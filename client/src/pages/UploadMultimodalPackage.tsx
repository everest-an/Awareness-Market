import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Navbar from '@/components/Navbar';
import { toast } from 'sonner';
import {
  Upload,
  Loader2,
  FileText,
  Image as ImageIcon,
  Music,
  Layers,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';

type Modality = 'text' | 'image' | 'audio' | 'video';
type FusionMethod = 'early' | 'late' | 'hybrid' | 'attention';

export default function UploadMultimodalPackage() {
  const [, setLocation] = useLocation();
  const [uploading, setUploading] = useState(false);

  // Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [tags, setTags] = useState('');

  // Modalities
  const [selectedModalities, setSelectedModalities] = useState<Modality[]>(['text', 'image']);
  const [textVector, setTextVector] = useState('');
  const [imageVector, setImageVector] = useState('');
  const [audioVector, setAudioVector] = useState('');
  const [videoVector, setVideoVector] = useState('');

  // Fusion settings
  const [fusionMethod, setFusionMethod] = useState<FusionMethod>('hybrid');
  const [weights, setWeights] = useState<Record<Modality, number>>({
    text: 0.4,
    image: 0.3,
    audio: 0.2,
    video: 0.1,
  });

  const createMutation = trpc.multimodal.uploadMultimodalPackage.useMutation({
    onSuccess: (data) => {
      toast.success('Multi-modal package created successfully!');
      setLocation(`/package/multimodal/${data.packageId}`);
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setUploading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !description || selectedModalities.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setUploading(true);

    try {
      const modalities: Record<string, any> = {};

      if (selectedModalities.includes('text') && textVector) {
        modalities.text = {
          vector: JSON.parse(textVector),
          dimension: JSON.parse(textVector).length,
        };
      }

      if (selectedModalities.includes('image') && imageVector) {
        modalities.image = {
          vector: JSON.parse(imageVector),
          dimension: JSON.parse(imageVector).length,
        };
      }

      if (selectedModalities.includes('audio') && audioVector) {
        modalities.audio = {
          vector: JSON.parse(audioVector),
          dimension: JSON.parse(audioVector).length,
        };
      }

      if (selectedModalities.includes('video') && videoVector) {
        modalities.video = {
          vector: JSON.parse(videoVector),
          dimension: JSON.parse(videoVector).length,
        };
      }

      const fusionWeights: Record<string, number> = {};
      selectedModalities.forEach(mod => {
        fusionWeights[mod] = weights[mod];
      });

      await createMutation.mutateAsync({
        name,
        description,
        modalities,
        fusionMethod,
        fusionWeights,
        price: parseFloat(price) || 0,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      });
    } catch (error: any) {
      toast.error(`Upload error: ${error.message}`);
      setUploading(false);
    }
  };

  const toggleModality = (modality: Modality) => {
    setSelectedModalities(prev =>
      prev.includes(modality)
        ? prev.filter(m => m !== modality)
        : [...prev, modality]
    );
  };

  const normalizeWeights = () => {
    const total = selectedModalities.reduce((sum, mod) => sum + weights[mod], 0);
    if (total === 0) return;

    const normalized: Record<Modality, number> = { ...weights };
    selectedModalities.forEach(mod => {
      normalized[mod] = weights[mod] / total;
    });
    setWeights(normalized);
    toast.success('Weights normalized to sum to 1.0');
  };

  const fusionDescriptions: Record<FusionMethod, string> = {
    early: 'Concatenate vectors before processing (best for correlated modalities)',
    late: 'Process each modality separately, then combine (best for independent features)',
    hybrid: 'Combine early and late fusion with learned weights (balanced approach)',
    attention: 'Use cross-modal attention mechanism (best for complex interactions)',
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-16 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Layers className="h-12 w-12 text-purple-400" />
            <h1 className="text-4xl font-bold">
              Upload Multi-Modal Package
            </h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Share AI capabilities across text, image, audio, and video
          </p>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Package Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Image-Text Alignment Model"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the multi-modal capability..."
                  className="min-h-[100px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (USD) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="19.99"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="vision, nlp, multimodal"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Modality Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-500" />
                Select Modalities
              </CardTitle>
              <CardDescription>
                Choose which modalities your package supports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { id: 'text' as Modality, icon: FileText, label: 'Text', color: 'blue' },
                  { id: 'image' as Modality, icon: ImageIcon, label: 'Image', color: 'green' },
                  { id: 'audio' as Modality, icon: Music, label: 'Audio', color: 'orange' },
                  { id: 'video' as Modality, icon: Music, label: 'Video', color: 'purple' },
                ].map(({ id, icon: Icon, label, color }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleModality(id)}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      selectedModalities.includes(id)
                        ? `border-${color}-500 bg-${color}-500/10`
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <Icon className={`h-8 w-8 mx-auto mb-2 ${
                      selectedModalities.includes(id) ? `text-${color}-500` : 'text-muted-foreground'
                    }`} />
                    <p className="text-sm font-medium text-center">{label}</p>
                    {selectedModalities.includes(id) && (
                      <CheckCircle2 className="h-4 w-4 mx-auto mt-1 text-green-500" />
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Modality Vectors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Modality Vectors
              </CardTitle>
              <CardDescription>
                Provide vectors for each selected modality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="text" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="text" disabled={!selectedModalities.includes('text')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Text
                  </TabsTrigger>
                  <TabsTrigger value="image" disabled={!selectedModalities.includes('image')}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Image
                  </TabsTrigger>
                  <TabsTrigger value="audio" disabled={!selectedModalities.includes('audio')}>
                    <Music className="h-4 w-4 mr-2" />
                    Audio
                  </TabsTrigger>
                  <TabsTrigger value="video" disabled={!selectedModalities.includes('video')}>
                    <Music className="h-4 w-4 mr-2" />
                    Video
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-2">
                  <Label>Text Vector (JSON Array)</Label>
                  <Textarea
                    placeholder='[0.1, 0.2, 0.3, ..., 0.768]'
                    value={textVector}
                    onChange={(e) => setTextVector(e.target.value)}
                    className="font-mono text-sm min-h-[120px]"
                  />
                </TabsContent>

                <TabsContent value="image" className="space-y-2">
                  <Label>Image Vector (JSON Array)</Label>
                  <Textarea
                    placeholder='[0.1, 0.2, 0.3, ..., 0.512]'
                    value={imageVector}
                    onChange={(e) => setImageVector(e.target.value)}
                    className="font-mono text-sm min-h-[120px]"
                  />
                </TabsContent>

                <TabsContent value="audio" className="space-y-2">
                  <Label>Audio Vector (JSON Array)</Label>
                  <Textarea
                    placeholder='[0.1, 0.2, 0.3, ..., 0.256]'
                    value={audioVector}
                    onChange={(e) => setAudioVector(e.target.value)}
                    className="font-mono text-sm min-h-[120px]"
                  />
                </TabsContent>

                <TabsContent value="video" className="space-y-2">
                  <Label>Video Vector (JSON Array)</Label>
                  <Textarea
                    placeholder='[0.1, 0.2, 0.3, ..., 0.1024]'
                    value={videoVector}
                    onChange={(e) => setVideoVector(e.target.value)}
                    className="font-mono text-sm min-h-[120px]"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Fusion Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-500" />
                Fusion Configuration
              </CardTitle>
              <CardDescription>
                Configure how modalities are combined
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Fusion Method</Label>
                <Select value={fusionMethod} onValueChange={(value: FusionMethod) => setFusionMethod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="early">Early Fusion</SelectItem>
                    <SelectItem value="late">Late Fusion</SelectItem>
                    <SelectItem value="hybrid">Hybrid Fusion (Recommended)</SelectItem>
                    <SelectItem value="attention">Attention Fusion</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {fusionDescriptions[fusionMethod]}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Modality Weights</Label>
                  <Button type="button" variant="outline" size="sm" onClick={normalizeWeights}>
                    Normalize
                  </Button>
                </div>

                {selectedModalities.map(modality => (
                  <div key={modality} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="capitalize">{modality}</Label>
                      <Badge variant="outline">{weights[modality].toFixed(2)}</Badge>
                    </div>
                    <Input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={weights[modality]}
                      onChange={(e) => setWeights(prev => ({ ...prev, [modality]: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-medium text-blue-500">Fusion Weights</p>
                    <p className="text-muted-foreground">
                      Weights determine how much each modality contributes to the final fused representation.
                      Higher weights give more importance to that modality.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation('/marketplace')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Multi-Modal Package
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
