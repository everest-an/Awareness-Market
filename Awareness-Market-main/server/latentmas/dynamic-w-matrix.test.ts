/**
 * Tests for Dynamic W-Matrix with MLP Alignment Head
 */

import { describe, it, expect } from 'vitest';
import {
  MLPAlignmentHead,
  DynamicWMatrix,
  createDynamicWMatrix,
  calculateAlignmentQuality,
} from './dynamic-w-matrix';

describe('MLP Alignment Head', () => {
  describe('Initialization', () => {
    it('should initialize with correct dimensions', () => {
      const mlp = new MLPAlignmentHead({
        inputDim: 4096,
        outputDim: 8192,
        hiddenDims: [6144],
        activation: 'relu',
      });

      expect(mlp.getArchitecture()).toBe('4096 → 6144 → 8192');
    });

    it('should support multiple hidden layers', () => {
      const mlp = new MLPAlignmentHead({
        inputDim: 768,
        outputDim: 1024,
        hiddenDims: [896, 960],
        activation: 'gelu',
      });

      expect(mlp.getArchitecture()).toBe('768 → 896 → 960 → 1024');
    });
  });

  describe('Forward Pass', () => {
    it('should transform input to output dimension', () => {
      const mlp = new MLPAlignmentHead({
        inputDim: 128,
        outputDim: 256,
        hiddenDims: [192],
        activation: 'relu',
      });

      const input = Array.from({ length: 128 }, () => Math.random());
      const output = mlp.forward(input);

      expect(output.length).toBe(256);
    });

    it('should throw error on dimension mismatch', () => {
      const mlp = new MLPAlignmentHead({
        inputDim: 128,
        outputDim: 256,
        hiddenDims: [192],
        activation: 'relu',
      });

      const wrongInput = Array.from({ length: 64 }, () => Math.random());

      expect(() => mlp.forward(wrongInput)).toThrow('Input dimension mismatch');
    });

    it('should produce consistent output for same input', () => {
      const mlp = new MLPAlignmentHead({
        inputDim: 64,
        outputDim: 128,
        hiddenDims: [96],
        activation: 'tanh',
      });

      const input = Array.from({ length: 64 }, () => Math.random());
      const output1 = mlp.forward(input);
      const output2 = mlp.forward(input);

      expect(output1).toEqual(output2);
    });
  });

  describe('Alignment', () => {
    it('should return alignment result with all fields', () => {
      const mlp = new MLPAlignmentHead({
        inputDim: 128,
        outputDim: 256,
        hiddenDims: [192],
        activation: 'gelu',
      });

      const input = Array.from({ length: 128 }, () => Math.random());
      const result = mlp.align(input);

      expect(result.alignedVector.length).toBe(256);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.alignmentLoss).toBeGreaterThanOrEqual(0);
      expect(result.transformationPath.length).toBeGreaterThan(0);
    });

    it('should have reasonable confidence scores', () => {
      const mlp = new MLPAlignmentHead({
        inputDim: 64,
        outputDim: 128,
        hiddenDims: [96],
        activation: 'relu',
      });

      const input = Array.from({ length: 64 }, () => Math.random());
      const result = mlp.align(input);

      // Confidence should be meaningful (not 0 or 1 for random input)
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(1);
    });
  });

  describe('Weight Export/Import', () => {
    it('should export and import weights correctly', () => {
      const mlp1 = new MLPAlignmentHead({
        inputDim: 64,
        outputDim: 128,
        hiddenDims: [96],
        activation: 'relu',
      });

      const input = Array.from({ length: 64 }, () => Math.random());
      const output1 = mlp1.forward(input);

      // Export weights
      const weights = mlp1.exportWeights();

      // Create new MLP and import weights
      const mlp2 = new MLPAlignmentHead({
        inputDim: 64,
        outputDim: 128,
        hiddenDims: [96],
        activation: 'relu',
      });
      mlp2.importWeights(weights);

      const output2 = mlp2.forward(input);

      // Outputs should be identical
      expect(output2).toEqual(output1);
    });
  });
});

