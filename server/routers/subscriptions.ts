import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { createSubscriptionCheckout } from "../stripe-client";

export const subscriptionsRouter = router({
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
});
