/**
 * Credit-Based Payment System for AI Agents
 *
 * Allows AI agents to:
 * 1. Pre-purchase credits (via Stripe/Crypto)
 * 2. Use credits for automated package purchases
 * 3. Track credit balance and transaction history
 *
 * Benefits:
 * - No PCI compliance required
 * - Enables programmatic purchases
 * - Simple, predictable pricing
 * - Low transaction overhead
 */

import { prisma } from '../db-prisma';
import { createLogger } from './logger';
import { TRPCError } from '@trpc/server';

const logger = createLogger('CreditPayment');

// ============================================================================
// Types
// ============================================================================

export interface PurchaseWithCreditsParams {
  userId: number;
  amount: number; // Credit amount to deduct
  packageType: 'vector' | 'memory' | 'chain';
  packageId: string;
  metadata?: Record<string, unknown>;
}

export interface PurchaseWithCreditsResult {
  success: boolean;
  transactionId: number;
  remainingBalance: number;
  purchaseId: number;
}

export interface CreditTopUpParams {
  userId: number;
  amount: number; // Credits to add
  paymentMethod: 'stripe' | 'crypto';
  paymentId: string; // Stripe payment intent ID or crypto transaction hash
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Credit Payment Functions
// ============================================================================

/**
 * Purchase a package using credits
 * Atomic transaction ensures credits are deducted only if purchase succeeds
 */
export async function purchaseWithCredits(
  params: PurchaseWithCreditsParams
): Promise<PurchaseWithCreditsResult> {
  const { userId, amount, packageType, packageId, metadata } = params;

  logger.info('[Credit Purchase] Starting purchase', {
    userId,
    amount,
    packageType,
    packageId,
  });

  // Step 1: Check user's credit balance
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  });

  if (!user) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'User not found',
    });
  }

  const balance = Number(user.creditsBalance || 0);

  if (balance < amount) {
    logger.warn('[Credit Purchase] Insufficient credits', {
      userId,
      required: amount,
      balance,
    });

    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Insufficient credits. Required: ${amount}, Available: ${balance}. Please top up your account.`,
      cause: {
        type: 'INSUFFICIENT_CREDITS',
        required: amount,
        available: balance,
        deficit: amount - balance,
      },
    });
  }

  // Step 2: Get package details and verify it exists
  let pkg: any = null;
  if (packageType === 'vector') {
    pkg = await prisma.vectorPackage.findUnique({
      where: { packageId },
    });
  } else if (packageType === 'memory') {
    pkg = await prisma.memoryPackage.findUnique({
      where: { packageId },
    });
  } else if (packageType === 'chain') {
    pkg = await prisma.chainPackage.findUnique({
      where: { packageId },
    });
  }

  if (!pkg) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Package not found',
    });
  }

  // Step 3: Verify price matches
  const packagePrice = parseFloat(pkg.price);
  if (Math.abs(packagePrice - amount) > 0.01) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Price mismatch. Expected: ${packagePrice} credits, provided: ${amount} credits`,
    });
  }

  // Step 4: Check if already purchased
  const existingPurchase = await prisma.packagePurchase.findFirst({
    where: {
      buyerId: userId,
      packageId,
      packageType,
    },
  });

  if (existingPurchase) {
    logger.info('[Credit Purchase] Package already purchased', {
      userId,
      packageId,
      purchaseId: existingPurchase.id,
    });

    return {
      success: true,
      transactionId: 0, // No new transaction
      remainingBalance: balance,
      purchaseId: existingPurchase.id,
    };
  }

  // Step 5: Execute atomic transaction (deduct credits + create purchase)
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Deduct credits
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditsBalance: { decrement: amount },
        },
        select: { creditsBalance: true },
      });

      // Record credit transaction
      const creditTransaction = await (tx as any).creditTransaction.create({
        data: {
          userId,
          type: 'debit',
          amount,
          balanceAfter: Number(updatedUser.creditsBalance),
          description: `Purchase: ${packageType} package ${packageId}`,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      // Calculate fees (10% platform fee)
      const platformFee = (amount * 0.1).toFixed(2);
      const sellerEarnings = (amount * 0.9).toFixed(2);

      // Create purchase record
      const purchase = await tx.packagePurchase.create({
        data: {
          buyerId: userId,
          sellerId: pkg.userId,
          packageId,
          packageType,
          price: amount.toFixed(2),
          platformFee,
          sellerEarnings,
          status: 'completed',
        } as any,
      });

      // Credit seller's account
      await tx.user.update({
        where: { id: pkg.userId },
        data: {
          creditsBalance: { increment: parseFloat(sellerEarnings) },
        },
      });

      // Record seller's credit income
      await (tx as any).creditTransaction.create({
        data: {
          userId: pkg.userId,
          type: 'credit',
          amount: parseFloat(sellerEarnings),
          balanceAfter: 0, // Will be updated by trigger/application logic
          description: `Sale: ${packageType} package ${packageId}`,
          metadata: JSON.stringify({ buyerId: userId }),
        },
      });

      return {
        transactionId: creditTransaction.id,
        remainingBalance: Number(updatedUser.creditsBalance),
        purchaseId: purchase.id,
      };
    });

    logger.info('[Credit Purchase] Success', {
      userId,
      packageId,
      amount,
      transactionId: result.transactionId,
      remainingBalance: result.remainingBalance,
    });

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    logger.error('[Credit Purchase] Transaction failed', {
      userId,
      packageId,
      error,
    });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to complete purchase. Please try again.',
    });
  }
}

