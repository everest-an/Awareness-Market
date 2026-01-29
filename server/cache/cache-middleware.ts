/**
 * Cache Middleware for tRPC
 *
 * Automatically caches query results and invalidates on mutations.
 */

import { TRPCError } from '@trpc/server';
import { getCache, cacheKeys } from './redis-cache';
import crypto from 'crypto';

interface CacheMiddlewareOptions {
  ttl?: number;
  tags?: string[];
  enabled?: boolean;
  keyGenerator?: (input: any) => string;
}

/**
 * Create cache middleware for tRPC procedures
 */
export function createCacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const { ttl = 3600, tags = [], enabled = true } = options;

  return async function cacheMiddleware({ next, ctx, input, path }: any) {
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

  return async function invalidationMiddleware({ next, ctx }: any) {
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
function generateCacheKey(path: string, input: any): string {
  const inputHash = hashInput(input);
  return `query:${path}:${inputHash}`;
}

/**
 * Hash input for cache key
 */
function hashInput(input: any): string {
  const str = JSON.stringify(input || {});
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 16);
}

/**
 * Decorator for cacheable queries
 */
export function Cacheable(ttl?: number, tags?: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cache = getCache();
      const cacheKey = `method:${target.constructor.name}:${propertyKey}:${hashInput(args)}`;

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

  return async (req: any, res: any, next: any) => {
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
    res.json = function (body: any) {
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
   */
  async warmPackages(packageIds: string[]): Promise<void> {
    console.log(`Warming cache for ${packageIds.length} packages...`);

    // This would typically fetch from database
    // For now, just a placeholder

    for (const id of packageIds) {
      const key = cacheKeys.package(id);
      // await this.cache.set(key, packageData, { ttl: 3600 });
    }

    console.log('Cache warming complete');
  }

  /**
   * Warm up cache with search results
   */
  async warmSearches(popularQueries: string[]): Promise<void> {
    console.log(`Warming cache for ${popularQueries.length} search queries...`);

    // Pre-compute and cache popular search results

    console.log('Search cache warming complete');
  }

  /**
   * Schedule periodic cache warming
   */
  startPeriodicWarming(intervalMs: number = 3600000): void {
    // Every hour
    setInterval(async () => {
      console.log('Periodic cache warming started...');
      // Implement warming logic
    }, intervalMs);
  }
}

export const cacheWarmer = new CacheWarmer();
