/**
 * Agent Custody Wallet Service
 * 
 * Provides server-side managed wallets for AI agents to autonomously
 * execute on-chain stablecoin transactions (USDC/USDT).
 * 
 * Security:
 * - Private keys encrypted with AES-256-GCM using per-key derived encryption key
 * - Encryption key derived from AGENT_WALLET_MASTER_KEY env var via PBKDF2
 * - Keys stored in database, never logged or exposed via API
 * - Spending limits enforced per-agent (daily/per-tx)
 * - Transaction audit log for compliance
 * 
 * Architecture:
 * - Each AI agent gets a unique Avalanche C-Chain wallet on first request
 * - Wallet is used for approve → directPurchase on StablecoinPaymentSystem contract
 * - Platform operator funds wallets with AVAX for gas
 */

import { ethers } from 'ethers';
import crypto from 'crypto';
import { prisma } from '../db-prisma';
import { createLogger } from '../utils/logger';
import {
  validateApproveTarget,
  isWhitelistedContract,
  checkTransactionAnomaly,
  sanitizeErrorMessage,
  safeCryptoError,
} from '../middleware/crypto-asset-guard';

const logger = createLogger('AgentWallet');

// ============================================================================
// Types
// ============================================================================

export interface AgentWalletInfo {
  address: string;
  chainId: number;
  createdAt: Date;
  dailySpendLimit: number;  // USD
  perTxSpendLimit: number;  // USD
  totalSpentToday: number;  // USD
  isActive: boolean;
}

export interface AgentWalletBalance {
  address: string;
  avaxBalance: string;     // Gas token
  usdcBalance: string;      // USDC in wallet
  usdtBalance: string;      // USDT in wallet
  contractUsdcBalance: string; // USDC deposited in payment contract
  contractUsdtBalance: string; // USDT deposited in payment contract
}

interface EncryptedKey {
  ciphertext: string;  // hex
  iv: string;          // hex
  authTag: string;     // hex
  salt: string;        // hex
}

// ============================================================================
// Constants
// ============================================================================

const AVALANCHE_CHAIN_ID = 43114;
const ALGORITHM = 'aes-256-gcm';
const KEY_DERIVATION_ITERATIONS = 100000;

// Stablecoin addresses on Avalanche C-Chain Mainnet
const USDC_ADDRESS = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';
const USDT_ADDRESS = '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7';

// Minimal ERC20 ABI for balance checks
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// Default spending limits
const DEFAULT_DAILY_LIMIT = 500;   // $500/day
const DEFAULT_PER_TX_LIMIT = 100;  // $100/transaction

// ============================================================================
// Encryption Helpers
// ============================================================================

function getMasterKey(): string {
  const key = process.env.AGENT_WALLET_MASTER_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      'AGENT_WALLET_MASTER_KEY must be set (min 32 chars). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return key;
}

function deriveEncryptionKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, KEY_DERIVATION_ITERATIONS, 32, 'sha256');
}

function encryptPrivateKey(privateKey: string): EncryptedKey {
  const masterKey = getMasterKey();
  const salt = crypto.randomBytes(16);
  const derivedKey = deriveEncryptionKey(masterKey, salt);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  let ciphertext = cipher.update(privateKey, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt.toString('hex'),
  };
}

