/**
 * LatentMAS Upload API
 *
 * Handles vector uploads from Python SDK and other clients.
 * Stores vectors with embeddings in PostgreSQL.
 *
 * Features:
 * - Single and batch uploads
 * - Automatic resonance detection (async)
 * - Credit tracking
 * - Public/private memory flags
 */

import { z } from 'zod';
import { protectedProcedure, router } from './_core/trpc.js';
import { prisma } from './db-prisma.js';
import { logger } from './utils/logger.js';
import { broadcastMemoryUpload } from './socket-events.js';

/**
 * Trigger async resonance detection for a new vector
 *
 * Finds similar vectors in the database and records resonance events.
 * Runs asynchronously to avoid blocking the upload response.
 *
 * Note: This is a simplified version. For production, use pgvector extension.
 */
async function triggerResonanceDetection(
  vectorId: number,
  _embedding: number[],
  _userId: number
) {
  try {
    // Simplified version: just update resonance count to 0
    // In production, use pgvector for similarity search
    await prisma.latentVector.update({
      where: { id: vectorId },
      data: {
        resonanceCount: 0,
        lastResonanceAt: new Date()
      }
    });

    logger.debug('Resonance detection completed (simplified mode)', { vectorId });
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
      // Insert vector into database using Prisma
      const vector = await prisma.latentVector.create({
        data: {
          creatorId: ctx.user.id,
          title: input.text.substring(0, 255), // Use first 255 chars as title
          description: input.text,
          category: input.metadata?.tags?.[0] || 'general',
          vectorFileKey: `memory-${ctx.user.id}-${Date.now()}`,
          vectorFileUrl: '', // Not using S3 for SDK memories
          basePrice: 0.00, // Free for now
          status: 'active',
          vectorType: 'embedding',
          memoryType: 'latent_vector',

          // Embedding fields
          embeddingProvider: 'sdk',
          embeddingModel: 'unknown',
          embeddingDimension: input.embedding.length,
          embeddingData: JSON.stringify(input.embedding), // Store as JSON text
          isPublic: input.isPublic,
          resonanceCount: 0
        }
      });

      // Trigger async resonance detection
      setImmediate(() => {
        triggerResonanceDetection(vector.id, input.embedding, ctx.user.id);
      });

      // Update user stats
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          totalMemories: { increment: 1 }
        }
      });

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
      // Batch insert using Prisma transaction
      const inserted = await prisma.$transaction(
        input.memories.map(m =>
          prisma.latentVector.create({
            data: {
              creatorId: ctx.user.id,
              title: m.text.substring(0, 255),
              description: m.text,
              category: 'batch-import',
              vectorFileKey: `batch-${ctx.user.id}-${Date.now()}-${Math.random()}`,
              vectorFileUrl: '',
              basePrice: 0.00,
              status: 'active',
              vectorType: 'embedding',
              memoryType: 'latent_vector',

              embeddingProvider: 'sdk',
              embeddingDimension: m.embedding.length,
              embeddingData: JSON.stringify(m.embedding),
              isPublic: false,
              resonanceCount: 0,

              createdAt: m.timestamp ? new Date(m.timestamp * 1000) : new Date()
            }
          })
        )
      );

      // Trigger resonance detection for each (async)
      inserted.forEach((vec, index) => {
        const memoryData = input.memories[index];
        if (memoryData) {
          setImmediate(() => {
            triggerResonanceDetection(vec.id, memoryData.embedding, ctx.user.id);
          });
        }
      });

      // Update user stats
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          totalMemories: { increment: inserted.length }
        }
      });

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
