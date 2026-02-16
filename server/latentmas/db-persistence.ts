/**
 * Database Persistence Layer for LatentMAS v2
 * 
 * Provides database storage for W-Matrix and Challenge data
 * with in-memory caching for performance
 */

import { prisma } from '../db-prisma';
import type { DynamicWMatrix } from './dynamic-w-matrix';
import type { Challenge } from './anti-poisoning';
import { createLogger } from '../utils/logger';
import { getModelDimension } from '../utils/model-dimensions';

// Cast prisma for models not yet in schema (legacy v1/v2)
const prismaAny = prisma as any;

const logger = createLogger('LatentMAS:DBPersistence');

/**
 * W-Matrix Database Operations
 */
export class WMatrixDB {
  /**
   * Save W-Matrix to database
   */
  static async save(
    matrixId: string,
    userId: string,
    matrix: DynamicWMatrix
  ): Promise<void> {
    const metadata = matrix.getMetadata();
    const serialized = matrix.serialize();

    await prismaAny.wMatrix.create({
      data: {
        matrixId,
        userId: parseInt(userId),
        sourceModel: metadata.sourceModel,
        targetModel: metadata.targetModel,
        sourceDim: getModelDimension(metadata.sourceModel),
        targetDim: getModelDimension(metadata.targetModel),
        architecture: metadata.architecture,
        serializedData: serialized,
        usageCount: 0,
      },
    });
  }

  /**
   * Load W-Matrix from database
   */
  static async load(matrixId: string): Promise<string | null> {
    const result = await prismaAny.wMatrix.findUnique({
      where: { matrixId },
    });

    if (!result) return null;

    // Update usage count and last used time
    await prismaAny.wMatrix.update({
      where: { matrixId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return result.serializedData;
  }

  /**
   * Delete W-Matrix from database
   */
  static async delete(matrixId: string): Promise<boolean> {
    await prismaAny.wMatrix.delete({
      where: { matrixId },
    });

    return true;
  }

  /**
   * List all W-Matrices for a user
   */
  static async listByUser(userId: string): Promise<any[]> {
    const result = await prismaAny.wMatrix.findMany({
      where: { userId: parseInt(userId) },
    });

    return result;
  }
}

/**
 * Challenge Database Operations
 */
export class ChallengeDB {
  /**
   * Save Challenge to database
   */
  static async save(challenge: Challenge, config?: Record<string, unknown>): Promise<void> {
    await prismaAny.challenge.create({
      data: {
        challengeId: challenge.id,
        nonce: challenge.nonce,
        testPrompts: JSON.stringify(challenge.testPrompts),
        expectedPatterns: JSON.stringify(challenge.expectedPatterns),
        expiresAt: new Date(challenge.expiresAt),
        config: config ? JSON.stringify(config) : null,
        status: 'active',
      },
    });
  }

  /**
   * Load Challenge from database
   */
  static async load(challengeId: string): Promise<Challenge | null> {
    const row = await prismaAny.challenge.findFirst({
      where: {
        challengeId,
        status: 'active',
      },
    });

    if (!row) return null;

    // Check if expired
    if (new Date(row.expiresAt) < new Date()) {
      await this.markExpired(challengeId);
      return null;
    }

    return {
      id: row.challengeId,
      timestamp: row.createdAt.getTime(),
      nonce: row.nonce,
      testPrompts: JSON.parse(row.testPrompts),
      expectedPatterns: JSON.parse(row.expectedPatterns),
      expiresAt: new Date(row.expiresAt).getTime(),
    };
  }

  /**
   * Mark Challenge as completed
   */
  static async markCompleted(
    challengeId: string,
    verificationResult: Record<string, unknown>
  ): Promise<void> {
    await prismaAny.challenge.updateMany({
      where: { challengeId },
      data: {
        status: 'completed',
        verificationResult: JSON.stringify(verificationResult),
      },
    });
  }

  /**
   * Mark Challenge as expired
   */
  static async markExpired(challengeId: string): Promise<void> {
    await prismaAny.challenge.updateMany({
      where: { challengeId },
      data: { status: 'expired' },
    });
  }

  /**
   * Delete Challenge from database
   */
  static async delete(challengeId: string): Promise<boolean> {
    await prismaAny.challenge.deleteMany({
      where: { challengeId },
    });

    return true;
  }

  /**
   * Clean up expired challenges
   */
  static async cleanupExpired(): Promise<number> {
    // Mark expired
    await prismaAny.challenge.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        status: 'active',
      },
      data: { status: 'expired' },
    });

    // Delete expired challenges older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await prismaAny.challenge.deleteMany({
      where: {
        status: 'expired',
        expiresAt: { lt: oneDayAgo },
      },
    });

    return result.count;
  }
}

/**
 * Hybrid Storage Manager
 * 
 * Combines in-memory cache with database persistence
 * - Fast reads from memory
 * - Automatic persistence to database
 * - Fallback to database on cache miss
 */
export class HybridStorage<T> {
  private cache: Map<string, T> = new Map();
  private dbOps: {
    save: (key: string, value: T) => Promise<void>;
    load: (key: string) => Promise<T | null>;
    delete: (key: string) => Promise<boolean>;
  };

  constructor(dbOps: {
    save: (key: string, value: T) => Promise<void>;
    load: (key: string) => Promise<T | null>;
    delete: (key: string) => Promise<boolean>;
  }) {
    this.dbOps = dbOps;
  }

  /**
   * Set value (cache + database)
   */
  async set(key: string, value: T): Promise<void> {
    this.cache.set(key, value);
    try {
      await this.dbOps.save(key, value);
    } catch (error) {
      logger.error('Failed to persist to database', { key, error });
      // Keep in cache even if DB fails
    }
  }

  /**
   * Get value (cache first, then database)
   */
  async get(key: string): Promise<T | undefined> {
    // Try cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Fallback to database
    try {
      const value = await this.dbOps.load(key);
      if (value) {
        this.cache.set(key, value);
        return value;
      }
    } catch (error) {
      logger.error('Failed to load from database', { key, error });
    }

    return undefined;
  }

  /**
   * Delete value (cache + database)
   */
  async delete(key: string): Promise<boolean> {
    this.cache.delete(key);
    try {
      return await this.dbOps.delete(key);
    } catch (error) {
      logger.error('Failed to delete from database', { key, error });
      return false;
    }
  }

  /**
   * Check if key exists (cache only for speed)
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get all keys (cache only)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Clear cache (does not affect database)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
