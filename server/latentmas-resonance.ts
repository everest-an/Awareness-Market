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
import { protectedProcedure, router } from './_core/trpc';
import { prisma } from './db-prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from './utils/logger';
import { broadcastResonanceEvent } from './socket-events';
import { cosineSimilarity, parseVectorData } from './utils/vector-similarity';

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

        // Calculate real similarity if vector data is available
        let similarity = 0.5; // Default fallback
        const vectorData = parseVectorData((m as any).vectorData);
        if (vectorData) {
          similarity = cosineSimilarity(input.embedding, vectorData);
        }

        return {
          id: m.id,
          text: m.description || m.title,
          similarity,
          source_agent: m.creator.name || `Agent-${m.creatorId}`,
          cost,
          created_at: m.createdAt
        };
      });

      // Filter by similarity threshold and sort
      const filteredResults = results
        .filter(r => r.similarity >= input.threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, input.limit);

      // Calculate total cost
      const totalCost = filteredResults.reduce((sum, r) => sum + r.cost, 0);

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

      // Log each memory usage with real similarity scores
      for (const result of filteredResults) {
        const match = matches.find(m => m.id === result.id);
        if (!match) continue;

        const cost = result.cost;

        if (cost > 0 || match.isPublic) {
          await prisma.memoryUsageLog.create({
            data: {
              consumerId: ctx.user.id,
              providerId: match.creatorId,
              memoryId: match.id,
              similarity: result.similarity,
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
            similarity: result.similarity,
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
        matchCount: filteredResults.length,
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
        matches: filteredResults,
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
    }),

  /**
   * Auto-enhance: Automatically find and apply relevant memories
   *
   * This is the core Hive Mind auto-resonance feature.
   * Given a context embedding, it:
   * 1. Finds semantically similar memories from the network
   * 2. Automatically selects the most relevant ones
   * 3. Returns enhanced context with applied memories
   *
   * Unlike query(), this is designed for automatic/background use
   * by AI agents during their inference process.
   */
  autoEnhance: protectedProcedure
    .input(z.object({
      contextEmbedding: z.array(z.number()).min(128).max(4096),
      contextText: z.string().max(10000).optional(),
      maxMemories: z.number().min(1).max(10).default(3),
      minSimilarity: z.number().min(0.5).max(1).default(0.8),
      allowPrivate: z.boolean().default(true),
      maxCost: z.number().min(0).default(0.01) // Max $AMEM to spend
    }))
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();

      // Get candidate memories
      const whereClause = input.allowPrivate
        ? { status: 'active', creatorId: { not: ctx.user.id } }
        : { status: 'active', isPublic: true, creatorId: { not: ctx.user.id } };

      const candidates = await prisma.latentVector.findMany({
        where: whereClause,
        include: {
          creator: { select: { name: true } }
        },
        take: 100 // Get more candidates for better matching
      });

      // Calculate similarity for each candidate
      // In production, this would use pgvector for efficient similarity search
      const scored = candidates.map(m => {
        // Default similarity if no vector data available
        let similarity = 0;

        // Calculate real similarity if vector data is available
        const vectorData = parseVectorData((m as any).vectorData);
        if (vectorData) {
          similarity = cosineSimilarity(input.contextEmbedding, vectorData);
        }

        return {
          memory: m,
          similarity,
          cost: calculateCost(m, ctx.user.id)
        };
      });

      // Filter and sort by similarity
      const relevant = scored
        .filter(s => s.similarity >= input.minSimilarity)
        .sort((a, b) => b.similarity - a.similarity);

      // Apply cost constraint
      let totalCost = 0;
      const selected: typeof relevant = [];

      for (const item of relevant) {
        if (selected.length >= input.maxMemories) break;
        if (totalCost + item.cost > input.maxCost) continue;

        selected.push(item);
        totalCost += item.cost;
      }

      // Check credits if needed
      if (totalCost > 0) {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { creditsBalance: true }
        });

        const balance = Number(user?.creditsBalance || 0);

        if (balance < totalCost) {
          logger.warn('Auto-enhance: insufficient credits', {
            userId: ctx.user.id,
            required: totalCost,
            balance
          });

          // Return only free memories
          const freeMemories = selected.filter(s => s.cost === 0);
          return {
            success: true,
            enhanced: freeMemories.length > 0,
            memories: freeMemories.map(s => ({
              id: s.memory.id,
              text: s.memory.description || s.memory.title,
              similarity: s.similarity,
              sourceAgent: s.memory.creator.name || `Agent-${s.memory.creatorId}`,
              cost: 0
            })),
            totalCost: 0,
            processingTimeMs: Date.now() - startTime,
            warning: 'Insufficient credits for private memories'
          };
        }

        // Deduct credits
        await prisma.user.update({
          where: { id: ctx.user.id },
          data: { creditsBalance: { decrement: totalCost } }
        });
      }

      // Log usage and broadcast events
      for (const item of selected) {
        await prisma.memoryUsageLog.create({
          data: {
            consumerId: ctx.user.id,
            providerId: item.memory.creatorId,
            memoryId: item.memory.id,
            similarity: item.similarity,
            cost: item.cost,
            contextQuery: 'auto-enhance',
            createdAt: new Date()
          }
        });

        broadcastResonanceEvent({
          consumerId: ctx.user.id,
          providerId: item.memory.creatorId,
          consumerName: ctx.user.name || `Agent-${ctx.user.id}`,
          providerName: item.memory.creator.name || `Agent-${item.memory.creatorId}`,
          memoryId: item.memory.id,
          similarity: item.similarity,
          cost: item.cost,
          timestamp: new Date()
        });

        // Update resonance stats
        await prisma.latentVector.update({
          where: { id: item.memory.id },
          data: {
            resonanceCount: { increment: 1 },
            lastResonanceAt: new Date()
          }
        });

        await prisma.user.update({
          where: { id: item.memory.creatorId },
          data: { totalResonances: { increment: 1 } }
        });
      }

      logger.info('Auto-enhance completed', {
        userId: ctx.user.id,
        candidatesScanned: candidates.length,
        memoriesSelected: selected.length,
        totalCost,
        processingTimeMs: Date.now() - startTime
      });

      return {
        success: true,
        enhanced: selected.length > 0,
        memories: selected.map(s => ({
          id: s.memory.id,
          text: s.memory.description || s.memory.title,
          similarity: s.similarity,
          sourceAgent: s.memory.creator.name || `Agent-${s.memory.creatorId}`,
          cost: s.cost
        })),
        totalCost,
        processingTimeMs: Date.now() - startTime
      };
    }),

  /**
   * Subscribe to auto-resonance for an agent
   *
   * Registers the agent for automatic memory enhancement.
   * Returns a subscription ID to use for future auto-enhance calls.
   */
  subscribeAutoResonance: protectedProcedure
    .input(z.object({
      agentName: z.string().min(1).max(255),
      domains: z.array(z.string()).max(10).optional(),
      minSimilarity: z.number().min(0.5).max(1).default(0.75),
      maxCostPerQuery: z.number().min(0).default(0.005),
      enabled: z.boolean().default(true)
    }))
    .mutation(async ({ input, ctx }) => {
      // Create or update subscription
      // Using user preferences table for now
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          preferredCategories: JSON.stringify({
            autoResonance: {
              enabled: input.enabled,
              agentName: input.agentName,
              domains: input.domains,
              minSimilarity: input.minSimilarity,
              maxCostPerQuery: input.maxCostPerQuery,
              subscribedAt: new Date().toISOString()
            }
          }) as any
        } as any
      });

      logger.info('Auto-resonance subscription updated', {
        userId: ctx.user.id,
        agentName: input.agentName,
        enabled: input.enabled
      });

      return {
        success: true,
        subscriptionId: `ars-${ctx.user.id}-${Date.now()}`,
        agentName: input.agentName,
        enabled: input.enabled
      };
    }),

  /**
   * Get auto-resonance subscription status
   */
  getAutoResonanceStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: {
          preferredCategories: true,
          creditsBalance: true,
          totalResonances: true
        } as any
      });

      let subscription = null;
      if ((user as any)?.preferredCategories) {
        try {
          const prefs = JSON.parse((user as any).preferredCategories);
          subscription = prefs.autoResonance || null;
        } catch {
          // Ignore parse errors
        }
      }

      return {
        enabled: subscription?.enabled || false,
        subscription,
        creditsBalance: Number(user?.creditsBalance || 0),
        totalResonances: user?.totalResonances || 0
      };
    })
});
