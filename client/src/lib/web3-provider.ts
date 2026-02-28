/**
 * @file web3-provider.ts — Backwards-compatibility re-exports
 *
 * This file previously contained both `Web3Provider` and `StablecoinService`
 * in a single 669-line module. They have been split into focused files:
 *
 *   lib/web3/wallet-provider.ts   — Web3Provider class + getWeb3Provider()
 *   lib/web3/stablecoin-service.ts — StablecoinService class + getStablecoinService()
 *   lib/web3/constants.ts          — Chain IDs, addresses, ABIs, fee constants
 *   lib/web3/types.ts              — WalletState, WalletCallbacks, etc.
 *
 * All existing imports of the form:
 *   import { Web3Provider } from '@/lib/web3-provider'
 * continue to work via the re-exports below.
 *
 * New code should import from the specific sub-module directly.
 */

export { Web3Provider, getWeb3Provider } from './web3/wallet-provider';
export { StablecoinService, getStablecoinService } from './web3/stablecoin-service';
export { STABLECOIN_ADDRESSES, STABLECOIN_PAYMENT_ADDRESS } from './web3/constants';
export type { WalletState, WalletCallbacks, StablecoinSymbol } from './web3/types';
