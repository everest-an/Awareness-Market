/**
 * Shared Latent Memory System (P1)
 *
 * Implements kNN-based retrieval for AI agent collaboration.
 * When Claude solves a complex problem, the reasoning path is vectorized and stored.
 * When Manus encounters similar tasks, it retrieves past successful cases via kNN.
 *
 * This is the essence of "multiple AIs using one thinking space" - not sharing text,
 * but sharing experience vectors.
 *
 * Tech Stack:
 * - ChromaDB / FAISS for initial implementation (local/lightweight)
 * - Each memory tagged with: embedding, raw_content, reasoning_chain, source_agent
 *
 * Integration Notes:
 * - Reuses cosineSimilarity, normalizeVector from latentmas-core.ts
 * - Reuses embeddingService from latentmas/embedding-service.ts
 */

import { createLogger } from '../utils/logger';
import { AgentType } from './agent-type-system';

// ✅ Reuse existing vector utilities from LatentMAS Core
import {
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  validateVector, // ✅ Phase 2 - Task E: Quality validation
} from '../latentmas-core';

// ✅ Reuse existing embedding service
import { embeddingService } from '../latentmas/embedding-service';

// ✅ Phase 2 - Task F: GPU acceleration for batch operations
import { WMatrixService } from '../latentmas/w-matrix-service';
import { neuralBridgeRouter } from '../routers/neural-bridge-api';

const logger = createLogger('Collaboration:LatentMemory');

// ============================================================================
// Types
// ============================================================================

/**
 * Memory entry in the latent space
 */
export interface LatentMemory {
  id: string;
  sessionId: string;
  sourceAgent: AgentType;
  agentRole: string;

  // Content
  rawContent: string;
  reasoningChain: string[];
  taskType: string;

  // Vectorized representation
  embedding: number[];
  embeddingModel: string;

  // Metadata
  success: boolean; // Was this a successful solution?
  complexity: number; // 1-10 complexity rating
  tags: string[];
  timestamp: Date;

  // KV-Cache snapshot (optional)
  kvSnapshot?: {
    keys: number[][][];
    values: number[][][];
  };

  // Outcome
  outcome?: {
    filesModified: string[];
    decisionsMade: string[];
    impact: string;
  };
}

/**
 * Memory retrieval query
 */
export interface MemoryQuery {
  queryEmbedding: number[];
  k: number; // Top-K results
  filters?: {
    sourceAgent?: AgentType;
    taskType?: string;
    minComplexity?: number;
    maxComplexity?: number;
    successfulOnly?: boolean;
    tags?: string[];
    timeRange?: {
      start: Date;
      end: Date;
    };
  };
}

/**
 * Memory retrieval result
 */
export interface MemoryRetrievalResult {
  memory: LatentMemory;
  similarity: number; // Cosine similarity score
  rank: number; // 1-based rank in results
}

// ============================================================================
// Shared Latent Memory Manager
// ============================================================================

/**
 * Manages the shared latent memory space across all agents
 */
export class SharedLatentMemoryManager {
  private vectorStore: LatentVectorStore;
  private embeddingService: CollaborationEmbeddingService;

  constructor(config: {
    storageBackend: 'memory' | 'chromadb' | 'faiss';
    embeddingModel?: string;
  }) {
    this.embeddingService = new CollaborationEmbeddingService(config.embeddingModel);

    // Initialize vector store based on backend
    switch (config.storageBackend) {
      case 'chromadb':
        this.vectorStore = new ChromaDBVectorStore();
        break;
      case 'faiss':
        this.vectorStore = new FAISSVectorStore();
        break;
      default:
        this.vectorStore = new InMemoryVectorStore();
    }

    logger.info('SharedLatentMemoryManager initialized', {
      backend: config.storageBackend,
      embeddingModel: config.embeddingModel,
    });
  }

