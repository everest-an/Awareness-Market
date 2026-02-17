/**
 * Rate Limiter Middleware — P1 Security Enhancement
 *
 * Protects APIs from:
 * - DDoS attacks
 * - Brute force attacks (login, password reset)
 * - API abuse
 * - Resource exhaustion
 *
 * Features:
 * - Global rate limiting (IP-based)
 * - Organization-based rate limiting (tier-aware)
 * - Authentication endpoint rate limiting
 * - Redis-backed distributed rate limiting
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

// Initialize Redis client for rate limiting
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: 'rl:',
  maxRetriesPerRequest: 3,
});

// ============================================================================
// Global Rate Limiters
// ============================================================================

/**
 * General API rate limiter (for public endpoints)
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use Redis for distributed rate limiting across multiple servers
  store: new RedisStore({
    sendCommand: (...args: string[]) => (redis as any).call(...args),
    prefix: 'rl:api:',
  }),
  // Skip successful requests for better UX (only count failed requests)
  skipSuccessfulRequests: false,
  // Skip rate limiting for health check endpoints
  skip: (req) => req.path === '/health' || req.path === '/api/health',
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 attempts per 15 minutes per IP (prevents brute force)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes',
    hint: 'If you forgot your password, use the password reset feature.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => (redis as any).call(...args),
    prefix: 'rl:auth:',
  }),
  // Don't skip successful requests - count all attempts
  skipSuccessfulRequests: false,
});

/**
 * Password reset rate limiter
 * 3 requests per hour per IP (prevents email spam)
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    error: 'Too many password reset requests, please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => (redis as any).call(...args),
    prefix: 'rl:pwd-reset:',
  }),
});

/**
 * Listing creation rate limiter
 * 10 listings per hour per user (prevents spam)
 */
export const listingCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    error: 'Too many listing creations, please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => (redis as any).call(...args),
    prefix: 'rl:listing:',
  }),
  // Use user ID as key instead of IP
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user ? `user:${user.id}` : req.ip || 'unknown';
  },
});

// ============================================================================
// Organization-Based Rate Limiting
// ============================================================================

interface OrgRateLimitConfig {
  perMinute: number;
  perHour: number;
  perDay: number;
}

const RATE_LIMITS_BY_TIER: Record<string, OrgRateLimitConfig> = {
  lite: {
    perMinute: 60,      // 1 req/sec average
    perHour: 1000,      // ~16 req/min average
    perDay: 10000,      // ~417 req/hour average
  },
  team: {
    perMinute: 300,     // 5 req/sec average
    perHour: 10000,     // ~167 req/min average
    perDay: 100000,     // ~4167 req/hour average
  },
  enterprise: {
    perMinute: 1000,    // ~17 req/sec average
    perHour: 50000,     // ~833 req/min average
    perDay: 500000,     // ~20833 req/hour average
  },
  scientific: {
    perMinute: 5000,    // ~83 req/sec average
    perHour: 200000,    // ~3333 req/min average
    perDay: 2000000,    // ~83333 req/hour average
  },
};

/**
 * Organization-aware rate limiter
 * Limits requests based on organization's plan tier
 */
export function createOrgRateLimiter(prisma: PrismaClient, window: 'minute' | 'hour' | 'day' = 'minute') {
  const windowMs = window === 'minute' ? 60 * 1000 : window === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  return async (req: Request, res: Response, next: any) => {
    const user = (req as any).user;

    if (!user || !user.currentOrgId) {
      // No org context - use global limiter
      return apiLimiter(req, res, next);
    }

    try {
      // Fetch organization plan tier
      const org = await prisma.organization.findUnique({
        where: { id: user.currentOrgId },
        select: { planTier: true },
      });

      if (!org) {
        return apiLimiter(req, res, next);
      }

      const limits = RATE_LIMITS_BY_TIER[org.planTier];
      const maxRequests = window === 'minute' ? limits.perMinute : window === 'hour' ? limits.perHour : limits.perDay;

      // Check rate limit in Redis
      const key = `rl:org:${user.currentOrgId}:${window}`;
      const current = await redis.incr(key);

      if (current === 1) {
        // First request in window - set expiry
        await redis.expire(key, Math.floor(windowMs / 1000));
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current).toString());
      res.setHeader('X-RateLimit-Reset', Date.now() + windowMs);

      if (current > maxRequests) {
        // Rate limit exceeded
        return res.status(429).json({
          error: 'Rate limit exceeded',
          limit: maxRequests,
          window,
          plan: org.planTier,
          message: `Your ${org.planTier} plan allows ${maxRequests} requests per ${window}. Upgrade to increase limits.`,
        });
      }

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - allow request if rate limiter fails
      next();
    }
  };
}

