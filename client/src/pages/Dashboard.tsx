import { useAuth } from '@/hooks/useAuth';
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  Star,
  DollarSign,
  Activity,
  Users,
  Upload,
  Eye,
  Download,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Transaction data types
interface TransactionData {
  id: number;
  amount: string | number;
  type: string;
  status: string;
  createdAt: string;
  vectorId?: number;
  vector?: { title: string };
  transactions?: TransactionData;
}

interface PurchaseData {
  id: number;
  amount: string | number;
  vectorId: number;
  vector?: { title: string };
  transactions?: PurchaseData;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to auth if not logged in
  if (!authLoading && !user) {
    setLocation("/auth");
    return null;
  }

  // Fetch user's vectors
  const { data: myVectors, isLoading: vectorsLoading } = trpc.vectors.myVectors.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Fetch user's transactions
  const { data: transactions, isLoading: transactionsLoading } = trpc.transactions.myTransactions.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Fetch user's purchases (same as transactions for buyers)
  const { data: purchasesRaw, isLoading: purchasesLoading } = trpc.transactions.myTransactions.useQuery(
    undefined,
    { enabled: !!user }
  );
  
  // Normalize purchases data to handle both joined and non-joined formats
  const purchases = purchasesRaw?.map((p: PurchaseData) => p.transactions || p) || [];

  // Calculate statistics
  const totalRevenue = myVectors?.reduce((sum, v) => sum + Number(v.totalRevenue || 0), 0) || 0;
  const totalVectors = myVectors?.length || 0;
  const totalCalls = myVectors?.reduce((sum, v) => sum + (v.totalCalls || 0), 0) || 0;
  const avgRating = myVectors && myVectors.length > 0
    ? myVectors.reduce((sum, v) => sum + Number(v.averageRating || 0), 0) / myVectors.length
    : 0;

  const totalSpent = purchases?.reduce((sum: number, p: PurchaseData) => sum + Number(p.amount || 0), 0) || 0;
  const totalPurchases = purchases?.length || 0;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
        <Navbar />
        <div className="pt-20 container py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Navbar />
      
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {user?.name || "User"}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setLocation("/marketplace")}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Browse Marketplace
            </Button>
            {user?.role === "creator" && (
              <Button onClick={() => setLocation("/upload")} variant="default">
                <Upload className="mr-2 h-4 w-4" />
                Upload Vector
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                From {totalVectors} vectors
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCalls.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                API invocations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgRating.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all vectors
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalPurchases} purchases
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="vectors" className="space-y-6">
          <TabsList>
            <TabsTrigger value="vectors">
              <Package className="mr-2 h-4 w-4" />
              My Vectors
            </TabsTrigger>
            <TabsTrigger value="purchases">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Purchases
            </TabsTrigger>
            <TabsTrigger value="transactions">
              <TrendingUp className="mr-2 h-4 w-4" />
              Transactions
            </TabsTrigger>
          </TabsList>

          {/* My Vectors Tab */}
          <TabsContent value="vectors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Latent Vectors</CardTitle>
                <CardDescription>
                  Vectors you've uploaded to the marketplace
                </CardDescription>
              </CardHeader>
              <CardContent>
                {vectorsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                ) : myVectors && myVectors.length > 0 ? (
                  <div className="space-y-4">
                    {myVectors.map((vector) => (
                      <div
                        key={vector.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold">{vector.title}</h3>
                            <Badge variant={vector.status === "active" ? "default" : "secondary"}>
                              {vector.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                            {vector.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {vector.totalCalls} calls
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {Number(vector.averageRating || 0).toFixed(1)}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              ${Number(vector.totalRevenue || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/vector/${vector.id}`)}
                          >
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation(`/vector/${vector.id}/edit`)}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No vectors yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Upload your first latent vector to start earning
                    </p>
                    <Button onClick={() => setLocation("/upload")}>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Vector
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchases Tab */}
          <TabsContent value="purchases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Purchases</CardTitle>
                <CardDescription>
                  Vectors you've purchased and have access to
                </CardDescription>
              </CardHeader>
              <CardContent>
                {purchasesLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : purchases && purchases.length > 0 ? (
                  <div className="space-y-3">
                    {purchases.map((purchase: PurchaseData & { status?: string; createdAt?: string }) => (
                      <div
                        key={purchase.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="font-medium">Purchase #{purchase.id}</h4>
                            <Badge variant={purchase.status === "completed" ? "default" : "secondary"}>
                              {purchase.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            ${Number(purchase.amount).toFixed(2)} �?{new Date(purchase.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/vector/${purchase.vectorId}`)}
                        >
                          <Download className="mr-2 h-3 w-3" />
                          Access
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No purchases yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Browse the marketplace to find vectors
                    </p>
                    <Button onClick={() => setLocation("/marketplace")}>
                      Browse Marketplace
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  All your earnings and purchases
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : transactions && transactions.length > 0 ? (
                  <div className="space-y-2">
                    {transactions.map((txData: TransactionData) => {
                      const tx = txData.transactions || txData;
                      return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {tx.buyerId === user?.id ? (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {tx.buyerId === user?.id ? "Purchase" : "Sale"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${tx.buyerId === user?.id ? "text-red-500" : "text-green-500"}`}>
                            {tx.buyerId === user?.id ? "-" : "+"}${Number(tx.amount).toFixed(2)}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No transactions yet</h3>
                    <p className="text-muted-foreground">
                      Your transaction history will appear here
                    </p>
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
