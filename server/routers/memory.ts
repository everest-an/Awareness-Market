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
import {
  createMemoryRouter,
  createConflictResolver,
  createVersionTreeManager,
  createSemanticConflictDetector,
} from '../memory-core';
import { createLogger } from '../utils/logger';

const logger = createLogger('Memory:API');

// Initialize memory router (singleton)
let memoryRouter: ReturnType<typeof createMemoryRouter> | null = null;
let conflictResolver: ReturnType<typeof createConflictResolver> | null = null;
let versionTreeManager: ReturnType<typeof createVersionTreeManager> | null = null;
let semanticDetector: ReturnType<typeof createSemanticConflictDetector> | null = null;

function getMemoryRouter() {
  if (!memoryRouter) {
    memoryRouter = createMemoryRouter(prisma);
    logger.info('[Memory:API] Memory router initialized');
  }
  return memoryRouter;
}

function getConflictResolver() {
  if (!conflictResolver) {
    conflictResolver = createConflictResolver(prisma);
    logger.info('[Memory:API] Conflict resolver initialized');
  }
  return conflictResolver;
}

function getVersionTreeManager() {
  if (!versionTreeManager) {
    versionTreeManager = createVersionTreeManager(prisma);
    logger.info('[Memory:API] Version tree manager initialized');
  }
  return versionTreeManager;
}

