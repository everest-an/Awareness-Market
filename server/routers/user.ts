import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const userRouter = router({
  // Get current user profile
  me: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
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
});
