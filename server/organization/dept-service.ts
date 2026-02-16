/**
 * Department Service
 *
 * CRUD operations for departments with hierarchy management.
 * Enforces plan tier department limits via OrgService.
 */

import type { PrismaClient, MemoryType } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('Dept:Service');

export interface CreateDeptInput {
  organizationId: number;
  name: string;
  slug: string;
  description?: string;
  parentDeptId?: number;
  defaultMemoryType?: MemoryType;
  defaultDecayFactor?: number;
}

export interface UpdateDeptInput {
  name?: string;
  description?: string;
  parentDeptId?: number | null;
  defaultMemoryType?: MemoryType;
  defaultDecayFactor?: number;
}

export class DeptService {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreateDeptInput) {
    // Check department limit
    const org = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { maxDepartments: true, _count: { select: { departments: true } } },
    });

    if (!org) throw new Error('Organization not found');
    if (org._count.departments >= org.maxDepartments) {
      throw new Error(`Department limit reached (${org.maxDepartments}). Upgrade your plan.`);
    }

    // Validate parent department belongs to same org
    if (input.parentDeptId) {
      const parent = await this.prisma.department.findFirst({
        where: { id: input.parentDeptId, organizationId: input.organizationId },
      });
      if (!parent) throw new Error('Parent department not found in this organization');
    }

    const dept = await this.prisma.department.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        parentDeptId: input.parentDeptId,
        defaultMemoryType: input.defaultMemoryType || 'semantic',
        defaultDecayFactor: input.defaultDecayFactor || 0.01,
      },
    });

    logger.info('Department created', { deptId: dept.id, orgId: input.organizationId });
    return dept;
  }

  async getById(deptId: number) {
    return this.prisma.department.findUnique({
      where: { id: deptId },
      include: {
        childDepts: { orderBy: { name: 'asc' } },
        parentDept: true,
        _count: { select: { agentAssignments: true } },
      },
    });
  }

  async listByOrg(orgId: number) {
    return this.prisma.department.findMany({
      where: { organizationId: orgId },
      include: {
        childDepts: { orderBy: { name: 'asc' } },
        _count: { select: { agentAssignments: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /** Returns tree structure (root departments with nested children) */
  async getTree(orgId: number) {
    const allDepts = await this.prisma.department.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { agentAssignments: true } } },
      orderBy: { name: 'asc' },
    });

    // Build tree from flat list
    const map = new Map<number, typeof allDepts[0] & { children: typeof allDepts }>();
    const roots: (typeof allDepts[0] & { children: typeof allDepts })[] = [];

    for (const dept of allDepts) {
      map.set(dept.id, { ...dept, children: [] });
    }

    for (const dept of allDepts) {
      const node = map.get(dept.id)!;
      if (dept.parentDeptId && map.has(dept.parentDeptId)) {
        map.get(dept.parentDeptId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async update(deptId: number, input: UpdateDeptInput) {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.parentDeptId !== undefined) data.parentDeptId = input.parentDeptId;
    if (input.defaultMemoryType !== undefined) data.defaultMemoryType = input.defaultMemoryType;
    if (input.defaultDecayFactor !== undefined) data.defaultDecayFactor = input.defaultDecayFactor;

    const dept = await this.prisma.department.update({
      where: { id: deptId },
      data,
    });

    logger.info('Department updated', { deptId });
    return dept;
  }

  async delete(deptId: number) {
    // Child departments will have parentDeptId set to null (onDelete: SetNull)
    await this.prisma.department.delete({ where: { id: deptId } });
    logger.info('Department deleted', { deptId });
  }
}

export function createDeptService(prisma: PrismaClient) {
  return new DeptService(prisma);
}
