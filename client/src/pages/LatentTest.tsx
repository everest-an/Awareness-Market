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
      toast.success("测试完成");
    } catch (e: any) {
      toast.error(e.message);
    }
    setIsProcessing(false);
  };

  const runWorkflow = async () => {
    if (!inputText.trim()) { toast.error("请输入文本"); return; }
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
      toast.success("Package 生成完成");
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
          <p className="text-muted-foreground">LatentMAS 工作流测试工具</p>
        </div>
      </div>
      <div className="container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="test"><Zap className="w-4 h-4 mr-2" />对齐测试</TabsTrigger>
            <TabsTrigger value="workflow"><Play className="w-4 h-4 mr-2" />完整工作流</TabsTrigger>
            <TabsTrigger value="models"><Cpu className="w-4 h-4 mr-2" />模型库</TabsTrigger>
            <TabsTrigger value="docs"><BookOpen className="w-4 h-4 mr-2" />文档</TabsTrigger>
          </TabsList>
          <TabsContent value="test" className="mt-6">
            <Card>
              <CardHeader><CardTitle>W-Matrix 对齐测试</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>源模型</Label><input className="w-full p-2 border rounded mt-1" value={sourceModel} onChange={e => setSourceModel(e.target.value)} /></div>
                  <div><Label>目标模型</Label><input className="w-full p-2 border rounded mt-1" value={targetModel} onChange={e => setTargetModel(e.target.value)} /></div>
                </div>
                <Button onClick={runTest} disabled={isProcessing} className="w-full">
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  运行对齐测试
                </Button>
                {result && <pre className="p-4 bg-muted rounded text-xs overflow-auto max-h-60">{JSON.stringify(result, null, 2)}</pre>}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="workflow" className="mt-6">
            <Card>
              <CardHeader><CardTitle>完整工作流</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>输入文本</Label><Textarea placeholder="输入文本内容..." value={inputText} onChange={e => setInputText(e.target.value)} className="mt-1" /></div>
                <Button onClick={runWorkflow} disabled={isProcessing} className="w-full">
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  生成 LatentMAS Package
                </Button>
                {result && <pre className="p-4 bg-muted rounded text-xs overflow-auto max-h-60">{JSON.stringify(result, null, 2)}</pre>}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="models" className="mt-6">
            <Card>
              <CardHeader><CardTitle>支持的模型</CardTitle></CardHeader>
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
              <CardHeader><CardTitle>LatentMAS 协议文档</CardTitle></CardHeader>
              <CardContent className="prose dark:prose-invert">
                <p>W-Matrix 协议实现了不同 AI 模型之间的 KV-Cache 直接交换，使 AI 代理能够共享推理过程。</p>
                <h4>工作原理</h4>
                <ol>
                  <li>标准化 W-Matrix：预定义的转换矩阵</li>
                  <li>KV-Cache 提取：从源模型提取注意力键值</li>
                  <li>对齐：W-Matrix 转换到目标模型空间</li>
                  <li>注入：对齐后的 KV-Cache 注入目标模型</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
