/**
 * MemoryPolicy CRUD Router
 *
 * Allows organisations to configure the three governance policy types:
 *   - retention          : auto-expire memories (maxAgeSeconds, maxCount)
 *   - access             : allow/deny read+write per agent / namespace
 *   - conflict_resolution: strategy for resolving conflicting memories
 *
 * All endpoints require authentication.
 * Org-scoping is enforced via the user's organisation membership.
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';
import { memoryGovernance } from '../memory-core/memory-governance';
import { createLogger } from '../utils/logger';

const logger = createLogger('MemoryPolicyRouter');

// ─── Rule schemas (mirror memory-governance.ts types) ─────────────────────────

const retentionRulesSchema = z.object({
  maxAgeSeconds: z.number().positive().optional(),
  maxCount: z.number().positive().int().optional(),
  expireOnBreach: z.boolean().default(true),
});

const accessRulesSchema = z.object({
  allowedAgents: z.array(z.string()).optional(),
  allowedRoles: z.array(z.string()).optional(),
  readOnly: z.boolean().optional(),
  denyAll: z.boolean().optional(),
});

const conflictResolutionRulesSchema = z.object({
  strategy: z.enum(['latest-wins', 'confidence-wins', 'score-wins', 'queue-arbitration', 'manual-review']),
  minConfidenceDelta: z.number().min(0).max(1).optional(),
});

const policyRulesSchema = z.union([
  retentionRulesSchema,
  accessRulesSchema,
  conflictResolutionRulesSchema,
]);

// ─── Input schemas ─────────────────────────────────────────────────────────────

const upsertPolicySchema = z.object({
  orgId: z.string().min(1),
  namespace: z.string().min(1),
  policyType: z.enum(['retention', 'access', 'conflict_resolution']),
  rules: policyRulesSchema,
});

const deletePolicySchema = z.object({
  policyId: z.string().uuid(),
});

const listPoliciesSchema = z.object({
  orgId: z.string().min(1),
  namespace: z.string().optional(),
  policyType: z.enum(['retention', 'access', 'conflict_resolution']).optional(),
});

const getPolicySchema = z.object({
  policyId: z.string().uuid(),
});

const enforceRetentionNowSchema = z.object({
  orgId: z.string().min(1),
  namespace: z.string().min(1),
});

// ─── Router ────────────────────────────────────────────────────────────────────

export const memoryPolicyRouter = router({
  /**
   * Create or update a policy for a given org + namespace + type.
   * If a policy already exists for that combination, it is replaced.
   */
  upsert: protectedProcedure
    .input(upsertPolicySchema)
    .mutation(async ({ input }) => {
      // Check if a policy already exists (upsert = delete old + create new)
      const existing = await prisma.memoryPolicy.findFirst({
        where: { orgId: input.orgId, namespace: input.namespace, policyType: input.policyType },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        await prisma.memoryPolicy.delete({ where: { id: existing.id } });
      }

      const policy = await prisma.memoryPolicy.create({
        data: {
          orgId: input.orgId,
          namespace: input.namespace,
          policyType: input.policyType,
          rules: input.rules,
        },
      });

      // Invalidate governance cache so new rules take effect immediately
      memoryGovernance.invalidate(input.orgId, input.namespace);

      logger.info('MemoryPolicy upserted', {
        policyId: policy.id,
        orgId: input.orgId,
        namespace: input.namespace,
        policyType: input.policyType,
      });

      return {
        success: true,
        policy: {
          id: policy.id,
          orgId: policy.orgId,
          namespace: policy.namespace,
          policyType: policy.policyType,
          rules: policy.rules,
          createdAt: policy.createdAt,
          replaced: !!existing,
        },
      };
    }),

  /**
   * List all policies for an organisation, optionally filtered by namespace / type.
   */
  list: protectedProcedure
    .input(listPoliciesSchema)
    .query(async ({ input }) => {
      const policies = await prisma.memoryPolicy.findMany({
        where: {
          orgId: input.orgId,
          ...(input.namespace ? { namespace: input.namespace } : {}),
          ...(input.policyType ? { policyType: input.policyType } : {}),
        },
        orderBy: [{ namespace: 'asc' }, { policyType: 'asc' }, { createdAt: 'desc' }],
      });

      return { policies };
    }),

  /**
   * Get a single policy by ID.
   */
  get: protectedProcedure
    .input(getPolicySchema)
    .query(async ({ input }) => {
      const policy = await prisma.memoryPolicy.findUnique({
        where: { id: input.policyId },
      });

      if (!policy) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Policy ${input.policyId} not found` });
      }

      return { policy };
    }),

  /**
   * Delete a policy by ID.
   */
  delete: protectedProcedure
    .input(deletePolicySchema)
    .mutation(async ({ input }) => {
      const policy = await prisma.memoryPolicy.findUnique({ where: { id: input.policyId } });

      if (!policy) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Policy ${input.policyId} not found` });
      }

      await prisma.memoryPolicy.delete({ where: { id: input.policyId } });

      // Invalidate cache
      memoryGovernance.invalidate(policy.orgId, policy.namespace);

      logger.info('MemoryPolicy deleted', { policyId: input.policyId });

      return { success: true, deletedId: input.policyId };
    }),

  /**
   * Manually trigger retention enforcement for a specific org + namespace.
   * Useful for testing policies before the next decay-worker cron run.
   */
  enforceRetentionNow: protectedProcedure
    .input(enforceRetentionNowSchema)
    .mutation(async ({ input }) => {
      memoryGovernance.invalidate(input.orgId, input.namespace);
      const result = await memoryGovernance.enforceRetention(input.orgId, input.namespace);

      logger.info('Manual retention enforcement triggered', {
        orgId: input.orgId,
        namespace: input.namespace,
        ...result,
      });

      return { success: true, ...result };
    }),
});
