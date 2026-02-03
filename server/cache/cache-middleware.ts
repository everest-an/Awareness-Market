/**
 * Cache Middleware for tRPC
 *
 * Automatically caches query results and invalidates on mutations.
 */

import { TRPCError } from '@trpc/server';
import { getCache, cacheKeys } from './redis-cache';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { prisma } from '../db-prisma';

const logger = createLogger('CacheMiddleware');

interface MiddlewareContext {
  next: () => Promise<unknown>;
  ctx: unknown;
  input?: unknown;
  path: string;
}

interface CacheMiddlewareOptions {
  ttl?: number;
  tags?: string[];
  enabled?: boolean;
  keyGenerator?: (input: unknown) => string;
}

/**
 * Create cache middleware for tRPC procedures
 */
export function createCacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const { ttl = 3600, tags = [], enabled = true } = options;

  return async function cacheMiddleware({ next, ctx, input, path }: MiddlewareContext) {
    if (!enabled) {
      return next();
    }

    const cache = getCache();

    // Generate cache key
    const cacheKey = options.keyGenerator
      ? options.keyGenerator(input)
      : generateCacheKey(path, input);

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Execute procedure
    const result = await next();

    // Cache the result (don't await)
    cache.set(cacheKey, result, { ttl, tags }).catch((err) => {
      console.error('Cache middleware set error:', err);
    });

    return result;
  };
}

/**
 * Create invalidation middleware for mutations
 */
export function createInvalidationMiddleware(options: { tags?: string[] } = {}) {
  const { tags = [] } = options;

  return async function invalidationMiddleware({ next }: Pick<MiddlewareContext, 'next'>) {
    // Execute mutation
    const result = await next();

    // Invalidate cache tags
    if (tags.length > 0) {
      const cache = getCache();
      cache.deleteByTags(tags).catch((err) => {
        console.error('Cache invalidation error:', err);
      });
    }

    return result;
  };
}

/**
 * Generate cache key from path and input
 */
function generateCacheKey(path: string, input: unknown): string {
  const inputHash = hashInput(input);
  return `query:${path}:${inputHash}`;
}

/**
 * Hash input for cache key
 */
function hashInput(input: unknown): string {
  const str = JSON.stringify(input || {});
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 16);
}

/**
 * Decorator for cacheable queries
 */
export function Cacheable(ttl?: number, tags?: string[]) {
  return function <T extends object>(target: T, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const cache = getCache();
      const cacheKey = `method:${(target as { constructor: { name: string } }).constructor.name}:${propertyKey}:${hashInput(args)}`;

      // Try cache
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Execute method
      const result = await originalMethod.apply(this, args);

      // Cache result
      await cache.set(cacheKey, result, { ttl, tags });

      return result;
    };

    return descriptor;
  };
}

/**
 * Express middleware for HTTP caching
 */
export function httpCacheMiddleware(options: { ttl?: number; varyBy?: string[] } = {}) {
  const { ttl = 60, varyBy = [] } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    const cache = getCache();

    // Generate cache key from URL and headers
    const keyParts = [req.originalUrl || req.url];
    for (const header of varyBy) {
      keyParts.push(req.get(header) || '');
    }
    const cacheKey = `http:${hashInput(keyParts)}`;

    // Try cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Intercept res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      res.set('X-Cache', 'MISS');

      // Cache response (don't await)
      cache.set(cacheKey, body, { ttl }).catch((err) => {
        console.error('HTTP cache error:', err);
      });

      return originalJson(body);
    };

    next();
  };
}

/**
 * Cache warming utility
 */
export class CacheWarmer {
  private cache = getCache();

