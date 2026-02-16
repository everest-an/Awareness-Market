/**
 * Workflow Performance Analytics Router
 *
 * Provides performance metrics and analysis for workflow sessions:
 * - Response time statistics (avg, P95, P99)
 * - Bottleneck identification
 * - Session type comparison
 * - Success/failure rate analysis
 * - Performance trends over time
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { prisma } from "../db-prisma";
import { createLogger } from "../utils/logger";

const logger = createLogger('WorkflowPerformance');

export const workflowPerformanceRouter = router({
  /**
   * Get Performance Metrics
   *
   * Returns aggregated performance statistics for a time range
   */
  getPerformanceMetrics: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      orchestration: z.enum([
        'sequential',
        'parallel',
        'consensus',
        'pipeline',
      ]).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { startDate, endDate, orchestration } = input;

      // Build where clause
      const where: any = {
        createdBy: ctx.user.id,
      };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      if (orchestration) {
        where.orchestration = orchestration;
      }

      // Get all workflows with timing data
      const workflows = await prisma.workflow.findMany({
        where,
        select: {
          id: true,
          orchestration: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          totalExecutionTime: true,
        },
      });

      // Calculate durations
      const workflowsWithDuration = workflows.map(w => ({
        ...w,
        duration: w.totalExecutionTime || (w.updatedAt.getTime() - w.createdAt.getTime()),
      }));

      // Filter out invalid durations
      const validWorkflows = workflowsWithDuration.filter(w => w.duration > 0);

      if (validWorkflows.length === 0) {
        return {
          avgResponseTime: 0,
          p50ResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          successRate: 0,
          totalWorkflows: 0,
        };
      }

      // Sort durations for percentile calculation
      const sortedDurations = validWorkflows
        .map(w => w.duration)
        .sort((a, b) => a - b);

      // Calculate percentiles
      const p50Index = Math.floor(sortedDurations.length * 0.50);
      const p95Index = Math.floor(sortedDurations.length * 0.95);
      const p99Index = Math.floor(sortedDurations.length * 0.99);

      const avgResponseTime = sortedDurations.reduce((sum, d) => sum + d, 0) / sortedDurations.length;
      const p50ResponseTime = sortedDurations[p50Index] || 0;
      const p95ResponseTime = sortedDurations[p95Index] || 0;
      const p99ResponseTime = sortedDurations[p99Index] || 0;
      const minResponseTime = sortedDurations[0] || 0;
      const maxResponseTime = sortedDurations[sortedDurations.length - 1] || 0;

      // Calculate success rate
      const completedCount = workflows.filter(w => w.status === 'completed').length;
      const successRate = workflows.length > 0 ? (completedCount / workflows.length) * 100 : 0;

      logger.info('Performance metrics calculated', {
        totalWorkflows: workflows.length,
        avgResponseTime: `${avgResponseTime.toFixed(0)}ms`,
        p95ResponseTime: `${p95ResponseTime}ms`,
      });

      return {
        avgResponseTime: Math.round(avgResponseTime),
        p50ResponseTime,
        p95ResponseTime,
        p99ResponseTime,
        minResponseTime,
        maxResponseTime,
        successRate: parseFloat(successRate.toFixed(2)),
        totalWorkflows: workflows.length,
      };
    }),

  /**
   * Get Bottlenecks
   *
   * Identifies slowest workflows (above P95 threshold)
   */
  getBottlenecks: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(20).default(5),
    }))
    .query(async ({ input, ctx }) => {
      const { startDate, endDate, limit } = input;

      const where: any = {
        createdBy: ctx.user.id,
      };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      // Get all workflows with step counts
      const workflows = await prisma.workflow.findMany({
        where,
        include: {
          _count: {
            select: { steps: true },
          },
        },
      });

      // Calculate durations
      const workflowsWithDuration = workflows
        .map(w => ({
          id: w.id,
          task: w.task,
          orchestration: w.orchestration,
          status: w.status,
          duration: w.totalExecutionTime || (w.updatedAt.getTime() - w.createdAt.getTime()),
          stepCount: w._count.steps,
          createdAt: w.createdAt,
        }))
        .filter(w => w.duration > 0);

      // Calculate P95 threshold
      const sortedDurations = workflowsWithDuration
        .map(w => w.duration)
        .sort((a, b) => a - b);
      const p95Index = Math.floor(sortedDurations.length * 0.95);
      const p95Threshold = sortedDurations[p95Index] || 0;

      // Find bottlenecks (workflows above P95)
      const bottlenecks = workflowsWithDuration
        .filter(w => w.duration >= p95Threshold)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, limit)
        .map(w => ({
          workflowId: w.id,
          task: w.task,
          orchestration: w.orchestration,
          status: w.status,
          duration: w.duration,
          stepCount: w.stepCount,
          createdAt: w.createdAt.toISOString(),
        }));

      logger.info('Bottlenecks identified', {
        p95Threshold: `${p95Threshold}ms`,
        bottleneckCount: bottlenecks.length,
      });

      return {
        bottlenecks,
        p95Threshold,
      };
    }),

  /**
   * Get Orchestration Type Comparison
   *
   * Compares performance metrics across different orchestration types
   */
  getTypeComparison: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { startDate, endDate } = input;

      const where: any = {
        createdBy: ctx.user.id,
      };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      // Get all workflows
      const workflows = await prisma.workflow.findMany({
        where,
      });

      // Group by orchestration type
      const typeStats = new Map<string, {
        total: number;
        completed: number;
        totalDuration: number;
        durations: number[];
      }>();

      workflows.forEach(w => {
        const duration = w.totalExecutionTime || (w.updatedAt.getTime() - w.createdAt.getTime());
        const existing = typeStats.get(w.orchestration) || {
          total: 0,
          completed: 0,
          totalDuration: 0,
          durations: [],
        };

        existing.total++;
        if (w.status === 'completed') {
          existing.completed++;
        }
        if (duration > 0) {
          existing.totalDuration += duration;
          existing.durations.push(duration);
        }

        typeStats.set(w.orchestration, existing);
      });

      // Calculate metrics for each type
      const comparison = Array.from(typeStats.entries()).map(([type, stats]) => {
        const avgDuration = stats.durations.length > 0
          ? stats.totalDuration / stats.durations.length
          : 0;

        const successRate = stats.total > 0
          ? (stats.completed / stats.total) * 100
          : 0;

        // Calculate P95 for this type
        const sortedDurations = stats.durations.sort((a, b) => a - b);
        const p95Index = Math.floor(sortedDurations.length * 0.95);
        const p95Duration = sortedDurations[p95Index] || 0;

        return {
          type,
          total: stats.total,
          avgDuration: Math.round(avgDuration),
          p95Duration,
          successRate: parseFloat(successRate.toFixed(2)),
        };
      });

      logger.info('Type comparison calculated', {
        typeCount: comparison.length,
      });

      return { comparison };
    }),

  /**
   * Get Performance Trend
   *
   * Returns performance metrics over time (hourly aggregation)
   */
  getTrend: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      granularity: z.enum(['hour', 'day']).default('hour'),
    }))
    .query(async ({ input, ctx }) => {
      const { startDate, endDate, granularity } = input;

      const workflows = await prisma.workflow.findMany({
        where: {
          createdBy: ctx.user.id,
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      });

      // Group by time bucket
      const bucketSize = granularity === 'hour' ? 3600000 : 86400000; // 1 hour or 1 day in ms
      const buckets = new Map<number, {
        count: number;
        totalDuration: number;
        completed: number;
      }>();

      workflows.forEach(w => {
        const bucket = Math.floor(w.createdAt.getTime() / bucketSize) * bucketSize;
        const duration = w.totalExecutionTime || (w.updatedAt.getTime() - w.createdAt.getTime());

        const existing = buckets.get(bucket) || {
          count: 0,
          totalDuration: 0,
          completed: 0,
        };

        existing.count++;
        if (duration > 0) {
          existing.totalDuration += duration;
        }
        if (w.status === 'completed') {
          existing.completed++;
        }

        buckets.set(bucket, existing);
      });

      // Convert to array and calculate metrics
      const trend = Array.from(buckets.entries())
        .map(([timestamp, stats]) => ({
          timestamp: new Date(timestamp).toISOString(),
          avgDuration: stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0,
          workflowCount: stats.count,
          successRate: stats.count > 0 ? parseFloat(((stats.completed / stats.count) * 100).toFixed(2)) : 0,
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      logger.info('Performance trend calculated', {
        dataPoints: trend.length,
        granularity,
      });

      return { trend };
    }),

  /**
   * Get Overall Statistics
   *
   * Returns high-level summary statistics
   */
  getStatistics: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { startDate, endDate } = input;

      const where: any = {
        createdBy: ctx.user.id,
      };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [totalWorkflows, completedWorkflows, failedWorkflows, workflows] = await Promise.all([
        prisma.workflow.count({ where }),
        prisma.workflow.count({ where: { ...where, status: 'completed' } }),
        prisma.workflow.count({ where: { ...where, status: 'failed' } }),
        prisma.workflow.findMany({
          where,
          include: {
            _count: {
              select: { steps: true },
            },
          },
        }),
      ]);

      // Calculate average step count
      const avgStepCount = workflows.length > 0
        ? workflows.reduce((sum, w) => sum + w._count.steps, 0) / workflows.length
        : 0;

      // Calculate average duration
      const durations = workflows
        .map(w => w.totalExecutionTime || (w.updatedAt.getTime() - w.createdAt.getTime()))
        .filter(d => d > 0);
      const avgDuration = durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

      return {
        totalWorkflows,
        completedWorkflows,
        failedWorkflows,
        avgStepCount: parseFloat(avgStepCount.toFixed(1)),
        avgDuration: Math.round(avgDuration),
      };
    }),
});
