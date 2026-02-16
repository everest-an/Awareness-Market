/**
 * Token & Stablecoin Payment System Integration
 *
 * Provides TypeScript interface for interacting with:
 * - AMEMToken contract (legacy)
 * - AgentCreditSystem contract (legacy)
 * - StablecoinPaymentSystem contract (new - USDC/USDT)
 *
 * Primary payment method: Stablecoins (USDC/USDT)
 * Legacy support: $AMEM token system
 */

import { ethers } from 'ethers';
import { createLogger } from '../utils/logger';

const logger = createLogger('TokenSystem');

// Contract ABIs (minimal - include only functions we need)
const AMEM_TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function circulatingSupply() view returns (uint256)',
  'function getTokenStats() view returns (uint256, uint256, uint256, uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

const AGENT_CREDIT_SYSTEM_ABI = [
  'function deposit(uint256 amount)',
  'function purchasePackage(string packageId, string packageType, uint256 priceUSD, address seller) returns (uint256)',
  'function requestWithdrawal(uint256 amount)',
  'function processWithdrawal()',
  'function cancelWithdrawal()',
  'function getBalance(address user) view returns (uint256)',
  'function getPurchaseHistory(address user) view returns (tuple(string packageId, string packageType, uint256 amountPaid, uint256 timestamp, bool refunded)[])',
  'function checkPurchased(string packageId, address user) view returns (bool)',
  'function getWithdrawalStatus(address user) view returns (tuple(uint256 amount, uint256 requestTime, bool processed), bool canProcess, uint256 timeRemaining)',
  'function getSystemStats() view returns (uint256, uint256, uint256, uint256, uint256)',
  'function usdToAmemRate() view returns (uint256)',
  'function platformFeeRate() view returns (uint256)',
  'event Deposited(address indexed user, uint256 amount, uint256 newBalance)',
  'event Spent(address indexed user, string packageId, string packageType, uint256 amount, uint256 platformFee)',
  'event Withdrawn(address indexed user, uint256 amount)',
];

// Contract return types
interface ContractPurchaseHistory {
  packageId: string;
  packageType: string;
  amountPaid: bigint;
  timestamp: bigint;
  refunded: boolean;
}

interface ParsedLogEvent {
  name: string;
  args: Record<string, unknown>;
}

interface TokenConfig {
  rpcUrl: string;
  amemTokenAddress: string;
  creditSystemAddress: string;
  privateKey?: string; // For server-side operations
}

interface Purchase {
  packageId: string;
  packageType: string;
  amountPaid: string;
  timestamp: number;
  refunded: boolean;
}

interface WithdrawalStatus {
  amount: string;
  requestTime: number;
  processed: boolean;
  canProcess: boolean;
  timeRemaining: number;
}

export class TokenSystemClient {
  private provider: ethers.JsonRpcProvider;
  private amemToken: ethers.Contract;
  private creditSystem: ethers.Contract;
  private signer?: ethers.Wallet;

  constructor(config: TokenConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    this.amemToken = new ethers.Contract(
      config.amemTokenAddress,
      AMEM_TOKEN_ABI,
      this.provider
    );

    this.creditSystem = new ethers.Contract(
      config.creditSystemAddress,
      AGENT_CREDIT_SYSTEM_ABI,
      this.provider
    );

    // If private key provided, create signer for write operations
    if (config.privateKey) {
      this.signer = new ethers.Wallet(config.privateKey, this.provider);
      this.amemToken = this.amemToken.connect(this.signer) as ethers.Contract;
      this.creditSystem = this.creditSystem.connect(this.signer) as ethers.Contract;
    }
  }

  // ============================================================================
  // Token Operations
  // ============================================================================

