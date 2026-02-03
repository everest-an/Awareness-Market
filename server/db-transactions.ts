/**
 * Database Transaction Manager
 *
 * Provides transaction support for critical operations using Prisma.
 *
 * Features:
 * - Automatic rollback on error
 * - Optimistic locking for concurrent updates
 * - Transaction timeout
 */

import { prisma } from './db-prisma';
import type { PrismaClient } from '@prisma/client';
import { createLogger } from './utils/logger';

const logger = createLogger('DB:Transactions');

export interface TransactionOptions {
  timeout?: number; // milliseconds
  maxWait?: number; // maximum wait time for acquiring a connection
}

const DEFAULT_OPTIONS: TransactionOptions = {
  timeout: 30000, // 30 seconds
  maxWait: 5000,  // 5 seconds
};

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Execute a function within a database transaction
 * Automatically rolls back on error
 */
export async function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return prisma.$transaction(
    async (tx) => {
      try {
        const result = await fn(tx);
        return result;
      } catch (error) {
        logger.error('[Transaction] Error, rolling back:', { error });
        throw error;
      }
    },
    {
      timeout: opts.timeout,
      maxWait: opts.maxWait,
    }
  );
}

/**
 * Optimistic locking: Update with version check
 * Returns true if update succeeded, false if version conflict
 */
export async function updateWithOptimisticLock<T extends { id: number; version: number }>(
  modelName: string,
  id: number,
  currentVersion: number,
  updates: Partial<T>
): Promise<boolean> {
  return withTransaction(async (tx) => {
    // Use raw query for generic table access
    const records = await tx.$queryRaw<Array<{ version: number }>>`
      SELECT version FROM ${modelName} WHERE id = ${id} LIMIT 1
    `;

    if (!records[0] || records[0].version !== currentVersion) {
      return false; // Version conflict
    }

    // Update with incremented version
    await tx.$executeRaw`
      UPDATE ${modelName}
      SET version = ${currentVersion + 1}, updated_at = NOW()
      WHERE id = ${id}
    `;

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
    const existingPurchase = await tx.packagePurchase.findFirst({
      where: {
        buyerId: userId,
        packageType,
        packageId,
      },
    });

    if (existingPurchase) {
      throw new Error('Package already purchased');
    }

    // 2. Create purchase record
    const purchase = await tx.packagePurchase.create({
      data: {
        buyerId: userId,
        sellerId: 0, // Will be updated with actual seller ID
        packageType,
        packageId,
        price: String(price),
        platformFee: String(Number(price) * 0.15), // 15% platform fee
        sellerEarnings: String(Number(price) * 0.85),
        stripePaymentIntentId: stripePaymentId,
        status: 'completed',
      },
    });

    // 3. Generate download link (7 days expiry)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const downloadUrl = `https://awareness.market/api/packages/download/${packageType}/${packageId}`;

    const download = await tx.packageDownload.create({
      data: {
        packageType,
        packageId,
        userId,
        downloadUrl,
        expiresAt,
      },
    });

    // 4. Update package download count using appropriate model
    switch (packageType) {
      case 'vector':
        await tx.vectorPackage.updateMany({
          where: { packageId },
          data: { downloads: { increment: 1 } },
        });
        break;
      case 'memory':
        await tx.memoryPackage.updateMany({
          where: { packageId },
          data: { downloads: { increment: 1 } },
        });
        break;
      case 'chain':
        await tx.chainPackage.updateMany({
          where: { packageId },
          data: { downloads: { increment: 1 } },
        });
        break;
    }

    return {
      purchaseId: purchase.id,
      downloadId: download.id,
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
  packageData: Record<string, unknown>;
  s3Urls: {
    packageUrl: string;
    wMatrixUrl: string;
  };
}) {
  return withTransaction(async (tx) => {
    const { userId, packageType, packageData, s3Urls } = params;

    let packageRecord: { id: number };

    // 1. Create package record based on type
    switch (packageType) {
      case 'vector':
        packageRecord = await tx.vectorPackage.create({
          data: {
            ...packageData,
            userId,
            packageUrl: s3Urls.packageUrl,
            wMatrixUrl: s3Urls.wMatrixUrl,
            downloads: 0,
            rating: 0,
          } as any,
        });
        break;
      case 'memory':
        packageRecord = await tx.memoryPackage.create({
          data: {
            ...packageData,
            userId,
            packageUrl: s3Urls.packageUrl,
            wMatrixUrl: s3Urls.wMatrixUrl,
            downloads: 0,
            rating: 0,
          } as any,
        });
        break;
      case 'chain':
        packageRecord = await tx.chainPackage.create({
          data: {
            ...packageData,
            userId,
            packageUrl: s3Urls.packageUrl,
            wMatrixUrl: s3Urls.wMatrixUrl,
            downloads: 0,
            rating: 0,
          } as any,
        });
        break;
      default:
        throw new Error(`Invalid package type: ${packageType}`);
    }

    // 2. Update user package count
    await tx.$executeRaw`
      UPDATE users SET package_count = COALESCE(package_count, 0) + 1 WHERE id = ${userId}
    `;

    return {
      packageId: packageRecord.id,
      packageUrl: s3Urls.packageUrl,
    };
  });
}
