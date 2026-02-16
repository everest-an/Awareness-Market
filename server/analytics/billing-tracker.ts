/**
 * Billing Tracker — Usage tracking per organization
 *
 * Tracks:
 * - Memory count vs plan limit
 * - Agent count vs plan limit
 * - LLM API calls (for arbitration, conflict detection)
 * - Department count vs plan limit
 */

import type { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('BillingTracker');

const PLAN_LIMITS: Record<string, {
  maxAgents: number;
  maxMemories: number;
  maxDepartments: number;
  price: number;
  features: string[];
}> = {
  lite: {
    maxAgents: 8,
    maxMemories: 10000,
    maxDepartments: 1,
    price: 49,
    features: ['Basic org', '1 department', 'Memory lifecycle', 'Scoring'],
  },
  team: {
    maxAgents: 32,
    maxMemories: 50000,
    maxDepartments: 10,
    price: 199,
    features: ['Multi-department', 'Memory pools', 'Conflict arbitration', 'Decay automation'],
  },
  enterprise: {
    maxAgents: 128,
    maxMemories: 500000,
    maxDepartments: 50,
    price: 499,
    features: ['Decision audit', 'Reputation system', 'Compliance export', 'Priority support'],
  },
  scientific: {
    maxAgents: 999999,
    maxMemories: 9999999,
    maxDepartments: 999,
    price: 999,
    features: ['Cross-domain verification', 'Evidence tracking', 'Dependency graphs', 'Unlimited agents'],
  },
};

export class BillingTracker {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get complete billing/usage overview for an organization
   */
  async getUsageOverview(orgId: number) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        planTier: true,
        maxAgents: true,
        maxMemories: true,
        maxDepartments: true,
        currentAgentCount: true,
        currentMemoryCount: true,
        stripeCustomerId: true,
      },
    });

    if (!org) return null;

    const planConfig = PLAN_LIMITS[org.planTier] || PLAN_LIMITS.lite;

    // Actual counts (not denormalized — more accurate)
    const [actualMemories, actualAgents, actualDepartments, decisionCount] = await Promise.all([
      this.prisma.memoryEntry.count({ where: { organizationId: orgId } }),
      this.prisma.agentAssignment.count({ where: { organizationId: orgId, isActive: true } }),
      this.prisma.department.count({ where: { organizationId: orgId } }),
      this.prisma.decision.count({ where: { organizationId: orgId } }),
    ]);

    return {
      plan: {
        tier: org.planTier,
        price: planConfig.price,
        features: planConfig.features,
      },
      usage: {
        memories: { current: actualMemories, limit: org.maxMemories, pct: Math.round((actualMemories / org.maxMemories) * 100) },
        agents: { current: actualAgents, limit: org.maxAgents, pct: Math.round((actualAgents / org.maxAgents) * 100) },
        departments: { current: actualDepartments, limit: org.maxDepartments, pct: Math.round((actualDepartments / org.maxDepartments) * 100) },
        decisions: { current: decisionCount },
      },
      billing: {
        stripeConfigured: !!org.stripeCustomerId,
      },
    };
  }

  /**
   * Check if organization is approaching limits
   * Returns warnings for resources > 80% utilized
   */
  async checkLimits(orgId: number): Promise<string[]> {
    const overview = await this.getUsageOverview(orgId);
    if (!overview) return [];

    const warnings: string[] = [];

    if (overview.usage.memories.pct >= 90) {
      warnings.push(`Memory usage at ${overview.usage.memories.pct}% — consider upgrading`);
    } else if (overview.usage.memories.pct >= 80) {
      warnings.push(`Memory usage approaching limit (${overview.usage.memories.pct}%)`);
    }

    if (overview.usage.agents.pct >= 90) {
      warnings.push(`Agent limit at ${overview.usage.agents.pct}% — consider upgrading`);
    }

    if (overview.usage.departments.pct >= 100) {
      warnings.push(`Department limit reached — upgrade to add more departments`);
    }

    return warnings;
  }

  /**
   * Get available plan upgrades
   */
  getUpgradeOptions(currentTier: string) {
    const tiers = Object.entries(PLAN_LIMITS);
    const currentIndex = tiers.findIndex(([key]) => key === currentTier);

    return tiers
      .filter((_, idx) => idx > currentIndex)
      .map(([key, config]) => ({
        tier: key,
        price: config.price,
        maxAgents: config.maxAgents,
        maxMemories: config.maxMemories,
        maxDepartments: config.maxDepartments,
        features: config.features,
      }));
  }
}

export function createBillingTracker(prisma: PrismaClient) {
  return new BillingTracker(prisma);
}
