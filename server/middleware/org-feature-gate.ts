/**
 * Organization Feature Gate
 *
 * Checks that an organization has a specific feature enabled before allowing access.
 * Used in tRPC routers to enforce plan-based feature gating.
 *
 * Feature flags on Organization model:
 * - enableMemoryPools  → Team+ plans
 * - enableDecisions    → Enterprise+ plans
 * - enableVerification → Scientific plan only
 */

import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';

export type OrgFeature = 'enableMemoryPools' | 'enableDecisions' | 'enableVerification';

const FEATURE_LABELS: Record<OrgFeature, string> = {
  enableMemoryPools: 'Memory Pools',
  enableDecisions: 'Decision Audit',
  enableVerification: 'Cross-Domain Verification',
};

const FEATURE_MIN_TIER: Record<OrgFeature, string> = {
  enableMemoryPools: 'team',
  enableDecisions: 'enterprise',
  enableVerification: 'scientific',
};

/**
 * Throws FORBIDDEN if the organization does not have the feature enabled.
 *
 * Usage in a tRPC router:
 * ```ts
 * await requireOrgFeature(input.orgId, 'enableDecisions');
 * ```
 */
export async function requireOrgFeature(orgId: number, feature: OrgFeature): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { [feature]: true, planTier: true },
  });

  if (!org) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
  }

  if (!(org as any)[feature]) {
    const label = FEATURE_LABELS[feature];
    const minTier = FEATURE_MIN_TIER[feature];
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `${label} requires the ${minTier} plan or higher. Current plan: ${org.planTier}`,
    });
  }
}

/**
 * Check plan limits before creating a resource.
 * Throws FORBIDDEN if the limit is reached.
 */
export async function requireWithinLimits(
  orgId: number,
  resource: 'agents' | 'memories' | 'departments'
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { maxAgents: true, maxMemories: true, maxDepartments: true },
  });

  if (!org) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
  }

  let current: number;
  let limit: number;
  let label: string;

  switch (resource) {
    case 'agents':
      current = await prisma.agentAssignment.count({ where: { organizationId: orgId, isActive: true } });
      limit = org.maxAgents;
      label = 'agents';
      break;
    case 'memories':
      current = await prisma.memoryEntry.count({ where: { organizationId: orgId } });
      limit = org.maxMemories;
      label = 'memories';
      break;
    case 'departments':
      current = await prisma.department.count({ where: { organizationId: orgId } });
      limit = org.maxDepartments;
      label = 'departments';
      break;
  }

  if (current >= limit) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `${label} limit reached (${current}/${limit}). Upgrade your plan to add more.`,
    });
  }
}
