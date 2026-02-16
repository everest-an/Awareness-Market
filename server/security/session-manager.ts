/**
 * Enhanced Session Management — P2 Security Enhancement
 *
 * Features:
 * - Session fixation prevention (regenerate on login)
 * - Idle timeout tracking (auto-logout after inactivity)
 * - Absolute session expiration (max duration)
 * - Device tracking (multiple devices support)
 * - Session revocation (logout from all devices)
 * - Concurrent session limiting
 *
 * Security benefits:
 * - Prevents session hijacking
 * - Automatic cleanup of stale sessions
 * - Audit trail of active sessions
 * - User control over active devices
 */

import { prisma } from '../db-prisma';
import { createLogger } from '../utils/logger';
import crypto from 'crypto';
import { generateAccessToken, generateRefreshToken } from '../auth-standalone';

const logger = createLogger('SessionManager');

// ============================================================================
// Configuration
// ============================================================================

interface SessionConfig {
  idleTimeoutMinutes: number; // Auto-logout after inactivity
  absoluteTimeoutHours: number; // Max session duration
  maxConcurrentSessions: number; // Max sessions per user
  enableDeviceTracking: boolean;
}

function getSessionConfig(): SessionConfig {
  return {
    idleTimeoutMinutes: parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES || '30', 10),
    absoluteTimeoutHours: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS || '24', 10),
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10),
    enableDeviceTracking: process.env.ENABLE_DEVICE_TRACKING !== 'false',
  };
}

// ============================================================================
// Session Creation
// ============================================================================

/**
 * Create a new session for user (after successful login)
 */
export async function createSession(params: {
  userId: number;
  ipAddress: string;
  userAgent?: string;
  deviceFingerprint?: string;
}): Promise<{
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const config = getSessionConfig();

  // Get user info for JWT generation
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Generate JWT tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Hash tokens for storage (never store plaintext tokens)
  const sessionTokenHash = hashToken(accessToken);
  const refreshTokenHash = hashToken(refreshToken);

  // Calculate expiration times
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.absoluteTimeoutHours * 60 * 60 * 1000);

  // Parse device info from user agent
  const deviceName = parseDeviceName(params.userAgent);

  // Enforce concurrent session limit
  await enforceConcurrentSessionLimit(params.userId, config.maxConcurrentSessions);

  // Create session record
  const session = await prisma.userSession.create({
    data: {
      userId: params.userId,
      sessionToken: sessionTokenHash,
      refreshToken: refreshTokenHash,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      deviceFingerprint: params.deviceFingerprint,
      deviceName,
      expiresAt,
      lastActivityAt: now,
      idleTimeoutMinutes: config.idleTimeoutMinutes,
      isActive: true,
    },
  });

  logger.info('Session created', {
    sessionId: session.id,
    userId: params.userId,
    deviceName,
    expiresAt,
  });

  return {
    sessionId: session.id,
    accessToken,
    refreshToken,
    expiresAt,
  };
}

/**
 * Hash token for storage (SHA256)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Parse device name from user agent
 */
function parseDeviceName(userAgent?: string): string {
  if (!userAgent) return 'Unknown Device';

  // Simple parsing - could be enhanced with ua-parser-js library
  const ua = userAgent.toLowerCase();

  let browser = 'Unknown Browser';
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';

  let os = 'Unknown OS';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  return `${browser} on ${os}`;
}

/**
 * Enforce concurrent session limit (revoke oldest sessions if exceeded)
 */
async function enforceConcurrentSessionLimit(userId: number, maxSessions: number): Promise<void> {
  const activeSessions = await prisma.userSession.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() },
      revokedAt: null,
    },
    orderBy: { lastActivityAt: 'asc' }, // Oldest first
  });

  if (activeSessions.length >= maxSessions) {
    const sessionsToRevoke = activeSessions.slice(0, activeSessions.length - maxSessions + 1);

    for (const session of sessionsToRevoke) {
      await revokeSession(session.id, 'Concurrent session limit exceeded');
    }

    logger.info('Revoked old sessions due to concurrent limit', {
      userId,
      revokedCount: sessionsToRevoke.length,
      maxSessions,
    });
  }
}

// ============================================================================
// Session Validation
// ============================================================================

/**
 * Validate session and check for idle/absolute timeout
 */
export async function validateSession(accessToken: string): Promise<{
  valid: boolean;
  sessionId?: string;
  userId?: number;
  error?: string;
}> {
  const tokenHash = hashToken(accessToken);

  const session = await prisma.userSession.findUnique({
    where: { sessionToken: tokenHash },
  });

  if (!session) {
    return { valid: false, error: 'Session not found' };
  }

  // Check if revoked
  if (session.revokedAt) {
    return { valid: false, error: 'Session has been revoked' };
  }

  // Check if active
  if (!session.isActive) {
    return { valid: false, error: 'Session is inactive' };
  }

  const now = new Date();

  // Check absolute expiration
  if (now > session.expiresAt) {
    await revokeSession(session.id, 'Absolute timeout exceeded');
    return { valid: false, error: 'Session expired (absolute timeout)' };
  }

  // Check idle timeout
  const idleTimeMs = now.getTime() - session.lastActivityAt.getTime();
  const idleTimeoutMs = session.idleTimeoutMinutes * 60 * 1000;

  if (idleTimeMs > idleTimeoutMs) {
    await revokeSession(session.id, 'Idle timeout exceeded');
    return { valid: false, error: 'Session expired (idle timeout)' };
  }

  // Update last activity (async to avoid blocking)
  updateSessionActivity(session.id).catch((error) => {
    logger.error('Failed to update session activity', { error, sessionId: session.id });
  });

  return { valid: true, sessionId: session.id, userId: session.userId };
}

