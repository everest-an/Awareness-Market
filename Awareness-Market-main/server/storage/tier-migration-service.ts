/**
 * Tier Migration Service
 * 
 * Automatically migrates packages between storage tiers
 * based on access patterns to optimize costs
 */

import { db } from '../db';
import { migrationQueue } from '../../drizzle/schema-storage-tiers';
import { eq, and, sql, or } from 'drizzle-orm';
import type { PackageType, DataTier } from './access-tracker';
import {
  getPackagesNeedingMigration,
  updateTierAssignment,
  getTierInfo,
} from './access-tracker';
import { getStorageRouter } from './storage-router';

export interface MigrationTask {
  id?: number;
  packageId: number;
  packageType: PackageType;
  fromBackend: string;
  toBackend: string;
  fromTier: DataTier;
  toTier: DataTier;
  priority: number;
  estimatedSavings: number;
}

export interface MigrationResult {
  success: boolean;
  taskId: number;
  error?: string;
  migratedBytes?: number;
  timeTaken?: number;
}

/**
 * Tier Migration Service
 */
export class TierMigrationService {
  private isProcessing = false;
  private maxConcurrent = 5;

  /**
   * Check for packages that need tier migration
   */
  async checkForMigrations(): Promise<MigrationTask[]> {
    try {
      const candidates = await getPackagesNeedingMigration();
      const tasks: MigrationTask[] = [];

      for (const candidate of candidates) {
        const tierInfo = await getTierInfo(candidate.packageId, candidate.packageType);
        if (!tierInfo) continue;

        const router = getStorageRouter();
        const fromBackend = tierInfo.currentBackend;
        const toBackend = this.getBackendForTier(candidate.recommendedTier);

        // Calculate estimated savings
        const estimatedSavings = this.calculateSavings(
          fromBackend,
          toBackend,
          candidate.daysSinceAccess
        );

        // Calculate priority (higher = more urgent)
        const priority = this.calculatePriority(
          candidate.currentTier,
          candidate.recommendedTier,
          candidate.daysSinceAccess,
          estimatedSavings
        );

        tasks.push({
          packageId: candidate.packageId,
          packageType: candidate.packageType,
          fromBackend,
          toBackend,
          fromTier: candidate.currentTier,
          toTier: candidate.recommendedTier,
          priority,
          estimatedSavings,
        });
      }

      // Sort by priority (highest first)
      tasks.sort((a, b) => b.priority - a.priority);

      console.log(`[TierMigration] Found ${tasks.length} packages needing migration`);
      return tasks;
    } catch (error) {
      console.error('[TierMigration] Failed to check for migrations:', error);
      return [];
    }
  }

  /**
   * Queue a migration task
   */
  async queueMigration(task: MigrationTask): Promise<number> {
    try {
      const result = await db.insert(migrationQueue).values({
        packageId: task.packageId,
        packageType: task.packageType,
        fromBackend: task.fromBackend,
        toBackend: task.toBackend,
        fromTier: task.fromTier,
        toTier: task.toTier,
        status: 'pending',
        priority: task.priority,
        estimatedSavings: task.estimatedSavings.toString(),
        createdAt: new Date(),
      });

      const taskId = Number(result.insertId);
      console.log(`[TierMigration] Queued migration task ${taskId} for ${task.packageType}:${task.packageId}`);
      return taskId;
    } catch (error) {
      console.error('[TierMigration] Failed to queue migration:', error);
      throw error;
    }
  }

