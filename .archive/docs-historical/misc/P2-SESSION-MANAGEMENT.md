# P2 Security: Enhanced Session Management

## Overview

Enterprise-grade session management with idle timeout, device tracking, and multi-device control to prevent session hijacking and enforce security policies.

## Features

### 1. **Session Fixation Prevention**
- New session ID generated on login
- Old sessions automatically revoked
- Session token rotation on refresh

### 2. **Dual Timeout System**
- **Idle Timeout**: Auto-logout after inactivity (default: 30 minutes)
- **Absolute Timeout**: Max session duration (default: 24 hours)
- Configurable per session

### 3. **Device Tracking**
- Track device name (browser + OS)
- IP address logging
- Device fingerprinting support
- View all active devices

### 4. **Session Revocation**
- Revoke specific sessions
- Logout from all devices
- Logout from other devices (keep current)
- Manual revocation with reason tracking

### 5. **Concurrent Session Limiting**
- Max sessions per user (default: 5)
- Automatic revocation of oldest sessions
- Enterprise-configurable limits

## Database Schema

### UserSession Model
```prisma
model UserSession {
  id                  String    @id @default(uuid())
  userId              Int
  sessionToken        String    @unique // JWT access token hash
  refreshToken        String?   @unique // JWT refresh token hash

  // Device tracking
  ipAddress           String
  userAgent           String?
  deviceFingerprint   String?
  deviceName          String? // e.g., "Chrome on Windows"

  // Session lifecycle
  createdAt           DateTime  @default(now())
  lastActivityAt      DateTime  @default(now())
  expiresAt           DateTime  // Absolute expiration
  revokedAt           DateTime? // Manual revocation
  revokedReason       String?

  // Security flags
  isActive            Boolean   @default(true)
  idleTimeoutMinutes  Int       @default(30)
}
```

## API Endpoints (tRPC)

### List Active Sessions
```typescript
const sessions = await trpc.sessionManagement.listSessions.query();
// Returns: [{ id, deviceName, ipAddress, lastActivityAt, createdAt, expiresAt, isCurrent }]
```

### Get Current Session
```typescript
const session = await trpc.sessionManagement.getCurrentSession.query();
// Returns: { id, deviceName, ipAddress, lastActivityAt, expiresAt, idleTimeoutMinutes }
```

### Revoke Specific Session
```typescript
await trpc.sessionManagement.revokeSession.mutate({
  sessionId: 'uuid-here',
  reason: 'Suspicious activity detected'
});
```

### Logout from All Devices
```typescript
const result = await trpc.sessionManagement.revokeAllSessions.mutate({
  reason: 'Password changed'
});
// Returns: { success: true, revokedCount: 3 }
```

### Logout from Other Devices
```typescript
const result = await trpc.sessionManagement.revokeOtherSessions.mutate({
  reason: 'Security cleanup'
});
// Returns: { success: true, revokedCount: 2 }
```

### Get Session Statistics
```typescript
const stats = await trpc.sessionManagement.getSessionStats.query();
// Returns: { totalSessions, activeSessions, expiringSoon }
```

## Backend Integration

### Session Creation (on Login)
```typescript
import { createSession } from './security/session-manager';

// After successful authentication
const session = await createSession({
  userId: user.id,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  deviceFingerprint: extractFingerprint(req),
});

// Set cookies
res.cookie('jwt_token', session.accessToken, cookieOptions);
res.cookie('jwt_refresh', session.refreshToken, refreshCookieOptions);
```

### Session Validation (Middleware)
```typescript
import { enhancedSessionValidation } from './middleware/session-middleware';

// Apply to authenticated routes
app.use(enhancedSessionValidation);

// Or specific routes
app.get('/api/protected', enhancedSessionValidation, handler);
```

### Session Refresh (Token Rotation)
```typescript
import { refreshSession } from './security/session-manager';

// On refresh token request
const result = await refreshSession(refreshToken);

if (result.success) {
  // Update cookies with new tokens
  res.cookie('jwt_token', result.accessToken, cookieOptions);
  res.cookie('jwt_refresh', result.newRefreshToken, refreshCookieOptions);
}
```

## Configuration

