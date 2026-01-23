import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Zap, Shield, Anchor, Network } from 'lucide-react';

export default function LatentMASv2Demo() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="container py-8 mt-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">LatentMAS v2 Features Demo</h1>
          <p className="text-muted-foreground">
            Interactive demonstrations of the 4 core v2 enhancements: KV-Cache Compression, Dynamic W-Matrix, 
            Anti-Poisoning Verification, and Semantic Anchors.
          </p>
        </div>

        <Tabs defaultValue="kv-cache" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="kv-cache">
              <Zap className="w-4 h-4 mr-2" />
              KV-Cache
            </TabsTrigger>
            <TabsTrigger value="w-matrix">
              <Network className="w-4 h-4 mr-2" />
              W-Matrix
            </TabsTrigger>
            <TabsTrigger value="anti-poisoning">
              <Shield className="w-4 h-4 mr-2" />
              Anti-Poisoning
            </TabsTrigger>
            <TabsTrigger value="semantic-anchors">
              <Anchor className="w-4 h-4 mr-2" />
              Semantic Anchors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kv-cache">
            <KVCacheDemo />
          </TabsContent>

          <TabsContent value="w-matrix">
            <WMatrixDemo />
          </TabsContent>

          <TabsContent value="anti-poisoning">
            <AntiPoisoningDemo />
          </TabsContent>

          <TabsContent value="semantic-anchors">
            <SemanticAnchorsDemo />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// KV-Cache Compression Demo
