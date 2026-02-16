/**
 * IP Whitelist Middleware — P2 Security Enhancement
 *
 * Validates incoming requests against IP whitelist
 * Supports organization-level and user-level restrictions
 */

import { Request, Response, NextFunction } from 'express';
import { isIpWhitelisted, logIpAccess } from '../security/ip-whitelist-service';
import { createLogger } from '../utils/logger';

const logger = createLogger('IpWhitelistMiddleware');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract client IP from request (handles proxies)
 */
function getClientIp(req: Request): string {
  // Check X-Forwarded-For header (set by proxies/load balancers)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }

  // Check X-Real-IP header (alternative proxy header)
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fallback to direct connection IP
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * IP whitelist middleware for authenticated requests
 */
export function ipWhitelistMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get user from request (set by auth middleware)
  const user = (req as any).user;

  if (!user) {
    // No user = not authenticated, skip whitelist check
    return next();
  }

  const clientIp = getClientIp(req);

  // Check whitelist asynchronously
  isIpWhitelisted(clientIp, user.id, user.currentOrgId)
    .then(async (result) => {
      // Log access attempt
      await logIpAccess({
        userId: user.id,
        ipAddress: clientIp,
        endpoint: req.path,
        method: req.method,
        allowed: result.allowed,
        whitelistId: result.whitelistId,
        userAgent: req.headers['user-agent'],
      });

      if (!result.allowed) {
        logger.warn('IP access blocked', {
          userId: user.id,
          ip: clientIp,
          endpoint: req.path,
          reason: result.reason,
        });

        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP address is not whitelisted for this account',
          reason: result.reason,
          clientIp: clientIp.includes(':') ? clientIp.substring(0, clientIp.lastIndexOf(':')) : clientIp, // Hide port
        });
      }

      // IP allowed - continue
      next();
    })
    .catch((error) => {
      logger.error('Whitelist check failed', { error, userId: user.id, clientIp });
      // Fail open - allow request if whitelist check errors
      next();
    });
}

/**
 * Create IP whitelist middleware for specific organization
 */
export function createOrgIpWhitelist(organizationId: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;

    if (!user) {
      return next();
    }

    const clientIp = getClientIp(req);

    try {
      const result = await isIpWhitelisted(clientIp, user.id, organizationId);

      await logIpAccess({
        userId: user.id,
        ipAddress: clientIp,
        endpoint: req.path,
        method: req.method,
        allowed: result.allowed,
        whitelistId: result.whitelistId,
        userAgent: req.headers['user-agent'],
      });

      if (!result.allowed) {
        logger.warn('Organization IP access blocked', {
          userId: user.id,
          organizationId,
          ip: clientIp,
          endpoint: req.path,
        });

        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP address is not whitelisted for this organization',
          organizationId,
        });
      }

      next();
    } catch (error) {
      logger.error('Organization whitelist check failed', { error, userId: user.id, organizationId });
      next();
    }
  };
}

/**
 * IP whitelist middleware for API key authentication
 */
export async function ipWhitelistApiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Get API key info from request (set by API key auth middleware)
  const apiKeyUser = (req as any).apiKeyUser;

  if (!apiKeyUser) {
    return next();
  }

  const clientIp = getClientIp(req);

  try {
    const result = await isIpWhitelisted(clientIp, apiKeyUser.userId);

    await logIpAccess({
      userId: apiKeyUser.userId,
      ipAddress: clientIp,
      endpoint: req.path,
      method: req.method,
      allowed: result.allowed,
      whitelistId: result.whitelistId,
      userAgent: req.headers['user-agent'],
    });

    if (!result.allowed) {
      logger.warn('API key IP access blocked', {
        userId: apiKeyUser.userId,
        ip: clientIp,
        endpoint: req.path,
      });

      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not whitelisted for API access',
      });
    }

    next();
  } catch (error) {
    logger.error('API key whitelist check failed', { error, userId: apiKeyUser.userId });
    next();
  }
}

// ============================================================================
// Utility Middleware
// ============================================================================

/**
 * Attach client IP to request object
 */
export function attachClientIp(req: Request, res: Response, next: NextFunction): void {
  (req as any).clientIp = getClientIp(req);
  next();
}

/**
 * Log all IP access (for analytics)
 */
export function logAllIpAccess(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;

  if (!user) {
    return next();
  }

  const clientIp = getClientIp(req);

  // Log asynchronously (don't block request)
  logIpAccess({
    userId: user.id,
    ipAddress: clientIp,
    endpoint: req.path,
    method: req.method,
    allowed: true, // Logged after passing middleware
    userAgent: req.headers['user-agent'],
  }).catch((error) => {
    logger.error('Failed to log IP access', { error });
  });

  next();
}
