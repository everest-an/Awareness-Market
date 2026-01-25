import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/Navbar';
import { 
  Cpu, 
  Database, 
  GitBranch, 
  Download, 
  ShoppingCart, 
  Star, 
  Zap, 
  Brain,
  ArrowLeft,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { useState } from 'react';

export default function PackageDetail() {
  const params = useParams<{ type: string; id: string }>();
  const type = params.type as 'vector' | 'memory' | 'chain';
  const packageId = params.id;
  const [purchasing, setPurchasing] = useState(false);

  // Fetch package details
  const { data: pkg, isLoading, refetch } = trpc.packages.getPackage.useQuery({
    packageType: type,
    packageId: packageId || '',
  }, {
    enabled: !!packageId,
  });

  // Check if user has purchased this package
  const { data: purchasesData } = trpc.packages.myPurchases.useQuery({ packageType: type }, {
    retry: false,
  });
  const hasPurchased = purchasesData?.purchases?.some(
    (p: any) => p.packageId === packageId && p.packageType === type
  );

  // Purchase mutation
  const purchaseMutation = trpc.packages.purchasePackage.useMutation({
    onSuccess: () => {
      toast.success('Package purchased successfully!');
      refetch();
    },
    onError: (error) => {
      toast.error(`Purchase failed: ${error.message}`);
      setPurchasing(false);
    },
  });

  // Download - trigger via tRPC useUtils fetch
  const trpcUtils = trpc.useUtils();
  const handleDownload = async () => {
    if (!packageId) return;
    try {
      // Call the download endpoint to get package URL
      const result = await trpcUtils.packages.downloadPackage.fetch({
        packageType: type,
        packageId,
      });
      if (result?.packageUrl) {
        window.open(result.packageUrl, '_blank');
        toast.success('Download started!');
      }
    } catch (error: any) {
      toast.error(`Download failed: ${error.message}`);
    }
  };

  const handlePurchase = async () => {
    if (!packageId) return;
    setPurchasing(true);
    try {
      await purchaseMutation.mutateAsync({
        packageType: type,
        packageId,
      });
    } finally {
      setPurchasing(false);
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'vector': return <Cpu className="h-8 w-8 text-cyan-400" />;
      case 'memory': return <Database className="h-8 w-8 text-purple-400" />;
      case 'chain': return <GitBranch className="h-8 w-8 text-emerald-400" />;
    }
  };

  const getTypeColor = () => {
    switch (type) {
      case 'vector': return 'cyan';
      case 'memory': return 'purple';
      case 'chain': return 'emerald';
    }
  };

  const getBackLink = () => {
    switch (type) {
      case 'vector': return '/vector-packages';
      case 'memory': return '/memory-packages';
      case 'chain': return '/chain-packages';
    }
  };

  const getTypeName = () => {
    switch (type) {
      case 'vector': return 'Vector Package';
      case 'memory': return 'Memory Package';
      case 'chain': return 'Chain Package';
    }
  };

  // Extract the actual package from the API response
  const packageData = pkg?.package as any;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading package details...</p>
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-white text-xl">Package not found</p>
          <Link href={getBackLink()}>
            <Button className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const color = getTypeColor();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Back Link */}
        <Link href={getBackLink()}>
          <Button variant="ghost" className="mb-6 text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {type.charAt(0).toUpperCase() + type.slice(1)} Marketplace
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <Card className="p-8 bg-slate-900/50 border-slate-800">
              <div className="flex items-start gap-4 mb-6">
                {getTypeIcon()}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-white">{packageData.name}</h1>
                    <Badge className={`bg-${color}-500 text-white`}>
                      {getTypeName()}
                    </Badge>
                  </div>
                  <p className="text-slate-400">{packageData.description}</p>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-slate-800/50 rounded">
                  <div className="text-2xl font-bold text-white">{packageData.downloads || 0}</div>
                  <div className="text-xs text-slate-400">Downloads</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                    <span className="text-2xl font-bold text-white">
                      {packageData.rating ? Number(packageData.rating).toFixed(1) : 'N/A'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">Rating</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded">
                  <div className="text-2xl font-bold text-white">{packageData.reviewCount || 0}</div>
                  <div className="text-xs text-slate-400">Reviews</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded">
                  <div className="text-2xl font-bold text-white">v{packageData.version || '1.0.0'}</div>
                  <div className="text-xs text-slate-400">Version</div>
                </div>
              </div>
            </Card>

            {/* Model Transfer Info */}
            <Card className="p-6 bg-slate-900/50 border-slate-800">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className={`h-5 w-5 text-${color}-400`} />
                Model Transfer
              </h2>
              <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded">
                <div className="text-center">
                  <div className="text-sm text-slate-400">Source Model</div>
                  <div className="text-lg font-mono text-white">{packageData.sourceModel}</div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="h-px bg-slate-700 flex-1 mx-4"></div>
                  <Zap className={`h-6 w-6 text-${color}-400`} />
                  <div className="h-px bg-slate-700 flex-1 mx-4"></div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-400">Target Model</div>
                  <div className="text-lg font-mono text-white">{packageData.targetModel}</div>
                </div>
              </div>
            </Card>

            {/* W-Matrix Quality */}
            <Card className="p-6 bg-slate-900/50 border-slate-800">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Brain className={`h-5 w-5 text-${color}-400`} />
                W-Matrix Quality Metrics
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800/30 rounded">
                  <div className="text-sm text-slate-400 mb-1">Epsilon (ε)</div>
                  <div className="text-2xl font-bold text-white">
                    {packageData.epsilon ? Number(packageData.epsilon).toFixed(4) : '0.0000'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Lower is better (alignment loss)</div>
                </div>
                <div className="p-4 bg-slate-800/30 rounded">
                  <div className="text-sm text-slate-400 mb-1">Information Retention</div>
                  <div className="text-2xl font-bold text-green-400">
                    {((packageData.informationRetention || 0.85) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Higher is better</div>
                </div>
              </div>
            </Card>

            {/* Type-Specific Info */}
            <Card className="p-6 bg-slate-900/50 border-slate-800">
              <h2 className="text-xl font-semibold text-white mb-4">
                {type === 'vector' && '�?Vector Details'}
                {type === 'memory' && '💾 Memory Details'}
                {type === 'chain' && '🔗 Chain Details'}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {type === 'vector' && (
                  <>
                    <div className="p-4 bg-slate-800/30 rounded">
                      <div className="text-sm text-slate-400 mb-1">Dimension</div>
                      <div className="text-xl font-bold text-cyan-400">{packageData.dimension || 768}</div>
                    </div>
                    <div className="p-4 bg-slate-800/30 rounded">
                      <div className="text-sm text-slate-400 mb-1">Category</div>
                      <div className="text-xl font-bold text-white capitalize">{packageData.category || 'nlp'}</div>
                    </div>
                  </>
                )}
                {type === 'memory' && (
                  <>
                    <div className="p-4 bg-slate-800/30 rounded">
                      <div className="text-sm text-slate-400 mb-1">Token Count</div>
                      <div className="text-xl font-bold text-purple-400">{packageData.tokenCount || 0}</div>
                    </div>
                    <div className="p-4 bg-slate-800/30 rounded">
                      <div className="text-sm text-slate-400 mb-1">Compression Ratio</div>
                      <div className="text-xl font-bold text-green-400">
                        {((packageData.compressionRatio || 0) * 100).toFixed(0)}%
                      </div>
                    </div>
                    {packageData.contextDescription && (
                      <div className="col-span-2 p-4 bg-slate-800/30 rounded">
                        <div className="text-sm text-slate-400 mb-1">Context Description</div>
                        <div className="text-white">{packageData.contextDescription}</div>
                      </div>
                    )}
                  </>
                )}
                {type === 'chain' && (
                  <>
                    <div className="p-4 bg-slate-800/30 rounded">
                      <div className="text-sm text-slate-400 mb-1">Step Count</div>
                      <div className="text-xl font-bold text-emerald-400">{packageData.stepCount || 0}</div>
                    </div>
                    <div className="p-4 bg-slate-800/30 rounded">
                      <div className="text-sm text-slate-400 mb-1">Problem Type</div>
                      <div className="text-xl font-bold text-white capitalize">
                        {packageData.problemType?.replace('-', ' ') || 'general'}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-800/30 rounded">
                      <div className="text-sm text-slate-400 mb-1">Solution Quality</div>
                      <div className="text-xl font-bold text-green-400">
                        {((packageData.solutionQuality || 0) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Purchase Card */}
            <Card className="p-6 bg-slate-900/50 border-slate-800 sticky top-6">
              <div className="text-center mb-6">
                <div className="text-sm text-slate-400 mb-1">Price</div>
                <div className="text-4xl font-bold text-white">
                  ${Number(packageData.price).toFixed(2)}
                </div>
              </div>

              {hasPurchased ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-green-400 mb-4">
                    <CheckCircle className="h-5 w-5" />
                    <span>Purchased</span>
                  </div>
                  <Button 
                    className={`w-full bg-${color}-500 hover:bg-${color}-600 text-white`}
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Package
                  </Button>
                </div>
              ) : (
                <Button 
                  className={`w-full bg-${color}-500 hover:bg-${color}-600 text-white`}
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
                      Purchase Now
                    </>
                  )}
                </Button>
              )}

              <div className="mt-6 pt-6 border-t border-slate-800">
                <div className="text-sm text-slate-400 space-y-2">
                  <div className="flex justify-between">
                    <span>Package Type</span>
                    <span className="text-white capitalize">{type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>File Format</span>
                    <span className="text-white">.{type}pkg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>License</span>
                    <span className="text-white">Commercial</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Creator Info */}
            <Card className="p-6 bg-slate-900/50 border-slate-800">
              <h3 className="text-lg font-semibold text-white mb-4">Creator</h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                  <span className="text-xl text-white">
                    {(packageData as any)?.creator?.name?.[0] || 'A'}
                  </span>
                </div>
                <div>
                  <div className="text-white font-medium">
                    {(packageData as any)?.creator?.name || 'Anonymous'}
                  </div>
                  <div className="text-sm text-slate-400">Package Creator</div>
                </div>
              </div>
            </Card>

            {/* Tags */}
            {packageData?.tags && (
              <Card className="p-6 bg-slate-900/50 border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {(typeof packageData.tags === 'string' ? packageData.tags.split(',') : packageData.tags).map((tag: string, i: number) => (
                    <Badge key={i} variant="outline" className="border-slate-700 text-slate-300">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
