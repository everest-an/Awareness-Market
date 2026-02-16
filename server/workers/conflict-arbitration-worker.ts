/**
 * Conflict Arbitration Worker
 *
 * BullMQ worker for high/critical severity conflict resolution via LLM.
 * Pattern: follows rmc-worker.ts and decay-worker.ts
 *
 * Reuses: semantic-conflict-detector.ts (LLM prompting pattern)
 * Reuses: relation-builder.ts (impact propagation via MemoryRelation graph)
 */

import { Worker, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { invokeLLM } from '../llm-aws';

const prisma = new PrismaClient();

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const arbitrationQueue = new Queue('conflict-arbitration', {
  connection: redisConnection,
});

/**
 * Classify conflict severity based on memory properties
 */
function classifySeverity(conflict: any): 'low' | 'medium' | 'high' | 'critical' {
  const m1 = conflict.memory1;
  const m2 = conflict.memory2;

  // Critical: cross-department + both high-confidence strategic memories
  if (m1.department !== m2.department && m1.memoryType === 'strategic' && m2.memoryType === 'strategic') {
    return 'critical';
  }

  // High: both high confidence (>0.8) or high usage (>20)
  const avgConfidence = (Number(m1.confidence) + Number(m2.confidence)) / 2;
  const maxUsage = Math.max(m1.usageCount, m2.usageCount);
  if (avgConfidence > 0.8 && maxUsage > 20) {
    return 'high';
  }

  // Low: both low confidence (<0.5) or low usage (<3)
  if (avgConfidence < 0.5 || maxUsage < 3) {
    return 'low';
  }

  return 'medium';
}

/**
 * Auto-resolve low-severity conflicts
 * Strategy: keep the memory with higher final score
 */
async function autoResolve(conflictId: string): Promise<boolean> {
  const conflict = await prisma.memoryConflict.findUnique({
    where: { id: conflictId },
    include: {
      memory1: { include: { score: true } },
      memory2: { include: { score: true } },
    },
  });

  if (!conflict) return false;

  const score1 = conflict.memory1.score ? Number(conflict.memory1.score.finalScore) : 0;
  const score2 = conflict.memory2.score ? Number(conflict.memory2.score.finalScore) : 0;

  const winnerId = score1 >= score2 ? conflict.memoryId1 : conflict.memoryId2;

  await prisma.memoryConflict.update({
    where: { id: conflictId },
    data: {
      status: 'resolved',
      resolutionMemoryId: winnerId,
      resolvedAt: new Date(),
      resolvedBy: 'auto-resolver',
      explanation: `Auto-resolved: higher-scoring memory wins (${Math.max(score1, score2).toFixed(1)} vs ${Math.min(score1, score2).toFixed(1)})`,
    },
  });

  return true;
}

/**
 * LLM arbitration for high/critical conflicts
 */
async function llmArbitrate(conflictId: string): Promise<boolean> {
  const conflict = await prisma.memoryConflict.findUnique({
    where: { id: conflictId },
    include: {
      memory1: { include: { score: true, entityTags: true } },
      memory2: { include: { score: true, entityTags: true } },
    },
  });

  if (!conflict) return false;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'You are an expert arbitrator for AI memory conflicts. Analyze the contradicting memories and determine which one should be trusted, or if both have merit in different contexts.',
        },
        {
          role: 'user',
          content: `Two memories in an AI organization are in conflict:

Memory A (score: ${conflict.memory1.score?.finalScore || 'N/A'}, validations: ${conflict.memory1.validationCount}, dept: ${conflict.memory1.department || 'none'}):
"${conflict.memory1.content}"

Memory B (score: ${conflict.memory2.score?.finalScore || 'N/A'}, validations: ${conflict.memory2.validationCount}, dept: ${conflict.memory2.department || 'none'}):
"${conflict.memory2.content}"

Respond in JSON:
{
  "winner": "A" or "B" or "both_valid",
  "confidence": 0-1,
  "explanation": "why this decision",
  "affected_domains": ["domain names that might be impacted"]
}`,
        },
      ],
      model: process.env.OPENAI_MODEL_ARBITRATION || 'gpt-4o',
      temperature: 0.3,
      max_tokens: 500,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'arbitration_result',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              winner: { type: 'string' },
              confidence: { type: 'number' },
              explanation: { type: 'string' },
              affected_domains: { type: 'array', items: { type: 'string' } },
            },
            required: ['winner', 'confidence', 'explanation', 'affected_domains'],
            additionalProperties: false,
          },
        },
      },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    // Determine resolution
    let resolutionId: string | null = null;
    let status = 'resolved';

    if (result.winner === 'A') {
      resolutionId = conflict.memoryId1;
    } else if (result.winner === 'B') {
      resolutionId = conflict.memoryId2;
    } else {
      // Both valid — mark as ignored (not a real conflict)
      status = 'ignored';
    }

    await prisma.memoryConflict.update({
      where: { id: conflictId },
      data: {
        status,
        resolutionMemoryId: resolutionId,
        resolvedAt: new Date(),
        resolvedBy: 'llm-arbitrator',
        arbitrationAgent: process.env.OPENAI_MODEL_ARBITRATION || 'gpt-4o',
        explanation: result.explanation,
        confidence: result.confidence,
        impactScope: { affectedDomains: result.affected_domains },
      },
    });

    return true;
  } catch (error: any) {
    console.error(`[Arbitration Worker] LLM error for conflict ${conflictId}:`, error.message);
    return false;
  }
}

