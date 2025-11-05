import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileIcon, CheckCircle, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";

interface UploadedFile {
  id: number;
  name: string;
  cid: string;
  url: string;
  size: number;
  timestamp: Date;
}

export default function IPFSUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const utils = trpc.useUtils();

  // Check if user can use IPFS
  const { data: ipfsAccess, isLoading: checkingAccess } = trpc.ipfs.canUse.useQuery();
  const { data: ipfsHealth } = trpc.ipfs.health.useQuery();

  // Upload file mutation
  const uploadFileMutation = trpc.files.upload.useMutation({
    onSuccess: async (data) => {
      // After uploading to S3, upload to IPFS
      if (data.fileId && selectedFile) {
        await uploadToIPFS(data.fileId, selectedFile);
      }
    },
    onError: (error) => {
      toast.error(`Failed to upload file: ${error.message}`);
      setUploading(false);
    },
  });

  // IPFS upload mutation
  const ipfsUploadMutation = trpc.ipfs.upload.useMutation({
    onSuccess: (data) => {
      toast.success("File uploaded to IPFS successfully!");
      setUploadedFiles((prev) => [
        {
          id: Date.now(),
          name: selectedFile?.name || "Unknown",
          cid: data.cid,
          url: data.url,
          size: data.size,
          timestamp: new Date(),
        },
        ...prev,
      ]);
      setUploading(false);
      setUploadProgress(0);
      setSelectedFile(null);
    },
    onError: (error) => {
      toast.error(`Failed to upload to IPFS: ${error.message}`);
      setUploading(false);
    },
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: uploading || !ipfsAccess?.canUseIPFS,
  });

  const uploadToIPFS = async (fileId: number, file: File) => {
    try {
      setUploadProgress(50);

      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(",")[1]; // Remove data:image/png;base64, prefix

        setUploadProgress(75);

        // Upload to IPFS
        await ipfsUploadMutation.mutateAsync({
          fileId,
          fileName: file.name,
          fileBuffer: base64Data,
        });

        setUploadProgress(100);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    if (!ipfsAccess?.canUseIPFS) {
      toast.error("IPFS storage is only available for paid subscribers");
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(",")[1];

        setUploadProgress(25);

        // First upload to S3
        await uploadFileMutation.mutateAsync({
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
          fileBuffer: base64Data,
          useIPFS: true,
        });
      };

      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error("Upload error:", error);
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">IPFS Upload</h1>
          <p className="text-muted-foreground mt-1">
            Upload files to decentralized storage (IPFS)
          </p>
        </div>

        {/* Service Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Service Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">IPFS Service</span>
              <Badge variant={ipfsHealth?.healthy ? "default" : "destructive"}>
                {ipfsHealth?.healthy ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Online
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Offline
                  </>
                )}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Your Access</span>
              <Badge variant={ipfsAccess?.canUseIPFS ? "default" : "secondary"}>
                {ipfsAccess?.canUseIPFS ? "Enabled" : "Upgrade Required"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Upload Area */}
        {!ipfsAccess?.canUseIPFS ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">IPFS Storage Unavailable</h3>
              <p className="text-muted-foreground text-center mb-4">
                IPFS storage is only available for paid subscribers.
                <br />
                Upgrade your plan to unlock decentralized storage.
              </p>
              <Button>Upgrade Plan</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Upload File</CardTitle>
                <CardDescription>
                  Select a file to upload to IPFS network
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Dropzone */}
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  {selectedFile ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium mb-1">
                        Drop your file here, or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Any file type supported
                      </p>
                    </div>
                  )}
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                {/* Upload Button */}
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="w-full"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload to IPFS
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Uploaded Files */}
            {uploadedFiles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Uploaded Files</CardTitle>
                  <CardDescription>
                    Files successfully uploaded to IPFS
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)} •{" "}
                              {file.timestamp.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              CID: {file.cid}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="shrink-0"
                        >
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
