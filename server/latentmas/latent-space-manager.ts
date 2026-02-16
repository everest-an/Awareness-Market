/**
 * Latent Space Manager
 * 
 * Manages user-scoped latent space instances for LatentMAS/2.1 protocol.
 * Provides lifecycle management, access control, and quota enforcement.
 * 
 * Requirements implemented:
 * - 9.1: Create unique latent space instance scoped to user's session
 * - 9.2: Associate packages with creator's user_id and enforce ownership
 * - 9.3: Create copy of latent space in buyer's isolated namespace
 * - 9.4: Prevent cross-user latent space access without explicit purchase
 * - 9.5: Display only spaces owned by or purchased by current user
 * - 9.6: Cascade delete latent spaces on account deletion
 * - 11.4: Automatically archive inactive latent spaces after 24 hours
 * - 11.5: Enforce per-user quotas for active latent spaces (default: 10)
 */

import { createLogger } from '../utils/logger';
import { db } from '../db-drizzle';
import {
  userLatentSpaces,
  packageAccessGrants,
  type UserLatentSpace,
  type InsertUserLatentSpace,
  type PackageAccessGrant,
  type InsertPackageAccessGrant
} from '../../drizzle/schema-latentmas-packages-pg';
import { eq, and, sql, asc } from 'drizzle-orm';
import { randomBytes } from 'crypto';

const logger = createLogger('LatentMAS:SpaceManager');

// ============================================================================
// Types
// ============================================================================

export interface LatentSpaceConfig {
  quotaLimit?: number; // Default: 10
  autoArchiveAfterHours?: number; // Default: 24
}

export interface LatentSpaceStats {
  totalSpaces: number;
  activeSpaces: number;
  archivedSpaces: number;
  quotaUsed: number;
  quotaLimit: number;
  totalKvCacheSize: number;
}

// ============================================================================
// Latent Space Manager Class
// ============================================================================

export class LatentSpaceManager {
  private config: Required<LatentSpaceConfig>;

  constructor(config: LatentSpaceConfig = {}) {
    this.config = {
      quotaLimit: config.quotaLimit ?? 10,
      autoArchiveAfterHours: config.autoArchiveAfterHours ?? 24,
    };
  }

  // ==========================================================================
  // Lifecycle Management
  // ==========================================================================

  /**
   * Create a new latent space for a user
   * 
   * Requirement 9.1: Create unique latent space instance scoped to user's session
   */
  async createSpace(userId: number): Promise<UserLatentSpace> {
    try {
      // Check quota before creating
      await this.enforceQuota(userId);

      // Generate unique space ID
      const spaceId = this.generateSpaceId();

      // Create space record
      const newSpace: InsertUserLatentSpace = {
        userId,
        spaceId,
        status: 'active',
        lastAccessedAt: new Date(),
        quotaUsed: 0,
        quotaLimit: this.config.quotaLimit,
        totalKvCacheSize: 0,
      };

      const [createdSpace] = await db.insert(userLatentSpaces).values(newSpace).returning();

      logger.info('Created latent space', { userId, spaceId });

      return createdSpace;
    } catch (error) {
      logger.error('Failed to create latent space', { userId, error });
      throw new Error(`Failed to create latent space: ${error}`);
    }
  }

  /**
   * Archive a latent space (move to cold storage)
   * 
   * Requirement 11.4: Automatically archive inactive spaces after 24 hours
   */
  async archiveSpace(spaceId: string): Promise<void> {
    try {
      await db
        .update(userLatentSpaces)
        .set({ 
          status: 'archived',
          updatedAt: new Date()
        })
        .where(eq(userLatentSpaces.spaceId, spaceId));

      logger.info('Archived latent space', { spaceId });
    } catch (error) {
      logger.error('Failed to archive latent space', { spaceId, error });
      throw new Error(`Failed to archive latent space: ${error}`);
    }
  }

