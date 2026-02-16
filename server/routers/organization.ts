/**
 * Organization tRPC Router
 *
 * CRUD endpoints for organizations, departments, memberships, and agent assignments.
 * Follows existing memory.ts router pattern.
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';
import { createOrgService, createDeptService, createMembershipService } from '../organization';
import { createLogger } from '../utils/logger';
import { requireWithinLimits } from '../middleware/org-feature-gate';

const logger = createLogger('Organization:API');

// Lazy singleton services
let orgService: ReturnType<typeof createOrgService> | null = null;
let deptService: ReturnType<typeof createDeptService> | null = null;
let memberService: ReturnType<typeof createMembershipService> | null = null;

function getOrgService() {
  if (!orgService) orgService = createOrgService(prisma);
  return orgService;
}
function getDeptService() {
  if (!deptService) deptService = createDeptService(prisma);
  return deptService;
}
function getMemberService() {
  if (!memberService) memberService = createMembershipService(prisma);
  return memberService;
}

// ============================================================================
// Input Schemas
// ============================================================================

const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional(),
  planTier: z.enum(['lite', 'team', 'enterprise', 'scientific']).optional(),
});

const updateOrgSchema = z.object({
  orgId: z.number(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  planTier: z.enum(['lite', 'team', 'enterprise', 'scientific']).optional(),
});

const createDeptSchema = z.object({
  organizationId: z.number(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  parentDeptId: z.number().optional(),
  defaultMemoryType: z.enum(['episodic', 'semantic', 'strategic', 'procedural']).optional(),
  defaultDecayFactor: z.number().min(0).max(1).optional(),
});

const updateDeptSchema = z.object({
  deptId: z.number(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  parentDeptId: z.number().nullable().optional(),
  defaultMemoryType: z.enum(['episodic', 'semantic', 'strategic', 'procedural']).optional(),
  defaultDecayFactor: z.number().min(0).max(1).optional(),
});

const addMemberSchema = z.object({
  organizationId: z.number(),
  userId: z.number(),
  role: z.enum(['owner', 'admin', 'dept_admin', 'member', 'viewer']).optional(),
  departmentIds: z.array(z.number()).optional(),
});

const updateMemberSchema = z.object({
  organizationId: z.number(),
  userId: z.number(),
  role: z.enum(['owner', 'admin', 'dept_admin', 'member', 'viewer']),
  departmentIds: z.array(z.number()).optional(),
});

const assignAgentSchema = z.object({
  organizationId: z.number(),
  agentId: z.string().min(1).max(255),
  departmentId: z.number().optional(),
  agentName: z.string().max(255).optional(),
  agentModel: z.string().max(100).optional(),
  capabilities: z.array(z.string()).optional(),
});

const updateAgentSchema = z.object({
  organizationId: z.number(),
  agentId: z.string(),
  departmentId: z.number().nullable().optional(),
  agentName: z.string().max(255).optional(),
  agentModel: z.string().max(100).optional(),
  capabilities: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Helper: Require org membership with minimum role
// ============================================================================

async function requireOrgRole(userId: number, orgId: number, minRole: 'viewer' | 'member' | 'dept_admin' | 'admin' | 'owner') {
  const hasRole = await getMemberService().hasRole(userId, orgId, minRole);
  if (!hasRole) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Requires at least "${minRole}" role in this organization`,
    });
  }
}

// ============================================================================
// Router
// ============================================================================

export const organizationRouter = router({
  // ---- Organization CRUD ----

  create: protectedProcedure
    .input(createOrgSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await getOrgService().create({ ...input, ownerId: ctx.user.id });
      } catch (err: any) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
      }
    }),

  get: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.orgId, 'viewer');
      const org = await getOrgService().getById(input.orgId);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
      return org;
    }),

  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const org = await getOrgService().getBySlug(input.slug);
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
      return org;
    }),

  listMine: protectedProcedure
    .query(async ({ ctx }) => {
      return getOrgService().listByUser(ctx.user.id);
    }),

  /**
   * List all organizations (platform admin only)
   */
  listAll: protectedProcedure
    .query(async ({ ctx }) => {
      // ✅ P0-3: Only allow platform admins (using standard role check)
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform admin access required' });
      }
      return prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              memberships: true,
              departments: true,
            },
          },
        },
      });
    }),

  update: protectedProcedure
    .input(updateOrgSchema)
    .mutation(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.orgId, 'admin');
      const { orgId, ...data } = input;
      return getOrgService().update(orgId, data);
    }),

  delete: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.orgId, 'owner');
      await getOrgService().delete(input.orgId);
      return { success: true };
    }),

  // ---- Department CRUD ----

  createDepartment: protectedProcedure
    .input(createDeptSchema)
    .mutation(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.organizationId, 'admin');
      await requireWithinLimits(input.organizationId, 'departments');
      try {
        return await getDeptService().create(input);
      } catch (err: any) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
      }
    }),

  getDepartment: protectedProcedure
    .input(z.object({ deptId: z.number() }))
    .query(async ({ input, ctx }) => {
      const dept = await getDeptService().getById(input.deptId);
      if (!dept) throw new TRPCError({ code: 'NOT_FOUND', message: 'Department not found' });
      await requireOrgRole(ctx.user.id, dept.organizationId, 'viewer');
      return dept;
    }),

  listDepartments: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.orgId, 'viewer');
      return getDeptService().listByOrg(input.orgId);
    }),

  getDepartmentTree: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.orgId, 'viewer');
      return getDeptService().getTree(input.orgId);
    }),

  updateDepartment: protectedProcedure
    .input(updateDeptSchema)
    .mutation(async ({ input, ctx }) => {
      const dept = await getDeptService().getById(input.deptId);
      if (!dept) throw new TRPCError({ code: 'NOT_FOUND', message: 'Department not found' });
      await requireOrgRole(ctx.user.id, dept.organizationId, 'admin');
      const { deptId, ...data } = input;
      return getDeptService().update(deptId, data);
    }),

  deleteDepartment: protectedProcedure
    .input(z.object({ deptId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const dept = await getDeptService().getById(input.deptId);
      if (!dept) throw new TRPCError({ code: 'NOT_FOUND', message: 'Department not found' });
      await requireOrgRole(ctx.user.id, dept.organizationId, 'admin');
      await getDeptService().delete(input.deptId);
      return { success: true };
    }),

  // ---- Member Management ----

  addMember: protectedProcedure
    .input(addMemberSchema)
    .mutation(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.organizationId, 'admin');
      try {
        return await getMemberService().addMember(input);
      } catch (err: any) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
      }
    }),

  removeMember: protectedProcedure
    .input(z.object({ organizationId: z.number(), userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.organizationId, 'admin');
      await getMemberService().removeMember(input.userId, input.organizationId);
      return { success: true };
    }),

  updateMember: protectedProcedure
    .input(updateMemberSchema)
    .mutation(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.organizationId, 'admin');
      return getMemberService().updateRole(input.userId, input.organizationId, input.role, input.departmentIds);
    }),

  listMembers: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.orgId, 'viewer');
      return getMemberService().listMembers(input.orgId);
    }),

  // ---- Agent Assignment ----

  assignAgent: protectedProcedure
    .input(assignAgentSchema)
    .mutation(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.organizationId, 'admin');
      await requireWithinLimits(input.organizationId, 'agents');
      try {
        return await getMemberService().assignAgent(input);
      } catch (err: any) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
      }
    }),

  unassignAgent: protectedProcedure
    .input(z.object({ organizationId: z.number(), agentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.organizationId, 'admin');
      await getMemberService().unassignAgent(input.agentId, input.organizationId);
      return { success: true };
    }),

  updateAgent: protectedProcedure
    .input(updateAgentSchema)
    .mutation(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.organizationId, 'admin');
      const { organizationId, agentId, ...data } = input;
      return getMemberService().updateAgentAssignment(agentId, organizationId, data);
    }),

  listAgents: protectedProcedure
    .input(z.object({ orgId: z.number(), departmentId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      await requireOrgRole(ctx.user.id, input.orgId, 'viewer');
      return getMemberService().listAgents(input.orgId, input.departmentId);
    }),
});
