/**
 * LatentMAS Upload API
 *
 * Handles vector uploads from Python SDK and other clients.
 * Stores vectors with embeddings in PostgreSQL (pgvector).
 *
 * Features:
 * - Single and batch uploads
 * - Automatic resonance detection (async)
 * - Credit tracking
 * - Public/private memory flags
 */

import { z } from 'zod';
import { protectedProcedure, router } from './trpc.js';
import { getDb } from './db.js';
import { latentVectors, users, memoryUsageLog } from '../drizzle/schema-pg.js';
import { eq, sql } from 'drizzle-orm';
import { logger } from './logger.js';
import { broadcastMemoryUpload } from './socket-events.js';

/**
 * Trigger async resonance detection for a new vector
 *
 * Finds similar vectors in the database and records resonance events.
 * Runs asynchronously to avoid blocking the upload response.
 */
async function triggerResonanceDetection(
  vectorId: number,
  embedding: number[],
  userId: number
) {
  try {
    const db = await getDb();

    // Find similar vectors using pgvector cosine similarity
    // 1 - (embedding <=> target) = similarity (0 to 1)
    const resonances = await db.execute(sql`
      SELECT
        id,
        creator_id,
        title,
        1 - (embedding_vector <=> ${JSON.stringify(embedding)}::vector) AS similarity
      FROM latent_vectors
      WHERE
        id != ${vectorId}
        AND embedding_vector IS NOT NULL
        AND (1 - (embedding_vector <=> ${JSON.stringify(embedding)}::vector)) > 0.85
      ORDER BY similarity DESC
      LIMIT 10
    `);

    if (resonances.length > 0) {
      // Update resonance count on the new vector
      await db.update(latentVectors)
        .set({
          resonanceCount: resonances.length,
          lastResonanceAt: new Date()
        })
        .where(eq(latentVectors.id, vectorId));

      logger.info('Resonance detected', {
        vectorId,
        matchCount: resonances.length,
        topSimilarity: resonances[0]?.similarity
      });
    }

  } catch (error) {
    logger.error('Resonance detection failed', { vectorId, error });
  }
}

/**
 * LatentMAS Upload Router
 */
export const latentUploadRouter = router({
  /**
   * Upload single memory
   *
   * Accepts text + embedding from SDK
   */
  uploadMemory: protectedProcedure
    .input(z.object({
      text: z.string().min(1).max(10000),
      embedding: z.array(z.number()).length(1536), // OpenAI text-embedding-3-small
      metadata: z.object({
        source: z.string().optional(),
        tags: z.array(z.string()).optional(),
        context: z.string().optional()
      }).optional(),
      isPublic: z.boolean().default(false)
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // Insert vector into database
      const [vector] = await db.insert(latentVectors).values({
        creatorId: ctx.user.id,
        title: input.text.substring(0, 255), // Use first 255 chars as title
        description: input.text,
        category: input.metadata?.tags?.[0] || 'general',
        vectorFileKey: `memory-${ctx.user.id}-${Date.now()}`,
        vectorFileUrl: '', // Not using S3 for SDK memories
        basePrice: '0.00', // Free for now
        status: 'active',
        vectorType: 'embedding',
        memoryType: 'latent_vector',

        // Moltbook compatibility fields
        embeddingVector: sql`${JSON.stringify(input.embedding)}::vector`,
        embeddingProvider: 'sdk',
        embeddingModel: 'unknown',
        embeddingDimension: input.embedding.length,
        isPublic: input.isPublic,
        resonanceCount: 0
      }).returning();

      // Trigger async resonance detection
      setImmediate(() => {
        triggerResonanceDetection(vector.id, input.embedding, ctx.user.id);
      });

      // Update user stats
      await db.update(users)
        .set({
          totalMemories: sql`${users.totalMemories} + 1`
        })
        .where(eq(users.id, ctx.user.id));

      logger.info('Memory uploaded', {
        userId: ctx.user.id,
        vectorId: vector.id,
        dimension: input.embedding.length,
        isPublic: input.isPublic
      });

      // Broadcast memory upload event to connected clients
      broadcastMemoryUpload({
        agentId: ctx.user.id,
        agentName: ctx.user.name || `Agent-${ctx.user.id}`,
        memoryId: vector.id,
        title: vector.title,
        isPublic: input.isPublic,
        timestamp: new Date()
      });

      return {
        memoryId: vector.id,
        resonanceCount: 0, // Will be updated asynchronously
        creditsUsed: 0.0
      };
    }),

  /**
   * Batch upload memories
   *
   * More efficient than uploading one by one
   */
  batchUpload: protectedProcedure
    .input(z.object({
      memories: z.array(z.object({
        text: z.string().min(1).max(10000),
        embedding: z.array(z.number()).length(1536),
        timestamp: z.number().optional()
      })).min(1).max(100) // Max 100 memories per batch
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // Prepare values for batch insert
      const values = input.memories.map(m => ({
        creatorId: ctx.user.id,
        title: m.text.substring(0, 255),
        description: m.text,
        category: 'batch-import',
        vectorFileKey: `batch-${ctx.user.id}-${Date.now()}-${Math.random()}`,
        vectorFileUrl: '',
        basePrice: '0.00',
        status: 'active' as const,
        vectorType: 'embedding' as const,
        memoryType: 'latent_vector' as const,

        embeddingVector: sql`${JSON.stringify(m.embedding)}::vector`,
        embeddingProvider: 'sdk',
        embeddingDimension: m.embedding.length,
        isPublic: false,
        resonanceCount: 0,

        createdAt: m.timestamp ? new Date(m.timestamp * 1000) : new Date()
      }));

      // Batch insert
      const inserted = await db.insert(latentVectors).values(values).returning();

      // Trigger resonance detection for each (async)
      inserted.forEach(vec => {
        const memoryData = input.memories.find(
          m => m.text === vec.description
        );
        if (memoryData) {
          setImmediate(() => {
            triggerResonanceDetection(vec.id, memoryData.embedding, ctx.user.id);
          });
        }
      });

      // Update user stats
      await db.update(users)
        .set({
          totalMemories: sql`${users.totalMemories} + ${inserted.length}`
        })
        .where(eq(users.id, ctx.user.id));

      logger.info('Batch upload completed', {
        userId: ctx.user.id,
        count: inserted.length
      });

      return {
        uploadedCount: inserted.length,
        memoryIds: inserted.map(v => v.id)
      };
    })
});
