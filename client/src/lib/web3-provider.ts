/**
 * Web3 钱包提供�?- ethers.js 集成
 * 支持 MetaMask 和其他以太坊钱包
 * 
 * 功能:
 * - 自动检测钱�?
 * - 连接/断开钱包
 * - 管理账户和网�?
 * - 监听账户和网络变�?
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

      // 设置事件监听�?
      this.setupEventListeners();

      // 尝试自动连接之前连接的钱�?
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

      // 更新状�?
      await this.updateState(address);

      // 保存连接状�?
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
   * 更新状态信�?
   */
  private async updateState(address: string): Promise<void> {
    if (!this.provider) return;

    try {
      // 获取链信�?
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
   * 切换网络�?Polygon Amoy
   */
  async switchToAmoy(): Promise<void> {
    if (!window.ethereum) {
      throw new Error('MetaMask not detected');
    }

    const amoyChainId = '0x13881'; // Polygon Amoy Chain ID in hex

    try {
      // 尝试切换�?Amoy
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: amoyChainId }],
      });
    } catch (error) {
      const ethError = error as { code?: number };
      // 如果网络不存在，添加�?
      if (ethError.code === 4902) {
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
   * 发送交�?
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
  getContract(address: string, abi: ethers.InterfaceAbi): Contract {
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
   * 设置事件监听�?
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

    window.ethereum.on('connect', (_info: { chainId: string }) => {
      this.state.isConnected = true;
    });

    window.ethereum.on('disconnect', () => {
      this.disconnect();
    });
  }

  /**
   * 获取当前状�?
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
   * 获取链信�?
   */
  getChainInfo(): { chainId: number | null; chainName: string | null } {
    return {
      chainId: this.state.chainId,
      chainName: this.state.chainName,
    };
  }

  /**
   * 是否连接�?Polygon Amoy
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

// ============================================================================
// Stablecoin Payment Support
// ============================================================================

// Contract addresses for Polygon
export const STABLECOIN_ADDRESSES = {
  // Polygon Mainnet
  mainnet: {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  // Polygon Amoy Testnet
  amoy: {
    USDC: import.meta.env.VITE_USDC_TESTNET_ADDRESS || '',
    USDT: import.meta.env.VITE_USDT_TESTNET_ADDRESS || '',
  },
};

export const STABLECOIN_PAYMENT_ADDRESS = import.meta.env.VITE_STABLECOIN_PAYMENT_ADDRESS || '';

// ERC20 ABI for stablecoins
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

// Stablecoin Payment System ABI
const STABLECOIN_PAYMENT_ABI = [
  'function getBalance(address user, address token) view returns (uint256)',
  'function getTotalBalanceUSD(address user) view returns (uint256)',
  'function checkPurchased(string packageId, address user) view returns (bool)',
  'function getSupportedStablecoins() view returns (address[], string[])',
  'function getTokenAmount(uint256 priceUSDCents, address token) view returns (uint256)',
  'function deposit(address token, uint256 amount)',
  'function purchasePackage(string packageId, string packageType, address token, uint256 priceUSD, address seller) returns (uint256)',
  'function directPurchase(string packageId, string packageType, address token, uint256 priceUSD, address seller) returns (uint256)',
  'function withdraw(address token, uint256 amount)',
];

export class StablecoinService {
  private web3Provider: Web3Provider;
  private network: 'mainnet' | 'amoy' = 'amoy';

  constructor(web3Provider: Web3Provider) {
    this.web3Provider = web3Provider;
  }

  setNetwork(network: 'mainnet' | 'amoy'): void {
    this.network = network;
  }

  getUSDCAddress(): string {
    return STABLECOIN_ADDRESSES[this.network].USDC;
  }

  getUSDTAddress(): string {
    return STABLECOIN_ADDRESSES[this.network].USDT;
  }

  /**
   * Get wallet balance of a stablecoin
   */
  async getWalletBalance(token: string): Promise<string> {
    const state = this.web3Provider.getState();
    if (!state.provider || !state.address) {
      throw new Error('Wallet not connected');
    }

    const tokenContract = new ethers.Contract(token, ERC20_ABI, state.provider);
    const balance = await tokenContract.balanceOf(state.address);
    const decimals = await tokenContract.decimals();
    return ethers.formatUnits(balance, decimals);
  }

  /**
   * Get deposited balance in payment system
   */
  async getPaymentBalance(token: string): Promise<string> {
    const state = this.web3Provider.getState();
    if (!state.provider || !state.address) {
      throw new Error('Wallet not connected');
    }

    const paymentContract = new ethers.Contract(
      STABLECOIN_PAYMENT_ADDRESS,
      STABLECOIN_PAYMENT_ABI,
      state.provider
    );
    const balance = await paymentContract.getBalance(state.address, token);
    return ethers.formatUnits(balance, 6);
  }

  /**
   * Check if user has already purchased a package
   */
  async hasPurchased(packageId: string): Promise<boolean> {
    const state = this.web3Provider.getState();
    if (!state.provider || !state.address) {
      throw new Error('Wallet not connected');
    }

    const paymentContract = new ethers.Contract(
      STABLECOIN_PAYMENT_ADDRESS,
      STABLECOIN_PAYMENT_ABI,
      state.provider
    );
    return await paymentContract.checkPurchased(packageId, state.address);
  }

  /**
   * Get token amount for a USD price
   */
  async getTokenAmount(priceUSD: number, token: string): Promise<string> {
    const state = this.web3Provider.getState();
    if (!state.provider) {
      throw new Error('Provider not initialized');
    }

    const paymentContract = new ethers.Contract(
      STABLECOIN_PAYMENT_ADDRESS,
      STABLECOIN_PAYMENT_ABI,
      state.provider
    );
    const priceCents = Math.round(priceUSD * 100);
    const amount = await paymentContract.getTokenAmount(priceCents, token);
    return ethers.formatUnits(amount, 6);
  }

  /**
   * Approve stablecoin spending
   */
  async approve(token: string, amount: string): Promise<string> {
    const state = this.web3Provider.getState();
    if (!state.signer) {
      throw new Error('Wallet not connected');
    }

    const tokenContract = new ethers.Contract(token, ERC20_ABI, state.signer);
    const amountWei = ethers.parseUnits(amount, 6);
    const tx = await tokenContract.approve(STABLECOIN_PAYMENT_ADDRESS, amountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Deposit stablecoins to payment system
   */
  async deposit(token: string, amount: string): Promise<string> {
    const state = this.web3Provider.getState();
    if (!state.signer || !state.address) {
      throw new Error('Wallet not connected');
    }

    // First approve
    const tokenContract = new ethers.Contract(token, ERC20_ABI, state.signer);
    const amountWei = ethers.parseUnits(amount, 6);

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(state.address, STABLECOIN_PAYMENT_ADDRESS);
    if (currentAllowance < amountWei) {
      const approveTx = await tokenContract.approve(STABLECOIN_PAYMENT_ADDRESS, amountWei);
      await approveTx.wait();
    }

    // Deposit
    const paymentContract = new ethers.Contract(
      STABLECOIN_PAYMENT_ADDRESS,
      STABLECOIN_PAYMENT_ABI,
      state.signer
    );
    const tx = await paymentContract.deposit(token, amountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Direct purchase a package (approve + purchase in one flow)
   */
  async directPurchase(
    packageId: string,
    packageType: string,
    token: string,
    priceUSD: number,
    sellerAddress: string
  ): Promise<{ txHash: string }> {
    const state = this.web3Provider.getState();
    if (!state.signer || !state.address) {
      throw new Error('Wallet not connected');
    }

    const tokenContract = new ethers.Contract(token, ERC20_ABI, state.signer);
    const paymentContract = new ethers.Contract(
      STABLECOIN_PAYMENT_ADDRESS,
      STABLECOIN_PAYMENT_ABI,
      state.signer
    );

    const priceCents = Math.round(priceUSD * 100);
    const tokenAmount = await paymentContract.getTokenAmount(priceCents, token);

    // Check and approve
    const currentAllowance = await tokenContract.allowance(state.address, STABLECOIN_PAYMENT_ADDRESS);
    if (currentAllowance < tokenAmount) {
      const approveTx = await tokenContract.approve(STABLECOIN_PAYMENT_ADDRESS, tokenAmount);
      await approveTx.wait();
    }

    // Direct purchase
    const tx = await paymentContract.directPurchase(
      packageId,
      packageType,
      token,
      priceCents,
      sellerAddress
    );
    const receipt = await tx.wait();

    return { txHash: receipt.hash };
  }

  /**
   * Withdraw stablecoins from payment system
   */
  async withdraw(token: string, amount: string): Promise<string> {
    const state = this.web3Provider.getState();
    if (!state.signer) {
      throw new Error('Wallet not connected');
    }

    const paymentContract = new ethers.Contract(
      STABLECOIN_PAYMENT_ADDRESS,
      STABLECOIN_PAYMENT_ABI,
      state.signer
    );
    const amountWei = ethers.parseUnits(amount, 6);
    const tx = await paymentContract.withdraw(token, amountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  }
}

// Stablecoin service singleton
let stablecoinServiceInstance: StablecoinService | null = null;

export function getStablecoinService(): StablecoinService {
  if (!stablecoinServiceInstance) {
    stablecoinServiceInstance = new StablecoinService(getWeb3Provider());
  }
  return stablecoinServiceInstance;
}

// 类型定义
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
