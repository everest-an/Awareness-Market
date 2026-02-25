/**
 * Inbound Webhook Express Endpoint
 *
 * External systems POST here to trigger workflow actions (propose/execute/stop/sync/tool).
 * Uses raw body for HMAC-SHA256 signature verification, rate limiting, and async
 * enqueuing via BullMQ — external requests never directly touch MCP communication.
 *
 * Registered BEFORE express.json() in server/_core/index.ts (same pattern as Stripe webhook).
 */

import { Router, Request, Response } from 'express';
import express from 'express';
import { createRateLimiter } from '../rate-limiter';
import * as workflowDb from '../db-workflows';
import {
  verifyInboundSignature,
  validateInboundPayload,
  enqueueInbound,
  isQueueAvailable,
} from '../collaboration/webhook-adapter';
import { createLogger } from '../utils/logger';

const logger = createLogger('Webhook:Inbound');

// 30 inbound webhook requests per minute per IP
const webhookInboundLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: 'Webhook rate limit exceeded. Try again later.',
});

const router = Router();

// Raw body parser for HMAC signature verification
router.use(express.raw({ type: 'application/json' }));

router.post('/', webhookInboundLimiter, async (req: Request, res: Response) => {
  try {
    // 1. Parse raw body
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(req.body || '');
    const bodyStr = rawBody.toString('utf-8');

    if (!bodyStr || bodyStr.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_BODY', message: 'Request body is required' },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyStr);
    } catch {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' },
      });
    }

    // 2. Validate payload schema
    const validation = validateInboundPayload(parsed);
    if (!validation.valid || !validation.parsed) {
      logger.warn('Inbound webhook validation failed', { errors: validation.errors, ip: req.ip });
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid webhook payload',
          details: validation.errors,
        },
      });
    }

    const payload = validation.parsed;

    // 3. Lookup workflow to get webhook secret
    const workflow = await workflowDb.getWorkflow(payload.workflowId);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found' },
      });
    }

    if (!workflow.webhookSecret) {
      return res.status(403).json({
        success: false,
        error: { code: 'WEBHOOK_NOT_CONFIGURED', message: 'Webhook is not configured for this workflow' },
      });
    }

    // 4. Verify HMAC-SHA256 signature
    const signatureHeader = req.headers['x-webhook-signature'] as string | undefined;
    if (!verifyInboundSignature(rawBody, signatureHeader, workflow.webhookSecret)) {
      logger.warn('Inbound webhook signature verification failed', {
        workflowId: payload.workflowId,
        ip: req.ip,
      });
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' },
      });
    }

    // 5. Check queue availability
    if (!isQueueAvailable()) {
      logger.error('Webhook inbound queue unavailable (Redis not connected)');
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Webhook processing temporarily unavailable. Try again later.',
          retryAfter: 30,
        },
      });
    }

    // 6. Enqueue for async processing
    const result = await enqueueInbound(payload, req.ip || undefined);

    if (!result.success) {
      return res.status(503).json({
        success: false,
        error: { code: 'ENQUEUE_FAILED', message: result.message },
      });
    }

    // 7. Return 202 Accepted (async processing)
    return res.status(202).json({
      success: true,
      requestId: result.requestId,
      message: result.message,
    });
  } catch (err: any) {
    logger.error('Inbound webhook handler error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
});

export default router;
