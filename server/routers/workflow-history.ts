import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { prisma } from "../db-prisma";
import type { Prisma } from "@prisma/client";

/**
 * Workflow History Router
 * 
 * Provides API endpoints for querying and replaying workflow history.
 * Uses the Workflow model (mapped to "workflows" table) which is the actual schema model.
 */
export const workflowHistoryRouter = router({
  /**
   * Get paginated list of workflow sessions with filters
   */
  getHistory: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        userId: z.number().optional(),
        sessionType: z.enum([
          "ai_reasoning",
          "memory_transfer",
          "package_processing",
          "w_matrix_training",
          "vector_invocation",
        ]).optional(),
        status: z.enum(["pending", "active", "completed", "failed"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        sortBy: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.pageSize;

      // Build filter conditions using Workflow model
      const where: Prisma.WorkflowWhereInput = {};

      if (input.userId) {
        where.createdBy = input.userId;
      }

      if (input.status) {
        where.status = input.status as any;
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

      const sessions = await prisma.workflow.findMany({
        where,
        orderBy: { [input.sortBy]: input.sortOrder },
        take: input.pageSize,
        skip: offset,
        include: {
          steps: { select: { id: true, status: true, agentRole: true } },
        },
      });

      const totalCount = await prisma.workflow.count({ where });
      const totalPages = Math.ceil(totalCount / input.pageSize);

      return {
        sessions: sessions.map(s => ({
          id: s.id,
          task: s.task,
          description: s.description,
          status: s.status,
          orchestration: s.orchestration,
          createdBy: s.createdBy,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          totalExecutionTime: s.totalExecutionTime,
          stepsCount: s.steps.length,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
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
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const session = await prisma.workflow.findUnique({
        where: { id: input.sessionId },
        include: {
          steps: true,
          interactions: true,
          creator: { select: { id: true, name: true, email: true } },
        },
      });

      if (!session) {
        throw new Error(`Session not found: ${input.sessionId}`);
      }

      return session;
    }),

  /**
   * Get all steps/events for a workflow session
   */
  getEvents: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
      })
    )
    .query(async ({ input }) => {
      const steps = await prisma.workflowStep.findMany({
        where: { workflowId: input.sessionId },
        orderBy: { stepOrder: input.sortOrder },
      });

      return steps;
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
      const where: Prisma.WorkflowWhereInput = {};

      if (input.userId) {
        where.createdBy = input.userId;
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

      // Use Prisma aggregation instead of raw SQL to avoid missing table errors
      const [total, completed, failed, active] = await Promise.all([
        prisma.workflow.count({ where }),
        prisma.workflow.count({ where: { ...where, status: "completed" } }),
        prisma.workflow.count({ where: { ...where, status: "failed" } }),
        prisma.workflow.count({ where: { ...where, status: "active" } }),
      ]);

      const avgDuration = await prisma.workflow.aggregate({
        where: { ...where, totalExecutionTime: { not: null } },
        _avg: { totalExecutionTime: true },
      });

      // Get orchestration type breakdown
      const orchestrationBreakdown = await prisma.workflow.groupBy({
        by: ["orchestration"],
        where,
        _count: { id: true },
      });

      return {
        totalSessions: total,
        completedSessions: completed,
        failedSessions: failed,
        activeSessions: active,
        avgDuration: avgDuration._avg.totalExecutionTime || 0,
        orchestrationBreakdown: orchestrationBreakdown.map(t => ({
          orchestration: t.orchestration,
          count: t._count.id,
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

      // Get workflows to delete
      const workflowsToDelete = await prisma.workflow.findMany({
        where: { createdAt: { lte: cutoffDate } },
        select: { id: true },
      });

      const workflowIds = workflowsToDelete.map((w) => w.id);

      if (workflowIds.length > 0) {
        // Delete steps first (foreign key constraint)
        await prisma.workflowStep.deleteMany({
          where: { workflowId: { in: workflowIds } },
        });

        // Delete on-chain interactions
        await prisma.onChainInteraction.deleteMany({
          where: { workflowId: { in: workflowIds } },
        });

        // Delete workflows
        await prisma.workflow.deleteMany({
          where: { createdAt: { lte: cutoffDate } },
        });
      }

      return {
        deletedCount: workflowIds.length,
        cutoffDate: cutoffDate.toISOString(),
      };
    }),
});
