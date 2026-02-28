# P2 Security: IP Whitelist Control

## Overview

Organization-level and user-level IP whitelisting to restrict API access to trusted networks and prevent unauthorized access.

## Features

### 1. **Multi-Level Control**
- **Organization-level**: All users in the organization must connect from whitelisted IPs
- **User-level**: Individual user IP restrictions
- **Hierarchy**: Organization whitelist + user whitelist = combined allowed IPs

### 2. **Flexible IP Formats**
- **Single IP**: `192.168.1.100`, `2001:db8::1`
- **CIDR notation**: `192.168.1.0/24`, `2001:db8::/32`
- **IP ranges**: `192.168.1.1` - `192.168.1.255`
- **IPv4 and IPv6**: Full support for both protocols

### 3. **Access Logging**
- Track all access attempts (allowed + blocked)
- Audit trail with IP, endpoint, timestamp
- Blocked IP statistics and analytics
- User agent tracking

## Database Schema

### IpWhitelist Model
```prisma
model IpWhitelist {
  id              Int       @id @default(autoincrement())
  organizationId  Int?      // Null for user-level
  userId          Int?      // Null for org-level
  ipAddress       String?   // Single IP (e.g., 192.168.1.100)
  ipRangeStart    String?   // Range start
  ipRangeEnd      String?   // Range end
  cidrNotation    String?   // CIDR (e.g., 192.168.1.0/24)
  description     String?
  isActive        Boolean   @default(true)
  createdBy       Int       // Who created this entry
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### IpAccessLog Model
```prisma
model IpAccessLog {
  id              Int       @id @default(autoincrement())
  userId          Int
  ipAddress       String
  endpoint        String
  method          String
  allowed         Boolean   // true if whitelisted, false if blocked
  whitelistId     Int?      // Which rule matched
  userAgent       String?
  timestamp       DateTime  @default(now())
}
```

## API Endpoints (tRPC)

### Add IP to Whitelist
```typescript
// Organization-level (requires admin/owner role)
await trpc.ipWhitelist.add.mutate({
  organizationId: 123,
  ipAddress: '192.168.1.100',
  description: 'Office network'
});

// User-level
await trpc.ipWhitelist.add.mutate({
  userId: 456,
  cidrNotation: '10.0.0.0/8',
  description: 'Home VPN'
});

// IP range
await trpc.ipWhitelist.add.mutate({
  organizationId: 123,
  ipRangeStart: '192.168.1.1',
  ipRangeEnd: '192.168.1.255',
  description: 'Office subnet'
});
```

### Remove from Whitelist
```typescript
await trpc.ipWhitelist.remove.mutate({
  whitelistId: 789
});
```

### List Organization Whitelist
```typescript
const whitelist = await trpc.ipWhitelist.listOrg.query({
  organizationId: 123,
  includeInactive: false
});
```

### List User Whitelist
```typescript
const whitelist = await trpc.ipWhitelist.listUser.query({
  includeInactive: false
});
```

### View Access Logs
```typescript
const logs = await trpc.ipWhitelist.accessLogs.query({
  blocked: true, // Only show blocked requests
  limit: 100,
  offset: 0
});
```

### Blocked IP Statistics
```typescript
const stats = await trpc.ipWhitelist.blockedStats.query({
  sinceHours: 24
});
// Returns: { totalBlocked, uniqueIps, topBlockedIps }
```

### Validate IP Format
```typescript
const result = await trpc.ipWhitelist.validateIp.query({
  ipAddress: '192.168.1.100'
});
// Returns: { valid, version, normalized, error }
```

### Validate CIDR
```typescript
const result = await trpc.ipWhitelist.validateCIDR.query({
  cidr: '192.168.1.0/24'
});
// Returns: { valid, network, prefix, firstIp, lastIp, error }
```

## Middleware Integration

### Express Middleware
```typescript
import { ipWhitelistMiddleware } from './middleware/ip-whitelist';

// Apply to all authenticated routes
app.use(ipWhitelistMiddleware);

// Or apply to specific routes
app.get('/api/sensitive', ipWhitelistMiddleware, handler);
```

### Organization-Specific Middleware
```typescript
import { createOrgIpWhitelist } from './middleware/ip-whitelist';

app.use('/api/org/123', createOrgIpWhitelist(123));
```

### API Key Middleware
```typescript
import { ipWhitelistApiKeyMiddleware } from './middleware/ip-whitelist';

// Check IP whitelist for API key authentication
app.use('/api/v1', apiKeyAuth, ipWhitelistApiKeyMiddleware);
```

## Usage Examples

### Scenario 1: Enterprise Office Network
```typescript
// Company wants to restrict access to office IP range
await trpc.ipWhitelist.add.mutate({
  organizationId: 1,
  cidrNotation: '203.0.113.0/24',
  description: 'Corporate HQ network'
});

