import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc";
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { AgentCard } from "@/components/AgentCard";
import { AgentDetailPanel } from "@/components/AgentDetailPanel";
import {
  BarChart3, TrendingUp, Clock, Zap, AlertTriangle, Activity, LogIn,
  Bot, Users, Plus, Play, Settings2, RefreshCw,
} from "lucide-react";
import { useLocation, useSearch } from "wouter";

/**
 * Control Center — Multi-function Agent management hub
 *
 * Tabs:
 * - Performance: workflow metrics, bottleneck analysis (original content)
 * - Agents: CrewAI-style agent card management per workspace
 * - Collaboration: quick-start collaboration sessions
 */

// ============================================================================
// Demo data for unauthenticated users
// ============================================================================

function generateDemoData() {
  const sessionTypes = ["ai_reasoning", "memory_transfer", "package_processing", "w_matrix_training", "vector_invocation"];
  const statuses = ["completed", "completed", "completed", "completed", "failed"];

  const sessions = Array.from({ length: 50 }, (_, i) => {
    const type = sessionTypes[Math.floor(Math.random() * sessionTypes.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const duration = Math.floor(Math.random() * 5000) + 500;
    return {
      sessionId: `demo-session-${i + 1}`,
      sessionType: type,
      status,
      duration,
      eventCount: Math.floor(Math.random() * 20) + 5,
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });

  const stats = {
    totalSessions: 50,
    completedSessions: sessions.filter(s => s.status === "completed").length,
    failedSessions: sessions.filter(s => s.status === "failed").length,
    avgEventCount: 12.5,
    avgDuration: 2800,
  };

  return { sessions, stats };
}

function generateDemoTypeComparison() {
  return [
    { type: 'ai_reasoning', total: 20, avgDuration: 2500, successRate: 85, p95Duration: 4000 },
    { type: 'memory_transfer', total: 15, avgDuration: 1800, successRate: 90, p95Duration: 3200 },
    { type: 'package_processing', total: 10, avgDuration: 3200, successRate: 75, p95Duration: 5000 },
    { type: 'w_matrix_training', total: 3, avgDuration: 4500, successRate: 100, p95Duration: 5500 },
    { type: 'vector_invocation', total: 2, avgDuration: 1200, successRate: 100, p95Duration: 2000 },
  ];
}

const AGENT_PRESETS: Record<string, { name: string; role: string; model: string; integration: string; tools: string[] }> = {
  "claude-code": { name: "Claude Code", role: "backend", model: "claude-opus-4-6", integration: "mcp", tools: ["code_edit", "terminal", "search", "git"] },
  "cursor": { name: "Cursor", role: "fullstack", model: "claude-sonnet-4-5-20250929", integration: "mcp", tools: ["code_edit", "terminal", "search", "file_read"] },
  "windsurf": { name: "Windsurf", role: "fullstack", model: "claude-sonnet-4-5-20250929", integration: "mcp", tools: ["code_edit", "terminal", "search"] },
  "v0": { name: "v0", role: "frontend", model: "gpt-4o", integration: "windows_mcp", tools: ["code_edit", "browser"] },
  "kiro": { name: "Kiro", role: "fullstack", model: "claude-sonnet-4-5-20250929", integration: "mcp", tools: ["code_edit", "terminal", "search"] },
  "manus": { name: "Manus", role: "generalist", model: "claude-sonnet-4-5-20250929", integration: "rest", tools: ["code_edit", "terminal", "browser", "search"] },
  "custom": { name: "Custom Agent", role: "custom", model: "custom", integration: "rest", tools: [] },
};

// ============================================================================
// Performance Tab (original content, extracted for clarity)
// ============================================================================

function PerformanceTab({
  isAuthenticated,
  timeRange,
  setTimeRange,
  setLocation,
}: {
  isAuthenticated: boolean;
  timeRange: string;
  setTimeRange: (v: "7" | "30" | "90") => void;
  setLocation: (path: string) => void;
}) {
  const demoData = useMemo(() => generateDemoData(), []);

  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  };

  const { startDate, endDate } = getDateRange();

  const { data: realMetrics, isLoading } = trpc.workflowPerformance.getPerformanceMetrics.useQuery(
    { startDate, endDate },
    { enabled: isAuthenticated },
  );

  const { data: realStats } = trpc.workflowPerformance.getStatistics.useQuery(
    { startDate, endDate },
    { enabled: isAuthenticated },
  );

  const { data: bottlenecksData } = trpc.workflowPerformance.getBottlenecks.useQuery(
    { startDate, endDate, limit: 5 },
    { enabled: isAuthenticated },
  );

  const { data: typeComparisonData } = trpc.workflowPerformance.getTypeComparison.useQuery(
    { startDate, endDate },
    { enabled: isAuthenticated },
  );

  const stats = isAuthenticated ? realStats : demoData.stats;

  const metrics = {
    avgResponseTime: isAuthenticated ? (realMetrics?.avgResponseTime || 0) : 2800,
    p95ResponseTime: isAuthenticated ? (realMetrics?.p95ResponseTime || 0) : 4500,
    p99ResponseTime: isAuthenticated ? (realMetrics?.p99ResponseTime || 0) : 5200,
    successRate: isAuthenticated ? (realMetrics?.successRate || 0) : 80,
    bottlenecks: isAuthenticated ? (bottlenecksData?.bottlenecks || []) : [],
    typeComparison: isAuthenticated ? (typeComparisonData?.comparison || []) : generateDemoTypeComparison(),
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getSessionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ai_reasoning: "AI Reasoning",
      memory_transfer: "Memory Transfer",
      package_processing: "Package Processing",
      w_matrix_training: "W-Matrix Training",
      vector_invocation: "Vector Invocation",
    };
    return labels[type] || type;
  };

  return (
    <>
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-400">Loading performance data...</p>
        </div>
      )}

      {!isLoading && stats && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Avg Response Time
                </CardDescription>
                <CardTitle className="text-3xl">{formatDuration(metrics.avgResponseTime)}</CardTitle>
              </CardHeader>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  P95 Response Time
                </CardDescription>
                <CardTitle className="text-3xl text-yellow-400">{formatDuration(metrics.p95ResponseTime)}</CardTitle>
              </CardHeader>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  P99 Response Time
                </CardDescription>
                <CardTitle className="text-3xl text-red-400">{formatDuration(metrics.p99ResponseTime)}</CardTitle>
              </CardHeader>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Success Rate
                </CardDescription>
                <CardTitle className="text-3xl text-green-400">{metrics.successRate.toFixed(1)}%</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Session Type Comparison */}
          <Card className="bg-gray-900/50 border-gray-800 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Session Type Comparison
              </CardTitle>
              <CardDescription>Performance metrics by workflow type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.typeComparison.map((type) => (
                  <div key={type.type} className="border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{getSessionTypeLabel(type.type)}</h3>
                      <span className="text-sm text-gray-400">{type.total} sessions</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Avg Duration</p>
                        <p className="text-lg font-semibold">{formatDuration(type.avgDuration)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Success Rate</p>
                        <p className="text-lg font-semibold text-green-400">{type.successRate.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bottlenecks */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Performance Bottlenecks
              </CardTitle>
              <CardDescription>Top 5 slowest sessions (above P95)</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.bottlenecks.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No significant bottlenecks detected</p>
              ) : (
                <div className="space-y-3">
                  {metrics.bottlenecks.map((bottleneck) => (
                    <div
                      key={bottleneck.workflowId}
                      className="border border-red-500/30 rounded-lg p-4 hover:border-red-500/50 transition-all cursor-pointer"
                      onClick={() => setLocation(`/workflow-history/${bottleneck.workflowId}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm text-gray-400">{bottleneck.workflowId}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {getSessionTypeLabel(bottleneck.orchestration)} | {(bottleneck as any).eventCount} events
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-red-400">{formatDuration(bottleneck.duration)}</p>
                          <p className="text-xs text-gray-500">
                            {((bottleneck.duration / metrics.avgResponseTime) - 1).toFixed(0)}x slower
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overall Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardDescription>Total Sessions</CardDescription>
                <CardTitle className="text-2xl">{(stats as any).totalSessions}</CardTitle>
              </CardHeader>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardDescription>Avg Events per Session</CardDescription>
                <CardTitle className="text-2xl">{(stats as any).avgEventCount?.toFixed(1) || "N/A"}</CardTitle>
              </CardHeader>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardDescription>Failed Sessions</CardDescription>
                <CardTitle className="text-2xl text-red-400">{(stats as any).failedSessions}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

// ============================================================================
// Agents Tab
// ============================================================================

function AgentsTab({
  isAuthenticated,
  setLocation,
}: {
  isAuthenticated: boolean;
  setLocation: (path: string) => void;
}) {
  const [selectedWsId, setSelectedWsId] = useState<string>("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch user's workspaces
  const { data: wsData } = trpc.workspace.list.useQuery(undefined, { enabled: isAuthenticated });
  const workspaces = wsData?.workspaces || [];

  // Auto-select first workspace
  const activeWsId = selectedWsId || workspaces[0]?.id || "";

  // Fetch workspace detail
  const { data: wsDetail, refetch: refetchWs } = trpc.workspace.get.useQuery(
    { workspaceId: activeWsId },
    { enabled: isAuthenticated && !!activeWsId },
  );

  type AgentRow = {
    id: string; name: string; role: string; model: string; integration: string;
    permissions: string[]; description?: string | null; goal?: string | null;
    backstory?: string | null; tools?: string[]; priority?: number;
    endpoint?: string | null; connectionStatus?: string; lastSeenAt?: string | null;
    config?: Record<string, unknown> | null;
  };
  const rawAgents = (wsDetail?.agents || []) as AgentRow[];

  // Real-time status overrides from WebSocket
  const [statusOverrides, setStatusOverrides] = useState<Record<string, { connectionStatus: string; lastSeenAt: string }>>({});
  const socketRef = useRef<Socket | null>(null);

  // Subscribe to workspace room for live agent:status events
  useEffect(() => {
    if (!activeWsId) return;
    const socket = io(window.location.origin, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 3,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("subscribe:workspace", activeWsId);
    });

    socket.on("agent:status", (evt: { agentId: string; connectionStatus: string; lastSeenAt: string }) => {
      setStatusOverrides(prev => ({
        ...prev,
        [evt.agentId]: { connectionStatus: evt.connectionStatus, lastSeenAt: evt.lastSeenAt },
      }));
    });

    return () => {
      socket.emit("unsubscribe:workspace", activeWsId);
      socket.disconnect();
      socketRef.current = null;
      setStatusOverrides({});
    };
  }, [activeWsId]);

  // Merge real-time overrides into agent data
  const agents: AgentRow[] = rawAgents.map(a => {
    const override = statusOverrides[a.id];
    if (!override) return a;
    return { ...a, connectionStatus: override.connectionStatus, lastSeenAt: override.lastSeenAt };
  });

  const selectedAgent = agents.find(a => a.id === selectedAgentId) || null;

  const updateAgentMut = trpc.workspace.updateAgent.useMutation({
    onSuccess: () => { setSaving(false); refetchWs(); },
    onError: () => setSaving(false),
  });

  const addAgentMut = trpc.workspace.addAgent.useMutation({
    onSuccess: () => { setShowPresets(false); refetchWs(); },
  });

  const handleSaveAgent = (agentId: string, data: Record<string, unknown>) => {
    if (!activeWsId) return;
    setSaving(true);
    updateAgentMut.mutate({
      workspaceId: activeWsId,
      agentId,
      data: data as any,
    });
  };

  const handleAddPreset = (presetKey: string) => {
    if (!activeWsId) return;
    const preset = AGENT_PRESETS[presetKey];
    addAgentMut.mutate({
      workspaceId: activeWsId,
      agent: {
        name: preset.name,
        role: preset.role,
        model: preset.model,
        integration: preset.integration as any,
        permissions: ["read", "write"],
        tools: preset.tools,
        priority: 5,
      },
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-16">
        <Bot className="h-16 w-16 mx-auto text-gray-600 mb-4" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">Agent Management</h3>
        <p className="text-gray-500 mb-6">Login to manage your AI agents across workspaces</p>
        <Button onClick={() => setLocation("/auth")} className="bg-blue-600 hover:bg-blue-700">
          <LogIn className="h-4 w-4 mr-2" /> Login
        </Button>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="text-center py-16">
        <Bot className="h-16 w-16 mx-auto text-gray-600 mb-4" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">No Workspaces Yet</h3>
        <p className="text-gray-500 mb-6">Create a workspace to start managing your AI agents</p>
        <Button onClick={() => setLocation("/workspace/new")} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" /> Create Workspace
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Workspace selector + Add Agent */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Select value={activeWsId} onValueChange={setSelectedWsId}>
            <SelectTrigger className="w-[280px] bg-gray-800 border-gray-700">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  {ws.name} ({ws.agentCount} agents)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => refetchWs()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <Dialog open={showPresets} onOpenChange={setShowPresets}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> Add Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-700 max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Add Agent Preset</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(AGENT_PRESETS).map(([key, preset]) => (
                <Card
                  key={key}
                  className="bg-gray-800 border-gray-700 cursor-pointer hover:border-blue-500 transition-colors p-3"
                  onClick={() => handleAddPreset(key)}
                >
                  <p className="font-semibold text-white text-sm">{preset.name}</p>
                  <p className="text-xs text-gray-400">{preset.role}</p>
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    {preset.integration === "mcp" ? "MCP" : preset.integration === "windows_mcp" ? "Win MCP" : "REST"}
                  </Badge>
                </Card>
              ))}
            </div>
            <DialogClose asChild>
              <Button variant="outline" className="mt-4 w-full border-gray-600">Cancel</Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agent cards + detail panel */}
      <div className="flex gap-6">
        {/* Left: Agent grid */}
        <div className="flex-1 min-w-0">
          {agents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No agents in this workspace. Click "Add Agent" to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={{
                    id: agent.id,
                    name: agent.name,
                    role: agent.role,
                    model: agent.model,
                    integration: agent.integration,
                    priority: agent.priority ?? 5,
                    connectionStatus: agent.connectionStatus || "disconnected",
                    goal: agent.goal,
                    tools: agent.tools,
                    lastSeenAt: agent.lastSeenAt,
                  }}
                  selected={selectedAgentId === agent.id}
                  onClick={() => setSelectedAgentId(selectedAgentId === agent.id ? null : agent.id)}
                />
              ))}
            </div>
          )}

          {/* Quick actions */}
          {agents.length > 0 && (
            <div className="flex gap-2 mt-6 pt-4 border-t border-gray-800">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-700"
                onClick={() => setLocation("/ai-collaboration/new")}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" /> Run Collaboration
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-700"
                onClick={() => setLocation(`/workspace/${activeWsId}`)}
              >
                <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Workspace Settings
              </Button>
            </div>
          )}
        </div>

        {/* Right: Detail panel */}
        {selectedAgent && (
          <div className="w-[380px] flex-shrink-0">
            <AgentDetailPanel
              agent={selectedAgent}
              workspaceName={wsDetail?.name || ""}
              mcpTokenMask={wsDetail?.mcpTokenMask || "***"}
              onSave={handleSaveAgent}
              onClose={() => setSelectedAgentId(null)}
              saving={saving}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Collaboration Tab
// ============================================================================

function CollaborationTab({
  isAuthenticated,
  setLocation,
}: {
  isAuthenticated: boolean;
  setLocation: (path: string) => void;
}) {
  if (!isAuthenticated) {
    return (
      <div className="text-center py-16">
        <Users className="h-16 w-16 mx-auto text-gray-600 mb-4" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">AI Collaboration</h3>
        <p className="text-gray-500 mb-6">Login to start collaboration sessions between your AI agents</p>
        <Button onClick={() => setLocation("/auth")} className="bg-blue-600 hover:bg-blue-700">
          <LogIn className="h-4 w-4 mr-2" /> Login
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick start cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="bg-gray-900/50 border-gray-800 cursor-pointer hover:border-blue-500 transition-colors"
          onClick={() => setLocation("/ai-collaboration/new")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Play className="h-5 w-5 text-blue-400" />
              New Session
            </CardTitle>
            <CardDescription>
              Start a new multi-agent collaboration session with custom orchestration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Badge variant="outline">Sequential</Badge>
              <Badge variant="outline">Parallel</Badge>
              <Badge variant="outline">Authority Weights</Badge>
            </div>
          </CardContent>
        </Card>

        <Card
          className="bg-gray-900/50 border-gray-800 cursor-pointer hover:border-purple-500 transition-colors"
          onClick={() => setLocation("/ai-collaboration/sessions")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-purple-400" />
              Session History
            </CardTitle>
            <CardDescription>
              View past collaboration sessions and their outcomes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Badge variant="outline">Results</Badge>
              <Badge variant="outline">Decisions</Badge>
              <Badge variant="outline">Replay</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Links to related pages */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg">Related Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="border-gray-700 justify-start" onClick={() => setLocation("/workflow-history")}>
              Workflow History
            </Button>
            <Button variant="outline" className="border-gray-700 justify-start" onClick={() => setLocation("/dev")}>
              Project Brain
            </Button>
            <Button variant="outline" className="border-gray-700 justify-start" onClick={() => setLocation("/workspace")}>
              All Workspaces
            </Button>
            <Button variant="outline" className="border-gray-700 justify-start" onClick={() => setLocation("/conflicts")}>
              Conflict Resolution
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkflowPerformance() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [timeRange, setTimeRange] = useState<"7" | "30" | "90">("7");
  const { isAuthenticated } = useAuth();

  // Read ?tab= from URL, default to "performance"
  const params = new URLSearchParams(searchString);
  const initialTab = params.get("tab") || "performance";
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Update URL without full navigation
    const url = tab === "performance" ? "/workflow-performance" : `/workflow-performance?tab=${tab}`;
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="pt-20 container mx-auto px-4 py-8 mt-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Control Center
            </h1>
            <p className="text-gray-400">
              Manage AI agents, monitor performance, and run collaborations
            </p>
          </div>

          <div className="flex items-center gap-4">
            {!isAuthenticated && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <LogIn className="h-4 w-4 text-amber-400" />
                <span className="text-amber-400 text-sm">Demo Data</span>
              </div>
            )}
            {isAuthenticated && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
                <Activity className="h-4 w-4 text-green-400" />
                <span className="text-green-400 text-sm">Live Data</span>
              </div>
            )}

            {activeTab === "performance" && (
              <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Login Prompt for unauthenticated users */}
        {!isAuthenticated && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 font-medium">Viewing Demo Data</p>
                <p className="text-gray-400 text-sm mt-1">Login to manage agents and see real performance metrics</p>
              </div>
              <Button onClick={() => setLocation("/auth")} className="bg-blue-600 hover:bg-blue-700">
                <LogIn className="h-4 w-4 mr-2" /> Login
              </Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-gray-800/50 mb-6">
            <TabsTrigger value="performance" className="data-[state=active]:bg-gray-700">
              <BarChart3 className="h-4 w-4 mr-2" /> Performance
            </TabsTrigger>
            <TabsTrigger value="agents" className="data-[state=active]:bg-gray-700">
              <Bot className="h-4 w-4 mr-2" /> Agents
            </TabsTrigger>
            <TabsTrigger value="collaboration" className="data-[state=active]:bg-gray-700">
              <Users className="h-4 w-4 mr-2" /> Collaboration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance">
            <PerformanceTab
              isAuthenticated={isAuthenticated}
              timeRange={timeRange}
              setTimeRange={setTimeRange}
              setLocation={setLocation}
            />
          </TabsContent>

          <TabsContent value="agents">
            <AgentsTab isAuthenticated={isAuthenticated} setLocation={setLocation} />
          </TabsContent>

          <TabsContent value="collaboration">
            <CollaborationTab isAuthenticated={isAuthenticated} setLocation={setLocation} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
