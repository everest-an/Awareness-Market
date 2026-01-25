/**
 * API Purchase Flow
 * Enables AI agents to autonomously purchase vectors via API
 */

import express from 'express';
import Stripe from 'stripe';
import { getDb } from './db.js';
import { latentVectors, transactions, accessPermissions } from '../drizzle/schema.ts';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { validateApiKey as validateKey } from './api-key-manager.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-12-15.clover' });

/**
 * Authenticate API requests using real API key validation
 */
async function authenticateApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  const validation = await validateKey(apiKey);
  
  if (!validation.valid) {
    return res.status(401).json({ error: validation.error || 'Invalid API key' });
  }
  
  // Attach user info to request
  (req as any).userId = validation.userId;
  (req as any).apiKeyId = validation.keyId;
  (req as any).permissions = validation.permissions;
  next();
}

/**
 * POST /api/vectors/purchase
 * Purchase a vector capability
 */
router.post('/purchase', authenticateApiKey, async (req, res) => {
  try {
    const { vectorId, paymentMethodId } = req.body;
    
    if (!vectorId || !paymentMethodId) {
      return res.status(400).json({ 
        error: 'Missing required fields: vectorId, paymentMethodId' 
      });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database connection failed' });
    }
    
    // Get vector details
    const [vector] = await db
      .select()
      .from(latentVectors)
      .where(eq(latentVectors.id, vectorId))
      .limit(1);
    
    if (!vector) {
      return res.status(404).json({ error: 'Vector not found' });
    }
    
    if (vector.status !== 'active') {
      return res.status(400).json({ error: 'Vector is not available for purchase' });
    }

    // Get buyer info from authenticated API key
    const buyerId = (req as any).userId;
    
    // Calculate fees
    const amount = parseFloat(vector.basePrice);
    const platformFeeRate = 0.15; // 15%
    const platformFee = amount * platformFeeRate;
    const creatorEarnings = amount - platformFee;

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        vectorId: vectorId.toString(),
        buyerId: buyerId.toString(),
        vectorName: vector.title
      }
    });

    if (paymentIntent.status !== 'succeeded') {
      return res.status(402).json({ 
        error: 'Payment failed',
        status: paymentIntent.status 
      });
    }

    // Create transaction record
    const [transactionResult] = await db
      .insert(transactions)
      .values({
        buyerId,
        vectorId,
        amount: vector.basePrice,
        platformFee: platformFee.toFixed(2),
        creatorEarnings: creatorEarnings.toFixed(2),
        stripePaymentIntentId: paymentIntent.id,
        status: 'completed',
        transactionType: 'one-time'
      });

    const transactionId = (transactionResult as any).insertId;

    // Generate access token
    const accessToken = `vat_${crypto.randomBytes(32).toString('hex')}`;

    // Create access permission
    await db.insert(accessPermissions).values({
      userId: buyerId,
      vectorId,
      transactionId,
      accessToken,
      expiresAt: null, // Lifetime access
      callsRemaining: null, // Unlimited calls
      isActive: true
    });

    // Update vector statistics
    await db
      .update(latentVectors)
      .set({
        totalCalls: vector.totalCalls + 1,
        totalRevenue: (parseFloat(vector.totalRevenue) + amount).toFixed(2)
      })
      .where(eq(latentVectors.id, vectorId));

    // Return success with access token
    res.json({
      success: true,
      transactionId,
      accessToken,
      vector: {
        id: vector.id,
        title: vector.title,
        category: vector.category,
        modelArchitecture: vector.modelArchitecture,
        vectorDimension: vector.vectorDimension
      },
      payment: {
        amount,
        platformFee,
        creatorEarnings,
        stripePaymentIntentId: paymentIntent.id
      },
      access: {
        token: accessToken,
        expiresAt: null,
        callsRemaining: null
      },
      message: 'Purchase successful! Use the access token to invoke this vector.'
    });

  } catch (error: any) {
    console.error('[Purchase API] Error:', error);
    res.status(500).json({ 
      error: 'Purchase failed',
      message: error.message 
    });
  }
});

/**
 * GET /api/vectors/:id/pricing
 * Get pricing details for a vector
 */
