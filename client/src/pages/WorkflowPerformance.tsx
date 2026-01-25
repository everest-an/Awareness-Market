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

  // Query statistics for the time range (only for authenticated users)
  const { data: realStats, isLoading } = trpc.workflowHistory.getStatistics.useQuery({
    startDate,
    endDate,
  }, {
    enabled: isAuthenticated,
  });
  
  // Use real stats if authenticated, demo stats otherwise
  const stats = isAuthenticated ? realStats : demoData.stats;

  // Query all sessions for detailed analysis (only for authenticated users)
  const { data: realSessionsData } = trpc.workflowHistory.getHistory.useQuery({
    page: 1,
    pageSize: 1000, // Get more data for analysis
    startDate,
    endDate,
    sortBy: "createdAt",
    sortOrder: "desc",
  }, {
    enabled: isAuthenticated,
  });
  
  // Use real sessions if authenticated, demo sessions otherwise
  const sessionsData = isAuthenticated 
    ? realSessionsData 
    : { sessions: demoData.sessions, totalCount: demoData.sessions.length };

  // Calculate performance metrics
  const calculateMetrics = () => {
    if (!sessionsData?.sessions) {
      return {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        successRate: 0,
        bottlenecks: [],
        typeComparison: [],
      };
    }

    const sessions = sessionsData.sessions;
    const durations = sessions
      .filter((s) => (s as any).duration !== null && (s as any).duration !== undefined)
      .map((s) => (s as any).duration!)
      .sort((a: number, b: number) => a - b);

    const avgResponseTime = durations.length > 0
      ? durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length
      : 0;

    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    const p95ResponseTime = durations[p95Index] || 0;
    const p99ResponseTime = durations[p99Index] || 0;

    const completedCount = sessions.filter((s) => s.status === "completed").length;
    const successRate = sessions.length > 0 ? (completedCount / sessions.length) * 100 : 0;

    // Find bottlenecks (sessions with duration > p95)
    const bottlenecks = sessions
      .filter((s) => (s as any).duration && (s as any).duration > p95ResponseTime)
      .slice(0, 5)
      .map((s: any) => ({
        sessionId: s.id,
        duration: s.duration!,
        type: s.type,
        eventCount: s.eventCount,
      }));

    // Type comparison
    const typeStats = new Map<string, { total: number; avgDuration: number; completed: number }>();
    sessions.forEach((s: any) => {
      const existing = typeStats.get(s.type) || { total: 0, avgDuration: 0, completed: 0 };
      existing.total++;
      if (s.duration) {
        existing.avgDuration += s.duration;
      }
      if (s.status === "completed") {
        existing.completed++;
      }
      typeStats.set(s.type, existing);
    });

    const typeComparison = Array.from(typeStats.entries()).map(([type, stats]) => ({
      type,
      total: stats.total,
      avgDuration: stats.avgDuration / stats.total,
      successRate: (stats.completed / stats.total) * 100,
    }));

    return {
      avgResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      successRate,
      bottlenecks,
      typeComparison,
    };
  };

  const metrics = calculateMetrics();

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
      
      <div className="container mx-auto px-4 py-8 mt-20">
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
                <p className="text-blue-300 font-medium">ðŸ“Š Viewing Demo Performance Data</p>
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
                        key={bottleneck.sessionId}
                        className="border border-red-500/30 rounded-lg p-4 hover:border-red-500/50 transition-all cursor-pointer"
                        onClick={() => setLocation(`/workflow-history/${bottleneck.sessionId}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono text-sm text-gray-400">{bottleneck.sessionId}</p>
                            <p className="text-sm text-gray-500 mt-1">
                              {getSessionTypeLabel(bottleneck.type)} â€?{bottleneck.eventCount} events
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
                  <CardTitle className="text-2xl">{stats.totalSessions}</CardTitle>
                </CardHeader>
              </Card>
              
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardDescription>Avg Events per Session</CardDescription>
                  <CardTitle className="text-2xl">{stats.avgEventCount?.toFixed(1) || "N/A"}</CardTitle>
                </CardHeader>
              </Card>
              
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardDescription>Failed Sessions</CardDescription>
                  <CardTitle className="text-2xl text-red-400">{stats.failedSessions}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
