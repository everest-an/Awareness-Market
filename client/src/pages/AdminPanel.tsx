import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminRoute from "@/components/AdminRoute";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Activity,
  Users,
  Key,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  Settings,
  Building2,
  Crown,
  Shield,
  Database,
  Bot,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function AdminPanel() {
  return (
    <AdminRoute>
      <AdminPanelContent />
    </AdminRoute>
  );
}

function AdminPanelContent() {
  const { toast } = useToast();
  const [selectedDays, setSelectedDays] = useState(7);
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<number | null>(null);
  const [rateLimitDialogOpen, setRateLimitDialogOpen] = useState(false);

  // Fetch data
  const { data: healthData, isLoading: healthLoading } = trpc.adminAnalytics.getSystemHealth.useQuery();
  const { data: usageStats, isLoading: statsLoading } = trpc.adminAnalytics.getUsageStats.useQuery({ days: selectedDays });
  const { data: timeline, isLoading: timelineLoading } = trpc.adminAnalytics.getUsageTimeline.useQuery({ days: 30 });
  const { data: topUsers, isLoading: usersLoading } = trpc.adminAnalytics.getTopUsers.useQuery({ limit: 10 });
  const { data: allApiKeys, isLoading: keysLoading } = trpc.adminAnalytics.getAllApiKeys.useQuery();

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Navbar />
      <div className="pt-20 container max-w-7xl py-8 mt-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">
            System overview and API usage analytics
          </p>
        </div>

        {/* System Health Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthLoading ? "..." : formatNumber(healthData?.totalUsers || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API Keys</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthLoading ? "..." : formatNumber(healthData?.totalApiKeys || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {healthData?.activeApiKeys} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Requests/Hour</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {healthLoading ? "..." : formatNumber(healthData?.requestsLastHour || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : formatPercent(usageStats?.errorRate || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {usageStats?.errorCount} errors
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : `${Math.round(usageStats?.avgResponseTime || 0)}ms`}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">
              <BarChart3 className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="api-keys">
              <Key className="mr-2 h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              Top Users
            </TabsTrigger>
            <TabsTrigger value="organizations">
              <Building2 className="mr-2 h-4 w-4" />
              Organizations
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Usage Timeline Chart */}
            <Card>
              <CardHeader>
                <CardTitle>API Usage Timeline (30 Days)</CardTitle>
                <CardDescription>
                  Daily request volume and error rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                {timelineLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <p className="text-muted-foreground">Loading...</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="requests" stroke="#8884d8" name="Requests" />
                      <Line type="monotone" dataKey="errors" stroke="#ef4444" name="Errors" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top Endpoints */}
            <Card>
              <CardHeader>
                <CardTitle>Top Endpoints</CardTitle>
                <CardDescription>
                  Most frequently accessed endpoints
                </CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : (
                  <div className="space-y-4">
                    {usageStats?.requestsByEndpoint.map((endpoint, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-mono text-sm">{endpoint.endpoint}</p>
                          <p className="text-xs text-muted-foreground">
                            Avg: {Math.round(endpoint.avgResponseTime)}ms
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {formatNumber(endpoint.count)} requests
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Code Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Status Code Distribution</CardTitle>
                <CardDescription>
                  HTTP response status codes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={usageStats?.requestsByStatus}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="statusCode" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All API Keys</CardTitle>
                <CardDescription>
                  Manage API keys and rate limits
                </CardDescription>
              </CardHeader>
              <CardContent>
                {keysLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : (
                  <div className="space-y-4">
                    {allApiKeys?.map((key) => (
                      <Card key={key.keyId}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{key.keyName}</p>
                                {key.isActive ? (
                                  <Badge variant="default">
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">Revoked</Badge>
                                )}
                              </div>
                              <p className="font-mono text-sm text-muted-foreground">
                                {key.keyPrefix}•••••••••••••••�?
                              </p>
                              <p className="text-sm text-muted-foreground">
                                User: {key.userName} ({key.userEmail})
                              </p>
                              <div className="flex gap-4 text-sm mt-2">
                                <span>
                                  <strong>Requests:</strong> {formatNumber(key.totalRequests)}
                                </span>
                                <span>
                                  <strong>Rate Limit:</strong>{" "}
                                  {key.requestsPerHour ? `${key.requestsPerHour}/hr` : "Not set"}
                                </span>
                                <span>
                                  <strong>Status:</strong>{" "}
                                  {key.rateLimitEnabled ? "Enabled" : "Disabled"}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedApiKeyId(key.keyId);
                                setRateLimitDialogOpen(true);
                              }}
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              Configure
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top API Users</CardTitle>
                <CardDescription>
                  Users with highest API usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : (
                  <div className="space-y-4">
                    {topUsers?.map((user, idx) => (
                      <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium">{user.userName}</p>
                            <p className="text-sm text-muted-foreground">{user.userEmail}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatNumber(user.totalRequests)} requests</p>
                          <p className="text-sm text-muted-foreground">
                            {user.apiKeyCount} API keys �?{Math.round(user.avgResponseTime)}ms avg
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Organizations Tab */}
          <TabsContent value="organizations" className="space-y-4">
            <OrganizationsPanel />
          </TabsContent>
        </Tabs>

        {/* Rate Limit Configuration Dialog */}
        <RateLimitDialog
          apiKeyId={selectedApiKeyId}
          open={rateLimitDialogOpen}
          onOpenChange={setRateLimitDialogOpen}
        />
      </div>
    </div>
  );
}

function RateLimitDialog({
  apiKeyId,
  open,
  onOpenChange,
}: {
  apiKeyId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [requestsPerHour, setRequestsPerHour] = useState(1000);
  const [requestsPerDay, setRequestsPerDay] = useState(10000);
  const [isEnabled, setIsEnabled] = useState(true);

  const { data: config } = trpc.adminAnalytics.getRateLimitConfig.useQuery(
    { apiKeyId: apiKeyId! },
    { enabled: !!apiKeyId }
  );

  const updateMutation = trpc.adminAnalytics.updateRateLimitConfig.useMutation({
    onSuccess: () => {
      utils.adminAnalytics.getAllApiKeys.invalidate();
      toast({
        title: "Rate Limit Updated",
        description: "Rate limit configuration has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!apiKeyId) return;

    updateMutation.mutate({
      apiKeyId,
      requestsPerHour,
      requestsPerDay,
      isEnabled,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Rate Limit</DialogTitle>
          <DialogDescription>
            Set rate limits for this API key
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="requestsPerHour">Requests Per Hour</Label>
            <Input
              id="requestsPerHour"
              type="number"
              value={requestsPerHour}
              onChange={(e) => setRequestsPerHour(parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requestsPerDay">Requests Per Day</Label>
            <Input
              id="requestsPerDay"
              type="number"
              value={requestsPerDay}
              onChange={(e) => setRequestsPerDay(parseInt(e.target.value))}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isEnabled"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="isEnabled">Enable Rate Limiting</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PLAN_TIERS: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  lite: { label: "Lite", color: "bg-slate-500/20 text-slate-300", icon: Shield },
  team: { label: "Team", color: "bg-blue-500/20 text-blue-400", icon: Users },
  enterprise: { label: "Enterprise", color: "bg-purple-500/20 text-purple-400", icon: Crown },
  scientific: { label: "Scientific", color: "bg-cyan-500/20 text-cyan-400", icon: Database },
};

function OrganizationsPanel() {
  const { data: orgs, isLoading } = trpc.organization.listAll.useQuery(
    undefined,
    { retry: false }
  );

  if (isLoading) {
    return <p className="text-muted-foreground text-center py-8">Loading organizations...</p>;
  }

  const orgList = orgs ?? [];

  // Aggregate stats
  const totalOrgs = orgList.length;
  const byTier = orgList.reduce((acc: Record<string, number>, org: any) => {
    const tier = org.planTier || "lite";
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Building2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">{totalOrgs}</div>
            <div className="text-xs text-muted-foreground">Total Organizations</div>
          </CardContent>
        </Card>
        {Object.entries(PLAN_TIERS).map(([key, tier]) => (
          <Card key={key}>
            <CardContent className="pt-6 text-center">
              <tier.icon className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <div className="text-2xl font-bold">{byTier[key] || 0}</div>
              <div className="text-xs text-muted-foreground">{tier.label} Plan</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Organizations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Organizations
          </CardTitle>
          <CardDescription>
            Platform-wide organization management
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No organizations yet</p>
              <p className="text-sm mt-1">Organizations will appear here once created.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orgList.map((org: any) => {
                const tier = PLAN_TIERS[org.planTier] || PLAN_TIERS.lite;
                const TierIcon = tier.icon;
                return (
                  <div
                    key={org.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">{org.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Bot className="h-3 w-3" />
                          {org._count?.agents ?? org.maxAgents ?? '—'} agents
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Database className="h-3 w-3" />
                          {org._count?.memories ?? '—'} memories
                        </div>
                      </div>
                      <Badge className={tier.color}>
                        <TierIcon className="h-3 w-3 mr-1" />
                        {tier.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
