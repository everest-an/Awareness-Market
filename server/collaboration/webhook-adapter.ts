/**
 * Webhook Adapter Layer
 *
 * Sits between external webhook requests and the MCP core communication layer.
 * Provides: request validation, format conversion, async decoupling via BullMQ,
 * idempotency, and audit logging — so external webhooks never directly interfere
 * with Agent-to-Agent MCP sync communication.
 */

import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../db-prisma';
import { createLogger } from '../utils/logger';
import type { WebhookEventType, WebhookPayload } from './webhook-dispatcher';
import { dispatchWebhook } from './webhook-dispatcher';

const logger = createLogger('Webhook:Adapter');

// ─── Types ───────────────────────────────────────────────────────────────────

export type WebhookAction = 'propose' | 'execute' | 'stop' | 'sync' | 'tool';

export interface InboundWebhookPayload {
  workflowId: string;
  action: WebhookAction;
  data?: Record<string, unknown>;
  toolName?: string;
  requestId?: string;
}

export interface AdapterResult {
  success: boolean;
  requestId: string;
  message: string;
  queuedJobId?: string;
}

/** Zod schema for inbound payload validation */
const inboundPayloadSchema = z.object({
  workflowId: z.string().min(1).max(64),
  action: z.enum(['propose', 'execute', 'stop', 'sync', 'tool']),
  data: z.record(z.string(), z.unknown()).optional(),
  toolName: z.string().max(64).optional(),
  requestId: z.string().max(64).optional(),
}).refine(
  (val) => val.action !== 'tool' || (val.toolName && val.toolName.length > 0),
  { message: 'toolName is required when action is "tool"', path: ['toolName'] },
);

// Valid MCP tool names that can be invoked via webhook
const VALID_MCP_TOOLS = new Set([
  'share_reasoning',
  'propose_shared_decision',
  'sync_progress',
  'ask_question',
  'assign_task',
  'update_task',
  'share_artifact',
]);

/** Max age (seconds) for inbound signature timestamps — 5 minutes */
const MAX_SIGNATURE_AGE_SECONDS = 300;

// ─── Signature Verification ──────────────────────────────────────────────────

/**
 * Verify HMAC-SHA256 signature on an inbound webhook request.
 * Header format: `t=<unix_timestamp>,v1=<hmac_hex>`
 * Signs: `${timestamp}.${rawBody}`
 */
