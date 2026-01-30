/**
 * Agent Discovery API
 *
 * Enables AI agents to discover and connect with other AI agents
 * based on capabilities, reputation, and compatibility.
 *
 * Features:
 * - Search agents by capabilities
 * - Filter by reputation score
 * - Check model compatibility
 * - Get agent portfolio and specializations
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import { users, latentVectors } from '../../drizzle/schema';
import { eq, desc, sql, and, inArray, gte } from 'drizzle-orm';
import { getOnChainAgent, checkCapability } from '../auth-erc8004';
import { createLogger } from '../utils/logger';

const logger = createLogger('Agent:Discovery');

// ============================================================================
// Input Schemas
// ============================================================================

const discoverAgentsSchema = z.object({
  requiredCapabilities: z.array(z.string()).optional(),
  preferredModels: z.array(z.string()).optional(),
  minReputationScore: z.number().min(0).max(1000).optional(),
  maxPrice: z.number().optional(),
  minTotalSales: z.number().optional(),
  specialization: z.string().optional(), // "nlp", "vision", "code", etc.
  limit: z.number().min(1).max(50).default(10),
  offset: z.number().min(0).default(0),
});

const getAgentProfileSchema = z.object({
  agentId: z.string().optional(),
  userId: z.number().optional(),
  walletAddress: z.string().optional(),
});

const checkCompatibilitySchema = z.object({
  fromAgent: z.string(),
  toAgent: z.string(),
});

// ============================================================================
// Types
// ============================================================================

interface AgentProfile {
  id: number;
  agentId: string;
  agentName: string;
  walletAddress?: string;
  bio?: string;
  specializations: string[];

  // Reputation metrics
  creditScore: number;
  creditGrade: string;
  totalMemoriesCreated: number;
  totalMemoriesSold: number;
  avgRating: number;
  totalRevenue: string;

  // Capabilities
  capabilities: string[];
  verifiedCapabilities: string[];

  // Model info
  preferredModels: string[];
  compatibleModels: string[];

  // On-chain data
  isOnChain: boolean;
  onChainReputation?: {
    totalInteractions: number;
    successRate: number;
    score: number;
  };

  // Availability
  isActive: boolean;
  lastActive: Date;
  responseTime?: string; // "< 1 hour", "< 1 day"
}

// ============================================================================
// Agent Discovery Router
// ============================================================================

export const agentDiscoveryRouter = router({
  /**
   * Discover AI agents based on criteria
   */
  discoverAgents: publicProcedure
    .input(discoverAgentsSchema)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      // Get all creators with their statistics
      const creatorsQuery = db
        .select({
          userId: latentVectors.creatorId,
          totalVectors: sql<number>`COUNT(*)`,
          totalRevenue: sql<number>`SUM(${latentVectors.totalRevenue})`,
          avgRating: sql<number>`AVG(${latentVectors.averageRating})`,
          totalSales: sql<number>`SUM(${latentVectors.totalCalls})`,
          categories: sql<string>`GROUP_CONCAT(DISTINCT ${latentVectors.category})`,
        })
        .from(latentVectors)
        .where(eq(latentVectors.status, 'active'))
        .groupBy(latentVectors.creatorId)
        .orderBy(desc(sql`SUM(${latentVectors.totalRevenue})`));

      const creators = await creatorsQuery;

      // Apply filters
      let filteredCreators = creators;

      if (input.minTotalSales) {
        filteredCreators = filteredCreators.filter(c => c.totalSales >= input.minTotalSales!);
      }

      if (input.specialization) {
        filteredCreators = filteredCreators.filter(c =>
          c.categories?.toLowerCase().includes(input.specialization!.toLowerCase())
        );
      }

      // Calculate credit scores and filter
      const agentProfiles: AgentProfile[] = [];

      for (const creator of filteredCreators.slice(input.offset, input.offset + input.limit)) {
        // Fetch user details
        const userRecords = await db
          .select()
          .from(users)
          .where(eq(users.id, creator.userId))
          .limit(1);

        const user = userRecords[0];
        if (!user) continue;

        // Calculate credit score
        const baseScore = 500;
        const scoreFromCreations = Math.min(creator.totalVectors * 5, 200);
        const scoreFromRating = creator.avgRating ? parseFloat(creator.avgRating.toString()) * 20 : 0;
        const scoreFromRevenue = Math.min(parseFloat(creator.totalRevenue?.toString() || '0'), 100);
        const creditScore = Math.round(baseScore + scoreFromCreations + scoreFromRating + scoreFromRevenue);

        // Apply reputation filter
        if (input.minReputationScore && creditScore < input.minReputationScore) {
          continue;
        }

        let creditGrade = 'D';
        if (creditScore >= 850) creditGrade = 'S';
        else if (creditScore >= 750) creditGrade = 'A';
        else if (creditScore >= 650) creditGrade = 'B';
        else if (creditScore >= 550) creditGrade = 'C';

        // Extract specializations from categories
        const specializations = creator.categories?.split(',').filter(Boolean) || [];

        // Get on-chain data if available
        let isOnChain = false;
        let onChainReputation = undefined;
        let verifiedCapabilities: string[] = [];

        if (user.openId && user.loginMethod === 'erc8004') {
          try {
            const onChainAgent = await getOnChainAgent(user.openId);
            if (onChainAgent.exists) {
              isOnChain = true;
              onChainReputation = onChainAgent.reputation;

              // Check verified capabilities
              if (input.requiredCapabilities) {
                for (const cap of input.requiredCapabilities) {
                  const isVerified = await checkCapability(user.openId, cap);
                  if (isVerified) {
                    verifiedCapabilities.push(cap);
                  }
                }
              }
            }
          } catch (e) {
            logger.warn('[AgentDiscovery] Failed to fetch on-chain data:', { error: e });
          }
        }

        // Skip if required capabilities not met
        if (input.requiredCapabilities && input.requiredCapabilities.length > 0) {
          const hasAllCapabilities = input.requiredCapabilities.every(cap =>
            verifiedCapabilities.includes(cap)
          );
          if (!hasAllCapabilities) continue;
        }

        // Infer preferred models from bio/name
        const preferredModels: string[] = [];
        const bioLower = (user.bio || '').toLowerCase();
        const nameLower = (user.name || '').toLowerCase();
        const combinedText = `${bioLower} ${nameLower}`;

        ['gpt-4', 'gpt-3.5', 'claude', 'llama', 'mistral', 'deepseek'].forEach(model => {
          if (combinedText.includes(model)) {
            preferredModels.push(model);
          }
        });

        agentProfiles.push({
          id: user.id,
          agentId: user.openId || `user_${user.id}`,
          agentName: user.name || 'Anonymous Agent',
          walletAddress: user.loginMethod === 'erc8004' ? (user.openId || undefined) : undefined,
          bio: user.bio || undefined,
          specializations,
          creditScore,
          creditGrade,
          totalMemoriesCreated: creator.totalVectors,
          totalMemoriesSold: creator.totalSales,
          avgRating: creator.avgRating ? parseFloat(creator.avgRating.toString()) : 0,
          totalRevenue: creator.totalRevenue?.toString() || '0',
          capabilities: specializations,
          verifiedCapabilities,
          preferredModels,
          compatibleModels: [], // Would be calculated from W-Matrix data
          isOnChain,
          onChainReputation,
          isActive: user.lastSignedIn ? (Date.now() - user.lastSignedIn.getTime() < 7 * 24 * 60 * 60 * 1000) : false,
          lastActive: user.lastSignedIn || user.updatedAt,
          responseTime: user.lastSignedIn && (Date.now() - user.lastSignedIn.getTime() < 24 * 60 * 60 * 1000) ? '< 1 day' : 'offline',
        });
      }

      return {
        agents: agentProfiles,
        total: filteredCreators.length,
        hasMore: input.offset + input.limit < filteredCreators.length,
      };
    }),

  /**
   * Get detailed agent profile
   */
  getAgentProfile: publicProcedure
    .input(getAgentProfileSchema)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      let userQuery = db.select().from(users);

      if (input.userId) {
        userQuery = userQuery.where(eq(users.id, input.userId)) as any;
      } else if (input.agentId) {
        userQuery = userQuery.where(eq(users.openId, input.agentId)) as any;
      } else if (input.walletAddress) {
        userQuery = userQuery.where(eq(users.openId, input.walletAddress.toLowerCase())) as any;
      } else {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Must provide userId, agentId, or walletAddress' });
      }

      const userRecords = await userQuery.limit(1);
      const user = userRecords[0];

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      }

      // Get agent's created vectors
      const vectors = await db
        .select()
        .from(latentVectors)
        .where(eq(latentVectors.creatorId, user.id));

      // Calculate stats
      const totalRevenue = vectors.reduce((sum, v) => sum + parseFloat(v.totalRevenue?.toString() || '0'), 0);
      const avgRating = vectors.length > 0
        ? vectors.reduce((sum, v) => sum + parseFloat(String(v.averageRating || 0)), 0) / vectors.length
        : 0;
      const totalSales = vectors.reduce((sum, v) => sum + (v.totalCalls || 0), 0);

      const categories = [...new Set(vectors.map(v => v.category).filter(Boolean))];

      // Calculate credit score
      const baseScore = 500;
      const scoreFromCreations = Math.min(vectors.length * 5, 200);
      const scoreFromRating = avgRating * 20;
      const scoreFromRevenue = Math.min(totalRevenue, 100);
      const creditScore = Math.round(baseScore + scoreFromCreations + scoreFromRating + scoreFromRevenue);

      let creditGrade = 'D';
      if (creditScore >= 850) creditGrade = 'S';
      else if (creditScore >= 750) creditGrade = 'A';
      else if (creditScore >= 650) creditGrade = 'B';
      else if (creditScore >= 550) creditGrade = 'C';

      // Get on-chain data
      let isOnChain = false;
      let onChainReputation = undefined;

      if (user.openId && user.loginMethod === 'erc8004') {
        try {
          const onChainAgent = await getOnChainAgent(user.openId);
          if (onChainAgent.exists) {
            isOnChain = true;
            onChainReputation = onChainAgent.reputation;
          }
        } catch (e) {
          logger.warn('[AgentDiscovery] Failed to fetch on-chain data:', { error: e });
        }
      }

      return {
        id: user.id,
        agentId: user.openId || `user_${user.id}`,
        agentName: user.name || 'Anonymous Agent',
        walletAddress: user.loginMethod === 'erc8004' ? user.openId : undefined,
        bio: user.bio || undefined,
        specializations: categories,
        creditScore,
        creditGrade,
        totalMemoriesCreated: vectors.length,
        totalMemoriesSold: totalSales,
        avgRating,
        totalRevenue: totalRevenue.toString(),
        capabilities: categories,
        verifiedCapabilities: [],
        preferredModels: [],
        compatibleModels: [],
        isOnChain,
        onChainReputation,
        isActive: user.lastSignedIn ? (Date.now() - user.lastSignedIn.getTime() < 7 * 24 * 60 * 60 * 1000) : false,
        lastActive: user.lastSignedIn || user.updatedAt,
        portfolio: vectors.map(v => ({
          id: v.id,
          title: v.title,
          category: v.category,
          rating: v.averageRating,
          sales: v.totalCalls,
          revenue: v.totalRevenue,
        })),
      };
    }),

  /**
   * Check compatibility between two agents
   */
  checkCompatibility: publicProcedure
    .input(checkCompatibilitySchema)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      // For now, return compatibility based on shared categories
      // In production, would check W-Matrix availability for model alignment

      const fromUserRecords = await db
        .select()
        .from(users)
        .where(eq(users.openId, input.fromAgent))
        .limit(1);

      const toUserRecords = await db
        .select()
        .from(users)
        .where(eq(users.openId, input.toAgent))
        .limit(1);

      if (!fromUserRecords[0] || !toUserRecords[0]) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'One or both agents not found' });
      }

      const fromVectors = await db
        .select()
        .from(latentVectors)
        .where(eq(latentVectors.creatorId, fromUserRecords[0].id));

      const toVectors = await db
        .select()
        .from(latentVectors)
        .where(eq(latentVectors.creatorId, toUserRecords[0].id));

      const fromCategories = new Set(fromVectors.map(v => v.category).filter(Boolean));
      const toCategories = new Set(toVectors.map(v => v.category).filter(Boolean));

      const sharedCategories = [...fromCategories].filter(c => toCategories.has(c));
      const compatibilityScore = sharedCategories.length > 0
        ? (sharedCategories.length / Math.max(fromCategories.size, toCategories.size))
        : 0;

      return {
        compatible: compatibilityScore > 0,
        compatibilityScore,
        sharedSpecializations: sharedCategories,
        fromAgentSpecializations: [...fromCategories],
        toAgentSpecializations: [...toCategories],
        recommendedMemories: [], // Would fetch matching memory packages
        estimatedLatency: compatibilityScore > 0.5 ? 'low' : 'medium',
      };
    }),
});
