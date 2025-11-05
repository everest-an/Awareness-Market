import express, { Request, Response } from 'express';
import { stripe, STRIPE_WEBHOOK_SECRET } from './stripe-client';
import { SUBSCRIPTION_PLANS } from './products';
import { 
  createSubscription, 
  updateSubscriptionByStripeId,
  getUserSubscription 
} from './db';
import Stripe from 'stripe';

export const stripeRouter = express.Router();

/**
 * Create Stripe Checkout Session
 */
stripeRouter.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const { planId, userId, userEmail, userName } = req.body;

    if (!planId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get plan details
    const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Skip Stripe for free trial
    if (planId === 'FREE_TRIAL') {
      return res.status(400).json({ error: 'Free trial does not require payment' });
    }

    const planData = plan as any;
    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: planData.interval === 'one_time' ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: planData.priceId,
          quantity: 1,
        },
      ],
      customer_email: userEmail,
      client_reference_id: userId.toString(),
      metadata: {
        user_id: userId.toString(),
        customer_email: userEmail || '',
        customer_name: userName || '',
        plan_id: planId,
      },
      success_url: `${req.headers.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/subscription/cancel`,
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * Stripe Webhook Handler
 * IMPORTANT: This route must be registered BEFORE express.json() middleware
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).send('Missing stripe-signature header');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook event:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = parseInt(session.metadata?.user_id || '0');
  const planId = session.metadata?.plan_id || '';

  if (!userId || !planId) {
    console.error('Missing user_id or plan_id in session metadata');
    return;
  }

  const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
  if (!plan) {
    console.error('Invalid plan_id:', planId);
    return;
  }

  // Calculate subscription period
  const now = new Date();
  const periodEnd = new Date(now);
  
  const interval = (plan as any).interval;
  if (interval === 'month') {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else if (interval === 'year') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else if (interval === 'one_time') {
    // Lifetime access
    periodEnd.setFullYear(periodEnd.getFullYear() + 100);
  } else {
    // Free trial - 15 days
    periodEnd.setDate(periodEnd.getDate() + 15);
  }

  // Create subscription record
  await createSubscription({
    userId,
    plan: planId,
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    stripeSubscriptionId: session.subscription as string || null,
    stripeCustomerId: session.customer as string || null,
    paymentMethod: 'stripe',
    amount: session.amount_total || 0,
    currency: session.currency || 'usd',
  });

  console.log(`✅ Subscription created for user ${userId}, plan: ${planId}`);
  console.log(`   Amount: ${(session.amount_total || 0) / 100} ${session.currency?.toUpperCase()}`);
  console.log(`   Period: ${now.toISOString()} to ${periodEnd.toISOString()}`);
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const stripeSubscriptionId = subscription.id;

  const sub = subscription as any;
  await updateSubscriptionByStripeId(stripeSubscriptionId, {
    status: subscription.status === 'active' ? 'active' : 
            subscription.status === 'past_due' ? 'past_due' : 
            subscription.status === 'canceled' ? 'canceled' : 'trialing',
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
  });

  console.log(`Subscription updated: ${stripeSubscriptionId}, status: ${subscription.status}`);
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const stripeSubscriptionId = subscription.id;

  await updateSubscriptionByStripeId(stripeSubscriptionId, {
    status: 'canceled',
  });

  console.log(`Subscription canceled: ${stripeSubscriptionId}`);
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription;
  if (subscriptionId && typeof subscriptionId === 'string') {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await handleSubscriptionUpdate(subscription);
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription;
  if (subscriptionId && typeof subscriptionId === 'string') {
    await updateSubscriptionByStripeId(subscriptionId, {
      status: 'past_due',
    });
    
    console.log(`❌ Payment failed for subscription: ${subscriptionId}`);
    console.log(`   Amount due: ${(invoice.amount_due || 0) / 100} ${invoice.currency?.toUpperCase()}`);
    console.log(`   Attempt count: ${invoice.attempt_count}`);
    
    // TODO: Send notification to user about payment failure
    // You can implement email notification or in-app notification here
  }
}
