/**
 * GhostTrap — Behavioral Threat Detection Engine
 * 
 * Multi-layer defense system that identifies and isolates:
 * - DDoS attacks (volumetric, slowloris, application-layer)
 * - Automated malicious scripts (bots, scanners, scrapers)
 * - Credential stuffing & brute force
 * - API abuse patterns
 * 
 * Architecture:
 * ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 * │  Fingerprint  │→│   Anomaly    │→│   Decision   │
 * │   Collector   │  │   Scorer     │  │   Engine     │
 * └──────────────┘  └──────────────┘  └──────────────┘
 *        │                 │                 │
 *        ▼                 ▼                 ▼
 * ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 * │  IP Reputa-  │  │  Honeypot    │  │  Circuit     │
 * │  tion Store  │  │  Router      │  │  Breaker     │
 * └──────────────┘  └──────────────┘  └──────────────┘
 * 
 * Threat Levels:
 *   0 = CLEAN      — normal traffic
 *   1 = SUSPICIOUS — minor anomalies, increased monitoring
 *   2 = HOSTILE    — clear attack pattern, rate limited + challenged
 *   3 = GHOST      — confirmed malicious, routed to honeypot sandbox
 *   4 = BLOCKED    — emergency block, connection dropped
 */

import { Request, Response, NextFunction } from 'express';
import { randomBytes, createHash } from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('GhostTrap');

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export enum ThreatLevel {
  CLEAN = 0,
  SUSPICIOUS = 1,
  HOSTILE = 2,
  GHOST = 3,
  BLOCKED = 4,
}

interface RequestFingerprint {
  ip: string;
  userAgent: string;
  acceptLang: string;
  acceptEnc: string;
  connection: string;
  /** Hash of all headers sorted — unique per client/tool */
  headerHash: string;
  /** TLS fingerprint hint from cipher if available */
  tlsVersion?: string;
}

interface IPProfile {
  ip: string;
  fingerprints: Set<string>;
  /** Sliding window of request timestamps (ms) */
  timestamps: number[];
  /** Path access histogram */
  pathCounts: Map<string, number>;
  /** Error response count (4xx, 5xx) */
  errorCount: number;
  /** Sequential path scanning indicator */
  sequentialPaths: number;
  /** Current threat level */
  threatLevel: ThreatLevel;
  /** When threat level was last escalated */
  escalatedAt: number;
  /** Number of times escalated */
  escalations: number;
  /** Honeypot trap triggers */
  honeypotHits: number;
  /** Failed auth attempts */
  authFailures: number;
  /** First seen timestamp */
  firstSeen: number;
  /** PoW challenge nonce (if issued) */
  challengeNonce?: string;
  /** PoW challenge issued at */
  challengeIssuedAt?: number;
  /** Whether PoW was solved correctly */
  challengeSolved: boolean;
}

interface ThreatEvent {
  timestamp: number;
  ip: string;
  threatLevel: ThreatLevel;
  reason: string;
  fingerprint: string;
  path: string;
  method: string;
}

// ────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────

export interface GhostTrapConfig {
  /** Max requests per IP per window (default 120) */
  maxRequestsPerWindow: number;
  /** Window size in ms (default 60000 = 1 min) */
  windowMs: number;
  /** Burst threshold — rapid-fire requests within 1s (default 20) */
  burstThreshold: number;
  /** Max unique paths per minute before flagging as scanner (default 50) */
  scannerPathThreshold: number;
  /** Max auth failures before escalation (default 5) */
  authFailureThreshold: number;
  /** Threat level decay period in ms (default 15 min) */
  decayPeriodMs: number;
  /** Max profiles to store (LRU eviction) */
  maxProfiles: number;
  /** Enable honeypot routing (default true) */
  enableHoneypot: boolean;
  /** Enable PoW challenges (default true) */
  enablePoWChallenge: boolean;
  /** PoW difficulty (leading zeros required, default 4) */
  powDifficulty: number;
  /** Event log max size */
  maxEventLog: number;
  /** Trusted proxy IPs (bypass all checks) */
  trustedIPs: Set<string>;
  /** Known bad User-Agents (instant HOSTILE) */
  badUserAgents: RegExp[];
  /** Paths that should never be accessed by legitimate users (honeypot triggers) */
  honeypotPaths: string[];
}

