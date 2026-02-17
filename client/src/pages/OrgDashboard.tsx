/**
 * Organization Dashboard — Overview of org, departments, agents, memory stats
 *
 * Reuses existing glass-card UI pattern.
 * Uses tRPC organization router for data.
 */

import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import DepartmentManager from "@/components/DepartmentManager";
import {
  Building2,
  Bot,
  Brain,
  Users,
  ChevronRight,
  Plus,
  Settings,
  BarChart3,
  Shield,
  Layers,
  Zap,
} from "lucide-react";

const PLAN_COLORS: Record<string, string> = {
  lite: "cyan",
  team: "blue",
  enterprise: "purple",
  scientific: "emerald",
};

export default function OrgDashboard() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orgId = Number(params.get("id"));
  const [activeTab, setActiveTab] = useState<"overview" | "departments" | "agents" | "members">("overview");

  const { data: org, isLoading } = trpc.organization.get.useQuery(
    { orgId },
    { enabled: !!orgId }
  );

  const { data: members } = trpc.organization.listMembers.useQuery(
    { orgId },
    { enabled: !!orgId && activeTab === "members" }
  );

  const { data: agents } = trpc.organization.listAgents.useQuery(
    { orgId },
    { enabled: !!orgId && activeTab === "agents" }
  );

  if (!orgId) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <p className="text-white/50">No organization selected</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <Brain className="w-8 h-8 text-cyan-400 animate-pulse mx-auto mb-4" />
          <p className="text-white/50">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <p className="text-white/50">Organization not found</p>
        </div>
      </div>
    );
  }

  const planColor = PLAN_COLORS[org.planTier] || "cyan";
  const agentUsage = org.currentAgentCount / org.maxAgents;
  const memoryUsage = org.currentMemoryCount / org.maxMemories;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "departments" as const, label: "Departments", icon: Building2 },
    { id: "agents" as const, label: "Agents", icon: Bot },
    { id: "members" as const, label: "Members", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 pt-24 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{org.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium bg-${planColor}-500/10 text-${planColor}-400 border border-${planColor}-500/20 uppercase`}>
                {org.planTier}
              </span>
            </div>
            <p className="text-white/40 text-sm">{org.description || `/${org.slug}`}</p>
          </div>
          <button className="p-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-8 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                  activeTab === tab.id
                    ? "bg-white/[0.1] text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Departments",
                  value: org.departments.length,
                  max: org.maxDepartments,
                  icon: Building2,
                  color: "blue",
                },
                {
                  label: "Agents",
                  value: org.currentAgentCount,
                  max: org.maxAgents,
                  icon: Bot,
                  color: "cyan",
                },
                {
                  label: "Memories",
                  value: org.currentMemoryCount,
                  max: org.maxMemories,
                  icon: Brain,
                  color: "purple",
                },
                {
                  label: "Members",
                  value: org._count.memberships,
                  max: null,
                  icon: Users,
                  color: "emerald",
                },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`w-4 h-4 text-${stat.color}-400`} />
                      <span className="text-xs text-white/40 uppercase tracking-wider">
                        {stat.label}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stat.value.toLocaleString()}
                    </div>
                    {stat.max && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-white/30 mb-1">
                          <span>Usage</span>
                          <span>
                            {Math.round((stat.value / stat.max) * 100)}%
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.06]">
                          <div
                            className={`h-full rounded-full bg-${stat.color}-500/60`}
                            style={{
                              width: `${Math.min(100, (stat.value / stat.max) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* v3 Navigation */}
            <div className="glass-card p-6">
              <h3 className="text-sm text-white/50 uppercase tracking-wider mb-4">
                Governance & Analytics
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Decision Audit", desc: "Review AI decision trail", icon: Brain, href: `/org/decisions?orgId=${orgId}`, color: "purple" },
                  { label: "Verification", desc: "Cross-domain peer review", icon: Shield, href: `/org/verification?orgId=${orgId}`, color: "emerald" },
                  { label: "Analytics", desc: "Executive dashboard", icon: BarChart3, href: `/org/analytics?orgId=${orgId}`, color: "cyan" },
                  { label: "Billing", desc: "Plan & usage", icon: Zap, href: `/org/billing?orgId=${orgId}`, color: "yellow" },
                ].map((nav) => {
                  const Icon = nav.icon;
                  return (
                    <a
                      key={nav.label}
                      href={nav.href}
                      className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12] transition-all text-left"
                    >
                      <div className={`p-2 rounded-lg bg-${nav.color}-500/10`}>
                        <Icon className={`w-4 h-4 text-${nav.color}-400`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium">{nav.label}</div>
                        <div className="text-xs text-white/30">{nav.desc}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20" />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card p-6">
              <h3 className="text-sm text-white/50 uppercase tracking-wider mb-4">
                Quick Actions
              </h3>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  {
                    label: "Add Department",
                    desc: "Create a new team or division",
                    icon: Building2,
                    action: () => setActiveTab("departments"),
                  },
                  {
                    label: "Assign Agent",
                    desc: "Connect an AI agent to your org",
                    icon: Bot,
                    action: () => setActiveTab("agents"),
                  },
                  {
                    label: "Invite Member",
                    desc: "Add team members to your org",
                    icon: Users,
                    action: () => setActiveTab("members"),
                  },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={action.action}
                      className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12] transition-all text-left"
                    >
                      <div className="p-2 rounded-lg bg-cyan-500/10">
                        <Icon className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-sm text-white font-medium">{action.label}</div>
                        <div className="text-xs text-white/30">{action.desc}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 ml-auto" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Departments Preview */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm text-white/50 uppercase tracking-wider">
                  Departments
                </h3>
                <button
                  onClick={() => setActiveTab("departments")}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {org.departments.slice(0, 5).map((dept: any) => (
                  <div
                    key={dept.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-blue-500/10">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                      <span className="text-sm text-white">{dept.name}</span>
                    </div>
                    <span className="text-xs text-white/30">{dept.slug}</span>
                  </div>
                ))}
                {org.departments.length === 0 && (
                  <p className="text-center text-white/30 text-sm py-4">
                    No departments yet
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Departments Tab */}
        {activeTab === "departments" && (
          <DepartmentManager orgId={orgId} maxDepartments={org.maxDepartments} />
        )}

        {/* Agents Tab */}
        {activeTab === "agents" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg text-white font-semibold">
                Agents ({org.currentAgentCount}/{org.maxAgents})
              </h2>
            </div>

            {agents && agents.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {agents.map((agent: any) => (
                  <div key={agent.id} className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-cyan-500/10">
                        <Bot className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-white font-medium">
                          {agent.agentName || agent.agentId}
                        </div>
                        <div className="text-xs text-white/30">
                          {agent.agentModel || "Unknown model"}
                        </div>
                      </div>
                      <div className={`ml-auto px-2 py-0.5 rounded-full text-xs ${
                        agent.isActive
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-white/[0.06] text-white/30"
                      }`}>
                        {agent.isActive ? "Active" : "Inactive"}
                      </div>
                    </div>
                    {agent.department && (
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Building2 className="w-3 h-3" />
                        {agent.department.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-12 text-center">
                <Bot className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No agents assigned yet</p>
                <p className="text-white/20 text-xs mt-1">
                  Use the SDK or API to assign agents to this organization
                </p>
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === "members" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg text-white font-semibold">
                Members ({org._count.memberships})
              </h2>
            </div>

            {members && members.length > 0 ? (
              <div className="glass-card divide-y divide-white/[0.06]">
                {members.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-white/50 text-sm font-medium">
                        {m.user.name?.charAt(0) || m.user.email?.charAt(0) || "?"}
                      </div>
                      <div>
                        <div className="text-sm text-white">
                          {m.user.name || m.user.email || `User #${m.user.id}`}
                        </div>
                        {m.user.email && (
                          <div className="text-xs text-white/30">{m.user.email}</div>
                        )}
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${
                      m.role === "owner"
                        ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        : m.role === "admin"
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                          : "bg-white/[0.06] text-white/40 border border-white/[0.08]"
                    }`}>
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-12 text-center">
                <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">Loading members...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
