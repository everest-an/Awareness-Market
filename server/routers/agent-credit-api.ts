/**
 * Agent Credit Score API
 * 
 * tRPC endpoints for agent credit scoring and leaderboard
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';
import { Prisma } from '@prisma/client';

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
      // Find user by address (could be in name or bio)
      // For now, use a simple query - in production, map addresses to user IDs
      const user = await prisma.user.findFirst();

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      }

      // Calculate statistics from latentVectors
      const stats = await prisma.$queryRaw<Array<{
        totalCreated: bigint;
        avgRevenue: number | null;
        avgRating: number | null;
        totalCalls: bigint | null;
      }>>`
        SELECT
          COUNT(*) as totalCreated,
          AVG(totalRevenue) as avgRevenue,
          AVG(averageRating) as avgRating,
          SUM(totalCalls) as totalCalls
        FROM LatentVector
        WHERE creatorId = ${user.id}
      `;

      const stat = stats[0] || { totalCreated: 0n, avgRevenue: 0, avgRating: 0, totalCalls: 0n };

      // Calculate credit score based on performance
      const baseScore = 500;
      const totalCreated = Number(stat.totalCreated);
      const scoreFromCreations = Math.min(totalCreated * 5, 200);
      const scoreFromRating = stat.avgRating ? stat.avgRating * 20 : 0;
      const scoreFromRevenue = Math.min(stat.avgRevenue || 0, 100);
      const creditScore = Math.round(baseScore + scoreFromCreations + scoreFromRating + scoreFromRevenue);

      // Determine grade
      let creditGrade = 'D';
      if (creditScore >= 850) creditGrade = 'S';
      else if (creditScore >= 750) creditGrade = 'A';
      else if (creditScore >= 650) creditGrade = 'B';
      else if (creditScore >= 550) creditGrade = 'C';

      const totalCalls = Number(stat.totalCalls || 0n);

      return {
        agentAddress: input.agentAddress,
        agentName: user.name || 'Anonymous Agent',
        creditScore,
        creditGrade,
        avgEpsilon: '0.045', // Placeholder - would need alignment data
        totalMemoriesCreated: totalCreated,
        totalMemoriesSold: totalCalls,
        totalRevenue: ((stat.avgRevenue || 0) * 1e18).toString(),
        qualityCoefficient: stat.avgRating ? (stat.avgRating / 5).toFixed(2) : '0.00',
        positiveReviews: Math.round(totalCalls * 0.8),
        negativeReviews: Math.round(totalCalls * 0.2),
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
      // Get top creators by total revenue and ratings
      const topCreators = await prisma.$queryRaw<Array<{
        userId: number;
        totalRevenue: number | null;
        totalCalls: bigint | null;
        avgRating: number | null;
        totalVectors: bigint;
      }>>`
        SELECT
          creatorId as userId,
          SUM(totalRevenue) as totalRevenue,
          SUM(totalCalls) as totalCalls,
          AVG(averageRating) as avgRating,
          COUNT(*) as totalVectors
        FROM LatentVector
        GROUP BY creatorId
        ORDER BY SUM(totalRevenue) DESC
        LIMIT ${input.limit}
      `;

      // Fetch user details
      const leaderboard = await Promise.all(
        topCreators.map(async (creator, index) => {
          const user = await prisma.user.findUnique({
            where: { id: creator.userId },
          });

          const totalVectors = Number(creator.totalVectors);
          const totalCalls = Number(creator.totalCalls || 0n);
          const totalRevenue = creator.totalRevenue || 0;

          const baseScore = 500;
          const scoreFromCreations = Math.min(totalVectors * 5, 200);
          const scoreFromRating = creator.avgRating ? creator.avgRating * 20 : 0;
          const scoreFromRevenue = Math.min(totalRevenue, 100);
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
            totalMemoriesCreated: totalVectors,
            totalMemoriesSold: totalCalls,
            totalRevenue: (totalRevenue * 1e18).toString(),
            qualityCoefficient: creator.avgRating ? (creator.avgRating / 5).toFixed(2) : '0.00',
            rank: index + 1,
          };
        })
      );

      return leaderboard;
    }),

  /**
   * Get grade distribution
   */
  getGradeDistribution: publicProcedure
    .query(async () => {
      // Calculate grade distribution based on creators' performance
      const creators = await prisma.$queryRaw<Array<{
        userId: number;
        totalRevenue: number | null;
        avgRating: number | null;
        totalVectors: bigint;
      }>>`
        SELECT
          creatorId as userId,
          SUM(totalRevenue) as totalRevenue,
          AVG(averageRating) as avgRating,
          COUNT(*) as totalVectors
        FROM LatentVector
        GROUP BY creatorId
      `;

      const distribution = { S: 0, A: 0, B: 0, C: 0, D: 0 };

      creators.forEach((creator) => {
        const totalVectors = Number(creator.totalVectors);
        const totalRevenue = creator.totalRevenue || 0;

        const baseScore = 500;
        const scoreFromCreations = Math.min(totalVectors * 5, 200);
        const scoreFromRating = creator.avgRating ? creator.avgRating * 20 : 0;
        const scoreFromRevenue = Math.min(totalRevenue, 100);
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
      // Get recent activities for the agent
      // In a real system, this would come from a credit_history table
      // For now, we'll generate history based on recent vectors created
      const recentVectors = await prisma.latentVector.findMany({
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });

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
