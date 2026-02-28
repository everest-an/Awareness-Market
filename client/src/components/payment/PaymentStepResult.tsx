/**
 * PaymentStepResult — Steps 3–5 of the stablecoin payment flow
 *
 * Handles three terminal/transitional states:
 *   processing — spinner while on-chain tx is in flight
 *   success    — confirmation with explorer link
 *   error      — error message with retry option
 *
 * Keeping all three states in one file avoids prop-drilling `step` through
 * multiple sibling components. Each state is a small, isolated JSX block.
 */

import { AlertCircle, Check, ExternalLink, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { EXPLORER_BASE_URL } from '@/lib/web3/constants';
import type { StablecoinSymbol } from '@/lib/web3/types';

// ============================================================================
// Processing step
// ============================================================================

interface ProcessingProps {
  selectedToken: StablecoinSymbol;
}

export function PaymentStepProcessing({ selectedToken }: ProcessingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <div className="text-center">
        <h3 className="text-lg font-semibold">Processing Payment</h3>
        <p className="text-sm text-muted-foreground mt-1">Executing on-chain transaction…</p>
        <div className="mt-4 space-y-1 text-xs text-muted-foreground">
          <p>1. Approving {selectedToken} spend…</p>
          <p>2. Calling directPurchase on contract…</p>
          <p>3. Waiting for block confirmation…</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Success step
// ============================================================================

interface SuccessProps {
  txHash: string;
  priceUSD: number;
  selectedToken: StablecoinSymbol;
  onContinue: () => void;
}

export function PaymentStepSuccess({ txHash, priceUSD, selectedToken, onContinue }: SuccessProps) {
  const explorerUrl = `${EXPLORER_BASE_URL}/tx/${txHash}`;
  const shortHash = `${txHash.slice(0, 10)}…${txHash.slice(-6)}`;

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
        <Check className="h-8 w-8 text-green-500" />
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold">Purchase Confirmed!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Your on-chain payment has been verified
        </p>
      </div>

      <div className="w-full space-y-3">
        <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">
              ${priceUSD.toFixed(2)} {selectedToken}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Network</span>
            <Badge variant="outline" className="text-xs">
              Avalanche
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tx Hash</span>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline text-xs font-mono"
            >
              {shortHash}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      <DialogFooter className="w-full">
        <Button onClick={onContinue} className="w-full">
          Continue to Download
        </Button>
      </DialogFooter>
    </div>
  );
}

// ============================================================================
// Error step
// ============================================================================

interface ErrorProps {
  message: string | null;
  onRetry: () => void;
  onCancel: () => void;
}

export function PaymentStepError({ message, onRetry, onCancel }: ErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold">Payment Failed</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {message ?? 'Transaction could not be completed'}
        </p>
      </div>

      <DialogFooter className="w-full gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button onClick={onRetry} className="flex-1">
          Try Again
        </Button>
      </DialogFooter>
    </div>
  );
}
