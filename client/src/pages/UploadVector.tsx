import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function UploadVector() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    modelArchitecture: "",
    vectorDimension: "",
    performanceMetrics: "",
    basePrice: "",
    pricingModel: "per-call" as "per-call" | "subscription" | "usage-based",
  });
  const [vectorFile, setVectorFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const createMutation = trpc.vectors.create.useMutation({
    onSuccess: () => {
      toast.success("AI capability uploaded successfully!");
      setLocation("/dashboard/creator");
    },
    onError: (error) => {
      toast.error(error.message || "Upload failed");
      setIsUploading(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error("File size must be less than 50MB");
        return;
      }
      setVectorFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!vectorFile) {
      toast.error("Please select a vector file");
      return;
    }

    if (!formData.title || !formData.description || !formData.category || !formData.basePrice) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsUploading(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result?.toString().split(',')[1] || "";
        
        await createMutation.mutateAsync({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          vectorFile: {
            data: base64Data,
            mimeType: vectorFile.type || "application/octet-stream",
          },
          modelArchitecture: formData.modelArchitecture || undefined,
          vectorDimension: formData.vectorDimension ? parseInt(formData.vectorDimension) : undefined,
          performanceMetrics: formData.performanceMetrics || undefined,
          basePrice: parseFloat(formData.basePrice),
          pricingModel: formData.pricingModel,
        });
      };
      reader.readAsDataURL(vectorFile);
    } catch (error) {
      console.error("Upload error:", error);
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-muted/30">
        <div className="container py-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/dashboard/creator">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Upload AI Capability</h1>
          <p className="text-muted-foreground">
            Share your latent space vectors with the community
          </p>
        </div>
      </div>

      <div className="container py-8">
        <div className="mx-auto max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Provide essential details about your AI capability
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g., Financial Sentiment Analysis Model"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">
                    Description <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what your AI capability does, its strengths, and ideal use cases..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={5}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Financial Analysis">Financial Analysis</SelectItem>
                      <SelectItem value="Code Generation">Code Generation</SelectItem>
                      <SelectItem value="Medical Diagnosis">Medical Diagnosis</SelectItem>
                      <SelectItem value="Content Creation">Content Creation</SelectItem>
                      <SelectItem value="Natural Language Processing">Natural Language Processing</SelectItem>
                      <SelectItem value="Computer Vision">Computer Vision</SelectItem>
                      <SelectItem value="Data Analysis">Data Analysis</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Technical Details */}
            <Card>
              <CardHeader>
                <CardTitle>Technical Details</CardTitle>
                <CardDescription>
                  Provide technical specifications (optional but recommended)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="modelArchitecture">Model Architecture</Label>
                  <Input
                    id="modelArchitecture"
                    placeholder="e.g., Transformer, BERT, GPT-4, Custom CNN"
                    value={formData.modelArchitecture}
                    onChange={(e) => setFormData({ ...formData, modelArchitecture: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vectorDimension">Vector Dimensions</Label>
                  <Input
                    id="vectorDimension"
                    type="number"
                    placeholder="e.g., 768, 1024, 2048"
                    value={formData.vectorDimension}
                    onChange={(e) => setFormData({ ...formData, vectorDimension: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="performanceMetrics">Performance Metrics (JSON)</Label>
                  <Textarea
                    id="performanceMetrics"
                    placeholder='{"accuracy": 0.95, "latency_ms": 50, "throughput_qps": 1000}'
                    value={formData.performanceMetrics}
                    onChange={(e) => setFormData({ ...formData, performanceMetrics: e.target.value })}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Provide performance metrics in JSON format
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Vector File Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Vector File</CardTitle>
                <CardDescription>
                  Upload your latent space vector file (max 50MB)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="vectorFile">
                    Vector File <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="vectorFile"
                      type="file"
                      accept=".bin,.pt,.pth,.safetensors,.onnx,.pkl"
                      onChange={handleFileChange}
                      required
                    />
                    {vectorFile && (
                      <span className="text-sm text-muted-foreground">
                        {(vectorFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: .bin, .pt, .pth, .safetensors, .onnx, .pkl
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>
                  Set your pricing model and base price
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pricingModel">Pricing Model</Label>
                  <Select
                    value={formData.pricingModel}
                    onValueChange={(value: any) => setFormData({ ...formData, pricingModel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per-call">Per Call</SelectItem>
                      <SelectItem value="subscription">Monthly Subscription</SelectItem>
                      <SelectItem value="usage-based">Usage-Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="basePrice">
                    Base Price (USD) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="basePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g., 0.10 for per-call, 49.99 for subscription"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Platform fee: 20% | Your earnings: 80%
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Your vector will be saved as draft and can be published later
              </p>
              <Button type="submit" size="lg" disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Upload Vector
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
