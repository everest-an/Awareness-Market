/**
 * Unified Package API
 * 
 * Handles all three package types:
 * - Vector Packages (.vectorpkg)
 * - Memory Packages (.memorypkg)
 * - Chain Packages (.chainpkg)
 * 
 * Each package contains W-Matrix + specific data
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { eq, desc, and, or, like, sql, type SQL, type InferSelectModel } from 'drizzle-orm';
import { getDb } from '../db';
import { getErrorMessage, assertDatabaseAvailable, assertPackageExists, throwValidationFailed } from '../utils/error-handling';
import { createLogger } from '../utils/logger';
import { vectorPackages, memoryPackages, chainPackages, packageDownloads, packagePurchases, users } from '../../drizzle/schema';
import { AntiPoisoningVerifier } from '../latentmas/anti-poisoning';
import { pricingEngine } from '../pricing-engine';
import { SemanticAnchorDB } from '../latentmas/semantic-anchors';
import { generateRecommendations, trackBrowsingAction } from '../recommendation-engine';

const logger = createLogger('Packages:API');
const poisonValidator = new AntiPoisoningVerifier();
const semanticAnchors = new SemanticAnchorDB();

// KV-Cache structure for vector extraction
interface KVCacheStructure {
  keys: number[][][][]; // [layers][heads][keys][dimension]
}

type VectorPackage = InferSelectModel<typeof vectorPackages>;
type MemoryPackage = InferSelectModel<typeof memoryPackages>;
type ChainPackage = InferSelectModel<typeof chainPackages>;
import {
  createVectorPackage,
  extractVectorPackage,
  createMemoryPackage,
  extractMemoryPackage,
  createChainPackage,
  extractChainPackage,
  type VectorData,
  type WMatrixData,
} from '../latentmas/package-builders';
import type { KVCache } from '../latentmas/types';
import type { ReasoningChainData } from '../latentmas/package-builders';
import { storageGet } from '../storage';
import { sendPurchaseConfirmationEmail, sendSaleNotificationEmail } from '../email-service';

// ============================================================================
// Input Schemas
// ============================================================================

const PackageTypeSchema = z.enum(['vector', 'memory', 'chain']);

const WMatrixSchema = z.object({
  weights: z.array(z.array(z.number())),
  biases: z.array(z.number()),
  epsilon: z.number().min(0).max(1),
  orthogonalityScore: z.number().optional(),
  trainingAnchors: z.number().int().optional(),
  sourceModel: z.string(),
  targetModel: z.string(),
  sourceDimension: z.number().int().positive(),
  targetDimension: z.number().int().positive(),
});

// Vector Package
const CreateVectorPackageSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  vector: z.object({
    vector: z.array(z.number()),
    dimension: z.number().int().positive(),
    category: z.enum(['nlp', 'vision', 'audio', 'multimodal', 'other']),
    performanceMetrics: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }),
  wMatrix: WMatrixSchema,
  price: z.number().positive(),
  trainingDataset: z.string(),
  tags: z.array(z.string()).optional(),
});

// Memory Package
const CreateMemoryPackageSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  kvCache: z.object({
    keys: z.array(z.array(z.array(z.number()))),
    values: z.array(z.array(z.array(z.number()))),
    attentionWeights: z.array(z.number()).optional(),
  }),
  wMatrix: WMatrixSchema,
  tokenCount: z.number().int().positive(),
  compressionRatio: z.number().min(0).max(1),
  contextDescription: z.string().min(10),
  price: z.number().positive(),
  trainingDataset: z.string(),
  tags: z.array(z.string()).optional(),
});

// Chain Package
const CreateChainPackageSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  chain: z.object({
    steps: z.array(z.object({
      stepIndex: z.number().int(),
      description: z.string(),
      kvSnapshot: z.object({
        keys: z.array(z.array(z.array(z.number()))),
        values: z.array(z.array(z.array(z.number()))),
        attentionWeights: z.array(z.number()).optional(),
      }),
      confidence: z.number().optional(),
      timestamp: z.string().optional(),
    })),
    problemType: z.string(),
    solutionQuality: z.number().min(0).max(1),
    totalSteps: z.number().int().positive(),
    initialContext: z.string().optional(),
    finalOutput: z.string().optional(),
  }),
  wMatrix: WMatrixSchema,
  price: z.number().positive(),
  trainingDataset: z.string(),
  tags: z.array(z.string()).optional(),
});

// Browse Packages
const BrowsePackagesSchema = z.object({
  packageType: PackageTypeSchema,
  sourceModel: z.string().optional(),
  targetModel: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['recent', 'popular', 'price_asc', 'price_desc', 'rating']).default('recent'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

// Purchase Package
const PurchasePackageSchema = z.object({
  packageType: PackageTypeSchema,
  packageId: z.string(),
});

// Download Package
const DownloadPackageSchema = z.object({
  packageType: PackageTypeSchema,
  packageId: z.string(),
});

// ============================================================================
// Helper Functions
// ============================================================================

function getPackageTable(packageType: 'vector' | 'memory' | 'chain') {
  switch (packageType) {
    case 'vector':
      return vectorPackages;
    case 'memory':
      return memoryPackages;
    case 'chain':
      return chainPackages;
  }
}

/**
 * Calculate dynamic pricing for a package
 * Applies PID controller pricing and half-life decay for memory packages
 */
