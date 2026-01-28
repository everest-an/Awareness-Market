/**
 * W-Matrix Compatibility Schema (PostgreSQL)
 *
 * Database-backed compatibility matrix for standardized W-Matrix protocol
 */

import {
  pgTable,
  integer,
  varchar,
  text,
  timestamp,
  pgEnum,
  numeric,
  jsonb,
  index
} from 'drizzle-orm/pg-core';

// Define enums
export const certificationLevelEnum = pgEnum('certification_level', [
  'bronze',
  'silver',
  'gold',
  'platinum'
]);

export const standardEnum = pgEnum('w_matrix_standard', [
  '4096',
  '8192',
  '16384'
]);

export const availabilityEnum = pgEnum('availability', [
  'yes',
  'no'
]);

export const listingStatusEnum = pgEnum('listing_status', [
  'active',
  'inactive',
  'suspended'
]);

export const validityEnum = pgEnum('validity', [
  'yes',
  'no'
]);

/**
 * W-Matrix compatibility matrix
 *
 * Stores model pair compatibility with versioning and quality metrics
 */
export const wMatrixCompatibility = pgTable('w_matrix_compatibility', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  wMatrixId: varchar('w_matrix_id', { length: 64 }).notNull(),
  sourceModel: varchar('source_model', { length: 100 }).notNull(),
  targetModel: varchar('target_model', { length: 100 }).notNull(),

  // Semantic versioning
  version: varchar('version', { length: 20 }).notNull(), // "1.2.3"
  versionMajor: integer('version_major').notNull(),
  versionMinor: integer('version_minor').notNull(),
  versionPatch: integer('version_patch').notNull(),

  // Quality metrics
  certification: certificationLevelEnum('certification').notNull(),
  epsilon: numeric('epsilon', { precision: 10, scale: 6 }).notNull(),
  cosineSimilarity: numeric('cosine_similarity', { precision: 10, scale: 6 }),
  euclideanDistance: numeric('euclidean_distance', { precision: 18, scale: 6 }),
  testSamples: integer('test_samples'),

  // Availability
  available: availabilityEnum('available').default('yes'),

  // Storage
  downloadUrl: varchar('download_url', { length: 512 }),
  checksumSHA256: varchar('checksum_sha256', { length: 66 }),
  sizeBytes: integer('size_bytes'),

  // Metadata
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Critical indexes for O(log n) performance
  modelPairIdx: index('w_matrix_compat_model_pair_idx').on(table.sourceModel, table.targetModel),
  certificationIdx: index('w_matrix_compat_certification_idx').on(table.certification),
  versionIdx: index('w_matrix_compat_version_idx').on(
    table.versionMajor,
    table.versionMinor,
    table.versionPatch
  ),
  wMatrixIdIdx: index('w_matrix_compat_id_idx').on(table.wMatrixId),
}));

/**
 * W-Matrix marketplace listings
 */
export const wMatrixListings = pgTable('w_matrix_listings', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sourceModel: varchar('source_model', { length: 100 }).notNull(),
  targetModel: varchar('target_model', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  creatorId: integer('creator_id').notNull(),

  // Dimensions
  sourceDimension: integer('source_dimension').notNull(),
  targetDimension: integer('target_dimension').notNull(),

  // Pricing
  price: numeric('price', { precision: 18, scale: 2 }).notNull(),

  // Version and quality
  version: varchar('version', { length: 20 }).notNull(),
  standard: standardEnum('standard').notNull(),
  certification: certificationLevelEnum('certification'),
  qualityGrade: varchar('quality_grade', { length: 2 }), // A+, A, B+, B, C

  // Quality metrics
  epsilon: numeric('epsilon', { precision: 10, scale: 6 }).notNull(),
  cosineSimilarity: numeric('cosine_similarity', { precision: 10, scale: 6 }),
  euclideanDistance: numeric('euclidean_distance', { precision: 18, scale: 6 }),
  testSamples: integer('test_samples'),

  // Storage
  storageUrl: varchar('storage_url', { length: 512 }).notNull(),
  checksumSHA256: varchar('checksum_sha256', { length: 66 }),
  sizeBytes: integer('size_bytes'),

  // Marketplace metadata
  tags: jsonb('tags'), // Array of tags
  status: listingStatusEnum('status').default('active').notNull(),
  downloads: integer('downloads').default(0).notNull(),
  views: integer('views').default(0).notNull(),
  avgRating: numeric('avg_rating', { precision: 3, scale: 2 }),
  reviewCount: integer('review_count').default(0).notNull(),

  // Training metadata (optional)
  trainingDataSize: integer('training_data_size'),
  trainingEpochs: integer('training_epochs'),
  trainingLoss: numeric('training_loss', { precision: 10, scale: 6 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  modelPairIdx: index('w_matrix_listings_model_pair_idx').on(table.sourceModel, table.targetModel),
  creatorIdx: index('w_matrix_listings_creator_idx').on(table.creatorId),
  statusIdx: index('w_matrix_listings_status_idx').on(table.status),
  certificationIdx: index('w_matrix_listings_certification_idx').on(table.certification),
}));

/**
 * W-Matrix integrity verification cache
 *
 * Stores verification results to avoid recomputing checksums
 */
export const wMatrixIntegrity = pgTable('w_matrix_integrity', {
  listingId: varchar('listing_id', { length: 64 }).primaryKey(),
  expectedChecksum: varchar('expected_checksum', { length: 66 }).notNull(),
  actualChecksum: varchar('actual_checksum', { length: 66 }),
  sizeBytes: integer('size_bytes'),
  valid: validityEnum('valid'),
  lastVerifiedAt: timestamp('last_verified_at'),
  verificationCount: integer('verification_count').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
