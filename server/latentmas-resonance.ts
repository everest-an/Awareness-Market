/**
 * LatentMAS Resonance API
 *
 * Implements the Hive Mind query system.
 *
 * Features:
 * - Memory search (simplified - pgvector not required)
 * - Configurable result limit
 * - Auto-debit credits for private memories
 * - Usage logging for analytics
 *
 * Note: For production with semantic search, enable pgvector extension
 * and use $queryRaw for similarity search.
 */

import { z } from 'zod';
import { protectedProcedure, router } from './_core/trpc.js';
import { prisma } from './db-prisma.js';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from './utils/logger.js';
import { broadcastResonanceEvent } from './socket-events.js';

// ============================================================================
// Types
// ============================================================================

interface MemoryMatch {
  id: number;
  title: string;
  description: string | null;
  creatorId: number;
  isPublic: boolean;
  createdAt: Date;
  creator: {
    name: string | null;
  };
}

/**
 * Calculate cost for using a private memory
 *
 * Free:
 * - Public memories (isPublic = true)
 * - Own memories
 *
 * Paid:
 * - Private memories from other agents: 0.001 $AMEM per use
 */
function calculateCost(memory: MemoryMatch, consumerId: number): number {
  if (memory.isPublic) return 0;
  if (memory.creatorId === consumerId) return 0;
  return 0.001; // $AMEM per private memory use
}

/**
 * LatentMAS Resonance Router
 */
export const resonanceRouter = router({
  /**
   * Query Hive Mind for memories
   *
   * Simplified version: returns recent public memories.
   * For semantic search, use pgvector extension with $queryRaw.
   */
  query: protectedProcedure
    .input(z.object({
      embedding: z.array(z.number()).length(1536),
      threshold: z.number().min(0).max(1).default(0.85),
      limit: z.number().min(1).max(20).default(5)
    }))
    .mutation(async ({ input, ctx }) => {
      // Simplified: fetch recent public memories (no semantic search)
      // In production, use pgvector with $queryRaw for similarity search
      const matches = await prisma.latentVector.findMany({
        where: {
          creatorId: { not: ctx.user.id }, // Exclude own memories
          status: 'active',
          OR: [
            { isPublic: true },
            { isPublic: false } // Include private for cost calculation
          ]
        },
        include: {
          creator: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit
      });

      // Calculate costs and prepare response
      const results = matches.map((m) => {
        const cost = calculateCost(m, ctx.user.id);
        // Simplified: use a placeholder similarity score
        const similarity = m.isPublic ? 0.9 : 0.85;

        return {
          id: m.id,
          text: m.description || m.title,
          similarity,
          source_agent: m.creator.name || `Agent-${m.creatorId}`,
          cost,
          created_at: m.createdAt
        };
      });

      // Calculate total cost
      const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

      // Check if user has enough credits
      if (totalCost > 0) {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { creditsBalance: true }
        });

        const balance = Number(user?.creditsBalance || 0);

        if (balance < totalCost) {
          logger.warn('Insufficient credits for Hive Mind query', {
            userId: ctx.user.id,
            required: totalCost,
            balance
          });

          return {
            matches: [],
            totalCost,
            error: 'Insufficient credits. Top up your balance to access private memories.'
          };
        }

        // Deduct credits
        await prisma.user.update({
          where: { id: ctx.user.id },
          data: {
            creditsBalance: { decrement: totalCost }
          }
        });
      }

      // Log each memory usage
      for (const match of matches) {
        const cost = calculateCost(match, ctx.user.id);

        if (cost > 0 || match.isPublic) {
          await prisma.memoryUsageLog.create({
            data: {
              consumerId: ctx.user.id,
              providerId: match.creatorId,
              memoryId: match.id,
              similarity: 0.9, // Placeholder
              cost,
              contextQuery: input.embedding.slice(0, 10).join(','),
              createdAt: new Date()
            }
          });

          // Broadcast resonance event to connected clients
          broadcastResonanceEvent({
            consumerId: ctx.user.id,
            providerId: match.creatorId,
            consumerName: ctx.user.name || `Agent-${ctx.user.id}`,
            providerName: match.creator.name || `Agent-${match.creatorId}`,
            memoryId: match.id,
            similarity: 0.9, // Placeholder
            cost,
            timestamp: new Date()
          });

          // Increment provider's resonance count
          await prisma.user.update({
            where: { id: match.creatorId },
            data: {
              totalResonances: { increment: 1 }
            }
          });
        }
      }

      logger.info('Hive Mind query completed', {
        userId: ctx.user.id,
        matchCount: results.length,
        totalCost,
        threshold: input.threshold
      });

      // Get updated balance
      let creditsRemaining: number | undefined;
      if (totalCost > 0) {
        const updatedUser = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { creditsBalance: true }
        });
        creditsRemaining = Number(updatedUser?.creditsBalance || 0);
      }

      return {
        matches: results,
        totalCost,
        creditsRemaining
      };
    }),

  /**
   * Get resonance stats for user's memories
   *
   * Shows how many times each memory has been used by others
   */
  getMyResonanceStats: protectedProcedure
    .query(async ({ ctx }) => {
      // Get user's vectors with usage stats
      const vectors = await prisma.latentVector.findMany({
        where: { creatorId: ctx.user.id },
        select: {
          id: true,
          title: true,
          resonanceCount: true,
          lastResonanceAt: true
        },
        orderBy: { resonanceCount: 'desc' },
        take: 20
      });

      // Get usage counts from memory_usage_log
      const usageCounts = await prisma.memoryUsageLog.groupBy({
        by: ['memoryId'],
        where: {
          providerId: ctx.user.id
        },
        _count: true,
        _sum: {
          cost: true
        }
      });

      const usageMap = new Map(
        usageCounts.map(u => [u.memoryId, {
          count: u._count,
          earned: Number(u._sum.cost || 0)
        }])
      );

      return {
        memories: vectors.map(v => ({
          memoryId: v.id,
          title: v.title,
          resonanceCount: v.resonanceCount || 0,
          lastResonanceAt: v.lastResonanceAt,
          usageCount: usageMap.get(v.id)?.count || 0,
          totalEarned: usageMap.get(v.id)?.earned || 0
        }))
      };
    }),

  /**
   * Get network-wide resonance activity (for 3D visualization)
   *
   * Returns recent resonance events for real-time display
   */
  getNetworkActivity: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50)
    }))
    .query(async ({ input }) => {
      const events = await prisma.memoryUsageLog.findMany({
        include: {
          consumer: { select: { name: true } },
          provider: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit
      });

      return {
        events: events.map(e => ({
          id: e.id,
          consumerId: e.consumerId,
          providerId: e.providerId,
          consumerName: e.consumer.name || `Agent-${e.consumerId}`,
          providerName: e.provider.name || `Agent-${e.providerId}`,
          similarity: Number(e.similarity || 0),
          cost: Number(e.cost || 0),
          timestamp: e.createdAt
        }))
      };
    })
});