/**
 * Top up user's credit balance
 * Called after successful Stripe payment or crypto transaction
 */
export async function topUpCredits(params: CreditTopUpParams): Promise<void> {
  const { userId, amount, paymentMethod, paymentId, metadata } = params;

  logger.info('[Credit Top-up] Processing top-up', {
    userId,
    amount,
    paymentMethod,
    paymentId,
  });

  try {
    // Atomic transaction
    await prisma.$transaction(async (tx) => {
      // Add credits to user's balance
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditsBalance: { increment: amount },
        },
        select: { creditsBalance: true },
      });

      // Record transaction
      await (tx as any).creditTransaction.create({
        data: {
          userId,
          type: 'credit',
          amount,
          balanceAfter: Number(updatedUser.creditsBalance),
          description: `Top-up via ${paymentMethod}`,
          metadata: JSON.stringify({
            paymentMethod,
            paymentId,
            ...metadata,
          }),
        },
      });

      logger.info('[Credit Top-up] Success', {
        userId,
        amount,
        newBalance: Number(updatedUser.creditsBalance),
      });
    });
  } catch (error) {
    logger.error('[Credit Top-up] Failed', {
      userId,
      amount,
      error,
    });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to process credit top-up',
    });
  }
}

/**
 * Get user's credit balance and recent transactions
 */
export async function getCreditBalance(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsBalance: true },
  });

  const recentTransactions = await (prisma as any).creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return {
    balance: Number(user?.creditsBalance || 0),
    transactions: recentTransactions.map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      description: t.description,
      createdAt: t.createdAt,
      metadata: t.metadata ? JSON.parse(t.metadata) : null,
    })),
  };
}

/**
 * Refund credits (e.g., for failed purchases, quality issues)
 */
export async function refundCredits(params: {
  userId: number;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { userId, amount, reason, metadata } = params;

  logger.info('[Credit Refund] Processing refund', {
    userId,
    amount,
    reason,
  });

  await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        creditsBalance: { increment: amount },
      },
      select: { creditsBalance: true },
    });

    await (tx as any).creditTransaction.create({
      data: {
        userId,
        type: 'credit',
        amount,
        balanceAfter: Number(updatedUser.creditsBalance),
        description: `Refund: ${reason}`,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    logger.info('[Credit Refund] Success', {
      userId,
      amount,
      newBalance: Number(updatedUser.creditsBalance),
    });
  });
}
