/**
 * Memory Conflict Resolver (第2阶段: Conflict Detection API)
 *
 * Provides API for managing memory conflicts detected by database triggers or semantic analysis.
 *
 * Features:
 * - List conflicts by org/status
 * - Get conflict details with full memory context
 * - Resolve conflicts (pick winning memory)
 * - Ignore conflicts (mark as not applicable)
 */

import { PrismaClient, MemoryEntry, MemoryConflict } from '@prisma/client';

export type ConflictStatus = 'pending' | 'resolved' | 'ignored';
export type ConflictType = 'claim_value_mismatch' | 'semantic_contradiction';

export interface ConflictWithMemories extends MemoryConflict {
  memory1: MemoryEntry;
  memory2: MemoryEntry;
  resolutionMemory?: MemoryEntry | null;
}

export interface ListConflictsParams {
  org_id: string;
  status?: ConflictStatus;
  conflict_type?: ConflictType;
  limit?: number;
  offset?: number;
}

export interface ResolveConflictParams {
  conflict_id: string;
  resolution_memory_id: string; // ID of the memory that "wins" the conflict
  resolved_by: string; // User ID or agent ID
}

export class ConflictResolver {
  constructor(private prisma: PrismaClient) {}

  /**
   * List conflicts for an organization
   *
   * Usage:
   * ```typescript
   * const conflicts = await resolver.listConflicts({
   *   org_id: 'org-123',
   *   status: 'pending',
   *   limit: 20,
   * });
   * ```
   */
  async listConflicts(params: ListConflictsParams): Promise<ConflictWithMemories[]> {
    const { org_id, status, conflict_type, limit = 50, offset = 0 } = params;

    // Find all conflicts where either memory belongs to this org
    const conflicts = await this.prisma.memoryConflict.findMany({
      where: {
        AND: [
          {
            OR: [
              { memory1: { org_id } },
              { memory2: { org_id } },
            ],
          },
          status ? { status } : {},
          conflict_type ? { conflictType: conflict_type } : {},
        ],
      },
      include: {
        memory1: true,
        memory2: true,
        resolutionMemory: {
          include: {
            score: true,
          },
        },
      },
      orderBy: {
        detectedAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return conflicts as ConflictWithMemories[];
  }

  /**
   * Get a single conflict by ID with full context
   *
   * Usage:
   * ```typescript
   * const conflict = await resolver.getConflict('conflict-uuid');
   * if (conflict) {
   *   console.log('Memory 1:', conflict.memory1.content);
   *   console.log('Memory 2:', conflict.memory2.content);
   * }
   * ```
   */
  async getConflict(conflict_id: string): Promise<ConflictWithMemories | null> {
    const conflict = await this.prisma.memoryConflict.findUnique({
      where: { id: conflict_id },
      include: {
        memory1: {
          include: {
            score: true,
          },
        },
        memory2: {
          include: {
            score: true,
          },
        },
        resolutionMemory: {
          include: {
            score: true,
          },
        },
      },
    });

    return conflict as ConflictWithMemories | null;
  }

  /**
   * Resolve a conflict by choosing a winning memory
   *
   * This marks the conflict as 'resolved' and records which memory was chosen as the truth.
   * The losing memory is NOT deleted, but can be marked as outdated in future updates.
   *
   * Usage:
   * ```typescript
   * await resolver.resolveConflict({
   *   conflict_id: 'conflict-uuid',
   *   resolution_memory_id: 'memory-uuid-winner',
   *   resolved_by: 'user-alice',
   * });
   * ```
   */
  async resolveConflict(params: ResolveConflictParams): Promise<MemoryConflict> {
    const { conflict_id, resolution_memory_id, resolved_by } = params;

    // Verify resolution memory exists and is one of the conflicting memories
    const conflict = await this.getConflict(conflict_id);
    if (!conflict) {
      throw new Error(`Conflict ${conflict_id} not found`);
    }

    if (
      resolution_memory_id !== conflict.memoryId1 &&
      resolution_memory_id !== conflict.memoryId2
    ) {
      throw new Error(
        `Resolution memory ${resolution_memory_id} is not one of the conflicting memories`
      );
    }

    // Update conflict status
    const resolved = await this.prisma.memoryConflict.update({
      where: { id: conflict_id },
      data: {
        status: 'resolved',
        resolutionMemoryId: resolution_memory_id,
        resolvedAt: new Date(),
        resolvedBy: resolved_by,
      },
    });

    // Optional: Mark the losing memory as is_latest = false
    // (Commented out - let user decide if they want to deprecate losing memories)
    /*
    const losingMemoryId =
      resolution_memory_id === conflict.memoryId1 ? conflict.memoryId2 : conflict.memoryId1;

    await this.prisma.memoryEntry.update({
      where: { id: losingMemoryId },
      data: { is_latest: false },
    });
    */

    return resolved;
  }

  /**
   * Ignore a conflict (mark as not applicable)
   *
   * Use this when the conflict is a false positive or when both memories are valid in different contexts.
   *
   * Usage:
   * ```typescript
   * await resolver.ignoreConflict({
   *   conflict_id: 'conflict-uuid',
   *   resolved_by: 'user-alice',
   * });
   * ```
   */
  async ignoreConflict(params: {
    conflict_id: string;
    resolved_by: string;
  }): Promise<MemoryConflict> {
    const { conflict_id, resolved_by } = params;

    const ignored = await this.prisma.memoryConflict.update({
      where: { id: conflict_id },
      data: {
        status: 'ignored',
        resolvedAt: new Date(),
        resolvedBy: resolved_by,
      },
    });

    return ignored;
  }

  /**
   * Get conflict statistics for an organization
   *
   * Usage:
   * ```typescript
   * const stats = await resolver.getConflictStats('org-123');
   * console.log('Pending:', stats.pending);
   * console.log('Resolved:', stats.resolved);
   * ```
   */
  async getConflictStats(org_id: string): Promise<{
    pending: number;
    resolved: number;
    ignored: number;
    total: number;
    by_type: Record<ConflictType, number>;
  }> {
    // Count by status
    const [pending, resolved, ignored] = await Promise.all([
      this.prisma.memoryConflict.count({
        where: {
          OR: [{ memory1: { org_id } }, { memory2: { org_id } }],
          status: 'pending',
        },
      }),
      this.prisma.memoryConflict.count({
        where: {
          OR: [{ memory1: { org_id } }, { memory2: { org_id } }],
          status: 'resolved',
        },
      }),
      this.prisma.memoryConflict.count({
        where: {
          OR: [{ memory1: { org_id } }, { memory2: { org_id } }],
          status: 'ignored',
        },
      }),
    ]);

    // Count by type
    const typeGroups = await this.prisma.memoryConflict.groupBy({
      by: ['conflictType'],
      where: {
        OR: [{ memory1: { org_id } }, { memory2: { org_id } }],
      },
      _count: true,
    });

    const by_type: Record<string, number> = {};
    typeGroups.forEach((group) => {
      by_type[group.conflictType] = group._count;
    });

    return {
      pending,
      resolved,
      ignored,
      total: pending + resolved + ignored,
      by_type: by_type as Record<ConflictType, number>,
    };
  }

  /**
   * Batch resolve conflicts (for bulk operations)
   *
   * Usage:
   * ```typescript
   * await resolver.batchResolveConflicts([
   *   { conflict_id: 'c1', resolution_memory_id: 'm1', resolved_by: 'user-alice' },
   *   { conflict_id: 'c2', resolution_memory_id: 'm3', resolved_by: 'user-alice' },
   * ]);
   * ```
   */
  async batchResolveConflicts(
    resolutions: ResolveConflictParams[]
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const resolution of resolutions) {
      try {
        await this.resolveConflict(resolution);
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`${resolution.conflict_id}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }
}

/**
 * Factory function to create ConflictResolver instance
 */
export function createConflictResolver(prisma: PrismaClient): ConflictResolver {
  return new ConflictResolver(prisma);
}