const DEFAULT_CONFIG: GhostTrapConfig = {
  maxRequestsPerWindow: 120,
  windowMs: 60_000,
  burstThreshold: 20,
  scannerPathThreshold: 50,
  authFailureThreshold: 5,
  decayPeriodMs: 15 * 60_000,
  maxProfiles: 50_000,
  enableHoneypot: true,
  enablePoWChallenge: true,
  powDifficulty: 4,
  maxEventLog: 10_000,
  trustedIPs: new Set(
    (process.env.TRUSTED_IPS || '127.0.0.1,::1').split(',').map(s => s.trim())
  ),
  badUserAgents: [
    /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zgrab/i,
    /dirbuster/i, /gobuster/i, /wfuzz/i, /hydra/i,
    /^python-requests/i, /^Go-http-client/i, /^curl\//i,
    /httpclient/i, /scrapy/i, /phantom/i, /selenium/i,
    /^$/,  // empty UA
  ],
  honeypotPaths: [
    '/admin/login', '/wp-admin', '/wp-login.php', '/.env',
    '/phpmyadmin', '/phpMyAdmin', '/pma', '/adminer',
    '/config.php', '/debug', '/trace', '/actuator',
    '/solr', '/console', '/_debug', '/server-status',
    '/graphql', '/graphiql', '/.git/config', '/.git/HEAD',
    '/api/v1/admin/users', '/api/internal/debug',
    '/backup', '/dump.sql', '/db.sql', '/database.sql',
    // Crypto-specific honeypots (synced with CryptoAssetGuard)
    '/api/wallet/export', '/api/wallet/private-key',
    '/api/wallet/seed-phrase', '/api/wallet/mnemonic',
    '/api/admin/wallets', '/api/admin/treasury', '/api/admin/keys',
    '/api/internal/decrypt', '/api/debug/wallet',
    '/api/v1/keys/export', '/api/agent/private-key',
    '/api/custody/export', '/api/config/master-key',
    '/.well-known/wallet', '/wallet.json',
    '/keystore', '/keystore.json', '/private-keys',
  ],
};

// ────────────────────────────────────────────────────────────────
// GhostTrap Engine
// ────────────────────────────────────────────────────────────────

export class GhostTrapEngine {
  private profiles: Map<string, IPProfile> = new Map();
  private eventLog: ThreatEvent[] = [];
  private config: GhostTrapConfig;
  private cleanupTimer: NodeJS.Timeout;
  /** Global request counter for circuit breaker */
  private globalRequestCount = 0;
  private globalWindowStart = Date.now();
  /** Circuit breaker state */
  private circuitOpen = false;
  private circuitOpenedAt = 0;
  /** Global max requests/sec before circuit opens (default 5000) */
  private readonly globalMaxRps: number;

