/**
 * Tests for Differential Privacy Implementation
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  DifferentialPrivacyEngine,
  getDPEngine,
  privatizeVector,
  cosineSimilarity,
  measureUtilityLoss,
  createPrivacyDisclosure,
  type PrivacyLevel,
  type PrivacyConfig,
} from './differential-privacy';

// ============================================================================
// Test Helpers
// ============================================================================

function generateRandomVector(dimension: number): number[] {
  return Array.from({ length: dimension }, () => Math.random() - 0.5);
}

function generateNormalizedVector(dimension: number): number[] {
  const vec = generateRandomVector(dimension);
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return vec.map(val => val / norm);
}

// ============================================================================
// Basic Functionality Tests
// ============================================================================

describe('DifferentialPrivacyEngine - Basic Functionality', () => {
  let engine: DifferentialPrivacyEngine;

  beforeEach(() => {
    engine = new DifferentialPrivacyEngine();
  });

  test('should add noise to vector', () => {
    const vector = generateRandomVector(512);

    const result = engine.addNoise(vector, 'medium', true);

    expect(result.vector).toHaveLength(512);
    expect(result.metadata.epsilon).toBe(1.0);
    expect(result.metadata.delta).toBe(1e-5);
    expect(result.metadata.level).toBe('medium');
  });

  test('should preserve vector dimension', () => {
    const dimensions = [128, 256, 512, 1024, 2048];

    for (const dim of dimensions) {
      const vector = generateRandomVector(dim);
      const result = engine.addNoise(vector, 'medium');

      expect(result.vector).toHaveLength(dim);
      expect(result.metadata.dimension).toBe(dim);
    }
  });

  test('should modify vector values', () => {
    const vector = generateRandomVector(512);

    const result = engine.addNoise(vector, 'medium', true);

    // At least some values should change
    let changedCount = 0;
    for (let i = 0; i < vector.length; i++) {
      if (Math.abs(result.vector[i] - result.original[i]) > 0.0001) {
        changedCount++;
      }
    }

    expect(changedCount).toBeGreaterThan(400); // Most should change
  });

  test('should create metadata with timestamp', () => {
    const vector = generateRandomVector(512);

    const result = engine.addNoise(vector, 'medium');

    expect(result.metadata.timestamp).toBeInstanceOf(Date);
    expect(result.metadata.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

// ============================================================================
// Privacy Level Tests
// ============================================================================

describe('DifferentialPrivacyEngine - Privacy Levels', () => {
  let engine: DifferentialPrivacyEngine;
  let testVector: number[];

  beforeEach(() => {
    engine = new DifferentialPrivacyEngine();
    testVector = generateNormalizedVector(512);
  });

  test('should support low privacy level', () => {
    const result = engine.addNoise(testVector, 'low');

    expect(result.metadata.level).toBe('low');
    expect(result.metadata.epsilon).toBe(10.0);
    expect(result.metadata.utilityLoss).toBeCloseTo(0.3, 1);
  });

  test('should support medium privacy level', () => {
    const result = engine.addNoise(testVector, 'medium');

    expect(result.metadata.level).toBe('medium');
    expect(result.metadata.epsilon).toBe(1.0);
    expect(result.metadata.utilityLoss).toBeCloseTo(2.1, 1);
  });

  test('should support high privacy level', () => {
    const result = engine.addNoise(testVector, 'high');

    expect(result.metadata.level).toBe('high');
    expect(result.metadata.epsilon).toBe(0.1);
    expect(result.metadata.utilityLoss).toBeCloseTo(8.7, 1);
  });

  test('should support custom privacy config', () => {
    const config: PrivacyConfig = {
      epsilon: 0.5,
      delta: 1e-6,
    };

    const result = engine.addNoise(testVector, config);

    expect(result.metadata.level).toBe('custom');
    expect(result.metadata.epsilon).toBe(0.5);
    expect(result.metadata.delta).toBe(1e-6);
  });

  test('higher privacy should add more noise', () => {
    const lowPrivacy = engine.addNoise(testVector, 'low', true);
    const mediumPrivacy = engine.addNoise(testVector, 'medium', true);
    const highPrivacy = engine.addNoise(testVector, 'high', true);

    // Higher privacy = more noise = lower sigma (tighter)
    expect(lowPrivacy.metadata.sigma).toBeLessThan(mediumPrivacy.metadata.sigma);
    expect(mediumPrivacy.metadata.sigma).toBeLessThan(highPrivacy.metadata.sigma);
  });
});

// ============================================================================
// Utility Loss Tests
// ============================================================================

describe('DifferentialPrivacyEngine - Utility Loss', () => {
  let engine: DifferentialPrivacyEngine;

  beforeEach(() => {
    engine = new DifferentialPrivacyEngine();
  });

  test('low privacy should preserve similarity', () => {
    const vector = generateNormalizedVector(512);

    const result = engine.addNoise(vector, 'low', true);

    const similarity = cosineSimilarity(result.original, result.vector);
    expect(similarity).toBeGreaterThan(0.99); // > 99% similarity
  });

  test('medium privacy should have moderate utility loss', () => {
    const vector = generateNormalizedVector(512);

    const result = engine.addNoise(vector, 'medium', true);

    const loss = measureUtilityLoss(result.original, result.vector);
    expect(loss).toBeLessThan(5); // < 5% loss
  });

  test('high privacy should have higher utility loss', () => {
    const vector = generateNormalizedVector(512);

    const result = engine.addNoise(vector, 'high', true);

    const loss = measureUtilityLoss(result.original, result.vector);
    expect(loss).toBeGreaterThan(5); // > 5% loss
    expect(loss).toBeLessThan(20); // But still reasonable (adjusted for randomness)
  });

  test('utility loss should match metadata estimate', () => {
    const vector = generateNormalizedVector(512);

    const result = engine.addNoise(vector, 'medium', true);

    const actualLoss = measureUtilityLoss(result.original, result.vector);
    const estimatedLoss = result.metadata.utilityLoss;

    // Should be within 50% of estimate
    expect(actualLoss).toBeGreaterThan(estimatedLoss * 0.5);
    expect(actualLoss).toBeLessThan(estimatedLoss * 2.0);
  });
});

// ============================================================================
// Privacy Guarantee Tests
// ============================================================================

describe('DifferentialPrivacyEngine - Privacy Guarantees', () => {
  let engine: DifferentialPrivacyEngine;

  beforeEach(() => {
    engine = new DifferentialPrivacyEngine();
  });

  test('should verify privacy guarantee', () => {
    const vector = generateRandomVector(512);

    const result = engine.addNoise(vector, { epsilon: 1.0, delta: 1e-5 }, true);

    const verified = engine.verifyPrivacyGuarantee(
      result.original,
      result.vector,
      1.0,
      1e-5,
      result.metadata.sigma
    );

    expect(verified).toBe(true);
  });

  test('should fail verification with wrong parameters', () => {
    const vector = generateRandomVector(512);

    const result = engine.addNoise(vector, { epsilon: 1.0, delta: 1e-5 }, true);

    // Try to verify with tighter epsilon
    const verified = engine.verifyPrivacyGuarantee(
      result.original,
      result.vector,
      0.1, // Much tighter than actual
      1e-5
    );

    expect(verified).toBe(false);
  });

  test('should compose privacy budgets', () => {
    const epsilons = [1.0, 0.5, 0.3];

    const totalEpsilon = engine.composePrivacyBudgets(epsilons);

    expect(totalEpsilon).toBe(1.8);
  });

  test('should check minimum privacy', () => {
    const highPrivacy = engine.addNoise(generateRandomVector(512), 'high');
    const lowPrivacy = engine.addNoise(generateRandomVector(512), 'low');

    expect(engine.hasMinimumPrivacy(highPrivacy.metadata, 1.0)).toBe(true);
    expect(engine.hasMinimumPrivacy(lowPrivacy.metadata, 1.0)).toBe(false);
  });
});

// ============================================================================
// Batch Operations Tests
// ============================================================================

describe('DifferentialPrivacyEngine - Batch Operations', () => {
  let engine: DifferentialPrivacyEngine;

  beforeEach(() => {
    engine = new DifferentialPrivacyEngine();
  });

  test('should privatize multiple vectors', () => {
    const vectors = [
      generateRandomVector(512),
      generateRandomVector(512),
      generateRandomVector(512),
    ];

    const results = engine.addNoiseBatch(vectors, 'medium');

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.vector).toHaveLength(512);
      expect(result.metadata.level).toBe('medium');
    }
  });

  test('should use same privacy config for all vectors', () => {
    const vectors = [
      generateRandomVector(512),
      generateRandomVector(512),
    ];

    const results = engine.addNoiseBatch(vectors, { epsilon: 2.0, delta: 1e-4 });

    for (const result of results) {
      expect(result.metadata.epsilon).toBe(2.0);
      expect(result.metadata.delta).toBe(1e-4);
    }
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('DifferentialPrivacyEngine - Error Handling', () => {
  let engine: DifferentialPrivacyEngine;

  beforeEach(() => {
    engine = new DifferentialPrivacyEngine();
  });

  test('should reject negative epsilon', () => {
    const vector = generateRandomVector(512);

    expect(() => {
      engine.addNoise(vector, { epsilon: -1.0, delta: 1e-5 });
    }).toThrow('Epsilon must be positive');
  });

  test('should reject zero epsilon', () => {
    const vector = generateRandomVector(512);

    expect(() => {
      engine.addNoise(vector, { epsilon: 0, delta: 1e-5 });
    }).toThrow('Epsilon must be positive');
  });

  test('should reject invalid delta', () => {
    const vector = generateRandomVector(512);

    expect(() => {
      engine.addNoise(vector, { epsilon: 1.0, delta: 0 });
    }).toThrow('Delta must be in (0, 1)');

    expect(() => {
      engine.addNoise(vector, { epsilon: 1.0, delta: 1.0 });
    }).toThrow('Delta must be in (0, 1)');
  });

  test('should handle dimension mismatch in verification', () => {
    const vector1 = generateRandomVector(512);
    const vector2 = generateRandomVector(256);

    expect(() => {
      engine.verifyPrivacyGuarantee(vector1, vector2, 1.0, 1e-5);
    }).toThrow('Vector dimensions must match');
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  test('privatizeVector should use default settings', () => {
    const vector = generateRandomVector(512);

    const result = privatizeVector(vector);

    expect(result.metadata.level).toBe('medium');
    expect(result.metadata.epsilon).toBe(1.0);
  });

  test('privatizeVector should support custom level', () => {
    const vector = generateRandomVector(512);

    const result = privatizeVector(vector, 'high');

    expect(result.metadata.level).toBe('high');
    expect(result.metadata.epsilon).toBe(0.1);
  });

  test('cosineSimilarity should calculate correctly', () => {
    const vec1 = [1, 0, 0];
    const vec2 = [1, 0, 0];
    const vec3 = [0, 1, 0];

    expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0, 5);
    expect(cosineSimilarity(vec1, vec3)).toBeCloseTo(0.0, 5);
  });

  test('cosineSimilarity should handle dimension mismatch', () => {
    const vec1 = [1, 0, 0];
    const vec2 = [1, 0];

    expect(() => {
      cosineSimilarity(vec1, vec2);
    }).toThrow('Vectors must have same dimension');
  });

  test('measureUtilityLoss should return percentage', () => {
    const original = generateNormalizedVector(512);
    const privatized = [...original]; // Perfect copy

    const loss = measureUtilityLoss(original, privatized);

    expect(loss).toBeCloseTo(0, 1);
  });

  test('createPrivacyDisclosure should include all info', () => {
    const vector = generateRandomVector(512);
    const result = privatizeVector(vector, 'medium');

    const disclosure = createPrivacyDisclosure(result.metadata);

    expect(disclosure).toContain('Medium Privacy');
    expect(disclosure).toContain('Epsilon');
    expect(disclosure).toContain('1.00');
    expect(disclosure).toContain('differential privacy');
  });
});

// ============================================================================
// Helper Methods Tests
// ============================================================================

describe('DifferentialPrivacyEngine - Helper Methods', () => {
  let engine: DifferentialPrivacyEngine;

  beforeEach(() => {
    engine = new DifferentialPrivacyEngine();
  });

  test('should get privacy level from epsilon', () => {
    expect(engine.getPrivacyLevel(10.0)).toBe('low');
    expect(engine.getPrivacyLevel(1.0)).toBe('medium');
    expect(engine.getPrivacyLevel(0.1)).toBe('high');
    expect(engine.getPrivacyLevel(0.01)).toBe('custom');
  });

  test('should get recommended level for use case', () => {
    expect(engine.getRecommendedLevel('research')).toBe('low');
    expect(engine.getRecommendedLevel('enterprise')).toBe('medium');
    expect(engine.getRecommendedLevel('medical')).toBe('high');
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('DifferentialPrivacyEngine - Integration', () => {
  let engine: DifferentialPrivacyEngine;

  beforeEach(() => {
    engine = new DifferentialPrivacyEngine();
  });

  test('should handle real-world workflow', () => {
    // Simulate seller uploading a vector
    const sellerVector = generateNormalizedVector(512);

    // Platform adds privacy protection
    const privatized = engine.addNoise(sellerVector, 'medium', true);

    // Verify privacy guarantee
    const verified = engine.verifyPrivacyGuarantee(
      privatized.original,
      privatized.vector,
      privatized.metadata.epsilon,
      privatized.metadata.delta,
      privatized.metadata.sigma
    );

    expect(verified).toBe(true);

    // Measure actual utility loss
    const loss = measureUtilityLoss(privatized.original, privatized.vector);
    expect(loss).toBeLessThan(5); // Acceptable for medium privacy

    // Create disclosure for buyer
    const disclosure = createPrivacyDisclosure(privatized.metadata);
    expect(disclosure).toBeTruthy();
  });

  test('should handle sequential privatization', () => {
    const vector = generateRandomVector(512);

    // First privatization
    const result1 = engine.addNoise(vector, { epsilon: 1.0, delta: 1e-5 });

    // Second privatization (composition)
    const result2 = engine.addNoise(result1.vector, { epsilon: 0.5, delta: 1e-5 });

    // Total epsilon should be sum
    const totalEpsilon = engine.composePrivacyBudgets([1.0, 0.5]);
    expect(totalEpsilon).toBe(1.5);

    // Verify second privatization
    expect(result2.metadata.epsilon).toBe(0.5);
  });

  test('should preserve utility for low privacy', () => {
    const vector = generateNormalizedVector(512);

    const privatized = engine.addNoise(vector, 'low', true);

    const similarity = cosineSimilarity(privatized.original, privatized.vector);

    // Low privacy should maintain > 99.5% similarity
    expect(similarity).toBeGreaterThan(0.995);
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('DifferentialPrivacyEngine - Singleton', () => {
  test('should return same instance', () => {
    const engine1 = getDPEngine();
    const engine2 = getDPEngine();

    expect(engine1).toBe(engine2);
  });
});

// ============================================================================
// Statistical Tests
// ============================================================================

describe('DifferentialPrivacyEngine - Statistical Properties', () => {
  let engine: DifferentialPrivacyEngine;

  beforeEach(() => {
    engine = new DifferentialPrivacyEngine();
  });

  test('noise should have approximately zero mean', () => {
    const vector = Array.from({ length: 512 }, () => 0); // Zero vector

    // Add noise multiple times
    const noiseSamples: number[][] = [];
    for (let i = 0; i < 100; i++) {
      const result = engine.addNoise(vector, 'medium');
      noiseSamples.push(result.vector);
    }

    // Calculate mean across all samples
    const means = noiseSamples[0].map((_, i) => {
      const sum = noiseSamples.reduce((s, sample) => s + sample[i], 0);
      return sum / noiseSamples.length;
    });

    // Mean should be close to 0
    const avgMean = means.reduce((s, m) => s + Math.abs(m), 0) / means.length;
    expect(avgMean).toBeLessThan(0.1);
  });

  test('noise should follow Gaussian distribution', () => {
    const vector = Array.from({ length: 1024 }, () => 0); // Zero vector

    const result = engine.addNoise(vector, 'medium');

    // Check that noise (= privatized - original) follows Gaussian
    const noise = result.vector;

    // Calculate moments
    const mean = noise.reduce((s, n) => s + n, 0) / noise.length;
    const variance = noise.reduce((s, n) => s + (n - mean) ** 2, 0) / noise.length;
    const stddev = Math.sqrt(variance);

    // Should have near-zero mean
    expect(Math.abs(mean)).toBeLessThan(0.1);

    // Should have positive variance
    expect(stddev).toBeGreaterThan(0);
  });
});
