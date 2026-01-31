import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { assertDatabaseAvailable } from "../utils/error-handling";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { PrivacyLevel, PrivacyConfig } from "../latentmas/differential-privacy";
import { getDPEngine, createPrivacyDisclosure } from "../latentmas/differential-privacy";

export const userRouter = router({
  // Get current user profile
  me: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    assertDatabaseAvailable(db);
    
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user[0]) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return {
      id: user[0].id,
      name: user[0].name,
      email: user[0].email,
      role: user[0].role,
      userType: user[0].userType,
      onboardingCompleted: user[0].onboardingCompleted,
      bio: user[0].bio,
      avatar: user[0].avatar,
      createdAt: user[0].createdAt,
    };
  }),

  // Update user role during onboarding
  updateUserRole: protectedProcedure
    .input(
      z.object({
        userType: z.enum(["creator", "consumer", "both"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      assertDatabaseAvailable(db);
      
      await db
        .update(users)
        .set({
          userType: input.userType,
          onboardingCompleted: true,
        })
        .where(eq(users.id, ctx.user.id));

      return {
        success: true,
        message: "User role updated successfully",
      };
    }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        bio: z.string().optional(),
        avatar: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      assertDatabaseAvailable(db);

      await db
        .update(users)
        .set({
          name: input.name,
          bio: input.bio,
          avatar: input.avatar,
        })
        .where(eq(users.id, ctx.user.id));

      return {
        success: true,
        message: "Profile updated successfully",
      };
    }),

  // ============================================================================
  // Differential Privacy Settings
  // ============================================================================

  /**
   * Get user's privacy settings and budget
   */
  getPrivacySettings: protectedProcedure
    .query(async ({ ctx }) => {
      // In production, these would be stored in database
      // For now, return defaults that can be overridden per upload
      const dpEngine = getDPEngine();

      return {
        defaultPrivacyLevel: 'medium' as PrivacyLevel,
        enableAutoPrivacy: false,
        totalPrivacyBudget: 10.0, // Total epsilon available
        usedPrivacyBudget: 0.0, // Sum of all epsilons used
        remainingPrivacyBudget: 10.0,
        recommendedLevel: dpEngine.getRecommendedLevel('enterprise'),
        availableLevels: {
          low: { epsilon: 10.0, delta: 1e-5, utilityLoss: 0.3 },
          medium: { epsilon: 1.0, delta: 1e-5, utilityLoss: 2.1 },
          high: { epsilon: 0.1, delta: 1e-5, utilityLoss: 8.7 },
        },
      };
    }),

  /**
   * Update privacy settings
   */
  updatePrivacySettings: protectedProcedure
    .input(z.object({
      defaultPrivacyLevel: z.enum(['low', 'medium', 'high']).optional(),
      enableAutoPrivacy: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // In production, save to database
      // For now, just validate and return success

      return {
        success: true,
        message: 'Privacy settings updated successfully',
        settings: {
          defaultPrivacyLevel: input.defaultPrivacyLevel || 'medium',
          enableAutoPrivacy: input.enableAutoPrivacy ?? false,
        },
      };
    }),

  /**
   * Get privacy budget history
   */
  getPrivacyBudgetHistory: protectedProcedure
    .query(async ({ ctx }) => {
      // In production, fetch from database
      // Return mock history showing privacy budget usage over time
      return {
        totalBudget: 10.0,
        usedBudget: 0.0,
        remainingBudget: 10.0,
        history: [
          // Example: { timestamp: '2026-01-15', operation: 'vector_upload', epsilon: 1.0, packageId: 'vpkg_xxx' }
        ],
      };
    }),

  /**
   * Simulate privacy-utility tradeoff for a vector
   */
  simulatePrivacy: protectedProcedure
    .input(z.object({
      vectorDimension: z.number().int().min(1).max(10000),
      privacyLevel: z.enum(['low', 'medium', 'high', 'custom']),
      customEpsilon: z.number().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dpEngine = getDPEngine();

      // Create a mock normalized vector
      const mockVector = Array.from({ length: input.vectorDimension }, () => Math.random() - 0.5);
      const norm = Math.sqrt(mockVector.reduce((sum, v) => sum + v * v, 0));
      const normalizedVector = mockVector.map(v => v / norm);

      // Apply privacy noise
      const config: PrivacyConfig | PrivacyLevel = input.privacyLevel === 'custom' && input.customEpsilon
        ? { epsilon: input.customEpsilon, delta: 1e-5, level: 'custom' }
        : input.privacyLevel;

      const privatized = dpEngine.addNoise(normalizedVector, config, true);

      // Calculate actual utility loss
      const dotProduct = privatized.vector.reduce((sum, v, i) => sum + v * privatized.original[i], 0);
      const norm1 = Math.sqrt(privatized.vector.reduce((sum, v) => sum + v * v, 0));
      const norm2 = Math.sqrt(privatized.original.reduce((sum, v) => sum + v * v, 0));
      const actualCosineSimilarity = dotProduct / (norm1 * norm2);
      const actualUtilityLoss = (1 - actualCosineSimilarity) * 100;

      return {
        success: true,
        simulation: {
          privacyMetadata: privatized.metadata,
          actualUtilityLoss: actualUtilityLoss,
          estimatedUtilityLoss: privatized.metadata.utilityLoss,
          cosineSimilarity: actualCosineSimilarity,
          disclosure: createPrivacyDisclosure(privatized.metadata),
        },
      };
    }),
});