### Environment Variables
```env
# Idle timeout (minutes)
SESSION_IDLE_TIMEOUT_MINUTES=30

# Absolute timeout (hours)
SESSION_ABSOLUTE_TIMEOUT_HOURS=24

# Max concurrent sessions per user
MAX_CONCURRENT_SESSIONS=5

# Device tracking
ENABLE_DEVICE_TRACKING=true

# Cleanup interval (minutes)
SESSION_CLEANUP_INTERVAL_MINUTES=60

# Auto-revoke idle sessions
SESSION_AUTO_REVOKE_IDLE=true
```

## Worker Jobs

### Session Cleanup Worker
**File**: `server/workers/session-cleanup-worker.ts`

**Schedule**: Every 60 minutes (configurable)

**Tasks**:
1. Auto-revoke idle sessions (past idle timeout)
2. Delete expired sessions (past absolute timeout)
3. Cleanup old revoked sessions (>30 days)

**Usage**:
```typescript
import { scheduleSessionCleanup } from './workers/session-cleanup-worker';

// Start cleanup scheduler
scheduleSessionCleanup();
```

## Usage Examples

### Scenario 1: User Views Active Devices
```typescript
// Frontend: List active sessions
const sessions = await trpc.sessionManagement.listSessions.query();

// Display in UI
sessions.forEach(session => {
  console.log(`Device: ${session.deviceName}`);
  console.log(`IP: ${session.ipAddress}`);
  console.log(`Last active: ${session.lastActivityAt}`);
  console.log(`Current: ${session.isCurrent ? 'Yes' : 'No'}`);
});
```

### Scenario 2: User Suspects Account Compromise
```typescript
// Immediately logout from all devices
await trpc.sessionManagement.revokeAllSessions.mutate({
  reason: 'Suspicious activity detected'
});

// User will need to log in again on all devices
```

### Scenario 3: Idle Session Auto-Logout
```
User logs in at 9:00 AM
User browses until 9:15 AM
User leaves computer idle
9:45 AM: Idle timeout (30 min) reached
System auto-revokes session
User returns at 10:00 AM
→ Prompted to log in again (session expired)
```

### Scenario 4: Multiple Device Login
```
User logs in from:
1. Desktop (Chrome on Windows)
2. Laptop (Firefox on macOS)
3. Phone (Safari on iOS)
4. Tablet (Chrome on Android)
5. Work computer (Edge on Windows)

User tries to log in from 6th device:
→ Oldest session (Desktop) automatically revoked
→ New session created for 6th device
→ User maintains 5 concurrent sessions (limit)
```

### Scenario 5: Session Refresh Flow
```
User logs in (access token valid for 1 hour)
After 55 minutes: Frontend detects token expiring soon
Frontend calls refresh endpoint with refresh token
Backend validates refresh token
→ Generates new access token
→ Generates new refresh token (rotation)
→ Updates session in database
→ Returns new tokens to frontend
Frontend stores new tokens
→ User continues working without interruption
```

## Security Benefits

### 1. **Session Hijacking Prevention**
- Tokens stored as hashed (not plaintext)
- Session fixation protection (new ID on login)
- Automatic timeout enforcement
- Device tracking for suspicious activity detection

### 2. **Account Takeover Protection**
- Concurrent session limits
- Manual revocation from any device
- Idle timeout prevents abandoned sessions
- Audit trail of all session activity

### 3. **Compliance**
- Session expiration (PCI-DSS, HIPAA)
- Inactivity timeout (SOC 2, ISO 27001)
- Audit logging (all session changes)
- Device tracking (forensic investigation)

### 4. **User Control**
- View all active devices
- Remote logout capability
- Session management dashboard
- Security notifications

## Idle vs Absolute Timeout

### Idle Timeout (30 minutes default)
- **Trigger**: No activity for X minutes
- **Purpose**: Prevent abandoned sessions
- **Example**: User leaves desk, session expires after 30 min idle
- **Resets on**: Any API request (activity tracking)

### Absolute Timeout (24 hours default)
- **Trigger**: Session age exceeds X hours
- **Purpose**: Force periodic re-authentication
- **Example**: User actively working, session expires after 24 hours
- **No reset**: Always expires at createdAt + timeout

