import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { prisma } from "../db-prisma";
import type { Prisma } from "@prisma/client";

/**
 * Workflow History Router
 * 
 * Provides API endpoints for querying and replaying workflow history.
 * All sessions and events are persisted in the database by WorkflowManager.
 */
export const workflowHistoryRouter = router({
  /**
   * Get paginated list of workflow sessions with filters
   */
  getHistory: publicProcedure
    .input(
      z.object({
        // Pagination
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),

        // Filters
        userId: z.number().optional(),
        sessionType: z.enum([
          "ai_reasoning",
          "memory_transfer",
          "package_processing",
          "w_matrix_training",
          "vector_invocation",
        ]).optional(),
        status: z.enum(["active", "completed", "failed"]).optional(),
        startDate: z.string().optional(), // ISO date string
        endDate: z.string().optional(),

        // Sorting
        sortBy: z.enum(["createdAt", "updatedAt", "duration"]).default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.pageSize;

      // Build filter conditions
      const where: Prisma.WorkflowSessionWhereInput = {};

      if (input.userId) {
        where.userId = input.userId;
      }

      if (input.sessionType) {
        where.type = input.sessionType;
      }

      if (input.status) {
        where.status = input.status;
      }

      if (input.startDate || input.endDate) {
        where.createdAt = {};
        if (input.startDate) {
          where.createdAt.gte = new Date(input.startDate);
        }
        if (input.endDate) {
          where.createdAt.lte = new Date(input.endDate);
        }
      }

      // Query sessions with filters
      const sessions = await prisma.workflowSession.findMany({
        where,
        orderBy: { createdAt: input.sortOrder },
        take: input.pageSize,
        skip: offset,
      });

      // Get total count for pagination
      const totalCount = await prisma.workflowSession.count({ where });
      const totalPages = Math.ceil(totalCount / input.pageSize);

      return {
        sessions,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages,
          hasNext: input.page < totalPages,
          hasPrev: input.page > 1,
        },
      };
    }),

  /**
   * Get single workflow session details
   */
  getSession: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const session = await prisma.workflowSession.findUnique({
        where: { id: input.sessionId }
      });

      if (!session) {
        throw new Error(`Session not found: ${input.sessionId}`);
      }

      return session;
    }),

  /**
   * Get all events for a workflow session
   */
  getEvents: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
      })
    )
    .query(async ({ input }) => {
      const events = await prisma.workflowEvent.findMany({
        where: { workflowId: input.sessionId },
        orderBy: { timestamp: input.sortOrder },
      });

      return events;
    }),

  /**
   * Search workflow sessions by keyword
   */
  searchSessions: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.pageSize;

      // Search in id, type, title, and description
      const where: Prisma.WorkflowSessionWhereInput = {
        OR: [
          { id: { contains: input.query, mode: 'insensitive' } },
          { title: { contains: input.query, mode: 'insensitive' } },
          { description: { contains: input.query, mode: 'insensitive' } },
        ],
      };

      const sessions = await prisma.workflowSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: input.pageSize,
        skip: offset,
      });

      // Get total count
      const totalCount = await prisma.workflowSession.count({ where });
      const totalPages = Math.ceil(totalCount / input.pageSize);

      return {
        sessions,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages,
          hasNext: input.page < totalPages,
          hasPrev: input.page > 1,
        },
      };
    }),

  /**
   * Get workflow statistics
   */
  getStatistics: publicProcedure
    .input(
      z.object({
        userId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      // Build filter conditions
      const where: Prisma.WorkflowSessionWhereInput = {};

      if (input.userId) {
        where.userId = input.userId;
      }

      if (input.startDate || input.endDate) {
        where.createdAt = {};
        if (input.startDate) {
          where.createdAt.gte = new Date(input.startDate);
        }
        if (input.endDate) {
          where.createdAt.lte = new Date(input.endDate);
        }
      }

      // Get statistics using raw SQL for complex aggregation
      const startDate = input.startDate ? new Date(input.startDate) : null;
      const endDate = input.endDate ? new Date(input.endDate) : null;

      const stats = await prisma.$queryRaw<Array<{
        totalSessions: bigint;
        completedSessions: bigint;
        failedSessions: bigint;
        avgDuration: number | null;
        avgEventCount: number | null;
      }>>`
        SELECT
          COUNT(*) as "totalSessions",
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as "completedSessions",
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as "failedSessions",
          AVG(total_duration) as "avgDuration",
          AVG(total_events) as "avgEventCount"
        FROM workflow_sessions
        WHERE (${input.userId}::int IS NULL OR user_id = ${input.userId})
          AND (${startDate}::timestamp IS NULL OR created_at >= ${startDate})
          AND (${endDate}::timestamp IS NULL OR created_at <= ${endDate})
      `;

      // Get session type breakdown
      const typeBreakdown = await prisma.$queryRaw<Array<{
        sessionType: string;
        count: bigint;
      }>>`
        SELECT
          type as "sessionType",
          COUNT(*) as count
        FROM workflow_sessions
        WHERE (${input.userId}::int IS NULL OR user_id = ${input.userId})
          AND (${startDate}::timestamp IS NULL OR created_at >= ${startDate})
          AND (${endDate}::timestamp IS NULL OR created_at <= ${endDate})
        GROUP BY type
      `;

      return {
        totalSessions: Number(stats[0]?.totalSessions || 0),
        completedSessions: Number(stats[0]?.completedSessions || 0),
        failedSessions: Number(stats[0]?.failedSessions || 0),
        avgDuration: stats[0]?.avgDuration || 0,
        avgEventCount: stats[0]?.avgEventCount || 0,
        typeBreakdown: typeBreakdown.map(t => ({
          sessionType: t.sessionType,
          count: Number(t.count),
        })),
      };
    }),

  /**
   * Delete old workflow sessions (cleanup)
   */
  deleteOldSessions: publicProcedure
    .input(
      z.object({
        olderThanDays: z.number().min(1).default(90),
      })
    )
    .mutation(async ({ input }) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.olderThanDays);

      // Get sessions to delete
      const sessionsToDelete = await prisma.workflowSession.findMany({
        where: { createdAt: { lte: cutoffDate } },
        select: { id: true },
      });

      const sessionIds = sessionsToDelete.map((s) => s.id);

      if (sessionIds.length > 0) {
        // Delete events first (foreign key constraint)
        await prisma.workflowEvent.deleteMany({
          where: { workflowId: { in: sessionIds } },
        });

        // Delete sessions
        await prisma.workflowSession.deleteMany({
          where: { createdAt: { lte: cutoffDate } },
        });
      }

      return {
        deletedCount: sessionIds.length,
        cutoffDate: cutoffDate.toISOString(),
      };
    }),
});
