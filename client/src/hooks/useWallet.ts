/**
 * useWallet — React hook for wallet connection state
 *
 * Bridges the framework-agnostic `Web3Provider` class and React's rendering
 * model. Components should use this hook instead of calling `getWeb3Provider()`
 * directly so they re-render on state changes.
 *
 * Usage:
 * ```tsx
 * const { isConnected, address, connect, disconnect } = useWallet();
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { getWeb3Provider } from '@/lib/web3/wallet-provider';
import type { WalletState } from '@/lib/web3/types';
import { INITIAL_WALLET_STATE } from '@/lib/web3/types';

interface UseWalletReturn extends WalletState {
  /** Connect MetaMask; triggers popup if not already connected */
  connect: () => Promise<void>;
  /** Disconnect and reset state */
  disconnect: () => void;
  /** Switch to Avalanche Fuji testnet */
  switchToFuji: () => Promise<void>;
  /** true while a connect / switch network action is in flight */
  isPending: boolean;
}

export function useWallet(): UseWalletReturn {
  const provider = getWeb3Provider();
  const [state, setState] = useState<WalletState>(() => provider.getState());
  const [isPending, setIsPending] = useState(false);

  // Sync provider state into React state on mount and when events fire
  useEffect(() => {
    // Register callbacks that push state changes into React
    provider.onConnect(() => setState(provider.getState()));
    provider.onDisconnect(() => setState({ ...INITIAL_WALLET_STATE }));
    provider.onAccountsChanged(() => setState(provider.getState()));
    provider.onChainChanged(() => setState(provider.getState()));

    // Try to restore an existing connection without prompting the user
    provider.initialize().catch(() => {
      // MetaMask not installed — leave state as disconnected
    });

    return () => {
      // No formal removeListener API on the class; callbacks will be overwritten
      // on the next mount. This is acceptable for a singleton provider.
    };
  }, []);

  const connect = useCallback(async () => {
    setIsPending(true);
    try {
      await provider.connect();
      setState(provider.getState());
    } finally {
      setIsPending(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    provider.disconnect();
    setState({ ...INITIAL_WALLET_STATE });
  }, []);

  const switchToFuji = useCallback(async () => {
    setIsPending(true);
    try {
      await provider.switchToAvalancheFuji();
      setState(provider.getState());
    } finally {
      setIsPending(false);
    }
  }, []);

  return { ...state, connect, disconnect, switchToFuji, isPending };
}
