/**
 * LLM Cost Tracking Service
 * Track and monitor costs for self-hosted and API-based LLM usage
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('LLMCostTracker');

export interface UsageRecord {
  id: string;
  timestamp: Date;
  operation: string;
  provider: 'SelfHosted' | 'OpenAI' | 'Anthropic' | 'Other';
  modelName: string;
  durationSeconds: number;
  cost: number;
  metadata?: Record<string, any>;
}

export interface CostStats {
  totalCost: number;
  dailyCost: number;
  monthlyCost: number;
  projectedMonthlyCost: number;
  totalRequests: number;
  avgCostPerRequest: number;
  byProvider: Record<string, number>;
  byOperation: Record<string, number>;
}

/**
 * Cost tracking service for LLM usage
 */
export class LLMCostTracker {
  private usage: UsageRecord[] = [];

  // Cost rates (USD per hour)
  private readonly COST_RATES = {
    'runpod-rtx-4090': 0.44,
    'runpod-rtx-4090-spot': 0.34,
    'runpod-a100': 1.89,
    'vast-ai-rtx-4090': 0.29,
    'aws-g5-xlarge': 1.01,
  };

  private costPerHour: number;

  constructor(provider: keyof typeof LLMCostTracker.prototype.COST_RATES = 'runpod-rtx-4090-spot') {
    this.costPerHour = this.COST_RATES[provider] || 0.44;

    logger.info('Initialized LLMCostTracker', {
      provider,
      costPerHour: `$${this.costPerHour}/hr`,
    });
  }

  /**
   * Track a new usage event
   */
  trackUsage(
    operation: string,
    durationSeconds: number,
    provider: UsageRecord['provider'] = 'SelfHosted',
    modelName: string = 'llama-3.1-8b',
    metadata?: Record<string, any>
  ): UsageRecord {
    const cost = (durationSeconds / 3600) * this.costPerHour;

    const record: UsageRecord = {
      id: this.generateId(),
      timestamp: new Date(),
      operation,
      provider,
      modelName,
      durationSeconds,
      cost,
      metadata,
    };

    this.usage.push(record);

    logger.info('💰 LLM Usage Tracked', {
      operation,
      duration: `${durationSeconds.toFixed(1)}s`,
      cost: `$${cost.toFixed(4)}`,
      provider,
      modelName,
      monthlyTotal: `$${this.getMonthlyTotal().toFixed(2)}`,
    });

    // Warn if approaching budget limits
    this.checkBudgetWarnings();

    return record;
  }

  /**
   * Get total cost for the current month
   */
  getMonthlyTotal(): number {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.usage
      .filter(record => record.timestamp >= startOfMonth)
      .reduce((sum, record) => sum + record.cost, 0);
  }

  /**
   * Get total cost for today
   */
  getDailyCost(): number {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return this.usage
      .filter(record => record.timestamp >= startOfDay)
      .reduce((sum, record) => sum + record.cost, 0);
  }

  /**
   * Get comprehensive cost statistics
   */
  getStats(): CostStats {
    const monthlyTotal = this.getMonthlyTotal();
    const dailyCost = this.getDailyCost();
    const totalCost = this.usage.reduce((sum, record) => sum + record.cost, 0);

    // Calculate projected monthly cost based on current daily average
    const now = new Date();
    const dayOfMonth = now.getDate();
    const avgDailyCost = monthlyTotal / dayOfMonth;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthlyCost = avgDailyCost * daysInMonth;

    // Group by provider
    const byProvider: Record<string, number> = {};
    for (const record of this.usage) {
      byProvider[record.provider] = (byProvider[record.provider] || 0) + record.cost;
    }

    // Group by operation
    const byOperation: Record<string, number> = {};
    for (const record of this.usage) {
      byOperation[record.operation] = (byOperation[record.operation] || 0) + record.cost;
    }

    return {
      totalCost,
      dailyCost,
      monthlyCost: monthlyTotal,
      projectedMonthlyCost,
      totalRequests: this.usage.length,
      avgCostPerRequest: this.usage.length > 0 ? totalCost / this.usage.length : 0,
      byProvider,
      byOperation,
    };
  }

  /**
   * Get usage records for a specific time period
   */
  getUsageRecords(
    startDate?: Date,
    endDate?: Date
  ): UsageRecord[] {
    let records = this.usage;

    if (startDate) {
      records = records.filter(r => r.timestamp >= startDate);
    }

    if (endDate) {
      records = records.filter(r => r.timestamp <= endDate);
    }

    return records;
  }

  /**
   * Export usage data as CSV
   */
  exportCSV(): string {
    const headers = [
      'Timestamp',
      'Operation',
      'Provider',
      'Model',
      'Duration (s)',
      'Cost (USD)',
    ];

    const rows = this.usage.map(record => [
      record.timestamp.toISOString(),
      record.operation,
      record.provider,
      record.modelName,
      record.durationSeconds.toFixed(2),
      record.cost.toFixed(6),
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');
  }

  /**
   * Clear all usage records (useful for testing)
   */
  clear(): void {
    this.usage = [];
    logger.info('Usage records cleared');
  }

  /**
   * Set custom cost rate
   */
  setCostRate(costPerHour: number): void {
    this.costPerHour = costPerHour;
    logger.info('Cost rate updated', { costPerHour: `$${costPerHour}/hr` });
  }

  /**
   * Check budget warnings
   */
  private checkBudgetWarnings(): void {
    const monthlyTotal = this.getMonthlyTotal();
    const stats = this.getStats();

    // Warning thresholds
    const WARNING_THRESHOLD = 40; // $40/month
    const CRITICAL_THRESHOLD = 50; // $50/month

    if (stats.projectedMonthlyCost > CRITICAL_THRESHOLD) {
      logger.error('🚨 CRITICAL: Projected monthly cost exceeds budget!', {
        current: `$${monthlyTotal.toFixed(2)}`,
        projected: `$${stats.projectedMonthlyCost.toFixed(2)}`,
        threshold: `$${CRITICAL_THRESHOLD}`,
      });
    } else if (stats.projectedMonthlyCost > WARNING_THRESHOLD) {
      logger.warn('⚠️ WARNING: Projected monthly cost approaching budget limit', {
        current: `$${monthlyTotal.toFixed(2)}`,
        projected: `$${stats.projectedMonthlyCost.toFixed(2)}`,
        threshold: `$${WARNING_THRESHOLD}`,
      });
    }
  }

  /**
   * Generate unique ID for records
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Global Tracker
// ============================================================================

let globalTracker: LLMCostTracker | null = null;

/**
 * Get or create global cost tracker
 */
export function getGlobalCostTracker(): LLMCostTracker {
  if (!globalTracker) {
    const provider = (process.env.LLM_COST_PROVIDER || 'runpod-rtx-4090-spot') as any;
    globalTracker = new LLMCostTracker(provider);
  }

  return globalTracker;
}

/**
 * Track usage with the global tracker
 */
export function trackLLMUsage(
  operation: string,
  durationSeconds: number,
  provider?: UsageRecord['provider'],
  modelName?: string,
  metadata?: Record<string, any>
): UsageRecord {
  return getGlobalCostTracker().trackUsage(operation, durationSeconds, provider, modelName, metadata);
}
