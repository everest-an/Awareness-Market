/**
 * Vector Indexing Service
 *
 * Integrates vector database with package upload/update workflows.
 * Automatically indexes vectors when packages are created or updated.
 */

import { getVectorDatabaseService, type VectorMetadata } from './vector-database';
import { createLogger } from './utils/logger';

const logger = createLogger('VectorIndexing');

// Package types used in the system
type PackageType = 'vector_package' | 'memory_package' | 'chain_package';

// ============================================================================
// Types
// ============================================================================

export interface IndexablePackage {
  id: string;
  type: PackageType;
  name: string;
  description: string;
  modelName: string;
  dimension: number;
  creatorId: number;
  epsilon?: number;
  qualityScore?: number;
  tags?: string[];
  vectorData?: string; // JSON stringified vector
  createdAt: Date;
}

export interface IndexingResult {
  packageId: string;
  indexed: boolean;
  error?: string;
}

// Qdrant filter types
interface QdrantFilterCondition {
  key: string;
  match?: { value?: unknown; any?: string[] };
  range?: { gte?: number; lte?: number };
}

interface QdrantFilter {
  must: QdrantFilterCondition[];
}

// ============================================================================
// Vector Indexing Service
// ============================================================================

export class VectorIndexingService {
  private vectorDB = getVectorDatabaseService();
  private enabled: boolean;

  constructor() {
    // Check if vector database is enabled
    this.enabled = process.env.ENABLE_VECTOR_DB !== 'false';

    if (!this.enabled) {
      console.warn('⚠️  Vector database indexing is disabled');
    }
  }

  /**
   * Index a package after upload
   */
  async indexPackage(pkg: IndexablePackage): Promise<IndexingResult> {
    if (!this.enabled) {
      return { packageId: pkg.id, indexed: false };
    }

    try {
      // Determine collection type based on package type
      const collectionType = this.getCollectionType(pkg.type);

      // Extract vector from package data
      const vector = this.extractVector(pkg);
      if (!vector) {
        return {
          packageId: pkg.id,
          indexed: false,
          error: 'No vector data found in package',
        };
      }

      // Build metadata
      const metadata: VectorMetadata = {
        packageId: pkg.id,
        packageType: collectionType === 'vectors' ? 'vector' : collectionType === 'memories' ? 'memory' : 'chain',
        modelName: pkg.modelName,
        dimension: pkg.dimension,
        createdAt: pkg.createdAt.toISOString(),
        creatorId: pkg.creatorId,
        epsilon: pkg.epsilon,
        qualityScore: pkg.qualityScore,
        tags: pkg.tags || [],
        description: pkg.description,
      };

      // Index the vector
      await this.vectorDB.indexVector(collectionType, pkg.id, vector, metadata);

      logger.info('Indexed package', { packageId: pkg.id, collection: collectionType });

      return { packageId: pkg.id, indexed: true };
    } catch (error) {
      logger.error('Failed to index package', { packageId: pkg.id, error });
      return {
        packageId: pkg.id,
        indexed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Index multiple packages in batch
   */
  async indexPackagesBatch(packages: IndexablePackage[]): Promise<IndexingResult[]> {
    if (!this.enabled) {
      return packages.map(pkg => ({ packageId: pkg.id, indexed: false }));
    }

    // Group packages by collection type
    const byCollection: Record<string, IndexablePackage[]> = {
      vectors: [],
      memories: [],
      chains: [],
    };

    for (const pkg of packages) {
      const collectionType = this.getCollectionType(pkg.type);
      byCollection[collectionType].push(pkg);
    }

    // Index each collection in batch
    const results: IndexingResult[] = [];

    for (const [collectionType, pkgs] of Object.entries(byCollection)) {
      if (pkgs.length === 0) continue;

      try {
        const vectors = pkgs
          .map(pkg => {
            const vector = this.extractVector(pkg);
            if (!vector) return null;

            const metadata: VectorMetadata = {
              packageId: pkg.id,
              packageType: collectionType as 'vector' | 'memory' | 'chain',
              modelName: pkg.modelName,
              dimension: pkg.dimension,
              createdAt: pkg.createdAt.toISOString(),
              creatorId: pkg.creatorId,
              epsilon: pkg.epsilon,
              qualityScore: pkg.qualityScore,
              tags: pkg.tags || [],
              description: pkg.description,
            };

            return {
              packageId: pkg.id,
              vector,
              metadata,
            };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null);

        await this.vectorDB.indexVectorsBatch(
          collectionType as 'vectors' | 'memories' | 'chains',
          vectors
        );

        logger.info('Batch indexed packages', { count: vectors.length, collection: collectionType });

        results.push(
          ...pkgs.map(pkg => ({
            packageId: pkg.id,
            indexed: true,
          }))
        );
      } catch (error) {
        logger.error('Failed to batch index', { collection: collectionType, error });
        results.push(
          ...pkgs.map(pkg => ({
            packageId: pkg.id,
            indexed: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }))
        );
      }
    }

    return results;
  }

  /**
   * Update package metadata in vector database
   */
  async updatePackageMetadata(
    packageId: string,
    packageType: PackageType,
    updates: Partial<VectorMetadata>
  ): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const collectionType = this.getCollectionType(packageType);
      await this.vectorDB.updateMetadata(collectionType, packageId, updates);
      logger.info('Updated metadata', { packageId });
      return true;
    } catch (error) {
      logger.error('Failed to update metadata', { packageId, error });
      return false;
    }
  }

  /**
   * Remove package from vector database
   */
  async removePackage(packageId: string, packageType: PackageType): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const collectionType = this.getCollectionType(packageType);
      await this.vectorDB.deleteVector(collectionType, packageId);
      logger.info('Removed package from index', { packageId });
      return true;
    } catch (error) {
      logger.error('Failed to remove package', { packageId, error });
      return false;
    }
  }

