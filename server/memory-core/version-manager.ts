/**
 * Memory Version Manager
 *
 * Manages memory version trees for:
 * - Non-destructive updates (create new version, keep old)
 * - Version history and audit trails
 * - Rollback capabilities
 * - Memory evolution tracking
 *
 * Version Tree Example:
 *   memory-001 (v1) "User prefers dark mode"
 *       │
 *       ├─ memory-002 (v2) "User prefers dark mode with high contrast"
 *       │       │
 *       │       └─ memory-003 (v3) "User prefers system theme"  [is_latest: true]
 *       │
 *       └─ memory-004 (v2-alt) "User disabled dark mode"  [abandoned branch]
 */

import { MemoryEntry, MemoryVersionNode, UpdateMemoryInput } from './schema';
import { v4 as uuidv4 } from 'uuid';

export class VersionManager {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Create a new version of an existing memory
   * - Creates new memory entry with version++
   * - Sets parent_id to original memory ID
   * - Marks original as is_latest=false (via trigger)
   * - Returns new memory ID
   */
  async createVersion(
    parentMemoryId: string,
    update: UpdateMemoryInput,
    updatedBy: string
  ): Promise<string> {
    // Fetch parent memory
    const parent = await this.prisma.memoryEntry.findUnique({
      where: { id: parentMemoryId },
    });

    if (!parent) {
      throw new Error(`Parent memory ${parentMemoryId} not found`);
    }

    if (!parent.is_latest) {
      throw new Error(`Cannot create version from non-latest memory ${parentMemoryId}`);
    }

    // Create new version
    const newVersion = await this.prisma.memoryEntry.create({
      data: {
        id: uuidv4(),
        org_id: parent.org_id,
        namespace: parent.namespace,
        content_type: parent.content_type,
        content: update.content !== undefined ? update.content : parent.content,
        embedding: parent.embedding, // Keep same embedding initially (can be updated later)
        metadata: update.metadata !== undefined ? update.metadata : parent.metadata,
        confidence: update.confidence !== undefined ? update.confidence : parent.confidence,
        reputation: parent.reputation, // Inherit reputation
        usage_count: 0, // Reset usage for new version
        validation_count: 0,
        version: parent.version + 1,
        parent_id: parentMemoryId,
        is_latest: true,
        created_by: updatedBy,
        decay_factor: parent.decay_factor,
        decay_checkpoint: new Date(), // Reset decay checkpoint
      },
    });

    return newVersion.id;
  }

  /**
   * Get full version tree for a memory
   * Returns hierarchical structure with all versions
   */
  async getVersionTree(memoryId: string): Promise<MemoryVersionNode> {
    // Find root of version tree
    const root = await this.findRoot(memoryId);

    // Build tree recursively
    return this.buildTree(root.id);
  }

  /**
   * Find root of version tree (memory with parent_id = null)
   */
  private async findRoot(memoryId: string): Promise<MemoryEntry> {
    let current = await this.prisma.memoryEntry.findUnique({
      where: { id: memoryId },
    });

    if (!current) {
      throw new Error(`Memory ${memoryId} not found`);
    }

    // Traverse up to root
    while (current.parent_id) {
      current = await this.prisma.memoryEntry.findUnique({
        where: { id: current.parent_id },
      });

      if (!current) {
        throw new Error('Broken version tree: parent not found');
      }
    }

    return current;
  }

  /**
   * Build version tree recursively
   */
  private async buildTree(memoryId: string): Promise<MemoryVersionNode> {
    const memory = await this.prisma.memoryEntry.findUnique({
      where: { id: memoryId },
    });

    if (!memory) {
      throw new Error(`Memory ${memoryId} not found`);
    }

    // Find all children (memories with parent_id = memoryId)
    const children = await this.prisma.memoryEntry.findMany({
      where: { parent_id: memoryId },
      orderBy: { created_at: 'asc' },
    });

    // Recursively build child trees
    const childTrees = await Promise.all(
      children.map((child: MemoryEntry) => this.buildTree(child.id))
    );

    return {
      memory,
      children: childTrees,
    };
  }

  /**
   * Get linear version history (all versions from root to current)
   */
  async getVersionHistory(memoryId: string): Promise<MemoryEntry[]> {
    const tree = await this.getVersionTree(memoryId);

    // Flatten tree to linear path (follow is_latest = true)
    const history: MemoryEntry[] = [];

    const traverse = (node: MemoryVersionNode) => {
      history.push(node.memory);

      // Find latest child
      const latestChild = node.children.find((child) => child.memory.is_latest);
      if (latestChild) {
        traverse(latestChild);
      }
    };

    traverse(tree);

    return history;
  }

