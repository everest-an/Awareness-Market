/**
 * KV-Cache + W-Matrix Integration - LatentMAS Core
 * 
 * This module implements the core LatentMAS functionality:
 * Using W-Matrix to transform KV-Cache from one model to another,
 * enabling cross-model memory sharing and reducing TTFT.
 * 
 * Paper Reference: LatentMAS Section 3.2 "Cross-Model KV-Cache Transfer"
 */

import type { KVCache, CompressedKVCache } from './kv-cache-compressor';
import type { TrainingResult } from './w-matrix-trainer';

// ============================================================================
// KV-Cache Transformation
// ============================================================================

export interface TransformedKVCache {
  keys: number[][][]; // [num_layers][num_tokens][dimension]
  values: number[][][];
  sourceModel: string;
  targetModel: string;
  transformationEpsilon: number; // Quality of transformation
  originalTokenCount: number;
  transformedTokenCount: number;
}

/**
 * Transform KV-Cache from source model to target model using W-Matrix
 * This is the core LatentMAS operation
 */
export function transformKVCache(
  kvCache: KVCache,
  wMatrix: TrainingResult,
  sourceModel: string,
  targetModel: string
): TransformedKVCache {
  const { weights, biases } = wMatrix;
  
  // Transform keys
  const transformedKeys = kvCache.keys.map(layer =>
    layer.map(token =>
      applyWMatrix(token, weights, biases)
    )
  );
  
  // Transform values
  const transformedValues = kvCache.values.map(layer =>
    layer.map(token =>
      applyWMatrix(token, weights, biases)
    )
  );
  
  return {
    keys: transformedKeys,
    values: transformedValues,
    sourceModel,
    targetModel,
    transformationEpsilon: wMatrix.finalEpsilon,
    originalTokenCount: kvCache.keys[0]?.length || 0,
    transformedTokenCount: transformedKeys[0]?.length || 0,
  };
}

/**
 * Apply W-Matrix transformation to a single vector
 * y = W * x + b
 */
function applyWMatrix(
  vector: number[],
  weights: number[][],
  biases: number[]
): number[] {
  const result = new Array(weights.length).fill(0);
  
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < vector.length; j++) {
      result[i] += weights[i][j] * vector[j];
    }
    result[i] += biases[i];
  }
  
  return result;
}

// ============================================================================
// Combined KV-Cache Compression + Transformation
// ============================================================================

export interface CompressedTransformedKVCache {
  compressed: CompressedKVCache;
  transformed: TransformedKVCache;
  compressionRatio: number;
  transformationQuality: number;
  totalBandwidthSaving: number; // Percentage
}

/**
 * Compress AND transform KV-Cache in one pass
 * This is the optimal LatentMAS workflow:
 * 1. Compress KV-Cache (remove redundant tokens)
 * 2. Transform to target model space (using W-Matrix)
 * 3. Result: Maximum bandwidth saving + cross-model compatibility
 */
export async function compressAndTransformKVCache(
  kvCache: KVCache,
  wMatrix: TrainingResult,
  sourceModel: string,
  targetModel: string,
  compressionThreshold: number = 0.9
): Promise<CompressedTransformedKVCache> {
  // Step 1: Compress KV-Cache (using attention-based selection)
  const compressed = await compressKVCacheByAttention(kvCache, compressionThreshold);
  
  // Step 2: Transform compressed cache to target model
  const transformed = transformKVCache(
    {
      keys: compressed.selectedKeys,
      values: compressed.selectedValues,
      attentionWeights: compressed.attentionWeights,
    },
    wMatrix,
    sourceModel,
    targetModel
  );
  
  // Calculate metrics
  const compressionRatio = compressed.selectedIndices.length / kvCache.keys[0].length;
  const transformationQuality = 1 - wMatrix.finalEpsilon;
  const totalBandwidthSaving = (1 - compressionRatio) * 100;
  
  return {
    compressed,
    transformed,
    compressionRatio,
    transformationQuality,
    totalBandwidthSaving,
  };
}

/**
 * Compress KV-Cache by selecting important tokens based on attention weights
 * Paper Reference: LatentMAS v2 "Symmetric Focus Algorithm"
 */
