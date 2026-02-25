/**
 * Plan-Aware Rate Limiter
 *
 * Dynamic rate limiting that varies by organization plan tier.
 * Higher-tier plans get higher API rate limits.
 *
 * Tier limits (requests per minute):
 *   - No org / unauthenticated: 60
 *   - Lite:       200
 *   - Team:       600
 *   - Enterprise: 2000
 *   - Scientific: 5000
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { prisma } from '../db-prisma';
import { createLogger } from '../utils/logger';

const logger = createLogger('PlanRateLimiter');

// ── Tier → limit mapping ──────────────────────────────────────────────────

const TIER_LIMITS: Record<string, number> = {
  lite: 200,
  team: 600,
  enterprise: 2000,
  scientific: 5000,
};

const DEFAULT_LIMIT = 60; // unauthenticated / no org

// ── In-memory cache for tier lookups (avoids DB hit per request) ───────────

interface CachedTier {
  tier: string;
  expiresAt: number;
}

const tierCache = new Map<string, CachedTier>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedTier(key: string): string | null {
  const cached = tierCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    tierCache.delete(key);
    return null;
  }
  return cached.tier;
}

function setCachedTier(key: string, tier: string): void {
  tierCache.set(key, { tier, expiresAt: Date.now() + CACHE_TTL_MS });

  // Lazy eviction: purge expired entries when cache grows large
  if (tierCache.size > 10000) {
    const now = Date.now();
    for (const [k, v] of tierCache) {
      if (now > v.expiresAt) tierCache.delete(k);
    }
  }
}

// ── Resolve org tier from request ─────────────────────────────────────────

interface RequestWithUser extends Request {
  user?: { id?: number | string };
}

async function resolveOrgTier(req: Request): Promise<string> {
  const userId = (req as RequestWithUser).user?.id;
  if (!userId) return 'none';

  const cacheKey = `user:${userId}`;
  const cached = getCachedTier(cacheKey);
  if (cached) return cached;

  try {
    // Find the highest-tier org the user belongs to
    const memberships = await prisma.orgMembership.findMany({
      where: { userId: Number(userId) },
      select: { organization: { select: { planTier: true } } },
    });

    if (memberships.length === 0) {
      setCachedTier(cacheKey, 'none');
      return 'none';
    }

    // Pick highest tier
    const tierOrder = ['lite', 'team', 'enterprise', 'scientific'];
    let bestTier = 'lite';
    for (const m of memberships) {
      const t = m.organization.planTier;
      if (tierOrder.indexOf(t) > tierOrder.indexOf(bestTier)) {
        bestTier = t;
      }
    }

    setCachedTier(cacheKey, bestTier);
    return bestTier;
  } catch (err) {
    // DB unavailable — fall back to default
    logger.warn('Failed to resolve org tier for rate limiting', { userId });
    return 'none';
  }
}

// ── Plan-Aware AI Agent Limiter ───────────────────────────────────────────

/**
 * Rate limiter for AI/MCP/Inference endpoints.
 * Dynamically sets `max` based on the authenticated user's best org plan tier.
 */
export const planAwareAgentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  validate: false, // custom keyGenerator handles IPv6 via fallback
  max: async (req: Request) => {
    const tier = await resolveOrgTier(req);
    return TIER_LIMITS[tier] ?? DEFAULT_LIMIT;
  },
  keyGenerator: (req: Request) => {
    const userId = (req as RequestWithUser).user?.id;
    if (userId) return `plan:user:${userId}`;
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    return apiKey || req.ip || 'anonymous';
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req: Request, res: Response) => {
    const tier = await resolveOrgTier(req);
    const limit = TIER_LIMITS[tier] ?? DEFAULT_LIMIT;
    res.status(429).json({
      success: false,
      error: {
        code: 'PLAN_RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded for your plan (${tier || 'free'}). Limit: ${limit} req/min. Upgrade your plan for higher limits.`,
        retryAfter: 60,
        limit,
        tier: tier || 'free',
        window: '1 minute',
      },
    });
  },
});

/**
 * Plan-aware global API limiter.
 * Authenticated users in higher orgs get more generous global limits.
 */
export const planAwareGlobalLimiter = rateLimit({
  windowMs: 60 * 1000,
  validate: false, // custom keyGenerator handles IPv6 via fallback
  max: async (req: Request) => {
    const tier = await resolveOrgTier(req);
    // Global limits are lower than agent-specific limits
    const globalTierLimits: Record<string, number> = {
      lite: 150,
      team: 400,
      enterprise: 1000,
      scientific: 3000,
    };
    return globalTierLimits[tier] ?? 100;
  },
  keyGenerator: (req: Request) => {
    const userId = (req as RequestWithUser).user?.id;
    if (userId) return `plan-global:user:${userId}`;
    return req.ip || 'anonymous';
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Upgrade your organization plan for higher limits.',
        retryAfter: 60,
      },
    });
  },
});
