/**
 * Dependency Cascade — Memory dependency graph traversal
 *
 * When a base memory is invalidated:
 * 1. Traverse MemoryDependency graph
 * 2. Set needsRevalidation = true on dependents
 * 3. Reduce dependent memory confidence
 * 4. Return affected memory IDs for notification
 *
 * Reuses: MemoryRelation graph (from relation-builder.ts)
 */

import type { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('DependencyCascade');

export interface CascadeResult {
  invalidatedMemoryId: string;
  affectedCount: number;
  affectedMemoryIds: string[];
  confidenceReductions: Map<string, number>; // memoryId -> new confidence
}

export class DependencyCascade {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a dependency between two memories
   */
  async createDependency(input: {
    sourceMemoryId: string;
    dependsOnMemoryId: string;
    organizationId: number;
    dependencyType: 'assumes' | 'builds_on' | 'requires' | 'refutes';
    strength?: number;
    description?: string;
    createdBy: string;
  }) {
    return this.prisma.memoryDependency.create({
      data: {
        sourceMemoryId: input.sourceMemoryId,
        dependsOnMemoryId: input.dependsOnMemoryId,
        organizationId: input.organizationId,
        dependencyType: input.dependencyType,
        strength: input.strength || 0.5,
        description: input.description,
        createdBy: input.createdBy,
      },
    });
  }

  /**
   * When a memory is invalidated, cascade the impact through the dependency graph
   *
   * Confidence reduction = 20% * dependency strength * depth_factor
   * Max traversal depth: 3 levels
   */
  async cascade(invalidatedMemoryId: string, maxDepth: number = 3): Promise<CascadeResult> {
    const affectedMemoryIds: string[] = [];
    const confidenceReductions = new Map<string, number>();
    const visited = new Set<string>();

    await this.traverseAndReduce(
      invalidatedMemoryId,
      0,
      maxDepth,
      1.0,
      visited,
      affectedMemoryIds,
      confidenceReductions
    );

    if (affectedMemoryIds.length > 0) {
      logger.info('Dependency cascade completed', {
        invalidatedMemoryId,
        affectedCount: affectedMemoryIds.length,
      });
    }

    return {
      invalidatedMemoryId,
      affectedCount: affectedMemoryIds.length,
      affectedMemoryIds,
      confidenceReductions,
    };
  }

  /**
   * Recursive traversal with depth-limited confidence reduction
   */
  private async traverseAndReduce(
    memoryId: string,
    depth: number,
    maxDepth: number,
    cumulativeStrength: number,
    visited: Set<string>,
    affectedIds: string[],
    reductions: Map<string, number>
  ) {
    if (depth >= maxDepth || visited.has(memoryId)) return;
    visited.add(memoryId);

    // Find all memories that depend on this one
    const dependents = await this.prisma.memoryDependency.findMany({
      where: {
        dependsOnMemoryId: memoryId,
        dependencyType: { in: ['assumes', 'builds_on', 'requires'] },
      },
      include: {
        sourceMemory: { select: { id: true, confidence: true } },
      },
    });

    for (const dep of dependents) {
      const depStrength = Number(dep.strength);
      const effectiveStrength = cumulativeStrength * depStrength;

      // Reduce confidence: 20% * effective strength
      const reduction = 0.2 * effectiveStrength;
      const currentConfidence = Number(dep.sourceMemory.confidence);
      const newConfidence = Math.max(0, currentConfidence - reduction);

      // Update memory
      await this.prisma.memoryEntry.update({
        where: { id: dep.sourceMemoryId },
        data: { confidence: newConfidence },
      });

      // Mark dependency as needing revalidation
      await this.prisma.memoryDependency.update({
        where: { id: dep.id },
        data: { needsRevalidation: true },
      });

      affectedIds.push(dep.sourceMemoryId);
      reductions.set(dep.sourceMemoryId, newConfidence);

      // Recurse into dependents of this dependent
      await this.traverseAndReduce(
        dep.sourceMemoryId,
        depth + 1,
        maxDepth,
        effectiveStrength,
        visited,
        affectedIds,
        reductions
      );
    }
  }

  /**
   * Get dependency graph for a memory (both directions)
   */
  async getGraph(memoryId: string) {
    const [dependsOn, dependedBy] = await Promise.all([
      this.prisma.memoryDependency.findMany({
        where: { sourceMemoryId: memoryId },
        include: {
          dependsOnMemory: { select: { id: true, content: true, confidence: true, poolType: true } },
        },
      }),
      this.prisma.memoryDependency.findMany({
        where: { dependsOnMemoryId: memoryId },
        include: {
          sourceMemory: { select: { id: true, content: true, confidence: true, poolType: true } },
        },
      }),
    ]);

    return { dependsOn, dependedBy };
  }

  /**
   * Get all dependencies needing revalidation for an org
   */
  async getNeedsRevalidation(orgId: number, limit: number = 50) {
    return this.prisma.memoryDependency.findMany({
      where: {
        organizationId: orgId,
        needsRevalidation: true,
      },
      include: {
        sourceMemory: { select: { id: true, content: true, confidence: true } },
        dependsOnMemory: { select: { id: true, content: true, confidence: true } },
      },
      take: limit,
    });
  }

  /**
   * Mark a dependency as revalidated
   */
  async markRevalidated(dependencyId: string) {
    await this.prisma.memoryDependency.update({
      where: { id: dependencyId },
      data: { needsRevalidation: false, lastValidatedAt: new Date() },
    });
  }
}

export function createDependencyCascade(prisma: PrismaClient) {
  return new DependencyCascade(prisma);
}
