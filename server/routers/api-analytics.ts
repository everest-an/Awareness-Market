/**
 * API Analytics Router
 * 
 * Provides endpoints for viewing API usage statistics
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { apiUsageLogs, apiUsageDailyStats } from '../../drizzle/schema-api-usage';
import { getUserApiStats, getGlobalApiStats } from '../middleware/api-usage-logger';

export const apiAnalyticsRouter = router({
  /**
   * Get current user's API usage statistics
   */
  myUsage: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const stats = await getUserApiStats(ctx.user.id, input.days);
      return {
        success: true,
        ...stats,
      };
    }),

  /**
   * Get recent API calls for current user
   */
  myRecentCalls: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      endpoint: z.string().optional(),
      statusCode: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      const conditions = [eq(apiUsageLogs.userId, ctx.user.id)];
      
      if (input.endpoint) {
        conditions.push(eq(apiUsageLogs.endpoint, input.endpoint));
      }
      
      if (input.statusCode) {
        conditions.push(eq(apiUsageLogs.statusCode, input.statusCode));
      }

      const logs = await db
        .select({
          id: apiUsageLogs.id,
          endpoint: apiUsageLogs.endpoint,
          method: apiUsageLogs.method,
          path: apiUsageLogs.path,
          statusCode: apiUsageLogs.statusCode,
          responseTimeMs: apiUsageLogs.responseTimeMs,
          errorCode: apiUsageLogs.errorCode,
          errorMessage: apiUsageLogs.errorMessage,
          createdAt: apiUsageLogs.createdAt,
        })
        .from(apiUsageLogs)
        .where(and(...conditions))
        .orderBy(desc(apiUsageLogs.createdAt))
        .limit(input.limit);

      return {
        success: true,
        logs,
      };
    }),

  /**
   * Get API usage by endpoint for current user
   */
  myEndpointStats: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Get endpoint statistics
      const stats = await db
        .select({
          endpoint: apiUsageLogs.endpoint,
          totalCalls: sql<number>`COUNT(*)`,
          avgResponseTime: sql<number>`AVG(${apiUsageLogs.responseTimeMs})`,
          successRate: sql<number>`SUM(CASE WHEN ${apiUsageLogs.statusCode} < 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)`,
        })
        .from(apiUsageLogs)
        .where(
          and(
            eq(apiUsageLogs.userId, ctx.user.id),
            gte(apiUsageLogs.createdAt, startDate)
          )
        )
        .groupBy(apiUsageLogs.endpoint)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(20);

      return {
        success: true,
        endpoints: stats.map(s => ({
          endpoint: s.endpoint,
          totalCalls: Number(s.totalCalls),
          avgResponseTime: Math.round(Number(s.avgResponseTime)),
          successRate: Math.round(Number(s.successRate) * 100) / 100,
        })),
      };
    }),

  /**
   * Get global API statistics (admin only)
   */
  globalStats: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(7),
    }))
    .query(async ({ ctx, input }) => {
      // Check if user is admin
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }

      const stats = await getGlobalApiStats(input.days);
      return {
        success: true,
        ...stats,
      };
    }),

  /**
   * Get hourly API traffic (admin only)
   */
  hourlyTraffic: protectedProcedure
    .input(z.object({
      hours: z.number().min(1).max(72).default(24),
    }))
    .query(async ({ ctx, input }) => {
      // Check if user is admin
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      const startDate = new Date();
      startDate.setHours(startDate.getHours() - input.hours);

      // Get hourly traffic
      const traffic = await db
        .select({
          hour: sql<string>`DATE_FORMAT(${apiUsageLogs.createdAt}, '%Y-%m-%d %H:00:00')`,
          totalRequests: sql<number>`COUNT(*)`,
          avgResponseTime: sql<number>`AVG(${apiUsageLogs.responseTimeMs})`,
          errorCount: sql<number>`SUM(CASE WHEN ${apiUsageLogs.statusCode} >= 400 THEN 1 ELSE 0 END)`,
        })
        .from(apiUsageLogs)
        .where(gte(apiUsageLogs.createdAt, startDate))
        .groupBy(sql`DATE_FORMAT(${apiUsageLogs.createdAt}, '%Y-%m-%d %H:00:00')`)
        .orderBy(sql`DATE_FORMAT(${apiUsageLogs.createdAt}, '%Y-%m-%d %H:00:00')`);

      return {
        success: true,
        traffic: traffic.map(t => ({
          hour: t.hour,
          totalRequests: Number(t.totalRequests),
          avgResponseTime: Math.round(Number(t.avgResponseTime)),
          errorCount: Number(t.errorCount),
        })),
      };
    }),

  /**
   * Get slow endpoints (admin only)
   */
  slowEndpoints: protectedProcedure
    .input(z.object({
      threshold: z.number().min(100).default(1000), // ms
      days: z.number().min(1).max(30).default(7),
    }))
    .query(async ({ ctx, input }) => {
      // Check if user is admin
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Get slow endpoints
      const slowEndpoints = await db
        .select({
          endpoint: apiUsageLogs.endpoint,
          avgResponseTime: sql<number>`AVG(${apiUsageLogs.responseTimeMs})`,
          maxResponseTime: sql<number>`MAX(${apiUsageLogs.responseTimeMs})`,
          p95ResponseTime: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${apiUsageLogs.responseTimeMs})`,
          callCount: sql<number>`COUNT(*)`,
        })
        .from(apiUsageLogs)
        .where(gte(apiUsageLogs.createdAt, startDate))
        .groupBy(apiUsageLogs.endpoint)
        .having(sql`AVG(${apiUsageLogs.responseTimeMs}) > ${input.threshold}`)
        .orderBy(sql`AVG(${apiUsageLogs.responseTimeMs}) DESC`)
        .limit(20);

      return {
        success: true,
        endpoints: slowEndpoints.map(e => ({
          endpoint: e.endpoint,
          avgResponseTime: Math.round(Number(e.avgResponseTime)),
          maxResponseTime: Number(e.maxResponseTime),
          p95ResponseTime: Math.round(Number(e.p95ResponseTime || 0)),
          callCount: Number(e.callCount),
        })),
      };
    }),

  /**
   * Get error breakdown (admin only)
   */
  errorBreakdown: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(30).default(7),
    }))
    .query(async ({ ctx, input }) => {
      // Check if user is admin
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Get error breakdown by endpoint and status code
      const errors = await db
        .select({
          endpoint: apiUsageLogs.endpoint,
          statusCode: apiUsageLogs.statusCode,
          errorCode: apiUsageLogs.errorCode,
          count: sql<number>`COUNT(*)`,
        })
        .from(apiUsageLogs)
        .where(
          and(
            gte(apiUsageLogs.createdAt, startDate),
            gte(apiUsageLogs.statusCode, 400)
          )
        )
        .groupBy(apiUsageLogs.endpoint, apiUsageLogs.statusCode, apiUsageLogs.errorCode)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(50);

      return {
        success: true,
        errors: errors.map(e => ({
          endpoint: e.endpoint,
          statusCode: e.statusCode,
          errorCode: e.errorCode,
          count: Number(e.count),
        })),
      };
    }),
});
