/**
 * Tests for KV-Cache Compression Algorithm
 */

import { describe, it, expect } from 'vitest';
import {
  KVCacheCompressor,
  createKVCacheCompressor,
  generateRandomKVCache,
} from './kv-cache-compressor';

describe('KV-Cache Compressor', () => {
  describe('Attention Weight Calculation', () => {
    it('should calculate attention weights that sum to 1', () => {
      const compressor = createKVCacheCompressor();
      const dim = 64;
      const numTokens = 100;

      const { keys, queries } = generateRandomKVCache(numTokens, dim);
      const weights = compressor.calculateAttentionWeights(queries, keys);

      // Sum should be approximately 1 (softmax property)
      const sum = weights.reduce((acc, w) => acc + w.weight, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should return weights for all tokens', () => {
      const compressor = createKVCacheCompressor();
      const dim = 64;
      const numTokens = 50;

      const { keys, queries } = generateRandomKVCache(numTokens, dim);
      const weights = compressor.calculateAttentionWeights(queries, keys);

      expect(weights.length).toBe(numTokens);
    });

    it('should have all weights between 0 and 1', () => {
      const compressor = createKVCacheCompressor();
      const dim = 64;
      const numTokens = 50;

      const { keys, queries } = generateRandomKVCache(numTokens, dim);
      const weights = compressor.calculateAttentionWeights(queries, keys);

      for (const w of weights) {
        expect(w.weight).toBeGreaterThanOrEqual(0);
        expect(w.weight).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Token Selection', () => {
    it('should select tokens with >90% cumulative attention', () => {
      const compressor = createKVCacheCompressor({ attentionThreshold: 0.90 });

      // Create mock weights with clear distribution
      const weights = [
        { tokenIndex: 0, weight: 0.5 },
        { tokenIndex: 1, weight: 0.3 },
        { tokenIndex: 2, weight: 0.15 },
        { tokenIndex: 3, weight: 0.04 },
        { tokenIndex: 4, weight: 0.01 },
      ];

      const selected = compressor.selectTopTokens(weights);

      // Should select first 3 tokens (0.5 + 0.3 + 0.15 = 0.95 > 0.90)
      expect(selected.length).toBeGreaterThanOrEqual(3);
      expect(selected).toContain(0);
      expect(selected).toContain(1);
      expect(selected).toContain(2);
    });

    it('should respect minimum token count', () => {
      const compressor = createKVCacheCompressor({
        attentionThreshold: 0.99,
        minTokens: 20,
      });

      const dim = 64;
      const numTokens = 100;
      const { keys, queries } = generateRandomKVCache(numTokens, dim);
      const weights = compressor.calculateAttentionWeights(queries, keys);
      const selected = compressor.selectTopTokens(weights);

      expect(selected.length).toBeGreaterThanOrEqual(20);
    });

    it('should respect maximum token count', () => {
      const compressor = createKVCacheCompressor({
        attentionThreshold: 0.50, // Low threshold
        maxTokens: 30,
      });

      const dim = 64;
      const numTokens = 100;
      const { keys, queries } = generateRandomKVCache(numTokens, dim);
      const weights = compressor.calculateAttentionWeights(queries, keys);
      const selected = compressor.selectTopTokens(weights);

      expect(selected.length).toBeLessThanOrEqual(30);
    });
  });

  describe('Compression', () => {
    it('should compress KV-Cache successfully', () => {
      const compressor = createKVCacheCompressor();
      const dim = 64;
      const numTokens = 100;

      const { keys, values, queries } = generateRandomKVCache(numTokens, dim);
      const compressed = compressor.compress(keys, values, queries);

      expect(compressed.totalTokens).toBe(numTokens);
      expect(compressed.selectedTokens).toBeLessThan(numTokens);
      expect(compressed.compressionRatio).toBeLessThan(1);
      expect(compressed.cumulativeAttention).toBeGreaterThanOrEqual(0.90);
    });

    it('should achieve >90% cumulative attention', () => {
      const compressor = createKVCacheCompressor({ attentionThreshold: 0.90 });
      const dim = 64;
      const numTokens = 100;

      const { keys, values, queries } = generateRandomKVCache(numTokens, dim);
      const compressed = compressor.compress(keys, values, queries);

      expect(compressed.cumulativeAttention).toBeGreaterThanOrEqual(0.90);
    });

    it('should throw error if keys and values length mismatch', () => {
      const compressor = createKVCacheCompressor();
      const dim = 64;

      const { keys, values, queries } = generateRandomKVCache(100, dim);
      values.pop(); // Remove one value

      expect(() => compressor.compress(keys, values, queries)).toThrow(
        'Keys and values must have same length'
      );
    });

    it('should maintain token order in compressed cache', () => {
      const compressor = createKVCacheCompressor();
      const dim = 64;
      const numTokens = 50;

      const { keys, values, queries } = generateRandomKVCache(numTokens, dim);
      const compressed = compressor.compress(keys, values, queries);

      // Check that token indices are in ascending order
      for (let i = 1; i < compressed.entries.length; i++) {
        expect(compressed.entries[i].tokenIndex).toBeGreaterThan(
          compressed.entries[i - 1].tokenIndex
        );
      }
    });
  });

  describe('Decompression', () => {
    it('should decompress to original length', () => {
      const compressor = createKVCacheCompressor();
      const dim = 64;
      const numTokens = 100;

      const { keys, values, queries } = generateRandomKVCache(numTokens, dim);
      const compressed = compressor.compress(keys, values, queries);
      const decompressed = compressor.decompress(compressed, numTokens);

      expect(decompressed.keys.length).toBe(numTokens);
      expect(decompressed.values.length).toBe(numTokens);
    });

    it('should preserve selected token values', () => {
      const compressor = createKVCacheCompressor();
      const dim = 64;
      const numTokens = 100;

      const { keys, values, queries } = generateRandomKVCache(numTokens, dim);
      const compressed = compressor.compress(keys, values, queries);
      const decompressed = compressor.decompress(compressed, numTokens);

      // Check that selected tokens match original
      for (const entry of compressed.entries) {
        const idx = entry.tokenIndex;
        expect(decompressed.keys[idx]).toEqual(entry.key);
        expect(decompressed.values[idx]).toEqual(entry.value);
      }
    });
  });

  describe('Bandwidth Estimation', () => {
    it('should calculate bandwidth savings', () => {
      const compressor = createKVCacheCompressor();
      const dim = 64;
      const numTokens = 100;

      const { keys, values, queries } = generateRandomKVCache(numTokens, dim);
      const compressed = compressor.compress(keys, values, queries);
      const savings = compressor.estimateBandwidthSavings(compressed);

      expect(savings.originalSize).toBeGreaterThan(0);
      expect(savings.compressedSize).toBeGreaterThan(0);
      expect(savings.compressedSize).toBeLessThan(savings.originalSize);
      expect(savings.savingsBytes).toBeGreaterThan(0);
      expect(savings.savingsPercent).toBeGreaterThan(0);
      expect(savings.savingsPercent).toBeLessThan(100);
    });

    it('should show significant bandwidth reduction', () => {
      const compressor = createKVCacheCompressor();
      const dim = 128;
      const numTokens = 200;

      const { keys, values, queries } = generateRandomKVCache(numTokens, dim);
      const compressed = compressor.compress(keys, values, queries);
      const savings = compressor.estimateBandwidthSavings(compressed);

      // Should save at least 10% bandwidth
      expect(savings.savingsPercent).toBeGreaterThan(10);
    });
  });

  describe('Integration Test', () => {
    it('should perform full compression-decompression cycle', () => {
      const compressor = createKVCacheCompressor({
        attentionThreshold: 0.90,
        minTokens: 10,
        maxTokens: 100,
      });

      const dim = 128;
      const numTokens = 200;

      const { keys, values, queries } = generateRandomKVCache(numTokens, dim);

      // Compress
      const compressed = compressor.compress(keys, values, queries);
      expect(compressed.cumulativeAttention).toBeGreaterThanOrEqual(0.90);

      // Estimate savings
      const savings = compressor.estimateBandwidthSavings(compressed);
      expect(savings.savingsPercent).toBeGreaterThan(0);

      // Decompress
      const decompressed = compressor.decompress(compressed, numTokens);
      expect(decompressed.keys.length).toBe(numTokens);
      expect(decompressed.values.length).toBe(numTokens);

      // Verify selected tokens preserved
      for (const entry of compressed.entries) {
        expect(decompressed.keys[entry.tokenIndex]).toEqual(entry.key);
        expect(decompressed.values[entry.tokenIndex]).toEqual(entry.value);
      }

      console.log(`✓ Compression test passed:`);
      console.log(`  - Original tokens: ${compressed.totalTokens}`);
      console.log(`  - Selected tokens: ${compressed.selectedTokens}`);
      console.log(
        `  - Compression ratio: ${(compressed.compressionRatio * 100).toFixed(1)}%`
      );
      console.log(
        `  - Cumulative attention: ${(compressed.cumulativeAttention * 100).toFixed(2)}%`
      );
      console.log(
        `  - Bandwidth savings: ${savings.savingsPercent.toFixed(1)}%`
      );
    });
  });
});
