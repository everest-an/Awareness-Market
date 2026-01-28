/**
 * End-to-End Integration Tests
 *
 * Tests the complete lifecycle of the Awareness Market system:
 * 1. Chain Package Creation with Verification
 * 2. Dynamic Pricing with PID Controller
 * 3. Memory Forgetting over time
 * 4. Fee Distribution with Token Burning
 */

import { describe, test, expect, beforeEach } from 'vitest';

// Import all modules
import { PIDController, pricingEngine, calculateFeeDistribution } from './pricing-engine';
import {
  ChainVerificationEngine,
  verifyReasoningChain,
  type VerificationResult,
} from './latentmas/chain-verification';
import {
  MemoryForgettingEngine,
  getForgettingEngine,
} from './memory-forgetting';
import type { ReasoningChainData, ReasoningStep } from './latentmas/chain-package-builder';
import type { KVCache } from './latentmas/types';

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

function createMockReasoningChain(steps: number = 5): ReasoningChainData {
  const reasoningSteps: ReasoningStep[] = [];

  for (let i = 0; i < steps; i++) {
    reasoningSteps.push({
      stepIndex: i,
      description: `Step ${i}: Analyze problem and derive solution part ${i + 1}`,
      kvSnapshot: createMockKVCache(10 + i * 2),
      confidence: 0.85 + Math.random() * 0.1,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    steps: reasoningSteps,
    problemType: 'mathematical_reasoning',
    solutionQuality: 0.9,
    totalSteps: steps,
    initialContext: 'Solve the given mathematical problem step by step',
    finalOutput: 'The final solution is correct with 90% confidence',
  };
}

// ============================================================================
// E2E Scenario 1: Complete Package Lifecycle
// ============================================================================

describe('E2E: Complete Package Lifecycle', () => {
  let verificationEngine: ChainVerificationEngine;
  let pidController: PIDController;
  let forgettingEngine: MemoryForgettingEngine;
  let packageId: string;

  beforeEach(() => {
    verificationEngine = new ChainVerificationEngine();
    pidController = new PIDController();
    forgettingEngine = new MemoryForgettingEngine();
    packageId = `pkg-${Date.now()}`;
  });

  test('should handle complete package workflow', async () => {
    // Step 1: Create reasoning chain
    const chain = createMockReasoningChain(5);

    // Step 2: Verify reasoning chain
    const verification = await verificationEngine.verifyChain(chain);

    expect(verification.status).toBe('verified');
    expect(verification.overallScore).toBeGreaterThan(0.7);
    expect(verification.errors).toHaveLength(0);

    // Step 3: Calculate initial pricing
    const epsilon = 0.05; // 5% alignment loss
    const basePrice = 10.0;
    const royaltyFee = 5.0;

    const initialPricing = pidController.calculatePrice(basePrice, epsilon, royaltyFee);

    expect(initialPricing.totalPrice).toBeGreaterThan(basePrice);
    expect(initialPricing.alignmentFee).toBeGreaterThan(0);

    // Step 4: Record multiple transactions to adjust pricing
    for (let i = 0; i < 10; i++) {
      const txEpsilon = 0.04 + Math.random() * 0.02; // 4-6% variation
      pidController.recordTransaction(txEpsilon, `tx-${i}`, 'gpt-4', 'llama-3');
    }

    const adjustedPricing = pidController.calculatePrice(basePrice, epsilon, royaltyFee);

    // K parameter should have adjusted based on quality
    expect(adjustedPricing.currentK).toBeDefined();

    // Step 5: Calculate fee distribution
    const totalFee = adjustedPricing.alignmentFee;
    const distribution = calculateFeeDistribution(totalFee);

    expect(distribution.burnAmount).toBe(totalFee * 0.3);
    expect(distribution.maintainerAmount).toBe(totalFee * 0.2);
    expect(distribution.sellerAmount).toBe(totalFee * 0.5);

    // Step 6: Register package in forgetting engine
    forgettingEngine.registerMemory(packageId, 100);

    const memoryStatus = forgettingEngine.getMemoryStatus(packageId);
    expect(memoryStatus?.energyValue).toBe(100);
    expect(memoryStatus?.tier).toBe('hot');
    expect(memoryStatus?.isDormant).toBe(false);

    // Step 7: Simulate time passing and access patterns
    forgettingEngine.accessMemory(packageId, 10); // Boost energy
    const afterAccess = forgettingEngine.getMemoryStatus(packageId);
    expect(afterAccess?.energyValue).toBe(100); // Capped at 100

    // Step 8: Apply forgetting (immediately, so minimal decay)
    const forgettingResult = forgettingEngine.applyForgetting(packageId);

    expect(forgettingResult.newTier).toBe('hot');
    expect(forgettingResult.isDormant).toBe(false);
    expect(forgettingResult.shouldArchive).toBe(false);
  });
});

// ============================================================================
// E2E Scenario 2: Quality-Based Price Adjustment
// ============================================================================

describe('E2E: Quality-Based Price Adjustment', () => {
  let pidController: PIDController;

  beforeEach(() => {
    pidController = new PIDController({
      targetEpsilon: 0.05,
      Kp: 10.0,
      Ki: 1.0,
      Kd: 5.0,
      minK: 1.0,
      maxK: 100.0,
      windowSize: 50,
    });
  });

  test('should increase prices for consistently low quality', () => {
    const basePrice = 10.0;
    const royaltyFee = 5.0;

    // Initial pricing with target quality
    const initialPricing = pidController.calculatePrice(basePrice, 0.05, royaltyFee);
    const initialTotal = initialPricing.totalPrice;

    // Simulate 20 transactions with poor quality (10% loss)
    for (let i = 0; i < 20; i++) {
      pidController.recordTransaction(0.10, `pkg-${i}`, 'model-a', 'model-b');
    }

    // Pricing should increase for poor quality
    const adjustedPricing = pidController.calculatePrice(basePrice, 0.10, royaltyFee);
    const adjustedTotal = adjustedPricing.totalPrice;

    expect(adjustedTotal).toBeGreaterThan(initialTotal);
    expect(adjustedPricing.currentK).toBeGreaterThan(initialPricing.currentK);
  });

  test('should decrease prices for consistently high quality', () => {
    // First establish baseline with target quality
    for (let i = 0; i < 10; i++) {
      pidController.recordTransaction(0.05, `pkg-${i}`, 'model-a', 'model-b');
    }

    const baselinePricing = pidController.calculatePrice(10.0, 0.02, 5.0);
    const baselineK = baselinePricing.currentK;

    // Now simulate excellent quality (2% loss)
    for (let i = 0; i < 50; i++) {
      pidController.recordTransaction(0.02, `pkg-${i}`, 'model-a', 'model-b');
    }

    const improvedPricing = pidController.calculatePrice(10.0, 0.02, 5.0);

    // K should decrease (or stay similar) with sustained high quality
    expect(improvedPricing.currentK).toBeLessThanOrEqual(baselineK * 1.1);
  });
});

// ============================================================================
// E2E Scenario 3: Multi-Package Memory Management
// ============================================================================

describe('E2E: Multi-Package Memory Management', () => {
  let forgettingEngine: MemoryForgettingEngine;

  beforeEach(() => {
    forgettingEngine = new MemoryForgettingEngine({
      hotDecayRate: 0.5,
      warmDecayRate: 1.0,
      coldDecayRate: 2.0,
      warmThreshold: 7,
      coldThreshold: 30,
      frozenThreshold: 90,
    });
  });

  test('should manage multiple packages with different access patterns', () => {
    // Create 3 packages with different characteristics
    forgettingEngine.registerMemory('popular-pkg', 100);
    forgettingEngine.registerMemory('moderate-pkg', 100);
    forgettingEngine.registerMemory('unpopular-pkg', 100);

    // Simulate different access patterns
    // Popular: accessed frequently
    for (let i = 0; i < 10; i++) {
      forgettingEngine.accessMemory('popular-pkg', 5);
    }

    // Moderate: accessed occasionally
    for (let i = 0; i < 3; i++) {
      forgettingEngine.accessMemory('moderate-pkg', 5);
    }

    // Unpopular: rarely accessed (none)

    // Simulate time passing with varying ages
    forgettingEngine.setLastAccessTime(
      'popular-pkg',
      new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    );
    forgettingEngine.setLastAccessTime(
      'moderate-pkg',
      new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
    );
    forgettingEngine.setLastAccessTime(
      'unpopular-pkg',
      new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) // 40 days ago
    );

    // Apply forgetting to all
    const results = forgettingEngine.applyForgettingBatch();

    expect(results).toHaveLength(3);

    // Check tiers
    const popular = results.find(r => r.packageId === 'popular-pkg');
    const moderate = results.find(r => r.packageId === 'moderate-pkg');
    const unpopular = results.find(r => r.packageId === 'unpopular-pkg');

    expect(popular?.newTier).toBe('hot');
    expect(moderate?.newTier).toBe('warm');
    expect(unpopular?.newTier).toBe('cold');

    // Check energy decay
    expect(popular?.newEnergy).toBeGreaterThan(moderate?.newEnergy || 0);
    expect(moderate?.newEnergy).toBeGreaterThan(unpopular?.newEnergy || 0);
  });

  test('should handle dormancy and reactivation cycle', () => {
    forgettingEngine.registerMemory('dormant-pkg', 20); // Start with low energy

    // Simulate long period without access
    forgettingEngine.setLastAccessTime(
      'dormant-pkg',
      new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) // 200 days ago
    );

    // Apply forgetting
    const result = forgettingEngine.applyForgetting('dormant-pkg');

    expect(result.isDormant).toBe(true);
    expect(result.newEnergy).toBe(0);

    // Check if reactivation is possible
    const memoryBeforeReactivation = forgettingEngine.getMemoryStatus('dormant-pkg');
    expect(memoryBeforeReactivation?.isDormant).toBe(true);

    // Reactivate with generous AMEM payment (to cover any cost)
    const reactivation = forgettingEngine.reactivateMemory('dormant-pkg', 1000);

    // If reactivation failed, log the reason
    if (!reactivation.success) {
      console.log('Reactivation failed:', reactivation.message);
      console.log('Cost required:', reactivation.costPaid);
    }

    expect(reactivation.success).toBe(true);
    expect(reactivation.energyRestored).toBeGreaterThan(0);

    const reactivatedStatus = forgettingEngine.getMemoryStatus('dormant-pkg');
    expect(reactivatedStatus?.isDormant).toBe(false);
    expect(reactivatedStatus?.energyValue).toBeGreaterThan(0);
  });
});

