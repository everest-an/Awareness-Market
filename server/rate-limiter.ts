/**
 * API Rate Limiting Middleware
 * 
 * Protects API endpoints from abuse and ensures fair usage:
 * - Global limit: 100 req/min per IP
 * - Upload limit: 10 req/hour per user
 * - Purchase limit: 50 req/hour per user
 * - Browse limit: 200 req/min per user
 * 
 * Features:
 * - Per-IP and per-user limits
 * - Custom error messages
 * - Retry-After header
 * - Skip for trusted IPs (optional)
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

// Type for authenticated request with user
interface RequestWithUser extends Request {
  user?: { id?: number | string };
}

/**
 * Global rate limiter - applies to all API requests
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '1 minute',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: 60, // seconds
      },
    });
  },
});

/**
 * Upload rate limiter - for package upload endpoints
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour per user
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise use IP
    return (req as RequestWithUser).user?.id?.toString() || req.ip || 'anonymous';
  },
  message: {
    error: 'Upload limit exceeded. You can upload up to 10 packages per hour.',
    retryAfter: '1 hour',
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'UPLOAD_LIMIT_EXCEEDED',
        message: 'Upload limit exceeded. You can upload up to 10 packages per hour.',
        retryAfter: 3600, // seconds
        limit: 10,
        window: '1 hour',
      },
    });
  },
});

/**
 * Purchase rate limiter - for package purchase endpoints
 */
export const purchaseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 purchases per hour per user
  keyGenerator: (req: Request) => {
    return (req as RequestWithUser).user?.id?.toString() || req.ip || 'anonymous';
  },
  message: {
    error: 'Purchase limit exceeded. You can make up to 50 purchases per hour.',
    retryAfter: '1 hour',
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'PURCHASE_LIMIT_EXCEEDED',
        message: 'Purchase limit exceeded. You can make up to 50 purchases per hour.',
        retryAfter: 3600,
        limit: 50,
        window: '1 hour',
      },
    });
  },
});

/**
 * Browse rate limiter - for package browsing endpoints
 */
export const browseLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute per user
  keyGenerator: (req: Request) => {
    return (req as RequestWithUser).user?.id?.toString() || req.ip || 'anonymous';
  },
  message: {
    error: 'Browse limit exceeded. You can make up to 200 requests per minute.',
    retryAfter: '1 minute',
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'BROWSE_LIMIT_EXCEEDED',
        message: 'Browse limit exceeded. You can make up to 200 requests per minute.',
        retryAfter: 60,
        limit: 200,
        window: '1 minute',
      },
    });
  },
});

/**
 * AI Agent rate limiter - for AI-specific endpoints
 * More generous limits for authenticated AI agents
 */
export const aiAgentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500, // 500 requests per minute per API key
  keyGenerator: (req: Request) => {
    // Use API key if present
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    return apiKey || req.ip || 'anonymous';
  },
  message: {
    error: 'AI Agent rate limit exceeded. You can make up to 500 requests per minute.',
    retryAfter: '1 minute',
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'AI_AGENT_LIMIT_EXCEEDED',
        message: 'AI Agent rate limit exceeded. You can make up to 500 requests per minute.',
        retryAfter: 60,
        limit: 500,
        window: '1 minute',
      },
    });
  },
});

/**
 * Workspace Collaboration rate limiter
 * Limits context sharing / progress sync to prevent spam
 * 60 writes per minute per token, 200 reads per minute
 */
export const collabWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req: Request) => {
    const token = req.headers['x-mcp-token'] as string
      || req.headers['x-api-key'] as string
      || req.ip || 'anonymous';
    return `collab-write:${token}`;
  },
  message: {
    error: 'Collaboration write rate limit exceeded. Max 60 writes per minute.',
    retryAfter: '1 minute',
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'COLLAB_WRITE_LIMIT_EXCEEDED',
        message: 'Collaboration write rate limit exceeded. Max 60 writes per minute.',
        retryAfter: 60,
        limit: 60,
        window: '1 minute',
      },
    });
  },
});

export const collabReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  keyGenerator: (req: Request) => {
    const token = req.headers['x-mcp-token'] as string
      || req.headers['x-api-key'] as string
      || req.ip || 'anonymous';
    return `collab-read:${token}`;
  },
  message: {
    error: 'Collaboration read rate limit exceeded. Max 200 reads per minute.',
    retryAfter: '1 minute',
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'COLLAB_READ_LIMIT_EXCEEDED',
        message: 'Collaboration read rate limit exceeded. Max 200 reads per minute.',
        retryAfter: 60,
        limit: 200,
        window: '1 minute',
      },
    });
  },
});

/**
 * Create custom rate limiter with specific configuration
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    keyGenerator: options.keyGenerator || ((req: Request) => req.ip || 'anonymous'),
    message: {
      error: options.message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: options.message,
          retryAfter: Math.ceil(options.windowMs / 1000),
        },
      });
    },
  });
}

/**
 * Skip rate limiting for trusted IPs (optional)
 */
export function skipTrustedIPs(req: Request): boolean {
  const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
  const clientIP = req.ip || '';
  return trustedIPs.includes(clientIP);
}
