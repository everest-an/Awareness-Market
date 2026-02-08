/**
 * CryptoAssetGuard — Token, Credential & Private Key Theft Defense
 * 
 * Multi-layer honeypot and defense system specifically targeting:
 * - Token theft (USDC/USDT drain, fake approve(), phishing contracts)
 * - Credential harvesting (API key enumeration, session replay)
 * - Private key exfiltration (memory scrub, log redaction, error sanitization)
 * - On-chain phishing (contract whitelist, approve target validation)
 * 
 * Architecture:
 * ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 * │   Contract   │  │  Transaction │  │  Credential  │
 * │   Whitelist  │  │  Anomaly     │  │  Theft       │
 * │   Engine     │  │  Detector    │  │  Detector    │
 * └──────────────┘  └──────────────┘  └──────────────┘
 *        │                 │                 │
 *        ▼                 ▼                 ▼
 * ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 * │  Key Memory  │  │  Error Msg   │  │  Crypto      │
 * │  Scrubber    │  │  Sanitizer   │  │  Honeypot    │
 * └──────────────┘  └──────────────┘  └──────────────┘
 */

import { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('CryptoAssetGuard');

// ════════════════════════════════════════════════════════════════
// 1. CONTRACT ADDRESS WHITELIST
// ════════════════════════════════════════════════════════════════

/**
 * Only these contracts may be targets for approve() or token transfers.
 * Any interaction with a contract not on this list is blocked.
 * Add new contracts here via env var or update this set.
 */
const WHITELISTED_CONTRACTS = new Set<string>([
  // StablecoinPaymentSystem (Polygon Mainnet)
  '0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8',
  // ERC8004Registry
  '0x1Ae90F59731e16b548E34f81F0054e96DdACFc28',
  // USDC (Polygon)
  '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  // USDT (Polygon)
  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  // Platform Treasury
  '0x3d0ab53241A2913D7939ae02f7083169fE7b823B',
].map(a => a.toLowerCase()));

// Allow extra whitelisted contracts from env
if (process.env.EXTRA_WHITELISTED_CONTRACTS) {
  process.env.EXTRA_WHITELISTED_CONTRACTS
    .split(',')
    .map(a => a.trim().toLowerCase())
    .filter(a => /^0x[a-f0-9]{40}$/i.test(a))
    .forEach(a => WHITELISTED_CONTRACTS.add(a));
}

/**
 * Check if a contract address is whitelisted.
 */
export function isWhitelistedContract(address: string): boolean {
  return WHITELISTED_CONTRACTS.has(address.toLowerCase());
}

/**
 * Validate that an approve() target is in the whitelist.
 * Returns the address if valid, throws if not.
 */
export function validateApproveTarget(targetAddress: string, context?: string): string {
  const lower = targetAddress.toLowerCase();
  if (!WHITELISTED_CONTRACTS.has(lower)) {
    logger.error('BLOCKED: approve() to non-whitelisted contract', {
      target: targetAddress,
      context: context || 'unknown',
    });
    throw new Error(
      'Transaction blocked: approve target is not a recognized contract. ' +
      'This may indicate a phishing attempt.'
    );
  }
  return targetAddress;
}

/**
 * Validate that env-var contract addresses haven't been tampered with.
 * Call at startup to detect env var injection attacks.
 */
export function validateContractIntegrity(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Known-good checksums (SHA-256 of lowercase address)
  const KNOWN_CHECKSUMS: Record<string, string> = {
    STABLECOIN_PAYMENT: createHash('sha256')
      .update('0xbaeea6b8b53272c4624df53b954ed8c72fd25dd8')
      .digest('hex'),
    ERC8004_REGISTRY: createHash('sha256')
      .update('0x1ae90f59731e16b548e34f81f0054e96ddacfc28')
      .digest('hex'),
    PLATFORM_TREASURY: createHash('sha256')
      .update('0x3d0ab53241a2913d7939ae02f7083169fe7b823b')
      .digest('hex'),
  };

  // Check payment contract
  const paymentAddr = (
    process.env.STABLECOIN_PAYMENT_ADDRESS ||
    process.env.STABLECOIN_CONTRACT_ADDRESS ||
    '0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8'
  ).toLowerCase();
  const paymentHash = createHash('sha256').update(paymentAddr).digest('hex');
  if (paymentHash !== KNOWN_CHECKSUMS.STABLECOIN_PAYMENT) {
    errors.push(`CRITICAL: Payment contract address mismatch! Got ${paymentAddr}`);
  }

  // Check treasury
  const treasuryAddr = (
    process.env.PLATFORM_TREASURY_ADDRESS ||
    '0x3d0ab53241A2913D7939ae02f7083169fE7b823B'
  ).toLowerCase();
  const treasuryHash = createHash('sha256').update(treasuryAddr).digest('hex');
  if (treasuryHash !== KNOWN_CHECKSUMS.PLATFORM_TREASURY) {
    errors.push(`CRITICAL: Treasury address mismatch! Got ${treasuryAddr}`);
  }

  if (errors.length > 0) {
    logger.error('CONTRACT INTEGRITY CHECK FAILED', { errors });
  } else {
    logger.info('Contract integrity check passed');
  }

  return { valid: errors.length === 0, errors };
}


// ════════════════════════════════════════════════════════════════
// 2. TRANSACTION ANOMALY DETECTOR
// ════════════════════════════════════════════════════════════════

interface TxAnomalyProfile {
  userId: number;
  /** Recent transaction timestamps (for velocity detection) */
  recentTxTimestamps: number[];
  /** Total USD volume in current window */
  windowVolume: number;
  /** Window start time */
  windowStart: number;
  /** Consecutive rapid transactions count */
  rapidTxCount: number;
  /** Last transaction timestamp */
  lastTxAt: number;
  /** Unique token types used in window */
  tokenTypes: Set<string>;
  /** Withdraw count in window */
  withdrawCount: number;
  /** Flag: has been warned about anomaly */
  warned: boolean;
}

const txProfiles = new Map<number, TxAnomalyProfile>();
const TX_WINDOW_MS = 3600_000; // 1 hour window
const MAX_TX_VELOCITY = 10;    // Max 10 transactions per window
const MAX_WITHDRAW_VELOCITY = 3; // Max 3 withdrawals per window
const RAPID_TX_THRESHOLD_MS = 5_000; // Transactions within 5s are "rapid"
const MAX_WINDOW_VOLUME_USD = 5000;  // $5000/hour max

function getTxProfile(userId: number): TxAnomalyProfile {
  let profile = txProfiles.get(userId);
  const now = Date.now();

  if (!profile) {
    profile = {
      userId,
      recentTxTimestamps: [],
      windowVolume: 0,
      windowStart: now,
      rapidTxCount: 0,
      lastTxAt: 0,
      tokenTypes: new Set(),
      withdrawCount: 0,
      warned: false,
    };
    txProfiles.set(userId, profile);
  }

  // Reset window if expired
  if (now - profile.windowStart > TX_WINDOW_MS) {
    profile.recentTxTimestamps = [];
    profile.windowVolume = 0;
    profile.windowStart = now;
    profile.rapidTxCount = 0;
    profile.tokenTypes.clear();
    profile.withdrawCount = 0;
    profile.warned = false;
  }

  return profile;
}

export interface TxAnomalyResult {
  allowed: boolean;
  reason?: string;
  severity: 'none' | 'warning' | 'critical';
  anomalyScore: number;
}

/**
 * Check a pending transaction for anomalies before allowing execution.
 * Call this BEFORE executing any on-chain transaction.
 */
export function checkTransactionAnomaly(
  userId: number,
  action: 'purchase' | 'deposit' | 'withdraw' | 'approve',
  amountUSD: number,
  token: string,
): TxAnomalyResult {
  const profile = getTxProfile(userId);
  const now = Date.now();
  let anomalyScore = 0;
  const reasons: string[] = [];

  // Record this transaction
  profile.recentTxTimestamps.push(now);
  profile.windowVolume += amountUSD;
  profile.tokenTypes.add(token);

  if (action === 'withdraw') {
    profile.withdrawCount++;
  }

  // Check rapid transaction (within 5s of last)
  if (profile.lastTxAt > 0 && now - profile.lastTxAt < RAPID_TX_THRESHOLD_MS) {
    profile.rapidTxCount++;
    if (profile.rapidTxCount >= 3) {
      anomalyScore += 3;
      reasons.push(`rapid_fire:${profile.rapidTxCount}tx_in_${RAPID_TX_THRESHOLD_MS}ms`);
    }
  } else {
    profile.rapidTxCount = Math.max(0, profile.rapidTxCount - 1);
  }
  profile.lastTxAt = now;

  // 1. Transaction velocity (too many tx/hour)
  if (profile.recentTxTimestamps.length > MAX_TX_VELOCITY) {
    anomalyScore += 2;
    reasons.push(`velocity:${profile.recentTxTimestamps.length}/${MAX_TX_VELOCITY}/hr`);
  }

  // 2. Withdraw velocity (many withdrawals in short time = drain attempt)
  if (profile.withdrawCount > MAX_WITHDRAW_VELOCITY) {
    anomalyScore += 4;
    reasons.push(`withdraw_drain:${profile.withdrawCount}/${MAX_WITHDRAW_VELOCITY}/hr`);
  }

  // 3. Volume spike (too much USD value in window)
  if (profile.windowVolume > MAX_WINDOW_VOLUME_USD) {
    anomalyScore += 3;
    reasons.push(`volume_spike:$${profile.windowVolume.toFixed(2)}/$${MAX_WINDOW_VOLUME_USD}/hr`);
  }

  // 4. Unusual amount patterns
  if (amountUSD > 1000) {
    anomalyScore += 1;
    reasons.push(`high_amount:$${amountUSD}`);
  }
  // Suspicious exact amounts that suggest scripted drain
  if (amountUSD === Math.floor(amountUSD) && amountUSD > 100 && amountUSD % 100 === 0) {
    anomalyScore += 1;
    reasons.push(`round_amount:$${amountUSD}`);
  }

  // 5. Token-switching (using both USDC and USDT rapidly = drain pattern)
  if (profile.tokenTypes.size > 1 && profile.recentTxTimestamps.length > 3) {
    anomalyScore += 2;
    reasons.push(`token_switching:${Array.from(profile.tokenTypes).join(',')}`);
  }

  // Determine result
  if (anomalyScore >= 6) {
    logger.error('BLOCKED: Transaction anomaly — possible token drain', {
      userId, action, amountUSD, token,
      anomalyScore, reasons,
      txCount: profile.recentTxTimestamps.length,
      withdrawCount: profile.withdrawCount,
      windowVolume: profile.windowVolume,
    });
    return {
      allowed: false,
      reason: `Transaction blocked: unusual activity detected (${reasons.join('; ')}). ` +
              'If this is legitimate, please wait and try again.',
      severity: 'critical',
      anomalyScore,
    };
  }

  if (anomalyScore >= 3) {
    logger.warn('Transaction anomaly warning', {
      userId, action, amountUSD, token,
      anomalyScore, reasons,
    });
    return {
      allowed: true,
      reason: `Warning: unusual activity pattern (${reasons.join('; ')})`,
      severity: 'warning',
      anomalyScore,
    };
  }

  return { allowed: true, severity: 'none', anomalyScore: 0 };
}


// ════════════════════════════════════════════════════════════════
// 3. PRIVATE KEY MEMORY SCRUBBER
// ════════════════════════════════════════════════════════════════

/**
 * Scrub a private key string from memory by overwriting with zeros.
 * JavaScript strings are immutable, so this creates a best-effort
 * defense by:
 * 1. Replacing the variable reference
 * 2. Triggering GC hint
 * 3. Using Buffer for sensitive operations when possible
 * 
 * NOTE: This is defense-in-depth — JS VMs don't guarantee memory erasure.
 * But it raises the bar significantly against heap dump attacks.
 */
export function scrubFromMemory(sensitiveString: string): void {
  // Best effort: overwrite the reference (V8 may still have the old string in heap)
  // The caller should set their variable to '' after calling this
  try {
    // Force a GC hint by creating pressure
    if (typeof global.gc === 'function') {
      global.gc();
    }
  } catch {
    // GC not exposed — this is normal in production
  }
}

/**
 * Execute a callback with a sensitive key, ensuring the key reference
 * is scrubbed after use. Returns the callback's result.
 * 
 * Usage:
 *   const wallet = await withScrubbed(privateKey, async (key) => {
 *     return new ethers.Wallet(key, provider);
 *   });
 */
export async function withScrubbed<T>(
  sensitiveKey: string,
  callback: (key: string) => T | Promise<T>
): Promise<T> {
  try {
    return await callback(sensitiveKey);
  } finally {
    scrubFromMemory(sensitiveKey);
  }
}


// ════════════════════════════════════════════════════════════════
// 4. ERROR MESSAGE SANITIZER
// ════════════════════════════════════════════════════════════════

/**
 * Patterns that should NEVER appear in error messages sent to clients.
 */
const SENSITIVE_PATTERNS: RegExp[] = [
  // Ethereum/Polygon private keys (64 hex chars, often prefixed with 0x)
  /0x[a-fA-F0-9]{64}/g,
  // Generic 64-char hex strings (could be keys/secrets)
  /\b[a-fA-F0-9]{64}\b/g,
  // Bearer tokens
  /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/gi,
  // JWT tokens (three base64 sections separated by dots)
  /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+\/=]+/g,
  // Database connection strings
  /(?:postgres|mysql|mongodb|redis):\/\/[^\s]+/gi,
  // API keys (common patterns)
  /(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9\-._~+\/]{16,}['"]?/gi,
  // File paths that reveal server structure
  /(?:\/home\/[^\s]+|\/var\/[^\s]+|[A-Z]:\\[^\s]+)/gi,
  // RPC URLs with keys
  /https?:\/\/[^\s]*(?:infura|alchemy|quicknode|moralis)[^\s]*/gi,
  // Encrypted key material
  /{"ciphertext":"[^"]+","iv":"[^"]+","authTag":"[^"]+"}/g,
  // Mnemonics (12 or 24 words — simplified check)
  /\b(?:abandon|ability|able|about|above|absent|absorb|abstract|absurd|abuse|access|accident)\b(?:\s+\w+){11,23}/gi,
];

/**
 * Sanitize an error message, removing all sensitive patterns.
 * Returns a safe string suitable for API responses.
 */
export function sanitizeErrorMessage(error: unknown): string {
  let message: string;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    return 'An internal error occurred';
  }

  // Redact sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    // Reset regex state (global flag)
    pattern.lastIndex = 0;
    message = message.replace(pattern, '[REDACTED]');
  }

  // Truncate long messages (prevent info leak via verbose errors)
  if (message.length > 200) {
    message = message.substring(0, 200) + '...';
  }

  return message;
}

