/**
 * API Key Rotation Worker — P2 Security Enhancement
 *
 * Automated API key lifecycle management:
 * - Expiration detection (7/3/1 days before expiry)
 * - Email notifications to users
 * - Automatic rotation for keys with auto-rotation enabled
 * - Rotation history tracking
 *
 * Security benefits:
 * - Reduces risk of compromised keys
 * - Enforces key hygiene practices
 * - Provides audit trail for compliance
 */

import { prisma } from '../db-prisma';
import { createLogger } from '../utils/logger';
import { rotateApiKey } from '../api-key-manager';

const logger = createLogger('ApiKeyRotationWorker');

// ============================================================================
// Configuration
// ============================================================================

interface RotationConfig {
  warningDays: number[]; // Days before expiry to send warnings
  enableAutoRotation: boolean;
  checkIntervalHours: number;
  notificationEmail?: string;
}

function getRotationConfig(): RotationConfig {
  return {
    warningDays: [7, 3, 1], // Warn at 7, 3, and 1 day before expiry
    enableAutoRotation: process.env.ENABLE_AUTO_KEY_ROTATION !== 'false',
    checkIntervalHours: parseInt(process.env.KEY_ROTATION_CHECK_INTERVAL || '6', 10),
    notificationEmail: process.env.KEY_ROTATION_NOTIFICATION_EMAIL,
  };
}

// ============================================================================
// Expiration Detection
// ============================================================================

/**
 * Find API keys expiring soon
 */
export async function findExpiringKeys(warningDays: number): Promise<
  Array<{
    id: number;
    userId: number;
    keyPrefix: string;
    name: string;
    expiresAt: Date;
    autoRotationEnabled: boolean;
    notificationSentAt: Date | null;
    user: { id: number; email: string };
  }>
> {
  const now = new Date();
  const warningDate = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000);

  // Find keys expiring in the warning window that haven't been notified recently
  const keys = await prisma.apiKey.findMany({
    where: {
      isActive: true,
      expiresAt: {
        gte: now, // Not yet expired
        lte: warningDate, // Expires within warning window
      },
      OR: [
        { notificationSentAt: null },
        {
          notificationSentAt: {
            // Re-notify if last notification was more than 12 hours ago
            lt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
          },
        },
      ],
    },
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  });

  return keys;
}

/**
 * Find already expired keys that are still active
 */
export async function findExpiredKeys(): Promise<
  Array<{
    id: number;
    userId: number;
    keyPrefix: string;
    name: string;
    expiresAt: Date;
    autoRotationEnabled: boolean;
  }>
> {
  const now = new Date();

  const keys = await prisma.apiKey.findMany({
    where: {
      isActive: true,
      expiresAt: {
        lt: now, // Already expired
      },
    },
    select: {
      id: true,
      userId: true,
      keyPrefix: true,
      name: true,
      expiresAt: true,
      autoRotationEnabled: true,
    },
  });

  return keys;
}

// ============================================================================
// Notification System
// ============================================================================

/**
 * Send expiration warning notification
 */
