/**
 * Stablecoin Payment API Router
 *
 * tRPC endpoints for stablecoin (USDC/USDT) payments on Avalanche C-Chain.
 *
 * Two payment modes:
 *
 * 1. CUSTODY MODE  — AI agents: server holds and signs with the agent wallet.
 *    Endpoints: getWallet, getBalance, getQuote, agentPurchase,
 *               agentDeposit, agentWithdraw, agentTransactions, updateLimits
 *
 * 2. DIRECT MODE   — Human users: user signs in MetaMask, server verifies
 *    the on-chain receipt and grants download access.
 *    Endpoints: verifyPurchase
 *
 * Shared: getInfo
 */

import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ethers } from 'ethers';
import { createLogger } from '../utils/logger';
import {
  getOrCreateAgentWallet,
  getAgentWalletBalance,
  getAgentSigner,
  checkSpendingLimits,
  recordAgentTransaction,
  getAgentTransactionHistory,
  updateSpendingLimits,
  deactivateAgentWallet,
} from '../blockchain/agent-wallet';
import {
  AVALANCHE_CHAIN_ID,
  STABLECOIN_ADDRESSES,
  PAYMENT_CONTRACT_ADDRESS,
  PLATFORM_FEE_RATE,
  PLATFORM_FEE_BPS,
  ERC20_ABI,
  PAYMENT_ABI,
  STABLECOIN_DECIMALS,
  QUOTE_TTL_SECONDS,
  EXPLORER_BASE_URL,
} from '../blockchain/constants';
import { resolvePackageSeller } from '../services/package-service';
import { prisma } from '../db-prisma';
import {
  validateApproveTarget,
  checkTransactionAnomaly,
} from '../middleware/crypto-asset-guard';

const logger = createLogger('StablecoinPayment');

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Resolve a token symbol ('USDC' | 'USDT') or raw address to its contract address.
 *
 * @param token   - Token symbol or hex address
 * @param network - 'mainnet' (default) or 'fuji'
 * @returns ERC-20 contract address
 * @throws Error for unsupported symbols
 */
function resolveTokenAddress(token: string, network: 'mainnet' | 'fuji' = 'mainnet'): string {
  const upper = token.toUpperCase();
  if (upper === 'USDC') return STABLECOIN_ADDRESSES[network].USDC;
  if (upper === 'USDT') return STABLECOIN_ADDRESSES[network].USDT;
  if (ethers.isAddress(token)) return token;
  throw new Error(`Unsupported token: ${token}. Use USDC, USDT, or a valid contract address.`);
}

/**
 * Shared Avalanche JSON-RPC provider (lazy-singleton).
 * Created once per process; reused across all router procedures.
 */
let _provider: ethers.JsonRpcProvider | null = null;
function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    const url =
      process.env.BLOCKCHAIN_RPC_URL ||
      process.env.AVALANCHE_RPC_URL ||
      'https://api.avax.network/ext/bc/C/rpc';
    _provider = new ethers.JsonRpcProvider(url);
  }
  return _provider;
}

/** Build a Snowscan transaction explorer URL */
function explorerTxUrl(txHash: string): string {
  return `${EXPLORER_BASE_URL}/tx/${txHash}`;
}

/** Build the internal download URL for a purchased package */
function downloadUrl(packageType: string, packageId: string): string {
  return `/api/ai/download-package?packageType=${packageType}&packageId=${packageId}`;
}

// ============================================================================
// Router
// ============================================================================

