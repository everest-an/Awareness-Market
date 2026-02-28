/**
 * LatentMAS Package Schema Extensions
 * 
 * Adds LatentMAS/2.1 protocol fields to support latent working memory packages.
 * These fields extend the existing vector_packages, memory_packages, and chain_packages
 * tables with latent rollout configuration, drift metrics, and Wa operator metadata.
 * 
 * Requirements implemented:
 * - 4.1: latent_steps, drift_max, drift_avg, drift_detected columns
 * - 4.2: wa_condition_number, wa_rank, wa_computed_at columns
 * - 4.3: kv_cache_url column for KV-Cache reference
 * - 4.4: protocol_version column defaulting to 'LatentMAS/2.1'
 * - 4.5: latent_thought_dim column
 */

import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  numeric,
  boolean,
  pgEnum,
  index,
  bigint
} from "drizzle-orm/pg-core";

/**
 * Package Mode Enum
 * Defines whether a package contains static embeddings or latent working memory
 */
export const packageModeEnum = pgEnum('package_mode', ['static', 'latent']);

/**
 * LatentMAS Vector Package Extensions
 * 
 * Extends vector packages with LatentMAS/2.1 protocol fields for
 * latent working memory support including drift metrics and Wa alignment.
 */
export const latentmasVectorPackages = pgTable('latentmas_vector_packages', {
  id: serial('id').primaryKey(),

  // Reference to base vector package
  vectorPackageId: integer('vector_package_id').notNull().unique(),

  // LatentMAS/2.1 Protocol Version
  protocolVersion: varchar('protocol_version', { length: 20 }).default('LatentMAS/2.1').notNull(),

  // Package Mode: static embedding or latent working memory
  packageMode: packageModeEnum('package_mode').$default(() => 'static'),
  
  // Latent Rollout Configuration
  latentSteps: integer('latent_steps').default(0).notNull(), // 0-80 steps
  ridgeLambda: numeric('ridge_lambda', { precision: 10, scale: 6 }).default('0.010000').notNull(), // 0.0001-1
  
  // Drift Metrics (Quality indicators during latent rollout)
  driftMax: numeric('drift_max', { precision: 10, scale: 6 }).default('0.000000').notNull(),
  driftAvg: numeric('drift_avg', { precision: 10, scale: 6 }).default('0.000000').notNull(),
  driftDetected: boolean('drift_detected').default(false).notNull(),
  
  // Wa Operator Metadata (Alignment matrix quality)
  waConditionNumber: numeric('wa_condition_number', { precision: 15, scale: 6 }).default('0.000000').notNull(),
  waRank: integer('wa_rank').default(0).notNull(),
  waComputedAt: timestamp('wa_computed_at'),
  
  // Latent Data Dimensions
  latentThoughtDim: integer('latent_thought_dim').default(0).notNull(),
  
  // KV-Cache Storage Reference
  kvCacheUrl: text('kv_cache_url'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  vectorPackageIdx: index('idx_vector_package').on(table.vectorPackageId),
  packageModeIdx: index('idx_package_mode').on(table.packageMode),
  protocolVersionIdx: index('idx_protocol_version').on(table.protocolVersion),
  driftDetectedIdx: index('idx_drift_detected').on(table.driftDetected),
}));

/**
 * LatentMAS Memory Package Extensions
 * 
 * Extends memory packages with LatentMAS/2.1 protocol fields for
 * KV-Cache state transfer and Wa alignment metadata.
 */