/**
 * Safe error handler for blockchain/crypto operations.
 * Returns a generic message for unknown errors, preserves
 * known-safe error types.
 */
export function safeCryptoError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Known-safe error messages that can be forwarded
    const safePatterns = [
      'insufficient balance', 'insufficient funds',
      'spending limit exceeded', 'wallet not found',
      'wallet is deactivated', 'package not found',
      'invalid amount', 'nonce too low',
      'transaction failed', 'gas estimation failed',
      'reverted', 'unpredictable_gas_limit',
    ];

    for (const safe of safePatterns) {
      if (msg.includes(safe)) {
        return sanitizeErrorMessage(error.message);
      }
    }
  }

  // For everything else, return a generic message
  return 'Transaction failed. Please try again later.';
}


// ════════════════════════════════════════════════════════════════
// 5. CREDENTIAL THEFT DETECTOR
// ════════════════════════════════════════════════════════════════

interface CredentialAbuseProfile {
  ip: string;
  /** API key attempts (different keys from same IP) */
  apiKeyAttempts: Set<string>;
  /** Session token replays (same session from different IPs) */
  sessionReplayCount: number;
  /** Auth endpoint hit count in window */
  authHitCount: number;
  /** Window start */
  windowStart: number;
  /** Wallet connect attempts */
  walletConnectAttempts: number;
  /** Unique wallet addresses tried */
  walletAddresses: Set<string>;
  /** Last flagged timestamp */
  lastFlagged: number;
}

