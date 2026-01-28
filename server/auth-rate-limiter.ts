/**
 * Authentication Rate Limiter
 * 
 * Protects against brute force attacks by limiting login attempts.
 * Supports both in-memory storage (development) and Redis (production).
 * 
 * ## Features
 * - Per-IP rate limiting
 * - Per-email rate limiting
 * - Exponential backoff for repeated failures
 * - Redis support for distributed systems
 * - Automatic cleanup of old entries
 * 
 * ## Configuration
 * - MAX_ATTEMPTS: Maximum login attempts before lockout (default: 5)
 * - LOCKOUT_DURATION_MS: Initial lockout duration (default: 15 minutes)
 * - WINDOW_MS: Time window for counting attempts (default: 15 minutes)
 * 
 * ## Redis Setup
 * Set REDIS_URL environment variable to enable Redis storage:
 * REDIS_URL=redis://localhost:6379
 */

import { createClient, RedisClientType } from 'redis';
import { getErrorMessage } from './utils/error-handling';
import { createLogger } from './utils/logger';

const logger = createLogger('Auth:RateLimit');

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  lockoutUntil: number | null;
  lockoutCount: number;
}

// Configuration
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const REDIS_KEY_PREFIX = 'ratelimit:';
const REDIS_TTL_SECONDS = 24 * 60 * 60; // 24 hours

// Storage backends
let redisClient: RedisClientType | null = null;
let redisConnected = false;

// In-memory fallback storage
const ipLimits = new Map<string, RateLimitEntry>();
const emailLimits = new Map<string, RateLimitEntry>();

/**
 * Initialize Redis connection if REDIS_URL is set
 */
