/**
 * useStablecoinPayment — React hook for the stablecoin purchase flow
 *
 * Encapsulates all payment-step state and the tRPC mutation so that
 * `StablecoinPaymentDialog` is reduced to pure UI orchestration.
 *
 * State machine:
 *   idle → confirm → processing → success
 *                              ↘ error → confirm (retry)
 *
 * Usage:
 * ```tsx
 * const payment = useStablecoinPayment({ packageId, packageType });
 * ```
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import type { StablecoinSymbol } from '@/lib/web3/types';

// ============================================================================
// Types
// ============================================================================

export type PaymentStep = 'idle' | 'confirm' | 'processing' | 'success' | 'error';

export interface PaymentState {
  step: PaymentStep;
  selectedToken: StablecoinSymbol;
  txHash: string | null;
  errorMessage: string | null;
}

export interface UseStablecoinPaymentProps {
  packageId: string;
  packageType: 'vector' | 'memory' | 'chain';
}

export interface UseStablecoinPaymentReturn extends PaymentState {
  /** Quote data from the server, undefined while loading */
  quote: ReturnType<typeof trpc.stablecoinPayment.getQuote.useQuery>['data'];
  /** true while fetching the quote */
  isQuoteLoading: boolean;
  /** Agent wallet info */
  walletInfo: ReturnType<typeof trpc.stablecoinPayment.getWallet.useQuery>['data'];
  /** Agent wallet balances */
  balanceInfo: ReturnType<typeof trpc.stablecoinPayment.getBalance.useQuery>['data'];
  /** true while the on-chain tx is in flight */
  isPurchasing: boolean;
  /** Select a token and advance to the confirm step */
  selectToken: (token: StablecoinSymbol) => void;
  /** Confirm and execute the purchase */
  confirmPurchase: () => void;
  /** Go back to the token-selection step */
  goBack: () => void;
  /** Retry after an error — returns to the confirm step */
  retry: () => void;
  /** Reset all state (call on dialog close) */
  reset: () => void;
}

// ============================================================================
// Hook
// ============================================================================

const INITIAL_STATE: PaymentState = {
  step: 'idle',
  selectedToken: 'USDC',
  txHash: null,
  errorMessage: null,
};

export function useStablecoinPayment({
  packageId,
  packageType,
}: UseStablecoinPaymentProps): UseStablecoinPaymentReturn {
  const [state, setState] = useState<PaymentState>(INITIAL_STATE);

  // -- Server queries ----------------------------------------------------------

  const { data: quote, isLoading: isQuoteLoading } =
    trpc.stablecoinPayment.getQuote.useQuery(
      { packageType, packageId, token: state.selectedToken },
      { enabled: state.step !== 'success' }
    );

  const { data: walletInfo } = trpc.stablecoinPayment.getWallet.useQuery();

  const { data: balanceInfo } = trpc.stablecoinPayment.getBalance.useQuery();

  // -- Mutation ----------------------------------------------------------------

  const purchaseMutation = trpc.stablecoinPayment.agentPurchase.useMutation({
    onSuccess: (data) => {
      setState((prev) => ({ ...prev, step: 'success', txHash: data.data.txHash }));
      toast.success('Purchase confirmed on-chain!');
    },
    onError: (error) => {
      setState((prev) => ({
        ...prev,
        step: 'error',
        errorMessage: classifyError(error.message),
      }));
      toast.error('Purchase failed', { description: error.message });
    },
  });

  // -- Actions -----------------------------------------------------------------

  const selectToken = useCallback((token: StablecoinSymbol) => {
    setState((prev) => ({ ...prev, selectedToken: token, step: 'confirm' }));
  }, []);

  const confirmPurchase = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'processing' }));
    purchaseMutation.mutate({ packageType, packageId, token: state.selectedToken });
  }, [packageType, packageId, state.selectedToken]);

  const goBack = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'idle' }));
  }, []);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'confirm', errorMessage: null }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    quote,
    isQuoteLoading,
    walletInfo,
    balanceInfo,
    isPurchasing: purchaseMutation.isPending,
    selectToken,
    confirmPurchase,
    goBack,
    retry,
    reset,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map on-chain and tRPC error messages to user-friendly text.
 *
 * Categorises errors into three buckets:
 *   1. User-rejected (MetaMask popup cancelled)
 *   2. Insufficient balance
 *   3. Generic on-chain / network errors
 *
 * @param raw - Raw error message from the wallet or server
 * @returns User-friendly error string
 */
export function classifyError(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes('user rejected') || lower.includes('user denied')) {
    return 'Transaction was rejected in your wallet.';
  }
  if (lower.includes('insufficient') || lower.includes('balance')) {
    return 'Insufficient balance. Please top up your agent wallet.';
  }
  if (lower.includes('spending limit') || lower.includes('daily limit')) {
    return 'Spending limit exceeded. Increase your limits in wallet settings.';
  }
  if (lower.includes('network') || lower.includes('rpc') || lower.includes('timeout')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Pass-through for all other errors — the raw message is already user-visible
  return raw;
}
