/**
 * Verification Worker
 *
 * BullMQ worker for:
 * 1. Auto-assigning verifiers to pending requests
 * 2. Expiring stale requests
 * 3. Auto-creating requests for strategic memories
 *
 * Pattern: follows decay-worker.ts
 */

import { Worker, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { createVerificationService } from '../verification/verification-service';

const prisma = new PrismaClient();
const verificationService = createVerificationService(prisma);

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const verificationQueue = new Queue('verification', {
  connection: redisConnection,
});

// Schedule: every 2 hours
verificationQueue.upsertJobScheduler(
  'verification-cron',
  { every: 2 * 60 * 60 * 1000 }, // 2h
  {
    name: 'verification-scan',
    data: {},
  }
);

const verificationWorker = new Worker(
  'verification',
  async (job) => {
    console.log('[Verification Worker] Starting verification scan...');

    const orgs = await prisma.organization.findMany({
      where: { enableVerification: true },
      select: { id: true },
    });

    let totalAssigned = 0;
    let totalExpired = 0;
    let totalCreated = 0;

    for (const org of orgs) {
      try {
        // 1. Expire stale requests
        const expired = await verificationService.expireStale();
        totalExpired += expired;

        // 2. Auto-create for strategic memories
        const created = await verificationService.autoCreateForStrategic(org.id);
        totalCreated += created;

        // 3. Auto-assign verifiers to pending requests
        const pending = await prisma.verificationRequest.findMany({
          where: { organizationId: org.id, status: 'pending' },
          take: 20,
        });

        for (const req of pending) {
          const assigned = await verificationService.assignVerifier(req.id);
          if (assigned) totalAssigned++;
        }
      } catch (error: any) {
        console.error(`[Verification Worker] Error for org ${org.id}:`, error.message);
      }
    }

    await job.updateProgress(100);

    console.log(`[Verification Worker] Done: ${totalCreated} created, ${totalAssigned} assigned, ${totalExpired} expired`);

    return {
      success: true,
      orgsScanned: orgs.length,
      totalCreated,
      totalAssigned,
      totalExpired,
    };
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

verificationWorker.on('completed', (job) => {
  console.log(`[Verification Worker] Completed job ${job.id}`);
});

verificationWorker.on('failed', (job, err) => {
  console.error(`[Verification Worker] Failed job ${job?.id}:`, err.message);
});

verificationWorker.on('error', (err) => {
  console.error('[Verification Worker] Worker error:', err);
});

process.on('SIGTERM', async () => {
  console.log('[Verification Worker] Shutting down...');
  await verificationWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('[Verification Worker] Started and waiting for jobs...');

export { verificationWorker };