router.get('/:id/pricing', async (req, res) => {
  try {
    const vectorId = parseInt(req.params.id);
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database connection failed' });
    }
    
    const [vector] = await db
      .select()
      .from(latentVectors)
      .where(eq(latentVectors.id, vectorId))
      .limit(1);
    
    if (!vector) {
      return res.status(404).json({ error: 'Vector not found' });
    }

    const amount = parseFloat(vector.basePrice);
    const platformFeeRate = 0.15;
    const platformFee = amount * platformFeeRate;
    const creatorEarnings = amount - platformFee;

    res.json({
      vectorId: vector.id,
      title: vector.title,
      pricing: {
        basePrice: amount,
        currency: 'USD',
        pricingModel: vector.pricingModel,
        platformFee,
        platformFeeRate,
        creatorEarnings,
        freeTrialCalls: vector.freeTrialCalls
      },
      paymentMethods: ['card', 'stripe'],
      refundPolicy: '30-day money-back guarantee'
    });

  } catch (error: any) {
    console.error('[Pricing API] Error:', error);
    res.status(500).json({ error: 'Failed to get pricing' });
  }
});

/**
 * POST /api/vectors/invoke
 * Invoke a purchased vector capability
 */
router.post('/invoke', authenticateApiKey, async (req, res) => {
  try {
    const { accessToken, vectorId, inputData } = req.body;
    
    if (!accessToken || !vectorId) {
      return res.status(400).json({ 
        error: 'Missing required fields: accessToken, vectorId' 
      });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database connection failed' });
    }
    
    // Verify access permission
    const [permission] = await db
      .select()
      .from(accessPermissions)
      .where(
        and(
          eq(accessPermissions.accessToken, accessToken),
          eq(accessPermissions.vectorId, vectorId),
          eq(accessPermissions.isActive, true)
        )
      )
      .limit(1);
    
    if (!permission) {
      return res.status(403).json({ error: 'Invalid access token or permission denied' });
    }

    // Check expiration
    if (permission.expiresAt && new Date(permission.expiresAt) < new Date()) {
      return res.status(403).json({ error: 'Access token expired' });
    }

    // Check calls remaining
    if (permission.callsRemaining !== null && permission.callsRemaining <= 0) {
      return res.status(403).json({ error: 'No calls remaining' });
    }

    // Get vector details
    const [vector] = await db
      .select()
      .from(latentVectors)
      .where(eq(latentVectors.id, vectorId))
      .limit(1);
    
    if (!vector) {
      return res.status(404).json({ error: 'Vector not found' });
    }

    // Simulate vector invocation (in production, load vector and run inference)
    const mockResult = {
      vectorId: vector.id,
      vectorName: vector.title,
      inputData,
      output: {
        result: 'Simulated vector output',
        confidence: 0.95,
        processingTime: 45
      },
      metadata: {
        modelArchitecture: vector.modelArchitecture,
        vectorDimension: vector.vectorDimension,
        timestamp: new Date().toISOString()
      }
    };

    // Update calls remaining
    if (permission.callsRemaining !== null) {
      await db
        .update(accessPermissions)
        .set({ callsRemaining: permission.callsRemaining - 1 })
        .where(eq(accessPermissions.id, permission.id));
    }

    // Update vector usage stats
    await db
      .update(latentVectors)
      .set({ totalCalls: vector.totalCalls + 1 })
      .where(eq(latentVectors.id, vectorId));

    res.json({
      success: true,
      ...mockResult,
      callsRemaining: permission.callsRemaining !== null 
        ? permission.callsRemaining - 1 
        : null
    });

  } catch (error: any) {
    console.error('[Invoke API] Error:', error);
    res.status(500).json({ 
      error: 'Invocation failed',
      message: error.message 
    });
  }
});

/**
 * GET /api/vectors/my-purchases
 * List purchased vectors for authenticated user
 */
router.get('/my-purchases', authenticateApiKey, async (req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: 'Database connection failed' });
    }
    const buyerId = (req as any).userId;
    
    const purchases = await db
      .select({
        transactionId: transactions.id,
        vectorId: latentVectors.id,
        vectorName: latentVectors.title,
        category: latentVectors.category,
        amount: transactions.amount,
        purchaseDate: transactions.createdAt,
        accessToken: accessPermissions.accessToken,
        callsRemaining: accessPermissions.callsRemaining,
        isActive: accessPermissions.isActive
      })
      .from(transactions)
      .innerJoin(latentVectors, eq(transactions.vectorId, latentVectors.id))
      .innerJoin(accessPermissions, eq(transactions.id, accessPermissions.transactionId))
      .where(eq(transactions.buyerId, buyerId))
      .orderBy(transactions.createdAt);

    res.json({
      success: true,
      purchases,
      total: purchases.length
    });

  } catch (error: any) {
    console.error('[My Purchases API] Error:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

export default router;
