/**
 * LatentMAS Marketplace API
 * 
 * Handles upload, validation, and trading of LatentMAS memory packages
 * Ensures all packages conform to the LatentMAS paper specification
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import type { LatentMASMemoryPackage } from '../latentmas/kv-cache-w-matrix-integration';
import { storagePut } from '../storage';

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

// ============================================================================
// Package Validation
// ============================================================================

/**
 * Validate that a package conforms to LatentMAS paper specification
 */
function validateLatentMASPackage(pkg: any): {
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
    .input(LatentMASPackageSchema)
    .mutation(async ({ input, ctx }) => {
      // Validate package
      const validation = validateLatentMASPackage(input);
      
      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Package validation failed: ${validation.errors.join(', ')}`,
        });
      }
      
      // Serialize and upload to S3
      const packageData = JSON.stringify(input);
      const packageKey = `latentmas-packages/${ctx.user.id}/${Date.now()}-${input.name.replace(/\s+/g, '-')}.json`;
      
      const { url } = await storagePut(
        packageKey,
        Buffer.from(packageData, 'utf-8'),
        'application/json'
      );
      
      // TODO: Save to database
      // const listing = await db.insert(latentmasListings).values({
      //   userId: ctx.user.id,
      //   name: input.name,
      //   sourceModel: input.sourceModel,
      //   targetModel: input.targetModel,
      //   epsilon: input.wMatrix.epsilon,
      //   price: input.price,
      //   packageUrl: url,
      //   certificationLevel: input.certificationLevel,
      // });
      
      return {
        success: true,
        packageUrl: url,
        validation: {
          errors: validation.errors,
          warnings: validation.warnings,
        },
        message: 'Package uploaded successfully',
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
      // TODO: Query from database
      // For now, return mock data
      
      const mockPackages: any[] = [
        {
          id: 'pkg-001',
          name: 'GPT-3.5 → GPT-4 Memory',
          sourceModel: 'gpt-3.5-turbo',
          targetModel: 'gpt-4',
          epsilon: 0.034,
          qualityScore: 0.87,
          certificationLevel: 'gold',
          price: 299.0,
          hasKVCache: true,
          createdAt: new Date(),
        },
      ];
      
      return {
        packages: mockPackages,
        total: mockPackages.length,
        hasMore: false,
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
      // TODO: Fetch from database and S3
      
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Package not found',
      });
    }),
  
  /**
   * Purchase a package
   */
  purchasePackage: protectedProcedure
    .input(z.object({
      packageId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // TODO: Implement payment and access grant
      
      return {
        success: true,
        downloadUrl: 'https://example.com/download',
        message: 'Package purchased successfully',
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
      // TODO: Calculate from database
      
      return {
        totalPackages: 10,
        totalTransactions: 42,
        averageEpsilon: 0.045,
        certificationDistribution: {
          platinum: 2,
          gold: 4,
          silver: 3,
          bronze: 1,
        },
        popularModelPairs: [
          { source: 'gpt-3.5-turbo', target: 'gpt-4', count: 5 },
          { source: 'claude-3-sonnet', target: 'gpt-4', count: 3 },
        ],
      };
    }),
});

// ============================================================================
// Helper Functions
// ============================================================================

function generateRecommendations(
  pkg: any,
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
