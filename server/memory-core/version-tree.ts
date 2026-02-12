/**
 * Memory Version Tree Manager (第2阶段: Version Tree API)
 *
 * Manages version history and branching for memories using root_id and parent_id fields.
 *
 * Features:
 * - Get full version tree (all branches)
 * - Get linear version history (single branch)
 * - Rollback to previous version
 * - Compare versions
 */

import { PrismaClient, MemoryEntry } from '@prisma/client';

export interface VersionNode extends MemoryEntry {
  children?: VersionNode[];
}

export interface VersionHistory {
  versions: MemoryEntry[];
  root: MemoryEntry;
  current: MemoryEntry;
  depth: number;
}

export interface VersionDiff {
  field: string;
  old_value: any;
  new_value: any;
}

export class VersionTreeManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get complete version tree for a memory
   *
   * Returns a tree structure with root at the top and all branches/versions as children.
   *
   * Usage:
   * ```typescript
   * const tree = await versionTree.getVersionTree('root-memory-id');
   * console.log('Root:', tree.content);
   * console.log('Children:', tree.children.length);
   * ```
   */
  async getVersionTree(root_id: string): Promise<VersionNode | null> {
    // Get all memories in this version tree
    const allVersions = await this.prisma.memoryEntry.findMany({
      where: {
        OR: [
          { id: root_id },
          { rootId: root_id },
        ],
      },
      include: {
        score: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    if (allVersions.length === 0) {
      return null;
    }

    // Build tree structure
    const versionMap = new Map<string, VersionNode>();
    allVersions.forEach((v) => {
      versionMap.set(v.id, { ...v, children: [] });
    });

    let root: VersionNode | null = null;

    // Link children to parents
    allVersions.forEach((v) => {
      const node = versionMap.get(v.id)!;

      if (v.parentId) {
        const parent = versionMap.get(v.parentId);
        if (parent) {
          parent.children!.push(node);
        }
      } else {
        // This is the root
        root = node;
      }
    });

    return root;
  }

  /**
   * Get linear version history for a memory (from current back to root)
   *
   * Returns array of versions in chronological order [root → ... → current].
   *
   * Usage:
   * ```typescript
   * const history = await versionTree.getVersionHistory('current-memory-id');
   * console.log('Total versions:', history.versions.length);
   * console.log('Root version:', history.root.content);
   * console.log('Current version:', history.current.content);
   * ```
   */
  async getVersionHistory(memory_id: string): Promise<VersionHistory | null> {
    const currentMemory = await this.prisma.memoryEntry.findUnique({
      where: { id: memory_id },
      include: {
        score: true,
      },
    });

    if (!currentMemory) {
      return null;
    }

    // Traverse up the parent chain
    const versions: MemoryEntry[] = [currentMemory];
    let currentId = currentMemory.parentId;

    while (currentId) {
      const parent = await this.prisma.memoryEntry.findUnique({
        where: { id: currentId },
        include: {
          score: true,
        },
      });

      if (!parent) break;

      versions.unshift(parent); // Add to beginning
      currentId = parent.parentId;
    }

    const root = versions[0];

    return {
      versions,
      root,
      current: currentMemory,
      depth: versions.length - 1, // Number of generations from root
    };
  }

  /**
   * Rollback to a specific version
   *
   * Creates a new memory entry that is a copy of the target version,
   * with parent_id pointing to the current latest version.
   *
   * Usage:
   * ```typescript
   * const newVersion = await versionTree.rollbackToVersion({
   *   target_version_id: 'old-version-id',
   *   created_by: 'user-alice',
   * });
   * ```
   */
  async rollbackToVersion(params: {
    target_version_id: string;
    created_by: string;
    reason?: string;
  }): Promise<MemoryEntry> {
    const { target_version_id, created_by, reason } = params;

    // Get target version
    const targetVersion = await this.prisma.memoryEntry.findUnique({
      where: { id: target_version_id },
    });

    if (!targetVersion) {
      throw new Error(`Version ${target_version_id} not found`);
    }

    // Find the current latest version in this tree
    const currentLatest = await this.prisma.memoryEntry.findFirst({
      where: {
        OR: [
          { id: targetVersion.rootId || targetVersion.id },
          { rootId: targetVersion.rootId || targetVersion.id },
        ],
        is_latest: true,
      },
    });

    if (!currentLatest) {
      throw new Error('Could not find current latest version');
    }

    // Mark current latest as not latest
    await this.prisma.memoryEntry.update({
      where: { id: currentLatest.id },
      data: { is_latest: false },
    });

    // Create new version as rollback (copy of target)
    const rolledBack = await this.prisma.memoryEntry.create({
      data: {
        org_id: targetVersion.org_id,
        namespace: targetVersion.namespace,
        content_type: targetVersion.content_type,
        content: targetVersion.content,
        embedding: targetVersion.embedding,
        confidence: targetVersion.confidence,
        created_by,
        parentId: currentLatest.id, // Parent is the version we're rolling back from
        rootId: targetVersion.rootId || targetVersion.id,
        is_latest: true,

        // Copy metadata fields
        claimKey: targetVersion.claimKey,
        claimValue: targetVersion.claimValue,
        agentId: targetVersion.agentId,
        department: targetVersion.department,
        role: targetVersion.role,

        // Add rollback metadata
        metadata: {
          ...(typeof targetVersion.metadata === 'object' ? targetVersion.metadata : {}),
          rollback: {
            from_version: currentLatest.id,
            to_version: target_version_id,
            reason: reason || 'Manual rollback',
            rolled_back_at: new Date().toISOString(),
            rolled_back_by: created_by,
          },
        },
      },
    });

    return rolledBack;
  }

  /**
   * Compare two versions and return differences
   *
   * Usage:
   * ```typescript
   * const diffs = await versionTree.compareVersions('version-1-id', 'version-2-id');
   * diffs.forEach(diff => {
   *   console.log(`${diff.field}: ${diff.old_value} → ${diff.new_value}`);
   * });
   * ```
   */
  async compareVersions(
    version_id_1: string,
    version_id_2: string
  ): Promise<VersionDiff[]> {
    const [v1, v2] = await Promise.all([
      this.prisma.memoryEntry.findUnique({ where: { id: version_id_1 } }),
      this.prisma.memoryEntry.findUnique({ where: { id: version_id_2 } }),
    ]);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const diffs: VersionDiff[] = [];

    // Compare key fields
    const fieldsToCompare: (keyof MemoryEntry)[] = [
      'content',
      'confidence',
      'claimKey',
      'claimValue',
      'department',
      'role',
      'agentId',
    ];

    fieldsToCompare.forEach((field) => {
      const oldVal = v1[field];
      const newVal = v2[field];

      if (oldVal !== newVal) {
        diffs.push({
          field: field as string,
          old_value: oldVal,
          new_value: newVal,
        });
      }
    });

    return diffs;
  }

  /**
   * Get all branches from a specific version
   *
   * Returns child versions that were created from a given parent.
   *
   * Usage:
   * ```typescript
   * const branches = await versionTree.getBranches('parent-version-id');
   * console.log(`This version has ${branches.length} branches`);
   * ```
   */
  async getBranches(parent_id: string): Promise<MemoryEntry[]> {
    const branches = await this.prisma.memoryEntry.findMany({
      where: {
        parentId: parent_id,
      },
      include: {
        score: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    return branches;
  }

  /**
   * Get version tree statistics
   *
   * Usage:
   * ```typescript
   * const stats = await versionTree.getTreeStats('root-id');
   * console.log('Total versions:', stats.total_versions);
   * console.log('Max depth:', stats.max_depth);
   * ```
   */
  async getTreeStats(root_id: string): Promise<{
    total_versions: number;
    max_depth: number;
    branch_points: number;
    latest_versions: number;
  }> {
    const allVersions = await this.prisma.memoryEntry.findMany({
      where: {
        OR: [{ id: root_id }, { rootId: root_id }],
      },
      include: {
        _count: {
          select: {
            children: true,
          },
        },
      },
    });

    // Count branch points (versions with > 1 child)
    const branchPoints = allVersions.filter((v) => v._count.children > 1).length;

    // Count latest versions
    const latestVersions = allVersions.filter((v) => v.is_latest).length;

    // Calculate max depth (BFS traversal)
    let maxDepth = 0;
    for (const version of allVersions) {
      if (!version.parentId) continue; // Skip root

      const history = await this.getVersionHistory(version.id);
      if (history && history.depth > maxDepth) {
        maxDepth = history.depth;
      }
    }

    return {
      total_versions: allVersions.length,
      max_depth: maxDepth,
      branch_points: branchPoints,
      latest_versions: latestVersions,
    };
  }
}

/**
 * Factory function to create VersionTreeManager instance
 */
export function createVersionTreeManager(prisma: PrismaClient): VersionTreeManager {
  return new VersionTreeManager(prisma);
}
