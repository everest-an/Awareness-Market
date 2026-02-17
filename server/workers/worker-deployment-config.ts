/**
 * Worker Deployment Configuration
 *
 * Centralizes all worker configuration for easy deployment and monitoring.
 * Supports both BullMQ (recommended) and node-cron scheduling.
 *
 * Usage:
 *   import { startAllWorkers } from './workers/worker-deployment-config';
 *   await startAllWorkers();
 */

import { CronJob } from 'cron';
import { createLogger } from '../utils/logger';

const logger = createLogger('Workers');

// ============================================================================
// Worker Definitions
// ============================================================================

export interface WorkerConfig {
  name: string;
  description: string;
  enabled: boolean;
  schedule: string; // Cron expression
  envVar?: string; // Environment variable to enable/disable
  phase?: number; // v3.0 phase this worker belongs to
  priority: 'critical' | 'high' | 'medium' | 'low';
  timeout?: number; // Max execution time in ms
  handler: () => Promise<void>;
}

export const WORKERS: Record<string, WorkerConfig> = {
  // ==========================================================================
  // P1 Security Workers
  // ==========================================================================

  backup: {
    name: 'Backup Worker',
    description: 'Daily database backup to S3',
    enabled: true,
    schedule: '0 3 * * *', // Daily at 3 AM
    envVar: 'ENABLE_BACKUP_WORKER',
    priority: 'critical',
    timeout: 60 * 60 * 1000, // 1 hour
    handler: async () => {
      const { runBackupJob } = await import('./backup-worker');
      await runBackupJob();
    },
  },

  apiKeyRotation: {
    name: 'API Key Rotation Worker',
    description: 'Check API key expiration and rotate keys',
    enabled: true,
    schedule: '0 */6 * * *', // Every 6 hours
    envVar: 'ENABLE_KEY_ROTATION_WORKER',
    priority: 'high',
    timeout: 30 * 60 * 1000, // 30 minutes
    handler: async () => {
      const { runRotationJob } = await import('./api-key-rotation-worker');
      await runRotationJob();
    },
  },

  sessionCleanup: {
    name: 'Session Cleanup Worker',
    description: 'Clean up expired and idle sessions',
    enabled: true,
    schedule: '0 * * * *', // Every hour
    envVar: 'ENABLE_SESSION_CLEANUP_WORKER',
    priority: 'medium',
    timeout: 15 * 60 * 1000, // 15 minutes
    handler: async () => {
      const { runSessionCleanup } = await import('./session-cleanup-worker');
      await runSessionCleanup();
    },
  },

  // ==========================================================================
  // v3.0 Phase 1 Workers
  // ==========================================================================

  memoryDecay: {
    name: 'Memory Decay Worker',
    description: 'Process memory decay and archive low-score memories',
    enabled: true,
    schedule: '0 */6 * * *', // Every 6 hours
    envVar: 'ENABLE_MEMORY_DECAY_WORKER',
    phase: 1,
    priority: 'high',
    timeout: 45 * 60 * 1000, // 45 minutes
    handler: async () => {
      const { decayQueue } = await import('./decay-worker');
      await decayQueue.add('process-decay', { trigger: 'cron' });
    },
  },

  // ==========================================================================
  // v3.0 Phase 2 Workers
  // ==========================================================================

  conflictArbitration: {
    name: 'Conflict Arbitration Worker',
    description: 'Process high-severity memory conflicts with LLM arbitration',
    enabled: false, // Disabled by default (Phase 2 feature)
    schedule: '0 */4 * * *', // Every 4 hours
    envVar: 'ENABLE_CONFLICT_ARBITRATION_WORKER',
    phase: 2,
    priority: 'medium',
    timeout: 30 * 60 * 1000, // 30 minutes
    handler: async () => {
      const { arbitrationQueue } = await import('./conflict-arbitration-worker');
      await arbitrationQueue.add('process-conflicts', { trigger: 'cron' });
    },
  },

  // ==========================================================================
  // v3.0 Phase 3 Workers
  // ==========================================================================

  reputationDecay: {
    name: 'Reputation Decay Worker',
    description: 'Decay reputation for inactive agents',
    enabled: false, // Disabled by default (Phase 3 feature)
    schedule: '0 2 * * *', // Daily at 2 AM
    envVar: 'ENABLE_REPUTATION_DECAY_WORKER',
    phase: 3,
    priority: 'low',
    timeout: 20 * 60 * 1000, // 20 minutes
    handler: async () => {
      const { reputationDecayQueue } = await import('./reputation-decay-worker');
      await reputationDecayQueue.add('process-reputation-decay', { trigger: 'cron' });
    },
  },

  // ==========================================================================
  // v3.0 Phase 4 Workers
  // ==========================================================================

  verification: {
    name: 'Verification Worker',
    description: 'Assign verifiers and process verification requests',
    enabled: false, // Disabled by default (Phase 4 feature)
    schedule: '0 */2 * * *', // Every 2 hours
    envVar: 'ENABLE_VERIFICATION_WORKER',
    phase: 4,
    priority: 'medium',
    timeout: 30 * 60 * 1000, // 30 minutes
    handler: async () => {
      const { verificationQueue } = await import('./verification-worker');
      await verificationQueue.add('process-verification', { trigger: 'cron' });
    },
  },

  // ==========================================================================
  // Existing Workers
  // ==========================================================================

  rmcWorker: {
    name: 'RMC Worker',
    description: 'Resonant Memory Core processing',
    enabled: true,
    schedule: '*/15 * * * *', // Every 15 minutes
    envVar: 'ENABLE_RMC_WORKER',
    priority: 'medium',
    timeout: 10 * 60 * 1000, // 10 minutes
    handler: async () => {
      const { rmcQueue } = await import('./rmc-worker');
      await rmcQueue.add('process-rmc', { trigger: 'cron' });
    },
  },
};

