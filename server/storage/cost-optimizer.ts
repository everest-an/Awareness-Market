/**
 * Cost Optimizer
 * 
 * Analyzes storage costs and provides optimization recommendations
 */

import { getDb } from '../db';
import { storageCostMetrics, packageStorageTier } from '../../drizzle/schema-storage-tiers';
import { sql, eq, gte, and } from 'drizzle-orm';
import type { DataTier } from './access-tracker';

export interface CostBreakdown {
  tier: DataTier;
  backend: string;
  storageGB: number;
  downloadGB: number;
  storageCost: number;
  bandwidthCost: number;
  totalCost: number;
}

export interface CostComparison {
  current: {
    monthly: number;
    breakdown: CostBreakdown[];
  };
  optimized: {
    monthly: number;
    breakdown: CostBreakdown[];
  };
  savings: {
    monthly: number;
    yearly: number;
    percentage: number;
  };
}

export interface OptimizationRecommendation {
  type: 'migrate' | 'compress' | 'delete' | 'deduplicate';
  packageId: number;
  packageType: string;
  currentTier: DataTier;
  recommendedTier?: DataTier;
  reason: string;
  estimatedSavings: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Cost Optimizer Service
 */
export class CostOptimizer {
  /**
   * Record daily cost metrics
   */
  async recordDailyCosts(): Promise<void> {
    try {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get storage distribution by tier
      const tierStats = await db
        .select({
          tier: packageStorageTier.currentTier,
          backend: packageStorageTier.currentBackend,
          count: sql<number>`COUNT(*)`,
        })
        .from(packageStorageTier)
        .groupBy(packageStorageTier.currentTier, packageStorageTier.currentBackend);

      // Backend costs
      const costs: Record<string, { storage: number; egress: number }> = {
        s3: { storage: 0.023, egress: 0.09 },
        r2: { storage: 0.015, egress: 0 },
        b2: { storage: 0.005, egress: 0.01 },
        wasabi: { storage: 0.0059, egress: 0 },
      };

      // Assume average file size of 100MB
      const avgFileSizeGB = 0.1;

      // Estimate downloads based on tier
      const tierDownloads: Record<string, number> = {
        hot: 10,   // 10 downloads/month
        warm: 2,   // 2 downloads/month
        cold: 0.1, // 0.1 downloads/month
      };

      for (const stat of tierStats) {
        const backend = stat.backend;
        const tier = stat.tier as DataTier;
        const fileCount = stat.count;

        const storageGB = fileCount * avgFileSizeGB;
        const downloadGB = storageGB * tierDownloads[tier];

        const backendCost = costs[backend] || costs.s3;
        const storageCost = storageGB * backendCost.storage;
        const bandwidthCost = downloadGB * backendCost.egress;
        const totalCost = storageCost + bandwidthCost;

        // Insert or update metrics
        await db.insert(storageCostMetrics).values({
          date: today,
          tier,
          backend,
          storageGB: storageGB.toString(),
          downloadGB: downloadGB.toString(),
          storageCost: storageCost.toFixed(4),
          bandwidthCost: bandwidthCost.toFixed(4),
          totalCost: totalCost.toFixed(4),
        }).onDuplicateKeyUpdate({
          set: {
            storageGB: storageGB.toString(),
            downloadGB: downloadGB.toString(),
            storageCost: storageCost.toFixed(4),
            bandwidthCost: bandwidthCost.toFixed(4),
            totalCost: totalCost.toFixed(4),
          },
        });
      }

      console.log('[CostOptimizer] Recorded daily costs');
    } catch (error) {
      console.error('[CostOptimizer] Failed to record costs:', error);
    }
  }

  /**
   * Get cost comparison: current vs optimized
   */
  async getCostComparison(): Promise<CostComparison> {
    try {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      
      // Get current month's costs
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const currentCosts = await db
        .select()
        .from(storageCostMetrics)
        .where(gte(storageCostMetrics.date, thirtyDaysAgo));

      // Aggregate by tier and backend
      const breakdown: Map<string, CostBreakdown> = new Map();

      for (const cost of currentCosts) {
        const key = `${cost.tier}-${cost.backend}`;
        const existing = breakdown.get(key);

        if (existing) {
          existing.storageGB += parseFloat(cost.storageGB);
          existing.downloadGB += parseFloat(cost.downloadGB);
          existing.storageCost += parseFloat(cost.storageCost);
          existing.bandwidthCost += parseFloat(cost.bandwidthCost);
          existing.totalCost += parseFloat(cost.totalCost);
        } else {
          breakdown.set(key, {
            tier: cost.tier as DataTier,
            backend: cost.backend,
            storageGB: parseFloat(cost.storageGB),
            downloadGB: parseFloat(cost.downloadGB),
            storageCost: parseFloat(cost.storageCost),
            bandwidthCost: parseFloat(cost.bandwidthCost),
            totalCost: parseFloat(cost.totalCost),
          });
        }
      }

      const currentBreakdown = Array.from(breakdown.values());
      const currentMonthly = currentBreakdown.reduce((sum, b) => sum + b.totalCost, 0);

      // Calculate optimized costs (if all packages were in optimal tiers)
      const optimizedBreakdown = this.calculateOptimizedCosts(currentBreakdown);
      const optimizedMonthly = optimizedBreakdown.reduce((sum, b) => sum + b.totalCost, 0);

      const savings = currentMonthly - optimizedMonthly;
      const percentage = currentMonthly > 0 ? (savings / currentMonthly) * 100 : 0;

      return {
        current: {
          monthly: currentMonthly,
          breakdown: currentBreakdown,
        },
        optimized: {
          monthly: optimizedMonthly,
          breakdown: optimizedBreakdown,
        },
        savings: {
          monthly: savings,
          yearly: savings * 12,
          percentage,
        },
      };
    } catch (error) {
      console.error('[CostOptimizer] Failed to get cost comparison:', error);
      return {
        current: { monthly: 0, breakdown: [] },
        optimized: { monthly: 0, breakdown: [] },
        savings: { monthly: 0, yearly: 0, percentage: 0 },
      };
    }
  }

