/**
 * Vector Database Service (Qdrant)
 *
 * Provides high-performance vector indexing and semantic search capabilities
 * for latent vectors, KV-Caches, and reasoning chains.
 *
 * Features:
 * - Approximate Nearest Neighbor (ANN) search
 * - Multi-tenancy support
 * - Metadata filtering
 * - Batch operations
 */

import { QdrantClient } from '@qdrant/js-client-rest';

// ============================================================================
// Types
// ============================================================================

export interface VectorMetadata {
  packageId: string;
  packageType: 'vector' | 'memory' | 'chain';
  modelName: string;
  dimension: number;
  createdAt: string;
  creatorId: number;
  epsilon?: number;
  qualityScore?: number;
  tags?: string[];
  description?: string;
  [key: string]: unknown; // Index signature for Qdrant compatibility
}

export interface SearchResult {
  packageId: string;
  score: number;
  metadata: VectorMetadata;
  vector?: number[];
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filter?: Record<string, any>;
  includeVector?: boolean;
  minScore?: number;
}

export interface CollectionConfig {
  name: string;
  dimension: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
  onDiskPayload?: boolean;
}

// ============================================================================
// Vector Database Service
// ============================================================================

export class VectorDatabaseService {
  private client: QdrantClient;
  private collections: Map<string, CollectionConfig> = new Map();

