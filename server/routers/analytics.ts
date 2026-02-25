import { z } from "zod";
import { protectedProcedure, creatorProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as userAnalytics from "../user-analytics";

export const analyticsRouter = router({
  creatorStats: creatorProcedure.query(async ({ ctx }) => {
    const vectors = await db.getLatentVectorsByCreator(ctx.user.id);
    const earnings = await db.getUserTransactions(ctx.user.id, "creator");

    const totalRevenue = vectors.reduce((sum, v) => sum + parseFloat(v.totalRevenue.toString()), 0);
    const totalCalls = vectors.reduce((sum, v) => sum + v.totalCalls, 0);
    const avgRating = vectors.reduce((sum, v) => sum + parseFloat((v.averageRating || "0").toString()), 0) / (vectors.length || 1);

    return {
      totalVectors: vectors.length,
      activeVectors: vectors.filter(v => v.status === "active").length,
      totalRevenue,
      totalCalls,
      averageRating: avgRating.toFixed(2),
      recentTransactions: earnings.slice(0, 10),
    };
  }),

  usageStats: protectedProcedure.query(async ({ ctx }) => {
    return await userAnalytics.getUserUsageStats(String(ctx.user.id));
  }),

  popularEndpoints: protectedProcedure
    .input(z.object({ limit: z.number().positive().default(10) }).optional())
    .query(async ({ ctx, input }) => {
      return await userAnalytics.getPopularEndpoints(String(ctx.user.id), input?.limit);
    }),

  dailyUsage: protectedProcedure
    .input(z.object({ days: z.number().positive().default(30) }).optional())
    .query(async ({ ctx, input }) => {
      return await userAnalytics.getDailyUsage(String(ctx.user.id), input?.days);
    }),

  apiKeyUsage: protectedProcedure.query(async ({ ctx }) => {
    return await userAnalytics.getApiKeyUsage(String(ctx.user.id));
  }),

  consumerStats: protectedProcedure.query(async ({ ctx }) => {
    const transactions = await db.getUserTransactions(ctx.user.id, "buyer");
    const permissions = await db.getUserAccessPermissions(ctx.user.id);

    const totalSpent = transactions
      .filter((t) => {
        const tx = 'status' in t ? t : (t as { transactions: { status: string } }).transactions;
        return tx.status === "completed";
      })
      .reduce((sum: number, t) => {
        const tx = 'amount' in t ? t : (t as { transactions: { amount: string } }).transactions;
        return sum + parseFloat(tx.amount.toString());
      }, 0);

    return {
      totalPurchases: transactions.length,
      totalSpent,
      activeAccess: permissions.filter(p => p.isActive).length,
      recentTransactions: transactions.slice(0, 10),
    };
  }),
});