function KVCacheDemo() {
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionResult, setCompressionResult] = useState<any>(null);

  const { mutate: compress } = trpc.latentmasV2.kvCache.compress.useMutation({
    onSuccess: (data) => {
      setCompressionResult(data);
      setIsCompressing(false);
    },
    onError: (error) => {
      console.error('Compression failed:', error);
      setIsCompressing(false);
    },
  });

  const handleCompress = () => {
    setIsCompressing(true);
    setCompressionResult(null);

    // Generate sample KV-Cache data
    const numTokens = 100;
    const dim = 64;
    const keys = Array.from({ length: numTokens }, () =>
      Array.from({ length: dim }, () => Math.random() * 2 - 1)
    );
    const values = Array.from({ length: numTokens }, () =>
      Array.from({ length: dim }, () => Math.random() * 2 - 1)
    );
    const queries = Array.from({ length: 5 }, () =>
      Array.from({ length: dim }, () => Math.random() * 2 - 1)
    );

    compress({
      keys,
      values,
      queries,
      config: {
        attentionThreshold: 0.90,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>KV-Cache Compression</CardTitle>
        <CardDescription>
          Compress KV-Cache using attention-based token selection. Only transmits tokens with {'>'}90% cumulative attention.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Button onClick={handleCompress} disabled={isCompressing}>
            {isCompressing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Compress Sample KV-Cache
          </Button>
        </div>

        {compressionResult && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>
                Compression successful! Reduced from {compressionResult.stats.originalTokens} to{' '}
                {compressionResult.stats.compressedTokens} tokens.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Compression Ratio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {(compressionResult.stats.compressionRatio * 100).toFixed(1)}%
                  </div>
                  <Progress 
                    value={compressionResult.stats.compressionRatio * 100} 
                    className="mt-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Bandwidth Savings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {((1 - compressionResult.stats.compressionRatio) * 100).toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Cumulative Attention: {(compressionResult.stats.cumulativeAttention * 100).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Statistics</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Original Tokens:</div>
                <div className="font-mono">{compressionResult.stats.originalTokens}</div>
                <div>Compressed Tokens:</div>
                <div className="font-mono">{compressionResult.stats.compressedTokens}</div>
                <div>Tokens Removed:</div>
                <div className="font-mono">
                  {compressionResult.stats.originalTokens - compressionResult.stats.compressedTokens}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// W-Matrix Alignment Demo
function WMatrixDemo() {
  const [sourceModel, setSourceModel] = useState('gpt-3.5-turbo');
  const [targetModel, setTargetModel] = useState('gpt-4');
  const [matrixId, setMatrixId] = useState<string | null>(null);
  const [alignmentResult, setAlignmentResult] = useState<any>(null);

  const { mutate: createMatrix, isPending: isCreating } = trpc.latentmasV2.wMatrix.create.useMutation({
    onSuccess: (data) => {
      setMatrixId(data.matrixId);
    },
  });

  const { mutate: alignVector, isPending: isAligning } = trpc.latentmasV2.wMatrix.align.useMutation({
    onSuccess: (data) => {
      setAlignmentResult(data.result);
    },
  });

  const handleCreateMatrix = () => {
    createMatrix({
      sourceModel,
      targetModel,
      sourceDim: 1536,
      targetDim: 3072,
    });
  };

  const handleAlign = () => {
    if (!matrixId) return;

    // Generate sample vector
    const vector = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);

    alignVector({
      matrixId,
      vector,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dynamic W-Matrix Alignment</CardTitle>
        <CardDescription>
          Create W-Matrix for cross-model vector alignment using adaptive MLP architecture.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Source Model</label>
            <select
              className="w-full mt-1 p-2 border rounded"
              value={sourceModel}
              onChange={(e) => setSourceModel(e.target.value)}
            >
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (1536D)</option>
              <option value="text-embedding-ada-002">Ada-002 (1536D)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Target Model</label>
            <select
              className="w-full mt-1 p-2 border rounded"
              value={targetModel}
              onChange={(e) => setTargetModel(e.target.value)}
            >
              <option value="gpt-4">GPT-4 (3072D)</option>
              <option value="text-embedding-3-large">Embedding-3-Large (3072D)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleCreateMatrix} disabled={isCreating || !!matrixId}>
            {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {matrixId ? 'Matrix Created' : 'Create W-Matrix'}
          </Button>

          {matrixId && (
            <Button onClick={handleAlign} disabled={isAligning} variant="secondary">
              {isAligning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Align Sample Vector
            </Button>
          )}
        </div>

        {matrixId && (
          <Alert>
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>
              W-Matrix created successfully! ID: <code className="text-xs">{matrixId}</code>
            </AlertDescription>
          </Alert>
        )}

        {alignmentResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Aligned Vector</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{alignmentResult.alignedVector.length}D</div>
                  <p className="text-xs text-muted-foreground mt-1">Dimension</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Confidence</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(alignmentResult.confidence * 100).toFixed(1)}%
                  </div>
                  <Progress value={alignmentResult.confidence * 100} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Alignment Loss</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{alignmentResult.alignmentLoss.toFixed(4)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Lower is better</p>
                </CardContent>
              </Card>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Transformation Path</h4>
              <div className="flex flex-wrap gap-2">
                {alignmentResult.transformationPath.map((layer: string, i: number) => (
                  <Badge key={i} variant="secondary">
                    {layer}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Anti-Poisoning Verification Demo
function AntiPoisoningDemo() {
  const [challenge, setChallenge] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const { mutate: generateChallenge, isPending: isGenerating } =
    trpc.latentmasV2.antiPoisoning.generateChallenge.useMutation({
      onSuccess: (data) => {
        setChallenge(data.challenge);
        setVerificationResult(null);
      },
    });

  const { mutate: verify, isPending: isVerifying } = trpc.latentmasV2.antiPoisoning.verify.useMutation({
    onSuccess: (data) => {
      setVerificationResult(data.result);
    },
  });

  const handleGenerateChallenge = () => {
    generateChallenge({
      config: {
        challengeSize: 10,
      },
    });
  };

  const handleVerify = () => {
    if (!challenge) return;

    // Generate mock vector outputs (in real scenario, seller provides these)
    const vectorOutputs = challenge.testPrompts.map(() =>
      Array.from({ length: 128 }, () => Math.random() * 2 - 1)
    );

    verify({
      challengeId: challenge.id,
      vectorOutputs,
      nonce: challenge.nonce,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anti-Poisoning Verification</CardTitle>
        <CardDescription>
          Proof-of-Latent-Fidelity (PoLF) mechanism to detect poisoned vectors using challenge-response verification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={handleGenerateChallenge} disabled={isGenerating}>
            {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Generate Challenge
          </Button>

          {challenge && (
            <Button onClick={handleVerify} disabled={isVerifying} variant="secondary">
              {isVerifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Verify (Mock Response)
            </Button>
          )}
        </div>

        {challenge && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>
                Challenge generated! ID: <code className="text-xs">{challenge.id.substring(0, 16)}...</code>
              </AlertDescription>
            </Alert>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Test Prompts ({challenge.testPrompts.length})</h4>
              <div className="space-y-2">
                {challenge.testPrompts.slice(0, 3).map((prompt: string, i: number) => (
                  <div key={i} className="text-sm p-2 bg-background rounded">
                    {i + 1}. {prompt}
                  </div>
                ))}
                {challenge.testPrompts.length > 3 && (
                  <div className="text-sm text-muted-foreground">
                    ... and {challenge.testPrompts.length - 3} more prompts
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {verificationResult && (
          <div className="space-y-4">
            <Alert variant={verificationResult.passed ? 'default' : 'destructive'}>
              {verificationResult.passed ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <AlertDescription>
                {verificationResult.passed
                  ? 'Verification passed! Vector is authentic.'
                  : 'Verification failed! Potential poisoning detected.'}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Fidelity Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(verificationResult.fidelityScore * 100).toFixed(1)}%
                  </div>
                  <Progress value={verificationResult.fidelityScore * 100} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Confidence</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(verificationResult.confidence * 100).toFixed(1)}%
                  </div>
                  <Progress value={verificationResult.confidence * 100} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Anomalies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{verificationResult.anomalies.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Detected</p>
                </CardContent>
              </Card>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Verification Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Pattern Matches:</div>
                <div className="font-mono">
                  {verificationResult.details.patternMatches} / {verificationResult.details.totalPatterns}
                </div>
                <div>Distribution Score:</div>
                <div className="font-mono">
                  {(verificationResult.details.distributionScore * 100).toFixed(1)}%
                </div>
                <div>Consistency Score:</div>
                <div className="font-mono">
                  {(verificationResult.details.consistencyScore * 100).toFixed(1)}%
                </div>
              </div>

              {verificationResult.anomalies.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-sm font-semibold mb-1">Detected Anomalies:</h5>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {verificationResult.anomalies.map((anomaly: string, i: number) => (
                      <li key={i}>{anomaly}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Semantic Anchors Demo
function SemanticAnchorsDemo() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [calibrationResult, setCalibrationResult] = useState<any>(null);

  const { data: stats } = trpc.latentmasV2.semanticAnchors.getStatistics.useQuery();
  const { data: categories } = trpc.latentmasV2.semanticAnchors.getCategories.useQuery();
  const { data: categoryAnchors } = trpc.latentmasV2.semanticAnchors.getByCategory.useQuery(
    { category: selectedCategory as any },
    { enabled: !!selectedCategory }
  );

  const { mutate: findNearest, isPending: isSearching } =
    trpc.latentmasV2.semanticAnchors.findNearest.useMutation({
      onSuccess: (data) => {
        setSearchResults(data.nearest);
      },
    });

  const { mutate: calibrate, isPending: isCalibrating } =
    trpc.latentmasV2.semanticAnchors.calibrate.useMutation({
      onSuccess: (data) => {
        setCalibrationResult(data.calibration);
      },
    });

  const handleSearch = () => {
    // Generate sample vector
    const vector = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    findNearest({ vector, topK: 5 });
  };

  const handleCalibrate = () => {
    // Generate sample vector
    const vector = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    calibrate({ vector });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Semantic Anchors</CardTitle>
        <CardDescription>
          1024 golden anchor prompts across 16 semantic categories for vector standardization and quality assessment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Total Anchors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.stats.totalAnchors}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {Object.keys(stats.stats.categoryCounts).length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Vectors Cached</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.stats.vectorsCached}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Browse by Category</label>
          <select
            className="w-full mt-1 p-2 border rounded"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Select a category...</option>
            {categories?.categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        {categoryAnchors && (
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">
              {selectedCategory.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} ({categoryAnchors.count})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {categoryAnchors.anchors.slice(0, 5).map((anchor: any) => (
                <div key={anchor.id} className="text-sm p-2 bg-background rounded">
                  {anchor.prompt}
                </div>
              ))}
              {categoryAnchors.count > 5 && (
                <div className="text-sm text-muted-foreground">
                  ... and {categoryAnchors.count - 5} more anchors
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Find Nearest Anchors
          </Button>

          <Button onClick={handleCalibrate} disabled={isCalibrating} variant="secondary">
            {isCalibrating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Calibrate Alignment
          </Button>
        </div>

        {searchResults && (
          <div className="space-y-2">
            <h4 className="font-semibold">Top 5 Nearest Anchors</h4>
            {searchResults.map((result: any, i: number) => (
              <div key={i} className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between items-start mb-1">
                  <Badge variant="outline">{result.category.replace(/_/g, ' ')}</Badge>
                  <span className="text-sm font-mono">
                    Similarity: {(result.similarity * 100).toFixed(2)}%
                  </span>
                </div>
                <p className="text-sm">{result.prompt}</p>
              </div>
            ))}
          </div>
        )}

        {calibrationResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Calibration Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(calibrationResult.calibrationScore * 100).toFixed(1)}%
                  </div>
                  <Progress value={calibrationResult.calibrationScore * 100} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Semantic Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(calibrationResult.coverage * 100).toFixed(1)}%
                  </div>
                  <Progress value={calibrationResult.coverage * 100} className="mt-2" />
                </CardContent>
              </Card>
            </div>

            {calibrationResult.recommendations.length > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Recommendations</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {calibrationResult.recommendations.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
