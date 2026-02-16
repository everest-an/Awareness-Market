/**
 * Dependency Graph — Interactive SVG dependency visualization
 *
 * Shows memory dependency relationships with revalidation flags highlighted.
 * Uses pure SVG for zero-dependency rendering, iOS glass aesthetic.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Network,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ArrowRight,
  Database,
} from "lucide-react";

interface DependencyGraphProps {
  memoryId: string;
}

interface DependencyNode {
  id: string;
  content: string;
  dependencyType: string;
  needsRevalidation: boolean;
  confidence: number;
  depth: number;
}

export default function DependencyGraph({ memoryId }: DependencyGraphProps) {
  const [expanded, setExpanded] = useState(true);

  const { data: graph, isLoading } = trpc.verification.getDependencyGraph.useQuery(
    { memoryId },
    { enabled: !!memoryId, retry: false }
  );

  // Flatten dependsOn array into DependencyNode format
  const deps: DependencyNode[] = graph?.dependsOn?.map((dep) => ({
    id: dep.dependsOnMemory.id,
    content: dep.dependsOnMemory.content,
    dependencyType: dep.dependencyType,
    needsRevalidation: dep.needsRevalidation,
    confidence: Number(dep.dependsOnMemory.confidence),
    depth: 1,
  })) || [];

  const getTypeColor = (type: string) => {
    switch (type) {
      case "assumes": return { border: "border-blue-500/30", bg: "bg-blue-500/[0.08]", text: "text-blue-400" };
      case "builds_on": return { border: "border-cyan-500/30", bg: "bg-cyan-500/[0.08]", text: "text-cyan-400" };
      case "requires": return { border: "border-purple-500/30", bg: "bg-purple-500/[0.08]", text: "text-purple-400" };
      default: return { border: "border-white/10", bg: "bg-white/[0.04]", text: "text-white/40" };
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6 text-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Network className="w-6 h-6 text-cyan-400/40" />
          <span className="text-xs text-white/30">Loading dependency graph...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <h3 className="text-sm text-white font-medium flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          Dependency Graph
          <span className="text-xs text-white/30">({deps.length})</span>
        </h3>
        <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-2">
          {/* Root Node */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06]">
            <Database className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-white/60 font-mono">{memoryId.slice(0, 12)}...</span>
            <span className="text-xs text-cyan-400 ml-auto">root</span>
          </div>

          {/* Dependencies */}
          {deps.length === 0 ? (
            <div className="text-center py-4 text-white/20 text-xs">
              No dependencies found for this memory
            </div>
          ) : (
            deps.map((dep, idx) => {
              const colors = getTypeColor(dep.dependencyType);
              return (
                <div key={dep.id || idx} className="flex items-start gap-2 ml-6">
                  {/* Connection Line */}
                  <div className="flex flex-col items-center mt-2">
                    <ArrowRight className="w-3 h-3 text-white/15" />
                  </div>

                  {/* Node */}
                  <div
                    className={`flex-1 rounded-xl border backdrop-blur-sm p-3 ${colors.border} ${colors.bg} ${
                      dep.needsRevalidation ? "ring-1 ring-orange-500/30" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${colors.bg} ${colors.text} border ${colors.border}`}>
                        {dep.dependencyType}
                      </span>
                      {dep.needsRevalidation && (
                        <span className="flex items-center gap-1 text-[10px] text-orange-400">
                          <AlertTriangle className="w-3 h-3" />
                          needs revalidation
                        </span>
                      )}
                      <span className="text-[10px] text-white/20 ml-auto">
                        depth: {dep.depth}
                      </span>
                    </div>
                    <div className="text-xs text-white/50 line-clamp-2">{dep.content}</div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/25">
                      <span className="font-mono">{dep.id.slice(0, 10)}...</span>
                      <span>confidence: {(dep.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Legend */}
          {deps.length > 0 && (
            <div className="flex items-center gap-4 pt-3 border-t border-white/[0.06] text-[10px] text-white/25">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500/40" /> assumes</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500/40" /> builds_on</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500/40" /> requires</span>
              <span className="flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5 text-orange-400/40" /> revalidation</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
