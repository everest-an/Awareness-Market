/**
 * Automatic Quality Degradation System
 *
 * Automatically adjusts package ratings based on:
 * - Verification scores
 * - User feedback and reviews
 * - Historical quality metrics (epsilon)
 * - Usage patterns and complaints
 *
 * Integrates with:
 * - Pricing Engine (lower ratings = higher prices)
 * - Memory Forgetting (lower ratings = faster decay)
 * - Chain Verification (automated quality checks)
 */

import type { VerificationResult } from './latentmas/chain-verification';

// ============================================================================
// Types
// ============================================================================

export type QualityTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'deprecated';

export interface QualityMetrics {
  verificationScore: number; // 0-1 from chain verification
  averageEpsilon: number; // Average alignment loss
  userRating: number; // 1-5 stars
  complaintRate: number; // 0-1 (0 = no complaints)
  usageCount: number; // Total number of uses
  successRate: number; // 0-1 (successful transactions / total)
}

export interface QualityThresholds {
  platinum: {
    minVerificationScore: number; // Default: 0.9
    maxEpsilon: number; // Default: 0.03
    minUserRating: number; // Default: 4.5
    maxComplaintRate: number; // Default: 0.05
    minUsageCount: number; // Default: 100
    minSuccessRate: number; // Default: 0.95
  };
  gold: {
    minVerificationScore: number; // Default: 0.8
    maxEpsilon: number; // Default: 0.05
    minUserRating: number; // Default: 4.0
    maxComplaintRate: number; // Default: 0.10
    minUsageCount: number; // Default: 50
    minSuccessRate: number; // Default: 0.90
  };
  silver: {
    minVerificationScore: number; // Default: 0.7
    maxEpsilon: number; // Default: 0.08
    minUserRating: number; // Default: 3.5
    maxComplaintRate: number; // Default: 0.15
    minUsageCount: number; // Default: 10
    minSuccessRate: number; // Default: 0.85
  };
  bronze: {
    minVerificationScore: number; // Default: 0.6
    maxEpsilon: number; // Default: 0.12
    minUserRating: number; // Default: 3.0
    maxComplaintRate: number; // Default: 0.25
    minUsageCount: number; // Default: 1
    minSuccessRate: number; // Default: 0.75
  };
}

export interface PackageQuality {
  packageId: string;
  currentTier: QualityTier;
  previousTier: QualityTier | null;
  metrics: QualityMetrics;
  lastEvaluated: Date;
  degradationHistory: DegradationEvent[];
}

export interface DegradationEvent {
  timestamp: Date;
  fromTier: QualityTier;
  toTier: QualityTier;
  reason: string;
  triggeredBy: 'automatic' | 'manual' | 'user_report';
  metricsSnapshot: QualityMetrics;
}

export interface DegradationResult {
  packageId: string;
  oldTier: QualityTier;
  newTier: QualityTier;
  degraded: boolean;
  reasons: string[];
  actionRequired: 'none' | 'price_increase' | 'visibility_reduction' | 'deprecation';
}

// ============================================================================
// Auto Degradation Engine
// ============================================================================

export class AutoDegradationEngine {
  private thresholds: QualityThresholds;
  private packages: Map<string, PackageQuality> = new Map();

  constructor(thresholds?: Partial<QualityThresholds>) {
    this.thresholds = this.initializeThresholds(thresholds);
  }

  /**
   * Initialize default thresholds
   */
  private initializeThresholds(
    custom?: Partial<QualityThresholds>
  ): QualityThresholds {
    return {
      platinum: {
        minVerificationScore: custom?.platinum?.minVerificationScore ?? 0.9,
        maxEpsilon: custom?.platinum?.maxEpsilon ?? 0.03,
        minUserRating: custom?.platinum?.minUserRating ?? 4.5,
        maxComplaintRate: custom?.platinum?.maxComplaintRate ?? 0.05,
        minUsageCount: custom?.platinum?.minUsageCount ?? 100,
        minSuccessRate: custom?.platinum?.minSuccessRate ?? 0.95,
      },
      gold: {
        minVerificationScore: custom?.gold?.minVerificationScore ?? 0.8,
        maxEpsilon: custom?.gold?.maxEpsilon ?? 0.05,
        minUserRating: custom?.gold?.minUserRating ?? 4.0,
        maxComplaintRate: custom?.gold?.maxComplaintRate ?? 0.10,
        minUsageCount: custom?.gold?.minUsageCount ?? 50,
        minSuccessRate: custom?.gold?.minSuccessRate ?? 0.90,
      },
      silver: {
        minVerificationScore: custom?.silver?.minVerificationScore ?? 0.7,
        maxEpsilon: custom?.silver?.maxEpsilon ?? 0.08,
        minUserRating: custom?.silver?.minUserRating ?? 3.5,
        maxComplaintRate: custom?.silver?.maxComplaintRate ?? 0.15,
        minUsageCount: custom?.silver?.minUsageCount ?? 10,
        minSuccessRate: custom?.silver?.minSuccessRate ?? 0.85,
      },
      bronze: {
        minVerificationScore: custom?.bronze?.minVerificationScore ?? 0.6,
        maxEpsilon: custom?.bronze?.maxEpsilon ?? 0.12,
        minUserRating: custom?.bronze?.minUserRating ?? 3.0,
        maxComplaintRate: custom?.bronze?.maxComplaintRate ?? 0.25,
        minUsageCount: custom?.bronze?.minUsageCount ?? 1,
        minSuccessRate: custom?.bronze?.minSuccessRate ?? 0.75,
      },
    };
  }

