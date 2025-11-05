import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, Search, Plus, Calendar, Tag } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Documents() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: documents, isLoading } = trpc.documents.list.useQuery();

  const filteredDocuments = documents?.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.extractedText?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Documents</h1>
            <p className="text-gray-600">
              Browse and search your knowledge base
            </p>
          </div>
          <Button onClick={() => setLocation("/upload")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Documents List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredDocuments && filteredDocuments.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc) => (
              <Card
                key={doc.id}
                className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-blue-200"
                onClick={() => setLocation(`/documents/${doc.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-lg line-clamp-2">{doc.title}</CardTitle>
                  <CardDescription className="line-clamp-3">
                    {doc.summary || "No summary available"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                    {doc.metadata && (
                      <div className="flex items-start gap-2">
                        <Tag className="h-4 w-4 text-gray-500 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            try {
                              const metadata = typeof doc.metadata === 'string' 
                                ? JSON.parse(doc.metadata) 
                                : doc.metadata;
                              const topics = metadata?.main_topics || [];
                              return topics.slice(0, 3).map((topic: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {topic}
                                </Badge>
                              ));
                            } catch {
                              return null;
                            }
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {searchQuery ? "No documents found" : "No documents yet"}
              </h3>
              <p className="text-gray-600 mb-6 text-center max-w-md">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Start by uploading an image or taking a photo to create your first document"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setLocation("/upload")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Document
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
