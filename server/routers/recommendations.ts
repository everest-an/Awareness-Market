import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as recommendationEngine from "../recommendation-engine";
import * as db from "../db";
import type { UserPreferencesUpdateData } from "../types/router-types";

export const recommendationsRouter = router({
  getRecommendations: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(5) }))
    .query(async ({ ctx, input }) => {
      const recommendations = await recommendationEngine.generateRecommendations({
        userId: ctx.user.id,
        limit: input.limit,
      });
      return recommendations;
    }),

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

  updatePreferences: protectedProcedure
    .input(z.object({
      preferredCategories: z.array(z.string()).optional(),
      priceRange: z.object({ min: z.number(), max: z.number() }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: UserPreferencesUpdateData = {};
      if (input.preferredCategories) {
        updates.preferredCategories = JSON.stringify(input.preferredCategories);
      }
      if (input.priceRange) {
        updates.priceRange = JSON.stringify(input.priceRange);
      }
      await db.upsertUserPreferences(ctx.user.id, updates);
      return { success: true };
    }),
});