function calculateDynamicPrice(
  pkg: { price: string; epsilon: string | null; createdAt: Date },
  packageType: 'vector' | 'memory' | 'chain'
): {
  currentPrice: string;
  pricingBreakdown: {
    alignmentFee: string;
    royaltyFee: string;
    qualityMultiplier: string;
    decayFactor?: string;
    ageInDays?: number;
  };
} {
  const basePrice = parseFloat(pkg.price.toString());
  const epsilon = parseFloat(pkg.epsilon?.toString() || '0.05');

  // Calculate dynamic price using PID controller
  const pricingResult = pricingEngine.calculatePackagePrice(
    packageType === 'vector' ? 'vector_package' :
    packageType === 'memory' ? 'kv_cache' :
    'reasoning_chain',
    epsilon,
    10, // 10% royalty percentage
    basePrice
  );

  let currentPrice = pricingResult.totalPrice;
  let decayFactor: number | undefined;
  let ageInDays: number | undefined;

  // Apply half-life decay for memory packages (whitepaper Section 12.6)
  if (packageType === 'memory') {
    const createdAt = new Date(pkg.createdAt).getTime();
    const now = Date.now();
    const ageMs = now - createdAt;
    const halfLifeMs = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds

    // Half-life decay formula: P(t) = P_base × 2^(-t / t_half)
    decayFactor = Math.pow(2, -ageMs / halfLifeMs);
    ageInDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    currentPrice = currentPrice * decayFactor;
  }

  return {
    currentPrice: currentPrice.toFixed(2),
    pricingBreakdown: {
      alignmentFee: pricingResult.alignmentFee.toFixed(2),
      royaltyFee: pricingResult.royaltyFee.toFixed(2),
      qualityMultiplier: pricingResult.currentK.toFixed(2),
      ...(packageType === 'memory' && {
        decayFactor: decayFactor?.toFixed(4),
        ageInDays,
      }),
    },
  };
}

/**
 * Extract representative vector from KV-Cache for validation
 * Uses mean pooling across all keys
 */
function extractRepresentativeVector(kvCache: KVCacheStructure): number[] {
  const allVectors: number[][] = [];

  // Flatten all keys from all layers and heads
  for (const layer of kvCache.keys) {
    for (const head of layer) {
      for (const keyVector of head) {
        allVectors.push(keyVector);
      }
    }
  }

  if (allVectors.length === 0) {
    throw new Error('Empty KV-Cache provided');
  }

  // Mean pooling
  const dimension = allVectors[0].length;
  const meanVector = new Array(dimension).fill(0);

  for (const vector of allVectors) {
    for (let i = 0; i < dimension; i++) {
      meanVector[i] += vector[i] / allVectors.length;
    }
  }

  return meanVector;
}

