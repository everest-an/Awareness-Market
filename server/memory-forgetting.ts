/**
 * Memory Forgetting Mechanism
 *
 * Implements the "forgetting curve" for KV-Cache memories based on:
 * - Last access time
 * - Energy value decay
 * - Storage optimization
 * - GDPR compliance
 *
 * Reference: Whitepaper Section 11.4 "Memory Forgetting Mechanism"
 */

import { createLogger } from './utils/logger';

const logger = createLogger('MemoryForgetting');

// ============================================================================
// Types
// ============================================================================

export interface MemoryMetadata {
  packageId: string;
  lastAccessTime: Date;
  createdAt: Date;
  accessCount: number;
  energyValue: number; // 0-100, decays over time
  isDormant: boolean;
  tier: 'hot' | 'warm' | 'cold' | 'frozen';
}

export interface ForgettingConfig {
  // Energy decay rates (% per day)
  hotDecayRate: number; // Default: 0.5% per day
  warmDecayRate: number; // Default: 1% per day
  coldDecayRate: number; // Default: 2% per day

  // Tier thresholds (days since last access)
  warmThreshold: number; // Default: 7 days
  coldThreshold: number; // Default: 30 days
  frozenThreshold: number; // Default: 90 days

  // Dormancy threshold
  dormancyEnergyThreshold: number; // Default: 20
  dormancyTimeThreshold: number; // Default: 180 days (6 months)

  // Reactivation cost (multiplier based on dormancy duration)
  baseReactivationCost: number; // Default: 10 AMEM
  reactivationCostMultiplier: number; // Default: 1.5

  // Cleanup settings
  autoDeleteEnabled: boolean; // Default: false (safety first)
  minEnergyForDeletion: number; // Default: 0
  minDormancyDaysForDeletion: number; // Default: 365
}

export interface ForgettingResult {
  packageId: string;
  oldEnergy: number;
  newEnergy: number;
  oldTier: string;
  newTier: string;
  daysSinceAccess: number;
  isDormant: boolean;
  shouldArchive: boolean;
  shouldDelete: boolean;
}

export interface ReactivationResult {
  packageId: string;
  success: boolean;
  energyRestored: number;
  costPaid: number;
  newTier: string;
  message: string;
}

// ============================================================================
// Memory Forgetting Engine
// ============================================================================

export class MemoryForgettingEngine {
  private config: ForgettingConfig;
  private memoryStore: Map<string, MemoryMetadata> = new Map();

  constructor(config: Partial<ForgettingConfig> = {}) {
    this.config = {
      hotDecayRate: config.hotDecayRate ?? 0.5,
      warmDecayRate: config.warmDecayRate ?? 1.0,
      coldDecayRate: config.coldDecayRate ?? 2.0,
      warmThreshold: config.warmThreshold ?? 7,
      coldThreshold: config.coldThreshold ?? 30,
      frozenThreshold: config.frozenThreshold ?? 90,
      dormancyEnergyThreshold: config.dormancyEnergyThreshold ?? 20,
      dormancyTimeThreshold: config.dormancyTimeThreshold ?? 180,
      baseReactivationCost: config.baseReactivationCost ?? 10,
      reactivationCostMultiplier: config.reactivationCostMultiplier ?? 1.5,
      autoDeleteEnabled: config.autoDeleteEnabled ?? false,
      minEnergyForDeletion: config.minEnergyForDeletion ?? 0,
      minDormancyDaysForDeletion: config.minDormancyDaysForDeletion ?? 365,
    };
  }

  /**
   * Register a new memory package
   */
  registerMemory(packageId: string, initialEnergy: number = 100): void {
    this.memoryStore.set(packageId, {
      packageId,
      lastAccessTime: new Date(),
      createdAt: new Date(),
      accessCount: 0,
      energyValue: Math.min(100, Math.max(0, initialEnergy)),
      isDormant: false,
      tier: 'hot',
    });
  }

  /**
   * Record memory access (refreshes energy)
   */
  accessMemory(packageId: string, energyBoost: number = 10): void {
    const memory = this.memoryStore.get(packageId);
    if (!memory) {
      throw new Error(`Memory ${packageId} not found`);
    }

    memory.lastAccessTime = new Date();
    memory.accessCount++;
    memory.energyValue = Math.min(100, memory.energyValue + energyBoost);
    memory.isDormant = false;

    // Update tier based on new access
    memory.tier = this.calculateTier(memory);

    this.memoryStore.set(packageId, memory);
  }

