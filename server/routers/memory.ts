/**
 * Memory API Router (tRPC)
 *
 * Public API endpoints for memory management.
 * Provides create, query, update, delete operations.
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';
import { createMemoryRouter } from '../memory-core';
import { createLogger } from '../utils/logger';

const logger = createLogger('Memory:API');

// Initialize memory router (singleton)
let memoryRouter: ReturnType<typeof createMemoryRouter> | null = null;

function getMemoryRouter() {
  if (!memoryRouter) {
    memoryRouter = createMemoryRouter(prisma);
    logger.info('[Memory:API] Memory router initialized');
  }
  return memoryRouter;
}

// ============================================================================
// Input Schemas
// ============================================================================

const createMemorySchema = z.object({
  namespace: z.string().min(1).max(255),
  content_type: z.enum(['text', 'code', 'data', 'image', 'audio', 'composite']),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
  confidence: z.number().min(0).max(1),
  expires_at: z.date().optional(),
  decay_factor: z.number().min(0).max(1).optional(),
});

const queryMemorySchema = z.object({
  namespaces: z.array(z.string()).min(1).max(10),
  query: z.string().min(1).max(1000),
  limit: z.number().min(1).max(100).default(10),
  min_confidence: z.number().min(0).max(1).default(0),
  min_score: z.number().min(0).max(100).default(0),
  content_types: z.array(z.enum(['text', 'code', 'data', 'image', 'audio', 'composite'])).optional(),
  created_after: z.date().optional(),
  created_before: z.date().optional(),
});

const updateMemorySchema = z.object({
  memory_id: z.string().uuid(),
  content: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const deleteMemorySchema = z.object({
  memory_id: z.string().uuid(),
});

const getMemorySchema = z.object({
  memory_id: z.string().uuid(),
});

const listMemoriesSchema = z.object({
  namespace: z.string().min(1).max(255),
  limit: z.number().min(1).max(100).default(50),
});

const incrementReputationSchema = z.object({
  memory_id: z.string().uuid(),
  delta: z.number().min(-100).max(100),
});

const markValidatedSchema = z.object({
  memory_id: z.string().uuid(),
});

// ============================================================================
// Memory Router
// ============================================================================

export const memoryRouter = router({
  /**
   * Create a new memory entry
   */
  create: protectedProcedure
    .input(createMemorySchema)
    .mutation(async ({ input, ctx }) => {
      const router = getMemoryRouter();

      try {
        const memoryId = await router.create({
          org_id: `org-${ctx.user.id}`, // Use user ID as org ID for now
          namespace: input.namespace,
          content_type: input.content_type,
          content: input.content,
          metadata: input.metadata,
          confidence: input.confidence,
          created_by: ctx.user.id.toString(),
          expires_at: input.expires_at,
          decay_factor: input.decay_factor,
        });

        logger.info(`[Memory:API] Created memory ${memoryId} for user ${ctx.user.id}`);

        return {
          success: true,
          memory_id: memoryId,
        };
      } catch (error: any) {
        logger.error('[Memory:API] Failed to create memory:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to create memory',
        });
      }
    }),

  /**
   * Query memories using semantic search
   */
  query: protectedProcedure
    .input(queryMemorySchema)
    .query(async ({ input, ctx }) => {
      const router = getMemoryRouter();

      try {
        const results = await router.query({
          org_id: `org-${ctx.user.id}`,
          namespaces: input.namespaces,
          query: input.query,
          limit: input.limit,
          min_confidence: input.min_confidence,
          min_score: input.min_score,
          content_types: input.content_types,
          created_after: input.created_after,
          created_before: input.created_before,
        });

        logger.info(
          `[Memory:API] Query returned ${results.length} results for user ${ctx.user.id}`
        );

        return {
          results: results.map((r) => ({
            memory: {
              id: r.memory.id,
              namespace: r.memory.namespace,
              content_type: r.memory.content_type,
              content: r.memory.content,
              metadata: r.memory.metadata,
              confidence: r.memory.confidence,
              reputation: r.memory.reputation,
              version: r.memory.version,
              created_by: r.memory.created_by,
              created_at: r.memory.created_at,
              updated_at: r.memory.updated_at,
            },
            score: r.score,
            similarity: r.similarity,
          })),
          count: results.length,
        };
      } catch (error: any) {
        logger.error('[Memory:API] Failed to query memories:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to query memories',
        });
      }
    }),

  /**
   * Update a memory (creates new version)
   */
  update: protectedProcedure
    .input(updateMemorySchema)
    .mutation(async ({ input, ctx }) => {
      const router = getMemoryRouter();

      try {
        // Verify ownership
        const existingMemory = await router.get(input.memory_id);
        if (!existingMemory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Memory not found',
          });
        }

        if (existingMemory.created_by !== ctx.user.id.toString()) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only update memories you created',
          });
        }

        const newVersionId = await router.update(
          input.memory_id,
          {
            content: input.content,
            metadata: input.metadata,
            confidence: input.confidence,
          },
          ctx.user.id.toString()
        );

        logger.info(
          `[Memory:API] Updated memory ${input.memory_id} → ${newVersionId} for user ${ctx.user.id}`
        );

        return {
          success: true,
          new_version_id: newVersionId,
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;

        logger.error('[Memory:API] Failed to update memory:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to update memory',
        });
      }
    }),

  /**
   * Delete a memory (soft delete)
   */
  delete: protectedProcedure
    .input(deleteMemorySchema)
    .mutation(async ({ input, ctx }) => {
      const router = getMemoryRouter();

      try {
        // Verify ownership
        const existingMemory = await router.get(input.memory_id);
        if (!existingMemory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Memory not found',
          });
        }

        if (existingMemory.created_by !== ctx.user.id.toString()) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only delete memories you created',
          });
        }

        await router.delete(input.memory_id);

        logger.info(`[Memory:API] Deleted memory ${input.memory_id} for user ${ctx.user.id}`);

        return {
          success: true,
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;

        logger.error('[Memory:API] Failed to delete memory:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to delete memory',
        });
      }
    }),

  /**
   * Get a single memory by ID
   */
  get: protectedProcedure
    .input(getMemorySchema)
    .query(async ({ input, ctx }) => {
      const router = getMemoryRouter();

      try {
        const memory = await router.get(input.memory_id);

        if (!memory) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Memory not found',
          });
        }

        // Check access (same org or creator)
        const orgId = `org-${ctx.user.id}`;
        if (memory.org_id !== orgId && memory.created_by !== ctx.user.id.toString()) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this memory',
          });
        }

        return {
          memory: {
            id: memory.id,
            namespace: memory.namespace,
            content_type: memory.content_type,
            content: memory.content,
            metadata: memory.metadata,
            confidence: memory.confidence,
            reputation: memory.reputation,
            usage_count: memory.usage_count,
            validation_count: memory.validation_count,
            version: memory.version,
            is_latest: memory.is_latest,
            created_by: memory.created_by,
            created_at: memory.created_at,
            updated_at: memory.updated_at,
            accessed_at: memory.accessed_at,
            expires_at: memory.expires_at,
          },
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;

        logger.error('[Memory:API] Failed to get memory:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to get memory',
        });
      }
    }),

  /**
   * List memories by namespace
   */
  listByNamespace: protectedProcedure
    .input(listMemoriesSchema)
    .query(async ({ input, ctx }) => {
      const router = getMemoryRouter();

      try {
        const memories = await router.listByNamespace(
          `org-${ctx.user.id}`,
          input.namespace,
          input.limit
        );

        return {
          memories: memories.map((m) => ({
            id: m.id,
            namespace: m.namespace,
            content_type: m.content_type,
            content: m.content.substring(0, 200), // Truncate for list view
            confidence: m.confidence,
            reputation: m.reputation,
            version: m.version,
            created_at: m.created_at,
            updated_at: m.updated_at,
          })),
          count: memories.length,
        };
      } catch (error: any) {
        logger.error('[Memory:API] Failed to list memories:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to list memories',
        });
      }
    }),

  /**
   * Increment reputation score
   */
  incrementReputation: protectedProcedure
    .input(incrementReputationSchema)
    .mutation(async ({ input, ctx }) => {
      const router = getMemoryRouter();

      try {
        await router.incrementReputation(input.memory_id, input.delta);

        logger.info(
          `[Memory:API] Incremented reputation for ${input.memory_id} by ${input.delta}`
        );

        return {
          success: true,
        };
      } catch (error: any) {
        logger.error('[Memory:API] Failed to increment reputation:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to increment reputation',
        });
      }
    }),

  /**
   * Mark memory as validated
   */
  markValidated: protectedProcedure
    .input(markValidatedSchema)
    .mutation(async ({ input, ctx }) => {
      const router = getMemoryRouter();

      try {
        await router.markValidated(input.memory_id);

        logger.info(`[Memory:API] Marked memory ${input.memory_id} as validated`);

        return {
          success: true,
        };
      } catch (error: any) {
        logger.error('[Memory:API] Failed to mark validated:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to mark validated',
        });
      }
    }),
});
