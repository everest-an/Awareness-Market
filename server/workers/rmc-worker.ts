/**
 * RMC Async Worker
 *
 * Background processor for entity extraction and relation building.
 * Prevents write latency by handling RMC processing asynchronously.
 */

import { Worker, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { createEntityExtractor, createRelationBuilder } from '../memory-core';

const prisma = new PrismaClient();

// Create RMC processing queue
export const rmcQueue = new Queue('rmc-processing', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

/**
 * RMC Worker: Processes memories asynchronously
 */
const rmcWorker = new Worker(
  'rmc-processing',
  async (job) => {
    const { memoryId, priority } = job.data;

    console.log(`[RMC Worker] Processing memory ${memoryId} (priority: ${priority || 'normal'})`);

    try {
      // 1. Fetch memory
      const memory = await prisma.memoryEntry.findUnique({
        where: { id: memoryId },
      });

      if (!memory) {
        throw new Error(`Memory ${memoryId} not found`);
      }

      // 2. Extract entities and create EntityTags
      const extractor = createEntityExtractor({
        enableLLM: process.env.RMC_ENABLE_LLM === 'true',
        openaiApiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL_ENTITY || 'gpt-4o-mini',
      });

      const extractionResult = await extractor.extract(memory.content);

      // 3. Upsert EntityTags and link to memory
      const entityTags = await Promise.all(
        extractionResult.entities.map(async (entity) => {
          const normalizedName = entity.name.toLowerCase().replace(/\s+/g, '_');

          return await prisma.entityTag.upsert({
            where: {
              normalizedName_type: {
                normalizedName,
                type: entity.type,
              },
            },
            update: {
              mentionCount: { increment: 1 },
              confidence: Math.max(entity.confidence, 0.5), // Update if higher
            },
            create: {
              name: entity.name,
              type: entity.type,
              normalizedName,
              confidence: entity.confidence,
              mentionCount: 1,
            },
          });
        })
      );

      // 4. Link EntityTags to Memory
      await prisma.memoryEntry.update({
        where: { id: memoryId },
        data: {
          entityTags: {
            connect: entityTags.map((tag) => ({ id: tag.id })),
          },
        },
      });

      console.log(`[RMC Worker] Linked ${entityTags.length} entities to memory ${memoryId}`);

      // 5. Build relations (with coarse filtering)
      const builder = createRelationBuilder(prisma, {
        enableLLM: process.env.RMC_ENABLE_LLM === 'true',
        openaiApiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL_RELATION || 'gpt-4o-mini',
        candidateLimit: 20,
        minEntityOverlap: 1,
        minVectorSimilarity: 0.75, // ✅ Coarse filter: only high similarity
        maxCandidateAge: 30, // Only check memories from last 30 days
      });

      const relationsCount = await builder.buildRelations(memoryId);

      console.log(`[RMC Worker] Created ${relationsCount} relations for memory ${memoryId}`);

      // 6. Update job progress
      await job.updateProgress(100);

      return {
        success: true,
        memoryId,
        entitiesExtracted: entityTags.length,
        relationsCreated: relationsCount,
      };
    } catch (error) {
      console.error(`[RMC Worker] Failed to process memory ${memoryId}:`, error);
      throw error; // Trigger retry
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: parseInt(process.env.RMC_WORKER_CONCURRENCY || '5'), // Process 5 jobs in parallel
    limiter: {
      max: 10, // Max 10 jobs per...
      duration: 1000, // ...1 second (rate limiting to avoid API throttling)
    },
  }
);

// Worker event handlers
rmcWorker.on('completed', (job) => {
  console.log(`[RMC Worker] ✅ Completed job ${job.id}`);
});

rmcWorker.on('failed', (job, err) => {
  console.error(`[RMC Worker] ❌ Failed job ${job?.id}:`, err.message);
});

rmcWorker.on('error', (err) => {
  console.error('[RMC Worker] Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[RMC Worker] Shutting down gracefully...');
  await rmcWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('[RMC Worker] Started and waiting for jobs...');

export { rmcWorker };