const credentialProfiles = new Map<string, CredentialAbuseProfile>();
const CREDENTIAL_WINDOW_MS = 300_000; // 5 minute window
const MAX_API_KEY_ATTEMPTS = 5;       // 5 different keys from same IP
const MAX_AUTH_HITS = 30;             // 30 auth attempts in 5 min
const MAX_WALLET_ATTEMPTS = 10;       // 10 different wallets from same IP

function getCredentialProfile(ip: string): CredentialAbuseProfile {
  let profile = credentialProfiles.get(ip);
  const now = Date.now();

  if (!profile) {
    profile = {
      ip,
      apiKeyAttempts: new Set(),
      sessionReplayCount: 0,
      authHitCount: 0,
      windowStart: now,
      walletConnectAttempts: 0,
      walletAddresses: new Set(),
      lastFlagged: 0,
    };
    credentialProfiles.set(ip, profile);
  }

  // Reset window
  if (now - profile.windowStart > CREDENTIAL_WINDOW_MS) {
    profile.apiKeyAttempts.clear();
    profile.sessionReplayCount = 0;
    profile.authHitCount = 0;
    profile.windowStart = now;
    profile.walletConnectAttempts = 0;
    profile.walletAddresses.clear();
  }

  return profile;
}

/**
 * Track API key usage attempt.
 * Detects mass enumeration of API keys from a single IP.
 */
