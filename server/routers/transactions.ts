import { z } from "zod";
import { protectedProcedure, creatorProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { createVectorPurchaseCheckout } from "../stripe-client";
import type { InsertResult } from "../types/router-types";

export const transactionsRouter = router({
  purchase: protectedProcedure
    .input(z.object({
      vectorId: z.number(),
      successUrl: z.string().optional(),
      cancelUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const vector = await db.getLatentVectorById(input.vectorId);
      if (!vector || vector.status !== "active") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vector not available" });
      }

      const amount = parseFloat(vector.basePrice.toString());
      const platformFeeRate = 0.20;
      const platformFee = amount * platformFeeRate;
      const creatorEarnings = amount - platformFee;

      const result = await db.createTransaction({
        buyerId: ctx.user.id,
        vectorId: input.vectorId,
        amount: amount.toFixed(2),
        platformFee: platformFee.toFixed(2),
        creatorEarnings: creatorEarnings.toFixed(2),
        status: "pending",
        transactionType: "one-time",
      });

      const transactionId = (result as unknown as InsertResult).insertId;

      const checkoutUrl = await createVectorPurchaseCheckout({
        userId: ctx.user.id,
        userEmail: ctx.user.email || `user-${ctx.user.id}@placeholder.local`,
        userName: ctx.user.name || undefined,
        vectorId: input.vectorId,
        vectorTitle: vector.title,
        amount: amount,
        successUrl: input.successUrl || `${process.env.CLIENT_URL || 'http://localhost:5173'}/purchase/success?transactionId=${transactionId}`,
        cancelUrl: input.cancelUrl || `${process.env.CLIENT_URL || 'http://localhost:5173'}/purchase/cancelled`,
        transactionId: Number(transactionId),
      });

      return {
        success: true,
        transactionId,
        checkoutUrl,
        message: "Redirecting to Stripe checkout..."
      };
    }),

  myTransactions: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserTransactions(ctx.user.id, "buyer");
  }),

  myEarnings: creatorProcedure.query(async ({ ctx }) => {
    const transactions = await db.getUserTransactions(ctx.user.id, "creator");
    return transactions;
  }),
});