export const stablecoinPaymentRouter = router({

  // --------------------------------------------------------------------------
  // Agent Custody Wallet — read
  // --------------------------------------------------------------------------

  /**
   * Get or create the AI agent's custody wallet.
   * Returns public info only — private keys never leave the server.
   */
  getWallet: protectedProcedure.query(async ({ ctx }) => {
    const data = await getOrCreateAgentWallet(ctx.user.id);
    return { success: true, data };
  }),

  /**
   * Return all balances for the agent's custody wallet:
   * AVAX (gas), USDC, USDT — both in-wallet and deposited in the contract.
   */
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const data = await getAgentWalletBalance(ctx.user.id);
    return { success: true, data };
  }),

  /**
   * Get a stablecoin price quote for a package.
   *
   * Calls `getTokenAmount` on-chain so the amount reflects the exact conversion
   * the contract will use. Quotes are valid for `QUOTE_TTL_SECONDS` seconds.
   */
  getQuote: protectedProcedure
    .input(
      z.object({
        packageType: z.enum(['vector', 'memory', 'chain']),
        packageId: z.string(),
        token: z.enum(['USDC', 'USDT']).default('USDC'),
      })
    )
    .query(async ({ input }) => {
      const { sellerAddress, priceUSD } = await resolvePackageSeller(
        input.packageType,
        input.packageId
      );

      const tokenAddress = resolveTokenAddress(input.token);
      const paymentContract = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_ABI, getProvider());

      const priceCents = Math.round(priceUSD * 100);
      const tokenAmountWei = await paymentContract.getTokenAmount(priceCents, tokenAddress);
      const tokenAmount = Number(ethers.formatUnits(tokenAmountWei, STABLECOIN_DECIMALS));

      // Decompose fee using the canonical constant — no magic numbers in this file
      const platformFee = tokenAmount * PLATFORM_FEE_RATE;
      const sellerReceives = tokenAmount - platformFee;

      return {
        success: true,
        data: {
          packageId: input.packageId,
          packageType: input.packageType,
          priceUSD,
          token: input.token,
          tokenAddress,
          tokenAmount: tokenAmount.toFixed(STABLECOIN_DECIMALS),
          platformFee: platformFee.toFixed(STABLECOIN_DECIMALS),
          sellerReceives: sellerReceives.toFixed(STABLECOIN_DECIMALS),
          sellerAddress,
          contractAddress: PAYMENT_CONTRACT_ADDRESS,
          chainId: AVALANCHE_CHAIN_ID,
          expiresIn: QUOTE_TTL_SECONDS,
        },
      };
    }),

  // --------------------------------------------------------------------------
  // Agent Custody — write (autonomous on-chain transactions)
  // --------------------------------------------------------------------------

  /**
   * Execute an autonomous stablecoin purchase from the agent's custody wallet.
   *
   * Flow:
   *   1. Resolve package seller & price (single DB call via resolvePackageSeller)
   *   2. Validate spending limits + anomaly checks
   *   3. Check on-chain token balance
   *   4. Approve token spend if current allowance is insufficient
   *   5. Call `directPurchase` on the payment contract
   *   6. Record transaction for audit + create PackagePurchase for download access
   */
  agentPurchase: protectedProcedure
    .input(
      z.object({
        packageType: z.enum(['vector', 'memory', 'chain']),
        packageId: z.string(),
        token: z.enum(['USDC', 'USDT']).default('USDC'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // 1. Resolve seller — single DB round-trip returns price + sellerId + address
      const { sellerAddress, priceUSD, sellerId } = await resolvePackageSeller(
        input.packageType,
        input.packageId
      );

      if (priceUSD <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Package price is invalid' });
      }

      // 2a. Spending limits
      const limitCheck = await checkSpendingLimits(userId, priceUSD);
      if (!limitCheck.allowed) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: limitCheck.reason || 'Spending limit exceeded',
        });
      }

      // 2b. Anomaly detection — rate-limiting & token drain prevention
      const anomalyCheck = checkTransactionAnomaly(userId, 'purchase', priceUSD, input.token);
      if (!anomalyCheck.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: anomalyCheck.reason || 'Transaction blocked due to unusual activity',
        });
      }

      // 3. Get signer and resolve token details
      const signer = await getAgentSigner(userId);
      const tokenAddress = resolveTokenAddress(input.token);
      const provider = getProvider();

      const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const paymentContract = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_ABI, provider);

      const priceCents = Math.round(priceUSD * 100);
      const tokenAmountWei: bigint = await paymentContract.getTokenAmount(priceCents, tokenAddress);
      const balance: bigint = await erc20.balanceOf(signer.address);

      if (balance < tokenAmountWei) {
        const need = ethers.formatUnits(tokenAmountWei, STABLECOIN_DECIMALS);
        const have = ethers.formatUnits(balance, STABLECOIN_DECIMALS);
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Insufficient ${input.token} balance. Need ${need}, have ${have}`,
        });
      }

      // 4. Approve token spend (only if allowance is insufficient)
      const currentAllowance: bigint = await erc20.allowance(signer.address, PAYMENT_CONTRACT_ADDRESS);
      if (currentAllowance < tokenAmountWei) {
        // Whitelist check — prevents phishing contract redirect
        validateApproveTarget(PAYMENT_CONTRACT_ADDRESS, `agentPurchase:${input.packageId}`);

        logger.info('Approving token spend', {
          userId,
          token: input.token,
          amount: ethers.formatUnits(tokenAmountWei, STABLECOIN_DECIMALS),
        });

        const erc20Signed = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const approveTx = await erc20Signed.approve(PAYMENT_CONTRACT_ADDRESS, tokenAmountWei);
        await approveTx.wait();

        await recordAgentTransaction({
          userId,
          txHash: approveTx.hash,
          action: 'approve',
          token: tokenAddress,
          amountUSD: priceUSD,
          packageId: input.packageId,
        });
      }

      // 5. Execute purchase
      const paymentSigned = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_ABI, signer);

      logger.info('Executing agent stablecoin purchase', {
        userId,
        packageId: input.packageId,
        token: input.token,
        priceUSD,
        seller: sellerAddress,
      });

      const purchaseTx = await paymentSigned.directPurchase(
        input.packageId,
        input.packageType,
        tokenAddress,
        priceCents,
        sellerAddress
      );
      const receipt = await purchaseTx.wait();

      // 6. Record audit trail + grant download access
      await recordAgentTransaction({
        userId,
        txHash: receipt.hash,
        action: 'purchase',
        token: tokenAddress,
        amountUSD: priceUSD,
        packageId: input.packageId,
        details: `${input.token} directPurchase on Avalanche`,
      });

      const platformFeeAmount = priceUSD * PLATFORM_FEE_RATE;

      // Store purchase record so the buyer can download the package.
      // `blockchainTxHash` is the correct field name — the column was previously
      // mis-named `stripePaymentIntentId`, which caused semantic confusion.
      await prisma.packagePurchase.create({
        data: {
          buyerId: userId,
          sellerId,
          packageType: input.packageType,
          packageId: input.packageId,
          price: priceUSD,
          platformFee: platformFeeAmount,
          sellerEarnings: priceUSD - platformFeeAmount,
          // Field alias: stored in stripePaymentIntentId column for DB compat,
          // but semantically this is the on-chain tx hash.
          stripePaymentIntentId: receipt.hash,
          status: 'completed',
        },
      });

      logger.info('Agent stablecoin purchase completed', {
        userId,
        packageId: input.packageId,
        txHash: receipt.hash,
      });

      return {
        success: true,
        data: {
          txHash: receipt.hash,
          packageId: input.packageId,
          token: input.token,
          amountPaid: ethers.formatUnits(tokenAmountWei, STABLECOIN_DECIMALS),
          priceUSD,
          blockNumber: receipt.blockNumber,
          explorerUrl: explorerTxUrl(receipt.hash),
          downloadUrl: downloadUrl(input.packageType, input.packageId),
        },
      };
    }),

  /**
   * Deposit stablecoins from the agent's wallet into the payment contract.
   *
   * The approve + deposit steps are separate on-chain transactions.
   * An existing allowance is respected so approve is skipped if already set.
   */
  agentDeposit: protectedProcedure
    .input(
      z.object({
        token: z.enum(['USDC', 'USDT']),
        amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Invalid amount — use up to 6 decimal places'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const anomalyCheck = checkTransactionAnomaly(
        userId,
        'deposit',
        parseFloat(input.amount),
        input.token
      );
      if (!anomalyCheck.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: anomalyCheck.reason || 'Transaction blocked due to unusual activity',
        });
      }

      const signer = await getAgentSigner(userId);
      const tokenAddress = resolveTokenAddress(input.token);
      const amountWei = ethers.parseUnits(input.amount, STABLECOIN_DECIMALS);

      validateApproveTarget(PAYMENT_CONTRACT_ADDRESS, `agentDeposit:${input.token}`);

      const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const currentAllowance: bigint = await erc20.allowance(signer.address, PAYMENT_CONTRACT_ADDRESS);

      if (currentAllowance < amountWei) {
        const approveTx = await erc20.approve(PAYMENT_CONTRACT_ADDRESS, amountWei);
        await approveTx.wait();
      }

      const paymentContract = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_ABI, signer);
      const depositTx = await paymentContract.deposit(tokenAddress, amountWei);
      const receipt = await depositTx.wait();

      await recordAgentTransaction({
        userId,
        txHash: receipt.hash,
        action: 'deposit',
        token: tokenAddress,
        amountUSD: parseFloat(input.amount),
      });

      return {
        success: true,
        data: {
          txHash: receipt.hash,
          token: input.token,
          amount: input.amount,
          explorerUrl: explorerTxUrl(receipt.hash),
        },
      };
    }),

  /**
   * Withdraw stablecoins from the payment contract back to the agent wallet.
   *
   * Withdrawals are treated as high-risk operations — anomaly detection
   * applies stricter thresholds for withdraw actions.
   */
  agentWithdraw: protectedProcedure
    .input(
      z.object({
        token: z.enum(['USDC', 'USDT']),
        amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Invalid amount — use up to 6 decimal places'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const anomalyCheck = checkTransactionAnomaly(
        userId,
        'withdraw',
        parseFloat(input.amount),
        input.token
      );
      if (!anomalyCheck.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: anomalyCheck.reason || 'Withdrawal blocked due to unusual activity',
        });
      }

      const signer = await getAgentSigner(userId);
      const tokenAddress = resolveTokenAddress(input.token);
      const amountWei = ethers.parseUnits(input.amount, STABLECOIN_DECIMALS);

      const paymentContract = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_ABI, signer);
      const tx = await paymentContract.withdraw(tokenAddress, amountWei);
      const receipt = await tx.wait();

      await recordAgentTransaction({
        userId,
        txHash: receipt.hash,
        action: 'withdraw',
        token: tokenAddress,
        amountUSD: parseFloat(input.amount),
      });

      return {
        success: true,
        data: {
          txHash: receipt.hash,
          token: input.token,
          amount: input.amount,
          explorerUrl: explorerTxUrl(receipt.hash),
        },
      };
    }),

  /** Retrieve the agent's on-chain transaction history (audit log). */
  agentTransactions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const data = await getAgentTransactionHistory(ctx.user.id, input.limit);
      return { success: true, data };
    }),

  /** Update spending limits for the calling agent's wallet. */
  updateLimits: protectedProcedure
    .input(
      z.object({
        dailyLimit: z.number().min(1).max(100_000).optional(),
        perTxLimit: z.number().min(1).max(10_000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateSpendingLimits(ctx.user.id, input.dailyLimit, input.perTxLimit);
      return { success: true, message: 'Spending limits updated' };
    }),

  // --------------------------------------------------------------------------
  // Direct (browser wallet) mode
  // --------------------------------------------------------------------------

  /**
   * Verify an on-chain purchase made by a user's MetaMask wallet.
   *
   * The user calls `directPurchase()` from their own wallet in the browser,
   * then submits the resulting `txHash` here. This endpoint:
   *   1. Fetches the receipt and verifies it succeeded
   *   2. Confirms the tx was sent to our payment contract
   *   3. Confirms the sender matches the user's registered wallet address
   *   4. Parses `Spent` event logs to confirm the correct packageId was purchased
   *   5. Creates a PackagePurchase record to grant download access
   */
  verifyPurchase: protectedProcedure
    .input(
      z.object({
        txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
        packageType: z.enum(['vector', 'memory', 'chain']),
        packageId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const provider = getProvider();

      const receipt = await provider.getTransactionReceipt(input.txHash);
      if (!receipt) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transaction not found. It may still be pending — try again shortly.',
        });
      }

      if (receipt.status !== 1) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Transaction failed on-chain' });
      }

      // Guard: ensure the tx hit OUR contract, not an arbitrary one
      if (receipt.to?.toLowerCase() !== PAYMENT_CONTRACT_ADDRESS.toLowerCase()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transaction was not sent to the payment contract',
        });
      }

      // Guard: sender must match the authenticated user's registered wallet
      const user = await prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { walletAddress: true },
      });

      if (user?.walletAddress && receipt.from.toLowerCase() !== user.walletAddress.toLowerCase()) {
        logger.warn('verifyPurchase: wallet address mismatch', {
          userId: ctx.user.id,
          expected: user.walletAddress,
          actual: receipt.from,
          txHash: input.txHash,
        });
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Transaction sender does not match your registered wallet address',
        });
      }

      // Parse logs to confirm the correct package was purchased
      const iface = new ethers.Interface(PAYMENT_ABI);
      let amountPaid = '0';
      let verified = false;

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === 'Spent' && parsed.args.packageId === input.packageId) {
            verified = true;
            amountPaid = ethers.formatUnits(parsed.args.amount, STABLECOIN_DECIMALS);
            break;
          }
        } catch {
          // This log belongs to a different contract — safe to skip
        }
      }

      if (!verified) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transaction does not contain a valid Spent event for this package',
        });
      }

      // Grant download access
      await prisma.packagePurchase.create({
        data: {
          buyerId: ctx.user.id,
          packageType: input.packageType,
          packageId: input.packageId,
          price: parseFloat(amountPaid),
          paymentId: input.txHash,
          status: 'completed',
        } as Parameters<typeof prisma.packagePurchase.create>[0]['data'],
      });

      return {
        success: true,
        data: {
          txHash: input.txHash,
          amountPaid,
          packageId: input.packageId,
          downloadUrl: downloadUrl(input.packageType, input.packageId),
        },
      };
    }),

  // --------------------------------------------------------------------------
  // General info
  // --------------------------------------------------------------------------

  /**
   * Return supported stablecoins and contract metadata.
   *
   * Treasury address is intentionally omitted — it is public on-chain but
   * serving it from the API would reduce phishing friction for bad actors.
   */
  getInfo: protectedProcedure.query(() => ({
    success: true,
    data: {
      contractAddress: PAYMENT_CONTRACT_ADDRESS,
      chainId: AVALANCHE_CHAIN_ID,
      network: 'Avalanche C-Chain',
      platformFeeRate: `${PLATFORM_FEE_BPS / 100}%`,
      supportedTokens: [
        { symbol: 'USDC', address: STABLECOIN_ADDRESSES.mainnet.USDC, decimals: STABLECOIN_DECIMALS },
        { symbol: 'USDT', address: STABLECOIN_ADDRESSES.mainnet.USDT, decimals: STABLECOIN_DECIMALS },
      ],
      explorerUrl: `${EXPLORER_BASE_URL}/address/${PAYMENT_CONTRACT_ADDRESS}`,
    },
  })),
});
