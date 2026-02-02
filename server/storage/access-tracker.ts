/**
 * Access Tracker Service
 *
 * Records package access patterns to determine data temperature
 * and optimize storage tier placement
 */

import { prisma } from '../db-prisma';
import { createLogger } from '../utils/logger';

const logger = createLogger('Storage:AccessTracker');

export type PackageType = 'vector' | 'memory' | 'chain';
export type AccessType = 'download' | 'view' | 'purchase';
export type DataTier = 'hot' | 'warm' | 'cold';

export interface AccessRecord {
  packageId: number;
  packageType: PackageType;
  accessType: AccessType;
  userId?: number;
}

export interface TierInfo {
  packageId: number;
  packageType: PackageType;
  currentTier: DataTier;
  currentBackend: string;
  lastAccessAt: Date;
  accessCount: number;
}

/**
 * Record a package access event
 */
export async function recordPackageAccess(record: AccessRecord): Promise<void> {
  try {
    // Insert access log
    await prisma.packageAccessLog.create({
      data: {
        packageId: record.packageId,
        packageType: record.packageType,
        accessType: record.accessType,
        userId: record.userId,
        timestamp: new Date(),
      },
    });

    // Update or create storage tier record
    const existing = await prisma.packageStorageTier.findFirst({
      where: {
        packageId: record.packageId,
        packageType: record.packageType,
      },
    });

    if (existing) {
      // Update existing record
      await prisma.packageStorageTier.update({
        where: { id: existing.id },
        data: {
          lastAccessAt: new Date(),
          accessCount: { increment: 1 },
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new record (default to hot tier on first access)
      await prisma.packageStorageTier.create({
        data: {
          packageId: record.packageId,
          packageType: record.packageType,
          currentTier: 'hot',
          currentBackend: 'r2', // Default to R2 for new uploads
          lastAccessAt: new Date(),
          accessCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    logger.info(`[AccessTracker] Recorded ${record.accessType} for ${record.packageType}:${record.packageId}`);
  } catch (error) {
    logger.error('[AccessTracker] Failed to record access:', { error });
    // Don't throw - access tracking should not break main functionality
  }
}

/**
 * Get access frequency for a package
 */
export async function getAccessFrequency(
  packageId: number,
  packageType: PackageType,
  days: number = 7
): Promise<number> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const count = await prisma.packageAccessLog.count({
      where: {
        packageId,
        packageType,
        timestamp: { gte: since },
      },
    });

    return count;
  } catch (error) {
    logger.error('[AccessTracker] Failed to get access frequency:', { error });
    return 0;
  }
}

/**
 * Determine data temperature based on access patterns
 */
export async function determineDataTemperature(
  packageId: number,
  packageType: PackageType
): Promise<DataTier> {
  try {
    const tierInfo = await prisma.packageStorageTier.findFirst({
      where: {
        packageId,
        packageType,
      },
    });

    if (!tierInfo) {
      // No tier info yet, default to hot
      return 'hot';
    }

    const lastAccess = tierInfo.lastAccessAt;
    const daysSinceAccess = (Date.now() - lastAccess.getTime()) / (1000 * 60 * 60 * 24);

    // Get access frequency in last 7 days
    const recentAccess = await getAccessFrequency(packageId, packageType, 7);

    // Temperature rules:
    // Hot: Accessed in last 7 days OR 3+ accesses in last 7 days
    // Warm: Accessed in last 7-90 days
    // Cold: Not accessed in 90+ days
    if (daysSinceAccess <= 7 || recentAccess >= 3) {
      return 'hot';
    } else if (daysSinceAccess <= 90) {
      return 'warm';
    } else {
      return 'cold';
    }
  } catch (error) {
    logger.error('[AccessTracker] Failed to determine temperature:', { error });
    return 'warm'; // Default to warm on error
  }
}

/**
 * Get current tier info for a package
 */
export async function getTierInfo(
  packageId: number,
  packageType: PackageType
): Promise<TierInfo | null> {
  try {
    const result = await prisma.packageStorageTier.findFirst({
      where: {
        packageId,
        packageType,
      },
    });

    if (!result) {
      return null;
    }

    return {
      packageId: result.packageId,
      packageType: result.packageType as PackageType,
      currentTier: result.currentTier as DataTier,
      currentBackend: result.currentBackend,
      lastAccessAt: result.lastAccessAt,
      accessCount: result.accessCount,
    };
  } catch (error) {
    logger.error('[AccessTracker] Failed to get tier info:', { error });
    return null;
  }
}

/**
 * Update tier assignment for a package
 */
export async function updateTierAssignment(
  packageId: number,
  packageType: PackageType,
  newTier: DataTier,
  newBackend: string
): Promise<void> {
  try {
    await prisma.packageStorageTier.updateMany({
      where: {
        packageId,
        packageType,
      },
      data: {
        currentTier: newTier,
        currentBackend: newBackend,
        updatedAt: new Date(),
      },
    });

    logger.info(`[AccessTracker] Updated ${packageType}:${packageId} to ${newTier} (${newBackend})`);
  } catch (error) {
    logger.error('[AccessTracker] Failed to update tier:', { error });
    throw error;
  }
}

/**
 * Get packages that need tier migration
 */
export async function getPackagesNeedingMigration(): Promise<Array<{
  packageId: number;
  packageType: PackageType;
  currentTier: DataTier;
  recommendedTier: DataTier;
  daysSinceAccess: number;
}>> {
  try {
    const allTiers = await prisma.packageStorageTier.findMany();

    const migrations: Array<{
      packageId: number;
      packageType: PackageType;
      currentTier: DataTier;
      recommendedTier: DataTier;
      daysSinceAccess: number;
    }> = [];

    for (const tier of allTiers) {
      const daysSinceAccess = (Date.now() - tier.lastAccessAt.getTime()) / (1000 * 60 * 60 * 24);
      const recommendedTier = await determineDataTemperature(tier.packageId, tier.packageType as PackageType);

      if (tier.currentTier !== recommendedTier) {
        migrations.push({
          packageId: tier.packageId,
          packageType: tier.packageType as PackageType,
          currentTier: tier.currentTier as DataTier,
          recommendedTier,
          daysSinceAccess,
        });
      }
    }

    return migrations;
  } catch (error) {
    logger.error('[AccessTracker] Failed to get migration candidates:', { error });
    return [];
  }
}

/**
 * Get access statistics for a package
 */
export async function getAccessStats(
  packageId: number,
  packageType: PackageType
): Promise<{
  totalAccess: number;
  last7Days: number;
  last30Days: number;
  last90Days: number;
  lastAccessAt: Date | null;
}> {
  try {
    const [total, week, month, quarter] = await Promise.all([
      getAccessFrequency(packageId, packageType, 365),
      getAccessFrequency(packageId, packageType, 7),
      getAccessFrequency(packageId, packageType, 30),
      getAccessFrequency(packageId, packageType, 90),
    ]);

    const tierInfo = await getTierInfo(packageId, packageType);

    return {
      totalAccess: total,
      last7Days: week,
      last30Days: month,
      last90Days: quarter,
      lastAccessAt: tierInfo?.lastAccessAt || null,
    };
  } catch (error) {
    logger.error('[AccessTracker] Failed to get access stats:', { error });
    return {
      totalAccess: 0,
      last7Days: 0,
      last30Days: 0,
      last90Days: 0,
      lastAccessAt: null,
    };
  }
}

/**
 * Get hot packages (frequently accessed)
 */
export async function getHotPackages(limit: number = 10): Promise<TierInfo[]> {
  try {
    const result = await prisma.packageStorageTier.findMany({
      where: { currentTier: 'hot' },
      orderBy: { accessCount: 'desc' },
      take: limit,
    });

    return result.map((r) => ({
      packageId: r.packageId,
      packageType: r.packageType as PackageType,
      currentTier: r.currentTier as DataTier,
      currentBackend: r.currentBackend,
      lastAccessAt: r.lastAccessAt,
      accessCount: r.accessCount,
    }));
  } catch (error) {
    logger.error('[AccessTracker] Failed to get hot packages:', { error });
    return [];
  }
}

/**
 * Get cold packages (rarely accessed)
 */
export async function getColdPackages(limit: number = 10): Promise<TierInfo[]> {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const result = await prisma.packageStorageTier.findMany({
      where: {
        currentTier: 'cold',
        lastAccessAt: { lt: ninetyDaysAgo },
      },
      orderBy: { lastAccessAt: 'asc' },
      take: limit,
    });

    return result.map((r) => ({
      packageId: r.packageId,
      packageType: r.packageType as PackageType,
      currentTier: r.currentTier as DataTier,
      currentBackend: r.currentBackend,
      lastAccessAt: r.lastAccessAt,
      accessCount: r.accessCount,
    }));
  } catch (error) {
    logger.error('[AccessTracker] Failed to get cold packages:', { error });
    return [];
  }
}
