import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { prisma } from "../db-prisma";
import { TRPCError } from "@trpc/server";
import type { PrivacyLevel, PrivacyConfig } from "../latentmas/differential-privacy";
import { getDPEngine, createPrivacyDisclosure } from "../latentmas/differential-privacy";

export const userRouter = router({
  // Get current user profile
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id }
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      userType: user.userType,
      onboardingCompleted: user.onboardingCompleted,
      bio: user.bio,
      avatar: user.avatar,
      createdAt: user.createdAt,
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
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          userType: input.userType,
          onboardingCompleted: true,
        }
      });

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
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          name: input.name,
          bio: input.bio,
          avatar: input.avatar,
        }
      });

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
      // Aggregate privacy budget usage from package records
      const totalBudget = 10.0;

      const [vectorPackages, memoryPackages, chainPackages] = await Promise.all([
        prisma.vectorPackage.findMany({
          where: { userId: ctx.user.id },
          select: { packageId: true, epsilon: true, createdAt: true },
        }),
        prisma.memoryPackage.findMany({
          where: { userId: ctx.user.id },
          select: { packageId: true, epsilon: true, createdAt: true },
        }),
        prisma.chainPackage.findMany({
          where: { userId: ctx.user.id },
          select: { packageId: true, epsilon: true, createdAt: true },
        }),
      ]);

      const history = [
        ...vectorPackages.map((pkg) => ({
          timestamp: pkg.createdAt.toISOString(),
          operation: 'vector_upload',
          epsilon: Number(pkg.epsilon || 0),
          packageId: pkg.packageId,
        })),
        ...memoryPackages.map((pkg) => ({
          timestamp: pkg.createdAt.toISOString(),
          operation: 'memory_upload',
          epsilon: Number(pkg.epsilon || 0),
          packageId: pkg.packageId,
        })),
        ...chainPackages.map((pkg) => ({
          timestamp: pkg.createdAt.toISOString(),
          operation: 'chain_upload',
          epsilon: Number(pkg.epsilon || 0),
          packageId: pkg.packageId,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const usedBudget = history.reduce((sum, item) => sum + item.epsilon, 0);
      const remainingPrivacyBudget = Math.max(totalBudget - usedBudget, 0);

      return {
        totalBudget,
        usedBudget,
        remainingPrivacyBudget,
        history,
      };
    }),

  /**
   * Simulate privacy-utility tradeoff for a vector
   */
  simulatePrivacy: protectedProcedure
    .input(z.object({
      vectorDimension: z.number().int().min(1).max(10000),
      vector: z.array(z.number()).optional(),
      privacyLevel: z.enum(['low', 'medium', 'high', 'custom']),
      customEpsilon: z.number().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dpEngine = getDPEngine();

      let normalizedVector: number[];
      if (input.vector && input.vector.length > 0) {
        const norm = Math.sqrt(input.vector.reduce((sum, v) => sum + v * v, 0));
        normalizedVector = norm === 0 ? input.vector : input.vector.map(v => v / norm);
      } else {
        // Create a mock normalized vector
        const mockVector = Array.from({ length: input.vectorDimension }, () => Math.random() - 0.5);
        const norm = Math.sqrt(mockVector.reduce((sum, v) => sum + v * v, 0));
        normalizedVector = mockVector.map(v => v / norm);
      }

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
