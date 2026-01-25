import { Request, Response } from "express";
import { stripe } from "./stripe-client";
import * as db from "./db";
import { sendEmail } from "./_core/email";
import crypto from "crypto";

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[Webhook] Missing signature or secret");
    return res.status(400).send("Webhook Error: Missing signature");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing event:", error);
    res.status(500).send("Webhook processing error");
  }
}

async function handleCheckoutCompleted(session: any) {
  const userId = parseInt(session.metadata?.user_id || session.client_reference_id);
  const purchaseType = session.metadata?.purchase_type;

  if (!userId) {
    console.error("[Webhook] Missing user_id in session metadata");
    return;
  }

  if (purchaseType === "vector") {
    // Handle one-time vector purchase
    const vectorId = parseInt(session.metadata?.vector_id);
    const transactionId = parseInt(session.metadata?.transaction_id);
    if (!vectorId) {
      console.error("[Webhook] Missing vector_id in session metadata");
      return;
    }

    if (!transactionId) {
      console.error("[Webhook] Missing transaction_id in session metadata");
      return;
    }

    const transaction = await db.getTransactionById(transactionId);
    if (!transaction) {
      console.error("[Webhook] Transaction not found:", transactionId);
      return;
    }

    if (transaction.status === "completed") {
      return;
    }

    const vector = await db.getLatentVectorById(vectorId);
    if (!vector) {
      console.error("[Webhook] Vector not found:", vectorId);
      return;
    }

    await db.updateTransactionPaymentInfo({
      id: transactionId,
      status: "completed",
      stripePaymentIntentId: session.payment_intent || null,
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
    console.log(`[Webhook] Vector purchase completed for user ${userId}, vector ${vectorId}`);
    
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
  } else if (session.mode === "subscription") {
    // Handle subscription purchase
    const subscriptionId = session.subscription;
    console.log(`[Webhook] Subscription created for user ${userId}: ${subscriptionId}`);
    
    // Subscription will be handled by subscription.created event
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  // Get user by customer ID
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || customer.deleted) {
    console.error("[Webhook] Customer not found:", customerId);
    return;
  }

  const userId = parseInt((customer as any).metadata?.user_id);
  if (!userId) {
    console.error("[Webhook] Missing user_id in customer metadata");
    return;
  }

  // Get or create subscription plan
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    console.error("[Webhook] Missing price ID in subscription");
    return;
  }

  // Find matching plan in database
  const plans = await db.getSubscriptionPlans();
  const matchingPlan = plans.find(
    p => p.stripePriceId === priceId
  );

  if (!matchingPlan) {
    console.error("[Webhook] No matching plan found for price:", priceId);
    return;
  }

  // Check if subscription already exists
  const existingSub = await db.getUserSubscription(userId);

  const subscriptionData = {
    userId,
    planId: matchingPlan.id,
    stripeSubscriptionId: subscriptionId,
    status: status === "active" ? "active" as const : 
            status === "past_due" ? "past_due" as const :
            status === "canceled" ? "cancelled" as const : "expired" as const,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
  };

  if (existingSub) {
    await db.updateUserSubscription(existingSub.id, subscriptionData);
  } else {
    await db.createUserSubscription(subscriptionData);
  }

  console.log(`[Webhook] Subscription updated for user ${userId}: ${status}`);
  
  // Create notification
  await db.createNotification({
    userId,
    type: "subscription",
    title: "Subscription Updated",
    message: `Your subscription status is now: ${status}`,
  });
}

async function handleSubscriptionDeleted(subscription: any) {
  const subscriptionId = subscription.id;

  // Find subscription in database
  const customerId = subscription.customer;
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || customer.deleted) return;

  const userId = parseInt((customer as any).metadata?.user_id);
  if (!userId) return;

  const existingSub = await db.getUserSubscription(userId);
  if (existingSub) {
    await db.updateUserSubscription(existingSub.id, {
      status: "cancelled",
      cancelAtPeriodEnd: true,
    });

    console.log(`[Webhook] Subscription deleted for user ${userId}`);
    
    // Create notification
    await db.createNotification({
      userId,
      type: "subscription",
      title: "Subscription Cancelled",
      message: "Your subscription has been cancelled",
    });
  }
}

async function handleInvoicePaid(invoice: any) {
  console.log(`[Webhook] Invoice paid: ${invoice.id}`);
  // Additional invoice handling if needed
}

async function handleInvoicePaymentFailed(invoice: any) {
  const customerId = invoice.customer;
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || customer.deleted) return;

  const userId = parseInt((customer as any).metadata?.user_id);
  if (!userId) return;

  console.log(`[Webhook] Invoice payment failed for user ${userId}`);
  
  // Create notification
  await db.createNotification({
    userId,
    type: "subscription",
    title: "Payment Failed",
    message: "Your recent payment failed. Please update your payment method.",
  });
}
