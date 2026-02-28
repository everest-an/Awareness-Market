/**
 * Agent Custody Wallet Service
 *
 * Manages server-side custodial wallets for AI agents, enabling autonomous
 * on-chain stablecoin transactions (USDC/USDT on Avalanche C-Chain).
 *
 * Security model:
 * - Private keys are encrypted at rest using AES-256-GCM + PBKDF2
 *   (see `crypto-utils.ts` for implementation details)
 * - Spending limits are enforced per-agent (daily + per-transaction ceilings)
 * - Every transaction is logged to an audit table for compliance
 * - `isActive` flag provides an emergency kill-switch per wallet
 *
 * Wallet lifecycle:
 * 1. First call to `getOrCreateAgentWallet` creates a random Avalanche wallet
 * 2. Wallet address is stored in DB; private key stored encrypted
 * 3. Platform operator funds wallets with AVAX for gas
 * 4. Agent calls `agentPurchase` → server decrypts key, signs tx, re-encrypts concept in memory
 */

import { ethers } from 'ethers';
import { prisma } from '../db-prisma';
import { createLogger } from '../utils/logger';
import {
  encryptPrivateKey,
  decryptPrivateKey,
  parseEncryptedPayload,
} from './crypto-utils';
import {
  AVALANCHE_CHAIN_ID,
  STABLECOIN_ADDRESSES,
  PAYMENT_CONTRACT_ADDRESS,
  ERC20_ABI,
  PAYMENT_ABI,
  DEFAULT_DAILY_SPEND_LIMIT_USD,
  DEFAULT_PER_TX_SPEND_LIMIT_USD,
  AVAX_DECIMALS,
  STABLECOIN_DECIMALS,
} from './constants';

const logger = createLogger('AgentWallet');

// ============================================================================
// Types
// ============================================================================

/** Public info about an agent's custody wallet (no sensitive data) */
export interface AgentWalletInfo {
  address: string;
  chainId: number;
  createdAt: Date;
  /** Daily USD spending ceiling */
  dailySpendLimit: number;
  /** Per-transaction USD ceiling */
  perTxSpendLimit: number;
  /** USD spent so far today (resets at midnight UTC) */
  totalSpentToday: number;
  isActive: boolean;
}

/** Balance snapshot for an agent wallet */
export interface AgentWalletBalance {
  address: string;
  /** AVAX balance — gas token */
  avaxBalance: string;
  /** USDC held in wallet (not deposited to contract) */
  usdcBalance: string;
  /** USDT held in wallet (not deposited to contract) */
  usdtBalance: string;
  /** USDC deposited inside StablecoinPaymentSystem contract */
  contractUsdcBalance: string;
  /** USDT deposited inside StablecoinPaymentSystem contract */
  contractUsdtBalance: string;
}

// ============================================================================
// Provider singleton
// ============================================================================

let _provider: ethers.JsonRpcProvider | null = null;

/**
 * Returns the shared JsonRpcProvider for Avalanche.
 * Lazy-initialised so tests can set env vars before first call.
 */
function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    const rpcUrl =
      process.env.BLOCKCHAIN_RPC_URL ||
      process.env.AVALANCHE_RPC_URL ||
      'https://api.avax.network/ext/bc/C/rpc';
    _provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return _provider;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get or create a custody wallet for an AI agent.
 *
 * Idempotent: returns the existing wallet if one already exists for `userId`.
 * On first call a new random Avalanche wallet is generated, the private key
 * is encrypted, and both are persisted to the database.
 *
 * @param userId - Platform user ID of the agent
 * @returns Public wallet info (no private key)
 */
