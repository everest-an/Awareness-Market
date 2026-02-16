/**
 * Decision tRPC Router
 *
 * Endpoints for decision audit trail, replay, and outcome verification.
 * Pattern: follows organization.ts router pattern.
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';
import { createDecisionRecorder } from '../decision/decision-recorder';
import { createDecisionReplay } from '../decision/decision-replay';
import { createReputationEngine } from '../reputation/reputation-engine';
import { createReputationHooks } from '../reputation/reputation-hooks';
import { requireOrgFeature } from '../middleware/org-feature-gate';

// Lazy singletons
let _recorder: ReturnType<typeof createDecisionRecorder> | null = null;
let _replay: ReturnType<typeof createDecisionReplay> | null = null;
let _engine: ReturnType<typeof createReputationEngine> | null = null;
let _hooks: ReturnType<typeof createReputationHooks> | null = null;

function getRecorder() { return _recorder ??= createDecisionRecorder(prisma); }
function getReplay() { return _replay ??= createDecisionReplay(prisma); }
function getEngine() { return _engine ??= createReputationEngine(prisma); }
function getHooks() { return _hooks ??= createReputationHooks(prisma); }

export const decisionRouter = router({
  // ---- Decision CRUD ----

  /** Record a new decision (called by agent SDK) */
  record: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      agentId: z.string(),
      departmentId: z.number().optional(),
      inputQuery: z.string(),
      output: z.string(),
      confidence: z.number().min(0).max(1),
      retrievedMemoryIds: z.array(z.string()).optional(),
      memoryScoresSnapshot: z.record(z.string(), z.object({
        finalScore: z.number(),
        poolType: z.string(),
        content: z.string(),
        confidence: z.number(),
      })).optional(),
      poolBreakdown: z.object({
        private: z.number(),
        domain: z.number(),
        global: z.number(),
      }).optional(),
      totalTokensUsed: z.number().optional(),
      decisionType: z.string().optional(),
      latencyMs: z.number().optional(),
      modelUsed: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireOrgFeature(input.orgId, 'enableDecisions');
      return getRecorder().record({
        organizationId: input.orgId,
        agentId: input.agentId,
        departmentId: input.departmentId,
        inputQuery: input.inputQuery,
        output: input.output,
        confidence: input.confidence,
        retrievedMemoryIds: input.retrievedMemoryIds,
        memoryScoresSnapshot: input.memoryScoresSnapshot,
        poolBreakdown: input.poolBreakdown,
        totalTokensUsed: input.totalTokensUsed,
        decisionType: input.decisionType,
        latencyMs: input.latencyMs,
        modelUsed: input.modelUsed,
      });
    }),

  /** Get a single decision */
  get: protectedProcedure
    .input(z.object({ decisionId: z.string() }))
    .query(async ({ input }) => {
      const decision = await getRecorder().getById(input.decisionId);
      if (!decision) throw new TRPCError({ code: 'NOT_FOUND', message: 'Decision not found' });
      return decision;
    }),

  /** List decisions for an organization */
  list: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      agentId: z.string().optional(),
      departmentId: z.number().optional(),
      verified: z.boolean().optional(),
      correct: z.boolean().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return getRecorder().list({
        orgId: input.orgId,
        agentId: input.agentId,
        departmentId: input.departmentId,
        verified: input.verified,
        correct: input.correct,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // ---- Outcome Verification ----

  /** Verify the outcome of a decision */
  verifyOutcome: protectedProcedure
    .input(z.object({
      decisionId: z.string(),
      outcomeCorrect: z.boolean(),
      outcomeNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const success = await getRecorder().verifyOutcome({
        decisionId: input.decisionId,
        outcomeCorrect: input.outcomeCorrect,
        outcomeNotes: input.outcomeNotes,
        verifiedBy: ctx.user?.name || `user-${ctx.user?.id}`,
      });

      if (!success) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Decision not found or already verified' });
      }

      // Trigger reputation hook
      await getHooks().onDecisionVerified(input.decisionId);

      return { success: true };
    }),

  // ---- Replay ----

  /** Replay a decision — compare historical vs current memory state */
  replay: protectedProcedure
    .input(z.object({ decisionId: z.string() }))
    .query(async ({ input }) => {
      const result = await getReplay().replay(input.decisionId);
      if (!result) throw new TRPCError({ code: 'NOT_FOUND', message: 'Decision not found' });
      return result;
    }),

  /** Get decision timeline for an agent */
  timeline: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      agentId: z.string(),
      days: z.number().min(1).max(365).default(30),
    }))
    .query(async ({ input }) => {
      return getReplay().getTimeline(input.orgId, input.agentId, input.days);
    }),

  // ---- Agent Accuracy Stats ----

  /** Get decision accuracy for an agent */
  agentAccuracy: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      agentId: z.string(),
    }))
    .query(async ({ input }) => {
      return getRecorder().getAgentAccuracy(input.orgId, input.agentId);
    }),

  // ---- Reputation ----

  /** Get agent reputation profile */
  getReputation: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      agentId: z.string(),
    }))
    .query(async ({ input }) => {
      return getEngine().getProfile(input.agentId, input.orgId);
    }),

  /** Get reputation leaderboard for an org */
  reputationLeaderboard: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      return getEngine().getLeaderboard(input.orgId, input.limit);
    }),

  // ---- Reputation Hooks (manual triggers) ----

  /** Manually trigger reputation update on memory validation */
  hookMemoryValidated: protectedProcedure
    .input(z.object({ memoryId: z.string() }))
    .mutation(async ({ input }) => {
      await getHooks().onMemoryValidated(input.memoryId);
      return { success: true };
    }),

  /** Manually trigger reputation update on memory conflict */
  hookMemoryConflicted: protectedProcedure
    .input(z.object({ memoryId: z.string() }))
    .mutation(async ({ input }) => {
      await getHooks().onMemoryConflicted(input.memoryId);
      return { success: true };
    }),

  /** Manually trigger reputation update on memory promotion */
  hookMemoryPromoted: protectedProcedure
    .input(z.object({ memoryId: z.string() }))
    .mutation(async ({ input }) => {
      await getHooks().onMemoryPromoted(input.memoryId);
      return { success: true };
    }),
});
