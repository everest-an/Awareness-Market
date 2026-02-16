/**
 * Session Cleanup Worker — P2 Security Enhancement
 *
 * Periodic cleanup of expired and idle sessions:
 * - Delete expired sessions (past absolute timeout)
 * - Auto-revoke idle sessions (past idle timeout)
 * - Cleanup old revoked sessions (>30 days)
 *
 * Security benefits:
 * - Prevents session table bloat
 * - Automatic security enforcement
 * - Reduces attack surface (fewer active sessions)
 */

import { createLogger } from '../utils/logger';
import {
  cleanupExpiredSessions,
  autoRevokeIdleSessions,
} from '../security/session-manager';

const logger = createLogger('SessionCleanupWorker');

// ============================================================================
// Configuration
// ============================================================================

interface CleanupConfig {
  cleanupIntervalMinutes: number;
  autoRevokeIdleEnabled: boolean;
}

function getCleanupConfig(): CleanupConfig {
  return {
    cleanupIntervalMinutes: parseInt(
      process.env.SESSION_CLEANUP_INTERVAL_MINUTES || '60',
      10
    ),
    autoRevokeIdleEnabled: process.env.SESSION_AUTO_REVOKE_IDLE !== 'false',
  };
}

// ============================================================================
// Cleanup Job
// ============================================================================

/**
 * Run session cleanup job
 */
export async function runSessionCleanup(): Promise<{
  deletedCount: number;
  revokedCount: number;
}> {
  const config = getCleanupConfig();
  logger.info('Starting session cleanup job', config);

  try {
    // 1. Auto-revoke idle sessions
    let revokedCount = 0;
    if (config.autoRevokeIdleEnabled) {
      const result = await autoRevokeIdleSessions();
      revokedCount = result.revokedCount;
    }

    // 2. Delete expired sessions
    const { deletedCount } = await cleanupExpiredSessions();

    logger.info('Session cleanup completed', {
      deletedCount,
      revokedCount,
    });

    return { deletedCount, revokedCount };
  } catch (error) {
    logger.error('Session cleanup failed', { error });
    return { deletedCount: 0, revokedCount: 0 };
  }
}

// ============================================================================
// Cron Schedule
// ============================================================================

/**
 * Schedule session cleanup
 *
 * Usage:
 * import { scheduleSessionCleanup } from './workers/session-cleanup-worker';
 * scheduleSessionCleanup();
 */
export function scheduleSessionCleanup(): void {
  const config = getCleanupConfig();

  logger.info('Session cleanup scheduler initialized', {
    cleanupIntervalMinutes: config.cleanupIntervalMinutes,
    autoRevokeIdleEnabled: config.autoRevokeIdleEnabled,
  });

  // This would use node-cron or BullMQ for scheduling
  // Example: setInterval(runSessionCleanup, config.cleanupIntervalMinutes * 60 * 1000);
}