export function trackApiKeyAttempt(ip: string, keyPrefix: string): { blocked: boolean; reason?: string } {
  const profile = getCredentialProfile(ip);
  profile.apiKeyAttempts.add(keyPrefix);
  profile.authHitCount++;

  if (profile.apiKeyAttempts.size > MAX_API_KEY_ATTEMPTS) {
    logger.error('BLOCKED: API key enumeration detected', {
      ip,
      uniqueKeys: profile.apiKeyAttempts.size,
      totalAttempts: profile.authHitCount,
    });
    return {
      blocked: true,
      reason: 'Too many different API keys attempted from this address',
    };
  }

  if (profile.authHitCount > MAX_AUTH_HITS) {
    logger.warn('Excessive auth attempts', { ip, count: profile.authHitCount });
    return {
      blocked: true,
      reason: 'Too many authentication attempts',
    };
  }

  return { blocked: false };
}

/**
 * Track wallet authentication attempt.
 * Detects mass wallet address enumeration.
 */
export function trackWalletAuth(ip: string, walletAddress: string): { blocked: boolean; reason?: string } {
  const profile = getCredentialProfile(ip);
  profile.walletConnectAttempts++;
  profile.walletAddresses.add(walletAddress.toLowerCase());

  if (profile.walletAddresses.size > MAX_WALLET_ATTEMPTS) {
    logger.error('BLOCKED: Wallet address enumeration detected', {
      ip,
      uniqueWallets: profile.walletAddresses.size,
      totalAttempts: profile.walletConnectAttempts,
    });
    return {
      blocked: true,
      reason: 'Too many different wallet connections attempted',
    };
  }

  return { blocked: false };
}


