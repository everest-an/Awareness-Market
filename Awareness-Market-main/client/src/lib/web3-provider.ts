/**
 * Web3 钱包提供商 - ethers.js 集成
 * 支持 MetaMask 和其他以太坊钱包
 * 
 * 功能:
 * - 自动检测钱包
 * - 连接/断开钱包
 * - 管理账户和网络
 * - 监听账户和网络变化
 */

import { ethers, BrowserProvider, Contract } from 'ethers';

export type WalletProvider = BrowserProvider | null;
export type WalletSigner = ethers.Signer | null;

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  chainName: string | null;
  balance: string | null;
  provider: WalletProvider;
  signer: WalletSigner;
  error: string | null;
  isOnAmoy?: boolean;
}

export interface WalletCallbacks {
  onAccountsChanged?: (accounts: string[]) => void;
  onChainChanged?: (chainId: string) => void;
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export class Web3Provider {
  private provider: WalletProvider = null;
  private signer: WalletSigner = null;
  private state: WalletState;
  private callbacks: WalletCallbacks = {};

  constructor() {
    this.state = {
      isConnected: false,
      address: null,
      chainId: null,
      chainName: null,
      balance: null,
      provider: null,
      signer: null,
      error: null,
    };
  }

  /**
   * 初始化提供商
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined' || !window.ethereum) {
      this.state.error = '未检测到以太坊钱包（MetaMask）';
      throw new Error('MetaMask not detected');
    }

    try {
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.state.provider = this.provider;

      // 设置事件监听器
      this.setupEventListeners();

      // 尝试自动连接之前连接的钱包
      await this.checkConnection();
    } catch (error) {
      this.state.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * 连接钱包
   */
  async connect(): Promise<string> {
    if (!this.provider) {
      await this.initialize();
    }

    try {
      // 请求用户连接
      const accounts = await window.ethereum!.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      this.signer = await this.provider!.getSigner();
      this.state.signer = this.signer;

      // 更新状态
      await this.updateState(address);

      // 保存连接状态
      localStorage.setItem('walletConnected', 'true');
      localStorage.setItem('walletAddress', address);

      if (this.callbacks.onConnect) {
        this.callbacks.onConnect(address);
      }

      return address;
    } catch (error) {
      this.state.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * 断开钱包连接
   */
  async disconnect(): Promise<void> {
    this.provider = null;
    this.signer = null;
    this.state = {
      isConnected: false,
      address: null,
      chainId: null,
      chainName: null,
      balance: null,
      provider: null,
      signer: null,
      error: null,
    };

    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletAddress');

    if (this.callbacks.onDisconnect) {
      this.callbacks.onDisconnect();
    }
  }

  /**
   * 检查是否已连接
   */
  async checkConnection(): Promise<boolean> {
    if (!this.provider) {
      return false;
    }

    try {
      const accounts = await this.provider.listAccounts();

      if (accounts && accounts.length > 0) {
        const address = accounts[0].address;
        this.signer = await this.provider.getSigner();
        this.state.signer = this.signer;
        await this.updateState(address);
        this.state.isConnected = true;
        return true;
      }
    } catch (error) {
      console.error('Connection check failed:', error);
    }

    return false;
  }

  /**
   * 更新状态信息
   */
  private async updateState(address: string): Promise<void> {
    if (!this.provider) return;

    try {
      // 获取链信息
      const network = await this.provider.getNetwork();
      this.state.chainId = Number(network.chainId);
      this.state.chainName = network.name;

      // 获取余额
      const balance = await this.provider.getBalance(address);
      this.state.balance = ethers.formatEther(balance);

      // 更新地址
      this.state.address = address;
      this.state.isConnected = true;
      this.state.error = null;
    } catch (error) {
      this.state.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * 切换网络到 Polygon Amoy
   */
  async switchToAmoy(): Promise<void> {
    if (!window.ethereum) {
      throw new Error('MetaMask not detected');
    }

    const amoyChainId = '0x13881'; // Polygon Amoy Chain ID in hex

    try {
      // 尝试切换到 Amoy
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: amoyChainId }],
      });
    } catch (error: any) {
      // 如果网络不存在，添加它
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: amoyChainId,
              chainName: 'Polygon Amoy',
              nativeCurrency: {
                name: 'POL',
                symbol: 'POL',
                decimals: 18,
              },
              rpcUrls: ['https://rpc-amoy.polygon.technology/'],
              blockExplorerUrls: ['https://amoy.polygonscan.com/'],
            },
          ],
        });

        // 重新尝试切换
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: amoyChainId }],
        });
      } else {
        throw error;
      }
    }

    // 刷新网络信息
    if (this.state.address) {
      await this.updateState(this.state.address);
    }
  }

  /**
   * 签署消息
   */
  async signMessage(message: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature = await this.signer.signMessage(message);
      return signature;
    } catch (error) {
      this.state.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * 发送交易
   */
  async sendTransaction(to: string, value: string, data?: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.signer.sendTransaction({
        to,
        value: ethers.parseEther(value),
        data,
      });

      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      this.state.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * 获取合约实例
   */
  getContract(address: string, abi: any): Contract {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    return new ethers.Contract(address, abi, this.signer);
  }

  /**
   * 设置事件回调
   */
  onAccountsChanged(callback: (accounts: string[]) => void): void {
    this.callbacks.onAccountsChanged = callback;
  }

  onChainChanged(callback: (chainId: string) => void): void {
    this.callbacks.onChainChanged = callback;
  }

  onConnect(callback: (address: string) => void): void {
    this.callbacks.onConnect = callback;
  }

  onDisconnect(callback: () => void): void {
    this.callbacks.onDisconnect = callback;
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        this.state.address = accounts[0];
        if (this.callbacks.onAccountsChanged) {
          this.callbacks.onAccountsChanged(accounts);
        }
      }
    });

    window.ethereum.on('chainChanged', (chainId: string) => {
      this.state.chainId = parseInt(chainId, 16);
      if (this.callbacks.onChainChanged) {
        this.callbacks.onChainChanged(chainId);
      }
    });

    window.ethereum.on('connect', (info: any) => {
      this.state.isConnected = true;
    });

    window.ethereum.on('disconnect', () => {
      this.disconnect();
    });
  }

  /**
   * 获取当前状态
   */
  getState(): WalletState {
    return { ...this.state };
  }

  /**
   * 获取账户
   */
  getAddress(): string | null {
    return this.state.address;
  }

  /**
   * 获取余额
   */
  getBalance(): string | null {
    return this.state.balance;
  }

  /**
   * 获取链信息
   */
  getChainInfo(): { chainId: number | null; chainName: string | null } {
    return {
      chainId: this.state.chainId,
      chainName: this.state.chainName,
    };
  }

  /**
   * 是否连接到 Polygon Amoy
   */
  isOnAmoy(): boolean {
    return this.state.chainId === 80002; // Polygon Amoy Chain ID
  }
}

// 单例实例
let instance: Web3Provider | null = null;

export function getWeb3Provider(): Web3Provider {
  if (!instance) {
    instance = new Web3Provider();
  }
  return instance;
}

// 类型定义
declare global {
  interface Window {
    ethereum?: any;
  }
}
