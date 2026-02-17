/**
 * Verification Dashboard — Cross-department peer review management
 *
 * Features:
 * - Pending review requests with priority
 * - Verification history
 * - Evidence attachment
 * - Dependency graph viewer
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSearch } from "wouter";
import Navbar from "@/components/Navbar";
import {
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Link2,
  GitBranch,
  Plus,
} from "lucide-react";

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  pending: { bg: "bg-yellow-500/10", text: "text-yellow-400", icon: Clock },
  assigned: { bg: "bg-blue-500/10", text: "text-blue-400", icon: ShieldCheck },
  verified: { bg: "bg-green-500/10", text: "text-green-400", icon: CheckCircle },
  rejected: { bg: "bg-red-500/10", text: "text-red-400", icon: XCircle },
  expired: { bg: "bg-white/[0.06]", text: "text-white/30", icon: Clock },
};

export default function VerificationDashboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orgId = parseInt(params.get("orgId") || "0");

  const [statusFilter, setStatusFilter] = useState("pending");
  const [activeTab, setActiveTab] = useState<"requests" | "evidence" | "dependencies">("requests");

  // Verification requests
  const { data: requestsData } = trpc.verification.listRequests.useQuery(
    { orgId, status: statusFilter || undefined, limit: 50 },
    { enabled: !!orgId }
  );

  // Evidence stats
  const { data: evidenceStats } = trpc.verification.evidenceStats.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  // Needs revalidation
  const { data: revalidation } = trpc.verification.needsRevalidation.useQuery(
    { orgId, limit: 20 },
    { enabled: !!orgId && activeTab === "dependencies" }
  );

  // Complete verification mutation
  const completeMutation = trpc.verification.complete.useMutation();
  const utils = trpc.useUtils();

  const handleVerify = async (requestId: string, verdict: 'verified' | 'rejected') => {
    await completeMutation.mutateAsync({
      requestId,
      verdict,
      confidence: 0.8,
      notes: verdict === 'verified' ? 'Verified by reviewer' : 'Rejected by reviewer',
    });
    utils.verification.listRequests.invalidate();
  };

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
              <ShieldCheck className="w-7 h-7 text-green-400" />
              Verification & Evidence
            </h1>
            <p className="text-sm text-white/30 mt-1">
              Cross-domain peer review and evidence tracking
            </p>
          </div>
          {evidenceStats && (
            <div className="flex gap-6 text-right">
              <div>
                <div className="text-xl font-bold text-white">{evidenceStats.total}</div>
                <div className="text-xs text-white/30">evidence items</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-400">{evidenceStats.peerReviewed}</div>
                <div className="text-xs text-white/30">peer reviewed</div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["requests", "evidence", "dependencies"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "bg-white/[0.04] text-white/40 hover:text-white/60"
              }`}
            >
              {tab === "requests" && <ShieldCheck className="w-4 h-4 inline mr-1.5" />}
              {tab === "evidence" && <FileText className="w-4 h-4 inline mr-1.5" />}
              {tab === "dependencies" && <GitBranch className="w-4 h-4 inline mr-1.5" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {/* Status Filter */}
            <div className="flex gap-2">
              {["pending", "assigned", "verified", "rejected", "expired"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    statusFilter === s
                      ? `${STATUS_COLORS[s].bg} ${STATUS_COLORS[s].text} border border-current/20`
                      : "bg-white/[0.04] text-white/30 hover:text-white/50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Request List */}
            <div className="space-y-3">
              {requestsData?.requests.map((req: any) => {
                const statusConfig = STATUS_COLORS[req.status] || STATUS_COLORS.pending;
                const StatusIcon = statusConfig.icon;

                return (
                  <div key={req.id} className="glass-card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${statusConfig.bg} ${statusConfig.text}`}>
                          <StatusIcon className="w-3 h-3" />
                          {req.status}
                        </span>
                        {req.priority > 0 && (
                          <span className="flex items-center gap-1 text-xs text-orange-400">
                            <AlertTriangle className="w-3 h-3" />
                            Priority {req.priority}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-white/20">
                        {new Date(req.requestedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {req.memory && (
                      <div className="text-sm text-white/60 mb-2 line-clamp-2">
                        {req.memory.content}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-white/20">
                      {req.verifierAgentId && (
                        <span>Verifier: <span className="text-white/40 font-mono">{req.verifierAgentId}</span></span>
                      )}
                      {req.memory?.poolType && (
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.06]">{req.memory.poolType}</span>
                      )}
                    </div>

                    {/* Action buttons for assigned requests */}
                    {req.status === "assigned" && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                        <button
                          onClick={() => handleVerify(req.id, "verified")}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-green-500/10 text-green-400 text-xs hover:bg-green-500/20"
                        >
                          <CheckCircle className="w-3 h-3" /> Verify
                        </button>
                        <button
                          onClick={() => handleVerify(req.id, "rejected")}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {requestsData?.requests.length === 0 && (
                <div className="text-center text-white/20 py-12">
                  No {statusFilter} verification requests
                </div>
              )}
            </div>
          </div>
        )}

        {/* Evidence Tab */}
        {activeTab === "evidence" && (
          <div className="space-y-4">
            {evidenceStats && (
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(evidenceStats.typeBreakdown).map(([type, count]: [string, any]) => (
                  <div key={type} className="glass-card p-4 text-center">
                    <div className="text-xl font-bold text-white">{count}</div>
                    <div className="text-xs text-white/30 capitalize">{type.replace('_', ' ')}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="glass-card p-8 text-center text-white/20">
              <FileText className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Evidence items are attached to individual memories</p>
              <p className="text-xs mt-1">Use the Memory Management page to add evidence to specific memories</p>
            </div>
          </div>
        )}

        {/* Dependencies Tab */}
        {activeTab === "dependencies" && (
          <div className="space-y-4">
            <h3 className="text-sm text-white/50 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              Dependencies Needing Revalidation ({revalidation?.length || 0})
            </h3>

            {revalidation?.map((dep: any) => (
              <div key={dep.id} className="glass-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400">
                    {dep.dependencyType}
                  </span>
                  <span className="text-xs text-white/20">
                    Strength: {Number(dep.strength).toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-white/30 mb-1">Source Memory</div>
                    <div className="text-white/60 line-clamp-2">{dep.sourceMemory?.content}</div>
                  </div>
                  <div>
                    <div className="text-white/30 mb-1">Depends On</div>
                    <div className="text-white/60 line-clamp-2">{dep.dependsOnMemory?.content}</div>
                  </div>
                </div>
              </div>
            ))}

            {(!revalidation || revalidation.length === 0) && (
              <div className="text-center text-white/20 py-12">
                No dependencies need revalidation
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
