/**
 * Access Tracker Service
 * 
 * Records package access patterns to determine data temperature
 * and optimize storage tier placement
 */

import { getDb } from '../db';
import { packageAccessLog, packageStorageTier } from '../../drizzle/schema-storage-tiers';
import { eq, and, sql, desc, gte } from 'drizzle-orm';
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
    const db = await getDb();
    if (!db) throw new Error('Database unavailable');
    
    // Insert access log
    await db.insert(packageAccessLog).values({
      packageId: record.packageId,
      packageType: record.packageType,
      accessType: record.accessType,
      userId: record.userId,
      timestamp: new Date(),
    });

    // Update or create storage tier record
    const existing = await db
      .select()
      .from(packageStorageTier)
      .where(
        and(
          eq(packageStorageTier.packageId, record.packageId),
          eq(packageStorageTier.packageType, record.packageType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(packageStorageTier)
        .set({
          lastAccessAt: new Date(),
          accessCount: sql`${packageStorageTier.accessCount} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(packageStorageTier.packageId, record.packageId),
            eq(packageStorageTier.packageType, record.packageType)
          )
        );
    } else {
      // Create new record (default to hot tier on first access)
      await db.insert(packageStorageTier).values({
        packageId: record.packageId,
        packageType: record.packageType,
        currentTier: 'hot',
        currentBackend: 'r2', // Default to R2 for new uploads
        lastAccessAt: new Date(),
        accessCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
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
    const db = await getDb();
    if (!db) return 0;
    
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(packageAccessLog)
      .where(
        and(
          eq(packageAccessLog.packageId, packageId),
          eq(packageAccessLog.packageType, packageType),
          gte(packageAccessLog.timestamp, since)
        )
      );

    return result[0]?.count || 0;
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
    const db = await getDb();
    if (!db) return 'warm';
    
    const tierInfo = await db
      .select()
      .from(packageStorageTier)
      .where(
        and(
          eq(packageStorageTier.packageId, packageId),
          eq(packageStorageTier.packageType, packageType)
        )
      )
      .limit(1);

    if (tierInfo.length === 0) {
      // No tier info yet, default to hot
      return 'hot';
    }

    const lastAccess = tierInfo[0].lastAccessAt;
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
    const db = await getDb();
    if (!db) return null;
    
    const result = await db
      .select()
      .from(packageStorageTier)
      .where(
        and(
          eq(packageStorageTier.packageId, packageId),
          eq(packageStorageTier.packageType, packageType)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return {
      packageId: result[0].packageId,
      packageType: result[0].packageType as PackageType,
      currentTier: result[0].currentTier as DataTier,
      currentBackend: result[0].currentBackend,
      lastAccessAt: result[0].lastAccessAt,
      accessCount: result[0].accessCount,
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
    const db = await getDb();
    if (!db) throw new Error('Database unavailable');
    
    await db
      .update(packageStorageTier)
      .set({
        currentTier: newTier,
        currentBackend: newBackend,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(packageStorageTier.packageId, packageId),
          eq(packageStorageTier.packageType, packageType)
        )
      );

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
    const db = await getDb();
    if (!db) return [];
    
    const allTiers = await db.select().from(packageStorageTier);
    
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
    const db = await getDb();
    if (!db) return [];
    
    const result = await db
      .select()
      .from(packageStorageTier)
      .where(eq(packageStorageTier.currentTier, 'hot'))
      .orderBy(desc(packageStorageTier.accessCount))
      .limit(limit);

    return result.map((r: typeof result[0]) => ({
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
    const db = await getDb();
    if (!db) return [];
    
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    const result = await db
      .select()
      .from(packageStorageTier)
      .where(
        and(
          eq(packageStorageTier.currentTier, 'cold'),
          sql`${packageStorageTier.lastAccessAt} < ${ninetyDaysAgo}`
        )
      )
      .orderBy(packageStorageTier.lastAccessAt)
      .limit(limit);

    return result.map((r: typeof result[0]) => ({
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
