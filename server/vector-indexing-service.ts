/**
 * Vector Indexing Service
 *
 * Integrates vector database with package upload/update workflows.
 * Automatically indexes vectors when packages are created or updated.
 */

import { getVectorDatabaseService, type VectorMetadata } from './vector-database';
import type { Package, PackageType } from '../drizzle/schema';

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
        packageType: collectionType,
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

      console.log(`✅ Indexed package ${pkg.id} in ${collectionType} collection`);

      return { packageId: pkg.id, indexed: true };
    } catch (error) {
      console.error(`❌ Failed to index package ${pkg.id}:`, error);
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

        console.log(`✅ Batch indexed ${vectors.length} packages in ${collectionType}`);

        results.push(
          ...pkgs.map(pkg => ({
            packageId: pkg.id,
            indexed: true,
          }))
        );
      } catch (error) {
        console.error(`❌ Failed to batch index ${collectionType}:`, error);
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
      console.log(`✅ Updated metadata for package ${packageId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update metadata for ${packageId}:`, error);
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
      console.log(`✅ Removed package ${packageId} from index`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to remove package ${packageId}:`, error);
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
    const filter: any = { must: [] };

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
    const filter: any = options.tags
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

      console.warn(`Unknown vector data format for package ${pkg.id}`);
      return null;
    } catch (error) {
      console.error(`Failed to parse vector data for ${pkg.id}:`, error);
      return null;
    }
  }

  /**
   * Create average embedding from KV-Cache (simplified)
   */
  private createAverageEmbedding(kvCache: any): number[] | null {
    try {
      // This is a placeholder - actual implementation would:
      // 1. Extract key/value tensors
      // 2. Compute mean pooling
      // 3. Normalize to unit vector

      // For now, return null to indicate this needs proper implementation
      console.warn('KV-Cache average embedding not yet implemented');
      return null;
    } catch (error) {
      console.error('Failed to create average embedding:', error);
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
    console.error(`Package ${pkg.id} was not indexed: ${result.error}`);
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
