/**
 * Worker Bootstrap
 *
 * Conditionally initializes all BullMQ workers when Redis is available.
 * Called from server startup to co-locate workers with the main process.
 *
 * Workers:
 * - rmc-worker: Entity extraction + relation building (on-demand)
 * - decay-worker: Memory score decay recalculation (every 6h)
 * - conflict-arbitration-worker: LLM conflict resolution (every 2h)
 * - reputation-decay-worker: Agent reputation decay (every 12h)
 * - verification-worker: Cross-domain peer review (every 2h)
 */

import type { Worker, Queue } from 'bullmq';
import { createLogger } from '../utils/logger';

const logger = createLogger('Workers');

let initialized = false;

// Worker and Queue instances tracked for clean shutdown
const activeWorkers: Worker[] = [];
const activeQueues: Queue[] = [];

/**
 * Initialize all BullMQ workers.
 * Safe to call multiple times — only runs once.
 * Skipped entirely if REDIS_HOST is not configured.
 */
export async function initializeWorkers(): Promise<void> {
  if (initialized) return;

  const redisHost = process.env.REDIS_HOST;
  if (!redisHost) {
    logger.warn('REDIS_HOST not set — BullMQ workers disabled');
    return;
  }

  try {
    // Dynamic imports to avoid crashing if Redis is unavailable
    const [
      { rmcQueue, rmcWorker },
      { decayQueue, decayWorker },
      { arbitrationQueue, arbitrationWorker },
      { reputationDecayQueue, reputationDecayWorker },
      { verificationQueue, verificationWorker },
      { webhookInboundQueue, webhookInboundWorker },
      { webhookOutboundQueue, webhookOutboundWorker },
    ] = await Promise.all([
      import('./rmc-worker'),
      import('./decay-worker'),
      import('./conflict-arbitration-worker'),
      import('./reputation-decay-worker'),
      import('./verification-worker'),
      import('./webhook-inbound-worker'),
      import('./webhook-outbound-worker'),
    ]);

    activeQueues.push(
      rmcQueue, decayQueue, arbitrationQueue, reputationDecayQueue, verificationQueue,
      webhookInboundQueue, webhookOutboundQueue,
    );
    activeWorkers.push(
      rmcWorker, decayWorker, arbitrationWorker, reputationDecayWorker, verificationWorker,
      webhookInboundWorker, webhookOutboundWorker,
    );

    // Register queues with webhook adapter for async routing
    try {
      const { setQueues } = await import('../collaboration/webhook-adapter');
      setQueues({ inbound: webhookInboundQueue, outbound: webhookOutboundQueue });
    } catch (err: any) {
      logger.warn('Failed to register webhook adapter queues', { error: err.message });
    }

    initialized = true;
    logger.info('All BullMQ workers initialized', {
      queues: [
        rmcQueue.name,
        decayQueue.name,
        arbitrationQueue.name,
        reputationDecayQueue.name,
        verificationQueue.name,
        webhookInboundQueue.name,
        webhookOutboundQueue.name,
      ],
    });
  } catch (err: any) {
    logger.error('Failed to initialize workers — continuing without background jobs', {
      error: err.message,
    });
  }
}

/**
 * Gracefully close all active workers and queues.
 * Called during server shutdown — waits for in-flight jobs to complete.
 */
export async function shutdownWorkers(): Promise<void> {
  if (!initialized || activeWorkers.length === 0) return;

  logger.info('Shutting down BullMQ workers...', { count: activeWorkers.length });

  // Close workers first (stops accepting new jobs, waits for current jobs)
  await Promise.allSettled(activeWorkers.map(w => w.close()));

  // Then close queues
  await Promise.allSettled(activeQueues.map(q => q.close()));

  logger.info('All BullMQ workers shut down');
}
