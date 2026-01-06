import { useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import {
  Upload,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Brain,
  Zap,
  Box,
  Info,
} from "lucide-react";

type UploadStep = "form" | "validation" | "preview" | "uploading" | "complete";

export default function UploadVectorPackage() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<UploadStep>("form");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form data
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    version: "1.0.0",
    category: "",
    sourceModel: "",
    targetModel: "",
    dimension: "",
    price: "",
    trainingDataset: "",
    tags: "",
  });

  // Files
  const [vectorFile, setVectorFile] = useState<File | null>(null);
  const [wMatrixFile, setWMatrixFile] = useState<File | null>(null);

  // W-Matrix metrics
  const [wMatrixMetrics, setWMatrixMetrics] = useState({
    epsilon: "",
    orthogonalityScore: "",
    trainingAnchors: "",
  });

  const [validationResult, setValidationResult] = useState<any>(null);

  // Create package mutation
  const createPackageMutation = trpc.packages.createVectorPackage.useMutation({
    onSuccess: () => {
      setCurrentStep("complete");
      toast.success("Vector Package published successfully!");
      setTimeout(() => {
        setLocation("/vector-packages");
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.message || "Upload failed");
      setCurrentStep("form");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "vector" | "wmatrix") => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast.error("File size cannot exceed 100MB");
        return;
      }

      if (type === "vector") {
        setVectorFile(file);
        toast.success("Vector file selected");
      } else {
        setWMatrixFile(file);
        toast.success("W-Matrix file selected");
      }
    }
  };

  const validatePackage = async () => {
    // Validation checks
    if (!vectorFile || !wMatrixFile) {
      toast.error("Please upload both vector and W-Matrix files");
      return;
    }

    if (!formData.name || !formData.description || !formData.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!formData.sourceModel || !formData.targetModel) {
      toast.error("Please specify source and target models");
      return;
    }

    if (!wMatrixMetrics.epsilon) {
      toast.error("Please provide W-Matrix epsilon value");
      return;
    }

    const epsilon = parseFloat(wMatrixMetrics.epsilon);
    if (isNaN(epsilon) || epsilon < 0 || epsilon > 1) {
      toast.error("Epsilon must be between 0 and 1");
      return;
    }

    setCurrentStep("validation");

    // Simulate validation
    setTimeout(() => {
      const validation = {
        isValid: true,
        vectorFormat: "safetensors",
        wMatrixFormat: "safetensors",
        detectedDimension: parseInt(formData.dimension) || 768,
        vectorSize: vectorFile.size,
        wMatrixSize: wMatrixFile.size,
        epsilon: epsilon,
        qualityGrade: epsilon < 0.05 ? "excellent" : epsilon < 0.10 ? "good" : epsilon < 0.15 ? "fair" : "poor",
        warnings: [] as string[],
      };

      // Add warnings
      if (epsilon > 0.10) {
        validation.warnings.push("Epsilon > 10% may result in lower alignment quality");
      }
      if (!wMatrixMetrics.orthogonalityScore) {
        validation.warnings.push("Orthogonality score not provided");
      }
      if (!formData.trainingDataset) {
        validation.warnings.push("Training dataset information not provided");
      }

      setValidationResult(validation);
      setCurrentStep("preview");
    }, 1500);
  };

  const handleSubmit = async () => {
    if (!validationResult?.isValid) {
      toast.error("Please validate the package first");
      return;
    }

    setCurrentStep("uploading");

    // Simulate file upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // In a real implementation, you would:
      // 1. Upload vector file to S3
      // 2. Upload W-Matrix file to S3
      // 3. Create package with URLs

      // For now, simulate the API call
      await createPackageMutation.mutateAsync({
        name: formData.name,
        description: formData.description,
        version: formData.version,
        vector: {
          vector: [], // Would be loaded from file
          dimension: parseInt(formData.dimension) || 768,
          category: formData.category as any,
          performanceMetrics: {},
        },
        wMatrix: {
          weights: [], // Would be loaded from file
          biases: [],
          epsilon: parseFloat(wMatrixMetrics.epsilon),
          orthogonalityScore: wMatrixMetrics.orthogonalityScore ? parseFloat(wMatrixMetrics.orthogonalityScore) : undefined,
          trainingAnchors: wMatrixMetrics.trainingAnchors ? parseInt(wMatrixMetrics.trainingAnchors) : undefined,
          sourceModel: formData.sourceModel,
          targetModel: formData.targetModel,
          sourceDimension: parseInt(formData.dimension) || 768,
          targetDimension: parseInt(formData.dimension) || 768,
        },
        price: parseFloat(formData.price),
        trainingDataset: formData.trainingDataset,
        tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()) : undefined,
      });

      setUploadProgress(100);
      clearInterval(progressInterval);
    } catch (error) {
      clearInterval(progressInterval);
      setUploadProgress(0);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[
        { step: "form", label: "Form", icon: FileCheck },
        { step: "validation", label: "Validation", icon: CheckCircle2 },
        { step: "preview", label: "Preview", icon: Brain },
        { step: "uploading", label: "Upload", icon: Upload },
        { step: "complete", label: "Complete", icon: Zap },
      ].map(({ step, label, icon: Icon }, index) => {
        const stepIndex = ["form", "validation", "preview", "uploading", "complete"].indexOf(currentStep);
        const currentIndex = ["form", "validation", "preview", "uploading", "complete"].indexOf(step);
        const isActive = currentIndex === stepIndex;
        const isCompleted = currentIndex < stepIndex;

        return (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                isActive
                  ? "bg-cyan-500 text-white"
                  : isCompleted
                  ? "bg-green-500 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{label}</span>
            </div>
            {index < 4 && (
              <div
                className={`w-8 h-0.5 mx-1 ${
                  isCompleted ? "bg-green-500" : "bg-slate-800"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-8">
          <Link href="/vector-packages">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Vector Packages
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Box className="h-8 w-8 text-cyan-400" />
            <h1 className="text-3xl font-bold text-white">Upload Vector Package</h1>
          </div>
          <p className="text-slate-400">
            Publish your trained vector with W-Matrix for cross-model compatibility
          </p>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Form Step */}
        {currentStep === "form" && (
          <Card className="max-w-3xl mx-auto bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Package Information</CardTitle>
              <CardDescription>Provide details about your Vector Package</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-white">Package Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Sentiment Analysis Vector"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-white">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe what this vector does and its use cases..."
                    rows={4}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="version" className="text-white">Version</Label>
                    <Input
                      id="version"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      placeholder="1.0.0"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="category" className="text-white">Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nlp">NLP</SelectItem>
                        <SelectItem value="vision">Vision</SelectItem>
                        <SelectItem value="audio">Audio</SelectItem>
                        <SelectItem value="multimodal">Multimodal</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Model Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Model Configuration</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sourceModel" className="text-white">Source Model *</Label>
                    <Select value={formData.sourceModel} onValueChange={(value) => setFormData({ ...formData, sourceModel: value })}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select source model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="claude-3">Claude-3</SelectItem>
                        <SelectItem value="llama-3">LLaMA-3</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="deepseek">DeepSeek</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="targetModel" className="text-white">Target Model *</Label>
                    <Select value={formData.targetModel} onValueChange={(value) => setFormData({ ...formData, targetModel: value })}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select target model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="claude-3">Claude-3</SelectItem>
                        <SelectItem value="llama-3">LLaMA-3</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="deepseek">DeepSeek</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="dimension" className="text-white">Vector Dimension</Label>
                  <Input
                    id="dimension"
                    type="number"
                    value={formData.dimension}
                    onChange={(e) => setFormData({ ...formData, dimension: e.target.value })}
                    placeholder="768"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>

              {/* File Uploads */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Files</h3>

                <div>
                  <Label htmlFor="vectorFile" className="text-white">Vector File (.safetensors) *</Label>
                  <div className="mt-2">
                    <Input
                      id="vectorFile"
                      type="file"
                      accept=".safetensors,.pt,.bin"
                      onChange={(e) => handleFileChange(e, "vector")}
                      className="bg-slate-800 border-slate-700 text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500 file:text-white hover:file:bg-cyan-600"
                    />
                    {vectorFile && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{vectorFile.name} ({(vectorFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="wMatrixFile" className="text-white">W-Matrix File (.safetensors) *</Label>
                  <div className="mt-2">
                    <Input
                      id="wMatrixFile"
                      type="file"
                      accept=".safetensors,.pt,.bin"
                      onChange={(e) => handleFileChange(e, "wmatrix")}
                      className="bg-slate-800 border-slate-700 text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500 file:text-white hover:file:bg-cyan-600"
                    />
                    {wMatrixFile && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{wMatrixFile.name} ({(wMatrixFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* W-Matrix Metrics */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">W-Matrix Quality Metrics</h3>

                <Alert className="bg-blue-500/10 border-blue-500/50">
                  <Info className="h-4 w-4 text-blue-400" />
                  <AlertDescription className="text-blue-300">
                    Epsilon measures alignment quality. Lower is better. Recommended: &lt; 10%
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="epsilon" className="text-white">Epsilon (0-1) *</Label>
                    <Input
                      id="epsilon"
                      type="number"
                      step="0.001"
                      value={wMatrixMetrics.epsilon}
                      onChange={(e) => setWMatrixMetrics({ ...wMatrixMetrics, epsilon: e.target.value })}
                      placeholder="0.08"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="orthogonalityScore" className="text-white">Orthogonality Score</Label>
                    <Input
                      id="orthogonalityScore"
                      type="number"
                      step="0.01"
                      value={wMatrixMetrics.orthogonalityScore}
                      onChange={(e) => setWMatrixMetrics({ ...wMatrixMetrics, orthogonalityScore: e.target.value })}
                      placeholder="0.95"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="trainingAnchors" className="text-white">Training Anchors</Label>
                    <Input
                      id="trainingAnchors"
                      type="number"
                      value={wMatrixMetrics.trainingAnchors}
                      onChange={(e) => setWMatrixMetrics({ ...wMatrixMetrics, trainingAnchors: e.target.value })}
                      placeholder="1000"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="price" className="text-white">Price (USD) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="9.99"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="trainingDataset" className="text-white">Training Dataset</Label>
                  <Input
                    id="trainingDataset"
                    value={formData.trainingDataset}
                    onChange={(e) => setFormData({ ...formData, trainingDataset: e.target.value })}
                    placeholder="e.g., IMDB, Wikipedia, Custom Dataset"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="tags" className="text-white">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="sentiment, nlp, classification"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>

              <Button
                onClick={validatePackage}
                className="w-full bg-cyan-500 hover:bg-cyan-600"
                size="lg"
              >
                <FileCheck className="h-4 w-4 mr-2" />
                Validate Package
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Validation Step */}
        {currentStep === "validation" && (
          <Card className="max-w-3xl mx-auto bg-slate-900/50 border-slate-800">
            <CardContent className="py-12">
              <div className="text-center">
                <Loader2 className="h-16 w-16 animate-spin text-cyan-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Validating Package...</h3>
                <p className="text-slate-400">Checking vector format, W-Matrix quality, and compatibility</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview Step */}
        {currentStep === "preview" && validationResult && (
          <Card className="max-w-3xl mx-auto bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
                Validation Complete
              </CardTitle>
              <CardDescription>Review your package before publishing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Validation Results */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-sm text-slate-400 mb-1">Vector Format</div>
                  <div className="text-lg font-semibold text-white">{validationResult.vectorFormat}</div>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-sm text-slate-400 mb-1">W-Matrix Format</div>
                  <div className="text-lg font-semibold text-white">{validationResult.wMatrixFormat}</div>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-sm text-slate-400 mb-1">Dimension</div>
                  <div className="text-lg font-semibold text-white">{validationResult.detectedDimension}</div>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-sm text-slate-400 mb-1">Quality Grade</div>
                  <Badge className={
                    validationResult.qualityGrade === "excellent" ? "bg-green-500" :
                    validationResult.qualityGrade === "good" ? "bg-blue-500" :
                    validationResult.qualityGrade === "fair" ? "bg-yellow-500" :
                    "bg-red-500"
                  }>
                    {validationResult.qualityGrade.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Warnings */}
              {validationResult.warnings.length > 0 && (
                <Alert className="bg-yellow-500/10 border-yellow-500/50">
                  <AlertCircle className="h-4 w-4 text-yellow-400" />
                  <AlertDescription className="text-yellow-300">
                    <div className="font-semibold mb-2">Warnings:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {validationResult.warnings.map((warning: string, index: number) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Package Preview */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Package Preview</h3>
                <div className="p-4 bg-slate-800/50 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Name:</span>
                    <span className="text-white font-medium">{formData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Category:</span>
                    <span className="text-white font-medium">{formData.category.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Model Transfer:</span>
                    <span className="text-white font-medium">{formData.sourceModel} → {formData.targetModel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price:</span>
                    <span className="text-white font-medium">${formData.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Epsilon:</span>
                    <span className="text-white font-medium">{(parseFloat(wMatrixMetrics.epsilon) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={() => setCurrentStep("form")}
                  variant="outline"
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Edit
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-600"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Publish Package
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Uploading Step */}
        {currentStep === "uploading" && (
          <Card className="max-w-3xl mx-auto bg-slate-900/50 border-slate-800">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <Loader2 className="h-16 w-16 animate-spin text-cyan-400 mx-auto" />
                <h3 className="text-xl font-semibold text-white">Publishing Package...</h3>
                <p className="text-slate-400">Uploading files and creating package</p>
                <div className="max-w-md mx-auto">
                  <Progress value={uploadProgress} className="h-2" />
                  <div className="text-sm text-slate-400 mt-2">{uploadProgress}% complete</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Step */}
        {currentStep === "complete" && (
          <Card className="max-w-3xl mx-auto bg-slate-900/50 border-slate-800">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto" />
                <h3 className="text-2xl font-bold text-white">Package Published!</h3>
                <p className="text-slate-400">Your Vector Package is now live on the marketplace</p>
                <Button
                  onClick={() => setLocation("/vector-packages")}
                  className="bg-cyan-500 hover:bg-cyan-600"
                >
                  View in Marketplace
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
