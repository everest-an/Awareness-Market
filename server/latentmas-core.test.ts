/**
 * Tests for LatentMAS Core - Vector Alignment and Transformation
 */

import { describe, it, expect } from 'vitest';
import {
  alignVector,
  transformDimension,
  validateVector,
  getSupportedModels,
  cosineSimilarity,
  euclideanDistance,
  normalizeVector
} from './latentmas-core';

describe('LatentMAS Core - Vector Operations', () => {
  describe('normalizeVector', () => {
    it('should normalize a vector to unit length', () => {
      const vector = [3, 4]; // Length = 5
      const normalized = normalizeVector(vector);
      
      expect(normalized[0]).toBeCloseTo(0.6);
      expect(normalized[1]).toBeCloseTo(0.8);
      
      // Check magnitude is 1
      const magnitude = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
      expect(magnitude).toBeCloseTo(1.0);
    });

    it('should handle zero vector', () => {
      const vector = [0, 0, 0];
      const normalized = normalizeVector(vector);
      
      expect(normalized).toEqual([0, 0, 0]);
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1.0);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0.0);
    });

    it('should throw error for different dimensions', () => {
      const vec1 = [1, 0];
      const vec2 = [1, 0, 0];
      
      expect(() => cosineSimilarity(vec1, vec2)).toThrow();
    });
  });

  describe('euclideanDistance', () => {
    it('should calculate Euclidean distance correctly', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [3, 4, 0];
      
      const distance = euclideanDistance(vec1, vec2);
      expect(distance).toBeCloseTo(5.0);
    });

    it('should return 0 for identical vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2, 3];
      
      const distance = euclideanDistance(vec1, vec2);
      expect(distance).toBeCloseTo(0.0);
    });
  });

  describe('validateVector', () => {
    it('should validate a good vector', () => {
      const vector = Array(768).fill(0).map(() => Math.random() - 0.5);
      
      const validation = validateVector(vector, 768);
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.statistics.dimension).toBe(768);
      expect(validation.statistics.hasNaN).toBe(false);
      expect(validation.statistics.hasInf).toBe(false);
    });

    it('should detect NaN values', () => {
      const vector = [1, 2, NaN, 4];
      
      const validation = validateVector(vector);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Vector contains NaN values');
      expect(validation.statistics.hasNaN).toBe(true);
    });

    it('should detect Infinity values', () => {
      const vector = [1, 2, Infinity, 4];
      
      const validation = validateVector(vector);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Vector contains Infinity values');
      expect(validation.statistics.hasInf).toBe(true);
    });

    it('should detect dimension mismatch', () => {
      const vector = Array(512).fill(0.1);
      
      const validation = validateVector(vector, 768);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('Dimension mismatch'))).toBe(true);
    });

    it('should detect zero magnitude', () => {
      const vector = [0, 0, 0, 0];
      
      const validation = validateVector(vector);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Vector has zero magnitude');
    });

    it('should detect high sparsity', () => {
      const vector = Array(1000).fill(0);
      vector[0] = 1; // Only 1 non-zero element
      
      const validation = validateVector(vector);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('too sparse'))).toBe(true);
      expect(validation.statistics.sparsity).toBeGreaterThan(0.95);
    });
  });

  describe('alignVector', () => {
    it('should align vector between models', () => {
      const sourceVector = Array(768).fill(0).map(() => Math.random() - 0.5);
      
      const result = alignVector(
        sourceVector,
        'gpt-3.5',
        'bert',
        'linear'
      );
      
      expect(result.alignedVector).toBeDefined();
      expect(result.alignedVector.length).toBe(768);
      expect(result.quality.cosineSimilarity).toBeGreaterThan(0);
      expect(result.quality.cosineSimilarity).toBeLessThanOrEqual(1);
      expect(result.quality.confidence).toBeGreaterThan(0);
      expect(result.metadata.method).toBe('linear');
      expect(result.metadata.sourceDim).toBe(768);
      expect(result.metadata.targetDim).toBe(768);
    });

    it('should support different alignment methods', () => {
      const sourceVector = Array(768).fill(0).map(() => Math.random() - 0.5);
      
      const linearResult = alignVector(sourceVector, 'gpt-3.5', 'bert', 'linear');
      const nonlinearResult = alignVector(sourceVector, 'gpt-3.5', 'bert', 'nonlinear');
      
      expect(linearResult.metadata.method).toBe('linear');
      expect(nonlinearResult.metadata.method).toBe('nonlinear');
      
      // Nonlinear should produce different results
      expect(linearResult.alignedVector).not.toEqual(nonlinearResult.alignedVector);
    });

    it('should normalize output vectors', () => {
      const sourceVector = Array(768).fill(0).map(() => Math.random() - 0.5);
      
      const result = alignVector(sourceVector, 'gpt-3.5', 'bert', 'linear');
      
      // Check that output is normalized (magnitude ≈ 1)
      const magnitude = Math.sqrt(
        result.alignedVector.reduce((sum, v) => sum + v * v, 0)
      );
      expect(magnitude).toBeCloseTo(1.0, 1);
    });

    it('should handle unknown model pairs gracefully', () => {
      const sourceVector = Array(768).fill(0).map(() => Math.random() - 0.5);
      
      const result = alignVector(
        sourceVector,
        'unknown-model-1',
        'unknown-model-2',
        'linear'
      );
      
      expect(result.alignedVector).toBeDefined();
      expect(result.quality.confidence).toBeLessThan(0.9); // Lower confidence for unknown pairs
    });
  });

  describe('transformDimension', () => {
    it('should reduce dimensions correctly', () => {
      const vector = Array(768).fill(0).map(() => Math.random() - 0.5);
      
      const result = transformDimension(vector, 512, 'pca');
      
      expect(result.transformedVector.length).toBe(512);
      expect(result.metadata.sourceDim).toBe(768);
      expect(result.metadata.targetDim).toBe(512);
      expect(result.quality.informationRetained).toBeGreaterThan(0);
      expect(result.quality.informationRetained).toBeLessThanOrEqual(1);
    });

    it('should expand dimensions correctly', () => {
      const vector = Array(512).fill(0).map(() => Math.random() - 0.5);
      
      const result = transformDimension(vector, 1024, 'interpolation');
      
      expect(result.transformedVector.length).toBe(1024);
      expect(result.metadata.sourceDim).toBe(512);
      expect(result.metadata.targetDim).toBe(1024);
    });

    it('should handle same dimension (no-op)', () => {
      const vector = Array(768).fill(0).map(() => Math.random() - 0.5);
      
      const result = transformDimension(vector, 768, 'pca');
      
      expect(result.transformedVector.length).toBe(768);
      expect(result.quality.informationRetained).toBe(1.0);
    });

    it('should support different transformation methods', () => {
      const vector = Array(768).fill(0).map(() => Math.random() - 0.5);
      
      const pcaResult = transformDimension(vector, 512, 'pca');
      const interpResult = transformDimension(vector, 512, 'interpolation');
      
      expect(pcaResult.metadata.method).toBe('pca');
      expect(interpResult.metadata.method).toBe('interpolation');
      
      // PCA should retain more information
      expect(pcaResult.quality.informationRetained).toBeGreaterThanOrEqual(
        interpResult.quality.informationRetained
      );
    });

    it('should normalize output vectors', () => {
      const vector = Array(768).fill(0).map(() => Math.random() - 0.5);
      
      const result = transformDimension(vector, 1024, 'pca');
      
      const magnitude = Math.sqrt(
        result.transformedVector.reduce((sum, v) => sum + v * v, 0)
      );
      expect(magnitude).toBeCloseTo(1.0, 1);
    });
  });

  describe('getSupportedModels', () => {
    it('should return list of supported models', () => {
      const result = getSupportedModels();
      
      expect(result.models).toBeDefined();
      expect(result.models.length).toBeGreaterThan(0);
      expect(result.pairs).toBeDefined();
      expect(result.pairs.length).toBeGreaterThan(0);
    });

    it('should include expected models', () => {
      const result = getSupportedModels();
      
      expect(result.models).toContain('gpt-3.5');
      expect(result.models).toContain('bert');
      expect(result.models).toContain('gpt-4');
    });

    it('should include quality scores for pairs', () => {
      const result = getSupportedModels();
      
      result.pairs.forEach(pair => {
        expect(pair.source).toBeDefined();
        expect(pair.target).toBeDefined();
        expect(pair.quality).toBeGreaterThan(0);
        expect(pair.quality).toBeLessThanOrEqual(1);
      });
    });
  });
});

