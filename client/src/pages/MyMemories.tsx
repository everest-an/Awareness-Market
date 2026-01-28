import { useState } from "react";
import Navbar from "@/components/Navbar";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { 
  Database, 
  TrendingUp, 
  ShoppingBag, 
  Wallet,
  ExternalLink,
  Download,
  Eye
} from "lucide-react";

export default function MyMemories() {
  const [activeTab, setActiveTab] = useState<"owned" | "created">("owned");

  // Fetch user's purchased packages
  const { data: purchasedPackages, isLoading: purchasesLoading } = trpc.packages.myPurchases.useQuery();

  // Fetch user's created vectors
  const { data: createdVectors, isLoading: creatorsLoading } = trpc.vectors.myVectors.useQuery();

  const ownedMemories = purchasedPackages?.map((pkg: any) => ({
    id: pkg.packageId || pkg.id,
    name: pkg.name || 'Unnamed Package',
    type: pkg.type || 'vector-package',
    certification: 'gold',
    purchasedAt: pkg.purchasedAt || new Date(),
    price: pkg.price || '0',
    usageCount: 0,
  })) || [];

  const createdMemories = createdVectors?.map((vector: any) => ({
    id: vector.id,
    name: vector.title,
    type: vector.vectorType || 'embedding',
    certification: 'silver',
    createdAt: vector.createdAt,
    price: vector.basePrice,
    salesCount: vector.totalCalls || 0,
    revenue: vector.totalRevenue || '0',
  })) || [];

  const getCertificationColor = (cert: string) => {
    switch (cert) {
      case "platinum": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "gold": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "silver": return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
      case "bronze": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "kv-cache": return <Database className="h-4 w-4" />;
      case "w-matrix": return <TrendingUp className="h-4 w-4" />;
      case "reasoning-chain": return <ShoppingBag className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  const isLoading = purchasesLoading || creatorsLoading;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="container mx-auto py-8 mt-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Memories</h1>
        <p className="text-muted-foreground">
          Manage your owned and created memory assets
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Owned Memories</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ownedMemories.length}</div>
            <p className="text-xs text-muted-foreground">
              Total purchased
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Created Memories</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{createdMemories.length}</div>
            <p className="text-xs text-muted-foreground">
              Published for sale
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${ownedMemories.reduce((sum, m) => sum + parseFloat(m.price), 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              On memory purchases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${createdMemories.reduce((sum, m) => sum + parseFloat(m.revenue || "0"), 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              From memory sales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading your memories...</p>
          </CardContent>
        </Card>
      ) : (
        /* Tabs */
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "owned" | "created")}>
          <TabsList>
            <TabsTrigger value="owned">Owned Memories</TabsTrigger>
            <TabsTrigger value="created">Created Memories</TabsTrigger>
          </TabsList>

          <TabsContent value="owned" className="space-y-4">
            {ownedMemories.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No memories owned yet</h3>
                <p className="text-muted-foreground mb-4">
                  Browse the marketplace to purchase your first memory
                </p>
                <Button asChild>
                  <Link href="/memory-marketplace">
                    Browse Marketplace
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ownedMemories.map((memory) => (
                <Card key={memory.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(memory.type)}
                        <CardTitle className="text-lg">{memory.name}</CardTitle>
                      </div>
                      <Badge className={getCertificationColor(memory.certification)}>
                        {memory.certification}
                      </Badge>
                    </div>
                    <CardDescription>
                      Purchased on {memory.purchasedAt.toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Purchase Price</span>
                        <span className="font-semibold">${memory.price}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Usage Count</span>
                        <span className="font-semibold">{memory.usageCount}</span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1" asChild>
                          <Link href={`/memory/${memory.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="created" className="space-y-4">
          {createdMemories.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Database className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No memories created yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create and publish your first memory to start earning
                </p>
                <Button asChild>
                  <Link href="/memory-marketplace">
                    Create Memory
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {createdMemories.map((memory) => (
                <Card key={memory.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(memory.type)}
                        <CardTitle className="text-lg">{memory.name}</CardTitle>
                      </div>
                      <Badge className={getCertificationColor(memory.certification)}>
                        {memory.certification}
                      </Badge>
                    </div>
                    <CardDescription>
                      Created on {memory.createdAt.toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">List Price</span>
                        <span className="font-semibold">${memory.price}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Sales Count</span>
                        <span className="font-semibold">{memory.salesCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Revenue</span>
                        <span className="font-semibold text-green-600">${memory.revenue}</span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1" asChild>
                          <Link href={`/memory/${memory.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Analytics
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        </Tabs>
      )}
      </div>
    </div>
  );
}
