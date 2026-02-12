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
  getDecayFactor,
} from './schema';
import { VectorStore } from './vector-store';
import { calculateMemoryScore, rerank, QueryContext } from './scoring-engine';
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

    // Generate embedding
    let embedding: number[] | undefined;
    if (input.content_type === 'text' || input.content_type === 'code') {
      embedding = await this.embeddingService.generate(input.content);
    }

    // Determine decay factor
    const decay_factor = input.decay_factor || getDecayFactor(input.content_type);

    // Create memory entry
    const memoryId = uuidv4();
    const memory = await this.prisma.memoryEntry.create({
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
      },
    });

    // Calculate and store initial score
    const score = calculateMemoryScore(memory);
    await this.prisma.memoryScore.create({
      data: {
        memory_id: memoryId,
        ...score,
      },
    });

    logger.info(`[MemoryRouter] Created memory ${memoryId} in ${input.namespace}`);

    return memoryId;
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
    const results = memories.map((memory) => {
      const vectorResult = vectorResults.find((r) => r.id === memory.id);
      return {
        memory,
        score: memory.score?.final_score || 0,
        similarity: vectorResult?.similarity || 0,
      };
    });

    // Re-rank by combined score
    const reranked = rerank(results, {
      similarity_weight: 0.7,
      score_weight: 0.3,
      recency_boost: true,
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
      logger.error('[MemoryRouter] Failed to recalculate scores:', error);
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

/**
 * Embedding Service Interface
 * Abstract away embedding generation (OpenAI, local, etc.)
 */
export interface EmbeddingService {
  generate(text: string): Promise<number[]>;
  batchGenerate(texts: string[]): Promise<number[][]>;
}

/**
 * OpenAI Embedding Service (default implementation)
 */
export class OpenAIEmbeddingService implements EmbeddingService {
  private apiKey: string;
  private model: string = 'text-embedding-3-small';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async batchGenerate(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }
}
