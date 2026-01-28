/**
 * Vector Package Builder
 * 
 * Builds .vectorpkg files containing:
 * - Vector (static embedding)
 * - W-Matrix (for cross-model alignment)
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

// ============================================================================
// Vector Package Types
// ============================================================================

export interface VectorData {
  vector: number[];
  dimension: number;
  category: 'nlp' | 'vision' | 'audio' | 'multimodal' | 'other';
  performanceMetrics?: {
    accuracy?: number;
    f1Score?: number;
    latency?: number;
    [key: string]: unknown;
  };
}

export interface VectorPackageData {
  vector: VectorData;
  wMatrix: WMatrixData;
  metadata: PackageMetadata;
  provenance: PackageProvenance;
}

export interface VectorPackageFiles {
  'vector.json': Buffer;
  'w_matrix/weights.json': Buffer;
  'w_matrix/biases.json': Buffer;
  'w_matrix/config.json': Buffer;
  'metadata.json': Buffer;
  'provenance.json': Buffer;
}

// ============================================================================
// Vector Package Builder
// ============================================================================

export class VectorPackageBuilder extends BasePackageBuilder {
  constructor() {
    super('vector');
  }

  /**
   * Create a complete Vector Package
   */
  async createPackage(data: VectorPackageData): Promise<{
    packageBuffer: Buffer;
    packageUrl: string;
    vectorUrl: string;
    wMatrixUrl: string;
  }> {
    // Validate all components
    const vectorValidation = this.validateVector(data.vector);
    if (!vectorValidation.valid) {
      throw new Error(`Vector validation failed: ${vectorValidation.errors.join(', ')}`);
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
    const packageUrl = await this.uploadToS3(packageId, packageBuffer, 'vectorpkg');

    // Upload individual components
    const vectorBuffer = Buffer.from(JSON.stringify(data.vector));
    const vectorUrl = await this.uploadFileToS3(
      packageId,
      'vector.json',
      vectorBuffer,
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
      vectorUrl,
      wMatrixUrl,
    };
  }

  /**
   * Extract Vector Package from buffer
   */
  async extractPackage(buffer: Buffer): Promise<VectorPackageData> {
    const files = await this.unpackFromZip(buffer);
    return await this.extractPackageData(files);
  }

  // ========================================================================
  // Protected Methods (BasePackageBuilder implementation)
  // ========================================================================

  protected validatePackageData(data: VectorPackageData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate vector
    const vectorValidation = this.validateVector(data.vector);
    errors.push(...vectorValidation.errors);
    warnings.push(...vectorValidation.warnings);

    // Validate W-Matrix
    const wMatrixValidation = this.validateWMatrix(data.wMatrix);
    errors.push(...wMatrixValidation.errors);
    warnings.push(...wMatrixValidation.warnings);

    // Validate metadata
    const metadataValidation = this.validateMetadata(data.metadata);
    errors.push(...metadataValidation.errors);
    warnings.push(...metadataValidation.warnings);

    // Check dimension consistency
    if (data.vector.dimension !== data.wMatrix.sourceDimension) {
      errors.push(`Vector dimension (${data.vector.dimension}) must match W-Matrix source dimension (${data.wMatrix.sourceDimension})`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  protected async getPackageFiles(data: VectorPackageData): Promise<Record<string, Buffer>> {
    const files: Record<string, Buffer> = {};

    // Vector file
    files['vector.json'] = Buffer.from(JSON.stringify({
      vector: data.vector.vector,
      dimension: data.vector.dimension,
      category: data.vector.category,
      performanceMetrics: data.vector.performanceMetrics || {},
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

  protected async extractPackageData(files: Record<string, Buffer>): Promise<VectorPackageData> {
    // Extract vector
    const vectorData = JSON.parse(files['vector.json'].toString());
    const vector: VectorData = {
      vector: vectorData.vector,
      dimension: vectorData.dimension,
      category: vectorData.category,
      performanceMetrics: vectorData.performanceMetrics,
    };

    // Extract W-Matrix
    const wMatrix = this.deserializeWMatrix(files['w_matrix/config.json'].toString());

    // Extract metadata and provenance
    const metadata = this.deserializeMetadata(files['metadata.json'].toString());
    const provenance = this.deserializeProvenance(files['provenance.json'].toString());

    return {
      vector,
      wMatrix,
      metadata,
      provenance,
    };
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Validate vector data
   */
  private validateVector(vector: VectorData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!vector.vector || !Array.isArray(vector.vector)) {
      errors.push('Vector must be an array');
      return { valid: false, errors, warnings };
    }

    if (vector.vector.length === 0) {
      errors.push('Vector cannot be empty');
      return { valid: false, errors, warnings };
    }

    if (vector.dimension !== vector.vector.length) {
      errors.push(`Vector dimension (${vector.dimension}) must match vector length (${vector.vector.length})`);
    }

    // Check for valid numbers
    for (let i = 0; i < vector.vector.length; i++) {
      if (typeof vector.vector[i] !== 'number' || !isFinite(vector.vector[i])) {
        errors.push(`Vector contains invalid value at index ${i}`);
        break;
      }
    }

    // Check vector magnitude
    const magnitude = Math.sqrt(vector.vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) {
      errors.push('Vector magnitude is zero (all zeros)');
    } else if (magnitude < 0.1) {
      warnings.push(`Very small vector magnitude (${magnitude.toFixed(6)}) - may indicate normalization issues`);
    }

    // Warnings for large dimensions
    if (vector.dimension > 10000) {
      warnings.push(`Large vector dimension (${vector.dimension}) - consider dimensionality reduction`);
    }

    // Check category
    const validCategories = ['nlp', 'vision', 'audio', 'multimodal', 'other'];
    if (!validCategories.includes(vector.category)) {
      warnings.push(`Unknown category "${vector.category}" - recommend using one of: ${validCategories.join(', ')}`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a Vector Package from components
 */
export async function createVectorPackage(
  vector: VectorData,
  wMatrix: WMatrixData,
  options: {
    name: string;
    description: string;
    version: string;
    creator: { id: number; name: string };
    trainingDataset: string;
  }
): Promise<{
  packageBuffer: Buffer;
  packageUrl: string;
  vectorUrl: string;
  wMatrixUrl: string;
  packageId: string;
}> {
  const builder = new VectorPackageBuilder();
  const packageId = builder['generatePackageId']();

  const metadata: PackageMetadata = {
    packageId,
    packageType: 'vector',
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

  const packageData: VectorPackageData = {
    vector,
    wMatrix,
    metadata,
    provenance,
  };

  const result = await builder.createPackage(packageData);

  return {
    ...result,
    packageId,
  };
}

/**
 * Extract a Vector Package
 */
export async function extractVectorPackage(buffer: Buffer): Promise<VectorPackageData> {
  const builder = new VectorPackageBuilder();
  return await builder.extractPackage(buffer);
}
