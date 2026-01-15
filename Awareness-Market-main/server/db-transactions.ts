/**
 * Database Transaction Manager
 * 
 * Provides transaction support for critical operations:
 * - Package purchase (check → deduct → create order → generate link)
 * - Package upload (upload file → create record → update stats)
 * - Package update (check version → update → increment version)
 * 
 * Features:
 * - Automatic rollback on error
 * - Optimistic locking for concurrent updates
 * - Nested transaction support
 * - Transaction timeout
 */

import { getDb, executeWithTimeout } from './db-connection';
import type { MySql2Database } from 'drizzle-orm/mysql2';

export interface TransactionOptions {
  timeout?: number; // milliseconds
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
}

const DEFAULT_OPTIONS: TransactionOptions = {
  timeout: 30000, // 30 seconds
  isolationLevel: 'READ COMMITTED',
};

/**
 * Execute a function within a database transaction
 * Automatically rolls back on error
 */
export async function withTransaction<T>(
  fn: (tx: MySql2Database<Record<string, never>>) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const db = await getDb();

  return executeWithTimeout(async () => {
    return await db.transaction(async (tx) => {
      // Set isolation level if specified
      if (opts.isolationLevel) {
        await tx.execute(`SET TRANSACTION ISOLATION LEVEL ${opts.isolationLevel}`);
      }

      try {
        const result = await fn(tx);
        return result;
      } catch (error) {
        console.error('[Transaction] Error, rolling back:', error);
        throw error;
      }
    });
  }, opts.timeout);
}

/**
 * Optimistic locking: Update with version check
 * Returns true if update succeeded, false if version conflict
 */
export async function updateWithOptimisticLock<T extends { id: number; version: number }>(
  table: any,
  id: number,
  currentVersion: number,
  updates: Partial<T>
): Promise<boolean> {
  return withTransaction(async (tx) => {
    // Check current version
    const [record] = await tx
      .select()
      .from(table)
      .where((t: any) => t.id.eq(id))
      .limit(1);

    if (!record || record.version !== currentVersion) {
      return false; // Version conflict
    }

    // Update with incremented version
    await tx
      .update(table)
      .set({
        ...updates,
        version: currentVersion + 1,
        updatedAt: new Date(),
      })
      .where((t: any) => t.id.eq(id));

    return true;
  });
}

/**
 * Transaction for package purchase
 * Steps:
 * 1. Check if user has already purchased
 * 2. Create purchase record
 * 3. Generate download link
 * 4. Update package download count
 */
export async function purchasePackageTransaction(params: {
  userId: number;
  packageType: 'vector' | 'memory' | 'chain';
  packageId: string;
  price: number;
  stripePaymentId: string;
}) {
  return withTransaction(async (tx) => {
    const { userId, packageType, packageId, price, stripePaymentId } = params;

    // 1. Check for duplicate purchase
    const existingPurchase = await tx
      .select()
      .from(packagePurchases)
      .where(
        (p: any) =>
          p.userId.eq(userId) &&
          p.packageType.eq(packageType) &&
          p.packageId.eq(packageId)
      )
      .limit(1);

    if (existingPurchase.length > 0) {
      throw new Error('Package already purchased');
    }

    // 2. Create purchase record
    const [purchase] = await tx.insert(packagePurchases).values({
      userId,
      packageType,
      packageId,
      price,
      stripePaymentId,
      purchasedAt: new Date(),
    });

    // 3. Generate download link (7 days expiry)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const downloadUrl = `https://awareness.market/api/packages/download/${packageType}/${packageId}`;

    const [download] = await tx.insert(packageDownloads).values({
      packageType,
      packageId,
      userId,
      downloadUrl,
      expiresAt,
      createdAt: new Date(),
    });

    // 4. Update package download count
    const packageTable = getPackageTable(packageType);
    await tx
      .update(packageTable)
      .set({
        downloads: (p: any) => p.downloads + 1,
      })
      .where((p: any) => p.packageId.eq(packageId));

    return {
      purchaseId: purchase.insertId,
      downloadId: download.insertId,
      downloadUrl,
      expiresAt,
    };
  });
}

/**
 * Transaction for package upload
 * Steps:
 * 1. Upload files to S3
 * 2. Create package record
 * 3. Update user statistics
 */
export async function uploadPackageTransaction(params: {
  userId: number;
  packageType: 'vector' | 'memory' | 'chain';
  packageData: any;
  s3Urls: {
    packageUrl: string;
    wMatrixUrl: string;
  };
}) {
  return withTransaction(async (tx) => {
    const { userId, packageType, packageData, s3Urls } = params;

    // 1. Create package record
    const packageTable = getPackageTable(packageType);
    const [pkg] = await tx.insert(packageTable).values({
      ...packageData,
      userId,
      packageUrl: s3Urls.packageUrl,
      wMatrixUrl: s3Urls.wMatrixUrl,
      downloads: 0,
      rating: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Update user package count
    await tx
      .update(users)
      .set({
        packageCount: (u: any) => u.packageCount + 1,
      })
      .where((u: any) => u.id.eq(userId));

    return {
      packageId: pkg.insertId,
      packageUrl: s3Urls.packageUrl,
    };
  });
}

/**
 * Helper: Get package table by type
 */
function getPackageTable(packageType: 'vector' | 'memory' | 'chain') {
  switch (packageType) {
    case 'vector':
      return vectorPackages;
    case 'memory':
      return memoryPackages;
    case 'chain':
      return chainPackages;
    default:
      throw new Error(`Invalid package type: ${packageType}`);
  }
}

// Import tables (will be added after schema is migrated)
import { vectorPackages, memoryPackages, chainPackages, packagePurchases, packageDownloads, users } from '../drizzle/schema';
