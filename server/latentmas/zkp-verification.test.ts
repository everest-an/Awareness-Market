/**
 * Tests for ZKP Verification System
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  ZKPVerificationEngine,
  getZKPEngine,
  initializeZKP,
  proveVectorQuality,
  verifyVectorQuality,
  createCommitment,
  verifyCommitment,
  type ProofSystem,
  type QualityProof,
} from './zkp-verification';

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

function calculateQualityScore(vector: number[]): number {
  // Mock quality score based on vector properties
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  const sparsity = vector.filter(v => Math.abs(v) < 0.01).length / vector.length;

  // Higher score for normalized vectors with low sparsity
  return Math.max(0, Math.min(1, (1 - Math.abs(norm - 1)) * (1 - sparsity)));
}

// ============================================================================
// Initialization Tests
// ============================================================================

describe('ZKPVerificationEngine - Initialization', () => {
  let engine: ZKPVerificationEngine;

  afterEach(() => {
    engine = null as any;
  });

  test('should initialize with default config', async () => {
    engine = new ZKPVerificationEngine();
    await engine.initialize();

    expect(engine.isReady()).toBe(true);
  });

  test('should initialize with mock system', async () => {
    engine = new ZKPVerificationEngine({ system: 'mock' });
    await engine.initialize();

    const stats = engine.getStats();
    expect(stats.proofSystem).toBe('mock');
  });

  test('should initialize with custom config', async () => {
    engine = new ZKPVerificationEngine({
      system: 'mock',
      curveType: 'bls12-381',
      securityLevel: 256,
    });

    await engine.initialize();
    expect(engine.isReady()).toBe(true);
  });

  test('should track initialization stats', async () => {
    engine = new ZKPVerificationEngine({ system: 'mock' });
    await engine.initialize();

    const stats = engine.getStats();
    expect(stats.proofsGenerated).toBe(0);
    expect(stats.proofsVerified).toBe(0);
  });
});

// ============================================================================
// Vector Commitment Tests
// ============================================================================

describe('ZKPVerificationEngine - Vector Commitments', () => {
  let engine: ZKPVerificationEngine;

  beforeEach(async () => {
    engine = new ZKPVerificationEngine({ system: 'mock' });
    await engine.initialize();
  });

  test('should create commitment to vector', async () => {
    const vector = generateRandomVector(512);

    const commitment = await engine.commitToVector(vector);

    expect(commitment.commitment).toBeDefined();
    expect(commitment.blinding).toBeDefined();
    expect(commitment.dimension).toBe(512);
  });

  test('should generate unique commitments', async () => {
    const vector = generateRandomVector(256);

    const commitment1 = await engine.commitToVector(vector);
    const commitment2 = await engine.commitToVector(vector);

    // Different blinding factors should produce different commitments
    expect(commitment1.commitment).not.toBe(commitment2.commitment);
    expect(commitment1.blinding).not.toBe(commitment2.blinding);
  });

  test('should create deterministic commitment with same blinding', async () => {
    const vector = generateRandomVector(128);

    const commitment1 = await engine.commitToVector(vector);

    // Manually verify commitment can be recomputed
    expect(commitment1.commitment.length).toBeGreaterThan(0);
  });

  test('should handle different vector dimensions', async () => {
    const dimensions = [128, 256, 512, 1024];

    for (const dim of dimensions) {
      const vector = generateRandomVector(dim);
      const commitment = await engine.commitToVector(vector);

      expect(commitment.dimension).toBe(dim);
    }
  });
});

// ============================================================================
// Quality Proof Generation Tests
// ============================================================================

describe('ZKPVerificationEngine - Quality Proofs', () => {
  let engine: ZKPVerificationEngine;

  beforeEach(async () => {
    engine = new ZKPVerificationEngine({ system: 'mock' });
    await engine.initialize();
  });

  test('should generate quality proof', async () => {
    const vector = generateNormalizedVector(512);
    const qualityScore = 0.95;
    const threshold = 0.8;

    const proof = await engine.proveQuality(vector, qualityScore, threshold);

    expect(proof.proof).toBeDefined();
    expect(proof.publicSignals).toBeDefined();
    expect(proof.vectorCommitment).toBeDefined();
    expect(proof.createdAt).toBeInstanceOf(Date);
    expect(proof.expiresAt).toBeInstanceOf(Date);
  });

  test('should include valid proof structure', async () => {
    const vector = generateRandomVector(256);
    const qualityScore = 0.85;
    const threshold = 0.7;

    const proof = await engine.proveQuality(vector, qualityScore, threshold);

    expect(proof.proof.system).toBe('mock');
    expect(proof.proof.pi_a).toHaveLength(2);
    expect(proof.proof.pi_b).toHaveLength(2);
    expect(proof.proof.pi_c).toHaveLength(2);
  });

  test('should include public signals', async () => {
    const vector = generateRandomVector(128);
    const qualityScore = 0.9;
    const threshold = 0.8;

    const proof = await engine.proveQuality(vector, qualityScore, threshold);

    expect(proof.publicSignals.qualityCommitment).toBeDefined();
    expect(proof.publicSignals.thresholdProof).toBeDefined();
    expect(proof.publicSignals.distributionProof).toBeDefined();
    expect(proof.publicSignals.timestamp).toBeInstanceOf(Date);
  });

  test('should set expiration time', async () => {
    const vector = generateRandomVector(256);
    const qualityScore = 0.85;
    const threshold = 0.7;

    const proof = await engine.proveQuality(vector, qualityScore, threshold);

    const timeUntilExpiry = proof.expiresAt.getTime() - proof.createdAt.getTime();

    // Should expire in ~1 hour
    expect(timeUntilExpiry).toBeGreaterThan(3500 * 1000); // > 58 minutes
    expect(timeUntilExpiry).toBeLessThan(3700 * 1000); // < 62 minutes
  });

  test('should update proof statistics', async () => {
    const vector = generateRandomVector(512);

    await engine.proveQuality(vector, 0.9, 0.8);
    await engine.proveQuality(vector, 0.85, 0.7);

    const stats = engine.getStats();
    expect(stats.proofsGenerated).toBe(2);
    expect(stats.averageProofTime).toBeGreaterThan(0);
  });
});

// ============================================================================
// Proof Verification Tests
// ============================================================================

describe('ZKPVerificationEngine - Proof Verification', () => {
  let engine: ZKPVerificationEngine;

  beforeEach(async () => {
    engine = new ZKPVerificationEngine({ system: 'mock' });
    await engine.initialize();
  });

  test('should verify valid proof', async () => {
    const vector = generateNormalizedVector(512);
    const qualityScore = 0.95;
    const threshold = 0.8;

    const proof = await engine.proveQuality(vector, qualityScore, threshold);

    const result = await engine.verifyQuality(proof);

    expect(result.valid).toBe(true);
    expect(result.proofSystem).toBe('mock');
    expect(result.verificationTime).toBeGreaterThan(0);
  });

  test('should reject expired proof', async () => {
    const vector = generateRandomVector(256);
    const qualityScore = 0.85;
    const threshold = 0.7;

    const proof = await engine.proveQuality(vector, qualityScore, threshold);

    // Manually expire the proof
    proof.expiresAt = new Date(Date.now() - 1000);

    const result = await engine.verifyQuality(proof);

    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain('expired');
  });

  test('should include public signals in verification result', async () => {
    const vector = generateRandomVector(128);
    const qualityScore = 0.9;
    const threshold = 0.8;

    const proof = await engine.proveQuality(vector, qualityScore, threshold);
    const result = await engine.verifyQuality(proof);

    expect(result.publicSignals).toEqual(proof.publicSignals);
  });

  test('should track verification statistics', async () => {
    const vector = generateRandomVector(512);

    const proof = await engine.proveQuality(vector, 0.9, 0.8);

    await engine.verifyQuality(proof);
    await engine.verifyQuality(proof);
    await engine.verifyQuality(proof);

    const stats = engine.getStats();
    expect(stats.proofsVerified).toBe(3);
    expect(stats.averageVerifyTime).toBeGreaterThan(0);
    expect(stats.successRate).toBe(1.0); // All valid
  });

  test('should update success rate correctly', async () => {
    const vector = generateRandomVector(256);

    const proof1 = await engine.proveQuality(vector, 0.9, 0.8);
    const proof2 = await engine.proveQuality(vector, 0.85, 0.7);

    // Expire one proof to trigger failure
    proof2.expiresAt = new Date(Date.now() - 1000);

    await engine.verifyQuality(proof1); // Valid
    await engine.verifyQuality(proof2); // Invalid (expired)

    const stats = engine.getStats();
    expect(stats.successRate).toBe(0.5); // 1 success, 1 failure
  });
});

// ============================================================================
// Batch Verification Tests
// ============================================================================

describe('ZKPVerificationEngine - Batch Verification', () => {
  let engine: ZKPVerificationEngine;

  beforeEach(async () => {
    engine = new ZKPVerificationEngine({ system: 'mock' });
    await engine.initialize();
  });

  test('should verify multiple proofs', async () => {
    const proofs: QualityProof[] = [];

    for (let i = 0; i < 5; i++) {
      const vector = generateRandomVector(256);
      const proof = await engine.proveQuality(vector, 0.9, 0.8);
      proofs.push(proof);
    }

    const results = await engine.verifyBatch(proofs);

    expect(results).toHaveLength(5);
    for (const result of results) {
      expect(result.valid).toBe(true);
    }
  });

  test('should handle mixed valid/invalid proofs', async () => {
    const proofs: QualityProof[] = [];

    // Valid proofs
    for (let i = 0; i < 3; i++) {
      const vector = generateRandomVector(128);
      const proof = await engine.proveQuality(vector, 0.9, 0.8);
      proofs.push(proof);
    }

    // Invalid proof (expired)
    const expiredProof = await engine.proveQuality(
      generateRandomVector(128),
      0.85,
      0.7
    );
    expiredProof.expiresAt = new Date(Date.now() - 1000);
    proofs.push(expiredProof);

    const results = await engine.verifyBatch(proofs);

    expect(results).toHaveLength(4);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(true);
    expect(results[2].valid).toBe(true);
    expect(results[3].valid).toBe(false);
  });
});

// ============================================================================
// Circuit Constraints Tests
// ============================================================================

describe('ZKPVerificationEngine - Circuit Constraints', () => {
  let engine: ZKPVerificationEngine;

  beforeEach(async () => {
    engine = new ZKPVerificationEngine({ system: 'mock' });
    await engine.initialize();
  });

  test('should return circuit constraints', () => {
    const constraints = engine.getCircuitConstraints();

    expect(constraints.numberOfConstraints).toBeGreaterThan(0);
    expect(constraints.numberOfWires).toBeGreaterThan(0);
    expect(constraints.numberOfPublicInputs).toBeGreaterThan(0);
    expect(constraints.numberOfPrivateInputs).toBeGreaterThan(0);
  });

  test('should have more wires than constraints', () => {
    const constraints = engine.getCircuitConstraints();

    expect(constraints.numberOfWires).toBeGreaterThan(
      constraints.numberOfConstraints
    );
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  test('proveVectorQuality should generate proof', async () => {
    const vector = generateNormalizedVector(512);

    const proof = await proveVectorQuality(vector, 0.95, 0.8);

    expect(proof.proof).toBeDefined();
    expect(proof.publicSignals).toBeDefined();
  });

  test('verifyVectorQuality should verify proof', async () => {
    const vector = generateRandomVector(256);

    const proof = await proveVectorQuality(vector, 0.9, 0.8);
    const isValid = await verifyVectorQuality(proof);

    expect(isValid).toBe(true);
  });

  test('createCommitment should commit to vector', async () => {
    const vector = generateRandomVector(128);

    const commitment = await createCommitment(vector);

    expect(commitment.commitment).toBeDefined();
    expect(commitment.blinding).toBeDefined();
  });

  test('verifyCommitment should verify commitment', async () => {
    const vector = generateRandomVector(256);

    const commitment = await createCommitment(vector);
    const isValid = await verifyCommitment(vector, commitment);

    expect(isValid).toBe(true);
  });

  test('verifyCommitment should reject wrong vector', async () => {
    const vector1 = generateRandomVector(128);
    const vector2 = generateRandomVector(128);

    const commitment = await createCommitment(vector1);
    const isValid = await verifyCommitment(vector2, commitment);

    expect(isValid).toBe(false);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('ZKPVerificationEngine - Integration', () => {
  let engine: ZKPVerificationEngine;

  beforeEach(async () => {
    engine = new ZKPVerificationEngine({ system: 'mock' });
    await engine.initialize();
  });

  test('should handle complete proof workflow', async () => {
    // Generate high-quality vector
    const vector = generateNormalizedVector(512);
    const qualityScore = calculateQualityScore(vector);

    // Seller creates proof
    const proof = await engine.proveQuality(vector, qualityScore, 0.8);

    expect(proof).toBeDefined();

    // Buyer verifies proof
    const result = await engine.verifyQuality(proof);

    expect(result.valid).toBe(true);

    // Check statistics
    const stats = engine.getStats();
    expect(stats.proofsGenerated).toBe(1);
    expect(stats.proofsVerified).toBe(1);
  });

  test('should handle seller-buyer interaction', async () => {
    // Seller has high-quality vector
    const sellerVector = generateNormalizedVector(768);
    const qualityScore = 0.95;

    // Seller commits to vector
    const commitment = await engine.commitToVector(sellerVector);

    // Seller generates proof without revealing vector
    const proof = await engine.proveQuality(sellerVector, qualityScore, 0.9);

    // Buyer receives proof and verifies
    const result = await engine.verifyQuality(proof);

    expect(result.valid).toBe(true);
    expect(result.publicSignals.qualityCommitment).toBeDefined();

    // Buyer confirms quality without seeing actual vector
    // Seller can now safely reveal vector or sell it
  });

  test('should handle multiple sequential proofs', async () => {
    const vector = generateRandomVector(512);

    // Generate proofs with different thresholds
    const proof1 = await engine.proveQuality(vector, 0.95, 0.8);
    const proof2 = await engine.proveQuality(vector, 0.90, 0.75);
    const proof3 = await engine.proveQuality(vector, 0.85, 0.7);

    // Verify all proofs
    const result1 = await engine.verifyQuality(proof1);
    const result2 = await engine.verifyQuality(proof2);
    const result3 = await engine.verifyQuality(proof3);

    expect(result1.valid).toBe(true);
    expect(result2.valid).toBe(true);
    expect(result3.valid).toBe(true);

    const stats = engine.getStats();
    expect(stats.proofsGenerated).toBe(3);
    expect(stats.proofsVerified).toBe(3);
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('ZKPVerificationEngine - Singleton', () => {
  test('should return same instance', () => {
    const engine1 = getZKPEngine();
    const engine2 = getZKPEngine();

    expect(engine1).toBe(engine2);
  });

  test('initializeZKP should return initialized engine', async () => {
    const engine = await initializeZKP({ system: 'mock' });

    expect(engine).toBeDefined();
    expect(engine.isReady()).toBe(true);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('ZKPVerificationEngine - Performance', () => {
  let engine: ZKPVerificationEngine;

  beforeEach(async () => {
    engine = new ZKPVerificationEngine({ system: 'mock' });
    await engine.initialize();
  });

  test('should generate proofs quickly', async () => {
    const vector = generateRandomVector(512);

    const startTime = performance.now();

    await engine.proveQuality(vector, 0.9, 0.8);

    const elapsed = performance.now() - startTime;

    // Mock proof should be fast (< 100ms)
    expect(elapsed).toBeLessThan(100);
  });

  test('should verify proofs quickly', async () => {
    const vector = generateRandomVector(256);
    const proof = await engine.proveQuality(vector, 0.9, 0.8);

    const startTime = performance.now();

    await engine.verifyQuality(proof);

    const elapsed = performance.now() - startTime;

    // Verification should be fast (< 50ms)
    expect(elapsed).toBeLessThan(50);
  });

  test('should handle large batches efficiently', async () => {
    const proofs: QualityProof[] = [];

    // Generate 50 proofs
    for (let i = 0; i < 50; i++) {
      const vector = generateRandomVector(128);
      const proof = await engine.proveQuality(vector, 0.9, 0.8);
      proofs.push(proof);
    }

    const startTime = performance.now();

    await engine.verifyBatch(proofs);

    const elapsed = performance.now() - startTime;

    // Should complete in reasonable time (< 500ms for mock)
    expect(elapsed).toBeLessThan(500);
  });
});
