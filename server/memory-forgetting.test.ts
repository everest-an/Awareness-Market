/**
 * Tests for Memory Forgetting Mechanism
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MemoryForgettingEngine,
  ForgettingScheduler,
  getForgettingEngine,
  getForgettingScheduler,
  type MemoryMetadata,
} from './memory-forgetting';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestEngine() {
  return new MemoryForgettingEngine({
    hotDecayRate: 0.5,
    warmDecayRate: 1.0,
    coldDecayRate: 2.0,
    warmThreshold: 7,
    coldThreshold: 30,
    frozenThreshold: 90,
    dormancyEnergyThreshold: 20,
    dormancyTimeThreshold: 180,
    baseReactivationCost: 10,
    reactivationCostMultiplier: 1.5,
    autoDeleteEnabled: false,
  });
}

function advanceTime(engine: MemoryForgettingEngine, packageId: string, days: number): void {
  const memory = engine.getMemoryStatus(packageId);
  if (memory) {
    const newDate = new Date(memory.lastAccessTime.getTime() - days * 24 * 60 * 60 * 1000);
    engine.setLastAccessTime(packageId, newDate);
  }
}

// ============================================================================
// Memory Registration Tests
// ============================================================================

describe('MemoryForgettingEngine - Registration', () => {
  let engine: MemoryForgettingEngine;

  beforeEach(() => {
    engine = createTestEngine();
  });

  test('should register new memory with default energy', () => {
    engine.registerMemory('mem-001');
    const status = engine.getMemoryStatus('mem-001');

    expect(status).toBeDefined();
    expect(status?.energyValue).toBe(100);
    expect(status?.tier).toBe('hot');
    expect(status?.isDormant).toBe(false);
    expect(status?.accessCount).toBe(0);
  });

  test('should register memory with custom initial energy', () => {
    engine.registerMemory('mem-002', 50);
    const status = engine.getMemoryStatus('mem-002');

    expect(status?.energyValue).toBe(50);
  });

  test('should clamp initial energy to 0-100 range', () => {
    engine.registerMemory('mem-003', 150);
    expect(engine.getMemoryStatus('mem-003')?.energyValue).toBe(100);

    engine.registerMemory('mem-004', -50);
    expect(engine.getMemoryStatus('mem-004')?.energyValue).toBe(0);
  });
});

// ============================================================================
// Memory Access Tests
// ============================================================================

describe('MemoryForgettingEngine - Access', () => {
  let engine: MemoryForgettingEngine;

  beforeEach(() => {
    engine = createTestEngine();
  });

  test('should record memory access and boost energy', () => {
    engine.registerMemory('mem-001', 50);
    engine.accessMemory('mem-001', 10);

    const status = engine.getMemoryStatus('mem-001');
    expect(status?.energyValue).toBe(60);
    expect(status?.accessCount).toBe(1);
  });

  test('should cap energy at 100', () => {
    engine.registerMemory('mem-001', 95);
    engine.accessMemory('mem-001', 20);

    const status = engine.getMemoryStatus('mem-001');
    expect(status?.energyValue).toBe(100);
  });

  test('should throw error for non-existent memory', () => {
    expect(() => {
      engine.accessMemory('non-existent');
    }).toThrow('Memory non-existent not found');
  });

  test('should reset dormancy on access', () => {
    engine.registerMemory('mem-001', 10); // Low energy
    const memory = engine.getMemoryStatus('mem-001')!;

    // Simulate dormancy
    memory.isDormant = true;

    engine.accessMemory('mem-001', 20);
    expect(engine.getMemoryStatus('mem-001')?.isDormant).toBe(false);
  });
});

// ============================================================================
// Forgetting Curve Tests
// ============================================================================

describe('MemoryForgettingEngine - Forgetting', () => {
  let engine: MemoryForgettingEngine;

  beforeEach(() => {
    engine = createTestEngine();
  });

  test('should not decay energy for recent memories (hot tier)', () => {
    engine.registerMemory('mem-001', 100);

    // Access immediately, so days since access = 0
    const result = engine.applyForgetting('mem-001');

    expect(result.newEnergy).toBeCloseTo(100, 1);
    expect(result.newTier).toBe('hot');
  });

  test('should apply light decay for warm tier', () => {
    engine.registerMemory('mem-001', 100);

    // Simulate 10 days without access (warm tier: 7-30 days)
    advanceTime(engine, 'mem-001', 10);

    const result = engine.applyForgetting('mem-001');

    expect(result.newTier).toBe('warm');
    expect(result.newEnergy).toBeLessThan(100);
    expect(result.newEnergy).toBeGreaterThanOrEqual(85); // 1% per day * 10 days ≈ 10%, so ≥ 85
    expect(result.daysSinceAccess).toBeGreaterThan(9);
  });

  test('should apply heavy decay for cold tier', () => {
    engine.registerMemory('mem-001', 100);
    const memory = engine.getMemoryStatus('mem-001')!;

    // Simulate 40 days without access (cold tier: 30-90 days)
    advanceTime(engine, 'mem-001', 40);

    const result = engine.applyForgetting('mem-001');

    expect(result.newTier).toBe('cold');
    expect(result.newEnergy).toBeLessThan(100);
    // 2% per day * 40 days = 80% loss
    expect(result.newEnergy).toBeLessThan(30);
  });

  test('should mark memory as frozen after threshold', () => {
    engine.registerMemory('mem-001', 100);
    const memory = engine.getMemoryStatus('mem-001')!;

    // Simulate 100 days without access (frozen: >90 days)
    advanceTime(engine, 'mem-001', 100);

    const result = engine.applyForgetting('mem-001');

    expect(result.newTier).toBe('frozen');
    expect(result.newEnergy).toBe(0); // Should be fully decayed
  });

  test('should mark memory as dormant when energy is low', () => {
    engine.registerMemory('mem-001', 25);
    const memory = engine.getMemoryStatus('mem-001')!;

    // Simulate 50 days without access
    advanceTime(engine, 'mem-001', 50);

    const result = engine.applyForgetting('mem-001');

    expect(result.isDormant).toBe(true);
    expect(result.newEnergy).toBeLessThan(20); // Below dormancy threshold
  });

  test('should suggest archiving frozen low-energy memories', () => {
    engine.registerMemory('mem-001', 100);
    const memory = engine.getMemoryStatus('mem-001')!;

    // Simulate 100 days without access
    advanceTime(engine, 'mem-001', 100);

    const result = engine.applyForgetting('mem-001');

    expect(result.newTier).toBe('frozen');
    expect(result.newEnergy).toBeLessThan(50);
    expect(result.shouldArchive).toBe(true);
  });

  test('should not suggest deletion by default (safety)', () => {
    engine.registerMemory('mem-001', 100);
    const memory = engine.getMemoryStatus('mem-001')!;

    // Simulate 400 days without access
    advanceTime(engine, 'mem-001', 400);

    const result = engine.applyForgetting('mem-001');

    expect(result.shouldDelete).toBe(false); // autoDeleteEnabled = false
  });

  test('should suggest deletion when enabled and thresholds met', () => {
    const engineWithDelete = new MemoryForgettingEngine({
      autoDeleteEnabled: true,
      minEnergyForDeletion: 0,
      minDormancyDaysForDeletion: 365,
    });

    engineWithDelete.registerMemory('mem-001', 100);

    // Simulate 400 days without access
    advanceTime(engineWithDelete, 'mem-001', 400);

    const result = engineWithDelete.applyForgetting('mem-001');

    expect(result.newEnergy).toBe(0);
    expect(result.shouldDelete).toBe(true);
  });
});

// ============================================================================
// Batch Forgetting Tests
// ============================================================================

describe('MemoryForgettingEngine - Batch Operations', () => {
  let engine: MemoryForgettingEngine;

  beforeEach(() => {
    engine = createTestEngine();
  });

  test('should apply forgetting to multiple memories', () => {
    engine.registerMemory('mem-001');
    engine.registerMemory('mem-002');
    engine.registerMemory('mem-003');

    const results = engine.applyForgettingBatch();

    expect(results).toHaveLength(3);
    expect(results.every(r => r.packageId.startsWith('mem-'))).toBe(true);
  });

  test('should handle errors gracefully in batch', () => {
    engine.registerMemory('mem-001');
    // mem-002 doesn't exist
    engine.registerMemory('mem-003');

    const results = engine.applyForgettingBatch();

    // Should process existing memories despite errors
    expect(results.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Reactivation Tests
// ============================================================================

describe('MemoryForgettingEngine - Reactivation', () => {
  let engine: MemoryForgettingEngine;

  beforeEach(() => {
    engine = createTestEngine();
  });

  test('should reactivate dormant memory with sufficient AMEM', () => {
    engine.registerMemory('mem-001', 15); // Low energy

    // Make dormant - advance time and apply forgetting
    advanceTime(engine, 'mem-001', 200);
    const forgettingResult = engine.applyForgetting('mem-001');

    // Verify it's actually dormant before attempting reactivation
    expect(forgettingResult.isDormant).toBe(true);
    expect(forgettingResult.newEnergy).toBe(0); // Should be fully decayed after 200 days

    const result = engine.reactivateMemory('mem-001', 1000); // Pay plenty of AMEM

    if (!result.success) {
      console.log('Reactivation failed:', result.message);
    }

    expect(result.success).toBe(true);
    expect(result.energyRestored).toBeGreaterThan(0);
    expect(engine.getMemoryStatus('mem-001')?.isDormant).toBe(false);
  });

  test('should reject reactivation with insufficient AMEM', () => {
    engine.registerMemory('mem-001', 15);
    const memory = engine.getMemoryStatus('mem-001')!;

    // Make dormant
    advanceTime(engine, 'mem-001', 200);
    engine.applyForgetting('mem-001');

    const result = engine.reactivateMemory('mem-001', 1); // Pay only 1 AMEM

    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient AMEM');
  });

  test('should reject reactivation of non-dormant memory', () => {
    engine.registerMemory('mem-001', 100); // High energy

    const result = engine.reactivateMemory('mem-001', 100);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not dormant');
  });

  test('should calculate higher cost for long-dormant memories', () => {
    engine.registerMemory('mem-001', 10);
    advanceTime(engine, 'mem-001', 60); // 60 days = 2 months
    const result1Forget = engine.applyForgetting('mem-001');
    expect(result1Forget.isDormant).toBe(true);

    engine.registerMemory('mem-002', 10);
    advanceTime(engine, 'mem-002', 200); // 200 days = longer dormancy
    const result2Forget = engine.applyForgetting('mem-002');
    expect(result2Forget.isDormant).toBe(true);

    const result1 = engine.reactivateMemory('mem-001', 100); // Pay enough
    const result2 = engine.reactivateMemory('mem-002', 200); // Pay more for longer dormancy

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // mem-002 was dormant longer, so should cost more
    expect(result2.costPaid).toBeGreaterThan(result1.costPaid);
  });

  test('should restore energy up to maximum', () => {
    engine.registerMemory('mem-001', 5); // Very low energy
    const memory = engine.getMemoryStatus('mem-001')!;

    advanceTime(engine, 'mem-001', 200);
    engine.applyForgetting('mem-001');

    const result = engine.reactivateMemory('mem-001', 1000); // Pay a lot

    expect(result.success).toBe(true);
    const status = engine.getMemoryStatus('mem-001');
    expect(status?.energyValue).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// Query Tests
// ============================================================================

describe('MemoryForgettingEngine - Queries', () => {
  let engine: MemoryForgettingEngine;

  beforeEach(() => {
    engine = createTestEngine();
  });

  test('should get dormant memories', () => {
    engine.registerMemory('mem-001', 10);
    engine.registerMemory('mem-002', 50);
    engine.registerMemory('mem-003', 100);

    advanceTime(engine, 'mem-001', 200);
    engine.applyForgetting('mem-001');

    const dormant = engine.getDormantMemories();

    expect(dormant.length).toBeGreaterThan(0);
    expect(dormant.every(m => m.isDormant)).toBe(true);
  });

  test('should get memories by tier', () => {
    engine.registerMemory('mem-hot', 100);

    engine.registerMemory('mem-warm', 100);
    advanceTime(engine, 'mem-warm', 10);
    engine.applyForgetting('mem-warm');

    engine.registerMemory('mem-cold', 100);
    advanceTime(engine, 'mem-cold', 40);
    engine.applyForgetting('mem-cold');

    const hotMemories = engine.getMemoriesByTier('hot');
    const warmMemories = engine.getMemoriesByTier('warm');
    const coldMemories = engine.getMemoriesByTier('cold');

    expect(hotMemories.length).toBeGreaterThan(0);
    expect(warmMemories.length).toBeGreaterThan(0);
    expect(coldMemories.length).toBeGreaterThan(0);
  });

  test('should get memory statistics', () => {
    engine.registerMemory('mem-001', 100);
    engine.registerMemory('mem-002', 50);
    engine.registerMemory('mem-003', 10);

    const stats = engine.getStatistics();

    expect(stats.total).toBe(3);
    expect(stats.hot).toBeGreaterThan(0);
    expect(stats.avgEnergy).toBeGreaterThan(0);
  });
});

// ============================================================================
// Configuration Tests
// ============================================================================

describe('MemoryForgettingEngine - Configuration', () => {
  let engine: MemoryForgettingEngine;

  beforeEach(() => {
    engine = createTestEngine();
  });

  test('should update configuration', () => {
    const initialConfig = engine.getConfig();
    expect(initialConfig.hotDecayRate).toBe(0.5);

    engine.updateConfig({ hotDecayRate: 1.0 });

    const updatedConfig = engine.getConfig();
    expect(updatedConfig.hotDecayRate).toBe(1.0);
  });

  test('should clear memory store', () => {
    engine.registerMemory('mem-001');
    engine.registerMemory('mem-002');

    expect(engine.getStatistics().total).toBe(2);

    engine.clear();

    expect(engine.getStatistics().total).toBe(0);
  });
});

// ============================================================================
// Scheduler Tests
// ============================================================================

describe('ForgettingScheduler', () => {
  let engine: MemoryForgettingEngine;
  let scheduler: ForgettingScheduler;

  beforeEach(() => {
    engine = createTestEngine();
    scheduler = new ForgettingScheduler(engine);
  });

  afterEach(() => {
    scheduler.stop();
  });

  test('should start and stop scheduler', () => {
    expect(scheduler.isActive()).toBe(false);

    scheduler.start(24);
    expect(scheduler.isActive()).toBe(true);

    scheduler.stop();
    expect(scheduler.isActive()).toBe(false);
  });

  test('should run forgetting task manually', async () => {
    engine.registerMemory('mem-001');
    engine.registerMemory('mem-002');

    const result = await scheduler.runForgettingTask();

    expect(result.processed).toBe(2);
    expect(result.errors).toBe(0);
  });

  test('should not start twice', () => {
    scheduler.start(24);

    // Try to start again
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    scheduler.start(24);

    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('already running'));
    consoleWarn.mockRestore();
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('Singleton Instances', () => {
  test('should return same engine instance', () => {
    const engine1 = getForgettingEngine();
    const engine2 = getForgettingEngine();

    expect(engine1).toBe(engine2);
  });

  test('should return same scheduler instance', () => {
    const scheduler1 = getForgettingScheduler();
    const scheduler2 = getForgettingScheduler();

    expect(scheduler1).toBe(scheduler2);
  });
});