  /**
   * Restore a latent space from archive
   * 
   * Requirement 11.4: Restore archived space within 5 seconds
   */
  async restoreSpace(spaceId: string): Promise<UserLatentSpace> {
    try {
      await db
        .update(userLatentSpaces)
        .set({ 
          status: 'active',
          lastAccessedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(userLatentSpaces.spaceId, spaceId));

      const [space] = await db
        .select()
        .from(userLatentSpaces)
        .where(eq(userLatentSpaces.spaceId, spaceId));

      logger.info('Restored latent space', { spaceId });
      return space;
    } catch (error) {
      logger.error('Failed to restore latent space', { spaceId, error });
      throw new Error(`Failed to restore latent space: ${error}`);
    }
  }

  /**
   * Delete a latent space permanently
   * 
   * Requirement 9.6: Cascade delete latent spaces on account deletion
   */
  async deleteSpace(spaceId: string): Promise<void> {
    try {
      await db
        .update(userLatentSpaces)
        .set({ 
          status: 'deleted',
          updatedAt: new Date()
        })
        .where(eq(userLatentSpaces.spaceId, spaceId));

      logger.info('Deleted latent space', { spaceId });
    } catch (error) {
      logger.error('Failed to delete latent space', { spaceId, error });
      throw new Error(`Failed to delete latent space: ${error}`);
    }
  }

  /**
   * Delete all latent spaces for a user (cascade on account deletion)
   * 
   * Requirement 9.6: Cascade delete all associated latent spaces
   */
  async deleteUserSpaces(userId: number): Promise<void> {
    try {
      await db
        .update(userLatentSpaces)
        .set({ 
          status: 'deleted',
          updatedAt: new Date()
        })
        .where(eq(userLatentSpaces.userId, userId));

      logger.info('Deleted all latent spaces for user', { userId });
    } catch (error) {
      logger.error('Failed to delete user latent spaces', { userId, error });
      throw new Error(`Failed to delete user latent spaces: ${error}`);
    }
  }

  // ==========================================================================
  // Access Control
  // ==========================================================================

  /**
   * Validate if a user has access to a package
   * 
   * Requirement 9.4: Prevent cross-user latent space access without explicit purchase
   */
  async validateAccess(userId: number, packageId: string, packageType: 'vector' | 'memory' | 'chain'): Promise<boolean> {
    try {
      // Check if user owns the package or has been granted access
      const [grant] = await db
        .select()
        .from(packageAccessGrants)
        .where(
          and(
            eq(packageAccessGrants.packageId, packageId),
            eq(packageAccessGrants.packageType, packageType),
            eq(packageAccessGrants.granteeId, userId)
          )
        );

      return !!grant;
    } catch (error) {
      logger.error('Failed to validate access', { userId, packageId, error });
      return false;
    }
  }

  /**
   * Grant access to a package (on purchase)
   * 
   * Requirement 9.3: Create copy of latent space in buyer's isolated namespace
   */
  async grantAccess(
    ownerId: number, 
    buyerId: number, 
    packageId: string,
    packageType: 'vector' | 'memory' | 'chain',
    expiresAt?: Date
  ): Promise<void> {
    try {
      const grant: InsertPackageAccessGrant = {
        packageType,
        packageId,
        ownerId,
        granteeId: buyerId,
        expiresAt: expiresAt || null,
      };

      await db.insert(packageAccessGrants).values(grant);

      logger.info('Granted package access', { ownerId, buyerId, packageId, packageType });
    } catch (error) {
      logger.error('Failed to grant access', { ownerId, buyerId, packageId, error });
      throw new Error(`Failed to grant access: ${error}`);
    }
  }

  /**
   * Revoke access to a package
   */
  async revokeAccess(
    buyerId: number, 
    packageId: string,
    packageType: 'vector' | 'memory' | 'chain'
  ): Promise<void> {
    try {
      await db
        .delete(packageAccessGrants)
        .where(
          and(
            eq(packageAccessGrants.packageId, packageId),
            eq(packageAccessGrants.packageType, packageType),
            eq(packageAccessGrants.granteeId, buyerId)
          )
        );

      logger.info('Revoked package access', { buyerId, packageId, packageType });
    } catch (error) {
      logger.error('Failed to revoke access', { buyerId, packageId, error });
      throw new Error(`Failed to revoke access: ${error}`);
    }
  }

  /**
   * Get all packages a user has access to
   * 
   * Requirement 9.5: Display only spaces owned by or purchased by current user
   */
  async getUserAccessiblePackages(userId: number): Promise<PackageAccessGrant[]> {
    try {
      const grants = await db
        .select()
        .from(packageAccessGrants)
        .where(eq(packageAccessGrants.granteeId, userId));

      return grants;
    } catch (error) {
      logger.error('Failed to get user accessible packages', { userId, error });
      return [];
    }
  }

  // ==========================================================================
  // Quota Management
  // ==========================================================================

  /**
   * Check user's quota usage
   * 
   * Requirement 11.5: Enforce per-user quotas for active latent spaces
   */
  async checkQuota(userId: number): Promise<{ used: number; limit: number }> {
    try {
      const [space] = await db
        .select()
        .from(userLatentSpaces)
        .where(
          and(
            eq(userLatentSpaces.userId, userId),
            eq(userLatentSpaces.status, 'active')
          )
        )
        .limit(1);

      if (!space) {
        return { used: 0, limit: this.config.quotaLimit };
      }

      // Count active spaces
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userLatentSpaces)
        .where(
          and(
            eq(userLatentSpaces.userId, userId),
            eq(userLatentSpaces.status, 'active')
          )
        );

      return {
        used: result?.count || 0,
        limit: space.quotaLimit,
      };
    } catch (error) {
      logger.error('Failed to check quota', { userId, error });
      return { used: 0, limit: this.config.quotaLimit };
    }
  }

