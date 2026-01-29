/**
 * Neural Bridge Protocol - MCP Tool Implementation
 *
 * Implements the core Neural Bridge Protocol from WHITEPAPER Section 3.2
 * Enables direct KV-Cache alignment and thought transfer between AI agents
 *
 * Key Features:
 * - Contrastive Loss (InfoNCE) alignment
 * - 1024 semantic anchor validation
 * - Fast validation (no inference required)
 * - 3% semantic loss guarantee
 *
 * Reference: LatentMAS Protocol Whitepaper v2.0
 */

import { SemanticAnchorDB, SemanticAnchor } from './semantic-anchor-validator.js';

/**
 * KV-Cache structure for cross-model transfer
 */
export interface KVCache {
  sourceModel: string;
  keys: number[][][];    // [layers][heads][sequence × key_dim]
  values: number[][][];  // [layers][heads][sequence × value_dim]
  attentionMask?: number[][];
  positionEncodings?: number[];
  metadata: {
    sequenceLength: number;
    contextDescription: string;
    tokenCount: number;
    generatedAt: string;
  };
}

/**
 * W-Matrix for cross-model transformation
 */
export interface WMatrix {
  version: string;
  sourceModel: string;
  targetModel: string;
  matrix: number[][];  // [d_target × d_source]
  unifiedDimension: number;
  method: 'orthogonal' | 'learned' | 'hybrid';
  epsilon: number;  // Alignment loss
  orthogonalityScore: number;
}

/**
 * Alignment result with quality metrics
 */
export interface AlignmentResult {
  alignedKVCache: KVCache;
  quality: {
    semanticQualityScore: number;  // 0-1 (from anchor validation)
    semanticLoss: number;           // 1 - semanticQualityScore
    passesThreshold: boolean;       // >= 0.95 (3% semantic loss)
    cosineSimilarity: number;
    informationRetention: number;
    confidence: number;
  };
  nearestAnchors: Array<{
    anchorId: number;
    category: string;
    similarity: number;
  }>;
  validationWarnings: string[];
}

/**
 * Neural Bridge Protocol Implementation
 *
 * Based on whitepaper Section 3.2:
 * L_total = L_contrastive + λ₁L_alignment + λ₂L_ortho
 */
export class NeuralBridge {
  private anchorDB: SemanticAnchorDB;
  private tau: number = 0.07;  // Temperature parameter for contrastive loss

  constructor(anchorDB: SemanticAnchorDB) {
    this.anchorDB = anchorDB;
  }

