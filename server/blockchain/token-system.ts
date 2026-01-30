/**
 * $AMEM Token System Integration
 *
 * Provides TypeScript interface for interacting with:
 * - AMEMToken contract
 * - AgentCreditSystem contract
 *
 * This replaces mock payments in AI agent API with real blockchain-based credits
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

      return history.map((p: any) => ({
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
            return this.creditSystem.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e && e.name === 'Deposited');

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
            return this.creditSystem.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e && e.name === 'Spent');

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
