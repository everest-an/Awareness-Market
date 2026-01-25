import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  ShoppingCart, 
  Key,
  TrendingUp,
  Eye,
  RefreshCw
} from "lucide-react";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ConsumerDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.analytics.consumerStats.useQuery();
  const { data: permissions, isLoading: permissionsLoading } = trpc.access.myPermissions.useQuery();
  const { data: transactions, isLoading: transactionsLoading } = trpc.transactions.myTransactions.useQuery();

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* Header */}
      <div className="border-b bg-muted/30 mt-20">
        <div className="container flex items-center justify-between py-6">
          <div>
            <h1 className="text-3xl font-bold">Consumer Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your purchased AI capabilities and track usage
            </p>
          </div>
          <Button asChild>
            <Link href="/marketplace">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Browse Marketplace
            </Link>
          </Button>
        </div>
      </div>

      <div className="container py-8">
        {/* Stats Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalPurchases || 0}</div>
              <p className="text-xs text-muted-foreground">
                AI capabilities acquired
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats?.totalSpent.toFixed(2) || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">
                Lifetime investment
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Access</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeAccess || 0}</div>
              <p className="text-xs text-muted-foreground">
                Currently available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Rating Given</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4.5</div>
              <p className="text-xs text-muted-foreground">
                Your review average
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="access" className="space-y-6">
          <TabsList>
            <TabsTrigger value="access">My Access</TabsTrigger>
            <TabsTrigger value="purchases">Purchase History</TabsTrigger>
            <TabsTrigger value="usage">Usage Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="access" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Active Access Tokens</CardTitle>
                <CardDescription>Your currently available AI capabilities</CardDescription>
              </CardHeader>
              <CardContent>
                {permissionsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : permissions && permissions.length > 0 ? (
                  <div className="space-y-4">
                    {permissions.map((permission: any) => {
                      const isExpired = permission.expiresAt && new Date(permission.expiresAt) < new Date();
                      const callsLeft = permission.callsRemaining;
                      
                      return (
                        <div
                          key={permission.id}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold">{permission.vectorTitle || "Unknown Vector"}</h3>
                              <Badge variant={permission.isActive && !isExpired ? "default" : "secondary"}>
                                {isExpired ? "Expired" : permission.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                              {callsLeft !== null && (
                                <span>{callsLeft} calls remaining</span>
                              )}
                              {permission.expiresAt && (
                                <span>Expires: {new Date(permission.expiresAt).toLocaleDateString()}</span>
                              )}
                              {!permission.expiresAt && callsLeft === null && (
                                <span>Unlimited access</span>
                              )}
                            </div>
                            <div className="mt-2">
                              <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                                {permission.accessToken}
                              </code>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/marketplace/${permission.vectorId}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Link>
                            </Button>
                            {permission.isActive && !isExpired && (
                              <Button variant="outline" size="sm">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Renew
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Key className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 font-semibold">No access tokens yet</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Purchase AI capabilities from the marketplace to get started
                    </p>
                    <Button asChild>
                      <Link href="/marketplace">
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Browse Marketplace
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Purchase History</CardTitle>
                <CardDescription>All your AI capability purchases</CardDescription>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : transactions && transactions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>AI Capability</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx: any) => {
                        const transaction = tx.transactions || tx;
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              {new Date(transaction.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-medium">
                              {tx.vectorTitle || "Unknown"}
                            </TableCell>
                            <TableCell>
                              ${parseFloat(transaction.amount || "0").toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
                                {transaction.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/marketplace/${transaction.vectorId}`}>
                                  View
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No purchases yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Usage Statistics</CardTitle>
                <CardDescription>Track your API calls and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground">
                  <p className="text-sm">
                    Detailed usage analytics available in <Link href="/analytics" className="text-primary hover:underline">Analytics Dashboard</Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
