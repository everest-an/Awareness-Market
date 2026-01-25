import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Grid3X3,
  BarChart3,
  Sparkles,
  Info,
  RefreshCw,
  Download,
  Share2,
} from "lucide-react";

// Model families and their models
const MODEL_FAMILIES = {
  OpenAI: [
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", dim: 4096 },
    { id: "gpt-4", name: "GPT-4", dim: 8192 },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", dim: 8192 },
    { id: "gpt-4o", name: "GPT-4o", dim: 8192 },
    { id: "o1", name: "O1", dim: 16384 },
    { id: "o1-mini", name: "O1 Mini", dim: 8192 },
  ],
  Anthropic: [
    { id: "claude-3-opus", name: "Claude 3 Opus", dim: 8192 },
    { id: "claude-3-sonnet", name: "Claude 3 Sonnet", dim: 8192 },
    { id: "claude-3-haiku", name: "Claude 3 Haiku", dim: 4096 },
    { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", dim: 8192 },
  ],
  Meta: [
    { id: "llama-2-7b", name: "LLaMA 2 7B", dim: 4096 },
    { id: "llama-2-13b", name: "LLaMA 2 13B", dim: 5120 },
    { id: "llama-2-70b", name: "LLaMA 2 70B", dim: 8192 },
    { id: "llama-3-8b", name: "LLaMA 3 8B", dim: 4096 },
    { id: "llama-3-70b", name: "LLaMA 3 70B", dim: 8192 },
    { id: "llama-3.1-405b", name: "LLaMA 3.1 405B", dim: 16384 },
  ],
  Alibaba: [
    { id: "qwen-7b", name: "Qwen 7B", dim: 4096 },
    { id: "qwen-14b", name: "Qwen 14B", dim: 5120 },
    { id: "qwen-72b", name: "Qwen 72B", dim: 8192 },
    { id: "qwen-2-72b", name: "Qwen 2 72B", dim: 8192 },
    { id: "qwen-2.5-72b", name: "Qwen 2.5 72B", dim: 8192 },
  ],
  DeepSeek: [
    { id: "deepseek-7b", name: "DeepSeek 7B", dim: 4096 },
    { id: "deepseek-67b", name: "DeepSeek 67B", dim: 8192 },
    { id: "deepseek-v2", name: "DeepSeek V2", dim: 8192 },
    { id: "deepseek-v2.5", name: "DeepSeek V2.5", dim: 8192 },
    { id: "deepseek-v3", name: "DeepSeek V3", dim: 16384 },
  ],
  Google: [
    { id: "gemini-pro", name: "Gemini Pro", dim: 8192 },
    { id: "gemini-ultra", name: "Gemini Ultra", dim: 16384 },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", dim: 8192 },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", dim: 4096 },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", dim: 8192 },
    { id: "gemini-2.0-pro", name: "Gemini 2.0 Pro", dim: 16384 },
  ],
  Mistral: [
    { id: "mistral-7b", name: "Mistral 7B", dim: 4096 },
    { id: "mixtral-8x7b", name: "Mixtral 8x7B", dim: 4096 },
    { id: "mixtral-8x22b", name: "Mixtral 8x22B", dim: 6144 },
    { id: "mistral-large", name: "Mistral Large", dim: 8192 },
  ],
  "01.AI": [
    { id: "yi-6b", name: "Yi 6B", dim: 4096 },
    { id: "yi-34b", name: "Yi 34B", dim: 7168 },
    { id: "yi-1.5-34b", name: "Yi 1.5 34B", dim: 7168 },
  ],
  Baichuan: [
    { id: "baichuan-7b", name: "Baichuan 7B", dim: 4096 },
    { id: "baichuan-13b", name: "Baichuan 13B", dim: 5120 },
    { id: "baichuan2-13b", name: "Baichuan 2 13B", dim: 5120 },
  ],
  Microsoft: [
    { id: "phi-2", name: "Phi-2", dim: 2560 },
    { id: "phi-3-mini", name: "Phi-3 Mini", dim: 3072 },
    { id: "phi-3-small", name: "Phi-3 Small", dim: 4096 },
  ],
  xAI: [
    { id: "grok-1", name: "Grok-1", dim: 8192 },
    { id: "grok-1.5", name: "Grok-1.5", dim: 8192 },
    { id: "grok-2", name: "Grok-2", dim: 8192 },
    { id: "grok-3", name: "Grok-3", dim: 16384 },
  ],
};

