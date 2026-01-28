/**
 * Tests for Automatic Quality Degradation System
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  AutoDegradationEngine,
  getDegradationEngine,
  type QualityMetrics,
  type QualityTier,
} from './auto-degradation';

// ============================================================================
// Test Helpers
// ============================================================================

function createHighQualityMetrics(): QualityMetrics {
  return {
    verificationScore: 0.95,
    averageEpsilon: 0.02,
    userRating: 4.8,
    complaintRate: 0.02,
    usageCount: 150,
    successRate: 0.98,
  };
}

function createMediumQualityMetrics(): QualityMetrics {
  return {
    verificationScore: 0.75,
    averageEpsilon: 0.06,
    userRating: 3.8,
    complaintRate: 0.12,
    usageCount: 60,
    successRate: 0.88,
  };
}

function createLowQualityMetrics(): QualityMetrics {
  return {
    verificationScore: 0.55,
    averageEpsilon: 0.15,
    userRating: 2.8,
    complaintRate: 0.30,
    usageCount: 20,
    successRate: 0.70,
  };
}

// ============================================================================
// Registration Tests
// ============================================================================

describe('AutoDegradationEngine - Registration', () => {
  let engine: AutoDegradationEngine;

  beforeEach(() => {
    engine = new AutoDegradationEngine();
  });

  test('should register package with default tier', () => {
    engine.registerPackage('pkg-001');

    const quality = engine.getPackageQuality('pkg-001');
    expect(quality).toBeDefined();
    expect(quality?.currentTier).toBe('silver');
    expect(quality?.previousTier).toBeNull();
  });

  test('should register package with custom tier', () => {
    engine.registerPackage('pkg-002', 'gold');

    const quality = engine.getPackageQuality('pkg-002');
    expect(quality?.currentTier).toBe('gold');
  });

  test('should register package with initial metrics', () => {
    const metrics = createHighQualityMetrics();
    engine.registerPackage('pkg-003', 'platinum', metrics);

    const quality = engine.getPackageQuality('pkg-003');
    expect(quality?.metrics.verificationScore).toBe(0.95);
    expect(quality?.metrics.userRating).toBe(4.8);
  });
});

// ============================================================================
// Metrics Update Tests
// ============================================================================

describe('AutoDegradationEngine - Metrics Updates', () => {
  let engine: AutoDegradationEngine;

  beforeEach(() => {
    engine = new AutoDegradationEngine();
  });

  test('should update package metrics', () => {
    engine.registerPackage('pkg-001');

    engine.updateMetrics('pkg-001', {
      verificationScore: 0.9,
      userRating: 4.5,
    });

    const quality = engine.getPackageQuality('pkg-001');
    expect(quality?.metrics.verificationScore).toBe(0.9);
    expect(quality?.metrics.userRating).toBe(4.5);
  });

  test('should record successful transaction', () => {
    engine.registerPackage('pkg-001');

    engine.recordTransaction('pkg-001', true, 0.04);

    const quality = engine.getPackageQuality('pkg-001');
    expect(quality?.metrics.usageCount).toBe(1);
    expect(quality?.metrics.successRate).toBe(1.0);
  });

  test('should record failed transaction', () => {
    engine.registerPackage('pkg-001');

    engine.recordTransaction('pkg-001', true, 0.03);
    engine.recordTransaction('pkg-001', true, 0.04);
    engine.recordTransaction('pkg-001', false, 0.10); // Failed

    const quality = engine.getPackageQuality('pkg-001');
    expect(quality?.metrics.usageCount).toBe(3);
    expect(quality?.metrics.successRate).toBeCloseTo(0.667, 2);
  });

  test('should update average epsilon with EMA', () => {
    engine.registerPackage('pkg-001');

    engine.recordTransaction('pkg-001', true, 0.02);
    engine.recordTransaction('pkg-001', true, 0.08);

    const quality = engine.getPackageQuality('pkg-001');
    // Should be between 0.02 and 0.08 due to EMA
    expect(quality?.metrics.averageEpsilon).toBeGreaterThan(0.02);
    expect(quality?.metrics.averageEpsilon).toBeLessThan(0.08);
  });

  test('should record user review', () => {
    engine.registerPackage('pkg-001');

    engine.recordReview('pkg-001', 5.0, false);
    engine.recordReview('pkg-001', 4.0, false);

    const quality = engine.getPackageQuality('pkg-001');
    expect(quality?.metrics.userRating).toBeGreaterThan(4.0);
    expect(quality?.metrics.userRating).toBeLessThan(5.0);
  });

  test('should track complaint rate', () => {
    engine.registerPackage('pkg-001');

    // Record transactions to establish usage
    for (let i = 0; i < 10; i++) {
      engine.recordTransaction('pkg-001', true, 0.05);
    }

    // Record complaints
    engine.recordReview('pkg-001', 2.0, true);
    engine.recordReview('pkg-001', 2.5, true);

    const quality = engine.getPackageQuality('pkg-001');
    expect(quality?.metrics.complaintRate).toBeGreaterThan(0);
  });
});

// ============================================================================
// Tier Evaluation Tests
// ============================================================================

describe('AutoDegradationEngine - Tier Evaluation', () => {
  let engine: AutoDegradationEngine;

  beforeEach(() => {
    engine = new AutoDegradationEngine();
  });

  test('should assign platinum tier for excellent metrics', () => {
    const metrics = createHighQualityMetrics();
    engine.registerPackage('pkg-platinum', 'silver', metrics);

    const result = engine.evaluatePackage('pkg-platinum');

    expect(result.newTier).toBe('platinum');
    expect(result.degraded).toBe(false);
  });

  test('should assign silver tier for medium metrics', () => {
    const metrics = createMediumQualityMetrics();
    engine.registerPackage('pkg-silver', 'gold', metrics);

    const result = engine.evaluatePackage('pkg-silver');

    expect(result.newTier).toBe('silver');
    expect(result.degraded).toBe(true);
  });

  test('should assign deprecated tier for poor metrics', () => {
    const metrics = createLowQualityMetrics();
    engine.registerPackage('pkg-bad', 'silver', metrics);

    const result = engine.evaluatePackage('pkg-bad');

    expect(result.newTier).toBe('deprecated');
    expect(result.degraded).toBe(true);
    expect(result.actionRequired).toBe('deprecation');
  });

  test('should maintain tier when quality is stable', () => {
    engine.registerPackage('pkg-stable', 'gold', {
      verificationScore: 0.85,
      averageEpsilon: 0.04,
      userRating: 4.2,
      complaintRate: 0.08,
      usageCount: 60,
      successRate: 0.92,
    });

    const result = engine.evaluatePackage('pkg-stable');

    expect(result.newTier).toBe('gold');
    expect(result.degraded).toBe(false);
  });

  test('should provide degradation reasons', () => {
    engine.registerPackage('pkg-degrading', 'platinum', createHighQualityMetrics());

    // Degrade metrics
    engine.updateMetrics('pkg-degrading', {
      verificationScore: 0.65,
      averageEpsilon: 0.10,
      userRating: 3.2,
    });

    const result = engine.evaluatePackage('pkg-degrading');

    expect(result.degraded).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.some(r => r.includes('verification'))).toBe(true);
  });
});

// ============================================================================
// Degradation History Tests
// ============================================================================

describe('AutoDegradationEngine - Degradation History', () => {
  let engine: AutoDegradationEngine;

  beforeEach(() => {
    engine = new AutoDegradationEngine();
  });

  test('should record degradation events', () => {
    engine.registerPackage('pkg-001', 'platinum', createHighQualityMetrics());

    // Degrade quality
    engine.updateMetrics('pkg-001', createMediumQualityMetrics());
    engine.evaluatePackage('pkg-001');

    const quality = engine.getPackageQuality('pkg-001');
    expect(quality?.degradationHistory).toHaveLength(1);
    expect(quality?.degradationHistory[0].fromTier).toBe('platinum');
    expect(quality?.degradationHistory[0].toTier).toBe('silver');
  });

  test('should track multiple degradation events', () => {
    engine.registerPackage('pkg-002', 'platinum', createHighQualityMetrics());

    // First degradation
    engine.updateMetrics('pkg-002', createMediumQualityMetrics());
    engine.evaluatePackage('pkg-002');

    // Second degradation
    engine.updateMetrics('pkg-002', createLowQualityMetrics());
    engine.evaluatePackage('pkg-002');

    const quality = engine.getPackageQuality('pkg-002');
    expect(quality?.degradationHistory).toHaveLength(2);
    expect(quality?.previousTier).toBe('silver');
    expect(quality?.currentTier).toBe('deprecated');
  });

  test('should not record event when tier unchanged', () => {
    // Register with metrics that meet gold tier requirements
    engine.registerPackage('pkg-003', 'gold', {
      verificationScore: 0.85,
      averageEpsilon: 0.04,
      userRating: 4.2,
      complaintRate: 0.08,
      usageCount: 60,
      successRate: 0.92,
    });

    engine.evaluatePackage('pkg-003');
    engine.evaluatePackage('pkg-003');

    const quality = engine.getPackageQuality('pkg-003');
    expect(quality?.degradationHistory).toHaveLength(0);
  });
});

// ============================================================================
// Batch Operations Tests
// ============================================================================

describe('AutoDegradationEngine - Batch Operations', () => {
  let engine: AutoDegradationEngine;

  beforeEach(() => {
    engine = new AutoDegradationEngine();
  });

  test('should evaluate all packages', () => {
    engine.registerPackage('pkg-001', 'platinum', createHighQualityMetrics());
    engine.registerPackage('pkg-002', 'gold', createMediumQualityMetrics());
    engine.registerPackage('pkg-003', 'silver', createLowQualityMetrics());

    const results = engine.evaluateAll();

    expect(results).toHaveLength(3);
  });

  test('should get packages by tier', () => {
    engine.registerPackage('pkg-001', 'platinum', createHighQualityMetrics());
    engine.registerPackage('pkg-002', 'gold');
    engine.registerPackage('pkg-003', 'silver');

    // Evaluate to set correct tiers
    engine.evaluateAll();

    const platinumPackages = engine.getPackagesByTier('platinum');
    expect(platinumPackages.length).toBeGreaterThanOrEqual(1);
  });

  test('should get degraded packages', () => {
    engine.registerPackage('pkg-001', 'platinum', createHighQualityMetrics());
    engine.registerPackage('pkg-002', 'gold', createHighQualityMetrics());

    // Degrade one package
    engine.updateMetrics('pkg-001', createLowQualityMetrics());
    engine.evaluatePackage('pkg-001');

    const degraded = engine.getDegradedPackages();
    expect(degraded.length).toBe(1);
    expect(degraded[0].packageId).toBe('pkg-001');
  });

  test('should get statistics', () => {
    engine.registerPackage('pkg-001', 'platinum', createHighQualityMetrics());
    engine.registerPackage('pkg-002', 'gold');
    engine.registerPackage('pkg-003', 'silver');
    engine.registerPackage('pkg-004', 'bronze');

    engine.evaluateAll();

    const stats = engine.getStatistics();
    expect(stats.total).toBe(4);
    expect(stats.platinum + stats.gold + stats.silver + stats.bronze + stats.deprecated).toBe(4);
  });
});

// ============================================================================
// Action Requirements Tests
// ============================================================================

describe('AutoDegradationEngine - Action Requirements', () => {
  let engine: AutoDegradationEngine;

  beforeEach(() => {
    engine = new AutoDegradationEngine();
  });

  test('should require deprecation for severely degraded packages', () => {
    engine.registerPackage('pkg-001', 'silver', createMediumQualityMetrics());

    engine.updateMetrics('pkg-001', createLowQualityMetrics());
    const result = engine.evaluatePackage('pkg-001');

    expect(result.newTier).toBe('deprecated');
    expect(result.actionRequired).toBe('deprecation');
  });

  test('should require price increase for moderate degradation', () => {
    engine.registerPackage('pkg-001', 'gold');

    engine.updateMetrics('pkg-001', {
      verificationScore: 0.75,
      averageEpsilon: 0.07,
      userRating: 3.7,
      complaintRate: 0.13,
      usageCount: 30,
      successRate: 0.86,
    });

    const result = engine.evaluatePackage('pkg-001');

    expect(result.degraded).toBe(true);
    expect(result.actionRequired).toBe('price_increase');
  });

  test('should require no action when quality improves', () => {
    engine.registerPackage('pkg-001', 'silver', createMediumQualityMetrics());

    engine.updateMetrics('pkg-001', createHighQualityMetrics());
    const result = engine.evaluatePackage('pkg-001');

    expect(result.newTier).toBe('platinum');
    expect(result.degraded).toBe(false);
    expect(result.actionRequired).toBe('none');
  });
});

// ============================================================================
// Threshold Management Tests
// ============================================================================

describe('AutoDegradationEngine - Threshold Management', () => {
  let engine: AutoDegradationEngine;

  beforeEach(() => {
    engine = new AutoDegradationEngine();
  });

  test('should use custom thresholds', () => {
    const customEngine = new AutoDegradationEngine({
      platinum: {
        minVerificationScore: 0.95,
        maxEpsilon: 0.02,
        minUserRating: 4.8,
        maxComplaintRate: 0.03,
        minUsageCount: 200,
        minSuccessRate: 0.98,
      },
    });

    const thresholds = customEngine.getThresholds();
    expect(thresholds.platinum.minVerificationScore).toBe(0.95);
  });

  test('should update thresholds dynamically', () => {
    engine.updateThresholds({
      gold: {
        minVerificationScore: 0.85,
        maxEpsilon: 0.04,
        minUserRating: 4.2,
        maxComplaintRate: 0.08,
        minUsageCount: 75,
        minSuccessRate: 0.92,
      },
    });

    const thresholds = engine.getThresholds();
    expect(thresholds.gold.minVerificationScore).toBe(0.85);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('AutoDegradationEngine - Integration', () => {
  let engine: AutoDegradationEngine;

  beforeEach(() => {
    engine = new AutoDegradationEngine();
  });

  test('should simulate real-world quality degradation', () => {
    // Start with high quality
    engine.registerPackage('pkg-real', 'platinum', createHighQualityMetrics());

    // Simulate usage with declining quality
    for (let i = 0; i < 20; i++) {
      const success = Math.random() > 0.15; // 85% success rate
      const epsilon = 0.03 + Math.random() * 0.05; // 3-8% epsilon
      engine.recordTransaction('pkg-real', success, epsilon);
    }

    // Add some negative reviews
    engine.recordReview('pkg-real', 3.5, false);
    engine.recordReview('pkg-real', 3.0, true);

    // Evaluate
    const result = engine.evaluatePackage('pkg-real');

    // Quality should have degraded
    expect(result.newTier).not.toBe('platinum');
    expect(result.degraded).toBe(true);

    const quality = engine.getPackageQuality('pkg-real');
    // Initial metrics had usageCount: 150, plus 20 transactions = 170
    expect(quality?.metrics.usageCount).toBe(170);
  });

  test('should handle error cases gracefully', () => {
    expect(() => {
      engine.updateMetrics('non-existent', { verificationScore: 0.8 });
    }).toThrow();

    expect(() => {
      engine.recordTransaction('non-existent', true, 0.05);
    }).toThrow();
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('AutoDegradationEngine - Singleton', () => {
  test('should return same instance', () => {
    const engine1 = getDegradationEngine();
    const engine2 = getDegradationEngine();

    expect(engine1).toBe(engine2);
  });
});
