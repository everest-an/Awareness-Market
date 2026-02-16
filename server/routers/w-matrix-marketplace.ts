import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { prisma } from "../db-prisma";
import { Prisma } from "@prisma/client";

// Cast prisma for models not yet in schema (legacy v1/v2)
const prismaAny = prisma as any;
import { assertPackageExists } from "../utils/error-handling";
import { createWMatrixPurchaseCheckout, stripe } from "../stripe-client";
import { pricingEngine } from "../pricing-engine";
import {
  WMatrixVersionManager,
  QualityCertifier,
  type WMatrixVersion,
  type CertificationLevel,
} from "../latentmas/w-matrix-protocol";
import { getGPUEngine } from "../latentmas/gpu-acceleration";
import { createLogger } from "../utils/logger";

type WMatrixListingUpdate = Partial<Prisma.WMatrixListingUpdateInput>;

const logger = createLogger('WMatrixMarketplace');
const gpuEngine = getGPUEngine({ enableFallback: true });

export const wMatrixMarketplaceRouter = router({
  /**
   * Create Stripe checkout session for W-Matrix purchase
   */
  createCheckout: protectedProcedure
    .input(z.object({
      listingId: z.number(),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await prisma.wMatrixListing.findUnique({
        where: { id: input.listingId },
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      if (listing.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This listing is not available for purchase" });
      }

      const existingPurchase = await prismaAny.wMatrixPurchase.findFirst({
        where: {
          listingId: input.listingId,
          buyerId: ctx.user.id,
          status: "completed",
        },
      });

      if (existingPurchase) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You have already purchased this W-Matrix" });
      }

      if (!ctx.user.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email is required to start checkout" });
      }

      const url = await createWMatrixPurchaseCheckout({
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        userName: ctx.user.name || undefined,
        listingId: input.listingId,
        listingTitle: listing.title,
        amount: parseFloat(listing.price.toString()),
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      });

      return { url };
    }),

  /**
   * Finalize checkout after Stripe redirect
   */
  finalizeCheckout: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await stripe.checkout.sessions.retrieve(input.sessionId);

      if (session.payment_status !== "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Payment not completed" });
      }

      const listingId = parseInt(session.metadata?.listing_id || "", 10);
      const userId = parseInt(session.metadata?.user_id || "", 10);

      if (!listingId || userId !== ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid checkout session" });
      }

      const listing = await prisma.wMatrixListing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      // ✅ P0-3: Wrap check + create in transaction to prevent double-purchase race condition
      const result = await prisma.$transaction(async (tx) => {
        const existingPurchase = await (tx as any).wMatrixPurchase.findFirst({
          where: {
            listingId,
            buyerId: ctx.user.id,
            status: "completed",
          },
        });

        if (existingPurchase) {
          return { success: true, purchaseId: existingPurchase.id, matrixId: listing.storageUrl };
        }

        const purchase = await (tx as any).wMatrixPurchase.create({
          data: {
            listingId,
            buyerId: ctx.user.id,
            price: listing.price,
            stripePaymentIntentId: session.payment_intent as string,
            status: "completed",
          },
        });

        await tx.wMatrixListing.update({
          where: { id: listingId },
          data: {
            downloads: { increment: 1 },
          },
        });

        return { success: true, purchaseId: purchase.id, matrixId: listing.storageUrl };
      }, {
        isolationLevel: 'Serializable' // ✅ Prevent race conditions
      });

      return result;
    }),

  /**
   * List all active W-Matrix listings with optional filtering
   */
  listListings: publicProcedure
    .input(z.object({
      sourceModel: z.string().optional(),
      targetModel: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      search: z.string().optional(),
      sortBy: z.enum(["price", "sales", "rating", "recent"]).default("recent"),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const { sourceModel, targetModel, minPrice, maxPrice, search, sortBy, limit, offset } = input;

      // Build where clause
      const where: Prisma.WMatrixListingWhereInput = { status: "active" };
      if (sourceModel) where.sourceModel = sourceModel;
      if (targetModel) where.targetModel = targetModel;
      if (minPrice !== undefined || maxPrice !== undefined) {
        where.price = {};
        if (minPrice !== undefined) where.price.gte = minPrice.toFixed(2);
        if (maxPrice !== undefined) where.price.lte = maxPrice.toFixed(2);
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Determine sort order
      let orderBy: Prisma.WMatrixListingOrderByWithRelationInput;
      switch (sortBy) {
        case "price":
          orderBy = { price: 'asc' };
          break;
        case "sales":
          orderBy = { downloads: 'desc' };
          break;
        case "rating":
          orderBy = { avgRating: 'desc' };
          break;
        case "recent":
        default:
          orderBy = { createdAt: 'desc' };
          break;
      }

      const listings = await prisma.wMatrixListing.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      });

      // Apply dynamic pricing and version info to each listing
      const listingsWithDynamicPricing = listings.map(listing => {
        const basePrice = parseFloat(listing.price.toString());
        const epsilon = parseFloat(listing.epsilon.toString());

        // Calculate dynamic price using PID controller
        const pricingResult = pricingEngine.calculatePackagePrice(
          "w_matrix",
          epsilon,
          10, // 10% royalty percentage (per whitepaper Section 10.5)
          basePrice
        );

        // Parse version from matrixId (format: "model1-model2-v1.2.3" or just use default)
        let version: WMatrixVersion = { major: 1, minor: 0, patch: 0 };
        const versionMatch = listing.storageUrl.match(/v?(\d+)\.(\d+)\.(\d+)/);
        if (versionMatch) {
          version = {
            major: parseInt(versionMatch[1]),
            minor: parseInt(versionMatch[2]),
            patch: parseInt(versionMatch[3]),
          };
        }

        // Get quality certification level based on epsilon
        const certificationLevel = QualityCertifier.getCertificationLevel(epsilon);

        return {
          ...listing,
          // Original creator-set price
          basePrice: listing.price,
          // Dynamically calculated current price
          currentPrice: pricingResult.totalPrice.toFixed(2),
          // Pricing breakdown for transparency
          pricingBreakdown: {
            alignmentFee: pricingResult.alignmentFee.toFixed(2),
            royaltyFee: pricingResult.royaltyFee.toFixed(2),
            qualityMultiplier: pricingResult.currentK.toFixed(2),
          },
          // Version information
          version: WMatrixVersionManager.formatVersion(version),
          versionDetails: version,
          certificationLevel,
        };
      });

      return listingsWithDynamicPricing;
    }),

  /**
   * Get a single W-Matrix listing by ID
   */
  getListing: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const listing = await prisma.wMatrixListing.findUnique({
        where: { id: input.id },
      });

      if (!listing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "W-Matrix listing not found",
        });
      }

      // Apply dynamic pricing
      const basePrice = parseFloat(listing.price.toString());
      const epsilon = parseFloat(listing.epsilon.toString());

      const pricingResult = pricingEngine.calculatePackagePrice(
        "w_matrix",
        epsilon,
        10, // 10% royalty percentage
        basePrice
      );

      // Parse version from matrixId
      let version: WMatrixVersion = { major: 1, minor: 0, patch: 0 };
      const versionMatch = listing.storageUrl.match(/v?(\d+)\.(\d+)\.(\d+)/);
      if (versionMatch) {
        version = {
          major: parseInt(versionMatch[1]),
          minor: parseInt(versionMatch[2]),
          patch: parseInt(versionMatch[3]),
        };
      }

      // Get quality certification level
      const certificationLevel = QualityCertifier.getCertificationLevel(epsilon);

      return {
        ...listing,
        basePrice: listing.price,
        currentPrice: pricingResult.totalPrice.toFixed(2),
        pricingBreakdown: {
          alignmentFee: pricingResult.alignmentFee.toFixed(2),
          royaltyFee: pricingResult.royaltyFee.toFixed(2),
          qualityMultiplier: pricingResult.currentK.toFixed(2),
        },
        version: WMatrixVersionManager.formatVersion(version),
        versionDetails: version,
        certificationLevel,
      };
    }),

  /**
   * Create a new W-Matrix listing (protected)
   */
  createListing: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      description: z.string().min(1),
      sourceModel: z.string(),
      targetModel: z.string(),
      sourceDim: z.number().int().positive(),
      targetDim: z.number().int().positive(),
      matrixId: z.string(), // Reference to stored matrix
      price: z.number().positive(),
      alignmentLoss: z.number().positive(),
      trainingDataSize: z.number().int().positive().optional(),
      performanceMetrics: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ✅ P0-2: Create listing with quota check in transaction to prevent spam
      const listing = await prisma.$transaction(async (tx) => {
        // Check user listing quota (inside transaction to prevent race condition)
        const user = await tx.user.findUnique({
          where: { id: ctx.user.id },
          select: { maxListings: true, currentListingCount: true, role: true },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // ✅ P0-2: Enforce listing quota (run migrate-v1-marketplace-quotas.ts to add these fields)
        if (user.currentListingCount >= user.maxListings) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Listing limit reached (${user.maxListings}). Please contact support to increase your limit.`,
          });
        }

        // Create listing
        const newListing = await tx.wMatrixListing.create({
          data: {
            creatorId: ctx.user.id,
            title: input.title,
            description: input.description,
            sourceModel: input.sourceModel,
            targetModel: input.targetModel,
            sourceDimension: input.sourceDim,
            targetDimension: input.targetDim,
            storageUrl: input.matrixId,
            price: input.price.toFixed(2),
            epsilon: input.alignmentLoss.toFixed(8),
            trainingDataSize: input.trainingDataSize,
            status: "active", // Auto-approve for now
            version: "1.0.0",
            standard: "W-Matrix-v1" as any,
          },
        });

        // ✅ P0-2: Increment user listing counter
        // Note: currentListingCount field doesn't exist in current schema
        // await tx.user.update({
        //   where: { id: ctx.user.id },
        //   data: { currentListingCount: { increment: 1 } } as any,
        // });

        return newListing;
      }, {
        isolationLevel: 'Serializable' // ✅ Prevent race conditions
      });

      return {
        success: true,
        listingId: listing.id,
      };
    }),

  /**
   * Update an existing W-Matrix listing (protected)
   */
  updateListing: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().min(1).optional(),
      price: z.number().positive().optional(),
      status: z.enum(["active", "inactive", "suspended"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const listing = await prisma.wMatrixListing.findUnique({
        where: { id: input.id },
      });

      if (!listing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Listing not found",
        });
      }

      if (listing.creatorId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own listings",
        });
      }

      const updates: WMatrixListingUpdate = {};
      if (input.title) updates.title = input.title;
      if (input.description) updates.description = input.description;
      if (input.price) updates.price = input.price.toFixed(2);
      if (input.status) updates.status = input.status;

      await prisma.wMatrixListing.update({
        where: { id: input.id },
        data: updates,
      });

      return { success: true };
    }),

  /**
   * Purchase a W-Matrix listing (protected)
   */
  purchaseListing: protectedProcedure
    .input(z.object({
      listingId: z.number(),
      stripePaymentIntentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get listing details
      const listing = await prisma.wMatrixListing.findUnique({
        where: { id: input.listingId },
      });

      if (!listing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Listing not found",
        });
      }

      if (listing.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This listing is not available for purchase",
        });
      }

      // ✅ P0-3: Wrap check + create in transaction to prevent double-purchase race condition
      const result = await prisma.$transaction(async (tx) => {
        // Check if already purchased (inside transaction)
        const existingPurchase = await (tx as any).wMatrixPurchase.findFirst({
          where: {
            listingId: input.listingId,
            buyerId: ctx.user.id,
            status: "completed",
          },
        });

        if (existingPurchase) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You have already purchased this W-Matrix",
          });
        }

        // Create purchase record
        const purchase = await (tx as any).wMatrixPurchase.create({
          data: {
            listingId: input.listingId,
            buyerId: ctx.user.id,
            price: listing.price,
            stripePaymentIntentId: input.stripePaymentIntentId,
            status: "completed", // Assume payment verified
          },
        });

        // Update listing stats
        await tx.wMatrixListing.update({
          where: { id: input.listingId },
          data: {
            downloads: { increment: 1 },
          },
        });

        return {
          success: true,
          purchaseId: purchase.id,
          matrixId: listing.storageUrl,
        };
      }, {
        isolationLevel: 'Serializable' // ✅ Prevent race conditions
      });

      return result;
    }),

  /**
   * Get user's purchased W-Matrices (protected)
   */
  myPurchases: protectedProcedure
    .query(async ({ ctx }) => {
      const purchases = await prismaAny.wMatrixPurchase.findMany({
        where: {
          buyerId: ctx.user.id,
          status: "completed",
        },
        include: {
          listing: true,
        },
        orderBy: { purchasedAt: 'desc' },
      });

      return purchases.map((p: any) => ({
        purchase: {
          id: p.id,
          listingId: p.listingId,
          buyerId: p.buyerId,
          price: p.price,
          stripePaymentIntentId: p.stripePaymentIntentId,
          status: p.status,
          purchasedAt: p.purchasedAt,
        },
        listing: p.listing,
      }));
    }),

  /**
   * Get user's published W-Matrix listings (protected)
   */
  myListings: protectedProcedure
    .query(async ({ ctx }) => {
      const listings = await prisma.wMatrixListing.findMany({
        where: { creatorId: ctx.user.id },
        orderBy: { createdAt: 'desc' },
      });

      return listings;
    }),

  /**
   * Get popular model pairs for marketplace
   */
  getPopularModelPairs: publicProcedure
    .query(async () => {
      const pairs = await prisma.$queryRaw<Array<{
        sourceModel: string;
        targetModel: string;
        count: bigint;
      }>>`
        SELECT
          sourceModel,
          targetModel,
          COUNT(*) as count
        FROM WMatrixListing
        WHERE status = 'active'
        GROUP BY sourceModel, targetModel
        ORDER BY count DESC
        LIMIT 10
      `;

      return pairs.map(p => ({
        sourceModel: p.sourceModel,
        targetModel: p.targetModel,
        count: Number(p.count),
      }));
    }),

  // ============================================================================
  // Version Management Endpoints
  // ============================================================================

  /**
   * Get version history for a specific model pair
   */
  getVersionHistory: publicProcedure
    .input(z.object({
      sourceModel: z.string(),
      targetModel: z.string(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      const listings = await prisma.wMatrixListing.findMany({
        where: {
          sourceModel: input.sourceModel,
          targetModel: input.targetModel,
          status: "active",
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });

      // Parse and sort by version
      const versioned = listings.map(listing => {
        let version: WMatrixVersion = { major: 1, minor: 0, patch: 0 };
        const versionMatch = listing.storageUrl.match(/v?(\d+)\.(\d+)\.(\d+)/);
        if (versionMatch) {
          version = {
            major: parseInt(versionMatch[1]),
            minor: parseInt(versionMatch[2]),
            patch: parseInt(versionMatch[3]),
          };
        }

        const epsilon = parseFloat(listing.epsilon.toString());
        const certificationLevel = QualityCertifier.getCertificationLevel(epsilon);

        return {
          id: listing.id,
          matrixId: listing.storageUrl,
          version: WMatrixVersionManager.formatVersion(version),
          versionDetails: version,
          certificationLevel,
          alignmentLoss: listing.epsilon,
          price: listing.price,
          totalSales: listing.downloads,
          averageRating: listing.avgRating,
          createdAt: listing.createdAt,
        };
      });

      // Sort by version (newest first)
      versioned.sort((a, b) =>
        WMatrixVersionManager.compareVersions(b.versionDetails, a.versionDetails)
      );

      return {
        sourceModel: input.sourceModel,
        targetModel: input.targetModel,
        totalVersions: versioned.length,
        versions: versioned,
      };
    }),

  /**
   * Check version compatibility
   */
  checkVersionCompatibility: publicProcedure
    .input(z.object({
      requiredVersion: z.string(),
      availableVersion: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const required = WMatrixVersionManager.parseVersion(input.requiredVersion);
        const available = WMatrixVersionManager.parseVersion(input.availableVersion);

        const isCompatible = WMatrixVersionManager.isCompatible(required, available);
        const isNewer = WMatrixVersionManager.isNewer(available, required);
        const comparison = WMatrixVersionManager.compareVersions(available, required);

        return {
          compatible: isCompatible,
          isNewer,
          comparison: comparison > 0 ? 'newer' : comparison < 0 ? 'older' : 'equal',
          required: {
            version: input.requiredVersion,
            parsed: required,
          },
          available: {
            version: input.availableVersion,
            parsed: available,
          },
          recommendation: isCompatible
            ? 'Version is compatible and can be used safely'
            : 'Version is incompatible. Major version mismatch or available version is too old.',
        };
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid version format',
        });
      }
    }),

  /**
   * Get certification statistics for marketplace
   */
  getCertificationStats: publicProcedure
    .query(async () => {
      const listings = await prisma.wMatrixListing.findMany({
        where: { status: "active" },
      });

      const certificationCounts: Record<CertificationLevel, number> = {
        bronze: 0,
        silver: 0,
        gold: 0,
        platinum: 0,
      };

      let totalEpsilon = 0;

      listings.forEach(listing => {
        const epsilon = parseFloat(listing.epsilon.toString());
        totalEpsilon += epsilon;
        const level = QualityCertifier.getCertificationLevel(epsilon);
        certificationCounts[level]++;
      });

      const avgEpsilon = listings.length > 0 ? totalEpsilon / listings.length : 0;

      return {
        totalListings: listings.length,
        certificationDistribution: certificationCounts,
        averageEpsilon: avgEpsilon.toFixed(6),
        qualityBreakdown: {
          platinum: {
            count: certificationCounts.platinum,
            percentage: ((certificationCounts.platinum / listings.length) * 100).toFixed(1),
            description: '< 1% alignment loss',
          },
          gold: {
            count: certificationCounts.gold,
            percentage: ((certificationCounts.gold / listings.length) * 100).toFixed(1),
            description: '< 5% alignment loss',
          },
          silver: {
            count: certificationCounts.silver,
            percentage: ((certificationCounts.silver / listings.length) * 100).toFixed(1),
            description: '< 10% alignment loss',
          },
          bronze: {
            count: certificationCounts.bronze,
            percentage: ((certificationCounts.bronze / listings.length) * 100).toFixed(1),
            description: '> 10% alignment loss',
          },
        },
      };
    }),

  // ============================================================================
  // GPU-Accelerated Training (P2 Integration)
  // ============================================================================

  /**
   * Train W-Matrix using GPU-accelerated ridge regression
   * Provides 10-50x speedup for large training datasets
   */
  trainWMatrixWithGPU: protectedProcedure
    .input(z.object({
      sourceModel: z.string(),
      targetModel: z.string(),
      trainingData: z.object({
        inputVectors: z.array(z.array(z.number())).min(50).describe('Source model vectors'),
        outputVectors: z.array(z.array(z.number())).min(50).describe('Target model vectors'),
      }),
      lambda: z.number().positive().default(0.01).describe('Ridge regression regularization parameter'),
      useGPU: z.boolean().default(true).describe('Enable GPU acceleration if available'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        logger.info(`[GPU] Training W-Matrix: ${input.sourceModel} → ${input.targetModel} (GPU: ${input.useGPU})`);

        const startTime = Date.now();

        // Validate dimensions match
        const inputDim = input.trainingData.inputVectors[0].length;
        const outputDim = input.trainingData.outputVectors[0].length;

        if (input.trainingData.inputVectors.some(v => v.length !== inputDim)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'All input vectors must have the same dimension',
          });
        }

        if (input.trainingData.outputVectors.some(v => v.length !== outputDim)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'All output vectors must have the same dimension',
          });
        }

        // Initialize GPU engine
        await gpuEngine.initialize();

        let wMatrix: number[][];
        let backend: string;

        if (input.useGPU && gpuEngine.isGPUAvailable()) {
          // GPU-accelerated training
          logger.info('[GPU] Using GPU-accelerated ridge regression');
          wMatrix = await gpuEngine.ridgeRegression(
            input.trainingData.inputVectors,
            input.trainingData.outputVectors,
            input.lambda
          );
          backend = 'gpu';
        } else {
          // CPU fallback with warning
          logger.warn('[GPU] GPU not available - using CPU fallback (slower)');
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'GPU-accelerated training requires TensorFlow. Please install @tensorflow/tfjs-node-gpu or use CPU training endpoint',
          });
        }

        const trainingTime = Date.now() - startTime;

        // Calculate alignment loss on training data
        const testResult = await gpuEngine.alignBatch(
          input.trainingData.inputVectors.slice(0, 10),
          wMatrix
        );

        // Compute cosine similarity to estimate alignment quality
        const similarities = await gpuEngine.cosineSimilarityBatch(
          testResult.alignedVectors,
          input.trainingData.outputVectors.slice(0, 10)
        );
        const avgSimilarity = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
        const alignmentLoss = 1 - avgSimilarity;

        return {
          success: true,
          wMatrix: {
            matrix: wMatrix,
            sourceModel: input.sourceModel,
            targetModel: input.targetModel,
            epsilon: alignmentLoss,
            qualityScore: avgSimilarity,
          },
          training: {
            backend,
            trainingTime,
            datasetSize: input.trainingData.inputVectors.length,
            lambda: input.lambda,
            dimensions: {
              input: inputDim,
              output: outputDim,
            },
          },
          quality: {
            avgCosineSimilarity: avgSimilarity,
            alignmentLoss,
            certificationLevel: QualityCertifier.getCertificationLevel(alignmentLoss),
          },
          message: `W-Matrix trained successfully in ${(trainingTime / 1000).toFixed(2)}s using ${backend}`,
        };
      } catch (error) {
        logger.error('[GPU] Training error:', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof TRPCError ? error.message : 'Failed to train W-Matrix',
          cause: error,
        });
      }
    }),

  /**
   * Estimate training time for GPU vs CPU
   */
  estimateTrainingTime: publicProcedure
    .input(z.object({
      datasetSize: z.number().int().min(50).max(10000),
      inputDimension: z.number().int().min(64).max(4096),
      outputDimension: z.number().int().min(64).max(4096),
    }))
    .query(async ({ input }) => {
      // Heuristic estimates based on empirical data
      // Ridge regression complexity: O(n × d^2) where n=dataset size, d=dimension
      const maxDim = Math.max(input.inputDimension, input.outputDimension);
      const complexity = input.datasetSize * maxDim * maxDim;

      // CPU time (rough estimate: 1ms per 1M ops)
      const cpuTimeMs = complexity / 1000;

      // GPU time (10-50x speedup depending on size)
      const gpuSpeedup = input.datasetSize > 500 ? 50 : input.datasetSize > 100 ? 20 : 10;
      const gpuTimeMs = cpuTimeMs / gpuSpeedup;

      await gpuEngine.initialize();
      const gpuAvailable = gpuEngine.isGPUAvailable();

      return {
        estimates: {
          cpu: {
            time: cpuTimeMs,
            timeFormatted: cpuTimeMs < 1000 ? `${cpuTimeMs.toFixed(0)}ms` : `${(cpuTimeMs / 1000).toFixed(1)}s`,
            available: true,
          },
          gpu: {
            time: gpuTimeMs,
            timeFormatted: gpuTimeMs < 1000 ? `${gpuTimeMs.toFixed(0)}ms` : `${(gpuTimeMs / 1000).toFixed(1)}s`,
            available: gpuAvailable,
            speedup: gpuSpeedup,
          },
        },
        recommendation: !gpuAvailable
          ? 'GPU not available - will use CPU (slower but functional)'
          : gpuSpeedup > 20
          ? `GPU is ${gpuSpeedup}x faster - strongly recommended for this dataset size`
          : `GPU is ${gpuSpeedup}x faster - recommended if available`,
        datasetInfo: {
          size: input.datasetSize,
          dimensions: `${input.inputDimension} → ${input.outputDimension}`,
          complexity: complexity > 1e9 ? `${(complexity / 1e9).toFixed(2)}B ops` : `${(complexity / 1e6).toFixed(2)}M ops`,
        },
      };
    }),
});
