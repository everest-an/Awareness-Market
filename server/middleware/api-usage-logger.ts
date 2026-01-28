/**
 * API Usage Logger Middleware
 * 
 * Logs all API requests for analytics and monitoring
 */

import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { apiUsageLogs } from '../../drizzle/schema-api-usage';
import { createLogger } from '../utils/logger';

const logger = createLogger('Middleware:APIUsageLogger');

interface ApiLogEntry {
  userId?: number;
  apiKeyId?: number;
  apiKeyPrefix?: string;
  endpoint: string;
  method: string;
  path: string;
  queryParams?: string;
  statusCode: number;
  responseTimeMs: number;
  responseSize?: number;
  errorCode?: string;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
}

// In-memory buffer for batch inserts
const logBuffer: ApiLogEntry[] = [];
const BUFFER_SIZE = 50;
const FLUSH_INTERVAL = 5000; // 5 seconds

/**
 * Flush log buffer to database
 */
async function flushLogBuffer(): Promise<void> {
  if (logBuffer.length === 0) return;
  
  const logsToInsert = logBuffer.splice(0, logBuffer.length);
  
  try {
    const db = await getDb();
    if (!db) {
      logger.error('Database unavailable, dropping logs');
      return;
    }
    
    await db.insert(apiUsageLogs).values(logsToInsert);
  } catch (error) {
    logger.error('Failed to flush logs:', error);
    // Re-add failed logs to buffer (with limit to prevent memory issues)
    if (logBuffer.length < 1000) {
      logBuffer.push(...logsToInsert);
    }
  }
}

// Start periodic flush
setInterval(flushLogBuffer, FLUSH_INTERVAL);

/**
 * Extract API key info from request
 */
function extractApiKeyInfo(req: Request): { apiKeyId?: number; apiKeyPrefix?: string } {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return {};
  }
  
  const token = authHeader.slice(7);
  
  // Check if it's an API key (starts with ak_ai_)
  if (token.startsWith('ak_ai_')) {
    return {
      apiKeyPrefix: token.slice(0, 14), // ak_ai_ + first 8 chars
    };
  }
  
  return {};
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Normalize endpoint path (remove IDs for grouping)
 */
function normalizeEndpoint(path: string): string {
  return path
    // Replace UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Replace numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Replace package IDs (vpkg_, mpkg_, cpkg_)
    .replace(/\/(vpkg|mpkg|cpkg)_[a-zA-Z0-9]+/g, '/:packageId');
}

/**
 * API Usage Logger Middleware
 */
export function apiUsageLogger(req: Request, res: Response, next: NextFunction): void {
  // Skip non-API routes
  if (!req.path.startsWith('/api/')) {
    return next();
  }
  
  const startTime = Date.now();
  const originalSend = res.send;
  let responseSize = 0;
  
  // Intercept response to capture size
  res.send = function(body: unknown): Response {
    if (body) {
      responseSize = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(String(body));
    }
    return originalSend.call(this, body);
  };
  
  // Log on response finish
  res.on('finish', () => {
    const responseTimeMs = Date.now() - startTime;
    const { apiKeyId, apiKeyPrefix } = extractApiKeyInfo(req);
    
    // Get user ID from session/context if available
    const userId = (req as any).user?.id;
    
    // Determine error info
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    
    if (res.statusCode >= 400) {
      errorCode = `HTTP_${res.statusCode}`;
      // Try to extract error message from response
      const responseBody = (res as any).__body;
      if (responseBody && typeof responseBody === 'object') {
        errorMessage = responseBody.message || responseBody.error;
      }
    }
    
    const logEntry: ApiLogEntry = {
      userId,
      apiKeyId,
      apiKeyPrefix,
      endpoint: normalizeEndpoint(req.path),
      method: req.method,
      path: req.path,
      queryParams: Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : undefined,
      statusCode: res.statusCode,
      responseTimeMs,
      responseSize,
      errorCode,
      errorMessage,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']?.slice(0, 500),
      referer: req.headers.referer?.slice(0, 500),
    };
    
    // Add to buffer
    logBuffer.push(logEntry);
    
    // Flush if buffer is full
    if (logBuffer.length >= BUFFER_SIZE) {
      flushLogBuffer();
    }
  });
  
  next();
}

