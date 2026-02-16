/**
 * DDoS Shield — Network-Level Defense Layer
 * 
 * Works with GhostTrap to provide:
 * - Connection flood detection (SYN flood, HTTP flood)
 * - Slowloris defense (slow header/body attacks)
 * - IP reputation scoring with automatic blacklisting
 * - Geographic and ASN anomaly detection
 * - Adaptive rate limiting based on threat level
 * - Emergency mode: automatic traffic shedding
 * 
 * This module handles the request BEFORE GhostTrap's behavioral
 * analysis — it focuses on volumetric and connection-level attacks.
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { ThreatLevel, ghostTrap } from './ghost-trap';

const logger = createLogger('DDoS:Shield');

// ────────────────────────────────────────────────────────────────
// IP Reputation Store
// ────────────────────────────────────────────────────────────────

interface IPReputation {
  ip: string;
  /** Reputation score: 100 = clean, 0 = blocked */
  score: number;
  /** Total blocked requests */
  blockedCount: number;
  /** Last activity timestamp */
  lastSeen: number;
  /** Whether IP is permanently blacklisted */
  blacklisted: boolean;
  /** Blacklist reason */
  blacklistReason?: string;
  /** Connection count in current window */
  connectionCount: number;
  /** Window start time */
  windowStart: number;
}