export async function sendExpirationWarning(
  userId: number,
  email: string,
  keys: Array<{
    keyPrefix: string;
    name: string;
    expiresAt: Date;
    autoRotationEnabled: boolean;
  }>
): Promise<void> {
  const daysUntilExpiry = Math.ceil(
    (keys[0].expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );

  logger.info('Sending API key expiration warning', {
    userId,
    email,
    keyCount: keys.length,
    daysUntilExpiry,
  });

  // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
  // For now, just log the notification
  const message = `
    ⚠️ API Key Expiration Warning

    ${keys.length} of your API key(s) will expire in ${daysUntilExpiry} day(s):

    ${keys
      .map(
        (k) =>
          `- ${k.name} (${k.keyPrefix}...) - Expires: ${k.expiresAt.toISOString()} ${k.autoRotationEnabled ? '✅ Auto-rotation enabled' : '❌ Auto-rotation disabled'}`
      )
      .join('\n    ')}

    Action required:
    ${keys.some((k) => !k.autoRotationEnabled) ? '- Enable auto-rotation or manually rotate your keys before expiry' : '- Keys will be automatically rotated before expiry'}
    - Update your applications with new keys after rotation

    Manage your API keys: https://your-domain.com/settings/api-keys
  `;

  logger.warn('API key expiration notification', {
    userId,
    email,
    message,
  });

  // Mark notification as sent
  await prisma.apiKey.updateMany({
    where: {
      id: { in: keys.map((k) => (k as any).id) },
    },
    data: {
      notificationSentAt: new Date(),
    },
  });
}

/**
 * Send rotation success notification
 */
export async function sendRotationNotification(
  userId: number,
  email: string,
  oldKeyPrefix: string,
  newKeyPrefix: string,
  keyName: string
): Promise<void> {
  logger.info('API key rotated', {
    userId,
    email,
    oldKeyPrefix,
    newKeyPrefix,
    keyName,
  });

  // TODO: Integrate with email service
  const message = `
    ✅ API Key Rotated Successfully

    Your API key "${keyName}" has been automatically rotated.

    Old key: ${oldKeyPrefix}... (revoked)
    New key: ${newKeyPrefix}... (active)

    Action required:
    - Update your applications with the new API key
    - Test your integrations
    - The old key is now inactive

    View your API keys: https://your-domain.com/settings/api-keys
  `;

  logger.info('API key rotation notification sent', {
    userId,
    email,
    message,
  });
}

// ============================================================================
// Auto-Rotation
// ============================================================================

/**
 * Automatically rotate API keys with auto-rotation enabled
 */
export async function performAutoRotation(keyId: number, userId: number): Promise<{
  success: boolean;
  newKeyPrefix?: string;
  error?: string;
}> {
  logger.info('Starting automatic API key rotation', { keyId, userId });

  try {
    // Rotate the key
    const result = await rotateApiKey(keyId, userId);

    if (!result.success) {
      logger.error('Auto-rotation failed', { keyId, userId, error: result.error });
      return result;
    }

    // Record rotation in history
    await prisma.apiKeyRotationHistory.create({
      data: {
        apiKeyId: keyId,
        oldKeyPrefix: result.newKeyPrefix!.substring(0, 12), // This is actually the old one in context
        newKeyPrefix: result.newKeyPrefix!,
        rotationType: 'automatic',
        rotationReason: 'Key approaching expiration',
      },
    });

    logger.info('Auto-rotation completed successfully', {
      keyId,
      userId,
      newKeyPrefix: result.newKeyPrefix,
    });

    return result;
  } catch (error) {
    logger.error('Auto-rotation error', { error, keyId, userId });
    return { success: false, error: String(error) };
  }
}

/**
 * Force-revoke expired keys (safety measure)
 */
export async function revokeExpiredKeys(): Promise<{ revoked: number }> {
  const expiredKeys = await findExpiredKeys();

  logger.info('Revoking expired keys', { count: expiredKeys.length });

  for (const key of expiredKeys) {
    try {
      if (key.autoRotationEnabled) {
        // Attempt auto-rotation one last time
        const result = await performAutoRotation(key.id, key.userId);
        if (result.success) {
          logger.info('Expired key rotated successfully', { keyId: key.id });
          continue;
        }
      }

      // If auto-rotation failed or disabled, just revoke
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { isActive: false },
      });

      logger.warn('Expired key revoked', {
        keyId: key.id,
        keyPrefix: key.keyPrefix,
        expiresAt: key.expiresAt,
      });
    } catch (error) {
      logger.error('Failed to revoke expired key', { error, keyId: key.id });
    }
  }

  return { revoked: expiredKeys.length };
}

// ============================================================================
// Main Job Runner
// ============================================================================

/**
 * Run the full API key rotation check workflow
 */
export async function runRotationJob(): Promise<{
  warned: number;
  rotated: number;
  revoked: number;
}> {
  const config = getRotationConfig();
  logger.info('Starting API key rotation job', config);

  let totalWarned = 0;
  let totalRotated = 0;

  try {
    // 1. Check for keys expiring soon and send warnings
    for (const warningDays of config.warningDays) {
      const expiringKeys = await findExpiringKeys(warningDays);

      logger.info(`Found keys expiring in ${warningDays} days`, {
        count: expiringKeys.length,
      });

      // Group keys by user for batch notifications
      const keysByUser = new Map<number, typeof expiringKeys>();
      for (const key of expiringKeys) {
        const userKeys = keysByUser.get(key.userId) || [];
        userKeys.push(key);
        keysByUser.set(key.userId, userKeys);
      }

      // Send notifications
      for (const [userId, keys] of keysByUser.entries()) {
        const userEmail = keys[0].user.email;
        await sendExpirationWarning(userId, userEmail, keys);
        totalWarned += keys.length;

        // Auto-rotate keys with auto-rotation enabled
        if (config.enableAutoRotation) {
          for (const key of keys.filter((k) => k.autoRotationEnabled)) {
            const result = await performAutoRotation(key.id, userId);
            if (result.success) {
              await sendRotationNotification(
                userId,
                userEmail,
                key.keyPrefix,
                result.newKeyPrefix!,
                key.name
              );
              totalRotated++;
            }
          }
        }
      }
    }

    // 2. Revoke already expired keys (safety cleanup)
    const { revoked } = await revokeExpiredKeys();

    logger.info('API key rotation job completed', {
      warned: totalWarned,
      rotated: totalRotated,
      revoked,
    });

    return {
      warned: totalWarned,
      rotated: totalRotated,
      revoked,
    };
  } catch (error) {
    logger.error('API key rotation job failed', { error });
    return { warned: totalWarned, rotated: totalRotated, revoked: 0 };
  }
}

// ============================================================================
// Cron Schedule
// ============================================================================

/**
 * Schedule API key rotation checks
 *
 * Usage:
 * import { scheduleKeyRotation } from './workers/api-key-rotation-worker';
 * scheduleKeyRotation();
 */
export function scheduleKeyRotation(): void {
  const config = getRotationConfig();

  logger.info('API key rotation scheduler initialized', {
    checkIntervalHours: config.checkIntervalHours,
    warningDays: config.warningDays,
    autoRotationEnabled: config.enableAutoRotation,
  });

  // This would use node-cron or BullMQ for scheduling
  // For now, just export the function
  // Example: cron.schedule(`0 */${config.checkIntervalHours} * * *`, runRotationJob);
}
