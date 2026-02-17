import { useState } from "react";
import Navbar from "@/components/Navbar";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Database,
  GitBranch,
  Eye,
  Info,
  Sparkles,
  Zap,
  Scale,
  Network,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface ConflictMemory {
  id: string;
  content: string;
  confidence: number;
  createdBy: string;
  createdAt: Date;
  claimKey?: string;
  claimValue?: string;
}

interface Conflict {
  id: string;
  conflictType: "claim_mismatch" | "semantic_contradiction";
  status: "pending" | "resolved" | "ignored";
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  memory1: ConflictMemory;
  memory2: ConflictMemory;
}

export default function ConflictResolution() {
  const [selectedTab, setSelectedTab] = useState<"pending" | "resolved" | "ignored">("pending");
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [showIgnoreDialog, setShowIgnoreDialog] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Auto-resolve mutation (low severity)
  const autoResolveMutation = trpc.memory.autoResolveConflict.useMutation({
    onSuccess: () => {
      toast.success("Conflict auto-resolved (higher-scoring memory wins)");
      utils.memory.listConflicts.invalidate();
      utils.memory.getConflictStats.invalidate();
    },
    onError: (error: any) => toast.error(`Auto-resolve failed: ${error.message}`),
  });

  // Request arbitration mutation (high/critical severity)
  const requestArbitrationMutation = trpc.memory.requestArbitration.useMutation({
    onSuccess: () => {
      toast.success("Arbitration requested — LLM analysis queued");
      utils.memory.listConflicts.invalidate();
    },
    onError: (error: any) => toast.error(`Arbitration failed: ${error.message}`),
  });

  // Fetch conflicts
  const { data: conflicts, isLoading } = trpc.memory.listConflicts.useQuery({
    status: selectedTab,
  });

  // Fetch stats
  const { data: stats } = trpc.memory.getConflictStats.useQuery();

  // Mutations
  const resolveConflict = trpc.memory.resolveConflict.useMutation({
    onSuccess: () => {
      toast.success("Conflict resolved successfully!");
      utils.memory.listConflicts.invalidate();
      utils.memory.getConflictStats.invalidate();
      setShowResolveDialog(false);
      setSelectedConflict(null);
    },
    onError: (error) => {
      toast.error(`Failed to resolve conflict: ${error.message}`);
    },
  });

  const ignoreConflict = trpc.memory.ignoreConflict.useMutation({
    onSuccess: () => {
      toast.success("Conflict ignored successfully!");
      utils.memory.listConflicts.invalidate();
      utils.memory.getConflictStats.invalidate();
      setShowIgnoreDialog(false);
      setSelectedConflict(null);
    },
    onError: (error) => {
      toast.error(`Failed to ignore conflict: ${error.message}`);
    },
  });

  const handleResolve = () => {
    if (!selectedConflict || !selectedWinner) return;

    resolveConflict.mutate({
      conflict_id: selectedConflict.id,
      resolution_memory_id: selectedWinner,
    });
  };

  const handleIgnore = () => {
    if (!selectedConflict) return;

    ignoreConflict.mutate({
      conflict_id: selectedConflict.id,
    });
  };

  const getConflictTypeColor = (type: string) => {
    switch (type) {
      case "claim_mismatch":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "semantic_contradiction":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "ignored":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium</Badge>;
      case "low":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Low</Badge>;
      default:
        return <Badge variant="outline" className="text-white/30">Unclassified</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      <div className="pt-20 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Conflict Resolution
          </h1>
          <p className="text-muted-foreground">
            Manage and resolve memory conflicts detected by the system
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  <div className="text-2xl font-bold">{stats.pending}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Resolved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div className="text-2xl font-bold">{stats.resolved}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ignored
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-gray-500" />
                  <div className="text-2xl font-bold">{stats.ignored}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-purple-500" />
                  <div className="text-2xl font-bold">{stats.total}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Conflicts List */}
        <Card>
          <CardHeader>
            <CardTitle>Conflicts</CardTitle>
            <CardDescription>
              View and manage conflicts detected in your memory system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pending">
                  Pending {stats && `(${stats.pending})`}
                </TabsTrigger>
                <TabsTrigger value="resolved">
                  Resolved {stats && `(${stats.resolved})`}
                </TabsTrigger>
                <TabsTrigger value="ignored">
                  Ignored {stats && `(${stats.ignored})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value={selectedTab} className="space-y-4 mt-6">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading conflicts...
                  </div>
                ) : !conflicts || conflicts.conflicts.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No {selectedTab} conflicts found
                    </p>
                  </div>
                ) : (
                  conflicts.conflicts.map((conflict: any) => (
                    <Card key={conflict.id} className="border-l-4 border-l-yellow-500">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              <CardTitle className="text-lg">Conflict Detected</CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getConflictTypeColor(conflict.conflict_type)}>
                                {conflict.conflict_type.replace(/_/g, " ")}
                              </Badge>
                              {getSeverityBadge(conflict.severity)}
                              <Badge className={getStatusColor(conflict.status)}>
                                {conflict.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(conflict.detected_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {conflict.status === "pending" && (
                            <div className="flex gap-2 flex-wrap">
                              {/* Auto-Resolve for low severity */}
                              {(conflict.severity === "low" || conflict.severity === "medium") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                                  onClick={() => autoResolveMutation.mutate({ conflict_id: conflict.id })}
                                  disabled={autoResolveMutation.isPending}
                                >
                                  <Zap className="h-4 w-4 mr-1" />
                                  Auto-Resolve
                                </Button>
                              )}
                              {/* Request Arbitration for high/critical */}
                              {(conflict.severity === "high" || conflict.severity === "critical") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                                  onClick={() => requestArbitrationMutation.mutate({ conflict_id: conflict.id })}
                                  disabled={requestArbitrationMutation.isPending}
                                >
                                  <Scale className="h-4 w-4 mr-1" />
                                  Request Arbitration
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedConflict(conflict);
                                  setShowIgnoreDialog(true);
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Ignore
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedConflict(conflict);
                                  setShowResolveDialog(true);
                                }}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Resolve
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Conflict Claim Keys */}
                        {conflict.memory1.claimKey && (
                          <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-sm font-medium mb-2">Conflicting Claim:</p>
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">{conflict.memory1.claimKey}</Badge>
                              <span className="text-red-600 font-mono">
                                {conflict.memory1.claimValue}
                              </span>
                              <span className="text-muted-foreground">vs</span>
                              <span className="text-blue-600 font-mono">
                                {conflict.memory2.claimValue}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Memory Comparison */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Memory 1 */}
                          <div className="rounded-lg border p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary">Memory 1</Badge>
                              <div className="text-xs text-muted-foreground">
                                Confidence: {(conflict.memory1.confidence * 100).toFixed(0)}%
                              </div>
                            </div>
                            <p className="text-sm line-clamp-3">{conflict.memory1.content}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>by {conflict.memory1.id.slice(0, 8)}</span>
                              <span>•</span>
                              <span>{new Date(conflict.memory1.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {/* Memory 2 */}
                          <div className="rounded-lg border p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary">Memory 2</Badge>
                              <div className="text-xs text-muted-foreground">
                                Confidence: {(conflict.memory2.confidence * 100).toFixed(0)}%
                              </div>
                            </div>
                            <p className="text-sm line-clamp-3">{conflict.memory2.content}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>by {conflict.memory2.id.slice(0, 8)}</span>
                              <span>•</span>
                              <span>{new Date(conflict.memory2.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Resolution Info */}
                        {conflict.status === "resolved" && conflict.resolved_by && (
                          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3">
                            <p className="text-sm text-green-800 dark:text-green-200">
                              ✓ Resolved by {conflict.resolved_by} on{" "}
                              {conflict.resolved_at && new Date(conflict.resolved_at).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Resolve Dialog */}
      {selectedConflict && (
        <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Resolve Conflict</DialogTitle>
              <DialogDescription>
                Choose which memory to keep. The other will be marked as superseded.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Memory 1 Option */}
              <div
                className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  selectedWinner === selectedConflict.memory1.id
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                    : "border-border hover:border-purple-300"
                }`}
                onClick={() => setSelectedWinner(selectedConflict.memory1.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={selectedWinner === selectedConflict.memory1.id}
                    onChange={() => setSelectedWinner(selectedConflict.memory1.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge>Memory 1</Badge>
                      <Badge variant="outline">
                        {(selectedConflict.memory1.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm">{selectedConflict.memory1.content}</p>
                    <div className="text-xs text-muted-foreground">
                      Created by {selectedConflict.memory1.createdBy} •{" "}
                      {new Date(selectedConflict.memory1.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Memory 2 Option */}
              <div
                className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  selectedWinner === selectedConflict.memory2.id
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                    : "border-border hover:border-purple-300"
                }`}
                onClick={() => setSelectedWinner(selectedConflict.memory2.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={selectedWinner === selectedConflict.memory2.id}
                    onChange={() => setSelectedWinner(selectedConflict.memory2.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge>Memory 2</Badge>
                      <Badge variant="outline">
                        {(selectedConflict.memory2.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm">{selectedConflict.memory2.content}</p>
                    <div className="text-xs text-muted-foreground">
                      Created by {selectedConflict.memory2.createdBy} •{" "}
                      {new Date(selectedConflict.memory2.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResolveDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleResolve}
                disabled={!selectedWinner || resolveConflict.isPending}
              >
                {resolveConflict.isPending ? "Resolving..." : "Resolve Conflict"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Ignore Dialog */}
      {selectedConflict && (
        <AlertDialog open={showIgnoreDialog} onOpenChange={setShowIgnoreDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ignore Conflict?</AlertDialogTitle>
              <AlertDialogDescription>
                This conflict will be marked as ignored and hidden from the pending list.
                You can view ignored conflicts in the "Ignored" tab.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleIgnore}
                disabled={ignoreConflict.isPending}
              >
                {ignoreConflict.isPending ? "Ignoring..." : "Ignore Conflict"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
