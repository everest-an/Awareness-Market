/**
 * Memory Package Builder
 * 
 * Builds .memorypkg files containing:
 * - KV-Cache (keys + values)
 * - W-Matrix (for cross-model transformation)
 * - Metadata
 * - Provenance
 */

import {
  BasePackageBuilder,
  type WMatrixData,
  type PackageMetadata,
  type PackageProvenance,
  type ValidationResult,
} from './base-package-builder';
import type { KVCache } from './kv-cache-compressor';
import type { CompressedKVCache } from './kv-cache-compressor-production';

// ============================================================================
// Memory Package Types
// ============================================================================

export interface MemoryPackageData {
  kvCache: KVCache | CompressedKVCache;
  wMatrix: WMatrixData;
  metadata: PackageMetadata;
  provenance: PackageProvenance;
  // Additional memory-specific metadata
  tokenCount: number;
  compressionRatio: number;
  contextDescription: string;
}

export interface MemoryPackageFiles {
  'kv_cache/keys.json': Buffer;
  'kv_cache/values.json': Buffer;
  'kv_cache/metadata.json': Buffer;
  'w_matrix/weights.json': Buffer;
  'w_matrix/biases.json': Buffer;
  'w_matrix/config.json': Buffer;
  'metadata.json': Buffer;
  'provenance.json': Buffer;
}

// ============================================================================
// Memory Package Builder
// ============================================================================

export class MemoryPackageBuilder extends BasePackageBuilder {
  constructor() {
    super('memory');
  }

  /**
   * Create a complete Memory Package
   */
  async createPackage(data: MemoryPackageData): Promise<{
    packageBuffer: Buffer;
    packageUrl: string;
    kvCacheUrl: string;
    wMatrixUrl: string;
  }> {
    // Validate all components
    const kvValidation = this.validateKVCache(data.kvCache);
    if (!kvValidation.valid) {
      throw new Error(`KV-Cache validation failed: ${kvValidation.errors.join(', ')}`);
    }

    const wMatrixValidation = this.validateWMatrix(data.wMatrix);
    if (!wMatrixValidation.valid) {
      throw new Error(`W-Matrix validation failed: ${wMatrixValidation.errors.join(', ')}`);
    }

    const metadataValidation = this.validateMetadata(data.metadata);
    if (!metadataValidation.valid) {
      throw new Error(`Metadata validation failed: ${metadataValidation.errors.join(', ')}`);
    }

    // Get package files
    const files = await this.getPackageFiles(data);

    // Pack into ZIP
    const packageBuffer = await this.packToZip(files);

    // Upload to S3
    const packageId = data.metadata.packageId;
    const packageUrl = await this.uploadToS3(packageId, packageBuffer, 'memorypkg');

    // Upload individual components
    const kvCacheBuffer = Buffer.from(JSON.stringify({
      keys: data.kvCache.keys,
      values: data.kvCache.values,
    }));
    const kvCacheUrl = await this.uploadFileToS3(
      packageId,
      'kv_cache.json',
      kvCacheBuffer,
      'application/json'
    );

    const wMatrixBuffer = Buffer.from(this.serializeWMatrix(data.wMatrix));
    const wMatrixUrl = await this.uploadFileToS3(
      packageId,
      'w_matrix.json',
      wMatrixBuffer,
      'application/json'
    );

    return {
      packageBuffer,
      packageUrl,
      kvCacheUrl,
      wMatrixUrl,
    };
  }

  /**
   * Extract Memory Package from buffer
   */
  async extractPackage(buffer: Buffer): Promise<MemoryPackageData> {
    const files = await this.unpackFromZip(buffer);
    return await this.extractPackageData(files);
  }

  // ========================================================================
  // Protected Methods (BasePackageBuilder implementation)
  // ========================================================================