export const latentmasMemoryPackages = pgTable('latentmas_memory_packages', {
  id: serial('id').primaryKey(),

  // Reference to base memory package
  memoryPackageId: integer('memory_package_id').notNull().unique(),

  // LatentMAS/2.1 Protocol Version
  protocolVersion: varchar('protocol_version', { length: 20 }).default('LatentMAS/2.1').notNull(),

  // Package Mode: static embedding or latent working memory
  packageMode: packageModeEnum('package_mode').$default(() => 'static'),
  
  // Latent Rollout Configuration
  latentSteps: integer('latent_steps').default(0).notNull(),
  ridgeLambda: numeric('ridge_lambda', { precision: 10, scale: 6 }).default('0.010000').notNull(),
  
  // Drift Metrics
  driftMax: numeric('drift_max', { precision: 10, scale: 6 }).default('0.000000').notNull(),
  driftAvg: numeric('drift_avg', { precision: 10, scale: 6 }).default('0.000000').notNull(),
  driftDetected: boolean('drift_detected').default(false).notNull(),
  
  // Wa Operator Metadata
  waConditionNumber: numeric('wa_condition_number', { precision: 15, scale: 6 }).default('0.000000').notNull(),
  waRank: integer('wa_rank').default(0).notNull(),
  waComputedAt: timestamp('wa_computed_at'),
  
  // Latent Data Dimensions
  latentThoughtDim: integer('latent_thought_dim').default(0).notNull(),
  
  // KV-Cache Storage Reference (may override base package URL)
  kvCacheUrl: text('kv_cache_url'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  memoryPackageIdx: index('idx_memory_package').on(table.memoryPackageId),
  packageModeIdx: index('idx_package_mode').on(table.packageMode),
  protocolVersionIdx: index('idx_protocol_version').on(table.protocolVersion),
  driftDetectedIdx: index('idx_drift_detected').on(table.driftDetected),
}));

/**
 * LatentMAS Chain Package Extensions
 * 
 * Extends chain packages with LatentMAS/2.1 protocol fields for
 * reasoning chain KV-Cache snapshots and step-by-step quality metrics.
 */
