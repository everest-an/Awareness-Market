/**
 * Decision Replay Viewer — Shows memories available at decision time with historical scores
 *
 * Visualizes context drift between historical and current memory state.
 * Uses frosted glass iOS aesthetic consistent with the rest of the app.
 */

import { trpc } from "@/lib/trpc";
import {
  PlayCircle,
  Clock,
  Brain,
  Eye,
  TrendingUp,
  TrendingDown,
  Database,
  BarChart3,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

interface DecisionReplayViewerProps {
  decisionId: string;
  orgId: number;
}

export default function DecisionReplayViewer({ decisionId, orgId }: DecisionReplayViewerProps) {
  const { data: replayData, isLoading } = trpc.decision.replay.useQuery(
    { decisionId },
    { enabled: !!decisionId }
  );

  if (isLoading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <PlayCircle className="w-8 h-8 text-cyan-400/40" />
          <span className="text-sm text-white/30">Loading replay data...</span>
        </div>
      </div>
    );
  }

  if (!replayData) {
    return (
      <div className="glass-card p-8 text-center text-white/20 text-sm">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-20" />
        Replay data not available for this decision
      </div>
    );
  }

  const { decision, analysis, historicalMemories } = replayData;
  const driftScore = analysis.contextDriftScore * 100;
  const driftColor =
    driftScore > 50 ? "text-red-400" : driftScore > 20 ? "text-yellow-400" : "text-green-400";

  return (
    <div className="space-y-5">
      {/* Decision Summary */}
      <div className="glass-card p-5">
        <h3 className="text-xs text-white/30 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Brain className="w-4 h-4 text-cyan-400" />
          Decision Summary
        </h3>

        <div className="space-y-3">
          <div>
            <div className="text-xs text-white/30">Input Query</div>
            <div className="text-sm text-white/80 mt-1 line-clamp-3">{decision.inputQuery}</div>
          </div>
          <div>
            <div className="text-xs text-white/30">Output</div>
            <div className="text-sm text-white/60 mt-1 line-clamp-3">{decision.output}</div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/[0.06]">
            <div>
              <div className="text-xs text-white/30">Agent</div>
              <div className="text-sm font-mono text-white/70">{decision.agentId}</div>
            </div>
            <div>
              <div className="text-xs text-white/30">Confidence</div>
              <div className="text-sm text-white/70">{(Number(decision.confidence) * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-xs text-white/30">Model</div>
              <div className="text-sm text-white/70">{decision.modelUsed || "N/A"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Context Drift Analysis */}
      <div className="glass-card p-5">
        <h3 className="text-xs text-white/30 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          Context Drift Analysis
        </h3>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className={`text-4xl font-bold ${driftColor}`}>
              {driftScore.toFixed(0)}%
            </div>
            <div className="text-xs text-white/30 mt-1">context change</div>
          </div>

          <div className="flex-1 space-y-2">
            {/* Drift progress bar */}
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  driftScore > 50 ? "bg-red-500/60" : driftScore > 20 ? "bg-yellow-500/60" : "bg-green-500/60"
                }`}
                style={{ width: `${Math.max(2, driftScore)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500/60" />
                <span className="text-white/40">Available: </span>
                <span className="text-green-400 font-medium">{analysis.memoriesStillAvailable}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500/60" />
                <span className="text-white/40">Removed: </span>
                <span className="text-red-400 font-medium">{analysis.memoriesRemoved}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {analysis.avgScoreChange >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                )}
                <span className="text-white/40">Score: </span>
                <span className={analysis.avgScoreChange >= 0 ? "text-green-400" : "text-red-400"}>
                  {analysis.avgScoreChange > 0 ? "+" : ""}
                  {analysis.avgScoreChange.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Memories at Decision Time */}
      <div className="glass-card p-5">
        <h3 className="text-xs text-white/30 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Eye className="w-4 h-4 text-blue-400" />
          Memories at Decision Time ({historicalMemories.length})
        </h3>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {historicalMemories.map((m: any, idx: number) => {
            const scoreChange = m.currentScore != null
              ? m.currentScore - m.finalScoreAtDecision
              : null;

            return (
              <div
                key={m.id || idx}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-sm"
              >
                <div className="text-sm text-white/60 line-clamp-2 mb-2">{m.content}</div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-white/40">
                    {m.poolType}
                  </span>
                  <span className="text-white/30">
                    Score: <span className="text-white/60">{m.finalScoreAtDecision.toFixed(1)}</span>
                  </span>
                  {scoreChange != null && (
                    <span className="flex items-center gap-0.5">
                      <ArrowRight className="w-3 h-3 text-white/20" />
                      <span className={scoreChange >= 0 ? "text-green-400" : "text-red-400"}>
                        {scoreChange > 0 ? "+" : ""}{scoreChange.toFixed(1)}
                      </span>
                    </span>
                  )}
                  {m.stillAvailable === false && (
                    <span className="text-red-400/60 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> removed
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {historicalMemories.length === 0 && (
            <div className="text-center py-6 text-white/20 text-sm">
              <Database className="w-6 h-6 mx-auto mb-2 opacity-30" />
              No memory context recorded for this decision
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