  /**
   * Calculate optimized costs if all packages were in optimal tiers
   */
  private calculateOptimizedCosts(current: CostBreakdown[]): CostBreakdown[] {
    // Backend costs
    const costs: Record<string, { storage: number; egress: number }> = {
      r2: { storage: 0.015, egress: 0 },
      b2: { storage: 0.005, egress: 0.01 },
      wasabi: { storage: 0.0059, egress: 0 },
    };

    // Optimal backend for each tier
    const optimalBackend: Record<DataTier, string> = {
      hot: 'r2',     // Zero egress for frequent downloads
      warm: 'b2',    // Cheap storage + low egress
      cold: 'wasabi', // Cheapest storage
    };

    return current.map(item => {
      const optimal = optimalBackend[item.tier];
      const cost = costs[optimal];

      const storageCost = item.storageGB * cost.storage;
      const bandwidthCost = item.downloadGB * cost.egress;
      const totalCost = storageCost + bandwidthCost;

      return {
        tier: item.tier,
        backend: optimal,
        storageGB: item.storageGB,
        downloadGB: item.downloadGB,
        storageCost,
        bandwidthCost,
        totalCost,
      };
    });
  }

  /**
   * Generate optimization recommendations
   */
  async generateRecommendations(): Promise<OptimizationRecommendation[]> {
    try {
      const db = await getDb();
      if (!db) return [];
      
      const recommendations: OptimizationRecommendation[] = [];

      // Get all packages with tier info
      const packages = await db.select().from(packageStorageTier);

      for (const pkg of packages) {
        const daysSinceAccess = (Date.now() - pkg.lastAccessAt.getTime()) / (1000 * 60 * 60 * 24);

        // Recommendation 1: Migrate hot data that hasn't been accessed in 7+ days
        if (pkg.currentTier === 'hot' && daysSinceAccess > 7) {
          recommendations.push({
            type: 'migrate',
            packageId: pkg.packageId,
            packageType: pkg.packageType,
            currentTier: pkg.currentTier as DataTier,
            recommendedTier: daysSinceAccess > 90 ? 'cold' : 'warm',
            reason: `Not accessed in ${Math.floor(daysSinceAccess)} days`,
            estimatedSavings: this.estimateMigrationSavings(pkg.currentTier as DataTier, daysSinceAccess > 90 ? 'cold' : 'warm'),
            priority: daysSinceAccess > 90 ? 'high' : 'medium',
          });
        }

        // Recommendation 2: Migrate warm data that hasn't been accessed in 90+ days
        if (pkg.currentTier === 'warm' && daysSinceAccess > 90) {
          recommendations.push({
            type: 'migrate',
            packageId: pkg.packageId,
            packageType: pkg.packageType,
            currentTier: pkg.currentTier as DataTier,
            recommendedTier: 'cold',
            reason: `Not accessed in ${Math.floor(daysSinceAccess)} days`,
            estimatedSavings: this.estimateMigrationSavings('warm', 'cold'),
            priority: 'high',
          });
        }

        // Recommendation 3: Delete packages not accessed in 365+ days
        if (daysSinceAccess > 365 && pkg.accessCount < 5) {
          recommendations.push({
            type: 'delete',
            packageId: pkg.packageId,
            packageType: pkg.packageType,
            currentTier: pkg.currentTier as DataTier,
            reason: `Not accessed in ${Math.floor(daysSinceAccess)} days, low usage`,
            estimatedSavings: this.estimateDeleteSavings(pkg.currentTier as DataTier),
            priority: 'low',
          });
        }

        // Recommendation 4: Compress large files in cold storage
        if (pkg.currentTier === 'cold') {
          recommendations.push({
            type: 'compress',
            packageId: pkg.packageId,
            packageType: pkg.packageType,
            currentTier: pkg.currentTier as DataTier,
            reason: 'Cold storage candidate for compression',
            estimatedSavings: 0.5, // Assume 50% compression ratio
            priority: 'low',
          });
        }
      }

      // Sort by estimated savings (highest first)
      recommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);

      console.log(`[CostOptimizer] Generated ${recommendations.length} recommendations`);
      return recommendations;
    } catch (error) {
      console.error('[CostOptimizer] Failed to generate recommendations:', error);
      return [];
    }
  }

