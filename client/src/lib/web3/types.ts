/**
 * Web3 / Wallet Type Definitions
 *
 * Shared interfaces and types used across wallet-provider, stablecoin-service,
 * and React hooks. Keeping types in their own file avoids circular imports and
 * makes it easy to generate API docs or share types with tests.
 */

// ============================================================================
// Wallet state
// ============================================================================

/** Snapshot of the wallet's current connection state */
export interface WalletState {
  isConnected: boolean;
  /** The currently active account address, or null if not connected */
  address: string | null;
  /** EVM chain ID of the active network, or null if not connected */
  chainId: number | null;
  /** Human-readable network name provided by ethers.js */
  chainName: string | null;
  /** AVAX balance in ether units (not wei), or null if unknown */
  avaxBalance: string | null;
  /** Last error message, or null if no error */
  error: string | null;
}

/** Initial / disconnected wallet state */
export const INITIAL_WALLET_STATE: WalletState = {
  isConnected: false,
  address: null,
  chainId: null,
  chainName: null,
  avaxBalance: null,
  error: null,
};

// ============================================================================
// Wallet events
// ============================================================================

/** Callbacks fired in response to MetaMask / EIP-1193 events */
export interface WalletCallbacks {
  /** Fired when the active account changes (including disconnect) */
  onAccountsChanged?: (accounts: string[]) => void;
  /** Fired when the active network changes — chainId is hex-encoded */
  onChainChanged?: (chainId: string) => void;
  /** Fired on successful connection */
  onConnect?: (address: string) => void;
  /** Fired on disconnect */
  onDisconnect?: () => void;
}

// ============================================================================
// Stablecoin payment types
// ============================================================================

/** Token symbols supported by the payment system */
export type StablecoinSymbol = 'USDC' | 'USDT';

/** Result of a successful `directPurchase` call */
export interface DirectPurchaseResult {
  txHash: string;
}

// ============================================================================
// EIP-1193 provider type (window.ethereum)
// ============================================================================

/** Minimal EIP-1193 Ethereum provider interface */
export interface EthereumProvider {
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
