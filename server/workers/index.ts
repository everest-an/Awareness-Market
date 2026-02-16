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

import { createLogger } from '../utils/logger';

const logger = createLogger('Workers');

let initialized = false;

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
      { rmcQueue },
      { decayQueue },
      { arbitrationQueue },
      { reputationDecayQueue },
      { verificationQueue },
    ] = await Promise.all([
      import('./rmc-worker'),
      import('./decay-worker'),
      import('./conflict-arbitration-worker'),
      import('./reputation-decay-worker'),
      import('./verification-worker'),
    ]);

    initialized = true;
    logger.info('All BullMQ workers initialized', {
      queues: [
        rmcQueue.name,
        decayQueue.name,
        arbitrationQueue.name,
        reputationDecayQueue.name,
        verificationQueue.name,
      ],
    });
  } catch (err: any) {
    logger.error('Failed to initialize workers — continuing without background jobs', {
      error: err.message,
    });
  }
}
