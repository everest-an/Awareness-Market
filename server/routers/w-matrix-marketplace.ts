import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";

// db is async, must await in each procedure
import { wMatrixListings, wMatrixPurchases } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const wMatrixMarketplaceRouter = router({
  /**
   * List all active W-Matrix listings with optional filtering
   */
  listListings: publicProcedure
    .input(z.object({
      sourceModel: z.string().optional(),
      targetModel: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      sortBy: z.enum(["price", "sales", "rating", "recent"]).default("recent"),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const { sourceModel, targetModel, minPrice, maxPrice, sortBy, limit, offset } = input;

      // Apply filters
      const conditions = [eq(wMatrixListings.status, "active")];
      if (sourceModel) conditions.push(eq(wMatrixListings.sourceModel, sourceModel));
      if (targetModel) conditions.push(eq(wMatrixListings.targetModel, targetModel));
      if (minPrice !== undefined) conditions.push(sql`${wMatrixListings.price} >= ${minPrice}`);
      if (maxPrice !== undefined) conditions.push(sql`${wMatrixListings.price} <= ${maxPrice}`);

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
      return listings;
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

      return listing;
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
      performanceMetrics: z.record(z.any()).optional(),
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

      const updates: any = {};
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
});
