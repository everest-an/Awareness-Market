/**
 * Production KV-Cache Compressor Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ProductionKVCacheCompressor,
  StreamingKVCacheCompressor,
  benchmarkCompression,
  MODEL_ADAPTERS,
  createProductionCompressor,
  createStreamingCompressor,
} from './kv-cache-compressor-production';

describe('ProductionKVCacheCompressor', () => {
  describe('Model Adapters', () => {
    it('should use model-specific threshold for GPT-4', () => {
      const compressor = new ProductionKVCacheCompressor('gpt-4');
      const adapter = compressor.getModelAdapter();
      
      expect(adapter.modelFamily).toBe('gpt');
      expect(adapter.attentionType).toBe('causal');
      expect(adapter.recommendedThreshold).toBe(0.92);
    });
    
    it('should use model-specific threshold for Claude', () => {
      const compressor = new ProductionKVCacheCompressor('claude-3.5-sonnet');
      const adapter = compressor.getModelAdapter();
      
      expect(adapter.modelFamily).toBe('claude');
      expect(adapter.attentionType).toBe('bidirectional');
      expect(adapter.recommendedThreshold).toBe(0.92);
    });
    
    it('should use sliding window for Mistral', () => {
      const compressor = new ProductionKVCacheCompressor('mistral-7b');
      const adapter = compressor.getModelAdapter();
      
      expect(adapter.attentionType).toBe('sliding-window');
      expect(adapter.windowSize).toBe(4096);
    });
    
    it('should use default adapter for unknown model', () => {
      const compressor = new ProductionKVCacheCompressor('unknown-model');
      const adapter = compressor.getModelAdapter();
      
      expect(adapter.modelFamily).toBe('unknown');
      expect(adapter.attentionType).toBe('causal');
      expect(adapter.recommendedThreshold).toBe(0.90);
    });
  });
  
  describe('Compression with Metrics', () => {
    it('should compress and return metrics', () => {
      const compressor = new ProductionKVCacheCompressor('gpt-4');
      
      // Generate test data
      const numTokens = 100;
      const dim = 128;
      const keys: number[][] = [];
      const values: number[][] = [];
      const queries: number[][] = [];
      
      for (let i = 0; i < numTokens; i++) {
        keys.push(Array.from({ length: dim }, () => Math.random() * 2 - 1));
        values.push(Array.from({ length: dim }, () => Math.random() * 2 - 1));
      }
      
      for (let i = 0; i < 5; i++) {
        queries.push(Array.from({ length: dim }, () => Math.random() * 2 - 1));
      }
      
      // Compress
      const { compressed, metrics } = compressor.compressWithMetrics(keys, values, queries);
      
      // Verify metrics
      expect(metrics.modelName).toBe('gpt-4');
      expect(metrics.attentionPattern).toBe('causal');
      expect(metrics.compressionTimeMs).toBeGreaterThan(0);
      expect(metrics.compressionRatio).toBeGreaterThan(0);
      expect(metrics.compressionRatio).toBeLessThanOrEqual(1);
      expect(metrics.tokenSavings).toBeGreaterThan(0);
      expect(metrics.bandwidthSavingsPercent).toBeGreaterThan(0);
      expect(metrics.cumulativeAttention).toBeGreaterThan(0.9);
      
      // Verify compressed data
      expect(compressed.selectedTokens).toBeLessThan(numTokens);
      expect(compressed.totalTokens).toBe(numTokens);
    });
    
    it('should store metrics for later retrieval', () => {
      const compressor = new ProductionKVCacheCompressor('gpt-3.5');
      
      const keys = [[1, 2], [3, 4], [5, 6]];
      const values = [[7, 8], [9, 10], [11, 12]];
      const queries = [[13, 14]];
      
      compressor.compressWithMetrics(keys, values, queries);
      
      const metrics = compressor.getMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics!.modelName).toBe('gpt-3.5');
    });
  });
  
  describe('Quality Validation', () => {
    it('should pass validation for good compression', () => {
      const compressor = new ProductionKVCacheCompressor('gpt-4');
      
      const numTokens = 200;
      const dim = 128;
      const keys: number[][] = [];
      const values: number[][] = [];
      const queries: number[][] = [];
      
      for (let i = 0; i < numTokens; i++) {
        keys.push(Array.from({ length: dim }, () => Math.random() * 2 - 1));
        values.push(Array.from({ length: dim }, () => Math.random() * 2 - 1));
      }
      
      for (let i = 0; i < 5; i++) {
        queries.push(Array.from({ length: dim }, () => Math.random() * 2 - 1));
      }
      
      const { compressed } = compressor.compressWithMetrics(keys, values, queries);
      const quality = compressor.validateQuality(compressed);
      
      expect(quality.passed).toBe(true);
      expect(quality.attentionCoverage).toBeGreaterThan(0.9);
      expect(quality.informationLoss).toBeLessThan(0.1);
    });
    
    it('should provide recommendations for poor compression', () => {
      const compressor = new ProductionKVCacheCompressor('gpt-4', {
        attentionThreshold: 0.5, // Very low threshold
      });
      
      const keys = [[1, 2], [3, 4], [5, 6]];
      const values = [[7, 8], [9, 10], [11, 12]];
      const queries = [[13, 14]];
      
      const { compressed } = compressor.compressWithMetrics(keys, values, queries);
      const quality = compressor.validateQuality(compressed);
      
      expect(quality.warnings.length).toBeGreaterThan(0);
      expect(quality.recommendations.length).toBeGreaterThan(0);
    });
  });
  
  describe('Factory Functions', () => {
    it('should create compressor via factory', () => {
      const compressor = createProductionCompressor('llama-3-8b');
      expect(compressor).toBeInstanceOf(ProductionKVCacheCompressor);
      
      const adapter = compressor.getModelAdapter();
      expect(adapter.modelFamily).toBe('llama');
    });
    
    it('should create streaming compressor via factory', () => {
      const compressor = createStreamingCompressor('qwen-7b', 64);
      expect(compressor).toBeInstanceOf(StreamingKVCacheCompressor);
    });
  });
});

describe('StreamingKVCacheCompressor', () => {
  it('should buffer tokens until chunk size reached', async () => {
    const compressor = new StreamingKVCacheCompressor('gpt-4', 10);
    
    // Add 5 tokens (below chunk size)
    const result1 = await compressor.addTokens(
      [[1], [2], [3], [4], [5]],
      [[6], [7], [8], [9], [10]],
      [[11]]
    );
    
    expect(result1).toBeNull(); // Not compressed yet
    
    // Add 5 more tokens (reaches chunk size)
    const result2 = await compressor.addTokens(
      [[12], [13], [14], [15], [16]],
      [[17], [18], [19], [20], [21]],
      [[22]]
    );
    
    expect(result2).not.toBeNull(); // Should compress
    expect(result2!.totalTokens).toBe(10);
  });
  
  it('should flush remaining buffer', () => {
    const compressor = new StreamingKVCacheCompressor('gpt-4', 100);
    
    compressor.addTokens(
      [[1], [2], [3]],
      [[4], [5], [6]],
      [[7]]
    );
    
    const result = compressor.flushBuffer();
    expect(result.totalTokens).toBe(3);
  });
  
  it('should stream compress async iterable', async () => {
    const compressor = new StreamingKVCacheCompressor('gpt-4', 5);
    
    // Create async iterable
    async function* generateChunks() {
      yield {
        keys: [[1], [2], [3]],
        values: [[4], [5], [6]],
        queries: [[7]],
      };
      yield {
        keys: [[8], [9], [10]],
        values: [[11], [12], [13]],
        queries: [[14]],
      };
      yield {
        keys: [[15], [16]],
        values: [[17], [18]],
        queries: [[19]],
      };
    }
    
    const results: any[] = [];
    for await (const compressed of compressor.streamCompress(generateChunks())) {
      results.push(compressed);
    }
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[results.length - 1].totalTokens).toBeGreaterThan(0);
  });
});

describe('Benchmarking', () => {
  it('should benchmark compression performance', async () => {
    const result = await benchmarkCompression('gpt-4', 100, 128, 3);
    
    expect(result.modelName).toBe('gpt-4');
    expect(result.numTokens).toBe(100);
    expect(result.dimension).toBe(128);
    expect(result.compressionTimeMs).toBeGreaterThan(0);
    expect(result.decompressionTimeMs).toBeGreaterThan(0);
    expect(result.compressionRatio).toBeGreaterThan(0);
    expect(result.bandwidthSavingsPercent).toBeGreaterThan(0);
    expect(result.attentionCoverage).toBeGreaterThan(0.9);
  });
  
  it('should benchmark different models', async () => {
    const models = ['gpt-4', 'claude-3-opus', 'llama-3-8b'];
    
    for (const model of models) {
      const result = await benchmarkCompression(model, 50, 64, 2);
      expect(result.modelName).toBe(model);
      expect(result.qualityPassed).toBe(true);
    }
  });
});

describe('Model Adapters Registry', () => {
  it('should have adapters for all major model families', () => {
    const expectedFamilies = ['gpt', 'claude', 'llama', 'mistral', 'qwen', 'deepseek'];
    
    const families = new Set(
      Object.values(MODEL_ADAPTERS).map(a => a.modelFamily)
    );
    
    for (const family of expectedFamilies) {
      expect(families.has(family)).toBe(true);
    }
  });
  
  it('should have different attention types', () => {
    const types = new Set(
      Object.values(MODEL_ADAPTERS).map(a => a.attentionType)
    );
    
    expect(types.has('causal')).toBe(true);
    expect(types.has('bidirectional')).toBe(true);
    expect(types.has('sliding-window')).toBe(true);
    expect(types.has('sparse')).toBe(true);
  });
});
