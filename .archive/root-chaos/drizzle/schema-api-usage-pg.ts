/**
 * API Usage Logging Schema
 * 
 * Tracks all API calls for analytics and rate limiting
 */

import { pgTable, varchar, integer, timestamp, text, numeric, boolean, index, serial } from "drizzle-orm/pg-core";

/**
 * API Usage Logs - Individual API call records
 */
export const apiUsageLogs = pgTable('api_usage_logs', {
  id: serial('id').primaryKey(),
  
  // User/API Key identification
  userId: integer('user_id'),
  apiKeyId: integer('api_key_id'),
  apiKeyPrefix: varchar('api_key_prefix', { length: 20 }), // First 8 chars for display
  
  // Request details
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  method: varchar('method', { length: 10 }).notNull(),
  path: varchar('path', { length: 500 }).notNull(),
  queryParams: text('query_params'),
  
  // Response details
  statusCode: integer('status_code').notNull(),
  responseTimeMs: integer('response_time_ms').notNull(),
  responseSize: integer('response_size'), // bytes
  
  // Error tracking
  errorCode: varchar('error_code', { length: 50 }),
  errorMessage: text('error_message'),
  
  // Request metadata
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  referer: varchar('referer', { length: 500 }),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('api_usage_user_id_idx').on(table.userId),
  apiKeyIdIdx: index('api_usage_api_key_id_idx').on(table.apiKeyId),
  endpointIdx: index('api_usage_endpoint_idx').on(table.endpoint),
  createdAtIdx: index('api_usage_created_at_idx').on(table.createdAt),
  statusCodeIdx: index('api_usage_status_code_idx').on(table.statusCode),
}));

/**
 * API Usage Daily Aggregates - Pre-computed daily stats
 */
export const apiUsageDailyStats = pgTable('api_usage_daily_stats', {
  id: serial('id').primaryKey(),
  
  // Aggregation key
  userId: integer('user_id'),
  apiKeyId: integer('api_key_id'),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  date: timestamp('date').notNull(),
  
  // Counts
  totalRequests: integer('total_requests').default(0).notNull(),
  successfulRequests: integer('successful_requests').default(0).notNull(),
  failedRequests: integer('failed_requests').default(0).notNull(),
  
  // Response time stats (ms)
  avgResponseTime: integer('avg_response_time').default(0),
  minResponseTime: integer('min_response_time'),
  maxResponseTime: integer('max_response_time'),
  p95ResponseTime: integer('p95_response_time'),
  
  // Data transfer
  totalResponseSize: integer('total_response_size').default(0), // bytes
  
  // Error breakdown
  error4xxCount: integer('error_4xx_count').default(0),
  error5xxCount: integer('error_5xx_count').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userDateIdx: index('api_daily_user_date_idx').on(table.userId, table.date),
  apiKeyDateIdx: index('api_daily_apikey_date_idx').on(table.apiKeyId, table.date),
  endpointDateIdx: index('api_daily_endpoint_date_idx').on(table.endpoint, table.date),
}));

/**
 * API Endpoints Registry - Track all available endpoints
 */
export const apiEndpoints = pgTable('api_endpoints', {
  id: serial('id').primaryKey(),
  
  // Endpoint details
  path: varchar('path', { length: 255 }).notNull().unique(),
  method: varchar('method', { length: 10 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }), // auth, packages, ai, etc.
  
  // Rate limiting
  rateLimit: integer('rate_limit').default(100), // requests per minute
  rateLimitWindow: integer('rate_limit_window').default(60), // seconds
  
  // Flags
  isPublic: boolean('is_public').default(false),
  requiresAuth: boolean('requires_auth').default(true),
  isDeprecated: boolean('is_deprecated').default(false),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