  /**
   * Get user's $AMEM token balance
   */
  async getTokenBalance(address: string): Promise<string> {
    try {
      const balance = await this.amemToken.balanceOf(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Failed to get token balance', { address, error });
      throw error;
    }
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<{
    totalSupply: string;
    circulatingSupply: string;
    totalBurned: string;
    totalFees: string;
  }> {
    try {
      const [totalSupply, circulatingSupply, totalBurned, totalFees] =
        await this.amemToken.getTokenStats();

      return {
        totalSupply: ethers.formatEther(totalSupply),
        circulatingSupply: ethers.formatEther(circulatingSupply),
        totalBurned: ethers.formatEther(totalBurned),
        totalFees: ethers.formatEther(totalFees),
      };
    } catch (error) {
      logger.error('Failed to get token stats', { error });
      throw error;
    }
  }

  // ============================================================================
  // Credit System Operations (Read)
  // ============================================================================

  /**
   * Get user's credit balance in the system
   */
  async getCreditBalance(address: string): Promise<string> {
    try {
      const balance = await this.creditSystem.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Failed to get credit balance', { address, error });
      throw error;
    }
  }

  /**
   * Check if user has purchased a package
   */
  async hasPurchased(packageId: string, userAddress: string): Promise<boolean> {
    try {
      return await this.creditSystem.checkPurchased(packageId, userAddress);
    } catch (error) {
      logger.error('Failed to check purchase status', { packageId, userAddress, error });
      throw error;
    }
  }

  /**
   * Get user's purchase history
   */
  async getPurchaseHistory(address: string): Promise<Purchase[]> {
    try {
      const history = await this.creditSystem.getPurchaseHistory(address);

      return history.map((p: ContractPurchaseHistory) => ({
        packageId: p.packageId,
        packageType: p.packageType,
        amountPaid: ethers.formatEther(p.amountPaid),
        timestamp: Number(p.timestamp),
        refunded: p.refunded,
      }));
    } catch (error) {
      logger.error('Failed to get purchase history', { address, error });
      throw error;
    }
  }

  /**
   * Get withdrawal request status
   */
  async getWithdrawalStatus(address: string): Promise<WithdrawalStatus> {
    try {
      const [request, canProcess, timeRemaining] =
        await this.creditSystem.getWithdrawalStatus(address);

      return {
        amount: ethers.formatEther(request.amount),
        requestTime: Number(request.requestTime),
        processed: request.processed,
        canProcess,
        timeRemaining: Number(timeRemaining),
      };
    } catch (error) {
      logger.error('Failed to get withdrawal status', { address, error });
      throw error;
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<{
    totalDeposited: string;
    totalSpent: string;
    totalWithdrawn: string;
    totalRefunded: string;
    contractBalance: string;
  }> {
    try {
      const [totalDeposited, totalSpent, totalWithdrawn, totalRefunded, contractBalance] =
        await this.creditSystem.getSystemStats();

      return {
        totalDeposited: ethers.formatEther(totalDeposited),
        totalSpent: ethers.formatEther(totalSpent),
        totalWithdrawn: ethers.formatEther(totalWithdrawn),
        totalRefunded: ethers.formatEther(totalRefunded),
        contractBalance: ethers.formatEther(contractBalance),
      };
    } catch (error) {
      logger.error('Failed to get system stats', { error });
      throw error;
    }
  }

  /**
   * Get USD to $AMEM conversion rate
   */
  async getConversionRate(): Promise<{ usdToAmem: string; amemToUsd: string }> {
    try {
      const rate = await this.creditSystem.usdToAmemRate();
      const rateNum = Number(ethers.formatEther(rate));

      return {
        usdToAmem: rateNum.toFixed(2), // 1 USD = X $AMEM
        amemToUsd: (1 / rateNum).toFixed(4), // 1 $AMEM = $X
      };
    } catch (error) {
      logger.error('Failed to get conversion rate', { error });
      throw error;
    }
  }

  // ============================================================================
  // Credit System Operations (Write - requires signer)
  // ============================================================================

  /**
   * Deposit $AMEM tokens to credit system
   */
  async deposit(amount: string): Promise<{ txHash: string; newBalance: string }> {
    if (!this.signer) {
      throw new Error('Signer required for write operations');
    }

    try {
      const amountWei = ethers.parseEther(amount);

      // First approve credit system to spend tokens
      logger.info('Approving token transfer', { amount });
      const approveTx = await this.amemToken.approve(
        await this.creditSystem.getAddress(),
        amountWei
      );
      await approveTx.wait();

      // Then deposit
      logger.info('Depositing tokens', { amount });
      const depositTx = await this.creditSystem.deposit(amountWei);
      const receipt = await depositTx.wait();

      // Get new balance from event
      const event = receipt.logs
        .map((log: any) => {
          try {
            return this.creditSystem.interface.parseLog(log) as ParsedLogEvent | null;
          } catch {
            return null;
          }
        })
        .find((e: any): e is ParsedLogEvent => e !== null && e.name === 'Deposited');

      const newBalance = event
        ? ethers.formatEther(event.args.newBalance)
        : await this.getCreditBalance(await this.signer.getAddress());

      return {
        txHash: receipt.hash,
        newBalance,
      };
    } catch (error) {
      logger.error('Failed to deposit', { amount, error });
      throw error;
    }
  }

  /**
   * Purchase package using credits
   */
  async purchasePackage(
    packageId: string,
    packageType: string,
    priceUSD: number,
    sellerAddress: string
  ): Promise<{ txHash: string; purchaseId: number }> {
    if (!this.signer) {
      throw new Error('Signer required for write operations');
    }

    try {
      logger.info('Purchasing package', { packageId, packageType, priceUSD });

      const tx = await this.creditSystem.purchasePackage(
        packageId,
        packageType,
        Math.round(priceUSD * 100), // Convert to cents
        sellerAddress
      );

      const receipt = await tx.wait();

      // Get purchase ID from event
      const event = receipt.logs
        .map((log: any) => {
          try {
            return this.creditSystem.interface.parseLog(log) as ParsedLogEvent | null;
          } catch {
            return null;
          }
        })
        .find((e: any): e is ParsedLogEvent => e !== null && e.name === 'Spent');

      return {
        txHash: receipt.hash,
        purchaseId: event ? Number(event.args.purchaseId) : 0,
      };
    } catch (error) {
      logger.error('Failed to purchase package', { packageId, error });
      throw error;
    }
  }

  /**
   * Request withdrawal
   */
  async requestWithdrawal(amount: string): Promise<{ txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer required for write operations');
    }

    try {
      const amountWei = ethers.parseEther(amount);
      const tx = await this.creditSystem.requestWithdrawal(amountWei);
      const receipt = await tx.wait();

      return { txHash: receipt.hash };
    } catch (error) {
      logger.error('Failed to request withdrawal', { amount, error });
      throw error;
    }
  }

  /**
   * Process withdrawal (after cooldown)
   */
  async processWithdrawal(): Promise<{ txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer required for write operations');
    }

    try {
      const tx = await this.creditSystem.processWithdrawal();
      const receipt = await tx.wait();

      return { txHash: receipt.hash };
    } catch (error) {
      logger.error('Failed to process withdrawal', { error });
      throw error;
    }
  }

  /**
   * Cancel withdrawal request
   */
  async cancelWithdrawal(): Promise<{ txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer required for write operations');
    }

    try {
      const tx = await this.creditSystem.cancelWithdrawal();
      const receipt = await tx.wait();

      return { txHash: receipt.hash };
    } catch (error) {
      logger.error('Failed to cancel withdrawal', { error });
      throw error;
    }
  }
}

/**
 * Create TokenSystemClient from environment variables
 */
export function createTokenSystemClient(): TokenSystemClient {
  const config: TokenConfig = {
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || process.env.POLYGON_RPC_URL || '',
    amemTokenAddress: process.env.AMEM_TOKEN_ADDRESS || '',
    creditSystemAddress: process.env.AGENT_CREDIT_SYSTEM_ADDRESS || '',
    privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY,
  };

  if (!config.rpcUrl) {
    throw new Error('BLOCKCHAIN_RPC_URL or POLYGON_RPC_URL required');
  }

  if (!config.amemTokenAddress) {
    throw new Error('AMEM_TOKEN_ADDRESS required');
  }

  if (!config.creditSystemAddress) {
    throw new Error('AGENT_CREDIT_SYSTEM_ADDRESS required');
  }

  logger.info('Initializing token system client', {
    rpcUrl: config.rpcUrl,
    amemToken: config.amemTokenAddress,
    creditSystem: config.creditSystemAddress,
  });

  return new TokenSystemClient(config);
}

// ============================================================================
// Stablecoin Payment System (USDC/USDT)
// ============================================================================

// Contract addresses for Polygon
export const STABLECOIN_ADDRESSES = {
  // Polygon Mainnet
  mainnet: {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  // Polygon Amoy Testnet (use mock tokens or deploy test tokens)
  amoy: {
    USDC: process.env.USDC_TESTNET_ADDRESS || '',
    USDT: process.env.USDT_TESTNET_ADDRESS || '',
  },
};

// ERC20 ABI for stablecoins
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

// Stablecoin Payment System ABI
const STABLECOIN_PAYMENT_ABI = [
  // Read functions
  'function getBalance(address user, address token) view returns (uint256)',
  'function getTotalBalanceUSD(address user) view returns (uint256)',
  'function getPurchaseHistory(address user) view returns (tuple(string packageId, string packageType, address token, uint256 amountPaid, uint256 timestamp, bool refunded)[])',
  'function checkPurchased(string packageId, address user) view returns (bool)',
  'function getSupportedStablecoins() view returns (address[], string[])',
  'function getSystemStats(address token) view returns (uint256, uint256, uint256, uint256, uint256)',
  'function getTokenAmount(uint256 priceUSDCents, address token) view returns (uint256)',
  'function platformFeeRate() view returns (uint256)',
  'function supportedStablecoins(address) view returns (bool enabled, uint8 decimals, string symbol)',

  // Write functions
  'function deposit(address token, uint256 amount)',
  'function purchasePackage(string packageId, string packageType, address token, uint256 priceUSD, address seller) returns (uint256)',
  'function directPurchase(string packageId, string packageType, address token, uint256 priceUSD, address seller) returns (uint256)',
  'function withdraw(address token, uint256 amount)',
  'function processWithdrawal()',
  'function cancelWithdrawal()',

  // Events
  'event Deposited(address indexed user, address indexed token, uint256 amount, uint256 newBalance)',
  'event Spent(address indexed user, string packageId, string packageType, address token, uint256 amount, uint256 platformFee)',
  'event DirectWithdrawn(address indexed user, address indexed token, uint256 amount)',
  'event Withdrawn(address indexed user, address indexed token, uint256 amount)',
];

interface StablecoinConfig {
  rpcUrl: string;
  paymentSystemAddress: string;
  privateKey?: string;
  network?: 'mainnet' | 'amoy';
}

interface StablecoinPurchase {
  packageId: string;
  packageType: string;
  token: string;
  amountPaid: string;
  timestamp: number;
  refunded: boolean;
}

interface ContractStablecoinPurchase {
  packageId: string;
  packageType: string;
  token: string;
  amountPaid: bigint;
  timestamp: bigint;
  refunded: boolean;
}

/**
 * Stablecoin Payment System Client
 * Primary payment method for Awareness Network using USDC/USDT
 */
export class StablecoinPaymentClient {
  private provider: ethers.JsonRpcProvider;
  private paymentSystem: ethers.Contract;
  private signer?: ethers.Wallet;
  private network: 'mainnet' | 'amoy';

  constructor(config: StablecoinConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.network = config.network || 'amoy';

    this.paymentSystem = new ethers.Contract(
      config.paymentSystemAddress,
      STABLECOIN_PAYMENT_ABI,
      this.provider
    );

    if (config.privateKey) {
      this.signer = new ethers.Wallet(config.privateKey, this.provider);
      this.paymentSystem = this.paymentSystem.connect(this.signer) as ethers.Contract;
    }
  }

  /**
   * Get stablecoin contract instance
   */
  private getTokenContract(tokenAddress: string): ethers.Contract {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    if (this.signer) {
      return contract.connect(this.signer) as ethers.Contract;
    }
    return contract;
  }

  /**
   * Get USDC address for current network
   */
  getUSDCAddress(): string {
    return STABLECOIN_ADDRESSES[this.network].USDC;
  }

  /**
   * Get USDT address for current network
   */
  getUSDTAddress(): string {
    return STABLECOIN_ADDRESSES[this.network].USDT;
  }

  // ============================================================================
  // Read Operations
  // ============================================================================

  /**
   * Get user's stablecoin balance in payment system
   * @param address User wallet address
   * @param token Stablecoin address (USDC or USDT)
   * @returns Balance in human-readable format
   */
  async getBalance(address: string, token: string): Promise<string> {
    try {
      const balance = await this.paymentSystem.getBalance(address, token);
      // USDC/USDT have 6 decimals
      return ethers.formatUnits(balance, 6);
    } catch (error) {
      logger.error('Failed to get stablecoin balance', { address, token, error });
      throw error;
    }
  }

  /**
   * Get user's total balance across all stablecoins in USD
   */
  async getTotalBalanceUSD(address: string): Promise<string> {
    try {
      const totalCents = await this.paymentSystem.getTotalBalanceUSD(address);
      return (Number(totalCents) / 100).toFixed(2);
    } catch (error) {
      logger.error('Failed to get total USD balance', { address, error });
      throw error;
    }
  }

  /**
   * Get user's wallet balance of a stablecoin (not in payment system)
   */
  async getWalletBalance(address: string, token: string): Promise<string> {
    try {
      const tokenContract = this.getTokenContract(token);
      const balance = await tokenContract.balanceOf(address);
      const decimals = await tokenContract.decimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      logger.error('Failed to get wallet balance', { address, token, error });
      throw error;
    }
  }

  /**
   * Check if user has purchased a package
   */
  async hasPurchased(packageId: string, userAddress: string): Promise<boolean> {
    try {
      return await this.paymentSystem.checkPurchased(packageId, userAddress);
    } catch (error) {
      logger.error('Failed to check purchase status', { packageId, userAddress, error });
      throw error;
    }
  }

  /**
   * Get user's purchase history
   */
  async getPurchaseHistory(address: string): Promise<StablecoinPurchase[]> {
    try {
      const history = await this.paymentSystem.getPurchaseHistory(address);

      return history.map((p: ContractStablecoinPurchase) => ({
        packageId: p.packageId,
        packageType: p.packageType,
        token: p.token,
        amountPaid: ethers.formatUnits(p.amountPaid, 6),
        timestamp: Number(p.timestamp),
        refunded: p.refunded,
      }));
    } catch (error) {
      logger.error('Failed to get purchase history', { address, error });
      throw error;
    }
  }

  /**
   * Get supported stablecoins list
   */
  async getSupportedStablecoins(): Promise<{ address: string; symbol: string }[]> {
    try {
      const [tokens, symbols] = await this.paymentSystem.getSupportedStablecoins();

      return tokens.map((token: string, i: number) => ({
        address: token,
        symbol: symbols[i],
      }));
    } catch (error) {
      logger.error('Failed to get supported stablecoins', { error });
      throw error;
    }
  }

  /**
   * Get token amount for a USD price
   * @param priceUSD Price in USD (e.g., 9.99)
   * @param token Stablecoin address
   * @returns Token amount in native format
   */
  async getTokenAmount(priceUSD: number, token: string): Promise<string> {
    try {
      const priceCents = Math.round(priceUSD * 100);
      const amount = await this.paymentSystem.getTokenAmount(priceCents, token);
      return ethers.formatUnits(amount, 6);
    } catch (error) {
      logger.error('Failed to get token amount', { priceUSD, token, error });
      throw error;
    }
  }

  /**
   * Get platform fee rate
   */
  async getPlatformFeeRate(): Promise<number> {
    try {
      const rate = await this.paymentSystem.platformFeeRate();
      return Number(rate) / 100; // Convert basis points to percentage
    } catch (error) {
      logger.error('Failed to get platform fee rate', { error });
      throw error;
    }
  }

  // ============================================================================
  // Write Operations (require signer)
  // ============================================================================

  /**
   * Deposit stablecoins to payment system
   * @param token Stablecoin address
   * @param amount Amount in human-readable format (e.g., "100.00")
   */
  async deposit(token: string, amount: string): Promise<{ txHash: string; newBalance: string }> {
    if (!this.signer) {
      throw new Error('Signer required for write operations');
    }

    try {
      const tokenContract = this.getTokenContract(token);
      const amountWei = ethers.parseUnits(amount, 6);
      const paymentAddress = await this.paymentSystem.getAddress();

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(
        await this.signer.getAddress(),
        paymentAddress
      );

      // Approve if needed
      if (currentAllowance < amountWei) {
        logger.info('Approving stablecoin transfer', { token, amount });
        const approveTx = await tokenContract.approve(paymentAddress, amountWei);
        await approveTx.wait();
      }

      // Deposit
      logger.info('Depositing stablecoin', { token, amount });
      const depositTx = await this.paymentSystem.deposit(token, amountWei);
      const receipt = await depositTx.wait();

      const newBalance = await this.getBalance(await this.signer.getAddress(), token);

      return {
        txHash: receipt.hash,
        newBalance,
      };
    } catch (error) {
      logger.error('Failed to deposit stablecoin', { token, amount, error });
      throw error;
    }
  }

  /**
   * Purchase package using deposited stablecoin balance
   */
  async purchasePackage(
    packageId: string,
    packageType: string,
    token: string,
    priceUSD: number,
    sellerAddress: string
  ): Promise<{ txHash: string; purchaseId: number }> {
    if (!this.signer) {
      throw new Error('Signer required for write operations');
    }

    try {
      logger.info('Purchasing package with stablecoin', { packageId, packageType, token, priceUSD });

      const priceCents = Math.round(priceUSD * 100);
      const tx = await this.paymentSystem.purchasePackage(
        packageId,
        packageType,
        token,
        priceCents,
        sellerAddress
      );

      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
        purchaseId: 0, // Parse from event if needed
      };
    } catch (error) {
      logger.error('Failed to purchase package', { packageId, error });
      throw error;
    }
  }

  /**
   * Direct purchase without depositing first (approve + purchase in one flow)
   */
  async directPurchase(
    packageId: string,
    packageType: string,
    token: string,
    priceUSD: number,
    sellerAddress: string
  ): Promise<{ txHash: string; purchaseId: number }> {
    if (!this.signer) {
      throw new Error('Signer required for write operations');
    }

    try {
      const tokenContract = this.getTokenContract(token);
      const priceCents = Math.round(priceUSD * 100);
      const tokenAmount = await this.paymentSystem.getTokenAmount(priceCents, token);
      const paymentAddress = await this.paymentSystem.getAddress();

      // Check and approve
      const currentAllowance = await tokenContract.allowance(
        await this.signer.getAddress(),
        paymentAddress
      );

      if (currentAllowance < tokenAmount) {
        logger.info('Approving direct purchase', { token, amount: ethers.formatUnits(tokenAmount, 6) });
        const approveTx = await tokenContract.approve(paymentAddress, tokenAmount);
        await approveTx.wait();
      }

      // Direct purchase
      logger.info('Direct purchasing package', { packageId, packageType, priceUSD });
      const tx = await this.paymentSystem.directPurchase(
        packageId,
        packageType,
        token,
        priceCents,
        sellerAddress
      );

      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
        purchaseId: 0,
      };
    } catch (error) {
      logger.error('Failed direct purchase', { packageId, error });
      throw error;
    }
  }

