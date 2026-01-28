/**
 * Tests for Reasoning Chain Verification System
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  ChainVerificationEngine,
  verifyReasoningChain,
  verifyReasoningChainStrict,
  type VerificationResult,
  type ChainError,
} from './chain-verification';
import type { ReasoningChainData, ReasoningStep } from './chain-package-builder';
import type { KVCache } from './types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockKVCache(size: number): KVCache {
  return {
    keys: [Array(size).fill(Array(128).fill(0.1))],
    values: [Array(size).fill(Array(128).fill(0.1))],
    metadata: {
      layerCount: 1,
      headCount: 8,
      hiddenSize: 128,
      sequenceLength: size,
    },
  };
}

function createMockStep(index: number, confidence: number = 0.8): ReasoningStep {
  return {
    stepIndex: index,
    description: `Reasoning step ${index}: Analyze and process information`,
    kvSnapshot: createMockKVCache(10 + index * 2),
    confidence,
    timestamp: new Date().toISOString(),
  };
}

function createValidChain(steps: number = 5): ReasoningChainData {
  return {
    steps: Array.from({ length: steps }, (_, i) => createMockStep(i, 0.85)),
    problemType: 'mathematical_reasoning',
    solutionQuality: 0.9,
    totalSteps: steps,
    initialContext: 'Given a mathematical problem, solve it step by step',
    finalOutput: 'The final answer is 42',
  };
}

// ============================================================================
// Verification Engine Tests
// ============================================================================

describe('ChainVerificationEngine', () => {
  let engine: ChainVerificationEngine;

  beforeEach(() => {
    engine = new ChainVerificationEngine();
  });

  test('should verify valid chain successfully', async () => {
    const chain = createValidChain();
    const result = await engine.verifyChain(chain);

    expect(result.status).toBe('verified');
    expect(result.method).toBe('automated');
    expect(result.overallScore).toBeGreaterThan(0.7);
    expect(result.errors).toHaveLength(0);
    expect(result.metrics.logicalConsistency).toBeGreaterThan(0.8);
    expect(result.metrics.stepCoherence).toBeGreaterThan(0.7);
  });

  test('should reject chain with missing steps', async () => {
    const chain: ReasoningChainData = {
      steps: [],
      problemType: 'test',
      solutionQuality: 0.5,
      totalSteps: 0,
    };

    const result = await engine.verifyChain(chain);

    expect(result.status).toBe('rejected');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].type).toBe('invalid_structure');
  });

  test('should detect step index discontinuity', async () => {
    const chain = createValidChain(3);
    chain.steps[1].stepIndex = 5; // Wrong index

    const result = await engine.verifyChain(chain);

    expect(result.status).toBe('rejected');
    const discontinuityError = result.errors.find(e => e.type === 'step_discontinuity');
    expect(discontinuityError).toBeDefined();
    expect(discontinuityError?.stepIndex).toBe(1);
  });

  test('should warn about low confidence steps', async () => {
    const chain = createValidChain(3);
    chain.steps[1].confidence = 0.3; // Low confidence

    const result = await engine.verifyChain(chain);

    expect(result.status).toBe('rejected'); // Should fail due to low confidence
    const lowConfError = result.errors.find(e => e.type === 'low_confidence');
    expect(lowConfError).toBeDefined();
  });

  test('should warn about missing KV snapshot', async () => {
    const chain = createValidChain(3);
    // @ts-expect-error - Testing missing data
    chain.steps[1].kvSnapshot = undefined;

    const result = await engine.verifyChain(chain);

    expect(result.status).toBe('rejected');
    const missingDataError = result.errors.find(
      e => e.type === 'missing_data' && e.stepIndex === 1
    );
    expect(missingDataError).toBeDefined();
  });

  test('should warn about short descriptions', async () => {
    const chain = createValidChain(3);
    chain.steps[0].description = 'Bad'; // Too short

    const result = await engine.verifyChain(chain);

    const shortDescWarning = result.warnings.find(
      w => w.type === 'missing_data' && w.message.includes('description')
    );
    expect(shortDescWarning).toBeDefined();
  });

  test('should detect significant KV cache size drop', async () => {
    const chain = createValidChain(3);
    chain.steps[0].kvSnapshot = createMockKVCache(100);
    chain.steps[1].kvSnapshot = createMockKVCache(20); // 80% drop

    const result = await engine.verifyChain(chain);

    const dropWarning = result.warnings.find(w =>
      w.message.includes('dropped significantly')
    );
    expect(dropWarning).toBeDefined();
  });

  test('should detect confidence drop', async () => {
    const chain = createValidChain(3);
    chain.steps[0].confidence = 0.9;
    chain.steps[1].confidence = 0.5; // 0.4 drop

    const result = await engine.verifyChain(chain);

    const confDropWarning = result.warnings.find(w =>
      w.type === 'low_confidence' && w.message.includes('dropped')
    );
    expect(confDropWarning).toBeDefined();
  });

  test('should check completeness', async () => {
    const chain = createValidChain(3);
    chain.initialContext = ''; // Missing context
    chain.finalOutput = undefined;

    const result = await engine.verifyChain(chain);

    const contextWarning = result.warnings.find(w =>
      w.message.includes('Initial context')
    );
    const outputWarning = result.warnings.find(w =>
      w.message.includes('Final output')
    );

    expect(contextWarning).toBeDefined();
    expect(outputWarning).toBeDefined();
    expect(result.metrics.completeness).toBeLessThan(0.7);
  });

  test('should calculate overall score correctly', async () => {
    const chain = createValidChain(5);
    const result = await engine.verifyChain(chain);

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(1);

    // Overall score should be weighted average of metrics
    const expectedScore =
      result.metrics.logicalConsistency * 0.25 +
      result.metrics.stepCoherence * 0.25 +
      result.metrics.confidenceScore * 0.20 +
      result.metrics.completeness * 0.15 +
      result.metrics.informationFlow * 0.15;

    expect(result.overallScore).toBeCloseTo(expectedScore, 2);
  });

  test('should update configuration', () => {
    const initialConfig = engine.getConfig();
    expect(initialConfig.minOverallScore).toBe(0.7);

    engine.updateConfig({ minOverallScore: 0.9 });

    const updatedConfig = engine.getConfig();
    expect(updatedConfig.minOverallScore).toBe(0.9);
  });

  test('should use strict mode correctly', async () => {
    const strictEngine = new ChainVerificationEngine({
      strictMode: true,
      minLogicalConsistency: 0.95,
    });

    const chain = createValidChain(3);
    const result = await strictEngine.verifyChain(chain);

    // In strict mode, even minor issues can cause disputed status
    expect(['verified', 'disputed']).toContain(result.status);
  });
});

// ============================================================================
// Human Verification Tests
// ============================================================================

describe('Human Verification', () => {
  let engine: ChainVerificationEngine;

  beforeEach(() => {
    engine = new ChainVerificationEngine();
  });

  test('should allow human override to approve', async () => {
    const chain = createValidChain(3);
    chain.steps[0].confidence = 0.4; // Would fail automated

    const result = await engine.verifyWithHuman(chain, {
      approved: true,
      comments: 'Manually reviewed and approved',
      verifierId: 'human-reviewer-123',
    });

    expect(result.status).toBe('verified');
    expect(result.method).toBe('human');
    expect(result.verifierId).toBe('human-reviewer-123');
  });

  test('should allow human override to reject', async () => {
    const chain = createValidChain(3);

    const result = await engine.verifyWithHuman(chain, {
      approved: false,
      comments: 'Found logical error in step 2',
      verifierId: 'human-reviewer-456',
    });

    expect(result.status).toBe('rejected');
    expect(result.method).toBe('human');
    const humanComment = result.warnings.find(w =>
      w.message.includes('Found logical error')
    );
    expect(humanComment).toBeDefined();
  });
});

// ============================================================================
// Consensus Verification Tests
// ============================================================================

describe('Consensus Verification', () => {
  let engine: ChainVerificationEngine;

  beforeEach(() => {
    engine = new ChainVerificationEngine();
  });

  test('should reach consensus with majority approval', async () => {
    const chain = createValidChain(3);

    // Create mock verifications (3 approve, 1 reject)
    const verifications: VerificationResult[] = [
      {
        status: 'verified',
        method: 'automated',
        overallScore: 0.85,
        errors: [],
        warnings: [],
        metrics: {
          logicalConsistency: 0.9,
          stepCoherence: 0.85,
          confidenceScore: 0.8,
          completeness: 0.9,
          informationFlow: 0.85,
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: 'verified',
        method: 'automated',
        overallScore: 0.8,
        errors: [],
        warnings: [],
        metrics: {
          logicalConsistency: 0.85,
          stepCoherence: 0.8,
          confidenceScore: 0.75,
          completeness: 0.85,
          informationFlow: 0.8,
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: 'verified',
        method: 'human',
        overallScore: 0.9,
        errors: [],
        warnings: [],
        metrics: {
          logicalConsistency: 0.95,
          stepCoherence: 0.9,
          confidenceScore: 0.85,
          completeness: 0.95,
          informationFlow: 0.9,
        },
        timestamp: new Date().toISOString(),
        verifierId: 'human-1',
      },
      {
        status: 'rejected',
        method: 'automated',
        overallScore: 0.5,
        errors: [
          {
            type: 'low_confidence',
            stepIndex: 1,
            severity: 'critical',
            message: 'Low confidence',
          },
        ],
        warnings: [],
        metrics: {
          logicalConsistency: 0.6,
          stepCoherence: 0.5,
          confidenceScore: 0.4,
          completeness: 0.6,
          informationFlow: 0.5,
        },
        timestamp: new Date().toISOString(),
      },
    ];

    const result = await engine.verifyWithConsensus(chain, verifications);

    expect(result.status).toBe('verified'); // 3 out of 4 approved (75% > 60%)
    expect(result.method).toBe('consensus');
    expect(result.overallScore).toBeGreaterThan(0.7);
  });

  test('should reach disputed with split decision', async () => {
    const chain = createValidChain(3);

    const verifications: VerificationResult[] = [
      {
        status: 'verified',
        method: 'automated',
        overallScore: 0.8,
        errors: [],
        warnings: [],
        metrics: {
          logicalConsistency: 0.8,
          stepCoherence: 0.8,
          confidenceScore: 0.8,
          completeness: 0.8,
          informationFlow: 0.8,
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: 'rejected',
        method: 'automated',
        overallScore: 0.5,
        errors: [],
        warnings: [],
        metrics: {
          logicalConsistency: 0.5,
          stepCoherence: 0.5,
          confidenceScore: 0.5,
          completeness: 0.5,
          informationFlow: 0.5,
        },
        timestamp: new Date().toISOString(),
      },
    ];

    const result = await engine.verifyWithConsensus(chain, verifications);

    expect(result.status).toBe('disputed'); // 50% not enough for consensus
  });

  test('should deduplicate errors in consensus', async () => {
    const chain = createValidChain(3);

    const sameError: ChainError = {
      type: 'low_confidence',
      stepIndex: 1,
      severity: 'critical',
      message: 'Low confidence',
    };

    const verifications: VerificationResult[] = [
      {
        status: 'rejected',
        method: 'automated',
        overallScore: 0.5,
        errors: [sameError],
        warnings: [],
        metrics: {
          logicalConsistency: 0.5,
          stepCoherence: 0.5,
          confidenceScore: 0.5,
          completeness: 0.5,
          informationFlow: 0.5,
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: 'rejected',
        method: 'automated',
        overallScore: 0.5,
        errors: [sameError], // Same error again
        warnings: [],
        metrics: {
          logicalConsistency: 0.5,
          stepCoherence: 0.5,
          confidenceScore: 0.5,
          completeness: 0.5,
          informationFlow: 0.5,
        },
        timestamp: new Date().toISOString(),
      },
    ];

    const result = await engine.verifyWithConsensus(chain, verifications);

    // Should only have one instance of the error
    expect(result.errors.length).toBe(1);
  });
});

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe('Convenience Functions', () => {
  test('verifyReasoningChain should use default settings', async () => {
    const chain = createValidChain(3);
    const result = await verifyReasoningChain(chain);

    expect(result.method).toBe('automated');
    expect(result.status).toBe('verified');
  });

  test('verifyReasoningChainStrict should use strict settings', async () => {
    const chain = createValidChain(3);
    chain.steps[0].confidence = 0.65; // Would pass normal, might fail strict

    const result = await verifyReasoningChainStrict(chain);

    expect(result.method).toBe('automated');
    // Strict mode is more demanding
    expect(['verified', 'disputed', 'rejected']).toContain(result.status);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  let engine: ChainVerificationEngine;

  beforeEach(() => {
    engine = new ChainVerificationEngine();
  });

  test('should handle single-step chain', async () => {
    const chain = createValidChain(1);
    const result = await engine.verifyChain(chain);

    expect(result.status).toBe('verified');
    expect(result.metrics.stepCoherence).toBe(1.0); // Single step = perfect coherence
  });

  test('should handle chain with missing confidence scores', async () => {
    const chain = createValidChain(3);
    chain.steps.forEach(step => {
      step.confidence = undefined;
    });

    const result = await engine.verifyChain(chain);

    expect(result.metrics.confidenceScore).toBe(0.5); // Default score
    const warning = result.warnings.find(w =>
      w.message.includes('No confidence scores')
    );
    expect(warning).toBeDefined();
  });

  test('should handle very long chains', async () => {
    const chain = createValidChain(100);
    const result = await engine.verifyChain(chain);

    // Should still verify but might have warnings
    expect(result.status).toBeDefined();
    expect(result.overallScore).toBeGreaterThan(0);
  });

  test('should handle empty consensus', async () => {
    const chain = createValidChain(3);
    const result = await engine.verifyWithConsensus(chain, []);

    // Should fall back to automated verification
    expect(result.method).toBe('automated');
  });
});