describe('Dynamic W-Matrix', () => {
  describe('Initialization', () => {
    it('should create matrix for model pair', () => {
      const matrix = createDynamicWMatrix('gpt-3.5', 'gpt-4', 4096, 8192);
      const metadata = matrix.getMetadata();

      expect(metadata.sourceModel).toBe('gpt-3.5');
      expect(metadata.targetModel).toBe('gpt-4');
      expect(metadata.version).toBe('2.0');
      expect(metadata.architecture).toContain('4096');
      expect(metadata.architecture).toContain('8192');
    });

    it('should create adaptive hidden layers for large dimension gap', () => {
      const matrix = createDynamicWMatrix('bert', 'gpt-4', 768, 8192);
      const metadata = matrix.getMetadata();

      // Should have 2 hidden layers for large gap
      const layers = metadata.architecture.split(' → ');
      expect(layers.length).toBeGreaterThanOrEqual(3); // input + hidden(s) + output
    });

    it('should create single hidden layer for small dimension gap', () => {
      const matrix = createDynamicWMatrix('llama-2', 'llama-3', 4096, 4096);
      const metadata = matrix.getMetadata();

      // Should have 1 hidden layer for small/no gap
      const layers = metadata.architecture.split(' → ');
      expect(layers.length).toBe(3); // input + hidden + output
    });
  });

  describe('Alignment', () => {
    it('should align vector to target dimension', () => {
      const matrix = createDynamicWMatrix('gpt-3.5', 'gpt-4', 1536, 3072);
      const sourceVector = Array.from({ length: 1536 }, () => Math.random());

      const result = matrix.align(sourceVector);

      expect(result.alignedVector.length).toBe(3072);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.alignmentLoss).toBeGreaterThanOrEqual(0);
    });

    it('should handle batch alignment', () => {
      const matrix = createDynamicWMatrix('bert', 'roberta', 768, 768);
      const batch = Array.from({ length: 10 }, () =>
        Array.from({ length: 768 }, () => Math.random())
      );

      const results = matrix.alignBatch(batch);

      expect(results.length).toBe(10);
      results.forEach((result) => {
        expect(result.alignedVector.length).toBe(768);
      });
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize correctly', () => {
      const matrix1 = createDynamicWMatrix('gpt-3.5', 'gpt-4', 512, 1024);
      const sourceVector = Array.from({ length: 512 }, () => Math.random());

      const result1 = matrix1.align(sourceVector);

      // Serialize
      const serialized = matrix1.serialize();
      expect(typeof serialized).toBe('string');

      // Deserialize
      const matrix2 = DynamicWMatrix.deserialize(serialized);
      const result2 = matrix2.align(sourceVector);

      // Results should be identical
      expect(result2.alignedVector).toEqual(result1.alignedVector);
      expect(result2.confidence).toEqual(result1.confidence);
    });

    it('should preserve metadata after deserialization', () => {
      // Use smaller dimensions to avoid JSON string length issues
      const matrix1 = createDynamicWMatrix('claude-2', 'claude-3', 256, 512);
      const metadata1 = matrix1.getMetadata();

      const serialized = matrix1.serialize();
      const matrix2 = DynamicWMatrix.deserialize(serialized);
      const metadata2 = matrix2.getMetadata();

      expect(metadata2.sourceModel).toBe(metadata1.sourceModel);
      expect(metadata2.targetModel).toBe(metadata1.targetModel);
      expect(metadata2.version).toBe(metadata1.version);
    });
  });
});

describe('Alignment Quality Metrics', () => {
  it('should calculate cosine similarity', () => {
    const v1 = [1, 0, 0, 0];
    const v2 = [1, 0, 0, 0];

    const metrics = calculateAlignmentQuality(v1, v2);

    expect(metrics.cosineSimilarity).toBeCloseTo(1.0, 5);
  });

  it('should calculate euclidean distance', () => {
    const v1 = [0, 0, 0, 0];
    const v2 = [1, 1, 1, 1];

    const metrics = calculateAlignmentQuality(v1, v2);

    expect(metrics.euclideanDistance).toBeGreaterThan(0);
  });

  it('should calculate norm ratio', () => {
    const v1 = [1, 1, 1, 1];
    const v2 = [2, 2, 2, 2];

    const metrics = calculateAlignmentQuality(v1, v2);

    expect(metrics.normRatio).toBeCloseTo(2.0, 5);
  });

  it('should handle zero vectors', () => {
    const v1 = [0, 0, 0, 0];
    const v2 = [0, 0, 0, 0];

    const metrics = calculateAlignmentQuality(v1, v2);

    expect(metrics.cosineSimilarity).toBe(0);
    expect(metrics.euclideanDistance).toBe(0);
  });
});

describe('Integration Test', () => {
  it('should perform full alignment pipeline', () => {
    // Create dynamic W-Matrix for GPT-3.5 → GPT-4 alignment
    const matrix = createDynamicWMatrix('gpt-3.5-turbo', 'gpt-4', 1536, 3072);

    // Generate random source vector
    const sourceVector = Array.from({ length: 1536 }, () =>
      Math.random() * 2 - 1
    );

    // Align vector
    const result = matrix.align(sourceVector);

    // Verify output
    expect(result.alignedVector.length).toBe(3072);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.alignmentLoss).toBeGreaterThanOrEqual(0);

    // Calculate quality metrics
    const quality = calculateAlignmentQuality(
      sourceVector,
      result.alignedVector.slice(0, 1536)
    );

    console.log(`✓ Dynamic W-Matrix alignment test passed:`);
    console.log(`  - Source model: gpt-3.5-turbo (1536D)`);
    console.log(`  - Target model: gpt-4 (3072D)`);
    console.log(`  - Architecture: ${matrix.getMetadata().architecture}`);
    console.log(`  - Confidence: ${(result.confidence * 100).toFixed(2)}%`);
    console.log(`  - Alignment loss: ${result.alignmentLoss.toFixed(6)}`);
    console.log(
      `  - Cosine similarity: ${quality.cosineSimilarity.toFixed(4)}`
    );
    console.log(`  - Norm ratio: ${quality.normRatio.toFixed(4)}`);
  });
});
