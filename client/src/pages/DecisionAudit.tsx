/**
 * Decision Audit — Timeline view of all AI agent decisions
 *
 * Features:
 * - Decision timeline with filters (agent, department, verified/unverified)
 * - Outcome verification buttons
 * - Replay navigation
 * - Agent accuracy stats
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSearch } from "wouter";
import Navbar from "@/components/Navbar";
import {
  Brain,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  BarChart3,
  Filter,
  PlayCircle,
  Shield,
} from "lucide-react";

export default function DecisionAudit() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orgId = parseInt(params.get("orgId") || "0");

  const [agentFilter, setAgentFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<string>("all");
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);

  // Decisions list
  const { data: decisionsData, isLoading } = trpc.decision.list.useQuery(
    {
      orgId,
      agentId: agentFilter || undefined,
      verified: verifiedFilter === "verified" ? true : verifiedFilter === "unverified" ? false : undefined,
      limit: 50,
    },
    { enabled: !!orgId }
  );

  // Verification mutation
  const verifyMutation = trpc.decision.verifyOutcome.useMutation();
  const utils = trpc.useUtils();

  const handleVerify = async (decisionId: string, correct: boolean) => {
    await verifyMutation.mutateAsync({
      decisionId,
      outcomeCorrect: correct,
      outcomeNotes: correct ? "Verified correct" : "Verified incorrect",
    });
    utils.decision.list.invalidate();
  };

  // Replay data
  const { data: replayData } = trpc.decision.replay.useQuery(
    { decisionId: selectedDecisionId! },
    { enabled: !!selectedDecisionId }
  );

  if (!orgId) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white/40 text-sm">No organization selected. Add ?orgId=X to the URL.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto pt-24 px-6 pb-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Brain className="w-7 h-7 text-cyan-400" />
              Decision Audit Trail
            </h1>
            <p className="text-sm text-white/30 mt-1">
              Every AI decision is traceable and every agent is accountable
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{decisionsData?.total || 0}</div>
            <div className="text-xs text-white/30">total decisions</div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card p-4 flex items-center gap-4 flex-wrap">
          <Filter className="w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Filter by agent ID..."
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/40"
          />
          <select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
            className="bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/40"
          >
            <option value="all">All decisions</option>
            <option value="verified">Verified only</option>
            <option value="unverified">Unverified only</option>
          </select>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Decision List */}
          <div className="lg:col-span-2 space-y-3">
            {isLoading && (
              <div className="text-center text-white/30 py-12">Loading decisions...</div>
            )}

            {decisionsData?.decisions.map((d: any) => (
              <div
                key={d.id}
                className={`glass-card p-4 transition-all cursor-pointer hover:bg-white/[0.04] ${
                  selectedDecisionId === d.id ? "border-cyan-500/30 bg-cyan-500/[0.04]" : ""
                }`}
                onClick={() => setSelectedDecisionId(d.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-white/30">{d.agentId}</span>
                    {d.decisionType && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40">
                        {d.decisionType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {d.outcomeVerified ? (
                      d.outcomeCorrect ? (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="w-3.5 h-3.5" /> Correct
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <XCircle className="w-3.5 h-3.5" /> Incorrect
                        </span>
                      )
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-yellow-400/60">
                        <Clock className="w-3.5 h-3.5" /> Unverified
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-sm text-white/70 mb-2 line-clamp-1">
                  <span className="text-white/30">Q:</span> {d.inputQuery}
                </div>
                <div className="text-sm text-white/50 line-clamp-1">
                  <span className="text-white/30">A:</span> {d.output}
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-white/20">
                  <span>Confidence: {(Number(d.confidence) * 100).toFixed(0)}%</span>
                  <span>Memories: {d.retrievedMemoryIds?.length || 0}</span>
                  {d.latencyMs && <span>{d.latencyMs}ms</span>}
                  <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Verify buttons (only for unverified) */}
                {!d.outcomeVerified && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleVerify(d.id, true); }}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-green-500/10 text-green-400 text-xs hover:bg-green-500/20 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" /> Mark Correct
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleVerify(d.id, false); }}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                    >
                      <XCircle className="w-3 h-3" /> Mark Incorrect
                    </button>
                  </div>
                )}
              </div>
            ))}

            {decisionsData?.decisions.length === 0 && !isLoading && (
              <div className="text-center text-white/20 py-12">
                No decisions recorded yet
              </div>
            )}
          </div>

          {/* Replay Panel */}
          <div className="space-y-4">
            {selectedDecisionId && replayData ? (
              <>
                <div className="glass-card p-5">
                  <h3 className="text-sm text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-cyan-400" />
                    Decision Replay
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-white/30">Agent</div>
                      <div className="text-sm font-mono">{replayData.decision.agentId}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/30">Confidence</div>
                      <div className="text-sm">{(replayData.decision.confidence * 100).toFixed(0)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/30">Model</div>
                      <div className="text-sm">{replayData.decision.modelUsed || "N/A"}</div>
                    </div>
                  </div>
                </div>

                {/* Context Drift */}
                <div className="glass-card p-5">
                  <h3 className="text-sm text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-400" />
                    Context Drift
                  </h3>

                  <div className="text-3xl font-bold text-white mb-1">
                    {(replayData.analysis.contextDriftScore * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-white/30 mb-3">memory context change</div>

                  <div className="space-y-2 text-xs text-white/40">
                    <div className="flex justify-between">
                      <span>Still available</span>
                      <span className="text-green-400">{replayData.analysis.memoriesStillAvailable}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Removed</span>
                      <span className="text-red-400">{replayData.analysis.memoriesRemoved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg score change</span>
                      <span className={replayData.analysis.avgScoreChange >= 0 ? "text-green-400" : "text-red-400"}>
                        {replayData.analysis.avgScoreChange > 0 ? "+" : ""}
                        {replayData.analysis.avgScoreChange.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Historical Memories */}
                <div className="glass-card p-5">
                  <h3 className="text-sm text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-400" />
                    Memories at Decision Time ({replayData.historicalMemories.length})
                  </h3>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {replayData.historicalMemories.map((m: any) => (
                      <div key={m.id} className="p-2 rounded-lg bg-white/[0.03] text-xs">
                        <div className="text-white/60 line-clamp-2">{m.content}</div>
                        <div className="flex items-center gap-2 mt-1 text-white/20">
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.06]">{m.poolType}</span>
                          <span>Score: {m.finalScoreAtDecision.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="glass-card p-8 text-center text-white/20 text-sm">
                <Shield className="w-8 h-8 mx-auto mb-3 opacity-20" />
                Select a decision to view replay details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
