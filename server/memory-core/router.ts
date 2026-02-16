/**
 * Memory Router (Control Plane Entry Point)
 *
 * Orchestrates all memory operations:
 * - Create, query, update, delete, archive memories
 * - Namespace resolution and access control
 * - Score calculation and caching
 * - Version management
 * - Vector storage coordination
 *
 * This is the main API that applications should use for memory management.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  MemoryEntry,
  MemoryQueryParams,
  MemoryQueryResult,
  CreateMemoryInput,
  UpdateMemoryInput,
  validateNamespace,
  DECAY_FACTORS,
} from './schema';
import { VectorStore } from './vector-store';
import { calculateMemoryScore, rerank, QueryContext, getMemoryTypeDecayFactor } from './scoring-engine';
import { VersionManager } from './version-manager';
import { EmbeddingService } from './embedding-service';
import { createLogger } from '../utils/logger';

const logger = createLogger('MemoryRouter');

export class MemoryRouter {
  private prisma: any;
  private vectorStore: VectorStore;
  private versionManager: VersionManager;
  private embeddingService: EmbeddingService;

  constructor(
    prisma: any,
    vectorStore: VectorStore,
    embeddingService: EmbeddingService
  ) {
    this.prisma = prisma;
    this.vectorStore = vectorStore;
    this.versionManager = new VersionManager(prisma);
    this.embeddingService = embeddingService;
  }

  /**
   * Create a new memory entry
   * - Validates namespace format
   * - Generates embedding if needed
   * - Calculates initial score
   * - Stores in both PostgreSQL and vector store
   */
  async create(input: CreateMemoryInput): Promise<string> {
    // Validate namespace
    if (!validateNamespace(input.namespace)) {
      throw new Error(
        `Invalid namespace format: ${input.namespace}. Expected: org-id/scope/entity`
      );
    }

    // ✅ P0-2: Check memory quota if organizationId is provided
    const organizationId = (input as any).organizationId || parseInt(input.org_id.split('-')[1]);
    if (organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { maxMemories: true, currentMemoryCount: true, planTier: true },
      });

      if (!org) {
        throw new Error('Organization not found');
      }

      if (org.currentMemoryCount >= org.maxMemories) {
        throw new Error(
          `Memory limit reached (${org.maxMemories}). Current plan: ${org.planTier}. Upgrade to add more memories.`
        );
      }
    }

    // Generate embedding
    let embedding: number[] | undefined;
    if (input.content_type === 'text' || input.content_type === 'code') {
      embedding = await this.embeddingService.generate(input.content);
    }

    // Determine decay factor — v3: memoryType overrides content_type defaults
    let decay_factor = input.decay_factor || DECAY_FACTORS[input.content_type];
    if (input.memoryType) {
      decay_factor = getMemoryTypeDecayFactor(input.memoryType);
    }

    // ✅ P0-2: Create memory entry + increment counter in transaction
    const memoryId = uuidv4();
    await this.prisma.$transaction(async (tx: any) => {
      // Create memory
      const memory = await tx.memoryEntry.create({
        data: {
          id: memoryId,
          org_id: input.org_id,
          namespace: input.namespace,
          content_type: input.content_type,
          content: input.content,
          embedding: embedding ? `[${embedding.join(',')}]` : null,
          metadata: input.metadata || {},
          confidence: input.confidence,
          reputation: 50, // Default initial reputation
          usage_count: 0,
          validation_count: 0,
          version: 1,
          parent_id: null,
          is_latest: true,
          created_by: input.created_by,
          expires_at: input.expires_at,
          decay_factor,
          decay_checkpoint: new Date(),
          // v3 fields
          ...(input.memoryType && { memoryType: input.memoryType }),
          ...(input.poolType && { poolType: input.poolType }),
          ...(input.departmentId && { department: String(input.departmentId) }),
          ...(input.agentId && { agentId: input.agentId }),
        },
      });

      // Calculate and store initial score
      const score = calculateMemoryScore(memory);
      await tx.memoryScore.create({
        data: {
          memory_id: memoryId,
          ...score,
        },
      });

      // ✅ P0-2: Increment organization memory counter
      if (organizationId) {
        await tx.organization.update({
          where: { id: organizationId },
          data: { currentMemoryCount: { increment: 1 } },
        });
      }
    });

    // v3: Attach evidence if provided (outside transaction - non-critical)
    if (input.evidence && input.evidence.length > 0) {
      try {
        for (const ev of input.evidence) {
          await this.prisma.evidence.create({
            data: {
              memoryId,
              evidenceType: ev.evidenceType,
              sourceUrl: ev.sourceUrl,
              sourceDoi: ev.sourceDoi,
              claimType: ev.claimType,
              assumptions: ev.assumptions || [],
              unit: ev.unit,
              dimension: ev.dimension,
            },
          });
        }
        logger.info(`[MemoryRouter] Attached ${input.evidence.length} evidence items to ${memoryId}`);
      } catch (err: unknown) {
        logger.warn(`[MemoryRouter] Evidence attachment failed for ${memoryId}: ${err}`);
      }
    }

    // v3: Create dependencies if provided (outside transaction - non-critical)
    if (input.dependencies && input.dependencies.length > 0) {
      try {
        for (const dep of input.dependencies) {
          await this.prisma.memoryDependency.create({
            data: {
              sourceMemoryId: memoryId,
              dependsOnMemoryId: dep.dependsOnMemoryId,
              dependencyType: dep.dependencyType,
            },
          });
        }
        logger.info(`[MemoryRouter] Created ${input.dependencies.length} dependencies for ${memoryId}`);
      } catch (err: unknown) {
        logger.warn(`[MemoryRouter] Dependency creation failed for ${memoryId}: ${err}`);
      }
    }

    logger.info(`[MemoryRouter] Created memory ${memoryId} in ${input.namespace}`);

    // ✅ RMC: Trigger async entity extraction and relation building
    this.processRMCAsync(memoryId, input).catch((err) => {
      logger.error(`[RMC] Failed to process memory ${memoryId}:`, err);
    });

    return memoryId;
  }

  /**
   * RMC: Async entity extraction and relation building (non-blocking)
   */
  private async processRMCAsync(memoryId: string, input: CreateMemoryInput): Promise<void> {
    try {
      // Import RMC modules dynamically to avoid circular dependencies
      const { createEntityExtractor, createRelationBuilder } = await import('./index');

      // 1. Extract entities
      const extractor = createEntityExtractor();

      const extractionResult = await extractor.extract(input.content);

      // 2. Create EntityTags and link to memory
      const entityTags = await Promise.all(
        extractionResult.entities.map(async (entity: any) => {
          const normalizedName = entity.name.toLowerCase().replace(/\s+/g, '_');

          return await this.prisma.entityTag.upsert({
            where: {
              normalizedName_type: {
                normalizedName,
                type: entity.type,
              },
            },
            update: {
              mentionCount: { increment: 1 },
              confidence: Math.max(entity.confidence, 0.5),
            },
            create: {
              name: entity.name,
              type: entity.type,
              normalizedName,
              confidence: entity.confidence,
              mentionCount: 1,
            },
          });
        })
      );

      // 3. Link EntityTags to Memory
      if (entityTags.length > 0) {
        await this.prisma.memoryEntry.update({
          where: { id: memoryId },
          data: {
            entityTags: {
              connect: entityTags.map((tag: any) => ({ id: tag.id })),
            },
          },
        });
        logger.info(`[RMC] Linked ${entityTags.length} entities to memory ${memoryId}`);
      }

      // 4. Build relations (with coarse filtering)
      const builder = createRelationBuilder(this.prisma);

      const relationsCount = await builder.buildRelations(memoryId);
      logger.info(`[RMC] Created ${relationsCount} relations for memory ${memoryId}`);
    } catch (error) {
      logger.error(`[RMC] Async processing failed for memory ${memoryId}:`, error as any);
      // Don't throw - memory is already created
    }
  }

  /**
   * Query memories using semantic search + filtering
   * - Converts query to embedding
   * - Performs vector similarity search
   * - Filters by namespace, confidence, etc.
   * - Re-ranks by combined score (similarity + quality)
   * - Returns top results
   */
  async query(params: MemoryQueryParams): Promise<MemoryQueryResult[]> {
    const {
      org_id,
      namespaces,
      query,
      limit = 10,
      min_confidence = 0,
      min_score = 0,
      content_types,
      created_after,
      created_before,
    } = params;

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generate(query);

    // Vector similarity search (broader limit for re-ranking)
    const vectorResults = await this.vectorStore.search(
      queryEmbedding,
      limit * 3, // Fetch 3x more for re-ranking
      {
        org_id,
        is_latest: true,
      }
    );

    // Fetch full memory entries with scores
    const memoryIds = vectorResults.map((r) => r.id);
    const memories = await this.prisma.memoryEntry.findMany({
      where: {
        id: { in: memoryIds },
        namespace: { in: namespaces },
        confidence: { gte: min_confidence },
        ...(content_types && { content_type: { in: content_types } }),
        ...(created_after && { created_at: { gte: created_after } }),
        ...(created_before && { created_at: { lte: created_before } }),
      },
      include: {
        score: true,
      },
    });

    // Build results with similarity scores
    const results = memories.map((memory: any) => {
      const vectorResult = vectorResults.find((r) => r.id === memory.id);
      return {
        memory,
        score: memory.score?.final_score || 0,
        similarity: vectorResult?.similarity || 0,
      };
    });

    // Re-rank by combined score (第1阶段: User formula - similarity 只是 40%)
    const reranked = rerank(results, {
      similarity_weight: 0.4, // User spec: similarity is only 40%
      score_weight: 0.6, // User spec: quality is 60%
      recency_boost: false, // Disabled - time decay already handles recency
    });

    // Filter by min_score and limit
    const filtered = reranked.filter((r) => r.score >= min_score).slice(0, limit);

    // Update access timestamps and usage counts
    await this.updateAccessMetrics(filtered.map((r) => r.memory.id));

    logger.info(
      `[MemoryRouter] Query returned ${filtered.length} results for "${query}"`
    );

    return filtered;
  }

  /**
   * Update a memory (creates new version)
   */
  async update(
    memoryId: string,
    update: UpdateMemoryInput,
    updatedBy: string
  ): Promise<string> {
    const newVersionId = await this.versionManager.createVersion(
      memoryId,
      update,
      updatedBy
    );

    // Regenerate embedding if content changed
    if (update.content) {
      const newMemory = await this.prisma.memoryEntry.findUnique({
        where: { id: newVersionId },
      });

      if (newMemory.content_type === 'text' || newMemory.content_type === 'code') {
        const embedding = await this.embeddingService.generate(update.content);
        await this.prisma.memoryEntry.update({
          where: { id: newVersionId },
          data: { embedding: `[${embedding.join(',')}]` },
        });
      }
    }

    // Calculate score for new version
    const newMemory = await this.prisma.memoryEntry.findUnique({
      where: { id: newVersionId },
    });
    const score = calculateMemoryScore(newMemory);
    await this.prisma.memoryScore.create({
      data: {
        memory_id: newVersionId,
        ...score,
      },
    });

    logger.info(`[MemoryRouter] Updated memory ${memoryId} → new version ${newVersionId}`);

    return newVersionId;
  }

  /**
   * Delete a memory (soft delete - marks as deleted, can be recovered)
   */
  async delete(memoryId: string): Promise<void> {
    // Mark as deleted (set expires_at to now)
    await this.prisma.memoryEntry.update({
      where: { id: memoryId },
      data: {
        expires_at: new Date(),
        is_latest: false,
      },
    });

    logger.info(`[MemoryRouter] Soft deleted memory ${memoryId}`);
  }

  /**
   * Archive a memory (permanent deletion)
   * Use with caution - this is destructive
   */
  async archive(memoryId: string): Promise<void> {
    await this.versionManager.deleteVersionTree(memoryId);

    logger.warn(`[MemoryRouter] Archived (hard deleted) memory ${memoryId}`);
  }

  /**
   * Increment reputation score
   */
  async incrementReputation(memoryId: string, delta: number): Promise<void> {
    const memory = await this.prisma.memoryEntry.findUnique({
      where: { id: memoryId },
    });

    const newReputation = Math.max(0, Math.min(100, memory.reputation + delta));

    await this.prisma.memoryEntry.update({
      where: { id: memoryId },
      data: { reputation: newReputation },
    });

    // Recalculate score
    const updatedMemory = await this.prisma.memoryEntry.findUnique({
      where: { id: memoryId },
    });
    const score = calculateMemoryScore(updatedMemory);
    await this.prisma.memoryScore.update({
      where: { memory_id: memoryId },
      data: score,
    });
  }

  /**
   * Mark memory as validated
   */
  async markValidated(memoryId: string): Promise<void> {
    await this.prisma.memoryEntry.update({
      where: { id: memoryId },
      data: { validation_count: { increment: 1 } },
    });

    // Recalculate score
    const memory = await this.prisma.memoryEntry.findUnique({
      where: { id: memoryId },
    });
    const score = calculateMemoryScore(memory);
    await this.prisma.memoryScore.update({
      where: { memory_id: memoryId },
      data: score,
    });
  }

  /**
   * Update access timestamps and usage counts
   */
  private async updateAccessMetrics(memoryIds: string[]): Promise<void> {
    await this.prisma.memoryEntry.updateMany({
      where: { id: { in: memoryIds } },
      data: {
        accessed_at: new Date(),
        usage_count: { increment: 1 },
      },
    });

    // Recalculate scores asynchronously (don't block query response)
    setTimeout(() => this.recalculateScores(memoryIds), 0);
  }

  /**
   * Recalculate scores for memories (background job)
   */
  private async recalculateScores(memoryIds: string[]): Promise<void> {
    try {
      const memories = await this.prisma.memoryEntry.findMany({
        where: { id: { in: memoryIds } },
      });

      for (const memory of memories) {
        const score = calculateMemoryScore(memory);
        await this.prisma.memoryScore.update({
          where: { memory_id: memory.id },
          data: score,
        });
      }
    } catch (error) {
      logger.error('[MemoryRouter] Failed to recalculate scores:', error as any);
    }
  }

  /**
   * Batch create memories (optimized for bulk operations)
   */
  async batchCreate(inputs: CreateMemoryInput[]): Promise<string[]> {
    const memoryIds: string[] = [];

    // TODO: Optimize with bulk embeddings + bulk database insert
    for (const input of inputs) {
      const id = await this.create(input);
      memoryIds.push(id);
    }

    return memoryIds;
  }

  /**
   * Get memory by ID
   */
  async get(memoryId: string): Promise<MemoryEntry | null> {
    return this.prisma.memoryEntry.findUnique({
      where: { id: memoryId },
      include: { score: true },
    });
  }

  /**
   * List memories by namespace
   */
  async listByNamespace(
    orgId: string,
    namespace: string,
    limit: number = 50
  ): Promise<MemoryEntry[]> {
    return this.prisma.memoryEntry.findMany({
      where: {
        org_id: orgId,
        namespace,
        is_latest: true,
      },
      include: { score: true },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }
}