// Add backup office
await trpc.ipWhitelist.add.mutate({
  organizationId: 1,
  cidrNotation: '198.51.100.0/24',
  description: 'Remote office'
});
```

### Scenario 2: Remote Worker with Dynamic IP
```typescript
// User works from home with changing IP
// Use broader range or VPN
await trpc.ipWhitelist.add.mutate({
  userId: 456,
  cidrNotation: '10.8.0.0/16',
  description: 'Corporate VPN'
});
```

### Scenario 3: Geo-Restriction
```typescript
// Restrict to specific country IP ranges
// Example: Australia (203.0.0.0/8 range)
await trpc.ipWhitelist.add.mutate({
  organizationId: 1,
  cidrNotation: '203.0.0.0/8',
  description: 'Australia region only'
});
```

### Scenario 4: Monitoring Blocked Attempts
```typescript
// View recent blocked access attempts
const blocked = await trpc.ipWhitelist.accessLogs.query({
  blocked: true,
  limit: 50
});

// Get statistics
const stats = await trpc.ipWhitelist.blockedStats.query({
  sinceHours: 24
});

console.log(`Blocked ${stats.totalBlocked} requests from ${stats.uniqueIps} IPs`);
console.log('Top offenders:', stats.topBlockedIps);
```

## Security Benefits

### 1. **Network Perimeter Defense**
- Only allow access from trusted networks
- Prevent unauthorized access from unknown locations
- Complementary to authentication (multi-factor)

### 2. **Compliance**
- Meet enterprise security requirements
- Support for SOC 2, ISO 27001 compliance
- Geographic data sovereignty (GDPR)

### 3. **Threat Prevention**
- Block compromised credentials from untrusted locations
- Prevent credential stuffing from botnets
- Reduce attack surface

### 4. **Audit Trail**
- Complete access history
- Track blocked attempts for incident response
- Identify suspicious patterns

## IP Detection

### Proxy Support
The system correctly handles proxied requests:
1. **X-Forwarded-For** header (most common)
2. **X-Real-IP** header (alternative)
3. **Direct socket IP** (fallback)

### IPv6 Support
- Full IPv6 address support
- CIDR notation for IPv6 (e.g., `2001:db8::/32`)
- IPv4-mapped IPv6 addresses handled correctly

## Best Practices

### For Organizations
1. **Use CIDR notation** for networks, not individual IPs
2. **Document each entry** with clear descriptions
3. **Regular audits** - review and remove stale entries
4. **Monitor blocked attempts** - investigate suspicious patterns
5. **Backup access** - maintain multiple allowed networks

### For Users
1. **Use VPN** if working from dynamic IPs
2. **Update whitelist** before travel
3. **Test access** after adding new IPs
4. **Keep entries minimal** - avoid overly broad ranges

### For Developers
1. **Fail open on errors** - don't block legitimate users
2. **Log all blocked attempts** for security analysis
3. **Provide clear error messages** with client IP
4. **Rate limit whitelist changes** to prevent abuse

## Troubleshooting

### Q: Access denied after adding IP?
**A**: Check these:
1. Verify IP format is correct (use `validateIp` endpoint)
2. Ensure IP matches what server sees (check access logs)
3. Check for proxy/load balancer IP translation
4. Verify whitelist entry is `isActive: true`

### Q: How to allow my current IP?
**A**:
```typescript
// Get your current IP from access logs
const logs = await trpc.ipWhitelist.accessLogs.query({ limit: 1 });
const myIp = logs[0].ipAddress;

// Add to whitelist
await trpc.ipWhitelist.add.mutate({
  userId: ctx.user.id,
  ipAddress: myIp,
  description: 'My current IP'
});
```

### Q: Whitelist not working for API keys?
**A**: Make sure `ipWhitelistApiKeyMiddleware` is applied AFTER API key authentication middleware.

### Q: How to disable whitelist temporarily?
**A**:
```typescript
// Deactivate all entries
await prisma.ipWhitelist.updateMany({
  where: { organizationId: 123 },
  data: { isActive: false }
});

// Or delete all entries
await prisma.ipWhitelist.deleteMany({
  where: { organizationId: 123 }
});
```

## Monitoring & Alerts

### Metrics to Track
- Blocked requests per hour
- Unique blocked IPs per day
- Top blocked endpoints
- Whitelist entry count (avoid bloat)

### Alert Conditions
- High number of blocked attempts (potential attack)
- Blocked requests from previously allowed IPs (credential compromise?)
- Rapid whitelist changes (suspicious admin activity)

## Migration Guide

### Enabling Whitelist for Existing Org
```typescript
// 1. Add office network
await trpc.ipWhitelist.add.mutate({
  organizationId: 123,
  cidrNotation: '203.0.113.0/24',
  description: 'Primary office'
});

// 2. Monitor blocked attempts for 24 hours
const blocked = await trpc.ipWhitelist.accessLogs.query({
  blocked: true,
  limit: 1000
});

// 3. Review blocked IPs - add legitimate ones
const stats = await trpc.ipWhitelist.blockedStats.query({ sinceHours: 24 });
for (const blocked of stats.topBlockedIps) {
  console.log(`Review ${blocked.ip}: ${blocked.count} attempts`);
}

// 4. Gradually expand whitelist as needed
```

## Related Documentation
- [Rate Limiting](./P1-RATE-LIMITING.md)
- [Input Validation](./P1-INPUT-VALIDATION.md)
- [API Key Auto-Rotation](./P2-API-KEY-AUTO-ROTATION.md)
