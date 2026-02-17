import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Box,
  Zap,
  CheckCircle,
  XCircle,
  ArrowRight,
  Clock,
  Cpu,
  BarChart3,
  ListOrdered,
  Settings,
} from 'lucide-react';

export default function WMatrixTools() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Compatibility check state
  const [sourceModel, setSourceModel] = useState('gpt-4');
  const [targetModel, setTargetModel] = useState('claude-3');

  // Training state
  const [trainSource, setTrainSource] = useState('gpt-4');
  const [trainTarget, setTrainTarget] = useState('claude-3');

  // Time estimate state
  const [datasetSize, setDatasetSize] = useState('500');
  const [inputDim, setInputDim] = useState('1536');
  const [outputDim, setOutputDim] = useState('1536');

  // Queries
  const { data: supportedModels } = trpc.wMatrix.getSupportedModels.useQuery();
  const { data: currentVersion } = trpc.wMatrix.getCurrentVersion.useQuery();

  const { data: compatibility, refetch: checkCompat } = trpc.wMatrix.checkCompatibility.useQuery(
    { model1: sourceModel, model2: targetModel },
    { enabled: false }
  );

  const { data: timeEstimate, refetch: estimateTime } = trpc.wMatrixMarketplace.estimateTrainingTime.useQuery(
    {
      datasetSize: parseInt(datasetSize) || 500,
      inputDimension: parseInt(inputDim) || 1536,
      outputDimension: parseInt(outputDim) || 1536,
    },
    { enabled: false }
  );

  // Alignment versions
  const { data: versions } = trpc.alignment.listVersions.useQuery();

  // Training mutation
  const trainMutation = trpc.wMatrixMarketplace.trainWMatrixWithGPU.useMutation({
    onSuccess: (data: any) => {
      toast({
        title: 'Training Complete',
        description: `Certification: ${data.qualityMetrics?.certificationLevel || 'pending'}`,
      });
    },
    onError: (err) => {
      toast({ title: 'Training Failed', description: err.message, variant: 'destructive' });
    },
  });

  const modelPairs = (supportedModels as any)?.pairs || supportedModels || [];
  const modelList = Array.isArray(modelPairs) ? modelPairs : [];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Navbar />

      <div className="max-w-5xl mx-auto pt-24 px-6 pb-12 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Box className="h-7 w-7 text-purple-400" />
            W-Matrix Tools
          </h1>
          <p className="text-sm text-white/30 mt-1">
            Check model compatibility, estimate training time, and manage W-Matrix versions
          </p>
          {currentVersion && (
            <Badge className="mt-2 bg-purple-500/20 text-purple-300">
              Protocol: {(currentVersion as any).version || JSON.stringify(currentVersion)}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="compatibility">
          <TabsList className="bg-slate-900/50">
            <TabsTrigger value="compatibility">Compatibility</TabsTrigger>
            <TabsTrigger value="estimate">Training Estimate</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="models">Supported Models</TabsTrigger>
          </TabsList>

          {/* Compatibility Check */}
          <TabsContent value="compatibility" className="space-y-4 mt-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-400" />
                  Model Compatibility Check
                </CardTitle>
                <CardDescription>
                  Verify if two models can transfer knowledge via W-Matrix
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Select value={sourceModel} onValueChange={setSourceModel}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white flex-1">
                      <SelectValue placeholder="Source Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="claude-3">Claude 3</SelectItem>
                      <SelectItem value="llama-3">LLaMA 3</SelectItem>
                      <SelectItem value="qwen-2">Qwen 2</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                    </SelectContent>
                  </Select>

                  <ArrowRight className="h-5 w-5 text-slate-400 shrink-0" />

                  <Select value={targetModel} onValueChange={setTargetModel}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white flex-1">
                      <SelectValue placeholder="Target Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="claude-3">Claude 3</SelectItem>
                      <SelectItem value="llama-3">LLaMA 3</SelectItem>
                      <SelectItem value="qwen-2">Qwen 2</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={() => checkCompat()}
                    className="bg-purple-500 hover:bg-purple-600"
                  >
                    Check
                  </Button>
                </div>

                {compatibility && (
                  <div className="p-4 bg-slate-800/50 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      {(compatibility as any).compatible ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-400" />
                          <span className="text-green-400 font-medium">Compatible</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-400" />
                          <span className="text-red-400 font-medium">Not Compatible</span>
                        </>
                      )}
                    </div>
                    {(compatibility as any).message && (
                      <p className="text-sm text-slate-300">{(compatibility as any).message}</p>
                    )}
                    {(compatibility as any).estimatedEpsilon && (
                      <div className="text-sm text-slate-400">
                        Estimated epsilon: <span className="text-white font-mono">{(compatibility as any).estimatedEpsilon}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Training Time Estimate */}
          <TabsContent value="estimate" className="space-y-4 mt-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-cyan-400" />
                  Training Time Estimate
                </CardTitle>
                <CardDescription>
                  Estimate CPU/GPU training time for a W-Matrix
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Dataset Size (50-10000)</label>
                    <Input
                      type="number"
                      value={datasetSize}
                      onChange={(e) => setDatasetSize(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white"
                      min={50}
                      max={10000}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Input Dimensions</label>
                    <Input
                      type="number"
                      value={inputDim}
                      onChange={(e) => setInputDim(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white"
                      min={64}
                      max={4096}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Output Dimensions</label>
                    <Input
                      type="number"
                      value={outputDim}
                      onChange={(e) => setOutputDim(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white"
                      min={64}
                      max={4096}
                    />
                  </div>
                </div>

                <Button
                  onClick={() => estimateTime()}
                  className="bg-cyan-500 hover:bg-cyan-600"
                >
                  <Cpu className="h-4 w-4 mr-2" />
                  Estimate
                </Button>

                {timeEstimate && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">CPU Estimate</div>
                      <div className="text-2xl font-bold text-white">{(timeEstimate as any).cpuTime || '—'}</div>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <div className="text-sm text-slate-400 mb-1">GPU Estimate</div>
                      <div className="text-2xl font-bold text-green-400">{(timeEstimate as any).gpuTime || '—'}</div>
                    </div>
                    {(timeEstimate as any).speedupFactor && (
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="text-sm text-slate-400 mb-1">GPU Speedup</div>
                        <div className="text-xl font-bold text-purple-400">{(timeEstimate as any).speedupFactor}x</div>
                      </div>
                    )}
                    {(timeEstimate as any).recommendation && (
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="text-sm text-slate-400 mb-1">Recommendation</div>
                        <div className="text-sm text-white">{(timeEstimate as any).recommendation}</div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Versions */}
          <TabsContent value="versions" className="space-y-4 mt-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListOrdered className="h-5 w-5 text-yellow-400" />
                  W-Matrix Versions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {versions && Array.isArray(versions) && versions.length > 0 ? (
                  <div className="space-y-2">
                    {versions.map((ver: any) => (
                      <div key={ver.id || ver.version} className="flex items-center justify-between p-3 bg-slate-800/30 rounded hover:bg-slate-800/50 transition-colors">
                        <div>
                          <div className="text-sm font-medium text-white">
                            v{ver.version || ver.id}
                          </div>
                          <div className="text-xs text-slate-400">
                            {ver.sourceModel} → {ver.targetModel}
                            {ver.epsilon && <> &middot; ε = {Number(ver.epsilon).toFixed(4)}</>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ver.status && (
                            <Badge className={ver.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-slate-500/20 text-slate-300'}>
                              {ver.status}
                            </Badge>
                          )}
                          {ver.fidelity && (
                            <span className="text-xs text-cyan-400 font-mono">
                              {(Number(ver.fidelity) * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <ListOrdered className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No W-Matrix versions available</p>
                    <p className="text-xs mt-1">Train a W-Matrix to create a new version</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Supported Models */}
          <TabsContent value="models" className="space-y-4 mt-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5 text-slate-400" />
                  Supported Model Pairs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {modelList.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {modelList.map((pair: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-800/30 rounded">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-white">{pair.sourceModel || pair.source || pair[0]}</span>
                          <ArrowRight className="h-3 w-3 text-purple-400" />
                          <span className="font-mono text-white">{pair.targetModel || pair.target || pair[1]}</span>
                        </div>
                        {pair.status && (
                          <Badge className="text-[10px] bg-green-500/20 text-green-300">{pair.status}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <p>Loading supported model pairs...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
