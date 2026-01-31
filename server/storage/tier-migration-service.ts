/**
 * Tier Migration Service
 * 
 * Automatically migrates packages between storage tiers
 * based on access patterns to optimize costs
 */

import { getDb } from '../db';
import { migrationQueue } from '../../drizzle/schema-storage-tiers';
import { vectorPackages, memoryPackages, chainPackages } from '../../drizzle/schema';
import { eq, and, sql, or } from 'drizzle-orm';
import type { PackageType, DataTier } from './access-tracker';
import {
  getPackagesNeedingMigration,
  updateTierAssignment,
  getTierInfo,
} from './access-tracker';
import { getStorageRouter } from './storage-router';
import { createLogger } from '../utils/logger';
import * as crypto from 'crypto';

const logger = createLogger('Storage:TierMigration');

/**
 * 包文件信息
 */
interface PackageFiles {
  packageId: number;
  packageType: PackageType;
  files: Array<{
    fieldName: string;
    url: string;
    key: string;
  }>;
}

/**
 * 从URL中提取存储键
 */
function extractStorageKey(url: string): string {
  try {
    const urlObj = new URL(url);
    // 移除开头的斜杠
    return urlObj.pathname.replace(/^\//, '');
  } catch {
    // 如果不是完整URL，假设已经是键
    return url;
  }
}

/**
 * 计算数据的SHA256哈希
 */
function computeHash(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * 从URL下载文件
 */
async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * 获取包的所有文件信息
 */
async function getPackageFiles(packageId: number, packageType: PackageType): Promise<PackageFiles | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const files: PackageFiles['files'] = [];

    switch (packageType) {
      case 'vector': {
        const result = await db.select().from(vectorPackages).where(eq(vectorPackages.id, packageId)).limit(1);
        if (result.length === 0) return null;
        const pkg = result[0];

        if (pkg.vectorUrl) files.push({ fieldName: 'vectorUrl', url: pkg.vectorUrl, key: extractStorageKey(pkg.vectorUrl) });
        if (pkg.wMatrixUrl) files.push({ fieldName: 'wMatrixUrl', url: pkg.wMatrixUrl, key: extractStorageKey(pkg.wMatrixUrl) });
        if (pkg.packageUrl) files.push({ fieldName: 'packageUrl', url: pkg.packageUrl, key: extractStorageKey(pkg.packageUrl) });
        break;
      }
      case 'memory': {
        const result = await db.select().from(memoryPackages).where(eq(memoryPackages.id, packageId)).limit(1);
        if (result.length === 0) return null;
        const pkg = result[0];

        if (pkg.kvCacheUrl) files.push({ fieldName: 'kvCacheUrl', url: pkg.kvCacheUrl, key: extractStorageKey(pkg.kvCacheUrl) });
        if (pkg.wMatrixUrl) files.push({ fieldName: 'wMatrixUrl', url: pkg.wMatrixUrl, key: extractStorageKey(pkg.wMatrixUrl) });
        if (pkg.packageUrl) files.push({ fieldName: 'packageUrl', url: pkg.packageUrl, key: extractStorageKey(pkg.packageUrl) });
        break;
      }
      case 'chain': {
        const result = await db.select().from(chainPackages).where(eq(chainPackages.id, packageId)).limit(1);
        if (result.length === 0) return null;
        const pkg = result[0];

        if (pkg.chainUrl) files.push({ fieldName: 'chainUrl', url: pkg.chainUrl, key: extractStorageKey(pkg.chainUrl) });
        if (pkg.wMatrixUrl) files.push({ fieldName: 'wMatrixUrl', url: pkg.wMatrixUrl, key: extractStorageKey(pkg.wMatrixUrl) });
        if (pkg.packageUrl) files.push({ fieldName: 'packageUrl', url: pkg.packageUrl, key: extractStorageKey(pkg.packageUrl) });
        break;
      }
    }

    return { packageId, packageType, files };
  } catch (error) {
    logger.error('[TierMigration] 获取包文件信息失败:', { error });
    return null;
  }
}