/**
 * Propagate impact through MemoryRelation graph
 * When a memory is invalidated, reduce confidence of dependent memories
 */
async function propagateImpact(conflictId: string): Promise<number> {
  const conflict = await prisma.memoryConflict.findUnique({
    where: { id: conflictId },
    select: { resolutionMemoryId: true, memoryId1: true, memoryId2: true },
  });

  if (!conflict || !conflict.resolutionMemoryId) return 0;

  // The losing memory
  const loserId = conflict.resolutionMemoryId === conflict.memoryId1
    ? conflict.memoryId2
    : conflict.memoryId1;

  // Find all memories that SUPPORTS or DERIVED_FROM the losing memory
  const dependents = await prisma.memoryRelation.findMany({
    where: {
      targetMemoryId: loserId,
      relationType: { in: ['SUPPORTS', 'DERIVED_FROM', 'PART_OF'] },
    },
    select: { sourceMemoryId: true },
  });

  if (dependents.length === 0) return 0;

  // Reduce confidence of dependent memories by 20%
  const dependentIds = dependents.map((d) => d.sourceMemoryId);
  await prisma.$executeRaw`
    UPDATE memory_entries
    SET confidence = GREATEST(0, confidence * 0.8)
    WHERE id = ANY(${dependentIds}::uuid[])
  `;

  console.log(`[Arbitration Worker] Propagated impact to ${dependentIds.length} dependent memories`);
  return dependentIds.length;
}

// ---- Worker Definition ----

const arbitrationWorker = new Worker(
  'conflict-arbitration',
  async (job) => {
    const { conflictId } = job.data;
    console.log(`[Arbitration Worker] Processing conflict ${conflictId}`);

    // 1. Fetch conflict and classify severity
    const conflict = await prisma.memoryConflict.findUnique({
      where: { id: conflictId },
      include: { memory1: true, memory2: true },
    });

    if (!conflict || conflict.status !== 'pending') {
      return { success: false, reason: 'Conflict not found or already resolved' };
    }

    const severity = classifySeverity(conflict);

    // 2. Update severity
    await prisma.memoryConflict.update({
      where: { id: conflictId },
      data: {
        severity,
        autoResolvable: severity === 'low',
      },
    });

    // 3. Resolve based on severity
    let resolved = false;
    if (severity === 'low') {
      resolved = await autoResolve(conflictId);
    } else {
      resolved = await llmArbitrate(conflictId);
    }

    // 4. Propagate impact for resolved high/critical conflicts
    let impactCount = 0;
    if (resolved && (severity === 'high' || severity === 'critical')) {
      impactCount = await propagateImpact(conflictId);
    }

    await job.updateProgress(100);

    return {
      success: resolved,
      conflictId,
      severity,
      impactPropagated: impactCount,
    };
  },
  {
    connection: redisConnection,
    concurrency: 3,
    limiter: { max: 5, duration: 1000 },
  }
);

// Event handlers
arbitrationWorker.on('completed', (job) => {
  console.log(`[Arbitration Worker] Completed job ${job.id}`);
});

arbitrationWorker.on('failed', (job, err) => {
  console.error(`[Arbitration Worker] Failed job ${job?.id}:`, err.message);
});

arbitrationWorker.on('error', (err) => {
  console.error('[Arbitration Worker] Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Arbitration Worker] Shutting down...');
  await arbitrationWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('[Arbitration Worker] Started and waiting for jobs...');

export { arbitrationWorker };
