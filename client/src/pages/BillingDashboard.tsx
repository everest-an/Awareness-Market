/**
 * Billing Dashboard — Plan tier visualization and usage tracking
 *
 * Features:
 * - Current plan info + usage vs limits
 * - Usage bars for agents, memories, departments, API calls
 * - Limit warnings (80%/90% thresholds)
 * - Upgrade options with tier comparison
 */

import { trpc } from "@/lib/trpc";
import { useSearch } from "wouter";
import Navbar from "@/components/Navbar";
import {
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  Zap,
  Users,
  Database,
  Building2,
  Brain,
  CheckCircle,
  Shield,
} from "lucide-react";

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  lite: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  team: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
  enterprise: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  scientific: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
};

const USAGE_ICONS: Record<string, any> = {
  agents: Users,
  memories: Database,
  departments: Building2,
  decisions: Brain,
};

function UsageBar({ label, current, limit, icon: Icon }: {
  label: string;
  current: number;
  limit: number;
  icon: any;
}) {
  const percentage = limit > 0 ? (current / limit) * 100 : 0;
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 90;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Icon className="w-4 h-4" />
          {label}
        </div>
        <div className="text-sm">
          <span className={`font-bold ${isCritical ? "text-red-400" : isWarning ? "text-yellow-400" : "text-white"}`}>
            {current.toLocaleString()}
          </span>
          <span className="text-white/20"> / {limit === -1 ? "Unlimited" : limit.toLocaleString()}</span>
        </div>
      </div>
      {limit !== -1 && (
        <div className="h-2 rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isCritical ? "bg-red-500/70" : isWarning ? "bg-yellow-500/60" : "bg-cyan-500/60"
            }`}
            style={{ width: `${Math.min(100, Math.max(1, percentage))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function BillingDashboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orgId = parseInt(params.get("orgId") || "0");

  const { data: billing } = trpc.orgAnalytics.billingOverview.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  const { data: warnings } = trpc.orgAnalytics.limitWarnings.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  const { data: upgradeOptions } = trpc.orgAnalytics.upgradeOptions.useQuery(
    { currentTier: billing?.plan?.tier || "lite" },
    { enabled: !!billing }
  );

  if (!orgId) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white/40 text-sm">No organization selected. Add ?orgId=X to the URL.</div>
      </div>
    );
  }

  const tierStyle = TIER_COLORS[billing?.plan?.tier || "lite"] || TIER_COLORS.lite;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto pt-24 px-6 pb-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-cyan-400" />
            Billing & Usage
          </h1>
          <p className="text-sm text-white/30 mt-1">
            Plan management and resource usage tracking
          </p>
        </div>

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((msg: string, i: number) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
              >
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-yellow-300">{msg}</span>
              </div>
            ))}
          </div>
        )}

        {/* Current Plan */}
        {billing && (
          <div className={`glass-card p-6 border ${tierStyle.border}`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold capitalize ${tierStyle.bg} ${tierStyle.text}`}>
                    {billing.plan.tier}
                  </span>
                  <span className="text-white/20 text-sm">Plan</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">
                  ${billing.plan.price}
                </div>
                <div className="text-xs text-white/30">/month</div>
              </div>
            </div>

            {/* Usage Bars */}
            <div className="space-y-4">
              <UsageBar
                label="Agents"
                current={billing.usage.agents.current}
                limit={billing.usage.agents.limit}
                icon={Users}
              />
              <UsageBar
                label="Memories"
                current={billing.usage.memories.current}
                limit={billing.usage.memories.limit}
                icon={Database}
              />
              <UsageBar
                label="Departments"
                current={billing.usage.departments.current}
                limit={billing.usage.departments.limit}
                icon={Building2}
              />
              <UsageBar
                label="Decisions"
                current={billing.usage.decisions.current}
                limit={-1}
                icon={Brain}
              />
            </div>
          </div>
        )}

        {/* Upgrade Options */}
        {upgradeOptions && upgradeOptions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Upgrade Options
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upgradeOptions.map((option: any) => {
                const optStyle = TIER_COLORS[option.tier] || TIER_COLORS.lite;
                return (
                  <div
                    key={option.tier}
                    className={`glass-card p-5 border ${optStyle.border} space-y-4`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold capitalize ${optStyle.bg} ${optStyle.text}`}>
                        {option.tier}
                      </span>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">${option.price}</div>
                        <div className="text-[10px] text-white/20">/month</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-white/50">
                        <Users className="w-3.5 h-3.5" />
                        <span>Up to {option.maxAgents >= 999999 ? "Unlimited" : option.maxAgents} agents</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/50">
                        <Database className="w-3.5 h-3.5" />
                        <span>{option.maxMemories >= 9999999 ? "Unlimited" : option.maxMemories.toLocaleString()} memories</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/50">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{option.maxDepartments >= 999 ? "Unlimited" : option.maxDepartments} departments</span>
                      </div>
                    </div>

                    {option.features && (
                      <div className="space-y-1 pt-2 border-t border-white/[0.06]">
                        {option.features.map((f: string) => (
                          <div key={f} className="flex items-center gap-2 text-xs text-white/40">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            {f}
                          </div>
                        ))}
                      </div>
                    )}

                    <button className={`w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${optStyle.bg} ${optStyle.text} hover:opacity-80 transition-opacity`}>
                      <ArrowUpRight className="w-4 h-4" />
                      Upgrade to {option.tier}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Features by Tier */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            Plan Comparison
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/30 border-b border-white/[0.06]">
                  <th className="text-left py-2 pr-4">Feature</th>
                  <th className="text-center py-2 px-3">Lite</th>
                  <th className="text-center py-2 px-3">Team</th>
                  <th className="text-center py-2 px-3">Enterprise</th>
                  <th className="text-center py-2 px-3">Scientific</th>
                </tr>
              </thead>
              <tbody className="text-white/50">
                {[
                  { feature: "AI Agents", lite: "8", team: "32", enterprise: "128", scientific: "Unlimited" },
                  { feature: "Memories", lite: "10K", team: "100K", enterprise: "1M", scientific: "Unlimited" },
                  { feature: "Departments", lite: "1", team: "10", enterprise: "50", scientific: "Unlimited" },
                  { feature: "Memory Pools", lite: "-", team: "Yes", enterprise: "Yes", scientific: "Yes" },
                  { feature: "Decision Audit", lite: "-", team: "-", enterprise: "Yes", scientific: "Yes" },
                  { feature: "Agent Reputation", lite: "-", team: "-", enterprise: "Yes", scientific: "Yes" },
                  { feature: "Cross-Domain Verification", lite: "-", team: "-", enterprise: "-", scientific: "Yes" },
                  { feature: "Evidence Tracking", lite: "-", team: "-", enterprise: "-", scientific: "Yes" },
                  { feature: "Dependency Graphs", lite: "-", team: "-", enterprise: "-", scientific: "Yes" },
                  { feature: "CSV/PDF Export", lite: "-", team: "CSV", enterprise: "CSV+PDF", scientific: "CSV+PDF" },
                ].map((row) => (
                  <tr key={row.feature} className="border-b border-white/[0.03]">
                    <td className="py-2 pr-4 text-white/60">{row.feature}</td>
                    <td className="text-center py-2 px-3">{row.lite}</td>
                    <td className="text-center py-2 px-3">{row.team}</td>
                    <td className="text-center py-2 px-3">{row.enterprise}</td>
                    <td className="text-center py-2 px-3">{row.scientific}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
