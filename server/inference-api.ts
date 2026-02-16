/**
 * Inference API - REST endpoints for AI-to-AI inference tracking
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { inferenceTracker } from './inference-tracker';
import { alignVector, transformDimension } from './latentmas-core';
import { z } from 'zod';
import { getErrorMessage } from './utils/error-handling';
import { validateApiKey } from './api-key-manager';

const inferenceRouter = Router();

/**
 * Authentication middleware for inference API
 * Validates API key from Authorization header or x-api-key header
 * Skips auth for /health endpoint
 */
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Skip auth for health check
  if (req.path === '/health') return next();

  const apiKey = req.headers['x-api-key'] as string || 
                 (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!apiKey) {
    return res.status(401).json({ error: 'Authentication required. Provide API key via x-api-key header or Bearer token.' });
  }

  const result = await validateApiKey(apiKey);
  if (!result.valid) {
    return res.status(401).json({ error: result.error || 'Invalid API key' });
  }

  (req as any).userId = result.userId;
  next();
}

// Apply auth middleware to all routes
inferenceRouter.use(requireAuth);

/**
 * Start a new inference session
 * POST /api/inference/session
 */
inferenceRouter.post('/session', async (req, res) => {
  try {
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      userId: z.number().optional(),
    });

    const data = schema.parse(req.body);
    const session = inferenceTracker.createSession(data);

    res.json({ success: true, session });
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/**
 * Get inference session
 * GET /api/inference/session/:id
 */
inferenceRouter.get('/session/:id', (req, res) => {
  const session = inferenceTracker.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ success: true, session });
});

/**
 * Get all active sessions
 * GET /api/inference/sessions
 */
inferenceRouter.get('/sessions', (req, res) => {
  const sessions = inferenceTracker.getActiveSessions();
  res.json({ success: true, sessions });
});

/**
 * Track vector alignment with visualization
 * POST /api/inference/align
 */
inferenceRouter.post('/align', async (req, res) => {
  try {
    const schema = z.object({
      sessionId: z.string(),
      sourceVector: z.array(z.number()),
      sourceModel: z.string(),
      targetModel: z.string(),
      method: z.enum(['linear', 'nonlinear', 'learned']).default('linear'),
    });

    const data = schema.parse(req.body);

    // Perform actual alignment
    const result = alignVector(
      data.sourceVector,
      data.sourceModel,
      data.targetModel,
      data.method
    );

    // Track in inference session
    const tracked = inferenceTracker.trackAlignment(data.sessionId, {
      sourceModel: data.sourceModel,
      targetModel: data.targetModel,
      inputVector: data.sourceVector,
      outputVector: result.alignedVector,
      quality: {
        epsilon: 1 - result.quality.cosineSimilarity, // Convert similarity to loss
        informationRetention: result.quality.confidence,
        cosineSimilarity: result.quality.cosineSimilarity,
        euclideanDistance: result.quality.euclideanDistance,
        confidence: result.quality.confidence,
      },
      wMatrix: {
        id: `wm-${data.sourceModel}-${data.targetModel}`,
        method: data.method,
      },
      duration: result.metadata.processingTimeMs,
    });

    res.json({
      success: true,
      alignedVector: result.alignedVector,
      quality: result.quality,
      metadata: result.metadata,
      event: tracked?.event,
      edge: tracked?.edge,
    });
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/**
 * Track dimension transformation with visualization
 * POST /api/inference/transform
 */
inferenceRouter.post('/transform', async (req, res) => {
  try {
    const schema = z.object({
      sessionId: z.string(),
      vector: z.array(z.number()),
      sourceModel: z.string(),
      targetDimension: z.number().int().positive(),
      method: z.enum(['pca', 'autoencoder', 'interpolation']).default('pca'),
    });

    const data = schema.parse(req.body);

    // Perform actual transformation
    const result = transformDimension(
      data.vector,
      data.targetDimension,
      data.method
    );

    // Track in inference session
    const event = inferenceTracker.trackTransformation(data.sessionId, {
      sourceModel: data.sourceModel,
      inputDimension: data.vector.length,
      outputDimension: data.targetDimension,
      method: data.method,
      quality: {
        informationRetention: result.quality.informationRetained,
        reconstructionError: result.quality.reconstructionError,
      },
      duration: result.metadata.processingTimeMs,
    });

    res.json({
      success: true,
      transformedVector: result.transformedVector,
      quality: result.quality,
      metadata: result.metadata,
      event,
    });
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/**
 * Complete inference session
 * POST /api/inference/session/:id/complete
 */
inferenceRouter.post('/session/:id/complete', (req, res) => {
  const status = req.body.status === 'failed' ? 'failed' : 'completed';
  const session = inferenceTracker.completeSession(req.params.id, status);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({ success: true, session });
});

/**
 * Start demo session
 * POST /api/inference/demo
 */
inferenceRouter.post('/demo', (req, res) => {
  const session = inferenceTracker.generateDemoSession();
  res.json({ success: true, session });
});

/**
 * Health check
 * GET /api/inference/health
 */
inferenceRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    activeSessions: inferenceTracker.getActiveSessions().length,
    timestamp: new Date().toISOString(),
  });
});

export default inferenceRouter;
