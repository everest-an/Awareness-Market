import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, DollarSign, Clock, CheckCircle, AlertCircle } from "lucide-react";

export default function Analytics() {
  const [timePeriod, setTimePeriod] = useState<number>(30);

  const { data: stats, isLoading: statsLoading } = trpc.analytics.usageStats.useQuery();
  const { data: dailyUsage, isLoading: dailyLoading } = trpc.analytics.dailyUsage.useQuery({ days: timePeriod });

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Usage Analytics</h1>
        <p className="text-muted-foreground">Monitor your AI capability usage, costs, and performance</p>
      </div>

      {/* Time Period Selector */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-medium">Time Period:</label>
        <Select value={timePeriod.toString()} onValueChange={(v) => setTimePeriod(Number(v))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invocations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? "—" : stats?.totalRequests ?? 0}</div>
            <p className="text-xs text-muted-foreground">API calls made</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${statsLoading ? "—" : "0.00"}</div>
            <p className="text-xs text-muted-foreground">Cost data not yet available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? "—" : `${stats?.avgResponseTime ?? 0}ms`}</div>
            <p className="text-xs text-muted-foreground">Average latency</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? "—" : `${stats?.successRate ?? 100}%`}</div>
            <p className="text-xs text-muted-foreground">Successful calls</p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for charts */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Usage</CardTitle>
          <CardDescription>
            Requests per day for the selected time range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center text-muted-foreground">
            <Activity className="mx-auto mb-4 h-12 w-12" />
            {dailyLoading ? (
              <p>Loading usage data...</p>
            ) : dailyUsage && dailyUsage.length > 0 ? (
              <p>{dailyUsage.length} days of usage data loaded</p>
            ) : (
              <p>No usage data available yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
