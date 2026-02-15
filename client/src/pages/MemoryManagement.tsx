import { useState } from "react";
import Navbar from "@/components/Navbar";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Database,
  Search,
  AlertTriangle,
  GitBranch,
  TrendingUp,
  Eye,
  History
} from "lucide-react";
import { MemoryScoreBreakdown } from "@/components/MemoryScoreBreakdown";
import { VersionHistoryViewer } from "@/components/VersionHistoryViewer";
import { Link } from "wouter";

interface Memory {
  id: string;
  content: string;
  namespace: string;
  contentType: string;
  confidence: number;
  usageCount: number;
  createdAt: Date;
  createdBy: string;
  score?: {
    totalScore: number;
    baseScore: number;
    timeDecay: number;
    usageBoost: number;
  };
}

export default function MemoryManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [showVersionDialog, setShowVersionDialog] = useState(false);

  // Fetch memories (using search query if provided)
  const { data: memories, isLoading } = trpc.memory.search.useQuery(
    {
      query: searchQuery || "",
      limit: 20,
    },
    {
      enabled: !!searchQuery,
    }
  );

  // Fetch conflict stats
  const { data: conflictStats } = trpc.memory.getConflictStats.useQuery();

  const handleViewScore = (memory: Memory) => {
    setSelectedMemory(memory);
    setShowScoreDialog(true);
  };

  const handleViewVersions = (memory: Memory) => {
    setSelectedMemory(memory);
    setShowVersionDialog(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Memory Management
          </h1>
          <p className="text-muted-foreground">
            Explore, analyze, and manage your organization's memory system
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Database className="h-4 w-4" />
                Total Memories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {memories?.length || 0}
              </div>
            </CardContent>
          </Card>

          <Link href="/conflicts">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Pending Conflicts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-yellow-600">
                    {conflictStats?.pending || 0}
                  </div>
                  {conflictStats && conflictStats.pending > 0 && (
                    <Badge variant="destructive">Action Required</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Version Branches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {/* This would need a separate query */}
                -
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Results */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search Memories</CardTitle>
            <CardDescription>
              Search across all memories to view scores and versions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search memories by content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setSearchQuery("")} variant="outline">
                Clear
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Searching memories...
              </div>
            ) : !memories || memories.length === 0 ? (
              <div className="text-center py-12">
                <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No memories found matching your search" : "Enter a search query to find memories"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {memories.map((memory) => (
                  <Card key={memory.id} className="hover:bg-muted/50 transition-colors">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{memory.contentType}</Badge>
                            <Badge variant="secondary">{memory.namespace}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(memory.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <p className="text-sm mb-2 line-clamp-2">{memory.content}</p>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Confidence: {(memory.confidence * 100).toFixed(0)}%
                            </span>
                            <span>Used {memory.usageCount} times</span>
                            <span>by {memory.createdBy}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewScore(memory)}
                          >
                            <TrendingUp className="h-4 w-4 mr-1" />
                            Score
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewVersions(memory)}
                          >
                            <History className="h-4 w-4 mr-1" />
                            Versions
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/conflicts">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Conflict Resolution
                </CardTitle>
                <CardDescription>
                  Manage and resolve memory conflicts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View {conflictStats?.pending || 0} pending conflicts that need your attention
                </p>
              </CardContent>
            </Card>
          </Link>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full opacity-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-purple-500" />
                Version Analytics
              </CardTitle>
              <CardDescription>
                Analyze version history patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Coming soon: Advanced version analytics and insights
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Score Breakdown Dialog */}
      {selectedMemory && selectedMemory.score && (
        <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Memory Score Details</DialogTitle>
              <DialogDescription>
                Detailed breakdown of scoring components
              </DialogDescription>
            </DialogHeader>

            <MemoryScoreBreakdown
              score={{
                totalScore: selectedMemory.score.totalScore,
                baseScore: selectedMemory.score.baseScore,
                timeDecay: selectedMemory.score.timeDecay,
                usageBoost: selectedMemory.score.usageBoost,
                confidence: selectedMemory.confidence,
                usageCount: selectedMemory.usageCount,
                createdAt: selectedMemory.createdAt,
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Version History Dialog */}
      {selectedMemory && (
        <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Version History</DialogTitle>
              <DialogDescription>
                View and manage version history for this memory
              </DialogDescription>
            </DialogHeader>

            <VersionHistoryViewer memoryId={selectedMemory.id} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
