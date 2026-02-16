import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp, ShoppingCart, Star, ArrowRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useToast } from '@/hooks/use-toast';

export default function WMatrixMarketplace() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'price' | 'sales' | 'rating'>('recent');
  const [sourceModel, setSourceModel] = useState<string>('');
  const [targetModel, setTargetModel] = useState<string>('');

  const { data: listings, isLoading } = trpc.wMatrixMarketplace.listListings.useQuery({
    sortBy,
    sourceModel: sourceModel || undefined,
    targetModel: targetModel || undefined,
    search: searchTerm || undefined,
    limit: 20,
    offset: 0,
  });

  const { data: popularPairs } = trpc.wMatrixMarketplace.getPopularModelPairs.useQuery();

  const purchaseMutation = trpc.wMatrixMarketplace.purchaseListing.useMutation({
    onSuccess: () => {
      toast({
        title: 'Purchase Successful',
        description: 'W-Matrix has been added to your collection',
      });
    },
    onError: (error) => {
      toast({
        title: 'Purchase Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const checkoutMutation = trpc.wMatrixMarketplace.createCheckout.useMutation({
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (error) => {
      toast({
        title: 'Checkout Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const finalizeMutation = trpc.wMatrixMarketplace.finalizeCheckout.useMutation({
    onSuccess: () => {
      toast({
        title: 'Purchase Successful',
        description: 'Your W-Matrix purchase has been completed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Checkout Verification Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handlePurchase = async (listingId: number) => {
    checkoutMutation.mutate({
      listingId,
      successUrl: `${window.location.origin}/w-matrix-marketplace?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/w-matrix-marketplace?canceled=true`,
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      finalizeMutation.mutate({ sessionId });
      params.delete('session_id');
      setLocation(`/w-matrix-marketplace?${params.toString()}`);
    }
  }, [finalizeMutation, setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="pt-20 container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            W-Matrix Marketplace
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Pre-trained alignment matrices for seamless cross-model communication. Buy once, use forever.
          </p>
        </div>

        {/* Popular Model Pairs */}
        {popularPairs && popularPairs.length > 0 && (
          <Card className="p-6 mb-8 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Popular Model Pairs</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {popularPairs.map((pair, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSourceModel(pair.sourceModel);
                    setTargetModel(pair.targetModel);
                  }}
                  className="text-sm"
                >
                  {pair.sourceModel} �?{pair.targetModel}
                  <Badge variant="secondary" className="ml-2">{pair.count}</Badge>
                </Button>
              ))}
            </div>
          </Card>
        )}

        {/* Search and Filters */}
        <Card className="p-6 mb-8 bg-slate-900/50 border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search W-Matrices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={sourceModel} onValueChange={setSourceModel}>
              <SelectTrigger>
                <SelectValue placeholder="Source Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Source Models</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="claude-3-opus">Claude-3 Opus</SelectItem>
                <SelectItem value="llama-3-70b">LLaMA-3 70B</SelectItem>
              </SelectContent>
            </Select>

            <Select value={targetModel} onValueChange={setTargetModel}>
              <SelectTrigger>
                <SelectValue placeholder="Target Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Target Models</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                <SelectItem value="claude-3-sonnet">Claude-3 Sonnet</SelectItem>
                <SelectItem value="embedding-3-large">Embedding-3 Large</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="price">Price: Low to High</SelectItem>
                <SelectItem value="sales">Most Popular</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Listings Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
            <p className="text-slate-400 mt-4">Loading W-Matrices...</p>
          </div>
        ) : listings && listings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <Card key={listing.id} className="p-6 bg-slate-900/50 border-slate-800 hover:border-cyan-700/50 transition-all">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white mb-2">{listing.title}</h3>
                  <p className="text-sm text-slate-400 line-clamp-2">{listing.description}</p>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Model Pair:</span>
                    <span className="text-cyan-400 font-mono text-xs">
                      {listing.sourceModel} �?{listing.targetModel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Dimensions:</span>
                    <span className="text-white">{listing.sourceDimension} �?{listing.targetDimension}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Alignment Loss:</span>
                    <Badge variant="secondary" className="bg-green-900/30 text-green-400">
                      {parseFloat(listing.epsilon.toString()).toFixed(4)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Sales:</span>
                    <span className="text-white">{listing.downloads}</span>
                  </div>

                  {listing.avgRating && parseFloat(listing.avgRating.toString()) > 0 && (
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-white">{parseFloat(listing.avgRating.toString()).toFixed(1)}</span>
                      <span className="text-slate-400 text-sm">({listing.reviewCount} reviews)</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <div>
                    <div className="text-2xl font-bold text-white">${parseFloat(listing.price.toString()).toFixed(2)}</div>
                    <div className="text-xs text-slate-400">One-time purchase</div>
                  </div>
                  <Button
                    onClick={() => handlePurchase(listing.id)}
                    disabled={purchaseMutation.isPending}
                    className="bg-cyan-600 hover:bg-cyan-700"
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Buy Now
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 bg-slate-900/50 border-slate-800 text-center">
            <p className="text-slate-400 text-lg">No W-Matrices found matching your criteria.</p>
            <Button variant="outline" className="mt-4" onClick={() => {
              setSourceModel('');
              setTargetModel('');
              setSearchTerm('');
            }}>
              Clear Filters
            </Button>
          </Card>
        )}

        {/* Call to Action */}
        <Card className="mt-12 p-8 bg-gradient-to-br from-cyan-900/20 to-purple-900/20 border-cyan-700/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Want to sell your W-Matrix?</h2>
              <p className="text-slate-300">
                Train and publish your own alignment matrices to earn passive income.
              </p>
            </div>
            <Link href="/dashboard">
              <Button className="bg-cyan-600 hover:bg-cyan-700">
                Start Selling
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
