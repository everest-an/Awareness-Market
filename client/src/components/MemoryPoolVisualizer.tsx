/**
 * Memory Pool Visualizer — 3-tier pool diagram with memory flow
 *
 * Displays:
 * - Private → Domain → Global pool hierarchy
 * - Memory counts per pool
 * - Promotion arrows and thresholds
 * - Pool-specific actions (promote, filter)
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Lock,
  Users,
  Globe,
  ArrowRight,
  Brain,
  Zap,
  Shield,
  ChevronUp,
  BarChart3,
} from "lucide-react";

interface MemoryPoolVisualizerProps {
  orgId: number;
}

const POOL_CONFIG = {
  private: {
    label: "Private Pool",
    desc: "Agent-local memories, not shared",
    icon: Lock,
    color: "blue",
    bgColor: "bg-blue-500/[0.08]",
    borderColor: "border-blue-500/20",
    textColor: "text-blue-400",
  },
  domain: {
    label: "Domain Pool",
    desc: "Department-shared memories",
    icon: Users,
    color: "cyan",
    bgColor: "bg-cyan-500/[0.08]",
    borderColor: "border-cyan-500/20",
    textColor: "text-cyan-400",
  },
  global: {
    label: "Global Pool",
    desc: "Organization-wide promoted memories",
    icon: Globe,
    color: "purple",
    bgColor: "bg-purple-500/[0.08]",
    borderColor: "border-purple-500/20",
    textColor: "text-purple-400",
  },
};

export default function MemoryPoolVisualizer({ orgId }: MemoryPoolVisualizerProps) {
  const [selectedPool, setSelectedPool] = useState<string | null>(null);

  // Pool stats query
  const { data: poolStats, isLoading } = trpc.memory.getPoolStats.useQuery(
    { orgId },
    { enabled: !!orgId, retry: false }
  );

  // Use defaults if query fails (feature might not be enabled yet)
  const stats = poolStats || { private: 0, domain: 0, global: 0, total: 0 };
  const total = stats.total || 1; // Avoid division by zero

  const pools = [
    { type: "private" as const, count: stats.private },
    { type: "domain" as const, count: stats.domain },
    { type: "global" as const, count: stats.global },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg text-white font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Memory Pools
          </h3>
          <p className="text-xs text-white/30 mt-1">
            3-layer architecture: Private → Domain → Global
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</div>
          <div className="text-xs text-white/30">total memories</div>
        </div>
      </div>

      {/* Pool Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {pools.map((pool, idx) => {
          const config = POOL_CONFIG[pool.type];
          const Icon = config.icon;
          const percentage = total > 0 ? Math.round((pool.count / total) * 100) : 0;

          return (
            <div key={pool.type} className="relative">
              {/* Arrow between pools */}
              {idx < 2 && (
                <div className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                  <div className="flex flex-col items-center">
                    <ChevronUp className="w-4 h-4 text-white/20 rotate-90" />
                    <span className="text-[10px] text-white/20 mt-0.5">promote</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedPool(selectedPool === pool.type ? null : pool.type)}
                className={`w-full glass-card p-5 text-left transition-all hover:bg-white/[0.04] ${
                  selectedPool === pool.type ? `${config.bgColor} ${config.borderColor}` : ""
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2.5 rounded-xl ${config.bgColor}`}>
                    <Icon className={`w-5 h-5 ${config.textColor}`} />
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">{config.label}</div>
                    <div className="text-xs text-white/30">{config.desc}</div>
                  </div>
                </div>

                {/* Count */}
                <div className="text-3xl font-bold text-white mb-2">
                  {pool.count.toLocaleString()}
                </div>

                {/* Bar */}
                <div className="h-1.5 rounded-full bg-white/[0.06] mb-1">
                  <div
                    className={`h-full rounded-full bg-${config.color}-500/60 transition-all duration-500`}
                    style={{ width: `${Math.max(2, percentage)}%` }}
                  />
                </div>
                <div className="text-xs text-white/20">{percentage}% of total</div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Pool Detail Panel */}
      {selectedPool && (
        <div className={`glass-card p-6 ${POOL_CONFIG[selectedPool as keyof typeof POOL_CONFIG].bgColor} ${POOL_CONFIG[selectedPool as keyof typeof POOL_CONFIG].borderColor}`}>
          <h4 className="text-sm text-white/50 uppercase tracking-wider mb-3">
            {POOL_CONFIG[selectedPool as keyof typeof POOL_CONFIG].label} Details
          </h4>

          {selectedPool === "private" && (
            <div className="space-y-2 text-sm text-white/60">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-400" />
                Agent-scoped: only visible to the creating agent
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                No cross-agent conflicts possible
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-blue-400" />
                Can be promoted to Domain pool by admin
              </div>
            </div>
          )}

          {selectedPool === "domain" && (
            <div className="space-y-2 text-sm text-white/60">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Department-shared: visible to all agents in the department
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Auto-promotes to Global when validation threshold met
              </div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                Conflict detection active between domain memories
              </div>
            </div>
          )}

          {selectedPool === "global" && (
            <div className="space-y-2 text-sm text-white/60">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" />
                Organization-wide: accessible by all agents across departments
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                Highest quality — promoted from domain after validation
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                Cross-domain conflict arbitration enabled
              </div>
            </div>
          )}
        </div>
      )}

      {/* Flow Diagram (simplified) */}
      <div className="glass-card p-5">
        <h4 className="text-xs text-white/30 uppercase tracking-wider mb-4">Memory Flow</h4>
        <div className="flex items-center justify-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Agent writes
          </div>
          <ArrowRight className="w-4 h-4 text-white/20" />
          <div className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Domain pool
          </div>
          <ArrowRight className="w-4 h-4 text-white/20" />
          <div className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/40 border border-white/[0.08]">
            Validation (5x)
          </div>
          <ArrowRight className="w-4 h-4 text-white/20" />
          <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Global pool
          </div>
        </div>
      </div>
    </div>
  );
}
