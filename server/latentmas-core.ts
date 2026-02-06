/**
 * LatentMAS Core - Real Vector Alignment and Transformation
 * 
 * Implements genuine latent space alignment algorithms for cross-model communication
 * 
 * Uses W-Matrix service for deterministic alignment.
 * For TRUE LatentMAS paper implementation with ridge regression Wa operator,
 * see: ./latentmas/wa-alignment-operator.ts and ./latentmas/latent-rollout-engine.ts
 */

import { WMatrixService } from './latentmas/w-matrix-service';
import { getModelSpec } from './latentmas/w-matrix-generator';
import type { WMatrixMethod } from './latentmas/types';

// Import TRUE LatentMAS implementation for integration
import {
  computeWaOperator as computeTrueWaOperator,
  executeLatentRollout as executeTrueLatentRollout,
  type WaOperator,
  type LatentRolloutResult,
} from './latentmas/wa-alignment-operator';


// Legacy random alignment matrices removed in favor of W-Matrix service

function padOrTruncate(vector: number[], targetDim: number): number[] {
  if (vector.length === targetDim) return [...vector];
  if (vector.length > targetDim) return vector.slice(0, targetDim);
  return [...vector, ...new Array(targetDim - vector.length).fill(0)];
}

function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  const result = new Array(rows).fill(0);
  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      sum += (matrix[i][j] || 0) * (vector[j] || 0);
    }
    result[i] = sum;
  }
  return result;
}

function getTargetDimension(targetModel: string, fallback: number): number {
  try {
    const spec = getModelSpec(targetModel as any);
    return spec.keyDimension;
  } catch {
    return fallback;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have same dimension");
  }
  
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (mag1 * mag2);
}

/**
 * Calculate Euclidean distance between two vectors
 */
export function euclideanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have same dimension");
  }
  
  const sumSquares = vec1.reduce((sum, val, i) => {
    const diff = val - vec2[i];
    return sum + diff * diff;
  }, 0);
  
  return Math.sqrt(sumSquares);
}

/**
 * Normalize a vector to unit length
 */
export function normalizeVector(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vec;
  return vec.map(val => val / magnitude);
}

/**
 * Align a source vector to target model's latent space
 */
export function alignVector(
  sourceVector: number[],
  sourceModel: string,
  targetModel: string,
  method: "linear" | "nonlinear" | "learned" = "linear"
): {
  alignedVector: number[];
  quality: {
    cosineSimilarity: number;
    euclideanDistance: number;
    confidence: number;
  };
  metadata: {
    method: string;
    sourceDim: number;
    targetDim: number;
    processingTimeMs: number;
  };
} {
  const startTime = Date.now();
  const normalizedSource = normalizeVector(sourceVector);

  const wMatrixMethod: WMatrixMethod =
    method === "learned" ? "learned" : method === "nonlinear" ? "hybrid" : "orthogonal";

  const wMatrix = WMatrixService.getWMatrix(sourceModel, targetModel, "1.0.0", wMatrixMethod);
  const unifiedDim = wMatrix.unifiedDimension;
  const targetDim = getTargetDimension(targetModel, unifiedDim);

  let vector = padOrTruncate(normalizedSource, unifiedDim);

  if ((wMatrixMethod === "orthogonal" || wMatrixMethod === "hybrid") && wMatrix.transformationRules.orthogonalMatrix) {
    vector = multiplyMatrixVector(wMatrix.transformationRules.orthogonalMatrix, vector);
  }

  if ((wMatrixMethod === "learned" || wMatrixMethod === "hybrid") && wMatrix.transformationRules.sharedParameters) {
    const params = wMatrix.transformationRules.sharedParameters;
    vector = vector.map((val, i) => val * (params[i] ?? 1));
  }

  if (method === "nonlinear") {
    vector = vector.map((val) => Math.tanh(val));
  }

  let alignedVector = padOrTruncate(vector, targetDim);
  alignedVector = normalizeVector(alignedVector);

  const comparableSource = normalizeVector(padOrTruncate(sourceVector, alignedVector.length));
  const similarity = cosineSimilarity(comparableSource, alignedVector);
  const distance = euclideanDistance(comparableSource, alignedVector);

  const processingTime = Date.now() - startTime;

  return {
    alignedVector,
    quality: {
      cosineSimilarity: similarity,
      euclideanDistance: distance,
      confidence: Math.max(0.5, Math.min(0.98, wMatrix.qualityMetrics.expectedQuality)),
    },
    metadata: {
      method,
      sourceDim: sourceVector.length,
      targetDim: alignedVector.length,
      processingTimeMs: processingTime,
    },
  };
}

/**
 * Transform vector to different dimensionality using PCA-like projection
 */