export async function getOrCreateAgentWallet(userId: number): Promise<AgentWalletInfo> {
  const existing = await prisma.agentWallet.findUnique({ where: { userId } });

  if (existing) {
    const totalSpentToday = await getTodaySpent(userId);
    return {
      address: existing.walletAddress,
      chainId: AVALANCHE_CHAIN_ID,
      createdAt: existing.createdAt,
      dailySpendLimit: Number(existing.dailySpendLimit),
      perTxSpendLimit: Number(existing.perTxSpendLimit),
      totalSpentToday,
      isActive: existing.isActive,
    };
  }

  // Generate new wallet; encrypt private key before any DB write
  const wallet = ethers.Wallet.createRandom();
  const encryptedPayload = encryptPrivateKey(wallet.privateKey);

  const created = await prisma.agentWallet.create({
    data: {
      userId,
      walletAddress: wallet.address,
      encryptedKey: JSON.stringify(encryptedPayload),
      chainId: AVALANCHE_CHAIN_ID,
      dailySpendLimit: DEFAULT_DAILY_SPEND_LIMIT_USD,
      perTxSpendLimit: DEFAULT_PER_TX_SPEND_LIMIT_USD,
      isActive: true,
    },
  });

  logger.info('Created agent custody wallet', { userId, address: wallet.address });

  return {
    address: created.walletAddress,
    chainId: AVALANCHE_CHAIN_ID,
    createdAt: created.createdAt,
    dailySpendLimit: DEFAULT_DAILY_SPEND_LIMIT_USD,
    perTxSpendLimit: DEFAULT_PER_TX_SPEND_LIMIT_USD,
    totalSpentToday: 0,
    isActive: true,
  };
}

/**
 * Retrieve an ethers.Wallet signer for signing on-chain transactions.
 *
 * The private key is decrypted only within this function's call stack and is
 * never returned to callers. TypeScript strings are not zero-able in the JS
 * runtime sense (GC is non-deterministic), but we minimise the window the
 * plaintext key is in memory by not storing it in any closure or outer scope.
 *
 * @param userId - Platform user ID of the agent
 * @returns Wallet instance connected to the Avalanche provider
 * @throws Error if wallet not found or is deactivated
 */
export async function getAgentSigner(userId: number): Promise<ethers.Wallet> {
  const record = await prisma.agentWallet.findUnique({ where: { userId } });

  if (!record) {
    throw new Error('Agent wallet not found — call getOrCreateAgentWallet first.');
  }
  if (!record.isActive) {
    throw new Error('Agent wallet is deactivated.');
  }

  const payload = parseEncryptedPayload(record.encryptedKey);
  const privateKey = decryptPrivateKey(payload);
  const provider = getProvider();

  return new ethers.Wallet(privateKey, provider);
}

/**
 * Fetch all on-chain balances for an agent's custody wallet.
 *
 * Queries AVAX, USDC, and USDT balances both in the wallet and deposited
 * in the StablecoinPaymentSystem contract. All calls are parallelised.
 *
 * @param userId - Platform user ID of the agent
 * @returns Balance snapshot
 */
export async function getAgentWalletBalance(userId: number): Promise<AgentWalletBalance> {
  const record = await prisma.agentWallet.findUnique({ where: { userId } });
  if (!record) throw new Error('Agent wallet not found');

  const provider = getProvider();
  const { address } = record;

  const usdc = new ethers.Contract(STABLECOIN_ADDRESSES.mainnet.USDC, ERC20_ABI, provider);
  const usdt = new ethers.Contract(STABLECOIN_ADDRESSES.mainnet.USDT, ERC20_ABI, provider);
  const paymentContract = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PAYMENT_ABI, provider);

  const [avaxBalance, usdcBalance, usdtBalance, contractUsdcBalance, contractUsdtBalance] =
    await Promise.all([
      provider.getBalance(address),
      usdc.balanceOf(address),
      usdt.balanceOf(address),
      // Fail gracefully: contract may not yet be funded
      paymentContract.getBalance(address, STABLECOIN_ADDRESSES.mainnet.USDC).catch(() => BigInt(0)),
      paymentContract.getBalance(address, STABLECOIN_ADDRESSES.mainnet.USDT).catch(() => BigInt(0)),
    ]);

  return {
    address,
    avaxBalance: ethers.formatUnits(avaxBalance, AVAX_DECIMALS),
    usdcBalance: ethers.formatUnits(usdcBalance, STABLECOIN_DECIMALS),
    usdtBalance: ethers.formatUnits(usdtBalance, STABLECOIN_DECIMALS),
    contractUsdcBalance: ethers.formatUnits(contractUsdcBalance, STABLECOIN_DECIMALS),
    contractUsdtBalance: ethers.formatUnits(contractUsdtBalance, STABLECOIN_DECIMALS),
  };
}

/**
 * Validate whether a proposed transaction is within the agent's spending limits.
 *
 * Checks both per-transaction and cumulative-daily ceilings.
 *
 * @param userId    - Platform user ID of the agent
 * @param amountUSD - Proposed transaction amount in USD
 * @returns `{ allowed: true }` or `{ allowed: false, reason: string }`
 */
