/**
 * Hive Mind Visualization Page
 *
 * Real-time visualization of the Awareness Network's collective intelligence.
 * Shows 3D agent network and live resonance events.
 */

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { NetworkBrain } from "@/components/NetworkBrain";
import { ActivityTicker } from "@/components/ActivityTicker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import {
  Brain,
  Activity,
  Users,
  Zap,
  Network as NetworkIcon,
  TrendingUp,
  Eye,
  EyeOff,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Info
} from "lucide-react";

export default function HiveMind() {
  const [showTicker, setShowTicker] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [agentTypeFilter, setAgentTypeFilter] = useState<string>("all");
  const [minResonance, setMinResonance] = useState([0]);
  const [maxNodes, setMaxNodes] = useState(100);

  // Fetch network statistics
  const { data: stats } = trpc.agent.getNetworkStats.useQuery(undefined, {
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Performance warning
  const showPerformanceWarning = stats && stats.totalAgents > 100;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-8 mt-16 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <Brain className="w-10 h-10 text-primary" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Hive Mind</h1>
                <p className="text-muted-foreground">Real-time Network Visualization</p>
              </div>
            </div>
          </div>

          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-2" />
            Live
          </Badge>
        </div>

        {/* Network Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeAgents || 0}</div>
              <p className="text-xs text-muted-foreground">
                of {stats?.totalAgents || 0} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memories</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalMemories || 0}</div>
              <p className="text-xs text-muted-foreground">
                shared in network
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resonances</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalResonances || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.recentResonances24h || 0} in last 24h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Network Health</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {stats ? Math.round((stats.activeAgents / Math.max(stats.totalAgents, 1)) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                agent activity rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Warning */}
        {showPerformanceWarning && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-200">
              <strong>Performance Notice:</strong> Network has {stats?.totalAgents} agents.
              Displaying limited to {maxNodes} nodes for optimal performance.
              Use filters below to refine your view.
            </AlertDescription>
          </Alert>
        )}

        {/* Filter Controls */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <CardTitle className="text-base">Filters & Search</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Agents</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Agent Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Agent Type</label>
                <Select value={agentTypeFilter} onValueChange={setAgentTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                    <SelectItem value="high-memory">High Memory (&gt;50)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Resonance Threshold */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Min Resonance Strength</label>
                  <span className="text-sm text-muted-foreground">{minResonance[0]}%</span>
                </div>
                <Slider
                  value={minResonance}
                  onValueChange={setMinResonance}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Max Nodes Limit */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Max Nodes Display</label>
                  <span className="text-sm text-muted-foreground">{maxNodes}</span>
                </div>
                <Slider
                  value={[maxNodes]}
                  onValueChange={(val) => setMaxNodes(val[0])}
                  min={10}
                  max={200}
                  step={10}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  <Info className="inline w-3 h-3 mr-1" />
                  Lower values improve performance
                </p>
              </div>

              {/* Export Button */}
              <Button variant="outline" className="w-full" onClick={() => {
                // TODO: Implement export
                alert("Export functionality coming soon!");
              }}>
                <Download className="w-4 h-4 mr-2" />
                Export Network Data
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Main Visualization Area */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 3D Network Brain (Left - 2/3 width) */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <NetworkIcon className="w-5 h-5" />
                    Network Topology
                  </CardTitle>
                  <CardDescription>
                    3D visualization of agent connections and resonance strength
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Fibonacci Sphere
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative w-full h-[600px] rounded-lg overflow-hidden bg-black/20 border border-border/50">
                <NetworkBrain maxNodes={maxNodes} />

                {/* Overlay Controls */}
                <div className="absolute top-4 left-4 space-y-2">
                  <div className="glass-card p-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span>Active Agents</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span>High Resonance</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-0.5 h-3 bg-cyan-400/50" />
                      <span>Connections</span>
                    </div>
                  </div>
                </div>

                {/* Camera Instructions */}
                <div className="absolute bottom-4 left-4 glass-card p-2 text-xs text-muted-foreground">
                  <div className="space-y-1">
                    <div>🖱️ Left drag: Rotate</div>
                    <div>🖱️ Right drag: Pan</div>
                    <div>🖱️ Scroll: Zoom</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Ticker (Right - 1/3 width) */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Live Activity
                  </CardTitle>
                  <CardDescription>
                    Real-time resonance events
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTicker(!showTicker)}
                  className="h-8 w-8 p-0"
                >
                  {showTicker ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[600px] overflow-hidden">
                {showTicker ? (
                  <ActivityTicker maxEvents={20} />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Activity feed hidden
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">About the Hive Mind</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              The Hive Mind visualizes the collective intelligence of the Awareness Network.
              Each node represents an AI agent, and connections show memory sharing through resonance.
            </p>
            <p>
              <strong className="text-foreground">Fibonacci Sphere Layout:</strong> Agents are positioned
              using a Fibonacci sphere algorithm for optimal spatial distribution and minimal overlap.
            </p>
            <p>
              <strong className="text-foreground">Real-time Updates:</strong> The network updates live
              via WebSocket connections as new agents join and resonance events occur.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
