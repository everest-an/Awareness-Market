/**
 * Web3Provider — MetaMask / EIP-1193 Wallet Adapter
 *
 * Wraps `ethers.BrowserProvider` (ethers.js v6) to manage:
 * - Wallet connection / disconnection
 * - Account and network change events
 * - Network switching (add + switch in one call)
 * - Message signing and raw transaction sending
 *
 * This class is intentionally framework-agnostic — it contains no React
 * imports. Reactive integration is handled by `useWallet.ts`.
 */

import { ethers, BrowserProvider } from 'ethers';
import type { WalletState, WalletCallbacks } from './types';
import { INITIAL_WALLET_STATE } from './types';
import { FUJI_CHAIN_ID, FUJI_NETWORK_CONFIG } from './constants';

export class Web3Provider {
  private browserProvider: BrowserProvider | null = null;
  private _state: WalletState = { ...INITIAL_WALLET_STATE };
  private callbacks: WalletCallbacks = {};

  // --------------------------------------------------------------------------
  // Connection lifecycle
  // --------------------------------------------------------------------------

  /**
   * Initialise the ethers BrowserProvider from `window.ethereum`.
   * Sets up EIP-1193 event listeners for account and chain changes.
   *
   * @throws Error if MetaMask (or compatible wallet) is not installed
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined' || !window.ethereum) {
      this._state.error = 'No Ethereum wallet detected. Please install MetaMask.';
      throw new Error('MetaMask not detected');
    }

    this.browserProvider = new ethers.BrowserProvider(window.ethereum);
    this.setupEventListeners();
    await this.refreshConnection();
  }

  /**
   * Request wallet connection and update internal state.
   *
   * Calls `eth_requestAccounts` — triggers the MetaMask popup if not already
   * connected. Persists connection intent to `localStorage` so `initialize()`
   * can auto-reconnect on page reload.
   *
   * @returns The connected account address
   * @throws Error if the user rejects the connection request
   */
  async connect(): Promise<string> {
    if (!this.browserProvider) await this.initialize();

    const accounts = (await window.ethereum!.request({
      method: 'eth_requestAccounts',
    })) as string[];

    if (!accounts.length) throw new Error('No accounts found');

    const address = accounts[0];
    await this.updateState(address);

    localStorage.setItem('walletConnected', 'true');
    localStorage.setItem('walletAddress', address);

    this.callbacks.onConnect?.(address);
    return address;
  }

  /**
   * Disconnect the wallet and reset all state.
   * Removes the persisted connection intent from localStorage.
   */
  disconnect(): void {
    this.browserProvider = null;
    this._state = { ...INITIAL_WALLET_STATE };

    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletAddress');

    this.callbacks.onDisconnect?.();
  }

  // --------------------------------------------------------------------------
  // Network management
  // --------------------------------------------------------------------------

