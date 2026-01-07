import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/Navbar';
import {
  Download,
  ShoppingCart,
  Star,
  TrendingUp,
  Database,
  GitBranch,
  Zap,
  Box,
  ArrowLeft,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function PackageDetail() {
  const [, params] = useRoute('/package/:type/:id');
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [purchasing, setPurchasing] = useState(false);

  const packageType = params?.type as 'vector' | 'memory' | 'chain';
  const packageId = params?.id;

  // Fetch package details
  const { data: pkg, isLoading, refetch } = trpc.packages.getPackage.useQuery(
    { packageId: packageId!, packageType },
    { enabled: !!packageId }
  );

  // Purchase mutation
  const purchaseMutation = trpc.packages.purchasePackage.useMutation({
    onSuccess: () => {
      toast.success('Purchase successful!');
      refetch();
      setPurchasing(false);
    },
    onError: (error) => {
      toast.error(`Purchase failed: ${error.message}`);
      setPurchasing(false);
    },
  });

  // Download mutation
  const downloadMutation = trpc.packages.downloadPackage.useMutation({
    onSuccess: (data) => {
      // Trigger download
      window.open(data.downloadUrl, '_blank');
      toast.success('Download started!');
    },
    onError: (error) => {
      toast.error(`Download failed: ${error.message}`);
    },
  });

  const handlePurchase = () => {
    if (!isAuthenticated) {
      toast.error('Please login to purchase');
      return;
    }
    setPurchasing(true);
    purchaseMutation.mutate({
      packageId: packageId!,
      packageType,
    });
  };

  const handleDownload = () => {
    if (!pkg?.hasPurchased) {
      toast.error('Please purchase this package first');
      return;
    }
    downloadMutation.mutate({
      packageId: packageId!,
      packageType,
    });
  };

  const getTypeIcon = () => {
    switch (packageType) {
      case 'vector':
        return <Box className="h-8 w-8 text-cyan-400" />;
      case 'memory':
        return <Database className="h-8 w-8 text-purple-400" />;
      case 'chain':
        return <GitBranch className="h-8 w-8 text-cyan-400" />;
    }
  };

  const getTypeColor = () => {
    switch (packageType) {
      case 'vector':
        return 'cyan';
      case 'memory':
        return 'purple';
      case 'chain':
        return 'cyan';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navbar />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center text-white py-12">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
            <p>Loading package details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navbar />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center text-slate-400 py-12">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Package not found</p>
            <Button
              className="mt-4"
              onClick={() => setLocation(`/${packageType}-packages`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Market
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const typeColor = getTypeColor();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6 text-slate-400 hover:text-white"
          onClick={() => setLocation(`/${packageType}-packages`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Market
        </Button>

        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Main Info */}
          <div className="lg:col-span-2">
            <Card className="p-8 bg-slate-900/50 border-slate-800">
              <div className="flex items-start gap-4 mb-6">
                {getTypeIcon()}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-white">{pkg.name}</h1>
                    <Badge className={`bg-${typeColor}-500 text-white`}>
                      v{pkg.version}
                    </Badge>
                  </div>
                  <p className="text-slate-300 text-lg mb-4">{pkg.description}</p>
                  
                  {/* Creator */}
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span>by</span>
                    <span className="text-white font-semibold">{pkg.creatorName || 'Anonymous'}</span>
                  </div>
                </div>
              </div>

              <Separator className="my-6 bg-slate-800" />

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">{pkg.downloads || 0}</div>
                  <div className="text-xs text-slate-400">Downloads</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400 flex items-center justify-center gap-1">
                    <Star className="h-5 w-5 fill-current" />
                    {pkg.rating ? pkg.rating.toFixed(1) : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-400">Rating</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{pkg.views || 0}</div>
                  <div className="text-xs text-slate-400">Views</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {new Date(pkg.createdAt).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-slate-400">Published</div>
                </div>
              </div>
            </Card>

            {/* Details Tabs */}
            <Card className="mt-6 p-6 bg-slate-900/50 border-slate-800">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-slate-800">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="specs">Specifications</TabsTrigger>
                  <TabsTrigger value="reviews">Reviews</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-6 space-y-4">
                  {/* Model Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Model Compatibility</h3>
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded">
                      <div>
                        <div className="text-sm text-slate-400">Source Model</div>
                        <div className="text-white font-mono">{pkg.sourceModel}</div>
                      </div>
                      <Zap className={`h-5 w-5 text-${typeColor}-400`} />
                      <div>
                        <div className="text-sm text-slate-400">Target Model</div>
                        <div className="text-white font-mono">{pkg.targetModel}</div>
                      </div>
                    </div>
                  </div>

                  {/* Type-specific details */}
                  {packageType === 'vector' && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Vector Details</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Dimension:</span>
                          <span className="text-white">{pkg.dimension || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Distance Metric:</span>
                          <span className="text-white">{pkg.distanceMetric || 'cosine'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {packageType === 'memory' && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Memory Details</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Token Count:</span>
                          <span className="text-white">{pkg.tokenCount || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Compression Ratio:</span>
                          <span className="text-white">{pkg.compressionRatio ? `${(pkg.compressionRatio * 100).toFixed(0)}%` : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Context:</span>
                          <span className="text-white">{pkg.contextDescription || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {packageType === 'chain' && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Chain Details</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Step Count:</span>
                          <span className="text-white">{pkg.stepCount || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Problem Type:</span>
                          <span className="text-white">{pkg.problemType || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Solution Quality:</span>
                          <span className="text-white">{pkg.solutionQuality ? `${(pkg.solutionQuality * 100).toFixed(0)}%` : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {pkg.tags && pkg.tags.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {pkg.tags.map((tag: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="border-slate-700">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="specs" className="mt-6">
                  <div className="text-sm text-slate-400 space-y-2">
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span>Package ID:</span>
                      <span className="text-white font-mono">{pkg.packageId}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span>Version:</span>
                      <span className="text-white">{pkg.version}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span>File Size:</span>
                      <span className="text-white">{pkg.fileSize || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span>Created:</span>
                      <span className="text-white">{new Date(pkg.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span>Last Updated:</span>
                      <span className="text-white">{new Date(pkg.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="reviews" className="mt-6">
                  <div className="text-center text-slate-400 py-8">
                    <Star className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Reviews coming soon!</p>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Purchase Card */}
          <div className="lg:col-span-1">
            <Card className="p-6 bg-slate-900/50 border-slate-800 sticky top-24">
              <div className="mb-6">
                <div className="text-sm text-slate-400 mb-2">Price</div>
                <div className="text-4xl font-bold text-white mb-4">
                  ${pkg.price != null ? pkg.price.toFixed(2) : '0.00'}
                </div>
              </div>

              {pkg.hasPurchased ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-400 bg-green-400/10 p-3 rounded">
                    <Check className="h-5 w-5" />
                    <span className="text-sm font-semibold">You own this package</span>
                  </div>
                  <Button
                    className={`w-full bg-${typeColor}-500 hover:bg-${typeColor}-600 text-white`}
                    onClick={handleDownload}
                    disabled={downloadMutation.isLoading}
                  >
                    {downloadMutation.isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download Package
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  className={`w-full bg-${typeColor}-500 hover:bg-${typeColor}-600 text-white`}
                  onClick={handlePurchase}
                  disabled={purchasing}
                >
                  {purchasing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Purchase Package
                    </>
                  )}
                </Button>
              )}

              <Separator className="my-6 bg-slate-800" />

              {/* Features */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <Check className="h-4 w-4 text-green-400" />
                  <span>Instant download</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Check className="h-4 w-4 text-green-400" />
                  <span>Lifetime access</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Check className="h-4 w-4 text-green-400" />
                  <span>Free updates</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Check className="h-4 w-4 text-green-400" />
                  <span>Commercial use</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
