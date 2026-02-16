/**
 * Creator Dashboard Backend Logic
 * Revenue analysis, performance monitoring, and user feedback management
 */

import { prisma } from "./db-prisma";

// Cast prisma for models not yet in schema (legacy v1/v2)
const prismaAny = prisma as any;

export interface RevenueAnalytics {
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueGrowth: number; // percentage
  dailyRevenue: Array<{ date: string; revenue: number }>;
  revenueByVector: Array<{
    vectorId: number;
    vectorTitle: string;
    revenue: number;
    percentage: number;
  }>;
}

export interface PerformanceMetrics {
  totalInvocations: number;
  successRate: number;
  avgExecutionTime: number;
  totalTokensUsed: number;
  invocationsThisMonth: number;
  invocationsLastMonth: number;
  performanceByVector: Array<{
    vectorId: number;
    vectorTitle: string;
    invocations: number;
    successRate: number;
    avgExecutionTime: number;
  }>;
}

export interface UserFeedback {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: { [key: number]: number }; // 1-5 stars
  recentReviews: Array<{
    id: number;
    vectorId: number;
    vectorTitle: string;
    rating: number;
    comment: string | null;
    userName: string;
    createdAt: Date;
  }>;
}

/**
 * Get revenue analytics for creator
 */
export async function getCreatorRevenueAnalytics(creatorId: number, days: number = 30): Promise<RevenueAnalytics> {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get creator's vectors
  const creatorVectors = await prisma.latentVector.findMany({
    where: { creatorId },
  });

  const vectorIds = creatorVectors.map(v => v.id);

  if (vectorIds.length === 0) {
    return {
      totalRevenue: 0,
      revenueThisMonth: 0,
      revenueLastMonth: 0,
      revenueGrowth: 0,
      dailyRevenue: [],
      revenueByVector: [],
    };
  }

  // Get all invocations for creator's vectors
  const allInvocations = await prismaAny.vectorInvocation.findMany({
    where: {
      vectorId: { in: vectorIds },
    },
  });

  // Calculate total revenue
  const totalRevenue = allInvocations.reduce((sum: number, inv: any) => sum + parseFloat(inv.cost?.toString() || '0'), 0);

  // Revenue this month
  const revenueThisMonth = allInvocations
    .filter((inv: any) => new Date(inv.createdAt) >= monthStart)
    .reduce((sum: number, inv: any) => sum + parseFloat(inv.cost?.toString() || '0'), 0);

  // Revenue last month
  const revenueLastMonth = allInvocations
    .filter((inv: any) => {
      const date = new Date(inv.createdAt);
      return date >= lastMonthStart && date <= lastMonthEnd;
    })
    .reduce((sum: number, inv: any) => sum + parseFloat(inv.cost?.toString() || '0'), 0);

  // Calculate growth
  const revenueGrowth = revenueLastMonth > 0
    ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
    : 0;

  // Daily revenue for the period
  const dailyRevenueMap = new Map<string, number>();
  allInvocations
    .filter((inv: any) => new Date(inv.createdAt) >= startDate)
    .forEach((inv: any) => {
      const date = new Date(inv.createdAt).toISOString().split('T')[0];
      const current = dailyRevenueMap.get(date) || 0;
      dailyRevenueMap.set(date, current + parseFloat(inv.cost?.toString() || '0'));
    });

  const dailyRevenue = Array.from(dailyRevenueMap.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Revenue by vector
  const revenueByVectorMap = new Map<number, number>();
  allInvocations.forEach((inv: any) => {
    const current = revenueByVectorMap.get(inv.vectorId) || 0;
    revenueByVectorMap.set(inv.vectorId, current + parseFloat(inv.cost?.toString() || '0'));
  });

  const revenueByVector = Array.from(revenueByVectorMap.entries())
    .map(([vectorId, revenue]) => {
      const vector = creatorVectors.find(v => v.id === vectorId);
      return {
        vectorId,
        vectorTitle: vector?.title || 'Unknown',
        revenue,
        percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue,
    revenueThisMonth,
    revenueLastMonth,
    revenueGrowth,
    dailyRevenue,
    revenueByVector,
  };
}

/**
 * Get performance metrics for creator
 */
export async function getCreatorPerformanceMetrics(creatorId: number): Promise<PerformanceMetrics> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get creator's vectors
  const creatorVectors = await prisma.latentVector.findMany({
    where: { creatorId },
  });

  const vectorIds = creatorVectors.map(v => v.id);

  if (vectorIds.length === 0) {
    return {
      totalInvocations: 0,
      successRate: 0,
      avgExecutionTime: 0,
      totalTokensUsed: 0,
      invocationsThisMonth: 0,
      invocationsLastMonth: 0,
      performanceByVector: [],
    };
  }

  // Get all invocations
  const allInvocations = await prismaAny.vectorInvocation.findMany({
    where: {
      vectorId: { in: vectorIds },
    },
  });

  const totalInvocations = allInvocations.length;
  const successfulInvocations = allInvocations.filter((inv: any) => inv.status === 'success').length;
  const successRate = totalInvocations > 0 ? (successfulInvocations / totalInvocations) * 100 : 0;

  const avgExecutionTime = totalInvocations > 0
    ? allInvocations.reduce((sum: number, inv: any) => sum + (inv.executionTime || 0), 0) / totalInvocations
    : 0;

  const totalTokensUsed = allInvocations.reduce((sum: number, inv: any) => sum + (inv.tokensUsed || 0), 0);

  const invocationsThisMonth = allInvocations.filter((inv: any) => new Date(inv.createdAt) >= monthStart).length;
  const invocationsLastMonth = allInvocations.filter((inv: any) => {
    const date = new Date(inv.createdAt);
    return date >= lastMonthStart && date <= lastMonthEnd;
  }).length;

  // Performance by vector
  const performanceByVector = vectorIds.map(vectorId => {
    const vectorInvs = allInvocations.filter((inv: any) => inv.vectorId === vectorId);
    const vector = creatorVectors.find(v => v.id === vectorId);
    const successful = vectorInvs.filter((inv: any) => inv.status === 'success').length;
    const avgExecTime = vectorInvs.length > 0
      ? vectorInvs.reduce((sum: number, inv: any) => sum + (inv.executionTime || 0), 0) / vectorInvs.length
      : 0;

    return {
      vectorId,
      vectorTitle: vector?.title || 'Unknown',
      invocations: vectorInvs.length,
      successRate: vectorInvs.length > 0 ? (successful / vectorInvs.length) * 100 : 0,
      avgExecutionTime: Math.round(avgExecTime),
    };
  }).sort((a, b) => b.invocations - a.invocations);

  return {
    totalInvocations,
    successRate,
    avgExecutionTime: Math.round(avgExecutionTime),
    totalTokensUsed,
    invocationsThisMonth,
    invocationsLastMonth,
    performanceByVector,
  };
}

/**
 * Get user feedback for creator
 */
export async function getCreatorUserFeedback(creatorId: number, limit: number = 10): Promise<UserFeedback> {
  // Get creator's vectors
  const creatorVectors = await prisma.latentVector.findMany({
    where: { creatorId },
  });

  const vectorIds = creatorVectors.map(v => v.id);

  if (vectorIds.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      recentReviews: [],
    };
  }

  // Get all reviews for creator's vectors with joins
  const allReviews = await prisma.review.findMany({
    where: {
      vectorId: { in: vectorIds },
    },
    include: {
      vector: {
        select: {
          id: true,
          title: true,
        },
      },
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  const totalReviews = allReviews.length;
  const averageRating = totalReviews > 0
    ? allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;

  // Rating distribution
  const ratingDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  allReviews.forEach(r => {
    ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
  });

  const recentReviews = allReviews.map(r => ({
    id: r.id,
    vectorId: r.vectorId,
    vectorTitle: r.vector?.title || 'Unknown',
    rating: r.rating,
    comment: r.comment,
    userName: r.user?.name || 'Anonymous',
    createdAt: r.createdAt,
  }));

  return {
    totalReviews,
    averageRating,
    ratingDistribution,
    recentReviews,
  };
}

/**
 * Get dashboard overview for creator
 */
export async function getCreatorDashboardOverview(creatorId: number) {
  const [revenue, performance, feedback] = await Promise.all([
    getCreatorRevenueAnalytics(creatorId, 30),
    getCreatorPerformanceMetrics(creatorId),
    getCreatorUserFeedback(creatorId, 5),
  ]);

  return {
    revenue,
    performance,
    feedback,
  };
}
