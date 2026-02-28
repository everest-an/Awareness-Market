/**
 * StablecoinPaymentDialog — Stablecoin purchase flow orchestrator
 *
 * This component is responsible ONLY for:
 * - Composing the Dialog shell
 * - Delegating state management to `useStablecoinPayment`
 * - Rendering the correct step sub-component based on the current step
 *
 * Business logic (fee math, balance checks, error classification) lives in
 * `useStablecoinPayment`. Rendering per-step lives in `payment/` sub-components.
 */

import { CircleDollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStablecoinPayment } from '@/hooks/useStablecoinPayment';
import { PaymentStepSelectToken } from './payment/PaymentStepSelectToken';
import { PaymentStepConfirm } from './payment/PaymentStepConfirm';
import {
  PaymentStepProcessing,
  PaymentStepSuccess,
  PaymentStepError,
} from './payment/PaymentStepResult';

// ============================================================================
// Props
// ============================================================================

export interface StablecoinPaymentDialogProps {
  vector: {
    id: number;
    title: string;
    basePrice: string;
    pricingModel: string;
    category: string;
    packageId?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function StablecoinPaymentDialog({
  vector,
  open,
  onOpenChange,
  onSuccess,
}: StablecoinPaymentDialogProps) {
  const packageId = vector.packageId ?? `vector_${vector.id}`;
  const priceUSD = parseFloat(vector.basePrice);

  const payment = useStablecoinPayment({ packageId, packageType: 'vector' });

  /** Called when the dialog is closed — by the user or programmatically */
  const handleClose = () => {
    if (payment.step === 'success') onSuccess();
    payment.reset();
    onOpenChange(false);
  };

  /** Resolve the token balance of the currently selected token */
  const selectedTokenBalance =
    payment.selectedToken === 'USDC'
      ? payment.balanceInfo?.data?.usdcBalance
      : payment.balanceInfo?.data?.usdtBalance;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            Pay with Stablecoin
          </DialogTitle>
          <DialogDescription>
            Purchase with USDC or USDT on Avalanche Network
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Token selection */}
        {(payment.step === 'idle') && (
          <PaymentStepSelectToken
            title={vector.title}
            category={vector.category}
            priceUSD={priceUSD}
            agentWalletAddress={payment.walletInfo?.data?.address}
            usdcBalance={payment.balanceInfo?.data?.usdcBalance}
            usdtBalance={payment.balanceInfo?.data?.usdtBalance}
            onSelect={payment.selectToken}
          />
        )}

        {/* Step 2: Confirm */}
        {payment.step === 'confirm' && (
          <PaymentStepConfirm
            title={vector.title}
            category={vector.category}
            priceUSD={priceUSD}
            selectedToken={payment.selectedToken}
            tokenBalance={selectedTokenBalance}
            quote={payment.quote?.data}
            isQuoteLoading={payment.isQuoteLoading}
            onConfirm={payment.confirmPurchase}
            onBack={payment.goBack}
          />
        )}

        {/* Step 3: Processing */}
        {payment.step === 'processing' && (
          <PaymentStepProcessing selectedToken={payment.selectedToken} />
        )}

        {/* Step 4: Success */}
        {payment.step === 'success' && payment.txHash && (
          <PaymentStepSuccess
            txHash={payment.txHash}
            priceUSD={priceUSD}
            selectedToken={payment.selectedToken}
            onContinue={handleClose}
          />
        )}

        {/* Step 5: Error */}
        {payment.step === 'error' && (
          <PaymentStepError
            message={payment.errorMessage}
            onRetry={payment.retry}
            onCancel={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
