import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Shield,
  Lock,
  ShoppingCart,
  Activity,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Info,
  TrendingUp,
  Zap,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function ZKPDashboard() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Proof Generation State
  const [proofVector, setProofVector] = useState('');
  const [qualityScore, setQualityScore] = useState(0.9);
  const [threshold, setThreshold] = useState(0.8);
  const [generatedProof, setGeneratedProof] = useState<any>(null);

  // Anonymous Purchase State
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [blindingFactor, setBlindingFactor] = useState('');

  // Fetch ZKP stats
  const { data: zkpStats, refetch: refetchStats } = trpc.zkp.getZKPStats.useQuery();

  // Generate proof mutation
  const generateProofMutation = trpc.zkp.generateQualityProof.useMutation({
    onSuccess: (data) => {
      setGeneratedProof(data.proof);
      toast.success("Quality proof generated successfully!");
      refetchStats();
    },
    onError: (error: any) => {
      toast.error(`Proof generation failed: ${error.message}`);
    },
  });

  // Verify proof mutation
  const verifyProofMutation = trpc.zkp.verifyQualityProof.useMutation({
    onSuccess: (data) => {
      if (data.verification.valid) {
        toast.success("Proof verified successfully!");
      } else {
        toast.error(`Proof verification failed: ${data.verification.errorMessage}`);
      }
      refetchStats();
    },
    onError: (error: any) => {
      toast.error(`Verification failed: ${error.message}`);
    },
  });

  // Anonymous purchase mutation
  const anonymousPurchaseMutation = trpc.zkp.anonymousPurchase.useMutation({
    onSuccess: (data) => {
      toast.success("Anonymous purchase completed!");
      setGeneratedProof(null);
      refetchStats();
    },
    onError: (error: any) => {
      toast.error(`Purchase failed: ${error.message}`);
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    setLocation("/auth");
    return null;
  }

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

  const handleVerifyProof = () => {
    if (!generatedProof) {
      toast.error("No proof to verify");
      return;
    }
    verifyProofMutation.mutate({ proof: generatedProof });
  };

  const handleAnonymousPurchase = () => {
    if (!generatedProof) {
      toast.error("Generate a quality proof first");
      return;
    }
    if (!selectedPackageId || !purchaseAmount || !blindingFactor) {
      toast.error("Please fill in all purchase fields");
      return;
    }

    anonymousPurchaseMutation.mutate({
      packageId: selectedPackageId,
      qualityProof: generatedProof,
      blindedPayment: {
        amount: parseFloat(purchaseAmount),
        blindingFactor,
        commitment: `commitment_${Date.now()}`,
      },
    });
  };

  const stats = zkpStats?.stats;
  const circuit = zkpStats?.circuit;

  // Chart data
  const performanceData = [
    { name: 'Proof Gen', time: stats?.averageProofTime || 0 },
    { name: 'Verify', time: stats?.averageVerifyTime || 0 },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <div className="pt-20 border-b border-white/5">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-blue-500" />
                Zero-Knowledge <span className="gradient-text">Proofs</span>
              </h1>
              <p className="text-muted-foreground mt-1">
                Anonymous quality verification and private transactions
              </p>
            </div>
            <Button variant="outline" onClick={() => setLocation("/marketplace")}>
              Back to Marketplace
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Proofs Generated</p>
                  <p className="text-2xl font-bold">{stats?.proofsGenerated || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Proofs Verified</p>
                  <p className="text-2xl font-bold">{stats?.proofsVerified || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{stats?.successRate || '0%'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Zap className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Proof System</p>
                  <p className="text-xl font-bold uppercase">{circuit?.system || 'MOCK'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="generate" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="generate">
              <Lock className="h-4 w-4 mr-2" />
              Generate Proof
            </TabsTrigger>
            <TabsTrigger value="purchase">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Anonymous Purchase
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <Activity className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="circuit">
              <Info className="h-4 w-4 mr-2" />
              Circuit Info
            </TabsTrigger>
          </TabsList>

          {/* Generate Proof Tab */}
          <TabsContent value="generate">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Generate Quality Proof</CardTitle>
                  <CardDescription>
                    Prove vector quality without revealing its content
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Vector (JSON Array)</Label>
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

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <div className="flex gap-2">
                      <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-medium text-blue-500">Zero-Knowledge Guarantee</p>
                        <p className="text-muted-foreground">
                          The proof demonstrates quality ≥ {threshold.toFixed(2)} WITHOUT revealing the vector.
                          Verifiers learn nothing except whether the quality threshold is met.
                        </p>
                      </div>
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
                        Generating...
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Generate Proof
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Proof Result */}
              <Card>
                <CardHeader>
                  <CardTitle>Generated Proof</CardTitle>
                  <CardDescription>
                    {generatedProof ? "Proof ready for verification" : "No proof generated yet"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generatedProof ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Proof System</p>
                          <Badge>{generatedProof.metadata?.system || 'MOCK'}</Badge>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs text-muted-foreground mb-1">Proof Size</p>
                          <p className="text-sm font-medium">
                            {generatedProof.verification?.proofSize || 'N/A'} bytes
                          </p>
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Created At</p>
                        <p className="text-sm font-medium font-mono">
                          {generatedProof.verification?.createdAt || new Date().toISOString()}
                        </p>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Expires At</p>
                        <p className="text-sm font-medium font-mono">
                          {generatedProof.verification?.expiresAt || 'Never'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Commitment Hash</Label>
                        <div className="bg-muted rounded-lg p-2 font-mono text-xs break-all">
                          {generatedProof.commitment || 'N/A'}
                        </div>
                      </div>

                      <Button
                        onClick={handleVerifyProof}
                        disabled={verifyProofMutation.isPending}
                        variant="outline"
                        className="w-full"
                      >
                        {verifyProofMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Verify Proof
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <EyeOff className="h-12 w-12 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">
                        Generate a proof to see its details
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Anonymous Purchase Tab */}
          <TabsContent value="purchase">
            <Card>
              <CardHeader>
                <CardTitle>Anonymous Purchase Wizard</CardTitle>
                <CardDescription>
                  Purchase packages anonymously using zero-knowledge proofs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!generatedProof && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                    <div className="flex gap-2">
                      <Info className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-500">Proof Required</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Generate a quality proof first to proceed with anonymous purchase.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Package ID</Label>
                    <Input
                      placeholder="pkg_abc123..."
                      value={selectedPackageId}
                      onChange={(e) => setSelectedPackageId(e.target.value)}
                      disabled={!generatedProof}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Payment Amount (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="14.99"
                      value={purchaseAmount}
                      onChange={(e) => setPurchaseAmount(e.target.value)}
                      disabled={!generatedProof}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Blinding Factor (Random String)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Random string for privacy..."
                      value={blindingFactor}
                      onChange={(e) => setBlindingFactor(e.target.value)}
                      disabled={!generatedProof}
                    />
                    <Button
                      variant="outline"
                      onClick={() => setBlindingFactor(Math.random().toString(36).substring(2))}
                      disabled={!generatedProof}
                    >
                      Generate
                    </Button>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex gap-2">
                    <Shield className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-blue-500">Privacy Guarantee</p>
                      <p className="text-muted-foreground">
                        Your purchase will be anonymous. The seller receives payment without learning your identity,
                        and you prove quality threshold compliance without revealing the vector.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="outline" className="text-xs">
                          <Eye className="h-3 w-3 mr-1" />
                          Quality Verified
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Identity Hidden
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          ZKP Protected
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleAnonymousPurchase}
                  disabled={
                    anonymousPurchaseMutation.isPending ||
                    !generatedProof ||
                    !selectedPackageId ||
                    !purchaseAmount ||
                    !blindingFactor
                  }
                  className="w-full"
                >
                  {anonymousPurchaseMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing Purchase...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Complete Anonymous Purchase
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>Average proof generation and verification times</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="name" stroke="#666" />
                        <YAxis stroke="#666" label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }} />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="time" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Statistics</CardTitle>
                  <CardDescription>Current ZKP system status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Status</p>
                      <Badge variant="outline" className="text-green-500">
                        {zkpStats?.info?.status || 'Unknown'}
                      </Badge>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Proof System</p>
                      <Badge>{circuit?.system || 'MOCK'}</Badge>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-2">Description</p>
                    <p className="text-sm">
                      {zkpStats?.info?.description || 'Zero-Knowledge Proof system for anonymous quality verification'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Circuit Info Tab */}
          <TabsContent value="circuit">
            <Card>
              <CardHeader>
                <CardTitle>Circuit Information</CardTitle>
                <CardDescription>Details about the ZKP circuit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Constraints</p>
                    <p className="text-2xl font-bold">{circuit?.constraints?.toLocaleString() || 0}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Wires</p>
                    <p className="text-2xl font-bold">{circuit?.wires?.toLocaleString() || 0}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Public Inputs</p>
                    <p className="text-2xl font-bold">{circuit?.publicInputs || 0}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Private Inputs</p>
                    <p className="text-2xl font-bold">{circuit?.privateInputs || 0}</p>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex gap-2">
                    <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-blue-500">How It Works</p>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Prover computes witness for quality threshold circuit</li>
                        <li>Circuit generates cryptographic proof using {circuit?.system || 'MOCK'} system</li>
                        <li>Verifier checks proof without learning vector content</li>
                        <li>Proof size: ~128-512 bytes (depending on system)</li>
                        <li>Verification time: ~5-20ms</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