### Combined Effect
```
User logs in at 9:00 AM
Absolute expiration: Tomorrow 9:00 AM (24 hours)
Idle expiration: Rolling 30-minute window

Timeline:
9:00 AM - Login (both timers start)
9:15 AM - Activity (idle timer resets to 9:45 AM)
9:30 AM - Activity (idle timer resets to 10:00 AM)
10:00 AM - No activity for 30 min → IDLE TIMEOUT (logged out)

OR (if active all day):

9:00 AM - Login
... continuous activity throughout day ...
8:59 AM next day - Still active
9:00 AM next day - ABSOLUTE TIMEOUT (logged out after 24h)
```

## Best Practices

### For Users
1. **Log out** when finished (don't rely on timeout)
2. **Review active sessions** regularly
3. **Revoke unknown sessions** immediately
4. **Enable notifications** for new logins
5. **Use different passwords** per device

### For Developers
1. **Track activity** on every API request
2. **Implement grace period** before hard logout (warn user)
3. **Refresh tokens proactively** (before expiration)
4. **Log session events** for security analysis
5. **Test timeout scenarios** thoroughly

### For Administrators
1. **Configure timeouts** based on security needs
2. **Monitor session patterns** for anomalies
3. **Enforce session limits** for high-value accounts
4. **Review revoked sessions** for suspicious activity
5. **Run cleanup worker** regularly

## Migration Guide

### Step 1: Database Migration
```bash
# Run Prisma migration
npx prisma migrate dev --name add_user_sessions

# Verify schema
npx prisma studio
```

### Step 2: Integrate Session Creation
```typescript
// Update login endpoint
import { createSession } from './security/session-manager';

// In your login handler:
const session = await createSession({
  userId: user.id,
  ipAddress: getClientIp(req),
  userAgent: req.headers['user-agent'],
});

res.cookie('jwt_token', session.accessToken, cookieOptions);
res.cookie('jwt_refresh', session.refreshToken, refreshCookieOptions);
```

### Step 3: Add Validation Middleware
```typescript
import { enhancedSessionValidation } from './middleware/session-middleware';

// Apply globally or per-route
app.use('/api', enhancedSessionValidation);
```

### Step 4: Start Cleanup Worker
```typescript
import { scheduleSessionCleanup } from './workers/session-cleanup-worker';

// In your server startup:
scheduleSessionCleanup();
```

### Step 5: Frontend Integration
```typescript
// Add session management to user settings
<SessionManagement>
  <ActiveSessions />
  <LogoutFromAllDevices />
</SessionManagement>
```

## Troubleshooting

### Q: Users getting logged out too frequently?
**A**: Increase `SESSION_IDLE_TIMEOUT_MINUTES` or ensure frontend tracks activity:
```typescript
// Ping backend periodically to keep session alive
setInterval(() => {
  trpc.sessionManagement.getCurrentSession.query();
}, 5 * 60 * 1000); // Every 5 minutes
```

### Q: Session cleanup not running?
**A**: Verify worker is started:
```typescript
import { runSessionCleanup } from './workers/session-cleanup-worker';

// Manual run for testing
await runSessionCleanup();
```

### Q: Users can't refresh tokens?
**A**: Check refresh token validation in session manager:
```typescript
const result = await refreshSession(refreshToken);
if (!result.success) {
  console.log('Refresh failed:', result.error);
}
```

### Q: How to handle concurrent logins from same device?
**A**: Increase `MAX_CONCURRENT_SESSIONS` or implement device fingerprinting:
```typescript
// Generate device fingerprint from headers
const fingerprint = crypto
  .createHash('sha256')
  .update(`${userAgent}:${acceptLanguage}:${platform}`)
  .digest('hex');
```

## Monitoring & Alerts

### Metrics to Track
- Active sessions per user
- Session creation rate
- Revocation rate (manual vs automatic)
- Idle timeout frequency
- Failed refresh attempts

### Alert Conditions
- High session creation rate (potential attack)
- Many concurrent sessions for single user
- Unusual device/IP combinations
- High idle timeout rate (poor UX indicator)

## Related Documentation
- [IP Whitelist Control](./P2-IP-WHITELIST-CONTROL.md)
- [API Key Auto-Rotation](./P2-API-KEY-AUTO-ROTATION.md)
- [Rate Limiting](./P1-RATE-LIMITING.md)
