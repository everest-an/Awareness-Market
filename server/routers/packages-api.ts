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
import { prisma } from '../db-prisma';
import { getErrorMessage, assertDatabaseAvailable, assertPackageExists, throwValidationFailed } from '../utils/error-handling';
import { createLogger } from '../utils/logger';
import { AntiPoisoningVerifier, type ChallengeResponse } from '../latentmas/anti-poisoning';
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

import type { VectorPackage, MemoryPackage, ChainPackage } from '@prisma/client';
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
import { stripe } from '../stripe-client';

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
  polfResponse: z.object({
    challengeId: z.string(),
    vectorOutputs: z.array(z.array(z.number())),
    signature: z.string(),
    timestamp: z.number(),
  }).optional(),
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
  polfResponse: z.object({
    challengeId: z.string(),
    vectorOutputs: z.array(z.array(z.number())),
    signature: z.string(),
    timestamp: z.number(),
  }).optional(),
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
  polfResponse: z.object({
    challengeId: z.string(),
    vectorOutputs: z.array(z.array(z.number())),
    signature: z.string(),
    timestamp: z.number(),
  }).optional(),
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
  paymentMethod: z.enum(['credits', 'stripe', 'crypto']).default('credits'),
  paymentMethodId: z.string().optional(),
});

// Download Package
const DownloadPackageSchema = z.object({
  packageType: PackageTypeSchema,
  packageId: z.string(),
});

// ============================================================================
// Helper Functions
// ============================================================================

// getPackageTable removed - using Prisma models directly

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

