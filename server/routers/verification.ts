/**
 * Verification + Evidence tRPC Router
 *
 * Endpoints for cross-department peer review, evidence management,
 * and dependency graph operations.
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';
import { createVerificationService } from '../verification/verification-service';
import { createEvidenceService } from '../evidence/evidence-service';
import { createDependencyCascade } from '../evidence/dependency-cascade';
import { requireOrgFeature } from '../middleware/org-feature-gate';

// Lazy singletons
let _verification: ReturnType<typeof createVerificationService> | null = null;
let _evidence: ReturnType<typeof createEvidenceService> | null = null;
let _cascade: ReturnType<typeof createDependencyCascade> | null = null;

function getVerification() { return _verification ??= createVerificationService(prisma); }
function getEvidence() { return _evidence ??= createEvidenceService(prisma); }
function getCascade() { return _cascade ??= createDependencyCascade(prisma); }

export const verificationRouter = router({
  // ---- Verification Requests ----

  /** Create a verification request */
  createRequest: protectedProcedure
    .input(z.object({
      memoryId: z.string(),
      orgId: z.number(),
      sourceDepartmentId: z.number().optional(),
      targetDepartmentId: z.number().optional(),
      priority: z.number().min(0).max(10).optional(),
      expiresInHours: z.number().positive().optional(),
    }))
    .mutation(async ({ input }) => {
      await requireOrgFeature(input.orgId, 'enableVerification');
      return getVerification().createRequest({
        memoryId: input.memoryId,
        organizationId: input.orgId,
        sourceDepartmentId: input.sourceDepartmentId,
        targetDepartmentId: input.targetDepartmentId,
        priority: input.priority,
        expiresInHours: input.expiresInHours,
      });
    }),

  /** List verification requests */
  listRequests: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      status: z.string().optional(),
      departmentId: z.number().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return getVerification().listRequests(input.orgId, {
        status: input.status,
        departmentId: input.departmentId,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /** Complete a verification with result */
  complete: protectedProcedure
    .input(z.object({
      requestId: z.string(),
      verdict: z.enum(['verified', 'rejected', 'needs_revision']),
      confidence: z.number().min(0).max(1),
      notes: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await getVerification().completeVerification(input.requestId, {
        verdict: input.verdict,
        confidence: input.confidence,
        notes: input.notes,
      });
      if (!result) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Request not found or already completed' });
      }
      return result;
    }),

  // ---- Evidence ----

  /** Attach evidence to a memory */
  addEvidence: protectedProcedure
    .input(z.object({
      memoryId: z.string(),
      orgId: z.number(),
      evidenceType: z.enum(['arxiv', 'doi', 'internal_data', 'experimental', 'computational', 'url']),
      sourceUrl: z.string().optional(),
      sourceDoi: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      claimType: z.string().optional(),
      assumptions: z.array(z.string()).optional(),
      unit: z.string().optional(),
      dimension: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
      peerReviewed: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return getEvidence().create({
        memoryId: input.memoryId,
        organizationId: input.orgId,
        evidenceType: input.evidenceType,
        sourceUrl: input.sourceUrl,
        sourceDoi: input.sourceDoi,
        title: input.title,
        description: input.description,
        claimType: input.claimType,
        assumptions: input.assumptions,
        unit: input.unit,
        dimension: input.dimension,
        confidence: input.confidence,
        peerReviewed: input.peerReviewed,
        createdBy: ctx.user?.name || `user-${ctx.user?.id}`,
      });
    }),

  /** Get evidence for a memory */
  getEvidence: protectedProcedure
    .input(z.object({ memoryId: z.string() }))
    .query(async ({ input }) => {
      return getEvidence().getForMemory(input.memoryId);
    }),

  /** List all evidence for an org */
  listEvidence: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      evidenceType: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return getEvidence().listForOrg(input.orgId, {
        evidenceType: input.evidenceType,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /** Get evidence stats */
  evidenceStats: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return getEvidence().getStats(input.orgId);
    }),

  /** Delete evidence */
  deleteEvidence: protectedProcedure
    .input(z.object({ evidenceId: z.string() }))
    .mutation(async ({ input }) => {
      await getEvidence().delete(input.evidenceId);
      return { success: true };
    }),

  // ---- Dependencies ----

  /** Create a memory dependency */
  createDependency: protectedProcedure
    .input(z.object({
      sourceMemoryId: z.string(),
      dependsOnMemoryId: z.string(),
      orgId: z.number(),
      dependencyType: z.enum(['assumes', 'builds_on', 'requires', 'refutes']),
      strength: z.number().min(0).max(1).optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return getCascade().createDependency({
        sourceMemoryId: input.sourceMemoryId,
        dependsOnMemoryId: input.dependsOnMemoryId,
        organizationId: input.orgId,
        dependencyType: input.dependencyType,
        strength: input.strength,
        description: input.description,
        createdBy: ctx.user?.name || `user-${ctx.user?.id}`,
      });
    }),

  /** Get dependency graph for a memory */
  getDependencyGraph: protectedProcedure
    .input(z.object({ memoryId: z.string() }))
    .query(async ({ input }) => {
      return getCascade().getGraph(input.memoryId);
    }),

  /** Trigger dependency cascade (when a memory is invalidated) */
  triggerCascade: protectedProcedure
    .input(z.object({ memoryId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await getCascade().cascade(input.memoryId);
      return {
        affectedCount: result.affectedCount,
        affectedMemoryIds: result.affectedMemoryIds,
      };
    }),

  /** Get dependencies needing revalidation */
  needsRevalidation: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      return getCascade().getNeedsRevalidation(input.orgId, input.limit);
    }),

  /** Mark dependency as revalidated */
  markRevalidated: protectedProcedure
    .input(z.object({ dependencyId: z.string() }))
    .mutation(async ({ input }) => {
      await getCascade().markRevalidated(input.dependencyId);
      return { success: true };
    }),
});
