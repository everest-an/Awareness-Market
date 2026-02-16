/**
 * Agent Reputation Card — Multi-dimensional reputation radar display
 *
 * Shows 4 dimensions:
 * - Write Quality (memory validation rate)
 * - Decision Accuracy (outcome verification rate)
 * - Collaboration Score (cross-agent success)
 * - Domain Expertise (promotion rate)
 *
 * Uses SVG radar chart instead of Recharts for zero-dependency rendering.
 */

import { trpc } from "@/lib/trpc";
import {
  PenTool,
  Brain,
  Users,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Star,
} from "lucide-react";

interface AgentReputationCardProps {
  orgId: number;
  agentId: string;
}

const DIMENSIONS = [
  { key: "writeQuality", label: "Write Quality", icon: PenTool, color: "text-blue-400" },
  { key: "decisionAccuracy", label: "Decision Accuracy", icon: Brain, color: "text-cyan-400" },
  { key: "collaborationScore", label: "Collaboration", icon: Users, color: "text-green-400" },
  { key: "domainExpertise", label: "Domain Expertise", icon: BookOpen, color: "text-purple-400" },
] as const;

/**
 * Simple SVG radar chart for reputation dimensions
 */
function RadarChart({ values }: { values: number[] }) {
  const size = 180;
  const center = size / 2;
  const maxRadius = 70;
  const levels = 4;
  const n = values.length;

  // Calculate points for each axis
  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const radius = (value / 100) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  };

  // Grid circles
  const gridCircles = Array.from({ length: levels }, (_, i) => {
    const r = (maxRadius * (i + 1)) / levels;
    return <circle key={i} cx={center} cy={center} r={r} fill="none" stroke="white" strokeOpacity={0.06} />;
  });

  // Axis lines
  const axisLines = Array.from({ length: n }, (_, i) => {
    const point = getPoint(i, 100);
    return <line key={i} x1={center} y1={center} x2={point.x} y2={point.y} stroke="white" strokeOpacity={0.08} />;
  });

  // Data polygon
  const points = values.map((v, i) => getPoint(i, v));
  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size} height={size} className="mx-auto">
      {gridCircles}
      {axisLines}
      <polygon
        points={polygonPoints}
        fill="rgb(6, 182, 212)"
        fillOpacity={0.15}
        stroke="rgb(6, 182, 212)"
        strokeOpacity={0.6}
        strokeWidth={1.5}
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="rgb(6, 182, 212)" fillOpacity={0.8} />
      ))}
    </svg>
  );
}

export default function AgentReputationCard({ orgId, agentId }: AgentReputationCardProps) {
  const { data: profile, isLoading } = trpc.decision.getReputation.useQuery(
    { orgId, agentId },
    { enabled: !!orgId && !!agentId, retry: false }
  );

  const rep = profile?.overall;

  // Use defaults if query fails
  const dims = rep
    ? {
        writeQuality: Number(rep.writeQuality),
        decisionAccuracy: Number(rep.decisionAccuracy),
        collaborationScore: Number(rep.collaborationScore),
        domainExpertise: Number(rep.domainExpertise),
      }
    : { writeQuality: 50, decisionAccuracy: 50, collaborationScore: 50, domainExpertise: 50 };

  const overall = rep ? Number(rep.overallReputation) : 50;

  const getReputationTier = (score: number) => {
    if (score >= 80) return { label: "Elite", color: "text-purple-400", bg: "bg-purple-500/10" };
    if (score >= 60) return { label: "Trusted", color: "text-cyan-400", bg: "bg-cyan-500/10" };
    if (score >= 40) return { label: "Standard", color: "text-white/50", bg: "bg-white/[0.06]" };
    return { label: "Novice", color: "text-orange-400", bg: "bg-orange-500/10" };
  };

  const tier = getReputationTier(overall);

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm text-white font-medium flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" />
            Agent Reputation
          </h3>
          <p className="text-xs text-white/30 font-mono mt-0.5">{agentId}</p>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${tier.bg} ${tier.color}`}>
          {tier.label}
        </div>
      </div>

      {/* Overall Score */}
      <div className="text-center">
        <div className="text-4xl font-bold text-white">{overall.toFixed(0)}</div>
        <div className="text-xs text-white/30">overall reputation</div>
      </div>

      {/* Radar Chart */}
      <RadarChart
        values={[dims.writeQuality, dims.decisionAccuracy, dims.collaborationScore, dims.domainExpertise]}
      />

      {/* Dimension Bars */}
      <div className="space-y-3">
        {DIMENSIONS.map((dim) => {
          const value = dims[dim.key];
          const Icon = dim.icon;
          return (
            <div key={dim.key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-xs text-white/50">
                  <Icon className={`w-3.5 h-3.5 ${dim.color}`} />
                  {dim.label}
                </div>
                <span className="text-xs text-white/70 font-medium">{value.toFixed(0)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-cyan-500/60 transition-all duration-500"
                  style={{ width: `${Math.max(2, value)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity Stats */}
      {rep && (
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06]">
          <div className="text-center">
            <div className="text-sm font-bold text-white">{rep.totalWrites}</div>
            <div className="text-[10px] text-white/20">writes</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-white">{rep.totalDecisions}</div>
            <div className="text-[10px] text-white/20">decisions</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-white">{rep.totalCollaborations}</div>
            <div className="text-[10px] text-white/20">collabs</div>
          </div>
        </div>
      )}
    </div>
  );
}