  /**
   * Switch MetaMask to the specified EVM chain.
   *
   * If the network is unknown to MetaMask (error 4902), it is added first
   * using `wallet_addEthereumChain` and then switched.
   *
   * @param chainId     - Target chain ID as a hex string (e.g. '0xA869')
   * @param networkConfig - Parameters for `wallet_addEthereumChain` if needed
   */
  async switchToNetwork(
    chainId: string,
    networkConfig: typeof FUJI_NETWORK_CONFIG
  ): Promise<void> {
    if (!window.ethereum) throw new Error('MetaMask not detected');

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
    } catch (error) {
      const ethError = error as { code?: number };
      // Error 4902: network not yet added to MetaMask
      if (ethError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [networkConfig],
        });
        // Retry the switch after adding
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId }],
        });
      } else {
        throw error;
      }
    }

    // Refresh state after a successful network switch
    if (this._state.address) await this.updateState(this._state.address);
  }

  /**
   * Convenience helper: switch to Avalanche Fuji testnet.
   *
   * Delegates to `switchToNetwork` with the hardcoded Fuji config so
   * callers don't need to import network constants directly.
   */
  async switchToAvalancheFuji(): Promise<void> {
    await this.switchToNetwork(FUJI_NETWORK_CONFIG.chainId, FUJI_NETWORK_CONFIG);
  }

  // --------------------------------------------------------------------------
  // Signing & transactions
  // --------------------------------------------------------------------------

  /**
   * Sign an arbitrary message with the connected wallet.
   *
   * @param message - Plain-text or EIP-191 prefixed message to sign
   * @returns Hex-encoded ECDSA signature
   * @throws Error if no wallet is connected
   */
  async signMessage(message: string): Promise<string> {
    const signer = await this.getSigner();
    return signer.signMessage(message);
  }

  /**
   * Send a native AVAX transfer transaction.
   *
   * @param to    - Recipient address
   * @param value - Amount in AVAX (ether units, NOT wei)
   * @param data  - Optional calldata hex
   * @returns Transaction hash
   */
  async sendTransaction(to: string, value: string, data?: string): Promise<string> {
    const signer = await this.getSigner();
    const tx = await signer.sendTransaction({
      to,
      value: ethers.parseEther(value),
      data,
    });
    const receipt = await tx.wait();
    return receipt?.hash ?? '';
  }

  /**
   * Return a `Contract` instance connected to the current signer.
   *
   * @param address - Contract address
   * @param abi     - ethers-compatible ABI
   */
  getContract(address: string, abi: ethers.InterfaceAbi): ethers.Contract {
    if (!this.browserProvider) throw new Error('Wallet not connected');
    // Returning a read-only provider-bound contract; callers needing to sign
    // should call `getSigner()` and bind themselves.
    return new ethers.Contract(address, abi, this.browserProvider);
  }

  // --------------------------------------------------------------------------
  // State accessors
  // --------------------------------------------------------------------------

  /** Snapshot of the current wallet state (immutable copy) */
  getState(): Readonly<WalletState> {
    return { ...this._state };
  }

  /** Active account address, or null */
  getAddress(): string | null {
    return this._state.address;
  }

  /** AVAX balance in ether units, or null */
  getAvaxBalance(): string | null {
    return this._state.avaxBalance;
  }

  /** Chain ID + name of the active network */
  getChainInfo(): { chainId: number | null; chainName: string | null } {
    return { chainId: this._state.chainId, chainName: this._state.chainName };
  }

  /**
   * Whether the wallet is currently connected to Avalanche Fuji testnet.
   * Use this to gate testnet-only UI paths.
   */
  isOnAvalancheFuji(): boolean {
    return this._state.chainId === FUJI_CHAIN_ID;
  }

  /** Expose the underlying ethers BrowserProvider for advanced use cases */
  getBrowserProvider(): BrowserProvider | null {
    return this.browserProvider;
  }

  // --------------------------------------------------------------------------
  // Event callbacks
  // --------------------------------------------------------------------------

  onAccountsChanged(cb: (accounts: string[]) => void): void {
    this.callbacks.onAccountsChanged = cb;
  }

  onChainChanged(cb: (chainId: string) => void): void {
    this.callbacks.onChainChanged = cb;
  }

  onConnect(cb: (address: string) => void): void {
    this.callbacks.onConnect = cb;
  }

  onDisconnect(cb: () => void): void {
    this.callbacks.onDisconnect = cb;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /** Try to restore an existing connection without prompting the user */
  private async refreshConnection(): Promise<boolean> {
    if (!this.browserProvider) return false;
    try {
      const accounts = await this.browserProvider.listAccounts();
      if (accounts.length > 0) {
        await this.updateState(accounts[0].address);
        return true;
      }
    } catch {
      // No active connection — silently ignore
    }
    return false;
  }

  /**
   * Fetch on-chain state (network, balance) and merge into `this._state`.
   *
   * @param address - The account address to query
   */
  private async updateState(address: string): Promise<void> {
    if (!this.browserProvider) return;

    const network = await this.browserProvider.getNetwork();
    const balanceWei = await this.browserProvider.getBalance(address);

    this._state = {
      isConnected: true,
      address,
      chainId: Number(network.chainId),
      chainName: network.name,
      avaxBalance: ethers.formatEther(balanceWei),
      error: null,
    };
  }

  /** Register EIP-1193 event listeners on `window.ethereum` */
  private setupEventListeners(): void {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', ((accounts: string[]) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        this._state.address = accounts[0];
        this.callbacks.onAccountsChanged?.(accounts);
      }
    }) as (...args: unknown[]) => void);

    window.ethereum.on('chainChanged', ((chainId: string) => {
      this._state.chainId = parseInt(chainId, 16);
      this.callbacks.onChainChanged?.(chainId);
    }) as (...args: unknown[]) => void);

    window.ethereum.on('disconnect', () => {
      this.disconnect();
    });
  }

  /** Return an ethers.Signer; throws if not connected */
  async getSigner(): Promise<ethers.Signer> {
    if (!this.browserProvider) throw new Error('Wallet not connected');
    return this.browserProvider.getSigner();
  }
}

// ============================================================================
// Module-level singleton
// ============================================================================

let _instance: Web3Provider | null = null;

/**
 * Return the shared `Web3Provider` singleton.
 * Safe to call multiple times — always returns the same instance.
 */
export function getWeb3Provider(): Web3Provider {
  if (!_instance) _instance = new Web3Provider();
  return _instance;
}
