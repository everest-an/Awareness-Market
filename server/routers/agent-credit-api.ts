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
// Helpers
// ============================================================================

function calculateCreditScore(params: {
  totalCreated: number;
  avgRating: number;
  avgRevenue: number;
}): { creditScore: number; creditGrade: string } {
  const baseScore = 500;
  const scoreFromCreations = Math.min(params.totalCreated * 5, 200);
  const scoreFromRating = params.avgRating ? params.avgRating * 20 : 0;
  const scoreFromRevenue = Math.min(params.avgRevenue || 0, 100);
  const creditScore = Math.round(baseScore + scoreFromCreations + scoreFromRating + scoreFromRevenue);

  let creditGrade = 'D';
  if (creditScore >= 850) creditGrade = 'S';
  else if (creditScore >= 750) creditGrade = 'A';
  else if (creditScore >= 650) creditGrade = 'B';
  else if (creditScore >= 550) creditGrade = 'C';

  return { creditScore, creditGrade };
}

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
      const normalized = input.agentAddress.toLowerCase();

      // Find user by wallet address or openId (wallet-based login)
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { walletAddress: normalized },
            { walletAddress: input.agentAddress },
            { openId: normalized },
            { openId: input.agentAddress },
          ],
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      }

      const stats = await prisma.latentVector.aggregate({
        where: { creatorId: user.id },
        _count: { _all: true },
        _avg: { totalRevenue: true, averageRating: true },
        _sum: { totalCalls: true },
      });

      const totalCreated = stats._count._all || 0;
      const avgRevenue = Number(stats._avg.totalRevenue || 0);
      const avgRating = Number(stats._avg.averageRating || 0);
      const totalCalls = Number(stats._sum.totalCalls || 0);

      const [vectorPackages, memoryPackages, chainPackages] = await Promise.all([
        prisma.vectorPackage.findMany({
          where: { userId: user.id },
          select: { epsilon: true },
        }),
        prisma.memoryPackage.findMany({
          where: { userId: user.id },
          select: { epsilon: true },
        }),
        prisma.chainPackage.findMany({
          where: { userId: user.id },
          select: { epsilon: true },
        }),
      ]);

      const epsilonValues = [
        ...vectorPackages.map((pkg) => Number(pkg.epsilon || 0)),
        ...memoryPackages.map((pkg) => Number(pkg.epsilon || 0)),
        ...chainPackages.map((pkg) => Number(pkg.epsilon || 0)),
      ].filter((value) => Number.isFinite(value) && value > 0);

      const avgEpsilon = epsilonValues.length > 0
        ? (epsilonValues.reduce((sum, value) => sum + value, 0) / epsilonValues.length).toFixed(3)
        : '0.000';

      const { creditScore, creditGrade } = calculateCreditScore({
        totalCreated,
        avgRating,
        avgRevenue,
      });

      return {
        agentAddress: input.agentAddress,
        agentName: user.name || 'Anonymous Agent',
        creditScore,
        creditGrade,
        avgEpsilon,
        totalMemoriesCreated: totalCreated,
        totalMemoriesSold: totalCalls,
        totalRevenue: (avgRevenue * 1e18).toString(),
        qualityCoefficient: avgRating ? (avgRating / 5).toFixed(2) : '0.00',
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
            agentAddress: user?.walletAddress || `0x${creator.userId.toString().padStart(40, '0')}`,
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
      const normalized = input.agentAddress.toLowerCase();
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { walletAddress: normalized },
            { walletAddress: input.agentAddress },
            { openId: normalized },
            { openId: input.agentAddress },
          ],
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      }

      const vectors = await prisma.latentVector.findMany({
        where: { creatorId: user.id },
        orderBy: { createdAt: 'asc' },
        take: input.limit,
        select: {
          id: true,
          status: true,
          createdAt: true,
          totalRevenue: true,
          averageRating: true,
        },
      });

      let totalCreated = 0;
      let revenueSum = 0;
      let ratingSum = 0;
      let ratingCount = 0;
      let previousScore = 500;

      const history = vectors.map((vector) => {
        totalCreated += 1;
        revenueSum += Number(vector.totalRevenue || 0);
        if (vector.averageRating !== null && vector.averageRating !== undefined) {
          ratingSum += Number(vector.averageRating);
          ratingCount += 1;
        }

        const avgRevenue = totalCreated > 0 ? revenueSum / totalCreated : 0;
        const avgRating = ratingCount > 0 ? ratingSum / ratingCount : 0;
        const { creditScore } = calculateCreditScore({ totalCreated, avgRating, avgRevenue });

        const entry = {
          previousScore,
          newScore: creditScore,
          scoreDelta: creditScore - previousScore,
          reason: vector.status === 'active' ? 'Memory published' : 'Memory created',
          relatedNftId: `vector-${vector.id}`,
          createdAt: vector.createdAt,
        };

        previousScore = creditScore;
        return entry;
      });

      return history.reverse();
    }),
});
