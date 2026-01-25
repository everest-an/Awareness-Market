/**
 * LatentMAS v2 Enhancement A: Symmetric Focus KV-Cache Compression
 * 
 * Implements selective token transmission based on attention weights.
 * Only transmits tokens with >90% cumulative attention weight to reduce bandwidth.
 * 
 * Reference: LatentMAS v2 Paper Section 3.2 - Symmetric Focus Mechanism
 */

export interface AttentionWeight {
  tokenIndex: number;
  weight: number;
  token?: string;
}

export interface KVCacheEntry {
  key: number[];
  value: number[];
  tokenIndex: number;
  attentionWeight: number;
}

export interface CompressedKVCache {
  entries: KVCacheEntry[];
  compressionRatio: number;
  totalTokens: number;
  selectedTokens: number;
  cumulativeAttention: number;
}

export interface KVCacheCompressionOptions {
  attentionThreshold: number; // Default: 0.90 (90%)
  minTokens: number; // Minimum tokens to keep
  maxTokens: number; // Maximum tokens to keep
}

/**
 * KV-Cache Compressor using Symmetric Focus mechanism
 */
export class KVCacheCompressor {
  private options: KVCacheCompressionOptions;

  constructor(options?: Partial<KVCacheCompressionOptions>) {
    this.options = {
      attentionThreshold: options?.attentionThreshold ?? 0.90,
      minTokens: options?.minTokens ?? 10,
      maxTokens: options?.maxTokens ?? 2048,
    };
  }

  /**
   * Calculate attention weights using softmax over query-key similarities
   */
  calculateAttentionWeights(
    queries: number[][],
    keys: number[][]
  ): AttentionWeight[] {
    const numTokens = keys.length;
    const weights: AttentionWeight[] = [];

    // Calculate raw attention scores (simplified: use last query)
    const lastQuery = queries[queries.length - 1];
    const scores: number[] = [];

    for (let i = 0; i < numTokens; i++) {
      const key = keys[i];
      // Dot product similarity
      let score = 0;
      for (let j = 0; j < Math.min(lastQuery.length, key.length); j++) {
        score += lastQuery[j] * key[j];
      }
      scores.push(score);
    }

    // Apply softmax
    const maxScore = Math.max(...scores);
    const expScores = scores.map((s) => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const softmaxWeights = expScores.map((e) => e / sumExp);

    // Create weight objects
    for (let i = 0; i < numTokens; i++) {
      weights.push({
        tokenIndex: i,
        weight: softmaxWeights[i],
      });
    }

    return weights;
  }

  /**
   * Select top tokens based on cumulative attention weight
   */
  selectTopTokens(weights: AttentionWeight[]): number[] {
    // Sort by weight descending
    const sorted = [...weights].sort((a, b) => b.weight - a.weight);

    const selected: number[] = [];
    let cumulativeWeight = 0;

    for (const item of sorted) {
      selected.push(item.tokenIndex);
      cumulativeWeight += item.weight;

      // Stop when threshold reached and minimum tokens satisfied
      if (
        cumulativeWeight >= this.options.attentionThreshold &&
        selected.length >= this.options.minTokens
      ) {
        break;
      }

      // Hard limit on max tokens
      if (selected.length >= this.options.maxTokens) {
        break;
      }
    }

    // Sort selected indices back to original order
    return selected.sort((a, b) => a - b);
  }

  /**
   * Compress KV-Cache by selecting high-attention tokens
   */
  compress(
    keys: number[][],
    values: number[][],
    queries: number[][]
  ): CompressedKVCache {
    if (keys.length !== values.length) {
      throw new Error("Keys and values must have same length");
    }

    const totalTokens = keys.length;

    // Calculate attention weights
    const weights = this.calculateAttentionWeights(queries, keys);

    // Select top tokens
    const selectedIndices = this.selectTopTokens(weights);

    // Build compressed cache
    const entries: KVCacheEntry[] = selectedIndices.map((idx) => ({
      key: keys[idx],
      value: values[idx],
      tokenIndex: idx,
      attentionWeight: weights[idx].weight,
    }));

    // Calculate cumulative attention of selected tokens
    const cumulativeAttention = entries.reduce(
      (sum, e) => sum + e.attentionWeight,
      0
    );

    return {
      entries,
      compressionRatio: selectedIndices.length / totalTokens,
      totalTokens,
      selectedTokens: selectedIndices.length,
      cumulativeAttention,
    };
  }

  /**
   * Decompress KV-Cache back to full size (with zero-padding for removed tokens)
   */
  decompress(
    compressed: CompressedKVCache,
    originalLength: number
  ): { keys: number[][]; values: number[][] } {
    const keyDim = compressed.entries[0]?.key.length ?? 0;
    const valueDim = compressed.entries[0]?.value.length ?? 0;

    // Initialize with zeros
    const keys: number[][] = Array(originalLength)
      .fill(0)
      .map(() => Array(keyDim).fill(0));
    const values: number[][] = Array(originalLength)
      .fill(0)
      .map(() => Array(valueDim).fill(0));

    // Fill in compressed entries
    for (const entry of compressed.entries) {
      keys[entry.tokenIndex] = entry.key;
      values[entry.tokenIndex] = entry.value;
    }

    return { keys, values };
  }

  /**
   * Estimate bandwidth savings from compression
   */
  estimateBandwidthSavings(compressed: CompressedKVCache): {
    originalSize: number;
    compressedSize: number;
    savingsBytes: number;
    savingsPercent: number;
  } {
    const bytesPerFloat = 4; // Float32
    const dimsPerEntry =
      (compressed.entries[0]?.key.length ?? 0) +
      (compressed.entries[0]?.value.length ?? 0);

    const originalSize =
      compressed.totalTokens * dimsPerEntry * bytesPerFloat;
    const compressedSize =
      compressed.selectedTokens * dimsPerEntry * bytesPerFloat;
    const savingsBytes = originalSize - compressedSize;
    const savingsPercent = (savingsBytes / originalSize) * 100;

    return {
      originalSize,
      compressedSize,
      savingsBytes,
      savingsPercent,
    };
  }
}

/**
 * Factory function for creating compressor with default settings
 */
export function createKVCacheCompressor(
  options?: Partial<KVCacheCompressionOptions>
): KVCacheCompressor {
  return new KVCacheCompressor(options);
}

/**
 * Utility: Generate random KV-Cache for testing
 */
export function generateRandomKVCache(
  numTokens: number,
  dim: number
): { keys: number[][]; values: number[][]; queries: number[][] } {
  const keys: number[][] = [];
  const values: number[][] = [];
  const queries: number[][] = [];

  for (let i = 0; i < numTokens; i++) {
    keys.push(Array.from({ length: dim }, () => Math.random() * 2 - 1));
    values.push(Array.from({ length: dim }, () => Math.random() * 2 - 1));
  }

  // Generate a few queries
  for (let i = 0; i < 5; i++) {
    queries.push(Array.from({ length: dim }, () => Math.random() * 2 - 1));
  }

  return { keys, values, queries };
}
