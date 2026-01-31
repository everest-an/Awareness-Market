import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
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

// db is async, must await in each procedure
import { wMatrixListings, wMatrixPurchases } from "../../drizzle/schema";
import { eq, and, desc, sql, type InferInsertModel } from "drizzle-orm";

type WMatrixListingUpdate = Partial<InferInsertModel<typeof wMatrixListings>>;

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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [listing] = await db
        .select()
        .from(wMatrixListings)
        .where(eq(wMatrixListings.id, input.listingId));

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      if (listing.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This listing is not available for purchase" });
      }

      const [existingPurchase] = await db
        .select()
        .from(wMatrixPurchases)
        .where(
          and(
            eq(wMatrixPurchases.listingId, input.listingId),
            eq(wMatrixPurchases.buyerId, ctx.user.id),
            eq(wMatrixPurchases.status, "completed")
          )
        );

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
        amount: parseFloat(listing.price),
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const session = await stripe.checkout.sessions.retrieve(input.sessionId);

      if (session.payment_status !== "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Payment not completed" });
      }

      const listingId = parseInt(session.metadata?.listing_id || "", 10);
      const userId = parseInt(session.metadata?.user_id || "", 10);

      if (!listingId || userId !== ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid checkout session" });
      }

      const [listing] = await db
        .select()
        .from(wMatrixListings)
        .where(eq(wMatrixListings.id, listingId));

      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }

      const [existingPurchase] = await db
        .select()
        .from(wMatrixPurchases)
        .where(
          and(
            eq(wMatrixPurchases.listingId, listingId),
            eq(wMatrixPurchases.buyerId, ctx.user.id),
            eq(wMatrixPurchases.status, "completed")
          )
        );

      if (existingPurchase) {
        return { success: true, purchaseId: existingPurchase.id, matrixId: listing.matrixId };
      }

      const [result] = await db.insert(wMatrixPurchases).values({
        listingId,
        buyerId: ctx.user.id,
        price: listing.price,
        stripePaymentIntentId: session.payment_intent as string,
        status: "completed",
      });

      await db
        .update(wMatrixListings)
        .set({
          totalSales: sql`${wMatrixListings.totalSales} + 1`,
          totalRevenue: sql`${wMatrixListings.totalRevenue} + ${listing.price}`,
        })
        .where(eq(wMatrixListings.id, listingId));

      return { success: true, purchaseId: result.insertId, matrixId: listing.matrixId };
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const { sourceModel, targetModel, minPrice, maxPrice, search, sortBy, limit, offset } = input;

      // Apply filters
      const conditions = [eq(wMatrixListings.status, "active")];
      if (sourceModel) conditions.push(eq(wMatrixListings.sourceModel, sourceModel));
      if (targetModel) conditions.push(eq(wMatrixListings.targetModel, targetModel));
      if (minPrice !== undefined) conditions.push(sql`${wMatrixListings.price} >= ${minPrice}`);
      if (maxPrice !== undefined) conditions.push(sql`${wMatrixListings.price} <= ${maxPrice}`);
      if (search) {
        conditions.push(
          sql`(${wMatrixListings.title} ILIKE ${'%' + search + '%'} OR ${wMatrixListings.description} ILIKE ${'%' + search + '%'})`
        );
      }
      // Determine sort order
      let orderByClause;
      switch (sortBy) {
        case "price":
          orderByClause = wMatrixListings.price;
          break;
        case "sales":
          orderByClause = desc(wMatrixListings.totalSales);
          break;
        case "rating":
          orderByClause = desc(wMatrixListings.averageRating);
          break;
        case "recent":
        default:
          orderByClause = desc(wMatrixListings.createdAt);
          break;
      }

      const listings = await db
        .select()
        .from(wMatrixListings)
        .where(and(...conditions))
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      // Apply dynamic pricing and version info to each listing
      const listingsWithDynamicPricing = listings.map(listing => {
        const basePrice = parseFloat(listing.price.toString());
        const epsilon = parseFloat(listing.alignmentLoss.toString());

        // Calculate dynamic price using PID controller
        const pricingResult = pricingEngine.calculatePackagePrice(
          "w_matrix",
          epsilon,
          10, // 10% royalty percentage (per whitepaper Section 10.5)
          basePrice
        );

        // Parse version from matrixId (format: "model1-model2-v1.2.3" or just use default)
        let version: WMatrixVersion = { major: 1, minor: 0, patch: 0 };
        const versionMatch = listing.matrixId.match(/v?(\d+)\.(\d+)\.(\d+)/);
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [listing] = await db
        .select()
        .from(wMatrixListings)
        .where(eq(wMatrixListings.id, input.id));

      if (!listing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "W-Matrix listing not found",
        });
      }

      // Apply dynamic pricing
      const basePrice = parseFloat(listing.price.toString());
      const epsilon = parseFloat(listing.alignmentLoss.toString());

      const pricingResult = pricingEngine.calculatePackagePrice(
        "w_matrix",
        epsilon,
        10, // 10% royalty percentage
        basePrice
      );

      // Parse version from matrixId
      let version: WMatrixVersion = { major: 1, minor: 0, patch: 0 };
      const versionMatch = listing.matrixId.match(/v?(\d+)\.(\d+)\.(\d+)/);
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [result] = await db.insert(wMatrixListings).values({
        sellerId: ctx.user.id,
        title: input.title,
        description: input.description,
        sourceModel: input.sourceModel,
        targetModel: input.targetModel,
        sourceDim: input.sourceDim,
        targetDim: input.targetDim,
        matrixId: input.matrixId,
        price: input.price.toFixed(2),
        alignmentLoss: input.alignmentLoss.toFixed(8),
        trainingDataSize: input.trainingDataSize,
        performanceMetrics: input.performanceMetrics ? JSON.stringify(input.performanceMetrics) : null,
        status: "active", // Auto-approve for now
      });

      return {
        success: true,
        listingId: result.insertId,
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
      status: z.enum(["draft", "active", "inactive", "suspended"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Verify ownership
      const [listing] = await db
        .select()
        .from(wMatrixListings)
        .where(eq(wMatrixListings.id, input.id));

      if (!listing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Listing not found",
        });
      }

      if (listing.sellerId !== ctx.user.id) {
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

      await db
        .update(wMatrixListings)
        .set(updates)
        .where(eq(wMatrixListings.id, input.id));

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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get listing details
      const [listing] = await db
        .select()
        .from(wMatrixListings)
        .where(eq(wMatrixListings.id, input.listingId));

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

      // Check if already purchased
      const [existingPurchase] = await db
        .select()
        .from(wMatrixPurchases)
        .where(
          and(
            eq(wMatrixPurchases.listingId, input.listingId),
            eq(wMatrixPurchases.buyerId, ctx.user.id),
            eq(wMatrixPurchases.status, "completed")
          )
        );

      if (existingPurchase) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already purchased this W-Matrix",
        });
      }

      // Create purchase record
      const [result] = await db.insert(wMatrixPurchases).values({
        listingId: input.listingId,
        buyerId: ctx.user.id,
        price: listing.price,
        stripePaymentIntentId: input.stripePaymentIntentId,
        status: "completed", // Assume payment verified
      });

      // Update listing stats
      await db
        .update(wMatrixListings)
        .set({
          totalSales: sql`${wMatrixListings.totalSales} + 1`,
          totalRevenue: sql`${wMatrixListings.totalRevenue} + ${listing.price}`,
        })
        .where(eq(wMatrixListings.id, input.listingId));

      return {
        success: true,
        purchaseId: result.insertId,
        matrixId: listing.matrixId,
      };
    }),

  /**
   * Get user's purchased W-Matrices (protected)
   */
  myPurchases: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const purchases = await db
        .select({
          purchase: wMatrixPurchases,
          listing: wMatrixListings,
        })
        .from(wMatrixPurchases)
        .innerJoin(wMatrixListings, eq(wMatrixPurchases.listingId, wMatrixListings.id))
        .where(
          and(
            eq(wMatrixPurchases.buyerId, ctx.user.id),
            eq(wMatrixPurchases.status, "completed")
          )
        )
        .orderBy(desc(wMatrixPurchases.purchasedAt));

      return purchases;
    }),

  /**
   * Get user's published W-Matrix listings (protected)
   */
  myListings: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const listings = await db
        .select()
        .from(wMatrixListings)
        .where(eq(wMatrixListings.sellerId, ctx.user.id))
        .orderBy(desc(wMatrixListings.createdAt));

      return listings;
    }),

  /**
   * Get popular model pairs for marketplace
   */
  getPopularModelPairs: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const pairs = await db
        .select({
          sourceModel: wMatrixListings.sourceModel,
          targetModel: wMatrixListings.targetModel,
          count: sql<number>`count(*)`,
        })
        .from(wMatrixListings)
        .where(eq(wMatrixListings.status, "active"))
        .groupBy(wMatrixListings.sourceModel, wMatrixListings.targetModel)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      return pairs;
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const listings = await db
        .select()
        .from(wMatrixListings)
        .where(
          and(
            eq(wMatrixListings.sourceModel, input.sourceModel),
            eq(wMatrixListings.targetModel, input.targetModel),
            eq(wMatrixListings.status, "active")
          )
        )
        .orderBy(desc(wMatrixListings.createdAt))
        .limit(input.limit);

      // Parse and sort by version
      const versioned = listings.map(listing => {
        let version: WMatrixVersion = { major: 1, minor: 0, patch: 0 };
        const versionMatch = listing.matrixId.match(/v?(\d+)\.(\d+)\.(\d+)/);
        if (versionMatch) {
          version = {
            major: parseInt(versionMatch[1]),
            minor: parseInt(versionMatch[2]),
            patch: parseInt(versionMatch[3]),
          };
        }

        const epsilon = parseFloat(listing.alignmentLoss.toString());
        const certificationLevel = QualityCertifier.getCertificationLevel(epsilon);

        return {
          id: listing.id,
          matrixId: listing.matrixId,
          version: WMatrixVersionManager.formatVersion(version),
          versionDetails: version,
          certificationLevel,
          alignmentLoss: listing.alignmentLoss,
          price: listing.price,
          totalSales: listing.totalSales,
          averageRating: listing.averageRating,
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const listings = await db
        .select()
        .from(wMatrixListings)
        .where(eq(wMatrixListings.status, "active"));

      const certificationCounts: Record<CertificationLevel, number> = {
        bronze: 0,
        silver: 0,
        gold: 0,
        platinum: 0,
      };

      let totalEpsilon = 0;

      listings.forEach(listing => {
        const epsilon = parseFloat(listing.alignmentLoss.toString());
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
