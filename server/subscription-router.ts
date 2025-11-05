import { z } from 'zod';
import { protectedProcedure, router } from './_core/trpc';
import { getUserSubscription, createSubscription } from './db';

export const subscriptionRouter = router({
  // Get current user's subscription
  current: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await getUserSubscription(ctx.user.id);
    
    // Check if subscription is expired
    if (subscription && subscription.currentPeriodEnd) {
      const now = new Date();
      if (now > subscription.currentPeriodEnd && subscription.status === 'active') {
        // Subscription expired but status not updated
        return {
          ...subscription,
          status: 'expired' as const,
        };
      }
    }
    
    return subscription;
  }),

  // Start free trial
  startFreeTrial: protectedProcedure.mutation(async ({ ctx }) => {
    // Check if user already has a subscription
    const existing = await getUserSubscription(ctx.user.id);
    if (existing) {
      throw new Error('User already has a subscription');
    }

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 15); // 15 days trial

    await createSubscription({
      userId: ctx.user.id,
      plan: 'free_trial',
      status: 'trialing',
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      trialEndsAt: trialEnd,
      paymentMethod: null,
      amount: null,
      currency: 'usd',
    });

    return { success: true, trialEndsAt: trialEnd };
  }),

  // Create Stripe checkout session
  createCheckoutSession: protectedProcedure
    .input(z.object({
      planId: z.enum(['MONTHLY', 'YEARLY', 'LIFETIME']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Call Stripe API to create checkout session
      const response = await fetch(`${ctx.req.headers.origin}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: input.planId,
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      return { checkoutUrl: data.url };
    }),
});