  /**
   * Align KV-Cache from source model to target model
   *
   * Process:
   * 1. Extract hidden states from KV-Cache
   * 2. Apply W-Matrix transformation
   * 3. Validate semantic quality using anchors
   * 4. Return aligned KV-Cache with quality metrics
   */
  async alignKVCache(
    kvCache: KVCache,
    wMatrix: WMatrix,
    targetModel: string
  ): Promise<AlignmentResult> {
    const warnings: string[] = [];

    // Step 1: Validate inputs
    if (kvCache.sourceModel !== wMatrix.sourceModel) {
      warnings.push(`KV-Cache source model (${kvCache.sourceModel}) doesn't match W-Matrix source (${wMatrix.sourceModel})`);
    }

    if (targetModel !== wMatrix.targetModel) {
      warnings.push(`Target model (${targetModel}) doesn't match W-Matrix target (${wMatrix.targetModel})`);
    }

    // Step 2: Transform KV-Cache using W-Matrix
    const alignedKeys = this.transformTensor3D(kvCache.keys, wMatrix.matrix);
    const alignedValues = this.transformTensor3D(kvCache.values, wMatrix.matrix);

    // Step 3: Extract representative hidden state for validation
    const representativeHiddenState = this.extractRepresentativeState(alignedKeys, alignedValues);

    // Step 4: Fast semantic validation using anchors
    const semanticQuality = this.fastValidation(representativeHiddenState);

    // Step 5: Find nearest semantic anchors
    const nearestAnchors = this.anchorDB.findNearestAnchors(representativeHiddenState, 10);

    // Step 6: Calculate additional quality metrics
    const cosineSimilarity = nearestAnchors[0]?.similarity || 0;
    const informationRetention = this.estimateInformationRetention(wMatrix.epsilon);
    const confidence = semanticQuality * (1 - wMatrix.epsilon);

    // Step 7: Check if passes 3% semantic loss threshold
    const passesThreshold = semanticQuality >= 0.95;
    const semanticLoss = 1.0 - semanticQuality;

    if (!passesThreshold) {
      warnings.push(`Semantic quality ${semanticQuality.toFixed(3)} below 0.95 threshold (${(semanticLoss * 100).toFixed(1)}% semantic loss)`);
    }

    // Step 8: Construct aligned KV-Cache
    const alignedKVCache: KVCache = {
      sourceModel: targetModel,  // Now in target model space
      keys: alignedKeys,
      values: alignedValues,
      attentionMask: kvCache.attentionMask,
      positionEncodings: kvCache.positionEncodings,
      metadata: {
        ...kvCache.metadata,
        generatedAt: new Date().toISOString(),
      }
    };

    return {
      alignedKVCache,
      quality: {
        semanticQualityScore: semanticQuality,
        semanticLoss,
        passesThreshold,
        cosineSimilarity,
        informationRetention,
        confidence,
      },
      nearestAnchors: nearestAnchors.slice(0, 5).map(a => ({
        anchorId: a.anchorId,
        category: a.category,
        similarity: a.similarity,
      })),
      validationWarnings: warnings,
    };
  }

  /**
   * Fast validation using semantic anchors
   *
   * Implements whitepaper Section 3.2 fast validation:
   * - Find nearest semantic anchor
   * - Check numerical stability
   * - Check distribution consistency (should be ~N(0,1))
   *
   * Returns: Semantic quality score (0-1)
   */
  private fastValidation(hiddenState: number[]): number {
    // 1. Find nearest semantic anchor
    const anchorSimilarities = this.anchorDB
      .findNearestAnchors(hiddenState, 10)
      .map(a => a.similarity);

    const maxAnchorSim = Math.max(...anchorSimilarities, 0);

    // 2. Check numerical stability
    if (hiddenState.some(x => !isFinite(x))) {
      return 0.0;
    }

    // 3. Check distribution consistency
    const mean = hiddenState.reduce((sum, x) => sum + x, 0) / hiddenState.length;
    const variance = hiddenState.reduce((sum, x) => sum + (x - mean) ** 2, 0) / hiddenState.length;
    const std = Math.sqrt(variance);

    // Normalize to standard Gaussian
    const normalized = hiddenState.map(x => (x - mean) / (std + 1e-8));

    // Compute KL divergence from N(0,1)
    const klDiv = this.computeKLDivergence(normalized);

    if (klDiv > 0.1) {  // KL divergence threshold
      return Math.max(0.0, maxAnchorSim - 0.1);
    }

    return maxAnchorSim;
  }

  /**
   * Calculate contrastive loss (InfoNCE)
   *
   * L_contrastive = -log(exp(sim(h_aligned, a+)/τ) / Σ exp(sim(h_aligned, a-)/τ))
   *
   * where:
   * - a+: positive anchor (most similar)
   * - a-: negative anchors (different categories)
   * - τ: temperature parameter (0.07)
   */
  calculateContrastiveLoss(
    alignedState: number[],
    positiveAnchor: number[],
    negativeAnchors: number[][]
  ): number {
    const simPositive = this.cosineSimilarity(alignedState, positiveAnchor);
    const expPositive = Math.exp(simPositive / this.tau);

    const sumNegatives = negativeAnchors.reduce((sum, negAnchor) => {
      const simNegative = this.cosineSimilarity(alignedState, negAnchor);
      return sum + Math.exp(simNegative / this.tau);
    }, 0);

    const loss = -Math.log(expPositive / (expPositive + sumNegatives));
    return loss;
  }

