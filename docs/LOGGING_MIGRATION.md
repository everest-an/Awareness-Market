# Logging System Migration Guide

## Overview

This guide documents the migration from `console.log` to the unified logging system (`logger`) for improved production logging, structured data, and better debugging capabilities.

---

## Why Migrate?

### Problems with `console.log`

❌ **No log levels** - Everything is the same priority
❌ **No structure** - Hard to parse logs programmatically
❌ **No timestamps** - Can't tell when events occurred
❌ **No context** - Missing metadata about the operation
❌ **Production issues** - Console logs don't integrate with log aggregators

### Benefits of Unified Logger

✅ **Log levels** (DEBUG, INFO, WARN, ERROR) for filtering
✅ **Structured logging** with JSON output in production
✅ **Automatic timestamps** for all log entries
✅ **Context objects** for rich metadata
✅ **Environment-aware** - verbose in dev, concise in prod
✅ **Prefixed loggers** for module identification
✅ **Color-coded output** in development

---

## Quick Start

### Import the Logger

```typescript
import { logger } from './utils/logger';
// OR create a prefixed logger for your module
import { createLogger } from './utils/logger';
const dbLogger = createLogger('Database');
```

### Basic Usage

```typescript
// Before
console.log('User logged in');
console.error('Database connection failed');
console.warn('Cache miss');

// After
logger.info('User logged in');
logger.error('Database connection failed');
logger.warn('Cache miss');
```

### With Context

```typescript
// Before
console.log('User logged in', userId);
console.error('Database error:', error);

// After
logger.info('User logged in', { userId, email: user.email });
logger.error('Database connection failed', {
  error,
  host: dbConfig.host,
  retryCount: 3
});
```

---

## Migration Patterns

### Pattern 1: Simple Console Logs

```typescript
// ❌ Before
console.log('Server started on port 3000');

// ✅ After
logger.info('Server started', { port: 3000 });
```

### Pattern 2: Error Logging

```typescript
// ❌ Before
console.error('Failed to connect:', error);

// ✅ After
logger.error('Failed to connect to database', { error });
```

### Pattern 3: Debug Information

```typescript
// ❌ Before
console.log('[Debug] Cache hit for key:', key);

// ✅ After
logger.debug('Cache hit', { key, ttl: 3600 });
```

### Pattern 4: Module-Specific Logging

```typescript
// ❌ Before
console.log('[Auth] User authenticated:', userId);
console.log('[Auth] Token generated');

// ✅ After
const authLogger = createLogger('Auth');
authLogger.info('User authenticated', { userId });
authLogger.info('Token generated', { expiresIn: '7d' });
```

### Pattern 5: String Interpolation

```typescript
// ❌ Before
console.log(`Processing ${count} items`);

// ✅ After
logger.info('Processing items', { count });
```

### Pattern 6: Conditional Logging

```typescript
// ❌ Before
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data);
}

// ✅ After
logger.debug('Debug info', { data });
// DEBUG logs are automatically filtered out in production
```

### Pattern 7: Webhook/External Events

```typescript
// ❌ Before
console.log(`[Webhook] Received ${event.type} event`);

// ✅ After
const webhookLogger = createLogger('Webhook');
webhookLogger.info('Event received', {
  eventType: event.type,
  eventId: event.id
});
```

### Pattern 8: Startup Messages

```typescript
// ❌ Before
console.log('🚀 Awareness Network Server');
console.log('==========================');
console.log('Environment:', process.env.NODE_ENV);

// ✅ After
logger.info('Awareness Network Server starting', {
  environment: process.env.NODE_ENV,
  version: packageJson.version
});
```

---

## Log Level Guidelines

### DEBUG (Development Only)

Use for verbose information useful during development:
- Cache operations (hit/miss)
- Query parameters
- Intermediate calculations
- Function entry/exit

```typescript
logger.debug('Cache lookup', { key, result: 'hit' });
logger.debug('Calculating alignment', { sourceDim, targetDim });
```

### INFO (General Information)

Use for noteworthy events that are normal:
- Server startup/shutdown
- User actions (login, logout, purchase)
- API requests (in development)
- Successful operations

```typescript
logger.info('Server listening', { port: 3000 });
logger.info('User purchased package', { userId, packageId });
```

### WARN (Potential Issues)

Use for unexpected situations that don't prevent operation:
- Fallback behavior triggered
- Deprecated feature usage
- Missing optional configuration
- Rate limit approaching

```typescript
logger.warn('API key missing, using local generation');
logger.warn('Rate limit approaching', { remaining: 10, limit: 100 });
```

### ERROR (Errors and Exceptions)

Use for errors that prevent normal operation:
- Database connection failures
- API errors
- Validation failures
- Unhandled exceptions

```typescript
logger.error('Database connection failed', { error, host });
logger.error('Payment processing failed', { error, orderId });
```

---

## Module-Specific Loggers

