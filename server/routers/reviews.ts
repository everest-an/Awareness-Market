import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { prisma } from "../db-prisma";

export const reviewsRouter = router({
  create: protectedProcedure
    .input(z.object({
      vectorId: z.number(),
      rating: z.number().min(1).max(5),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const permissions = await db.getUserAccessPermissions(ctx.user.id);
      const hasPurchased = permissions.some(p => p.vectorId === input.vectorId);

      await db.createReview({
        vectorId: input.vectorId,
        userId: ctx.user.id,
        rating: input.rating,
        comment: input.comment,
        isVerifiedPurchase: hasPurchased,
      });

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

  getByVector: publicProcedure
    .input(z.object({
      vectorId: z.number(),
      sortBy: z.enum(["newest", "oldest", "highest", "lowest"]).default("newest"),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return await db.getVectorReviews(input.vectorId);
    }),

  myReviews: protectedProcedure.query(async ({ ctx }) => {
    const userReviews = await prisma.$queryRaw<Array<{
      id: number;
      vectorId: number;
      userId: number;
      rating: number;
      comment: string | null;
      isVerifiedPurchase: boolean;
      createdAt: Date;
      vector_id: number | null;
      vector_title: string | null;
      vector_category: string | null;
    }>>`
      SELECT r.*,
             v.id as vector_id, v.title as vector_title, v.category as vector_category
      FROM reviews r
      LEFT JOIN latent_vectors v ON r.vector_id = v.id
      WHERE r.user_id = ${ctx.user.id}
      ORDER BY r.created_at DESC
    `;

    return userReviews.map(r => ({
      review: {
        id: r.id,
        vectorId: r.vectorId,
        userId: r.userId,
        rating: r.rating,
        comment: r.comment,
        isVerifiedPurchase: r.isVerifiedPurchase,
        createdAt: r.createdAt,
      },
      vector: r.vector_id ? {
        id: r.vector_id,
        title: r.vector_title,
        category: r.vector_category,
      } : null
    }));
  }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      rating: z.number().min(1).max(5).optional(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const review = await prisma.review.findUnique({
        where: { id: input.id }
      });

      if (!review || review.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const updateData: { rating?: number; comment?: string } = {};
      if (input.rating !== undefined) updateData.rating = input.rating;
      if (input.comment !== undefined) updateData.comment = input.comment;

      await prisma.review.update({
        where: { id: input.id },
        data: updateData
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const review = await prisma.review.findUnique({
        where: { id: input.id }
      });

      if (!review || review.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await prisma.review.delete({
        where: { id: input.id }
      });

      return { success: true };
    }),

  getStats: publicProcedure
    .input(z.object({ vectorId: z.number() }))
    .query(async ({ input }) => {
      const vectorReviews = await prisma.review.findMany({
        where: { vectorId: input.vectorId }
      });

      const totalReviews = vectorReviews.length;
      const averageRating = totalReviews > 0
        ? vectorReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      vectorReviews.forEach((r) => {
        ratingDistribution[r.rating as keyof typeof ratingDistribution]++;
      });

      const verifiedPurchases = vectorReviews.filter((r) => r.isVerifiedPurchase).length;

      return {
        totalReviews,
        averageRating,
        ratingDistribution,
        verifiedPurchases,
        verifiedPercentage: totalReviews > 0 ? (verifiedPurchases / totalReviews) * 100 : 0,
      };
    }),
});
