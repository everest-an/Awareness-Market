# P1+P2 Security Deployment Guide

Complete deployment guide for all security enhancements (P1 + P2).

## Table of Contents
- [Environment Configuration](#environment-configuration)
- [Database Migration](#database-migration)
- [Worker Setup](#worker-setup)
- [Middleware Integration](#middleware-integration)
- [Testing & Verification](#testing--verification)
- [Monitoring & Maintenance](#monitoring--maintenance)

---

## Environment Configuration

### Required Environment Variables

Create or update `.env` file with the following:

```env
# ============================================================================
# Core Configuration
# ============================================================================
DATABASE_URL=postgresql://user:password@localhost:5432/awareness_network
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# JWT Authentication
JWT_SECRET=your_super_secure_jwt_secret_min_32_chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# ============================================================================
# P1 Security: Data Encryption (Audit Logs)
# ============================================================================
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_char_hex_encryption_key_here

# Optional: Multiple keys for rotation
# ENCRYPTION_KEY_AUDIT=another_64_char_hex_key
# ENCRYPTION_KEY_PII=another_64_char_hex_key

# ============================================================================
# P1 Security: Database Backup
# ============================================================================
BACKUP_PATH=/tmp/backups
S3_BACKUP_BUCKET=awareness-network-backups
S3_BACKUP_PREFIX=postgresql
BACKUP_RETENTION_DAYS=30
BACKUP_VERIFICATION=true
ENABLE_BACKUP_RESTORE_TEST=false
BACKUP_NOTIFICATION_EMAIL=admin@your-domain.com

# AWS Credentials for S3 backup
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1

# ============================================================================
# P1 Security: Rate Limiting
# ============================================================================
# Global API rate limit (requests per 15 minutes per IP)
GLOBAL_API_RATE_LIMIT=100

# Auth endpoint rate limit (attempts per 15 minutes per IP)
AUTH_RATE_LIMIT=5

# Password reset rate limit (requests per hour per IP)
PASSWORD_RESET_RATE_LIMIT=3

# ============================================================================
# P2 Security: API Key Auto-Rotation
# ============================================================================
# Enable auto-rotation (default: true)
ENABLE_AUTO_KEY_ROTATION=true

# Check interval in hours (default: 6)
KEY_ROTATION_CHECK_INTERVAL=6

# Notification email for key rotation alerts
KEY_ROTATION_NOTIFICATION_EMAIL=admin@your-domain.com

# ============================================================================
# P2 Security: Session Management
# ============================================================================
# Idle timeout (minutes) - auto-logout after inactivity
SESSION_IDLE_TIMEOUT_MINUTES=30

# Absolute timeout (hours) - max session duration
SESSION_ABSOLUTE_TIMEOUT_HOURS=24

# Max concurrent sessions per user
MAX_CONCURRENT_SESSIONS=5

# Device tracking
ENABLE_DEVICE_TRACKING=true

# Cleanup interval (minutes)
SESSION_CLEANUP_INTERVAL_MINUTES=60

# Auto-revoke idle sessions
SESSION_AUTO_REVOKE_IDLE=true

# ============================================================================
# Email Service (for notifications)
# ============================================================================
EMAIL_SERVICE=sendgrid  # or 'ses', 'smtp'
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=noreply@your-domain.com

# For AWS SES
# AWS_SES_REGION=us-east-1

# For SMTP
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your_email@gmail.com
# SMTP_PASSWORD=your_app_password
```

### Generate Encryption Key

```bash
# Generate a secure 256-bit encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example output: `8f7d2a1b9e4c3f6a5d8b7e2a9c4f1b6d3e8a5c7f2b4d9e1a6c8f3b5d7e2a4c6f`

---

## Database Migration

### Step 1: Run Prisma Migrations

```bash
# Development
npx prisma migrate dev --name add_security_enhancements

# Production
npx prisma migrate deploy
```

### Step 2: Verify Schema

```bash
# Open Prisma Studio to verify
npx prisma studio
```

**Expected New Tables:**
- `api_key_rotation_history`
- `ip_whitelists`
- `ip_access_logs`
- `user_sessions`

**Modified Tables:**
- `api_keys` (added auto-rotation fields)
- `users` (added listing quota fields)

### Step 3: Run Backfill Scripts (if upgrading)

```bash
# Backfill V1/V2 user quotas
npx tsx scripts/migrate-v1-marketplace-quotas.ts

# Verify backfill
psql $DATABASE_URL -c "SELECT email, max_listings, current_listing_count FROM users LIMIT 10;"
```

---

## Worker Setup

### Option 1: Manual Worker Processes

Create `server/workers/index.ts`:

```typescript
import { scheduleBackups } from './backup-worker';
import { scheduleKeyRotation } from './api-key-rotation-worker';
import { scheduleSessionCleanup } from './session-cleanup-worker';

// Start all workers
export function startWorkers() {
  console.log('Starting security workers...');

  scheduleBackups();
  scheduleKeyRotation();
  scheduleSessionCleanup();

  console.log('✅ All workers started');
}
```

In `server/index.ts`:
```typescript
import { startWorkers } from './workers';

// After server starts
startWorkers();
```

### Option 2: BullMQ Integration (Recommended)

Install BullMQ (already in dependencies):
```bash
pnpm add bullmq
```

Create `server/workers/queue-setup.ts`:
```typescript
import { Queue, Worker } from 'bullmq';
import { runBackupJob } from './backup-worker';
import { runRotationJob } from './api-key-rotation-worker';
import { runSessionCleanup } from './session-cleanup-worker';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
};

// Create queues
export const backupQueue = new Queue('backups', { connection: redisConnection });
export const rotationQueue = new Queue('key-rotation', { connection: redisConnection });
export const sessionCleanupQueue = new Queue('session-cleanup', { connection: redisConnection });

// Create workers
export const backupWorker = new Worker('backups', async () => {
  await runBackupJob();
}, { connection: redisConnection });

export const rotationWorker = new Worker('key-rotation', async () => {
  await runRotationJob();
}, { connection: redisConnection });

export const sessionCleanupWorker = new Worker('session-cleanup', async () => {
  await runSessionCleanup();
}, { connection: redisConnection });

// Schedule recurring jobs (cron-like)
export async function scheduleSecurityJobs() {
  // Database backup: Daily at 3 AM
  await backupQueue.add('daily-backup', {}, {
    repeat: { pattern: '0 3 * * *' },
  });

  // API key rotation check: Every 6 hours
  await rotationQueue.add('rotation-check', {}, {
    repeat: { pattern: '0 */6 * * *' },
  });

  // Session cleanup: Every hour
  await sessionCleanupQueue.add('cleanup', {}, {
    repeat: { pattern: '0 * * * *' },
  });

  console.log('✅ Security jobs scheduled');
}
```

---

## Middleware Integration

### Step 1: Apply Rate Limiting

In `server/index.ts` or your Express app:

```typescript
import { apiLimiter, authLimiter, passwordResetLimiter } from './middleware/rate-limiter';

// Global rate limiting (after CORS, before routes)
app.use('/api', apiLimiter);

// Auth endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/password-reset', passwordResetLimiter);
```

### Step 2: Apply Input Validation

```typescript
import { sanitizeInputMiddleware } from './middleware/input-validator';

// Sanitize all inputs (after body parser)
app.use(sanitizeInputMiddleware);
```

### Step 3: Apply IP Whitelist (Optional)

```typescript
import { ipWhitelistMiddleware } from './middleware/ip-whitelist';

// Apply to authenticated routes only
app.use('/api/protected', ipWhitelistMiddleware);

// Or apply globally after authentication
app.use(authenticateUser, ipWhitelistMiddleware);
```

### Step 4: Apply Session Validation

```typescript
import { enhancedSessionValidation } from './middleware/session-middleware';

// Replace or augment existing JWT validation
app.use('/api', enhancedSessionValidation);
```

### Middleware Order (Important!)

```typescript
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { apiLimiter, authLimiter } from './middleware/rate-limiter';
import { sanitizeInputMiddleware } from './middleware/input-validator';
import { enhancedSessionValidation } from './middleware/session-middleware';
import { ipWhitelistMiddleware } from './middleware/ip-whitelist';

const app = express();

// 1. CORS (first)
app.use(cors());

// 2. Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. Rate limiting (before auth)
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);

// 4. Input sanitization (after body parser)
app.use(sanitizeInputMiddleware);

// 5. Session validation (includes auth)
app.use('/api', enhancedSessionValidation);

// 6. IP whitelist (after auth)
app.use('/api', ipWhitelistMiddleware);

// 7. Your routes
app.use('/api', yourRoutes);
```

---

## Testing & Verification

### Step 1: Test Encryption

```typescript
// Test encryption setup
import { generateEncryptionKey, testEncryption } from './server/utils/encryption';

// Generate key (if not done)
console.log('Encryption key:', generateEncryptionKey());

// Test encryption/decryption
const works = testEncryption();
console.log('Encryption test:', works ? '✅ PASS' : '❌ FAIL');
```

### Step 2: Test Rate Limiting

```bash
# Test global API rate limit (100 req/15min)
for i in {1..110}; do
  curl -X GET http://localhost:3000/api/health
done
# Expected: First 100 succeed, then 429 errors

# Test auth rate limit (5 attempts/15min)
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
# Expected: First 5 attempts processed, then 429 errors
```

### Step 3: Test API Key Rotation

```typescript
// In Node.js console or test script
import { trpc } from './client/trpc';

// Create key with auto-rotation
const key = await trpc.apiKeys.create.mutate({
  name: 'Test Key',
  permissions: ['*'],
  autoRotationEnabled: true,
  rotationIntervalDays: 1, // 1 day for testing
});

console.log('Key created:', key);

// Wait 24 hours or manually trigger rotation
await trpc.apiKeys.rotate.mutate({
  keyId: key.id,
  reason: 'Manual test',
});

// Check rotation history
const history = await trpc.apiKeys.getRotationHistory.query({
  keyId: key.id,
});

console.log('Rotation history:', history);
```

### Step 4: Test IP Whitelist

```typescript
// Add your current IP
await trpc.ipWhitelist.add.mutate({
  userId: ctx.user.id,
  ipAddress: '192.168.1.100',
  description: 'Test IP',
});

// Try accessing from different IP
// Expected: 403 Forbidden

// Check access logs
const logs = await trpc.ipWhitelist.accessLogs.query({
  blocked: true,
  limit: 10,
});

console.log('Blocked attempts:', logs);
```

### Step 5: Test Session Management

```typescript
// List active sessions
const sessions = await trpc.sessionManagement.listSessions.query();
console.log('Active sessions:', sessions);

// Logout from all devices
await trpc.sessionManagement.revokeAllSessions.mutate({
  reason: 'Security test',
});

// Verify logout
// Expected: All sessions revoked, must log in again
```

### Step 6: Test Database Backup

```bash
# Manual backup test
node -e "
const { runBackupJob } = require('./server/workers/backup-worker');
runBackupJob().then(() => console.log('✅ Backup completed'));
"

# Check backup in S3
aws s3 ls s3://awareness-network-backups/postgresql/

# Verify backup file
aws s3 cp s3://awareness-network-backups/postgresql/backup-latest.dump.gz /tmp/
gunzip /tmp/backup-latest.dump.gz
pg_restore -l /tmp/backup-latest.dump
```

---

## Monitoring & Maintenance

### Step 1: Set Up Health Checks

Create `server/routers/health.ts`:

```typescript
import { router, publicProcedure } from '../trpc';
import { isEncryptionConfigured } from '../utils/encryption';
import { prisma } from '../db-prisma';
import { redis } from '../middleware/rate-limiter';

export const healthRouter = router({
  check: publicProcedure.query(async () => {
    const checks = {
      database: false,
      redis: false,
      encryption: false,
    };

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Check Redis
    try {
      await redis.ping();
      checks.redis = true;
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    // Check encryption
    checks.encryption = isEncryptionConfigured();

    const allHealthy = Object.values(checks).every(Boolean);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }),
});
```

### Step 2: Monitor Worker Jobs

```typescript
// Add logging to worker jobs
import { createLogger } from './utils/logger';

const logger = createLogger('WorkerMonitoring');

// In each worker
export async function runBackupJob() {
  const startTime = Date.now();
  logger.info('Backup job started');

  try {
    const result = await createBackup();
    logger.info('Backup job completed', {
      duration: Date.now() - startTime,
      sizeBytes: result.sizeBytes,
      checksum: result.checksumSHA256,
    });
  } catch (error) {
    logger.error('Backup job failed', { error, duration: Date.now() - startTime });
    // Send alert notification
  }
}
```

### Step 3: Set Up Alerts

Create `server/monitoring/alerts.ts`:

```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('Alerts');

export async function sendAlert(params: {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}) {
  logger[params.severity === 'info' ? 'info' : params.severity === 'warning' ? 'warn' : 'error'](
    params.title,
    { message: params.message, ...params.metadata }
  );

  // TODO: Integrate with alerting service
  // - Email (SendGrid, AWS SES)
  // - Slack webhook
  // - PagerDuty
  // - Datadog
}

// Alert conditions
export async function checkSecurityAlerts() {
  // 1. High rate of blocked IPs
  const blockedStats = await getBlockedIpStats({ sinceHours: 1 });
  if (blockedStats.totalBlocked > 100) {
    await sendAlert({
      severity: 'warning',
      title: 'High Rate of Blocked IPs',
      message: `${blockedStats.totalBlocked} requests blocked in last hour`,
      metadata: blockedStats,
    });
  }

  // 2. Failed backup job
  // (Already handled in backup worker)

  // 3. High number of expired sessions
  const expiredCount = await prisma.userSession.count({
    where: { revokedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (expiredCount > 50) {
    await sendAlert({
      severity: 'info',
      title: 'High Session Expiration Rate',
      message: `${expiredCount} sessions expired in last hour`,
    });
  }
}
```

### Step 4: Metrics Dashboard

Use Prometheus + Grafana or similar:

**Key Metrics to Track:**
- Rate limit rejections per endpoint
- Blocked IP attempts per hour
- API key rotation success/failure rate
- Session timeout frequency (idle vs absolute)
- Database backup success rate
- Encryption/decryption performance

**Example Prometheus Metrics:**

```typescript
import { register, Counter, Histogram } from 'prom-client';

export const rateLimitRejections = new Counter({
  name: 'rate_limit_rejections_total',
  help: 'Total rate limit rejections',
  labelNames: ['endpoint', 'ip'],
});

export const sessionValidations = new Histogram({
  name: 'session_validation_duration_seconds',
  help: 'Session validation duration',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
});

export const ipWhitelistBlocks = new Counter({
  name: 'ip_whitelist_blocks_total',
  help: 'Total IP whitelist blocks',
  labelNames: ['user_id', 'ip'],
});
```

---

## Maintenance Checklist

### Daily
- [ ] Check backup job logs (3 AM daily)
- [ ] Review blocked IP statistics
- [ ] Monitor rate limit rejections

### Weekly
- [ ] Review API key rotation logs
- [ ] Check session cleanup stats
- [ ] Verify encryption key status
- [ ] Review security alerts

### Monthly
- [ ] Audit active sessions per user
- [ ] Review IP whitelist entries (remove stale)
- [ ] Test backup restore procedure
- [ ] Update security documentation

### Quarterly
- [ ] Rotate encryption keys (if needed)
- [ ] Review and update rate limits
- [ ] Security penetration testing
- [ ] Update dependencies (`npm audit`)

---

## Troubleshooting

### Workers Not Running
```bash
# Check process
ps aux | grep node

# Check logs
tail -f logs/workers.log

# Restart workers
pm2 restart workers
```

### Rate Limit Not Working
```bash
# Check Redis connection
redis-cli -h localhost -p 6379 ping

# Check rate limit keys
redis-cli -h localhost -p 6379 keys "rl:*"

# Check rate limit value
redis-cli -h localhost -p 6379 get "rl:api:192.168.1.1"
```

### Encryption Errors
```bash
# Verify encryption key is set
echo $ENCRYPTION_KEY

# Test encryption
node -e "
const { testEncryption } = require('./server/utils/encryption');
console.log('Encryption works:', testEncryption());
"
```

### Session Timeout Issues
```sql
-- Check active sessions
SELECT
  u.email,
  COUNT(*) as session_count,
  MAX(s.last_activity_at) as last_activity
FROM user_sessions s
JOIN users u ON s.user_id = u.id
WHERE s.is_active = true
GROUP BY u.email
ORDER BY session_count DESC;

-- Check expired sessions
SELECT COUNT(*) FROM user_sessions
WHERE expires_at < NOW();
```

---

## Security Audit Log

Track all security-related changes:

| Date | Change | Reason | Performed By |
|------|--------|--------|--------------|
| 2024-XX-XX | Enabled API key rotation | Security policy | Admin |
| 2024-XX-XX | Added IP whitelist for org #123 | Remote work policy | Security Team |
| 2024-XX-XX | Reduced session timeout to 15 min | PCI-DSS compliance | Compliance Officer |

---

## Support & Resources

- **P1 Documentation**: [SECURITY_ENHANCEMENTS_P1.md](./SECURITY_ENHANCEMENTS_P1.md)
- **P2 API Key Rotation**: [P2-API-KEY-AUTO-ROTATION.md](./docs/P2-API-KEY-AUTO-ROTATION.md)
- **P2 IP Whitelist**: [P2-IP-WHITELIST-CONTROL.md](./docs/P2-IP-WHITELIST-CONTROL.md)
- **P2 Session Management**: [P2-SESSION-MANAGEMENT.md](./docs/P2-SESSION-MANAGEMENT.md)
- **GitHub Issues**: https://github.com/everest-an/Awareness-Market/issues

---

**Last Updated**: 2024-01-XX
**Version**: 1.0.0
**Status**: Production Ready ✅