async function compressKVCacheByAttention(
  kvCache: KVCache,
  threshold: number
): Promise<CompressedKVCache> {
  const { keys, values, attentionWeights } = kvCache;
  
  if (!attentionWeights || attentionWeights.length === 0) {
    throw new Error('Attention weights are required for compression');
  }
  
  // Calculate cumulative attention for each token
  const numTokens = keys[0].length;
  const tokenImportance = new Array(numTokens).fill(0);
  
  for (const layerWeights of attentionWeights) {
    for (let i = 0; i < numTokens; i++) {
      tokenImportance[i] += layerWeights[i];
    }
  }
  
  // Normalize
  const totalImportance = tokenImportance.reduce((sum, val) => sum + val, 0);
  const normalizedImportance = tokenImportance.map(val => val / totalImportance);
  
  // Sort by importance and select top tokens
  const sortedIndices = normalizedImportance
    .map((importance, idx) => ({ importance, idx }))
    .sort((a, b) => b.importance - a.importance);
  
  // Select tokens until cumulative importance >= threshold
  let cumulativeImportance = 0;
  const selectedIndices: number[] = [];
  
  for (const { importance, idx } of sortedIndices) {
    selectedIndices.push(idx);
    cumulativeImportance += importance;
    
    if (cumulativeImportance >= threshold) {
      break;
    }
  }
  
  // Sort selected indices to maintain order
  selectedIndices.sort((a, b) => a - b);
  
  // Extract selected keys and values
  const selectedKeys = keys.map(layer =>
    selectedIndices.map(idx => layer[idx])
  );
  
  const selectedValues = values.map(layer =>
    selectedIndices.map(idx => layer[idx])
  );
  
  return {
    selectedKeys,
    selectedValues,
    selectedIndices,
    attentionWeights,
    originalSize: numTokens,
    compressedSize: selectedIndices.length,
    compressionRatio: selectedIndices.length / numTokens,
  };
}

// ============================================================================
// LatentMAS Memory Package
// ============================================================================

export interface LatentMASMemoryPackage {
  // Metadata
  id: string;
  name: string;
  description: string;
  version: string;
  
  // Model information
  sourceModel: string;
  targetModel: string;
  
  // W-Matrix
  wMatrix: {
    weights: number[][];
    biases: number[];
    epsilon: number;
    orthogonalityScore: number;
    trainingAnchors: number;
  };
  
  // KV-Cache (optional - can be sold separately or bundled)
  kvCache?: {
    keys: number[][][];
    values: number[][][];
    tokenCount: number;
    compressionRatio: number;
  };
  
  // Quality metrics
  metrics: {
    ttftReduction: number; // Percentage reduction in Time To First Token
    tokenSavings: number; // Number of tokens saved
    bandwidthSaving: number; // Percentage
    qualityScore: number; // Overall quality (0-1)
  };
  
  // Provenance
  createdBy: string;
  createdAt: Date;
  trainingDataset: string;
  certificationLevel: 'platinum' | 'gold' | 'silver' | 'bronze';
}

/**
 * Create a complete LatentMAS memory package
 * This is what gets uploaded to the marketplace
 */
export function createLatentMASPackage(
  wMatrix: TrainingResult,
  sourceModel: string,
  targetModel: string,
  kvCache?: TransformedKVCache,
  metadata?: Partial<LatentMASMemoryPackage>
): LatentMASMemoryPackage {
  // Calculate quality metrics
  const qualityScore = calculateQualityScore(wMatrix, kvCache);
  const certificationLevel = getCertificationLevel(wMatrix.finalEpsilon);
  
  return {
    id: generatePackageId(),
    name: `${sourceModel} → ${targetModel} Memory`,
    description: `LatentMAS memory package for cross-model transfer`,
    version: '1.0.0',
    sourceModel,
    targetModel,
    wMatrix: {
      weights: wMatrix.weights,
      biases: wMatrix.biases,
      epsilon: wMatrix.finalEpsilon,
      orthogonalityScore: wMatrix.orthogonalityScore,
      trainingAnchors: 100, // From training
    },
    kvCache: kvCache ? {
      keys: kvCache.keys,
      values: kvCache.values,
      tokenCount: kvCache.transformedTokenCount,
      compressionRatio: kvCache.transformedTokenCount / kvCache.originalTokenCount,
    } : undefined,
    metrics: {
      ttftReduction: estimateTTFTReduction(wMatrix, kvCache),
      tokenSavings: kvCache ? (kvCache.originalTokenCount - kvCache.transformedTokenCount) : 0,
      bandwidthSaving: kvCache ? ((1 - kvCache.transformedTokenCount / kvCache.originalTokenCount) * 100) : 0,
      qualityScore,
    },
    createdBy: metadata?.createdBy || 'system',
    createdAt: new Date(),
    trainingDataset: 'standardized-anchors-v1',
    certificationLevel,
    ...metadata,
  };
}

