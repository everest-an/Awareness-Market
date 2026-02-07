import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, FileCheck, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";

export default function S3Tester() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedFileKey, setUploadedFileKey] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadedFileUrl(null);
      setUploadedFileKey(null);
      setDownloadUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file first",
        variant: "destructive",
      });
      return;
    }

    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter your API key",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", `Test Upload - ${file.name}`);
      formData.append("description", "Test file upload via S3 Tester");
      formData.append("price", "0.00");
      formData.append("seller_id", "test-user");
      formData.append("category", "test");

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload to W-Matrix Marketplace API
      const wMatrixBase = import.meta.env.VITE_GO_SERVICE_BASE?.replace(/:\d+$/, ':8081') || 'http://localhost:8081';
      const response = await fetch(`${wMatrixBase}/api/v1/listings`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();

      setUploadedFileUrl(data.listing.vector_file_url);
      setUploadedFileKey(data.listing.vector_file_key);

      toast({
        title: "Upload Successful",
        description: `File uploaded to S3: ${data.listing.vector_file_key}`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateDownloadUrl = async () => {
    if (!uploadedFileKey) {
      toast({
        title: "Error",
        description: "No file uploaded yet",
        variant: "destructive",
      });
      return;
    }

    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter your API key",
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate presigned download URL
      const wMatrixBase = import.meta.env.VITE_GO_SERVICE_BASE?.replace(/:\d+$/, ':8081') || 'http://localhost:8081';
      const response = await fetch(
        `${wMatrixBase}/api/v1/listings/${uploadedFileKey}/download`,
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate download URL");
      }

      const data = await response.json();
      setDownloadUrl(data.download_url);

      toast({
        title: "Download URL Generated",
        description: "Presigned URL valid for 60 minutes",
      });
    } catch (error) {
      console.error("Download URL error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate download URL",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Navbar />
      <div className="container max-w-4xl py-8 mt-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">S3 Storage Tester</h1>
          <p className="text-muted-foreground">
            Test file upload and download functionality with W-Matrix Marketplace S3 integration
          </p>
        </div>

        <div className="grid gap-6">
          {/* API Key Input */}
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Enter your API key to test S3 operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Get your API key from the{" "}
                  <a href="/api-keys" className="text-primary hover:underline">
                    API Keys page
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                File Upload
              </CardTitle>
              <CardDescription>
                Upload a file to test S3 storage integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Select File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!file || uploading || !apiKey}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload to S3
                  </>
                )}
              </Button>

              {uploadedFileUrl && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Upload Successful!</p>
                      <p className="text-sm">
                        <strong>File Key:</strong> {uploadedFileKey}
                      </p>
                      <p className="text-sm break-all">
                        <strong>URL:</strong>{" "}
                        <a
                          href={uploadedFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {uploadedFileUrl}
                        </a>
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* File Download */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                File Download
              </CardTitle>
              <CardDescription>
                Generate a presigned URL to download the uploaded file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleGenerateDownloadUrl}
                disabled={!uploadedFileKey || !apiKey}
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Generate Download URL
              </Button>

              {downloadUrl && (
                <Alert>
                  <FileCheck className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">Download URL Generated</p>
                      <p className="text-sm break-all">
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {downloadUrl}
                        </a>
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(downloadUrl, "_blank")}
                      >
                        Open in New Tab
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Testing Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>
                  Create an API key from the{" "}
                  <a href="/api-keys" className="text-primary hover:underline">
                    API Keys page
                  </a>
                </li>
                <li>Enter your API key in the configuration section above</li>
                <li>Select a file to upload (any file type supported)</li>
                <li>Click "Upload to S3" to test file upload functionality</li>
                <li>After successful upload, click "Generate Download URL" to test download</li>
                <li>Verify the file can be accessed via the generated presigned URL</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