Create prefixed loggers for better organization:

```typescript
// server/auth-standalone.ts
const authLogger = createLogger('Auth');
authLogger.info('User registered', { userId });

// server/stripe-webhook.ts
const stripeLogger = createLogger('Stripe');
stripeLogger.info('Webhook received', { eventType });

// server/db-connection.ts
const dbLogger = createLogger('Database');
dbLogger.info('Connection established', { host });

// server/neural-bridge/wa-alignment-operator.ts
const alignmentLogger = createLogger('Neural Bridge:Alignment');
alignmentLogger.debug('Computing W-matrix', { sourceDim, targetDim });
```

---

## Environment Configuration

Control logging behavior via environment variables:

```bash
# .env
NODE_ENV=development        # Enables DEBUG level, colored output
LOG_LEVEL=DEBUG            # Override default log level
```

### Development Mode

- Log Level: DEBUG (shows everything)
- Output: Colored, human-readable
- Timestamps: ISO format
- Context: Pretty-printed JSON

### Production Mode

- Log Level: INFO (hides DEBUG)
- Output: JSON (one line per log)
- Timestamps: ISO format
- Context: Inline in JSON

### Example Production Log

```json
{"timestamp":"2025-01-28T10:30:45.123Z","level":"INFO","message":"User purchased package","userId":123,"packageId":"vec_abc123"}
```

---

## Migration Progress

Track migration progress by file:

### Core Server (Priority 1)
- [ ] `server/_core/index.ts` (8 instances)
- [ ] `server/db-connection.ts` (11 instances)
- [ ] `server/db.ts` (16 instances)

### Authentication (Priority 2)
- [ ] `server/auth-standalone.ts`
- [ ] `server/auth-oauth.ts`
- [ ] `server/auth-erc8004.ts`

### Payment & Webhooks (Priority 3)
- [ ] `server/stripe-webhook.ts` (21 instances)
- [ ] `server/purchase-api.ts` (4 instances)

### Neural Bridge (Priority 4)
- [ ] `server/neural-bridge-core.ts`
- [ ] `server/neural-bridge/*` (various files)

### Storage (Priority 5)
- [ ] `server/storage/*` (various backends)

---

## Testing

Verify logger behavior:

```bash
npm run test server/utils/logger.test.ts
```

---

## Best Practices

### ✅ DO

- Use appropriate log levels
- Include context objects with metadata
- Create module-specific loggers
- Log user actions with user IDs
- Log errors with error objects
- Use structured data over string concatenation

### ❌ DON'T

- Log sensitive data (passwords, tokens, full credit cards)
- Log in tight loops (causes performance issues)
- Use console.log directly anymore
- Include stack traces in INFO logs
- Log the same event multiple times

### Security Considerations

```typescript
// ❌ NEVER log sensitive data
logger.info('User login', {
  email: user.email,
  password: user.password  // ❌ SECURITY RISK
});

// ✅ Log safely
logger.info('User login', {
  userId: user.id,
  email: user.email,
  // password is not logged
});

// ✅ Sanitize errors before logging
logger.error('Payment failed', {
  error: sanitizeError(error),  // Remove sensitive fields
  orderId: order.id
});
```

---

## Rollout Plan

### Phase 1: Foundation (Week 1)
- ✅ Create logger utility
- ✅ Write tests
- ✅ Document migration guide
- ⏳ Migrate core server files

### Phase 2: Critical Paths (Week 2)
- ⏳ Migrate authentication
- ⏳ Migrate payment processing
- ⏳ Migrate database layer

### Phase 3: Features (Week 3)
- ⏳ Migrate Neural Bridge modules
- ⏳ Migrate API routers
- ⏳ Migrate storage backends

### Phase 4: Cleanup (Week 4)
- ⏳ Migrate remaining files
- ⏳ Add linter rule to prevent console.log
- ⏳ Update CI/CD to check for violations

---

## Troubleshooting

### Issue: Logs not appearing

**Solution:** Check LOG_LEVEL environment variable:
```bash
export LOG_LEVEL=DEBUG
```

### Issue: Colors not working

**Solution:** Ensure running in a TTY:
```bash
# Check if stdout is a TTY
node -e "console.log(process.stdout.isTTY)"
```

### Issue: JSON logs in development

**Solution:** Ensure NODE_ENV is set correctly:
```bash
export NODE_ENV=development
```

---

## Resources

- **Logger Source:** `server/utils/logger.ts`
- **Logger Tests:** `server/utils/logger.test.ts`
- **Migration Script:** `scripts/migrate-console-logs.sh` (future)
- **ESLint Rule:** `.eslintrc.js` (future - block console.log)

---

## Questions?

- Check existing migrated files for examples
- Review logger tests for usage patterns
- Open an issue if you encounter edge cases

---

**Migration Status:** In Progress (3 of 66 files migrated)
**Last Updated:** 2025-01-28