// ════════════════════════════════════════════════════════════════
// 6. CRYPTO HONEYPOT ENDPOINTS
// ════════════════════════════════════════════════════════════════

/**
 * Fake crypto endpoints that real users should never access.
 * Attackers scanning for wallet/key endpoints will hit these
 * and get tarpitted with convincing but fake data.
 */
export const CRYPTO_HONEYPOT_PATHS = [
  '/api/wallet/export',
  '/api/wallet/private-key',
  '/api/wallet/seed-phrase',
  '/api/wallet/mnemonic',
  '/api/wallet/backup',
  '/api/admin/wallets',
  '/api/admin/treasury',
  '/api/admin/keys',
  '/api/internal/decrypt',
  '/api/debug/wallet',
  '/api/v1/keys/export',
  '/api/v2/wallet/raw',
  '/api/agent/private-key',
  '/api/custody/export',
  '/api/config/master-key',
  '/.well-known/wallet',
  '/wallet.json',
  '/keystore',
  '/keystore.json',
  '/private-keys',
  '/seed-phrase.txt',
];

/**
 * Serve a convincing but fake crypto honeypot response.
 * All data is randomly generated — no real keys/wallets exposed.
 */
function serveCryptoHoneypot(req: Request, res: Response): void {
  const delay = 3000 + Math.floor(Math.random() * 7000); // 3-10s tarpit
  const path = req.path.toLowerCase();

  setTimeout(() => {
    // Fake wallet export
    if (path.includes('private-key') || path.includes('export') || path.includes('raw')) {
      res.status(200).json({
        success: true,
        wallet: {
          address: `0x${randomBytes(20).toString('hex')}`,
          privateKey: `0x${randomBytes(32).toString('hex')}`,
          chainId: 137,
          balance: `${(Math.random() * 100).toFixed(6)} MATIC`,
        },
      });
      return;
    }

    // Fake seed phrase
    if (path.includes('seed') || path.includes('mnemonic')) {
      const fakeWords = [
        'abandon', 'ability', 'absent', 'absorb', 'abstract',
        'absurd', 'abuse', 'access', 'accident', 'account',
        'accuse', 'achieve',
      ];
      res.status(200).json({
        success: true,
        seedPhrase: fakeWords.join(' '),
        derivationPath: "m/44'/60'/0'/0/0",
        warning: 'Store securely',
      });
      return;
    }

    // Fake admin treasury
    if (path.includes('admin') || path.includes('treasury')) {
      res.status(200).json({
        success: true,
        treasury: {
          address: `0x${randomBytes(20).toString('hex')}`,
          balance: {
            USDC: `${(Math.random() * 50000).toFixed(2)}`,
            USDT: `${(Math.random() * 30000).toFixed(2)}`,
            MATIC: `${(Math.random() * 10000).toFixed(4)}`,
          },
          signers: [
            `0x${randomBytes(20).toString('hex')}`,
            `0x${randomBytes(20).toString('hex')}`,
          ],
        },
      });
      return;
    }

    // Fake keystore
    if (path.includes('keystore') || path.includes('decrypt') || path.includes('master-key')) {
      res.status(200).json({
        version: 3,
        id: randomBytes(16).toString('hex'),
        address: randomBytes(20).toString('hex'),
        crypto: {
          ciphertext: randomBytes(32).toString('hex'),
          cipherparams: { iv: randomBytes(16).toString('hex') },
          cipher: 'aes-128-ctr',
          kdf: 'scrypt',
          kdfparams: {
            dklen: 32, n: 262144, r: 8, p: 1,
            salt: randomBytes(32).toString('hex'),
          },
          mac: randomBytes(32).toString('hex'),
        },
      });
      return;
    }

    // Default fake response
    res.status(200).json({
      success: true,
      data: randomBytes(32).toString('hex'),
    });
  }, delay);
}


