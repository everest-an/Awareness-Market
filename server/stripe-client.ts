import Stripe from "stripe";

// Use a test key in test environment if STRIPE_SECRET_KEY is not set
const stripeKey = process.env.STRIPE_SECRET_KEY ||
  (process.env.NODE_ENV === 'test' ? 'sk_test_mock_key_for_tests' : '');

if (!stripeKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(stripeKey, {
  apiVersion: "2025-12-15.clover",
});

/**
 * Create or retrieve a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(params: {
  userId: number;
  email: string;
  name?: string;
}): Promise<string> {
  // Search for existing customer by email
  const customers = await stripe.customers.list({
    email: params.email,
    limit: 1,
  });

  if (customers.data.length > 0) {
    return customers.data[0].id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      user_id: params.userId.toString(),
    },
  });

  return customer.id;
}

/**
 * Create a checkout session for one-time vector purchase
 */
export async function createVectorPurchaseCheckout(params: {
  userId: number;
  userEmail: string;
  userName?: string;
  vectorId: number;
  vectorTitle: string;
  amount: number; // in dollars
  successUrl: string;
  cancelUrl: string;
  transactionId: number;
}): Promise<string> {
  const customerId = await getOrCreateStripeCustomer({
    userId: params.userId,
    email: params.userEmail,
    name: params.userName,
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `AI Capability: ${params.vectorTitle}`,
            description: "One-time access to latent vector",
          },
          unit_amount: Math.round(params.amount * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId.toString(),
    metadata: {
      user_id: params.userId.toString(),
      vector_id: params.vectorId.toString(),
      transaction_id: params.transactionId.toString(),
      customer_email: params.userEmail,
      customer_name: params.userName || "",
      purchase_type: "vector",
    },
    allow_promotion_codes: true,
  });

  return session.url!;
}

/**
 * Create a checkout session for W-Matrix purchase
 */
export async function createWMatrixPurchaseCheckout(params: {
  userId: number;
  userEmail: string;
  userName?: string;
  listingId: number;
  listingTitle: string;
  amount: number; // in dollars
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const customerId = await getOrCreateStripeCustomer({
    userId: params.userId,
    email: params.userEmail,
    name: params.userName,
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `W-Matrix: ${params.listingTitle}`,
            description: "One-time access to alignment matrix",
          },
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId.toString(),
    metadata: {
      user_id: params.userId.toString(),
      listing_id: params.listingId.toString(),
      purchase_type: "w-matrix",
      customer_email: params.userEmail,
      customer_name: params.userName || "",
    },
    allow_promotion_codes: true,
  });

  return session.url!;
}

/**
 * Create a checkout session for subscription
 */
export async function createSubscriptionCheckout(params: {
  userId: number;
  userEmail: string;
  userName?: string;
  planId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const customerId = await getOrCreateStripeCustomer({
    userId: params.userId,
    email: params.userEmail,
    name: params.userName,
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId.toString(),
    metadata: {
      user_id: params.userId.toString(),
      plan_id: params.planId,
      customer_email: params.userEmail,
      customer_name: params.userName || "",
    },
    allow_promotion_codes: true,
  });

  return session.url!;
}

/**
 * Create a checkout session for credit top-up
 */
export async function createCreditTopUpCheckout(params: {
  userId: number;
  userEmail: string;
  userName?: string;
  amount: number; // in dollars
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const customerId = await getOrCreateStripeCustomer({
    userId: params.userId,
    email: params.userEmail,
    name: params.userName,
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Credits Top-up",
            description: "Pre-purchase credits for automated AI purchases",
          },
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId.toString(),
    metadata: {
      user_id: params.userId.toString(),
      topup_amount: params.amount.toFixed(2),
      purchase_type: "credit_topup",
      customer_email: params.userEmail,
      customer_name: params.userName || "",
    },
    allow_promotion_codes: true,
  });

  return session.url!;
}

/**
 * Create a checkout session for organization plan subscription
 */
export async function createOrgPlanCheckout(params: {
  userId: number;
  userEmail: string;
  userName?: string;
  orgId: number;
  targetTier: string;
  priceMonthly: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const customerId = await getOrCreateStripeCustomer({
    userId: params.userId,
    email: params.userEmail,
    name: params.userName,
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Awareness Network — ${params.targetTier.charAt(0).toUpperCase() + params.targetTier.slice(1)} Plan`,
            description: `AI Organization Governance — ${params.targetTier} tier`,
          },
          unit_amount: Math.round(params.priceMonthly * 100),
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId.toString(),
    metadata: {
      user_id: params.userId.toString(),
      org_id: params.orgId.toString(),
      target_tier: params.targetTier,
      purchase_type: "org_plan",
      customer_email: params.userEmail,
    },
    allow_promotion_codes: true,
  });

  return session.url!;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Reactivate a cancelled subscription
 */
export async function reactivateSubscription(subscriptionId: string): Promise<void> {
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}
