import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GitBranch,
  Clock,
  User,
  TrendingUp,
  RotateCcw,
  Eye,
  ChevronRight,
  ChevronDown,
  GitCommit,
  GitMerge
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

interface VersionNode {
  id: string;
  content: string;
  confidence: number;
  createdBy: string;
  createdAt: Date;
  version: number;
  isLatest: boolean;
  children?: VersionNode[];
}

interface VersionDiff {
  field: string;
  old_value: any;
  new_value: any;
}

interface VersionHistoryViewerProps {
  memoryId: string;
  className?: string;
}

export function VersionHistoryViewer({ memoryId, className }: VersionHistoryViewerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [compareVersion, setCompareVersion] = useState<string | null>(null);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Fetch version tree
  const { data: versionTree, isLoading: treeLoading } = trpc.memory.getVersionTree.useQuery({
    memory_id: memoryId,
  });

  // Fetch version history (linear)
  const { data: versionHistory, isLoading: historyLoading } = trpc.memory.getVersionHistory.useQuery({
    memory_id: memoryId,
  });

  // Fetch version comparison
  const { data: versionDiff, isLoading: diffLoading } = trpc.memory.compareVersions.useQuery(
    {
      version_id_1: compareVersion || "",
      version_id_2: selectedVersion || "",
    },
    {
      enabled: !!compareVersion && !!selectedVersion,
    }
  );

  // Rollback mutation
  const rollbackMutation = trpc.memory.rollbackVersion.useMutation({
    onSuccess: () => {
      toast.success("Version rolled back successfully!");
      utils.memory.getVersionTree.invalidate();
      utils.memory.getVersionHistory.invalidate();
      setShowRollbackDialog(false);
      setRollbackTarget(null);
    },
    onError: (error) => {
      toast.error(`Rollback failed: ${error.message}`);
    },
  });

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleRollback = () => {
    if (!rollbackTarget) return;

    rollbackMutation.mutate({
      target_version_id: rollbackTarget,
      created_by: "current-user", // TODO: Get from auth context
      reason: "Manual rollback via UI",
    });
  };

  const renderVersionNode = (node: VersionNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedVersion === node.id;

    return (
      <div key={node.id} className="space-y-1">
        <div
          className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? "bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500"
              : "hover:bg-muted"
          }`}
          style={{ marginLeft: `${depth * 20}px` }}
          onClick={() => setSelectedVersion(node.id)}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="mt-1"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}

          {!hasChildren && <GitCommit className="h-4 w-4 mt-1 text-muted-foreground" />}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={node.isLatest ? "default" : "secondary"} className="text-xs">
                v{node.version}
              </Badge>
              {node.isLatest && (
                <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20">
                  Latest
                </Badge>
              )}
              <span className="text-xs text-muted-foreground truncate">
                {node.id.substring(0, 8)}
              </span>
            </div>

            <p className="text-sm line-clamp-2 mb-1">{node.content}</p>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {node.createdBy}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(node.createdAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {(node.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {!node.isLatest && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setRollbackTarget(node.id);
                setShowRollbackDialog(true);
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderVersionNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderDiff = (diff: VersionDiff) => {
    return (
      <div key={diff.field} className="rounded-lg border p-3 space-y-2">
        <div className="font-medium text-sm capitalize">{diff.field.replace(/_/g, " ")}</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Old Value</div>
            <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 font-mono text-xs">
              {String(diff.old_value)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">New Value</div>
            <div className="p-2 rounded bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 font-mono text-xs">
              {String(diff.new_value)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Version History Summary */}
      {versionHistory && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-purple-500" />
                  Version History
                </CardTitle>
                <CardDescription>
                  {versionHistory.versions.length} versions • Depth: {versionHistory.depth}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCompareDialog(true)}
                  disabled={!selectedVersion}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Compare Versions
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Linear History Timeline */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Linear Timeline</h3>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-4">
                  {versionHistory.versions.map((version, idx) => (
                    <div
                      key={version.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedVersion === version.id
                          ? "bg-purple-50 dark:bg-purple-900/20 border-purple-500"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => setSelectedVersion(version.id)}
                    >
                      <div className="flex flex-col items-center">
                        <div className={`h-3 w-3 rounded-full ${
                          idx === 0 ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                        }`} />
                        {idx < versionHistory.versions.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-300 dark:bg-gray-600 mt-1" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">v{version.version}</Badge>
                          {idx === 0 && <Badge className="bg-green-500">Latest</Badge>}
                        </div>
                        <p className="text-sm line-clamp-1">{version.content}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{version.createdBy}</span>
                          <span>•</span>
                          <span>{new Date(version.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version Tree Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-blue-500" />
            Version Tree Structure
          </CardTitle>
          <CardDescription>
            Explore the full branching history of this memory
          </CardDescription>
        </CardHeader>

        <CardContent>
          {treeLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading version tree...
            </div>
          ) : !versionTree ? (
            <div className="text-center py-8 text-muted-foreground">
              No version history available
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="pr-4">
                {renderVersionNode(versionTree)}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Version Comparison Dialog */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Compare Versions</DialogTitle>
            <DialogDescription>
              Select a version to compare with the currently selected version
            </DialogDescription>
          </DialogHeader>

          {versionHistory && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Compare with:</label>
                <ScrollArea className="h-[200px] rounded-lg border p-2">
                  {versionHistory.versions
                    .filter((v) => v.id !== selectedVersion)
                    .map((version) => (
                      <div
                        key={version.id}
                        className={`p-2 rounded cursor-pointer mb-1 ${
                          compareVersion === version.id
                            ? "bg-purple-100 dark:bg-purple-900/30"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => setCompareVersion(version.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">v{version.version}</Badge>
                          <span className="text-sm truncate flex-1">{version.content}</span>
                        </div>
                      </div>
                    ))}
                </ScrollArea>
              </div>

              {versionDiff && versionDiff.length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  <h3 className="font-medium">Changes Detected:</h3>
                  {versionDiff.map(renderDiff)}
                </div>
              )}

              {versionDiff && versionDiff.length === 0 && compareVersion && (
                <div className="text-center py-4 text-muted-foreground">
                  No differences found between these versions
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCompareDialog(false);
              setCompareVersion(null);
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <AlertDialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback to Previous Version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new version based on the selected version's content.
              The current version will be preserved in the history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={rollbackMutation.isPending}
            >
              {rollbackMutation.isPending ? "Rolling back..." : "Rollback"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