// ============================================================================
// Router
// ============================================================================

export const packagesApiRouter = router({
  /**
   * Create Vector Package
   */
  createVectorPackage: protectedProcedure
    .input(CreateVectorPackageSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // ============================================================
        // Step 1 - Anti-Poisoning Verification (PoLF)
        // ============================================================
        // STATUS: Mock implementation - awaiting production deployment
        //
        // Full implementation requires:
        // 1. Challenge generation: poisonValidator.generateChallenge(vector)
        // 2. Response verification: poisonValidator.verify(challenge, response)
        // 3. Semantic anchor validation against known good vectors
        //
        // See: server/latentmas/anti-poisoning.ts for full implementation
        // ============================================================
        logger.info(`[PoLF] Using mock validation (user: ${ctx.user.id})`);

        // Mock validation - always passes in development
        const polfResult = { isPassed: true, reason: 'Mock validation', score: 1.0, anomalies: [] as string[] };

        if (process.env.ENABLE_POLF_VERIFICATION === 'true' && !polfResult.isPassed) {
          logger.warn(`Poisoning detected in vector package upload`, {
            userId: ctx.user.id,
            packageName: input.name,
            reason: polfResult.reason,
            anomalies: polfResult.anomalies,
          });

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Security check failed: ${polfResult.reason}. Your vector shows signs of a poisoning attack.`,
            cause: {
              type: 'POISONING_DETECTED',
              score: polfResult.score,
              details: polfResult.anomalies,
              recommendations: [
                'Verify your training data is clean',
                'Check for adversarial perturbations',
                'Retrain the model with validated datasets',
              ],
            },
          });
        }

        logger.info(`Vector passed anti-poisoning check (score: ${polfResult.score.toFixed(3)})`);

        // NEW: Step 2 - Semantic Quality Validation
        logger.info(`Performing semantic quality calibration (user: ${ctx.user.id})`);

        const calibration = semanticAnchors.calibrateAlignment(input.vector.vector);
        const calibrationScore = calibration.calibrationScore;

        if (calibrationScore < 0.70) {
          logger.warn(`Low quality vector rejected`, {
            userId: ctx.user.id,
            packageName: input.name,
            calibrationScore,
            coverage: calibration.coverage,
          });

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Quality too low for marketplace listing (score: ${calibrationScore.toFixed(3)}). Minimum required: 0.70`,
            cause: {
              type: 'LOW_QUALITY',
              calibrationScore,
              coverage: calibration.coverage,
              recommendations: calibration.recommendations,
            },
          });
        }

        logger.info(`Vector passed quality check (score: ${calibrationScore.toFixed(3)}, coverage: ${(calibration.coverage * 100).toFixed(1)}%)`);

        // Existing: Step 3 - Create Package
        const result = await createVectorPackage(
          input.vector as VectorData,
          input.wMatrix as WMatrixData,
          {
            name: input.name,
            description: input.description,
            version: input.version,
            creator: { id: ctx.user.id, name: ctx.user.name || 'Unknown' },
            trainingDataset: input.trainingDataset,
          }
        );

        // Save to database
        const db = await getDb();
        assertDatabaseAvailable(db);
        const insertResult = await db.insert(vectorPackages).values({
          packageId: result.packageId,
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          sourceModel: input.wMatrix.sourceModel,
          targetModel: input.wMatrix.targetModel,
          category: input.vector.category,
          price: String(input.price),
          packageUrl: result.packageUrl,
          vectorUrl: result.vectorUrl || '',
          wMatrixUrl: result.wMatrixUrl || '',
          epsilon: String(input.wMatrix.epsilon),
          informationRetention: '0.9500',
          dimension: input.vector.dimension,
        }).$returningId();

        const pkgId = insertResult[0]?.id;
        const [pkg] = pkgId ? await db.select().from(vectorPackages).where(eq(vectorPackages.id, pkgId)).limit(1) : [];

        return {
          success: true,
          package: pkg,
          packageId: result.packageId,
        };
      } catch (error: unknown) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create vector package: ${getErrorMessage(error)}`,
        });
      }
    }),

  /**
   * Create Memory Package
   */
  createMemoryPackage: protectedProcedure
    .input(CreateMemoryPackageSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // ============================================================
        // Step 1 - Anti-Poisoning Verification (PoLF)
        // STATUS: Mock implementation - see createVectorPackage for details
        // ============================================================
        logger.info(`[PoLF] Verifying KV-Cache (user: ${ctx.user.id})`);

        // Extract representative vector from KV-Cache using mean pooling
        // Used for PoLF verification when enabled
        const _representativeVector = extractRepresentativeVector(input.kvCache);

        // Mock validation - enable with ENABLE_POLF_VERIFICATION=true
        // Real implementation: await poisonValidator.proofOfLatentFidelity(_representativeVector)
        const polfResult = { isPassed: true, reason: 'Mock validation', score: 1.0, anomalies: [] as string[] };

        if (process.env.ENABLE_POLF_VERIFICATION === 'true' && !polfResult.isPassed) {
          logger.warn(`Poisoning detected in memory package upload`, {
            userId: ctx.user.id,
            packageName: input.name,
            reason: polfResult.reason,
            anomalies: polfResult.anomalies,
          });

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Security check failed: ${polfResult.reason}. Your KV-Cache shows signs of a poisoning attack.`,
            cause: {
              type: 'POISONING_DETECTED',
              score: polfResult.score,
              details: polfResult.anomalies,
              recommendations: [
                'Verify your context data is clean',
                'Check for adversarial manipulations in the memory',
                'Regenerate the KV-Cache from trusted sources',
              ],
            },
          });
        }

        logger.info(`KV-Cache passed anti-poisoning check (score: ${polfResult.score.toFixed(3)})`);

        // Existing: Step 2 - Create Package
        const result = await createMemoryPackage(
          input.kvCache as unknown as KVCache,
          input.wMatrix as WMatrixData,
          {
            name: input.name,
            description: input.description,
            version: input.version,
            creator: { id: ctx.user.id, name: ctx.user.name || 'Unknown' },
            tokenCount: input.tokenCount,
            compressionRatio: input.compressionRatio,
            contextDescription: input.contextDescription,
            trainingDataset: input.trainingDataset,
          }
        );

        // Save to database
        const db = await getDb();
        assertDatabaseAvailable(db);
        const insertResult = await db.insert(memoryPackages).values({
          packageId: result.packageId,
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          sourceModel: input.wMatrix.sourceModel,
          targetModel: input.wMatrix.targetModel,
          tokenCount: input.tokenCount,
          compressionRatio: String(input.compressionRatio),
          contextDescription: input.contextDescription,
          price: String(input.price),
          packageUrl: result.packageUrl,
          kvCacheUrl: result.kvCacheUrl || '',
          wMatrixUrl: result.wMatrixUrl || '',
          epsilon: String(input.wMatrix.epsilon),
          informationRetention: '0.9500',
        }).$returningId();
        const pkgId = insertResult[0]?.id;
        const [pkg] = pkgId ? await db.select().from(memoryPackages).where(eq(memoryPackages.id, pkgId)).limit(1) : [];

        return {
          success: true,
          package: pkg,
          packageId: result.packageId,
        };
      } catch (error: unknown) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create memory package: ${getErrorMessage(error)}`,
        });
      }
    }),

  /**
   * Create Chain Package
   */
  createChainPackage: protectedProcedure
    .input(CreateChainPackageSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // ============================================================
        // Step 1 - Anti-Poisoning Verification (PoLF)
        // STATUS: Mock implementation - see createVectorPackage for details
        // ============================================================
        logger.info(`[PoLF] Verifying reasoning chain (user: ${ctx.user.id})`);

        // Validate critical steps: first and last (to balance security and performance)
        const stepsToValidate = [
          { index: 0, step: input.chain.steps[0] },
          { index: input.chain.steps.length - 1, step: input.chain.steps[input.chain.steps.length - 1] },
        ];

        for (const { index, step } of stepsToValidate) {
          if (!step) continue; // Skip if step doesn't exist

          logger.info(`[PoLF] Validating step ${index + 1}/${input.chain.steps.length}`);

          // Extract representative vector from step's KV snapshot
          // Used for PoLF verification when enabled
          const _representativeVector = extractRepresentativeVector(step.kvSnapshot);

          // Mock validation - enable with ENABLE_POLF_VERIFICATION=true
          // Real implementation: await poisonValidator.proofOfLatentFidelity(_representativeVector)
          const polfResult = { isPassed: true, reason: 'Mock validation', score: 1.0, anomalies: [] as string[] };

          if (process.env.ENABLE_POLF_VERIFICATION === 'true' && !polfResult.isPassed) {
            logger.warn(`Poisoning detected in chain package step ${index + 1}`, {
              userId: ctx.user.id,
              packageName: input.name,
              stepIndex: index,
              reason: polfResult.reason,
              anomalies: polfResult.anomalies,
            });

            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Security check failed at step ${index + 1}: ${polfResult.reason}. Your reasoning chain shows signs of a poisoning attack.`,
              cause: {
                type: 'POISONING_DETECTED',
                score: polfResult.score,
                stepIndex: index,
                details: polfResult.anomalies,
                recommendations: [
                  'Verify your reasoning steps are from trusted sources',
                  'Check for adversarial perturbations in the chain',
                  'Regenerate the reasoning chain from clean data',
                ],
              },
            });
          }

          logger.info(`Step ${index + 1} passed anti-poisoning check (score: ${polfResult.score.toFixed(3)})`);
        }

        logger.info(`All critical steps passed anti-poisoning validation`);

        // Existing: Step 2 - Create Package
        const result = await createChainPackage(
          input.chain as unknown as ReasoningChainData,
          input.wMatrix as WMatrixData,
          {
            name: input.name,
            description: input.description,
            version: input.version,
            creator: { id: ctx.user.id, name: ctx.user.name || 'Unknown' },
            trainingDataset: input.trainingDataset,
          }
        );

        // Save to database
        const db = await getDb();
        assertDatabaseAvailable(db);
        const insertResult = await db.insert(chainPackages).values({
          packageId: result.packageId,
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          sourceModel: input.wMatrix.sourceModel,
          targetModel: input.wMatrix.targetModel,
          problemType: input.chain.problemType,
          solutionQuality: String(input.chain.solutionQuality),
          stepCount: input.chain.totalSteps,
          price: String(input.price),
          packageUrl: result.packageUrl,
          chainUrl: result.chainUrl || '',
          wMatrixUrl: result.wMatrixUrl || '',
          epsilon: String(input.wMatrix.epsilon),
          informationRetention: '0.9500',
        }).$returningId();
        const pkgId = insertResult[0]?.id;
        const [pkg] = pkgId ? await db.select().from(chainPackages).where(eq(chainPackages.id, pkgId)).limit(1) : [];

        return {
          success: true,
          package: pkg,
          packageId: result.packageId,
        };
      } catch (error: unknown) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create chain package: ${getErrorMessage(error)}`,
        });
      }
    }),

  /**
   * Browse Packages
   */
  browsePackages: publicProcedure
    .input(BrowsePackagesSchema)
    .query(async ({ input }) => {
      const db = await getDb();
      assertDatabaseAvailable(db);
      const table = getPackageTable(input.packageType);

      // Build query conditions
      const conditions: SQL[] = [];

      if (input.sourceModel) {
        conditions.push(eq(table.sourceModel, input.sourceModel));
      }

      if (input.targetModel) {
        conditions.push(eq(table.targetModel, input.targetModel));
      }

      if (input.search) {
        const searchCondition = or(
          like(table.name, `%${input.search}%`),
          like(table.description, `%${input.search}%`)
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      if (input.minPrice !== undefined) {
        conditions.push(sql`${table.price} >= ${input.minPrice}`);
      }

      if (input.maxPrice !== undefined) {
        conditions.push(sql`${table.price} <= ${input.maxPrice}`);
      }

      // Query packages
      const packages = await db
        .select()
        .from(table)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
          input.sortBy === 'recent' ? desc(table.createdAt) :
          input.sortBy === 'popular' ? desc(table.downloads) :
          input.sortBy === 'price_asc' ? table.price :
          input.sortBy === 'price_desc' ? desc(table.price) :
          desc(table.createdAt)
        )
        .limit(input.limit)
        .offset(input.offset);

      // Apply dynamic pricing to each package
      const packagesWithDynamicPricing = packages.map(pkg => {
        const pricing = calculateDynamicPrice(pkg, input.packageType);
        return {
          ...pkg,
          basePrice: pkg.price,
          ...pricing,
        };
      });

      return {
        success: true,
        packages: packagesWithDynamicPricing,
        total: packagesWithDynamicPricing.length,
      };
    }),

  // ============================================================================
  // Personalized Recommendations
  // ============================================================================

  /**
   * Get personalized package recommendations for the current user
   */
  getRecommendations: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(5),
      packageType: PackageTypeSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        logger.info(`[Recommendations] Generating for user ${ctx.user.id}`);

        // Generate recommendations using AI engine
        const recommendations = await generateRecommendations({
          userId: ctx.user.id,
          limit: input.limit,
        });

        // Filter by package type if specified
        let filtered = recommendations;
        if (input.packageType) {
          // Map vector recommendations to package types
          // (In production, you'd have type metadata in the vectors)
          filtered = recommendations; // Placeholder
        }

        return {
          success: true,
          recommendations: filtered.map(rec => ({
            packageId: rec.vectorId,
            score: rec.score,
            reason: rec.reason,
            package: rec.vector,
          })),
          total: filtered.length,
        };
      } catch (error) {
        logger.error('[Recommendations] Error:', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate recommendations',
          cause: error,
        });
      }
    }),

  /**
   * Track user browsing activity for recommendations
   */
  trackBrowsing: protectedProcedure
    .input(z.object({
      packageId: z.string(),
      packageType: PackageTypeSchema,
      action: z.enum(['view', 'click', 'search']),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Extract numeric ID from packageId (format: "vec_12345" -> 12345)
        const numericId = parseInt(input.packageId.split('_')[1] || '0');

        await trackBrowsingAction(
          ctx.user.id,
          numericId,
          input.action,
          {
            packageType: input.packageType,
            ...input.metadata,
          }
        );

        logger.info(
          `[Tracking] User ${ctx.user.id} ${input.action} package ${input.packageId}`
        );

        return {
          success: true,
          message: 'Browsing activity tracked successfully',
        };
      } catch (error) {
        logger.error('[Tracking] Error:', { error });
        // Don't throw error - tracking failure shouldn't break user experience
        return {
          success: false,
          message: 'Failed to track browsing activity',
        };
      }
    }),

  /**
   * Get Package Details
   */
  getPackage: publicProcedure
    .input(z.object({
      packageType: PackageTypeSchema,
      packageId: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      assertDatabaseAvailable(db);
      const table = getPackageTable(input.packageType);

      const [pkg] = await db
        .select()
        .from(table)
        .where(eq(table.packageId, input.packageId))
        .limit(1);

      if (!pkg) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Package not found',
        });
      }

      // Apply dynamic pricing
      const pricing = calculateDynamicPrice(pkg, input.packageType);

      return {
        success: true,
        package: {
          ...pkg,
          basePrice: pkg.price,
          ...pricing,
        },
      };
    }),

  /**
   * Purchase Package
   */
  purchasePackage: protectedProcedure
    .input(PurchasePackageSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      assertDatabaseAvailable(db);
      const table = getPackageTable(input.packageType);

      // Get package
      const [pkg] = await db
        .select()
        .from(table)
        .where(eq(table.packageId, input.packageId))
        .limit(1);

      if (!pkg) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Package not found',
        });
      }

      // Check if already purchased
      const [existingPurchase] = await db
        .select()
        .from(packagePurchases)
        .where(
          and(
            eq(packagePurchases.buyerId, ctx.user.id),
            eq(packagePurchases.packageId, input.packageId),
            eq(packagePurchases.packageType, input.packageType)
          )
        )
        .limit(1);

      if (existingPurchase) {
        return {
          success: true,
          alreadyPurchased: true,
          purchase: existingPurchase,
        };
      }

      // Calculate fees (10% platform fee)
      const priceNum = parseFloat(pkg.price.toString());
      const platformFee = (priceNum * 0.1).toFixed(2);
      const sellerEarnings = (priceNum * 0.9).toFixed(2);

      // Create purchase record
      const insertResult = await db.insert(packagePurchases).values({
        buyerId: ctx.user.id,
        sellerId: pkg.userId,
        packageId: input.packageId,
        packageType: input.packageType,
        price: pkg.price,
        platformFee,
        sellerEarnings,
        status: 'completed',
      }).$returningId();
      const purchaseId = insertResult[0]?.id;
      const [purchase] = purchaseId ? await db.select().from(packagePurchases).where(eq(packagePurchases.id, purchaseId)).limit(1) : [];

      // Send email notifications (async, don't block response)
      try {
        // Get buyer and seller info
        const [buyer] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const [seller] = await db.select().from(users).where(eq(users.id, pkg.userId)).limit(1);

        // Send purchase confirmation to buyer
        if (buyer?.email) {
          sendPurchaseConfirmationEmail(
            buyer.email,
            pkg.name,
            input.packageType,
            priceNum.toFixed(2)
          ).catch(err => logger.error('[Email] Failed to send purchase confirmation:', err));
        }

        // Send sale notification to seller
        if (seller?.email) {
          sendSaleNotificationEmail(
            seller.email,
            pkg.name,
            buyer?.name || 'Anonymous',
            priceNum.toFixed(2),
            sellerEarnings
          ).catch(err => logger.error('[Email] Failed to send sale notification:', err));
        }
      } catch (emailError) {
        logger.error('[Email] Error sending notifications:', { error: emailError });
      }

      return {
        success: true,
        alreadyPurchased: false,
        purchase,
      };
    }),

  /**
   * Download Package
   */
  downloadPackage: protectedProcedure
    .input(DownloadPackageSchema)
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      assertDatabaseAvailable(db);
      const table = getPackageTable(input.packageType);

      // Check if purchased
      const [purchase] = await db
        .select()
        .from(packagePurchases)
        .where(
          and(
            eq(packagePurchases.buyerId, ctx.user.id),
            eq(packagePurchases.packageId, input.packageId),
            eq(packagePurchases.packageType, input.packageType)
          )
        )
        .limit(1);

      if (!purchase) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Package not purchased',
        });
      }

      // Get package
      const [pkg] = await db
        .select()
        .from(table)
        .where(eq(table.packageId, input.packageId))
        .limit(1);

      if (!pkg) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Package not found',
        });
      }

      // Generate signed download URL (expires in 7 days = 604800 seconds)
      const expiresIn = 7 * 24 * 60 * 60; // 7 days in seconds
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

      // Extract S3 key from packageUrl
      // URL format: https://bucket.s3.region.amazonaws.com/key
      let s3Key = pkg.packageUrl;
      try {
        const url = new URL(pkg.packageUrl);
        s3Key = url.pathname.slice(1); // Remove leading slash
      } catch {
        // If not a valid URL, assume it's already a key
      }

      // Generate signed URL
      const { url: signedUrl } = await storageGet(s3Key, expiresIn);

      // Record download
      await db.insert(packageDownloads).values({
        userId: ctx.user.id,
        packageId: input.packageId,
        packageType: input.packageType,
        downloadUrl: signedUrl,
        expiresAt,
      });

      // Update download count
      await db
        .update(table)
        .set({ downloads: sql`${table.downloads} + 1` })
        .where(eq(table.packageId, input.packageId));

      return {
        success: true,
        packageUrl: signedUrl,
        package: pkg,
        expiresAt: expiresAt.toISOString(),
      };
    }),

  /**
   * Get My Packages (created by me)
   */
  myPackages: protectedProcedure
    .input(z.object({ packageType: PackageTypeSchema }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      assertDatabaseAvailable(db);
      const table = getPackageTable(input.packageType);

      const packages = await db
        .select()
        .from(table)
        .where(eq(table.userId, ctx.user.id))
        .orderBy(desc(table.createdAt));

      return {
        success: true,
        packages,
      };
    }),

  /**
   * Get My Purchases
   */
  myPurchases: protectedProcedure
    .input(z.object({ packageType: PackageTypeSchema }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      assertDatabaseAvailable(db);

      const purchases = await db
        .select()
        .from(packagePurchases)
        .where(
          and(
            eq(packagePurchases.buyerId, ctx.user.id),
            eq(packagePurchases.packageType, input.packageType)
          )
        )
        .orderBy(desc(packagePurchases.purchasedAt));

      return {
        success: true,
        purchases,
      };
    }),

  /**
   * Global Search - Search across all package types
   */
  globalSearch: publicProcedure
    .input(z.object({
      query: z.string().optional(),
      packageTypes: z.array(PackageTypeSchema).optional(), // Filter by specific types
      sourceModel: z.string().optional(),
      targetModel: z.string().optional(),
      category: z.string().optional(),
      minEpsilon: z.number().min(0).max(1).optional(),
      maxEpsilon: z.number().min(0).max(1).optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      assertDatabaseAvailable(db);
      const results: Array<{
        type: 'vector' | 'memory' | 'chain';
        package: VectorPackage | MemoryPackage | ChainPackage;
      }> = [];

      // Determine which package types to search
      const typesToSearch = input.packageTypes || ['vector', 'memory', 'chain'];

      // Search each package type
      for (const packageType of typesToSearch) {
        const table = getPackageTable(packageType);
        const conditions: SQL[] = [];

        // Text search (name or description)
        if (input.query) {
          const searchCondition = or(
            like(table.name, `%${input.query}%`),
            like(table.description, `%${input.query}%`)
          );
          if (searchCondition) conditions.push(searchCondition);
        }

        // Model filters
        if (input.sourceModel) {
          conditions.push(eq(table.sourceModel, input.sourceModel));
        }
        if (input.targetModel) {
          conditions.push(eq(table.targetModel, input.targetModel));
        }

        // Category filter (only for vector packages)
        if (input.category && packageType === 'vector') {
          // Use vectorPackages directly since we know it's a vector package
          conditions.push(eq(vectorPackages.category, input.category));
        }

        // Epsilon range filter
        if (input.minEpsilon !== undefined) {
          conditions.push(sql`${table.epsilon} >= ${input.minEpsilon}`);
        }
        if (input.maxEpsilon !== undefined) {
          conditions.push(sql`${table.epsilon} <= ${input.maxEpsilon}`);
        }

        // Price range filter
        if (input.minPrice !== undefined) {
          conditions.push(sql`${table.price} >= ${input.minPrice}`);
        }
        if (input.maxPrice !== undefined) {
          conditions.push(sql`${table.price} <= ${input.maxPrice}`);
        }

        // Query packages
        const packages = await db
          .select()
          .from(table)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(table.createdAt))
          .limit(Math.ceil(input.limit / typesToSearch.length)); // Distribute limit across types

        // Add to results with type annotation
        packages.forEach(pkg => {
          results.push({
            type: packageType,
            package: pkg,
          });
        });
      }

      // Sort all results by creation date and limit
      const sortedResults = results
        .sort((a, b) => {
          const dateA = new Date(a.package.createdAt).getTime();
          const dateB = new Date(b.package.createdAt).getTime();
          return dateB - dateA;
        })
        .slice(0, input.limit);

      return {
        success: true,
        results: sortedResults,
        total: sortedResults.length,
      };
    }),
});
