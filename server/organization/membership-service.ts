/**
 * Membership Service
 *
 * User-to-org membership management with role-based access control.
 * Also handles AgentAssignment CRUD.
 */

import type { PrismaClient, OrgMemberRole } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('Membership:Service');

export interface AddMemberInput {
  userId: number;
  organizationId: number;
  role?: OrgMemberRole;
  departmentIds?: number[];
}

export interface AssignAgentInput {
  agentId: string;
  organizationId: number;
  departmentId?: number;
  agentName?: string;
  agentModel?: string;
  capabilities?: string[];
}

export class MembershipService {
  constructor(private prisma: PrismaClient) {}

  // ---- User Membership ----

  async addMember(input: AddMemberInput) {
    const membership = await this.prisma.orgMembership.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId,
        role: input.role || 'member',
        departmentIds: input.departmentIds || [],
      },
    });
    logger.info('Member added', { userId: input.userId, orgId: input.organizationId });
    return membership;
  }

  async removeMember(userId: number, orgId: number) {
    await this.prisma.orgMembership.delete({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    logger.info('Member removed', { userId, orgId });
  }

  async updateRole(userId: number, orgId: number, role: OrgMemberRole, departmentIds?: number[]) {
    const data: Record<string, unknown> = { role };
    if (departmentIds !== undefined) data.departmentIds = departmentIds;

    const membership = await this.prisma.orgMembership.update({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      data,
    });
    logger.info('Member role updated', { userId, orgId, role });
    return membership;
  }

  async getMembership(userId: number, orgId: number) {
    return this.prisma.orgMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      include: { organization: true },
    });
  }

  async listMembers(orgId: number) {
    return this.prisma.orgMembership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /** Check if user has at least the given role level in org */
  async hasRole(userId: number, orgId: number, minRole: OrgMemberRole): Promise<boolean> {
    const roleHierarchy: Record<string, number> = {
      viewer: 0,
      member: 1,
      dept_admin: 2,
      admin: 3,
      owner: 4,
    };

    const membership = await this.prisma.orgMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      select: { role: true },
    });

    if (!membership) return false;
    return roleHierarchy[membership.role] >= roleHierarchy[minRole];
  }

  // ---- Agent Assignment ----

  async assignAgent(input: AssignAgentInput) {
    // ✅ P0-4: Move quota check inside transaction with Serializable isolation
    const assignment = await this.prisma.$transaction(async (tx) => {
      // Check agent limit (inside transaction to prevent race condition)
      const org = await tx.organization.findUnique({
        where: { id: input.organizationId },
        select: { maxAgents: true, currentAgentCount: true, planTier: true },
      });

      if (!org) throw new Error('Organization not found');
      if (org.currentAgentCount >= org.maxAgents) {
        throw new Error(
          `Agent limit reached (${org.maxAgents}). Current plan: ${org.planTier}. Upgrade your plan.`
        );
      }

      // Create assignment
      const result = await tx.agentAssignment.create({
        data: {
          agentId: input.agentId,
          organizationId: input.organizationId,
          departmentId: input.departmentId,
          agentName: input.agentName,
          agentModel: input.agentModel,
          capabilities: input.capabilities || [],
        },
      });

      // Increment org counter
      await tx.organization.update({
        where: { id: input.organizationId },
        data: { currentAgentCount: { increment: 1 } },
      });

      return result;
    }, {
      isolationLevel: 'Serializable' // ✅ Prevent race conditions
    });

    logger.info('Agent assigned', { agentId: input.agentId, orgId: input.organizationId });
    return assignment;
  }

  async unassignAgent(agentId: string, orgId: number) {
    await this.prisma.$transaction(async (tx) => {
      await tx.agentAssignment.delete({
        where: { agentId_organizationId: { agentId, organizationId: orgId } },
      });

      await tx.organization.update({
        where: { id: orgId },
        data: { currentAgentCount: { decrement: 1 } },
      });
    });

    logger.info('Agent unassigned', { agentId, orgId });
  }

  async updateAgentAssignment(agentId: string, orgId: number, data: {
    departmentId?: number | null;
    agentName?: string;
    agentModel?: string;
    capabilities?: string[];
    isActive?: boolean;
  }) {
    return this.prisma.agentAssignment.update({
      where: { agentId_organizationId: { agentId, organizationId: orgId } },
      data,
    });
  }

  async listAgents(orgId: number, departmentId?: number) {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (departmentId !== undefined) where.departmentId = departmentId;

    return this.prisma.agentAssignment.findMany({
      where,
      include: { department: { select: { id: true, name: true, slug: true } } },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async getAgentAssignment(agentId: string, orgId: number) {
    return this.prisma.agentAssignment.findUnique({
      where: { agentId_organizationId: { agentId, organizationId: orgId } },
      include: { department: true, organization: true },
    });
  }
}

export function createMembershipService(prisma: PrismaClient) {
  return new MembershipService(prisma);
}
