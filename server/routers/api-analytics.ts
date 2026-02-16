/**
 * API Analytics Router
 *
 * Provides endpoints for viewing API usage statistics
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';
const prismaAny = prisma as any;
import { Prisma } from '@prisma/client';
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
      const where: any = {
        userId: ctx.user.id,
      };

      if (input.endpoint) {
        where.endpoint = input.endpoint;
      }

      if (input.statusCode) {
        where.statusCode = input.statusCode;
      }

      const logs = await prismaAny.apiUsageLog.findMany({
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

  // ============================================================================
  // Phase 3 - Task I: Collaboration Analytics
  // ============================================================================

  /**
   * Get collaboration statistics
   * ✅ Phase 3 - Task I
   */
  collaborationStats: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
      agentType: z.enum(['Router', 'Architect', 'Visualizer']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Query collaboration statistics
      const stats = await prisma.$queryRaw<Array<{
        totalSessions: bigint;
        successfulSessions: bigint;
        avgDuration: number | null;
        avgQuality: number | null;
        totalMemories: bigint;
      }>>`
        SELECT
          COUNT(*) as "totalSessions",
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as "successfulSessions",
          AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as "avgDuration",
          AVG(quality_score) as "avgQuality",
          (SELECT COUNT(*) FROM latent_memories WHERE created_at >= ${startDate}) as "totalMemories"
        FROM collaborations
        WHERE created_at >= ${startDate}
        ${input.agentType ? Prisma.sql`AND source_agent = ${input.agentType}` : Prisma.empty}
      `;

      const result = stats[0];

      return {
        success: true,
        stats: {
          totalSessions: Number(result.totalSessions),
          successfulSessions: Number(result.successfulSessions),
          successRate: Number(result.totalSessions) > 0
            ? Math.round((Number(result.successfulSessions) / Number(result.totalSessions)) * 100)
            : 0,
          avgDuration: Math.round(Number(result.avgDuration || 0)),
          avgQuality: Number((result.avgQuality || 0).toFixed(4)),
          totalMemories: Number(result.totalMemories),
        },
      };
    }),

  /**
   * Get quality metrics for embeddings and alignments
   * ✅ Phase 3 - Task I
   */
  qualityMetrics: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(7),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Get quality metrics for embeddings
      const metrics = await prisma.$queryRaw<Array<{
        avgMagnitude: number | null;
        avgSparsity: number | null;
        avgSimilarity: number | null;
        rejectionCount: bigint;
        totalCount: bigint;
      }>>`
        SELECT
          AVG((metadata->>'magnitude')::float) as "avgMagnitude",
          AVG((metadata->>'sparsity')::float) as "avgSparsity",
          AVG(similarity_score) as "avgSimilarity",
          SUM(CASE WHEN is_valid = false THEN 1 ELSE 0 END) as "rejectionCount",
          COUNT(*) as "totalCount"
        FROM latent_memories
        WHERE created_at >= ${startDate}
      `;

      const result = metrics[0];

      return {
        success: true,
        metrics: {
          avgEmbeddingQuality: Number((result.avgMagnitude || 0).toFixed(4)),
          avgSparsity: Number((result.avgSparsity || 0).toFixed(4)),
          avgSimilarityScore: Number((result.avgSimilarity || 0).toFixed(4)),
          rejectionRate: Number(result.totalCount) > 0
            ? Math.round((Number(result.rejectionCount) / Number(result.totalCount)) * 100)
            : 0,
          totalProcessed: Number(result.totalCount),
        },
      };
    }),

  /**
   * Get performance metrics (retrieval time, GPU usage, etc.)
   * ✅ Phase 3 - Task I
   */
  performanceMetrics: protectedProcedure
    .input(z.object({
      hours: z.number().min(1).max(72).default(24),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - input.hours);

      // Get performance metrics from logs
      const metrics = await prisma.$queryRaw<Array<{
        avgRetrievalTime: number | null;
        p95RetrievalTime: number | null;
        maxRetrievalTime: number | null;
        gpuUsageCount: bigint;
        totalQueries: bigint;
        cacheHits: bigint;
      }>>`
        SELECT
          AVG((metadata->>'retrievalTimeMs')::float) as "avgRetrievalTime",
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (metadata->>'retrievalTimeMs')::float) as "p95RetrievalTime",
          MAX((metadata->>'retrievalTimeMs')::float) as "maxRetrievalTime",
          SUM(CASE WHEN metadata->>'usedGPU' = 'true' THEN 1 ELSE 0 END) as "gpuUsageCount",
          COUNT(*) as "totalQueries",
          SUM(CASE WHEN metadata->>'cacheHit' = 'true' THEN 1 ELSE 0 END) as "cacheHits"
        FROM memory_query_logs
        WHERE created_at >= ${startDate}
      `;

      const result = metrics[0];

      return {
        success: true,
        metrics: {
          avgRetrievalTime: Math.round(Number(result.avgRetrievalTime || 0)),
          p95RetrievalTime: Math.round(Number(result.p95RetrievalTime || 0)),
          maxRetrievalTime: Math.round(Number(result.maxRetrievalTime || 0)),
          gpuUtilization: Number(result.totalQueries) > 0
            ? Math.round((Number(result.gpuUsageCount) / Number(result.totalQueries)) * 100)
            : 0,
          cacheHitRate: Number(result.totalQueries) > 0
            ? Math.round((Number(result.cacheHits) / Number(result.totalQueries)) * 100)
            : 0,
          totalQueries: Number(result.totalQueries),
        },
      };
    }),

  /**
   * Get agent utilization statistics
   * ✅ Phase 3 - Task I
   */
  agentUtilization: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(7),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Get agent utilization by type
      const utilization = await prisma.$queryRaw<Array<{
        agentType: string;
        sessionCount: bigint;
        avgQuality: number | null;
        successRate: number | null;
        totalDuration: number | null;
      }>>`
        SELECT
          source_agent as "agentType",
          COUNT(*) as "sessionCount",
          AVG(quality_score) as "avgQuality",
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as "successRate",
          SUM(EXTRACT(EPOCH FROM (completed_at - created_at))) as "totalDuration"
        FROM collaborations
        WHERE created_at >= ${startDate}
        GROUP BY source_agent
        ORDER BY COUNT(*) DESC
      `;

      return {
        success: true,
        agents: utilization.map(u => ({
          agentType: u.agentType,
          sessionCount: Number(u.sessionCount),
          avgQuality: Number((u.avgQuality || 0).toFixed(4)),
          successRate: Math.round(Number(u.successRate || 0)),
          totalDuration: Math.round(Number(u.totalDuration || 0)),
          avgSessionDuration: Number(u.sessionCount) > 0
            ? Math.round(Number(u.totalDuration || 0) / Number(u.sessionCount))
            : 0,
        })),
      };
    }),

  /**
   * Get hourly collaboration trend
   * ✅ Phase 3 - Task I
   */
  collaborationTrend: protectedProcedure
    .input(z.object({
      hours: z.number().min(1).max(168).default(24),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - input.hours);

      // Get hourly collaboration trend
      const trend = await prisma.$queryRaw<Array<{
        hour: Date;
        sessionCount: bigint;
        successCount: bigint;
        avgQuality: number | null;
        memoryCreated: bigint;
      }>>`
        SELECT
          date_trunc('hour', c.created_at) as hour,
          COUNT(DISTINCT c.id) as "sessionCount",
          SUM(CASE WHEN c.success = true THEN 1 ELSE 0 END) as "successCount",
          AVG(c.quality_score) as "avgQuality",
          COUNT(DISTINCT m.id) as "memoryCreated"
        FROM collaborations c
        LEFT JOIN latent_memories m ON date_trunc('hour', m.created_at) = date_trunc('hour', c.created_at)
        WHERE c.created_at >= ${startDate}
        GROUP BY date_trunc('hour', c.created_at)
        ORDER BY date_trunc('hour', c.created_at)
      `;

      return {
        success: true,
        trend: trend.map(t => ({
          hour: t.hour.toISOString(),
          sessionCount: Number(t.sessionCount),
          successCount: Number(t.successCount),
          successRate: Number(t.sessionCount) > 0
            ? Math.round((Number(t.successCount) / Number(t.sessionCount)) * 100)
            : 0,
          avgQuality: Number((t.avgQuality || 0).toFixed(4)),
          memoryCreated: Number(t.memoryCreated),
        })),
      };
    }),

  /**
   * Get top performing tasks
   * ✅ Phase 3 - Task I
   */
  topTasks: protectedProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(30),
      limit: z.number().min(5).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Get top performing tasks by quality and success
      const tasks = await prisma.$queryRaw<Array<{
        taskType: string;
        count: bigint;
        avgQuality: number | null;
        successRate: number | null;
        avgDuration: number | null;
      }>>`
        SELECT
          task_type as "taskType",
          COUNT(*) as count,
          AVG(quality_score) as "avgQuality",
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as "successRate",
          AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as "avgDuration"
        FROM collaborations
        WHERE created_at >= ${startDate} AND task_type IS NOT NULL
        GROUP BY task_type
        ORDER BY AVG(quality_score) DESC, COUNT(*) DESC
        LIMIT ${input.limit}
      `;

      return {
        success: true,
        tasks: tasks.map(t => ({
          taskType: t.taskType,
          count: Number(t.count),
          avgQuality: Number((t.avgQuality || 0).toFixed(4)),
          successRate: Math.round(Number(t.successRate || 0)),
          avgDuration: Math.round(Number(t.avgDuration || 0)),
        })),
      };
    }),
});