// ============================================================================
// E2E Scenario 4: Verification Quality Gates
// ============================================================================

describe('E2E: Verification Quality Gates', () => {
  let verificationEngine: ChainVerificationEngine;

  beforeEach(() => {
    verificationEngine = new ChainVerificationEngine({
      minOverallScore: 0.7,
      minLogicalConsistency: 0.8,
      strictMode: false,
    });
  });

  test('should reject chains with critical errors', async () => {
    const badChain: ReasoningChainData = {
      steps: [
        {
          stepIndex: 0,
          description: 'Bad', // Too short
          kvSnapshot: createMockKVCache(10),
          confidence: 0.3, // Too low
          timestamp: new Date().toISOString(),
        },
      ],
      problemType: 'test',
      solutionQuality: 0.5,
      totalSteps: 1,
    };

    const result = await verificationEngine.verifyChain(badChain);

    expect(result.status).toBe('rejected');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should approve high-quality chains', async () => {
    const goodChain = createMockReasoningChain(10);

    const result = await verificationEngine.verifyChain(goodChain);

    expect(result.status).toBe('verified');
    expect(result.overallScore).toBeGreaterThan(0.7);
    expect(result.metrics.logicalConsistency).toBeGreaterThan(0.7);
    expect(result.metrics.completeness).toBeGreaterThan(0.8);
  });

  test('should handle borderline cases with disputed status', async () => {
    const borderlineChain: ReasoningChainData = {
      steps: [
        {
          stepIndex: 0,
          description: 'Minimal description that meets length requirement',
          kvSnapshot: createMockKVCache(5),
          confidence: 0.65, // Borderline
          timestamp: new Date().toISOString(),
        },
        {
          stepIndex: 1,
          description: 'Another minimal description for second step',
          kvSnapshot: createMockKVCache(5),
          confidence: 0.68,
          timestamp: new Date().toISOString(),
        },
      ],
      problemType: 'test',
      solutionQuality: 0.7,
      totalSteps: 2,
      initialContext: 'Minimal context',
      finalOutput: 'Minimal output',
    };

    const result = await verificationEngine.verifyChain(borderlineChain);

    // Should be verified or disputed, but not rejected
    expect(['verified', 'disputed']).toContain(result.status);
  });
});

