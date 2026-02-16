/**
 * Organization Service
 *
 * CRUD operations for organizations with plan tier enforcement.
 * Reuses existing Prisma singleton from db-prisma.ts.
 */

import type { PrismaClient, OrgPlanTier } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('Org:Service');

// Plan tier limits
const PLAN_LIMITS: Record<string, { maxAgents: number; maxMemories: number; maxDepartments: number }> = {
  lite:       { maxAgents: 8,   maxMemories: 10000,   maxDepartments: 1 },
  team:       { maxAgents: 32,  maxMemories: 100000,  maxDepartments: 10 },
  enterprise: { maxAgents: 128, maxMemories: 1000000, maxDepartments: 50 },
  scientific: { maxAgents: 9999, maxMemories: 10000000, maxDepartments: 200 },
};

export interface CreateOrgInput {
  name: string;
  slug: string;
  description?: string;
  planTier?: OrgPlanTier;
  ownerId: number; // User who creates the org becomes owner
}

export interface UpdateOrgInput {
  name?: string;
  description?: string;
  planTier?: OrgPlanTier;
}

export class OrgService {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreateOrgInput) {
    const limits = PLAN_LIMITS[input.planTier || 'lite'];

    // Slug uniqueness checked by DB constraint, but give friendly error
    const existing = await this.prisma.organization.findUnique({
      where: { slug: input.slug },
    });
    if (existing) {
      throw new Error(`Organization slug "${input.slug}" is already taken`);
    }

    const org = await this.prisma.$transaction(async (tx) => {
      // 1. Create organization
      const newOrg = await tx.organization.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          planTier: input.planTier || 'lite',
          maxAgents: limits.maxAgents,
          maxMemories: limits.maxMemories,
          maxDepartments: limits.maxDepartments,
        },
      });

      // 2. Auto-create owner membership
      await tx.orgMembership.create({
        data: {
          userId: input.ownerId,
          organizationId: newOrg.id,
          role: 'owner',
        },
      });

      // 3. Auto-create default "General" department
      await tx.department.create({
        data: {
          organizationId: newOrg.id,
          name: 'General',
          slug: 'general',
          description: 'Default department',
        },
      });

      return newOrg;
    });

    logger.info('Organization created', { orgId: org.id, slug: org.slug, plan: org.planTier });
    return org;
  }

  async getById(orgId: number) {
    return this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        departments: { orderBy: { name: 'asc' } },
        _count: { select: { memberships: true, agentAssignments: true, memories: true } },
      },
    });
  }

  async getBySlug(slug: string) {
    return this.prisma.organization.findUnique({
      where: { slug },
      include: {
        departments: { orderBy: { name: 'asc' } },
        _count: { select: { memberships: true, agentAssignments: true, memories: true } },
      },
    });
  }

  async listByUser(userId: number) {
    const memberships = await this.prisma.orgMembership.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            _count: { select: { memberships: true, agentAssignments: true, memories: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => ({ ...m.organization, role: m.role }));
  }

  async update(orgId: number, input: UpdateOrgInput) {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;

    // Plan tier change updates limits
    if (input.planTier !== undefined) {
      const limits = PLAN_LIMITS[input.planTier];
      data.planTier = input.planTier;
      data.maxAgents = limits.maxAgents;
      data.maxMemories = limits.maxMemories;
      data.maxDepartments = limits.maxDepartments;
    }

    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data,
    });

    logger.info('Organization updated', { orgId: org.id });
    return org;
  }

  async delete(orgId: number) {
    // Cascade handled by Prisma relations
    await this.prisma.organization.delete({ where: { id: orgId } });
    logger.info('Organization deleted', { orgId });
  }

  /** Check if org has capacity for more agents */
  async canAddAgent(orgId: number): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { maxAgents: true, currentAgentCount: true },
    });
    if (!org) return false;
    return org.currentAgentCount < org.maxAgents;
  }

  /** Check if org has capacity for more memories */
  async canAddMemory(orgId: number): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { maxMemories: true, currentMemoryCount: true },
    });
    if (!org) return false;
    return org.currentMemoryCount < org.maxMemories;
  }

  /** Increment org counters (called after agent/memory creation) */
  async incrementAgentCount(orgId: number) {
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { currentAgentCount: { increment: 1 } },
    });
  }

  async decrementAgentCount(orgId: number) {
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { currentAgentCount: { decrement: 1 } },
    });
  }

  async incrementMemoryCount(orgId: number) {
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { currentMemoryCount: { increment: 1 } },
    });
  }

  async decrementMemoryCount(orgId: number) {
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { currentMemoryCount: { decrement: 1 } },
    });
  }
}

export function createOrgService(prisma: PrismaClient) {
  return new OrgService(prisma);
}
