import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import Navbar from "@/components/Navbar";
import { 
  Network, 
  Cpu, 
  Zap, 
  ArrowRight, 
  CheckCircle2,
  Info,
  GitBranch,
  Layers,
  Activity
} from "lucide-react";

const MODEL_FAMILIES = [
  { label: "OpenAI GPT", models: ["gpt-3.5", "gpt-4", "gpt-4-turbo", "gpt-4o", "o1", "o1-mini"] },
  { label: "Anthropic Claude", models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-3.5-sonnet"] },
  { label: "Meta LLaMA", models: ["llama-2-7b", "llama-2-13b", "llama-2-70b", "llama-3-8b", "llama-3-70b", "llama-3.1-8b", "llama-3.1-70b", "llama-3.1-405b"] },
  { label: "Mistral", models: ["mistral-7b", "mixtral-8x7b", "mixtral-8x22b", "mistral-large"] },
  { label: "Google Gemini", models: ["gemini-pro", "gemini-ultra", "gemini-1.5-pro", "gemini-1.5-flash"] },
  { label: "Alibaba Qwen", models: ["qwen-7b", "qwen-14b", "qwen-72b", "qwen-2-7b", "qwen-2-72b", "qwen-2.5-7b", "qwen-2.5-72b"] },
  { label: "DeepSeek", models: ["deepseek-7b", "deepseek-67b", "deepseek-coder-7b", "deepseek-coder-33b", "deepseek-v2", "deepseek-v2.5", "deepseek-v3"] },
  { label: "01.AI Yi", models: ["yi-6b", "yi-34b", "yi-1.5-9b", "yi-1.5-34b"] },
  { label: "Baichuan", models: ["baichuan-7b", "baichuan-13b", "baichuan2-7b", "baichuan2-13b"] },
  { label: "Microsoft Phi", models: ["phi-2", "phi-3-mini", "phi-3-small", "phi-3-medium"] },
  { label: "InternLM", models: ["internlm-7b", "internlm-20b", "internlm2-7b", "internlm2-20b"] },
  { label: "ChatGLM", models: ["chatglm-6b", "chatglm2-6b", "chatglm3-6b", "glm-4"] },
  { label: "Cohere", models: ["command-r", "command-r-plus"] },
  { label: "xAI Grok", models: ["grok-1", "grok-2"] },
];

export default function WMatrixProtocol() {
  const [sourceModel, setSourceModel] = useState<string>("gpt-4");
  const [targetModel, setTargetModel] = useState<string>("llama-3-70b");
  const [method, setMethod] = useState<"orthogonal" | "learned" | "hybrid">("orthogonal");

  // Get current W-Matrix version
  const { data: versionData } = trpc.wMatrix.getCurrentVersion.useQuery();

  // Get supported models
  const { data: supportedModels } = trpc.wMatrix.getSupportedModels.useQuery();

  // Generate W-Matrix
  const { data: wMatrix, isLoading } = trpc.wMatrix.generate.useQuery({
    sourceModel,
    targetModel,
    method,
  }, {
    enabled: !!sourceModel && !!targetModel,
  });

  // Check compatibility
  const { data: compatibilityData } = trpc.wMatrix.checkCompatibility.useQuery({
    model1: sourceModel,
    model2: targetModel,
  }, {
    enabled: !!sourceModel && !!targetModel,
  });

  const totalModels = supportedModels?.length || 60;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Header */}
      <div className="pt-20 border-b border-white/5 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
              <Network className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold">W-Matrix Protocol</h1>
            <Badge variant="secondary" className="ml-2">v{versionData?.version || "1.0.0"}</Badge>
          </div>
          <p className="text-lg text-muted-foreground">
            Standardized latent space alignment for cross-model KV-Cache exchange
          </p>
          <div className="mt-4 flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-blue-500" />
              <span>{totalModels}+ Models Supported</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span>Zero-Shot Alignment</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-green-500" />
              <span>14 Model Families</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <Tabs defaultValue="explorer" className="space-y-8">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="explorer">Explorer</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="docs">Documentation</TabsTrigger>
          </TabsList>

          {/* Explorer Tab */}
          <TabsContent value="explorer" className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Configuration Panel */}
              <Card>
                <CardHeader>
                  <CardTitle>W-Matrix Generator</CardTitle>
                  <CardDescription>
                    Generate alignment matrices for cross-model KV-Cache exchange
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Source Model</label>
                      <Select value={sourceModel} onValueChange={setSourceModel}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODEL_FAMILIES.map((family) => (
                            <div key={family.label}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                                {family.label}
                              </div>
                              {family.models.map((model) => (
                                <SelectItem key={model} value={model}>
                                  {model}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Target Model</label>
                      <Select value={targetModel} onValueChange={setTargetModel}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODEL_FAMILIES.map((family) => (
                            <div key={family.label}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                                {family.label}
                              </div>
                              {family.models.map((model) => (
                                <SelectItem key={model} value={model}>
                                  {model}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Alignment Method</label>
                    <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="orthogonal">
                          Orthogonal (Highest Quality)
                        </SelectItem>
                        <SelectItem value="learned">
                          Learned (Fastest)
                        </SelectItem>
                        <SelectItem value="hybrid">
                          Hybrid (Balanced)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Visual Alignment Arrow */}
                  <div className="flex items-center justify-center gap-4 py-4">
                    <div className="text-center">
                      <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 inline-block">
                        <Cpu className="h-8 w-8 text-blue-500" />
                      </div>
                      <p className="mt-2 text-sm font-medium">{sourceModel}</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <ArrowRight className="h-8 w-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">W-Matrix</span>
                    </div>
                    <div className="text-center">
                      <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30 inline-block">
                        <Cpu className="h-8 w-8 text-purple-500" />
                      </div>
                      <p className="mt-2 text-sm font-medium">{targetModel}</p>
                    </div>
                  </div>

                  {compatibilityData && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${
                      compatibilityData.compatible 
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                    }`}>
                      {compatibilityData.compatible ? (
                        <>
                          <CheckCircle2 className="h-5 w-5" />
                          <span>Direct alignment available (same dimension)</span>
                        </>
                      ) : (
                        <>
                          <Info className="h-5 w-5" />
                          <span>Cross-dimension alignment required</span>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Results Panel */}
              <Card>
                <CardHeader>
                  <CardTitle>W-Matrix Specification</CardTitle>
                  <CardDescription>
                    Generated alignment matrix details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                      <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                      <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                    </div>
                  ) : wMatrix ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Version</p>
                          <p className="font-mono font-medium">{wMatrix.version}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Method</p>
                          <p className="font-medium capitalize">{wMatrix.method}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Unified Dimension</p>
                          <p className="font-mono font-medium">{wMatrix.unifiedDimension}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Head Count</p>
                          <p className="font-mono font-medium">{wMatrix.kvCacheCompatibility.headCount}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold">Quality Metrics</h4>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Expected Quality</span>
                            <span>{(wMatrix.qualityMetrics.expectedQuality * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={wMatrix.qualityMetrics.expectedQuality * 100} className="h-2" />
                        </div>

                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Information Retention</span>
                            <span>{(wMatrix.qualityMetrics.informationRetention * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={wMatrix.qualityMetrics.informationRetention * 100} className="h-2" />
                        </div>

                        <div className="flex justify-between text-sm">
                          <span>Computational Cost</span>
                          <span className="font-mono">{wMatrix.qualityMetrics.computationalCost.toLocaleString()} ops</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <h4 className="font-semibold mb-2">KV-Cache Compatibility</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Key Dimension:</span>
                            <span className="font-mono">{wMatrix.kvCacheCompatibility.keyDimension}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Value Dimension:</span>
                            <span className="font-mono">{wMatrix.kvCacheCompatibility.valueDimension}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Layer Count:</span>
                            <span className="font-mono">{wMatrix.kvCacheCompatibility.layerCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max Sequence:</span>
                            <span className="font-mono">{wMatrix.kvCacheCompatibility.sequenceLength.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Select models to generate W-Matrix</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {MODEL_FAMILIES.map((family) => (
                <Card key={family.label}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{family.label}</CardTitle>
                    <CardDescription>{family.models.length} models</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {family.models.map((model) => (
                        <Badge key={model} variant="secondary" className="font-mono text-xs">
                          {model}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Documentation Tab */}
          <TabsContent value="docs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>W-Matrix Protocol Documentation</CardTitle>
                <CardDescription>
                  Technical specification for cross-model KV-Cache alignment
                </CardDescription>
              </CardHeader>
              <CardContent className="prose dark:prose-invert max-w-none">
                <h3>Overview</h3>
                <p>
                  The W-Matrix Protocol enables direct exchange of KV-Cache (Key-Value Cache) 
                  between different AI models. This allows AI agents to share their "thinking" 
                  or reasoning processes without information loss.
                </p>

                <h3>How It Works</h3>
                <ol>
                  <li>
                    <strong>Standardized W-Matrix:</strong> A pre-defined transformation matrix 
                    that aligns the latent space of different models to a unified representation.
                  </li>
                  <li>
                    <strong>KV-Cache Extraction:</strong> The source model's KV-Cache is extracted, 
                    containing the attention keys and values from its reasoning process.
                  </li>
                  <li>
                    <strong>Alignment:</strong> The W-Matrix transforms the KV-Cache from the 
                    source model's latent space to the target model's latent space.
                  </li>
                  <li>
                    <strong>Integration:</strong> The aligned KV-Cache is injected into the 
                    target model, allowing it to continue from the source model's reasoning state.
                  </li>
                </ol>

                <h3>Alignment Methods</h3>
                <ul>
                  <li>
                    <strong>Orthogonal:</strong> Uses orthogonal transformation matrices for 
                    lossless alignment. Best quality but higher computational cost.
                  </li>
                  <li>
                    <strong>Learned:</strong> Uses lightweight learned parameters for fast 
                    alignment. Lower quality but very efficient.
                  </li>
                  <li>
                    <strong>Hybrid:</strong> Combines orthogonal and learned approaches for 
                    balanced quality and performance.
                  </li>
                </ul>

                <h3>API Usage</h3>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`// Get W-Matrix for model pair
const wMatrix = await trpc.wMatrix.generate.query({
  sourceModel: "gpt-4",
  targetModel: "llama-3-70b",
  method: "orthogonal"
});

// Align KV-Cache
const aligned = await trpc.wMatrix.alignKVCache.mutate({
  kvCache: sourceKVCache,
  targetModel: "llama-3-70b"
});`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
