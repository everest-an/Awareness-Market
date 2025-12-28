import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { invokeLLM } from "./_core/llm";

// Helper to ensure user is a creator
const creatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "creator" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only creators can access this resource" });
  }
  return next({ ctx });
});

// Helper to ensure user is admin
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateRole: protectedProcedure
      .input(z.object({ role: z.enum(["creator", "consumer"]) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserRole(ctx.user.id, input.role);
        return { success: true };
      }),
  }),

  // Latent Vectors Management
  vectors: router({
    // Create new latent vector
    create: creatorProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().min(1),
        category: z.string().min(1).max(100),
        vectorFile: z.object({
          data: z.string(), // base64 encoded
          mimeType: z.string(),
        }),
        modelArchitecture: z.string().optional(),
        vectorDimension: z.number().optional(),
        performanceMetrics: z.string().optional(), // JSON string
        basePrice: z.number().min(0),
        pricingModel: z.enum(["per-call", "subscription", "usage-based"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Upload vector file to S3
        const fileBuffer = Buffer.from(input.vectorFile.data, 'base64');
        const fileKey = `vectors/${ctx.user.id}/${nanoid()}.bin`;
        const { url } = await storagePut(fileKey, fileBuffer, input.vectorFile.mimeType);

        const result = await db.createLatentVector({
          creatorId: ctx.user.id,
          title: input.title,
          description: input.description,
          category: input.category,
          vectorFileKey: fileKey,
          vectorFileUrl: url,
          modelArchitecture: input.modelArchitecture,
          vectorDimension: input.vectorDimension,
          performanceMetrics: input.performanceMetrics,
          basePrice: input.basePrice.toFixed(2),
          pricingModel: input.pricingModel,
          status: "draft",
        });

        return { success: true, vectorId: (result as any).insertId };
      }),

    // Get vector by ID
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const vector = await db.getLatentVectorById(input.id);
        if (!vector) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Vector not found" });
        }
        return vector;
      }),

    // Get creator's vectors
    myVectors: creatorProcedure.query(async ({ ctx }) => {
      return await db.getLatentVectorsByCreator(ctx.user.id);
    }),

    // Search and browse vectors
    search: publicProcedure
      .input(z.object({
        category: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        minRating: z.number().optional(),
        searchTerm: z.string().optional(),
        sortBy: z.enum(["newest", "oldest", "price_low", "price_high", "rating", "popular"]).default("newest"),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return await db.searchLatentVectors(input);
      }),

    // Get all categories
    getCategories: publicProcedure.query(async () => {
      return await db.getAllCategories();
    }),

    // Update vector
    update: creatorProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        basePrice: z.number().optional(),
        status: z.enum(["draft", "active", "inactive"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const vector = await db.getLatentVectorById(input.id);
        if (!vector || vector.creatorId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const updates: any = {};
        if (input.title) updates.title = input.title;
        if (input.description) updates.description = input.description;
        if (input.basePrice !== undefined) updates.basePrice = input.basePrice.toFixed(2);
        if (input.status) updates.status = input.status;

        await db.updateLatentVector(input.id, updates);
        return { success: true };
      }),

    // Get vector statistics
    getStats: creatorProcedure
      .input(z.object({ vectorId: z.number(), days: z.number().default(30) }))
      .query(async ({ ctx, input }) => {
        const vector = await db.getLatentVectorById(input.vectorId);
        if (!vector || vector.creatorId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const callLogs = await db.getVectorCallStats(input.vectorId, input.days);
        
        return {
          totalCalls: vector.totalCalls,
          totalRevenue: vector.totalRevenue,
          averageRating: vector.averageRating,
          reviewCount: vector.reviewCount,
          recentCalls: callLogs.length,
          successRate: callLogs.filter(log => log.success).length / (callLogs.length || 1),
        };
      }),
  }),

  // Transactions
  transactions: router({
    // Create purchase transaction
    purchase: protectedProcedure
      .input(z.object({
        vectorId: z.number(),
        paymentMethodId: z.string(), // Stripe payment method ID
      }))
      .mutation(async ({ ctx, input }) => {
        const vector = await db.getLatentVectorById(input.vectorId);
        if (!vector || vector.status !== "active") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Vector not available" });
        }

        const amount = parseFloat(vector.basePrice);
        const platformFeeRate = 0.20; // 20% platform fee
        const platformFee = amount * platformFeeRate;
        const creatorEarnings = amount - platformFee;

        // Create transaction record
        const result = await db.createTransaction({
          buyerId: ctx.user.id,
          vectorId: input.vectorId,
          amount: amount.toFixed(2),
          platformFee: platformFee.toFixed(2),
          creatorEarnings: creatorEarnings.toFixed(2),
          status: "pending",
          transactionType: "one-time",
        });

        // TODO: Integrate with Stripe payment processing
        // For now, mark as completed
        const transactionId = (result as any).insertId;
        await db.updateTransactionStatus(transactionId, "completed");

        // Create access permission
        const accessToken = nanoid(32);
        await db.createAccessPermission({
          userId: ctx.user.id,
          vectorId: input.vectorId,
          transactionId,
          accessToken,
          isActive: true,
        });

        // Update vector stats
        await db.incrementVectorStats(input.vectorId, creatorEarnings);

        // Create notification for creator
        const creator = await db.getUserById(vector.creatorId);
        if (creator) {
          await db.createNotification({
            userId: vector.creatorId,
            type: "transaction",
            title: "New Purchase",
            message: `${ctx.user.name || "Someone"} purchased your AI capability "${vector.title}"`,
            relatedEntityId: transactionId,
          });
        }

        return { success: true, transactionId, accessToken };
      }),

    // Get user's transactions
    myTransactions: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserTransactions(ctx.user.id, "buyer");
    }),

    // Get creator's earnings
    myEarnings: creatorProcedure.query(async ({ ctx }) => {
      const transactions = await db.getUserTransactions(ctx.user.id, "creator");
      return transactions;
    }),
  }),

  // Access & API
  access: router({
    // Verify access token and get vector
    verify: publicProcedure
      .input(z.object({ accessToken: z.string() }))
      .query(async ({ input }) => {
        const permission = await db.getAccessPermissionByToken(input.accessToken);
        if (!permission || !permission.isActive) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired access token" });
        }

        // Check expiration
        if (permission.expiresAt && new Date(permission.expiresAt) < new Date()) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Access token expired" });
        }

        // Check calls remaining
        if (permission.callsRemaining !== null && permission.callsRemaining <= 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No calls remaining" });
        }

        const vector = await db.getLatentVectorById(permission.vectorId);
        if (!vector) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        return {
          vectorId: vector.id,
          vectorUrl: vector.vectorFileUrl,
          callsRemaining: permission.callsRemaining,
        };
      }),

    // Log API call
    logCall: publicProcedure
      .input(z.object({
        accessToken: z.string(),
        responseTime: z.number(),
        success: z.boolean(),
        errorMessage: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const permission = await db.getAccessPermissionByToken(input.accessToken);
        if (!permission) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        await db.logApiCall({
          userId: permission.userId,
          vectorId: permission.vectorId,
          permissionId: permission.id,
          responseTime: input.responseTime,
          success: input.success,
          errorMessage: input.errorMessage,
        });

        // Decrement calls remaining if applicable
        if (permission.callsRemaining !== null) {
          await db.decrementCallsRemaining(permission.id);
        }

        return { success: true };
      }),

    // Get user's access permissions
    myPermissions: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserAccessPermissions(ctx.user.id);
    }),
  }),

  // Reviews
  reviews: router({
    // Create review
    create: protectedProcedure
      .input(z.object({
        vectorId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if user has purchased this vector
        const permissions = await db.getUserAccessPermissions(ctx.user.id);
        const hasPurchased = permissions.some(p => p.vectorId === input.vectorId);

        await db.createReview({
          vectorId: input.vectorId,
          userId: ctx.user.id,
          rating: input.rating,
          comment: input.comment,
          isVerifiedPurchase: hasPurchased,
        });

        // Notify creator
        const vector = await db.getLatentVectorById(input.vectorId);
        if (vector) {
          await db.createNotification({
            userId: vector.creatorId,
            type: "review",
            title: "New Review",
            message: `${ctx.user.name || "Someone"} left a ${input.rating}-star review on "${vector.title}"`,
            relatedEntityId: input.vectorId,
          });
        }

        return { success: true };
      }),

    // Get vector reviews
    getByVector: publicProcedure
      .input(z.object({ vectorId: z.number() }))
      .query(async ({ input }) => {
        return await db.getVectorReviews(input.vectorId);
      }),
  }),

  // Notifications
  notifications: router({
    // Get user notifications
    list: protectedProcedure
      .input(z.object({ unreadOnly: z.boolean().default(false) }))
      .query(async ({ ctx, input }) => {
        return await db.getUserNotifications(ctx.user.id, input.unreadOnly);
      }),

    // Mark as read
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markNotificationAsRead(input.id);
        return { success: true };
      }),
  }),

  // Recommendations
  recommendations: router({
    // Get personalized recommendations
    getRecommendations: protectedProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ ctx, input }) => {
        // Get user preferences
        const prefs = await db.getUserPreferences(ctx.user.id);
        
        // Get user's purchase history
        const transactions = await db.getUserTransactions(ctx.user.id, "buyer");
        const purchasedCategories = new Set<string>();
        
        for (const tx of transactions) {
          const txData: any = 'vectorId' in tx ? tx : tx.transactions;
          const vector = await db.getLatentVectorById(txData.vectorId);
          if (vector) {
            purchasedCategories.add(vector.category);
          }
        }

        // Use LLM to analyze and recommend
        let preferredCategories: string[] = [];
        if (prefs?.preferredCategories) {
          try {
            preferredCategories = JSON.parse(prefs.preferredCategories);
          } catch {}
        }

        // Combine purchased and preferred categories
        const allCategories = [...Array.from(purchasedCategories), ...preferredCategories];

        // Search for vectors in these categories
        const recommendations = await db.searchLatentVectors({
          category: allCategories.length > 0 ? allCategories[0] : undefined,
          minRating: 4.0,
          limit: input.limit,
        });

        return recommendations;
      }),

    // Update user preferences
    updatePreferences: protectedProcedure
      .input(z.object({
        preferredCategories: z.array(z.string()).optional(),
        priceRange: z.object({ min: z.number(), max: z.number() }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const updates: any = {};
        
        if (input.preferredCategories) {
          updates.preferredCategories = JSON.stringify(input.preferredCategories);
        }
        
        if (input.priceRange) {
          updates.priceRange = JSON.stringify(input.priceRange);
        }

        await db.upsertUserPreferences(ctx.user.id, updates);
        return { success: true };
      }),
  }),

  // Analytics Dashboard
  analytics: router({
    // Creator dashboard stats
    creatorStats: creatorProcedure.query(async ({ ctx }) => {
      const vectors = await db.getLatentVectorsByCreator(ctx.user.id);
      const earnings = await db.getUserTransactions(ctx.user.id, "creator");

      const totalRevenue = vectors.reduce((sum, v) => sum + parseFloat(v.totalRevenue), 0);
      const totalCalls = vectors.reduce((sum, v) => sum + v.totalCalls, 0);
      const avgRating = vectors.reduce((sum, v) => sum + parseFloat(v.averageRating || "0"), 0) / (vectors.length || 1);

      return {
        totalVectors: vectors.length,
        activeVectors: vectors.filter(v => v.status === "active").length,
        totalRevenue,
        totalCalls,
        averageRating: avgRating.toFixed(2),
        recentTransactions: earnings.slice(0, 10),
      };
    }),

    // Consumer dashboard stats
    consumerStats: protectedProcedure.query(async ({ ctx }) => {
      const transactions = await db.getUserTransactions(ctx.user.id, "buyer");
      const permissions = await db.getUserAccessPermissions(ctx.user.id);

      const totalSpent = transactions
        .filter((t: any) => {
          const tx = 'status' in t ? t : t.transactions;
          return tx.status === "completed";
        })
        .reduce((sum, t: any) => {
          const tx = 'amount' in t ? t : t.transactions;
          return sum + parseFloat(tx.amount);
        }, 0);

      return {
        totalPurchases: transactions.length,
        totalSpent,
        activeAccess: permissions.filter(p => p.isActive).length,
        recentTransactions: transactions.slice(0, 10),
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
