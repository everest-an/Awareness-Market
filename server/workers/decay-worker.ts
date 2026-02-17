/**
 * Memory Decay Worker
 *
 * BullMQ cron job that runs every 6 hours to:
 * 1. Recalculate decay multipliers for all active memories
 * 2. Auto-archive memories below the bronze threshold (score < 5)
 * 3. Apply MemoryType-specific λ values
 *
 * Reuses: scoring-engine.ts (calculateFinalScore, calculateDecayMultiplier)
 * Pattern: follows rmc-worker.ts BullMQ pattern
 */

import { Worker, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import {
  calculateBaseScore,
  calculateDecayMultiplier,
} from '../memory-core/scoring-engine';
import type { MemoryEntry } from '../memory-core/schema';
import { memoryGovernance } from '../memory-core/memory-governance';

const prisma = new PrismaClient();

// MemoryType → λ decay rate mapping (from plan spec)
const MEMORY_TYPE_DECAY: Record<string, number> = {
  episodic: 0.05,   // ~14 days half-life — short-term events
  semantic: 0.01,   // ~70 days half-life — general knowledge (default)
  strategic: 0.001, // ~693 days half-life — long-term strategic
  procedural: 0.02, // ~35 days half-life — process/how-to
};

const ARCHIVE_THRESHOLD = 5; // Final score below this → auto-archive
const BATCH_SIZE = 500;

// Redis connection config (reused from rmc-worker.ts)
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Create queue with repeatable cron job
export const decayQueue = new Queue('memory-decay', {
  connection: redisConnection,
});

// Schedule the cron job (every 6 hours)
async function scheduleDecayCron() {
  await decayQueue.upsertJobScheduler(
    'decay-cron',
    { pattern: '0 */6 * * *' }, // Every 6 hours
    {
      name: 'process-decay',
      data: { trigger: 'cron' },
    },
  );
  console.log('[Decay Worker] Cron scheduled: every 6 hours');
}

/**
 * Convert Prisma MemoryEntry to scoring-engine MemoryEntry interface
 */
function toScoringEntry(dbEntry: any): MemoryEntry {
  return {
    id: dbEntry.id,
    org_id: dbEntry.orgId,
    namespace: dbEntry.namespace,
    content_type: dbEntry.contentType,
    content: dbEntry.content,
    confidence: Number(dbEntry.confidence),
    reputation: Number(dbEntry.reputation),
    usage_count: dbEntry.usageCount,
    validation_count: dbEntry.validationCount,
    version: dbEntry.version,
    is_latest: dbEntry.isLatest,
    created_by: dbEntry.createdBy,
    created_at: dbEntry.createdAt,
    updated_at: dbEntry.updatedAt,
    accessed_at: dbEntry.accessedAt,
    decay_factor: Number(dbEntry.decayFactor),
    decay_checkpoint: dbEntry.decayCheckpoint,
  };
}

/**
 * Decay Worker: Processes memory scores in batches
 */
const decayWorker = new Worker(
  'memory-decay',
  async (job) => {
    console.log(`[Decay Worker] Starting decay recalculation (trigger: ${job.data.trigger})`);
    const startTime = Date.now();

    let totalProcessed = 0;
    let totalArchived = 0;
    let cursor: string | undefined;

    // Process in batches using cursor-based pagination
    while (true) {
      const memories = await prisma.memoryEntry.findMany({
        where: { isLatest: true },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: {
          id: true,
          orgId: true,
          namespace: true,
          contentType: true,
          content: true,
          confidence: true,
          reputation: true,
          usageCount: true,
          validationCount: true,
          version: true,
          isLatest: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          accessedAt: true,
          decayFactor: true,
          decayCheckpoint: true,
          memoryType: true,
        },
      });

      if (memories.length === 0) break;

      // Process batch
      const scoreUpdates: { memoryId: string; baseScore: number; decayMultiplier: number; finalScore: number }[] = [];
      const archiveIds: string[] = [];

      for (const memory of memories) {
        // Apply MemoryType-specific λ if the decayFactor hasn't been customized
        const expectedLambda = MEMORY_TYPE_DECAY[memory.memoryType] || 0.01;
        const scoringEntry = toScoringEntry(memory);

        // Use MemoryType λ for decay calculation
        scoringEntry.decay_factor = expectedLambda;

        const baseScore = calculateBaseScore(scoringEntry);
        const decayMultiplier = calculateDecayMultiplier(scoringEntry);
        const finalScore = baseScore * decayMultiplier;

        scoreUpdates.push({
          memoryId: memory.id,
          baseScore: Math.round(baseScore * 100) / 100,
          decayMultiplier: Math.round(decayMultiplier * 10000) / 10000,
          finalScore: Math.round(finalScore * 100) / 100,
        });

        // Auto-archive if below threshold
        if (finalScore < ARCHIVE_THRESHOLD) {
          archiveIds.push(memory.id);
        }
      }

      // Batch upsert scores
      await Promise.all(
        scoreUpdates.map((s) =>
          prisma.memoryScore.upsert({
            where: { memoryId: s.memoryId },
            update: {
              baseScore: s.baseScore,
              decayMultiplier: s.decayMultiplier,
              finalScore: s.finalScore,
              lastCalculated: new Date(),
            },
            create: {
              memoryId: s.memoryId,
              baseScore: s.baseScore,
              decayMultiplier: s.decayMultiplier,
              finalScore: s.finalScore,
            },
          })
        )
      );

      // Archive low-score memories (set isLatest = false, mark as expired)
      if (archiveIds.length > 0) {
        await prisma.memoryEntry.updateMany({
          where: { id: { in: archiveIds } },
          data: { isLatest: false, expiresAt: new Date() },
        });
        totalArchived += archiveIds.length;
      }

      totalProcessed += memories.length;
      cursor = memories[memories.length - 1].id;

      // Report progress
      await job.updateProgress(Math.min(95, totalProcessed));
    }

    // ✅ Governance: enforce retention policies for all configured org+namespace pairs
    let retentionResult = { policiesProcessed: 0, totalExpired: 0, totalTrimmed: 0 };
    try {
      retentionResult = await memoryGovernance.enforceAllRetentionPolicies();
    } catch (retentionErr: any) {
      console.error('[Decay Worker] Retention policy enforcement error (non-critical):', retentionErr.message);
    }

    const duration = Date.now() - startTime;
    await job.updateProgress(100);

    console.log(`[Decay Worker] Completed: ${totalProcessed} processed, ${totalArchived} archived, ` +
      `${retentionResult.totalExpired} policy-expired, ${retentionResult.totalTrimmed} policy-trimmed (${duration}ms)`);

    return {
      success: true,
      totalProcessed,
      totalArchived,
      retentionPolicies: retentionResult,
      durationMs: duration,
    };
  },
  {
    connection: redisConnection,
    concurrency: 1, // Single worker for cron job
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

// Worker event handlers
decayWorker.on('completed', (job) => {
  console.log(`[Decay Worker] Completed job ${job.id}`);
});

decayWorker.on('failed', (job, err) => {
  console.error(`[Decay Worker] Failed job ${job?.id}:`, err.message);
});

decayWorker.on('error', (err) => {
  console.error('[Decay Worker] Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Decay Worker] Shutting down gracefully...');
  await decayWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

// Schedule cron on startup
scheduleDecayCron().catch(console.error);

console.log('[Decay Worker] Started and waiting for jobs...');

export { decayWorker };
