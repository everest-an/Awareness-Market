/**
 * LatentMAS v2 API Integration Tests
 * 
 * Tests all 17 tRPC endpoints across 4 feature categories:
 * - KV-Cache Compression (3 endpoints)
 * - Dynamic W-Matrix Alignment (4 endpoints)
 * - Anti-Poisoning Verification (3 endpoints)
 * - Semantic Anchors (7 endpoints)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from '../routers';

// Mock context for testing
const mockContext = {
  req: {} as any,
  res: {} as any,
  user: {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'creator' as const,
  },
};

// Create caller using tRPC's createCallerFactory
const createCaller = appRouter.createCaller;
const caller = createCaller(mockContext);

describe('LatentMAS v2 API - KV-Cache Compression', () => {
  let sampleKVCache: { keys: number[][]; values: number[][]; queries: number[][] };

  beforeEach(() => {
    // Generate sample KV-Cache data
    const numTokens = 50;
    const dim = 32;
    sampleKVCache = {
      keys: Array.from({ length: numTokens }, () =>
        Array.from({ length: dim }, () => Math.random() * 2 - 1)
      ),
      values: Array.from({ length: numTokens }, () =>
        Array.from({ length: dim }, () => Math.random() * 2 - 1)
      ),
      queries: Array.from({ length: 3 }, () =>
        Array.from({ length: dim }, () => Math.random() * 2 - 1)
      ),
    };
  });

  it('should compress KV-Cache with default config', async () => {
    const result = await caller.latentmasV2.kvCache.compress({
      keys: sampleKVCache.keys,
      values: sampleKVCache.values,
      queries: sampleKVCache.queries,
    });

    expect(result.success).toBe(true);
    expect(result.compressed).toBeDefined();
    expect(result.stats.originalTokens).toBe(50);
    expect(result.stats.compressedTokens).toBeLessThan(50);
    expect(result.stats.compressionRatio).toBeGreaterThan(0);
    expect(result.stats.compressionRatio).toBeLessThanOrEqual(1);
    expect(result.stats.cumulativeAttention).toBeGreaterThanOrEqual(0.90);
  });

  it('should compress KV-Cache with custom config', async () => {
    const result = await caller.latentmasV2.kvCache.compress({
      keys: sampleKVCache.keys,
      values: sampleKVCache.values,
      queries: sampleKVCache.queries,
      config: {
        attentionThreshold: 0.95,
        minTokens: 5,
        maxTokens: 100,
      },
    });

    expect(result.success).toBe(true);
    expect(result.stats.cumulativeAttention).toBeGreaterThanOrEqual(0.95);
  });

  it('should decompress KV-Cache back to original size', async () => {
    const compressed = await caller.latentmasV2.kvCache.compress({
      keys: sampleKVCache.keys,
      values: sampleKVCache.values,
      queries: sampleKVCache.queries,
    });

    const decompressed = await caller.latentmasV2.kvCache.decompress({
      compressed: compressed.compressed,
      originalLength: sampleKVCache.keys.length,
    });

    expect(decompressed.success).toBe(true);
    expect(decompressed.keys.length).toBe(sampleKVCache.keys.length);
    expect(decompressed.values.length).toBe(sampleKVCache.values.length);
    expect(decompressed.stats.decompressedLength).toBe(sampleKVCache.keys.length);
  });

  it('should estimate bandwidth savings', async () => {
    const compressed = await caller.latentmasV2.kvCache.compress({
      keys: sampleKVCache.keys,
      values: sampleKVCache.values,
      queries: sampleKVCache.queries,
    });

    const bandwidth = await caller.latentmasV2.kvCache.estimateBandwidth({
      compressed: compressed.compressed,
      originalLength: sampleKVCache.keys.length,
      vectorDimension: 32,
    });

    expect(bandwidth.success).toBe(true);
    expect(bandwidth.bandwidth.originalSize).toBeGreaterThan(0);
    expect(bandwidth.bandwidth.compressedSize).toBeGreaterThan(0);
    expect(bandwidth.bandwidth.savingsBytes).toBeGreaterThan(0);
    expect(bandwidth.bandwidth.savingsPercent).toBeGreaterThan(0);
    expect(bandwidth.bandwidth.compressedSize).toBeLessThan(bandwidth.bandwidth.originalSize);
  });
});

describe('LatentMAS v2 API - Dynamic W-Matrix', () => {
  let matrixId: string;

  it('should create W-Matrix for cross-model alignment', async () => {
    const result = await caller.latentmasV2.wMatrix.create({
      sourceModel: 'gpt-3.5-turbo',
      targetModel: 'gpt-4',
      sourceDim: 128,
      targetDim: 256,
    });

    expect(result.success).toBe(true);
    expect(result.matrixId).toBeDefined();
    expect(result.metadata.sourceModel).toBe('gpt-3.5-turbo');
    expect(result.metadata.targetModel).toBe('gpt-4');
    expect(result.metadata.architecture).toContain('→');

    matrixId = result.matrixId;
  });

  it('should align vector using existing matrix', async () => {
    // Create matrix first
    const created = await caller.latentmasV2.wMatrix.create({
      sourceModel: 'gpt-3.5-turbo',
      targetModel: 'gpt-4',
      sourceDim: 128,
      targetDim: 256,
    });

    // Align vector
    const vector = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    const result = await caller.latentmasV2.wMatrix.align({
      matrixId: created.matrixId,
      vector,
    });

    expect(result.success).toBe(true);
    expect(result.result.alignedVector.length).toBe(256);
    expect(result.result.confidence).toBeGreaterThan(0);
    expect(result.result.confidence).toBeLessThanOrEqual(1);
    expect(result.result.alignmentLoss).toBeGreaterThanOrEqual(0);
    expect(result.result.transformationPath.length).toBeGreaterThan(0);
  });

  it('should align vector with temporary matrix', async () => {
    const vector = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    const result = await caller.latentmasV2.wMatrix.align({
      sourceModel: 'gpt-3.5-turbo',
      targetModel: 'gpt-4',
      sourceDim: 128,
      targetDim: 256,
      vector,
    });

    expect(result.success).toBe(true);
    expect(result.result.alignedVector.length).toBe(256);
  });

  it('should serialize W-Matrix to JSON', async () => {
    const created = await caller.latentmasV2.wMatrix.create({
      sourceModel: 'gpt-3.5-turbo',
      targetModel: 'gpt-4',
      sourceDim: 128,
      targetDim: 256,
    });

    const result = await caller.latentmasV2.wMatrix.serialize({
      matrixId: created.matrixId,
    });

    expect(result.success).toBe(true);
    expect(result.serialized).toBeDefined();
    expect(typeof result.serialized).toBe('string');

    // Should be valid JSON
    const parsed = JSON.parse(result.serialized);
    expect(parsed.sourceModel).toBe('gpt-3.5-turbo');
    expect(parsed.targetModel).toBe('gpt-4');
  });

  it('should deserialize W-Matrix from JSON', async () => {
    const created = await caller.latentmasV2.wMatrix.create({
      sourceModel: 'gpt-3.5-turbo',
      targetModel: 'gpt-4',
      sourceDim: 128,
      targetDim: 256,
    });

    const serialized = await caller.latentmasV2.wMatrix.serialize({
      matrixId: created.matrixId,
    });

    const result = await caller.latentmasV2.wMatrix.deserialize({
      serialized: serialized.serialized,
    });

    expect(result.success).toBe(true);
    expect(result.matrixId).toBeDefined();
    expect(result.metadata.sourceModel).toBe('gpt-3.5-turbo');
    expect(result.metadata.targetModel).toBe('gpt-4');
  });
});

describe('LatentMAS v2 API - Anti-Poisoning Verification', () => {
  it('should generate verification challenge', async () => {
    const result = await caller.latentmasV2.antiPoisoning.generateChallenge({
      config: {
        challengeSize: 10,
      },
    });

    expect(result.success).toBe(true);
    expect(result.challenge.id).toBeDefined();
    expect(result.challenge.testPrompts.length).toBe(10);
    expect(result.challenge.nonce).toBeDefined();
    expect(result.challenge.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should verify challenge response', async () => {
    const challenge = await caller.latentmasV2.antiPoisoning.generateChallenge({
      config: {
        challengeSize: 10,
      },
    });

    // Generate mock vector outputs
    const vectorOutputs = challenge.challenge.testPrompts.map(() =>
      Array.from({ length: 128 }, () => Math.random() * 2 - 1)
    );

    const result = await caller.latentmasV2.antiPoisoning.verify({
      challengeId: challenge.challenge.id,
      vectorOutputs,
      nonce: challenge.challenge.nonce,
    });

    expect(result.success).toBe(true);
    expect(result.result.passed).toBeDefined();
    expect(result.result.fidelityScore).toBeGreaterThanOrEqual(0);
    expect(result.result.fidelityScore).toBeLessThanOrEqual(1);
    expect(result.result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.result.confidence).toBeLessThanOrEqual(1);
    expect(result.result.anomalies).toBeInstanceOf(Array);
    expect(result.result.details.patternMatches).toBeGreaterThanOrEqual(0);
    expect(result.result.details.totalPatterns).toBeGreaterThanOrEqual(0);
  });

  it('should get challenge details', async () => {
    const challenge = await caller.latentmasV2.antiPoisoning.generateChallenge({
      config: {
        challengeSize: 10,
      },
    });

    const result = await caller.latentmasV2.antiPoisoning.getChallenge({
      challengeId: challenge.challenge.id,
    });

    expect(result.success).toBe(true);
    expect(result.challenge.id).toBe(challenge.challenge.id);
    expect(result.challenge.testPrompts.length).toBe(10);
    expect(result.challenge.expiresAt).toBeDefined();
  });
});

describe('LatentMAS v2 API - Semantic Anchors', () => {
  it('should get all semantic anchors', async () => {
    const result = await caller.latentmasV2.semanticAnchors.getAll();

    expect(result.success).toBe(true);
    expect(result.anchors.length).toBe(1024);
    expect(result.stats.totalAnchors).toBe(1024);
    expect(Object.keys(result.stats.categoryCounts).length).toBeGreaterThan(0);
  });

  it('should get anchors by category', async () => {
    const result = await caller.latentmasV2.semanticAnchors.getByCategory({
      category: 'factual_knowledge',
    });

    expect(result.success).toBe(true);
    expect(result.category).toBe('factual_knowledge');
    expect(result.anchors.length).toBeGreaterThan(0);
    expect(result.count).toBe(result.anchors.length);

    // All anchors should be from the requested category
    result.anchors.forEach((anchor) => {
      expect(anchor.category).toBe('factual_knowledge');
    });
  });

  it('should find nearest anchors to vector', async () => {
    // First, store some anchor vectors
    const vector1 = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    await caller.latentmasV2.semanticAnchors.storeAnchorVector({
      anchorId: 0,
      vector: vector1,
    });
    await caller.latentmasV2.semanticAnchors.storeAnchorVector({
      anchorId: 1,
      vector: Array.from({ length: 128 }, () => Math.random() * 2 - 1),
    });
    await caller.latentmasV2.semanticAnchors.storeAnchorVector({
      anchorId: 2,
      vector: Array.from({ length: 128 }, () => Math.random() * 2 - 1),
    });
    await caller.latentmasV2.semanticAnchors.storeAnchorVector({
      anchorId: 3,
      vector: Array.from({ length: 128 }, () => Math.random() * 2 - 1),
    });
    await caller.latentmasV2.semanticAnchors.storeAnchorVector({
      anchorId: 4,
      vector: Array.from({ length: 128 }, () => Math.random() * 2 - 1),
    });

    // Now search for nearest
    const queryVector = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    const result = await caller.latentmasV2.semanticAnchors.findNearest({
      vector: queryVector,
      topK: 5,
    });

    expect(result.success).toBe(true);
    expect(result.nearest.length).toBeGreaterThan(0);
    expect(result.nearest.length).toBeLessThanOrEqual(5);

    // Results should be sorted by similarity (descending)
    for (let i = 0; i < result.nearest.length - 1; i++) {
      expect(result.nearest[i].similarity).toBeGreaterThanOrEqual(result.nearest[i + 1].similarity);
    }

    // Each result should have required fields
    result.nearest.forEach((match) => {
      expect(match.anchorId).toBeGreaterThanOrEqual(0);
      expect(match.anchorId).toBeLessThan(1024);
      expect(match.similarity).toBeGreaterThanOrEqual(-1);
      expect(match.similarity).toBeLessThanOrEqual(1);
      expect(match.category).toBeDefined();
      expect(match.prompt).toBeDefined();
    });
  });

  it('should calibrate alignment quality', async () => {
    // Store some anchor vectors first
    for (let i = 0; i < 20; i++) {
      await caller.latentmasV2.semanticAnchors.storeAnchorVector({
        anchorId: i,
        vector: Array.from({ length: 128 }, () => Math.random() * 2 - 1),
      });
    }

    const vector = Array.from({ length: 128 }, () => Math.random() * 2 - 1);

    const result = await caller.latentmasV2.semanticAnchors.calibrate({
      vector,
    });

    expect(result.success).toBe(true);
    expect(result.calibration.anchors.length).toBe(20);
    // Calibration score can be negative in some edge cases
    expect(result.calibration.calibrationScore).toBeGreaterThanOrEqual(-1);
    expect(result.calibration.calibrationScore).toBeLessThanOrEqual(1);
    expect(result.calibration.coverage).toBeGreaterThanOrEqual(0);
    expect(result.calibration.coverage).toBeLessThanOrEqual(1);
    expect(result.calibration.recommendations).toBeInstanceOf(Array);
  });

  it('should store anchor vector', async () => {
    const vector = Array.from({ length: 128 }, () => Math.random() * 2 - 1);

    const result = await caller.latentmasV2.semanticAnchors.storeAnchorVector({
      anchorId: 0,
      vector,
    });

    expect(result.success).toBe(true);
    expect(result.anchorId).toBe(0);
  });

  it('should get all categories', async () => {
    const result = await caller.latentmasV2.semanticAnchors.getCategories();

    expect(result.success).toBe(true);
    expect(result.categories.length).toBe(16);
    expect(result.categories).toContain('factual_knowledge');
    expect(result.categories).toContain('logical_reasoning');
    expect(result.categories).toContain('creative_expression');
  });

  it('should get statistics', async () => {
    const result = await caller.latentmasV2.semanticAnchors.getStatistics();

    expect(result.success).toBe(true);
    expect(result.stats.totalAnchors).toBe(1024);
    expect(Object.keys(result.stats.categoryCounts).length).toBe(16);
    expect(result.stats.vectorsCached).toBeGreaterThanOrEqual(0);
  });
});

describe('LatentMAS v2 API - Integration Tests', () => {
  it('should complete full KV-Cache workflow', async () => {
    // 1. Compress
    const compressed = await caller.latentmasV2.kvCache.compress({
      keys: Array.from({ length: 50 }, () => Array.from({ length: 32 }, () => Math.random() * 2 - 1)),
      values: Array.from({ length: 50 }, () => Array.from({ length: 32 }, () => Math.random() * 2 - 1)),
      queries: Array.from({ length: 3 }, () => Array.from({ length: 32 }, () => Math.random() * 2 - 1)),
    });

    expect(compressed.success).toBe(true);

    // 2. Estimate bandwidth
    const bandwidth = await caller.latentmasV2.kvCache.estimateBandwidth({
      compressed: compressed.compressed,
      originalLength: 50,
      vectorDimension: 32,
    });

    expect(bandwidth.success).toBe(true);
    expect(bandwidth.bandwidth.savingsPercent).toBeGreaterThan(0);

    // 3. Decompress
    const decompressed = await caller.latentmasV2.kvCache.decompress({
      compressed: compressed.compressed,
      originalLength: 50,
    });

    expect(decompressed.success).toBe(true);
    expect(decompressed.keys.length).toBe(50);
  });

  it('should complete full W-Matrix workflow', async () => {
    // 1. Create matrix
    const created = await caller.latentmasV2.wMatrix.create({
      sourceModel: 'gpt-3.5-turbo',
      targetModel: 'gpt-4',
      sourceDim: 128,
      targetDim: 256,
    });

    expect(created.success).toBe(true);

    // 2. Align vector
    const vector = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    const aligned = await caller.latentmasV2.wMatrix.align({
      matrixId: created.matrixId,
      vector,
    });

    expect(aligned.success).toBe(true);
    expect(aligned.result.alignedVector.length).toBe(256);

    // 3. Serialize
    const serialized = await caller.latentmasV2.wMatrix.serialize({
      matrixId: created.matrixId,
    });

    expect(serialized.success).toBe(true);

    // 4. Deserialize
    const deserialized = await caller.latentmasV2.wMatrix.deserialize({
      serialized: serialized.serialized,
    });

    expect(deserialized.success).toBe(true);
  });

  it('should complete full anti-poisoning workflow', async () => {
    // 1. Generate challenge
    const challenge = await caller.latentmasV2.antiPoisoning.generateChallenge({
      config: { challengeSize: 10 },
    });

    expect(challenge.success).toBe(true);

    // 2. Get challenge details
    const details = await caller.latentmasV2.antiPoisoning.getChallenge({
      challengeId: challenge.challenge.id,
    });

    expect(details.success).toBe(true);

    // 3. Verify response
    const vectorOutputs = challenge.challenge.testPrompts.map(() =>
      Array.from({ length: 128 }, () => Math.random() * 2 - 1)
    );

    const verified = await caller.latentmasV2.antiPoisoning.verify({
      challengeId: challenge.challenge.id,
      vectorOutputs,
      nonce: challenge.challenge.nonce,
    });

    expect(verified.success).toBe(true);
  });

  it('should complete full semantic anchors workflow', async () => {
    // 1. Get all anchors
    const all = await caller.latentmasV2.semanticAnchors.getAll();
    expect(all.success).toBe(true);

    // 2. Get categories
    const categories = await caller.latentmasV2.semanticAnchors.getCategories();
    expect(categories.success).toBe(true);

    // 3. Get by category
    const byCategory = await caller.latentmasV2.semanticAnchors.getByCategory({
      category: categories.categories[0] as any,
    });
    expect(byCategory.success).toBe(true);

    // 4. Store anchor vector
    const vector = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    const stored = await caller.latentmasV2.semanticAnchors.storeAnchorVector({
      anchorId: 0,
      vector,
    });
    expect(stored.success).toBe(true);

    // 5. Find nearest
    const nearest = await caller.latentmasV2.semanticAnchors.findNearest({
      vector,
      topK: 5,
    });
    expect(nearest.success).toBe(true);

    // 6. Calibrate
    const calibrated = await caller.latentmasV2.semanticAnchors.calibrate({
      vector,
    });
    expect(calibrated.success).toBe(true);

    // 7. Get statistics
    const stats = await caller.latentmasV2.semanticAnchors.getStatistics();
    expect(stats.success).toBe(true);
  });
});
