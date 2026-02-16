import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import { BarChart3, TrendingUp, Clock, Zap, AlertTriangle, Activity, LogIn } from "lucide-react";
import { useLocation } from "wouter";

/**
 * Workflow Performance Dashboard
 * 
 * Provides performance analysis and insights for workflow sessions:
 * - Response time trends
 * - Bottleneck analysis
 * - Session type comparison
 * - Success/failure rates
 */
// Generate demo performance data for unauthenticated users
function generateDemoData() {
  const sessionTypes = ["ai_reasoning", "memory_transfer", "package_processing", "w_matrix_training", "vector_invocation"];
  const statuses = ["completed", "completed", "completed", "completed", "failed"]; // 80% success
  
  const sessions = Array.from({ length: 50 }, (_, i) => {
    const type = sessionTypes[Math.floor(Math.random() * sessionTypes.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const duration = Math.floor(Math.random() * 5000) + 500; // 500ms - 5500ms
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

export function WorkflowPerformance() {
  const [, setLocation] = useLocation();
  const [timeRange, setTimeRange] = useState<"7" | "30" | "90">("7");
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  // Demo data for unauthenticated users
  const demoData = useMemo(() => generateDemoData(), []);

  // Calculate date range
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  };

  const { startDate, endDate } = getDateRange();

  // Query performance metrics (only for authenticated users)
  const { data: realMetrics, isLoading } = trpc.workflowPerformance.getPerformanceMetrics.useQuery({
    startDate,
    endDate,
  }, {
    enabled: isAuthenticated,
  });

  // Query overall statistics
  const { data: realStats } = trpc.workflowPerformance.getStatistics.useQuery({
    startDate,
    endDate,
  }, {
    enabled: isAuthenticated,
  });

  // Query bottlenecks
  const { data: bottlenecksData } = trpc.workflowPerformance.getBottlenecks.useQuery({
    startDate,
    endDate,
    limit: 5,
  }, {
    enabled: isAuthenticated,
  });

  // Query type comparison
  const { data: typeComparisonData } = trpc.workflowPerformance.getTypeComparison.useQuery({
    startDate,
    endDate,
  }, {
    enabled: isAuthenticated,
  });

  // Use real stats if authenticated, demo stats otherwise
  const stats = isAuthenticated ? realStats : demoData.stats;

  // Use backend-calculated metrics (much more efficient!)
  const metrics = {
    avgResponseTime: isAuthenticated ? (realMetrics?.avgResponseTime || 0) : 2800,
    p95ResponseTime: isAuthenticated ? (realMetrics?.p95ResponseTime || 0) : 4500,
    p99ResponseTime: isAuthenticated ? (realMetrics?.p99ResponseTime || 0) : 5200,
    successRate: isAuthenticated ? (realMetrics?.successRate || 0) : 80,
    bottlenecks: isAuthenticated ? (bottlenecksData?.bottlenecks || []) : [],
    typeComparison: isAuthenticated ? (typeComparisonData?.comparison || []) : generateDemoTypeComparison(),
  };

  // Generate demo type comparison for unauthenticated users
  function generateDemoTypeComparison() {
    return [
      { type: 'ai_reasoning', total: 20, avgDuration: 2500, successRate: 85, p95Duration: 4000 },
      { type: 'memory_transfer', total: 15, avgDuration: 1800, successRate: 90, p95Duration: 3200 },
      { type: 'package_processing', total: 10, avgDuration: 3200, successRate: 75, p95Duration: 5000 },
      { type: 'w_matrix_training', total: 3, avgDuration: 4500, successRate: 100, p95Duration: 5500 },
      { type: 'vector_invocation', total: 2, avgDuration: 1200, successRate: 100, p95Duration: 2000 },
    ];
  }

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Get session type label
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
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      
      <div className="pt-20 container mx-auto px-4 py-8 mt-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Performance Dashboard
            </h1>
            <p className="text-gray-400">
              Analyze workflow performance and identify optimization opportunities
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Auth Status Indicator */}
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
            
            {/* Time Range Selector */}
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
          </div>
        </div>
        
        {/* Login Prompt for unauthenticated users */}
        {!isAuthenticated && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 font-medium">📊 Viewing Demo Performance Data</p>
                <p className="text-gray-400 text-sm mt-1">Login to see your real workflow performance metrics and analytics</p>
              </div>
              <Button 
                onClick={() => setLocation("/auth")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Button>
            </div>
          </div>
        )}

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
                <CardDescription>
                  Performance metrics by workflow type
                </CardDescription>
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
                <CardDescription>
                  Top 5 slowest sessions (above P95)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.bottlenecks.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    No significant bottlenecks detected
                  </p>
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
                              {getSessionTypeLabel(bottleneck.orchestration)} �?{(bottleneck as any).eventCount} events
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
      </div>
    </div>
  );
}