/**
 * Update session last activity timestamp
 */
async function updateSessionActivity(sessionId: string): Promise<void> {
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { lastActivityAt: new Date() },
  });
}

// ============================================================================
// Session Revocation
// ============================================================================

/**
 * Revoke a specific session
 */
export async function revokeSession(
  sessionId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason || 'Manual revocation',
      },
    });

    logger.info('Session revoked', { sessionId, reason });
    return { success: true };
  } catch (error) {
    logger.error('Failed to revoke session', { error, sessionId });
    return { success: false, error: String(error) };
  }
}

/**
 * Revoke all sessions for a user (logout from all devices)
 */
export async function revokeAllUserSessions(
  userId: number,
  reason?: string
): Promise<{ revokedCount: number }> {
  const result = await prisma.userSession.updateMany({
    where: {
      userId,
      isActive: true,
      revokedAt: null,
    },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokedReason: reason || 'Revoke all sessions requested',
    },
  });

  logger.info('All sessions revoked for user', {
    userId,
    revokedCount: result.count,
    reason,
  });

  return { revokedCount: result.count };
}

/**
 * Revoke all sessions except current one
 */
export async function revokeOtherSessions(
  userId: number,
  currentSessionId: string,
  reason?: string
): Promise<{ revokedCount: number }> {
  const result = await prisma.userSession.updateMany({
    where: {
      userId,
      id: { not: currentSessionId },
      isActive: true,
      revokedAt: null,
    },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokedReason: reason || 'Logout from other devices',
    },
  });

  logger.info('Other sessions revoked', {
    userId,
    currentSessionId,
    revokedCount: result.count,
  });

  return { revokedCount: result.count };
}

// ============================================================================
// Session Listing
// ============================================================================

/**
 * List active sessions for a user
 */
export async function listUserSessions(userId: number): Promise<
  Array<{
    id: string;
    deviceName: string | null;
    ipAddress: string;
    lastActivityAt: Date;
    createdAt: Date;
    expiresAt: Date;
    isCurrent: boolean;
  }>
> {
  const sessions = await prisma.userSession.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() },
      revokedAt: null,
    },
    orderBy: { lastActivityAt: 'desc' },
  });

  return sessions.map((s) => ({
    id: s.id,
    deviceName: s.deviceName,
    ipAddress: s.ipAddress,
    lastActivityAt: s.lastActivityAt,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isCurrent: false, // Would need current session ID to determine
  }));
}

// ============================================================================
// Session Cleanup
// ============================================================================

/**
 * Clean up expired sessions (run periodically via worker)
 */
export async function cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
  const now = new Date();

  // Delete sessions that are expired and inactive
  const result = await prisma.userSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } }, // Absolute timeout passed
        {
          AND: [
            { isActive: false },
            { revokedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }, // Revoked >30 days ago
          ],
        },
      ],
    },
  });

  logger.info('Expired sessions cleaned up', { deletedCount: result.count });
  return { deletedCount: result.count };
}

/**
 * Auto-revoke idle sessions (run periodically via worker)
 */
export async function autoRevokeIdleSessions(): Promise<{ revokedCount: number }> {
  const sessions = await prisma.userSession.findMany({
    where: {
      isActive: true,
      revokedAt: null,
    },
  });

  let revokedCount = 0;

  for (const session of sessions) {
    const now = new Date();
    const idleTimeMs = now.getTime() - session.lastActivityAt.getTime();
    const idleTimeoutMs = session.idleTimeoutMinutes * 60 * 1000;

    if (idleTimeMs > idleTimeoutMs) {
      await revokeSession(session.id, 'Idle timeout exceeded');
      revokedCount++;
    }
  }

  logger.info('Idle sessions auto-revoked', { revokedCount });
  return { revokedCount };
}

// ============================================================================
// Refresh Token Handling
// ============================================================================

/**
 * Rotate session with refresh token
 */
export async function refreshSession(refreshToken: string): Promise<{
  success: boolean;
  accessToken?: string;
  newRefreshToken?: string;
  expiresAt?: Date;
  error?: string;
}> {
  const tokenHash = hashToken(refreshToken);

  const session = await prisma.userSession.findUnique({
    where: { refreshToken: tokenHash },
    include: { user: { select: { id: true, email: true, role: true } } },
  });

  if (!session) {
    return { success: false, error: 'Invalid refresh token' };
  }

  // Check if revoked or expired
  if (session.revokedAt || !session.isActive || new Date() > session.expiresAt) {
    return { success: false, error: 'Session is no longer valid' };
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken(session.user);
  const newRefreshToken = generateRefreshToken(session.user);

  // Update session with new token hashes
  await prisma.userSession.update({
    where: { id: session.id },
    data: {
      sessionToken: hashToken(newAccessToken),
      refreshToken: hashToken(newRefreshToken),
      lastActivityAt: new Date(),
    },
  });

  logger.info('Session refreshed', { sessionId: session.id, userId: session.userId });

  return {
    success: true,
    accessToken: newAccessToken,
    newRefreshToken,
    expiresAt: session.expiresAt,
  };
}
