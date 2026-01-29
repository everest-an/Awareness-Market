import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Shield, Lock, Loader2, CheckCircle2, Info, Eye, EyeOff } from "lucide-react";

interface ZKPPurchaseButtonProps {
  packageId: string;
  price: number;
  packageName: string;
  disabled?: boolean;
}

export function ZKPPurchaseButton({
  packageId,
  price,
  packageName,
  disabled = false,
}: ZKPPurchaseButtonProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'proof' | 'purchase'>('proof');

  // Proof generation state
  const [proofVector, setProofVector] = useState('');
  const [qualityScore, setQualityScore] = useState(0.9);
  const [threshold, setThreshold] = useState(0.8);
  const [generatedProof, setGeneratedProof] = useState<any>(null);

  // Purchase state
  const [blindingFactor, setBlindingFactor] = useState('');

  // Generate proof mutation
  const generateProofMutation = trpc.zkp.generateQualityProof.useMutation({
    onSuccess: (data) => {
      setGeneratedProof(data.proof);
      toast.success("Quality proof generated!");
      setStep('purchase');
    },
    onError: (error: any) => {
      toast.error(`Proof generation failed: ${error.message}`);
    },
  });

  // Anonymous purchase mutation
  const anonymousPurchaseMutation = trpc.zkp.anonymousPurchase.useMutation({
    onSuccess: (data) => {
      toast.success("Anonymous purchase completed!");
      setOpen(false);
      resetState();
    },
    onError: (error: any) => {
      toast.error(`Purchase failed: ${error.message}`);
    },
  });

  const resetState = () => {
    setStep('proof');
    setProofVector('');
    setGeneratedProof(null);
    setBlindingFactor('');
  };

  const handleGenerateProof = () => {
    try {
      const vector = JSON.parse(proofVector);
      if (!Array.isArray(vector)) {
        toast.error("Vector must be a JSON array of numbers");
        return;
      }
      generateProofMutation.mutate({
        vector,
        qualityScore,
        threshold,
      });
    } catch (error) {
      toast.error("Invalid JSON format");
    }
  };

  const handlePurchase = () => {
    if (!generatedProof || !blindingFactor) {
      toast.error("Please complete all fields");
      return;
    }

    anonymousPurchaseMutation.mutate({
      packageId,
      qualityProof: generatedProof,
      blindedPayment: {
        amount: price,
        blindingFactor,
        commitment: `commitment_${Date.now()}`,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetState();
    }}>
      <DialogTrigger asChild>
        <Button disabled={disabled} className="w-full" variant="outline">
          <Shield className="h-4 w-4 mr-2" />
          Anonymous Purchase (ZKP)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Anonymous Purchase with ZKP
          </DialogTitle>
          <DialogDescription>
            Purchase "{packageName}" anonymously using zero-knowledge proofs
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${step === 'proof' ? 'text-blue-500' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                step === 'proof' ? 'border-blue-500 bg-blue-500/10' : 'border-muted bg-muted/10'
              }`}>
                1
              </div>
              <span className="text-sm font-medium">Generate Proof</span>
            </div>
            <div className="w-12 h-0.5 bg-muted" />
            <div className={`flex items-center gap-2 ${step === 'purchase' ? 'text-blue-500' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                step === 'purchase' ? 'border-blue-500 bg-blue-500/10' : 'border-muted bg-muted/10'
              }`}>
                {generatedProof ? <CheckCircle2 className="h-4 w-4" /> : '2'}
              </div>
              <span className="text-sm font-medium">Complete Purchase</span>
            </div>
          </div>

          {/* Step 1: Generate Proof */}
          {step === 'proof' && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-medium text-blue-500">Step 1: Quality Proof</p>
                    <p className="text-muted-foreground">
                      Prove your vector meets the quality threshold WITHOUT revealing its content.
                      The seller will verify quality but never see your actual vector.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Your Vector (JSON Array)</Label>
                <Textarea
                  placeholder='[0.1, 0.2, 0.3, ..., 0.768]'
                  value={proofVector}
                  onChange={(e) => setProofVector(e.target.value)}
                  className="font-mono text-sm min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quality Score</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={qualityScore}
                    onChange={(e) => setQualityScore(parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Threshold</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <Button
                onClick={handleGenerateProof}
                disabled={generateProofMutation.isPending || !proofVector}
                className="w-full"
              >
                {generateProofMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Proof...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Generate Quality Proof
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 2: Complete Purchase */}
          {step === 'purchase' && (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <div className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-medium text-green-500">Proof Generated Successfully!</p>
                    <p className="text-muted-foreground">
                      Your quality proof is ready. Complete the purchase to acquire the package anonymously.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Package</p>
                  <p className="text-sm font-medium truncate">{packageName}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Price</p>
                  <p className="text-sm font-medium">${price.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Blinding Factor (for payment privacy)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Random string..."
                    value={blindingFactor}
                    onChange={(e) => setBlindingFactor(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setBlindingFactor(Math.random().toString(36).substring(2, 15))}
                  >
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  A random value that blinds your payment commitment
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex gap-2">
                  <Shield className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2 text-xs">
                    <p className="font-medium text-blue-500">Privacy Guarantees</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        Quality Verified
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <EyeOff className="h-3 w-3 mr-1" />
                        Vector Hidden
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Identity Protected
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('proof')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handlePurchase}
                  disabled={anonymousPurchaseMutation.isPending || !blindingFactor}
                  className="flex-1"
                >
                  {anonymousPurchaseMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Complete Purchase (${price.toFixed(2)})
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
