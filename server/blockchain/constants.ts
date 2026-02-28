/**
 * Blockchain Constants
 *
 * Single source of truth for all on-chain constants used by the Awareness Market
 * backend. Import from here — never redeclare in individual files.
 *
 * Network: Avalanche C-Chain (mainnet 43114 / Fuji testnet 43113)
 */

// ============================================================================
// Chain IDs
// ============================================================================

/** Avalanche C-Chain mainnet */
export const AVALANCHE_CHAIN_ID = 43114;

/** Avalanche Fuji testnet */
export const FUJI_CHAIN_ID = 43113;

// ============================================================================
// Stablecoin Addresses
// ============================================================================

/** Stablecoin ERC-20 addresses per network */
export const STABLECOIN_ADDRESSES = {
  mainnet: {
    /** USDC on Avalanche mainnet — 6 decimals */
    USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    /** USDT on Avalanche mainnet — 6 decimals */
    USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  },
  fuji: {
    USDC: process.env.USDC_TESTNET_ADDRESS || '',
    USDT: process.env.USDT_TESTNET_ADDRESS || '',
  },
} as const;

/** Number of decimals used by USDC and USDT on Avalanche */
export const STABLECOIN_DECIMALS = 6;

/** Avalanche native gas token decimals */
export const AVAX_DECIMALS = 18;

// ============================================================================
// Contract Addresses
// ============================================================================

/**
 * StablecoinPaymentSystem contract address.
 * Resolved from env at startup; falls back to deployed mainnet address.
 */
export const PAYMENT_CONTRACT_ADDRESS: string =
  process.env.STABLECOIN_PAYMENT_ADDRESS ||
  process.env.STABLECOIN_CONTRACT_ADDRESS ||
  '0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8';

/**
 * Platform treasury address — receives platform fees when sellers have no wallet.
 * Intentionally kept server-side only to reduce phishing attack surface.
 */
export const PLATFORM_TREASURY_ADDRESS: string =
  process.env.PLATFORM_TREASURY_ADDRESS ||
  '0x3d0ab53241A2913D7939ae02f7083169fE7b823B';

// ============================================================================
// Fee Configuration
// ============================================================================

/**
 * Platform fee in basis points (1 bp = 0.01%).
 * 500 bps = 5% — matches StablecoinPaymentSystem.sol.
 *
 * WHY basis points: avoids floating-point drift when computing fees on-chain
 * and keeps server-side calculation consistent with Solidity integer math.
 */
export const PLATFORM_FEE_BPS = 500;

/** Convenience scalar: platform fee as a decimal fraction (0.05) */
export const PLATFORM_FEE_RATE = PLATFORM_FEE_BPS / 10_000;

// ============================================================================
// ABI Fragments — Minimal "human-readable" ABIs
// ============================================================================

/**
 * Minimal ERC-20 ABI — only functions needed for balance/approve flows.
 * Keeping it minimal reduces the chance of calling unintended contract methods.
 */
export const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;

/**
 * StablecoinPaymentSystem ABI.
 * Includes all methods called by the server router and agent-wallet service.
 */
export const PAYMENT_ABI = [
  'function directPurchase(string packageId, string packageType, address token, uint256 priceUSD, address seller) returns (uint256)',
  'function deposit(address token, uint256 amount)',
  'function withdraw(address token, uint256 amount)',
  'function getBalance(address user, address token) view returns (uint256)',
  'function getTotalBalanceUSD(address user) view returns (uint256)',
  'function getTokenAmount(uint256 priceUSDCents, address token) view returns (uint256)',
  'function checkPurchased(string packageId, address user) view returns (bool)',
  'event Spent(address indexed user, string packageId, string packageType, address token, uint256 amount, uint256 platformFee)',
] as const;

// ============================================================================
// Spending Limit Defaults
// ============================================================================

/** Default per-day USD spending ceiling for agent custody wallets */
export const DEFAULT_DAILY_SPEND_LIMIT_USD = 500;

/** Default per-transaction USD ceiling for agent custody wallets */
export const DEFAULT_PER_TX_SPEND_LIMIT_USD = 100;

// ============================================================================
// Misc
// ============================================================================

/** Quote validity window in seconds — used in getQuote response */
export const QUOTE_TTL_SECONDS = 300;

/** Snowscan explorer base URL (mainnet) */
export const EXPLORER_BASE_URL = 'https://snowscan.xyz';