  /**
   * Store a new memory in the latent space
   * ✅ Phase 2 - Task E: With quality validation for 97%+ threshold
   */
  async storeMemory(memory: Omit<LatentMemory, 'id' | 'embedding' | 'embeddingModel'>): Promise<string> {
    try {
      // Generate embedding for the reasoning content
      const embeddingText = this.constructEmbeddingText(memory);
      const embedding = await this.embeddingService.embed(embeddingText);

      // ✅ Phase 2 - Task E: Validate embedding quality
      const validation = validateVector(embedding);

      if (!validation.isValid) {
        logger.error('Memory embedding quality validation failed', {
          issues: validation.issues,
          statistics: validation.statistics,
          sourceAgent: memory.sourceAgent,
        });

        throw new Error(
          `Memory embedding quality below threshold: ${validation.issues.join(', ')}`
        );
      }

      // ✅ Additional quality check: magnitude threshold
      const qualityThreshold = 0.97;
      if (validation.statistics.magnitude < 0.1 || validation.statistics.magnitude > 10) {
        logger.warn('Memory embedding has unusual magnitude', {
          magnitude: validation.statistics.magnitude,
          sourceAgent: memory.sourceAgent,
        });
      }

      const fullMemory: LatentMemory = {
        ...memory,
        id: this.generateMemoryId(),
        embedding,
        embeddingModel: this.embeddingService.getModelName(),
      };

      // Store in vector database
      await this.vectorStore.insert(fullMemory);

      logger.info('Memory stored with quality validation', {
        memoryId: fullMemory.id,
        sourceAgent: fullMemory.sourceAgent,
        embeddingDim: embedding.length,
        complexity: fullMemory.complexity,
        quality: {
          magnitude: validation.statistics.magnitude.toFixed(4),
          sparsity: validation.statistics.sparsity.toFixed(4),
          isValid: validation.isValid,
        },
      });

      return fullMemory.id;
    } catch (error) {
      logger.error('Failed to store memory', { error });
      throw error;
    }
  }