  /**
   * Withdraw stablecoins from payment system
   */
  async withdraw(token: string, amount: string): Promise<{ txHash: string }> {
    if (!this.signer) {
      throw new Error('Signer required for write operations');
    }

    try {
      const amountWei = ethers.parseUnits(amount, 6);
      const tx = await this.paymentSystem.withdraw(token, amountWei);
      const receipt = await tx.wait();

      return { txHash: receipt.hash };
    } catch (error) {
      logger.error('Failed to withdraw', { token, amount, error });
      throw error;
    }
  }
}

/**
 * Create StablecoinPaymentClient from environment variables
 */
export function createStablecoinPaymentClient(): StablecoinPaymentClient {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.POLYGON_RPC_URL || '';
  const paymentSystemAddress = process.env.STABLECOIN_PAYMENT_ADDRESS || '';
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  const network = (process.env.BLOCKCHAIN_NETWORK || 'amoy') as 'mainnet' | 'amoy';

  if (!rpcUrl) {
    throw new Error('BLOCKCHAIN_RPC_URL or POLYGON_RPC_URL required');
  }

  if (!paymentSystemAddress) {
    throw new Error('STABLECOIN_PAYMENT_ADDRESS required');
  }

  logger.info('Initializing stablecoin payment client', {
    rpcUrl,
    paymentSystem: paymentSystemAddress,
    network,
  });

  return new StablecoinPaymentClient({
    rpcUrl,
    paymentSystemAddress,
    privateKey,
    network,
  });
}

/**
 * Create unified payment client that prefers stablecoins
 * Falls back to $AMEM token system if stablecoin system not configured
 */
export function createPaymentClient(): StablecoinPaymentClient | TokenSystemClient {
  // Prefer stablecoin system
  if (process.env.STABLECOIN_PAYMENT_ADDRESS) {
    return createStablecoinPaymentClient();
  }

  // Fallback to legacy $AMEM system
  return createTokenSystemClient();
}
