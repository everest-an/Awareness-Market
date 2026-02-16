import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Zap, Play, Cpu, BookOpen, Loader2, FlaskConical } from "lucide-react";

export default function LatentTest() {
  const [activeTab, setActiveTab] = useState("test");
  const [sourceModel, setSourceModel] = useState("gpt-4");
  const [targetModel, setTargetModel] = useState("llama-3-70b");
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const alignMutation = trpc.latentmasV2.wMatrix.align.useMutation();
  const buildPackageMutation = trpc.latentmasV2.buildPackage.useMutation();

  const runTest = async () => {
    setIsProcessing(true);
    try {
      const testVector = Array.from({ length: 128 }, () => (Math.random() - 0.5) * 2);
      const res = await alignMutation.mutateAsync({
        vector: testVector,
        sourceModel,
        targetModel,
        sourceDim: 128,
        targetDim: 128,
      });
      setResult(res);
      toast.success("Test completed");
    } catch (e: any) {
      toast.error(e.message);
    }
    setIsProcessing(false);
  };

  const runWorkflow = async () => {
    if (!inputText.trim()) { toast.error("Please enter text"); return; }
    setIsProcessing(true);
    try {
      const res = await buildPackageMutation.mutateAsync({
        text: inputText,
        sourceModel,
        targetModel,
        alignmentMethod: "orthogonal",
        enableCompression: true,
        compressionRatio: 0.65,
      });
      setResult(res);
      toast.success("Package generation completed");
    } catch (e: any) {
      toast.error(e.message);
    }
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 border-b border-white/5 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10">
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500">
              <FlaskConical className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold">Latent Test</h1>
            <Badge variant="secondary">LatentMAS v2.0</Badge>
          </div>
          <p className="text-muted-foreground">LatentMAS Workflow Testing Tool</p>
        </div>
      </div>
      <div className="container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="test"><Zap className="w-4 h-4 mr-2" />Alignment Test</TabsTrigger>
            <TabsTrigger value="workflow"><Play className="w-4 h-4 mr-2" />Full Workflow</TabsTrigger>
            <TabsTrigger value="models"><Cpu className="w-4 h-4 mr-2" />Model Library</TabsTrigger>
            <TabsTrigger value="docs"><BookOpen className="w-4 h-4 mr-2" />Documentation</TabsTrigger>
          </TabsList>
          <TabsContent value="test" className="mt-6">
            <Card>
              <CardHeader><CardTitle>W-Matrix Alignment Test</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Source Model</Label><input className="w-full p-2 border rounded mt-1" value={sourceModel} onChange={e => setSourceModel(e.target.value)} /></div>
                  <div><Label>Target Model</Label><input className="w-full p-2 border rounded mt-1" value={targetModel} onChange={e => setTargetModel(e.target.value)} /></div>
                </div>
                <Button onClick={runTest} disabled={isProcessing} className="w-full">
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  Run Alignment Test
                </Button>
                {result && <pre className="p-4 bg-muted rounded text-xs overflow-auto max-h-60">{JSON.stringify(result, null, 2)}</pre>}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="workflow" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Full Workflow</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Input Text</Label><Textarea placeholder="Enter text content..." value={inputText} onChange={e => setInputText(e.target.value)} className="mt-1" /></div>
                <Button onClick={runWorkflow} disabled={isProcessing} className="w-full">
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Generate LatentMAS Package
                </Button>
                {result && <pre className="p-4 bg-muted rounded text-xs overflow-auto max-h-60">{JSON.stringify(result, null, 2)}</pre>}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="models" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Supported Models</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {["GPT-4", "GPT-4o", "Claude 3 Opus", "Claude 3.5 Sonnet", "LLaMA 3 70B", "DeepSeek V3", "Gemini 1.5 Pro", "Mixtral 8x22B"].map(m => (
                    <Badge key={m} variant="outline" className="justify-center py-2">{m}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="docs" className="mt-6">
            <Card>
              <CardHeader><CardTitle>LatentMAS Protocol Documentation</CardTitle></CardHeader>
              <CardContent className="prose dark:prose-invert">
                <p>The W-Matrix protocol enables direct KV-Cache exchange between different AI models, allowing AI agents to share reasoning processes.</p>
                <h4>How it works</h4>
                <ol>
                  <li>Standardized W-Matrix: Pre-defined transformation matrices</li>
                  <li>KV-Cache Extraction: Extract attention key-values from source model</li>
                  <li>Alignment: W-Matrix transformation to target model space</li>
                  <li>Injection: Inject aligned KV-Cache into target model</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
