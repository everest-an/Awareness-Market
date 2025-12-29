import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import * as db from "../db";
import { sendEmail } from "./email";
import { users } from "../../drizzle/schema";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Broadcast system announcement (admin only)
  announce: adminProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      message: z.string().min(1),
      sendEmail: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Get all active users
      // Note: In a large system, this should be done via a job queue/background worker
      // For this scale, direct iteration is acceptable
      const connection = await db.getDb();
      if (!connection) throw new Error("Database connection failed");

      const allUsers = await connection.select().from(users);

      let emailCount = 0;
      let notifCount = 0;

      // 2. Create notification for each user
      for (const user of allUsers) {
        await db.createNotification({
          userId: user.id,
          type: "system",
          title: input.title,
          message: input.message,
          relatedEntityId: null, // System notification has no related entity
        });
        notifCount++;

        // 3. Send email if requested and user has email
        if (input.sendEmail && user.email) {
          try {
            await sendEmail({
              to: user.email,
              subject: `System Update: ${input.title}`,
              text: input.message,
            });
            emailCount++;
          } catch (e) {
            console.error(`Failed to email user ${user.id}:`, e);
          }
        }
      }

      return {
        success: true,
        notificationsCreated: notifCount,
        emailsSent: emailCount
      };
    }),
});
