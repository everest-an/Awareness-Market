import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navbar from '@/components/Navbar';
import { GitBranch, Upload, CheckCircle, AlertCircle, Loader2, Brain } from 'lucide-react';
import { toast } from 'sonner';

export default function UploadChainPackage() {
  const [, setLocation] = useLocation();
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    version: '1.0.0',
    sourceModel: '',
    targetModel: '',
    stepCount: '',
    problemType: '',
    solutionQuality: '',
    price: '',
    trainingDataset: '',
    tags: '',
  });
  const [chainJson, setChainJson] = useState('');
  const [wMatrixJson, setWMatrixJson] = useState('');

  const createMutation = trpc.packages.createChainPackage.useMutation({
    onSuccess: (data) => {
      toast.success('Chain package created successfully!');
      setLocation(`/package/chain/${data.packageId}`);
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setUploading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.description || !formData.sourceModel || !formData.targetModel) {
      toast.error('Please fill in all required fields');
      return;
    }

    setUploading(true);

    try {
      const rawChain = chainJson ? JSON.parse(chainJson) : null;
      const rawWMatrix = wMatrixJson ? JSON.parse(wMatrixJson) : null;

      if (!rawChain || !rawWMatrix) {
        toast.error('Please provide Chain JSON and W-Matrix JSON');
        setUploading(false);
        return;
      }

      const chain = {
        ...rawChain,
        problemType: rawChain.problemType || formData.problemType || 'general',
        solutionQuality: rawChain.solutionQuality ?? parseFloat(formData.solutionQuality) || 0.85,
        totalSteps: rawChain.totalSteps ?? parseInt(formData.stepCount) || 5,
      };

      const wMatrix = {
        ...rawWMatrix,
        sourceModel: rawWMatrix.sourceModel || formData.sourceModel,
        targetModel: rawWMatrix.targetModel || formData.targetModel,
      };

      await createMutation.mutateAsync({
        name: formData.name,
        description: formData.description,
        version: formData.version,
        chain,
        wMatrix,
        price: parseFloat(formData.price) || 0,
        trainingDataset: formData.trainingDataset,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <GitBranch className="h-12 w-12 text-emerald-400" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Upload Chain Package
            </h1>
          </div>
          <p className="text-xl text-slate-300">
            Share your AI reasoning chains with the community
          </p>
        </div>

        {/* Upload Form */}
        <Card className="p-8 bg-slate-900/50 border-slate-800">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                Basic Information
              </h2>

              <div>
                <Label htmlFor="name" className="text-slate-300">Package Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Math Problem Solving Chain"
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-slate-300">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe the reasoning process and what problems it solves..."
                  className="bg-slate-800 border-slate-700 text-white mt-1 min-h-[100px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="version" className="text-slate-300">Version</Label>
                  <Input
                    id="version"
                    value={formData.version}
                    onChange={(e) => handleChange('version', e.target.value)}
                    placeholder="1.0.0"
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="price" className="text-slate-300">Price (USD) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => handleChange('price', e.target.value)}
                    placeholder="19.99"
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="trainingDataset" className="text-slate-300">Training Dataset *</Label>
                <Input
                  id="trainingDataset"
                  value={formData.trainingDataset}
                  onChange={(e) => handleChange('trainingDataset', e.target.value)}
                  placeholder="e.g., Math Olympiad Problems"
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Brain className="h-5 w-5 text-emerald-400" />
                Chain & W-Matrix JSON
              </h2>
              <div className="space-y-2">
                <Label>Chain JSON</Label>
                <Textarea
                  placeholder='{"steps":[{"stepIndex":1,"description":"Step 1","kvSnapshot":{"keys":[[[0.1]]],"values":[[[0.2]]]}}],"problemType":"general","solutionQuality":0.85,"totalSteps":1}'
                  value={chainJson}
                  onChange={(e) => setChainJson(e.target.value)}
                  className="min-h-[140px] font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>W-Matrix JSON</Label>
                <Textarea
                  placeholder='{"weights":[[0.9,0.1],[0.1,0.9]],"biases":[0.01,0.02],"epsilon":0.12,"sourceModel":"gpt-4","targetModel":"claude-3"}'
                  value={wMatrixJson}
                  onChange={(e) => setWMatrixJson(e.target.value)}
                  className="min-h-[140px] font-mono"
                />
              </div>
            </div>

            {/* Model Configuration */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-cyan-400" />
                Model Configuration
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sourceModel" className="text-slate-300">Source Model *</Label>
                  <Select value={formData.sourceModel} onValueChange={(value) => handleChange('sourceModel', value)}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                      <SelectValue placeholder="Select source model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                      <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                      <SelectItem value="llama-3-70b">LLaMA 3 70B</SelectItem>
                      <SelectItem value="qwen-2-72b">Qwen 2 72B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="targetModel" className="text-slate-300">Target Model *</Label>
                  <Select value={formData.targetModel} onValueChange={(value) => handleChange('targetModel', value)}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                      <SelectValue placeholder="Select target model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                      <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                      <SelectItem value="llama-3-70b">LLaMA 3 70B</SelectItem>
                      <SelectItem value="qwen-2-72b">Qwen 2 72B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Chain Details */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Brain className="h-5 w-5 text-green-400" />
                Chain Details
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stepCount" className="text-slate-300">Number of Steps *</Label>
                  <Input
                    id="stepCount"
                    type="number"
                    value={formData.stepCount}
                    onChange={(e) => handleChange('stepCount', e.target.value)}
                    placeholder="e.g., 10"
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="solutionQuality" className="text-slate-300">Solution Quality (0-1) *</Label>
                  <Input
                    id="solutionQuality"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.solutionQuality}
                    onChange={(e) => handleChange('solutionQuality', e.target.value)}
                    placeholder="e.g., 0.95"
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="problemType" className="text-slate-300">Problem Type *</Label>
                <Select value={formData.problemType} onValueChange={(value) => handleChange('problemType', value)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                    <SelectValue placeholder="Select problem type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="math-proof">Math Proof</SelectItem>
                    <SelectItem value="code-generation">Code Generation</SelectItem>
                    <SelectItem value="legal-analysis">Legal Analysis</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="debugging">Debugging</SelectItem>
                    <SelectItem value="data-analysis">Data Analysis</SelectItem>
                    <SelectItem value="creative-writing">Creative Writing</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tags" className="text-slate-300">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                  placeholder="e.g., math, reasoning, step-by-step"
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pt-6 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/chain-packages')}
                className="border-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={uploading}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Chain Package
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 p-6 bg-slate-900/30 border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-3">🔗 Chain Package Format</h3>
          <p className="text-sm text-slate-400 mb-3">
            A Chain Package (.chainpkg) contains:
          </p>
          <ul className="text-sm text-slate-400 space-y-2 list-disc list-inside">
            <li><strong className="text-white">Reasoning Chain:</strong> Step-by-step thought process with actions and observations</li>
            <li><strong className="text-white">W-Matrix:</strong> Transformation matrix for cross-model reasoning transfer</li>
            <li><strong className="text-white">Problem Type:</strong> Category of problems this chain solves</li>
            <li><strong className="text-white">Quality Metrics:</strong> Solution quality score and information retention</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
