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
import { getErrorMessage } from '../utils/error-handling';
import { createLogger } from '../utils/logger';
import { vectorPackages, memoryPackages, chainPackages, packageDownloads, packagePurchases, users } from '../../drizzle/schema';

const logger = createLogger('Packages:API');

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
    performanceMetrics: z.record(z.string(), z.any()).optional(),
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
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database unavailable',
          });
        }
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
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database unavailable',
          });
        }
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
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Database unavailable',
          });
        }
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
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
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
        conditions.push(
          or(
            like(table.name, `%${input.search}%`),
            like(table.description, `%${input.search}%`)
          )
        );
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

      return {
        success: true,
        packages,
        total: packages.length,
      };
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
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
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

      return {
        success: true,
        package: pkg,
      };
    }),

  /**
   * Purchase Package
   */
  purchasePackage: protectedProcedure
    .input(PurchasePackageSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
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
        logger.error('[Email] Error sending notifications:', emailError);
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
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
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
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
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
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });

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
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
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
          conditions.push(
            or(
              like(table.name, `%${input.query}%`),
              like(table.description, `%${input.query}%`)
            )
          );
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
          // Use sql template for category filter since table type varies
          conditions.push(sql`${(table as any).category} = ${input.category}`);
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
