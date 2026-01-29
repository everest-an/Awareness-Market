/**
 * Redis Configuration
 *
 * Environment-specific Redis configuration for development and production.
 */

export interface RedisEnvConfig {
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB?: number;
  REDIS_KEY_PREFIX?: string;
  REDIS_TTL?: number;
  REDIS_MAX_RETRIES?: number;
}

/**
 * Get Redis configuration from environment
 */
export function getRedisConfig(): RedisEnvConfig {
  return {
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_DB: parseInt(process.env.REDIS_DB || '0', 10),
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX || 'awareness:',
    REDIS_TTL: parseInt(process.env.REDIS_TTL || '3600', 10),
    REDIS_MAX_RETRIES: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
  };
}

/**
 * Development configuration (local Redis)
 */
export const developmentConfig: RedisEnvConfig = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_KEY_PREFIX: 'dev:awareness:',
  REDIS_TTL: 3600, // 1 hour
};

/**
 * Production configuration (Redis Cloud/ElastiCache)
 */
export const productionConfig: RedisEnvConfig = {
  REDIS_HOST: process.env.REDIS_HOST || 'redis-cluster.example.com',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: 0,
  REDIS_KEY_PREFIX: 'prod:awareness:',
  REDIS_TTL: 7200, // 2 hours
  REDIS_MAX_RETRIES: 5,
};

/**
 * Test configuration (separate DB)
 */
export const testConfig: RedisEnvConfig = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_DB: 1, // Separate database for tests
  REDIS_KEY_PREFIX: 'test:awareness:',
  REDIS_TTL: 300, // 5 minutes
};

/**
 * Get configuration based on environment
 */
export function getConfigForEnvironment(env: string = process.env.NODE_ENV || 'development'): RedisEnvConfig {
  switch (env) {
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    case 'development':
    default:
      return developmentConfig;
  }
}

/**
 * Cache TTL presets for different data types
 */
export const CacheTTL = {
  // Very short (1 minute)
  VERY_SHORT: 60,

  // Short (5 minutes)
  SHORT: 300,

  // Medium (15 minutes)
  MEDIUM: 900,

  // Standard (1 hour)
  STANDARD: 3600,

  // Long (6 hours)
  LONG: 21600,

  // Very long (24 hours)
  VERY_LONG: 86400,

  // Week
  WEEK: 604800,

  // Month
  MONTH: 2592000,
} as const;

/**
 * Recommended TTL for different data types
 */
export const RecommendedTTL = {
  // Package details (rarely change)
  package: CacheTTL.LONG,

  // Package listings (frequent updates)
  packageList: CacheTTL.MEDIUM,

  // Search results (can be stale)
  searchResults: CacheTTL.STANDARD,

  // User profile (moderate changes)
  userProfile: CacheTTL.STANDARD,

  // Popular/trending (needs freshness)
  trending: CacheTTL.SHORT,

  // Stats/analytics (can be stale)
  analytics: CacheTTL.LONG,

  // Session data
  session: CacheTTL.VERY_LONG,

  // Rate limiting counters
  rateLimit: CacheTTL.VERY_SHORT,

  // GPU status (real-time)
  gpuStatus: CacheTTL.VERY_SHORT,

  // Privacy budget (important to sync)
  privacyBudget: CacheTTL.SHORT,
} as const;

/**
 * Cache invalidation tags
 */
export const CacheTags = {
  // Invalidate all package-related caches
  PACKAGES: 'packages',

  // Invalidate specific package
  package: (id: string) => `package:${id}`,

  // Invalidate user-specific caches
  user: (id: string) => `user:${id}`,

  // Invalidate search caches
  SEARCH: 'search',

  // Invalidate stats caches
  STATS: 'stats',

  // Invalidate listings
  LISTINGS: 'listings',
} as const;

/**
 * Example .env file content
 */
export const exampleEnvConfig = `
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password-here
REDIS_DB=0
REDIS_KEY_PREFIX=awareness:
REDIS_TTL=3600
REDIS_MAX_RETRIES=3

# Production Redis (AWS ElastiCache / Redis Cloud)
# REDIS_HOST=your-redis-cluster.cache.amazonaws.com
# REDIS_PORT=6379
# REDIS_PASSWORD=your-production-password
# REDIS_DB=0
`.trim();
