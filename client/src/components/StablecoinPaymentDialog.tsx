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
import { 
  Wallet, 
  Shield, 
  Check, 
  Loader2, 
  ExternalLink,
  Copy,
  AlertCircle,
  ArrowRight,
  CircleDollarSign,
} from "lucide-react";
import { toast } from "sonner";

interface StablecoinPaymentDialogProps {
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

type PaymentStep = "select-token" | "confirm" | "processing" | "success" | "error";
type TokenType = "USDC" | "USDT";

export function StablecoinPaymentDialog({ 
  vector, 
  open, 
  onOpenChange, 
  onSuccess 
}: StablecoinPaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>("select-token");
  const [selectedToken, setSelectedToken] = useState<TokenType>("USDC");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const packageId = vector.packageId || `vector_${vector.id}`;

  // Get quote
  const { data: quote, isLoading: quoteLoading } = trpc.stablecoinPayment.getQuote.useQuery(
    {
      packageType: "vector",
      packageId,
      token: selectedToken,
    },
    { enabled: open && step !== "success" }
  );

  // Get wallet info  
  const { data: walletInfo } = trpc.stablecoinPayment.getWallet.useQuery(
    undefined,
    { enabled: open }
  );

  // Get balance
  const { data: balanceInfo } = trpc.stablecoinPayment.getBalance.useQuery(
    undefined,
    { enabled: open }
  );

  // Agent purchase mutation
  const purchaseMutation = trpc.stablecoinPayment.agentPurchase.useMutation({
    onSuccess: (data) => {
      setTxHash(data.data.txHash);
      setStep("success");
      toast.success("Purchase completed on-chain!");
    },
    onError: (error) => {
      setErrorMessage(error.message);
      setStep("error");
      toast.error("Purchase failed", { description: error.message });
    },
  });

  const handleSelectToken = (token: TokenType) => {
    setSelectedToken(token);
    setStep("confirm");
  };

  const handleConfirmPurchase = () => {
    setStep("processing");
    purchaseMutation.mutate({
      packageType: "vector",
      packageId,
      token: selectedToken,
    });
  };

  const handleClose = () => {
    if (step === "success") {
      onSuccess();
    }
    setStep("select-token");
    setTxHash(null);
    setErrorMessage(null);
    onOpenChange(false);
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success("Address copied!");
  };

  const basePrice = parseFloat(vector.basePrice);
  const platformFee = basePrice * 0.05;
  const total = basePrice;

  const tokenBalance = selectedToken === "USDC" 
    ? balanceInfo?.data?.usdcBalance 
    : balanceInfo?.data?.usdtBalance;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            Pay with Stablecoin
          </DialogTitle>
          <DialogDescription>
            Purchase with USDC or USDT on Polygon Network
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select Token */}
        {step === "select-token" && (
          <div className="space-y-4 py-4">
            {/* Package info */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{vector.title}</h3>
                <Badge variant="secondary">{vector.category}</Badge>
              </div>
              <div className="text-2xl font-bold text-primary">${total.toFixed(2)}</div>
            </div>

            <Separator />

            {/* Token selection */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Select Payment Token</h4>
              
              <button
                onClick={() => handleSelectToken("USDC")}
                className="w-full flex items-center justify-between p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <span className="font-bold text-blue-500 text-sm">USDC</span>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">USD Coin</div>
                    <div className="text-xs text-muted-foreground">Circle • Polygon</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {balanceInfo?.data && (
                    <span className="text-sm text-muted-foreground">
                      {parseFloat(balanceInfo.data.usdcBalance).toFixed(2)} available
                    </span>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>

              <button
                onClick={() => handleSelectToken("USDT")}
                className="w-full flex items-center justify-between p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <span className="font-bold text-green-500 text-sm">USDT</span>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Tether USD</div>
                    <div className="text-xs text-muted-foreground">Tether • Polygon</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {balanceInfo?.data && (
                    <span className="text-sm text-muted-foreground">
                      {parseFloat(balanceInfo.data.usdtBalance).toFixed(2)} available
                    </span>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            </div>

            {/* Agent wallet info */}
            {walletInfo?.data && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <Wallet className="h-3 w-3" />
                <span>Agent Wallet: {walletInfo.data.address.slice(0, 6)}...{walletInfo.data.address.slice(-4)}</span>
                <button onClick={() => copyAddress(walletInfo.data.address)} className="ml-auto">
                  <Copy className="h-3 w-3 hover:text-primary" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="font-semibold mb-1">{vector.title}</h3>
              <Badge variant="secondary">{vector.category}</Badge>
            </div>

            <Separator />

            {/* Price breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium">${basePrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee (5%)</span>
                <span className="font-medium">${platformFee.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Payment Token</span>
                <Badge variant="outline">{selectedToken}</Badge>
              </div>
              {quoteLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Getting quote...
                </div>
              ) : quote?.data && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Token Amount</span>
                  <span className="font-medium">{parseFloat(quote.data.tokenAmount).toFixed(2)} {selectedToken}</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">Total</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">${total.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">
                    ≈ {quote?.data ? parseFloat(quote.data.tokenAmount).toFixed(2) : total.toFixed(2)} {selectedToken}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Balance check */}
            {tokenBalance && parseFloat(tokenBalance) < total && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 text-destructive flex-shrink-0" />
                <div>
                  <div className="font-medium text-destructive">Insufficient Balance</div>
                  <div className="text-muted-foreground">
                    You need {total.toFixed(2)} {selectedToken} but only have {parseFloat(tokenBalance).toFixed(2)}.
                    Deposit more {selectedToken} to your agent wallet.
                  </div>
                </div>
              </div>
            )}

            {/* What's included */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">What's Included:</h4>
              {["Instant access to latent space vectors", "On-chain purchase proof (Polygon)", "Usage analytics and monitoring", "MCP protocol compatibility"].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 text-primary" />
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
                  Transaction executed on Polygon via StablecoinPaymentSystem smart contract.
                  5% platform fee, seller receives 95%.
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("select-token")}>
                Back
              </Button>
              <Button 
                onClick={handleConfirmPurchase}
                disabled={quoteLoading || (!!tokenBalance && parseFloat(tokenBalance) < total)}
                className="min-w-[160px]"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Pay with {selectedToken}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Processing Payment</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Executing on-chain transaction...
              </p>
              <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                <p>1. Approving {selectedToken} spend ✓</p>
                <p>2. Calling directPurchase on contract...</p>
                <p>3. Waiting for block confirmation...</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "success" && txHash && (
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
                  <span className="font-medium">${total.toFixed(2)} {selectedToken}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <Badge variant="outline" className="text-xs">Polygon</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tx Hash</span>
                  <a 
                    href={`https://polygonscan.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline text-xs font-mono"
                  >
                    {txHash.slice(0, 10)}...{txHash.slice(-6)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            <DialogFooter className="w-full">
              <Button onClick={handleClose} className="w-full">
                Continue to Download
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 5: Error */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Payment Failed</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {errorMessage || "Transaction could not be completed"}
              </p>
            </div>

            <DialogFooter className="w-full gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={() => setStep("confirm")} className="flex-1">
                Try Again
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