describe('LatentMAS Core - Integration Tests', () => {
  it('should complete full alignment workflow', () => {
    // 1. Create source vector
    const sourceVector = Array(768).fill(0).map(() => Math.random() - 0.5);
    
    // 2. Validate source
    const validation = validateVector(sourceVector, 768);
    expect(validation.isValid).toBe(true);
    
    // 3. Align to target model
    const alignment = alignVector(sourceVector, 'gpt-3.5', 'bert', 'linear');
    expect(alignment.alignedVector.length).toBe(768);
    
    // 4. Validate aligned vector
    const alignedValidation = validateVector(alignment.alignedVector, 768);
    expect(alignedValidation.isValid).toBe(true);
  });

  it('should complete full transformation workflow', () => {
    // 1. Create source vector
    const sourceVector = Array(768).fill(0).map(() => Math.random() - 0.5);
    
    // 2. Validate source
    const validation = validateVector(sourceVector, 768);
    expect(validation.isValid).toBe(true);
    
    // 3. Transform dimensions
    const transform = transformDimension(sourceVector, 1024, 'pca');
    expect(transform.transformedVector.length).toBe(1024);
    
    // 4. Validate transformed vector
    const transformedValidation = validateVector(transform.transformedVector, 1024);
    expect(transformedValidation.isValid).toBe(true);
  });

  it('should handle align + transform pipeline', () => {
    const sourceVector = Array(768).fill(0).map(() => Math.random() - 0.5);
    
    // Step 1: Align from GPT-3.5 to BERT
    const aligned = alignVector(sourceVector, 'gpt-3.5', 'bert', 'linear');
    
    // Step 2: Transform to 1024 dimensions
    const transformed = transformDimension(aligned.alignedVector, 1024, 'pca');
    
    expect(transformed.transformedVector.length).toBe(1024);
    expect(validateVector(transformed.transformedVector, 1024).isValid).toBe(true);
  });
});
