import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Calendar, FileText, Tag, Edit, Trash2 } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function DocumentDetail() {
  const [, params] = useRoute("/documents/:id");
  const [, setLocation] = useLocation();
  const documentId = params?.id ? parseInt(params.id) : 0;

  const { data: document, isLoading } = trpc.documents.get.useQuery({ id: documentId });
  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success("Document deleted successfully");
      setLocation("/documents");
    },
    onError: () => {
      toast.error("Failed to delete document");
    },
  });

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this document?")) {
      deleteMutation.mutate({ id: documentId });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!document) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Document not found</h3>
            <Button onClick={() => setLocation("/documents")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Documents
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const metadata = (() => {
    try {
      return typeof document.metadata === 'string' 
        ? JSON.parse(document.metadata) 
        : document.metadata;
    } catch {
      return null;
    }
  })();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/documents")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{document.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(document.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Summary */}
        {document.summary && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg text-blue-900">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-blue-800">{document.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Tags and Metadata */}
        {metadata && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tags & Topics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {metadata.main_topics && metadata.main_topics.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-2">Main Topics</h4>
                  <div className="flex flex-wrap gap-2">
                    {metadata.main_topics.map((topic: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {metadata.key_entities && metadata.key_entities.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-2">Key Entities</h4>
                  <div className="flex flex-wrap gap-2">
                    {metadata.key_entities.map((entity: string, idx: number) => (
                      <Badge key={idx} variant="outline">
                        {entity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {metadata.document_type && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-2">Document Type</h4>
                  <Badge className="bg-purple-100 text-purple-800">
                    {metadata.document_type}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            {document.contentMd ? (
              <div className="prose prose-sm max-w-none">
                <Streamdown>{document.contentMd}</Streamdown>
              </div>
            ) : (
              <p className="text-gray-500 italic">No content available</p>
            )}
          </CardContent>
        </Card>

        {/* Extracted Text */}
        {document.extractedText && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Original Extracted Text</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                  {document.extractedText}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
