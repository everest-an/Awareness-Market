/**
 * IP Whitelist Service — P2 Security Enhancement
 *
 * Features:
 * - Organization-level and user-level IP whitelisting
 * - IPv4 and IPv6 support
 * - CIDR notation (e.g., 192.168.1.0/24)
 * - IP range support (e.g., 192.168.1.1 - 192.168.1.255)
 * - IP access logging for audit trail
 *
 * Security benefits:
 * - Restrict API access to trusted networks
 * - Prevent unauthorized access from unknown IPs
 * - Compliance with enterprise security policies
 * - Geographic restriction capability
 */

import { prisma } from '../db-prisma';
import { createLogger } from '../utils/logger';
import ipaddr from 'ipaddr.js';

const logger = createLogger('IpWhitelistService');

// ============================================================================
// IP Validation and Parsing
// ============================================================================

/**
 * Parse and validate IP address (IPv4 or IPv6)
 */
export function parseIpAddress(ip: string): { valid: boolean; version: 4 | 6 | null; normalized: string | null; error?: string } {
  try {
    const parsed = ipaddr.process(ip);
    const version = parsed.kind() === 'ipv4' ? 4 : 6;
    const normalized = parsed.toString();

    return { valid: true, version, normalized };
  } catch (error) {
    return { valid: false, version: null, normalized: null, error: String(error) };
  }
}

/**
 * Parse CIDR notation (e.g., 192.168.1.0/24)
 */
