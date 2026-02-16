/**
 * Reputation Decay Worker
 *
 * BullMQ cron: decays reputation for inactive agents every 12 hours.
 * Pattern: follows decay-worker.ts
 *
 * Reuses: reputation-engine.ts (decayInactive method)
 */

import { Worker, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { createReputationEngine } from '../reputation/reputation-engine';

const prisma = new PrismaClient();
const reputationEngine = createReputationEngine(prisma);

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const reputationDecayQueue = new Queue('reputation-decay', {
  connection: redisConnection,
});

// Schedule: every 12 hours
reputationDecayQueue.upsertJobScheduler(
  'reputation-decay-cron',
  { every: 12 * 60 * 60 * 1000 }, // 12h
  {
    name: 'reputation-decay-scan',
    data: {},
  }
);

const reputationDecayWorker = new Worker(
  'reputation-decay',
  async (job) => {
    console.log('[ReputationDecay Worker] Starting reputation decay scan...');

    // Get all organizations that have agents
    const orgs = await prisma.organization.findMany({
      select: { id: true },
    });

    let totalDecayed = 0;

    for (const org of orgs) {
      try {
        const decayed = await reputationEngine.decayInactive(
          org.id,
          30,  // 30 days inactive threshold
          0.02 // 2% daily decay rate after threshold
        );
        totalDecayed += decayed;
      } catch (error: any) {
        console.error(`[ReputationDecay Worker] Error for org ${org.id}:`, error.message);
      }
    }

    await job.updateProgress(100);

    console.log(`[ReputationDecay Worker] Decayed ${totalDecayed} agent reputations across ${orgs.length} orgs`);

    return {
      success: true,
      orgsScanned: orgs.length,
      totalDecayed,
    };
  },
  {
    connection: redisConnection,
    concurrency: 1,
    limiter: { max: 1, duration: 1000 },
  }
);

// Event handlers
reputationDecayWorker.on('completed', (job) => {
  console.log(`[ReputationDecay Worker] Completed job ${job.id}`);
});

reputationDecayWorker.on('failed', (job, err) => {
  console.error(`[ReputationDecay Worker] Failed job ${job?.id}:`, err.message);
});

reputationDecayWorker.on('error', (err) => {
  console.error('[ReputationDecay Worker] Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[ReputationDecay Worker] Shutting down...');
  await reputationDecayWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('[ReputationDecay Worker] Started and waiting for jobs...');

export { reputationDecayWorker };