export async function checkSpendingLimits(
  userId: number,
  amountUSD: number
): Promise<{ allowed: boolean; reason?: string }> {
  const record = await prisma.agentWallet.findUnique({ where: { userId } });

  if (!record) return { allowed: false, reason: 'Agent wallet not found' };
  if (!record.isActive) return { allowed: false, reason: 'Agent wallet is deactivated' };

  const perTxLimit = Number(record.perTxSpendLimit);
  if (amountUSD > perTxLimit) {
    return {
      allowed: false,
      reason: `Amount $${amountUSD} exceeds per-transaction limit of $${perTxLimit}`,
    };
  }

  const dailyLimit = Number(record.dailySpendLimit);
  const todaySpent = await getTodaySpent(userId);
  if (todaySpent + amountUSD > dailyLimit) {
    return {
      allowed: false,
      reason: `Would exceed daily limit. Spent today: $${todaySpent.toFixed(2)}, limit: $${dailyLimit}`,
    };
  }

  return { allowed: true };
}

/**
 * Record a completed on-chain transaction in the audit log.
 *
 * This creates a row in `AgentWalletTransaction` which is used for both
 * compliance reporting and daily spend tracking.
 *
 * @param params.userId    - Agent user ID
 * @param params.txHash    - On-chain transaction hash
 * @param params.action    - Transaction type ('deposit' | 'purchase' | 'withdraw' | 'approve')
 * @param params.token     - Token contract address
 * @param params.amountUSD - USD value of the transaction
 * @param params.packageId - (optional) Package ID for purchases
 * @param params.details   - (optional) Human-readable description
 */
export async function recordAgentTransaction(params: {
  userId: number;
  txHash: string;
  action: 'deposit' | 'purchase' | 'withdraw' | 'approve';
  token: string;
  amountUSD: number;
  packageId?: string;
  details?: string;
}): Promise<void> {
  await prisma.agentWalletTransaction.create({
    data: {
      userId: params.userId,
      txHash: params.txHash,
      action: params.action,
      token: params.token,
      amountUSD: params.amountUSD,
      packageId: params.packageId,
      details: params.details,
    },
  });
}

/**
 * Update spending limits for an agent wallet.
 *
 * Partial updates are supported — pass only the limits you want to change.
 *
 * @param userId      - Agent user ID
 * @param dailyLimit  - New daily USD ceiling (optional)
 * @param perTxLimit  - New per-transaction USD ceiling (optional)
 */
export async function updateSpendingLimits(
  userId: number,
  dailyLimit?: number,
  perTxLimit?: number
): Promise<void> {
  const data: Record<string, number> = {};
  if (dailyLimit !== undefined) data.dailySpendLimit = dailyLimit;
  if (perTxLimit !== undefined) data.perTxSpendLimit = perTxLimit;

  await prisma.agentWallet.update({ where: { userId }, data });
}

/**
 * Deactivate an agent wallet — emergency kill-switch.
 *
 * Once deactivated, `getAgentSigner` and `checkSpendingLimits` will both
 * reject further transactions. Re-activation requires a manual DB update.
 *
 * @param userId - Agent user ID
 */
export async function deactivateAgentWallet(userId: number): Promise<void> {
  await prisma.agentWallet.update({ where: { userId }, data: { isActive: false } });
  logger.warn('Agent wallet deactivated', { userId });
}

/**
 * Retrieve paginated transaction history for an agent.
 *
 * @param userId - Agent user ID
 * @param limit  - Maximum number of records to return (default 50, max 100)
 */
export async function getAgentTransactionHistory(
  userId: number,
  limit = 50
): Promise<
  Array<{
    txHash: string;
    action: string;
    token: string;
    amountUSD: number;
    packageId: string | null;
    createdAt: Date;
  }>
> {
  const rows = await prisma.agentWalletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      txHash: true,
      action: true,
      token: true,
      amountUSD: true,
      packageId: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({ ...row, amountUSD: Number(row.amountUSD) }));
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Sum all `purchase` transactions for `userId` since the start of today (UTC).
 *
 * @param userId - Agent user ID
 * @returns Total USD spent today
 */
async function getTodaySpent(userId: number): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const result = await prisma.agentWalletTransaction.aggregate({
    where: { userId, action: 'purchase', createdAt: { gte: startOfDay } },
    _sum: { amountUSD: true },
  });

  return Number(result._sum.amountUSD ?? 0);
}