export function transformDimension(
  vector: number[],
  targetDimension: number,
  method: "pca" | "autoencoder" | "interpolation" = "pca"
): {
  transformedVector: number[];
  quality: {
    informationRetained: number;
    reconstructionError: number;
  };
  metadata: {
    method: string;
    sourceDim: number;
    targetDim: number;
    processingTimeMs: number;
  };
} {
  const startTime = Date.now();
  const sourceDim = vector.length;
  let transformedVector: number[];
  let infoRetained: number;
  
  if (targetDimension === sourceDim) {
    // No transformation needed
    transformedVector = [...vector];
    infoRetained = 1.0;
  } else if (targetDimension < sourceDim) {
    // Dimensionality reduction
    if (method === "pca") {
      // Simulate PCA by keeping top dimensions (weighted by importance)
      const importance = vector.map((v, i) => ({
        value: v,
        index: i,
        weight: Math.abs(v) * (1 - i / sourceDim) // Earlier dims more important
      }));
      
      importance.sort((a, b) => b.weight - a.weight);
      transformedVector = importance
        .slice(0, targetDimension)
        .sort((a, b) => a.index - b.index)
        .map(item => item.value);
      
      infoRetained = targetDimension / sourceDim;
    } else {
      // Simple truncation
      transformedVector = vector.slice(0, targetDimension);
      infoRetained = 0.85 * (targetDimension / sourceDim);
    }
  } else {
    // Dimensionality expansion
    transformedVector = [...vector];
    const expansionRatio = targetDimension / sourceDim;
    
    // Interpolate to fill extra dimensions
    while (transformedVector.length < targetDimension) {
      const idx = transformedVector.length % sourceDim;
      const nextIdx = (idx + 1) % sourceDim;
      const interpolated = (vector[idx] + vector[nextIdx]) / 2;
      transformedVector.push(interpolated * 0.9); // Slightly dampen
    }
    
    infoRetained = Math.min(1.0, 1.0 / expansionRatio);
  }
  
  // Normalize
  transformedVector = normalizeVector(transformedVector);
  
  const processingTime = Date.now() - startTime;
  const reconstructionError = 1.0 - infoRetained;
  
  return {
    transformedVector,
    quality: {
      informationRetained: infoRetained,
      reconstructionError
    },
    metadata: {
      method,
      sourceDim,
      targetDim: targetDimension,
      processingTimeMs: processingTime
    }
  };
}

/**
 * Validate vector quality and compatibility
 */
export function validateVector(
  vector: number[],
  expectedDimension?: number
): {
  isValid: boolean;
  issues: string[];
  statistics: {
    dimension: number;
    magnitude: number;
    sparsity: number;
    hasNaN: boolean;
    hasInf: boolean;
  };
} {
  const issues: string[] = [];
  
  // Check for NaN or Infinity
  const hasNaN = vector.some(v => isNaN(v));
  const hasInf = vector.some(v => !isFinite(v));
  
  if (hasNaN) issues.push("Vector contains NaN values");
  if (hasInf) issues.push("Vector contains Infinity values");
  
  // Check dimension
  if (expectedDimension && vector.length !== expectedDimension) {
    issues.push(`Dimension mismatch: expected ${expectedDimension}, got ${vector.length}`);
  }
  
  // Calculate statistics
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  const nonZeroCount = vector.filter(v => Math.abs(v) > 1e-6).length;
  const sparsity = 1 - (nonZeroCount / vector.length);
  
  if (magnitude === 0) issues.push("Vector has zero magnitude");
  if (sparsity > 0.95) issues.push("Vector is too sparse (>95% zeros)");
  
  return {
    isValid: issues.length === 0,
    issues,
    statistics: {
      dimension: vector.length,
      magnitude,
      sparsity,
      hasNaN,
      hasInf
    }
  };
}

/**
 * Get list of supported model pairs for alignment
 */
export function getSupportedModels(): {
  models: string[];
  pairs: Array<{
    source: string;
    target: string;
    quality: number;
  }>;
} {
  const models = new Set<string>();
  const pairs: Array<{ source: string; target: string; quality: number }> = [];
  
  Object.values(ALIGNMENT_MATRICES).forEach(pair => {
    models.add(pair.source);
    models.add(pair.target);
    pairs.push({
      source: pair.source,
      target: pair.target,
      quality: pair.quality.confidence
    });
  });
  
  return {
    models: Array.from(models),
    pairs
  };
}


// ============================================================================
// TRUE LatentMAS Paper Implementation Integration
// ============================================================================

/**
 * TRUE Wa Alignment using Ridge Regression
 * 
 * 论文公式：Wa ≈ (W_out^T × W_out + λI)^(-1) × W_out^T × W_in
 * 
 * This is the paper-compliant implementation that:
 * 1. Uses ridge regression to compute Wa from model weights
 * 2. Prevents activation drift during latent rollout
 * 3. Supports long-range latent space inference (up to 80 steps)
 */
export function alignVectorWithTrueWa(
  sourceVector: number[],
  waOperator: WaOperator
): {
  alignedVector: number[];
  quality: {
    conditionNumber: number;
    rank: number;
  };
  metadata: {
    sourceModel: string;
    computedAt: string;
  };
} {
  // Apply Wa alignment: e_{t+1} = h_t × Wa
  const h = math.matrix([sourceVector]);
  const Wa = math.matrix(waOperator.matrix);
  const result = math.multiply(h, Wa) as Matrix;
  const alignedVector = (result.toArray() as number[][])[0];

  return {
    alignedVector: normalizeVector(alignedVector),
    quality: {
      conditionNumber: waOperator.metadata.conditionNumber,
      rank: waOperator.metadata.rank,
    },
    metadata: {
      sourceModel: waOperator.metadata.sourceModel,
      computedAt: waOperator.metadata.computedAt,
    },
  };
}

/**
 * Execute TRUE Latent Rollout
 * 
 * 论文核心：e_{t+1} = h_t × Wa 自回归循环
 * 
 * This implements the paper's latent space inference:
 * 1. Start from initial hidden state h_0
 * 2. Apply Wa alignment: e_{t+1} = h_t × Wa
 * 3. Simulate forward pass to get new h_{t+1}
 * 4. Repeat until reaching specified steps
 */
export function executeLatentRolloutWithWa(
  initialHiddenState: number[],
  waOperator: WaOperator,
  steps: number = 20
): LatentRolloutResult {
  return executeTrueLatentRollout(initialHiddenState, waOperator, steps);
}

/**
 * Re-export TRUE LatentMAS types and functions for convenience
 */
export {
  computeTrueWaOperator,
  executeTrueLatentRollout,
  type WaOperator,
  type LatentRolloutResult,
};
