/**
 * Web3 Wallet Provider - ethers.js Integration
 * Supports MetaMask and other Ethereum wallets
 * 
 * Features:
 * - Auto-detect wallet
 * - Connect/Disconnect wallet
 * - Manage accounts and network
 * - Listen for account and network changes
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
   * Initialize provider
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined' || !window.ethereum) {
      this.state.error = 'Ethereum wallet (MetaMask) not detected';
      throw new Error('MetaMask not detected');
    }

    try {
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.state.provider = this.provider;

      // Set up event listeners
      this.setupEventListeners();

      // Try to auto-connect the previously connected wallet
      await this.checkConnection();
    } catch (error) {
      this.state.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * Connect wallet
   */
  async connect(): Promise<string> {
    if (!this.provider) {
      await this.initialize();
    }

    try {
      // Request user connection
      const accounts = await window.ethereum!.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      this.signer = await this.provider!.getSigner();
      this.state.signer = this.signer;

      // Update state
      await this.updateState(address);

      // Save connection state
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
   * Disconnect wallet
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
   * Check connection
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
   * Update state information
   */
  private async updateState(address: string): Promise<void> {
    if (!this.provider) return;

    try {
      // Get chain information
      const network = await this.provider.getNetwork();
      this.state.chainId = Number(network.chainId);
      this.state.chainName = network.name;

      // Get balance
      const balance = await this.provider.getBalance(address);
      this.state.balance = ethers.formatEther(balance);

      // Update address
      this.state.address = address;
      this.state.isConnected = true;
      this.state.error = null;
    } catch (error) {
      this.state.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * Switch to Polygon Amoy Network
   */
  async switchToAmoy(): Promise<void> {
    if (!window.ethereum) {
      throw new Error('MetaMask not detected');
    }

    const amoyChainId = '0x13881'; // Polygon Amoy Chain ID in hex

    try {
      // Attempt to switch to Amoy
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: amoyChainId }],
      });
    } catch (error) {
      const ethError = error as { code?: number };
      // If network does not exist, add it
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

        // Retry switch
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: amoyChainId }],
        });
      } else {
        throw error;
      }
    }

    // Refresh network info
    if (this.state.address) {
      await this.updateState(this.state.address);
    }
  }

  /**
   * Sign message
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
   * Send transaction
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
   * Get contract instance
   */
  getContract(address: string, abi: ethers.InterfaceAbi): Contract {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    return new ethers.Contract(address, abi, this.signer);
  }

  /**
   * Set event callbacks
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
   * Set up event listeners
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
   * Get current state
   */
  getState(): WalletState {
    return { ...this.state };
  }

  /**
   * Get account
   */
  getAddress(): string | null {
    return this.state.address;
  }

  /**
   * Get balance
   */
  getBalance(): string | null {
    return this.state.balance;
  }

  /**
   * Get chain info
   */
  getChainInfo(): { chainId: number | null; chainName: string | null } {
    return {
      chainId: this.state.chainId,
      chainName: this.state.chainName,
    };
  }

  /**
   * Is connected to Polygon Amoy
   */
  isOnAmoy(): boolean {
    return this.state.chainId === 80002; // Polygon Amoy Chain ID
  }
}

// Singleton instance
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

// Type definitions
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