async function initRedis(): Promise<boolean> {
  if (redisClient) return redisConnected;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.info( No REDIS_URL set, using in-memory storage');
    return false;
  }

  try {
    redisClient = createClient({ url: redisUrl });
    
    redisClient.on('error', (err) => {
      logger.error( Redis error:', err.message);
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info( Connected to Redis');
      redisConnected = true;
    });

    redisClient.on('disconnect', () => {
      logger.info( Disconnected from Redis');
      redisConnected = false;
    });

    await redisClient.connect();
    redisConnected = true;
    logger.info( Redis initialized successfully');
    return true;
  } catch (error: unknown) {
    logger.error( Failed to connect to Redis:', getErrorMessage(error));
    logger.info( Falling back to in-memory storage');
    redisClient = null;
    redisConnected = false;
    return false;
  }
}

// Initialize Redis on module load
initRedis().catch(() => {});

/**
 * Get entry from Redis
 */
async function getRedisEntry(key: string): Promise<RateLimitEntry | null> {
  if (!redisClient || !redisConnected) return null;
  
  try {
    const data = await redisClient.get(REDIS_KEY_PREFIX + key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    logger.error( Redis get error:', error);
    return null;
  }
}

/**
 * Set entry in Redis
 */
async function setRedisEntry(key: string, entry: RateLimitEntry): Promise<boolean> {
  if (!redisClient || !redisConnected) return false;
  
  try {
    await redisClient.setEx(
      REDIS_KEY_PREFIX + key,
      REDIS_TTL_SECONDS,
      JSON.stringify(entry)
    );
    return true;
  } catch (error) {
    logger.error( Redis set error:', error);
    return false;
  }
}

/**
 * Delete entry from Redis
 */
async function deleteRedisEntry(key: string): Promise<boolean> {
  if (!redisClient || !redisConnected) return false;
  
  try {
    await redisClient.del(REDIS_KEY_PREFIX + key);
    return true;
  } catch (error) {
    logger.error( Redis delete error:', error);
    return false;
  }
}

// Cleanup old in-memory entries periodically
setInterval(() => {
  const now = Date.now();
  const cutoff = now - WINDOW_MS * 2;

  for (const [key, entry] of ipLimits.entries()) {
    if (entry.lastAttempt < cutoff && (!entry.lockoutUntil || entry.lockoutUntil < now)) {
      ipLimits.delete(key);
    }
  }

  for (const [key, entry] of emailLimits.entries()) {
    if (entry.lastAttempt < cutoff && (!entry.lockoutUntil || entry.lockoutUntil < now)) {
      emailLimits.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Get or create rate limit entry (supports both Redis and in-memory)
 */
async function getEntry(type: 'ip' | 'email', key: string): Promise<RateLimitEntry> {
  const now = Date.now();
  const fullKey = `${type}:${key}`;
  
  // Try Redis first
  let entry = await getRedisEntry(fullKey);
  
  // Fall back to in-memory
  if (!entry) {
    const map = type === 'ip' ? ipLimits : emailLimits;
    entry = map.get(key) || null;
  }

  if (!entry) {
    entry = {
      attempts: 0,
      firstAttempt: now,
      lastAttempt: now,
      lockoutUntil: null,
      lockoutCount: 0,
    };
  }

  // Reset if window has passed and not locked out
  if (now - entry.firstAttempt > WINDOW_MS && (!entry.lockoutUntil || entry.lockoutUntil < now)) {
    entry.attempts = 0;
    entry.firstAttempt = now;
    entry.lockoutUntil = null;
  }

  return entry;
}

/**
 * Save rate limit entry (supports both Redis and in-memory)
 */
async function saveEntry(type: 'ip' | 'email', key: string, entry: RateLimitEntry): Promise<void> {
  const fullKey = `${type}:${key}`;
  
  // Try Redis first
  await setRedisEntry(fullKey, entry);
  
  // Always save to in-memory as fallback
  const map = type === 'ip' ? ipLimits : emailLimits;
  map.set(key, entry);
}

/**
 * Calculate lockout duration with exponential backoff
 */
function calculateLockoutDuration(lockoutCount: number): number {
  const duration = LOCKOUT_DURATION_MS * Math.pow(2, lockoutCount);
  return Math.min(duration, MAX_LOCKOUT_DURATION_MS);
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  } else if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    const hours = Math.ceil(seconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
}

/**
 * Check if login is allowed for given IP and email
 */
export async function checkLoginAllowed(
  ip: string,
  email: string
): Promise<{ allowed: true } | { allowed: false; retryAfter: number; reason: string }> {
  const now = Date.now();

  // Check IP limit
  const ipEntry = await getEntry('ip', ip);
  if (ipEntry.lockoutUntil && ipEntry.lockoutUntil > now) {
    const retryAfter = Math.ceil((ipEntry.lockoutUntil - now) / 1000);
    return {
      allowed: false,
      retryAfter,
      reason: `Too many login attempts from this IP. Try again in ${formatDuration(retryAfter)}.`,
    };
  }

  // Check email limit
  const emailEntry = await getEntry('email', email.toLowerCase());
  if (emailEntry.lockoutUntil && emailEntry.lockoutUntil > now) {
    const retryAfter = Math.ceil((emailEntry.lockoutUntil - now) / 1000);
    return {
      allowed: false,
      retryAfter,
      reason: `Too many login attempts for this account. Try again in ${formatDuration(retryAfter)}.`,
    };
  }

  return { allowed: true };
}

/**
 * Record a failed login attempt
 */
export async function recordFailedAttempt(ip: string, email: string): Promise<void> {
  const now = Date.now();

  // Update IP entry
  const ipEntry = await getEntry('ip', ip);
  ipEntry.attempts++;
  ipEntry.lastAttempt = now;

  if (ipEntry.attempts >= MAX_ATTEMPTS) {
    ipEntry.lockoutCount++;
    ipEntry.lockoutUntil = now + calculateLockoutDuration(ipEntry.lockoutCount - 1);
    logger.warn( IP ${ip} locked out until ${new Date(ipEntry.lockoutUntil).toISOString()}`);
  }
  
  await saveEntry('ip', ip, ipEntry);

  // Update email entry
  const emailEntry = await getEntry('email', email.toLowerCase());
  emailEntry.attempts++;
  emailEntry.lastAttempt = now;

  if (emailEntry.attempts >= MAX_ATTEMPTS) {
    emailEntry.lockoutCount++;
    emailEntry.lockoutUntil = now + calculateLockoutDuration(emailEntry.lockoutCount - 1);
    logger.warn( Email ${email} locked out until ${new Date(emailEntry.lockoutUntil).toISOString()}`);
  }
  
  await saveEntry('email', email.toLowerCase(), emailEntry);
}

/**
 * Record a successful login (resets attempt counter)
 */
export async function recordSuccessfulLogin(ip: string, email: string): Promise<void> {
  // Reset IP entry
  const ipEntry = await getEntry('ip', ip);
  ipEntry.attempts = 0;
  ipEntry.lockoutUntil = null;
  await saveEntry('ip', ip, ipEntry);

  // Reset email entry
  const emailEntry = await getEntry('email', email.toLowerCase());
  emailEntry.attempts = 0;
  emailEntry.lockoutUntil = null;
  await saveEntry('email', email.toLowerCase(), emailEntry);
}

/**
 * Get remaining attempts before lockout
 */
export async function getRemainingAttempts(ip: string, email: string): Promise<number> {
  const ipEntry = await getEntry('ip', ip);
  const emailEntry = await getEntry('email', email.toLowerCase());

  const ipRemaining = MAX_ATTEMPTS - ipEntry.attempts;
  const emailRemaining = MAX_ATTEMPTS - emailEntry.attempts;

  return Math.min(Math.max(0, ipRemaining), Math.max(0, emailRemaining));
}

/**
 * Get rate limit status for debugging/admin
 */
export function getRateLimitStatus(): {
  storage: 'redis' | 'memory';
  redisConnected: boolean;
  ipLimits: number;
  emailLimits: number;
} {
  return {
    storage: redisConnected ? 'redis' : 'memory',
    redisConnected,
    ipLimits: ipLimits.size,
    emailLimits: emailLimits.size,
  };
}

/**
 * Clear rate limit for specific IP (admin function)
 */
export async function clearIpLimit(ip: string): Promise<boolean> {
  await deleteRedisEntry(`ip:${ip}`);
  return ipLimits.delete(ip);
}

/**
 * Clear rate limit for specific email (admin function)
 */
export async function clearEmailLimit(email: string): Promise<boolean> {
  await deleteRedisEntry(`email:${email.toLowerCase()}`);
  return emailLimits.delete(email.toLowerCase());
}
