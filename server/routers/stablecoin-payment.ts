/**
 * Stablecoin Payment API Router
 * 
 * Provides tRPC endpoints for:
 * - AI Agent autonomous stablecoin payments (USDC/USDT on Avalanche C-Chain)
 * - User wallet-based direct purchases
 * - Agent custody wallet management
 * - Deposit / Purchase / Withdraw lifecycle
 * 
 * Two payment modes:
 * 1. CUSTODY MODE (AI agents): Server holds wallet, agent calls API to transact
 * 2. DIRECT MODE (users): User signs tx in browser wallet (MetaMask), server verifies
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
  StablecoinPaymentClient,
  STABLECOIN_ADDRESSES,
} from '../blockchain/token-system';
import { prisma } from '../db-prisma';
import {
  validateApproveTarget,
  checkTransactionAnomaly,
  safeCryptoError,
} from '../middleware/crypto-asset-guard';

const logger = createLogger('StablecoinPayment');

// ============================================================================
// Constants
// ============================================================================

const AVALANCHE_CHAIN_ID = 43114;

const PAYMENT_CONTRACT_ADDRESS =
  process.env.STABLECOIN_PAYMENT_ADDRESS ||
  process.env.STABLECOIN_CONTRACT_ADDRESS ||
  '0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8';

const PLATFORM_TREASURY =
  process.env.PLATFORM_TREASURY_ADDRESS ||
  '0x3d0ab53241A2913D7939ae02f7083169fE7b823B';

// Minimal ABIs
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

const PAYMENT_ABI = [
  'function directPurchase(string packageId, string packageType, address token, uint256 priceUSD, address seller) returns (uint256)',
  'function deposit(address token, uint256 amount)',
  'function withdraw(address token, uint256 amount)',
  'function getBalance(address user, address token) view returns (uint256)',
  'function getTotalBalanceUSD(address user) view returns (uint256)',
  'function getTokenAmount(uint256 priceUSDCents, address token) view returns (uint256)',
  'function checkPurchased(string packageId, address user) view returns (bool)',
  'event Spent(address indexed user, string packageId, string packageType, address token, uint256 amount, uint256 platformFee)',
];

// Resolve valid token names to addresses
function resolveTokenAddress(token: string, network: 'mainnet' | 'fuji' = 'mainnet'): string {
  const upper = token.toUpperCase();
  if (upper === 'USDC') return STABLECOIN_ADDRESSES[network].USDC;
  if (upper === 'USDT') return STABLECOIN_ADDRESSES[network].USDT;
  // Already an address
  if (ethers.isAddress(token)) return token;
  throw new Error(`Unsupported token: ${token}. Use USDC or USDT.`);
}

function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc';
  return new ethers.JsonRpcProvider(rpcUrl);
}

// ============================================================================
// Helper: get seller wallet address for a package
// ============================================================================

async function getPackageSellerAddress(
  packageType: 'vector' | 'memory' | 'chain',
  packageId: string
): Promise<{ sellerAddress: string; priceUSD: number; sellerId: number }> {
  let sellerId: number | null = null;
  let price = 0;

  switch (packageType) {
    case 'vector': {
      const pkg = await prisma.vectorPackage.findUnique({
        where: { packageId },
        select: { userId: true, price: true },
      });
      if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vector package not found' });
      sellerId = pkg.userId;
      price = Number(pkg.price);
      break;
    }
    case 'memory': {
      const pkg = await prisma.memoryPackage.findUnique({
        where: { packageId },
        select: { userId: true, price: true },
      });
      if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Memory package not found' });
      sellerId = pkg.userId;
      price = Number(pkg.price);
      break;
    }
    case 'chain': {
      const pkg = await prisma.chainPackage.findUnique({
        where: { packageId },
        select: { userId: true, price: true },
      });
      if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Chain package not found' });
      sellerId = pkg.userId;
      price = Number(pkg.price);
      break;
    }
  }

  if (!sellerId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Package has no creator' });
  }

  // Get seller's wallet address
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { walletAddress: true },
  });

  // If seller has no wallet, payments go to platform treasury
  const sellerAddress = seller?.walletAddress || PLATFORM_TREASURY;

  return { sellerAddress, priceUSD: price, sellerId };
}

// ============================================================================
// tRPC Router
// ============================================================================

export const stablecoinPaymentRouter = router({

  // ==========================================================================
  // Agent Custody Wallet Management
  // ==========================================================================

  /**
   * Get or create the AI agent's custody wallet
   */
  getWallet: protectedProcedure
    .query(async ({ ctx }) => {
      const wallet = await getOrCreateAgentWallet(ctx.user.id);
      return {
        success: true,
        data: wallet,
      };
    }),

  /**
   * Get wallet balances (AVAX, USDC, USDT — both wallet and contract)
   */
  getBalance: protectedProcedure
    .query(async ({ ctx }) => {
      const balance = await getAgentWalletBalance(ctx.user.id);
      return {
        success: true,
        data: balance,
      };
    }),

  /**
   * Get a price quote for a package in stablecoin terms
   */
  getQuote: protectedProcedure
    .input(z.object({
      packageType: z.enum(['vector', 'memory', 'chain']),
      packageId: z.string(),
      token: z.enum(['USDC', 'USDT']).default('USDC'),
    }))
    .query(async ({ input }) => {
      const { sellerAddress, priceUSD } = await getPackageSellerAddress(
        input.packageType,
        input.packageId
      );

      const tokenAddress = resolveTokenAddress(input.token);
      const provider = getProvider();
      const paymentContract = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_ABI, provider);

      const priceCents = Math.round(priceUSD * 100);
      const tokenAmount = await paymentContract.getTokenAmount(priceCents, tokenAddress);

      const platformFeeRate = 500; // 5% basis points
      const platformFee = (Number(ethers.formatUnits(tokenAmount, 6)) * platformFeeRate) / 10000;
      const sellerReceives = Number(ethers.formatUnits(tokenAmount, 6)) - platformFee;

      return {
        success: true,
        data: {
          packageId: input.packageId,
          packageType: input.packageType,
          priceUSD,
          token: input.token,
          tokenAddress,
          tokenAmount: ethers.formatUnits(tokenAmount, 6),
          platformFee: platformFee.toFixed(6),
          sellerReceives: sellerReceives.toFixed(6),
          sellerAddress,
          contractAddress: PAYMENT_CONTRACT_ADDRESS,
          chainId: AVALANCHE_CHAIN_ID,
          expiresIn: 300, // Quote valid for 5 minutes
        },
      };
    }),

  // ==========================================================================
  // AI Agent Autonomous Purchases (Custody Mode)
  // ==========================================================================

  /**
   * AI Agent: Purchase a package with stablecoin via custody wallet
   * Server-side autonomous transaction — no user signature required
   */
  agentPurchase: protectedProcedure
    .input(z.object({
      packageType: z.enum(['vector', 'memory', 'chain']),
      packageId: z.string(),
      token: z.enum(['USDC', 'USDT']).default('USDC'),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // 1. Get package details
      const { sellerAddress, priceUSD } = await getPackageSellerAddress(
        input.packageType,
        input.packageId
      );

      if (priceUSD <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Package price is invalid' });
      }

      // 2. Check spending limits
      const limitCheck = await checkSpendingLimits(userId, priceUSD);
      if (!limitCheck.allowed) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: limitCheck.reason || 'Spending limit exceeded',
        });
      }

      // 2b. Transaction anomaly detection (token drain prevention)
      const anomalyCheck = checkTransactionAnomaly(userId, 'purchase', priceUSD, input.token);
      if (!anomalyCheck.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: anomalyCheck.reason || 'Transaction blocked due to unusual activity',
        });
      }

      // 3. Get agent signer
      const signer = await getAgentSigner(userId);
      const tokenAddress = resolveTokenAddress(input.token);
      const provider = getProvider();

      // 4. Check token balance
      const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const balance = await erc20.balanceOf(signer.address);
      const priceCents = Math.round(priceUSD * 100);

      const paymentContract = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_ABI, provider);
      const tokenAmount = await paymentContract.getTokenAmount(priceCents, tokenAddress);

      if (balance < tokenAmount) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Insufficient ${input.token} balance. Need ${ethers.formatUnits(tokenAmount, 6)}, have ${ethers.formatUnits(balance, 6)}`,
        });
      }

      // 5. Approve token spending (with contract whitelist validation)
      const erc20WithSigner = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const currentAllowance = await erc20.allowance(signer.address, PAYMENT_CONTRACT_ADDRESS);

      if (currentAllowance < tokenAmount) {
        // Validate approve target is whitelisted — prevents phishing contract redirect
        validateApproveTarget(PAYMENT_CONTRACT_ADDRESS, `agentPurchase:${input.packageId}`);
        
        logger.info('Approving token spend', { userId, token: input.token, amount: ethers.formatUnits(tokenAmount, 6) });
        const approveTx = await erc20WithSigner.approve(PAYMENT_CONTRACT_ADDRESS, tokenAmount);
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

      // 6. Execute directPurchase
      const paymentWithSigner = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_ABI, signer);

      logger.info('Executing agent stablecoin purchase', {
        userId,
        packageId: input.packageId,
        token: input.token,
        priceUSD,
        seller: sellerAddress,
      });

      const purchaseTx = await paymentWithSigner.directPurchase(
        input.packageId,
        input.packageType,
        tokenAddress,
        priceCents,
        sellerAddress
      );
      const receipt = await purchaseTx.wait();

      // 7. Record transaction
      await recordAgentTransaction({
        userId,
        txHash: receipt.hash,
        action: 'purchase',
        token: tokenAddress,
        amountUSD: priceUSD,
        packageId: input.packageId,
        details: `${input.token} directPurchase on Avalanche`,
      });

      // 8. Also record in platform DB for download access
      const platformFeeRate = 0.05;
      const platformFeeAmount = priceUSD * platformFeeRate;

      // Get seller ID from package
      const { sellerId: packageSellerId } = await getPackageSellerAddress(
        input.packageType,
        input.packageId
      );

      await prisma.packagePurchase.create({
        data: {
          buyerId: userId,
          sellerId: packageSellerId,
          packageType: input.packageType,
          packageId: input.packageId,
          price: priceUSD,
          platformFee: platformFeeAmount,
          sellerEarnings: priceUSD - platformFeeAmount,
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
          amountPaid: ethers.formatUnits(tokenAmount, 6),
          priceUSD,
          blockNumber: receipt.blockNumber,
          explorerUrl: `https://snowscan.xyz/tx/${receipt.hash}`,
          downloadUrl: `/api/ai/download-package?packageType=${input.packageType}&packageId=${input.packageId}`,
        },
      };
    }),

  /**
   * AI Agent: Deposit stablecoins into the payment contract
   */
  agentDeposit: protectedProcedure
    .input(z.object({
      token: z.enum(['USDC', 'USDT']),
      amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Invalid amount format'),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const signer = await getAgentSigner(userId);
      const tokenAddress = resolveTokenAddress(input.token);
      const amountWei = ethers.parseUnits(input.amount, 6);

      // Transaction anomaly detection
      const anomalyCheck = checkTransactionAnomaly(userId, 'deposit', parseFloat(input.amount), input.token);
      if (!anomalyCheck.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: anomalyCheck.reason || 'Transaction blocked due to unusual activity',
        });
      }

      // Approve (with whitelist validation)
      validateApproveTarget(PAYMENT_CONTRACT_ADDRESS, `agentDeposit:${input.token}`);
      const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const currentAllowance = await erc20.allowance(signer.address, PAYMENT_CONTRACT_ADDRESS);

      if (currentAllowance < amountWei) {
        const approveTx = await erc20.approve(PAYMENT_CONTRACT_ADDRESS, amountWei);
        await approveTx.wait();
      }

      // Deposit
      const DEPOSIT_ABI = ['function deposit(address token, uint256 amount)'];
      const paymentContract = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, DEPOSIT_ABI, signer);
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
          explorerUrl: `https://snowscan.xyz/tx/${receipt.hash}`,
        },
      };
    }),

  /**
   * AI Agent: Withdraw stablecoins from payment contract back to wallet
   */
  agentWithdraw: protectedProcedure
    .input(z.object({
      token: z.enum(['USDC', 'USDT']),
      amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Invalid amount format'),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Transaction anomaly detection — withdrawals are high-risk
      const anomalyCheck = checkTransactionAnomaly(userId, 'withdraw', parseFloat(input.amount), input.token);
      if (!anomalyCheck.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: anomalyCheck.reason || 'Withdrawal blocked due to unusual activity',
        });
      }

      const signer = await getAgentSigner(userId);
      const tokenAddress = resolveTokenAddress(input.token);
      const amountWei = ethers.parseUnits(input.amount, 6);

      const WITHDRAW_ABI = ['function withdraw(address token, uint256 amount)'];
      const paymentContract = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, WITHDRAW_ABI, signer);
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
          explorerUrl: `https://snowscan.xyz/tx/${receipt.hash}`,
        },
      };
    }),

  /**
   * Get agent's on-chain transaction history
   */
  agentTransactions: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const txs = await getAgentTransactionHistory(ctx.user.id, input.limit);
      return {
        success: true,
        data: txs,
      };
    }),

  /**
   * Update agent spending limits (owner only)
   */
  updateLimits: protectedProcedure
    .input(z.object({
      dailyLimit: z.number().min(1).max(100000).optional(),
      perTxLimit: z.number().min(1).max(10000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateSpendingLimits(ctx.user.id, input.dailyLimit, input.perTxLimit);
      return { success: true, message: 'Spending limits updated' };
    }),

  // ==========================================================================
  // User Direct Purchases (Browser Wallet Mode)
  // ==========================================================================

  /**
   * Verify an on-chain stablecoin purchase made by user's browser wallet.
   * User calls directPurchase() from their MetaMask, then submits txHash here.
   */
  verifyPurchase: protectedProcedure
    .input(z.object({
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
      packageType: z.enum(['vector', 'memory', 'chain']),
      packageId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const provider = getProvider();

      // Wait for confirmation
      const receipt = await provider.getTransactionReceipt(input.txHash);
      if (!receipt) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Transaction not found. It may still be pending.',
        });
      }

      if (receipt.status !== 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transaction failed on-chain',
        });
      }

      // Verify the transaction interacted with our payment contract
      if (receipt.to?.toLowerCase() !== PAYMENT_CONTRACT_ADDRESS.toLowerCase()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transaction was not sent to the payment contract',
        });
      }

      // Verify the sender is the authenticated user's wallet
      const user = await prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { walletAddress: true },
      });
      if (user?.walletAddress && receipt.from.toLowerCase() !== user.walletAddress.toLowerCase()) {
        logger.warn('verifyPurchase: sender mismatch', {
          userId: ctx.user.id,
          expected: user.walletAddress,
          actual: receipt.from,
          txHash: input.txHash,
        });
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Transaction sender does not match your registered wallet',
        });
      }

      // Parse Spent event to verify it's the correct package
      const iface = new ethers.Interface(PAYMENT_ABI);
      let verified = false;
      let amountPaid = '0';

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed && parsed.name === 'Spent' && parsed.args.packageId === input.packageId) {
            verified = true;
            amountPaid = ethers.formatUnits(parsed.args.amount, 6);
            break;
          }
        } catch {
          // Not our event
        }
      }

      if (!verified) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Transaction does not contain a valid purchase for this package',
        });
      }

      // Record purchase for download access
      await prisma.packagePurchase.create({
        data: {
          buyerId: ctx.user.id,
          packageType: input.packageType,
          packageId: input.packageId,
          price: parseFloat(amountPaid),
          paymentId: input.txHash,
          status: 'completed',
        } as any,
      });

      return {
        success: true,
        data: {
          txHash: input.txHash,
          amountPaid,
          packageId: input.packageId,
          downloadUrl: `/api/ai/download-package?packageType=${input.packageType}&packageId=${input.packageId}`,
        },
      };
    }),

  // ==========================================================================
  // General Info
  // ==========================================================================

  /**
   * Get supported stablecoins and contract info
   * NOTE: Treasury address removed from public response (prevents targeted phishing)
   */
  getInfo: protectedProcedure
    .query(async () => {
      return {
        success: true,
        data: {
          contractAddress: PAYMENT_CONTRACT_ADDRESS,
          chainId: AVALANCHE_CHAIN_ID,
          network: 'Avalanche C-Chain',
          platformFeeRate: '5%',
          supportedTokens: [
            {
              symbol: 'USDC',
              address: STABLECOIN_ADDRESSES.mainnet.USDC,
              decimals: 6,
            },
            {
              symbol: 'USDT',
              address: STABLECOIN_ADDRESSES.mainnet.USDT,
              decimals: 6,
            },
          ],
          // Treasury address intentionally omitted — on-chain public but
          // no need to serve it, reduces phishing attack surface
          explorerUrl: `https://snowscan.xyz/address/${PAYMENT_CONTRACT_ADDRESS}`,
        },
      };
    }),
});
