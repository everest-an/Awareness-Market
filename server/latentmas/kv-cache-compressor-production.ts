/**
 * LatentMAS v2 Production KV-Cache Compressor
 * 
 * Production-grade KV-Cache compression with:
 * - Model-specific adapters for different attention patterns
 * - Streaming compression for real-time processing
 * - Performance monitoring and benchmarking
 * - Quality validation and metrics
 * - Python SDK integration ready
 * 
 * Reference: LatentMAS v2 Paper Section 3.2 - Symmetric Focus Mechanism
 */

import { KVCacheCompressor, CompressedKVCache, KVCacheCompressionOptions } from './kv-cache-compressor';

// ============================================================================
// Model Adapters
// ============================================================================

export interface ModelAttentionPattern {
  modelFamily: string;
  attentionType: 'causal' | 'bidirectional' | 'sparse' | 'sliding-window';
  windowSize?: number;
  sparsityPattern?: string;
  recommendedThreshold: number;
}

export const MODEL_ADAPTERS: Record<string, ModelAttentionPattern> = {
  // GPT Family (Causal attention)
  'gpt-3.5': {
    modelFamily: 'gpt',
    attentionType: 'causal',
    recommendedThreshold: 0.90,
  },
  'gpt-4': {
    modelFamily: 'gpt',
    attentionType: 'causal',
    recommendedThreshold: 0.92,
  },
  'gpt-4o': {
    modelFamily: 'gpt',
    attentionType: 'causal',
    recommendedThreshold: 0.93,
  },
  
  // Claude Family (Bidirectional with causal masking)
  'claude-3-opus': {
    modelFamily: 'claude',
    attentionType: 'bidirectional',
    recommendedThreshold: 0.91,
  },
  'claude-3-sonnet': {
    modelFamily: 'claude',
    attentionType: 'bidirectional',
    recommendedThreshold: 0.90,
  },
  'claude-3.5-sonnet': {
    modelFamily: 'claude',
    attentionType: 'bidirectional',
    recommendedThreshold: 0.92,
  },
  
  // LLaMA Family (Causal with RoPE)
  'llama-2-7b': {
    modelFamily: 'llama',
    attentionType: 'causal',
    recommendedThreshold: 0.88,
  },
  'llama-2-70b': {
    modelFamily: 'llama',
    attentionType: 'causal',
    recommendedThreshold: 0.90,
  },
  'llama-3-8b': {
    modelFamily: 'llama',
    attentionType: 'causal',
    recommendedThreshold: 0.89,
  },
  'llama-3.1-70b': {
    modelFamily: 'llama',
    attentionType: 'causal',
    recommendedThreshold: 0.91,
  },
  
  // Mistral Family (Sliding window attention)
  'mistral-7b': {
    modelFamily: 'mistral',
    attentionType: 'sliding-window',
    windowSize: 4096,
    recommendedThreshold: 0.87,
  },
  'mixtral-8x7b': {
    modelFamily: 'mistral',
    attentionType: 'sliding-window',
    windowSize: 4096,
    recommendedThreshold: 0.88,
  },
  
  // Qwen Family
  'qwen-7b': {
    modelFamily: 'qwen',
    attentionType: 'causal',
    recommendedThreshold: 0.89,
  },
  'qwen-2.5-72b': {
    modelFamily: 'qwen',
    attentionType: 'causal',
    recommendedThreshold: 0.91,
  },
  
  // DeepSeek Family
  'deepseek-v2': {
    modelFamily: 'deepseek',
    attentionType: 'sparse',
    sparsityPattern: 'learned',
    recommendedThreshold: 0.85,
  },
  'deepseek-v3': {
    modelFamily: 'deepseek',
    attentionType: 'sparse',
    sparsityPattern: 'learned',
    recommendedThreshold: 0.86,
  },
};

// ============================================================================
// Performance Metrics
// ============================================================================

export interface CompressionMetrics {
  // Timing metrics
  compressionTimeMs: number;
  decompressionTimeMs: number;
  ttft: number; // Time to first token (ms)
  
  // Compression metrics
  compressionRatio: number;
  tokenSavings: number;
  bandwidthSavingsBytes: number;
  bandwidthSavingsPercent: number;
  
  // Quality metrics
  cumulativeAttention: number;
  selectedTokens: number;
  totalTokens: number;
  
  // Model-specific
  modelName: string;
  attentionPattern: string;
}

export interface QualityReport {
  passed: boolean;
  attentionCoverage: number; // Should be >= threshold
  informationLoss: number; // Estimated information loss (0-1)
  recommendations: string[];
  warnings: string[];
}

