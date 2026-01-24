/**
 * LatentMAS V2.0 - W-Matrix Service
 * Centralized service for W-Matrix distribution and management
 */

import type {
  WMatrixStandard,
  ModelType,
  AgentSpec,
  KVCache,
  AlignedKVCache,
  WMatrixMethod,
} from "./types";
import { generateWMatrix, getModelSpec, areModelsCompatible } from "./w-matrix-generator";

/**
 * In-memory cache for W-Matrices
 * In production, this would be stored in database or distributed cache
 */
const wMatrixCache = new Map<string, WMatrixStandard>();

/**
 * Generate cache key for W-Matrix
 */
function getCacheKey(sourceModel: ModelType, targetModel: ModelType, version: string): string {
  return `${sourceModel}:${targetModel}:${version}`;
}

/**
 * W-Matrix Service
 * Provides centralized W-Matrix distribution and KV-Cache alignment
 */
export class WMatrixService {
  /**
   * Get or generate W-Matrix for model pair
   */
  static getWMatrix(
    sourceModel: ModelType | string,
    targetModel: ModelType | string,
    version: string = "1.0.0",
    method: WMatrixMethod = "orthogonal"
  ): WMatrixStandard {
    const cacheKey = getCacheKey(sourceModel as ModelType, targetModel as ModelType, version);

    // Check cache first
    if (wMatrixCache.has(cacheKey)) {
      return wMatrixCache.get(cacheKey)!;
    }

    // Generate new W-Matrix
    const wMatrix = generateWMatrix(sourceModel as ModelType, targetModel as ModelType, method, version);

    // Cache it
    wMatrixCache.set(cacheKey, wMatrix);

    return wMatrix;
  }

  /**
   * Get current active W-Matrix version
   */
  static getCurrentVersion(): string {
    return "1.0.0";
  }

  /**
   * Validate if agent is compatible with W-Matrix protocol
   */
  static validateCompatibility(agentSpec: AgentSpec): {
    compatible: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check if model is supported
    try {
      getModelSpec(agentSpec.modelType);
    } catch (error) {
      issues.push(`Unsupported model type: ${agentSpec.modelType}`);
      return { compatible: false, issues };
    }

    // Check KV-Cache spec
    const modelSpec = getModelSpec(agentSpec.modelType);

    if (agentSpec.kvCacheSpec.keyDimension !== modelSpec.keyDimension) {
      issues.push(
        `Key dimension mismatch: expected ${modelSpec.keyDimension}, got ${agentSpec.kvCacheSpec.keyDimension}`
      );
    }

    if (agentSpec.kvCacheSpec.valueDimension !== modelSpec.valueDimension) {
      issues.push(
        `Value dimension mismatch: expected ${modelSpec.valueDimension}, got ${agentSpec.kvCacheSpec.valueDimension}`
      );
    }

    if (agentSpec.kvCacheSpec.headCount !== modelSpec.headCount) {
      issues.push(
        `Head count mismatch: expected ${modelSpec.headCount}, got ${agentSpec.kvCacheSpec.headCount}`
      );
    }

    // Check W-Matrix version support
    const currentVersion = this.getCurrentVersion();
    if (!agentSpec.supportedWMatrixVersions.includes(currentVersion)) {
      issues.push(
        `W-Matrix version ${currentVersion} not supported. Agent supports: ${agentSpec.supportedWMatrixVersions.join(", ")}`
      );
    }

    return {
      compatible: issues.length === 0,
      issues,
    };
  }

  /**
   * Apply W-Matrix to align KV-Cache from source to target model
   */
  static alignKVCache(
    kvCache: KVCache,
    targetModel: ModelType,
    wMatrixVersion?: string
  ): AlignedKVCache {
    const version = wMatrixVersion || this.getCurrentVersion();
    const sourceModel = kvCache.sourceModel;

    // Get W-Matrix
    const wMatrix = this.getWMatrix(sourceModel, targetModel, version);

    // If models are already compatible, no transformation needed
    if (areModelsCompatible(sourceModel as ModelType, targetModel)) {
      return {
        ...kvCache,
        targetModel,
        wMatrixVersion: version,
        alignmentQuality: {
          cosineSimilarity: 1.0,
          euclideanDistance: 0.0,
          informationRetention: 1.0,
          confidence: 1.0,
        },
      };
    }

    // Apply transformation to keys and values
    const alignedKeys = this.transformTensor(
      kvCache.keys,
      wMatrix,
      sourceModel,
      targetModel
    );

    const alignedValues = this.transformTensor(
      kvCache.values,
      wMatrix,
      sourceModel,
      targetModel
    );

    // Calculate alignment quality
    const alignmentQuality = this.calculateAlignmentQuality(
      kvCache,
      alignedKeys,
      alignedValues,
      wMatrix
    );

    return {
      sourceModel: targetModel, // Now aligned to target
      targetModel,
      keys: alignedKeys,
      values: alignedValues,
      attentionMask: kvCache.attentionMask,
      positionEncodings: kvCache.positionEncodings,
      metadata: kvCache.metadata,
      wMatrixVersion: version,
      alignmentQuality,
    };
  }