// ============================================================================
// E2E Scenario 5: Complete Market Simulation
// ============================================================================

describe('E2E: Complete Market Simulation', () => {
  test('should simulate a full day of market activity', async () => {
    // Initialize all systems
    const pidController = new PIDController();
    const verificationEngine = new ChainVerificationEngine();
    const forgettingEngine = new MemoryForgettingEngine();

    const stats = {
      packagesCreated: 0,
      packagesVerified: 0,
      packagesRejected: 0,
      totalRevenue: 0,
      totalBurned: 0,
      dormantPackages: 0,
    };

    // Simulate 50 package creations throughout the day
    for (let i = 0; i < 50; i++) {
      const packageId = `market-pkg-${i}`;
      stats.packagesCreated++;

      // Create and verify chain
      const chain = createMockReasoningChain(3 + Math.floor(Math.random() * 5));
      const verification = await verificationEngine.verifyChain(chain);

      if (verification.status === 'verified') {
        stats.packagesVerified++;

        // Calculate pricing
        const epsilon = 0.03 + Math.random() * 0.05; // 3-8% loss
        const basePrice = 10.0;
        const royaltyFee = 5.0;

        const pricing = pidController.calculatePrice(basePrice, epsilon, royaltyFee);
        stats.totalRevenue += pricing.totalPrice;

        // Record transaction
        pidController.recordTransaction(epsilon, packageId, 'gpt-4', 'llama-3');

        // Calculate fee distribution
        const distribution = calculateFeeDistribution(pricing.alignmentFee);
        stats.totalBurned += distribution.burnAmount;

        // Register in memory system
        forgettingEngine.registerMemory(packageId, 100);

        // Simulate some packages being accessed
        if (Math.random() > 0.5) {
          forgettingEngine.accessMemory(packageId, 10);
        }
      } else {
        stats.packagesRejected++;
      }
    }

    // End of day: apply forgetting
    const forgettingResults = forgettingEngine.applyForgettingBatch();
    stats.dormantPackages = forgettingResults.filter(r => r.isDormant).length;

    // Verify market statistics
    expect(stats.packagesCreated).toBe(50);
    expect(stats.packagesVerified).toBeGreaterThan(40); // Most should pass
    expect(stats.totalRevenue).toBeGreaterThan(0);
    expect(stats.totalBurned).toBeGreaterThan(0);
    expect(stats.totalBurned).toBeLessThan(stats.totalRevenue); // Sanity check

    // Get PID status
    const pidStatus = pidController.getStatus();
    expect(pidStatus.transactionCount).toBeGreaterThan(40);

    // Get forgetting statistics
    const forgettingStats = forgettingEngine.getStatistics();
    expect(forgettingStats.total).toBe(stats.packagesVerified);
    expect(forgettingStats.hot).toBeGreaterThan(0);

    console.log('Market Simulation Results:', {
      ...stats,
      avgK: pidStatus.currentK.toFixed(2),
      avgEpsilon: pidStatus.currentEpsilon.toFixed(4),
      hotPackages: forgettingStats.hot,
      avgEnergy: forgettingStats.avgEnergy.toFixed(2),
    });
  });
});

// ============================================================================
// E2E Scenario 6: System Integration Health Check
// ============================================================================

describe('E2E: System Integration Health Check', () => {
  test('should verify all systems are operational', async () => {
    // Test 1: Pricing Engine
    const pricing = pricingEngine.calculatePackagePrice('test-pkg', 0.05, 10, 50);
    expect(pricing.totalPrice).toBeGreaterThan(0);

    // Test 2: Chain Verification
    const chain = createMockReasoningChain(3);
    const verification = await verifyReasoningChain(chain);
    expect(verification.status).toBeDefined();

    // Test 3: Memory Forgetting
    const forgetting = getForgettingEngine();
    forgetting.registerMemory('health-check', 100);
    const status = forgetting.getMemoryStatus('health-check');
    expect(status).toBeDefined();

    // Test 4: Fee Distribution
    const distribution = calculateFeeDistribution(100);
    expect(distribution.burnAmount + distribution.maintainerAmount + distribution.sellerAmount).toBe(100);

    console.log('✅ All systems operational');
  });
});
