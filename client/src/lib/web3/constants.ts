/**
 * Frontend Web3 Constants
 *
 * Client-side equivalent of server/blockchain/constants.ts.
 * Import from here — never inline chain IDs or contract addresses in components.
 *
 * Values are read from Vite environment variables at build time.
 * Server-side contract addresses are intentionally NOT duplicated here;
 * the client gets them via the `stablecoinPayment.getInfo` tRPC query.
 */

// ============================================================================
// Chain IDs
// ============================================================================

/** Avalanche C-Chain mainnet */
export const AVALANCHE_CHAIN_ID = 43114;

/** Avalanche Fuji testnet */
export const FUJI_CHAIN_ID = 43113;

// ============================================================================
// Stablecoin addresses
// ============================================================================

/** Stablecoin ERC-20 addresses per Avalanche network */
export const STABLECOIN_ADDRESSES = {
  mainnet: {
    /** Circle USDC — 6 decimals */
    USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    /** Tether USDT — 6 decimals */
    USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  },
  fuji: {
    USDC: import.meta.env.VITE_USDC_TESTNET_ADDRESS ?? '',
    USDT: import.meta.env.VITE_USDT_TESTNET_ADDRESS ?? '',
  },
} as const;

/** Payment contract address injected at build time */
export const STABLECOIN_PAYMENT_ADDRESS: string =
  import.meta.env.VITE_STABLECOIN_PAYMENT_ADDRESS ?? '';

/** Number of decimals used by USDC and USDT on Avalanche */
export const STABLECOIN_DECIMALS = 6;

// ============================================================================
// Fee constants (must match server/blockchain/constants.ts)
// ============================================================================

/** Platform fee in basis points — used for UI display only, NOT on-chain math */
export const PLATFORM_FEE_BPS = 500;

/** Platform fee as a decimal fraction */
export const PLATFORM_FEE_RATE = PLATFORM_FEE_BPS / 10_000;

// ============================================================================
// ABI fragments — minimal, read-only subset used by the frontend
// ============================================================================

/** Minimal ERC-20 ABI for balance and allowance reads */
export const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;

/** StablecoinPaymentSystem ABI — all methods called from the browser */
export const STABLECOIN_PAYMENT_ABI = [
  'function getBalance(address user, address token) view returns (uint256)',
  'function getTotalBalanceUSD(address user) view returns (uint256)',
  'function checkPurchased(string packageId, address user) view returns (bool)',
  'function getSupportedStablecoins() view returns (address[], string[])',
  'function getTokenAmount(uint256 priceUSDCents, address token) view returns (uint256)',
  'function deposit(address token, uint256 amount)',
  'function directPurchase(string packageId, string packageType, address token, uint256 priceUSD, address seller) returns (uint256)',
  'function withdraw(address token, uint256 amount)',
] as const;

// ============================================================================
// Network configs — used by switchToNetwork()
// ============================================================================

/** Wallet_addEthereumChain parameters for Avalanche Fuji testnet */
export const FUJI_NETWORK_CONFIG = {
  chainId: '0xA869', // 43113 in hex
  chainName: 'Avalanche Fuji Testnet',
  nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
  rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
  blockExplorerUrls: ['https://testnet.snowscan.xyz/'],
} as const;

/** Wallet_addEthereumChain parameters for Avalanche mainnet */
export const AVALANCHE_MAINNET_NETWORK_CONFIG = {
  chainId: '0xA86A', // 43114 in hex
  chainName: 'Avalanche C-Chain',
  nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
  rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
  blockExplorerUrls: ['https://snowscan.xyz/'],
} as const;

/** Snowscan explorer base URL */
export const EXPLORER_BASE_URL = 'https://snowscan.xyz';