export function parseCIDR(cidr: string): {
  valid: boolean;
  network?: string;
  prefix?: number;
  firstIp?: string;
  lastIp?: string;
  error?: string;
} {
  try {
    const [network, prefixStr] = cidr.split('/');
    if (!prefixStr) {
      return { valid: false, error: 'Invalid CIDR format (missing prefix)' };
    }

    const prefix = parseInt(prefixStr, 10);
    const parsed = ipaddr.process(network);
    const range = parsed.kind() === 'ipv4'
      ? ipaddr.IPv4.networkAddressFromCIDR(cidr)
      : ipaddr.IPv6.networkAddressFromCIDR(cidr);

    return {
      valid: true,
      network,
      prefix,
      firstIp: range.toString(),
      lastIp: range.toString(), // Simplified - full range calculation omitted
    };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

/**
 * Check if an IP is within a CIDR range
 */
export function isIpInCIDR(ip: string, cidr: string): boolean {
  try {
    const parsedIp = ipaddr.process(ip);
    const parsed = ipaddr.parseCIDR(cidr);
    return parsedIp.match(parsed);
  } catch (error) {
    logger.error('CIDR matching error', { error, ip, cidr });
    return false;
  }
}

/**
 * Check if an IP is within a range (startIp - endIp)
 */
export function isIpInRange(ip: string, startIp: string, endIp: string): boolean {
  try {
    const parsedIp = ipaddr.process(ip);
    const parsedStart = ipaddr.process(startIp);
    const parsedEnd = ipaddr.process(endIp);

    // Must be same IP version
    if (parsedIp.kind() !== parsedStart.kind() || parsedIp.kind() !== parsedEnd.kind()) {
      return false;
    }

    const ipBytes = parsedIp.toByteArray();
    const startBytes = parsedStart.toByteArray();
    const endBytes = parsedEnd.toByteArray();

    // Compare byte-by-byte
    for (let i = 0; i < ipBytes.length; i++) {
      if (ipBytes[i] < startBytes[i] || ipBytes[i] > endBytes[i]) {
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error('IP range matching error', { error, ip, startIp, endIp });
    return false;
  }
}

// ============================================================================
// Whitelist Checking
// ============================================================================

/**
 * Check if an IP is whitelisted for a user
 */
export async function isIpWhitelisted(
  ip: string,
  userId: number,
  organizationId?: number | null
): Promise<{
  allowed: boolean;
  whitelistId?: number;
  reason?: string;
}> {
  try {
    // Fetch all active whitelists for user + organization
    const whitelists = await prisma.ipWhitelist.findMany({
      where: {
        isActive: true,
        OR: [
          { userId }, // User-level whitelist
          ...(organizationId ? [{ organizationId }] : []), // Org-level whitelist
        ],
      },
    });

    if (whitelists.length === 0) {
      // No whitelist configured = allow all (whitelist is opt-in)
      return { allowed: true, reason: 'No whitelist configured (allow all)' };
    }

    // Check each whitelist entry
    for (const whitelist of whitelists) {
      // Single IP address
      if (whitelist.ipAddress) {
        const normalized = parseIpAddress(ip).normalized;
        const whitelistedNormalized = parseIpAddress(whitelist.ipAddress).normalized;
        if (normalized === whitelistedNormalized) {
          return { allowed: true, whitelistId: whitelist.id, reason: 'Single IP match' };
        }
      }

      // CIDR range
      if (whitelist.cidrNotation) {
        if (isIpInCIDR(ip, whitelist.cidrNotation)) {
          return { allowed: true, whitelistId: whitelist.id, reason: 'CIDR range match' };
        }
      }

      // IP range
      if (whitelist.ipRangeStart && whitelist.ipRangeEnd) {
        if (isIpInRange(ip, whitelist.ipRangeStart, whitelist.ipRangeEnd)) {
          return { allowed: true, whitelistId: whitelist.id, reason: 'IP range match' };
        }
      }
    }

    // No match found - blocked
    return { allowed: false, reason: 'IP not in whitelist' };
  } catch (error) {
    logger.error('Whitelist check error', { error, ip, userId });
    // Fail open to avoid blocking legitimate users due to errors
    return { allowed: true, reason: 'Error during whitelist check (fail-open)' };
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Add IP to whitelist
 */
export async function addToWhitelist(params: {
  organizationId?: number | null;
  userId?: number | null;
  ipAddress?: string;
  cidrNotation?: string;
  ipRangeStart?: string;
  ipRangeEnd?: string;
  description?: string;
  createdBy: number;
}): Promise<{ id: number; success: boolean; error?: string }> {
  // Validation: Must specify either single IP, CIDR, or range
  const hasIp = !!params.ipAddress;
  const hasCIDR = !!params.cidrNotation;
  const hasRange = !!(params.ipRangeStart && params.ipRangeEnd);

  if (!hasIp && !hasCIDR && !hasRange) {
    return { id: 0, success: false, error: 'Must specify IP address, CIDR, or range' };
  }

  // Validate IP format
  if (params.ipAddress) {
    const parsed = parseIpAddress(params.ipAddress);
    if (!parsed.valid) {
      return { id: 0, success: false, error: `Invalid IP address: ${parsed.error}` };
    }
  }

  // Validate CIDR
  if (params.cidrNotation) {
    const parsed = parseCIDR(params.cidrNotation);
    if (!parsed.valid) {
      return { id: 0, success: false, error: `Invalid CIDR notation: ${parsed.error}` };
    }
  }

  // Validate range
  if (params.ipRangeStart && params.ipRangeEnd) {
    const startParsed = parseIpAddress(params.ipRangeStart);
    const endParsed = parseIpAddress(params.ipRangeEnd);

    if (!startParsed.valid) {
      return { id: 0, success: false, error: `Invalid range start IP: ${startParsed.error}` };
    }
    if (!endParsed.valid) {
      return { id: 0, success: false, error: `Invalid range end IP: ${endParsed.error}` };
    }
    if (startParsed.version !== endParsed.version) {
      return { id: 0, success: false, error: 'Range IPs must be same version (IPv4 or IPv6)' };
    }
  }

  try {
    const whitelist = await prisma.ipWhitelist.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        ipAddress: params.ipAddress,
        cidrNotation: params.cidrNotation,
        ipRangeStart: params.ipRangeStart,
        ipRangeEnd: params.ipRangeEnd,
        description: params.description,
        createdBy: params.createdBy,
        isActive: true,
      },
    });

    logger.info('IP added to whitelist', {
      id: whitelist.id,
      organizationId: params.organizationId,
      userId: params.userId,
      ipAddress: params.ipAddress,
      cidrNotation: params.cidrNotation,
    });

    return { id: whitelist.id, success: true };
  } catch (error) {
    logger.error('Failed to add IP to whitelist', { error, params });
    return { id: 0, success: false, error: String(error) };
  }
}

/**
 * Remove IP from whitelist
 */
export async function removeFromWhitelist(
  whitelistId: number,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify ownership (user must be creator or org admin)
    const whitelist = await prisma.ipWhitelist.findUnique({
      where: { id: whitelistId },
      include: { organization: { include: { memberships: true } } },
    });

    if (!whitelist) {
      return { success: false, error: 'Whitelist entry not found' };
    }

    // Check permission
    const isCreator = whitelist.createdBy === userId;
    const isOrgAdmin =
      whitelist.organizationId &&
      whitelist.organization?.memberships.some(
        (m) => m.userId === userId && (m.role === 'owner' || m.role === 'admin')
      );

    if (!isCreator && !isOrgAdmin) {
      return { success: false, error: 'Permission denied' };
    }

    await prisma.ipWhitelist.delete({
      where: { id: whitelistId },
    });

    logger.info('IP removed from whitelist', { whitelistId, userId });
    return { success: true };
  } catch (error) {
    logger.error('Failed to remove IP from whitelist', { error, whitelistId });
    return { success: false, error: String(error) };
  }
}

/**
 * List whitelist entries
 */
export async function listWhitelist(params: {
  organizationId?: number;
  userId?: number;
  includeInactive?: boolean;
}): Promise<
  Array<{
    id: number;
    organizationId: number | null;
    userId: number | null;
    ipAddress: string | null;
    cidrNotation: string | null;
    ipRangeStart: string | null;
    ipRangeEnd: string | null;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
  }>
> {
  const whitelists = await prisma.ipWhitelist.findMany({
    where: {
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { createdAt: 'desc' },
  });

  return whitelists.map((w) => ({
    id: w.id,
    organizationId: w.organizationId,
    userId: w.userId,
    ipAddress: w.ipAddress,
    cidrNotation: w.cidrNotation,
    ipRangeStart: w.ipRangeStart,
    ipRangeEnd: w.ipRangeEnd,
    description: w.description,
    isActive: w.isActive,
    createdAt: w.createdAt,
  }));
}

// ============================================================================
// Access Logging
// ============================================================================

/**
 * Log IP access attempt (for audit trail)
 */
export async function logIpAccess(params: {
  userId: number;
  ipAddress: string;
  endpoint: string;
  method: string;
  allowed: boolean;
  whitelistId?: number;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.ipAccessLog.create({
      data: {
        userId: params.userId,
        ipAddress: params.ipAddress,
        endpoint: params.endpoint,
        method: params.method,
        allowed: params.allowed,
        whitelistId: params.whitelistId,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    // Don't throw - logging should not block requests
    logger.error('Failed to log IP access', { error, params });
  }
}

/**
 * Get IP access logs for a user
 */
export async function getIpAccessLogs(params: {
  userId?: number;
  organizationId?: number;
  blocked?: boolean;
  limit?: number;
  offset?: number;
}): Promise<
  Array<{
    id: number;
    userId: number;
    ipAddress: string;
    endpoint: string;
    method: string;
    allowed: boolean;
    timestamp: Date;
    userAgent: string | null;
  }>
> {
  const logs = await prisma.ipAccessLog.findMany({
    where: {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.blocked !== undefined ? { allowed: !params.blocked } : {}),
    },
    orderBy: { timestamp: 'desc' },
    take: params.limit || 100,
    skip: params.offset || 0,
  });

  return logs.map((log) => ({
    id: log.id,
    userId: log.userId,
    ipAddress: log.ipAddress,
    endpoint: log.endpoint,
    method: log.method,
    allowed: log.allowed,
    timestamp: log.timestamp,
    userAgent: log.userAgent,
  }));
}

/**
 * Get blocked IP statistics
 */
export async function getBlockedIpStats(params: {
  userId?: number;
  organizationId?: number;
  sinceHours?: number;
}): Promise<{
  totalBlocked: number;
  uniqueIps: number;
  topBlockedIps: Array<{ ip: string; count: number }>;
}> {
  const since = params.sinceHours
    ? new Date(Date.now() - params.sinceHours * 60 * 60 * 1000)
    : new Date(0);

  const logs = await prisma.ipAccessLog.findMany({
    where: {
      ...(params.userId ? { userId: params.userId } : {}),
      allowed: false,
      timestamp: { gte: since },
    },
    select: { ipAddress: true },
  });

  const ipCounts = logs.reduce(
    (acc, log) => {
      acc[log.ipAddress] = (acc[log.ipAddress] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const topBlockedIps = Object.entries(ipCounts)
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalBlocked: logs.length,
    uniqueIps: Object.keys(ipCounts).length,
    topBlockedIps,
  };
}