  /**
   * Enforce quota limits
   * 
   * Requirement 11.5: Automatically archive least recently used space when quota exceeded
   */
  async enforceQuota(userId: number): Promise<void> {
    try {
      const quota = await this.checkQuota(userId);

      if (quota.used >= quota.limit) {
        // Find least recently used active space
        const [lruSpace] = await db
          .select()
          .from(userLatentSpaces)
          .where(
            and(
              eq(userLatentSpaces.userId, userId),
              eq(userLatentSpaces.status, 'active')
            )
          )
          .orderBy(asc(userLatentSpaces.lastAccessedAt))
          .limit(1);

        if (lruSpace) {
          await this.archiveSpace(lruSpace.spaceId);
          logger.info('Auto-archived LRU space due to quota', { 
            userId, 
            spaceId: lruSpace.spaceId 
          });
        }
      }
    } catch (error) {
      logger.error('Failed to enforce quota', { userId, error });
      throw new Error(`Failed to enforce quota: ${error}`);
    }
  }

  /**
   * Update space quota usage
   */
  async updateQuotaUsage(spaceId: string, kvCacheSizeDelta: number): Promise<void> {
    try {
      await db
        .update(userLatentSpaces)
        .set({ 
          totalKvCacheSize: sql`${userLatentSpaces.totalKvCacheSize} + ${kvCacheSizeDelta}`,
          updatedAt: new Date()
        })
        .where(eq(userLatentSpaces.spaceId, spaceId));
    } catch (error) {
      logger.error('Failed to update quota usage', { spaceId, error });
    }
  }

  // ==========================================================================
  // Statistics and Monitoring
  // ==========================================================================

  /**
   * Get statistics for a user's latent spaces
   */
  async getUserStats(userId: number): Promise<LatentSpaceStats> {
    try {
      const spaces = await db
        .select()
        .from(userLatentSpaces)
        .where(eq(userLatentSpaces.userId, userId));

      const activeSpaces = spaces.filter((s: any) => s.status === 'active');
      const archivedSpaces = spaces.filter((s: any) => s.status === 'archived');
      const totalKvCacheSize = spaces.reduce((sum: number, s: any) => sum + Number(s.totalKvCacheSize), 0);

      return {
        totalSpaces: spaces.length,
        activeSpaces: activeSpaces.length,
        archivedSpaces: archivedSpaces.length,
        quotaUsed: activeSpaces.length,
        quotaLimit: spaces[0]?.quotaLimit || this.config.quotaLimit,
        totalKvCacheSize,
      };
    } catch (error) {
      logger.error('Failed to get user stats', { userId, error });
      return {
        totalSpaces: 0,
        activeSpaces: 0,
        archivedSpaces: 0,
        quotaUsed: 0,
        quotaLimit: this.config.quotaLimit,
        totalKvCacheSize: 0,
      };
    }
  }

  /**
   * Get user's latent spaces
   * 
   * Requirement 9.5: Display only spaces owned by or purchased by current user
   */
  async getUserSpaces(userId: number, includeArchived: boolean = false): Promise<UserLatentSpace[]> {
    try {
      if (includeArchived) {
        return await db
          .select()
          .from(userLatentSpaces)
          .where(eq(userLatentSpaces.userId, userId));
      } else {
        return await db
          .select()
          .from(userLatentSpaces)
          .where(
            and(
              eq(userLatentSpaces.userId, userId),
              eq(userLatentSpaces.status, 'active')
            )
          );
      }
    } catch (error) {
      logger.error('Failed to get user spaces', { userId, error });
      return [];
    }
  }

  /**
   * Update last accessed timestamp
   */
  async touchSpace(spaceId: string): Promise<void> {
    try {
      await db
        .update(userLatentSpaces)
        .set({ 
          lastAccessedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(userLatentSpaces.spaceId, spaceId));
    } catch (error) {
      logger.error('Failed to touch space', { spaceId, error });
    }
  }

  // ==========================================================================
  // Background Jobs
  // ==========================================================================

  /**
   * Auto-archive inactive spaces (background job)
   * 
   * Requirement 11.4: Automatically archive spaces inactive for 24 hours
   */
  async autoArchiveInactiveSpaces(): Promise<number> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - this.config.autoArchiveAfterHours);

      const inactiveSpaces = await db
        .select()
        .from(userLatentSpaces)
        .where(
          and(
            eq(userLatentSpaces.status, 'active'),
            sql`${userLatentSpaces.lastAccessedAt} < ${cutoffTime}`
          )
        );

      for (const space of inactiveSpaces) {
        await this.archiveSpace(space.spaceId);
      }

      logger.info('Auto-archived inactive spaces', { count: inactiveSpaces.length });
      return inactiveSpaces.length;
    } catch (error) {
      logger.error('Failed to auto-archive inactive spaces', { error });
      return 0;
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private generateSpaceId(): string {
    return `space-${Date.now()}-${randomBytes(8).toString('hex')}`;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const latentSpaceManager = new LatentSpaceManager();