/**
 * Get API usage statistics for a user
 */
export async function getUserApiStats(userId: number, days: number = 30): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  dailyUsage: Array<{ date: string; count: number }>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      topEndpoints: [],
      dailyUsage: [],
    };
  }
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get raw logs for the period
  const logs = await db
    .select()
    .from(apiUsageLogs)
    .where(
      // Note: In production, use proper date comparison with drizzle
      // This is simplified for demonstration
      (log) => log.userId === userId
    )
    .limit(10000);
  
  // Calculate stats
  const totalRequests = logs.length;
  const successfulRequests = logs.filter(l => l.statusCode < 400).length;
  const failedRequests = totalRequests - successfulRequests;
  const avgResponseTime = logs.length > 0
    ? Math.round(logs.reduce((sum, l) => sum + l.responseTimeMs, 0) / logs.length)
    : 0;
  
  // Top endpoints
  const endpointCounts = new Map<string, number>();
  logs.forEach(l => {
    endpointCounts.set(l.endpoint, (endpointCounts.get(l.endpoint) || 0) + 1);
  });
  const topEndpoints = Array.from(endpointCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([endpoint, count]) => ({ endpoint, count }));
  
  // Daily usage
  const dailyCounts = new Map<string, number>();
  logs.forEach(l => {
    const date = new Date(l.createdAt).toISOString().split('T')[0];
    dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
  });
  const dailyUsage = Array.from(dailyCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
  
  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    avgResponseTime,
    topEndpoints,
    dailyUsage,
  };
}

/**
 * Get global API analytics (admin only)
 */
export async function getGlobalApiStats(days: number = 7): Promise<{
  totalRequests: number;
  uniqueUsers: number;
  avgResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{ endpoint: string; count: number; avgTime: number }>;
  statusCodeDistribution: Record<string, number>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalRequests: 0,
      uniqueUsers: 0,
      avgResponseTime: 0,
      errorRate: 0,
      topEndpoints: [],
      statusCodeDistribution: {},
    };
  }
  
  // Get recent logs
  const logs = await db
    .select()
    .from(apiUsageLogs)
    .orderBy(apiUsageLogs.createdAt)
    .limit(50000);
  
  const totalRequests = logs.length;
  const uniqueUsers = new Set(logs.map(l => l.userId).filter(Boolean)).size;
  const avgResponseTime = logs.length > 0
    ? Math.round(logs.reduce((sum, l) => sum + l.responseTimeMs, 0) / logs.length)
    : 0;
  const errorCount = logs.filter(l => l.statusCode >= 400).length;
  const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
  
  // Top endpoints with avg time
  const endpointStats = new Map<string, { count: number; totalTime: number }>();
  logs.forEach(l => {
    const stats = endpointStats.get(l.endpoint) || { count: 0, totalTime: 0 };
    stats.count++;
    stats.totalTime += l.responseTimeMs;
    endpointStats.set(l.endpoint, stats);
  });
  const topEndpoints = Array.from(endpointStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([endpoint, stats]) => ({
      endpoint,
      count: stats.count,
      avgTime: Math.round(stats.totalTime / stats.count),
    }));
  
  // Status code distribution
  const statusCodeDistribution: Record<string, number> = {};
  logs.forEach(l => {
    const category = `${Math.floor(l.statusCode / 100)}xx`;
    statusCodeDistribution[category] = (statusCodeDistribution[category] || 0) + 1;
  });
  
  return {
    totalRequests,
    uniqueUsers,
    avgResponseTime,
    errorRate: Math.round(errorRate * 100) / 100,
    topEndpoints,
    statusCodeDistribution,
  };
}