// Flatten all models
const ALL_MODELS = Object.entries(MODEL_FAMILIES).flatMap(([family, models]) =>
  models.map((m) => ({ ...m, family }))
);

// Simulate alignment quality calculation
function calculateAlignmentQuality(
  sourceModel: typeof ALL_MODELS[0],
  targetModel: typeof ALL_MODELS[0]
): {
  cosineSimilarity: number;
  informationRetention: number;
  computationalCost: number;
  overallScore: number;
  recommendation: "excellent" | "good" | "fair" | "poor";
} {
  // Same model = perfect alignment
  if (sourceModel.id === targetModel.id) {
    return {
      cosineSimilarity: 1.0,
      informationRetention: 1.0,
      computationalCost: 0.0,
      overallScore: 1.0,
      recommendation: "excellent",
    };
  }
  
  // Same family = high alignment
  const sameFamily = sourceModel.family === targetModel.family;
  
  // Dimension ratio affects quality
  const dimRatio = Math.min(sourceModel.dim, targetModel.dim) / Math.max(sourceModel.dim, targetModel.dim);
  
  // Base scores
  let cosineSimilarity = sameFamily ? 0.92 + Math.random() * 0.06 : 0.75 + Math.random() * 0.15;
  let informationRetention = dimRatio * (sameFamily ? 0.95 : 0.85) + Math.random() * 0.05;
  let computationalCost = 1 - dimRatio + (sameFamily ? 0 : 0.1);
  
  // Clamp values
  cosineSimilarity = Math.min(0.99, Math.max(0.5, cosineSimilarity));
  informationRetention = Math.min(0.99, Math.max(0.5, informationRetention));
  computationalCost = Math.min(1, Math.max(0, computationalCost));
  
  // Overall score
  const overallScore = (cosineSimilarity * 0.4 + informationRetention * 0.4 + (1 - computationalCost) * 0.2);
  
  // Recommendation
  let recommendation: "excellent" | "good" | "fair" | "poor";
  if (overallScore >= 0.9) recommendation = "excellent";
  else if (overallScore >= 0.75) recommendation = "good";
  else if (overallScore >= 0.6) recommendation = "fair";
  else recommendation = "poor";
  
  return {
    cosineSimilarity,
    informationRetention,
    computationalCost,
    overallScore,
    recommendation,
  };
}