  /**
   * Estimate savings from tier migration
   */
  private estimateMigrationSavings(fromTier: DataTier, toTier: DataTier): number {
    const costs: Record<string, { storage: number; egress: number }> = {
      hot: { storage: 0.015, egress: 0 },      // R2
      warm: { storage: 0.005, egress: 0.01 },  // B2
      cold: { storage: 0.0059, egress: 0 },    // Wasabi
    };

    const avgFileSizeGB = 0.1;
    const tierDownloads: Record<DataTier, number> = {
      hot: 10,
      warm: 2,
      cold: 0.1,
    };

    const fromCost = costs[fromTier];
    const toCost = costs[toTier];

    const fromMonthly = fromCost.storage * avgFileSizeGB + fromCost.egress * avgFileSizeGB * tierDownloads[fromTier];
    const toMonthly = toCost.storage * avgFileSizeGB + toCost.egress * avgFileSizeGB * tierDownloads[toTier];

    return Math.max(0, fromMonthly - toMonthly);
  }

  /**
   * Estimate savings from deleting a package
   */
  private estimateDeleteSavings(tier: DataTier): number {
    const costs: Record<DataTier, number> = {
      hot: 0.015,
      warm: 0.005,
      cold: 0.0059,
    };

    const avgFileSizeGB = 0.1;
    return costs[tier] * avgFileSizeGB;
  }

  /**
   * Get cost trend over time
   */
  async getCostTrend(days: number = 30): Promise<Array<{
    date: Date;
    totalCost: number;
    storageCost: number;
    bandwidthCost: number;
  }>> {
    try {
      const db = await getDb();
      if (!db) return [];
      
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const metrics = await db
        .select()
        .from(storageCostMetrics)
        .where(gte(storageCostMetrics.date, since))
        .orderBy(storageCostMetrics.date);

      // Aggregate by date
      const trendMap: Map<string, { totalCost: number; storageCost: number; bandwidthCost: number }> = new Map();

      for (const metric of metrics) {
        const dateKey = metric.date.toISOString().split('T')[0];
        const existing = trendMap.get(dateKey);

        if (existing) {
          existing.totalCost += parseFloat(metric.totalCost);
          existing.storageCost += parseFloat(metric.storageCost);
          existing.bandwidthCost += parseFloat(metric.bandwidthCost);
        } else {
          trendMap.set(dateKey, {
            totalCost: parseFloat(metric.totalCost),
            storageCost: parseFloat(metric.storageCost),
            bandwidthCost: parseFloat(metric.bandwidthCost),
          });
        }
      }

      return Array.from(trendMap.entries()).map(([dateStr, costs]) => ({
        date: new Date(dateStr),
        ...costs,
      }));
    } catch (error) {
      console.error('[CostOptimizer] Failed to get cost trend:', error);
      return [];
    }
  }

  /**
   * Get storage distribution by tier
   */
  async getStorageDistribution(): Promise<Array<{
    tier: DataTier;
    backend: string;
    fileCount: number;
    totalSizeGB: number;
    monthlyCost: number;
  }>> {
    try {
      const db = await getDb();
      if (!db) return [];
      
      const distribution = await db
        .select({
          tier: packageStorageTier.currentTier,
          backend: packageStorageTier.currentBackend,
          count: sql<number>`COUNT(*)`,
        })
        .from(packageStorageTier)
        .groupBy(packageStorageTier.currentTier, packageStorageTier.currentBackend);

      const avgFileSizeGB = 0.1;

      return distribution.map((d: typeof distribution[0]) => ({
        tier: d.tier as DataTier,
        backend: d.backend,
        fileCount: d.count,
        totalSizeGB: d.count * avgFileSizeGB,
        monthlyCost: d.count * avgFileSizeGB * this.getBackendCost(d.backend),
      }));
    } catch (error) {
      console.error('[CostOptimizer] Failed to get storage distribution:', error);
      return [];
    }
  }

  /**
   * Get backend storage cost
   */
  private getBackendCost(backend: string): number {
    const costs: Record<string, number> = {
      s3: 0.023,
      r2: 0.015,
      b2: 0.005,
      wasabi: 0.0059,
    };
    return costs[backend] || costs.s3;
  }
}

// Singleton instance
let costOptimizerInstance: CostOptimizer | null = null;

export function getCostOptimizer(): CostOptimizer {
  if (!costOptimizerInstance) {
    costOptimizerInstance = new CostOptimizer();
  }
  return costOptimizerInstance;
}
