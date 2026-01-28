/**
 * Database Operations for W-Matrix Compatibility Matrix
 *
 * Replaces in-memory ModelCompatibilityMatrix with persistent database
 */

import { getDb } from './db';
import { wMatrixCompatibility, wMatrixListings, wMatrixIntegrity } from '../drizzle/schema';
import { eq, and, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import { createLogger } from './utils/logger';
import type { CertificationLevel } from './latentmas/w-matrix-protocol';

const logger = createLogger('DB:WMatrix');

export interface CompatibilityEntry {
  sourceModel: string;
  targetModel: string;
  wMatrixId: string;
  version: { major: number; minor: number; patch: number };
  certification: CertificationLevel;
  epsilon: number;
  available: boolean;
}

/**
 * Add W-Matrix compatibility entry
 */
export async function addCompatibilityEntry(data: {
  wMatrixId: string;
  sourceModel: string;
  targetModel: string;
  version: string; // e.g., "1.0.0"
  certification: CertificationLevel;
  epsilon: number;
  cosineSimilarity?: number;
  euclideanDistance?: number;
  testSamples?: number;
  downloadUrl?: string;
  checksumSHA256?: string;
  sizeBytes?: number;
  createdBy?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Parse version
  const [major, minor, patch] = data.version.split('.').map(Number);

  await db.insert(wMatrixCompatibility).values({
    wMatrixId: data.wMatrixId,
    sourceModel: data.sourceModel,
    targetModel: data.targetModel,
    version: data.version,
    versionMajor: major,
    versionMinor: minor,
    versionPatch: patch,
    certification: data.certification,
    epsilon: data.epsilon.toString(),
    cosineSimilarity: data.cosineSimilarity?.toString(),
    euclideanDistance: data.euclideanDistance?.toString(),
    testSamples: data.testSamples,
    available: 'yes',
    downloadUrl: data.downloadUrl,
    checksumSHA256: data.checksumSHA256,
    sizeBytes: data.sizeBytes,
    createdBy: data.createdBy,
  });

  logger.info(`[addCompatibilityEntry] Added ${data.sourceModel} → ${data.targetModel} v${data.version}`);
}

/**
 * Get compatible W-Matrices for a model pair
 */
export async function getCompatibleMatrices(
  sourceModel: string,
  targetModel: string
): Promise<CompatibilityEntry[]> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const results = await db
    .select()
    .from(wMatrixCompatibility)
    .where(
      and(
        eq(wMatrixCompatibility.sourceModel, sourceModel),
        eq(wMatrixCompatibility.targetModel, targetModel),
        eq(wMatrixCompatibility.available, 'yes')
      )
    )
    .orderBy(desc(wMatrixCompatibility.versionMajor), desc(wMatrixCompatibility.versionMinor), desc(wMatrixCompatibility.versionPatch));

  return results.map(r => ({
    sourceModel: r.sourceModel,
    targetModel: r.targetModel,
    wMatrixId: r.wMatrixId,
    version: {
      major: r.versionMajor,
      minor: r.versionMinor,
      patch: r.versionPatch,
    },
    certification: r.certification,
    epsilon: parseFloat(r.epsilon),
    available: r.available === 'yes',
  }));
}

/**
 * Get best W-Matrix for a model pair
 */
export async function getBestMatrix(
  sourceModel: string,
  targetModel: string,
  minCertification?: CertificationLevel
): Promise<CompatibilityEntry | null> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const certLevels: CertificationLevel[] = ['bronze', 'silver', 'gold', 'platinum'];
  const certFilters = minCertification
    ? certLevels.slice(certLevels.indexOf(minCertification))
    : certLevels;

  const results = await db
    .select()
    .from(wMatrixCompatibility)
    .where(
      and(
        eq(wMatrixCompatibility.sourceModel, sourceModel),
        eq(wMatrixCompatibility.targetModel, targetModel),
        eq(wMatrixCompatibility.available, 'yes'),
        inArray(wMatrixCompatibility.certification, certFilters)
      )
    )
    .orderBy(
      desc(sql`FIELD(${wMatrixCompatibility.certification}, 'platinum', 'gold', 'silver', 'bronze')`),
      desc(wMatrixCompatibility.versionMajor),
      desc(wMatrixCompatibility.versionMinor),
      desc(wMatrixCompatibility.versionPatch)
    )
    .limit(1);

  if (results.length === 0) return null;

  const r = results[0];
  return {
    sourceModel: r.sourceModel,
    targetModel: r.targetModel,
    wMatrixId: r.wMatrixId,
    version: {
      major: r.versionMajor,
      minor: r.versionMinor,
      patch: r.versionPatch,
    },
    certification: r.certification,
    epsilon: parseFloat(r.epsilon),
    available: r.available === 'yes',
  };
}

/**
 * Get supported target models for a source model
 */
export async function getSupportedTargetModels(sourceModel: string): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const results = await db
    .selectDistinct({ targetModel: wMatrixCompatibility.targetModel })
    .from(wMatrixCompatibility)
    .where(
      and(
        eq(wMatrixCompatibility.sourceModel, sourceModel),
        eq(wMatrixCompatibility.available, 'yes')
      )
    );

  return results.map(r => r.targetModel);
}

/**
 * Get supported source models
 */
export async function getSupportedSourceModels(): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const results = await db
    .selectDistinct({ sourceModel: wMatrixCompatibility.sourceModel })
    .from(wMatrixCompatibility)
    .where(eq(wMatrixCompatibility.available, 'yes'));

  return results.map(r => r.sourceModel);
}

