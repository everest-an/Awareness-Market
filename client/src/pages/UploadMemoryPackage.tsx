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
import { Database, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function UploadMemoryPackage() {
  const [, setLocation] = useLocation();
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    version: '1.0.0',
    sourceModel: '',
    targetModel: '',
    tokenCount: '',
    compressionRatio: '',
    contextDescription: '',
    price: '',
    trainingDataset: '',
    tags: '',
  });
  const [kvCacheJson, setKvCacheJson] = useState('');
  const [wMatrixJson, setWMatrixJson] = useState('');

  const createMutation = trpc.packages.createMemoryPackage.useMutation({
    onSuccess: (data) => {
      toast.success('Memory package created successfully!');
      setLocation(`/package/memory/${data.packageId}`);
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
      const rawKvCache = kvCacheJson ? JSON.parse(kvCacheJson) : null;
      const rawWMatrix = wMatrixJson ? JSON.parse(wMatrixJson) : null;

      if (!rawKvCache || !rawWMatrix) {
        toast.error('Please provide KV-Cache JSON and W-Matrix JSON');
        setUploading(false);
        return;
      }

      const wMatrix = {
        ...rawWMatrix,
        sourceModel: rawWMatrix.sourceModel || formData.sourceModel,
        targetModel: rawWMatrix.targetModel || formData.targetModel,
      };

      await createMutation.mutateAsync({
        name: formData.name,
        description: formData.description,
        version: formData.version,
        kvCache: rawKvCache,
        wMatrix,
        tokenCount: parseInt(formData.tokenCount) || 1000,
        compressionRatio: parseFloat(formData.compressionRatio) || 0.5,
        contextDescription: formData.contextDescription,
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

      <div className="pt-20 container mx-auto px-4 py-16 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Database className="h-12 w-12 text-purple-400" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Upload Memory Package
            </h1>
          </div>
          <p className="text-xl text-slate-300">
            Share your AI memories with the community
          </p>
        </div>

        {/* Upload Form */}
        <Card className="p-8 bg-slate-900/50 border-slate-800">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-purple-400" />
                Basic Information
              </h2>

              <div>
                <Label htmlFor="name" className="text-slate-300">Package Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., GPT-4 Conversation Memory"
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
                  placeholder="Describe what this memory contains and its use cases..."
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
                    placeholder="9.99"
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-purple-400" />
                KV-Cache & W-Matrix JSON
              </h2>
              <div className="space-y-2">
                <Label>KV-Cache JSON</Label>
                <Textarea
                  placeholder='{"keys":[[[0.1,0.2]]],"values":[[[0.3,0.4]]],"attentionWeights":[0.9]}'
                  value={kvCacheJson}
                  onChange={(e) => setKvCacheJson(e.target.value)}
                  className="min-h-[140px] font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>W-Matrix JSON</Label>
                <Textarea
                  placeholder='{"weights":[[0.9,0.1],[0.1,0.9]],"biases":[0.01,0.02],"epsilon":0.15,"sourceModel":"gpt-4","targetModel":"claude-3"}'
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

            {/* Memory Details */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-green-400" />
                Memory Details
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tokenCount" className="text-slate-300">Token Count *</Label>
                  <Input
                    id="tokenCount"
                    type="number"
                    value={formData.tokenCount}
                    onChange={(e) => handleChange('tokenCount', e.target.value)}
                    placeholder="e.g., 2048"
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="compressionRatio" className="text-slate-300">Compression Ratio (0-1) *</Label>
                  <Input
                    id="compressionRatio"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.compressionRatio}
                    onChange={(e) => handleChange('compressionRatio', e.target.value)}
                    placeholder="e.g., 0.75"
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="contextDescription" className="text-slate-300">Context Description *</Label>
                <Textarea
                  id="contextDescription"
                  value={formData.contextDescription}
                  onChange={(e) => handleChange('contextDescription', e.target.value)}
                  placeholder="Describe the context of this memory (e.g., technical discussion, creative writing, code review...)"
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="trainingDataset" className="text-slate-300">Training Dataset</Label>
                <Input
                  id="trainingDataset"
                  value={formData.trainingDataset}
                  onChange={(e) => handleChange('trainingDataset', e.target.value)}
                  placeholder="e.g., Custom conversation dataset"
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                />
              </div>

              <div>
                <Label htmlFor="tags" className="text-slate-300">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                  placeholder="e.g., conversation, technical, gpt-4"
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pt-6 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/memory-marketplace')}
                className="border-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={uploading}
                className="bg-purple-500 hover:bg-purple-600 text-white"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Memory Package
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 p-6 bg-slate-900/30 border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-3">📦 Memory Package Format</h3>
          <p className="text-sm text-slate-400 mb-3">
            A Memory Package (.memorypkg) contains:
          </p>
          <ul className="text-sm text-slate-400 space-y-2 list-disc list-inside">
            <li><strong className="text-white">KV-Cache:</strong> Compressed key-value cache from the source model</li>
            <li><strong className="text-white">W-Matrix:</strong> Transformation matrix for cross-model memory transfer</li>
            <li><strong className="text-white">Metadata:</strong> Model info, compression ratio, and context description</li>
            <li><strong className="text-white">Provenance:</strong> Training dataset and quality metrics</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