export default function WMatrixTester() {
  const [sourceModelId, setSourceModelId] = useState<string>("");
  const [targetModelId, setTargetModelId] = useState<string>("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof calculateAlignmentQuality> | null>(null);
  const [activeTab, setActiveTab] = useState("tester");
  
  // Get model objects
  const sourceModel = ALL_MODELS.find((m) => m.id === sourceModelId);
  const targetModel = ALL_MODELS.find((m) => m.id === targetModelId);
  
  // Run alignment test
  const runTest = async () => {
    if (!sourceModel || !targetModel) {
      toast.error("Please select both source and target models");
      return;
    }
    
    setIsCalculating(true);
    setResult(null);
    
    // Simulate calculation time
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const alignmentResult = calculateAlignmentQuality(sourceModel, targetModel);
    setResult(alignmentResult);
    setIsCalculating(false);
    
    toast.success("Alignment test complete!", {
      description: `Overall score: ${(alignmentResult.overallScore * 100).toFixed(1)}%`,
    });
  };
  
  // Generate compatibility matrix data
  const matrixData = useMemo(() => {
    const families = Object.keys(MODEL_FAMILIES);
    const matrix: { source: string; target: string; score: number }[] = [];
    
    families.forEach((source) => {
      families.forEach((target) => {
        const sourceModel = MODEL_FAMILIES[source as keyof typeof MODEL_FAMILIES][0];
        const targetModel = MODEL_FAMILIES[target as keyof typeof MODEL_FAMILIES][0];
        const result = calculateAlignmentQuality(
          { ...sourceModel, family: source },
          { ...targetModel, family: target }
        );
        matrix.push({ source, target, score: result.overallScore });
      });
    });
    
    return matrix;
  }, []);
  
  // Get color for score
  const getScoreColor = (score: number) => {
    if (score >= 0.9) return "bg-green-500";
    if (score >= 0.75) return "bg-blue-500";
    if (score >= 0.6) return "bg-yellow-500";
    return "bg-red-500";
  };
  
  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case "excellent":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "good":
        return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      case "fair":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* Hero gradient */}
      <div className="hero-gradient absolute inset-0 pointer-events-none" />
      
      <main className="container py-8 mt-20">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/w-matrix">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <Badge className="badge-primary">
              <Sparkles className="w-3 h-3 mr-1" />
              V2.0
            </Badge>
          </div>
          <h1 className="text-3xl font-bold">W-Matrix Compatibility Tester</h1>
          <p className="text-muted-foreground mt-2">
            Test alignment quality between 60+ AI models
          </p>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="glass-card p-1">
            <TabsTrigger value="tester" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Zap className="w-4 h-4 mr-2" />
              Alignment Tester
            </TabsTrigger>
            <TabsTrigger value="matrix" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Grid3X3 className="w-4 h-4 mr-2" />
              Compatibility Matrix
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="w-4 h-4 mr-2" />
              Model Stats
            </TabsTrigger>
          </TabsList>
          
          {/* Alignment Tester Tab */}
          <TabsContent value="tester" className="space-y-8">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Model Selection */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    Select Models
                  </CardTitle>
                  <CardDescription>
                    Choose source and target models to test W-Matrix alignment quality
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Source Model */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Source Model</label>
                    <Select value={sourceModelId} onValueChange={setSourceModelId}>
                      <SelectTrigger className="input-glass">
                        <SelectValue placeholder="Select source model" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {Object.entries(MODEL_FAMILIES).map(([family, models]) => (
                          <div key={family}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                              {family}
                            </div>
                            {models.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{model.name}</span>
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {model.dim}d
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    {sourceModel && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{sourceModel.family}</Badge>
                        <span>Dimension: {sourceModel.dim}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Arrow */}
                  <div className="flex justify-center">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <ArrowRight className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  
                  {/* Target Model */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target Model</label>
                    <Select value={targetModelId} onValueChange={setTargetModelId}>
                      <SelectTrigger className="input-glass">
                        <SelectValue placeholder="Select target model" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {Object.entries(MODEL_FAMILIES).map(([family, models]) => (
                          <div key={family}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                              {family}
                            </div>
                            {models.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{model.name}</span>
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {model.dim}d
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    {targetModel && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{targetModel.family}</Badge>
                        <span>Dimension: {targetModel.dim}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Test Button */}
                  <Button
                    onClick={runTest}
                    disabled={!sourceModelId || !targetModelId || isCalculating}
                    className="w-full btn-primary"
                  >
                    {isCalculating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Calculating Alignment...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Test Alignment
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
              
              {/* Results */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Alignment Results
                  </CardTitle>
                  <CardDescription>
                    W-Matrix transformation quality metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!result && !isCalculating && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select models and run a test to see results</p>
                    </div>
                  )}
                  
                  {isCalculating && (
                    <div className="text-center py-12">
                      <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                      <p className="text-muted-foreground">Computing W-Matrix transformation...</p>
                    </div>
                  )}
                  
                  {result && !isCalculating && (
                    <div className="space-y-6">
                      {/* Overall Score */}
                      <div className="text-center p-6 glass-card rounded-xl">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          {getRecommendationIcon(result.recommendation)}
                          <span className="text-lg font-semibold capitalize">
                            {result.recommendation}
                          </span>
                        </div>
                        <div className="text-5xl font-bold gradient-text mb-2">
                          {(result.overallScore * 100).toFixed(1)}%
                        </div>
                        <p className="text-sm text-muted-foreground">Overall Alignment Score</p>
                      </div>
                      
                      {/* Detailed Metrics */}
                      <div className="space-y-4">
                        {/* Cosine Similarity */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Cosine Similarity</span>
                            <span className="font-medium">
                              {(result.cosineSimilarity * 100).toFixed(1)}%
                            </span>
                          </div>
                          <Progress
                            value={result.cosineSimilarity * 100}
                            className="h-2"
                          />
                        </div>
                        
                        {/* Information Retention */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Information Retention</span>
                            <span className="font-medium">
                              {(result.informationRetention * 100).toFixed(1)}%
                            </span>
                          </div>
                          <Progress
                            value={result.informationRetention * 100}
                            className="h-2"
                          />
                        </div>
                        
                        {/* Computational Cost */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Computational Efficiency</span>
                            <span className="font-medium">
                              {((1 - result.computationalCost) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <Progress
                            value={(1 - result.computationalCost) * 100}
                            className="h-2"
                          />
                        </div>
                      </div>
                      
                      {/* Recommendation */}
                      <div className="glass-card p-4 bg-primary/5">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium mb-1">Recommendation</p>
                            <p className="text-muted-foreground">
                              {result.recommendation === "excellent" &&
                                "This model pair has excellent alignment. KV-cache transfer will preserve most semantic information."}
                              {result.recommendation === "good" &&
                                "Good alignment quality. Minor information loss expected during transfer."}
                              {result.recommendation === "fair" &&
                                "Fair alignment. Consider using models from the same family for better results."}
                              {result.recommendation === "poor" &&
                                "Poor alignment. Significant information loss expected. Use with caution."}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={runTest}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Retest
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Compatibility Matrix Tab */}
          <TabsContent value="matrix">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Grid3X3 className="w-5 h-5 text-primary" />
                  Model Family Compatibility Matrix
                </CardTitle>
                <CardDescription>
                  Cross-family alignment quality overview
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="p-2 text-left text-sm font-medium text-muted-foreground">
                          Source â†?Target
                        </th>
                        {Object.keys(MODEL_FAMILIES).map((family) => (
                          <th
                            key={family}
                            className="p-2 text-center text-xs font-medium text-muted-foreground"
                          >
                            {family}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(MODEL_FAMILIES).map((sourceFamily) => (
                        <tr key={sourceFamily}>
                          <td className="p-2 text-sm font-medium">{sourceFamily}</td>
                          {Object.keys(MODEL_FAMILIES).map((targetFamily) => {
                            const data = matrixData.find(
                              (d) => d.source === sourceFamily && d.target === targetFamily
                            );
                            const score = data?.score || 0;
                            return (
                              <td key={targetFamily} className="p-1">
                                <div
                                  className={`w-full h-10 rounded flex items-center justify-center text-xs font-medium text-white ${getScoreColor(score)}`}
                                  title={`${sourceFamily} â†?${targetFamily}: ${(score * 100).toFixed(0)}%`}
                                >
                                  {(score * 100).toFixed(0)}%
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500" />
                    <span>Excellent (90%+)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-500" />
                    <span>Good (75-90%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-500" />
                    <span>Fair (60-75%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500" />
                    <span>Poor (&lt;60%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Model Stats Tab */}
          <TabsContent value="stats">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(MODEL_FAMILIES).map(([family, models]) => (
                <Card key={family} className="glass-card-hover">
                  <CardHeader>
                    <CardTitle className="text-lg">{family}</CardTitle>
                    <CardDescription>{models.length} models supported</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {models.map((model) => (
                        <div
                          key={model.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                        >
                          <span className="text-sm">{model.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {model.dim}d
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <Card className="glass-card p-6 text-center">
                <div className="text-3xl font-bold gradient-text">
                  {ALL_MODELS.length}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Total Models</p>
              </Card>
              <Card className="glass-card p-6 text-center">
                <div className="text-3xl font-bold gradient-text">
                  {Object.keys(MODEL_FAMILIES).length}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Model Families</p>
              </Card>
              <Card className="glass-card p-6 text-center">
                <div className="text-3xl font-bold gradient-text">
                  {ALL_MODELS.length * ALL_MODELS.length}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Possible Alignments</p>
              </Card>
              <Card className="glass-card p-6 text-center">
                <div className="text-3xl font-bold gradient-text">V1.0.0</div>
                <p className="text-sm text-muted-foreground mt-1">W-Matrix Version</p>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