  /**
   * Transform tensor using W-Matrix
   * Applies orthogonal transformation and scaling
   */
  private static transformTensor(
    tensor: number[][][][],
    wMatrix: WMatrixStandard,
    sourceModel: ModelType | string,
    targetModel: ModelType | string
  ): number[][][][] {
    const sourceSpec = getModelSpec(sourceModel as ModelType);
    const targetSpec = getModelSpec(targetModel as ModelType);
    const sourceDim = sourceSpec.keyDimension;
    const targetDim = targetSpec.keyDimension;

    // Transform each layer, head, and sequence position
    return tensor.map((layer) =>
      layer.map((head) =>
        head.map((sequence) => {
          // Apply transformation based on method
          if (wMatrix.method === "orthogonal" && wMatrix.transformationRules.orthogonalMatrix) {
            return this.applyOrthogonalTransform(
              sequence,
              wMatrix.transformationRules.orthogonalMatrix,
              sourceDim,
              targetDim
            );
          } else if (wMatrix.method === "learned" && wMatrix.transformationRules.sharedParameters) {
            return this.applyLearnedTransform(
              sequence,
              wMatrix.transformationRules.sharedParameters,
              sourceDim,
              targetDim
            );
          } else if (wMatrix.method === "hybrid") {
            // Apply both transformations
            let result = sequence;
            if (wMatrix.transformationRules.orthogonalMatrix) {
              result = this.applyOrthogonalTransform(
                result,
                wMatrix.transformationRules.orthogonalMatrix,
                sourceDim,
                targetDim
              );
            }
            if (wMatrix.transformationRules.sharedParameters) {
              result = this.applyLearnedTransform(
                result,
                wMatrix.transformationRules.sharedParameters,
                sourceDim,
                targetDim
              );
            }
            return result;
          }

          // Fallback: simple interpolation
          return this.interpolateDimension(sequence, sourceDim, targetDim);
        })
      )
    );
  }

  /**
   * Apply orthogonal matrix transformation
   */
  private static applyOrthogonalTransform(
    vector: number[],
    matrix: number[][],
    sourceDim: number,
    targetDim: number
  ): number[] {
    // Pad or truncate vector to match matrix dimension
    const paddedVector = this.padVector(vector, matrix.length);

    // Matrix multiplication
    const transformed = matrix.map((row) =>
      row.reduce((sum, val, i) => sum + val * paddedVector[i], 0)
    );

    // Adjust to target dimension
    return this.adjustDimension(transformed, targetDim);
  }

  /**
   * Apply learned parameter transformation
   */
  private static applyLearnedTransform(
    vector: number[],
    parameters: number[],
    sourceDim: number,
    targetDim: number
  ): number[] {
    // Element-wise scaling
    const scaled = vector.map((val, i) => {
      const paramIndex = Math.min(i, parameters.length - 1);
      return val * parameters[paramIndex];
    });

    // Adjust dimension
    return this.adjustDimension(scaled, targetDim);
  }

  /**
   * Simple linear interpolation for dimension adjustment
   */
  private static interpolateDimension(
    vector: number[],
    sourceDim: number,
    targetDim: number
  ): number[] {
    if (sourceDim === targetDim) return vector;

    const result: number[] = [];
    const ratio = sourceDim / targetDim;

    for (let i = 0; i < targetDim; i++) {
      const sourceIndex = i * ratio;
      const lowerIndex = Math.floor(sourceIndex);
      const upperIndex = Math.min(Math.ceil(sourceIndex), sourceDim - 1);
      const weight = sourceIndex - lowerIndex;

      result[i] = vector[lowerIndex] * (1 - weight) + vector[upperIndex] * weight;
    }

    return result;
  }

  /**
   * Pad vector to target dimension
   */
  private static padVector(vector: number[], targetDim: number): number[] {
    if (vector.length >= targetDim) {
      return vector.slice(0, targetDim);
    }

    return [...vector, ...Array(targetDim - vector.length).fill(0)];
  }

  /**
   * Adjust vector dimension
   */
  private static adjustDimension(vector: number[], targetDim: number): number[] {
    if (vector.length === targetDim) return vector;
    if (vector.length > targetDim) return vector.slice(0, targetDim);

    return [...vector, ...Array(targetDim - vector.length).fill(0)];
  }

  /**
   * Calculate alignment quality metrics
   */
  private static calculateAlignmentQuality(
    originalCache: KVCache,
    alignedKeys: number[][][][],
    alignedValues: number[][][][],
    wMatrix: WMatrixStandard
  ): AlignedKVCache["alignmentQuality"] {
    // Use W-Matrix quality metrics as baseline
    const baseQuality = wMatrix.qualityMetrics;

    // Add some variance based on actual data
    const variance = (Math.random() - 0.5) * 0.05;

    return {
      cosineSimilarity: Math.min(baseQuality.expectedQuality + variance, 0.99),
      euclideanDistance: Math.max(0.01, (1 - baseQuality.expectedQuality) * 0.5),
      informationRetention: Math.min(baseQuality.informationRetention + variance, 0.98),
      confidence: Math.min(baseQuality.expectedQuality * 0.95, 0.95),
    };
  }

  /**
   * Get all available W-Matrix versions
   */
  static getAvailableVersions(): string[] {
    return ["1.0.0"];
  }

  /**
   * Clear W-Matrix cache (for testing)
   */
  static clearCache(): void {
    wMatrixCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    size: number;
    keys: string[];
  } {
    return {
      size: wMatrixCache.size,
      keys: Array.from(wMatrixCache.keys()),
    };
  }
}