// ============================================================================
// Usage Statistics Tracking
// ============================================================================

/**
 * Track API usage for billing purposes
 * Records every API call to organization's usage counter
 */
export function createUsageTracker(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: any) => {
    const user = (req as any).user;

    if (!user || !user.currentOrgId) {
      return next();
    }

    // Track usage asynchronously (don't block request)
    setImmediate(async () => {
      try {
        const timestamp = new Date();
        const endpoint = req.path;
        const method = req.method;

        // Increment usage counter in Redis (fast)
        const key = `usage:org:${user.currentOrgId}:${timestamp.toISOString().slice(0, 10)}`; // Daily key
        await redis.hincrby(key, endpoint, 1);
        await redis.expire(key, 90 * 24 * 60 * 60); // Keep for 90 days

        // Batch write to database every 100 requests (reduce DB load)
        const count = await redis.incr(`usage:org:${user.currentOrgId}:count`);
        if (count % 100 === 0) {
          const dateKey = timestamp.toISOString().slice(0, 10);
          const redisKey = `usage:org:${user.currentOrgId}:${dateKey}`;
          const endpointCounts = await redis.hgetall(redisKey);

          if (endpointCounts && Object.keys(endpointCounts).length > 0) {
            // Ensure table exists (self-initializing, no migration required)
            await prisma.$executeRaw`
              CREATE TABLE IF NOT EXISTS org_api_usage_daily (
                org_id      INT         NOT NULL,
                date        DATE        NOT NULL,
                endpoint    VARCHAR(255) NOT NULL,
                call_count  INT         NOT NULL DEFAULT 0,
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (org_id, date, endpoint)
              )
            `;

            for (const [ep, callsStr] of Object.entries(endpointCounts)) {
              const calls = parseInt(callsStr, 10) || 0;
              await prisma.$executeRaw`
                INSERT INTO org_api_usage_daily (org_id, date, endpoint, call_count, updated_at)
                VALUES (${user.currentOrgId}, ${dateKey}::date, ${ep}, ${calls}, NOW())
                ON CONFLICT (org_id, date, endpoint)
                DO UPDATE SET call_count = ${calls}, updated_at = NOW()
              `;
            }
          }
        }
      } catch (error) {
        console.error('Usage tracker error:', error);
        // Fail silently - usage tracking should never break the API
      }
    });

    next();
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current rate limit status for an organization
 */
export async function getOrgRateLimitStatus(orgId: number, window: 'minute' | 'hour' | 'day' = 'minute'): Promise<{
  limit: number;
  current: number;
  remaining: number;
  resetAt: Date;
}> {
  const key = `rl:org:${orgId}:${window}`;
  const current = parseInt((await redis.get(key)) || '0', 10);
  const ttl = await redis.ttl(key);

  // Get org tier limits (would need prisma instance)
  // For now, return default
  const limit = 100;

  return {
    limit,
    current,
    remaining: Math.max(0, limit - current),
    resetAt: new Date(Date.now() + ttl * 1000),
  };
}

/**
 * Reset rate limit for an organization (admin function)
 */
export async function resetOrgRateLimit(orgId: number): Promise<void> {
  await Promise.all([
    redis.del(`rl:org:${orgId}:minute`),
    redis.del(`rl:org:${orgId}:hour`),
    redis.del(`rl:org:${orgId}:day`),
  ]);
}
