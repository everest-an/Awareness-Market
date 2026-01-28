/**
 * Tests for GPU Acceleration
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  GPUAccelerationEngine,
  getGPUEngine,
  initializeGPU,
  alignVector,
  normalizeVector,
  isTensorFlowAvailable,
  getRecommendedBatchSize,
  benchmarkBackends,
  type ComputeBackend,
} from './gpu-acceleration';

// ============================================================================
// Test Helpers
// ============================================================================

function generateRandomVector(dimension: number): number[] {
  return Array.from({ length: dimension }, () => Math.random() - 0.5);
}

function generateRandomMatrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => generateRandomVector(cols));
}

function generateIdentityMatrix(size: number): number[][] {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => (i === j ? 1 : 0))
  );
}

function vectorNorm(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
}

function cosineSimilarity(v1: number[], v2: number[]): number {
  const dot = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  const norm1 = vectorNorm(v1);
  const norm2 = vectorNorm(v2);
  return dot / (norm1 * norm2);
}

// ============================================================================
// Initialization Tests
// ============================================================================

describe('GPUAccelerationEngine - Initialization', () => {
  let engine: GPUAccelerationEngine;

  afterEach(() => {
    engine?.dispose();
  });

  test('should initialize with default config', async () => {
    engine = new GPUAccelerationEngine();
    await engine.initialize();

    expect(engine.getBackend()).toBe('cpu'); // Default
  });

  test('should initialize with custom backend', async () => {
    engine = new GPUAccelerationEngine({ backend: 'cpu' });
    await engine.initialize();

    expect(engine.getBackend()).toBe('cpu');
  });

  test('should fall back to CPU if GPU unavailable', async () => {
    engine = new GPUAccelerationEngine({
      backend: 'gpu',
      enableFallback: true,
    });
    await engine.initialize();

    // Will be CPU unless TensorFlow GPU is installed
    const backend = engine.getBackend();
    expect(['cpu', 'gpu']).toContain(backend);
  });

  test('should track initialization stats', async () => {
    engine = new GPUAccelerationEngine();
    await engine.initialize();

    const stats = engine.getStats();
    expect(stats.backend).toBeDefined();
    expect(stats.operationsCount).toBe(0);
  });
});

// ============================================================================
// Batch Alignment Tests
// ============================================================================

describe('GPUAccelerationEngine - Batch Alignment', () => {
  let engine: GPUAccelerationEngine;

  beforeEach(async () => {
    engine = new GPUAccelerationEngine({ backend: 'cpu' });
    await engine.initialize();
  });

  afterEach(() => {
    engine.dispose();
  });

  test('should align batch of vectors', async () => {
    const vectors = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];

    const wMatrix = generateIdentityMatrix(3);

    const result = await engine.alignBatch(vectors, wMatrix);

    expect(result.alignedVectors).toHaveLength(3);
    expect(result.backend).toBe('cpu');
    expect(result.batchSize).toBe(3);
    expect(result.computeTime).toBeGreaterThan(0);
  });

  test('should preserve vectors with identity matrix', async () => {
    const vectors = generateRandomMatrix(10, 512);
    const wMatrix = generateIdentityMatrix(512);

    const result = await engine.alignBatch(vectors, wMatrix);

    // Identity matrix should preserve vectors
    for (let i = 0; i < vectors.length; i++) {
      for (let j = 0; j < 512; j++) {
        expect(result.alignedVectors[i][j]).toBeCloseTo(vectors[i][j], 5);
      }
    }
  });

  test('should handle dimension transformation', async () => {
    const inputDim = 512;
    const outputDim = 768;

    const vectors = generateRandomMatrix(5, inputDim);
    const wMatrix = generateRandomMatrix(outputDim, inputDim);

    const result = await engine.alignBatch(vectors, wMatrix);

    expect(result.alignedVectors).toHaveLength(5);
    expect(result.alignedVectors[0]).toHaveLength(outputDim);
  });

  test('should handle large batches', async () => {
    const vectors = generateRandomMatrix(100, 256);
    const wMatrix = generateRandomMatrix(256, 256);

    const result = await engine.alignBatch(vectors, wMatrix);

    expect(result.alignedVectors).toHaveLength(100);
    expect(result.computeTime).toBeLessThan(1000); // Should complete in < 1s
  });

  test('should update statistics after operations', async () => {
    const vectors = generateRandomMatrix(10, 128);
    const wMatrix = generateRandomMatrix(128, 128);

    engine.resetStats();

    await engine.alignBatch(vectors, wMatrix);
    await engine.alignBatch(vectors, wMatrix);

    const stats = engine.getStats();
    expect(stats.operationsCount).toBe(2);
    expect(stats.totalTime).toBeGreaterThan(0);
    expect(stats.averageTime).toBeGreaterThan(0);
  });
});

// ============================================================================
// Normalization Tests
// ============================================================================

describe('GPUAccelerationEngine - Normalization', () => {
  let engine: GPUAccelerationEngine;

  beforeEach(async () => {
    engine = new GPUAccelerationEngine({ backend: 'cpu' });
    await engine.initialize();
  });

  afterEach(() => {
    engine.dispose();
  });

  test('should normalize vectors to unit length', async () => {
    const vectors = [
      [3, 4, 0],
      [1, 1, 1],
      [2, 0, 0],
    ];

    const normalized = await engine.normalizeBatch(vectors);

    // Check that each vector has norm ≈ 1
    for (const vector of normalized) {
      const norm = vectorNorm(vector);
      expect(norm).toBeCloseTo(1.0, 5);
    }
  });

  test('should preserve direction after normalization', async () => {
    const vectors = generateRandomMatrix(20, 512);

    const normalized = await engine.normalizeBatch(vectors);

    // Check that direction is preserved (cosine similarity ≈ 1)
    for (let i = 0; i < vectors.length; i++) {
      const similarity = cosineSimilarity(vectors[i], normalized[i]);
      expect(Math.abs(similarity)).toBeCloseTo(1.0, 5);
    }
  });

  test('should handle zero vectors', async () => {
    const vectors = [
      [0, 0, 0],
      [1, 1, 1],
    ];

    const normalized = await engine.normalizeBatch(vectors);

    // Zero vector should remain zero
    expect(normalized[0]).toEqual([0, 0, 0]);

    // Non-zero vector should be normalized
    const norm = vectorNorm(normalized[1]);
    expect(norm).toBeCloseTo(1.0, 5);
  });
});

// ============================================================================
// Cosine Similarity Tests
// ============================================================================

describe('GPUAccelerationEngine - Cosine Similarity', () => {
  let engine: GPUAccelerationEngine;

  beforeEach(async () => {
    engine = new GPUAccelerationEngine({ backend: 'cpu' });
    await engine.initialize();
  });

  afterEach(() => {
    engine.dispose();
  });

  test('should compute cosine similarity for identical vectors', async () => {
    const vectors1 = [
      [1, 0, 0],
      [0, 1, 0],
    ];
    const vectors2 = [
      [1, 0, 0],
      [0, 1, 0],
    ];

    const similarities = await engine.cosineSimilarityBatch(vectors1, vectors2);

    expect(similarities).toHaveLength(2);
    expect(similarities[0]).toBeCloseTo(1.0, 5);
    expect(similarities[1]).toBeCloseTo(1.0, 5);
  });

  test('should compute cosine similarity for orthogonal vectors', async () => {
    const vectors1 = [[1, 0, 0]];
    const vectors2 = [[0, 1, 0]];

    const similarities = await engine.cosineSimilarityBatch(vectors1, vectors2);

    expect(similarities[0]).toBeCloseTo(0.0, 5);
  });

  test('should compute cosine similarity for opposite vectors', async () => {
    const vectors1 = [[1, 0, 0]];
    const vectors2 = [[-1, 0, 0]];

    const similarities = await engine.cosineSimilarityBatch(vectors1, vectors2);

    expect(similarities[0]).toBeCloseTo(-1.0, 5);
  });

  test('should handle batch computation', async () => {
    const size = 50;
    const vectors1 = generateRandomMatrix(size, 256);
    const vectors2 = generateRandomMatrix(size, 256);

    const similarities = await engine.cosineSimilarityBatch(vectors1, vectors2);

    expect(similarities).toHaveLength(size);
    for (const sim of similarities) {
      expect(sim).toBeGreaterThanOrEqual(-1);
      expect(sim).toBeLessThanOrEqual(1);
    }
  });

  test('should throw error for mismatched batch sizes', async () => {
    const vectors1 = generateRandomMatrix(5, 128);
    const vectors2 = generateRandomMatrix(3, 128);

    await expect(
      engine.cosineSimilarityBatch(vectors1, vectors2)
    ).rejects.toThrow('Batch sizes must match');
  });
});

// ============================================================================
// Statistics Tests
// ============================================================================

describe('GPUAccelerationEngine - Statistics', () => {
  let engine: GPUAccelerationEngine;

  beforeEach(async () => {
    engine = new GPUAccelerationEngine({ backend: 'cpu' });
    await engine.initialize();
  });

  afterEach(() => {
    engine.dispose();
  });

  test('should track operation count', async () => {
    const vectors = generateRandomMatrix(10, 128);
    const wMatrix = generateRandomMatrix(128, 128);

    engine.resetStats();

    await engine.alignBatch(vectors, wMatrix);
    await engine.alignBatch(vectors, wMatrix);
    await engine.alignBatch(vectors, wMatrix);

    const stats = engine.getStats();
    expect(stats.operationsCount).toBe(3);
  });

  test('should calculate average time', async () => {
    const vectors = generateRandomMatrix(10, 128);
    const wMatrix = generateRandomMatrix(128, 128);

    engine.resetStats();

    await engine.alignBatch(vectors, wMatrix);
    await engine.alignBatch(vectors, wMatrix);

    const stats = engine.getStats();
    expect(stats.averageTime).toBeCloseTo(stats.totalTime / 2, 1);
  });

  test('should reset statistics', async () => {
    const vectors = generateRandomMatrix(10, 128);
    const wMatrix = generateRandomMatrix(128, 128);

    await engine.alignBatch(vectors, wMatrix);

    engine.resetStats();

    const stats = engine.getStats();
    expect(stats.operationsCount).toBe(0);
    expect(stats.totalTime).toBe(0);
    expect(stats.averageTime).toBe(0);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  test('alignVector should align single vector', async () => {
    const vector = [1, 0, 0];
    const wMatrix = generateIdentityMatrix(3);

    const aligned = await alignVector(vector, wMatrix);

    expect(aligned).toEqual(vector);
  });

  test('normalizeVector should normalize single vector', async () => {
    const vector = [3, 4, 0];

    const normalized = await normalizeVector(vector);

    const norm = vectorNorm(normalized);
    expect(norm).toBeCloseTo(1.0, 5);
  });

  test('isTensorFlowAvailable should check TensorFlow', async () => {
    const available = await isTensorFlowAvailable();

    expect(typeof available).toBe('boolean');
  });

  test('getRecommendedBatchSize should suggest batch sizes', () => {
    expect(getRecommendedBatchSize(256)).toBe(100);
    expect(getRecommendedBatchSize(512)).toBe(100);
    expect(getRecommendedBatchSize(1024)).toBe(50);
    expect(getRecommendedBatchSize(2048)).toBe(25);
    expect(getRecommendedBatchSize(4096)).toBe(10);
  });
});

// ============================================================================
// Backend Switching Tests
// ============================================================================

describe('GPUAccelerationEngine - Backend Switching', () => {
  let engine: GPUAccelerationEngine;

  beforeEach(() => {
    engine = new GPUAccelerationEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  test('should switch backends', async () => {
    await engine.initialize();
    expect(engine.getBackend()).toBe('cpu');

    await engine.setBackend('cpu');
    expect(engine.getBackend()).toBe('cpu');
  });

  test('should maintain functionality after backend switch', async () => {
    await engine.initialize();

    const vectors = generateRandomMatrix(5, 128);
    const wMatrix = generateRandomMatrix(128, 128);

    const result1 = await engine.alignBatch(vectors, wMatrix);

    await engine.setBackend('cpu');

    const result2 = await engine.alignBatch(vectors, wMatrix);

    expect(result2.alignedVectors).toHaveLength(result1.alignedVectors.length);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('GPUAccelerationEngine - Integration', () => {
  let engine: GPUAccelerationEngine;

  beforeEach(async () => {
    engine = new GPUAccelerationEngine({ backend: 'cpu' });
    await engine.initialize();
  });

  afterEach(() => {
    engine.dispose();
  });

  test('should handle complete alignment workflow', async () => {
    // Generate test data
    const inputVectors = generateRandomMatrix(20, 512);
    const wMatrix = generateRandomMatrix(768, 512);

    // Align vectors
    const alignResult = await engine.alignBatch(inputVectors, wMatrix);
    expect(alignResult.alignedVectors).toHaveLength(20);
    expect(alignResult.alignedVectors[0]).toHaveLength(768);

    // Normalize aligned vectors
    const normalized = await engine.normalizeBatch(alignResult.alignedVectors);
    expect(normalized).toHaveLength(20);

    // Verify normalization
    for (const vector of normalized) {
      const norm = vectorNorm(vector);
      expect(norm).toBeCloseTo(1.0, 5);
    }

    // Check statistics
    const stats = engine.getStats();
    expect(stats.operationsCount).toBe(1); // Only alignBatch counts
  });

  test('should handle similarity computation workflow', async () => {
    const vectors1 = generateRandomMatrix(30, 256);

    // Normalize vectors
    const normalized1 = await engine.normalizeBatch(vectors1);

    // Compute self-similarity
    const similarities = await engine.cosineSimilarityBatch(
      normalized1,
      normalized1
    );

    // Self-similarity should be 1.0
    for (const sim of similarities) {
      expect(sim).toBeCloseTo(1.0, 5);
    }
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('GPUAccelerationEngine - Performance', () => {
  test('should process large batches efficiently', async () => {
    const engine = new GPUAccelerationEngine({ backend: 'cpu' });
    await engine.initialize();

    const vectors = generateRandomMatrix(500, 512);
    const wMatrix = generateRandomMatrix(512, 512);

    const startTime = performance.now();
    await engine.alignBatch(vectors, wMatrix);
    const elapsedTime = performance.now() - startTime;

    // Should complete in reasonable time (< 5 seconds for CPU)
    expect(elapsedTime).toBeLessThan(5000);

    engine.dispose();
  });

  test('benchmarkBackends should compare performance', async () => {
    const vectors = generateRandomMatrix(50, 256);
    const wMatrix = generateRandomMatrix(256, 256);

    const benchmark = await benchmarkBackends(vectors, wMatrix);

    expect(benchmark.cpu.time).toBeGreaterThan(0);
    expect(benchmark.gpu.time).toBeGreaterThan(0);
    expect(benchmark.speedup).toBeGreaterThan(0);
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('GPUAccelerationEngine - Singleton', () => {
  test('should return same instance', () => {
    const engine1 = getGPUEngine();
    const engine2 = getGPUEngine();

    expect(engine1).toBe(engine2);
  });

  test('initializeGPU should return initialized engine', async () => {
    const engine = await initializeGPU({ backend: 'cpu' });

    expect(engine).toBeDefined();
    expect(engine.getBackend()).toBe('cpu');
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('GPUAccelerationEngine - Error Handling', () => {
  let engine: GPUAccelerationEngine;

  beforeEach(async () => {
    engine = new GPUAccelerationEngine({ backend: 'cpu' });
    await engine.initialize();
  });

  afterEach(() => {
    engine.dispose();
  });

  test('should handle empty batches gracefully', async () => {
    const vectors: number[][] = [];
    const wMatrix = generateRandomMatrix(128, 128);

    const result = await engine.alignBatch(vectors, wMatrix);

    expect(result.alignedVectors).toHaveLength(0);
  });

  test('should handle dimension mismatches', async () => {
    const vectors = generateRandomMatrix(10, 512);
    const wMatrix = generateRandomMatrix(256, 768); // Mismatched dimensions

    // Should still execute (result dimensions will be different)
    const result = await engine.alignBatch(vectors, wMatrix);

    // Output will have dimension matching wMatrix rows
    expect(result.alignedVectors[0]).toHaveLength(256);
  });
});
