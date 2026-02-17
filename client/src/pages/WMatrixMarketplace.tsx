import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Box,
  Zap,
  Filter,
  TrendingUp,
  Award,
  ArrowRight,
  ShoppingCart,
  BarChart3,
  Upload,
} from 'lucide-react';

type SortOption = 'recent' | 'price' | 'sales' | 'rating';

const CERT_COLORS: Record<string, string> = {
  platinum: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  gold: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  silver: 'bg-slate-400/20 text-slate-300 border-slate-400/30',
  bronze: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

export default function WMatrixMarketplace() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceModel, setSourceModel] = useState('all');
  const [targetModel, setTargetModel] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const { data: listings, isLoading } = trpc.wMatrixMarketplace.listListings.useQuery({
    sourceModel: sourceModel !== 'all' ? sourceModel : undefined,
    targetModel: targetModel !== 'all' ? targetModel : undefined,
    search: searchTerm || undefined,
    sortBy,
    limit: 20,
    offset: 0,
  });

  const { data: popularPairs } = trpc.wMatrixMarketplace.getPopularModelPairs.useQuery();
  const { data: certStats } = trpc.wMatrixMarketplace.getCertificationStats.useQuery();
  const { data: myPurchases } = trpc.wMatrixMarketplace.myPurchases.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const checkoutMutation = trpc.wMatrixMarketplace.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (err) => {
      toast({ title: 'Purchase Failed', description: err.message, variant: 'destructive' });
    },
  });

  const items = (listings as any)?.listings ?? listings ?? [];
  const itemsList = Array.isArray(items) ? items : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <Navbar />

      <div className="max-w-6xl mx-auto pt-24 px-6 pb-12 space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Box className="h-10 w-10 text-purple-400" />
            <h1 className="text-3xl md:text-4xl font-bold">W-Matrix Marketplace</h1>
          </div>
          <p className="text-slate-300 max-w-2xl mx-auto mb-4">
            Trade cross-model alignment matrices. W-Matrices enable direct knowledge transfer between different AI models.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50">
              <Zap className="h-3 w-3 mr-1" />
              Cross-Model Alignment
            </Badge>
            <Badge className="bg-green-500/20 text-green-300 border-green-500/50">
              <Award className="h-3 w-3 mr-1" />
              Quality Certified
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
            <div className="text-2xl font-bold text-purple-400">{itemsList.length}</div>
            <div className="text-xs text-slate-400">W-Matrices</div>
          </Card>
          <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
            <div className="text-2xl font-bold text-cyan-400">{popularPairs?.length ?? 0}</div>
            <div className="text-xs text-slate-400">Model Pairs</div>
          </Card>
          <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
            <div className="text-2xl font-bold text-green-400">
              {certStats?.averageEpsilon ? Number(certStats.averageEpsilon).toFixed(4) : '—'}
            </div>
            <div className="text-xs text-slate-400">Avg Epsilon</div>
          </Card>
          <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
            <div className="text-2xl font-bold text-yellow-400">{myPurchases?.length ?? 0}</div>
            <div className="text-xs text-slate-400">My Purchases</div>
          </Card>
        </div>

        {/* Popular Model Pairs */}
        {popularPairs && popularPairs.length > 0 && (
          <Card className="p-5 bg-slate-900/50 border-slate-800">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
              Popular Model Pairs
            </h3>
            <div className="flex flex-wrap gap-2">
              {popularPairs.map((pair: any) => (
                <Button
                  key={`${pair.sourceModel}-${pair.targetModel}`}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSourceModel(pair.sourceModel);
                    setTargetModel(pair.targetModel);
                  }}
                  className="text-xs"
                >
                  {pair.sourceModel} <ArrowRight className="h-3 w-3 mx-1" /> {pair.targetModel}
                  <Badge className="ml-2 text-[10px]">{pair.count}</Badge>
                </Button>
              ))}
            </div>
          </Card>
        )}

        <Tabs defaultValue="browse">
          <TabsList className="bg-slate-900/50">
            <TabsTrigger value="browse">Browse</TabsTrigger>
            {isAuthenticated && <TabsTrigger value="my-purchases">My Purchases</TabsTrigger>}
          </TabsList>

          <TabsContent value="browse" className="space-y-4 mt-4">
            {/* Filters */}
            <Card className="p-5 bg-slate-900/50 border-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search W-Matrices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <Select value={sourceModel} onValueChange={setSourceModel}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Source Model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Source</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="claude-3">Claude 3</SelectItem>
                    <SelectItem value="llama-3">LLaMA 3</SelectItem>
                    <SelectItem value="qwen-2">Qwen 2</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={targetModel} onValueChange={setTargetModel}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Target Model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Target</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="claude-3">Claude 3</SelectItem>
                    <SelectItem value="llama-3">LLaMA 3</SelectItem>
                    <SelectItem value="qwen-2">Qwen 2</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Filter className="h-4 w-4" />
                  <span>Sort:</span>
                </div>
                <div className="flex gap-2">
                  {[
                    { value: 'recent', label: 'Newest' },
                    { value: 'price', label: 'Price' },
                    { value: 'sales', label: 'Sales' },
                    { value: 'rating', label: 'Rating' },
                  ].map((s) => (
                    <Button
                      key={s.value}
                      variant={sortBy === s.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSortBy(s.value as SortOption)}
                      className={sortBy === s.value ? 'bg-purple-500 hover:bg-purple-600' : ''}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Listings Grid */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-4" />
                <p className="text-slate-400">Loading W-Matrices...</p>
              </div>
            ) : itemsList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {itemsList.map((listing: any) => (
                  <Card
                    key={listing.id}
                    className="p-5 bg-slate-900/50 border-slate-800 hover:border-purple-500/50 transition-all group"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-white group-hover:text-purple-400 transition-colors">
                          {listing.title}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">{listing.description}</p>
                      </div>
                      {listing.certificationLevel && (
                        <Badge className={`ml-2 text-[10px] ${CERT_COLORS[listing.certificationLevel] || ''}`}>
                          {listing.certificationLevel}
                        </Badge>
                      )}
                    </div>

                    {/* Model Pair */}
                    <div className="mb-3 p-3 bg-slate-800/30 rounded">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-400">From:</span>
                          <span className="text-white ml-1 font-mono">{listing.sourceModel}</span>
                        </div>
                        <Zap className="h-3 w-3 text-purple-400" />
                        <div>
                          <span className="text-slate-400">To:</span>
                          <span className="text-white ml-1 font-mono">{listing.targetModel}</span>
                        </div>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center p-2 bg-slate-800/50 rounded">
                        <div className="text-xs font-bold text-green-400">
                          {listing.alignmentLoss ? Number(listing.alignmentLoss).toFixed(4) : '—'}
                        </div>
                        <div className="text-[10px] text-slate-400">Epsilon</div>
                      </div>
                      <div className="text-center p-2 bg-slate-800/50 rounded">
                        <div className="text-xs font-bold text-cyan-400">
                          {listing.sourceDim || '—'}x{listing.targetDim || '—'}
                        </div>
                        <div className="text-[10px] text-slate-400">Dimensions</div>
                      </div>
                      <div className="text-center p-2 bg-slate-800/50 rounded">
                        <div className="text-xs font-bold text-yellow-400">
                          {listing.totalSales ?? 0}
                        </div>
                        <div className="text-[10px] text-slate-400">Sales</div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <div>
                        <div className="text-xs text-slate-400">Price</div>
                        <div className="text-lg font-bold text-white">
                          ${listing.dynamicPrice ? Number(listing.dynamicPrice).toFixed(2) : Number(listing.price || 0).toFixed(2)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-purple-500 hover:bg-purple-600"
                        disabled={!isAuthenticated || checkoutMutation.isPending}
                        onClick={() => {
                          if (!isAuthenticated) return;
                          checkoutMutation.mutate({
                            listingId: listing.id,
                            successUrl: `${window.location.origin}/w-matrix-market?status=success`,
                            cancelUrl: `${window.location.origin}/w-matrix-market?status=cancelled`,
                          });
                        }}
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Buy
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Box className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No W-Matrices found</p>
                <p className="text-sm mt-1">Try adjusting your filters or check back later</p>
              </div>
            )}
          </TabsContent>

          {isAuthenticated && (
            <TabsContent value="my-purchases" className="mt-4">
              {myPurchases && myPurchases.length > 0 ? (
                <div className="space-y-3">
                  {myPurchases.map((purchase: any) => (
                    <Card key={purchase.id} className="p-4 bg-slate-900/50 border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-white">
                            {purchase.listing?.title || `W-Matrix #${purchase.listingId}`}
                          </h4>
                          <div className="text-xs text-slate-400 mt-1">
                            {purchase.listing?.sourceModel} → {purchase.listing?.targetModel}
                            &nbsp;&middot;&nbsp;
                            Purchased {new Date(purchase.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge className="bg-green-500/20 text-green-300">Purchased</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No purchases yet</p>
                  <p className="text-sm mt-1">Browse the marketplace to find W-Matrices for your models</p>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* Certification Stats */}
        {certStats && (
          <Card className="p-5 bg-slate-900/50 border-slate-800">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Marketplace Quality
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(certStats.certificationDistribution || {}).map(([level, count]) => (
                <div key={level} className="text-center p-3 bg-slate-800/50 rounded">
                  <Badge className={`mb-2 ${CERT_COLORS[level] || ''}`}>{level}</Badge>
                  <div className="text-lg font-bold text-white">{count as number}</div>
                  <div className="text-[10px] text-slate-400">matrices</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
