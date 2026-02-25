/**
 * Webhook Outbound Worker
 *
 * BullMQ worker that reliably delivers outbound webhook notifications
 * for workflow lifecycle events. Replaces the previous fire-and-forget
 * pattern with queued delivery, exponential backoff retry, and dead
 * letter handling.
 */

import { Worker, Queue } from 'bullmq';
import { prisma } from '../db-prisma';
import { dispatchWebhook, type WebhookPayload } from '../collaboration/webhook-dispatcher';
import { createLogger } from '../utils/logger';

const logger = createLogger('Worker:WebhookOutbound');

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// ─── Queue ───────────────────────────────────────────────────────────────────

export const webhookOutboundQueue = new Queue('webhook-outbound', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10_000, // 10s → 30s → 90s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: false, // Keep failed jobs for audit/debugging
  },
});

// ─── Worker ──────────────────────────────────────────────────────────────────

export const webhookOutboundWorker = new Worker(
  'webhook-outbound',
  async (job) => {
    const { webhookEventId, webhookUrl, webhookSecret, payload } = job.data as {
      webhookEventId: string;
      webhookUrl: string;
      webhookSecret: string | null;
      payload: WebhookPayload;
    };

    logger.info('Delivering outbound webhook', {
      jobId: job.id,
      event: payload.event,
      workflowId: payload.workflowId,
      attempt: job.attemptsMade + 1,
    });

    // Update audit record: processing + increment attempts
    try {
      await prisma.webhookEvent.update({
        where: { requestId: webhookEventId },
        data: {
          status: 'processing',
          attempts: job.attemptsMade + 1,
        },
      });
    } catch {
      // Audit update is non-critical — continue with delivery
    }

    // Deliver webhook using existing dispatch function
    const result = await dispatchWebhook(webhookUrl, webhookSecret, payload);

    if (!result.success) {
      // Update audit record with error info
      try {
        await prisma.webhookEvent.update({
          where: { requestId: webhookEventId },
          data: {
            error: result.error || `HTTP ${result.statusCode}`,
            statusCode: result.statusCode || null,
          },
        });
      } catch {
        // Non-critical
      }

      // Throw to trigger BullMQ retry
      throw new Error(
        `Webhook delivery failed: ${result.error || `HTTP ${result.statusCode}`}`,
      );
    }

    // Success — update audit record
    try {
      await prisma.webhookEvent.update({
        where: { requestId: webhookEventId },
        data: {
          status: 'delivered',
          statusCode: result.statusCode || 200,
          processedAt: new Date(),
        },
      });
    } catch {
      // Non-critical
    }

    logger.info('Outbound webhook delivered', {
      event: payload.event,
      workflowId: payload.workflowId,
      statusCode: result.statusCode,
    });

    return { success: true, statusCode: result.statusCode };
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 20,
      duration: 1000,
    },
  },
);

// ─── Event Handlers ──────────────────────────────────────────────────────────

webhookOutboundWorker.on('completed', (job) => {
  logger.debug('Outbound webhook job completed', { jobId: job?.id });
});

webhookOutboundWorker.on('failed', (job, err) => {
  const maxAttempts = job?.opts?.attempts ?? 3;
  const isFinalFailure = job && job.attemptsMade >= maxAttempts;

  if (isFinalFailure) {
    // Dead letter — mark as DLQ in audit record
    logger.error('Outbound webhook permanently failed (DLQ)', {
      jobId: job?.id,
      attempts: job?.attemptsMade,
      error: err.message,
    });

    const webhookEventId = job?.data?.webhookEventId;
    if (webhookEventId) {
      prisma.webhookEvent
        .update({
          where: { requestId: webhookEventId },
          data: { status: 'dlq', error: `DLQ after ${job?.attemptsMade} attempts: ${err.message}` },
        })
        .catch(() => {});
    }
  } else {
    logger.warn('Outbound webhook delivery attempt failed, will retry', {
      jobId: job?.id,
      attempt: job?.attemptsMade,
      error: err.message,
    });
  }
});
