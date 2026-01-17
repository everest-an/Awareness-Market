/**
 * NFT 合约交互模块
 * 处理与 MemoryNFT 合约的所有交互
 */

import { Contract, parseEther } from 'ethers';
import { getWeb3Provider } from './web3-provider';

// MemoryNFT 合约 ABI (核心方法)
const MEMORY_NFT_ABI = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'uri', type: 'string' },
      { name: 'price', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'buyLicense',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getNFTPrice',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLicensePrice',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOwnerRoyalty',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'LicensePurchased',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'price', type: 'uint256', indexed: false },
    ],
  },
];

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export interface NFTInfo {
  tokenId: number;
  owner: string;
  uri: string;
  price: string;
  licensePrice: string;
  royalty: string;
}

export class MemoryNFTManager {
  private contractAddress: string | null = null;
  private contract: Contract | null = null;
  private web3Provider = getWeb3Provider();

  constructor(contractAddress?: string) {
    if (contractAddress) {
      this.setContractAddress(contractAddress);
    }
  }

  /**
   * 设置合约地址
   */
  setContractAddress(address: string) {
    this.contractAddress = address;
    this.contract = this.web3Provider.getContract(address, MEMORY_NFT_ABI);
  }

  /**
   * 获取当前合约地址
   */
  getContractAddress(): string | null {
    return this.contractAddress;
  }

  /**
   * 检查是否已连接合约
   */
  private ensureContractConnected() {
    if (!this.contract || !this.contractAddress) {
      throw new Error('Contract not initialized. Call setContractAddress() first.');
    }
  }

  /**
   * 获取账户的 NFT 余额
   */
  async getBalance(address: string): Promise<number> {
    this.ensureContractConnected();
    try {
      const balance = await this.contract!.balanceOf(address);
      return Number(balance);
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * 获取 NFT 信息
   */
  async getNFTInfo(tokenId: number): Promise<NFTInfo> {
    this.ensureContractConnected();
    try {
      const [owner, uri, price, licensePrice, royalty] = await Promise.all([
        this.contract!.ownerOf(tokenId),
        this.contract!.tokenURI(tokenId),
        this.contract!.getNFTPrice(tokenId),
        this.contract!.getLicensePrice(tokenId),
        this.contract!.getOwnerRoyalty(tokenId),
      ]);

      return {
        tokenId,
        owner,
        uri,
        price: price.toString(),
        licensePrice: licensePrice.toString(),
        royalty: royalty.toString(),
      };
    } catch (error) {
      console.error('Failed to get NFT info:', error);
      throw error;
    }
  }

  /**
   * 购买 NFT 许可证
   */
  async buyLicense(tokenId: number): Promise<string> {
    this.ensureContractConnected();
    try {
      const licensePrice = await this.contract!.getLicensePrice(tokenId);
      
      const tx = await this.contract!.buyLicense(tokenId, {
        value: licensePrice,
      });

      console.log('License purchase transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('License purchase confirmed:', receipt);
      
      return tx.hash;
    } catch (error) {
      console.error('Failed to buy license:', error);
      throw error;
    }
  }

  /**
   * 铸造新 NFT
   */
  async mintNFT(
    to: string,
    metadata: NFTMetadata,
    priceInMatic: number
  ): Promise<string> {
    this.ensureContractConnected();
    try {
      // 将元数据转换为 JSON URI (在实际场景中应该上传到 IPFS)
      const uri = JSON.stringify(metadata);
      const price = parseEther(priceInMatic.toString());

      const tx = await this.contract!.mint(to, uri, price);
      console.log('NFT mint transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('NFT minted:', receipt);
      
      return tx.hash;
    } catch (error) {
      console.error('Failed to mint NFT:', error);
      throw error;
    }
  }

  /**
   * 获取 NFT 总供应量
   */
  async getTotalSupply(): Promise<number> {
    this.ensureContractConnected();
    try {
      const supply = await this.contract!.totalSupply();
      return Number(supply);
    } catch (error) {
      console.error('Failed to get total supply:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有 NFT
   */
  async getUserNFTs(address: string): Promise<NFTInfo[]> {
    this.ensureContractConnected();
    try {
      const balance = await this.getBalance(address);
      const nfts: NFTInfo[] = [];

      // 注意: 这是一个简化的实现
      // 实际应该通过事件或子图来查询
      const totalSupply = await this.getTotalSupply();

      for (let tokenId = 1; tokenId <= totalSupply; tokenId++) {
        try {
          const owner = await this.contract!.ownerOf(tokenId);
          if (owner.toLowerCase() === address.toLowerCase()) {
            const info = await this.getNFTInfo(tokenId);
            nfts.push(info);
          }
        } catch {
          // Token may not exist
          continue;
        }
      }

      return nfts;
    } catch (error) {
      console.error('Failed to get user NFTs:', error);
      throw error;
    }
  }

  /**
   * 监听 NFT 传输事件
   */
  onNFTTransfer(
    callback: (from: string, to: string, tokenId: number) => void
  ): () => void {
    this.ensureContractConnected();
    
    const listener = (from: string, to: string, tokenId: any) => {
      callback(from, to, Number(tokenId));
    };

    this.contract!.on('Transfer', listener);

    // 返回取消监听函数
    return () => {
      this.contract!.off('Transfer', listener);
    };
  }

  /**
   * 监听许可证购买事件
   */
  onLicensePurchased(
    callback: (tokenId: number, buyer: string, price: string) => void
  ): () => void {
    this.ensureContractConnected();
    
    const listener = (tokenId: any, buyer: string, price: any) => {
      callback(Number(tokenId), buyer, price.toString());
    };

    this.contract!.on('LicensePurchased', listener);

    // 返回取消监听函数
    return () => {
      this.contract!.off('LicensePurchased', listener);
    };
  }

  /**
   * 签名消息 (用于验证)
   */
  async signMessage(message: string): Promise<string> {
    try {
      return await this.web3Provider.signMessage(message);
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  }
}

// 创建全局实例
let nftManager: MemoryNFTManager | null = null;

export function getMemoryNFTManager(contractAddress?: string): MemoryNFTManager {
  if (!nftManager) {
    nftManager = new MemoryNFTManager(contractAddress);
  } else if (contractAddress) {
    nftManager.setContractAddress(contractAddress);
  }
  return nftManager;
}
