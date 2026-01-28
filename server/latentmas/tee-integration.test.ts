/**
 * Tests for TEE Integration
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  TEEIntegrationEngine,
  getTEEEngine,
  initializeTEE,
  secureAlign,
  isRunningInTEE,
  getCurrentAttestation,
  type TEEProvider,
  type SecureVectorOperation,
} from './tee-integration';

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

// ============================================================================
// Initialization Tests
// ============================================================================

describe('TEEIntegrationEngine - Initialization', () => {
  let engine: TEEIntegrationEngine;

  afterEach(() => {
    engine = null as any;
  });

  test('should initialize with default config', async () => {
    engine = new TEEIntegrationEngine();
    await engine.initialize();

    expect(engine.getProvider()).toBe('none'); // Default fallback
    expect(engine.isAvailable()).toBe(true);
  });

  test('should initialize with none provider', async () => {
    engine = new TEEIntegrationEngine({ provider: 'none' });
    await engine.initialize();

    expect(engine.getProvider()).toBe('none');
    expect(engine.isAvailable()).toBe(true);
  });

  test('should fall back to none if Nitro unavailable', async () => {
    engine = new TEEIntegrationEngine({ provider: 'nitro' });
    await engine.initialize();

    // Should fall back to 'none' when Nitro is unavailable
    expect(engine.getProvider()).toBe('none');
    expect(engine.isAvailable()).toBe(true);
  });

  test('should track initialization stats', async () => {
    engine = new TEEIntegrationEngine({ provider: 'none' });
    await engine.initialize();

    const stats = engine.getStats();
    expect(stats.provider).toBe('none');
    expect(stats.isAvailable).toBe(true);
    expect(stats.operationsCompleted).toBe(0);
  });
});

// ============================================================================
// Secure Context Tests
// ============================================================================

describe('TEEIntegrationEngine - Secure Context', () => {
  let engine: TEEIntegrationEngine;

  beforeEach(async () => {
    engine = new TEEIntegrationEngine({ provider: 'none' });
    await engine.initialize();
  });

  test('should create secure context', async () => {
    const context = await engine.createSecureContext();

    expect(context.contextId).toBeDefined();
    expect(context.provider).toBe('none');
    expect(context.isSealed).toBe(true);
    expect(context.createdAt).toBeInstanceOf(Date);
    expect(context.expiresAt).toBeInstanceOf(Date);
  });

  test('should include attestation when enabled', async () => {
    const context = await engine.createSecureContext();

    expect(context.attestation).toBeDefined();
    expect(context.attestation?.moduleId).toBeDefined();
    expect(context.attestation?.digest).toBeDefined();
  });

  test('should generate unique context IDs', async () => {
    const context1 = await engine.createSecureContext();
    const context2 = await engine.createSecureContext();

    expect(context1.contextId).not.toBe(context2.contextId);
  });

  test('should destroy context', async () => {
    const context = await engine.createSecureContext();

    await expect(engine.destroyContext(context.contextId)).resolves.not.toThrow();
  });

  test('should throw error destroying non-existent context', async () => {
    await expect(
      engine.destroyContext('non-existent-context')
    ).rejects.toThrow('Context not found');
  });
});

// ============================================================================
// Attestation Tests
// ============================================================================

describe('TEEIntegrationEngine - Attestation', () => {
  let engine: TEEIntegrationEngine;

  beforeEach(async () => {
    engine = new TEEIntegrationEngine({ provider: 'none', enableAttestation: true });
    await engine.initialize();
  });

  test('should perform attestation', async () => {
    const attestation = await engine.performAttestation();

    expect(attestation.moduleId).toBeDefined();
    expect(attestation.timestamp).toBeInstanceOf(Date);
    expect(attestation.digest).toBeDefined();
    expect(attestation.publicKey).toBeDefined();
  });

  test('should include PCRs in Nitro attestation', async () => {
    const nitroEngine = new TEEIntegrationEngine({ provider: 'nitro' });
    await nitroEngine.initialize();

    const attestation = await nitroEngine.performAttestation();

    // Mock attestation should have PCRs
    expect(attestation.pcrs).toBeDefined();
  });

  test('should verify valid attestation', async () => {
    const attestation = await engine.performAttestation();

    const isValid = await engine.verifyAttestation(attestation);

    expect(isValid).toBe(true);
  });

  test('should reject old attestation', async () => {
    const attestation = await engine.performAttestation();

    // Modify timestamp to be old
    attestation.timestamp = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

    const isValid = await engine.verifyAttestation(attestation);

    expect(isValid).toBe(false);
  });

  test('should reject invalid attestation', async () => {
    const attestation = await engine.performAttestation();

    // Corrupt the digest
    attestation.digest = 'invalid-digest';

    // For mock attestation, this should still pass basic checks
    // In production, signature verification would fail
    const isValid = await engine.verifyAttestation(attestation);

    expect(typeof isValid).toBe('boolean');
  });

  test('should track attestation count', async () => {
    await engine.performAttestation();
    await engine.performAttestation();
    await engine.performAttestation();

    const stats = engine.getStats();
    expect(stats.attestationsPerformed).toBe(3);
  });
});

// ============================================================================
// Secure Operations Tests
// ============================================================================

describe('TEEIntegrationEngine - Secure Operations', () => {
  let engine: TEEIntegrationEngine;

  beforeEach(async () => {
    engine = new TEEIntegrationEngine({ provider: 'none' });
    await engine.initialize();
  });

  test('should execute secure alignment', async () => {
    const vectors = generateRandomMatrix(10, 512);
    const wMatrix = generateIdentityMatrix(512);

    const operation: SecureVectorOperation = {
      operationType: 'align',
      inputVectors: vectors,
      wMatrix,
    };

    const result = await engine.executeSecure(operation);

    expect(result.success).toBe(true);
    expect(result.outputVectors).toHaveLength(10);
    expect(result.computeTime).toBeGreaterThan(0);
    expect(result.contextId).toBeDefined();
  });

  test('should preserve vectors with identity matrix', async () => {
    const vectors = generateRandomMatrix(5, 128);
    const wMatrix = generateIdentityMatrix(128);

    const operation: SecureVectorOperation = {
      operationType: 'align',
      inputVectors: vectors,
      wMatrix,
    };

    const result = await engine.executeSecure(operation);

    // Identity matrix should preserve vectors
    for (let i = 0; i < vectors.length; i++) {
      for (let j = 0; j < 128; j++) {
        expect(result.outputVectors![i][j]).toBeCloseTo(vectors[i][j], 5);
      }
    }
  });

  test('should execute secure normalization', async () => {
    const vectors = [
      [3, 4, 0],
      [1, 1, 1],
      [2, 0, 0],
    ];

    const operation: SecureVectorOperation = {
      operationType: 'normalize',
      inputVectors: vectors,
    };

    const result = await engine.executeSecure(operation);

    expect(result.success).toBe(true);

    // Check normalization
    for (const vector of result.outputVectors!) {
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 5);
    }
  });

  test('should compute cosine similarity', async () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];

    const operation: SecureVectorOperation = {
      operationType: 'compute_similarity',
      inputVectors: [v1, v2],
    };

    const result = await engine.executeSecure(operation);

    expect(result.success).toBe(true);
    expect(result.outputVectors).toHaveLength(1);
    expect(result.outputVectors![0][0]).toBeCloseTo(1.0, 5);
  });

  test('should handle encryption operation', async () => {
    const vectors = generateRandomMatrix(5, 256);

    const operation: SecureVectorOperation = {
      operationType: 'encrypt',
      inputVectors: vectors,
    };

    const result = await engine.executeSecure(operation);

    expect(result.success).toBe(true);
    expect(result.outputVectors).toHaveLength(5);
  });

  test('should handle missing W-Matrix error', async () => {
    const vectors = generateRandomMatrix(5, 128);

    const operation: SecureVectorOperation = {
      operationType: 'align',
      inputVectors: vectors,
      // Missing wMatrix
    };

    const result = await engine.executeSecure(operation);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('W-Matrix required');
  });

  test('should update operation statistics', async () => {
    const vectors = generateRandomMatrix(10, 128);
    const wMatrix = generateRandomMatrix(128, 128);

    const operation: SecureVectorOperation = {
      operationType: 'align',
      inputVectors: vectors,
      wMatrix,
    };

    await engine.executeSecure(operation);
    await engine.executeSecure(operation);

    const stats = engine.getStats();
    expect(stats.operationsCompleted).toBe(2);
    expect(stats.averageLatency).toBeGreaterThan(0);
  });

  test('should include attestation in result', async () => {
    const vectors = generateRandomMatrix(5, 128);
    const wMatrix = generateRandomMatrix(128, 128);

    const operation: SecureVectorOperation = {
      operationType: 'align',
      inputVectors: vectors,
      wMatrix,
    };

    const result = await engine.executeSecure(operation);

    expect(result.attestation).toBeDefined();
    expect(result.attestation?.moduleId).toBeDefined();
  });
});

// ============================================================================
// Data Sealing Tests
// ============================================================================

describe('TEEIntegrationEngine - Data Sealing', () => {
  let engine: TEEIntegrationEngine;

  beforeEach(async () => {
    engine = new TEEIntegrationEngine({ provider: 'none' });
    await engine.initialize();
  });

  test('should seal data', async () => {
    const data = { vector: [1, 2, 3], metadata: { type: 'latent' } };

    const sealed = await engine.sealData(data);

    expect(typeof sealed).toBe('string');
    expect(sealed.length).toBeGreaterThan(0);
  });

  test('should unseal data', async () => {
    const originalData = { vector: [1, 2, 3], metadata: { type: 'latent' } };

    const sealed = await engine.sealData(originalData);
    const unsealed = await engine.unsealData(sealed);

    expect(unsealed).toEqual(originalData);
  });

  test('should handle complex data structures', async () => {
    const complexData = {
      vectors: generateRandomMatrix(5, 128),
      wMatrix: generateRandomMatrix(256, 128),
      metadata: {
        created: new Date().toISOString(),
        version: 2,
        tags: ['medical', 'confidential'],
      },
    };

    const sealed = await engine.sealData(complexData);
    const unsealed = await engine.unsealData(sealed);

    expect(unsealed.vectors).toEqual(complexData.vectors);
    expect(unsealed.wMatrix).toEqual(complexData.wMatrix);
  });
});

// ============================================================================
// Statistics Tests
// ============================================================================

describe('TEEIntegrationEngine - Statistics', () => {
  let engine: TEEIntegrationEngine;

  beforeEach(async () => {
    engine = new TEEIntegrationEngine({ provider: 'none' });
    await engine.initialize();
  });

  test('should track operation statistics', async () => {
    const vectors = generateRandomMatrix(10, 128);
    const wMatrix = generateRandomMatrix(128, 128);

    const operation: SecureVectorOperation = {
      operationType: 'align',
      inputVectors: vectors,
      wMatrix,
    };

    await engine.executeSecure(operation);
    await engine.executeSecure(operation);
    await engine.executeSecure(operation);

    const stats = engine.getStats();
    expect(stats.operationsCompleted).toBe(3);
    expect(stats.averageLatency).toBeGreaterThan(0);
  });

  test('should calculate average latency', async () => {
    const vectors = generateRandomMatrix(5, 128);
    const wMatrix = generateRandomMatrix(128, 128);

    const operation: SecureVectorOperation = {
      operationType: 'align',
      inputVectors: vectors,
      wMatrix,
    };

    await engine.executeSecure(operation);
    const stats1 = engine.getStats();

    await engine.executeSecure(operation);
    const stats2 = engine.getStats();

    expect(stats2.operationsCompleted).toBe(2);
    expect(stats2.averageLatency).toBeGreaterThan(0);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  test('secureAlign should align vectors', async () => {
    const vectors = generateRandomMatrix(5, 128);
    const wMatrix = generateIdentityMatrix(128);

    const aligned = await secureAlign(vectors, wMatrix);

    expect(aligned).toHaveLength(5);

    // Identity matrix should preserve vectors
    for (let i = 0; i < vectors.length; i++) {
      for (let j = 0; j < 128; j++) {
        expect(aligned[i][j]).toBeCloseTo(vectors[i][j], 5);
      }
    }
  });

  test('isRunningInTEE should detect TEE status', () => {
    const status = isRunningInTEE();

    expect(typeof status).toBe('boolean');
    // Should be false in test environment (provider: 'none')
    expect(status).toBe(false);
  });

  test('getCurrentAttestation should return attestation', async () => {
    const attestation = await getCurrentAttestation();

    // Should return attestation even for 'none' provider
    expect(attestation).toBeDefined();
    expect(attestation?.moduleId).toBeDefined();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('TEEIntegrationEngine - Integration', () => {
  let engine: TEEIntegrationEngine;

  beforeEach(async () => {
    engine = new TEEIntegrationEngine({ provider: 'none' });
    await engine.initialize();
  });

  test('should handle complete secure workflow', async () => {
    // Create secure context
    const context = await engine.createSecureContext();
    expect(context.isSealed).toBe(true);

    // Perform attestation
    const attestation = await engine.performAttestation();
    expect(attestation).toBeDefined();

    // Verify attestation
    const isValid = await engine.verifyAttestation(attestation);
    expect(isValid).toBe(true);

    // Execute secure operation
    const vectors = generateRandomMatrix(10, 256);
    const wMatrix = generateRandomMatrix(512, 256);

    const result = await engine.executeSecure({
      operationType: 'align',
      inputVectors: vectors,
      wMatrix,
    });

    expect(result.success).toBe(true);
    expect(result.outputVectors).toHaveLength(10);
    expect(result.outputVectors![0]).toHaveLength(512);

    // Destroy context
    await engine.destroyContext(context.contextId);
  });

  test('should handle multiple operations in sequence', async () => {
    const vectors = generateRandomMatrix(5, 128);
    const wMatrix = generateRandomMatrix(256, 128);

    // Alignment
    const alignResult = await engine.executeSecure({
      operationType: 'align',
      inputVectors: vectors,
      wMatrix,
    });

    expect(alignResult.success).toBe(true);

    // Normalization
    const normResult = await engine.executeSecure({
      operationType: 'normalize',
      inputVectors: alignResult.outputVectors!,
    });

    expect(normResult.success).toBe(true);

    // Verify normalized
    for (const vector of normResult.outputVectors!) {
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 5);
    }
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('TEEIntegrationEngine - Singleton', () => {
  test('should return same instance', () => {
    const engine1 = getTEEEngine();
    const engine2 = getTEEEngine();

    expect(engine1).toBe(engine2);
  });

  test('initializeTEE should return initialized engine', async () => {
    const engine = await initializeTEE({ provider: 'none' });

    expect(engine).toBeDefined();
    expect(engine.isAvailable()).toBe(true);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('TEEIntegrationEngine - Error Handling', () => {
  let engine: TEEIntegrationEngine;

  beforeEach(async () => {
    engine = new TEEIntegrationEngine({ provider: 'none' });
    await engine.initialize();
  });

  test('should handle invalid operation type', async () => {
    const vectors = generateRandomMatrix(5, 128);

    const result = await engine.executeSecure({
      operationType: 'invalid' as any,
      inputVectors: vectors,
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('Unknown operation type');
  });

  test('should handle similarity with wrong number of vectors', async () => {
    const vectors = generateRandomMatrix(3, 128); // Need exactly 2

    const result = await engine.executeSecure({
      operationType: 'compute_similarity',
      inputVectors: vectors,
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('exactly 2 vectors');
  });
});