  /**
   * Warm up cache with popular packages
   * Fetches package data from database and pre-loads into cache
   */
  async warmPackages(packageIds: string[]): Promise<void> {
    logger.info('[Cache Warmer] Starting package cache warming', { count: packageIds.length });

    let successCount = 0;
    let errorCount = 0;

    for (const packageId of packageIds) {
      try {
        // Try to fetch from all package types
        let packageData: any = null;
        let packageType: 'vector' | 'memory' | 'chain' | null = null;

        // Check vector packages
        packageData = await prisma.vectorPackage.findUnique({
          where: { packageId },
        });
        if (packageData) packageType = 'vector';

        // Check memory packages if not found
        if (!packageData) {
          packageData = await prisma.memoryPackage.findUnique({
            where: { packageId },
          });
          if (packageData) packageType = 'memory';
        }

        // Check chain packages if still not found
        if (!packageData) {
          packageData = await prisma.chainPackage.findUnique({
            where: { packageId },
          });
          if (packageData) packageType = 'chain';
        }

        // Cache the package data if found
        if (packageData && packageType) {
          const cacheKey = cacheKeys.package(packageId);
          await this.cache.set(
            cacheKey,
            { ...packageData, packageType },
            { ttl: 3600 } // 1 hour TTL
          );
          successCount++;
          logger.debug('[Cache Warmer] Package cached', { packageId, packageType });
        } else {
          logger.warn('[Cache Warmer] Package not found', { packageId });
        }
      } catch (error) {
        errorCount++;
        logger.error('[Cache Warmer] Error warming package cache', {
          packageId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('[Cache Warmer] Package cache warming complete', {
      total: packageIds.length,
      success: successCount,
      errors: errorCount,
    });
  }

  /**
   * Warm up cache with search results
   * Pre-computes and caches results for popular search queries
   */
  async warmSearches(popularQueries: string[]): Promise<void> {
    logger.info('[Cache Warmer] Starting search cache warming', { count: popularQueries.length });

    let successCount = 0;
    let errorCount = 0;

    for (const query of popularQueries) {
      try {
        // Search across all package types
        const searchResults = {
          vector: await prisma.vectorPackage.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
              status: 'active',
            },
            take: 10,
            orderBy: { downloads: 'desc' },
          }),
          memory: await prisma.memoryPackage.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
              status: 'active',
            },
            take: 10,
            orderBy: { downloads: 'desc' },
          }),
          chain: await prisma.chainPackage.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
              status: 'active',
            },
            take: 10,
            orderBy: { downloads: 'desc' },
          }),
        };

        // Cache search results
        const cacheKey = `search:${query.toLowerCase().trim()}`;
        await this.cache.set(
          cacheKey,
          searchResults,
          { ttl: 1800 } // 30 minutes TTL for searches
        );

        successCount++;
        logger.debug('[Cache Warmer] Search cached', {
          query,
          resultsCount:
            searchResults.vector.length +
            searchResults.memory.length +
            searchResults.chain.length,
        });
      } catch (error) {
        errorCount++;
        logger.error('[Cache Warmer] Error warming search cache', {
          query,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('[Cache Warmer] Search cache warming complete', {
      total: popularQueries.length,
      success: successCount,
      errors: errorCount,
    });
  }

  /**
   * Schedule periodic cache warming
   * Automatically warms cache for top packages and searches
   */
  startPeriodicWarming(intervalMs: number = 3600000): void {
    logger.info('[Cache Warmer] Starting periodic cache warming', {
      intervalMs,
      intervalHours: intervalMs / 3600000,
    });

    // Run immediately on startup
    this.runPeriodicWarming().catch((error) => {
      logger.error('[Cache Warmer] Initial warming failed', { error });
    });

    // Then schedule periodic runs
    setInterval(async () => {
      await this.runPeriodicWarming();
    }, intervalMs);
  }

  /**
   * Execute one cycle of cache warming
   */
  private async runPeriodicWarming(): Promise<void> {
    logger.info('[Cache Warmer] Periodic cache warming cycle started');
    const startTime = Date.now();

    try {
      // Get top 100 most downloaded packages
      const topPackages = await Promise.all([
        prisma.vectorPackage.findMany({
          where: { status: 'active' },
          select: { packageId: true },
          orderBy: { downloads: 'desc' },
          take: 50,
        }),
        prisma.memoryPackage.findMany({
          where: { status: 'active' },
          select: { packageId: true },
          orderBy: { downloads: 'desc' },
          take: 25,
        }),
        prisma.chainPackage.findMany({
          where: { status: 'active' },
          select: { packageId: true },
          orderBy: { downloads: 'desc' },
          take: 25,
        }),
      ]);

      const packageIds = [
        ...topPackages[0].map((p) => p.packageId),
        ...topPackages[1].map((p) => p.packageId),
        ...topPackages[2].map((p) => p.packageId),
      ];

      // Warm package cache
      await this.warmPackages(packageIds);

      // Warm search cache with popular queries
      const popularQueries = [
        'gpt',
        'claude',
        'llama',
        'embedding',
        'chat',
        'translation',
        'summarization',
        'reasoning',
        'vision',
        'audio',
      ];
      await this.warmSearches(popularQueries);

      const duration = Date.now() - startTime;
      logger.info('[Cache Warmer] Periodic cache warming cycle completed', {
        durationMs: duration,
        packagesCached: packageIds.length,
        queriesCached: popularQueries.length,
      });
    } catch (error) {
      logger.error('[Cache Warmer] Periodic cache warming failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const cacheWarmer = new CacheWarmer();