  protected validatePackageData(data: MemoryPackageData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate KV-Cache
    const kvValidation = this.validateKVCache(data.kvCache);
    errors.push(...kvValidation.errors);
    warnings.push(...kvValidation.warnings);

    // Validate W-Matrix
    const wMatrixValidation = this.validateWMatrix(data.wMatrix);
    errors.push(...wMatrixValidation.errors);
    warnings.push(...wMatrixValidation.warnings);

    // Validate metadata
    const metadataValidation = this.validateMetadata(data.metadata);
    errors.push(...metadataValidation.errors);
    warnings.push(...metadataValidation.warnings);

    // Validate memory-specific fields
    if (data.tokenCount <= 0) {
      errors.push('Token count must be positive');
    }

    if (data.compressionRatio < 0 || data.compressionRatio > 1) {
      errors.push('Compression ratio must be between 0 and 1');
    }

    if (!data.contextDescription || data.contextDescription.length < 10) {
      warnings.push('Context description should be at least 10 characters for better discoverability');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  protected async getPackageFiles(data: MemoryPackageData): Promise<Record<string, Buffer>> {
    const files: Record<string, Buffer> = {};

    // KV-Cache files
    files['kv_cache/keys.json'] = Buffer.from(JSON.stringify(data.kvCache.keys, null, 2));
    files['kv_cache/values.json'] = Buffer.from(JSON.stringify(data.kvCache.values, null, 2));
    files['kv_cache/metadata.json'] = Buffer.from(JSON.stringify({
      tokenCount: data.tokenCount,
      compressionRatio: data.compressionRatio,
      contextDescription: data.contextDescription,
      attentionWeights: (data.kvCache as any).attentionWeights || null,
    }, null, 2));

    // W-Matrix files
    files['w_matrix/weights.json'] = Buffer.from(JSON.stringify(data.wMatrix.weights, null, 2));
    files['w_matrix/biases.json'] = Buffer.from(JSON.stringify(data.wMatrix.biases, null, 2));
    files['w_matrix/config.json'] = Buffer.from(this.serializeWMatrix(data.wMatrix));

    // Metadata and provenance
    files['metadata.json'] = Buffer.from(this.serializeMetadata(data.metadata));
    files['provenance.json'] = Buffer.from(this.serializeProvenance(data.provenance));

    return files;
  }

  protected async extractPackageData(files: Record<string, Buffer>): Promise<MemoryPackageData> {
    // Extract KV-Cache
    const keys = JSON.parse(files['kv_cache/keys.json'].toString());
    const values = JSON.parse(files['kv_cache/values.json'].toString());
    const kvMetadata = JSON.parse(files['kv_cache/metadata.json'].toString());

    const kvCache: KVCache = {
      keys,
      values,
      attentionWeights: kvMetadata.attentionWeights || undefined,
    };

    // Extract W-Matrix
    const wMatrix = this.deserializeWMatrix(files['w_matrix/config.json'].toString());

    // Extract metadata and provenance
    const metadata = this.deserializeMetadata(files['metadata.json'].toString());
    const provenance = this.deserializeProvenance(files['provenance.json'].toString());

    return {
      kvCache,
      wMatrix,
      metadata,
      provenance,
      tokenCount: kvMetadata.tokenCount,
      compressionRatio: kvMetadata.compressionRatio,
      contextDescription: kvMetadata.contextDescription,
    };
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Validate KV-Cache structure
   */
  private validateKVCache(kvCache: KVCache | CompressedKVCache): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!kvCache.keys || !Array.isArray(kvCache.keys)) {
      errors.push('KV-Cache keys must be an array');
      return { valid: false, errors, warnings };
    }

    if (!kvCache.values || !Array.isArray(kvCache.values)) {
      errors.push('KV-Cache values must be an array');
      return { valid: false, errors, warnings };
    }

    // Check keys and values have same structure
    if (kvCache.keys.length !== kvCache.values.length) {
      errors.push('KV-Cache keys and values must have same number of layers');
    }

    // Check each layer
    for (let i = 0; i < kvCache.keys.length; i++) {
      const keyLayer = kvCache.keys[i];
      const valueLayer = kvCache.values[i];

      if (!Array.isArray(keyLayer) || !Array.isArray(valueLayer)) {
        errors.push(`Layer ${i}: keys and values must be arrays`);
        continue;
      }

      if (keyLayer.length !== valueLayer.length) {
        errors.push(`Layer ${i}: keys and values must have same number of tokens`);
      }

      // Check token dimensions
      if (keyLayer.length > 0) {
        const keyDim = Array.isArray(keyLayer[0]) ? keyLayer[0].length : 0;
        const valueDim = Array.isArray(valueLayer[0]) ? valueLayer[0].length : 0;

        if (keyDim === 0 || valueDim === 0) {
          errors.push(`Layer ${i}: invalid token dimensions`);
        }
      }
    }

    // Warnings for large caches
    const totalTokens = kvCache.keys[0]?.length || 0;
    if (totalTokens > 10000) {
      warnings.push(`Large KV-Cache (${totalTokens} tokens) - consider compression`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a Memory Package from components
 */
export async function createMemoryPackage(
  kvCache: KVCache | CompressedKVCache,
  wMatrix: WMatrixData,
  options: {
    name: string;
    description: string;
    version: string;
    creator: { id: number; name: string };
    tokenCount: number;
    compressionRatio: number;
    contextDescription: string;
    trainingDataset: string;
  }
): Promise<{
  packageBuffer: Buffer;
  packageUrl: string;
  kvCacheUrl: string;
  wMatrixUrl: string;
  packageId: string;
}> {
  const builder = new MemoryPackageBuilder();
  const packageId = builder['generatePackageId']();

  const metadata: PackageMetadata = {
    packageId,
    packageType: 'memory',
    name: options.name,
    description: options.description,
    version: options.version,
    createdAt: new Date().toISOString(),
    creator: options.creator,
  };

  const certificationLevel = builder['createCertification'](wMatrix);

  const provenance: PackageProvenance = {
    trainingDataset: options.trainingDataset,
    certificationLevel,
    qualityMetrics: {
      epsilon: wMatrix.epsilon,
      informationRetention: 1 - wMatrix.epsilon,
    },
  };

  const packageData: MemoryPackageData = {
    kvCache,
    wMatrix,
    metadata,
    provenance,
    tokenCount: options.tokenCount,
    compressionRatio: options.compressionRatio,
    contextDescription: options.contextDescription,
  };

  const result = await builder.createPackage(packageData);

  return {
    ...result,
    packageId,
  };
}

/**
 * Extract a Memory Package
 */
export async function extractMemoryPackage(buffer: Buffer): Promise<MemoryPackageData> {
  const builder = new MemoryPackageBuilder();
  return await builder.extractPackage(buffer);
}