  /**
   * Apply forgetting curve to a single memory
   */
  applyForgetting(packageId: string): ForgettingResult {
    const memory = this.memoryStore.get(packageId);
    if (!memory) {
      throw new Error(`Memory ${packageId} not found`);
    }

    const oldEnergy = memory.energyValue;
    const oldTier = memory.tier;

    // Calculate time since last access
    const now = new Date();
    const daysSinceAccess = this.daysBetween(memory.lastAccessTime, now);

    // Calculate tier
    const newTier = this.calculateTier(memory);

    // Apply energy decay based on tier
    const decayRate = this.getDecayRate(newTier);
    const energyLoss = decayRate * daysSinceAccess;
    const newEnergy = Math.max(0, memory.energyValue - energyLoss);

    // Check dormancy
    const isDormant = this.checkDormancy(newEnergy, daysSinceAccess);

    // Update memory
    memory.energyValue = newEnergy;
    memory.tier = newTier;
    memory.isDormant = isDormant;

    this.memoryStore.set(packageId, memory);

    // Determine actions
    const shouldArchive = newTier === 'frozen' && newEnergy < 50;
    const shouldDelete =
      this.config.autoDeleteEnabled &&
      newEnergy <= this.config.minEnergyForDeletion &&
      daysSinceAccess >= this.config.minDormancyDaysForDeletion;

    return {
      packageId,
      oldEnergy,
      newEnergy,
      oldTier,
      newTier,
      daysSinceAccess,
      isDormant,
      shouldArchive,
      shouldDelete,
    };
  }