  /**
   * Rollback to a specific version
   * - Marks target version as is_latest = true
   * - Marks all descendants as is_latest = false
   * - Creates audit log entry (Phase B)
   */
  async rollback(memoryId: string, targetVersion: number): Promise<void> {
    // Find memory with specified version
    const tree = await this.getVersionTree(memoryId);
    const targetMemory = this.findVersionInTree(tree, targetVersion);

    if (!targetMemory) {
      throw new Error(`Version ${targetVersion} not found in memory tree`);
    }

    // Mark target as latest
    await this.prisma.memoryEntry.update({
      where: { id: targetMemory.id },
      data: { is_latest: true },
    });

    // Mark all other versions in tree as not latest
    const allVersionIds = this.collectAllIds(tree);
    await this.prisma.memoryEntry.updateMany({
      where: {
        id: { in: allVersionIds.filter((id) => id !== targetMemory.id) },
      },
      data: { is_latest: false },
    });
  }

  /**
   * Find memory with specific version number in tree
   */
  private findVersionInTree(
    node: MemoryVersionNode,
    targetVersion: number
  ): MemoryEntry | null {
    if (node.memory.version === targetVersion) {
      return node.memory;
    }

    for (const child of node.children) {
      const found = this.findVersionInTree(child, targetVersion);
      if (found) return found;
    }

    return null;
  }

  /**
   * Collect all memory IDs in tree
   */
  private collectAllIds(node: MemoryVersionNode): string[] {
    const ids = [node.memory.id];
    for (const child of node.children) {
      ids.push(...this.collectAllIds(child));
    }
    return ids;
  }

  /**
   * Get latest version of a memory
   */
  async getLatestVersion(memoryId: string): Promise<MemoryEntry> {
    const history = await this.getVersionHistory(memoryId);
    return history[history.length - 1];
  }

  /**
   * Compare two versions (diff)
   * Returns changed fields
   */
  async compareVersions(
    versionAId: string,
    versionBId: string
  ): Promise<Record<string, any>> {
    const [versionA, versionB] = await Promise.all([
      this.prisma.memoryEntry.findUnique({ where: { id: versionAId } }),
      this.prisma.memoryEntry.findUnique({ where: { id: versionBId } }),
    ]);

    if (!versionA || !versionB) {
      throw new Error('One or both versions not found');
    }

    const diff: Record<string, any> = {};

    // Compare key fields
    const fieldsToCompare = ['content', 'confidence', 'metadata'];
    for (const field of fieldsToCompare) {
      if (JSON.stringify(versionA[field]) !== JSON.stringify(versionB[field])) {
        diff[field] = {
          before: versionA[field],
          after: versionB[field],
        };
      }
    }

    return diff;
  }

  /**
   * Delete version tree (cascade delete all versions)
   * Use with caution - this is destructive
   */
  async deleteVersionTree(memoryId: string): Promise<void> {
    const tree = await this.getVersionTree(memoryId);
    const allIds = this.collectAllIds(tree);

    // Delete all versions and their scores
    await this.prisma.$transaction([
      this.prisma.memoryScore.deleteMany({
        where: { memory_id: { in: allIds } },
      }),
      this.prisma.memoryEntry.deleteMany({
        where: { id: { in: allIds } },
      }),
    ]);
  }

  /**
   * Archive old versions (move to cold storage)
   * Keeps latest version + last N versions, archives the rest
   * Phase B feature - placeholder for now
   */
  async archiveOldVersions(
    memoryId: string,
    keepVersions: number = 5
  ): Promise<number> {
    const history = await this.getVersionHistory(memoryId);

    if (history.length <= keepVersions) {
      return 0; // Nothing to archive
    }

    const toArchive = history.slice(0, history.length - keepVersions);
    const archiveIds = toArchive.map((m) => m.id);

    // TODO Phase B: Move to S3/R2 cold storage instead of deleting
    // For now, just mark as archived in metadata
    await this.prisma.memoryEntry.updateMany({
      where: { id: { in: archiveIds } },
      data: {
        metadata: {
          archived: true,
          archived_at: new Date().toISOString(),
        },
      },
    });

    return archiveIds.length;
  }
}
