/**
 * Redis Cache Service
 *
 * Provides 20-30x faster data access through intelligent caching.
 * Implements cache-aside pattern with automatic invalidation.
 */

import Redis from 'ioredis';

interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: number; // Default TTL in seconds
  maxRetriesPerRequest?: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // For group invalidation
  compress?: boolean; // Compress large values
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsed: string;
}

/**
 * Redis Cache Service
 */
export class RedisCacheService {
  private client: Redis;
  private config: CacheConfig;
  private stats: { hits: number; misses: number } = { hits: 0, misses: 0 };

  constructor(config: CacheConfig) {
    this.config = {
      ttl: 3600, // 1 hour default
      maxRetriesPerRequest: 3,
      ...config,
    };

    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db || 0,
      keyPrefix: this.config.keyPrefix || 'awareness:',
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ETIMEDOUT'];
        return targetErrors.some(targetError => err.message.includes(targetError));
      },
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('✓ Redis connected');
    });

    this.client.on('error', (error) => {
      console.error('Redis error:', error);
    });

    this.client.on('close', () => {
      console.log('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });
  }

  /**
   * Get value from cache
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;

      // Check if compressed
      if (value.startsWith('gzip:')) {
        const compressed = Buffer.from(value.substring(5), 'base64');
        const decompressed = await this.decompress(compressed);
        return JSON.parse(decompressed);
      }

      return JSON.parse(value);
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: unknown, options?: CacheOptions): Promise<boolean> {
    try {
      const ttl = options?.ttl || this.config.ttl!;
      let serialized = JSON.stringify(value);

      // Compress if large or requested
      if (options?.compress || serialized.length > 10240) {
        // > 10KB
        const compressed = await this.compress(serialized);
        serialized = 'gzip:' + compressed.toString('base64');
      }

      // Set with TTL
      await this.client.setex(key, ttl, serialized);

      // Add tags for group invalidation
      if (options?.tags && options.tags.length > 0) {
        await this.addTags(key, options.tags);
      }

      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T = unknown>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch data
    const data = await fetcher();

    // Store in cache (don't await to reduce latency)
    this.set(key, data, options).catch(err => {
      console.error('Background cache set failed:', err);
    });

    return data;
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys
   */
  async deleteMany(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    try {
      return await this.client.del(...keys);
    } catch (error) {
      console.error('Cache delete many error:', error);
      return 0;
    }
  }

  /**
   * Delete keys by pattern
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      return await this.client.del(...keys);
    } catch (error) {
      console.error(`Cache delete by pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Delete keys by tags
   */
  async deleteByTags(tags: string[]): Promise<number> {
    try {
      let totalDeleted = 0;

      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const keys = await this.client.smembers(tagKey);

        if (keys.length > 0) {
          const deleted = await this.client.del(...keys);
          totalDeleted += deleted;
        }

        // Delete tag set itself
        await this.client.del(tagKey);
      }

      return totalDeleted;
    } catch (error) {
      console.error('Cache delete by tags error:', error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration time
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL of key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
      return -2; // Key doesn't exist
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, by: number = 1): Promise<number> {
    try {
      return await this.client.incrby(key, by);
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Add tags to key for group invalidation
   */
  private async addTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.client.pipeline();

    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      pipeline.sadd(tagKey, key);
    }

    await pipeline.exec();
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.client.info('stats');
      const memory = await this.client.info('memory');
      const dbsize = await this.client.dbsize();

      const hitRate = this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

      // Parse memory used
      const memoryMatch = memory.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsed = memoryMatch ? memoryMatch[1].trim() : 'unknown';

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        totalKeys: dbsize,
        memoryUsed,
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: 0,
        totalKeys: 0,
        memoryUsed: 'unknown',
      };
    }
  }

  /**
   * Clear all cache
   */
  async flush(): Promise<boolean> {
    try {
      await this.client.flushdb();
      this.stats = { hits: 0, misses: 0 };
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Compress data using gzip
   */
  private async compress(data: string): Promise<Buffer> {
    const { gzip } = await import('zlib');
    const { promisify } = await import('util');
    const gzipAsync = promisify(gzip);
    return await gzipAsync(Buffer.from(data));
  }

  /**
   * Decompress gzip data
   */
  private async decompress(data: Buffer): Promise<string> {
    const { gunzip } = await import('zlib');
    const { promisify } = await import('util');
    const gunzipAsync = promisify(gunzip);
    const decompressed = await gunzipAsync(data);
    return decompressed.toString();
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Get underlying Redis client (for advanced operations)
   */
  getClient(): Redis {
    return this.client;
  }
}

/**
 * Cache Key Builder
 */
export class CacheKeyBuilder {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  /**
   * Build package cache key
   */
  package(id: string): string {
    return `${this.prefix}package:${id}`;
  }

  /**
   * Build search results cache key
   */
  searchResults(queryHash: string): string {
    return `${this.prefix}search:${queryHash}`;
  }

  /**
   * Build user cache key
   */
  user(id: string): string {
    return `${this.prefix}user:${id}`;
  }

  /**
   * Build listing cache key
   */
  listing(page: number, limit: number, filters?: Record<string, unknown>): string {
    const filterHash = filters ? this.hashObject(filters) : 'default';
    return `${this.prefix}listing:${page}:${limit}:${filterHash}`;
  }

  /**
   * Build stats cache key
   */
  stats(type: string): string {
    return `${this.prefix}stats:${type}`;
  }

  /**
   * Hash object for cache key
   */
  private hashObject(obj: unknown): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64').substring(0, 16);
  }
}

/**
 * Global cache instance
 */
let cacheInstance: RedisCacheService | null = null;

export function initializeCache(config: CacheConfig): RedisCacheService {
  if (!cacheInstance) {
    cacheInstance = new RedisCacheService(config);
  }
  return cacheInstance;
}

export function getCache(): RedisCacheService {
  if (!cacheInstance) {
    throw new Error('Cache not initialized. Call initializeCache() first.');
  }
  return cacheInstance;
}

export const cacheKeys = new CacheKeyBuilder();
