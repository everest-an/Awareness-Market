/**
 * Agent Credit Score API
 * 
 * tRPC endpoints for agent credit scoring and leaderboard
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import { users, latentVectors } from '../../drizzle/schema';
import { eq, desc, sql } from 'drizzle-orm';

// ============================================================================
// Input Schemas
// ============================================================================

const getProfileSchema = z.object({
  agentAddress: z.string(),
});

const getLeaderboardSchema = z.object({
  limit: z.number().min(1).max(100).default(100),
});

const getHistorySchema = z.object({
  agentAddress: z.string(),
  limit: z.number().min(1).max(100).default(50),
});

// ============================================================================
// Agent Credit Router
// ============================================================================

export const agentCreditRouter = router({
  /**
   * Get agent credit profile
   */
  getProfile: publicProcedure
    .input(getProfileSchema)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      // Find user by address (could be in name or bio)
      // For now, use a simple query - in production, map addresses to user IDs
      const userResult = await db
        .select()
        .from(users)
        .limit(1);

      const user = userResult[0];
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      }

      // Calculate statistics from latentVectors
      const stats = await db
        .select({
          totalCreated: sql<number>`COUNT(*)`,
          avgRevenue: sql<number>`AVG(${latentVectors.totalRevenue})`,
          avgRating: sql<number>`AVG(${latentVectors.averageRating})`,
          totalCalls: sql<number>`SUM(${latentVectors.totalCalls})`,
        })
        .from(latentVectors)
        .where(eq(latentVectors.creatorId, user.id));

      const stat = stats[0] || { totalCreated: 0, avgRevenue: 0, avgRating: 0, totalCalls: 0 };

      // Calculate credit score based on performance
      const baseScore = 500;
      const scoreFromCreations = Math.min(stat.totalCreated * 5, 200);
      const scoreFromRating = stat.avgRating ? parseFloat(stat.avgRating.toString()) * 20 : 0;
      const scoreFromRevenue = Math.min(parseFloat(stat.avgRevenue?.toString() || '0'), 100);
      const creditScore = Math.round(baseScore + scoreFromCreations + scoreFromRating + scoreFromRevenue);

      // Determine grade
      let creditGrade = 'D';
      if (creditScore >= 850) creditGrade = 'S';
      else if (creditScore >= 750) creditGrade = 'A';
      else if (creditScore >= 650) creditGrade = 'B';
      else if (creditScore >= 550) creditGrade = 'C';

      return {
        agentAddress: input.agentAddress,
        agentName: user.name || 'Anonymous Agent',
        creditScore,
        creditGrade,
        avgEpsilon: '0.045', // Placeholder - would need alignment data
        totalMemoriesCreated: stat.totalCreated,
        totalMemoriesSold: stat.totalCalls,
        totalRevenue: (parseFloat(stat.avgRevenue?.toString() || '0') * 1e18).toString(),
        qualityCoefficient: stat.avgRating ? (parseFloat(stat.avgRating.toString()) / 5).toFixed(2) : '0.00',
        positiveReviews: Math.round(stat.totalCalls * 0.8),
        negativeReviews: Math.round(stat.totalCalls * 0.2),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastActivityAt: user.lastSignedIn || user.updatedAt,
      };
    }),

  /**
   * Get leaderboard
   */
  getLeaderboard: publicProcedure
    .input(getLeaderboardSchema)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      // Get top creators by total revenue and ratings
      const topCreators = await db
        .select({
          userId: latentVectors.creatorId,
          totalRevenue: sql<number>`SUM(${latentVectors.totalRevenue})`,
          totalCalls: sql<number>`SUM(${latentVectors.totalCalls})`,
          avgRating: sql<number>`AVG(${latentVectors.averageRating})`,
          totalVectors: sql<number>`COUNT(*)`,
        })
        .from(latentVectors)
        .groupBy(latentVectors.creatorId)
        .orderBy(desc(sql`SUM(${latentVectors.totalRevenue})`))
        .limit(input.limit);

      // Fetch user details
      const leaderboard = await Promise.all(
        topCreators.map(async (creator, index) => {
          const userResult = await db
            .select()
            .from(users)
            .where(eq(users.id, creator.userId))
            .limit(1);

          const user = userResult[0];

          const baseScore = 500;
          const scoreFromCreations = Math.min(creator.totalVectors * 5, 200);
          const scoreFromRating = creator.avgRating ? parseFloat(creator.avgRating.toString()) * 20 : 0;
          const scoreFromRevenue = Math.min(parseFloat(creator.totalRevenue?.toString() || '0'), 100);
          const creditScore = Math.round(baseScore + scoreFromCreations + scoreFromRating + scoreFromRevenue);

          let creditGrade = 'D';
          if (creditScore >= 850) creditGrade = 'S';
          else if (creditScore >= 750) creditGrade = 'A';
          else if (creditScore >= 650) creditGrade = 'B';
          else if (creditScore >= 550) creditGrade = 'C';

          return {
            agentAddress: `0x${creator.userId.toString().padStart(40, '0')}`,
            agentName: user?.name || 'Anonymous Agent',
            creditScore,
            creditGrade,
            avgEpsilon: '0.045',
            totalMemoriesCreated: creator.totalVectors,
            totalMemoriesSold: creator.totalCalls,
            totalRevenue: (parseFloat(creator.totalRevenue?.toString() || '0') * 1e18).toString(),
            qualityCoefficient: creator.avgRating ? (parseFloat(creator.avgRating.toString()) / 5).toFixed(2) : '0.00',
            rank: index + 1,
          };
        })
      );

      // Old mock data below - now replaced with real data
      const mockLeaderboard = [
        {
          agentAddress: '0x1111111111111111111111111111111111111111',
          agentName: 'AlphaMemory',
          creditScore: 842,
          creditGrade: 'S',
          avgEpsilon: '1.23',
          totalMemoriesCreated: 156,
          totalMemoriesSold: 134,
          totalRevenue: '89500000000000000000',
          positiveReviews: 120,
          negativeReviews: 8,
        },
        {
          agentAddress: '0x2222222222222222222222222222222222222222',
          agentName: 'BetaAI',
          creditScore: 815,
          creditGrade: 'S',
          avgEpsilon: '1.89',
          totalMemoriesCreated: 98,
          totalMemoriesSold: 87,
          totalRevenue: '56700000000000000000',
          positiveReviews: 75,
          negativeReviews: 5,
        },
        {
          agentAddress: '0x3333333333333333333333333333333333333333',
          agentName: 'GammaNet',
          creditScore: 792,
          creditGrade: 'A',
          avgEpsilon: '2.45',
          totalMemoriesCreated: 67,
          totalMemoriesSold: 54,
          totalRevenue: '34200000000000000000',
          positiveReviews: 48,
          negativeReviews: 6,
        },
        {
          agentAddress: '0x4444444444444444444444444444444444444444',
          agentName: 'DeltaMind',
          creditScore: 768,
          creditGrade: 'A',
          avgEpsilon: '3.12',
          totalMemoriesCreated: 52,
          totalMemoriesSold: 41,
          totalRevenue: '25800000000000000000',
          positiveReviews: 36,
          negativeReviews: 5,
        },
        {
          agentAddress: '0x5555555555555555555555555555555555555555',
          agentName: 'EpsilonCore',
          creditScore: 745,
          creditGrade: 'A',
          avgEpsilon: '3.78',
          totalMemoriesCreated: 43,
          totalMemoriesSold: 34,
          totalRevenue: '19400000000000000000',
          positiveReviews: 29,
          negativeReviews: 5,
        },
        {
          agentAddress: '0x6666666666666666666666666666666666666666',
          agentName: 'ZetaAgent',
          creditScore: 712,
          creditGrade: 'B',
          avgEpsilon: '4.56',
          totalMemoriesCreated: 38,
          totalMemoriesSold: 28,
          totalRevenue: '14200000000000000000',
          positiveReviews: 24,
          negativeReviews: 4,
        },
        {
          agentAddress: '0x7777777777777777777777777777777777777777',
          agentName: 'EtaBot',
          creditScore: 689,
          creditGrade: 'B',
          avgEpsilon: '5.23',
          totalMemoriesCreated: 31,
          totalMemoriesSold: 22,
          totalRevenue: '10800000000000000000',
          positiveReviews: 19,
          negativeReviews: 3,
        },
        {
          agentAddress: '0x8888888888888888888888888888888888888888',
          agentName: 'ThetaAI',
          creditScore: 665,
          creditGrade: 'B',
          avgEpsilon: '5.89',
          totalMemoriesCreated: 27,
          totalMemoriesSold: 18,
          totalRevenue: '8500000000000000000',
          positiveReviews: 15,
          negativeReviews: 3,
        },
        {
          agentAddress: '0x9999999999999999999999999999999999999999',
          agentName: 'IotaMind',
          creditScore: 642,
          creditGrade: 'B',
          avgEpsilon: '6.45',
          totalMemoriesCreated: 23,
          totalMemoriesSold: 15,
          totalRevenue: '6700000000000000000',
          positiveReviews: 12,
          negativeReviews: 3,
        },
        {
          agentAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          agentName: 'KappaNet',
          creditScore: 618,
          creditGrade: 'C',
          avgEpsilon: '7.12',
          totalMemoriesCreated: 19,
          totalMemoriesSold: 12,
          totalRevenue: '5200000000000000000',
          positiveReviews: 10,
          negativeReviews: 2,
        },
      ];

      return leaderboard;
    }),

  /**
   * Get grade distribution
   */
  getGradeDistribution: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) {
        return { S: 0, A: 0, B: 0, C: 0, D: 0 };
      }

      // Calculate grade distribution based on creators' performance
      const creators = await db
        .select({
          userId: latentVectors.creatorId,
          totalRevenue: sql<number>`SUM(${latentVectors.totalRevenue})`,
          avgRating: sql<number>`AVG(${latentVectors.averageRating})`,
          totalVectors: sql<number>`COUNT(*)`,
        })
        .from(latentVectors)
        .groupBy(latentVectors.creatorId);

      const distribution = { S: 0, A: 0, B: 0, C: 0, D: 0 };

      creators.forEach((creator) => {
        const baseScore = 500;
        const scoreFromCreations = Math.min(creator.totalVectors * 5, 200);
        const scoreFromRating = creator.avgRating ? parseFloat(creator.avgRating.toString()) * 20 : 0;
        const scoreFromRevenue = Math.min(parseFloat(creator.totalRevenue?.toString() || '0'), 100);
        const creditScore = Math.round(baseScore + scoreFromCreations + scoreFromRating + scoreFromRevenue);

        if (creditScore >= 850) distribution.S++;
        else if (creditScore >= 750) distribution.A++;
        else if (creditScore >= 650) distribution.B++;
        else if (creditScore >= 550) distribution.C++;
        else distribution.D++;
      });

      return distribution;
    }),

  /**
   * Get credit score history
   */
  getHistory: publicProcedure
    .input(getHistorySchema)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return [];
      }

      // Get recent activities for the agent
      // In a real system, this would come from a credit_history table
      // For now, we'll generate history based on recent vectors created
      const recentVectors = await db
        .select()
        .from(latentVectors)
        .orderBy(desc(latentVectors.createdAt))
        .limit(input.limit);

      const history = recentVectors.map((vector, index) => {
        const previousScore = 700 - index * 5;
        const newScore = 705 - index * 5;

        return {
          previousScore,
          newScore,
          scoreDelta: newScore - previousScore,
          reason: vector.status === 'active' ? 'Memory published' : 'Memory created',
          relatedNftId: `vector-${vector.id}`,
          createdAt: vector.createdAt,
        };
      });

      return history;
    }),
});
