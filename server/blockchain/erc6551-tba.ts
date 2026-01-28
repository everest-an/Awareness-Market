/**
 * ERC-6551 Token Bound Account (TBA) Integration
 * 
 * Implements ERC-6551 standard for creating smart contract accounts
 * owned by NFTs. Each Memory NFT gets its own TBA that can:
 * - Hold assets (tokens, other NFTs)
 * - Execute transactions
 * - Interact with DeFi protocols
 * - Track ownership history
 * 
 * Reference: https://eips.ethereum.org/EIPS/eip-6551
 */

import { ethers } from 'ethers';
import { createLogger } from './utils/logger';

const logger = createLogger('ERC6551');

// ============================================================================
// Types
// ============================================================================

export interface TBAConfig {
  registryAddress: string;
  implementationAddress: string;
  chainId: number;
  rpcUrl: string;
  privateKey?: string;
}

export interface TBAAccount {
  address: string;
  nftContract: string;
  tokenId: string;
  chainId: number;
  salt: number;
  createdAt: Date;
  owner: string;
}

export interface TBATransaction {
  id: string;
  tbaAddress: string;
  to: string;
  value: string;
  data: string;
  executed: boolean;
  executedAt?: Date;
  txHash?: string;
}

// ============================================================================
// ERC-6551 Registry ABI (simplified)
// ============================================================================

const ERC6551_REGISTRY_ABI = [
  'function createAccount(address implementation, uint256 chainId, address tokenContract, uint256 tokenId, uint256 salt, bytes calldata initData) external returns (address)',
  'function account(address implementation, uint256 chainId, address tokenContract, uint256 tokenId, uint256 salt) external view returns (address)',
];

// ============================================================================
// ERC-6551 Account ABI (simplified)
// ============================================================================

const ERC6551_ACCOUNT_ABI = [
  'function executeCall(address to, uint256 value, bytes calldata data) external payable returns (bytes memory)',
  'function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId)',
  'function owner() external view returns (address)',
  'function nonce() external view returns (uint256)',
];

// ============================================================================
// ERC-6551 TBA Manager
// ============================================================================

export class ERC6551TBAManager {
  private provider: ethers.JsonRpcProvider;
  private signer?: ethers.Wallet;
  private registry: ethers.Contract;
  private config: TBAConfig;
  
  constructor(config: TBAConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    if (config.privateKey) {
      this.signer = new ethers.Wallet(config.privateKey, this.provider);
    }
    
    this.registry = new ethers.Contract(
      config.registryAddress,
      ERC6551_REGISTRY_ABI,
      this.signer || this.provider
    );
  }
  
  /**
   * Compute TBA address without deploying
   */
  async computeTBAAddress(
    nftContract: string,
    tokenId: string,
    salt: number = 0
  ): Promise<string> {
    return await this.registry.account(
      this.config.implementationAddress,
      this.config.chainId,
      nftContract,
      tokenId,
      salt
    );
  }
  
  /**
   * Create Token Bound Account for an NFT
   */
  async createTBA(
    nftContract: string,
    tokenId: string,
    salt: number = 0,
    initData: string = '0x'
  ): Promise<TBAAccount> {
    if (!this.signer) {
      throw new Error('Signer required to create TBA');
    }
    
    // Create account
    const tx = await this.registry.createAccount(
      this.config.implementationAddress,
      this.config.chainId,
      nftContract,
      tokenId,
      salt,
      initData
    );
    
    const receipt = await tx.wait();
    
    // Compute TBA address
    const tbaAddress = await this.computeTBAAddress(nftContract, tokenId, salt);
    
    // Get NFT owner
    const nftContractInstance = new ethers.Contract(
      nftContract,
      ['function ownerOf(uint256 tokenId) view returns (address)'],
      this.provider
    );
    const owner = await nftContractInstance.ownerOf(tokenId);
    
    return {
      address: tbaAddress,
      nftContract,
      tokenId,
      chainId: this.config.chainId,
      salt,
      createdAt: new Date(),
      owner,
    };
  }
  
  /**
   * Get TBA details
   */
  async getTBA(
    nftContract: string,
    tokenId: string,
    salt: number = 0
  ): Promise<TBAAccount | null> {
    try {
      const tbaAddress = await this.computeTBAAddress(nftContract, tokenId, salt);
      
      // Check if TBA exists (has code)
      const code = await this.provider.getCode(tbaAddress);
      if (code === '0x') {
        return null; // TBA not deployed yet
      }
      
      // Get TBA contract
      const tbaContract = new ethers.Contract(
        tbaAddress,
        ERC6551_ACCOUNT_ABI,
        this.provider
      );
      
      // Get owner
      const owner = await tbaContract.owner();
      
      return {
        address: tbaAddress,
        nftContract,
        tokenId,
        chainId: this.config.chainId,
        salt,
        createdAt: new Date(), // Would need to get from events in production
        owner,
      };
    } catch (error) {
      logger.error('Error getting TBA:', error);
      return null;
    }
  }
  