export const latentmasChainPackages = pgTable('latentmas_chain_packages', {
  id: serial('id').primaryKey(),

  // Reference to base chain package
  chainPackageId: integer('chain_package_id').notNull().unique(),

  // LatentMAS/2.1 Protocol Version
  protocolVersion: varchar('protocol_version', { length: 20 }).default('LatentMAS/2.1').notNull(),

  // Package Mode: static embedding or latent working memory
  packageMode: packageModeEnum('package_mode').$default(() => 'static'),
  
  // Latent Rollout Configuration
  latentSteps: integer('latent_steps').default(0).notNull(),
  ridgeLambda: numeric('ridge_lambda', { precision: 10, scale: 6 }).default('0.010000').notNull(),
  
  // Drift Metrics (aggregate across all chain steps)
  driftMax: numeric('drift_max', { precision: 10, scale: 6 }).default('0.000000').notNull(),
  driftAvg: numeric('drift_avg', { precision: 10, scale: 6 }).default('0.000000').notNull(),
  driftDetected: boolean('drift_detected').default(false).notNull(),
  
  // Wa Operator Metadata
  waConditionNumber: numeric('wa_condition_number', { precision: 15, scale: 6 }).default('0.000000').notNull(),
  waRank: integer('wa_rank').default(0).notNull(),
  waComputedAt: timestamp('wa_computed_at'),
  
  // Latent Data Dimensions
  latentThoughtDim: integer('latent_thought_dim').default(0).notNull(),
  
  // KV-Cache Storage Reference
  kvCacheUrl: text('kv_cache_url'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  chainPackageIdx: index('idx_chain_package').on(table.chainPackageId),
  packageModeIdx: index('idx_package_mode').on(table.packageMode),
  protocolVersionIdx: index('idx_protocol_version').on(table.protocolVersion),
  driftDetectedIdx: index('idx_drift_detected').on(table.driftDetected),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type LatentmasVectorPackage = typeof latentmasVectorPackages.$inferSelect;
export type InsertLatentmasVectorPackage = typeof latentmasVectorPackages.$inferInsert;

export type LatentmasMemoryPackage = typeof latentmasMemoryPackages.$inferSelect;
export type InsertLatentmasMemoryPackage = typeof latentmasMemoryPackages.$inferInsert;

export type LatentmasChainPackage = typeof latentmasChainPackages.$inferSelect;
export type InsertLatentmasChainPackage = typeof latentmasChainPackages.$inferInsert;

// ============================================================================
// User Latent Spaces Table
// ============================================================================

/**
 * User Latent Space Status Enum
 * Defines the lifecycle state of a user's latent space
 */
export const latentSpaceStatusEnum = pgEnum('latent_space_status', ['active', 'archived', 'deleted']);

/**
 * User Latent Spaces Table
 * 
 * Manages user-isolated latent space instances for LatentMAS/2.1 protocol.
 * Each user has their own isolated namespace for latent working memory.
 * 
 * Requirements implemented:
 * - 9.1: Create unique latent space instance scoped to user's session
 * - 11.5: Enforce per-user quotas for active latent spaces (default: 10)
 */
export const userLatentSpaces = pgTable('user_latent_spaces', {
  // Primary key
  id: serial('id').primaryKey(),
  
  // User reference (references users table)
  userId: integer('user_id').notNull(),
  
  // Unique space identifier (UUID for the latent space)
  spaceId: varchar('space_id', { length: 64 }).notNull().unique(),

  // Lifecycle status
  status: latentSpaceStatusEnum('status').$default(() => 'active'),
  
  // Last access tracking for auto-archival
  lastAccessedAt: timestamp('last_accessed_at').defaultNow().notNull(),
  
  // Quota management (Requirement 11.5)
  quotaUsed: integer('quota_used').default(0).notNull(),
  quotaLimit: integer('quota_limit').default(10).notNull(), // Default: 10 active spaces per user
  
  // Resource tracking
  totalKvCacheSize: bigint('total_kv_cache_size', { mode: 'number' }).default(0).notNull(), // Bytes
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on userId for user lookup
  userIdx: index('idx_user_id').on(table.userId),
  // Index on status for filtering active/archived spaces
  statusIdx: index('idx_status').on(table.status),
}));

// Type exports for User Latent Spaces
export type UserLatentSpace = typeof userLatentSpaces.$inferSelect;
export type InsertUserLatentSpace = typeof userLatentSpaces.$inferInsert;

// ============================================================================
// Package Access Grants Table
// ============================================================================

/**
 * Package Type Enum for access grants
 * Defines which type of package the access grant applies to
 */
export const packageTypeEnum = pgEnum('package_type', ['vector', 'memory', 'chain']);

/**
 * Package Access Grants Table
 *
 * Manages access permissions for purchased packages.
 * When a user purchases a package, an access grant is created allowing them
 * to use the package's latent working memory.
 *
 * Requirements implemented:
 * - 9.3: Create a copy of the latent space in the buyer's isolated namespace
 * - 9.4: Prevent cross-user latent space access without explicit purchase
 */
export const packageAccessGrants = pgTable('package_access_grants', {
  // Primary key
  id: serial('id').primaryKey(),

  // Package reference
  packageType: packageTypeEnum('package_type').notNull(),
  packageId: varchar('package_id', { length: 64 }).notNull(),

  // Owner and grantee
  ownerId: integer('owner_id').notNull(), // Package creator
  granteeId: integer('grantee_id').notNull(), // Package buyer

  // Grant metadata
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // Optional expiration

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Composite index for package lookup
  packageIdx: index('idx_package').on(table.packageType, table.packageId),
  // Index for grantee lookup (find all packages a user has access to)
  granteeIdx: index('idx_grantee').on(table.granteeId),
  // Index for owner lookup (find all grants for packages owned by a user)
  ownerIdx: index('idx_owner').on(table.ownerId),
}));

// Type exports for Package Access Grants
export type PackageAccessGrant = typeof packageAccessGrants.$inferSelect;
export type InsertPackageAccessGrant = typeof packageAccessGrants.$inferInsert;

// ============================================================================
// Shared Types for LatentMAS Protocol
// ============================================================================

/**
 * Common LatentMAS fields interface for use across all package types
 */
export interface LatentMASFields {
  protocolVersion: string;
  packageMode: 'static' | 'latent';
  latentSteps: number;
  ridgeLambda: string;
  driftMax: string;
  driftAvg: string;
  driftDetected: boolean;
  waConditionNumber: string;
  waRank: number;
  waComputedAt: Date | null;
  latentThoughtDim: number;
  kvCacheUrl: string | null;
}

/**
 * Drift metrics subset for quality display
 */
export interface DriftMetrics {
  maxDrift: number;
  avgDrift: number;
  driftDetected: boolean;
}

/**
 * Wa operator metadata for alignment quality display
 */
export interface WaMetadata {
  conditionNumber: number;
  rank: number;
  computedAt: Date | null;
}
