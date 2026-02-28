/**
 * W-Matrix Compatibility Matrix Schema
 * 
 * Replaces in-memory compatibility matrix with persistent database
 */

import { mysqlTable, int, varchar, text, timestamp, mysqlEnum, decimal, index, json } from 'drizzle-orm/mysql-core';

/**
 * W-Matrix compatibility entries
 */
export const wMatrixCompatibility = mysqlTable('w_matrix_compatibility', {
  id: int('id').autoincrement().primaryKey(),
  wMatrixId: varchar('w_matrix_id', { length: 64 }).notNull(), // Reference to W-Matrix listing
  sourceModel: varchar('source_model', { length: 100 }).notNull(),
  targetModel: varchar('target_model', { length: 100 }).notNull(),
  version: varchar('version', { length: 20 }).notNull(), // Semantic version (e.g., "1.0.0")
  versionMajor: int('version_major').notNull(),
  versionMinor: int('version_minor').notNull(),
  versionPatch: int('version_patch').notNull(),
  certification: mysqlEnum('certification', ['bronze', 'silver', 'gold', 'platinum']).notNull(),
  epsilon: decimal('epsilon', { precision: 10, scale: 6 }).notNull(), // Quality metric
  cosineSimilarity: decimal('cosine_similarity', { precision: 10, scale: 6 }),
  euclideanDistance: decimal('euclidean_distance', { precision: 10, scale: 6 }),
  testSamples: int('test_samples'),
  available: mysqlEnum('available', ['yes', 'no']).default('yes').notNull(),
  downloadUrl: text('download_url'),
  checksumSHA256: varchar('checksum_sha256', { length: 64 }),
  sizeBytes: int('size_bytes'),
  createdBy: int('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sourceModelIdx: index('source_model_idx').on(table.sourceModel),
  targetModelIdx: index('target_model_idx').on(table.targetModel),
  modelPairIdx: index('model_pair_idx').on(table.sourceModel, table.targetModel),
  certificationIdx: index('certification_idx').on(table.certification),
  versionIdx: index('version_idx').on(table.versionMajor, table.versionMinor, table.versionPatch),
}));

/**
 * W-Matrix listings (marketplace)
 */
export const wMatrixListings = mysqlTable('w_matrix_listings', {
  id: varchar('id', { length: 64 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  creatorId: int('creator_id').notNull(),
  sourceModel: varchar('source_model', { length: 100 }).notNull(),
  targetModel: varchar('target_model', { length: 100 }).notNull(),
  sourceDimension: int('source_dimension').notNull(),
  targetDimension: int('target_dimension').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  version: varchar('version', { length: 20 }).notNull(),
  standard: mysqlEnum('standard', ['4096', '8192', '16384']).notNull(),
  certification: mysqlEnum('certification', ['bronze', 'silver', 'gold', 'platinum']).notNull(),
  qualityGrade: varchar('quality_grade', { length: 10 }),
  epsilon: decimal('epsilon', { precision: 10, scale: 6 }).notNull(),
  cosineSimilarity: decimal('cosine_similarity', { precision: 10, scale: 6 }),
  euclideanDistance: decimal('euclidean_distance', { precision: 10, scale: 6 }),
  testSamples: int('test_samples'),
  storageUrl: text('storage_url').notNull(),
  checksumSHA256: varchar('checksum_sha256', { length: 64 }),
  sizeBytes: int('size_bytes'),
  tags: json('tags'), // Array of tags
  totalSales: int('total_sales').default(0).notNull(),
  totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }).default('0.00').notNull(),
  status: mysqlEnum('status', ['draft', 'active', 'inactive', 'suspended']).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  creatorIdx: index('creator_idx').on(table.creatorId),
  modelPairIdx: index('model_pair_idx').on(table.sourceModel, table.targetModel),
  certificationIdx: index('certification_idx').on(table.certification),
  statusIdx: index('status_idx').on(table.status),
}));

/**
 * W-Matrix integrity verification cache
 */
export const wMatrixIntegrity = mysqlTable('w_matrix_integrity', {
  id: int('id').autoincrement().primaryKey(),
  listingId: varchar('listing_id', { length: 64 }).notNull(),
  expectedChecksum: varchar('expected_checksum', { length: 64 }).notNull(),
  actualChecksum: varchar('actual_checksum', { length: 64 }),
  sizeBytes: int('size_bytes'),
  valid: mysqlEnum('valid', ['yes', 'no', 'pending']).default('pending').notNull(),
  lastVerifiedAt: timestamp('last_verified_at'),
  verificationCount: int('verification_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  listingIdIdx: index('listing_id_idx').on(table.listingId),
}));
