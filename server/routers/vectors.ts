import { z } from "zod";
import { publicProcedure, protectedProcedure, creatorProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import type { InsertResult, VectorUpdateData } from "../types/router-types";

export const vectorsRouter = router({
  create: creatorProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      description: z.string().min(1),
      category: z.string().min(1).max(100),
      vectorFile: z.object({
        data: z.string(),
        mimeType: z.string(),
      }),
      modelArchitecture: z.string().optional(),
      vectorDimension: z.number().optional(),
      performanceMetrics: z.string().optional(),
      basePrice: z.number().min(0),
      pricingModel: z.enum(["per-call", "subscription", "usage-based"]),
    }))
    .mutation(async ({ ctx, input }) => {
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

      return { success: true, vectorId: (result as unknown as InsertResult).insertId };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const vector = await db.getLatentVectorById(input.id);
      if (!vector) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vector not found" });
      }
      return vector;
    }),

  myVectors: creatorProcedure.query(async ({ ctx }) => {
    return await db.getLatentVectorsByCreator(ctx.user.id);
  }),

  search: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      minRating: z.number().optional(),
      searchTerm: z.string().optional(),
      sortBy: z.enum(["newest", "oldest", "price_low", "price_high", "rating", "popular"]).default("newest"),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return await db.searchLatentVectors(input);
    }),

  getCategories: publicProcedure.query(async () => {
    return await db.getAllCategories();
  }),

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

      const updates: VectorUpdateData = {};
      if (input.title) updates.title = input.title;
      if (input.description) updates.description = input.description;
      if (input.basePrice !== undefined) updates.basePrice = input.basePrice.toFixed(2);
      if (input.status) updates.status = input.status;

      await db.updateLatentVector(input.id, updates);
      return { success: true };
    }),

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

  invoke: protectedProcedure
    .input(z.object({
      vectorId: z.number(),
      inputData: z.unknown(),
      options: z.object({
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        alignToModel: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { invokeVector } = await import("../vector-invocation");
      return await invokeVector(ctx.user.id, input);
    }),

  invocationHistory: protectedProcedure
    .input(z.object({
      vectorId: z.number().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { getInvocationHistory } = await import("../vector-invocation");
      return await getInvocationHistory(ctx.user.id, input);
    }),

  invocationStats: creatorProcedure
    .input(z.object({ vectorId: z.number() }))
    .query(async ({ ctx, input }) => {
      const vector = await db.getLatentVectorById(input.vectorId);
      if (!vector || vector.creatorId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { getVectorInvocationStats } = await import("../vector-invocation");
      return await getVectorInvocationStats(input.vectorId);
    }),
});