function computeInformationRetention(epsilon: number): string {
  if (!Number.isFinite(epsilon)) return '0.0000';
  const retention = Math.max(0, Math.min(1, 1 - epsilon));
  return retention.toFixed(4);
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
   * Generate anti-poisoning challenge (PoLF)
   */
  getPoisoningChallenge: protectedProcedure
    .query(async () => {
      const challenge = poisonValidator.generateChallenge();
      return {
        success: true,
        challenge,
        expiresAt: challenge.expiresAt,
      };
    }),
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
        const polfEnabled = process.env.ENABLE_POLF_VERIFICATION === 'true';
        let polfResult = { isPassed: true, reason: 'Not enforced', score: 1.0, anomalies: [] as string[] };

        if (polfEnabled) {
          if (!input.polfResponse) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'PoLF verification required. Please request a challenge and provide a response.',
            });
          }

          const verification = poisonValidator.verify(input.polfResponse as ChallengeResponse);
          polfResult = {
            isPassed: verification.passed,
            reason: verification.passed ? 'PoLF verification passed' : 'PoLF verification failed',
            score: Number(verification.fidelityScore.toFixed(3)),
            anomalies: verification.anomalies,
          };

          logger.info(`[PoLF] Verification result`, {
            userId: ctx.user.id,
            passed: polfResult.isPassed,
            score: polfResult.score,
            anomalies: polfResult.anomalies,
          });
        } else {
          logger.info(`[PoLF] Verification not enforced (user: ${ctx.user.id})`);
        }

        if (polfEnabled && !polfResult.isPassed) {
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
        const pkg = await prisma.vectorPackage.create({
          data: {
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
            informationRetention: computeInformationRetention(input.wMatrix.epsilon),
            dimension: input.vector.dimension,
          },
        });

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
        // ============================================================
        const polfEnabled = process.env.ENABLE_POLF_VERIFICATION === 'true';
        let polfResult = { isPassed: true, reason: 'Not enforced', score: 1.0, anomalies: [] as string[] };

        if (polfEnabled) {
          if (!input.polfResponse) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'PoLF verification required. Please request a challenge and provide a response.',
            });
          }

          const verification = poisonValidator.verify(input.polfResponse as ChallengeResponse);
          polfResult = {
            isPassed: verification.passed,
            reason: verification.passed ? 'PoLF verification passed' : 'PoLF verification failed',
            score: Number(verification.fidelityScore.toFixed(3)),
            anomalies: verification.anomalies,
          };

          logger.info(`[PoLF] Verification result`, {
            userId: ctx.user.id,
            passed: polfResult.isPassed,
            score: polfResult.score,
            anomalies: polfResult.anomalies,
          });
        } else {
          logger.info(`[PoLF] Verification not enforced (user: ${ctx.user.id})`);
        }

        if (polfEnabled && !polfResult.isPassed) {
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
        const pkg = await prisma.memoryPackage.create({
          data: {
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
            informationRetention: computeInformationRetention(input.wMatrix.epsilon),
          },
        });

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
        // ============================================================
        const polfEnabled = process.env.ENABLE_POLF_VERIFICATION === 'true';
        let polfResult = { isPassed: true, reason: 'Not enforced', score: 1.0, anomalies: [] as string[] };

        if (polfEnabled) {
          if (!input.polfResponse) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'PoLF verification required. Please request a challenge and provide a response.',
            });
          }

          const verification = poisonValidator.verify(input.polfResponse as ChallengeResponse);
          polfResult = {
            isPassed: verification.passed,
            reason: verification.passed ? 'PoLF verification passed' : 'PoLF verification failed',
            score: Number(verification.fidelityScore.toFixed(3)),
            anomalies: verification.anomalies,
          };

          logger.info(`[PoLF] Verification result`, {
            userId: ctx.user.id,
            passed: polfResult.isPassed,
            score: polfResult.score,
            anomalies: polfResult.anomalies,
          });
        } else {
          logger.info(`[PoLF] Verification not enforced (user: ${ctx.user.id})`);
        }

        if (polfEnabled && !polfResult.isPassed) {
          logger.warn(`Poisoning detected in chain package upload`, {
            userId: ctx.user.id,
            packageName: input.name,
            reason: polfResult.reason,
            anomalies: polfResult.anomalies,
          });

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Security check failed: ${polfResult.reason}. Your reasoning chain shows signs of a poisoning attack.`,
            cause: {
              type: 'POISONING_DETECTED',
              score: polfResult.score,
              details: polfResult.anomalies,
              recommendations: [
                'Verify your reasoning steps are from trusted sources',
                'Check for adversarial perturbations in the chain',
                'Regenerate the reasoning chain from clean data',
              ],
            },
          });
        }

        logger.info(`Reasoning chain passed anti-poisoning check (score: ${polfResult.score.toFixed(3)})`);

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
        const pkg = await prisma.chainPackage.create({
          data: {
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
            informationRetention: computeInformationRetention(input.wMatrix.epsilon),
          },
        });

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

      // Build Prisma where conditions
      const where: any = {
        status: 'active',
      };

      if (input.sourceModel) {
        where.sourceModel = input.sourceModel;
      }

      if (input.targetModel) {
        where.targetModel = input.targetModel;
      }

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      if (input.minPrice !== undefined || input.maxPrice !== undefined) {
        where.price = {};
        if (input.minPrice !== undefined) {
          where.price.gte = String(input.minPrice);
        }
        if (input.maxPrice !== undefined) {
          where.price.lte = String(input.maxPrice);
        }
      }

      // Determine sort order
      let orderBy: any = { createdAt: 'desc' };
      switch (input.sortBy) {
        case 'recent':
          orderBy = { createdAt: 'desc' };
          break;
        case 'popular':
          orderBy = { downloads: 'desc' };
          break;
        case 'price_asc':
          orderBy = { price: 'asc' };
          break;
        case 'price_desc':
          orderBy = { price: 'desc' };
          break;
        case 'rating':
          orderBy = { rating: 'desc' };
          break;
      }

      // Query packages based on type
      let packages: any[] = [];
      
      try {
        if (input.packageType === 'vector') {
          packages = await prisma.vectorPackage.findMany({
            where,
            orderBy,
            take: input.limit,
            skip: input.offset,
          });
        } else if (input.packageType === 'memory') {
          packages = await prisma.memoryPackage.findMany({
            where,
            orderBy,
            take: input.limit,
            skip: input.offset,
          });
        } else if (input.packageType === 'chain') {
          packages = await prisma.chainPackage.findMany({
            where,
            orderBy,
            take: input.limit,
            skip: input.offset,
          });
        }
      } catch (error) {
        logger.error('Failed to browse packages', { error, packageType: input.packageType });
        // Return empty array on error
        packages = [];
      }

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

        if (input.packageType && input.packageType !== 'vector') {
          const packages = input.packageType === 'memory'
            ? await prisma.memoryPackage.findMany({
                where: { status: 'active' },
                orderBy: { downloads: 'desc' },
                take: input.limit,
              })
            : await prisma.chainPackage.findMany({
                where: { status: 'active' },
                orderBy: { downloads: 'desc' },
                take: input.limit,
              });

          const recommendations = packages.map((pkg) => {
            const downloads = Number((pkg as { downloads?: number | string }).downloads || 0);
            const score = Math.min(100, downloads * 2);
            return {
              packageId: pkg.packageId,
              score,
              reason: `Popular ${input.packageType} package based on download activity.`,
              package: pkg,
            };
          });

          return {
            success: true,
            recommendations,
            total: recommendations.length,
          };
        }

        // Generate recommendations using AI engine (vector packages)
        const recommendations = await generateRecommendations({
          userId: ctx.user.id,
          limit: input.limit,
        });

        const filtered = recommendations;

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
      let pkg: any = null;

      if (input.packageType === 'vector') {
        pkg = await prisma.vectorPackage.findUnique({
          where: { packageId: input.packageId },
        });
      } else if (input.packageType === 'memory') {
        pkg = await prisma.memoryPackage.findUnique({
          where: { packageId: input.packageId },
        });
      } else if (input.packageType === 'chain') {
        pkg = await prisma.chainPackage.findUnique({
          where: { packageId: input.packageId },
        });
      }

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
      // Get package
      let pkg: any = null;
      if (input.packageType === 'vector') {
        pkg = await prisma.vectorPackage.findUnique({
          where: { packageId: input.packageId },
        });
      } else if (input.packageType === 'memory') {
        pkg = await prisma.memoryPackage.findUnique({
          where: { packageId: input.packageId },
        });
      } else if (input.packageType === 'chain') {
        pkg = await prisma.chainPackage.findUnique({
          where: { packageId: input.packageId },
        });
      }

      if (!pkg) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Package not found',
        });
      }

      // Check if already purchased
      const existingPurchase = await prisma.packagePurchase.findFirst({
        where: {
          buyerId: ctx.user.id,
          packageId: input.packageId,
          packageType: input.packageType,
        },
      });

      if (existingPurchase) {
        return {
          success: true,
          alreadyPurchased: true,
          purchase: existingPurchase,
        };
      }

      const priceNum = parseFloat(pkg.price.toString());
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid package price',
        });
      }

      let purchase = null as any;
      let alreadyPurchased = false;

      if (input.paymentMethod === 'credits') {
        const { purchaseWithCredits } = await import('../utils/credit-payment-system');
        const result = await purchaseWithCredits({
          userId: ctx.user.id,
          amount: priceNum,
          packageType: input.packageType,
          packageId: input.packageId,
          metadata: {
            source: 'packages-api',
          },
        });

        alreadyPurchased = result.transactionId === 0;
        purchase = await prisma.packagePurchase.findUnique({
          where: { id: result.purchaseId },
        });
      } else if (input.paymentMethod === 'stripe') {
        if (!input.paymentMethodId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'paymentMethodId is required for Stripe purchases',
          });
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(priceNum * 100),
          currency: 'usd',
          payment_method: input.paymentMethodId,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never',
          },
          metadata: {
            userId: ctx.user.id.toString(),
            packageType: input.packageType,
            packageId: input.packageId,
          },
        });

        if (paymentIntent.status !== 'succeeded') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Payment failed',
          });
        }

        const platformFee = (priceNum * 0.1).toFixed(2);
        const sellerEarnings = (priceNum * 0.9).toFixed(2);

        purchase = await prisma.packagePurchase.create({
          data: {
            buyerId: ctx.user.id,
            sellerId: pkg.userId,
            packageId: input.packageId,
            packageType: input.packageType,
            price: pkg.price,
            platformFee,
            sellerEarnings,
            status: 'completed',
            stripePaymentIntentId: paymentIntent.id,
            paymentMethod: 'stripe',
          },
        });
      } else {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'Crypto purchase is not available here. Please top up credits and use paymentMethod=credits.',
        });
      }

      // Send email notifications (async, don't block response)
      if (!alreadyPurchased && purchase) {
        try {
          // Get buyer and seller info
          const buyer = await prisma.user.findUnique({
            where: { id: ctx.user.id },
          });
          const seller = await prisma.user.findUnique({
            where: { id: pkg.userId },
          });

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
            const sellerEarnings = (priceNum * 0.9).toFixed(2);
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
      }

      return {
        success: true,
        alreadyPurchased,
        purchase,
      };
    }),

  /**
   * Download Package
   */
  downloadPackage: protectedProcedure
    .input(DownloadPackageSchema)
    .query(async ({ ctx, input }) => {
      // Check if purchased
      const purchase = await prisma.packagePurchase.findFirst({
        where: {
          buyerId: ctx.user.id,
          packageId: input.packageId,
          packageType: input.packageType,
        },
      });

      if (!purchase) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Package not purchased',
        });
      }

      // Get package
      let pkg: any = null;
      if (input.packageType === 'vector') {
        pkg = await prisma.vectorPackage.findUnique({
          where: { packageId: input.packageId },
        });
      } else if (input.packageType === 'memory') {
        pkg = await prisma.memoryPackage.findUnique({
          where: { packageId: input.packageId },
        });
      } else if (input.packageType === 'chain') {
        pkg = await prisma.chainPackage.findUnique({
          where: { packageId: input.packageId },
        });
      }

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
      await prisma.packageDownload.create({
        data: {
          userId: ctx.user.id,
          packageId: input.packageId,
          packageType: input.packageType,
          downloadUrl: signedUrl,
          expiresAt,
        },
      });

      // Update download count
      if (input.packageType === 'vector') {
        await prisma.vectorPackage.update({
          where: { packageId: input.packageId },
          data: { downloads: { increment: 1 } },
        });
      } else if (input.packageType === 'memory') {
        await prisma.memoryPackage.update({
          where: { packageId: input.packageId },
          data: { downloads: { increment: 1 } },
        });
      } else if (input.packageType === 'chain') {
        await prisma.chainPackage.update({
          where: { packageId: input.packageId },
          data: { downloads: { increment: 1 } },
        });
      }

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
      let packages: any[] = [];

      if (input.packageType === 'vector') {
        packages = await prisma.vectorPackage.findMany({
          where: { userId: ctx.user.id },
          orderBy: { createdAt: 'desc' },
        });
      } else if (input.packageType === 'memory') {
        packages = await prisma.memoryPackage.findMany({
          where: { userId: ctx.user.id },
          orderBy: { createdAt: 'desc' },
        });
      } else if (input.packageType === 'chain') {
        packages = await prisma.chainPackage.findMany({
          where: { userId: ctx.user.id },
          orderBy: { createdAt: 'desc' },
        });
      }

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
      const purchases = await prisma.packagePurchase.findMany({
        where: {
          buyerId: ctx.user.id,
          packageType: input.packageType,
        },
        orderBy: { purchasedAt: 'desc' },
      });

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
      const results: Array<{
        type: 'vector' | 'memory' | 'chain';
        package: VectorPackage | MemoryPackage | ChainPackage;
      }> = [];

      // Determine which package types to search
      const typesToSearch = input.packageTypes || ['vector', 'memory', 'chain'];
      const limitPerType = Math.ceil(input.limit / typesToSearch.length);

      // Search each package type
      for (const packageType of typesToSearch) {
        const where: any = {};

        // Text search (name or description)
        if (input.query) {
          where.OR = [
            { name: { contains: input.query, mode: 'insensitive' } },
            { description: { contains: input.query, mode: 'insensitive' } },
          ];
        }

        // Model filters
        if (input.sourceModel) {
          where.sourceModel = input.sourceModel;
        }
        if (input.targetModel) {
          where.targetModel = input.targetModel;
        }

        // Category filter (only for vector packages)
        if (input.category && packageType === 'vector') {
          where.category = input.category;
        }

        // Epsilon range filter
        if (input.minEpsilon !== undefined || input.maxEpsilon !== undefined) {
          where.epsilon = {};
          if (input.minEpsilon !== undefined) {
            where.epsilon.gte = String(input.minEpsilon);
          }
          if (input.maxEpsilon !== undefined) {
            where.epsilon.lte = String(input.maxEpsilon);
          }
        }

        // Price range filter
        if (input.minPrice !== undefined || input.maxPrice !== undefined) {
          where.price = {};
          if (input.minPrice !== undefined) {
            where.price.gte = String(input.minPrice);
          }
          if (input.maxPrice !== undefined) {
            where.price.lte = String(input.maxPrice);
          }
        }

        // Query packages
        let packages: any[] = [];
        try {
          if (packageType === 'vector') {
            packages = await prisma.vectorPackage.findMany({
              where,
              orderBy: { createdAt: 'desc' },
              take: limitPerType,
            });
          } else if (packageType === 'memory') {
            packages = await prisma.memoryPackage.findMany({
              where,
              orderBy: { createdAt: 'desc' },
              take: limitPerType,
            });
          } else if (packageType === 'chain') {
            packages = await prisma.chainPackage.findMany({
              where,
              orderBy: { createdAt: 'desc' },
              take: limitPerType,
            });
          }

          // Add to results with type annotation
          packages.forEach(pkg => {
            results.push({
              type: packageType,
              package: pkg,
            });
          });
        } catch (error) {
          logger.error(`Failed to search ${packageType} packages`, { error });
        }
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