/**
 * Get compatibility statistics
 */
export async function getCompatibilityStatistics(): Promise<{
  totalEntries: number;
  uniqueSourceModels: number;
  uniqueTargetModels: number;
  certificationDistribution: Record<string, number>;
  avgEpsilon: number;
}> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(wMatrixCompatibility)
    .where(eq(wMatrixCompatibility.available, 'yes'));

  const sourceModels = await getSupportedSourceModels();
  const targetModels = await db
    .selectDistinct({ targetModel: wMatrixCompatibility.targetModel })
    .from(wMatrixCompatibility)
    .where(eq(wMatrixCompatibility.available, 'yes'));

  const certCounts = await db
    .select({
      certification: wMatrixCompatibility.certification,
      count: sql<number>`count(*)`,
    })
    .from(wMatrixCompatibility)
    .where(eq(wMatrixCompatibility.available, 'yes'))
    .groupBy(wMatrixCompatibility.certification);

  const [avgResult] = await db
    .select({
      avg: sql<number>`avg(CAST(${wMatrixCompatibility.epsilon} AS DECIMAL(10,6)))`,
    })
    .from(wMatrixCompatibility)
    .where(eq(wMatrixCompatibility.available, 'yes'));

  const certificationDistribution: Record<string, number> = {};
  certCounts.forEach(c => {
    certificationDistribution[c.certification] = Number(c.count);
  });

  return {
    totalEntries: Number(countResult?.count || 0),
    uniqueSourceModels: sourceModels.length,
    uniqueTargetModels: targetModels.length,
    certificationDistribution,
    avgEpsilon: avgResult?.avg || 0,
  };
}

/**
 * Store W-Matrix listing
 */
export async function createWMatrixListing(data: {
  id: string;
  title: string;
  description: string;
  creatorId: number;
  sourceModel: string;
  targetModel: string;
  sourceDimension: number;
  targetDimension: number;
  price: number;
  version: string;
  standard: '4096' | '8192' | '16384';
  certification: CertificationLevel;
  qualityGrade?: string;
  epsilon: number;
  cosineSimilarity?: number;
  euclideanDistance?: number;
  testSamples?: number;
  storageUrl: string;
  checksumSHA256?: string;
  sizeBytes?: number;
  tags?: string[];
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.insert(wMatrixListings).values({
    id: data.id,
    title: data.title,
    description: data.description,
    creatorId: data.creatorId,
    sourceModel: data.sourceModel,
    targetModel: data.targetModel,
    sourceDimension: data.sourceDimension,
    targetDimension: data.targetDimension,
    price: data.price.toString(),
    version: data.version,
    standard: data.standard,
    certification: data.certification,
    qualityGrade: data.qualityGrade,
    epsilon: data.epsilon.toString(),
    cosineSimilarity: data.cosineSimilarity?.toString(),
    euclideanDistance: data.euclideanDistance?.toString(),
    testSamples: data.testSamples,
    storageUrl: data.storageUrl,
    checksumSHA256: data.checksumSHA256,
    sizeBytes: data.sizeBytes,
    tags: data.tags || [],
    status: 'active',
  });

  logger.info(`[createWMatrixListing] Created listing ${data.id}: ${data.title}`);
}

/**
 * Store integrity verification result
 */
export async function storeIntegrityVerification(data: {
  listingId: string;
  expectedChecksum: string;
  actualChecksum: string;
  sizeBytes: number;
  valid: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Check if entry exists
  const existing = await db
    .select()
    .from(wMatrixIntegrity)
    .where(eq(wMatrixIntegrity.listingId, data.listingId))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db
      .update(wMatrixIntegrity)
      .set({
        expectedChecksum: data.expectedChecksum,
        actualChecksum: data.actualChecksum,
        sizeBytes: data.sizeBytes,
        valid: data.valid ? 'yes' : 'no',
        lastVerifiedAt: new Date(),
        verificationCount: sql`${wMatrixIntegrity.verificationCount} + 1`,
      })
      .where(eq(wMatrixIntegrity.listingId, data.listingId));
  } else {
    // Insert new
    await db.insert(wMatrixIntegrity).values({
      listingId: data.listingId,
      expectedChecksum: data.expectedChecksum,
      actualChecksum: data.actualChecksum,
      sizeBytes: data.sizeBytes,
      valid: data.valid ? 'yes' : 'no',
      lastVerifiedAt: new Date(),
      verificationCount: 1,
    });
  }

  logger.info(`[storeIntegrityVerification] Verified ${data.listingId}: ${data.valid ? 'VALID' : 'INVALID'}`);
}

/**
 * Get integrity verification result
 */
export async function getIntegrityVerification(listingId: string): Promise<{
  expectedChecksum: string;
  actualChecksum: string;
  sizeBytes: number;
  valid: boolean;
  lastVerifiedAt?: Date;
} | null> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const results = await db
    .select()
    .from(wMatrixIntegrity)
    .where(eq(wMatrixIntegrity.listingId, listingId))
    .limit(1);

  if (results.length === 0) return null;

  const r = results[0];
  return {
    expectedChecksum: r.expectedChecksum,
    actualChecksum: r.actualChecksum || '',
    sizeBytes: r.sizeBytes || 0,
    valid: r.valid === 'yes',
    lastVerifiedAt: r.lastVerifiedAt || undefined,
  };
}