/**
 * 根据内容类型推断MIME类型
 */
function inferContentType(key: string): string {
  if (key.endsWith('.safetensors')) return 'application/octet-stream';
  if (key.endsWith('.json')) return 'application/json';
  if (key.endsWith('.vectorpkg') || key.endsWith('.memorypkg') || key.endsWith('.chainpkg')) {
    return 'application/octet-stream';
  }
  return 'application/octet-stream';
}

/**
 * 更新包的文件URL
 */
async function updatePackageFileUrl(
  packageId: number,
  packageType: PackageType,
  fieldName: string,
  newUrl: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('数据库不可用');

  switch (packageType) {
    case 'vector':
      await db.update(vectorPackages)
        .set({ [fieldName]: newUrl })
        .where(eq(vectorPackages.id, packageId));
      break;
    case 'memory':
      await db.update(memoryPackages)
        .set({ [fieldName]: newUrl })
        .where(eq(memoryPackages.id, packageId));
      break;
    case 'chain':
      await db.update(chainPackages)
        .set({ [fieldName]: newUrl })
        .where(eq(chainPackages.id, packageId));
      break;
  }
}

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

      logger.info(`[TierMigration] Found ${tasks.length} packages needing migration`);
      return tasks;
    } catch (error) {
      logger.error('[TierMigration] Failed to check for migrations:', { error });
      return [];
    }
  }

  /**
   * Queue a migration task
   */
  async queueMigration(task: MigrationTask): Promise<number> {
    try {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      
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
      }).$returningId();

      const taskId = result[0]?.id || 0;
      logger.info(`[TierMigration] Queued migration task ${taskId} for ${task.packageType}:${task.packageId}`);
      return taskId;
    } catch (error) {
      logger.error('[TierMigration] Failed to queue migration:', { error });
      throw error;
    }
  }

  /**
   * Process pending migration tasks
   */
  async processMigrationQueue(): Promise<void> {
    if (this.isProcessing) {
      logger.info('[TierMigration] Already processing queue');
      return;
    }

    this.isProcessing = true;

    try {
      const db = await getDb();
      if (!db) {
        logger.info('[TierMigration] Database unavailable');
        return;
      }
      
      // Get pending tasks
      const pendingTasks = await db
        .select()
        .from(migrationQueue)
        .where(eq(migrationQueue.status, 'pending'))
        .orderBy(sql`${migrationQueue.priority} DESC`)
        .limit(this.maxConcurrent);

      if (pendingTasks.length === 0) {
        logger.info('[TierMigration] No pending tasks');
        return;
      }

      logger.info(`[TierMigration] Processing ${pendingTasks.length} tasks`);

      // Process tasks in parallel
      const results = await Promise.allSettled(
        pendingTasks.map((task: typeof pendingTasks[0]) => this.executeMigration(task.id))
      );

      const succeeded = results.filter((r: PromiseSettledResult<MigrationResult>) => r.status === 'fulfilled').length;
      const failed = results.filter((r: PromiseSettledResult<MigrationResult>) => r.status === 'rejected').length;

      logger.info(`[TierMigration] Completed: ${succeeded} succeeded, ${failed} failed`);
    } catch (error) {
      logger.error('[TierMigration] Queue processing failed:', { error });
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
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      
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

      logger.info(`[TierMigration] Executing task ${taskId}: ${task.packageType}:${task.packageId} ${task.fromBackend} → ${task.toBackend}`);

      const router = getStorageRouter();
      const sourceBackend = router.getBackend(task.fromBackend);
      const destBackend = router.getBackend(task.toBackend);

      if (!sourceBackend) {
        throw new Error(`源后端 ${task.fromBackend} 不可用`);
      }
      if (!destBackend) {
        throw new Error(`目标后端 ${task.toBackend} 不可用`);
      }

      // 获取包的所有文件
      const packageFiles = await getPackageFiles(task.packageId, task.packageType as PackageType);
      if (!packageFiles || packageFiles.files.length === 0) {
        throw new Error(`找不到包 ${task.packageType}:${task.packageId} 的文件`);
      }

      let totalMigratedBytes = 0;

      // 迁移每个文件
      for (const file of packageFiles.files) {
        logger.info(`[TierMigration] 迁移文件: ${file.key}`);

        try {
          // 1. 从源后端获取签名URL并下载
          const { url: downloadUrl } = await sourceBackend.get(file.key, 3600);
          const fileData = await downloadFile(downloadUrl);
          const originalHash = computeHash(fileData);
          totalMigratedBytes += fileData.length;

          logger.info(`[TierMigration] 下载完成: ${file.key} (${fileData.length} bytes, hash: ${originalHash.substring(0, 16)}...)`);

          // 2. 上传到目标后端
          const contentType = inferContentType(file.key);
          const { url: newUrl } = await destBackend.put(file.key, fileData, contentType);

          logger.info(`[TierMigration] 上传完成: ${file.key} → ${task.toBackend}`);

          // 3. 验证完整性 - 从目标后端下载并比较哈希
          const { url: verifyUrl } = await destBackend.get(file.key, 3600);
          const verifyData = await downloadFile(verifyUrl);
          const verifyHash = computeHash(verifyData);

          if (originalHash !== verifyHash) {
            throw new Error(`完整性验证失败: ${file.key} 哈希不匹配 (原: ${originalHash.substring(0, 16)}..., 新: ${verifyHash.substring(0, 16)}...)`);
          }

          logger.info(`[TierMigration] 完整性验证通过: ${file.key}`);

          // 4. 更新数据库中的文件URL
          await updatePackageFileUrl(task.packageId, task.packageType as PackageType, file.fieldName, newUrl);

          // 注意: 暂不删除源文件，保留30天安全期
          // 可以通过另一个定时任务来清理已迁移的旧文件
          logger.info(`[TierMigration] 保留源文件 ${file.key} 用于安全期`);

        } catch (fileError) {
          logger.error(`[TierMigration] 文件迁移失败: ${file.key}`, { error: fileError });
          throw fileError;
        }
      }

      // 更新分层分配
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
      logger.info(`[TierMigration] Task ${taskId} completed in ${timeTaken}ms, migrated ${totalMigratedBytes} bytes`);

      return {
        success: true,
        taskId,
        timeTaken,
        migratedBytes: totalMigratedBytes,
      };
    } catch (error) {
      const db = await getDb();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[TierMigration] Task ${taskId} failed:`, { error });

      // Mark as failed
      if (db) {
        await db
          .update(migrationQueue)
          .set({
            status: 'failed',
            errorMessage,
            completedAt: new Date(),
          })
          .where(eq(migrationQueue.id, taskId));
      }

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
      const db = await getDb();
      if (!db) {
        return { pending: 0, processing: 0, completed: 0, failed: 0, totalSavings: 0 };
      }
      
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

      const totalSavings = completedTasks.reduce((sum: number, task: typeof completedTasks[0]) => {
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
      logger.error('[TierMigration] Failed to get queue status:', { error });
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
    logger.info('[TierMigration] Running daily migration check');

    try {
      const tasks = await this.checkForMigrations();
      
      // Queue high-priority tasks (priority > 100)
      const highPriorityTasks = tasks.filter(t => t.priority > 100);
      
      for (const task of highPriorityTasks.slice(0, 1000)) {
        await this.queueMigration(task);
      }

      logger.info(`[TierMigration] Queued ${highPriorityTasks.length} high-priority tasks`);

      // Process the queue
      await this.processMigrationQueue();
    } catch (error) {
      logger.error('[TierMigration] Daily check failed:', { error });
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
