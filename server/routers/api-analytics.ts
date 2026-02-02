/**
 * API Analytics Router
 *
 * Provides endpoints for viewing API usage statistics
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';
import type { Prisma } from '@prisma/client';
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
      const where: Prisma.ApiUsageLogWhereInput = {
        userId: ctx.user.id,
      };

      if (input.endpoint) {
        where.endpoint = input.endpoint;
      }

      if (input.statusCode) {
        where.statusCode = input.statusCode;
      }

      const logs = await prisma.apiUsageLog.findMany({
        where,
        select: {
          id: true,
          endpoint: true,
          method: true,
          path: true,
          statusCode: true,
          responseTimeMs: true,
          errorCode: true,
          errorMessage: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });

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
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Get endpoint statistics using raw SQL
      const stats = await prisma.$queryRaw<Array<{
        endpoint: string;
        totalCalls: bigint;
        avgResponseTime: number | null;
        successRate: number | null;
      }>>`
        SELECT
          endpoint,
          COUNT(*) as "totalCalls",
          AVG(response_time_ms) as "avgResponseTime",
          SUM(CASE WHEN status_code < 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as "successRate"
        FROM api_usage_logs
        WHERE user_id = ${ctx.user.id} AND created_at >= ${startDate}
        GROUP BY endpoint
        ORDER BY COUNT(*) DESC
        LIMIT 20
      `;

      return {
        success: true,
        endpoints: stats.map(s => ({
          endpoint: s.endpoint,
          totalCalls: Number(s.totalCalls),
          avgResponseTime: Math.round(Number(s.avgResponseTime || 0)),
          successRate: Math.round(Number(s.successRate || 0) * 100) / 100,
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

      const startDate = new Date();
      startDate.setHours(startDate.getHours() - input.hours);

      // Get hourly traffic using PostgreSQL date_trunc
      const traffic = await prisma.$queryRaw<Array<{
        hour: Date;
        totalRequests: bigint;
        avgResponseTime: number | null;
        errorCount: bigint;
      }>>`
        SELECT
          date_trunc('hour', created_at) as hour,
          COUNT(*) as "totalRequests",
          AVG(response_time_ms) as "avgResponseTime",
          SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as "errorCount"
        FROM api_usage_logs
        WHERE created_at >= ${startDate}
        GROUP BY date_trunc('hour', created_at)
        ORDER BY date_trunc('hour', created_at)
      `;

      return {
        success: true,
        traffic: traffic.map(t => ({
          hour: t.hour.toISOString(),
          totalRequests: Number(t.totalRequests),
          avgResponseTime: Math.round(Number(t.avgResponseTime || 0)),
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

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Get slow endpoints using raw SQL
      const slowEndpoints = await prisma.$queryRaw<Array<{
        endpoint: string;
        avgResponseTime: number | null;
        maxResponseTime: number | null;
        p95ResponseTime: number | null;
        callCount: bigint;
      }>>`
        SELECT
          endpoint,
          AVG(response_time_ms) as "avgResponseTime",
          MAX(response_time_ms) as "maxResponseTime",
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as "p95ResponseTime",
          COUNT(*) as "callCount"
        FROM api_usage_logs
        WHERE created_at >= ${startDate}
        GROUP BY endpoint
        HAVING AVG(response_time_ms) > ${input.threshold}
        ORDER BY AVG(response_time_ms) DESC
        LIMIT 20
      `;

      return {
        success: true,
        endpoints: slowEndpoints.map(e => ({
          endpoint: e.endpoint,
          avgResponseTime: Math.round(Number(e.avgResponseTime || 0)),
          maxResponseTime: Number(e.maxResponseTime || 0),
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

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Get error breakdown by endpoint and status code using raw SQL
      const errors = await prisma.$queryRaw<Array<{
        endpoint: string;
        statusCode: number;
        errorCode: string | null;
        count: bigint;
      }>>`
        SELECT
          endpoint,
          status_code as "statusCode",
          error_code as "errorCode",
          COUNT(*) as count
        FROM api_usage_logs
        WHERE created_at >= ${startDate} AND status_code >= 400
        GROUP BY endpoint, status_code, error_code
        ORDER BY COUNT(*) DESC
        LIMIT 50
      `;

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