// ============================================================================
// Worker Registry
// ============================================================================

const activeJobs = new Map<string, CronJob>();

/**
 * Check if a worker is enabled via environment variable
 */
function isWorkerEnabled(worker: WorkerConfig): boolean {
  // Check environment variable override
  if (worker.envVar) {
    const envValue = process.env[worker.envVar];
    if (envValue !== undefined) {
      return envValue === 'true' || envValue === '1';
    }
  }

  // Fall back to default enabled state
  return worker.enabled;
}

/**
 * Start a single worker
 */
export function startWorker(key: string): CronJob | null {
  const worker = WORKERS[key];
  if (!worker) {
    logger.error(`Unknown worker: ${key}`);
    return null;
  }

  if (!isWorkerEnabled(worker)) {
    logger.info(`Worker "${worker.name}" is disabled`);
    return null;
  }

  logger.info(`Starting worker: ${worker.name}`);
  logger.info(`  Schedule: ${worker.schedule}`);
  logger.info(`  Priority: ${worker.priority}`);

  const job = new CronJob(
    worker.schedule,
    async () => {
      const startTime = Date.now();
      logger.info(`[${worker.name}] Starting execution`);

      try {
        // Execute with timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Worker timeout')), worker.timeout || 30 * 60 * 1000);
        });

        await Promise.race([worker.handler(), timeoutPromise]);

        const duration = Date.now() - startTime;
        logger.info(`[${worker.name}] Completed in ${duration}ms`);
      } catch (error: any) {
        logger.error(`[${worker.name}] Failed:`, error);

        // TODO: Send alert for critical workers
        if (worker.priority === 'critical') {
          logger.error(`[${worker.name}] CRITICAL WORKER FAILED - ALERT REQUIRED`);
        }
      }
    },
    null, // onComplete
    false, // start immediately (we'll start manually)
    'America/Los_Angeles' // timezone
  );

  job.start();
  activeJobs.set(key, job);

  logger.info(`✅ Worker "${worker.name}" started`);
  return job;
}

/**
 * Stop a single worker
 */
export function stopWorker(key: string): void {
  const job = activeJobs.get(key);
  if (job) {
    job.stop();
    activeJobs.delete(key);
    logger.info(`Worker "${key}" stopped`);
  }
}

/**
 * Start all enabled workers
 */
export function startAllWorkers(): void {
  logger.info('Starting all enabled workers...');

  let started = 0;
  let skipped = 0;

  for (const [key, worker] of Object.entries(WORKERS)) {
    if (isWorkerEnabled(worker)) {
      startWorker(key);
      started++;
    } else {
      skipped++;
    }
  }

  logger.info(`✅ Started ${started} workers (${skipped} skipped/disabled)`);
}

/**
 * Stop all workers
 */
export function stopAllWorkers(): void {
  logger.info('Stopping all workers...');

  for (const key of activeJobs.keys()) {
    stopWorker(key);
  }

  logger.info('✅ All workers stopped');
}

/**
 * Get worker status
 */
export function getWorkerStatus(): Array<{
  key: string;
  name: string;
  enabled: boolean;
  running: boolean;
  schedule: string;
  priority: string;
  phase?: number;
}> {
  return Object.entries(WORKERS).map(([key, worker]) => ({
    key,
    name: worker.name,
    enabled: isWorkerEnabled(worker),
    running: activeJobs.has(key),
    schedule: worker.schedule,
    priority: worker.priority,
    phase: worker.phase,
  }));
}

/**
 * Get workers by phase
 */
export function getWorkersByPhase(phase: number): WorkerConfig[] {
  return Object.values(WORKERS).filter((w) => w.phase === phase);
}

/**
 * Get critical workers
 */
export function getCriticalWorkers(): WorkerConfig[] {
  return Object.values(WORKERS).filter((w) => w.priority === 'critical');
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, stopping workers...');
  stopAllWorkers();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, stopping workers...');
  stopAllWorkers();
  process.exit(0);
});

// ============================================================================
// Exports
// ============================================================================

export default {
  start: startWorker,
  startAll: startAllWorkers,
  stop: stopWorker,
  stopAll: stopAllWorkers,
  getStatus: getWorkerStatus,
  getByPhase: getWorkersByPhase,
  getCritical: getCriticalWorkers,
  WORKERS,
};
