import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

export const accessRouter = router({
  verify: publicProcedure
    .input(z.object({ accessToken: z.string() }))
    .query(async ({ input }) => {
      const permission = await db.getAccessPermissionByToken(input.accessToken);
      if (!permission || !permission.isActive) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired access token" });
      }

      if (permission.expiresAt && new Date(permission.expiresAt) < new Date()) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Access token expired" });
      }

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

  logCall: protectedProcedure
    .input(z.object({
      accessToken: z.string(),
      responseTime: z.number(),
      success: z.boolean(),
      errorMessage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const permission = await db.getAccessPermissionByToken(input.accessToken);
      if (!permission) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      if (permission.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot log calls for another user's access token" });
      }

      await db.logApiCall({
        userId: permission.userId,
        vectorId: permission.vectorId,
        permissionId: permission.id,
        responseTime: input.responseTime,
        success: input.success,
        errorMessage: input.errorMessage,
      });

      if (permission.callsRemaining !== null) {
        await db.decrementCallsRemaining(permission.id);
      }

      return { success: true };
    }),

  myPermissions: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserAccessPermissions(ctx.user.id);
  }),
});
