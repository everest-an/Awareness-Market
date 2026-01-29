/**
 * Creator Dashboard API
 *
 * Provides analytics and insights for content creators:
 * - Revenue analytics (total, monthly growth, breakdown by package)
 * - Performance metrics (invocations, success rate, execution time)
 * - User feedback (reviews, ratings, comments)
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { createLogger } from '../utils/logger';
import {
  getCreatorRevenueAnalytics,
  getCreatorPerformanceMetrics,
  getCreatorUserFeedback,
} from '../creator-dashboard';

const logger = createLogger('CreatorDashboard:API');

export const creatorDashboardRouter = router({
  /**
   * Get revenue analytics for the authenticated creator
   */
  getRevenueAnalytics: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(365).default(30).describe('Number of days to analyze'),
    }))
    .query(async ({ ctx, input }) => {
      try {
        logger.info(`[Revenue] Getting analytics for creator ${ctx.user.id}, days=${input.days}`);

        const analytics = await getCreatorRevenueAnalytics(ctx.user.id, input.days);

        return {
          success: true,
          analytics,
        };
      } catch (error) {
        logger.error('[Revenue] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch revenue analytics',
          cause: error,
        });
      }
    }),

  /**
   * Get performance metrics for the authenticated creator
   */
  getPerformanceMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        logger.info(`[Performance] Getting metrics for creator ${ctx.user.id}`);

        const metrics = await getCreatorPerformanceMetrics(ctx.user.id);

        return {
          success: true,
          metrics,
        };
      } catch (error) {
        logger.error('[Performance] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch performance metrics',
          cause: error,
        });
      }
    }),

  /**
   * Get user feedback (reviews and ratings) for the authenticated creator
   */
  getUserFeedback: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10).describe('Number of recent reviews to fetch'),
    }))
    .query(async ({ ctx, input }) => {
      try {
        logger.info(`[Feedback] Getting feedback for creator ${ctx.user.id}, limit=${input.limit}`);

        const feedback = await getCreatorUserFeedback(ctx.user.id, input.limit);

        return {
          success: true,
          feedback,
        };
      } catch (error) {
        logger.error('[Feedback] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user feedback',
          cause: error,
        });
      }
    }),

  /**
   * Get comprehensive dashboard overview (all metrics at once)
   */
  getDashboardOverview: protectedProcedure
    .input(z.object({
      revenueDays: z.number().min(1).max(365).default(30),
      reviewLimit: z.number().min(1).max(100).default(10),
    }))
    .query(async ({ ctx, input }) => {
      try {
        logger.info(`[Overview] Getting full dashboard for creator ${ctx.user.id}`);

        // Fetch all data in parallel
        const [revenue, performance, feedback] = await Promise.all([
          getCreatorRevenueAnalytics(ctx.user.id, input.revenueDays),
          getCreatorPerformanceMetrics(ctx.user.id),
          getCreatorUserFeedback(ctx.user.id, input.reviewLimit),
        ]);

        return {
          success: true,
          overview: {
            revenue,
            performance,
            feedback,
            generatedAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        logger.error('[Overview] Error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch dashboard overview',
          cause: error,
        });
      }
    }),
});

export default creatorDashboardRouter;
