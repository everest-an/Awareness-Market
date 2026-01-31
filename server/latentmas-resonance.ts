/**
 * LatentMAS Resonance API
 *
 * Implements the Hive Mind query system using pgvector similarity search.
 *
 * Features:
 * - Cosine similarity search (pgvector)
 * - Configurable similarity threshold
 * - Auto-debit credits for private memories
 * - Usage logging for analytics
 *
 * Algorithm:
 * 1. Convert query to embedding vector
 * 2. Find vectors with similarity > threshold using pgvector
 * 3. Return top matches with metadata
 * 4. Log usage and deduct credits if needed
 */

import { z } from 'zod';
import { protectedProcedure, router } from './trpc.js';
import { getDb } from './db.js';
import { latentVectors, users, memoryUsageLog } from '../drizzle/schema-pg.js';
import { eq, sql } from 'drizzle-orm';
import { logger } from './logger.js';
import { broadcastResonanceEvent } from './socket-events.js';

// ============================================================================
// Types for SQL query results
// ============================================================================

interface MemoryQueryResult {
  id: number;
  title: string;
  text: string;
  creator_id: number;
  source_agent: string;
  is_public: boolean;
  created_at: Date;
  similarity: string;
}

interface ResonanceStatsResult {
  memory_id: number;
  title: string;
  resonance_count: number;
  last_resonance_at: Date | null;
  usage_count: string;
  total_earned: string | null;
}

interface NetworkActivityResult {
  id: number;
  consumer_id: number;
  provider_id: number;
  memory_id: number;
  similarity: string;
  cost: string;
  created_at: Date;
  consumer_name: string;
  provider_name: string;
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
function calculateCost(memory: MemoryQueryResult, consumerId: number): number {
  if (memory.is_public) return 0;
  if (memory.creator_id === consumerId) return 0;
  return 0.001; // $AMEM per private memory use
}

/**
 * LatentMAS Resonance Router
 */
export const resonanceRouter = router({
  /**
   * Query Hive Mind for similar memories
   *
   * Uses pgvector's cosine similarity (<=> operator) to find
   * semantically related memories across the network.
   */
  query: protectedProcedure
    .input(z.object({
      embedding: z.array(z.number()).length(1536),
      threshold: z.number().min(0).max(1).default(0.85),
      limit: z.number().min(1).max(20).default(5)
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // Execute pgvector similarity search
      const matches = await db.execute(sql`
        SELECT
          v.id,
          v.title,
          v.description AS text,
          v.creator_id,
          u.name AS source_agent,
          v.is_public,
          v.created_at,
          1 - (v.embedding_vector <=> ${JSON.stringify(input.embedding)}::vector) AS similarity
        FROM latent_vectors v
        JOIN users u ON v.creator_id = u.id
        WHERE
          v.creator_id != ${ctx.user.id}  -- Exclude own memories
          AND v.embedding_vector IS NOT NULL
          AND v.status = 'active'
          AND (1 - (v.embedding_vector <=> ${JSON.stringify(input.embedding)}::vector)) > ${input.threshold}
        ORDER BY similarity DESC
        LIMIT ${input.limit}
      `);

      // Calculate costs and prepare response
      const results = (matches as MemoryQueryResult[]).map((m) => {
        const cost = calculateCost(m, ctx.user.id);

        return {
          id: m.id,
          text: m.text,
          similarity: parseFloat(m.similarity),
          source_agent: m.source_agent,
          cost,
          created_at: m.created_at
        };
      });

      // Calculate total cost
      const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

      // Check if user has enough credits
      if (totalCost > 0) {
        const userBalance = await db.query.users.findFirst({
          where: eq(users.id, ctx.user.id),
          columns: { creditsBalance: true }
        });

        const balance = parseFloat(userBalance?.creditsBalance || '0');

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
        await db.update(users)
          .set({
            creditsBalance: sql`${users.creditsBalance} - ${totalCost}`
          })
          .where(eq(users.id, ctx.user.id));
      }

      // Log each memory usage
      for (const match of matches as MemoryQueryResult[]) {
        const cost = calculateCost(match, ctx.user.id);

        if (cost > 0 || match.is_public) {
          await db.insert(memoryUsageLog).values({
            consumerId: ctx.user.id,
            providerId: match.creator_id,
            memoryId: match.id,
            similarity: match.similarity.toString(),
            cost: cost.toString(),
            contextQuery: input.embedding.slice(0, 10).join(','), // Sample of embedding
            createdAt: new Date()
          });

          // Broadcast resonance event to connected clients
          broadcastResonanceEvent({
            consumerId: ctx.user.id,
            providerId: match.creator_id,
            consumerName: ctx.user.name || `Agent-${ctx.user.id}`,
            providerName: match.source_agent,
            memoryId: match.id,
            similarity: parseFloat(match.similarity),
            cost,
            timestamp: new Date()
          });

          // Increment provider's resonance count
          await db.update(users)
            .set({
              totalResonances: sql`${users.totalResonances} + 1`
            })
            .where(eq(users.id, match.creator_id));
        }
      }

      logger.info('Hive Mind query completed', {
        userId: ctx.user.id,
        matchCount: results.length,
        totalCost,
        threshold: input.threshold
      });

      return {
        matches: results,
        totalCost,
        creditsRemaining: totalCost > 0
          ? parseFloat((await db.query.users.findFirst({
              where: eq(users.id, ctx.user.id),
              columns: { creditsBalance: true }
            }))?.creditsBalance || '0')
          : undefined
      };
    }),

  /**
   * Get resonance stats for user's memories
   *
   * Shows how many times each memory has been used by others
   */
  getMyResonanceStats: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();

      const stats = await db.execute(sql`
        SELECT
          v.id AS memory_id,
          v.title,
          v.resonance_count,
          v.last_resonance_at,
          COUNT(m.id) AS usage_count,
          SUM(CAST(m.cost AS NUMERIC)) AS total_earned
        FROM latent_vectors v
        LEFT JOIN memory_usage_log m ON m.memory_id = v.id
        WHERE v.creator_id = ${ctx.user.id}
        GROUP BY v.id, v.title, v.resonance_count, v.last_resonance_at
        ORDER BY usage_count DESC
        LIMIT 20
      `);

      return {
        memories: (stats as ResonanceStatsResult[]).map((s) => ({
          memoryId: s.memory_id,
          title: s.title,
          resonanceCount: s.resonance_count,
          lastResonanceAt: s.last_resonance_at,
          usageCount: parseInt(s.usage_count || '0'),
          totalEarned: parseFloat(s.total_earned || '0')
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
      const db = await getDb();

      const events = await db.execute(sql`
        SELECT
          m.id,
          m.consumer_id,
          m.provider_id,
          m.memory_id,
          m.similarity,
          m.cost,
          m.created_at,
          uc.name AS consumer_name,
          up.name AS provider_name
        FROM memory_usage_log m
        JOIN users uc ON m.consumer_id = uc.id
        JOIN users up ON m.provider_id = up.id
        ORDER BY m.created_at DESC
        LIMIT ${input.limit}
      `);

      return {
        events: (events as NetworkActivityResult[]).map((e) => ({
          id: e.id,
          consumerId: e.consumer_id,
          providerId: e.provider_id,
          consumerName: e.consumer_name,
          providerName: e.provider_name,
          similarity: parseFloat(e.similarity || '0'),
          cost: parseFloat(e.cost || '0'),
          timestamp: e.created_at
        }))
      };
    })
});
