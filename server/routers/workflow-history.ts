import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { assertDatabaseAvailable } from "../utils/error-handling";
import { workflowSessions, workflowEvents } from "../../drizzle/schema";
import { eq, and, gte, lte, desc, asc, like, or, sql } from "drizzle-orm";

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
      const db = await getDb();
      const offset = (input.page - 1) * input.pageSize;

      // Build filter conditions
      const conditions = [];
      
      if (input.userId) {
        conditions.push(eq(workflowSessions.userId, input.userId));
      }
      
      if (input.sessionType) {
        conditions.push(eq(workflowSessions.type, input.sessionType));
      }
      
      if (input.status) {
        conditions.push(eq(workflowSessions.status, input.status));
      }
      
      if (input.startDate) {
        conditions.push(gte(workflowSessions.createdAt, new Date(input.startDate)));
      }
      
      if (input.endDate) {
        conditions.push(lte(workflowSessions.createdAt, new Date(input.endDate)));
      }

      // Query sessions with filters
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      // Always sort by createdAt since other sort options don't exist in schema
      const sessions = await db!
        .select()
        .from(workflowSessions)
        .where(whereClause)
        .orderBy(
          input.sortOrder === "desc"
            ? desc(workflowSessions.createdAt)
            : asc(workflowSessions.createdAt)
        )
        .limit(input.pageSize)
        .offset(offset);

      // Get total count for pagination
      const countResult = await db!
        .select({ count: sql<number>`count(*)` })
        .from(workflowSessions)
        .where(whereClause);
      
      const totalCount = Number(countResult[0]?.count || 0);
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
      const db = await getDb();
      assertDatabaseAvailable(db);

      const session = await db
        .select()
        .from(workflowSessions)
        .where(eq(workflowSessions.id, input.sessionId))
        .limit(1);

      if (session.length === 0) {
        throw new Error(`Session not found: ${input.sessionId}`);
      }

      return session[0];
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
      const db = await getDb();
      assertDatabaseAvailable(db);

      const events = await db
        .select()
        .from(workflowEvents)
        .where(eq(workflowEvents.workflowId, input.sessionId))
        .orderBy(
          input.sortOrder === "desc"
            ? desc(workflowEvents.timestamp)
            : asc(workflowEvents.timestamp)
        );

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
      const db = await getDb();
      assertDatabaseAvailable(db);
      const offset = (input.page - 1) * input.pageSize;
      const searchPattern = `%${input.query}%`;

      // Search in id, type, title, and description
      const sessions = await db
        .select()
        .from(workflowSessions)
        .where(
          or(
            like(workflowSessions.id, searchPattern),
            like(workflowSessions.title, searchPattern),
            like(workflowSessions.description, searchPattern)
          )
        )
        .orderBy(desc(workflowSessions.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(workflowSessions)
        .where(
          or(
            like(workflowSessions.id, searchPattern),
            like(workflowSessions.title, searchPattern),
            like(workflowSessions.description, searchPattern)
          )
        );
      
      const totalCount = Number(countResult[0]?.count || 0);
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
      const db = await getDb();
      assertDatabaseAvailable(db);

      // Build filter conditions
      const conditions = [];

      if (input.userId) {
        conditions.push(eq(workflowSessions.userId, input.userId));
      }
      
      if (input.startDate) {
        conditions.push(gte(workflowSessions.createdAt, new Date(input.startDate)));
      }
      
      if (input.endDate) {
        conditions.push(lte(workflowSessions.createdAt, new Date(input.endDate)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get statistics
      const stats = await db
        .select({
          totalSessions: sql<number>`count(*)`,
          completedSessions: sql<number>`sum(case when ${workflowSessions.status} = 'completed' then 1 else 0 end)`,
          failedSessions: sql<number>`sum(case when ${workflowSessions.status} = 'failed' then 1 else 0 end)`,
          avgDuration: sql<number>`avg(${workflowSessions.totalDuration})`,
          avgEventCount: sql<number>`avg(${workflowSessions.totalEvents})`,
        })
        .from(workflowSessions)
        .where(whereClause);

      // Get session type breakdown
      const typeBreakdown = await db
        .select({
          sessionType: workflowSessions.type,
          count: sql<number>`count(*)`,
        })
        .from(workflowSessions)
        .where(whereClause)
        .groupBy(workflowSessions.type);

      return {
        ...stats[0],
        typeBreakdown,
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
      const db = await getDb();
      assertDatabaseAvailable(db);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - input.olderThanDays);

      // Delete events first (foreign key constraint)
      const sessionsToDelete = await db
        .select({ sessionId: workflowSessions.id })
        .from(workflowSessions)
        .where(lte(workflowSessions.createdAt, cutoffDate));

      const sessionIds = sessionsToDelete.map((s) => s.sessionId);

      if (sessionIds.length > 0) {
        await db
          .delete(workflowEvents)
          .where(
            sql`${workflowEvents.workflowId} IN (${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)})`
          );

        await db
          .delete(workflowSessions)
          .where(lte(workflowSessions.createdAt, cutoffDate));
      }

      return {
        deletedCount: sessionIds.length,
        cutoffDate: cutoffDate.toISOString(),
      };
    }),
});
