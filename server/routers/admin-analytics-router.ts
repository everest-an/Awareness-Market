import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import * as adminAnalytics from "../admin-analytics";

export const adminAnalyticsRouter = router({
  getUsageStats: adminProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(7) }))
    .query(async ({ input }) => {
      return await adminAnalytics.getApiUsageStats(input.days);
    }),

  getUsageTimeline: adminProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      return await adminAnalytics.getApiUsageTimeline(input.days);
    }),

  getTopUsers: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(10) }))
    .query(async ({ input }) => {
      return await adminAnalytics.getTopApiKeyUsers(input.limit);
    }),

  getAllApiKeys: adminProcedure.query(async () => {
    return await adminAnalytics.getAllApiKeysWithStats();
  }),

  getSystemHealth: adminProcedure.query(async () => {
    return await adminAnalytics.getSystemHealthMetrics();
  }),

  getRateLimitConfig: adminProcedure
    .input(z.object({ apiKeyId: z.number() }))
    .query(async ({ input }) => {
      return await adminAnalytics.getRateLimitConfig(input.apiKeyId);
    }),

  updateRateLimitConfig: adminProcedure
    .input(
      z.object({
        apiKeyId: z.number(),
        requestsPerHour: z.number().optional(),
        requestsPerDay: z.number().optional(),
        requestsPerMonth: z.number().optional(),
        burstLimit: z.number().optional(),
        isEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { apiKeyId, ...config } = input;
      await adminAnalytics.updateRateLimitConfig(apiKeyId, config);
      return { success: true };
    }),
});