function calculateQualityScore(
  wMatrix: TrainingResult,
  kvCache?: TransformedKVCache
): number {
  // Quality score based on:
  // 1. W-Matrix epsilon (lower is better)
  // 2. Orthogonality score (lower is better)
  // 3. KV-Cache compression ratio (if available)
  
  const epsilonScore = Math.max(0, 1 - wMatrix.finalEpsilon / 0.1); // Normalize to 0-1
  const orthogonalityScore = Math.max(0, 1 - wMatrix.orthogonalityScore / 10);
  
  let compressionScore = 0.5; // Default if no KV-Cache
  if (kvCache) {
    compressionScore = kvCache.transformedTokenCount / kvCache.originalTokenCount;
  }
  
  return (epsilonScore * 0.5 + orthogonalityScore * 0.3 + compressionScore * 0.2);
}

function getCertificationLevel(epsilon: number): 'platinum' | 'gold' | 'silver' | 'bronze' {
  if (epsilon < 0.01) return 'platinum';
  if (epsilon < 0.05) return 'gold';
  if (epsilon < 0.10) return 'silver';
  return 'bronze';
}

function estimateTTFTReduction(
  wMatrix: TrainingResult,
  kvCache?: TransformedKVCache
): number {
  // Estimate TTFT reduction based on:
  // 1. KV-Cache token savings
  // 2. W-Matrix quality
  
  if (!kvCache) return 0;
  
  const tokenSavingRatio = 1 - (kvCache.transformedTokenCount / kvCache.originalTokenCount);
  const qualityFactor = 1 - wMatrix.finalEpsilon;
  
  // TTFT reduction is proportional to token savings, adjusted by quality
  return tokenSavingRatio * qualityFactor * 100;
}

function generatePackageId(): string {
  return `latentmas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Usage Example
// ============================================================================

/**
 * Example: Complete LatentMAS workflow
 */
export async function exampleLatentMASWorkflow() {
  // 1. Train W-Matrix
  const wMatrix: TrainingResult = {
    weights: [[]], // Trained weights
    biases: [],
    trainingLoss: [],
    validationLoss: [],
    finalEpsilon: 0.034,
    convergenceEpoch: 50,
    orthogonalityScore: 0.12,
  };
  
  // 2. Prepare KV-Cache
  const kvCache: KVCache = {
    keys: [[[]]],
    values: [[[]]],
    attentionWeights: [[]],
  };
  
  // 3. Compress and transform
  const result = await compressAndTransformKVCache(
    kvCache,
    wMatrix,
    'gpt-3.5-turbo',
    'gpt-4'
  );
  
  // 4. Create marketplace package
  const package_ = createLatentMASPackage(
    wMatrix,
    'gpt-3.5-turbo',
    'gpt-4',
    result.transformed,
    {
      createdBy: 'agent-0x1234',
      description: 'High-quality GPT-3.5 to GPT-4 memory transfer',
    }
  );
  
  console.log('LatentMAS Package Created:');
  console.log(`  ID: ${package_.id}`);
  console.log(`  Quality Score: ${package_.metrics.qualityScore.toFixed(2)}`);
  console.log(`  TTFT Reduction: ${package_.metrics.ttftReduction.toFixed(1)}%`);
  console.log(`  Bandwidth Saving: ${package_.metrics.bandwidthSaving.toFixed(1)}%`);
  console.log(`  Certification: ${package_.certificationLevel}`);
  
  return package_;
}
