import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Activity, TrendingUp, Clock, AlertCircle, Key, Target, Users, Brain, Zap, Award } from "lucide-react";

const COLORS = ["#0ea5e9", "#06b6d4", "#22d3ee", "#67e8f9", "#a5f3fc"];

export default function UsageAnalytics() {
  const [activeTab, setActiveTab] = useState<"api" | "collaboration">("api");

  // API Usage queries
  const { data: stats, isLoading: statsLoading, error: statsError } = trpc.analytics.usageStats.useQuery();
  const { data: endpoints, isLoading: endpointsLoading } = trpc.analytics.popularEndpoints.useQuery({ limit: 10 });
  const { data: dailyUsage, isLoading: dailyLoading } = trpc.analytics.dailyUsage.useQuery({ days: 30 });
  const { data: apiKeyUsage, isLoading: keysLoading } = trpc.analytics.apiKeyUsage.useQuery();

  // Collaboration Analytics queries (Phase 3 - Task I)
  const { data: collabStats } = trpc.apiAnalytics.collaborationStats.useQuery({ days: 30 });
  const { data: qualityMetrics } = trpc.apiAnalytics.qualityMetrics.useQuery({ days: 7 });
  const { data: perfMetrics } = trpc.apiAnalytics.performanceMetrics.useQuery({ hours: 24 });
  const { data: agentUtil } = trpc.apiAnalytics.agentUtilization.useQuery({ days: 7 });
  const { data: collabTrend } = trpc.apiAnalytics.collaborationTrend.useQuery({ hours: 24 });
  const { data: topTasks } = trpc.apiAnalytics.topTasks.useQuery({ days: 30, limit: 10 });

  if (statsError) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load usage analytics. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="pt-20 container py-8 space-y-8 mt-20">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Monitor API usage, collaboration metrics, and system performance
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "api" | "collaboration")} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="api">API Usage</TabsTrigger>
            <TabsTrigger value="collaboration">Collaboration Analytics</TabsTrigger>
          </TabsList>

          {/* API Usage Tab */}
          <TabsContent value="api" className="space-y-8 mt-6">

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalRequests.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.requestsToday} today
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.successRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last 30 days
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.avgResponseTime}ms</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all endpoints
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.requestsThisMonth.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.requestsThisWeek} this week
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Usage</CardTitle>
            <CardDescription>Requests over the past 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : dailyUsage && dailyUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="requests" stroke="#0ea5e9" strokeWidth={2} name="Requests" />
                  <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} name="Errors" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No usage data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Key Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>API Key Usage</CardTitle>
            <CardDescription>Requests by API key</CardDescription>
          </CardHeader>
          <CardContent>
            {keysLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : apiKeyUsage && apiKeyUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={apiKeyUsage}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ keyName, percent }) => `${keyName}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="requests"
                  >
                    {apiKeyUsage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No API keys found
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Popular Endpoints Table */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Endpoints</CardTitle>
          <CardDescription>Most frequently used API endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          {endpointsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : endpoints && endpoints.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Endpoint</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Method</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Requests</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Avg Time</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((endpoint, index) => (
                    <tr key={index} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm font-mono">{endpoint.endpoint}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          endpoint.method === 'GET' ? 'bg-blue-500/10 text-blue-500' :
                          endpoint.method === 'POST' ? 'bg-green-500/10 text-green-500' :
                          endpoint.method === 'PUT' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {endpoint.method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-right">{endpoint.count.toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-right">{endpoint.avgResponseTime}ms</td>
                      <td className="py-3 px-4 text-sm text-right">
                        <span className={endpoint.errorRate > 5 ? 'text-red-500' : 'text-green-500'}>
                          {endpoint.errorRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No endpoint data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Usage breakdown by API key</CardDescription>
        </CardHeader>
        <CardContent>
          {keysLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : apiKeyUsage && apiKeyUsage.length > 0 ? (
            <div className="space-y-3">
              {apiKeyUsage.map((key, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Key className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{key.keyName}</div>
                      <div className="text-sm text-muted-foreground">
                        {key.lastUsed ? `Last used ${new Date(key.lastUsed).toLocaleString()}` : 'Never used'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{key.requests.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">requests</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No API keys found. Create one to start tracking usage.
            </div>
          )}
        </CardContent>
      </Card>
          </TabsContent>

          {/* Collaboration Analytics Tab - Phase 3 Task I */}
          <TabsContent value="collaboration" className="space-y-8 mt-6">
            {/* Collaboration Stats Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {!collabStats ? <Skeleton className="h-8 w-24" /> : (
                    <>
                      <div className="text-2xl font-bold">{collabStats.stats.totalSessions}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {collabStats.stats.successRate}% success rate
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Quality</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {!collabStats ? <Skeleton className="h-8 w-24" /> : (
                    <>
                      <div className="text-2xl font-bold">{collabStats.stats.avgQuality.toFixed(4)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Quality score</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Memories</CardTitle>
                  <Brain className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {!collabStats ? <Skeleton className="h-8 w-24" /> : (
                    <>
                      <div className="text-2xl font-bold">{collabStats.stats.totalMemories}</div>
                      <p className="text-xs text-muted-foreground mt-1">Created</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {!collabStats ? <Skeleton className="h-8 w-24" /> : (
                    <>
                      <div className="text-2xl font-bold">{(collabStats.stats.avgDuration / 1000).toFixed(1)}s</div>
                      <p className="text-xs text-muted-foreground mt-1">Per session</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Collaboration Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Collaboration Trend</CardTitle>
                  <CardDescription>Hourly collaboration activity (last 24h)</CardDescription>
                </CardHeader>
                <CardContent>
                  {!collabTrend ? <Skeleton className="h-[300px] w-full" /> : collabTrend.trend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={collabTrend.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="hour"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(value) => new Date(value).toLocaleTimeString('en-US', { hour: '2-digit' })}
                        />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="sessionCount" stroke="#0ea5e9" strokeWidth={2} name="Sessions" />
                        <Line type="monotone" dataKey="memoryCreated" stroke="#22d3ee" strokeWidth={2} name="Memories" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No collaboration data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Agent Utilization */}
              <Card>
                <CardHeader>
                  <CardTitle>Agent Utilization</CardTitle>
                  <CardDescription>Session count by agent type</CardDescription>
                </CardHeader>
                <CardContent>
                  {!agentUtil ? <Skeleton className="h-[300px] w-full" /> : agentUtil.agents.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={agentUtil.agents}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="agentType" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Bar dataKey="sessionCount" fill="#0ea5e9" name="Sessions" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No agent data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quality & Performance Metrics */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Quality Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Quality Metrics</CardTitle>
                  <CardDescription>Embedding quality and validation</CardDescription>
                </CardHeader>
                <CardContent>
                  {!qualityMetrics ? <Skeleton className="h-[200px] w-full" /> : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Avg Embedding Quality</span>
                        <span className="text-lg font-semibold">{qualityMetrics.metrics.avgEmbeddingQuality.toFixed(4)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Avg Sparsity</span>
                        <span className="text-lg font-semibold">{qualityMetrics.metrics.avgSparsity.toFixed(4)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Avg Similarity Score</span>
                        <span className="text-lg font-semibold">{qualityMetrics.metrics.avgSimilarityScore.toFixed(4)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Rejection Rate</span>
                        <span className={`text-lg font-semibold ${qualityMetrics.metrics.rejectionRate > 5 ? 'text-red-500' : 'text-green-500'}`}>
                          {qualityMetrics.metrics.rejectionRate}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Processed</span>
                        <span className="text-lg font-semibold">{qualityMetrics.metrics.totalProcessed}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>Retrieval time and GPU usage</CardDescription>
                </CardHeader>
                <CardContent>
                  {!perfMetrics ? <Skeleton className="h-[200px] w-full" /> : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Avg Retrieval Time</span>
                        <span className="text-lg font-semibold">{perfMetrics.metrics.avgRetrievalTime}ms</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">P95 Retrieval Time</span>
                        <span className="text-lg font-semibold text-yellow-500">{perfMetrics.metrics.p95RetrievalTime}ms</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Max Retrieval Time</span>
                        <span className="text-lg font-semibold text-red-500">{perfMetrics.metrics.maxRetrievalTime}ms</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">GPU Utilization</span>
                        <span className="text-lg font-semibold text-blue-400">{perfMetrics.metrics.gpuUtilization}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Cache Hit Rate</span>
                        <span className="text-lg font-semibold text-green-500">{perfMetrics.metrics.cacheHitRate}%</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Tasks Table */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Tasks</CardTitle>
                <CardDescription>Tasks ranked by quality and success rate</CardDescription>
              </CardHeader>
              <CardContent>
                {!topTasks ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : topTasks.tasks.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Task Type</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Count</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Avg Quality</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Success Rate</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Avg Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topTasks.tasks.map((task, index) => (
                          <tr key={index} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-3 px-4 text-sm font-medium">{task.taskType}</td>
                            <td className="py-3 px-4 text-sm text-right">{task.count}</td>
                            <td className="py-3 px-4 text-sm text-right">
                              <span className="text-blue-400 font-semibold">{task.avgQuality.toFixed(4)}</span>
                            </td>
                            <td className="py-3 px-4 text-sm text-right">
                              <span className={task.successRate >= 90 ? 'text-green-500' : task.successRate >= 70 ? 'text-yellow-500' : 'text-red-500'}>
                                {task.successRate}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-right">{(task.avgDuration / 1000).toFixed(1)}s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No task data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
