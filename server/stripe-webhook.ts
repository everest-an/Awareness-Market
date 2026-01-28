import { Request, Response } from "express";
import { stripe } from "./stripe-client";
import * as db from "./db";
import { sendEmail } from "./_core/email";
import crypto from "crypto";
import { getErrorMessage } from "./utils/error-handling";
import type Stripe from "stripe";
import { createLogger } from "./utils/logger";

// Extended Stripe Subscription type with period fields
// These exist in the Stripe API but may be missing from TypeScript definitions
interface StripeSubscriptionWithPeriod extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
}

const logger = createLogger('Stripe:Webhook');

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    logger.error("Missing signature or webhook secret");
    return res.status(400).send("Webhook Error: Missing signature");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: unknown) {
    logger.error("Signature verification failed", { error: getErrorMessage(err) });
    return res.status(400).send(`Webhook Error: ${getErrorMessage(err)}`);
  }

  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    logger.info("Test event detected, returning verification response", { eventId: event.id });
    return res.json({ verified: true });
  }

  logger.info("Webhook event received", { eventType: event.type, eventId: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        logger.warn("Unhandled event type", { eventType: event.type });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error("Error processing webhook event", { error });
    res.status(500).send("Webhook processing error");
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userIdStr = session.metadata?.user_id || session.client_reference_id || "";
  const userId = userIdStr ? parseInt(userIdStr, 10) : NaN;
  const purchaseType = session.metadata?.purchase_type;

  if (!userId || isNaN(userId)) {
    logger.error("Missing user_id in checkout session metadata", {
      sessionId: session.id,
      metadata: session.metadata
    });
    return;
  }

  if (purchaseType === "latentmas_package") {
    // Handle LatentMAS package purchase
    const packageId = session.metadata?.packageId || "";
    const creatorIdStr = session.metadata?.creatorId || "";
    const creatorId = creatorIdStr ? parseInt(creatorIdStr, 10) : NaN;

    if (!packageId) {
      logger.error("Missing packageId in session metadata", {
        sessionId: session.id,
        userId
      });
      return;
    }

    // Get package details
    const pkg = await db.getVectorPackageByPackageId(packageId);
    if (!pkg) {
      logger.error("Package not found", {
        packageId,
        sessionId: session.id,
        userId
      });
      return;
    }

    // Update purchase status
    await db.updatePackagePurchaseStatus({
      userId,
      packageId: pkg.id,
      status: 'completed',
      completedAt: new Date(),
    });

    // Increment download count
    await db.incrementPackageDownloads(pkg.id);

    logger.info("LatentMAS package purchase completed", {
      userId,
      packageId,
      amount: session.metadata?.amount
    });

    // Create notification for buyer
    await db.createNotification({
      userId,
      type: "transaction",
      title: "Purchase Successful",
      message: `Your LatentMAS package "${pkg.name}" purchase has been completed successfully`,
      relatedEntityId: pkg.id,
    });

    // Send email to buyer
    const user = await db.getUserById(userId);
    if (user?.email) {
      const emailText = `Your purchase of "${pkg.name}" was successful. You can now download this package from your dashboard.`;
      await sendEmail({
        to: user.email,
        subject: "Awareness Market - Package Purchase Successful",
        html: `<p>${emailText}</p><p><a href="${process.env.BASE_URL}/packages/${packageId}">View Package</a></p>`,
        text: emailText,
      });
    }

    // Notify creator if valid
    if (!isNaN(creatorId) && creatorId > 0) {
      const creator = await db.getUserById(creatorId);
      if (creator) {
        await db.createNotification({
          userId: creatorId,
          type: "transaction",
          title: "New Package Sale",
          message: `${user?.name || "Someone"} purchased your LatentMAS package "${pkg.name}"`,
          relatedEntityId: pkg.id,
        });

        if (creator.email) {
          const earnings = session.metadata?.creatorEarnings || "0";
          const emailText = `Great news! ${user?.name || "A user"} just purchased your LatentMAS package "${pkg.name}". You earned $${earnings}.`;
          await sendEmail({
            to: creator.email,
            subject: "Awareness Market - New Package Sale",
            html: `<p>${emailText}</p>`,
            text: emailText,
          });
        }
      }
    }
  } else if (purchaseType === "vector") {
    // Handle one-time vector purchase
    const vectorIdStr = session.metadata?.vector_id || "";
    const transactionIdStr = session.metadata?.transaction_id || "";
    const vectorId = vectorIdStr ? parseInt(vectorIdStr, 10) : NaN;
    const transactionId = transactionIdStr ? parseInt(transactionIdStr, 10) : NaN;

    if (!vectorId || isNaN(vectorId)) {
      logger.error("Missing vector_id in session metadata", {
        sessionId: session.id,
        userId
      });
      return;
    }

    if (!transactionId || isNaN(transactionId)) {
      logger.error("Missing transaction_id in session metadata", {
        sessionId: session.id,
        userId,
        vectorId
      });
      return;
    }

    const transaction = await db.getTransactionById(transactionId);
    if (!transaction) {
      logger.error("Transaction not found", {
        transactionId,
        sessionId: session.id,
        userId
      });
      return;
    }

    if (transaction.status === "completed") {
      return;
    }

    const vector = await db.getLatentVectorById(vectorId);
    if (!vector) {
      logger.error("Vector not found", {
        vectorId,
        transactionId,
        userId
      });
      return;
    }

    // Extract payment intent ID (can be string or PaymentIntent object)
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

    await db.updateTransactionPaymentInfo({
      id: transactionId,
      status: "completed",
      stripePaymentIntentId: paymentIntentId,
    });

    const accessToken = crypto.randomUUID().replace(/-/g, "");
    await db.createAccessPermission({
      userId,
      vectorId,
      transactionId,
      accessToken,
      isActive: true,
    });

    await db.incrementVectorStats(vectorId, parseFloat(transaction.creatorEarnings));

    // Transaction should already be created by the purchase API
    // Just update the payment intent ID
    logger.info("Vector purchase completed", {
      userId,
      vectorId,
      transactionId,
      amount: transaction.amount
    });
    
    // Create notification
    await db.createNotification({
      userId,
      type: "transaction",
      title: "Purchase Successful",
      message: "Your AI capability purchase has been completed successfully",
      relatedEntityId: transactionId,
    });

    // Send email
    const user = await db.getUserById(userId);
    if (user?.email) {
      const emailText = `Your purchase of vector #${vectorId} was successful. You can now access this capability in your dashboard.`;
      await sendEmail({
        to: user.email,
        subject: "Awareness Market - Purchase Successful",
        html: `<p>${emailText}</p>`,
        text: emailText,
      });
    }

    const creator = await db.getUserById(vector.creatorId);
    if (creator) {
      await db.createNotification({
        userId: vector.creatorId,
        type: "transaction",
        title: "New Purchase",
        message: `${user?.name || "Someone"} purchased your AI capability "${vector.title}"`,
        relatedEntityId: transactionId,
      });

      if (creator.email) {
        const emailText = `Great news! ${user?.name || "A user"} just purchased your AI capability "${vector.title}". You earned $${parseFloat(transaction.creatorEarnings).toFixed(2)}.`;
        await sendEmail({
          to: creator.email,
          subject: "Awareness Market - New Sale",
          html: `<p>${emailText}</p>`,
          text: emailText,
        });
      }
    }
  } else if (purchaseType === "w-matrix") {
    // Handle W-Matrix purchase
    const listingIdStr = session.metadata?.listing_id || "";
    const listingId = listingIdStr ? parseInt(listingIdStr, 10) : NaN;

    if (!listingId || isNaN(listingId)) {
      logger.error("Missing listing_id in session metadata", {
        sessionId: session.id,
        userId
      });
      return;
    }

    // Get listing details
    const dbModule = await import('./db');
    const db = await dbModule.getDb();
    const { wMatrixListings, wMatrixPurchases } = await import('../drizzle/schema');
    const { eq, sql, and } = await import('drizzle-orm');

    const [listing] = await db
      .select()
      .from(wMatrixListings)
      .where(eq(wMatrixListings.id, listingId));

    if (!listing) {
      logger.error("W-Matrix listing not found", {
        listingId,
        sessionId: session.id,
        userId
      });
      return;
    }

    // Check if purchase already exists
    const [existingPurchase] = await db
      .select()
      .from(wMatrixPurchases)
      .where(
        and(
          eq(wMatrixPurchases.listingId, listingId),
          eq(wMatrixPurchases.buyerId, userId),
          eq(wMatrixPurchases.status, "completed")
        )
      );

    if (existingPurchase) {
      logger.info("W-Matrix already purchased", {
        userId,
        listingId,
        purchaseId: existingPurchase.id
      });
      return;
    }

    // Extract payment intent ID
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

    // Create or update purchase record
    await db.insert(wMatrixPurchases).values({
      listingId,
      buyerId: userId,
      price: listing.price,
      stripePaymentIntentId: paymentIntentId,
      status: "completed",
    });

    // Update listing stats
    await db
      .update(wMatrixListings)
      .set({
        totalSales: sql`${wMatrixListings.totalSales} + 1`,
        totalRevenue: sql`${wMatrixListings.totalRevenue} + ${listing.price}`,
      })
      .where(eq(wMatrixListings.id, listingId));

    logger.info("W-Matrix purchase completed", {
      userId,
      listingId,
      amount: listing.price
    });

    // Create notification for buyer
    await dbModule.createNotification({
      userId,
      type: "transaction",
      title: "W-Matrix Purchase Successful",
      message: `Your W-Matrix "${listing.title}" purchase has been completed successfully`,
      relatedEntityId: listingId,
    });

    // Send email to buyer
    const user = await dbModule.getUserById(userId);
    if (user?.email) {
      const emailText = `Your purchase of W-Matrix "${listing.title}" (${listing.sourceModel} → ${listing.targetModel}) was successful. You can now download and use this alignment matrix.`;
      await sendEmail({
        to: user.email,
        subject: "Awareness Market - W-Matrix Purchase Successful",
        html: `<p>${emailText}</p><p><a href="${process.env.BASE_URL}/w-matrix/${listingId}">View W-Matrix</a></p>`,
        text: emailText,
      });
    }

    // Notify seller
    const seller = await dbModule.getUserById(listing.sellerId);
    if (seller) {
      const platformFeeRate = 0.15; // 15%
      const sellerEarnings = parseFloat(listing.price) * (1 - platformFeeRate);

      await dbModule.createNotification({
        userId: listing.sellerId,
        type: "transaction",
        title: "New W-Matrix Sale",
        message: `${user?.name || "Someone"} purchased your W-Matrix "${listing.title}"`,
        relatedEntityId: listingId,
      });

      if (seller.email) {
        const emailText = `Great news! ${user?.name || "A user"} just purchased your W-Matrix "${listing.title}" (${listing.sourceModel} → ${listing.targetModel}). You earned $${sellerEarnings.toFixed(2)}.`;
        await sendEmail({
          to: seller.email,
          subject: "Awareness Market - New W-Matrix Sale",
          html: `<p>${emailText}</p>`,
          text: emailText,
        });
      }
    }
  } else if (session.mode === "subscription") {
    // Handle subscription purchase
    const subscriptionId = session.subscription;
    logger.info("Subscription created", {
      userId,
      subscriptionId,
      sessionId: session.id
    });

    // Subscription will be handled by subscription.created event
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subscriptionWithPeriod = subscription as StripeSubscriptionWithPeriod;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const status = subscription.status;

  // Get user by customer ID
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || customer.deleted) {
    logger.error("Customer not found", {
      customerId,
      subscriptionId: subscription.id
    });
    return;
  }

  const userIdStr = (customer as Stripe.Customer).metadata?.user_id || "";
  const userId = userIdStr ? parseInt(userIdStr, 10) : NaN;
  if (!userId || isNaN(userId)) {
    logger.error("Missing user_id in customer metadata", {
      customerId,
      subscriptionId: subscription.id
    });
    return;
  }

  // Get or create subscription plan
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    logger.error("Missing price ID in subscription", {
      subscriptionId: subscription.id,
      userId
    });
    return;
  }

  // Find matching plan in database
  const plans = await db.getSubscriptionPlans();
  const matchingPlan = plans.find(
    p => p.stripePriceId === priceId
  );

  if (!matchingPlan) {
    logger.error("No matching plan found for price", {
      priceId,
      subscriptionId: subscription.id,
      userId
    });
    return;
  }

  // Check if subscription already exists
  const existingSub = await db.getUserSubscription(userId);

  const subscriptionData = {
    userId,
    planId: matchingPlan.id,
    stripeSubscriptionId: subscription.id,
    status: status === "active" ? "active" as const :
            status === "past_due" ? "past_due" as const :
            status === "canceled" ? "cancelled" as const : "expired" as const,
    currentPeriodStart: new Date(subscriptionWithPeriod.current_period_start * 1000),
    currentPeriodEnd: new Date(subscriptionWithPeriod.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
  };

  if (existingSub) {
    await db.updateUserSubscription(existingSub.id, subscriptionData);
  } else {
    await db.createUserSubscription(subscriptionData);
  }

  logger.info("Subscription updated", {
    userId,
    subscriptionId: subscription.id,
    status,
    planId: matchingPlan.id
  });

  // Create notification
  await db.createNotification({
    userId,
    type: "subscription",
    title: "Subscription Updated",
    message: `Your subscription status is now: ${status}`,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Find subscription in database
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || customer.deleted) return;

  const userIdStr = (customer as Stripe.Customer).metadata?.user_id || "";
  const userId = userIdStr ? parseInt(userIdStr, 10) : NaN;
  if (!userId || isNaN(userId)) return;

  const existingSub = await db.getUserSubscription(userId);
  if (existingSub) {
    await db.updateUserSubscription(existingSub.id, {
      status: "cancelled",
      cancelAtPeriodEnd: true,
    });

    logger.info("Subscription deleted", {
      userId,
      subscriptionId: subscription.id
    });

    // Create notification
    await db.createNotification({
      userId,
      type: "subscription",
      title: "Subscription Cancelled",
      message: "Your subscription has been cancelled",
    });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  logger.info("Invoice paid", {
    invoiceId: invoice.id,
    amount: invoice.amount_paid,
    currency: invoice.currency
  });
  // Additional invoice handling if needed
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || "";
  if (!customerId) return;

  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || customer.deleted) return;

  const userIdStr = (customer as Stripe.Customer).metadata?.user_id || "";
  const userId = userIdStr ? parseInt(userIdStr, 10) : NaN;
  if (!userId || isNaN(userId)) return;

  logger.warn('Invoice payment failed', {
    userId,
    invoiceId: invoice.id,
    amountDue: invoice.amount_due,
    currency: invoice.currency
  });

  // Create notification
  await db.createNotification({
    userId,
    type: "subscription",
    title: "Payment Failed",
    message: "Your recent payment failed. Please update your payment method.",
  });
}
