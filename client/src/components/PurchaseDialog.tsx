import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { DollarSign, CreditCard, Shield, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PurchaseDialogProps {
  vector: {
    id: number;
    title: string;
    basePrice: string;
    pricingModel: string;
    category: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PurchaseDialog({ vector, open, onOpenChange, onSuccess }: PurchaseDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const purchaseMutation = trpc.transactions.purchase.useMutation({
    onSuccess: (data) => {
      setIsProcessing(false);
      toast.success("Purchase successful!", {
        description: "You now have access to this AI capability.",
      });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      setIsProcessing(false);
      toast.error("Purchase failed", {
        description: error.message || "Please try again later.",
      });
    },
  });

  const handlePurchase = () => {
    setIsProcessing(true);
    // In production, this should integrate with Stripe Checkout
    // For now, we use a mock payment method ID
    purchaseMutation.mutate({
      vectorId: vector.id,
      paymentMethodId: "pm_card_visa",
    });
  };

  const basePrice = parseFloat(vector.basePrice);
  const platformFee = basePrice * 0.20;
  const total = basePrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Purchase AI Capability</DialogTitle>
          <DialogDescription>
            Complete your purchase to get instant access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Vector Info */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">{vector.title}</h3>
              <Badge variant="secondary">{vector.category}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {vector.pricingModel === "per-call" ? "Pay per API call" : "Monthly subscription"}
            </div>
          </div>

          <Separator />

          {/* Price Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Base Price</span>
              <span className="font-medium">${basePrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Platform Fee (20%)</span>
              <span className="font-medium">${platformFee.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Total</span>
              <div className="flex items-center gap-1">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* What's Included */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">What's Included:</h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>Instant access to latent space vectors</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>Secure API access token</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>Usage analytics and monitoring</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>MCP protocol compatibility</span>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-sm">
            <Shield className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" />
            <div>
              <div className="font-medium text-primary">Secure Payment</div>
              <div className="text-muted-foreground">
                All transactions are encrypted and processed securely through Stripe.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handlePurchase} disabled={isProcessing} className="min-w-[140px]">
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Complete Purchase
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