export function verifyInboundSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  try {
    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(',')) {
      const [key, value] = part.split('=', 2);
      if (key && value) parts[key.trim()] = value.trim();
    }

    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) return false;

    // Replay protection: reject if timestamp > 5 minutes old
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (isNaN(age) || age > MAX_SIGNATURE_AGE_SECONDS || age < -60) return false;

    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${bodyStr}`)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ─── Payload Validation ──────────────────────────────────────────────────────

export function validateInboundPayload(body: unknown): {
  valid: boolean;
  parsed?: InboundWebhookPayload;
  errors?: string[];
} {
  const result = inboundPayloadSchema.safeParse(body);
  if (result.success) {
    return { valid: true, parsed: result.data as InboundWebhookPayload };
  }
  return {
    valid: false,
    errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}

// ─── Enqueue Helpers ─────────────────────────────────────────────────────────

/** BullMQ queue references — lazily initialized from workers */
let inboundQueue: any = null;
let outboundQueue: any = null;

/**
 * Set queue references. Called by workers/index.ts after queues are created.
 */
export function setQueues(opts: { inbound?: any; outbound?: any }) {
  if (opts.inbound) inboundQueue = opts.inbound;
  if (opts.outbound) outboundQueue = opts.outbound;
}

/**
 * Check if BullMQ queues are available (Redis connected).
 */
export function isQueueAvailable(): boolean {
  return !!outboundQueue;
}

/**
 * Enqueue an inbound webhook for async processing.
 * Creates an audit record and adds the job to the webhook-inbound BullMQ queue.
 */
export async function enqueueInbound(
  payload: InboundWebhookPayload,
  sourceIp: string | undefined,
): Promise<AdapterResult> {
  const requestId = payload.requestId || crypto.randomUUID();

  // Idempotency check
  const existing = await prisma.webhookEvent.findUnique({
    where: { requestId },
  });
  if (existing) {
    return {
      success: true,
      requestId,
      message: 'Request already processed (idempotent)',
    };
  }

  // Create audit record
  await prisma.webhookEvent.create({
    data: {
      workflowId: payload.workflowId,
      direction: 'inbound',
      event: `webhook.${payload.action}`,
      action: payload.action,
      requestId,
      payload: payload as any,
      status: 'pending',
      sourceIp: sourceIp || null,
    },
  });

  // Enqueue to BullMQ
  if (!inboundQueue) {
    logger.warn('Inbound queue not available (Redis down?) — cannot process webhook');
    await prisma.webhookEvent.update({
      where: { requestId },
      data: { status: 'failed', error: 'Queue unavailable (Redis not connected)' },
    });
    return { success: false, requestId, message: 'Service temporarily unavailable' };
  }

  const job = await inboundQueue.add('process-inbound', {
    requestId,
    workflowId: payload.workflowId,
    action: payload.action,
    data: payload.data,
    toolName: payload.toolName,
  }, {
    jobId: requestId, // BullMQ-level dedup
    removeOnComplete: { count: 500 },
    removeOnFail: false,
  });

  logger.info('Inbound webhook enqueued', { requestId, action: payload.action, workflowId: payload.workflowId });

  return {
    success: true,
    requestId,
    message: 'Queued for processing',
    queuedJobId: job.id,
  };
}

/**
 * Enqueue an outbound webhook for reliable delivery with retry.
 * Creates an audit record and adds the job to the webhook-outbound BullMQ queue.
 * Falls back to direct dispatch if Redis is unavailable.
 */
export function enqueueOutbound(
  workflowId: string,
  webhookUrl: string | undefined | null,
  webhookSecret: string | undefined | null,
  event: WebhookEventType,
  data: Record<string, unknown>,
): void {
  if (!webhookUrl) return;

  const requestId = crypto.randomUUID();
  const payload: WebhookPayload = {
    event,
    workflowId,
    timestamp: new Date().toISOString(),
    data,
  };

  // Try queueing; fall back to direct dispatch
  if (outboundQueue) {
    // Fire-and-forget audit + enqueue (non-blocking)
    (async () => {
      try {
        await prisma.webhookEvent.create({
          data: {
            workflowId,
            direction: 'outbound',
            event,
            requestId,
            payload: payload as any,
            status: 'pending',
          },
        });

        await outboundQueue.add('deliver-outbound', {
          webhookEventId: requestId,
          webhookUrl,
          webhookSecret: webhookSecret || null,
          payload,
        }, {
          jobId: requestId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: false,
        });

        logger.debug('Outbound webhook enqueued', { requestId, event, workflowId });
      } catch (err: any) {
        logger.error('Failed to enqueue outbound webhook, falling back to direct dispatch', { error: err.message });
        dispatchWebhook(webhookUrl, webhookSecret || null, payload).catch(() => {});
      }
    })();
  } else {
    // Redis not available — graceful degradation to direct dispatch
    logger.debug('Outbound queue unavailable, dispatching directly', { event, workflowId });
    dispatchWebhook(webhookUrl, webhookSecret || null, payload).catch((err) => {
      logger.error('Direct webhook dispatch failed', { workflowId, event, error: err });
    });
  }
}

// ─── Format Conversion ──────────────────────────────────────────────────────

export interface InternalCommand {
  type: WebhookAction;
  workflowId: string;
  data: Record<string, unknown>;
  toolName?: string;
}

/**
 * Convert an inbound webhook payload into an internal command
 * that the worker can execute against the collaboration engine.
 */
export function convertToInternalCommand(payload: {
  workflowId: string;
  action: WebhookAction;
  data?: Record<string, unknown>;
  toolName?: string;
}): InternalCommand {
  return {
    type: payload.action,
    workflowId: payload.workflowId,
    data: payload.data || {},
    toolName: payload.toolName,
  };
}

/**
 * Validate that a tool name is a known MCP collaboration tool.
 */
export function isValidMcpTool(toolName: string): boolean {
  return VALID_MCP_TOOLS.has(toolName);
}
