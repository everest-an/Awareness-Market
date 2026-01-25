/**
 * Database Persistence Layer for LatentMAS v2
 * 
 * Provides database storage for W-Matrix and Challenge data
 * with in-memory caching for performance
 */

import { getDb } from '../db';
import { wMatrices, challenges } from '../../drizzle/schema';
import { eq, and, lt } from 'drizzle-orm';
import type { DynamicWMatrix } from './dynamic-w-matrix';
import type { Challenge } from './anti-poisoning';

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
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const metadata = matrix.getMetadata();
    const serialized = matrix.serialize();

    await db.insert(wMatrices).values({
      matrixId,
      userId: parseInt(userId),
      sourceModel: metadata.sourceModel,
      targetModel: metadata.targetModel,
      sourceDim: parseInt(metadata.sourceModel.split('-')[0] || '0'), // Placeholder
      targetDim: parseInt(metadata.targetModel.split('-')[0] || '0'), // Placeholder
      architecture: metadata.architecture,
      serializedData: serialized,
      usageCount: 0,
    });
  }

  /**
   * Load W-Matrix from database
   */
  static async load(matrixId: string): Promise<string | null> {
    const db = await getDb();
    if (!db) return null;

    const result = await db
      .select()
      .from(wMatrices)
      .where(eq(wMatrices.matrixId, matrixId))
      .limit(1);

    if (result.length === 0) return null;

    // Update usage count and last used time
    await db
      .update(wMatrices)
      .set({
        usageCount: result[0].usageCount + 1,
        lastUsedAt: new Date(),
      })
      .where(eq(wMatrices.matrixId, matrixId));

    return result[0].serializedData;
  }

  /**
   * Delete W-Matrix from database
   */
  static async delete(matrixId: string): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    const result = await db
      .delete(wMatrices)
      .where(eq(wMatrices.matrixId, matrixId));

    return true;
  }

  /**
   * List all W-Matrices for a user
   */
  static async listByUser(userId: string): Promise<any[]> {
    const db = await getDb();
    if (!db) return [];

    const result = await db
      .select()
      .from(wMatrices)
      .where(eq(wMatrices.userId, parseInt(userId)));

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
  static async save(challenge: Challenge, config?: any): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    await db.insert(challenges).values({
      challengeId: challenge.id,
      nonce: challenge.nonce,
      testPrompts: JSON.stringify(challenge.testPrompts),
      expectedPatterns: JSON.stringify(challenge.expectedPatterns),
      expiresAt: new Date(challenge.expiresAt),
      config: config ? JSON.stringify(config) : null,
      status: 'active',
    });
  }

  /**
   * Load Challenge from database
   */
  static async load(challengeId: string): Promise<Challenge | null> {
    const db = await getDb();
    if (!db) return null;

    const result = await db
      .select()
      .from(challenges)
      .where(
        and(
          eq(challenges.challengeId, challengeId),
          eq(challenges.status, 'active')
        )
      )
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];

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
    verificationResult: any
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db
      .update(challenges)
      .set({
        status: 'completed',
        verificationResult: JSON.stringify(verificationResult),
      })
      .where(eq(challenges.challengeId, challengeId));
  }

  /**
   * Mark Challenge as expired
   */
  static async markExpired(challengeId: string): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db
      .update(challenges)
      .set({ status: 'expired' })
      .where(eq(challenges.challengeId, challengeId));
  }

  /**
   * Delete Challenge from database
   */
  static async delete(challengeId: string): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    await db
      .delete(challenges)
      .where(eq(challenges.challengeId, challengeId));

    return true;
  }

  /**
   * Clean up expired challenges
   */
  static async cleanupExpired(): Promise<number> {
    const db = await getDb();
    if (!db) return 0;

    // Mark expired
    await db
      .update(challenges)
      .set({ status: 'expired' })
      .where(
        and(
          lt(challenges.expiresAt, new Date()),
          eq(challenges.status, 'active')
        )
      );

    // Delete expired challenges older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await db
      .delete(challenges)
      .where(
        and(
          eq(challenges.status, 'expired'),
          lt(challenges.expiresAt, oneDayAgo)
        )
      );

    return 0; // Return count if needed
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
      console.error(`Failed to persist ${key} to database:`, error);
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
      console.error(`Failed to load ${key} from database:`, error);
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
      console.error(`Failed to delete ${key} from database:`, error);
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