function getSemanticDetector() {
  if (!semanticDetector) {
    semanticDetector = createSemanticConflictDetector(prisma);
    logger.info('[Memory:API] Semantic detector initialized');
  }
  return semanticDetector;
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

// Phase 2: Conflict Detection & Version Tree Schemas
const listConflictsSchema = z.object({
  status: z.enum(['pending', 'resolved', 'ignored']).optional(),
  conflict_type: z.enum(['claim_value_mismatch', 'semantic_contradiction']).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const resolveConflictSchema = z.object({
  conflict_id: z.string().uuid(),
  resolution_memory_id: z.string().uuid(),
});

const ignoreConflictSchema = z.object({
  conflict_id: z.string().uuid(),
});

const getVersionHistorySchema = z.object({
  memory_id: z.string().uuid(),
});

const getVersionTreeSchema = z.object({
  root_id: z.string().uuid(),
});

const rollbackVersionSchema = z.object({
  target_version_id: z.string().uuid(),
  reason: z.string().optional(),
});

const compareVersionsSchema = z.object({
  version_id_1: z.string().uuid(),
  version_id_2: z.string().uuid(),
});

const runSemanticDetectionSchema = z.object({
  force: z.boolean().default(false), // Force run even if recently ran
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

  // ============================================================================
  // Phase 2: Conflict Detection
  // ============================================================================

  /**
   * List conflicts for the user's organization
   */
  listConflicts: protectedProcedure
    .input(listConflictsSchema)
    .query(async ({ input, ctx }) => {
      const resolver = getConflictResolver();

      try {
        const conflicts = await resolver.listConflicts({
          org_id: `org-${ctx.user.id}`,
          status: input.status,
          conflict_type: input.conflict_type,
          limit: input.limit,
          offset: input.offset,
        });

        return {
          conflicts: conflicts.map((c) => ({
            id: c.id,
            memory1: {
              id: c.memory1.id,
              content: c.memory1.content.substring(0, 200),
              confidence: c.memory1.confidence,
              created_at: c.memory1.created_at,
            },
            memory2: {
              id: c.memory2.id,
              content: c.memory2.content.substring(0, 200),
              confidence: c.memory2.confidence,
              created_at: c.memory2.created_at,
            },
            conflict_type: c.conflictType,
            status: c.status,
            detected_at: c.detectedAt,
            resolved_at: c.resolvedAt,
            resolved_by: c.resolvedBy,
          })),
          count: conflicts.length,
        };
      } catch (error: any) {
        logger.error('[Memory:API] Failed to list conflicts:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to list conflicts',
        });
      }
    }),

  /**
   * Get conflict statistics
   */
  getConflictStats: protectedProcedure
    .query(async ({ ctx }) => {
      const resolver = getConflictResolver();

      try {
        const stats = await resolver.getConflictStats(`org-${ctx.user.id}`);
        return stats;
      } catch (error: any) {
        logger.error('[Memory:API] Failed to get conflict stats:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to get conflict stats',
        });
      }
    }),

  /**
   * Resolve a conflict by choosing winning memory
   */
  resolveConflict: protectedProcedure
    .input(resolveConflictSchema)
    .mutation(async ({ input, ctx }) => {
      const resolver = getConflictResolver();

      try {
        await resolver.resolveConflict({
          conflict_id: input.conflict_id,
          resolution_memory_id: input.resolution_memory_id,
          resolved_by: ctx.user.id.toString(),
        });

        logger.info(`[Memory:API] Resolved conflict ${input.conflict_id}`);

        return {
          success: true,
        };
      } catch (error: any) {
        logger.error('[Memory:API] Failed to resolve conflict:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to resolve conflict',
        });
      }
    }),

  /**
   * Ignore a conflict
   */
  ignoreConflict: protectedProcedure
    .input(ignoreConflictSchema)
    .mutation(async ({ input, ctx }) => {
      const resolver = getConflictResolver();

      try {
        await resolver.ignoreConflict({
          conflict_id: input.conflict_id,
          resolved_by: ctx.user.id.toString(),
        });

        logger.info(`[Memory:API] Ignored conflict ${input.conflict_id}`);

        return {
          success: true,
        };
      } catch (error: any) {
        logger.error('[Memory:API] Failed to ignore conflict:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to ignore conflict',
        });
      }
    }),

  /**
   * Run semantic conflict detection (LLM-based)
   */
  runSemanticDetection: protectedProcedure
    .input(runSemanticDetectionSchema)
    .mutation(async ({ input, ctx }) => {
      const detector = getSemanticDetector();

      try {
        const results = await detector.detectConflicts(`org-${ctx.user.id}`);

        logger.info(
          `[Memory:API] Semantic detection: ${results.conflicts_detected} conflicts found`
        );

        return {
          success: true,
          ...results,
        };
      } catch (error: any) {
        logger.error('[Memory:API] Failed to run semantic detection:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to run semantic detection',
        });
      }
    }),

  // ============================================================================
  // Phase 2: Version Tree
  // ============================================================================

  /**
   * Get version history for a memory (linear chain)
   */
  getVersionHistory: protectedProcedure
    .input(getVersionHistorySchema)
    .query(async ({ input, ctx }) => {
      const versionTree = getVersionTreeManager();

      try {
        const history = await versionTree.getVersionHistory(input.memory_id);

        if (!history) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Memory not found',
          });
        }

        return {
          versions: history.versions.map((v) => ({
            id: v.id,
            content: v.content,
            confidence: v.confidence,
            version: v.version,
            created_by: v.created_by,
            created_at: v.created_at,
            parent_id: v.parentId,
          })),
          root: {
            id: history.root.id,
            content: history.root.content,
          },
          current: {
            id: history.current.id,
            content: history.current.content,
          },
          depth: history.depth,
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;

        logger.error('[Memory:API] Failed to get version history:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to get version history',
        });
      }
    }),

  /**
   * Get full version tree (including branches)
   */
  getVersionTree: protectedProcedure
    .input(getVersionTreeSchema)
    .query(async ({ input, ctx }) => {
      const versionTree = getVersionTreeManager();

      try {
        const tree = await versionTree.getVersionTree(input.root_id);

        if (!tree) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Root memory not found',
          });
        }

        // Recursive function to serialize tree
        function serializeNode(node: any): any {
          return {
            id: node.id,
            content: node.content.substring(0, 200),
            confidence: node.confidence,
            version: node.version,
            created_by: node.created_by,
            created_at: node.created_at,
            is_latest: node.is_latest,
            children: node.children?.map((c: any) => serializeNode(c)) || [],
          };
        }

        return serializeNode(tree);
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;

        logger.error('[Memory:API] Failed to get version tree:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to get version tree',
        });
      }
    }),

  /**
   * Rollback to a previous version
   */
  rollbackVersion: protectedProcedure
    .input(rollbackVersionSchema)
    .mutation(async ({ input, ctx }) => {
      const versionTree = getVersionTreeManager();

      try {
        const newVersion = await versionTree.rollbackToVersion({
          target_version_id: input.target_version_id,
          created_by: ctx.user.id.toString(),
          reason: input.reason,
        });

        logger.info(
          `[Memory:API] Rolled back to version ${input.target_version_id} → ${newVersion.id}`
        );

        return {
          success: true,
          new_version_id: newVersion.id,
        };
      } catch (error: any) {
        logger.error('[Memory:API] Failed to rollback version:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to rollback version',
        });
      }
    }),

  /**
   * Compare two versions
   */
  compareVersions: protectedProcedure
    .input(compareVersionsSchema)
    .query(async ({ input, ctx }) => {
      const versionTree = getVersionTreeManager();

      try {
        const diffs = await versionTree.compareVersions(
          input.version_id_1,
          input.version_id_2
        );

        return {
          differences: diffs,
          count: diffs.length,
        };
      } catch (error: any) {
        logger.error('[Memory:API] Failed to compare versions:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to compare versions',
        });
      }
    }),
});
