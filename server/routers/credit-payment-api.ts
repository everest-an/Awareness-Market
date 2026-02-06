/**
 * Credit Payment API
 *
 * Production-ready credit-based payment system for AI agents.
 * Enables instant, automated purchases without payment processing delays.
 *
 * Features:
 * - Pre-purchase credits via Stripe/Crypto
 * - Instant automated purchases
 * - Transaction history and balance tracking
 * - Refund support
 * - No PCI compliance required
 *
 * Pricing: 1 credit = $1 USD
 */

import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { createLogger } from '../utils/logger';
import { createCreditTopUpCheckout } from '../stripe-client';
import { createStablecoinPaymentClient } from '../blockchain/token-system';
import { ethers } from 'ethers';
import {
  purchaseWithCredits,
  getCreditBalance,
  topUpCredits,
  refundCredits,
} from '../utils/credit-payment-system';
import { prisma } from '../db-prisma';

const logger = createLogger('CreditPayment:API');

export const creditPaymentRouter = router({
  /**
   * Get current credit balance and recent transactions
   */
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const result = await getCreditBalance(ctx.user.id);

    return {
      success: true,
      balance: result.balance,
      transactions: result.transactions,
    };
  }),

  /**
   * Purchase package using credits
   *
   * Example usage:
   * ```typescript
   * const result = await trpc.creditPayment.purchaseWithCredits.mutate({
   *   packageType: 'vector',
   *   packageId: 'vec_123456',
   * });
   * console.log(result.creditsRemaining); // Check remaining balance
   * ```
   */
  purchaseWithCredits: protectedProcedure
    .input(
      z.object({
        packageType: z.enum(['vector', 'memory', 'chain']),
        packageId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      logger.info('[Purchase] Attempting credit purchase', {
        userId: ctx.user.id,
        packageType: input.packageType,
        packageId: input.packageId,
      });

      // Get package details
      let pkg: any = null;
      if (input.packageType === 'vector') {
        pkg = await prisma.vectorPackage.findUnique({
          where: { packageId: input.packageId },
        });
      } else if (input.packageType === 'memory') {
        pkg = await prisma.memoryPackage.findUnique({
          where: { packageId: input.packageId },
        });
      } else if (input.packageType === 'chain') {
        pkg = await prisma.chainPackage.findUnique({
          where: { packageId: input.packageId },
        });
      }

      if (!pkg) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Package not found',
        });
      }

      const price = parseFloat(pkg.price);

      // Execute credit purchase
      const result = await purchaseWithCredits({
        userId: ctx.user.id,
        amount: price,
        packageType: input.packageType,
        packageId: input.packageId,
        metadata: {
          packageName: pkg.name,
          packageDescription: pkg.description,
        },
      });

      logger.info('[Purchase] Success', {
        userId: ctx.user.id,
        packageId: input.packageId,
        amount: price,
        remainingBalance: result.remainingBalance,
      });

      return {
        success: true,
        purchaseId: result.purchaseId,
        transactionId: result.transactionId,
        creditsSpent: price,
        creditsRemaining: result.remainingBalance,
        message: `Successfully purchased ${input.packageType} package using ${price} credits. ${result.remainingBalance} credits remaining.`,
      };
    }),

  /**
   * Top up credits (called after successful Stripe/crypto payment)
   *
   * Note: This should be called from a webhook handler after payment confirmation,
   * not directly from the frontend.
   *
   * Example usage from Stripe webhook:
   * ```typescript
   * stripe.webhooks.onCheckoutComplete(async (session) => {
   *   await topUpCreditsInternal({
   *     userId: session.metadata.userId,
   *     amount: session.amount_total / 100, // Convert cents to dollars
   *     paymentMethod: 'stripe',
   *     paymentId: session.payment_intent,
   *   });
   * });
   * ```
   */
  topUpCreditsInternal: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive().max(10000), // Max $10,000 per top-up
        paymentMethod: z.enum(['stripe', 'crypto']),
        paymentId: z.string(), // Stripe payment intent ID or crypto tx hash
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      logger.info('[Top-up] Processing credit top-up', {
        userId: ctx.user.id,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
      });

      await topUpCredits({
        userId: ctx.user.id,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        paymentId: input.paymentId,
        metadata: input.metadata,
      });

      const balance = await getCreditBalance(ctx.user.id);

      logger.info('[Top-up] Success', {
        userId: ctx.user.id,
        amount: input.amount,
        newBalance: balance.balance,
      });

      return {
        success: true,
        creditsAdded: input.amount,
        newBalance: balance.balance,
        message: `Successfully added ${input.amount} credits. New balance: ${balance.balance} credits.`,
      };
    }),

  /**
   * Create Stripe checkout session for credit top-up
   *
   * Frontend flow:
   * 1. Call this endpoint to get checkout URL
   * 2. Redirect user to Stripe checkout
   * 3. Stripe webhook calls topUpCreditsInternal after payment
   * 4. User returns to success page with updated balance
   */
  createTopUpCheckout: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive().max(10000),
        successUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      logger.info('[Checkout] Creating Stripe checkout session', {
        userId: ctx.user.id,
        amount: input.amount,
      });

      const checkoutUrl = await createCreditTopUpCheckout({
        userId: ctx.user.id,
        userEmail: ctx.user.email || `user-${ctx.user.id}@placeholder.local`,
        userName: ctx.user.name || undefined,
        amount: input.amount,
        successUrl: input.successUrl || `${process.env.CLIENT_URL || 'http://localhost:5173'}/credits/success`,
        cancelUrl: input.cancelUrl || `${process.env.CLIENT_URL || 'http://localhost:5173'}/credits/cancelled`,
      });

      return {
        success: true,
        checkoutUrl,
        message: 'Redirect user to this URL to complete payment',
      };
    }),

  /**
   * Get stablecoin top-up quote (USDC/USDT)
   */
  getStablecoinQuote: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive().max(10000),
        tokenSymbol: z.enum(['USDC', 'USDT']),
      })
    )
    .query(async ({ input }) => {
      const client = createStablecoinPaymentClient();
      const tokenAddress = input.tokenSymbol === 'USDC'
        ? client.getUSDCAddress()
        : client.getUSDTAddress();

      const tokenAmount = await client.getTokenAmount(input.amount, tokenAddress);
      const paymentAddress = process.env.STABLECOIN_PAYMENT_ADDRESS || '';

      return {
        success: true,
        amountUSD: input.amount,
        tokenSymbol: input.tokenSymbol,
        tokenAddress,
        tokenAmount,
        paymentAddress,
        network: process.env.BLOCKCHAIN_NETWORK || 'amoy',
        decimals: 6,
      };
    }),

  /**
   * Confirm stablecoin top-up via transaction hash
   */
  confirmStablecoinTopUp: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive().max(10000),
        tokenSymbol: z.enum(['USDC', 'USDT']),
        txHash: z.string().min(10),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.POLYGON_RPC_URL || '';
      const paymentAddress = (process.env.STABLECOIN_PAYMENT_ADDRESS || '').toLowerCase();

      if (!rpcUrl || !paymentAddress) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Stablecoin payment system is not configured',
        });
      }

      const client = createStablecoinPaymentClient();
      const tokenAddress = (input.tokenSymbol === 'USDC'
        ? client.getUSDCAddress()
        : client.getUSDTAddress()).toLowerCase();

      const expectedTokenAmount = await client.getTokenAmount(input.amount, tokenAddress);
      const expectedWei = ethers.parseUnits(expectedTokenAmount, 6);

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(input.txHash);

      if (!receipt || receipt.status !== 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transaction not confirmed or failed',
        });
      }

      const iface = new ethers.Interface([
        'event Transfer(address indexed from, address indexed to, uint256 value)',
      ]);

      let totalReceived = 0n;
      let fromAddress: string | null = null;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== tokenAddress) continue;
        try {
          const parsed = iface.parseLog({ topics: log.topics, data: log.data });
          if (parsed?.name !== 'Transfer') continue;
          const to = String(parsed.args.to).toLowerCase();
          if (to !== paymentAddress) continue;
          const value = BigInt(parsed.args.value.toString());
          totalReceived += value;
          if (!fromAddress) fromAddress = String(parsed.args.from);
        } catch {
          // Ignore non-Transfer logs
        }
      }

      if (totalReceived < expectedWei) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Insufficient stablecoin transfer amount',
        });
      }

      await topUpCredits({
        userId: ctx.user.id,
        amount: input.amount,
        paymentMethod: 'crypto',
        paymentId: input.txHash,
        metadata: {
          tokenSymbol: input.tokenSymbol,
          tokenAddress,
          expectedTokenAmount,
          receivedTokenAmount: ethers.formatUnits(totalReceived, 6),
          fromAddress,
          paymentAddress,
          network: process.env.BLOCKCHAIN_NETWORK || 'amoy',
        },
      });

      return {
        success: true,
        creditsAdded: input.amount,
        tokenSymbol: input.tokenSymbol,
        receivedTokenAmount: ethers.formatUnits(totalReceived, 6),
        txHash: input.txHash,
      };
    }),

  /**
   * Get transaction history
   */
  getTransactions: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const transactions = await prisma.creditTransaction.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        skip: input.offset,
      });

      return {
        success: true,
        transactions: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          balanceAfter: Number(t.balanceAfter),
          description: t.description,
          createdAt: t.createdAt,
          metadata: t.metadata ? JSON.parse(t.metadata) : null,
        })),
        total: transactions.length,
      };
    }),

  /**
   * Request refund (admin only or within refund period)
   *
   * This endpoint should have additional authorization checks in production.
   */
  requestRefund: protectedProcedure
    .input(
      z.object({
        transactionId: z.number(),
        reason: z.string().min(10).max(500),
      })
    )
    .mutation(async ({ input, ctx }) => {
      logger.info('[Refund] Refund requested', {
        userId: ctx.user.id,
        transactionId: input.transactionId,
        reason: input.reason,
      });

      // Get transaction details
      const transaction = await prisma.creditTransaction.findUnique({
        where: { id: input.transactionId },
      });

      if (!transaction) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        });
      }

      if (transaction.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only request refunds for your own transactions',
        });
      }

      if (transaction.type !== 'debit') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only refund debit transactions (purchases)',
        });
      }

      // Check if refund period expired (7 days)
      const transactionAge = Date.now() - transaction.createdAt.getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      if (transactionAge > sevenDays) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Refund period expired. Refunds are only available within 7 days of purchase.',
        });
      }

      // Process refund
      await refundCredits({
        userId: ctx.user.id,
        amount: Number(transaction.amount),
        reason: input.reason,
        metadata: {
          originalTransactionId: transaction.id,
          requestedAt: new Date().toISOString(),
        },
      });

      logger.info('[Refund] Refund completed', {
        userId: ctx.user.id,
        transactionId: input.transactionId,
        amount: Number(transaction.amount),
      });

      return {
        success: true,
        refundedAmount: Number(transaction.amount),
        message: `Refund of ${transaction.amount} credits processed successfully`,
      };
    }),

  /**
   * Get credit pricing info
   */
  getPricing: publicProcedure.query(async () => {
    return {
      success: true,
      pricing: {
        baseRate: 1.0, // $1 = 1 credit
        currency: 'USD',
        minimumTopUp: 10, // $10 minimum
        maximumTopUp: 10000, // $10,000 maximum
        bonuses: [
          {
            threshold: 100,
            bonus: 5, // 5% bonus for $100+ top-ups
            description: '5% bonus for top-ups of $100 or more',
          },
          {
            threshold: 500,
            bonus: 10, // 10% bonus for $500+ top-ups
            description: '10% bonus for top-ups of $500 or more',
          },
          {
            threshold: 1000,
            bonus: 15, // 15% bonus for $1000+ top-ups
            description: '15% bonus for top-ups of $1000 or more',
          },
        ],
      },
      refundPolicy: {
        periodDays: 7,
        description: 'Full refund available within 7 days of purchase',
      },
    };
  }),
});
