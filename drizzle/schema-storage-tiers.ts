/**
 * Storage Tiering Schema
 * 
 * Tracks package access patterns and storage tier assignments
 * for intelligent cost optimization
 */

import { mysqlTable, int, varchar, timestamp, index, primaryKey, decimal, mysqlEnum } from 'drizzle-orm/mysql-core';

/**
 * Package Access Log
 * Records every access to track data temperature
 */
export const packageAccessLog = mysqlTable('packageAccessLog', {
  id: int('id').primaryKey().autoincrement(),
  packageId: int('package_id').notNull(),
  packageType: mysqlEnum('package_type', ['vector', 'memory', 'chain']).notNull(),
  accessType: mysqlEnum('access_type', ['download', 'view', 'purchase']).notNull(),
  userId: int('user_id'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  packageIdx: index('idx_package').on(table.packageId, table.packageType),
  timestampIdx: index('idx_timestamp').on(table.timestamp),
}));

/**
 * Package Storage Tier
 * Tracks current storage tier and backend for each package
 */
export const packageStorageTier = mysqlTable('packageStorageTier', {
  packageId: int('package_id').notNull(),
  packageType: mysqlEnum('package_type', ['vector', 'memory', 'chain']).notNull(),
  currentTier: mysqlEnum('current_tier', ['hot', 'warm', 'cold']).notNull(),
  currentBackend: varchar('current_backend', { length: 20 }).notNull(),
  lastAccessAt: timestamp('last_access_at').notNull(),
  accessCount: int('access_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.packageId, table.packageType] }),
  tierIdx: index('idx_tier').on(table.currentTier),
  lastAccessIdx: index('idx_last_access').on(table.lastAccessAt),
}));

/**
 * Migration Queue
 * Tracks pending and completed tier migrations
 */
export const migrationQueue = mysqlTable('migrationQueue', {
  id: int('id').primaryKey().autoincrement(),
  packageId: int('package_id').notNull(),
  packageType: mysqlEnum('package_type', ['vector', 'memory', 'chain']).notNull(),
  fromBackend: varchar('from_backend', { length: 20 }).notNull(),
  toBackend: varchar('to_backend', { length: 20 }).notNull(),
  fromTier: mysqlEnum('from_tier', ['hot', 'warm', 'cold']).notNull(),
  toTier: mysqlEnum('to_tier', ['hot', 'warm', 'cold']).notNull(),
  status: mysqlEnum('status', ['pending', 'processing', 'completed', 'failed']).default('pending').notNull(),
  priority: int('priority').default(0).notNull(),
  estimatedSavings: decimal('estimated_savings', { precision: 10, scale: 4 }),
  errorMessage: varchar('error_message', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  statusIdx: index('idx_status').on(table.status),
  priorityIdx: index('idx_priority').on(table.priority),
}));

/**
 * Storage Cost Metrics
 * Daily cost tracking per tier and backend
 */
export const storageCostMetrics = mysqlTable('storageCostMetrics', {
  id: int('id').primaryKey().autoincrement(),
  date: timestamp('date').notNull(),
  tier: mysqlEnum('tier', ['hot', 'warm', 'cold']).notNull(),
  backend: varchar('backend', { length: 20 }).notNull(),
  storageGB: decimal('storage_gb', { precision: 10, scale: 2 }).notNull(),
  downloadGB: decimal('download_gb', { precision: 10, scale: 2 }).notNull(),
  storageCost: decimal('storage_cost', { precision: 10, scale: 4 }).notNull(),
  bandwidthCost: decimal('bandwidth_cost', { precision: 10, scale: 4 }).notNull(),
  totalCost: decimal('total_cost', { precision: 10, scale: 4 }).notNull(),
}, (table) => ({
  dateIdx: index('idx_date').on(table.date),
  tierIdx: index('idx_tier').on(table.tier),
}));

/**
 * Type exports for TypeScript
 */
export type PackageAccessLog = typeof packageAccessLog.$inferSelect;
export type NewPackageAccessLog = typeof packageAccessLog.$inferInsert;

export type PackageStorageTier = typeof packageStorageTier.$inferSelect;
export type NewPackageStorageTier = typeof packageStorageTier.$inferInsert;

export type MigrationQueue = typeof migrationQueue.$inferSelect;
export type NewMigrationQueue = typeof migrationQueue.$inferInsert;

export type StorageCostMetrics = typeof storageCostMetrics.$inferSelect;
export type NewStorageCostMetrics = typeof storageCostMetrics.$inferInsert;
