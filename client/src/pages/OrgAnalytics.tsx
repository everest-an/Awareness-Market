/**
 * Organization Analytics — Executive dashboard for AI org governance
 *
 * Features:
 * - Overview stats (agents, memories, decisions, departments)
 * - Memory health: quality tier distribution + pool distribution
 * - Agent leaderboard by reputation
 * - Department productivity
 * - Decision accuracy trend
 * - Memory creation activity
 * - CSV export buttons
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSearch } from "wouter";
import {
  BarChart3,
  Users,
  Brain,
  Database,
  TrendingUp,
  Award,
  Building2,
  Download,
  Activity,
  Shield,
  Layers,
  Target,
} from "lucide-react";

const QUALITY_COLORS: Record<string, string> = {
  platinum: "bg-purple-500/20 text-purple-300",
  gold: "bg-yellow-500/20 text-yellow-300",
  silver: "bg-white/10 text-white/60",
  bronze: "bg-orange-500/20 text-orange-300",
};

const POOL_COLORS: Record<string, string> = {
  private: "bg-blue-500/20 text-blue-300",
  domain: "bg-cyan-500/20 text-cyan-300",
  global: "bg-green-500/20 text-green-300",
};

export default function OrgAnalytics() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orgId = parseInt(params.get("orgId") || "0");

  const [trendDays, setTrendDays] = useState(30);
  const [activityDays, setActivityDays] = useState(30);

  // Queries
  const { data: overview } = trpc.orgAnalytics.overview.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  const { data: memoryHealth } = trpc.orgAnalytics.memoryHealth.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  const { data: leaderboard } = trpc.orgAnalytics.agentLeaderboard.useQuery(
    { orgId, limit: 10 },
    { enabled: !!orgId }
  );

  const { data: deptStats } = trpc.orgAnalytics.departmentStats.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  const { data: decisionTrend } = trpc.orgAnalytics.decisionTrend.useQuery(
    { orgId, days: trendDays },
    { enabled: !!orgId }
  );

  const { data: memoryActivity } = trpc.orgAnalytics.memoryActivity.useQuery(
    { orgId, days: activityDays },
    { enabled: !!orgId }
  );

  // Export mutations
  const exportDecisions = trpc.orgAnalytics.exportDecisions.useMutation();
  const exportReputation = trpc.orgAnalytics.exportReputation.useMutation();
  const exportMemoryHealth = trpc.orgAnalytics.exportMemoryHealth.useMutation();

  const downloadCsv = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (type: "decisions" | "reputation" | "memoryHealth") => {
    if (type === "decisions") {
      const result = await exportDecisions.mutateAsync({ orgId });
      downloadCsv(result.csv, result.filename);
    } else if (type === "reputation") {
      const result = await exportReputation.mutateAsync({ orgId });
      downloadCsv(result.csv, result.filename);
    } else {
      const result = await exportMemoryHealth.mutateAsync({ orgId });
      downloadCsv(result.csv, result.filename);
    }
  };

  if (!orgId) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white/40 text-sm">No organization selected. Add ?orgId=X to the URL.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-cyan-400" />
              Organization Analytics
            </h1>
            <p className="text-sm text-white/30 mt-1">
              Executive overview of your AI organization
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("decisions")}
              disabled={exportDecisions.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/50 text-xs hover:bg-white/[0.1] hover:text-white/70 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Decisions CSV
            </button>
            <button
              onClick={() => handleExport("reputation")}
              disabled={exportReputation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/50 text-xs hover:bg-white/[0.1] hover:text-white/70 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Reputation CSV
            </button>
            <button
              onClick={() => handleExport("memoryHealth")}
              disabled={exportMemoryHealth.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/50 text-xs hover:bg-white/[0.1] hover:text-white/70 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Memory CSV
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Agents", value: overview.agentCount, icon: Users, color: "text-blue-400" },
              { label: "Memories", value: overview.memoryCount, icon: Database, color: "text-cyan-400" },
              { label: "Decisions", value: overview.decisionCount, icon: Brain, color: "text-purple-400" },
              { label: "Departments", value: overview.departmentCount, icon: Building2, color: "text-green-400" },
              { label: "Verified", value: overview.verificationCount, icon: Shield, color: "text-emerald-400" },
              { label: "Conflicts", value: overview.conflictCount, icon: Target, color: "text-orange-400" },
              { label: "Evidence", value: overview.evidenceCount, icon: Layers, color: "text-indigo-400" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-xs text-white/30">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Memory Health */}
          {memoryHealth && (
            <div className="glass-card p-5 space-y-4">
              <h2 className="text-sm font-medium text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" />
                Memory Health
              </h2>

              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {Number(memoryHealth.avgScore).toFixed(1)}
                </div>
                <div className="text-xs text-white/30">avg score</div>
              </div>

              {/* Quality Tier Distribution */}
              <div>
                <div className="text-xs text-white/40 mb-2">Quality Tiers</div>
                <div className="space-y-2">
                  {Object.entries(memoryHealth.tierDistribution).map(([tier, count]: [string, any]) => {
                    const total = Object.values(memoryHealth.tierDistribution).reduce(
                      (s: number, c: any) => s + Number(c), 0
                    );
                    const pct = total > 0 ? (Number(count) / total) * 100 : 0;
                    return (
                      <div key={tier} className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${QUALITY_COLORS[tier] || "bg-white/[0.06] text-white/40"}`}>
                          {tier}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-cyan-500/60"
                            style={{ width: `${Math.max(1, pct)}%` }}
                          />
                        </div>
                        <span className="text-xs text-white/40 w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pool Distribution */}
              <div>
                <div className="text-xs text-white/40 mb-2">Pool Distribution</div>
                <div className="flex gap-2">
                  {Object.entries(memoryHealth.poolDistribution).map(([pool, count]: [string, any]) => (
                    <div
                      key={pool}
                      className={`flex-1 rounded-lg p-3 text-center ${POOL_COLORS[pool] || "bg-white/[0.06] text-white/40"}`}
                    >
                      <div className="text-lg font-bold">{count}</div>
                      <div className="text-[10px] capitalize">{pool}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Agent Leaderboard */}
          <div className="glass-card p-5 space-y-4">
            <h2 className="text-sm font-medium text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-400" />
              Agent Leaderboard
            </h2>

            <div className="space-y-2">
              {leaderboard?.map((agent: any, i: number) => (
                <div
                  key={agent.agentId}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <span className={`w-6 text-center text-xs font-bold ${
                    i === 0 ? "text-yellow-400" : i === 1 ? "text-white/50" : i === 2 ? "text-orange-400" : "text-white/20"
                  }`}>
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80 font-mono truncate">{agent.agentId}</div>
                    {agent.department && (
                      <div className="text-[10px] text-white/20">{agent.department.name}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-cyan-400">
                      {Number(agent.overallReputation).toFixed(0)}
                    </div>
                    <div className="text-[10px] text-white/20">reputation</div>
                  </div>
                </div>
              ))}

              {(!leaderboard || leaderboard.length === 0) && (
                <div className="text-center text-white/20 py-8 text-sm">
                  No agent reputation data yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Department Stats */}
        {deptStats && deptStats.length > 0 && (
          <div className="glass-card p-5 space-y-4">
            <h2 className="text-sm font-medium text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-green-400" />
              Department Productivity
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {deptStats.map((dept: any) => (
                <div key={dept.id} className="rounded-lg bg-white/[0.03] p-4 space-y-2">
                  <div className="text-sm font-medium text-white">{dept.name}</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-cyan-400">{dept.memoryCount}</div>
                      <div className="text-[10px] text-white/20">memories</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-400">{dept.agentCount}</div>
                      <div className="text-[10px] text-white/20">agents</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-400">{dept.decisionCount}</div>
                      <div className="text-[10px] text-white/20">decisions</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Decision Accuracy Trend */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                Decision Accuracy Trend
              </h2>
              <select
                value={trendDays}
                onChange={(e) => setTrendDays(Number(e.target.value))}
                className="bg-white/[0.06] text-white/60 text-xs rounded-lg px-2 py-1 border-0"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>

            <div className="space-y-1">
              {decisionTrend?.map((day: any) => {
                const accuracy = day.total > 0 ? (day.correct / day.total) * 100 : 0;
                return (
                  <div key={day.date} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/20 w-16">{day.date.split("-").slice(1).join("/")}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          accuracy >= 80 ? "bg-green-500/60" : accuracy >= 50 ? "bg-yellow-500/60" : "bg-red-500/60"
                        }`}
                        style={{ width: `${Math.max(1, accuracy)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-white/40 w-12 text-right">
                      {accuracy.toFixed(0)}% ({day.total})
                    </span>
                  </div>
                );
              })}

              {(!decisionTrend || decisionTrend.length === 0) && (
                <div className="text-center text-white/20 py-8 text-sm">
                  No decision data for this period
                </div>
              )}
            </div>
          </div>

          {/* Memory Activity */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                Memory Creation Activity
              </h2>
              <select
                value={activityDays}
                onChange={(e) => setActivityDays(Number(e.target.value))}
                className="bg-white/[0.06] text-white/60 text-xs rounded-lg px-2 py-1 border-0"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>

            <div className="space-y-1">
              {memoryActivity?.map((day: any) => {
                const maxCount = Math.max(...(memoryActivity || []).map((d: any) => d.count), 1);
                const barWidth = (day.count / maxCount) * 100;
                return (
                  <div key={day.date} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/20 w-16">{day.date.split("-").slice(1).join("/")}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-cyan-500/60 transition-all"
                        style={{ width: `${Math.max(1, barWidth)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-white/40 w-8 text-right">{day.count}</span>
                  </div>
                );
              })}

              {(!memoryActivity || memoryActivity.length === 0) && (
                <div className="text-center text-white/20 py-8 text-sm">
                  No memory creation data for this period
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