  constructor() {
    // Initialize Qdrant client
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const qdrantApiKey = process.env.QDRANT_API_KEY;

    this.client = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    });

    // Define collection configurations
    this.collections.set('vectors', {
      name: 'awareness_vectors',
      dimension: 4096, // Default for Llama-3
      distance: 'Cosine',
      onDiskPayload: true,
    });

    this.collections.set('memories', {
      name: 'awareness_memories',
      dimension: 4096,
      distance: 'Cosine',
      onDiskPayload: true,
    });

    this.collections.set('chains', {
      name: 'awareness_chains',
      dimension: 4096,
      distance: 'Cosine',
      onDiskPayload: true,
    });
  }

  /**
   * Initialize all collections
   */
  async initializeCollections(): Promise<void> {
    for (const [key, config] of this.collections) {
      try {
        // Check if collection exists
        const collections = await this.client.getCollections();
        const exists = collections.collections.some(c => c.name === config.name);

        if (!exists) {
          await this.client.createCollection(config.name, {
            vectors: {
              size: config.dimension,
              distance: config.distance,
            },
            optimizers_config: {
              default_segment_number: 2,
            },
            on_disk_payload: config.onDiskPayload,
          });

          console.log(`✅ Created collection: ${config.name}`);
        } else {
          console.log(`ℹ️  Collection already exists: ${config.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize collection ${config.name}:`, error);
        throw error;
      }
    }
  }

  /**
   * Index a single vector
   */
  async indexVector(
    collectionType: 'vectors' | 'memories' | 'chains',
    packageId: string,
    vector: number[],
    metadata: VectorMetadata
  ): Promise<void> {
    const config = this.collections.get(collectionType);
    if (!config) {
      throw new Error(`Unknown collection type: ${collectionType}`);
    }

    // Validate vector dimension
    if (vector.length !== config.dimension) {
      throw new Error(
        `Vector dimension mismatch: expected ${config.dimension}, got ${vector.length}`
      );
    }

    await this.client.upsert(config.name, {
      wait: true,
      points: [
        {
          id: packageId,
          vector: vector,
          payload: metadata,
        },
      ],
    });
  }

  /**
   * Index multiple vectors in batch
   */
  async indexVectorsBatch(
    collectionType: 'vectors' | 'memories' | 'chains',
    vectors: Array<{
      packageId: string;
      vector: number[];
      metadata: VectorMetadata;
    }>
  ): Promise<void> {
    const config = this.collections.get(collectionType);
    if (!config) {
      throw new Error(`Unknown collection type: ${collectionType}`);
    }

    const points = vectors.map(({ packageId, vector, metadata }) => {
      if (vector.length !== config.dimension) {
        throw new Error(
          `Vector dimension mismatch for ${packageId}: expected ${config.dimension}, got ${vector.length}`
        );
      }

      return {
        id: packageId,
        vector: vector,
        payload: metadata,
      };
    });

    // Batch insert (Qdrant handles large batches efficiently)
    await this.client.upsert(config.name, {
      wait: true,
      points: points,
    });
  }

  /**
   * Search for similar vectors
   */
  async searchSimilar(
    collectionType: 'vectors' | 'memories' | 'chains',
    queryVector: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const config = this.collections.get(collectionType);
    if (!config) {
      throw new Error(`Unknown collection type: ${collectionType}`);
    }

    const {
      limit = 10,
      offset = 0,
      filter,
      includeVector = false,
      minScore = 0.0,
    } = options;

    const searchResult = await this.client.search(config.name, {
      vector: queryVector,
      limit: limit,
      offset: offset,
      filter: filter,
      with_payload: true,
      with_vector: includeVector,
      score_threshold: minScore,
    });

    return searchResult.map(result => ({
      packageId: result.id as string,
      score: result.score,
      metadata: result.payload as VectorMetadata,
      vector: includeVector ? (result.vector as number[]) : undefined,
    }));
  }

  /**
   * Search by metadata filters only (no vector similarity)
   */
  async searchByMetadata(
    collectionType: 'vectors' | 'memories' | 'chains',
    filter: Record<string, any>,
    options: { limit?: number; offset?: number } = {}
  ): Promise<SearchResult[]> {
    const config = this.collections.get(collectionType);
    if (!config) {
      throw new Error(`Unknown collection type: ${collectionType}`);
    }

    const { limit = 10, offset = 0 } = options;

    const scrollResult = await this.client.scroll(config.name, {
      filter: filter,
      limit: limit,
      offset: offset,
      with_payload: true,
      with_vector: false,
    });

    return scrollResult.points.map(point => ({
      packageId: point.id as string,
      score: 1.0, // No similarity score for metadata-only search
      metadata: point.payload as VectorMetadata,
    }));
  }

  /**
   * Get a specific vector by ID
   */
  async getVector(
    collectionType: 'vectors' | 'memories' | 'chains',
    packageId: string,
    includeVector: boolean = false
  ): Promise<SearchResult | null> {
    const config = this.collections.get(collectionType);
    if (!config) {
      throw new Error(`Unknown collection type: ${collectionType}`);
    }

    const result = await this.client.retrieve(config.name, {
      ids: [packageId],
      with_payload: true,
      with_vector: includeVector,
    });

    if (result.length === 0) {
      return null;
    }

    const point = result[0];
    return {
      packageId: point.id as string,
      score: 1.0,
      metadata: point.payload as VectorMetadata,
      vector: includeVector ? (point.vector as number[]) : undefined,
    };
  }

  /**
   * Update vector metadata (without changing the vector itself)
   */
  async updateMetadata(
    collectionType: 'vectors' | 'memories' | 'chains',
    packageId: string,
    metadata: Partial<VectorMetadata>
  ): Promise<void> {
    const config = this.collections.get(collectionType);
    if (!config) {
      throw new Error(`Unknown collection type: ${collectionType}`);
    }

    await this.client.setPayload(config.name, {
      wait: true,
      payload: metadata,
      points: [packageId],
    });
  }

  /**
   * Delete a vector from the index
   */
  async deleteVector(
    collectionType: 'vectors' | 'memories' | 'chains',
    packageId: string
  ): Promise<void> {
    const config = this.collections.get(collectionType);
    if (!config) {
      throw new Error(`Unknown collection type: ${collectionType}`);
    }

    await this.client.delete(config.name, {
      wait: true,
      points: [packageId],
    });
  }

  /**
   * Delete multiple vectors by filter
   */
  async deleteByFilter(
    collectionType: 'vectors' | 'memories' | 'chains',
    filter: Record<string, any>
  ): Promise<void> {
    const config = this.collections.get(collectionType);
    if (!config) {
      throw new Error(`Unknown collection type: ${collectionType}`);
    }

    await this.client.delete(config.name, {
      wait: true,
      filter: filter,
    });
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(
    collectionType: 'vectors' | 'memories' | 'chains'
  ): Promise<{
    totalVectors: number;
    indexedVectors: number;
    dimension: number;
  }> {
    const config = this.collections.get(collectionType);
    if (!config) {
      throw new Error(`Unknown collection type: ${collectionType}`);
    }

    const info = await this.client.getCollection(config.name);

    return {
      totalVectors: info.points_count || 0,
      indexedVectors: info.indexed_vectors_count || 0,
      dimension: config.dimension,
    };
  }

  /**
   * Recommend similar vectors based on positive and negative examples
   */
  async recommend(
    collectionType: 'vectors' | 'memories' | 'chains',
    positiveIds: string[],
    negativeIds: string[] = [],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const config = this.collections.get(collectionType);
    if (!config) {
      throw new Error(`Unknown collection type: ${collectionType}`);
    }

    const { limit = 10, filter, minScore = 0.0 } = options;

    const recommendResult = await this.client.recommend(config.name, {
      positive: positiveIds,
      negative: negativeIds,
      limit: limit,
      filter: filter,
      with_payload: true,
      with_vector: false,
      score_threshold: minScore,
    });

    return recommendResult.map(result => ({
      packageId: result.id as string,
      score: result.score,
      metadata: result.payload as VectorMetadata,
    }));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      console.error('Qdrant health check failed:', error);
      return false;
    }
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    // Qdrant client doesn't need explicit close
    console.log('Vector database service closed');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalVectorDB: VectorDatabaseService | null = null;

/**
 * Get or create global vector database service
 */
export function getVectorDatabaseService(): VectorDatabaseService {
  if (!globalVectorDB) {
    globalVectorDB = new VectorDatabaseService();
  }
  return globalVectorDB;
}

/**
 * Initialize vector database (call on server startup)
 */
export async function initializeVectorDatabase(): Promise<void> {
  const service = getVectorDatabaseService();
  await service.initializeCollections();

  const healthy = await service.healthCheck();
  if (!healthy) {
    throw new Error('Vector database health check failed');
  }

  console.log('✅ Vector database initialized successfully');
}