  /**
   * Register a new package for quality monitoring
   */
  registerPackage(
    packageId: string,
    initialTier: QualityTier = 'silver',
    initialMetrics?: Partial<QualityMetrics>
  ): void {
    this.packages.set(packageId, {
      packageId,
      currentTier: initialTier,
      previousTier: null,
      metrics: {
        verificationScore: initialMetrics?.verificationScore ?? 0.8,
        averageEpsilon: initialMetrics?.averageEpsilon ?? 0.05,
        userRating: initialMetrics?.userRating ?? 4.0,
        complaintRate: initialMetrics?.complaintRate ?? 0.0,
        usageCount: initialMetrics?.usageCount ?? 0,
        successRate: initialMetrics?.successRate ?? 1.0,
      },
      lastEvaluated: new Date(),
      degradationHistory: [],
    });
  }

  /**
   * Update package metrics
   */
  updateMetrics(
    packageId: string,
    updates: Partial<QualityMetrics>
  ): void {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package ${packageId} not registered`);
    }

    pkg.metrics = {
      ...pkg.metrics,
      ...updates,
    };

    this.packages.set(packageId, pkg);
  }

  /**
   * Record a transaction result
   */
  recordTransaction(
    packageId: string,
    success: boolean,
    epsilon: number
  ): void {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package ${packageId} not registered`);
    }

    // Update usage count
    pkg.metrics.usageCount++;

    // Update success rate
    const totalSuccess = pkg.metrics.successRate * (pkg.metrics.usageCount - 1) + (success ? 1 : 0);
    pkg.metrics.successRate = totalSuccess / pkg.metrics.usageCount;

    // Update average epsilon (exponential moving average)
    const alpha = 0.2; // Weight for new value
    pkg.metrics.averageEpsilon =
      alpha * epsilon + (1 - alpha) * pkg.metrics.averageEpsilon;

    this.packages.set(packageId, pkg);
  }

  /**
   * Record user review
   */
  recordReview(
    packageId: string,
    rating: number,
    isComplaint: boolean = false
  ): void {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package ${packageId} not registered`);
    }

    // Update user rating (exponential moving average)
    const alpha = 0.3;
    pkg.metrics.userRating =
      alpha * rating + (1 - alpha) * pkg.metrics.userRating;

    // Update complaint rate
    if (isComplaint) {
      const totalComplaints = pkg.metrics.complaintRate * pkg.metrics.usageCount + 1;
      pkg.metrics.complaintRate = totalComplaints / (pkg.metrics.usageCount + 1);
    }

    this.packages.set(packageId, pkg);
  }

  /**
   * Evaluate package quality and determine tier
   */
  evaluatePackage(packageId: string): DegradationResult {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package ${packageId} not registered`);
    }

    const oldTier = pkg.currentTier;
    const newTier = this.calculateTier(pkg.metrics);
    const reasons: string[] = [];
    const degraded = this.tierRank(newTier) < this.tierRank(oldTier);

    // Determine which tier to compare against for reasons
    const comparisonTier = degraded && oldTier !== 'deprecated'
      ? oldTier  // If degraded, show what failed from old tier
      : newTier !== 'deprecated'
      ? newTier  // Otherwise use new tier
      : 'bronze'; // For deprecated, compare against bronze

    // Check each metric against thresholds
    // comparisonTier is guaranteed to not be 'deprecated' by the logic above
    const threshold = this.thresholds[comparisonTier as Exclude<QualityTier, 'deprecated'>];

    if (pkg.metrics.verificationScore < threshold.minVerificationScore) {
      reasons.push(`Low verification score: ${pkg.metrics.verificationScore.toFixed(2)}`);
    }

    if (pkg.metrics.averageEpsilon > threshold.maxEpsilon) {
      reasons.push(`High epsilon: ${pkg.metrics.averageEpsilon.toFixed(4)}`);
    }

    if (pkg.metrics.userRating < threshold.minUserRating) {
      reasons.push(`Low user rating: ${pkg.metrics.userRating.toFixed(1)}`);
    }

    if (pkg.metrics.complaintRate > threshold.maxComplaintRate) {
      reasons.push(`High complaint rate: ${(pkg.metrics.complaintRate * 100).toFixed(1)}%`);
    }

    if (pkg.metrics.successRate < threshold.minSuccessRate) {
      reasons.push(`Low success rate: ${(pkg.metrics.successRate * 100).toFixed(1)}%`);
    }

    if (pkg.metrics.usageCount < threshold.minUsageCount) {
      reasons.push(`Insufficient usage count: ${pkg.metrics.usageCount}`);
    }

    // Special handling for deprecated tier
    if (newTier === 'deprecated' && reasons.length === 0) {
      reasons.push('Package quality below minimum standards');
    }

    // Record degradation event if tier changed
    if (newTier !== oldTier) {
      const event: DegradationEvent = {
        timestamp: new Date(),
        fromTier: oldTier,
        toTier: newTier,
        reason: reasons.join('; '),
        triggeredBy: 'automatic',
        metricsSnapshot: { ...pkg.metrics },
      };

      pkg.degradationHistory.push(event);
      pkg.previousTier = oldTier;
      pkg.currentTier = newTier;
      pkg.lastEvaluated = new Date();

      this.packages.set(packageId, pkg);
    }

    // Determine required action
    let actionRequired: DegradationResult['actionRequired'] = 'none';
    if (newTier === 'deprecated') {
      actionRequired = 'deprecation';
    } else if (degraded) {
      actionRequired = this.tierRank(newTier) < 2 ? 'visibility_reduction' : 'price_increase';
    }

    return {
      packageId,
      oldTier,
      newTier,
      degraded,
      reasons,
      actionRequired,
    };
  }

  /**
   * Calculate appropriate tier based on metrics
   */
  private calculateTier(metrics: QualityMetrics): QualityTier {
    // Check from highest to lowest tier
    if (this.meetsTierRequirements(metrics, 'platinum')) {
      return 'platinum';
    } else if (this.meetsTierRequirements(metrics, 'gold')) {
      return 'gold';
    } else if (this.meetsTierRequirements(metrics, 'silver')) {
      return 'silver';
    } else if (this.meetsTierRequirements(metrics, 'bronze')) {
      return 'bronze';
    } else {
      return 'deprecated';
    }
  }

  /**
   * Check if metrics meet tier requirements
   */
  private meetsTierRequirements(
    metrics: QualityMetrics,
    tier: Exclude<QualityTier, 'deprecated'>
  ): boolean {
    const threshold = this.thresholds[tier];

    return (
      metrics.verificationScore >= threshold.minVerificationScore &&
      metrics.averageEpsilon <= threshold.maxEpsilon &&
      metrics.userRating >= threshold.minUserRating &&
      metrics.complaintRate <= threshold.maxComplaintRate &&
      metrics.usageCount >= threshold.minUsageCount &&
      metrics.successRate >= threshold.minSuccessRate
    );
  }

  /**
   * Get tier rank (higher = better)
   */
  private tierRank(tier: QualityTier): number {
    const ranks: Record<QualityTier, number> = {
      platinum: 4,
      gold: 3,
      silver: 2,
      bronze: 1,
      deprecated: 0,
    };
    return ranks[tier];
  }

  /**
   * Evaluate all packages
   */
  evaluateAll(): DegradationResult[] {
    const results: DegradationResult[] = [];

    for (const packageId of this.packages.keys()) {
      try {
        const result = this.evaluatePackage(packageId);
        results.push(result);
      } catch (error) {
        console.error(`Failed to evaluate package ${packageId}:`, error);
      }
    }

    return results;
  }

  /**
   * Get package quality info
   */
  getPackageQuality(packageId: string): PackageQuality | undefined {
    return this.packages.get(packageId);
  }

  /**
   * Get all packages by tier
   */
  getPackagesByTier(tier: QualityTier): PackageQuality[] {
    return Array.from(this.packages.values()).filter((pkg) => pkg.currentTier === tier);
  }

  /**
   * Get degraded packages (tier decreased)
   */
  getDegradedPackages(): PackageQuality[] {
    return Array.from(this.packages.values()).filter((pkg) => {
      if (!pkg.previousTier) return false;
      return this.tierRank(pkg.currentTier) < this.tierRank(pkg.previousTier);
    });
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    total: number;
    platinum: number;
    gold: number;
    silver: number;
    bronze: number;
    deprecated: number;
    degraded: number;
  } {
    const packages = Array.from(this.packages.values());

    return {
      total: packages.length,
      platinum: packages.filter((p) => p.currentTier === 'platinum').length,
      gold: packages.filter((p) => p.currentTier === 'gold').length,
      silver: packages.filter((p) => p.currentTier === 'silver').length,
      bronze: packages.filter((p) => p.currentTier === 'bronze').length,
      deprecated: packages.filter((p) => p.currentTier === 'deprecated').length,
      degraded: this.getDegradedPackages().length,
    };
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds: Partial<QualityThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds,
    };
  }

  /**
   * Get current thresholds
   */
  getThresholds(): QualityThresholds {
    return { ...this.thresholds };
  }

  /**
   * Clear all packages (for testing)
   */
  clear(): void {
    this.packages.clear();
  }

  /**
   * Import verification result
   */
  importVerificationResult(
    packageId: string,
    verification: VerificationResult
  ): void {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package ${packageId} not registered`);
    }

    pkg.metrics.verificationScore = verification.overallScore;
    this.packages.set(packageId, pkg);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalEngine: AutoDegradationEngine | null = null;

/**
 * Get or create global degradation engine
 */
export function getDegradationEngine(): AutoDegradationEngine {
  if (!globalEngine) {
    globalEngine = new AutoDegradationEngine();
  }
  return globalEngine;
}
