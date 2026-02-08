/**
 * API Purchase Flow
 * Enables AI agents to autonomously purchase vectors via API
 */

import express from 'express';
import Stripe from 'stripe';
import { prisma } from './db-prisma';
import crypto from 'crypto';
import { validateApiKey as validateKey } from './api-key-manager';
import { getErrorMessage } from './utils/error-handling';
import { createLogger } from './utils/logger';
import { runVector } from './vector-runtime';

const logger = createLogger('Purchase:API');
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-12-15.clover' });

// Type extension for authenticated requests
interface PurchaseAuthenticatedRequest extends express.Request {
  userId: number;
  apiKeyId: number;
  permissions: string[];
}


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
  (req as PurchaseAuthenticatedRequest).userId = validation.userId!;
  (req as PurchaseAuthenticatedRequest).apiKeyId = validation.keyId!;
  (req as PurchaseAuthenticatedRequest).permissions = validation.permissions!;
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

    // Get vector details
    const vector = await prisma.latentVector.findUnique({
      where: { id: vectorId }
    });

    if (!vector) {
      return res.status(404).json({ error: 'Vector not found' });
    }

    if (vector.status !== 'active') {
      return res.status(400).json({ error: 'Vector is not available for purchase' });
    }

    // Get buyer info from authenticated API key
    const buyerId = (req as PurchaseAuthenticatedRequest).userId;
    
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
    const transaction = await prisma.transaction.create({
      data: {
        buyerId,
        vectorId,
        amount: vector.basePrice,
        platformFee: platformFee.toFixed(2),
        creatorEarnings: creatorEarnings.toFixed(2),
        stripePaymentIntentId: paymentIntent.id,
        status: 'completed',
        transactionType: 'one-time'
      }
    });

    const transactionId = transaction.id;

    // Generate access token
    const accessToken = `vat_${crypto.randomBytes(32).toString('hex')}`;

    // Create access permission
    await prisma.accessPermission.create({
      data: {
        userId: buyerId,
        vectorId,
        transactionId,
        accessToken,
        expiresAt: null, // Lifetime access
        callsRemaining: null, // Unlimited calls
        isActive: true
      }
    });

    // Update vector statistics
    await prisma.latentVector.update({
      where: { id: vectorId },
      data: {
        totalCalls: vector.totalCalls + 1,
        totalRevenue: (parseFloat(vector.totalRevenue) + amount).toFixed(2)
      }
    });

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

  } catch (error: unknown) {
    logger.error('Purchase failed', { error: getErrorMessage(error), vectorId: req.body.vectorId });
    res.status(500).json({
      error: 'Purchase failed',
      message: getErrorMessage(error)
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

    const vector = await prisma.latentVector.findUnique({
      where: { id: vectorId }
    });

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

  } catch (error: unknown) {
    logger.error('Failed to get pricing', { error: getErrorMessage(error), vectorId: req.params.id });
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

    // Verify access permission
    const permission = await prisma.accessPermission.findFirst({
      where: {
        accessToken,
        vectorId,
        isActive: true
      }
    });

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
    const vector = await prisma.latentVector.findUnique({
      where: { id: vectorId }
    });

    if (!vector) {
      return res.status(404).json({ error: 'Vector not found' });
    }

    const runtimeResult = await runVector({
      vector,
      context: inputData,
    });

    const executionResult = {
      vectorId: vector.id,
      vectorName: vector.title,
      inputData,
      output: {
        result: runtimeResult.text,
        model: runtimeResult.model,
        usage: runtimeResult.usage,
        processingTimeMs: runtimeResult.processingTimeMs,
      },
      metadata: {
        modelArchitecture: vector.modelArchitecture,
        vectorDimension: vector.vectorDimension,
        timestamp: new Date().toISOString(),
      },
    };

    // Update calls remaining
    if (permission.callsRemaining !== null) {
      await prisma.accessPermission.update({
        where: { id: permission.id },
        data: { callsRemaining: permission.callsRemaining - 1 }
      });
    }

    // Update vector usage stats
    await prisma.latentVector.update({
      where: { id: vectorId },
      data: { totalCalls: vector.totalCalls + 1 }
    });

    res.json({
      success: true,
      ...executionResult,
      callsRemaining: permission.callsRemaining !== null 
        ? permission.callsRemaining - 1 
        : null
    });

  } catch (error: unknown) {
    logger.error('Invocation failed', { error: getErrorMessage(error) });
    res.status(500).json({
      error: 'Invocation failed',
      message: 'An internal error occurred while processing the invocation'
    });
  }
});

/**
 * GET /api/vectors/my-purchases
 * List purchased vectors for authenticated user
 */
router.get('/my-purchases', authenticateApiKey, async (req, res) => {
  try {
    const buyerId = (req as PurchaseAuthenticatedRequest).userId;

    // Use raw SQL for complex join query
    const purchases = await prisma.$queryRaw<Array<{
      transactionId: number;
      vectorId: number;
      vectorName: string;
      category: string;
      amount: string;
      purchaseDate: Date;
      accessToken: string;
      callsRemaining: number | null;
      isActive: boolean;
    }>>`
      SELECT
        t.id as "transactionId",
        v.id as "vectorId",
        v.title as "vectorName",
        v.category,
        t.amount,
        t.created_at as "purchaseDate",
        ap.access_token as "accessToken",
        ap.calls_remaining as "callsRemaining",
        ap.is_active as "isActive"
      FROM transactions t
      INNER JOIN latent_vectors v ON t.vector_id = v.id
      INNER JOIN access_permissions ap ON t.id = ap.transaction_id
      WHERE t.buyer_id = ${buyerId}
      ORDER BY t.created_at DESC
    `;

    res.json({
      success: true,
      purchases,
      total: purchases.length
    });

  } catch (error: unknown) {
    logger.error('Failed to fetch purchases', { error: getErrorMessage(error), userId: (req as PurchaseAuthenticatedRequest).userId });
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

export default router;