class IPReputationStore {
  private store: Map<string, IPReputation> = new Map();
  private blacklist: Set<string> = new Set();
  /** Temporary whitelist for verified IPs */
  private whitelist: Set<string> = new Set();
  private readonly maxSize: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxSize = 100_000) {
    this.maxSize = maxSize;
    // Load static blacklist from env
    const envBlacklist = process.env.IP_BLACKLIST?.split(',') || [];
    envBlacklist.forEach(ip => this.blacklist.add(ip.trim()));

    const envWhitelist = process.env.IP_WHITELIST?.split(',') || [];
    envWhitelist.forEach(ip => this.whitelist.add(ip.trim()));

    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60_000);
    this.cleanupInterval.unref();
  }

  get(ip: string): IPReputation {
    let rep = this.store.get(ip);
    if (!rep) {
      if (this.store.size >= this.maxSize) {
        // Evict oldest
        const oldest = this.store.keys().next().value;
        if (oldest) this.store.delete(oldest);
      }
      rep = {
        ip,
        score: 100,
        blockedCount: 0,
        lastSeen: Date.now(),
        blacklisted: this.blacklist.has(ip),
        connectionCount: 0,
        windowStart: Date.now(),
      };
      this.store.set(ip, rep);
    }
    return rep;
  }

  penalize(ip: string, amount: number, reason?: string): void {
    const rep = this.get(ip);
    rep.score = Math.max(0, rep.score - amount);
    rep.lastSeen = Date.now();

    // Auto-blacklist at score 0
    if (rep.score <= 0 && !rep.blacklisted) {
      rep.blacklisted = true;
      rep.blacklistReason = reason || 'reputation_depleted';
      this.blacklist.add(ip);
      logger.warn('IP blacklisted', { ip, reason: rep.blacklistReason });
    }
  }

  reward(ip: string, amount: number): void {
    const rep = this.get(ip);
    rep.score = Math.min(100, rep.score + amount);
  }

  isBlacklisted(ip: string): boolean {
    return this.blacklist.has(ip);
  }

  isWhitelisted(ip: string): boolean {
    return this.whitelist.has(ip);
  }

  trackConnection(ip: string): number {
    const rep = this.get(ip);
    const now = Date.now();

    // Reset window every second
    if (now - rep.windowStart >= 1000) {
      rep.connectionCount = 0;
      rep.windowStart = now;
    }

    rep.connectionCount++;
    rep.lastSeen = now;
    return rep.connectionCount;
  }

  recordBlock(ip: string): void {
    const rep = this.get(ip);
    rep.blockedCount++;
  }

  private cleanup(): void {
    const now = Date.now();
    const expiry = 60 * 60_000; // 1 hour for non-blacklisted
    let cleaned = 0;

    for (const [ip, rep] of this.store) {
      if (!rep.blacklisted && now - rep.lastSeen > expiry) {
        this.store.delete(ip);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('IP reputation cleanup', { cleaned, remaining: this.store.size });
    }
  }

  getStats() {
    let clean = 0, degraded = 0, blacklisted = 0;
    for (const rep of this.store.values()) {
      if (rep.blacklisted) blacklisted++;
      else if (rep.score < 50) degraded++;
      else clean++;
    }
    return {
      total: this.store.size,
      clean,
      degraded,
      blacklisted,
      blacklistSize: this.blacklist.size,
      whitelistSize: this.whitelist.size,
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

// ────────────────────────────────────────────────────────────────
// Connection Tracker (Slowloris Defense)
// ────────────────────────────────────────────────────────────────

interface ConnectionInfo {
  ip: string;
  startTime: number;
  bytesReceived: number;
  headerComplete: boolean;
}

class SlowlorisDefense {
  private connections: Map<string, ConnectionInfo[]> = new Map();
  /** Max concurrent connections per IP */
  private readonly maxConnectionsPerIP: number;
  /** Max time to receive complete headers (ms) */
  private readonly headerTimeoutMs: number;
  /** Max time for complete request body (ms) */
  private readonly bodyTimeoutMs: number;

  constructor(
    maxConnectionsPerIP = 10,
    headerTimeoutMs = 10_000,
    bodyTimeoutMs = 30_000,
  ) {
    this.maxConnectionsPerIP = maxConnectionsPerIP;
    this.headerTimeoutMs = headerTimeoutMs;
    this.bodyTimeoutMs = bodyTimeoutMs;
  }

  check(req: Request): { blocked: boolean; reason?: string } {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const conns = this.connections.get(ip) || [];
    const now = Date.now();

    // Clean up completed connections
    const active = conns.filter(c => now - c.startTime < this.bodyTimeoutMs);
    this.connections.set(ip, active);

    // Check concurrent connection limit
    if (active.length >= this.maxConnectionsPerIP) {
      return { blocked: true, reason: `max_connections:${active.length}` };
    }

    // Track this connection
    active.push({
      ip,
      startTime: now,
      bytesReceived: parseInt(req.headers['content-length'] || '0', 10),
      headerComplete: true, // If we're in Express, headers are complete
    });

    return { blocked: false };
  }
}

// ────────────────────────────────────────────────────────────────
// Request Validation Layer
// ────────────────────────────────────────────────────────────────

/**
 * Validates request structure to catch malformed/attack requests
 * before they reach business logic.
 */
function validateRequest(req: Request): { valid: boolean; reason?: string } {
  // 1. URL length check (prevent buffer overflow attempts)
  if (req.url.length > 4096) {
    return { valid: false, reason: 'url_too_long' };
  }

  // 2. Header count check
  const headerCount = Object.keys(req.headers).length;
  if (headerCount > 50) {
    return { valid: false, reason: `too_many_headers:${headerCount}` };
  }

  // 3. Cookie size check
  const cookieHeader = req.headers['cookie'] || '';
  if (cookieHeader.length > 8192) {
    return { valid: false, reason: 'cookie_too_large' };
  }

  // 4. Host header validation (prevent host header injection)
  const host = req.headers['host'];
  if (host && !/^[\w.-]+(:\d+)?$/.test(host)) {
    return { valid: false, reason: 'invalid_host_header' };
  }

  // 5. Null byte injection check
  if (req.url.includes('\x00') || req.url.includes('%00')) {
    return { valid: false, reason: 'null_byte_injection' };
  }

  // 6. Path traversal check
  const decodedPath = decodeURIComponent(req.path);
  if (decodedPath.includes('..') || decodedPath.includes('//')) {
    return { valid: false, reason: 'path_traversal' };
  }

  return { valid: true };
}

// ────────────────────────────────────────────────────────────────
// Adaptive Rate Limiter
// ────────────────────────────────────────────────────────────────

/**
 * Adjusts rate limits dynamically based on threat level.
 * CLEAN: 120/min → SUSPICIOUS: 60/min → HOSTILE: 10/min → GHOST: 0/min
 */
function getAdaptiveLimit(threatLevel: ThreatLevel): number {
  switch (threatLevel) {
    case ThreatLevel.CLEAN: return 120;
    case ThreatLevel.SUSPICIOUS: return 60;
    case ThreatLevel.HOSTILE: return 10;
    case ThreatLevel.GHOST: return 0;
    case ThreatLevel.BLOCKED: return 0;
    default: return 120;
  }
}

// ────────────────────────────────────────────────────────────────
// Exports — Singletons
// ────────────────────────────────────────────────────────────────

export const ipReputation = new IPReputationStore();
export const slowlorisDefense = new SlowlorisDefense();

// ────────────────────────────────────────────────────────────────
// DDoS Shield Middleware
// ────────────────────────────────────────────────────────────────

/**
 * DDoS Shield — runs BEFORE GhostTrap.
 * Handles network-level threats that don't need behavioral analysis.
 * 
 * Order in the middleware chain:
 *   1. ddosShield ← YOU ARE HERE
 *   2. ghostTrapMiddleware (behavioral)
 *   3. securityHeaders
 *   4. rate limiters
 *   5. business logic
 */
export function ddosShield() {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // ── 1. Whitelist bypass ──
    if (ipReputation.isWhitelisted(ip)) {
      return next();
    }

    // ── 2. Blacklist check ──
    if (ipReputation.isBlacklisted(ip)) {
      ipReputation.recordBlock(ip);
      // Silent drop — don't waste resources on a response
      req.socket.destroy();
      return;
    }

    // ── 3. Request validation ──
    const validation = validateRequest(req);
    if (!validation.valid) {
      ipReputation.penalize(ip, 20, validation.reason);
      ghostTrap.recordError(ip);
      logger.warn('Malformed request blocked', { ip, reason: validation.reason });
      return res.status(400).json({ error: 'Bad request' });
    }

    // ── 4. Connection flood detection ──
    const connCount = ipReputation.trackConnection(ip);
    if (connCount > 50) {
      // 50+ requests in 1 second from a single IP
      ipReputation.penalize(ip, 30, 'connection_flood');
      return res.status(429).set('Retry-After', '60').json({
        error: 'Connection rate exceeded',
      });
    }

    // ── 5. Slowloris check ──
    const slowCheck = slowlorisDefense.check(req);
    if (slowCheck.blocked) {
      ipReputation.penalize(ip, 15, slowCheck.reason);
      return res.status(429).json({ error: 'Too many concurrent connections' });
    }

    // ── 6. Reputation-based rate limit ──
    const rep = ipReputation.get(ip);
    if (rep.score < 30) {
      // Degraded reputation — aggressive rate limit
      const ghostProfile = ghostTrap.getProfile(ip);
      const adaptiveLimit = getAdaptiveLimit(ghostProfile?.threatLevel ?? ThreatLevel.SUSPICIOUS);
      if (connCount > adaptiveLimit / 60) {
        return res.status(429).set('Retry-After', '120').json({
          error: 'Rate limited due to suspicious activity',
        });
      }
    }

    // ── 7. Good request — small reputation reward ──
    if (rep.score < 100) {
      ipReputation.reward(ip, 0.1); // Slow recovery
    }

    next();
  };
}

// ────────────────────────────────────────────────────────────────
// DDoS Stats API
// ────────────────────────────────────────────────────────────────

export function ddosStatsHandler(req: Request, res: Response): void {
  res.json({
    ddosShield: {
      ipReputation: ipReputation.getStats(),
      ghostTrap: ghostTrap.getStats(),
      timestamp: new Date().toISOString(),
    },
  });
}