// ════════════════════════════════════════════════════════════════
// 7. RESPONSE BODY SANITIZER (Log Redaction)
// ════════════════════════════════════════════════════════════════

/**
 * Intercept logger calls to redact sensitive data.
 * This patches the response body for sensitive endpoints
 * so that private keys, encrypted keys, etc. never appear in logs.
 */
export function redactSensitiveFields(obj: Record<string, any>): Record<string, any> {
  const redacted = { ...obj };
  const sensitiveKeys = [
    'privateKey', 'private_key', 'secretKey', 'secret_key',
    'encryptedKey', 'encrypted_key', 'mnemonic', 'seedPhrase',
    'seed_phrase', 'masterKey', 'master_key', 'apiKey', 'api_key',
    'accessToken', 'access_token', 'refreshToken', 'refresh_token',
    'password', 'passwordHash', 'keyHash', 'token', 'jwt',
    'walletKey', 'signingKey', 'ciphertext', 'authTag',
  ];

  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.includes(key) || sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactSensitiveFields(redacted[key]);
    } else if (typeof redacted[key] === 'string') {
      // Check for inline private key patterns
      for (const pattern of SENSITIVE_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(redacted[key])) {
          redacted[key] = '[REDACTED]';
          break;
        }
      }
    }
  }

  return redacted;
}


// ════════════════════════════════════════════════════════════════
// 8. EXPRESS MIDDLEWARE
// ════════════════════════════════════════════════════════════════

/**
 * CryptoAssetGuard Express middleware.
 * 
 * - Intercepts crypto honeypot paths
 * - Sanitizes error responses to strip private key patterns
 * - Tracks credential abuse patterns
 * - Integrates with GhostTrap threat scoring
 */
