/**
 * W-Matrix Marketplace V2 API with Protocol Support
 * 
 * Enhanced marketplace with:
 * - Version management
 * - Quality certification
 * - Model compatibility queries
 * - Integrity verification
 * - CDN distribution
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { getErrorMessage } from '../utils/error-handling';
import {
  WMatrixProtocolBuilder,
  QualityCertifier,
  WMatrixVersionManager,
  IntegrityVerifier,
  ModelCompatibilityMatrix,
  type WMatrixVersion,
  type CertificationLevel,
  type CompatibilityEntry,
} from '../latentmas/w-matrix-protocol';
import { storagePut } from '../storage';
import { nanoid } from 'nanoid';

// ============================================================================
// Input Schemas
// ============================================================================

const CreateListingInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  sourceModel: z.string(),
  targetModel: z.string(),
  sourceDimension: z.number().int().positive(),
  targetDimension: z.number().int().positive(),
  weights: z.array(z.array(z.number())),
  biases: z.array(z.number()).optional(),
  price: z.number().positive(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/), // Semantic version
  standard: z.enum(['4096', '8192', '16384']),
  // Quality metrics
  epsilon: z.number().min(0).max(1),
  cosineSimilarity: z.number().min(0).max(1),
  euclideanDistance: z.number().min(0),
  testSamples: z.number().int().positive(),
  tags: z.array(z.string()).optional(),
});

const BrowseListingsInputSchema = z.object({
  sourceModel: z.string().optional(),
  targetModel: z.string().optional(),
  minCertification: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
  minVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  standard: z.enum(['4096', '8192', '16384']).optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['version', 'certification', 'price', 'recent']).default('recent'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const VerifyIntegrityInputSchema = z.object({
  listingId: z.string(),
  expectedChecksum: z.string(),
});

const GetCompatibleModelsInputSchema = z.object({
  sourceModel: z.string(),
  minCertification: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
});

// ============================================================================
// In-memory compatibility matrix (should be loaded from database)
// ============================================================================

const compatibilityMatrix = new ModelCompatibilityMatrix();

// ============================================================================
// Router
// ============================================================================

export const wMatrixMarketplaceV2Router = router({
  /**
   * Create W-Matrix listing with protocol support
   */
  createListing: protectedProcedure
    .input(CreateListingInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Create quality certification
        const certification = QualityCertifier.createCertification(
          input.epsilon,
          input.cosineSimilarity,
          input.euclideanDistance,
          input.testSamples
        );
        
        // Build W-Matrix protocol
        const protocol = new WMatrixProtocolBuilder()
          .setVersion(input.version)
          .setStandard(input.standard)
          .setModelPair({
            sourceModel: input.sourceModel,
            targetModel: input.targetModel,
            sourceDimension: input.sourceDimension,
            targetDimension: input.targetDimension,
          })
          .setWeights(input.weights, input.biases)
          .setCertification(certification)
          .setMetadata({
            createdBy: ctx.user.id.toString(),
            description: input.description,
            tags: input.tags || [],
          })
          .build();
        
        // Upload to S3
        const fileKey = `w-matrix/${ctx.user.id}/${nanoid()}-${Date.now()}.json`;
        const protocolJson = JSON.stringify(protocol);
        const { url: storageUrl } = await storagePut(fileKey, protocolJson, 'application/json');
        
        // Update protocol with CDN URLs
        protocol.metadata.downloadUrl = storageUrl;
        protocol.metadata.cdnUrls = [storageUrl];
        
        // Add to compatibility matrix
        compatibilityMatrix.addEntry({
          sourceModel: input.sourceModel,
          targetModel: input.targetModel,
          wMatrixId: protocol.metadata.id,
          version: protocol.metadata.version,
          certification: certification.level,
          epsilon: input.epsilon,
          available: true,
        });
        
        return {
          success: true,
          listing: {
            id: protocol.metadata.id,
            title: input.title,
            version: WMatrixVersionManager.formatVersion(protocol.metadata.version),
            certification: certification.level,
            qualityGrade: protocol.metadata.qualityGrade,
            downloadUrl: storageUrl,
            checksum: protocol.metadata.checksumSHA256,
            sizeBytes: protocol.metadata.sizeBytes,
          },
        };
      } catch (error: unknown) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create listing: ${getErrorMessage(error)}`,
        });
      }
    }),
  
  /**
   * Browse W-Matrix listings with advanced filtering
   */
  browseListings: publicProcedure
    .input(BrowseListingsInputSchema)
    .query(async ({ input }) => {
      // This is a simplified implementation
      // In production, this should query from database
      
      const { sourceModel, targetModel, minCertification, minVersion, limit, offset } = input;

      // Get all compatible matrices
      let results: CompatibilityEntry[] = [];
      
      if (sourceModel && targetModel) {
        results = compatibilityMatrix.getCompatibleMatrices(sourceModel, targetModel);
      } else if (sourceModel) {
        const targetModels = compatibilityMatrix.getSupportedTargetModels(sourceModel);
        for (const target of targetModels) {
          results.push(...compatibilityMatrix.getCompatibleMatrices(sourceModel, target));
        }
      } else {
        // Return all (not efficient, should use database)
        const sourceModels = compatibilityMatrix.getSupportedSourceModels();
        for (const source of sourceModels) {
          const targets = compatibilityMatrix.getSupportedTargetModels(source);
          for (const target of targets) {
            results.push(...compatibilityMatrix.getCompatibleMatrices(source, target));
          }
        }
      }
      
      // Filter by certification
      if (minCertification) {
        const certLevels: CertificationLevel[] = ['bronze', 'silver', 'gold', 'platinum'];
        const minLevel = certLevels.indexOf(minCertification);
        results = results.filter(r => certLevels.indexOf(r.certification) >= minLevel);
      }
      
      // Filter by version
      if (minVersion) {
        const minVer = WMatrixVersionManager.parseVersion(minVersion);
        results = results.filter(r => 
          WMatrixVersionManager.isCompatible(minVer, r.version)
        );
      }
      
      // Apply pagination
      const paginated = results.slice(offset, offset + limit);
      
      return {
        success: true,
        listings: paginated,
        total: results.length,
        hasMore: offset + limit < results.length,
      };
    }),
  
  /**
   * Get compatible target models for a source model
   */
  getCompatibleModels: publicProcedure
    .input(GetCompatibleModelsInputSchema)
    .query(async ({ input }) => {
      const { sourceModel, minCertification } = input;
      
      const targetModels = compatibilityMatrix.getSupportedTargetModels(sourceModel);
      
      const compatible = targetModels.map(target => {
        const best = compatibilityMatrix.getBestMatrix(sourceModel, target, minCertification);
        return {
          targetModel: target,
          available: best !== null,
          bestVersion: best ? WMatrixVersionManager.formatVersion(best.version) : null,
          certification: best?.certification,
          epsilon: best?.epsilon,
        };
      }).filter(c => c.available);
      
      return {
        success: true,
        sourceModel,
        compatibleModels: compatible,
        totalCount: compatible.length,
      };
    }),
  
  /**
   * Get best W-Matrix for model pair
   */
  getBestMatrix: publicProcedure
    .input(z.object({
      sourceModel: z.string(),
      targetModel: z.string(),
      minCertification: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
    }))
    .query(async ({ input }) => {
      const best = compatibilityMatrix.getBestMatrix(
        input.sourceModel,
        input.targetModel,
        input.minCertification
      );
      
      if (!best) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No compatible W-Matrix found for this model pair',
        });
      }
      
      return {
        success: true,
        matrix: {
          id: best.wMatrixId,
          version: WMatrixVersionManager.formatVersion(best.version),
          certification: best.certification,
          epsilon: best.epsilon,
          available: best.available,
        },
      };
    }),
  
  /**
   * Verify W-Matrix integrity
   */
  verifyIntegrity: publicProcedure
    .input(VerifyIntegrityInputSchema)
    .mutation(async ({ input }) => {
      try {
        // In production, fetch the W-Matrix data from storage
        // For now, this is a placeholder
        
        const { listingId, expectedChecksum } = input;
        
        // Simulate fetching data
        const mockData = JSON.stringify({ listingId });
        
        const report = IntegrityVerifier.generateIntegrityReport(mockData, expectedChecksum);
        
        return {
          success: true,
          valid: report.valid,
          actualChecksum: report.actualChecksum,
          expectedChecksum: report.expectedChecksum,
          sizeBytes: report.sizeBytes,
        };
      } catch (error: unknown) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Integrity verification failed: ${getErrorMessage(error)}`,
        });
      }
    }),
  
  /**
   * Get marketplace statistics
   */
  getStatistics: publicProcedure
    .query(async () => {
      const stats = compatibilityMatrix.getStatistics();
      
      return {
        success: true,
        statistics: {
          totalListings: stats.totalEntries,
          uniqueSourceModels: stats.uniqueSourceModels,
          uniqueTargetModels: stats.uniqueTargetModels,
          certificationDistribution: stats.certificationDistribution,
          averageEpsilon: stats.avgEpsilon,
        },
      };
    }),
  
  /**
   * Get supported source models
   */
  getSupportedSourceModels: publicProcedure
    .query(async () => {
      const models = compatibilityMatrix.getSupportedSourceModels();
      
      return {
        success: true,
        models,
        totalCount: models.length,
      };
    }),
  
  /**
   * Check version compatibility
   */
  checkVersionCompatibility: publicProcedure
    .input(z.object({
      required: z.string().regex(/^\d+\.\d+\.\d+$/),
      available: z.string().regex(/^\d+\.\d+\.\d+$/),
    }))
    .query(async ({ input }) => {
      const requiredVersion = WMatrixVersionManager.parseVersion(input.required);
      const availableVersion = WMatrixVersionManager.parseVersion(input.available);
      
      const compatible = WMatrixVersionManager.isCompatible(requiredVersion, availableVersion);
      const comparison = WMatrixVersionManager.compareVersions(availableVersion, requiredVersion);
      
      return {
        success: true,
        compatible,
        comparison: comparison > 0 ? 'newer' : comparison < 0 ? 'older' : 'equal',
        requiredVersion: input.required,
        availableVersion: input.available,
      };
    }),
  
  /**
   * Get certification details
   */
  getCertificationInfo: publicProcedure
    .input(z.object({
      epsilon: z.number().min(0).max(1),
    }))
    .query(async ({ input }) => {
      const level = QualityCertifier.getCertificationLevel(input.epsilon);
      const grade = QualityCertifier.getQualityGrade(input.epsilon);
      
      return {
        success: true,
        epsilon: input.epsilon,
        certificationLevel: level,
        qualityGrade: grade,
        thresholds: {
          platinum: 0.01,
          gold: 0.05,
          silver: 0.10,
          bronze: Infinity,
        },
      };
    }),
});