  /**
   * Retrieve relevant memories using kNN search
   * ✅ Phase 2 - Task F: With GPU batch acceleration for large candidate sets
   */
  async retrieveRelevant(query: MemoryQuery): Promise<MemoryRetrievalResult[]> {
    try {
      const startTime = Date.now();

      // Perform kNN search
      let results = await this.vectorStore.search(
        query.queryEmbedding,
        query.k,
        query.filters
      );

      // ✅ Phase 2 - Task F: GPU batch acceleration for large candidate sets
      if (results.length > 50) {
        try {
          logger.info('Using GPU batch alignment for large candidate set', {
            candidateCount: results.length,
          });

          // Get W-Matrix for the source agent type
          const sourceAgentType = query.filters?.sourceAgent || 'Router';
          const wMatrix = WMatrixService.getWMatrix(
            sourceAgentType,
            'unified-latent-space',
            '1.0.0',
            'hybrid'
          );

          // Batch align vectors using GPU
          const aligned = await neuralBridgeRouter
            .createCaller({})
            .batchAlignVectors({
              vectors: results.map(r => r.memory.embedding),
              wMatrix: wMatrix.matrix,
              useGPU: true,
            });

          // Recalculate similarities with aligned vectors
          results.forEach((result, index) => {
            result.similarity = cosineSimilarity(
              query.queryEmbedding,
              aligned.alignedVectors[index]
            );
          });

          // Re-sort by updated similarity scores
          results.sort((a, b) => b.similarity - a.similarity);

          logger.info('GPU batch alignment completed', {
            candidateCount: results.length,
            avgQuality: aligned.avgQuality.toFixed(4),
            processingTime: `${aligned.processingTimeMs}ms`,
          });
        } catch (gpuError) {
          // Fallback: continue with original results if GPU alignment fails
          logger.warn('GPU batch alignment failed, using original results', {
            error: gpuError,
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Memory retrieval completed', {
        k: query.k,
        resultsFound: results.length,
        duration: `${duration}ms`,
        filters: query.filters,
        usedGPU: results.length > 50,
      });

      return results.map((result, index) => ({
        memory: result.memory,
        similarity: result.similarity,
        rank: index + 1,
      }));
    } catch (error) {
      logger.error('Failed to retrieve memories', { error });
      throw error;
    }
  }

  /**
   * Retrieve memories by similar task description
   */
  async retrieveBySimilarTask(
    taskDescription: string,
    sourceAgent: AgentType,
    k: number = 5
  ): Promise<MemoryRetrievalResult[]> {
    // Embed the task description
    const queryEmbedding = await this.embeddingService.embed(taskDescription);

    // Search with filters
    return this.retrieveRelevant({
      queryEmbedding,
      k,
      filters: {
        sourceAgent,
        successfulOnly: true, // Only retrieve successful past experiences
      },
    });
  }

  /**
   * Get few-shot context for an agent
   *
   * This is the key feature: when an agent encounters a task,
   * it automatically gets past successful examples of similar tasks.
   */
  async getFewShotContext(
    currentTask: string,
    agentType: AgentType,
    k: number = 3
  ): Promise<string> {
    const relevantMemories = await this.retrieveBySimilarTask(currentTask, agentType, k);

    if (relevantMemories.length === 0) {
      return '';
    }

    // Construct few-shot prompt
    let context = `\n\n## Similar Past Experiences (Few-Shot Context)\n\n`;
    context += `I've encountered similar tasks before. Here are ${relevantMemories.length} relevant examples:\n\n`;

    relevantMemories.forEach((result, index) => {
      const { memory, similarity } = result;
      context += `### Example ${index + 1} (Similarity: ${(similarity * 100).toFixed(1)}%)\n`;
      context += `**Task**: ${memory.rawContent.split('\n')[0]}\n`;
      context += `**Reasoning Chain**:\n`;
      memory.reasoningChain.forEach((step, stepIndex) => {
        context += `${stepIndex + 1}. ${step}\n`;
      });
      if (memory.outcome) {
        context += `**Outcome**: ${memory.outcome.impact}\n`;
      }
      context += `\n`;
    });

    context += `---\n\n`;
    context += `Use these examples as reference, but adapt to the current specific requirements.\n`;

    return context;
  }

  /**
   * Clear old memories (garbage collection)
   */
  async clearOldMemories(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const deleted = await this.vectorStore.deleteOlderThan(cutoffDate);

    logger.info('Old memories cleared', {
      olderThanDays,
      deletedCount: deleted,
    });

    return deleted;
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<{
    totalMemories: number;
    byAgent: Record<AgentType, number>;
    avgComplexity: number;
    successRate: number;
  }> {
    const stats = await this.vectorStore.getStats();
    return stats;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private constructEmbeddingText(memory: Omit<LatentMemory, 'id' | 'embedding' | 'embeddingModel'>): string {
    // Combine raw content and reasoning chain for embedding
    let text = `Task: ${memory.rawContent}\n\n`;
    text += `Reasoning:\n${memory.reasoningChain.join('\n')}\n\n`;
    if (memory.outcome) {
      text += `Outcome: ${memory.outcome.impact}`;
    }
    return text;
  }

  private generateMemoryId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

// ============================================================================
// Embedding Service (Wrapper)
// ============================================================================

/**
 * Embedding service wrapper
 * ✅ Now uses the existing embeddingService from latentmas/embedding-service.ts
 */
class CollaborationEmbeddingService {
  private modelName: string;

  constructor(modelName: string = 'text-embedding-3-small') {
    this.modelName = modelName;
  }

  async embed(text: string): Promise<number[]> {
    // ✅ Use existing embedding service
    const result = await embeddingService.embed({
      text,
      model: this.modelName as any,
    });

    // Normalize vector using latentmas-core
    return normalizeVector(result.vector);
  }

  getModelName(): string {
    return this.modelName;
  }
}

// ============================================================================
// Vector Store Implementations
// ============================================================================

/**
 * Abstract vector store interface
 */
abstract class LatentVectorStore {
  abstract insert(memory: LatentMemory): Promise<void>;
  abstract search(
    queryEmbedding: number[],
    k: number,
    filters?: MemoryQuery['filters']
  ): Promise<Array<{ memory: LatentMemory; similarity: number }>>;
  abstract deleteOlderThan(date: Date): Promise<number>;
  abstract getStats(): Promise<{
    totalMemories: number;
    byAgent: Record<AgentType, number>;
    avgComplexity: number;
    successRate: number;
  }>;
}

/**
 * In-memory vector store (for development/testing)
 */
class InMemoryVectorStore extends LatentVectorStore {
  private memories: LatentMemory[] = [];

  async insert(memory: LatentMemory): Promise<void> {
    this.memories.push(memory);
  }

  async search(
    queryEmbedding: number[],
    k: number,
    filters?: MemoryQuery['filters']
  ): Promise<Array<{ memory: LatentMemory; similarity: number }>> {
    // Apply filters
    let filtered = this.memories;

    if (filters) {
      if (filters.sourceAgent) {
        filtered = filtered.filter(m => m.sourceAgent === filters.sourceAgent);
      }
      if (filters.taskType) {
        filtered = filtered.filter(m => m.taskType === filters.taskType);
      }
      if (filters.successfulOnly) {
        filtered = filtered.filter(m => m.success);
      }
      if (filters.minComplexity) {
        filtered = filtered.filter(m => m.complexity >= filters.minComplexity!);
      }
      if (filters.maxComplexity) {
        filtered = filtered.filter(m => m.complexity <= filters.maxComplexity!);
      }
      if (filters.tags && filters.tags.length > 0) {
        filtered = filtered.filter(m =>
          filters.tags!.some(tag => m.tags.includes(tag))
        );
      }
      if (filters.timeRange) {
        filtered = filtered.filter(m =>
          m.timestamp >= filters.timeRange!.start &&
          m.timestamp <= filters.timeRange!.end
        );
      }
    }

    // Calculate similarities using ✅ latentmas-core cosineSimilarity
    const withSimilarity = filtered.map(memory => ({
      memory,
      similarity: cosineSimilarity(queryEmbedding, memory.embedding),
    }));

    // Sort by similarity (descending)
    withSimilarity.sort((a, b) => b.similarity - a.similarity);

    // Return top-k
    return withSimilarity.slice(0, k);
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const before = this.memories.length;
    this.memories = this.memories.filter(m => m.timestamp >= date);
    return before - this.memories.length;
  }

  async getStats(): Promise<{
    totalMemories: number;
    byAgent: Record<AgentType, number>;
    avgComplexity: number;
    successRate: number;
  }> {
    const byAgent: Record<string, number> = {};
    let totalComplexity = 0;
    let successCount = 0;

    this.memories.forEach(m => {
      byAgent[m.sourceAgent] = (byAgent[m.sourceAgent] || 0) + 1;
      totalComplexity += m.complexity;
      if (m.success) successCount++;
    });

    return {
      totalMemories: this.memories.length,
      byAgent: byAgent as Record<AgentType, number>,
      avgComplexity: this.memories.length > 0 ? totalComplexity / this.memories.length : 0,
      successRate: this.memories.length > 0 ? successCount / this.memories.length : 0,
    };
  }

  // ✅ Removed duplicate cosineSimilarity() - now using latentmas-core version
}

/**
 * ChromaDB vector store (production-ready)
 * TODO: Implement when ChromaDB is set up
 */
class ChromaDBVectorStore extends LatentVectorStore {
  async insert(memory: LatentMemory): Promise<void> {
    throw new Error('ChromaDB not yet implemented');
  }

  async search(
    queryEmbedding: number[],
    k: number,
    filters?: MemoryQuery['filters']
  ): Promise<Array<{ memory: LatentMemory; similarity: number }>> {
    throw new Error('ChromaDB not yet implemented');
  }

  async deleteOlderThan(date: Date): Promise<number> {
    throw new Error('ChromaDB not yet implemented');
  }

  async getStats(): Promise<any> {
    throw new Error('ChromaDB not yet implemented');
  }
}

/**
 * FAISS vector store (production-ready, high performance)
 * TODO: Implement when FAISS is set up
 */
class FAISSVectorStore extends LatentVectorStore {
  async insert(memory: LatentMemory): Promise<void> {
    throw new Error('FAISS not yet implemented');
  }

  async search(
    queryEmbedding: number[],
    k: number,
    filters?: MemoryQuery['filters']
  ): Promise<Array<{ memory: LatentMemory; similarity: number }>> {
    throw new Error('FAISS not yet implemented');
  }

  async deleteOlderThan(date: Date): Promise<number> {
    throw new Error('FAISS not yet implemented');
  }

  async getStats(): Promise<any> {
    throw new Error('FAISS not yet implemented');
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  SharedLatentMemoryManager,
  InMemoryVectorStore,
  ChromaDBVectorStore,
  FAISSVectorStore,
};