// ============================================================================
// Production KV-Cache Compressor
// ============================================================================

export class ProductionKVCacheCompressor extends KVCacheCompressor {
  private modelName: string;
  private modelAdapter: ModelAttentionPattern;
  private metrics: CompressionMetrics | null = null;
  
  constructor(modelName: string, options?: Partial<KVCacheCompressionOptions>) {
    // Get model adapter or use default
    const adapter = MODEL_ADAPTERS[modelName] || {
      modelFamily: 'unknown',
      attentionType: 'causal',
      recommendedThreshold: 0.90,
    };
    
    // Override threshold with model-specific recommendation
    const mergedOptions = {
      ...options,
      attentionThreshold: options?.attentionThreshold ?? adapter.recommendedThreshold,
    };
    
    super(mergedOptions);
    this.modelName = modelName;
    this.modelAdapter = adapter;
  }
  
  /**
   * Compress with performance monitoring
   */
  compressWithMetrics(
    keys: number[][],
    values: number[][],
    queries: number[][]
  ): { compressed: CompressedKVCache; metrics: CompressionMetrics } {
    const startTime = performance.now();
    
    // Perform compression
    const compressed = this.compress(keys, values, queries);
    
    const compressionTime = performance.now() - startTime;
    
    // Calculate bandwidth savings
    const bandwidth = this.estimateBandwidthSavings(compressed);
    
    // Build metrics
    const metrics: CompressionMetrics = {
      compressionTimeMs: compressionTime,
      decompressionTimeMs: 0, // Will be measured separately
      ttft: compressionTime, // Approximation
      compressionRatio: compressed.compressionRatio,
      tokenSavings: compressed.totalTokens - compressed.selectedTokens,
      bandwidthSavingsBytes: bandwidth.savingsBytes,
      bandwidthSavingsPercent: bandwidth.savingsPercent,
      cumulativeAttention: compressed.cumulativeAttention,
      selectedTokens: compressed.selectedTokens,
      totalTokens: compressed.totalTokens,
      modelName: this.modelName,
      attentionPattern: this.modelAdapter.attentionType,
    };
    
    this.metrics = metrics;
    
    return { compressed, metrics };
  }
  
  /**
   * Validate compression quality
   */
  validateQuality(compressed: CompressedKVCache): QualityReport {
    const recommendations: string[] = [];
    const warnings: string[] = [];
    
    // Check attention coverage
    const attentionCoverage = compressed.cumulativeAttention;
    const threshold = this.modelAdapter.recommendedThreshold;
    
    if (attentionCoverage < threshold) {
      warnings.push(
        `Attention coverage (${(attentionCoverage * 100).toFixed(2)}%) is below recommended threshold (${(threshold * 100).toFixed(2)}%)`
      );
      recommendations.push('Consider lowering attentionThreshold or increasing minTokens');
    }
    
    // Check compression ratio
    if (compressed.compressionRatio > 0.5) {
      warnings.push(
        `Compression ratio (${(compressed.compressionRatio * 100).toFixed(2)}%) is high - limited bandwidth savings`
      );
      recommendations.push('Consider increasing attentionThreshold for better compression');
    }
    
    // Check token count
    if (compressed.selectedTokens < 10) {
      warnings.push('Very few tokens selected - may lose important context');
      recommendations.push('Consider lowering attentionThreshold or decreasing minTokens');
    }
    
    // Estimate information loss (simplified)
    const informationLoss = 1 - attentionCoverage;
    
    const passed = attentionCoverage >= threshold && compressed.selectedTokens >= 10;
    
    return {
      passed,
      attentionCoverage,
      informationLoss,
      recommendations,
      warnings,
    };
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): CompressionMetrics | null {
    return this.metrics;
  }
  
  /**
   * Get model adapter info
   */
  getModelAdapter(): ModelAttentionPattern {
    return this.modelAdapter;
  }
}

// ============================================================================
// Streaming Compression
// ============================================================================

export interface StreamingKVCache {
  keys: number[][];
  values: number[][];
  queries: number[][];
  isComplete: boolean;
}

export class StreamingKVCacheCompressor {
  private compressor: ProductionKVCacheCompressor;
  private buffer: StreamingKVCache;
  private chunkSize: number;
  
  constructor(modelName: string, chunkSize: number = 128) {
    this.compressor = new ProductionKVCacheCompressor(modelName);
    this.chunkSize = chunkSize;
    this.buffer = {
      keys: [],
      values: [],
      queries: [],
      isComplete: false,
    };
  }
  
