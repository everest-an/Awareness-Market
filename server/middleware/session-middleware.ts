/**
 * Session Validation Middleware — P2 Security Enhancement
 *
 * Integrates enhanced session management into request flow
 * Validates sessions, tracks activity, enforces timeouts
 */

import { Request, Response, NextFunction } from 'express';
import { validateSession } from '../security/session-manager';
import { verifyToken } from '../auth-standalone';
import { createLogger } from '../utils/logger';

const logger = createLogger('SessionMiddleware');

// ============================================================================
// Session Validation Middleware
// ============================================================================

/**
 * Enhanced session validation middleware
 * Replaces or augments existing JWT validation
 */
export async function enhancedSessionValidation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Extract access token from cookie or Authorization header
  const accessToken =
    req.cookies?.jwt_token ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!accessToken) {
    return next(); // No token = not authenticated (handled by auth middleware)
  }

  try {
    // 1. Verify JWT signature first (lightweight check)
    const payload = verifyToken(accessToken, 'access');

    if (!payload) {
      // Invalid JWT - clear cookie and reject
      res.clearCookie('jwt_token');
      res.status(401).json({
        error: 'Invalid or expired token',
        message: 'Please log in again',
      });
      return;
    }

    // 2. Validate session in database (idle timeout, revocation, etc.)
    const sessionValidation = await validateSession(accessToken);

    if (!sessionValidation.valid) {
      // Session invalid - clear cookie and reject
      res.clearCookie('jwt_token');
      res.clearCookie('jwt_refresh');

      logger.warn('Session validation failed', {
        userId: payload.userId,
        error: sessionValidation.error,
      });

      res.status(401).json({
        error: 'Session expired or invalid',
        message: sessionValidation.error,
        reason: sessionValidation.error,
      });
      return;
    }

    // 3. Attach session info to request
    (req as any).sessionId = sessionValidation.sessionId;
    (req as any).user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    logger.error('Session validation error', { error });
    // Fail open - let auth middleware handle it
    next();
  }
}

/**
 * Middleware to track session activity (updates lastActivityAt)
 */
export function trackSessionActivity(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const sessionId = (req as any).sessionId;

  if (sessionId) {
    // Activity is already tracked in validateSession()
    // This middleware is for explicit tracking if needed
  }

  next();
}

/**
 * Middleware to enforce session limits on login
 */
export function sessionLimitEnforcer(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Session limit is enforced in createSession() automatically
  next();
}
