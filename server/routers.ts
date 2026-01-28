import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { invokeLLM } from "./_core/llm";
import * as recommendationEngine from "./recommendation-engine";
import { createApiKey, listApiKeys, revokeApiKey, deleteApiKey } from "./api-key-manager.js";
import * as blogDb from "./blog-db";
import { getDb } from "./db";
import { reviews, latentVectors, wMatrixVersions, alignmentCalculations } from "../drizzle/schema";
import * as latentmas from "./latentmas";
import * as goServiceAdapter from "./adapters/go-service-adapter";
import * as semanticIndex from "./semantic-index";
import { GENESIS_MEMORIES } from "../shared/genesis-memories";
import * as authStandalone from "./auth-standalone";
import * as authOAuth from "./auth-oauth";
import * as authRateLimiter from "./auth-rate-limiter";
import * as authPasswordValidator from "./auth-password-validator";
import * as authEmailVerification from "./auth-email-verification";
import * as adminAnalytics from "./admin-analytics";
import * as userAnalytics from "./user-analytics";
import { latentmasRouter } from "./routers/latentmas";
import { wMatrixMarketplaceRouter } from "./routers/w-matrix-marketplace";
import { kvCacheApiRouter } from "./routers/kv-cache-api";
import { wMatrixMarketplaceV2Router } from "./routers/w-matrix-marketplace-v2";
import { memoryNFTRouter } from "./routers/memory-nft-api";
import { agentCreditRouter } from './routers/agent-credit-api';
import { latentmasMarketplaceRouter } from './routers/latentmas-marketplace';
import { packagesApiRouter } from './routers/packages-api';
import { aiAgentRouter } from './api/ai-agent-api';
import { workflowRouter } from './routers/workflow';
import { workflowHistoryRouter } from './routers/workflow-history';
import { userRouter } from './routers/user';
import { authUnifiedRouter } from './routers/auth-unified';
import { apiAnalyticsRouter } from './routers/api-analytics';
import { agentDiscoveryRouter } from './routers/agent-discovery';
import { agentCollaborationRouter } from './routers/agent-collaboration';
import { createSubscriptionCheckout, createVectorPurchaseCheckout } from "./stripe-client";
// Memory Exchange moved to Go microservice