  constructor(config?: Partial<GhostTrapConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.globalMaxRps = parseInt(process.env.GHOSTTRAP_GLOBAL_MAX_RPS || '5000', 10);

    // Periodic cleanup of expired profiles
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60_000);
    this.cleanupTimer.unref();
  }

  // ──── Fingerprinting ──────────────────────────────────────────

  fingerprint(req: Request): RequestFingerprint {
    const headers = Object.keys(req.headers).sort().join(',');
    const headerHash = createHash('sha256')
      .update(headers + (req.headers['accept'] || '') + (req.headers['accept-encoding'] || ''))
      .digest('hex')
      .substring(0, 16);

    return {
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: (req.headers['user-agent'] || '').substring(0, 256),
      acceptLang: (req.headers['accept-language'] || '').substring(0, 64),
      acceptEnc: (req.headers['accept-encoding'] || '').substring(0, 64),
      connection: (req.headers['connection'] || '').substring(0, 32),
      headerHash,
      tlsVersion: (req.socket as any)?.getProtocol?.() || undefined,
    };
  }

  fingerprintHash(fp: RequestFingerprint): string {
    return createHash('sha256')
      .update(`${fp.userAgent}|${fp.acceptLang}|${fp.acceptEnc}|${fp.headerHash}`)
      .digest('hex')
      .substring(0, 12);
  }

  // ──── Profile Management ──────────────────────────────────────

  getOrCreateProfile(ip: string): IPProfile {
    let profile = this.profiles.get(ip);
    if (!profile) {
      // LRU eviction
      if (this.profiles.size >= this.config.maxProfiles) {
        const oldest = this.profiles.keys().next().value;
        if (oldest) this.profiles.delete(oldest);
      }
      profile = {
        ip,
        fingerprints: new Set(),
        timestamps: [],
        pathCounts: new Map(),
        errorCount: 0,
        sequentialPaths: 0,
        threatLevel: ThreatLevel.CLEAN,
        escalatedAt: 0,
        escalations: 0,
        honeypotHits: 0,
        authFailures: 0,
        firstSeen: Date.now(),
        challengeSolved: false,
      };
      this.profiles.set(ip, profile);
    }
    return profile;
  }

  // ──── Anomaly Scoring ─────────────────────────────────────────

  /**
   * Score a request and update the profile.
   * Returns the threat level AFTER scoring.
   */
  score(req: Request): { level: ThreatLevel; profile: IPProfile; reasons: string[] } {
    const fp = this.fingerprint(req);
    const fpHash = this.fingerprintHash(fp);
    const now = Date.now();
    const profile = this.getOrCreateProfile(fp.ip);
    const reasons: string[] = [];

    // Record fingerprint
    profile.fingerprints.add(fpHash);

    // Record timestamp
    profile.timestamps.push(now);

    // Trim timestamps outside window
    const windowStart = now - this.config.windowMs;
    profile.timestamps = profile.timestamps.filter(t => t >= windowStart);

    // Record path
    const pathKey = `${req.method} ${req.path}`;
    profile.pathCounts.set(pathKey, (profile.pathCounts.get(pathKey) || 0) + 1);

    // ── Anomaly checks ──

    let score = 0;

    // 1. Volume: too many requests in window
    const reqCount = profile.timestamps.length;
    if (reqCount > this.config.maxRequestsPerWindow) {
      score += 2;
      reasons.push(`volume:${reqCount}/${this.config.maxRequestsPerWindow}`);
    }

    // 2. Burst: many requests in the last 1 second
    const oneSecAgo = now - 1000;
    const burstCount = profile.timestamps.filter(t => t >= oneSecAgo).length;
    if (burstCount > this.config.burstThreshold) {
      score += 3;
      reasons.push(`burst:${burstCount}/${this.config.burstThreshold}`);
    }

    // 3. Scanner: accessing too many unique paths
    if (profile.pathCounts.size > this.config.scannerPathThreshold) {
      score += 2;
      reasons.push(`scanner:${profile.pathCounts.size}paths`);
    }

    // 4. Bad User-Agent
    if (this.config.badUserAgents.some(re => re.test(fp.userAgent))) {
      score += 2;
      reasons.push(`bad_ua:${fp.userAgent.substring(0, 40)}`);
    }

    // 5. Empty or missing standard headers (bot indicator)
    if (!fp.userAgent || !fp.acceptLang || !fp.acceptEnc) {
      score += 1;
      reasons.push('missing_headers');
    }

    // 6. Too many fingerprints from same IP (rotating tools)
    if (profile.fingerprints.size > 10) {
      score += 1;
      reasons.push(`multi_fp:${profile.fingerprints.size}`);
    }

    // 7. High error rate
    if (profile.errorCount > 20) {
      score += 2;
      reasons.push(`errors:${profile.errorCount}`);
    }

    // 8. Auth brute force
    if (profile.authFailures >= this.config.authFailureThreshold) {
      score += 3;
      reasons.push(`auth_brute:${profile.authFailures}`);
    }

    // 9. Honeypot access
    if (profile.honeypotHits > 0) {
      score += 4; // Immediate escalation
      reasons.push(`honeypot:${profile.honeypotHits}hits`);
    }

    // ── Map score to threat level ──
    let newLevel: ThreatLevel;
    if (score >= 7) newLevel = ThreatLevel.GHOST;
    else if (score >= 4) newLevel = ThreatLevel.HOSTILE;
    else if (score >= 2) newLevel = ThreatLevel.SUSPICIOUS;
    else newLevel = ThreatLevel.CLEAN;

    // Never downgrade more than 1 level at a time (sticky escalation)
    if (newLevel < profile.threatLevel) {
      // Allow decay only if enough time has passed
      if (now - profile.escalatedAt > this.config.decayPeriodMs) {
        newLevel = Math.max(profile.threatLevel - 1, newLevel) as ThreatLevel;
      } else {
        newLevel = profile.threatLevel; // Hold current level
      }
    }

    // Escalate
    if (newLevel > profile.threatLevel) {
      profile.escalatedAt = now;
      profile.escalations++;
      this.logEvent({
        timestamp: now,
        ip: fp.ip,
        threatLevel: newLevel,
        reason: reasons.join('; '),
        fingerprint: fpHash,
        path: req.path,
        method: req.method,
      });
    }

    profile.threatLevel = newLevel;
    return { level: newLevel, profile, reasons };
  }

  // ──── Honeypot Detection ──────────────────────────────────────

  isHoneypotPath(path: string): boolean {
    const normalized = path.toLowerCase().replace(/\/+$/, '');
    return this.config.honeypotPaths.some(hp => normalized === hp.toLowerCase());
  }

  recordHoneypotHit(ip: string): void {
    const profile = this.getOrCreateProfile(ip);
    profile.honeypotHits++;
    profile.threatLevel = ThreatLevel.GHOST;
    profile.escalatedAt = Date.now();
    logger.warn('Honeypot triggered', { ip, hits: profile.honeypotHits });
  }

  // ──── Auth Failure Tracking ───────────────────────────────────

  recordAuthFailure(ip: string): void {
    const profile = this.getOrCreateProfile(ip);
    profile.authFailures++;
    if (profile.authFailures >= this.config.authFailureThreshold) {
      profile.threatLevel = Math.max(profile.threatLevel, ThreatLevel.HOSTILE) as ThreatLevel;
      profile.escalatedAt = Date.now();
    }
  }

  recordError(ip: string): void {
    const profile = this.getOrCreateProfile(ip);
    profile.errorCount++;
  }

  // ──── Proof-of-Work Challenge ─────────────────────────────────

  /**
   * Issue a PoW challenge. Client must find a nonce such that
   * SHA256(nonce + challenge) has `difficulty` leading hex zeros.
   */
  issueChallenge(ip: string): { challenge: string; difficulty: number } {
    const profile = this.getOrCreateProfile(ip);
    const challenge = randomBytes(16).toString('hex');
    profile.challengeNonce = challenge;
    profile.challengeIssuedAt = Date.now();
    profile.challengeSolved = false;
    return { challenge, difficulty: this.config.powDifficulty };
  }

  /**
   * Verify a PoW solution
   */
  verifyChallenge(ip: string, nonce: string): boolean {
    const profile = this.profiles.get(ip);
    if (!profile?.challengeNonce) return false;

    // Challenge expires after 5 minutes
    if (Date.now() - (profile.challengeIssuedAt || 0) > 5 * 60_000) {
      profile.challengeNonce = undefined;
      return false;
    }

    const hash = createHash('sha256')
      .update(nonce + profile.challengeNonce)
      .digest('hex');

    const prefix = '0'.repeat(this.config.powDifficulty);
    if (hash.startsWith(prefix)) {
      profile.challengeSolved = true;
      // Successful PoW — reduce threat level by 1
      profile.threatLevel = Math.max(0, profile.threatLevel - 1) as ThreatLevel;
      profile.challengeNonce = undefined;
      return true;
    }
    return false;
  }

  // ──── Circuit Breaker (Global DDoS) ───────────────────────────

  checkCircuitBreaker(): boolean {
    const now = Date.now();
    // Reset counter every second
    if (now - this.globalWindowStart >= 1000) {
      // Check if we exceeded global RPS
      if (this.globalRequestCount > this.globalMaxRps) {
        this.circuitOpen = true;
        this.circuitOpenedAt = now;
        logger.error('CIRCUIT BREAKER OPEN — DDoS detected', {
          rps: this.globalRequestCount,
          threshold: this.globalMaxRps,
        });
      }
      this.globalRequestCount = 0;
      this.globalWindowStart = now;
    }

    this.globalRequestCount++;

    // Auto-close circuit after 30s
    if (this.circuitOpen && now - this.circuitOpenedAt > 30_000) {
      this.circuitOpen = false;
      logger.info('Circuit breaker closed — resuming normal operations');
    }

    return this.circuitOpen;
  }

  // ──── Cleanup ─────────────────────────────────────────────────

  private cleanup(): void {
    const now = Date.now();
    const expiry = 30 * 60_000; // 30 minutes inactive
    let cleaned = 0;

    for (const [ip, profile] of this.profiles) {
      const lastActivity = profile.timestamps[profile.timestamps.length - 1] || profile.firstSeen;
      if (now - lastActivity > expiry && profile.threatLevel <= ThreatLevel.SUSPICIOUS) {
        this.profiles.delete(ip);
        cleaned++;
      }
    }

    // Trim event log
    if (this.eventLog.length > this.config.maxEventLog) {
      this.eventLog = this.eventLog.slice(-this.config.maxEventLog);
    }

    if (cleaned > 0) {
      logger.debug('GhostTrap cleanup', { cleaned, remaining: this.profiles.size });
    }
  }

  private logEvent(event: ThreatEvent): void {
    this.eventLog.push(event);
    if (event.threatLevel >= ThreatLevel.HOSTILE) {
      logger.warn('Threat escalated', event);
    }
  }

  // ──── Stats & Monitoring ──────────────────────────────────────

  getStats() {
    let clean = 0, suspicious = 0, hostile = 0, ghost = 0, blocked = 0;
    for (const profile of this.profiles.values()) {
      switch (profile.threatLevel) {
        case ThreatLevel.CLEAN: clean++; break;
        case ThreatLevel.SUSPICIOUS: suspicious++; break;
        case ThreatLevel.HOSTILE: hostile++; break;
        case ThreatLevel.GHOST: ghost++; break;
        case ThreatLevel.BLOCKED: blocked++; break;
      }
    }
    return {
      totalProfiles: this.profiles.size,
      clean, suspicious, hostile, ghost, blocked,
      circuitOpen: this.circuitOpen,
      globalRps: this.globalRequestCount,
      recentEvents: this.eventLog.slice(-20),
    };
  }

  getProfile(ip: string): IPProfile | undefined {
    return this.profiles.get(ip);
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
  }
}