function decryptPrivateKey(encrypted: EncryptedKey): string {
  const masterKey = getMasterKey();
  const salt = Buffer.from(encrypted.salt, 'hex');
  const derivedKey = deriveEncryptionKey(masterKey, salt);
  const iv = Buffer.from(encrypted.iv, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

  let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

// ============================================================================
// Provider singleton
// ============================================================================

let _provider: ethers.JsonRpcProvider | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc';
    _provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return _provider;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get or create a custody wallet for an AI agent (identified by userId).
 * Wallet is created on first call, returned from DB on subsequent calls.
 */
export async function getOrCreateAgentWallet(userId: number): Promise<AgentWalletInfo> {
  // Check if user already has a custody wallet
  const existing = await prisma.agentWallet.findUnique({
    where: { userId },
  });

  if (existing) {
    const todaySpent = await getTodaySpent(userId);
    return {
      address: existing.walletAddress,
      chainId: AVALANCHE_CHAIN_ID,
      createdAt: existing.createdAt,
      dailySpendLimit: Number(existing.dailySpendLimit),
      perTxSpendLimit: Number(existing.perTxSpendLimit),
      totalSpentToday: todaySpent,
      isActive: existing.isActive,
    };
  }

  // Create new wallet
  const wallet = ethers.Wallet.createRandom();
  const encrypted = encryptPrivateKey(wallet.privateKey);

  const created = await prisma.agentWallet.create({
    data: {
      userId,
      walletAddress: wallet.address,
      encryptedKey: JSON.stringify(encrypted),
      chainId: AVALANCHE_CHAIN_ID,
      dailySpendLimit: DEFAULT_DAILY_LIMIT,
      perTxSpendLimit: DEFAULT_PER_TX_LIMIT,
      isActive: true,
    },
  });

  logger.info('Created agent custody wallet', {
    userId,
    address: wallet.address,
  });

  return {
    address: created.walletAddress,
    chainId: AVALANCHE_CHAIN_ID,
    createdAt: created.createdAt,
    dailySpendLimit: DEFAULT_DAILY_LIMIT,
    perTxSpendLimit: DEFAULT_PER_TX_LIMIT,
    totalSpentToday: 0,
    isActive: true,
  };
}

/**
 * Get wallet signer for on-chain transactions.
 * Never expose the signer or private key externally.
 * Key is scrubbed from local variable after Wallet construction.
 */
export async function getAgentSigner(userId: number): Promise<ethers.Wallet> {
  const record = await prisma.agentWallet.findUnique({
    where: { userId },
  });

  if (!record) {
    throw new Error('Agent wallet not found. Call getOrCreateAgentWallet first.');
  }

  if (!record.isActive) {
    throw new Error('Agent wallet is deactivated.');
  }

  const encrypted: EncryptedKey = JSON.parse(record.encryptedKey);
  let privateKey: string | null = decryptPrivateKey(encrypted);
  const provider = getProvider();

  // Construct wallet and immediately scrub the key variable
  const wallet = new ethers.Wallet(privateKey, provider);
  privateKey = null; // Release reference for GC

  return wallet;
}

/**
 * Get all balances for an agent wallet.
 */
export async function getAgentWalletBalance(userId: number): Promise<AgentWalletBalance> {
  const record = await prisma.agentWallet.findUnique({
    where: { userId },
  });

  if (!record) {
    throw new Error('Agent wallet not found');
  }

  const provider = getProvider();
  const address = record.walletAddress;

  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
  const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);

  // Payment contract address
  const paymentContractAddress = process.env.STABLECOIN_PAYMENT_ADDRESS ||
    process.env.STABLECOIN_CONTRACT_ADDRESS ||
    '0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8';

  const PAYMENT_ABI = [
    'function getBalance(address user, address token) view returns (uint256)',
  ];
  const paymentContract = new ethers.Contract(paymentContractAddress, PAYMENT_ABI, provider);

  const [
    avaxBalance,
    usdcBalance,
    usdtBalance,
    contractUsdcBalance,
    contractUsdtBalance,
  ] = await Promise.all([
    provider.getBalance(address),
    usdc.balanceOf(address),
    usdt.balanceOf(address),
    paymentContract.getBalance(address, USDC_ADDRESS).catch(() => BigInt(0)),
    paymentContract.getBalance(address, USDT_ADDRESS).catch(() => BigInt(0)),
  ]);

  return {
    address,
    avaxBalance: ethers.formatEther(avaxBalance),
    usdcBalance: ethers.formatUnits(usdcBalance, 6),
    usdtBalance: ethers.formatUnits(usdtBalance, 6),
    contractUsdcBalance: ethers.formatUnits(contractUsdcBalance, 6),
    contractUsdtBalance: ethers.formatUnits(contractUsdtBalance, 6),
  };
}

/**
 * Check spending limits before a transaction.
 */
export async function checkSpendingLimits(
  userId: number,
  amountUSD: number
): Promise<{ allowed: boolean; reason?: string }> {
  const record = await prisma.agentWallet.findUnique({
    where: { userId },
  });

  if (!record) {
    return { allowed: false, reason: 'Agent wallet not found' };
  }

  if (!record.isActive) {
    return { allowed: false, reason: 'Agent wallet is deactivated' };
  }

  // Per-transaction limit
  if (amountUSD > Number(record.perTxSpendLimit)) {
    return {
      allowed: false,
      reason: `Amount $${amountUSD} exceeds per-transaction limit of $${record.perTxSpendLimit}`,
    };
  }

  // Daily limit
  const todaySpent = await getTodaySpent(userId);
  if (todaySpent + amountUSD > Number(record.dailySpendLimit)) {
    return {
      allowed: false,
      reason: `Would exceed daily limit. Spent today: $${todaySpent.toFixed(2)}, limit: $${record.dailySpendLimit}`,
    };
  }

  return { allowed: true };
}

/**
 * Record a transaction for audit and spending tracking.
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
 * Get total spent today for an agent.
 */
async function getTodaySpent(userId: number): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await prisma.agentWalletTransaction.aggregate({
    where: {
      userId,
      action: 'purchase',
      createdAt: { gte: startOfDay },
    },
    _sum: { amountUSD: true },
  });

  return Number(result._sum.amountUSD || 0);
}

/**
 * Update spending limits for an agent wallet.
 */
export async function updateSpendingLimits(
  userId: number,
  dailyLimit?: number,
  perTxLimit?: number
): Promise<void> {
  const data: Record<string, number> = {};
  if (dailyLimit !== undefined) data.dailySpendLimit = dailyLimit;
  if (perTxLimit !== undefined) data.perTxSpendLimit = perTxLimit;

  await prisma.agentWallet.update({
    where: { userId },
    data,
  });
}

/**
 * Deactivate an agent wallet (emergency kill switch).
 */
export async function deactivateAgentWallet(userId: number): Promise<void> {
  await prisma.agentWallet.update({
    where: { userId },
    data: { isActive: false },
  });

  logger.warn('Agent wallet deactivated', { userId });
}

/**
 * Get agent transaction history.
 */
export async function getAgentTransactionHistory(
  userId: number,
  limit = 50
): Promise<Array<{
  txHash: string;
  action: string;
  token: string;
  amountUSD: number;
  packageId: string | null;
  createdAt: Date;
}>> {
  const txs = await prisma.agentWalletTransaction.findMany({
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

  return txs.map(tx => ({
    ...tx,
    amountUSD: Number(tx.amountUSD),
  }));
}
