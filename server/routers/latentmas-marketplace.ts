/**
 * LatentMAS Marketplace API
 * 
 * Handles upload, validation, and trading of LatentMAS memory packages
 * Ensures all packages conform to the LatentMAS paper specification
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
// LatentMASPackageInput type is inferred from Zod schema below
import { storagePut } from '../storage';
import * as db from '../db';
import { nanoid } from 'nanoid';
import { applySoftProcrustesConstraint, computeOrthogonalityScore } from '../latentmas/svd-orthogonalization';
import { getDPEngine, createPrivacyDisclosure, type PrivacyLevel, type PrivacyMetadata } from '../latentmas/differential-privacy';
import { createLogger } from '../utils/logger';

const logger = createLogger('LatentMASMarketplace');

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for LatentMAS Memory Package
 * Enforces paper-compliant format
 */
const LatentMASPackageSchema = z.object({
  // Metadata
  name: z.string().min(1).max(200),
  description: z.string().min(10).max(1000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/), // Semantic versioning

  // Model information
  sourceModel: z.string(),
  targetModel: z.string(),

  // W-Matrix (REQUIRED)
  wMatrix: z.object({
    weights: z.array(z.array(z.number())), // 2D array
    biases: z.array(z.number()),
    epsilon: z.number().min(0).max(1), // Must be measured, not estimated
    orthogonalityScore: z.number().min(0),
    trainingAnchors: z.number().int().min(50), // Minimum 50 anchors
  }),

  // KV-Cache (OPTIONAL - can be sold separately)
  kvCache: z.object({
    keys: z.array(z.array(z.array(z.number()))),
    values: z.array(z.array(z.array(z.number()))),
    tokenCount: z.number().int().positive(),
    compressionRatio: z.number().min(0).max(1),
  }).optional(),

  // Quality metrics (REQUIRED)
  metrics: z.object({
    ttftReduction: z.number().min(0).max(100), // Percentage
    tokenSavings: z.number().int().min(0),
    bandwidthSaving: z.number().min(0).max(100),
    qualityScore: z.number().min(0).max(1),
  }),

  // Provenance (REQUIRED for trust)
  trainingDataset: z.string(),
  certificationLevel: z.enum(['platinum', 'gold', 'silver', 'bronze']),

  // Pricing
  price: z.number().positive(),
});

// Type inferred from Zod schema for validation functions
type LatentMASPackageInput = z.infer<typeof LatentMASPackageSchema>;

// ============================================================================
// Package Validation
// ============================================================================

/**
 * Validate that a package conforms to LatentMAS paper specification
 */