// Helper to get client IP from request
function getClientIp(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || req.headers['x-real-ip'] 
    || req.socket?.remoteAddress 
    || req.ip 
    || '127.0.0.1';
}

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
      ctx.res.clearCookie('jwt_token', { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie('jwt_refresh', { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    
    // Email/Password Authentication with rate limiting and password validation
    registerEmail: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Validate password strength
        const passwordValidation = authPasswordValidator.validatePassword(input.password, input.email);
        if (!passwordValidation.valid) {
          return { 
            success: false, 
            error: passwordValidation.errors[0],
            passwordErrors: passwordValidation.errors,
          };
        }
        
        const result = await authStandalone.registerWithEmail(input);
        
        // Send verification email if registration successful
        if (result.success && result.userId) {
          await authEmailVerification.sendVerificationEmail(result.userId, input.email);
        }
        
        return {
          ...result,
          requiresVerification: result.success,
        };
      }),
    
    // Email verification endpoints
    sendVerificationEmail: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (!ctx.user.email) {
          return { success: false, error: "No email associated with account" };
        }
        if (ctx.user.emailVerified) {
          return { success: false, error: "Email already verified" };
        }
        return await authEmailVerification.sendVerificationEmail(ctx.user.id, ctx.user.email);
      }),
    
    verifyEmail: publicProcedure
      .input(z.object({
        email: z.string().email(),
        code: z.string().length(6),
      }))
      .mutation(async ({ input }) => {
        return await authEmailVerification.verifyEmail(input.email, input.code);
      }),
    
    verificationStatus: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .query(({ input }) => {
        return authEmailVerification.getVerificationStatus(input.email);
      }),
    
    loginEmail: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const clientIp = getClientIp(ctx.req);
        
        // Check rate limit
        const rateLimitCheck = await authRateLimiter.checkLoginAllowed(clientIp, input.email);
        if (!rateLimitCheck.allowed) {
          return { 
            success: false, 
            error: rateLimitCheck.reason,
            retryAfter: rateLimitCheck.retryAfter,
          };
        }
        
        const result = await authStandalone.loginWithEmail(input);
        
        if (result.success && result.accessToken) {
          // Record successful login
          await authRateLimiter.recordSuccessfulLogin(clientIp, input.email);
          
          // Set JWT token in HTTP-only cookie
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie('jwt_token', result.accessToken, cookieOptions);
          ctx.res.cookie('jwt_refresh', result.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        } else {
          // Record failed attempt
          await authRateLimiter.recordFailedAttempt(clientIp, input.email);
          
          // Add remaining attempts info
          const remaining = await authRateLimiter.getRemainingAttempts(clientIp, input.email);
          if (remaining <= 2 && remaining > 0) {
            result.error = `${result.error}. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`;
          }
        }
        
        return result;
      }),
    
    updateRole: protectedProcedure
      .input(z.object({ role: z.enum(["creator", "consumer"]) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserRole(ctx.user.id, input.role);
        return { success: true };
      }),
    
    // Password Reset Flow
    requestPasswordReset: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        return await authStandalone.requestPasswordReset(input.email);
      }),
    
    verifyResetCode: publicProcedure
      .input(z.object({
        email: z.string().email(),
        code: z.string().length(6),
      }))
      .mutation(async ({ input }) => {
        return await authStandalone.verifyResetCode(input.email, input.code);
      }),
    
    resetPassword: publicProcedure
      .input(z.object({
        email: z.string().email(),
        code: z.string().length(6),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input }) => {
        // Validate new password strength
        const passwordValidation = authPasswordValidator.validatePassword(input.newPassword, input.email);
        if (!passwordValidation.valid) {
          return { 
            success: false, 
            error: passwordValidation.errors[0],
          };
        }
        
        return await authStandalone.resetPassword(input.email, input.code, input.newPassword);
      }),
    
    // Password validation endpoint (for real-time feedback)
    validatePassword: publicProcedure
      .input(z.object({
        password: z.string(),
        email: z.string().email().optional(),
      }))
      .query(({ input }) => {
        const result = authPasswordValidator.validatePassword(input.password, input.email);
        const strength = authPasswordValidator.getPasswordStrengthLabel(result.score);
        return {
          ...result,
          strength: strength.label,
          strengthColor: strength.color,
        };
      }),
    
    // OAuth endpoints
    oauthStatus: publicProcedure.query(() => {
      return authOAuth.getOAuthStatus();
    }),
    
    oauthAuthorizeUrl: publicProcedure
      .input(z.object({
        provider: z.enum(["github", "google"]),
      }))
      .query(({ input, ctx }) => {
        const state = authOAuth.generateOAuthState();
        
        // Store state in cookie for CSRF protection
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie('oauth_state', state, { ...cookieOptions, maxAge: 10 * 60 * 1000 }); // 10 min
        
        const url = authOAuth.getOAuthAuthorizeUrl(input.provider, state);
        return { url, state };
      }),
    
    oauthCallback: publicProcedure
      .input(z.object({
        provider: z.enum(["github", "google"]),
        code: z.string(),
        state: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Verify state matches (CSRF protection)
        const storedState = ctx.req.cookies?.oauth_state;
        if (!storedState || storedState !== input.state) {
          return { success: false, error: "Invalid state parameter. Please try again." };
        }
        
        // Clear state cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie('oauth_state', cookieOptions);
        
        // Handle OAuth callback
        const result = await authOAuth.handleOAuthCallback(input.provider, input.code);
        
        if (result.success && result.accessToken) {
          // Set JWT tokens
          ctx.res.cookie('jwt_token', result.accessToken, cookieOptions);
          ctx.res.cookie('jwt_refresh', result.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        }
        
        return result;
      }),
    
    // Token refresh endpoint
    refreshToken: publicProcedure.mutation(async ({ ctx }) => {
      const refreshToken = ctx.req.cookies?.jwt_refresh;
      
      if (!refreshToken) {
        return { success: false, error: "No refresh token" };
      }
      
      const result = await authStandalone.refreshAccessToken(refreshToken);
      
      if (result.success && result.accessToken) {
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie('jwt_token', result.accessToken, cookieOptions);
      }
      
      return result;
    }),
  }),

  // API Key Management
  apiKeys: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const keys = await listApiKeys(ctx.user.id);
      return { keys };
    }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        permissions: z.array(z.string()).optional(),
        expiresInDays: z.number().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const expiresAt = input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : null;
        
        const result = await createApiKey({
          userId: ctx.user.id,
          name: input.name,
          permissions: input.permissions || ['*'],
          expiresAt,
        });
        
        return {
          success: true,
          apiKey: result.key,
          keyPrefix: result.keyPrefix,
          message: 'API key created successfully. Store it securely - it won\'t be shown again.',
        };
      }),
    
    revoke: protectedProcedure
      .input(z.object({ keyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const success = await revokeApiKey(input.keyId, ctx.user.id);
        if (!success) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'API key not found' });
        }
        return { success: true, message: 'API key revoked successfully' };
      }),
    
    delete: protectedProcedure
      .input(z.object({ keyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const success = await deleteApiKey(input.keyId, ctx.user.id);
        if (!success) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'API key not found' });
        }
        return { success: true, message: 'API key deleted successfully' };
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

    // Invoke vector (execute purchased capability)
    invoke: protectedProcedure
      .input(z.object({
        vectorId: z.number(),
        inputData: z.any(),
        options: z.object({
          temperature: z.number().optional(),
          maxTokens: z.number().optional(),
          alignToModel: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeVector } = await import("./vector-invocation");
        return await invokeVector(ctx.user.id, input);
      }),

    // Get invocation history
    invocationHistory: protectedProcedure
      .input(z.object({
        vectorId: z.number().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ ctx, input }) => {
        const { getInvocationHistory } = await import("./vector-invocation");
        return await getInvocationHistory(ctx.user.id, input);
      }),

    // Get invocation stats (creator view)
    invocationStats: creatorProcedure
      .input(z.object({ vectorId: z.number() }))
      .query(async ({ ctx, input }) => {
        const vector = await db.getLatentVectorById(input.vectorId);
        if (!vector || vector.creatorId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const { getVectorInvocationStats } = await import("./vector-invocation");
        return await getVectorInvocationStats(input.vectorId);
      }),
  }),

  // Transactions
  transactions: router({
    // Create purchase transaction with Stripe checkout
    purchase: protectedProcedure
      .input(z.object({
        vectorId: z.number(),
        successUrl: z.string().optional(),
        cancelUrl: z.string().optional(),
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

        const transactionId = (result as any).insertId;

        // Create Stripe checkout session
        const checkoutUrl = await createVectorPurchaseCheckout({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name || undefined,
          vectorId: input.vectorId,
          vectorTitle: vector.title,
          amount: amount,
          successUrl: input.successUrl || `${process.env.CLIENT_URL || 'http://localhost:5173'}/purchase/success?transactionId=${transactionId}`,
          cancelUrl: input.cancelUrl || `${process.env.CLIENT_URL || 'http://localhost:5173'}/purchase/cancelled`,
          transactionId: transactionId,
        });

        // Transaction will be completed by Stripe webhook after successful payment
        // Access permission will also be created by the webhook

        return {
          success: true,
          transactionId,
          checkoutUrl,
          message: "Redirecting to Stripe checkout..."
        };
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
      .input(z.object({ 
        vectorId: z.number(),
        sortBy: z.enum(["newest", "oldest", "highest", "lowest"]).default("newest"),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return await db.getVectorReviews(input.vectorId);
      }),

    // Get user's reviews
    myReviews: protectedProcedure.query(async ({ ctx }) => {
      const db_instance = await getDb();
      if (!db_instance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const userReviews = await db_instance
        .select({
          review: reviews,
          vector: {
            id: latentVectors.id,
            title: latentVectors.title,
            category: latentVectors.category,
          }
        })
        .from(reviews)
        .leftJoin(latentVectors, eq(reviews.vectorId, latentVectors.id))
        .where(eq(reviews.userId, ctx.user.id))
        .orderBy(desc(reviews.createdAt));
      
      return userReviews;
    }),

    // Update review
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        rating: z.number().min(1).max(5).optional(),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db_instance = await getDb();
        if (!db_instance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Check ownership
        const [review] = await db_instance
          .select()
          .from(reviews)
          .where(eq(reviews.id, input.id))
          .limit(1);

        if (!review || review.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const updates: any = {};
        if (input.rating !== undefined) updates.rating = input.rating;
        if (input.comment !== undefined) updates.comment = input.comment;

        await db_instance
          .update(reviews)
          .set(updates)
          .where(eq(reviews.id, input.id));

        return { success: true };
      }),

    // Delete review
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db_instance = await getDb();
        if (!db_instance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Check ownership
        const [review] = await db_instance
          .select()
          .from(reviews)
          .where(eq(reviews.id, input.id))
          .limit(1);

        if (!review || review.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        await db_instance
          .delete(reviews)
          .where(eq(reviews.id, input.id));

        return { success: true };
      }),

    // Get review statistics for a vector
    getStats: publicProcedure
      .input(z.object({ vectorId: z.number() }))
      .query(async ({ input }) => {
        const db_instance = await getDb();
        if (!db_instance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const vectorReviews = await db_instance
          .select()
          .from(reviews)
          .where(eq(reviews.vectorId, input.vectorId));

        const totalReviews = vectorReviews.length;
        const averageRating = totalReviews > 0
          ? vectorReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews
          : 0;

        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        vectorReviews.forEach((r: any) => {
          ratingDistribution[r.rating as keyof typeof ratingDistribution]++;
        });

        const verifiedPurchases = vectorReviews.filter((r: any) => r.isVerifiedPurchase).length;

        return {
          totalReviews,
          averageRating,
          ratingDistribution,
          verifiedPurchases,
          verifiedPercentage: totalReviews > 0 ? (verifiedPurchases / totalReviews) * 100 : 0,
        };
      }),
  }),

  // Creator Dashboard
  creatorDashboard: router({
    // Get dashboard overview
    overview: creatorProcedure.query(async ({ ctx }) => {
      const { getCreatorDashboardOverview } = await import("./creator-dashboard");
      return await getCreatorDashboardOverview(ctx.user.id);
    }),

    // Get revenue analytics
    revenueAnalytics: creatorProcedure
      .input(z.object({ days: z.number().default(30) }))
      .query(async ({ ctx, input }) => {
        const { getCreatorRevenueAnalytics } = await import("./creator-dashboard");
        return await getCreatorRevenueAnalytics(ctx.user.id, input.days);
      }),

    // Get performance metrics
    performanceMetrics: creatorProcedure.query(async ({ ctx }) => {
      const { getCreatorPerformanceMetrics } = await import("./creator-dashboard");
      return await getCreatorPerformanceMetrics(ctx.user.id);
    }),

    // Get user feedback
    userFeedback: creatorProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ ctx, input }) => {
        const { getCreatorUserFeedback } = await import("./creator-dashboard");
        return await getCreatorUserFeedback(ctx.user.id, input.limit);
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
    // Get personalized recommendations using LLM
    getRecommendations: protectedProcedure
      .input(z.object({ limit: z.number().default(5) }))
      .query(async ({ ctx, input }) => {
        const recommendations = await recommendationEngine.generateRecommendations({
          userId: ctx.user.id,
          limit: input.limit,
        });
        return recommendations;
      }),

    // Track browsing action
    trackView: protectedProcedure
      .input(z.object({ vectorId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await recommendationEngine.trackBrowsingAction(
          ctx.user.id,
          input.vectorId,
          "view"
        );
        return { success: true };
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

  // Blog Posts
  blog: router({
    // List blog posts (public)
    list: publicProcedure
      .input(z.object({
        status: z.enum(["draft", "published", "archived"]).optional(),
        category: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        // Only show published posts to non-admin users
        const status = input.status || "published";
        return await blogDb.listBlogPosts({ ...input, status });
      }),

    // Get blog post by slug (public)
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const post = await blogDb.getBlogPostBySlug(input.slug);
        if (post && post.status === "published") {
          await blogDb.incrementBlogPostViews(post.id);
        }
        return post;
      }),

    // Get blog post by ID (admin only)
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await blogDb.getBlogPostById(input.id);
      }),

    // Create blog post (admin only)
    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        slug: z.string().min(1),
        excerpt: z.string().optional(),
        content: z.string().min(1),
        coverImage: z.string().optional(),
        tags: z.array(z.string()).optional(),
        category: z.string().optional(),
        status: z.enum(["draft", "published", "archived"]).default("draft"),
      }))
      .mutation(async ({ ctx, input }) => {
        const data: any = {
          ...input,
          authorId: ctx.user.id,
          tags: input.tags ? JSON.stringify(input.tags) : null,
          publishedAt: input.status === "published" ? new Date() : null,
        };
        return await blogDb.createBlogPost(data);
      }),

    // Update blog post (admin only)
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        slug: z.string().optional(),
        excerpt: z.string().optional(),
        content: z.string().optional(),
        coverImage: z.string().optional(),
        tags: z.array(z.string()).optional(),
        category: z.string().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        const data: any = { ...updates };
        
        if (updates.tags) {
          data.tags = JSON.stringify(updates.tags);
        }
        
        // Set publishedAt when publishing
        if (updates.status === "published") {
          const existing = await blogDb.getBlogPostById(id);
          if (existing && !existing.publishedAt) {
            data.publishedAt = new Date();
          }
        }
        
        return await blogDb.updateBlogPost(id, data);
      }),

    // Delete blog post (admin only)
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await blogDb.deleteBlogPost(input.id);
        return { success: true };
      }),

    // Get categories
    getCategories: publicProcedure.query(async () => {
      return await blogDb.getBlogCategories();
    }),

    // Get post count
    getCount: adminProcedure
      .input(z.object({ status: z.enum(["draft", "published", "archived"]).optional() }))
      .query(async ({ input }) => {
        return await blogDb.getBlogPostCount(input.status);
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

    // User API usage statistics
    usageStats: protectedProcedure.query(async ({ ctx }) => {
      return await userAnalytics.getUserUsageStats(String(ctx.user.id));
    }),

    // Popular endpoints
    popularEndpoints: protectedProcedure
      .input(z.object({ limit: z.number().positive().default(10) }).optional())
      .query(async ({ ctx, input }) => {
        return await userAnalytics.getPopularEndpoints(String(ctx.user.id), input?.limit);
      }),

    // Daily usage over time
    dailyUsage: protectedProcedure
      .input(z.object({ days: z.number().positive().default(30) }).optional())
      .query(async ({ ctx, input }) => {
        return await userAnalytics.getDailyUsage(String(ctx.user.id), input?.days);
      }),

    // API key usage breakdown
    apiKeyUsage: protectedProcedure.query(async ({ ctx }) => {
      return await userAnalytics.getApiKeyUsage(String(ctx.user.id));
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

  // Subscription Plans and Checkout
  subscriptions: router({
    listPlans: publicProcedure.query(async () => {
      return await db.getSubscriptionPlans();
    }),

    createCheckout: protectedProcedure
      .input(z.object({
        planId: z.number(),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      }))
      .mutation(async ({ ctx, input }) => {
        const plans = await db.getSubscriptionPlans();
        const plan = plans.find(p => p.id === input.planId);

        if (!plan) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Subscription plan not found" });
        }

        if (!plan.stripePriceId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Subscription plan is not configured for Stripe" });
        }

        const url = await createSubscriptionCheckout({
          userId: ctx.user.id,
          userEmail: ctx.user.email || "",
          userName: ctx.user.name || undefined,
          planId: plan.id.toString(),
          priceId: plan.stripePriceId,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
        });

        return { url };
      }),
  }),

  // LatentMAS V2.0 - Memory Exchange and W-Matrix Protocol
  memory: router({
    // Browse available memories for purchase (from Go service)
    browse: publicProcedure
      .input(z.object({
        memoryType: z.enum(["kv_cache", "reasoning_chain", "long_term_memory"]).optional(),
        sourceModel: z.string().optional(),
        minQuality: z.number().min(0).max(1).optional(),
        maxPrice: z.number().positive().optional(),
        limit: z.number().positive().default(20),
        offset: z.number().nonnegative().default(0),
      }))
      .query(async ({ input }) => {
        // Map memoryType to Go service type
        const goType = input.memoryType === 'reasoning_chain' ? 'attention' : 
                       input.memoryType === 'kv_cache' ? 'kv_cache' : 'all';
        return await goServiceAdapter.browseMemoryPackages(goType, input.limit, input.offset);
      }),

    // Publish a memory for sale (with S3 storage)
    publish: creatorProcedure
      .input(z.object({
        memoryType: z.enum(["kv_cache", "reasoning_chain", "long_term_memory"]),
        kvCacheData: z.object({
          sourceModel: z.string(),
          keys: z.array(z.any()),
          values: z.array(z.any()),
          attentionMask: z.array(z.any()).optional(),
          positionEncodings: z.array(z.any()).optional(),
          metadata: z.object({
            sequenceLength: z.number(),
            contextDescription: z.string(),
            tokenCount: z.number(),
            generatedAt: z.date().optional(),
          }),
        }),
        price: z.number().positive(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Store KV-cache data in S3
        const kvCacheJson = JSON.stringify(input.kvCacheData);
        const fileKey = `kv-cache/${ctx.user.id}/${nanoid()}-${Date.now()}.json`;
        const { url: storageUrl } = await storagePut(fileKey, kvCacheJson, "application/json");
        
        // Publish to Go Memory Exchange service
        const description = input.description || 'Memory Package';
        return await goServiceAdapter.publishMemoryPackage(
          String(ctx.user.id),
          {
            name: description.substring(0, 50),
            description: description,
            type: input.memoryType === 'kv_cache' ? 'kv_cache' : 'attention',
            price: input.price,
            model_type: input.kvCacheData.sourceModel,
          }
        );
      }),

    // Purchase and align memory to target model
    purchase: protectedProcedure
      .input(z.object({
        memoryId: z.number(),
        targetModel: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Call Go Memory Exchange service via adapter
        return await goServiceAdapter.purchaseMemoryPackage(
          String(ctx.user.id),
          String(input.memoryId)
        );
      }),

    // Get user's memory exchange history (from Go service)
    history: protectedProcedure
      .input(z.object({
        role: z.enum(["seller", "buyer", "both"]).default("both"),
        limit: z.number().positive().default(50),
      }))
      .query(async ({ ctx, input }) => {
        // Delegate to Go Memory Exchange service via adapter
        const allPackages = await goServiceAdapter.browseMemoryPackages('all', input.limit, 0);
        // Filter by user and role if needed
        return allPackages;
      }),

    // Get memory exchange statistics (from Go service)
    stats: publicProcedure.query(async () => {
      // Get statistics from Go Memory Exchange service
      const packages = await goServiceAdapter.browseMemoryPackages('all', 1000, 0);
      const packagesArray = (packages as any).packages || packages.data || [];
      return {
        totalPackages: Array.isArray(packagesArray) ? packagesArray.length : 0,
        averagePrice: Array.isArray(packagesArray) && packagesArray.length > 0 
          ? packagesArray.reduce((sum: number, p: any) => sum + (p.price || 0), 0) / packagesArray.length 
          : 0,
        totalTransactions: Array.isArray(packagesArray) 
          ? packagesArray.reduce((sum: number, p: any) => sum + (p.total_transactions || 0), 0) 
          : 0,
        averageRating: Array.isArray(packagesArray) && packagesArray.length > 0
          ? packagesArray.reduce((sum: number, p: any) => sum + (p.average_rating || 0), 0) / packagesArray.length
          : 0,
      };
    }),
  }),

  // Reasoning Chains Marketplace
  reasoningChains: router({
    // Browse reasoning chains (from Go service)
    browse: publicProcedure
      .input(z.object({
        category: z.string().optional(),
        sourceModel: z.string().optional(),
        minQuality: z.number().min(0).max(1).optional(),
        maxPrice: z.number().positive().optional(),
        limit: z.number().positive().default(20),
        offset: z.number().nonnegative().default(0),
      }))
      .query(async ({ input }) => {
        // Delegate to Go Reasoning Chains service via adapter
        return await goServiceAdapter.browseReasoningChains(
          input.sourceModel,
          input.limit,
          input.offset
        );
      }),

    // Publish a reasoning chain (with S3 storage)
    publish: creatorProcedure
      .input(z.object({
        chainName: z.string().min(1),
        description: z.string().min(1),
        category: z.string().min(1),
        inputExample: z.any(),
        outputExample: z.any(),
        kvCacheSnapshot: z.object({
          sourceModel: z.string(),
          keys: z.array(z.any()),
          values: z.array(z.any()),
          attentionMask: z.array(z.any()).optional(),
          positionEncodings: z.array(z.any()).optional(),
          metadata: z.object({
            sequenceLength: z.number(),
            contextDescription: z.string(),
            tokenCount: z.number(),
            generatedAt: z.date().optional(),
          }),
        }),
        pricePerUse: z.number().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Store KV-cache snapshot in S3
        const kvCacheJson = JSON.stringify(input.kvCacheSnapshot);
        const fileKey = `reasoning-chains/${ctx.user.id}/${nanoid()}-${Date.now()}.json`;
        const { url: storageUrl } = await storagePut(fileKey, kvCacheJson, "application/json");
        
        // Publish to Go Reasoning Chains service
        return await goServiceAdapter.publishReasoningChain(
          String(ctx.user.id),
          {
            name: input.chainName,
            description: input.description,
            chain_steps: [input.inputExample, input.outputExample],
            model_type: input.kvCacheSnapshot.sourceModel,
            price: input.pricePerUse,
          }
        );
      }),

    // Use (purchase) a reasoning chain
    use: protectedProcedure
      .input(z.object({
        chainId: z.number(),
        targetModel: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Call Go Reasoning Chains service via adapter
        return await goServiceAdapter.useReasoningChain(
          String(ctx.user.id),
          String(input.chainId)
        );
      }),
  }),

  // W-Matrix Protocol
  wMatrix: router({
    // Get supported models
    getSupportedModels: publicProcedure.query(() => {
      return latentmas.getSupportedModels();
    }),

    // Get model specification
    getModelSpec: publicProcedure
      .input(z.object({ model: z.string() }))
      .query(({ input }) => {
        return latentmas.getModelSpec(input.model as latentmas.ModelType);
      }),

    // Check model compatibility
    checkCompatibility: publicProcedure
      .input(z.object({
        model1: z.string(),
        model2: z.string(),
      }))
      .query(({ input }) => {
        return {
          compatible: latentmas.areModelsCompatible(
            input.model1 as latentmas.ModelType,
            input.model2 as latentmas.ModelType
          ),
        };
      }),

    // Get current W-Matrix version
    getCurrentVersion: publicProcedure.query(() => {
      return { version: latentmas.WMatrixService.getCurrentVersion() };
    }),

    // Get available W-Matrix versions (from Go service)
    getVersions: publicProcedure.query(async () => {
      return await goServiceAdapter.getWMatrixVersions();
    }),

    // Generate W-Matrix for model pair
    generate: publicProcedure
      .input(z.object({
        sourceModel: z.string(),
        targetModel: z.string(),
        method: z.enum(["orthogonal", "learned", "hybrid"]).default("orthogonal"),
      }))
      .query(({ input }) => {
        const wMatrix = latentmas.WMatrixService.getWMatrix(
          input.sourceModel as latentmas.ModelType,
          input.targetModel as latentmas.ModelType,
          latentmas.WMatrixService.getCurrentVersion(),
          input.method
        );
        // Return without the full transformation rules (too large)
        return {
          version: wMatrix.version,
          sourceModel: wMatrix.sourceModel,
          targetModel: wMatrix.targetModel,
          unifiedDimension: wMatrix.unifiedDimension,
          method: wMatrix.method,
          kvCacheCompatibility: wMatrix.kvCacheCompatibility,
          qualityMetrics: wMatrix.qualityMetrics,
          metadata: wMatrix.metadata,
        };
      }),

    // Align KV-cache to target model
    alignKVCache: protectedProcedure
      .input(z.object({
        kvCache: z.object({
          sourceModel: z.string(),
          keys: z.array(z.any()),
          values: z.array(z.any()),
          attentionMask: z.array(z.any()).optional(),
          positionEncodings: z.array(z.any()).optional(),
          metadata: z.object({
            sequenceLength: z.number(),
            contextDescription: z.string(),
            tokenCount: z.number(),
            generatedAt: z.date().optional(),
          }),
        }),
        targetModel: z.string(),
        wMatrixVersion: z.string().optional(),
      }))
      .mutation(({ input }) => {
        const aligned = latentmas.WMatrixService.alignKVCache(
          input.kvCache as latentmas.KVCache,
          input.targetModel as latentmas.ModelType,
          input.wMatrixVersion
        );
        return {
          targetModel: aligned.targetModel,
          wMatrixVersion: aligned.wMatrixVersion,
          alignmentQuality: aligned.alignmentQuality,
          metadata: aligned.metadata,
          // Note: Full KV-cache data would be returned in production
          // Omitted here for response size
        };
      }),
  }),

  // Semantic Index API - For AI Agent Discovery
  semanticIndex: router({
    // Search memories by topic/keyword
    findByTopic: publicProcedure
      .input(z.object({
        topic: z.string().min(1),
        limit: z.number().min(1).max(50).default(10)
      }))
      .query(({ input }) => {
        return semanticIndex.findMemoryByTopic(input.topic, input.limit);
      }),

    // Search memories by domain
    findByDomain: publicProcedure
      .input(z.object({
        domain: z.string(),
        limit: z.number().min(1).max(50).default(10)
      }))
      .query(({ input }) => {
        return semanticIndex.findMemoryByDomain(input.domain as any, input.limit);
      }),

    // Search memories by task type
    findByTask: publicProcedure
      .input(z.object({
        taskType: z.string(),
        limit: z.number().min(1).max(50).default(10)
      }))
      .query(({ input }) => {
        return semanticIndex.findMemoryByTask(input.taskType as any, input.limit);
      }),

    // Combined semantic search
    search: publicProcedure
      .input(z.object({
        query: z.string().optional(),
        domain: z.string().optional(),
        taskType: z.string().optional(),
        modelOrigin: z.string().optional(),
        isPublic: z.boolean().optional(),
        limit: z.number().min(1).max(50).default(20)
      }))
      .query(({ input }) => {
        return semanticIndex.semanticSearch({
          query: input.query,
          domain: input.domain as any,
          task_type: input.taskType as any,
          model_origin: input.modelOrigin,
          is_public: input.isPublic,
          limit: input.limit
        });
      }),

    // Get memory leaderboard
    leaderboard: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(10) }))
      .query(({ input }) => {
        return semanticIndex.getMemoryLeaderboard(input.limit);
      }),

    // Get network statistics
    stats: publicProcedure.query(() => {
      return semanticIndex.getNetworkStats();
    }),

    // Get available domains
    domains: publicProcedure.query(() => {
      return semanticIndex.getAvailableDomains();
    }),

    // Get available task types
    taskTypes: publicProcedure.query(() => {
      return semanticIndex.getAvailableTaskTypes();
    }),

    // Get all genesis memories
    genesisMemories: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(100) }))
      .query(({ input }) => {
        return GENESIS_MEMORIES.slice(0, input.limit);
      }),
  }),

  // Agent Registry API
  agentRegistry: router({
    // Register a new agent
    register: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        modelType: z.string().min(1),
        capabilities: z.array(z.string()),
        tbaAddress: z.string().min(1)
      }))
      .mutation(({ input }) => {
        return semanticIndex.registerAgent({
          name: input.name,
          description: input.description,
          model_type: input.modelType,
          capabilities: input.capabilities,
          tba_address: input.tbaAddress
        });
      }),

    // Get agent by ID
    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => {
        return semanticIndex.getAgent(input.id);
      }),

    // List all agents
    list: publicProcedure
      .input(z.object({
        modelType: z.string().optional(),
        capability: z.string().optional(),
        limit: z.number().min(1).max(100).default(50)
      }))
      .query(({ input }) => {
        return semanticIndex.listAgents({
          model_type: input.modelType,
          capability: input.capability,
          limit: input.limit
        });
      }),

    // Get recently registered agents
    recent: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
      .query(({ input }) => {
        return semanticIndex.getRecentAgents(input.limit);
      }),

    // Get top agents by reputation
    top: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
      .query(({ input }) => {
        return semanticIndex.getTopAgents(input.limit);
      }),

    // Search agents by capability
    search: publicProcedure
      .input(z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(20)
      }))
      .query(({ input }) => {
        return semanticIndex.searchAgentsByCapability(input.query, input.limit);
      }),

    // Get agent activity timeline
    activityTimeline: publicProcedure.query(() => {
      return semanticIndex.getAgentActivityTimeline();
    }),
  }),

  // W-Matrix Alignment System
  alignment: router({
    // Calculate alignment for a vector
    calculate: publicProcedure
      .input(z.object({
        vectorData: z.array(z.number()),
        wMatrixVersion: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { alignmentService } = await import('./alignment/alignment-service');
        const result = await alignmentService.computeAlignment(
          JSON.stringify(input.vectorData),
          input.wMatrixVersion
        );
        
        // Log to database
        const database = await getDb();
        if (database) {
          await database.insert(alignmentCalculations).values({
            vectorId: 0, // Placeholder when vector doesn't exist in DB yet
            wMatrixVersion: input.wMatrixVersion,
            epsilonValue: result.epsilon.toString(),
            fidelityBoostEstimate: result.improvementPct.toString(),
            computationTimeMs: result.computationTimeMs,
          });
        }
        
        return result;
      }),

    // Train new W-matrix
    trainMatrix: adminProcedure
      .input(z.object({
        sourceVectors: z.array(z.array(z.number())),
        targetVectors: z.array(z.array(z.number())),
        standardDim: z.enum(['4096', '8192']),
        version: z.string(),
        sourceModels: z.array(z.string()),
        useLora: z.boolean().default(true),
        loraRank: z.number().default(64),
      }))
      .mutation(async ({ input, ctx }) => {
        const { workflowManager } = await import('./workflow-manager');
        const { alignmentService } = await import('./alignment/alignment-service');
        
        // Create workflow session
        const session = workflowManager.createSession({
          userId: ctx.user.id,
          type: 'w_matrix_training',
          title: `Train W-Matrix ${input.version}`,
          description: `Training W-Matrix from ${input.sourceVectors.length} anchor pairs`,
          tags: ['w-matrix', 'training', input.standardDim],
        });
        const workflowId = session.id;
        
        try {
          // Track: Prepare training data
          const prepareEvent = workflowManager.addEvent(workflowId, {
            type: 'tool_call',
            title: 'Prepare Training Data',
            input: {
              sourceVectorsCount: input.sourceVectors.length,
              targetVectorsCount: input.targetVectors.length,
              standardDim: input.standardDim,
              sourceModels: input.sourceModels,
            },
          });
          
          workflowManager.updateEvent(workflowId, prepareEvent.id, {
            status: 'completed',
            output: {
              anchorPairs: input.sourceVectors.length,
              useLora: input.useLora,
              loraRank: input.loraRank,
            },
          });
          
          // Track: Train W-Matrix
          const trainEvent = workflowManager.addEvent(workflowId, {
            type: 'tool_call',
            title: 'Train W-Matrix Model',
            input: {
              standardDim: input.standardDim,
              method: input.useLora ? 'LoRA' : 'Full',
            },
          });
          
          const result = await alignmentService.trainWMatrix(
            input.sourceVectors,
            input.targetVectors,
            parseInt(input.standardDim) as 4096 | 8192,
            { useLora: input.useLora, loraRank: input.loraRank }
          );
          
          workflowManager.updateEvent(workflowId, trainEvent.id, {
            status: 'completed',
            output: {
              epsilon: result.metrics.epsilon,
              fidelityScore: result.metrics.fidelityScore,
              trainingTimeMs: result.metrics.computationTimeMs,
            },
          });
          
          // Track: Save to database
          const saveEvent = workflowManager.addEvent(workflowId, {
            type: 'tool_call',
            title: 'Save W-Matrix to Database',
            input: { version: input.version },
          });
          
          const database = await getDb();
          if (database) {
            await database.insert(wMatrixVersions).values({
              version: input.version,
              standardDim: parseInt(input.standardDim),
              matrixData: result.serializedMatrix,
              matrixFormat: 'numpy',
              sourceModels: JSON.stringify(input.sourceModels),
              alignmentPairsCount: input.sourceVectors.length,
              avgReconstructionError: result.metrics.epsilon.toString(),
              isActive: true,
            });
          }
          
          workflowManager.updateEvent(workflowId, saveEvent.id, {
            status: 'completed',
            output: { version: input.version, saved: true },
          });
          
          // End workflow
          workflowManager.completeSession(workflowId, 'completed');
          
          return result;
        } catch (error) {
          // Track error
          workflowManager.addEvent(workflowId, {
            type: 'tool_call',
            title: 'Training Failed',
            input: { error: (error as Error).message },
          });
          workflowManager.completeSession(workflowId, 'failed');
          throw error;
        }
      }),

    // Get W-matrix versions
    listVersions: publicProcedure.query(async () => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const versions = await database
        .select()
        .from(wMatrixVersions)
        .where(eq(wMatrixVersions.isActive, true))
        .orderBy(desc(wMatrixVersions.createdAt));
      return versions;
    }),

    // Get specific W-matrix version
    getVersion: publicProcedure
      .input(z.object({ version: z.string() }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const [version] = await database
          .select()
          .from(wMatrixVersions)
          .where(eq(wMatrixVersions.version, input.version))
          .limit(1);
        
        if (!version) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'W-matrix version not found' });
        }
        
        return version;
      }),

    // Transform vector using W-matrix
    transform: publicProcedure
      .input(z.object({
        vectorData: z.array(z.number()),
        wMatrixVersion: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { alignmentService } = await import('./alignment/alignment-service');
        const transformed = await alignmentService.transformVector(
          input.vectorData,
          input.wMatrixVersion
        );
        return { transformedVector: transformed };
      }),

    // Get alignment calculation history
    getHistory: protectedProcedure
      .input(z.object({
        vectorId: z.number().optional(),
        limit: z.number().min(1).max(100).default(50),
      }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        
        if (input.vectorId) {
          return await database
            .select()
            .from(alignmentCalculations)
            .where(eq(alignmentCalculations.vectorId, input.vectorId))
            .orderBy(desc(alignmentCalculations.computedAt))
            .limit(input.limit);
        }
        
        return await database
          .select()
          .from(alignmentCalculations)
          .orderBy(desc(alignmentCalculations.computedAt))
          .limit(input.limit);
      }),
  }),

  // LatentMAS v2 API Endpoints
  latentmasV2: latentmasRouter,
  wMatrixMarketplace: wMatrixMarketplaceRouter,
  aiAgent: aiAgentRouter,
  wMatrixMarketplaceV2: wMatrixMarketplaceV2Router,
  kvCacheApi: kvCacheApiRouter,
  memoryNFT: memoryNFTRouter,
  agentCredit: agentCreditRouter,
  latentmasMarketplace: latentmasMarketplaceRouter,
  packages: packagesApiRouter,
  workflow: workflowRouter,
  workflowHistory: workflowHistoryRouter,
  user: userRouter,
  authUnified: authUnifiedRouter,
  apiAnalytics: apiAnalyticsRouter,
  agentDiscovery: agentDiscoveryRouter,
  agentCollaboration: agentCollaborationRouter,
  // memoryExchange: Go microservice at :8080

  // Admin Analytics (admin-only)
  adminAnalytics: router({
    getUsageStats: adminProcedure
      .input(z.object({ days: z.number().min(1).max(365).default(7) }))
      .query(async ({ input }) => {
        return await adminAnalytics.getApiUsageStats(input.days);
      }),

    getUsageTimeline: adminProcedure
      .input(z.object({ days: z.number().min(1).max(365).default(30) }))
      .query(async ({ input }) => {
        return await adminAnalytics.getApiUsageTimeline(input.days);
      }),

    getTopUsers: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(10) }))
      .query(async ({ input }) => {
        return await adminAnalytics.getTopApiKeyUsers(input.limit);
      }),

    getAllApiKeys: adminProcedure.query(async () => {
      return await adminAnalytics.getAllApiKeysWithStats();
    }),

    getSystemHealth: adminProcedure.query(async () => {
      return await adminAnalytics.getSystemHealthMetrics();
    }),

    getRateLimitConfig: adminProcedure
      .input(z.object({ apiKeyId: z.number() }))
      .query(async ({ input }) => {
        return await adminAnalytics.getRateLimitConfig(input.apiKeyId);
      }),

    updateRateLimitConfig: adminProcedure
      .input(
        z.object({
          apiKeyId: z.number(),
          requestsPerHour: z.number().optional(),
          requestsPerDay: z.number().optional(),
          requestsPerMonth: z.number().optional(),
          burstLimit: z.number().optional(),
          isEnabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { apiKeyId, ...config } = input;
        await adminAnalytics.updateRateLimitConfig(apiKeyId, config);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