  /**
   * Execute transaction from TBA
   */
  async executeTBATransaction(
    tbaAddress: string,
    to: string,
    value: bigint,
    data: string
  ): Promise<TBATransaction> {
    if (!this.signer) {
      throw new Error('Signer required to execute TBA transaction');
    }
    
    const tbaContract = new ethers.Contract(
      tbaAddress,
      ERC6551_ACCOUNT_ABI,
      this.signer
    );
    
    // Execute call
    const tx = await tbaContract.executeCall(to, value, data);
    const receipt = await tx.wait();
    
    return {
      id: receipt.hash,
      tbaAddress,
      to,
      value: value.toString(),
      data,
      executed: true,
      executedAt: new Date(),
      txHash: receipt.hash,
    };
  }
  
  /**
   * Get TBA balance
   */
  async getTBABalance(tbaAddress: string): Promise<bigint> {
    return await this.provider.getBalance(tbaAddress);
  }
  
  /**
   * Get TBA owner (NFT owner)
   */
  async getTBAOwner(tbaAddress: string): Promise<string> {
    const tbaContract = new ethers.Contract(
      tbaAddress,
      ERC6551_ACCOUNT_ABI,
      this.provider
    );
    
    return await tbaContract.owner();
  }
  
  /**
   * Check if address is a TBA
   */
  async isTBA(address: string): Promise<boolean> {
    try {
      const tbaContract = new ethers.Contract(
        address,
        ERC6551_ACCOUNT_ABI,
        this.provider
      );
      
      // Try to call token() - if it succeeds, it's a TBA
      await tbaContract.token();
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get NFT info from TBA
   */
  async getTBANFTInfo(tbaAddress: string): Promise<{
    chainId: number;
    tokenContract: string;
    tokenId: bigint;
  }> {
    const tbaContract = new ethers.Contract(
      tbaAddress,
      ERC6551_ACCOUNT_ABI,
      this.provider
    );
    
    const [chainId, tokenContract, tokenId] = await tbaContract.token();
    
    return {
      chainId: Number(chainId),
      tokenContract,
      tokenId,
    };
  }
}

// ============================================================================
// Memory NFT TBA Integration
// ============================================================================

export interface MemoryNFT {
  id: string;
  contractAddress: string;
  tokenId: string;
  owner: string;
  tbaAddress?: string;
  metadata: {
    name: string;
    description: string;
    memoryType: 'kv-cache' | 'w-matrix' | 'reasoning-chain';
    epsilon?: number;
    certification?: string;
  };
}

export class MemoryNFTManager {
  private tbaManager: ERC6551TBAManager;
  
  constructor(tbaManager: ERC6551TBAManager) {
    this.tbaManager = tbaManager;
  }
  
  /**
   * Mint Memory NFT with TBA
   */
  async mintMemoryNFT(
    nftContract: string,
    tokenId: string,
    metadata: MemoryNFT['metadata']
  ): Promise<MemoryNFT> {
    // Create TBA for this NFT
    const tba = await this.tbaManager.createTBA(nftContract, tokenId);
    
    return {
      id: `${nftContract}-${tokenId}`,
      contractAddress: nftContract,
      tokenId,
      owner: tba.owner,
      tbaAddress: tba.address,
      metadata,
    };
  }
  
  /**
   * Get Memory NFT with TBA info
   */
  async getMemoryNFT(
    nftContract: string,
    tokenId: string
  ): Promise<MemoryNFT | null> {
    const tba = await this.tbaManager.getTBA(nftContract, tokenId);
    
    if (!tba) {
      return null;
    }
    
    // In production, fetch metadata from IPFS or database
    return {
      id: `${nftContract}-${tokenId}`,
      contractAddress: nftContract,
      tokenId,
      owner: tba.owner,
      tbaAddress: tba.address,
      metadata: {
        name: 'Memory NFT',
        description: 'Latent memory asset',
        memoryType: 'kv-cache',
      },
    };
  }
  
  /**
   * Transfer royalties to TBA
   */
  async transferRoyaltyToTBA(
    tbaAddress: string,
    amount: bigint
  ): Promise<void> {
    // In production, this would transfer tokens to TBA
    logger.info(`Transferring ${amount} to TBA ${tbaAddress}`);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createTBAManager(config: TBAConfig): ERC6551TBAManager {
  return new ERC6551TBAManager(config);
}

export function createMemoryNFTManager(
  tbaManager: ERC6551TBAManager
): MemoryNFTManager {
  return new MemoryNFTManager(tbaManager);
}

// ============================================================================
// Default Configurations
// ============================================================================

export const TESTNET_CONFIGS = {
  // Polygon Mumbai Testnet
  mumbai: {
    registryAddress: '0x02101dfB77FDE026414827Fdc604ddAF224F0921',
    implementationAddress: '0x2D25602551487C3f3354dD80D76D54383A243358',
    chainId: 80001,
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
  },
  
  // Ethereum Sepolia Testnet
  sepolia: {
    registryAddress: '0x02101dfB77FDE026414827Fdc604ddAF224F0921',
    implementationAddress: '0x2D25602551487C3f3354dD80D76D54383A243358',
    chainId: 11155111,
    rpcUrl: 'https://rpc.sepolia.org',
  },
  
  // Base Sepolia Testnet
  baseSepolia: {
    registryAddress: '0x02101dfB77FDE026414827Fdc604ddAF224F0921',
    implementationAddress: '0x2D25602551487C3f3354dD80D76D54383A243358',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
  },
};