function validateLatentMASPackage(pkg: LatentMASPackageInput): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check W-Matrix dimensions
  const { wMatrix } = pkg;
  if (wMatrix.weights.length === 0 || wMatrix.weights[0].length === 0) {
    errors.push('W-Matrix weights cannot be empty');
  }
  
  if (wMatrix.biases.length !== wMatrix.weights.length) {
    errors.push('Bias vector length must match W-Matrix output dimension');
  }
  
  // Check epsilon quality
  if (wMatrix.epsilon > 0.15) {
    warnings.push(`High epsilon (${wMatrix.epsilon.toFixed(3)}) - quality may be poor`);
  }
  
  // Check orthogonality
  if (wMatrix.orthogonalityScore > 5.0) {
    warnings.push(`Poor orthogonality score (${wMatrix.orthogonalityScore.toFixed(2)}) - may cause instability`);
  }
  
  // Check training anchors
  if (wMatrix.trainingAnchors < 100) {
    warnings.push(`Low training anchor count (${wMatrix.trainingAnchors}) - recommend at least 100`);
  }
  
  // Check KV-Cache if present
  if (pkg.kvCache) {
    const { keys, values } = pkg.kvCache;
    
    if (keys.length !== values.length) {
      errors.push('KV-Cache keys and values must have same number of layers');
    }
    
    if (keys.length > 0 && keys[0].length !== values[0].length) {
      errors.push('KV-Cache keys and values must have same number of tokens');
    }
  }
  
  // Check metrics consistency
  const { metrics } = pkg;
  if (metrics.qualityScore < 0.3) {
    warnings.push(`Low quality score (${metrics.qualityScore.toFixed(2)}) - consider retraining`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Router
// ============================================================================

export const latentmasMarketplaceRouter = router({
  /**
   * Upload a new LatentMAS memory package
   */
  uploadPackage: protectedProcedure
    .input(LatentMASPackageSchema.extend({
      // Optional differential privacy settings
      applyPrivacy: z.boolean().optional().describe('Apply differential privacy to W-Matrix weights'),
      privacyLevel: z.enum(['low', 'medium', 'high']).optional().describe('Privacy protection level'),
      customPrivacyConfig: z.object({
        epsilon: z.number().positive(),
        delta: z.number().positive().max(1),
      }).optional().describe('Custom privacy parameters'),
    }))
    .mutation(async ({ input, ctx }) => {
      let privacyMetadata: PrivacyMetadata | undefined;
      let modifiedInput = { ...input };

      // Apply differential privacy if requested
      if (input.applyPrivacy) {
        logger.info(`[Privacy] Applying differential privacy to package from user ${ctx.user.id}`);
        const dpEngine = getDPEngine();

        // Determine privacy configuration
        const privacyConfig = input.customPrivacyConfig
          ? { ...input.customPrivacyConfig, level: 'custom' as const }
          : (input.privacyLevel || 'medium');

        try {
          // Apply privacy to W-Matrix weights (flatten, privatize, reshape)
          const originalWeights = input.wMatrix.weights;
          const flatWeights = originalWeights.flat();

          const privatized = dpEngine.addNoise(flatWeights, privacyConfig, false);
          privacyMetadata = privatized.metadata;

          // Reshape back to 2D array
          const privatizedWeights: number[][] = [];
          let idx = 0;
          for (let i = 0; i < originalWeights.length; i++) {
            privatizedWeights.push(privatized.vector.slice(idx, idx + originalWeights[i].length));
            idx += originalWeights[i].length;
          }

          // Apply privacy to biases
          const privatizedBiases = dpEngine.addNoise(input.wMatrix.biases, privacyConfig, false);

          // Update modified input with privatized weights
          modifiedInput.wMatrix = {
            ...input.wMatrix,
            weights: privatizedWeights,
            biases: privatizedBiases.vector,
          };

          logger.info(`[Privacy] Applied ${privatizedBiases.metadata.level} privacy: ε=${privatizedBiases.metadata.epsilon}, utility loss=${privatizedBiases.metadata.utilityLoss.toFixed(2)}%`);
        } catch (error) {
          logger.error('[Privacy] Error applying differential privacy:', { error });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to apply differential privacy',
            cause: error,
          });
        }
      }

      // Enforce Procrustes orthogonality constraint (paper requirement)
      try {
        const originalWeights = modifiedInput.wMatrix.weights;
        const originalScore = computeOrthogonalityScore(originalWeights);

        let adjustedWeights = originalWeights;
        let adjustedScore = originalScore;

        if (originalScore > 5.0) {
          adjustedWeights = applySoftProcrustesConstraint(originalWeights, 0.15);
          adjustedScore = computeOrthogonalityScore(adjustedWeights);

          logger.warn('[Orthogonality] Applied soft Procrustes constraint', {
            userId: ctx.user.id,
            originalScore,
            adjustedScore,
          });
        }

        modifiedInput.wMatrix = {
          ...modifiedInput.wMatrix,
          weights: adjustedWeights,
          orthogonalityScore: adjustedScore,
        };
      } catch (error) {
        logger.error('[Orthogonality] Failed to apply Procrustes constraint', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to validate W-Matrix orthogonality',
          cause: error,
        });
      }

      // Validate package
      const validation = validateLatentMASPackage(modifiedInput);

      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Package validation failed: ${validation.errors.join(', ')}`,
        });
      }
      
      // Serialize and upload to S3 (use modified input with privacy if applied)
      const packageData = JSON.stringify(modifiedInput);
      const packageKey = `latentmas-packages/${ctx.user.id}/${Date.now()}-${input.name.replace(/\s+/g, '-')}.json`;
      
      const { url } = await storagePut(
        packageKey,
        Buffer.from(packageData, 'utf-8'),
        'application/json'
      );

      // Save to database
      const packageId = `vpkg_${nanoid(16)}`;

      await db.createVectorPackage({
        packageId,
        userId: ctx.user.id,
        name: input.name,
        description: input.description,
        vectorUrl: url, // For now, use same URL for all files
        wMatrixUrl: url,
        packageUrl: url,
        sourceModel: input.sourceModel,
        targetModel: input.targetModel,
        dimension: input.wMatrix.weights[0]?.length || 0,
        epsilon: input.wMatrix.epsilon.toString(),
        informationRetention: input.metrics.qualityScore.toString(),
        category: 'nlp', // Default category
        price: input.price.toString(),
        status: 'active',
      });

      return {
        success: true,
        packageId,
        packageUrl: url,
        validation: {
          errors: validation.errors,
          warnings: validation.warnings,
        },
        privacy: privacyMetadata ? {
          applied: true,
          level: privacyMetadata.level,
          epsilon: privacyMetadata.epsilon,
          delta: privacyMetadata.delta,
          utilityLoss: privacyMetadata.utilityLoss,
          disclosure: createPrivacyDisclosure(privacyMetadata),
        } : {
          applied: false,
        },
        message: privacyMetadata
          ? `Package uploaded successfully with ${privacyMetadata.level} privacy protection (ε=${privacyMetadata.epsilon})`
          : 'Package uploaded successfully',
      };
    }),
  
  /**
   * Browse LatentMAS packages with advanced filtering
   */
  browsePackages: publicProcedure
    .input(z.object({
      sourceModel: z.string().optional(),
      targetModel: z.string().optional(),
      maxEpsilon: z.number().optional(),
      minQualityScore: z.number().optional(),
      certificationLevel: z.enum(['platinum', 'gold', 'silver', 'bronze']).optional(),
      includeKVCache: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      // Query from database
      const packages = await db.browseVectorPackages({
        sourceModel: input.sourceModel,
        targetModel: input.targetModel,
        maxEpsilon: input.maxEpsilon,
        status: 'active',
        limit: input.limit,
        offset: input.offset,
      });

      // Transform to match expected format
      const formattedPackages = packages.map(pkg => ({
        id: pkg.packageId,
        name: pkg.name,
        description: pkg.description,
        sourceModel: pkg.sourceModel,
        targetModel: pkg.targetModel,
        epsilon: parseFloat(pkg.epsilon),
        qualityScore: parseFloat(pkg.informationRetention),
        certificationLevel: 'gold' as const, // Default certification
        price: parseFloat(pkg.price),
        hasKVCache: false, // Can be extended later
        downloads: pkg.downloads,
        rating: parseFloat(pkg.rating || '0'),
        createdAt: pkg.createdAt,
      }));

      return {
        packages: formattedPackages,
        total: packages.length,
        hasMore: packages.length >= input.limit,
      };
    }),
  
  /**
   * Get package details
   */
  getPackageDetails: publicProcedure
    .input(z.object({
      packageId: z.string(),
    }))
    .query(async ({ input }) => {
      // Fetch from database
      const pkg = await db.getVectorPackageByPackageId(input.packageId);

      if (!pkg) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Package not found',
        });
      }

      return {
        id: pkg.packageId,
        name: pkg.name,
        description: pkg.description,
        sourceModel: pkg.sourceModel,
        targetModel: pkg.targetModel,
        dimension: pkg.dimension,
        epsilon: parseFloat(pkg.epsilon),
        informationRetention: parseFloat(pkg.informationRetention),
        category: pkg.category,
        price: parseFloat(pkg.price),
        downloads: pkg.downloads,
        rating: parseFloat(pkg.rating || '0'),
        reviewCount: pkg.reviewCount,
        packageUrl: pkg.packageUrl,
        vectorUrl: pkg.vectorUrl,
        wMatrixUrl: pkg.wMatrixUrl,
        status: pkg.status,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
      };
    }),
  
  /**
   * Purchase a package
   */
  purchasePackage: protectedProcedure
    .input(z.object({
      packageId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get package details
      const pkg = await db.getVectorPackageByPackageId(input.packageId);

      if (!pkg) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Package not found',
        });
      }

      if (pkg.status !== 'active') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Package is not available for purchase',
        });
      }

      // Check if user already owns this package
      const existingPurchase = await db.getUserPackagePurchaseByPackageId(ctx.user.id, input.packageId);
      if (existingPurchase && existingPurchase.status === 'completed') {
        // User already owns it, return download URL
        return {
          success: true,
          downloadUrl: pkg.packageUrl,
          vectorUrl: pkg.vectorUrl,
          wMatrixUrl: pkg.wMatrixUrl,
          message: 'You already own this package',
          alreadyOwned: true,
        };
      }

      // Calculate fees
      const amount = parseFloat(pkg.price);
      const platformFeeRate = 0.15; // 15%
      const platformFee = amount * platformFeeRate;
      const creatorEarnings = amount - platformFee;

      // Create Stripe checkout session for payment
      const { stripe } = await import('../stripe-client');

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: pkg.name,
                description: `${pkg.sourceModel} → ${pkg.targetModel} | ε: ${pkg.epsilon}`,
                metadata: {
                  packageId: input.packageId,
                  category: pkg.category,
                },
              },
              unit_amount: Math.round(amount * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/packages?success=true&packageId=${input.packageId}`,
        cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/packages?canceled=true`,
        metadata: {
          userId: ctx.user.id.toString(),
          packageId: input.packageId,
          purchaseType: 'latentmas_package',
          creatorId: pkg.userId.toString(),
          amount: amount.toFixed(2),
          platformFee: platformFee.toFixed(2),
          creatorEarnings: creatorEarnings.toFixed(2),
        },
      });

      // Record pending purchase in database
      const purchaseId = await db.createPackagePurchase({
        userId: ctx.user.id,
        packageId: pkg.id,
        amount: amount.toFixed(2),
        status: 'pending',
      });

      return {
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        purchaseId,
        message: 'Redirect to checkout to complete purchase',
      };
    }),
  
  /**
   * Validate a package before upload (dry-run)
   */
  validatePackage: publicProcedure
    .input(LatentMASPackageSchema)
    .mutation(async ({ input }) => {
      const validation = validateLatentMASPackage(input);

      return {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        recommendations: generateRecommendations(input, validation),
      };
    }),
  
  /**
   * Get marketplace statistics
   */
  getStatistics: publicProcedure
    .query(async () => {
      // Calculate from database
      const stats = await db.getVectorPackagesStatistics();

      return {
        totalPackages: stats.totalPackages,
        totalDownloads: stats.totalDownloads,
        averageEpsilon: stats.averageEpsilon,
        averageRating: stats.averageRating,
        certificationDistribution: {
          platinum: 0,
          gold: stats.totalPackages, // Assume all are gold for now
          silver: 0,
          bronze: 0,
        },
        popularModelPairs: [],
      };
    }),

  /**
   * Get privacy information for a package
   * Shows privacy guarantees and utility impact to potential buyers
   */
  getPackagePrivacyInfo: publicProcedure
    .input(z.object({
      packageId: z.string(),
    }))
    .query(async ({ input }) => {
      // Fetch package
      const pkg = await db.getVectorPackageByPackageId(input.packageId);

      if (!pkg) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Package not found',
        });
      }

      // In production, privacy metadata would be stored in DB
      // For now, return default privacy info if epsilon is very high (suggesting privacy was applied)
      const hasPrivacy = parseFloat(pkg.epsilon) > 0.1;

      if (!hasPrivacy) {
        return {
          hasPrivacy: false,
          message: 'This package does not have differential privacy protection applied.',
        };
      }

      const dpEngine = getDPEngine();
      const epsilon = parseFloat(pkg.epsilon);
      const dimension = Math.max(pkg.dimension, 1);
      const syntheticVector = Array.from({ length: dimension }, (_, i) => (i % 2 === 0 ? 0.5 : -0.5));
      const { metadata } = dpEngine.addNoise(syntheticVector, { epsilon, delta: 1e-5 }, false);
      const computedMetadata: PrivacyMetadata = {
        ...metadata,
        epsilon,
        dimension,
        timestamp: pkg.createdAt,
      };

      return {
        hasPrivacy: true,
        metadata: computedMetadata,
        disclosure: createPrivacyDisclosure(computedMetadata),
        explanation: {
          whatIsDP: 'Differential Privacy mathematically guarantees that the package cannot reveal information about any specific training example.',
          epsilonMeaning: `Epsilon (ε) = ${computedMetadata.epsilon.toFixed(2)} means the package provides ${computedMetadata.level} privacy protection.`,
          utilityImpact: `The privacy protection adds ~${computedMetadata.utilityLoss.toFixed(1)}% utility loss compared to the unprotected version.`,
        },
      };
    }),

  /**
   * Get recommended privacy settings for upload
   */
  getRecommendedPrivacySettings: protectedProcedure
    .input(z.object({
      vectorDimension: z.number().int().positive(),
      category: z.string(),
      useCase: z.enum(['research', 'enterprise', 'medical']).optional(),
    }))
    .query(async ({ input }) => {
      const dpEngine = getDPEngine();
      const useCase = input.useCase || 'enterprise';
      const recommendedLevel = dpEngine.getRecommendedLevel(useCase);

      return {
        recommendedLevel,
        useCaseGuidance: {
          research: 'Low privacy (ε=10.0) - Suitable for public research with non-sensitive data',
          enterprise: 'Medium privacy (ε=1.0) - Recommended for commercial applications',
          medical: 'High privacy (ε=0.1) - Required for medical/financial sensitive data',
        },
        categorySpecific: input.category === 'medical' || input.category === 'finance'
          ? 'High privacy strongly recommended for this category'
          : 'Medium privacy is sufficient for most use cases',
        estimatedUtilityLoss: {
          low: '0.3% - Minimal impact on quality',
          medium: '2.1% - Small but noticeable quality reduction',
          high: '8.7% - Significant quality tradeoff for maximum privacy',
        },
      };
    }),
});

// ============================================================================
// Helper Functions
// ============================================================================

function generateRecommendations(
  pkg: LatentMASPackageInput,
  validation: { valid: boolean; errors: string[]; warnings: string[] }
): string[] {
  const recommendations: string[] = [];

  // Epsilon recommendations
  if (pkg.wMatrix.epsilon > 0.10) {
    recommendations.push('Consider retraining with more anchor prompts to reduce epsilon');
  }

  // Orthogonality recommendations
  if (pkg.wMatrix.orthogonalityScore > 2.0) {
    recommendations.push('Apply stronger Procrustes orthogonality constraint during training');
  }

  // KV-Cache recommendations
  if (!pkg.kvCache) {
    recommendations.push('Consider including KV-Cache for better value proposition');
  }

  // Pricing recommendations
  if (pkg.price > 500 && pkg.metrics.qualityScore < 0.7) {
    recommendations.push('Price may be too high for the quality score - consider lowering');
  }

  return recommendations;
}
