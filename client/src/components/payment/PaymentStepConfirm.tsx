/**
 * PaymentStepConfirm — Step 2 of the stablecoin payment flow
 *
 * Shows the price breakdown, balance warning, and "What's Included" list.
 * Calls `onConfirm` when the user approves the purchase.
 *
 * All fee math is derived from the server quote — the component does NOT
 * compute fees itself. This ensures UI totals always match on-chain amounts.
 */

import { AlertCircle, Check, Loader2, Shield, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import type { StablecoinSymbol } from '@/lib/web3/types';

const INCLUDED_FEATURES = [
  'Instant access to latent space vectors',
  'On-chain purchase proof (Avalanche)',
  'Usage analytics and monitoring',
  'MCP protocol compatibility',
];

interface QuoteData {
  tokenAmount: string;
  platformFee: string;
  sellerReceives: string;
}

interface PaymentStepConfirmProps {
  title: string;
  category: string;
  priceUSD: number;
  selectedToken: StablecoinSymbol;
  /** Token balance of the selected stablecoin in the agent wallet */
  tokenBalance: string | undefined;
  /** Quote from the server; undefined while loading */
  quote: QuoteData | undefined;
  isQuoteLoading: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function PaymentStepConfirm({
  title,
  category,
  priceUSD,
  selectedToken,
  tokenBalance,
  quote,
  isQuoteLoading,
  onConfirm,
  onBack,
}: PaymentStepConfirmProps) {
  // Balance check uses the server-calculated token amount for accuracy.
  // Fall back to priceUSD if the quote hasn't arrived yet.
  const tokenAmountNeeded = quote ? parseFloat(quote.tokenAmount) : priceUSD;
  const hasInsufficientBalance =
    !!tokenBalance && parseFloat(tokenBalance) < tokenAmountNeeded;

  return (
    <div className="space-y-4 py-4">
      {/* Package header */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <h3 className="font-semibold mb-1">{title}</h3>
        <Badge variant="secondary">{category}</Badge>
      </div>

      <Separator />

      {/* Price breakdown — derived from server quote, never computed here */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Package Price</span>
          <span className="font-medium">${priceUSD.toFixed(2)}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Platform Fee (5%)</span>
          <span className="font-medium">
            {quote ? `${parseFloat(quote.platformFee).toFixed(2)} ${selectedToken}` : '—'}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Payment Token</span>
          <Badge variant="outline">{selectedToken}</Badge>
        </div>

        {isQuoteLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Fetching on-chain quote…
          </div>
        ) : quote && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Token Amount</span>
            <span className="font-medium">
              {parseFloat(quote.tokenAmount).toFixed(2)} {selectedToken}
            </span>
          </div>
        )}

        <Separator />

        {/* Total */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Total</span>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">${priceUSD.toFixed(2)}</div>
            {quote && (
              <div className="text-xs text-muted-foreground">
                ≈ {parseFloat(quote.tokenAmount).toFixed(2)} {selectedToken}
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Insufficient balance warning */}
      {hasInsufficientBalance && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive flex-shrink-0" />
          <div>
            <div className="font-medium text-destructive">Insufficient Balance</div>
            <div className="text-muted-foreground">
              You need {tokenAmountNeeded.toFixed(2)} {selectedToken} but only have{' '}
              {parseFloat(tokenBalance!).toFixed(2)}. Deposit more {selectedToken} to your agent
              wallet.
            </div>
          </div>
        </div>
      )}

      {/* What's included */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">What's Included:</h4>
        {INCLUDED_FEATURES.map((item) => (
          <div key={item} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-sm">
        <Shield className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" />
        <div>
          <div className="font-medium text-primary">On-Chain Payment</div>
          <div className="text-muted-foreground">
            Transaction executed on Avalanche via StablecoinPaymentSystem. 5% platform fee,
            seller receives 95%.
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isQuoteLoading || hasInsufficientBalance}
          className="min-w-[160px]"
        >
          <Wallet className="mr-2 h-4 w-4" />
          Pay with {selectedToken}
        </Button>
      </DialogFooter>
    </div>
  );
}
