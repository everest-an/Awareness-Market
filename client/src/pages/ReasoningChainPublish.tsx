import { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Upload,
  Brain,
  Sparkles,
  Code,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Database,
  Lock,
  Eye,
  DollarSign,
  Info,
} from "lucide-react";

// Supported AI models for KV-Cache
const SUPPORTED_MODELS = [
  // OpenAI
  { value: "gpt-4", label: "GPT-4", family: "OpenAI" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo", family: "OpenAI" },
  { value: "gpt-4o", label: "GPT-4o", family: "OpenAI" },
  { value: "o1", label: "O1", family: "OpenAI" },
  // Anthropic
  { value: "claude-3-opus", label: "Claude 3 Opus", family: "Anthropic" },
  { value: "claude-3-sonnet", label: "Claude 3 Sonnet", family: "Anthropic" },
  { value: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet", family: "Anthropic" },
  // Meta
  { value: "llama-3-70b", label: "LLaMA 3 70B", family: "Meta" },
  { value: "llama-3.1-405b", label: "LLaMA 3.1 405B", family: "Meta" },
  // Alibaba
  { value: "qwen-2.5-72b", label: "Qwen 2.5 72B", family: "Alibaba" },
  { value: "qwen-2-72b", label: "Qwen 2 72B", family: "Alibaba" },
  // DeepSeek
  { value: "deepseek-v3", label: "DeepSeek V3", family: "DeepSeek" },
  { value: "deepseek-v2.5", label: "DeepSeek V2.5", family: "DeepSeek" },
  // Google
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", family: "Google" },
  { value: "gemini-ultra", label: "Gemini Ultra", family: "Google" },
  // Mistral
  { value: "mixtral-8x22b", label: "Mixtral 8x22B", family: "Mistral" },
  { value: "mistral-large", label: "Mistral Large", family: "Mistral" },
];

// Categories for reasoning chains
const CATEGORIES = [
  { value: "code-generation", label: "Code Generation", icon: Code },
  { value: "mathematical-reasoning", label: "Mathematical Reasoning", icon: Brain },
  { value: "scientific-analysis", label: "Scientific Analysis", icon: Sparkles },
  { value: "creative-writing", label: "Creative Writing", icon: Sparkles },
  { value: "data-analysis", label: "Data Analysis", icon: Database },
  { value: "logical-deduction", label: "Logical Deduction", icon: Brain },
  { value: "problem-solving", label: "Problem Solving", icon: Zap },
  { value: "language-translation", label: "Language Translation", icon: Code },
];

interface KVCacheData {
  sourceModel: string;
  keys: number[][];
  values: number[][];
  attentionMask?: number[];
  positionEncodings?: number[];
  metadata: {
    sequenceLength: number;
    contextDescription: string;
    tokenCount: number;
    generatedAt?: Date;
  };
}

export default function ReasoningChainPublish() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Form state
  const [step, setStep] = useState(1);
  const [chainName, setChainName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [sourceModel, setSourceModel] = useState("");
  const [pricePerUse, setPricePerUse] = useState("0.10");
  const [inputExample, setInputExample] = useState("");
  const [outputExample, setOutputExample] = useState("");
  
  // KV-Cache state
  const [kvCacheFile, setKvCacheFile] = useState<File | null>(null);
  const [kvCacheData, setKvCacheData] = useState<KVCacheData | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  
  // Publish mutation
  const publishMutation = trpc.reasoningChains.publish.useMutation({
    onSuccess: (data) => {
      toast.success("Reasoning chain published successfully!", {
        description: "Your reasoning chain is now available in the marketplace.",
      });
      setLocation("/reasoning-chains");
    },
    onError: (error) => {
      toast.error("Failed to publish reasoning chain", {
        description: error.message,
      });
    },
  });
  
  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setKvCacheFile(file);
    setIsValidating(true);
    setUploadProgress(0);
    
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);
      
      // Read and parse the file
      const text = await file.text();
      const data = JSON.parse(text) as KVCacheData;
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Validate the KV-Cache data
      const errors: string[] = [];
      const warnings: string[] = [];
      
      if (!data.sourceModel) {
        errors.push("Missing sourceModel field");
      }
      if (!data.keys || !Array.isArray(data.keys)) {
        errors.push("Missing or invalid keys array");
      }
      if (!data.values || !Array.isArray(data.values)) {
        errors.push("Missing or invalid values array");
      }
      if (!data.metadata) {
        errors.push("Missing metadata object");
      } else {
        if (!data.metadata.sequenceLength) {
          warnings.push("Missing sequenceLength in metadata");
        }
        if (!data.metadata.contextDescription) {
          warnings.push("Missing contextDescription in metadata");
        }
        if (!data.metadata.tokenCount) {
          warnings.push("Missing tokenCount in metadata");
        }
      }
      
      // Check array dimensions
      if (data.keys && data.values) {
        if (data.keys.length !== data.values.length) {
          errors.push("Keys and values arrays must have the same length");
        }
      }
      
      setValidationResult({
        valid: errors.length === 0,
        errors,
        warnings,
      });
      
      if (errors.length === 0) {
        setKvCacheData(data);
        if (data.sourceModel && !sourceModel) {
          setSourceModel(data.sourceModel);
        }
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        errors: ["Failed to parse JSON file. Please ensure it's a valid KV-Cache export."],
        warnings: [],
      });
    } finally {
      setIsValidating(false);
    }
  }, [sourceModel]);
  
  // Handle publish
  const handlePublish = async () => {
    if (!kvCacheData) {
      toast.error("Please upload a valid KV-Cache file");
      return;
    }
    
    publishMutation.mutate({
      chainName,
      description,
      category,
      inputExample: inputExample ? JSON.parse(inputExample) : null,
      outputExample: outputExample ? JSON.parse(outputExample) : null,
      kvCacheSnapshot: kvCacheData,
      pricePerUse: parseFloat(pricePerUse),
    });
  };
  
  // Check authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="hero-gradient absolute inset-0 pointer-events-none" />
        <div className="container py-20">
          <Card className="glass-card max-w-md mx-auto">
            <CardHeader className="text-center">
              <Lock className="w-12 h-12 mx-auto text-primary mb-4" />
              <CardTitle>Authentication Required</CardTitle>
              <CardDescription>
                Please sign in to publish reasoning chains
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full btn-primary" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background pt-16">
      {/* Navbar */}
      <Navbar />
      
      {/* Hero gradient */}
      <div className="hero-gradient absolute inset-0 pointer-events-none" />
      
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-xl bg-background/80 sticky top-16 z-40">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/reasoning-chains">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">Publish Reasoning Chain</h1>
              <p className="text-sm text-muted-foreground">
                Share your AI's thought process with the world
              </p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container py-8">
        {/* Progress Steps */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: "Upload KV-Cache" },
              { num: 2, label: "Chain Details" },
              { num: 3, label: "Examples" },
              { num: 4, label: "Pricing & Publish" },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                    step >= s.num
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
                </div>
                <span
                  className={`ml-2 text-sm hidden sm:block ${
                    step >= s.num ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
                {i < 3 && (
                  <div
                    className={`w-12 sm:w-24 h-0.5 mx-2 ${
                      step > s.num ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Step Content */}
        <div className="max-w-3xl mx-auto">
          {/* Step 1: Upload KV-Cache */}
          {step === 1 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  Upload KV-Cache File
                </CardTitle>
                <CardDescription>
                  Upload your model's KV-Cache snapshot in JSON format. This contains the
                  key-value pairs from your model's attention mechanism.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload Area */}
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    kvCacheFile
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="kv-cache-upload"
                  />
                  <label
                    htmlFor="kv-cache-upload"
                    className="cursor-pointer block"
                  >
                    {isValidating ? (
                      <div className="space-y-4">
                        <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
                        <p className="text-muted-foreground">Validating KV-Cache...</p>
                        <Progress value={uploadProgress} className="max-w-xs mx-auto" />
                      </div>
                    ) : kvCacheFile ? (
                      <div className="space-y-4">
                        <FileJson className="w-12 h-12 mx-auto text-primary" />
                        <div>
                          <p className="font-medium">{kvCacheFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(kvCacheFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                        <div>
                          <p className="font-medium">Click to upload or drag and drop</p>
                          <p className="text-sm text-muted-foreground">
                            JSON file containing KV-Cache data
                          </p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
                
                {/* Validation Results */}
                {validationResult && (
                  <div className="space-y-3">
                    {validationResult.valid ? (
                      <div className="flex items-center gap-2 text-green-500 bg-green-500/10 p-3 rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>KV-Cache file is valid</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {validationResult.errors.map((error, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg"
                          >
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>{error}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {validationResult.warnings.length > 0 && (
                      <div className="space-y-2">
                        {validationResult.warnings.map((warning, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 p-3 rounded-lg"
                          >
                            <Info className="w-5 h-5 shrink-0" />
                            <span>{warning}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* KV-Cache Info */}
                {kvCacheData && (
                  <div className="glass-card p-4 space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Database className="w-4 h-4 text-primary" />
                      KV-Cache Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Source Model:</span>
                        <p className="font-medium">{kvCacheData.sourceModel}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sequence Length:</span>
                        <p className="font-medium">{kvCacheData.metadata?.sequenceLength || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Token Count:</span>
                        <p className="font-medium">{kvCacheData.metadata?.tokenCount || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Keys/Values:</span>
                        <p className="font-medium">{kvCacheData.keys?.length || 0} layers</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Example Format */}
                <div className="glass-card p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Code className="w-4 h-4 text-primary" />
                    Expected JSON Format
                  </h4>
                  <pre className="code-block text-xs overflow-x-auto">
{`{
  "sourceModel": "gpt-4",
  "keys": [[...], [...], ...],
  "values": [[...], [...], ...],
  "attentionMask": [...],
  "positionEncodings": [...],
  "metadata": {
    "sequenceLength": 2048,
    "contextDescription": "Complex math problem solving",
    "tokenCount": 1500,
    "generatedAt": "2025-01-03T00:00:00Z"
  }
}`}
                  </pre>
                </div>
                
                <div className="flex justify-end">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!validationResult?.valid}
                    className="btn-primary"
                  >
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Step 2: Chain Details */}
          {step === 2 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  Reasoning Chain Details
                </CardTitle>
                <CardDescription>
                  Provide information about your reasoning chain to help buyers understand its capabilities.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="chainName">Chain Name *</Label>
                  <Input
                    id="chainName"
                    value={chainName}
                    onChange={(e) => setChainName(e.target.value)}
                    placeholder="e.g., Advanced Mathematical Proof Solver"
                    className="input-glass"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this reasoning chain does, its strengths, and ideal use cases..."
                    rows={4}
                    className="input-glass resize-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="input-glass">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center gap-2">
                              <cat.icon className="w-4 h-4" />
                              {cat.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Source Model *</Label>
                    <Select value={sourceModel} onValueChange={setSourceModel}>
                      <SelectTrigger className="input-glass">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_MODELS.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {model.family}
                              </Badge>
                              {model.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!chainName || !description || !category || !sourceModel}
                    className="btn-primary"
                  >
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Step 3: Examples */}
          {step === 3 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  Input/Output Examples
                </CardTitle>
                <CardDescription>
                  Provide examples to help buyers understand how to use your reasoning chain.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="inputExample">Input Example (JSON)</Label>
                  <Textarea
                    id="inputExample"
                    value={inputExample}
                    onChange={(e) => setInputExample(e.target.value)}
                    placeholder='{"problem": "Prove that √2 is irrational"}'
                    rows={4}
                    className="input-glass font-mono text-sm resize-none"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="outputExample">Output Example (JSON)</Label>
                  <Textarea
                    id="outputExample"
                    value={outputExample}
                    onChange={(e) => setOutputExample(e.target.value)}
                    placeholder='{"proof": "Assume √2 = p/q where p,q are coprime integers...", "steps": [...]}'
                    rows={4}
                    className="input-glass font-mono text-sm resize-none"
                  />
                </div>
                
                <div className="glass-card p-4 bg-primary/5">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium mb-1">Why provide examples?</p>
                      <p className="text-muted-foreground">
                        Good examples help buyers understand exactly what your reasoning chain
                        can do and how to format their inputs. Chains with clear examples
                        typically see 3x more purchases.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button onClick={() => setStep(4)} className="btn-primary">
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Step 4: Pricing & Publish */}
          {step === 4 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Pricing & Publish
                </CardTitle>
                <CardDescription>
                  Set your pricing and review your reasoning chain before publishing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Pricing */}
                <div className="space-y-2">
                  <Label htmlFor="price">Price per Use (USD) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={pricePerUse}
                      onChange={(e) => setPricePerUse(e.target.value)}
                      className="input-glass pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Platform fee: 10% | You receive: ${(parseFloat(pricePerUse || "0") * 0.9).toFixed(2)} per use
                  </p>
                </div>
                
                {/* Summary */}
                <div className="glass-card p-6 space-y-4">
                  <h4 className="font-semibold">Publishing Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Chain Name:</span>
                      <p className="font-medium">{chainName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Category:</span>
                      <p className="font-medium capitalize">{category.replace("-", " ")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Source Model:</span>
                      <p className="font-medium">{sourceModel}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Price per Use:</span>
                      <p className="font-medium">${pricePerUse}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Description:</span>
                      <p className="font-medium line-clamp-2">{description}</p>
                    </div>
                  </div>
                </div>
                
                {/* Terms */}
                <div className="text-sm text-muted-foreground">
                  By publishing, you agree to our{" "}
                  <Link href="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and confirm that you have the rights to share this reasoning chain.
                </div>
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    Back
                  </Button>
                  <Button
                    onClick={handlePublish}
                    disabled={publishMutation.isPending || !pricePerUse}
                    className="btn-primary"
                  >
                    {publishMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Publish Reasoning Chain
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
