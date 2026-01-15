/**
 * Base Package Builder
 * 
 * Abstract base class for all package builders (Vector, Memory, Chain)
 * Provides common functionality for packaging, validation, and S3 upload
 */

import JSZip from 'jszip';
import { storagePut } from '../storage';
import { nanoid } from 'nanoid';
import type { TrainingResult } from './w-matrix-trainer';
import { QualityCertifier, type CertificationLevel } from './w-matrix-protocol';

// ============================================================================
// Common Types
// ============================================================================

export interface WMatrixData {
  weights: number[][];
  biases: number[];
  epsilon: number;
  orthogonalityScore?: number;
  trainingAnchors?: number;
  sourceModel: string;
  targetModel: string;
  sourceDimension: number;
  targetDimension: number;
}

export interface PackageMetadata {
  packageId: string;
  packageType: 'vector' | 'memory' | 'chain';
  name: string;
  description: string;
  version: string;
  createdAt: string;
  creator: {
    id: number;
    name: string;
  };
}

export interface PackageProvenance {
  trainingDataset: string;
  certificationLevel: CertificationLevel;
  qualityMetrics: {
    epsilon: number;
    cosineSimilarity?: number;
    euclideanDistance?: number;
    informationRetention: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Base Package Builder
// ============================================================================

export abstract class BasePackageBuilder {
  protected packageType: 'vector' | 'memory' | 'chain';

  constructor(packageType: 'vector' | 'memory' | 'chain') {
    this.packageType = packageType;
  }

  // ========================================================================
  // Abstract Methods (must be implemented by subclasses)
  // ========================================================================

  /**
   * Validate package-specific data
   */
  protected abstract validatePackageData(data: any): ValidationResult;

  /**
   * Get package-specific files for ZIP
   */
  protected abstract getPackageFiles(data: any): Promise<Record<string, Buffer>>;

  /**
   * Extract package-specific data from ZIP
   */
  protected abstract extractPackageData(files: Record<string, Buffer>): Promise<any>;

  // ========================================================================
  // Common Methods (shared by all package types)
  // ========================================================================

  /**
   * Validate W-Matrix data
   */
  protected validateWMatrix(wMatrix: WMatrixData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check dimensions
    if (!wMatrix.weights || wMatrix.weights.length === 0) {
      errors.push('W-Matrix weights cannot be empty');
    }

    if (!wMatrix.biases || wMatrix.biases.length === 0) {
      errors.push('W-Matrix biases cannot be empty');
    }

    if (wMatrix.weights.length !== wMatrix.biases.length) {
      errors.push('Bias vector length must match W-Matrix output dimension');
    }

    if (wMatrix.weights.length !== wMatrix.targetDimension) {
      errors.push(`W-Matrix output dimension (${wMatrix.weights.length}) must match target dimension (${wMatrix.targetDimension})`);
    }

    if (wMatrix.weights[0] && wMatrix.weights[0].length !== wMatrix.sourceDimension) {
      errors.push(`W-Matrix input dimension (${wMatrix.weights[0].length}) must match source dimension (${wMatrix.sourceDimension})`);
    }

    // Check epsilon quality
    if (wMatrix.epsilon > 0.15) {
      warnings.push(`High epsilon (${wMatrix.epsilon.toFixed(3)}) - quality may be poor (recommend < 0.15)`);
    }

    // Check orthogonality if provided
    if (wMatrix.orthogonalityScore !== undefined && wMatrix.orthogonalityScore > 5.0) {
      warnings.push(`Poor orthogonality score (${wMatrix.orthogonalityScore.toFixed(2)}) - may cause instability`);
    }

    // Check training anchors if provided
    if (wMatrix.trainingAnchors !== undefined && wMatrix.trainingAnchors < 100) {
      warnings.push(`Low training anchor count (${wMatrix.trainingAnchors}) - recommend at least 100`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate metadata
   */
  protected validateMetadata(metadata: PackageMetadata): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!metadata.packageId || metadata.packageId.length === 0) {
      errors.push('Package ID is required');
    }

    if (!metadata.name || metadata.name.length === 0) {
      errors.push('Package name is required');
    }

    if (!metadata.description || metadata.description.length < 10) {
      errors.push('Package description must be at least 10 characters');
    }

    if (!metadata.version || !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      errors.push('Package version must follow semantic versioning (e.g., 1.0.0)');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Create certification for W-Matrix
   */
  protected createCertification(wMatrix: WMatrixData): CertificationLevel {
    return QualityCertifier.createCertification(
      wMatrix.epsilon,
      0.95, // Default cosine similarity
      0.1,  // Default euclidean distance
      wMatrix.trainingAnchors || 100
    ).level;
  }

  /**
   * Pack files into ZIP buffer
   */
  protected async packToZip(files: Record<string, Buffer | string>): Promise<Buffer> {
    const zip = new JSZip();

    for (const [path, content] of Object.entries(files)) {
      if (typeof content === 'string') {
        zip.file(path, content);
      } else {
        zip.file(path, content);
      }
    }

    return await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });
  }

  /**
   * Unpack ZIP buffer into files
   */
  protected async unpackFromZip(buffer: Buffer): Promise<Record<string, Buffer>> {
    const zip = await JSZip.loadAsync(buffer);
    const files: Record<string, Buffer> = {};

    for (const [path, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        files[path] = await file.async('nodebuffer');
      }
    }

    return files;
  }

  /**
   * Upload package to S3
   */
  protected async uploadToS3(
    packageId: string,
    buffer: Buffer,
    fileExtension: string
  ): Promise<string> {
    const fileName = `${packageId}.${fileExtension}`;
    const s3Key = `${this.packageType}-packages/${packageId}/${fileName}`;
    
    const { url } = await storagePut(s3Key, buffer, 'application/zip');
    return url;
  }

  /**
   * Upload individual file to S3
   */
  protected async uploadFileToS3(
    packageId: string,
    fileName: string,
    buffer: Buffer,
    contentType: string
  ): Promise<string> {
    const s3Key = `${this.packageType}-packages/${packageId}/${fileName}`;
    const { url } = await storagePut(s3Key, buffer, contentType);
    return url;
  }

  /**
   * Serialize W-Matrix to JSON
   */
  protected serializeWMatrix(wMatrix: WMatrixData): string {
    return JSON.stringify({
      weights: wMatrix.weights,
      biases: wMatrix.biases,
      epsilon: wMatrix.epsilon,
      orthogonalityScore: wMatrix.orthogonalityScore,
      trainingAnchors: wMatrix.trainingAnchors,
      sourceModel: wMatrix.sourceModel,
      targetModel: wMatrix.targetModel,
      sourceDimension: wMatrix.sourceDimension,
      targetDimension: wMatrix.targetDimension,
    }, null, 2);
  }

  /**
   * Deserialize W-Matrix from JSON
   */
  protected deserializeWMatrix(json: string): WMatrixData {
    return JSON.parse(json);
  }

  /**
   * Serialize metadata to JSON
   */
  protected serializeMetadata(metadata: PackageMetadata): string {
    return JSON.stringify(metadata, null, 2);
  }

  /**
   * Deserialize metadata from JSON
   */
  protected deserializeMetadata(json: string): PackageMetadata {
    return JSON.parse(json);
  }

  /**
   * Serialize provenance to JSON
   */
  protected serializeProvenance(provenance: PackageProvenance): string {
    return JSON.stringify(provenance, null, 2);
  }

  /**
   * Deserialize provenance from JSON
   */
  protected deserializeProvenance(json: string): PackageProvenance {
    return JSON.parse(json);
  }

  /**
   * Generate package ID
   */
  protected generatePackageId(): string {
    const prefix = this.packageType === 'vector' ? 'vpkg' :
                   this.packageType === 'memory' ? 'mpkg' : 'cpkg';
    return `${prefix}_${nanoid(12)}`;
  }

  /**
   * Convert TrainingResult to WMatrixData
   */
  protected trainingResultToWMatrixData(
    result: TrainingResult,
    sourceModel: string,
    targetModel: string
  ): WMatrixData {
    return {
      weights: result.weights,
      biases: result.biases,
      epsilon: result.finalEpsilon,
      orthogonalityScore: result.orthogonalityScore,
      trainingAnchors: result.trainingAnchors,
      sourceModel,
      targetModel,
      sourceDimension: result.weights[0]?.length || 0,
      targetDimension: result.weights.length,
    };
  }

  /**
   * Serialize array to binary buffer (for .safetensors-like format)
   */
  protected serializeArray(arr: number[] | number[][] | number[][][]): Buffer {
    // Flatten multi-dimensional array
    const flat = this.flattenArray(arr);
    
    // Create buffer (8 bytes per float64)
    const buffer = Buffer.allocUnsafe(flat.length * 8);
    
    for (let i = 0; i < flat.length; i++) {
      buffer.writeDoubleLE(flat[i], i * 8);
    }
    
    return buffer;
  }

  /**
   * Deserialize binary buffer to array
   */
  protected deserializeArray(buffer: Buffer, shape: number[]): number[] | number[][] | number[][][] {
    const flat: number[] = [];
    
    for (let i = 0; i < buffer.length / 8; i++) {
      flat.push(buffer.readDoubleLE(i * 8));
    }
    
    return this.reshapeArray(flat, shape);
  }

  /**
   * Flatten multi-dimensional array
   */
  private flattenArray(arr: any): number[] {
    if (typeof arr === 'number') return [arr];
    if (!Array.isArray(arr)) return [];
    
    const result: number[] = [];
    for (const item of arr) {
      if (Array.isArray(item)) {
        result.push(...this.flattenArray(item));
      } else {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Reshape flat array to multi-dimensional array
   */
  private reshapeArray(flat: number[], shape: number[]): any {
    if (shape.length === 1) {
      return flat.slice(0, shape[0]);
    }
    
    const result: any[] = [];
    const size = shape.slice(1).reduce((a, b) => a * b, 1);
    
    for (let i = 0; i < shape[0]; i++) {
      result.push(this.reshapeArray(flat.slice(i * size, (i + 1) * size), shape.slice(1)));
    }
    
    return result;
  }
}
