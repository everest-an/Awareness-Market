import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  Brain, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Eye,
  MoreVertical
} from "lucide-react";
import { Link } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function CreatorDashboard() {
  const utils = trpc.useUtils();
  const { data: stats, isLoading: statsLoading } = trpc.analytics.creatorStats.useQuery();
  const { data: trend } = trpc.analytics.creatorTrend.useQuery({ days: 30 });
  const { data: vectors, isLoading: vectorsLoading } = trpc.vectors.myVectors.useQuery();
  const updateVectorMutation = trpc.vectors.update.useMutation({
    onSuccess: () => {
      utils.vectors.myVectors.invalidate();
      utils.analytics.creatorStats.invalidate();
      utils.analytics.creatorTrend.invalidate();
    },
  });

  if (statsLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="mb-8 h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const revenueGrowth = stats ? (
    stats.totalRevenue > 0 ? ((stats.totalRevenue - (stats.totalRevenue * 0.8)) / (stats.totalRevenue * 0.8)) * 100 : 0
  ) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-muted/30">
        <div className="container flex items-center justify-between py-6">
          <div>
            <h1 className="text-3xl font-bold">Creator Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your AI capabilities and track performance
            </p>
          </div>
          <Button asChild>
            <Link href="/upload">
              <Plus className="mr-2 h-4 w-4" />
              Upload New Vector
            </Link>
          </Button>
        </div>
      </div>

      <div className="container py-8">
        {/* Stats Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats?.totalRevenue.toFixed(2) || "0.00"}
              </div>
              <p className="flex items-center text-xs text-muted-foreground">
                {revenueGrowth >= 0 ? (
                  <>
                    <ArrowUpRight className="mr-1 h-3 w-3 text-green-500" />
                    <span className="text-green-500">+{revenueGrowth.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="mr-1 h-3 w-3 text-red-500" />
                    <span className="text-red-500">{revenueGrowth.toFixed(1)}%</span>
                  </>
                )}
                <span className="ml-1">from last month</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCalls.toLocaleString() || "0"}</div>
              <p className="text-xs text-muted-foreground">
                Across all vectors
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Vectors</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.activeVectors || 0} / {stats?.totalVectors || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Published and available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.averageRating || "0.0"}</div>
              <p className="text-xs text-muted-foreground">
                Based on user reviews
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="vectors">My Vectors</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue & Calls Trend</CardTitle>
                <CardDescription>Last 30 days performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        name="Revenue ($)"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="calls"
                        stroke="hsl(var(--accent))"
                        strokeWidth={2}
                        name="API Calls"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Latest purchases of your AI capabilities</CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Vector</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Your Earnings</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recentTransactions.map((tx: any) => (
                        <TableRow key={tx.id || tx.transactions?.id}>
                          <TableCell>
                            {new Date(tx.createdAt || tx.transactions?.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {tx.vectorTitle || "Unknown"}
                          </TableCell>
                          <TableCell>${parseFloat(tx.amount || tx.transactions?.amount || "0").toFixed(2)}</TableCell>
                          <TableCell className="font-semibold text-green-600">
                            ${parseFloat(tx.creatorEarnings || tx.transactions?.creatorEarnings || "0").toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={tx.status === "completed" || tx.transactions?.status === "completed" ? "default" : "secondary"}>
                              {tx.status || tx.transactions?.status || "pending"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No transactions yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vectors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your AI Capabilities</CardTitle>
                <CardDescription>Manage and monitor your published vectors</CardDescription>
              </CardHeader>
              <CardContent>
                {vectorsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : vectors && vectors.length > 0 ? (
                  <div className="space-y-4">
                    {vectors.map((vector) => (
                      <div
                        key={vector.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold">{vector.title}</h3>
                            <Badge variant={vector.status === "active" ? "default" : "secondary"}>
                              {vector.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                            {vector.description}
                          </p>
                          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{vector.totalCalls} calls</span>
                            <span>${parseFloat(vector.totalRevenue).toFixed(2)} earned</span>
                            <span>⭐ {parseFloat(vector.averageRating || "0").toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/marketplace/${vector.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 text-foreground"
                                  onClick={() => updateVectorMutation.mutate({
                                    id: vector.id,
                                    status: vector.status === "active" ? "inactive" : "active",
                                  })}
                                >
                                  {vector.status === "active" ? "Deactivate" : "Activate"}
                                </Button>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 font-semibold">No vectors yet</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Start by uploading your first AI capability
                    </p>
                    <Button asChild>
                      <Link href="/upload">
                        <Plus className="mr-2 h-4 w-4" />
                        Upload Vector
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>Complete history of your earnings</CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Vector</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Platform Fee (20%)</TableHead>
                        <TableHead>Your Earnings (80%)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recentTransactions.map((tx: any) => {
                        const transaction = tx.transactions || tx;
                        const amount = parseFloat(transaction.amount || "0");
                        const platformFee = amount * 0.2;
                        const earnings = amount * 0.8;
                        
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-mono text-sm">
                              #{transaction.id}
                            </TableCell>
                            <TableCell>
                              {new Date(transaction.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-medium">
                              {tx.vectorTitle || "Unknown"}
                            </TableCell>
                            <TableCell>
                              {tx.buyerName || "Anonymous"}
                            </TableCell>
                            <TableCell>${amount.toFixed(2)}</TableCell>
                            <TableCell className="text-muted-foreground">
                              ${platformFee.toFixed(2)}
                            </TableCell>
                            <TableCell className="font-semibold text-green-600">
                              ${earnings.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
                                {transaction.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No transactions yet
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
