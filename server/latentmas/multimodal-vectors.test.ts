/**
 * Tests for Multi-Modal Vector Support
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  MultiModalFusionEngine,
  MultiModalVectorBuilder,
  createCLIPVector,
  createAudioTextVector,
  isMultiModal,
  extractModality,
  type MultiModalVector,
  type ModalityVector,
  type FusionMethod,
} from './multimodal-vectors';

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

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same dimension');
  }

  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  const norm1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const norm2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

  return dotProduct / (norm1 * norm2);
}

// ============================================================================
// Multi-Modal Vector Builder Tests
// ============================================================================

describe('MultiModalVectorBuilder', () => {
  test('should build a multi-modal vector', () => {
    const textVector = generateRandomVector(512);
    const imageVector = generateRandomVector(512);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', textVector, 'text-encoder')
      .addModality('image', imageVector, 'image-encoder')
      .setFusionMethod('late')
      .build('test-001', 'clip-vit-b-32');

    expect(mmVector.id).toBe('test-001');
    expect(mmVector.modalityVectors).toHaveLength(2);
    expect(mmVector.fusionMethod).toBe('late');
    expect(mmVector.metadata.sourceModel).toBe('clip-vit-b-32');
  });

  test('should add multiple modalities', () => {
    const builder = new MultiModalVectorBuilder()
      .addModality('text', generateRandomVector(512), 'text-model')
      .addModality('image', generateRandomVector(512), 'image-model')
      .addModality('audio', generateRandomVector(512), 'audio-model');

    const mmVector = builder.build('multi-modal', 'multimodal-model');

    expect(mmVector.modalityVectors).toHaveLength(3);
    expect(mmVector.modalityVectors.map(mv => mv.modality)).toEqual([
      'text',
      'image',
      'audio',
    ]);
  });

  test('should throw error when no modalities added', () => {
    const builder = new MultiModalVectorBuilder();

    expect(() => {
      builder.build('test', 'model');
    }).toThrow('No modality vectors added');
  });
});

// ============================================================================
// Early Fusion Tests
// ============================================================================

describe('MultiModalFusionEngine - Early Fusion', () => {
  let engine: MultiModalFusionEngine;

  beforeEach(() => {
    engine = new MultiModalFusionEngine({ method: 'early' });
  });

  test('should concatenate vectors', () => {
    const textVector = generateRandomVector(512);
    const imageVector = generateRandomVector(512);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', textVector, 'text-encoder')
      .addModality('image', imageVector, 'image-encoder')
      .setFusionMethod('early')
      .build('test-001', 'model');

    const result = engine.fuse(mmVector);

    expect(result.fusedVector).toHaveLength(1024); // 512 + 512
    expect(result.method).toBe('early');
    expect(result.modalitiesUsed).toEqual(['text', 'image']);
  });

  test('should handle different dimensions', () => {
    const vec1 = generateRandomVector(256);
    const vec2 = generateRandomVector(512);
    const vec3 = generateRandomVector(128);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', vec1, 'model-1')
      .addModality('image', vec2, 'model-2')
      .addModality('audio', vec3, 'model-3')
      .setFusionMethod('early')
      .build('test-002', 'model');

    const result = engine.fuse(mmVector);

    expect(result.fusedVector).toHaveLength(256 + 512 + 128);
  });

  test('should normalize output when configured', () => {
    const engine = new MultiModalFusionEngine({
      method: 'early',
      normalizeOutput: true,
    });

    const textVector = generateRandomVector(512);
    const imageVector = generateRandomVector(512);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', textVector, 'text-encoder')
      .addModality('image', imageVector, 'image-encoder')
      .setFusionMethod('early')
      .build('test-003', 'model');

    const result = engine.fuse(mmVector);

    // Check if normalized (L2 norm should be close to 1)
    const norm = Math.sqrt(
      result.fusedVector.reduce((sum, val) => sum + val * val, 0)
    );
    expect(norm).toBeCloseTo(1.0, 2);
  });
});

// ============================================================================
// Late Fusion Tests
// ============================================================================

describe('MultiModalFusionEngine - Late Fusion', () => {
  let engine: MultiModalFusionEngine;

  beforeEach(() => {
    engine = new MultiModalFusionEngine({ method: 'late', normalizeOutput: false });
  });

  test('should average vectors of same dimension', () => {
    const textVector = generateNormalizedVector(512);
    const imageVector = generateNormalizedVector(512);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', textVector, 'text-encoder')
      .addModality('image', imageVector, 'image-encoder')
      .setFusionMethod('late')
      .build('test-001', 'model');

    const result = engine.fuse(mmVector);

    expect(result.fusedVector).toHaveLength(512);
    expect(result.method).toBe('late');

    // Check if result is average
    for (let i = 0; i < 512; i++) {
      const expected = (textVector[i] + imageVector[i]) / 2;
      expect(result.fusedVector[i]).toBeCloseTo(expected, 5);
    }
  });

  test('should apply weights when configured', () => {
    const engine = new MultiModalFusionEngine({
      method: 'late',
      weights: { text: 0.7, image: 0.3 },
      normalizeOutput: false,
    });

    const textVector = generateNormalizedVector(512);
    const imageVector = generateNormalizedVector(512);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', textVector, 'text-encoder')
      .addModality('image', imageVector, 'image-encoder')
      .setFusionMethod('late')
      .build('test-002', 'model');

    const result = engine.fuse(mmVector);

    // Check weighted average
    for (let i = 0; i < 512; i++) {
      const expected = (textVector[i] * 0.7 + imageVector[i] * 0.3) / 1.0;
      expect(result.fusedVector[i]).toBeCloseTo(expected, 5);
    }
  });

  test('should throw error for different dimensions', () => {
    const textVector = generateRandomVector(512);
    const imageVector = generateRandomVector(768); // Different dimension

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', textVector, 'text-encoder')
      .addModality('image', imageVector, 'image-encoder')
      .setFusionMethod('late')
      .build('test-003', 'model');

    expect(() => {
      engine.fuse(mmVector);
    }).toThrow('same dimension');
  });

  test('should calculate average confidence', () => {
    const textVector = generateRandomVector(512);
    const imageVector = generateRandomVector(512);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', textVector, 'text-encoder', 0.9)
      .addModality('image', imageVector, 'image-encoder', 0.7)
      .setFusionMethod('late')
      .build('test-004', 'model');

    const result = engine.fuse(mmVector);

    expect(result.confidence).toBeCloseTo(0.8, 2); // (0.9 + 0.7) / 2
  });
});

// ============================================================================
// Hybrid Fusion Tests
// ============================================================================

describe('MultiModalFusionEngine - Hybrid Fusion', () => {
  let engine: MultiModalFusionEngine;

  beforeEach(() => {
    engine = new MultiModalFusionEngine({ method: 'hybrid' });
  });

  test('should handle different dimensions', () => {
    const textVector = generateRandomVector(512);
    const imageVector = generateRandomVector(768);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', textVector, 'text-encoder')
      .addModality('image', imageVector, 'image-encoder')
      .setFusionMethod('hybrid')
      .build('test-001', 'model');

    const result = engine.fuse(mmVector);

    // Should project to max dimension (768)
    expect(result.fusedVector).toHaveLength(768);
    expect(result.method).toBe('hybrid');
  });

  test('should pad smaller vectors', () => {
    const smallVector = generateRandomVector(256);
    const largeVector = generateRandomVector(512);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', smallVector, 'model-1')
      .addModality('image', largeVector, 'model-2')
      .setFusionMethod('hybrid')
      .build('test-002', 'model');

    const result = engine.fuse(mmVector);

    expect(result.fusedVector).toHaveLength(512);
  });

  test('should work with three+ modalities of different dimensions', () => {
    const vec1 = generateRandomVector(256);
    const vec2 = generateRandomVector(512);
    const vec3 = generateRandomVector(384);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', vec1, 'model-1')
      .addModality('image', vec2, 'model-2')
      .addModality('audio', vec3, 'model-3')
      .setFusionMethod('hybrid')
      .build('test-003', 'model');

    const result = engine.fuse(mmVector);

    // Should project to max dimension (512)
    expect(result.fusedVector).toHaveLength(512);
    expect(result.modalitiesUsed).toHaveLength(3);
  });
});

// ============================================================================
// Attention Fusion Tests
// ============================================================================

describe('MultiModalFusionEngine - Attention Fusion', () => {
  let engine: MultiModalFusionEngine;

  beforeEach(() => {
    engine = new MultiModalFusionEngine({ method: 'attention' });
  });

  test('should weight by confidence', () => {
    const textVector = generateRandomVector(512);
    const imageVector = generateRandomVector(512);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', textVector, 'text-encoder', 0.9) // High confidence
      .addModality('image', imageVector, 'image-encoder', 0.1) // Low confidence
      .setFusionMethod('attention')
      .build('test-001', 'model');

    const result = engine.fuse(mmVector);

    expect(result.method).toBe('attention');
    expect(result.fusedVector).toHaveLength(512);

    // Result should be closer to text vector (higher confidence)
    const textSim = cosineSimilarity(result.fusedVector, textVector);
    const imageSim = cosineSimilarity(result.fusedVector, imageVector);

    expect(textSim).toBeGreaterThan(imageSim);
  });

  test('should handle different dimensions', () => {
    const vec1 = generateRandomVector(256);
    const vec2 = generateRandomVector(512);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', vec1, 'model-1', 0.5)
      .addModality('image', vec2, 'model-2', 0.5)
      .setFusionMethod('attention')
      .build('test-002', 'model');

    const result = engine.fuse(mmVector);

    // Should project to max dimension
    expect(result.fusedVector).toHaveLength(512);
  });
});

// ============================================================================
// Single Modality Tests
// ============================================================================

describe('MultiModalFusionEngine - Single Modality', () => {
  let engine: MultiModalFusionEngine;

  beforeEach(() => {
    engine = new MultiModalFusionEngine();
  });

  test('should return vector as-is for single modality', () => {
    const textVector = generateRandomVector(512);

    const mmVector = new MultiModalVectorBuilder()
      .addModality('text', textVector, 'text-encoder', 0.95)
      .setFusionMethod('late')
      .build('test-001', 'model');

    const result = engine.fuse(mmVector);

    expect(result.fusedVector).toEqual(textVector);
    expect(result.confidence).toBe(0.95);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  test('createCLIPVector should create text+image vector', () => {
    const textVec = generateRandomVector(512);
    const imageVec = generateRandomVector(512);

    const clipVector = createCLIPVector('clip-001', textVec, imageVec);

    expect(clipVector.modalityVectors).toHaveLength(2);
    expect(clipVector.fusionMethod).toBe('late');
    expect(clipVector.metadata.sourceModel).toBe('clip-vit-b-32');
  });

  test('createAudioTextVector should create audio+text vector', () => {
    const audioVec = generateRandomVector(768);
    const textVec = generateRandomVector(512);

    const audioTextVector = createAudioTextVector('audio-001', audioVec, textVec);

    expect(audioTextVector.modalityVectors).toHaveLength(2);
    expect(audioTextVector.fusionMethod).toBe('hybrid');
  });

  test('isMultiModal should detect multi-modal vectors', () => {
    const multiModal = createCLIPVector(
      'test',
      generateRandomVector(512),
      generateRandomVector(512)
    );

    const singleModal = new MultiModalVectorBuilder()
      .addModality('text', generateRandomVector(512), 'model')
      .build('single', 'model');

    expect(isMultiModal(multiModal)).toBe(true);
    expect(isMultiModal(singleModal)).toBe(false); // Only 1 modality
    expect(isMultiModal(null)).toBe(false);
    expect(isMultiModal({})).toBe(false);
  });

  test('extractModality should extract specific modality', () => {
    const textVec = generateRandomVector(512);
    const imageVec = generateRandomVector(512);

    const mmVector = createCLIPVector('test', textVec, imageVec);

    const extractedText = extractModality(mmVector, 'text');
    const extractedImage = extractModality(mmVector, 'image');
    const extractedAudio = extractModality(mmVector, 'audio');

    expect(extractedText).toBeDefined();
    expect(extractedText?.vector).toEqual(textVec);

    expect(extractedImage).toBeDefined();
    expect(extractedImage?.vector).toEqual(imageVec);

    expect(extractedAudio).toBeNull();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('MultiModalFusionEngine - Integration', () => {
  test('should handle real-world CLIP-style fusion', () => {
    const engine = new MultiModalFusionEngine({
      method: 'late',
      weights: { text: 0.5, image: 0.5 },
      normalizeOutput: true,
    });

    // Simulate CLIP text and image encoders
    const textVector = generateNormalizedVector(512);
    const imageVector = generateNormalizedVector(512);

    const clipVector = createCLIPVector('clip-test', textVector, imageVector);

    const result = engine.fuse(clipVector);

    expect(result.fusedVector).toHaveLength(512);
    expect(result.modalitiesUsed).toEqual(['text', 'image']);

    // Check normalization
    const norm = Math.sqrt(
      result.fusedVector.reduce((sum, val) => sum + val * val, 0)
    );
    expect(norm).toBeCloseTo(1.0, 2);
  });

  test('should handle audio transcription scenario', () => {
    const engine = new MultiModalFusionEngine({ method: 'hybrid' });

    // Whisper audio encoder (1280 dim) + text encoder (768 dim)
    const audioVector = generateRandomVector(1280);
    const textVector = generateRandomVector(768);

    const audioTextVector = createAudioTextVector('whisper-test', audioVector, textVector);

    const result = engine.fuse(audioTextVector);

    // Should project to max dimension (1280)
    expect(result.fusedVector).toHaveLength(1280);
    expect(result.modalitiesUsed).toEqual(['audio', 'text']);
  });
});
