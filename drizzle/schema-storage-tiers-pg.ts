/**
 * Storage Tiering Schema
 * 
 * Tracks package access patterns and storage tier assignments
 * for intelligent cost optimization
 */

import { pgTable, integer, varchar, timestamp, index, primaryKey, numeric, pgEnum } from "drizzle-orm/pg-core";

/**
 * Package Access Log
 * Records every access to track data temperature
 */
export const packageAccessLog = pgTable('packageAccessLog', {
  id: integer('id').primaryKey().autoincrement(),
  packageId: integer('package_id').notNull(),
  packageType: pgEnum('package_type', ['vector', 'memory', 'chain']).notNull(),
  accessType: pgEnum('access_type', ['download', 'view', 'purchase']).notNull(),
  userId: integer('user_id'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  packageIdx: index('idx_package').on(table.packageId, table.packageType),
  timestampIdx: index('idx_timestamp').on(table.timestamp),
}));

/**
 * Package Storage Tier
 * Tracks current storage tier and backend for each package
 */
export const packageStorageTier = pgTable('packageStorageTier', {
  packageId: integer('package_id').notNull(),
  packageType: pgEnum('package_type', ['vector', 'memory', 'chain']).notNull(),
  currentTier: pgEnum('current_tier', ['hot', 'warm', 'cold']).notNull(),
  currentBackend: varchar('current_backend', { length: 20 }).notNull(),
  lastAccessAt: timestamp('last_access_at').notNull(),
  accessCount: integer('access_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.packageId, table.packageType] }),
  tierIdx: index('idx_tier').on(table.currentTier),
  lastAccessIdx: index('idx_last_access').on(table.lastAccessAt),
}));

/**
 * Migration Queue
 * Tracks pending and completed tier migrations
 */
export const migrationQueue = pgTable('migrationQueue', {
  id: integer('id').primaryKey().autoincrement(),
  packageId: integer('package_id').notNull(),
  packageType: pgEnum('package_type', ['vector', 'memory', 'chain']).notNull(),
  fromBackend: varchar('from_backend', { length: 20 }).notNull(),
  toBackend: varchar('to_backend', { length: 20 }).notNull(),
  fromTier: pgEnum('from_tier', ['hot', 'warm', 'cold']).notNull(),
  toTier: pgEnum('to_tier', ['hot', 'warm', 'cold']).notNull(),
  status: pgEnum('status', ['pending', 'processing', 'completed', 'failed']).default('pending').notNull(),
  priority: integer('priority').default(0).notNull(),
  estimatedSavings: numeric('estimated_savings', { precision: 10, scale: 4 }),
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
export const storageCostMetrics = pgTable('storageCostMetrics', {
  id: integer('id').primaryKey().autoincrement(),
  date: timestamp('date').notNull(),
  tier: pgEnum('tier', ['hot', 'warm', 'cold']).notNull(),
  backend: varchar('backend', { length: 20 }).notNull(),
  storageGB: numeric('storage_gb', { precision: 10, scale: 2 }).notNull(),
  downloadGB: numeric('download_gb', { precision: 10, scale: 2 }).notNull(),
  storageCost: numeric('storage_cost', { precision: 10, scale: 4 }).notNull(),
  bandwidthCost: numeric('bandwidth_cost', { precision: 10, scale: 4 }).notNull(),
  totalCost: numeric('total_cost', { precision: 10, scale: 4 }).notNull(),
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
