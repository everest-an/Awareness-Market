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
  History,
  Lock,
  Users,
  Globe,
  ArrowUp,
} from "lucide-react";
import { MemoryScoreBreakdown } from "@/components/MemoryScoreBreakdown";
import { VersionHistoryViewer } from "@/components/VersionHistoryViewer";
import { Link } from "wouter";
import { toast } from "sonner";

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
  const [activePool, setActivePool] = useState<"all" | "private" | "domain" | "global">("all");

  // Pool stats
  const { data: poolStats } = trpc.memory.getPoolStats.useQuery(
    { orgId: 0 },
    { retry: false }
  );

  // Promote mutation
  const promoteMutation = trpc.memory.promoteMemory.useMutation({
    onSuccess: () => {
      toast.success("Memory promoted to Global pool!");
    },
    onError: (err: any) => {
      toast.error(`Promotion failed: ${err.message}`);
    },
  });

  // Fetch memories (using query if provided)
  const { data: memoriesResult, isLoading } = trpc.memory.query.useQuery(
    {
      namespaces: ["default"],
      query: searchQuery || "",
      limit: 20,
      ...(activePool !== "all" && { pools: [activePool] }),
    },
    {
      enabled: !!searchQuery,
    }
  );

  // Flatten results for display
  const memories = memoriesResult?.results?.map((r: any) => ({
    id: r.memory.id,
    content: r.memory.content,
    namespace: r.memory.namespace,
    contentType: r.memory.content_type,
    confidence: Number(r.memory.confidence),
    usageCount: 0,
    createdAt: r.memory.created_at,
    createdBy: r.memory.created_by,
    score: r.score ? {
      totalScore: r.score,
      baseScore: r.score,
      timeDecay: 0,
      usageBoost: 0,
    } : undefined,
  })) as Memory[] | undefined;

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

      <div className="pt-20 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Memory Management
          </h1>
          <p className="text-muted-foreground">
            Explore, analyze, and manage your organization's memory system
          </p>
        </div>

        {/* Pool Selector Tabs */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { key: "all" as const, label: "All Pools", icon: Database, count: poolStats?.total ?? 0, color: "text-white/60", bg: "bg-white/[0.06]", activeBg: "bg-white/[0.12]" },
            { key: "private" as const, label: "Private", icon: Lock, count: poolStats?.private ?? 0, color: "text-blue-400", bg: "bg-blue-500/[0.06]", activeBg: "bg-blue-500/[0.15]" },
            { key: "domain" as const, label: "Domain", icon: Users, count: poolStats?.domain ?? 0, color: "text-cyan-400", bg: "bg-cyan-500/[0.06]", activeBg: "bg-cyan-500/[0.15]" },
            { key: "global" as const, label: "Global", icon: Globe, count: poolStats?.global ?? 0, color: "text-purple-400", bg: "bg-purple-500/[0.06]", activeBg: "bg-purple-500/[0.15]" },
          ].map((pool) => {
            const Icon = pool.icon;
            const isActive = activePool === pool.key;
            return (
              <button
                key={pool.key}
                onClick={() => setActivePool(pool.key)}
                className={`rounded-xl border backdrop-blur-md p-4 text-left transition-all ${
                  isActive
                    ? `${pool.activeBg} border-white/20 shadow-lg`
                    : `${pool.bg} border-white/[0.08] hover:border-white/15 hover:bg-white/[0.08]`
                }`}
              >
                <Icon className={`h-4 w-4 ${pool.color} mb-2`} />
                <div className="text-xl font-bold text-white">{pool.count}</div>
                <div className="text-xs text-white/40">{pool.label}</div>
              </button>
            );
          })}
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Link href="/conflicts">
            <div className="rounded-xl border border-white/[0.08] backdrop-blur-md bg-white/[0.04] p-4 cursor-pointer hover:bg-white/[0.06] transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-white/50">Pending Conflicts</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-yellow-400">{conflictStats?.pending || 0}</span>
                  {conflictStats && conflictStats.pending > 0 && (
                    <Badge variant="destructive" className="text-xs">Action Required</Badge>
                  )}
                </div>
              </div>
            </div>
          </Link>

          <div className="rounded-xl border border-white/[0.08] backdrop-blur-md bg-white/[0.04] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-white/50">Version Branches</span>
              </div>
              <span className="text-xl font-bold text-white">-</span>
            </div>
          </div>
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
                          {activePool === "domain" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                              onClick={() => promoteMutation.mutate({ memoryId: memory.id })}
                              disabled={promoteMutation.isPending}
                            >
                              <ArrowUp className="h-4 w-4 mr-1" />
                              Promote
                            </Button>
                          )}
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