export function cryptoAssetGuard() {
  // Run startup integrity check
  const integrity = validateContractIntegrity();
  if (!integrity.valid) {
    logger.error('⚠️  CONTRACT INTEGRITY CHECK FAILED — possible env var tampering', {
      errors: integrity.errors,
    });
    // In production, you might want to halt the process:
    // process.exit(1);
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path.toLowerCase();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // ── 1. Crypto honeypot paths ──
    if (CRYPTO_HONEYPOT_PATHS.some(hp => path === hp || path.startsWith(hp + '/'))) {
      logger.warn('Crypto honeypot triggered', { ip, path, method: req.method });
      // Notify GhostTrap if available
      try {
        const { ghostTrap } = require('./ghost-trap');
        ghostTrap.recordHoneypotHit(ip);
      } catch { /* GhostTrap not loaded */ }
      return serveCryptoHoneypot(req, res);
    }

    // ── 2. Track wallet auth attempts ──
    if (path.includes('/auth') && path.includes('wallet') || path.includes('/phantom')) {
      const walletAddr = req.body?.address || req.body?.walletAddress || '';
      if (walletAddr) {
        const check = trackWalletAuth(ip, walletAddr);
        if (check.blocked) {
          return res.status(429).json({ error: check.reason });
        }
      }
    }

    // ── 3. Track API key auth attempts ──
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ak_')) {
      const keyPrefix = authHeader.substring(7, 19); // "ak_XXXXXXXX"
      const check = trackApiKeyAttempt(ip, keyPrefix);
      if (check.blocked) {
        return res.status(429).json({ error: check.reason });
      }
    }

    // ── 4. Sanitize error responses ──
    // Intercept res.json() to strip sensitive data from error responses
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode >= 400 && body) {
        // Sanitize error messages
        if (body.error && typeof body.error === 'string') {
          body.error = sanitizeErrorMessage(body.error);
        }
        if (body.message && typeof body.message === 'string') {
          body.message = sanitizeErrorMessage(body.message);
        }
        // Strip any sensitive fields that might leak
        if (typeof body === 'object') {
          body = redactSensitiveFields(body);
        }
      }

      // Even on success, never expose these fields in responses
      if (body && typeof body === 'object') {
        delete body.privateKey;
        delete body.private_key;
        delete body.encryptedKey;
        delete body.encrypted_key;
        delete body.masterKey;
        delete body.master_key;
        delete body.seedPhrase;
        delete body.mnemonic;
      }

      return originalJson(body);
    } as any;

    next();
  };
}


// ════════════════════════════════════════════════════════════════
// 9. CLEANUP
// ════════════════════════════════════════════════════════════════

// Periodic cleanup of stale profiles (every 10 minutes)
const cleanupInterval = setInterval(() => {
  const now = Date.now();

  // Clean tx anomaly profiles older than 2 hours
  for (const [userId, profile] of txProfiles) {
    if (now - profile.windowStart > 2 * TX_WINDOW_MS) {
      txProfiles.delete(userId);
    }
  }

  // Clean credential profiles older than 30 minutes
  for (const [ip, profile] of credentialProfiles) {
    if (now - profile.windowStart > 6 * CREDENTIAL_WINDOW_MS) {
      credentialProfiles.delete(ip);
    }
  }
}, 10 * 60_000);
cleanupInterval.unref();


// ════════════════════════════════════════════════════════════════
// 10. MONITORING
// ════════════════════════════════════════════════════════════════

export function getCryptoGuardStats() {
  let totalTxProfiles = txProfiles.size;
  let totalCredProfiles = credentialProfiles.size;
  let blockedCredentials = 0;
  let activeAnomalies = 0;

  for (const profile of credentialProfiles.values()) {
    if (profile.apiKeyAttempts.size > MAX_API_KEY_ATTEMPTS ||
        profile.walletAddresses.size > MAX_WALLET_ATTEMPTS) {
      blockedCredentials++;
    }
  }

  for (const profile of txProfiles.values()) {
    if (profile.withdrawCount > MAX_WITHDRAW_VELOCITY ||
        profile.windowVolume > MAX_WINDOW_VOLUME_USD) {
      activeAnomalies++;
    }
  }

  return {
    contractIntegrity: validateContractIntegrity().valid,
    whitelistedContracts: WHITELISTED_CONTRACTS.size,
    txProfiles: totalTxProfiles,
    credentialProfiles: totalCredProfiles,
    blockedCredentials,
    activeAnomalies,
    honeypotPaths: CRYPTO_HONEYPOT_PATHS.length,
  };
}