// ────────────────────────────────────────────────────────────────
// Singleton
// ────────────────────────────────────────────────────────────────

export const ghostTrap = new GhostTrapEngine();

// ────────────────────────────────────────────────────────────────
// Express Middleware
// ────────────────────────────────────────────────────────────────

/**
 * GhostTrap middleware — the primary request interceptor.
 * 
 * Flow:
 * 1. Check circuit breaker (global DDoS)
 * 2. Skip trusted IPs
 * 3. Check honeypot paths
 * 4. Score the request
 * 5. Apply action based on threat level:
 *    - CLEAN: pass through
 *    - SUSPICIOUS: add tracking headers, continue
 *    - HOSTILE: issue PoW challenge or rate limit aggressively
 *    - GHOST: route to honeypot sandbox (fake responses)
 *    - BLOCKED: drop connection
 */
export function ghostTrapMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // ── 1. Circuit breaker check ──
    if (ghostTrap.checkCircuitBreaker()) {
      // During DDoS, only let through health checks
      if (req.path === '/health' || req.path === '/ping') {
        return next();
      }
      res.status(503).set('Retry-After', '30').json({
        error: 'Service temporarily unavailable due to high traffic',
        retryAfter: 30,
      });
      return;
    }

    // ── 2. Trusted IPs bypass ──
    if (ghostTrap['config'].trustedIPs.has(ip)) {
      return next();
    }

    // ── 3. Honeypot path check ──
    if (ghostTrap.isHoneypotPath(req.path)) {
      ghostTrap.recordHoneypotHit(ip);
      // Return convincing but fake response after deliberate delay (tarpit)
      return serveFakeResponse(req, res);
    }

    // ── 4. Score the request ──
    const { level, reasons } = ghostTrap.score(req);

    // Attach to request for downstream use
    (req as any).__ghostTrapLevel = level;
    (req as any).__ghostTrapReasons = reasons;

    // ── 5. Track error responses ──
    const originalEnd = res.end;
    res.end = function (this: Response, ...args: any[]) {
      if (res.statusCode >= 400) {
        ghostTrap.recordError(ip);
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        ghostTrap.recordAuthFailure(ip);
      }
      return originalEnd.apply(this, args);
    } as any;

    // ── 6. Action based on threat level ──
    switch (level) {
      case ThreatLevel.CLEAN:
        return next();

      case ThreatLevel.SUSPICIOUS:
        // Continue but flag the request
        res.setHeader('X-Threat-Flag', 'monitored');
        return next();

      case ThreatLevel.HOSTILE:
        // Issue PoW challenge if enabled
        if (ghostTrap['config'].enablePoWChallenge) {
          const profile = ghostTrap.getProfile(ip);
          if (profile?.challengeSolved) {
            // Already solved challenge — let through with aggressive rate limit
            return next();
          }
          // Check if they're submitting a challenge solution
          const solutionNonce = req.headers['x-pow-solution'] as string;
          if (solutionNonce) {
            if (ghostTrap.verifyChallenge(ip, solutionNonce)) {
              return next();
            }
            return res.status(403).json({ error: 'Invalid proof-of-work solution' });
          }
          // Issue new challenge
          const challenge = ghostTrap.issueChallenge(ip);
          return res.status(429).json({
            error: 'Rate limit exceeded. Complete proof-of-work challenge to continue.',
            challenge: challenge.challenge,
            difficulty: challenge.difficulty,
            instruction: `Find nonce where SHA256(nonce + "${challenge.challenge}") starts with ${'0'.repeat(challenge.difficulty)}`,
          });
        }
        // No PoW — just rate limit
        return res.status(429).set('Retry-After', '60').json({
          error: 'Too many requests. Please slow down.',
          retryAfter: 60,
        });

      case ThreatLevel.GHOST:
        // Route to honeypot sandbox — fake convincing responses
        return serveFakeResponse(req, res);

      case ThreatLevel.BLOCKED:
        // Silently drop connection
        req.socket.destroy();
        return;

      default:
        return next();
    }
  };
}

