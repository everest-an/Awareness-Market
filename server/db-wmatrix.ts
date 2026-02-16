/**
 * Database Operations for W-Matrix Compatibility Matrix (Prisma)
 *
 * Replaces in-memory ModelCompatibilityMatrix with persistent Prisma database
 */

import { PrismaClient, CertificationLevel as PrismaCertificationLevel, WMatrixStandard } from '@prisma/client';
import { createLogger } from './utils/logger';
import type { CertificationLevel } from './latentmas/w-matrix-protocol';
import { Prisma } from '@prisma/client';

const logger = createLogger('DB:WMatrix');

// Singleton Prisma Client
let prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

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
  const db = getPrisma();

  // Parse version
  const [major, minor, patch] = data.version.split('.').map(Number);

  await db.wMatrixCompatibility.create({
    data: {
      wMatrixId: data.wMatrixId,
      sourceModel: data.sourceModel,
      targetModel: data.targetModel,
      version: data.version,
      versionMajor: major,
      versionMinor: minor,
      versionPatch: patch,
      certification: data.certification as PrismaCertificationLevel,
      epsilon: new Prisma.Decimal(data.epsilon),
      cosineSimilarity: data.cosineSimilarity ? new Prisma.Decimal(data.cosineSimilarity) : null,
      euclideanDistance: data.euclideanDistance ? new Prisma.Decimal(data.euclideanDistance) : null,
      testSamples: data.testSamples,
      available: true,
      downloadUrl: data.downloadUrl,
      checksumSHA256: data.checksumSHA256,
      sizeBytes: data.sizeBytes,
      createdBy: data.createdBy,
    },
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
  const db = getPrisma();

  const results = await db.wMatrixCompatibility.findMany({
    where: {
      sourceModel,
      targetModel,
      available: true,
    },
    orderBy: [
      { versionMajor: 'desc' },
      { versionMinor: 'desc' },
      { versionPatch: 'desc' },
    ],
  });

  return results.map(r => ({
    sourceModel: r.sourceModel,
    targetModel: r.targetModel,
    wMatrixId: r.wMatrixId,
    version: {
      major: r.versionMajor,
      minor: r.versionMinor,
      patch: r.versionPatch,
    },
    certification: r.certification as CertificationLevel,
    epsilon: r.epsilon.toNumber(),
    available: r.available,
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
  const db = getPrisma();

  const certLevels: PrismaCertificationLevel[] = [
    PrismaCertificationLevel.bronze,
    PrismaCertificationLevel.silver,
    PrismaCertificationLevel.gold,
    PrismaCertificationLevel.platinum,
  ];
  const certFilters = minCertification
    ? certLevels.slice(certLevels.indexOf(minCertification as PrismaCertificationLevel))
    : certLevels;

  const result = await db.wMatrixCompatibility.findFirst({
    where: {
      sourceModel,
      targetModel,
      available: true,
      certification: { in: certFilters },
    },
    orderBy: [
      // Custom order for certification (platinum > gold > silver > bronze)
      // Prisma doesn't support FIELD() directly, so we'll order by enum value order
      { versionMajor: 'desc' },
      { versionMinor: 'desc' },
      { versionPatch: 'desc' },
    ],
  });

  if (!result) return null;

  // Since Prisma doesn't support custom sort orders easily, we'll fetch all and sort in memory
  // For better performance with custom sort, we'd need to use raw SQL
  const allResults = await db.wMatrixCompatibility.findMany({
    where: {
      sourceModel,
      targetModel,
      available: true,
      certification: { in: certFilters },
    },
  });

  // Sort by certification level (platinum > gold > silver > bronze)
  const certOrder = { platinum: 4, gold: 3, silver: 2, bronze: 1 };
  allResults.sort((a, b) => {
    const certDiff = certOrder[b.certification] - certOrder[a.certification];
    if (certDiff !== 0) return certDiff;

    const majorDiff = b.versionMajor - a.versionMajor;
    if (majorDiff !== 0) return majorDiff;

    const minorDiff = b.versionMinor - a.versionMinor;
    if (minorDiff !== 0) return minorDiff;

    return b.versionPatch - a.versionPatch;
  });

  const r = allResults[0];
  if (!r) return null;

  return {
    sourceModel: r.sourceModel,
    targetModel: r.targetModel,
    wMatrixId: r.wMatrixId,
    version: {
      major: r.versionMajor,
      minor: r.versionMinor,
      patch: r.versionPatch,
    },
    certification: r.certification as CertificationLevel,
    epsilon: r.epsilon.toNumber(),
    available: r.available,
  };
}

/**
 * Get supported target models for a source model
 */
export async function getSupportedTargetModels(sourceModel: string): Promise<string[]> {
  const db = getPrisma();

  const results = await db.wMatrixCompatibility.findMany({
    where: {
      sourceModel,
      available: true,
    },
    distinct: ['targetModel'],
    select: { targetModel: true },
  });

  return results.map(r => r.targetModel);
}

/**
 * Get supported source models
 */
export async function getSupportedSourceModels(): Promise<string[]> {
  const db = getPrisma();

  const results = await db.wMatrixCompatibility.findMany({
    where: { available: true },
    distinct: ['sourceModel'],
    select: { sourceModel: true },
  });

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
  const db = getPrisma();

  const [totalCount, sourceModels, targetModels, certCounts, avgEpsilon] = await Promise.all([
    db.wMatrixCompatibility.count({
      where: { available: true },
    }),
    getSupportedSourceModels(),
    db.wMatrixCompatibility.findMany({
      where: { available: true },
      distinct: ['targetModel'],
      select: { targetModel: true },
    }),
    db.wMatrixCompatibility.groupBy({
      by: ['certification'],
      where: { available: true },
      _count: true,
    }),
    db.wMatrixCompatibility.aggregate({
      where: { available: true },
      _avg: { epsilon: true },
    }),
  ]);

  const certificationDistribution: Record<string, number> = {};
  certCounts.forEach(c => {
    certificationDistribution[c.certification] = c._count;
  });

  return {
    totalEntries: totalCount,
    uniqueSourceModels: sourceModels.length,
    uniqueTargetModels: targetModels.length,
    certificationDistribution,
    avgEpsilon: avgEpsilon._avg.epsilon?.toNumber() || 0,
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
  const db = getPrisma();

  // Map standard to enum
  const standardMap: Record<string, WMatrixStandard> = {
    '4096': WMatrixStandard.standard_4096,
    '8192': WMatrixStandard.standard_8192,
    '16384': WMatrixStandard.standard_16384,
  };

  await db.wMatrixListing.create({
    data: {
      // id is auto-generated by Prisma
      title: data.title,
      description: data.description,
      creatorId: data.creatorId,
      sourceModel: data.sourceModel,
      targetModel: data.targetModel,
      sourceDimension: data.sourceDimension,
      targetDimension: data.targetDimension,
      price: new Prisma.Decimal(data.price),
      version: data.version,
      standard: standardMap[data.standard],
      certification: data.certification as PrismaCertificationLevel,
      qualityGrade: data.qualityGrade,
      epsilon: new Prisma.Decimal(data.epsilon),
      cosineSimilarity: data.cosineSimilarity ? new Prisma.Decimal(data.cosineSimilarity) : null,
      euclideanDistance: data.euclideanDistance ? new Prisma.Decimal(data.euclideanDistance) : null,
      testSamples: data.testSamples,
      storageUrl: data.storageUrl,
      checksumSHA256: data.checksumSHA256,
      sizeBytes: data.sizeBytes,
      tags: data.tags || [],
    },
  });

  logger.info(`[createWMatrixListing] Created listing ${data.id}: ${data.title}`);
}

/**
 * Get W-Matrix listing by ID
 */
export async function getWMatrixListingById(listingId: string): Promise<{
  id: string;
  title: string;
  storageUrl: string | null;
  checksumSHA256: string | null;
  sizeBytes: number | null;
} | null> {
  const db = getPrisma();

  const result = await db.wMatrixListing.findUnique({
    where: { id: parseInt(listingId) },
    select: {
      id: true,
      title: true,
      storageUrl: true,
      checksumSHA256: true,
      sizeBytes: true,
    },
  });

  if (!result) return null;

  return {
    id: result.id.toString(),
    title: result.title,
    storageUrl: result.storageUrl,
    checksumSHA256: result.checksumSHA256,
    sizeBytes: result.sizeBytes,
  };
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
  const db = getPrisma();

  // Upsert (update if exists, create if not)
  await db.wMatrixIntegrity.upsert({
    where: { listingId: data.listingId },
    update: {
      expectedChecksum: data.expectedChecksum,
      actualChecksum: data.actualChecksum,
      sizeBytes: data.sizeBytes,
      valid: data.valid,
      lastVerifiedAt: new Date(),
      verificationCount: { increment: 1 },
    },
    create: {
      listingId: data.listingId,
      expectedChecksum: data.expectedChecksum,
      actualChecksum: data.actualChecksum,
      sizeBytes: data.sizeBytes,
      valid: data.valid,
      lastVerifiedAt: new Date(),
      verificationCount: 1,
    },
  });

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
  const db = getPrisma();

  const result = await db.wMatrixIntegrity.findUnique({
    where: { listingId },
  });

  if (!result) return null;

  return {
    expectedChecksum: result.expectedChecksum,
    actualChecksum: result.actualChecksum || '',
    sizeBytes: result.sizeBytes || 0,
    valid: result.valid || false,
    lastVerifiedAt: result.lastVerifiedAt || undefined,
  };
}
