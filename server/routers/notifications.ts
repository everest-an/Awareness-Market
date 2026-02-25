import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { prisma } from "../db-prisma";

export const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      return await db.getUserNotifications(ctx.user.id, input.unreadOnly);
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const notification = await prisma.notification.findUnique({
        where: { id: input.id },
        select: { userId: true },
      });
      if (!notification || notification.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      }
      await db.markNotificationAsRead(input.id);
      return { success: true };
    }),
});