  /**
   * Apply forgetting to all memories
   */
  applyForgettingBatch(): ForgettingResult[] {
    const results: ForgettingResult[] = [];

    for (const packageId of this.memoryStore.keys()) {
      try {
        const result = this.applyForgetting(packageId);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to apply forgetting to ${packageId}`, { error });
      }
    }

    return results;
  }

  /**
   * Reactivate a dormant memory
   */
  reactivateMemory(
    packageId: string,
    amemPaid: number
  ): ReactivationResult {
    const memory = this.memoryStore.get(packageId);
    if (!memory) {
      return {
        packageId,
        success: false,
        energyRestored: 0,
        costPaid: 0,
        newTier: 'unknown',
        message: 'Memory not found',
      };
    }

    if (!memory.isDormant) {
      return {
        packageId,
        success: false,
        energyRestored: 0,
        costPaid: 0,
        newTier: memory.tier,
        message: 'Memory is not dormant',
      };
    }

    // Calculate reactivation cost
    const daysSinceAccess = this.daysBetween(memory.lastAccessTime, new Date());
    const reactivationCost = this.calculateReactivationCost(daysSinceAccess);

    if (amemPaid < reactivationCost) {
      return {
        packageId,
        success: false,
        energyRestored: 0,
        costPaid: 0,
        newTier: memory.tier,
        message: `Insufficient AMEM. Required: ${reactivationCost}, paid: ${amemPaid}`,
      };
    }

    // Restore energy
    const energyRestored = Math.min(100 - memory.energyValue, 80); // Restore up to 80
    memory.energyValue += energyRestored;
    memory.lastAccessTime = new Date();
    memory.isDormant = false;
    memory.tier = this.calculateTier(memory);

    this.memoryStore.set(packageId, memory);

    return {
      packageId,
      success: true,
      energyRestored,
      costPaid: reactivationCost,
      newTier: memory.tier,
      message: 'Memory successfully reactivated',
    };
  }

  /**
   * Get dormant memories
   */
  getDormantMemories(): MemoryMetadata[] {
    return Array.from(this.memoryStore.values()).filter((m) => m.isDormant);
  }

  /**
   * Get memories by tier
   */
  getMemoriesByTier(tier: 'hot' | 'warm' | 'cold' | 'frozen'): MemoryMetadata[] {
    return Array.from(this.memoryStore.values()).filter((m) => m.tier === tier);
  }

  /**
   * Get memory status
   */
  getMemoryStatus(packageId: string): MemoryMetadata | undefined {
    return this.memoryStore.get(packageId);
  }

  /**
   * Get all memory statistics
   */
  getStatistics(): {
    total: number;
    hot: number;
    warm: number;
    cold: number;
    frozen: number;
    dormant: number;
    avgEnergy: number;
  } {
    const memories = Array.from(this.memoryStore.values());

    return {
      total: memories.length,
      hot: memories.filter((m) => m.tier === 'hot').length,
      warm: memories.filter((m) => m.tier === 'warm').length,
      cold: memories.filter((m) => m.tier === 'cold').length,
      frozen: memories.filter((m) => m.tier === 'frozen').length,
      dormant: memories.filter((m) => m.isDormant).length,
      avgEnergy:
        memories.reduce((sum, m) => sum + m.energyValue, 0) / memories.length || 0,
    };
  }

  /**
   * Clear memory store (for testing)
   */
  clear(): void {
    this.memoryStore.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ForgettingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ForgettingConfig {
    return { ...this.config };
  }

  /**
   * Set last access time manually (for testing)
   */
  setLastAccessTime(packageId: string, date: Date): void {
    const memory = this.memoryStore.get(packageId);
    if (memory) {
      memory.lastAccessTime = date;
      this.memoryStore.set(packageId, memory);
    }
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Calculate tier based on last access time
   */
  private calculateTier(memory: MemoryMetadata): 'hot' | 'warm' | 'cold' | 'frozen' {
    const daysSinceAccess = this.daysBetween(memory.lastAccessTime, new Date());

    if (daysSinceAccess < this.config.warmThreshold) {
      return 'hot';
    } else if (daysSinceAccess < this.config.coldThreshold) {
      return 'warm';
    } else if (daysSinceAccess < this.config.frozenThreshold) {
      return 'cold';
    } else {
      return 'frozen';
    }
  }

  /**
   * Get decay rate for tier
   */
  private getDecayRate(tier: 'hot' | 'warm' | 'cold' | 'frozen'): number {
    switch (tier) {
      case 'hot':
        return this.config.hotDecayRate;
      case 'warm':
        return this.config.warmDecayRate;
      case 'cold':
      case 'frozen':
        return this.config.coldDecayRate;
    }
  }

  /**
   * Check if memory should be dormant
   */
  private checkDormancy(energy: number, daysSinceAccess: number): boolean {
    return (
      energy <= this.config.dormancyEnergyThreshold ||
      daysSinceAccess >= this.config.dormancyTimeThreshold
    );
  }

  /**
   * Calculate reactivation cost based on dormancy duration
   */
  private calculateReactivationCost(daysDormant: number): number {
    const baseMonths = Math.floor(daysDormant / 30);
    return (
      this.config.baseReactivationCost *
      Math.pow(this.config.reactivationCostMultiplier, baseMonths)
    );
  }

  /**
   * Calculate days between two dates
   */
  private daysBetween(date1: Date, date2: Date): number {
    const diffMs = date2.getTime() - date1.getTime();
    return diffMs / (1000 * 60 * 60 * 24);
  }
}

// ============================================================================
// Scheduled Task Runner
// ============================================================================

export class ForgettingScheduler {
  private engine: MemoryForgettingEngine;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(engine: MemoryForgettingEngine) {
    this.engine = engine;
  }

  /**
   * Start periodic forgetting task
   */
  start(intervalHours: number = 24): void {
    if (this.isRunning) {
      logger.warn('Forgetting scheduler is already running');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    logger.info(`Starting memory forgetting scheduler (every ${intervalHours} hours)`);

    // Run immediately
    this.runForgettingTask();

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runForgettingTask();
    }, intervalMs);
  }

  /**
   * Stop periodic task
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Memory forgetting scheduler stopped');
  }

  /**
   * Run forgetting task manually
   */
  async runForgettingTask(): Promise<{
    processed: number;
    archived: number;
    deleted: number;
    errors: number;
  }> {
    logger.info('Running scheduled forgetting task');

    const results = this.engine.applyForgettingBatch();

    const stats = {
      processed: results.length,
      archived: results.filter((r) => r.shouldArchive).length,
      deleted: results.filter((r) => r.shouldDelete).length,
      errors: 0,
    };

    logger.info('Forgetting task completed', stats);

    return stats;
  }

  /**
   * Get scheduler status
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

// Global forgetting engine instance
let globalEngine: MemoryForgettingEngine | null = null;
let globalScheduler: ForgettingScheduler | null = null;

/**
 * Get or create global forgetting engine
 */
export function getForgettingEngine(
  config?: Partial<ForgettingConfig>
): MemoryForgettingEngine {
  if (!globalEngine) {
    globalEngine = new MemoryForgettingEngine(config);
  }
  return globalEngine;
}

/**
 * Get or create global scheduler
 */
export function getForgettingScheduler(): ForgettingScheduler {
  if (!globalScheduler) {
    const engine = getForgettingEngine();
    globalScheduler = new ForgettingScheduler(engine);
  }
  return globalScheduler;
}

/**
 * Start global forgetting scheduler
 */
export function startGlobalForgetting(intervalHours: number = 24): void {
  const scheduler = getForgettingScheduler();
  scheduler.start(intervalHours);
}

/**
 * Stop global forgetting scheduler
 */
export function stopGlobalForgetting(): void {
  if (globalScheduler) {
    globalScheduler.stop();
  }
}