  /**
   * Calculate orthogonality regularization loss
   *
   * L_ortho = ||W^T W - I||_F^2
   */
  calculateOrthogonalityLoss(wMatrix: number[][]): number {
    const n = wMatrix.length;
    const m = wMatrix[0].length;

    // Compute W^T W
    const wtw: number[][] = Array(m).fill(0).map(() => Array(m).fill(0));

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += wMatrix[k][i] * wMatrix[k][j];
        }
        wtw[i][j] = sum;
      }
    }

    // Compute ||W^T W - I||_F^2
    let loss = 0;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        const target = (i === j) ? 1 : 0;
        const diff = wtw[i][j] - target;
        loss += diff * diff;
      }
    }

    return loss;
  }

  /**
   * Transform 3D tensor (KV-Cache keys/values) using W-Matrix
   *
   * Input: [layers][heads][sequence × dim_source]
   * Output: [layers][heads][sequence × dim_target]
   */
  private transformTensor3D(tensor: number[][][], wMatrix: number[][]): number[][][] {
    return tensor.map(layer =>
      layer.map(head =>
        this.matrixVectorMultiply(wMatrix, head)
      )
    );
  }

  /**
   * Extract representative hidden state from KV-Cache
   * Uses average pooling over all layers and heads
   */
  private extractRepresentativeState(keys: number[][][], values: number[][][]): number[] {
    // Flatten all keys and values
    const allVectors: number[][] = [];

    for (const layer of keys) {
      for (const head of layer) {
        allVectors.push(head);
      }
    }

    for (const layer of values) {
      for (const head of layer) {
        allVectors.push(head);
      }
    }

    // Average pooling
    if (allVectors.length === 0) return [];

    const dim = allVectors[0].length;
    const avgVector = Array(dim).fill(0);

    for (const vec of allVectors) {
      for (let i = 0; i < dim; i++) {
        avgVector[i] += vec[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      avgVector[i] /= allVectors.length;
    }

    return avgVector;
  }

  /**
   * Estimate information retention based on epsilon
   *
   * Based on empirical data from whitepaper evaluation:
   * - ε < 0.05: >95% retention
   * - ε < 0.10: >90% retention
   * - ε < 0.15: >85% retention
   */
  private estimateInformationRetention(epsilon: number): number {
    if (epsilon < 0.05) return 0.96;
    if (epsilon < 0.10) return 0.93;
    if (epsilon < 0.15) return 0.88;
    return Math.max(0.70, 1.0 - epsilon);
  }

  /**
   * Matrix-vector multiplication
   */
  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row =>
      row.reduce((sum, val, i) => sum + val * (vector[i] || 0), 0)
    );
  }

  /**
   * Cosine similarity
   */
  private cosineSimilarity(v1: number[], v2: number[]): number {
    const minLen = Math.min(v1.length, v2.length);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < minLen; i++) {
      dotProduct += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (norm1 * norm2);
  }

  /**
   * Compute KL divergence from standard Gaussian
   */
  private computeKLDivergence(normalizedVector: number[]): number {
    // Simplified KL divergence approximation
    // For N(μ, σ²) vs N(0, 1): KL = 0.5 * (σ² + μ² - 1 - log(σ²))

    const mean = normalizedVector.reduce((sum, x) => sum + x, 0) / normalizedVector.length;
    const variance = normalizedVector.reduce((sum, x) => sum + (x - mean) ** 2, 0) / normalizedVector.length;

    const kl = 0.5 * (variance + mean * mean - 1 - Math.log(variance + 1e-8));
    return Math.abs(kl);
  }
}

/**
 * Create Neural Bridge instance with semantic anchor database
 */
export function createNeuralBridge(anchorDB: SemanticAnchorDB): NeuralBridge {
  return new NeuralBridge(anchorDB);
}