  /**
   * Semantic search for packages
   */
  async searchSimilarPackages(
    queryVector: number[],
    packageType: PackageType,
    options: {
      limit?: number;
      minScore?: number;
      tags?: string[];
      minQualityScore?: number;
      creatorId?: number;
    } = {}
  ) {
    if (!this.enabled) {
      throw new Error('Vector database is disabled');
    }

    const collectionType = this.getCollectionType(packageType);

    // Build filter
    const filter: QdrantFilter = { must: [] };

    if (options.tags && options.tags.length > 0) {
      filter.must.push({
        key: 'tags',
        match: { any: options.tags },
      });
    }

    if (options.minQualityScore !== undefined) {
      filter.must.push({
        key: 'qualityScore',
        range: { gte: options.minQualityScore },
      });
    }

    if (options.creatorId !== undefined) {
      filter.must.push({
        key: 'creatorId',
        match: { value: options.creatorId },
      });
    }

    // Search
    const results = await this.vectorDB.searchSimilar(collectionType, queryVector, {
      limit: options.limit || 10,
      minScore: options.minScore || 0.5,
      filter: filter.must.length > 0 ? filter : undefined,
    });

    return results;
  }

  /**
   * Get recommendations based on user's liked packages
   */
  async getRecommendations(
    packageType: PackageType,
    likedPackageIds: string[],
    dislikedPackageIds: string[] = [],
    options: {
      limit?: number;
      tags?: string[];
    } = {}
  ) {
    if (!this.enabled) {
      throw new Error('Vector database is disabled');
    }

    const collectionType = this.getCollectionType(packageType);

    // Build filter
    const filter: QdrantFilter | undefined = options.tags
      ? { must: [{ key: 'tags', match: { any: options.tags } }] }
      : undefined;

    const results = await this.vectorDB.recommend(
      collectionType,
      likedPackageIds,
      dislikedPackageIds,
      {
        limit: options.limit || 10,
        filter,
      }
    );

    return results;
  }

  /**
   * Check if vector database is enabled and healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) return false;
    return await this.vectorDB.healthCheck();
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Map package type to collection type
   */
  private getCollectionType(
    packageType: PackageType
  ): 'vectors' | 'memories' | 'chains' {
    switch (packageType) {
      case 'vector_package':
        return 'vectors';
      case 'memory_package':
        return 'memories';
      case 'chain_package':
        return 'chains';
      default:
        return 'vectors';
    }
  }