// ────────────────────────────────────────────────────────────────
// Honeypot Sandbox — Fake Responses
// ────────────────────────────────────────────────────────────────

/**
 * Serves convincing but entirely fake responses to waste attacker's time.
 * Includes deliberate delays (tarpit) to slow down automated tools.
 */
function serveFakeResponse(req: Request, res: Response): void {
  // Tarpit: random delay 2-10 seconds to slow automated tools
  const delay = 2000 + Math.floor(Math.random() * 8000);

  setTimeout(() => {
    const path = req.path.toLowerCase();

    // Fake admin panels
    if (path.includes('admin') || path.includes('login') || path.includes('wp-')) {
      res.status(200).type('html').send(`
        <!DOCTYPE html>
        <html><head><title>Admin Login</title></head>
        <body>
          <form method="POST" action="${req.path}">
            <input name="username" type="text" placeholder="Username" />
            <input name="password" type="password" placeholder="Password" />
            <button type="submit">Login</button>
          </form>
          <!-- Session: ${randomBytes(16).toString('hex')} -->
        </body></html>
      `);
      return;
    }

    // Fake config/env files
    if (path.includes('.env') || path.includes('config')) {
      res.status(200).type('text').send(
        `# Application Config\n` +
        `DB_HOST=internal-db.${randomBytes(4).toString('hex')}.local\n` +
        `DB_PASSWORD=${randomBytes(20).toString('base64')}\n` +
        `API_KEY=${randomBytes(24).toString('hex')}\n` +
        `SECRET_KEY=${randomBytes(32).toString('hex')}\n` +
        `# Do not expose this file\n`
      );
      return;
    }

    // Fake database dumps
    if (path.includes('.sql') || path.includes('dump') || path.includes('backup')) {
      res.status(200).type('text').send(
        `-- Database dump v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}\n` +
        `CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(255));\n` +
        `INSERT INTO users VALUES (1, 'admin@${randomBytes(4).toString('hex')}.local');\n`
      );
      return;
    }

    // Fake git files
    if (path.includes('.git')) {
      res.status(200).type('text').send(
        `ref: refs/heads/main\n`
      );
      return;
    }

    // Fake API responses
    if (path.includes('api')) {
      res.status(200).json({
        status: 'ok',
        version: '2.1.0',
        users_count: Math.floor(Math.random() * 10000),
        session: randomBytes(16).toString('hex'),
      });
      return;
    }

    // Default: fake 200 with empty-ish content
    res.status(200).json({ status: 'ok' });
  }, delay);
}

// ────────────────────────────────────────────────────────────────
// GhostTrap Stats API (for monitoring)
// ────────────────────────────────────────────────────────────────

export function ghostTrapStatsHandler(req: Request, res: Response): void {
  const stats = ghostTrap.getStats();
  res.json({
    ghostTrap: {
      ...stats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
}