  /**
   * Add tokens to buffer and compress when chunk size reached
   */
  async addTokens(
    keys: number[][],
    values: number[][],
    queries: number[][]
  ): Promise<CompressedKVCache | null> {
    this.buffer.keys.push(...keys);
    this.buffer.values.push(...values);
    this.buffer.queries.push(...queries);
    
    // Compress when buffer reaches chunk size
    if (this.buffer.keys.length >= this.chunkSize) {
      return this.flushBuffer();
    }
    
    return null;
  }
  
  /**
   * Flush buffer and compress remaining tokens
   */
  flushBuffer(): CompressedKVCache {
    const compressed = this.compressor.compress(
      this.buffer.keys,
      this.buffer.values,
      this.buffer.queries
    );
    
    // Clear buffer
    this.buffer = {
      keys: [],
      values: [],
      queries: [],
      isComplete: true,
    };
    
    return compressed;
  }
  
  /**
   * Async generator for streaming compression
   */
  async *streamCompress(
    kvCacheStream: AsyncIterable<{ keys: number[][]; values: number[][]; queries: number[][] }>
  ): AsyncIterable<CompressedKVCache> {
    for await (const chunk of kvCacheStream) {
      const compressed = await this.addTokens(chunk.keys, chunk.values, chunk.queries);
      if (compressed) {
        yield compressed;
      }
    }
    
    // Flush remaining buffer
    if (this.buffer.keys.length > 0) {
      yield this.flushBuffer();
    }
  }
}

// ============================================================================
// Benchmarking Utilities
// ============================================================================

export interface BenchmarkResult {
  modelName: string;
  numTokens: number;
  dimension: number;
  compressionTimeMs: number;
  decompressionTimeMs: number;
  compressionRatio: number;
  bandwidthSavingsPercent: number;
  attentionCoverage: number;
  qualityPassed: boolean;
}

export async function benchmarkCompression(
  modelName: string,
  numTokens: number,
  dimension: number,
  iterations: number = 10
): Promise<BenchmarkResult> {
  const compressor = new ProductionKVCacheCompressor(modelName);
  
  const results: number[] = [];
  let finalCompressed: CompressedKVCache | null = null;
  let finalMetrics: CompressionMetrics | null = null;
  
  for (let i = 0; i < iterations; i++) {
    // Generate random KV-Cache
    const keys: number[][] = [];
    const values: number[][] = [];
    const queries: number[][] = [];
    
    for (let j = 0; j < numTokens; j++) {
      keys.push(Array.from({ length: dimension }, () => Math.random() * 2 - 1));
      values.push(Array.from({ length: dimension }, () => Math.random() * 2 - 1));
    }
    
    for (let j = 0; j < 5; j++) {
      queries.push(Array.from({ length: dimension }, () => Math.random() * 2 - 1));
    }
    
    // Compress with metrics
    const { compressed, metrics } = compressor.compressWithMetrics(keys, values, queries);
    results.push(metrics.compressionTimeMs);
    
    if (i === iterations - 1) {
      finalCompressed = compressed;
      finalMetrics = metrics;
    }
  }
  
  // Calculate average compression time
  const avgCompressionTime = results.reduce((a, b) => a + b, 0) / results.length;
  
  // Measure decompression time
  const decompressStart = performance.now();
  compressor.decompress(finalCompressed!, numTokens);
  const decompressionTime = performance.now() - decompressStart;
  
  // Validate quality
  const quality = compressor.validateQuality(finalCompressed!);
  
  return {
    modelName,
    numTokens,
    dimension,
    compressionTimeMs: avgCompressionTime,
    decompressionTimeMs: decompressionTime,
    compressionRatio: finalMetrics!.compressionRatio,
    bandwidthSavingsPercent: finalMetrics!.bandwidthSavingsPercent,
    attentionCoverage: finalMetrics!.cumulativeAttention,
    qualityPassed: quality.passed,
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createProductionCompressor(
  modelName: string,
  options?: Partial<KVCacheCompressionOptions>
): ProductionKVCacheCompressor {
  return new ProductionKVCacheCompressor(modelName, options);
}

export function createStreamingCompressor(
  modelName: string,
  chunkSize?: number
): StreamingKVCacheCompressor {
  return new StreamingKVCacheCompressor(modelName, chunkSize);
}

// ============================================================================
// Export all
// ============================================================================

// Re-export types from base compressor
export type { AttentionWeight, KVCacheEntry, CompressedKVCache, KVCacheCompressionOptions } from './kv-cache-compressor';