  /**
   * Extract vector from package data
   */
  private extractVector(pkg: IndexablePackage): number[] | null {
    if (!pkg.vectorData) return null;

    try {
      const data = JSON.parse(pkg.vectorData);

      // Handle different vector data formats
      if (Array.isArray(data)) {
        return data;
      }

      if (data.vector && Array.isArray(data.vector)) {
        return data.vector;
      }

      if (data.embedding && Array.isArray(data.embedding)) {
        return data.embedding;
      }

      // For memory packages, extract from KV-Cache
      if (data.keys && data.values) {
        // Create average embedding from KV-Cache
        // This is a simplified approach - production would use more sophisticated methods
        return this.createAverageEmbedding(data);
      }

      logger.warn(`Unknown vector data format for package ${pkg.id}`);
      return null;
    } catch (error) {
      logger.error(`Failed to parse vector data for ${pkg.id}`, { error });
      return null;
    }
  }

  /**
   * Create average embedding from KV-Cache (simplified)
   */
  private createAverageEmbedding(kvCache: unknown): number[] | null {
    try {
      const keys = (kvCache as { keys?: unknown }).keys;
      if (!Array.isArray(keys) || keys.length === 0) {
        logger.warn('KV-Cache average embedding: missing keys');
        return null;
      }

      const vectors: number[][] = [];

      const first = keys[0] as unknown;
      const is4D = Array.isArray(first)
        && Array.isArray((first as unknown[])[0])
        && Array.isArray((first as unknown[])[0] as unknown[])
        && Array.isArray(((first as unknown[])[0] as unknown[])[0]);

      if (is4D) {
        for (const layer of keys as unknown[][][][]) {
          for (const head of layer) {
            for (const token of head) {
              if (Array.isArray(token)) {
                vectors.push(token as number[]);
              }
            }
          }
        }
      } else {
        for (const layer of keys as unknown[][][]) {
          for (const token of layer) {
            if (Array.isArray(token)) {
              vectors.push(token as number[]);
            }
          }
        }
      }

      if (vectors.length === 0) {
        logger.warn('KV-Cache average embedding: empty vectors');
        return null;
      }

      const dimension = vectors[0].length;
      const meanVector = new Array(dimension).fill(0);

      for (const vec of vectors) {
        for (let i = 0; i < dimension; i++) {
          meanVector[i] += vec[i] / vectors.length;
        }
      }

      const norm = Math.sqrt(meanVector.reduce((sum, v) => sum + v * v, 0));
      if (norm === 0) return meanVector;
      return meanVector.map((v) => v / norm);
    } catch (error) {
      logger.error('Failed to create average embedding', { error });
      return null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalIndexingService: VectorIndexingService | null = null;

/**
 * Get or create global vector indexing service
 */
export function getVectorIndexingService(): VectorIndexingService {
  if (!globalIndexingService) {
    globalIndexingService = new VectorIndexingService();
  }
  return globalIndexingService;
}

/**
 * Hook: Index package after upload
 */
export async function onPackageUploaded(pkg: IndexablePackage): Promise<void> {
  const service = getVectorIndexingService();
  const result = await service.indexPackage(pkg);

  if (!result.indexed && result.error) {
    logger.error(`Package ${pkg.id} was not indexed`, { error: result.error });
    // Don't throw - indexing failures shouldn't block package upload
  }
}

/**
 * Hook: Update package metadata after edit
 */
export async function onPackageUpdated(
  packageId: string,
  packageType: PackageType,
  updates: Partial<VectorMetadata>
): Promise<void> {
  const service = getVectorIndexingService();
  await service.updatePackageMetadata(packageId, packageType, updates);
}

/**
 * Hook: Remove package from index after deletion
 */
export async function onPackageDeleted(
  packageId: string,
  packageType: PackageType
): Promise<void> {
  const service = getVectorIndexingService();
  await service.removePackage(packageId, packageType);
}