  /**
   * Process pending migration tasks
   */
  async processMigrationQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('[TierMigration] Already processing queue');
      return;
    }

    this.isProcessing = true;

    try {
      // Get pending tasks
      const pendingTasks = await db
        .select()
        .from(migrationQueue)
        .where(eq(migrationQueue.status, 'pending'))
        .orderBy(sql`${migrationQueue.priority} DESC`)
        .limit(this.maxConcurrent);

      if (pendingTasks.length === 0) {
        console.log('[TierMigration] No pending tasks');
        return;
      }

      console.log(`[TierMigration] Processing ${pendingTasks.length} tasks`);

      // Process tasks in parallel
      const results = await Promise.allSettled(
        pendingTasks.map(task => this.executeMigration(task.id))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`[TierMigration] Completed: ${succeeded} succeeded, ${failed} failed`);
    } catch (error) {
      console.error('[TierMigration] Queue processing failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single migration task
   */
  async executeMigration(taskId: number): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      // Get task details
      const tasks = await db
        .select()
        .from(migrationQueue)
        .where(eq(migrationQueue.id, taskId))
        .limit(1);

      if (tasks.length === 0) {
        throw new Error(`Task ${taskId} not found`);
      }

      const task = tasks[0];

      // Mark as processing
      await db
        .update(migrationQueue)
        .set({ status: 'processing' })
        .where(eq(migrationQueue.id, taskId));

      console.log(`[TierMigration] Executing task ${taskId}: ${task.packageType}:${task.packageId} ${task.fromBackend} → ${task.toBackend}`);

      // TODO: Actual file migration logic
      // 1. Download from source backend
      // 2. Upload to destination backend
      // 3. Verify integrity
      // 4. Delete from source (optional, keep for safety period)
      
      // For now, just update the tier assignment
      await updateTierAssignment(
        task.packageId,
        task.packageType as PackageType,
        task.toTier as DataTier,
        task.toBackend
      );

      // Mark as completed
      await db
        .update(migrationQueue)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(migrationQueue.id, taskId));

      const timeTaken = Date.now() - startTime;
      console.log(`[TierMigration] Task ${taskId} completed in ${timeTaken}ms`);

      return {
        success: true,
        taskId,
        timeTaken,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[TierMigration] Task ${taskId} failed:`, error);

      // Mark as failed
      await db
        .update(migrationQueue)
        .set({
          status: 'failed',
          errorMessage,
          completedAt: new Date(),
        })
        .where(eq(migrationQueue.id, taskId));

      return {
        success: false,
        taskId,
        error: errorMessage,
      };
    }
  }

  /**
   * Get backend name for a tier
   */
  private getBackendForTier(tier: DataTier): string {
    switch (tier) {
      case 'hot':
        return 'r2'; // Cloudflare R2 - zero egress
      case 'warm':
        return 'b2'; // Backblaze B2 - cheap storage
      case 'cold':
        return 'wasabi'; // Wasabi - cheapest storage
      default:
        return 's3'; // Fallback to S3
    }
  }

  /**
   * Calculate estimated monthly savings from migration
   */
  private calculateSavings(
    fromBackend: string,
    toBackend: string,
    daysSinceAccess: number
  ): number {
    // Backend costs ($/GB/month)
    const costs: Record<string, { storage: number; egress: number }> = {
      s3: { storage: 0.023, egress: 0.09 },
      r2: { storage: 0.015, egress: 0 },
      b2: { storage: 0.005, egress: 0.01 },
      wasabi: { storage: 0.0059, egress: 0 },
    };

    const fromCost = costs[fromBackend] || costs.s3;
    const toCost = costs[toBackend] || costs.s3;

    // Assume average file size of 100MB
    const fileSizeGB = 0.1;

    // Estimate monthly downloads based on access pattern
    let monthlyDownloads = 0;
    if (daysSinceAccess < 7) monthlyDownloads = 10;
    else if (daysSinceAccess < 30) monthlyDownloads = 2;
    else if (daysSinceAccess < 90) monthlyDownloads = 0.5;
    else monthlyDownloads = 0.1;

    // Calculate costs
    const fromMonthlyCost = fromCost.storage * fileSizeGB + fromCost.egress * fileSizeGB * monthlyDownloads;
    const toMonthlyCost = toCost.storage * fileSizeGB + toCost.egress * fileSizeGB * monthlyDownloads;

    return Math.max(0, fromMonthlyCost - toMonthlyCost);
  }

  /**
   * Calculate migration priority
   */
  private calculatePriority(
    fromTier: DataTier,
    toTier: DataTier,
    daysSinceAccess: number,
    estimatedSavings: number
  ): number {
    let priority = 0;

    // Higher priority for downgrade (cost savings)
    if (fromTier === 'hot' && toTier === 'warm') priority += 50;
    if (fromTier === 'hot' && toTier === 'cold') priority += 100;
    if (fromTier === 'warm' && toTier === 'cold') priority += 75;

    // Lower priority for upgrade (performance improvement)
    if (fromTier === 'cold' && toTier === 'warm') priority += 30;
    if (fromTier === 'cold' && toTier === 'hot') priority += 20;
    if (fromTier === 'warm' && toTier === 'hot') priority += 10;

    // Add priority based on time since access
    priority += Math.min(daysSinceAccess, 100);

    // Add priority based on savings
    priority += Math.min(estimatedSavings * 100, 50);

    return Math.round(priority);
  }

  /**
   * Get migration queue status
   */
  async getQueueStatus(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalSavings: number;
  }> {
    try {
      const [pending, processing, completed, failed] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` })
          .from(migrationQueue)
          .where(eq(migrationQueue.status, 'pending')),
        db.select({ count: sql<number>`COUNT(*)` })
          .from(migrationQueue)
          .where(eq(migrationQueue.status, 'processing')),
        db.select({ count: sql<number>`COUNT(*)` })
          .from(migrationQueue)
          .where(eq(migrationQueue.status, 'completed')),
        db.select({ count: sql<number>`COUNT(*)` })
          .from(migrationQueue)
          .where(eq(migrationQueue.status, 'failed')),
      ]);

      // Calculate total savings from completed migrations
      const completedTasks = await db
        .select()
        .from(migrationQueue)
        .where(eq(migrationQueue.status, 'completed'));

      const totalSavings = completedTasks.reduce((sum, task) => {
        return sum + (parseFloat(task.estimatedSavings || '0') || 0);
      }, 0);

      return {
        pending: pending[0]?.count || 0,
        processing: processing[0]?.count || 0,
        completed: completed[0]?.count || 0,
        failed: failed[0]?.count || 0,
        totalSavings,
      };
    } catch (error) {
      console.error('[TierMigration] Failed to get queue status:', error);
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        totalSavings: 0,
      };
    }
  }

  /**
   * Run daily migration check and queue tasks
   */
  async runDailyMigrationCheck(): Promise<void> {
    console.log('[TierMigration] Running daily migration check');

    try {
      const tasks = await this.checkForMigrations();
      
      // Queue high-priority tasks (priority > 100)
      const highPriorityTasks = tasks.filter(t => t.priority > 100);
      
      for (const task of highPriorityTasks.slice(0, 1000)) {
        await this.queueMigration(task);
      }

      console.log(`[TierMigration] Queued ${highPriorityTasks.length} high-priority tasks`);

      // Process the queue
      await this.processMigrationQueue();
    } catch (error) {
      console.error('[TierMigration] Daily check failed:', error);
    }
  }
}

// Singleton instance
let migrationServiceInstance: TierMigrationService | null = null;

export function getTierMigrationService(): TierMigrationService {
  if (!migrationServiceInstance) {
    migrationServiceInstance = new TierMigrationService();
  }
  return migrationServiceInstance;
}

/**
 * Schedule daily migration check (to be called from cron job)
 */
export async function scheduleDailyMigrationCheck(): Promise<void> {
  const service = getTierMigrationService();
  await service.runDailyMigrationCheck();
}
