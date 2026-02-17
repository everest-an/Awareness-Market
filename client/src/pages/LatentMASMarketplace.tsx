import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
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
  Database,
  Shield,
  Zap,
  Filter,
  BarChart3,
  ShoppingCart,
  Upload,
  CheckCircle,
  AlertTriangle,
  Lock,
  Eye,
} from 'lucide-react';

const CERT_BADGES: Record<string, { color: string; label: string }> = {
  platinum: { color: 'bg-purple-500/20 text-purple-300', label: 'Platinum' },
  gold: { color: 'bg-yellow-500/20 text-yellow-300', label: 'Gold' },
  silver: { color: 'bg-slate-400/20 text-slate-300', label: 'Silver' },
  bronze: { color: 'bg-orange-500/20 text-orange-300', label: 'Bronze' },
};

type SortOption = 'recent' | 'epsilon' | 'rating' | 'price';

export default function LatentMASMarketplace() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceModel, setSourceModel] = useState('all');
  const [targetModel, setTargetModel] = useState('all');
  const [certLevel, setCertLevel] = useState('all');
  const [maxEpsilon, setMaxEpsilon] = useState('');
  const [privacyUseCase, setPrivacyUseCase] = useState('research');

  // Browse packages
  const { data: packages, isLoading } = trpc.latentmasMarketplace.browsePackages.useQuery({
    sourceModel: sourceModel !== 'all' ? sourceModel : undefined,
    targetModel: targetModel !== 'all' ? targetModel : undefined,
    certificationLevel: certLevel !== 'all' ? certLevel as any : undefined,
    maxEpsilon: maxEpsilon ? parseFloat(maxEpsilon) : undefined,
  });

  // Marketplace stats
  const { data: stats } = trpc.latentmasMarketplace.getStatistics.useQuery();

  // Privacy recommendations
  const { data: privacyRecs } = trpc.latentmasMarketplace.getRecommendedPrivacySettings.useQuery({
    vectorDimension: 1536,
    category: 'general',
    useCase: privacyUseCase as any,
  });

  const purchaseMutation = trpc.latentmasMarketplace.purchasePackage.useMutation({
    onSuccess: (data: any) => {
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
      } else {
        toast({ title: 'Purchase initiated' });
      }
    },
    onError: (err) => {
      toast({ title: 'Purchase Failed', description: err.message, variant: 'destructive' });
    },
  });

  const validateMutation = trpc.latentmasMarketplace.validatePackage.useMutation({
    onSuccess: (data: any) => {
      if (data.valid) {
        toast({ title: 'Validation Passed', description: 'Package meets quality standards' });
      } else {
        toast({
          title: 'Validation Failed',
          description: data.issues?.join(', ') || 'Package does not meet requirements',
          variant: 'destructive',
        });
      }
    },
    onError: (err) => {
      toast({ title: 'Validation Error', description: err.message, variant: 'destructive' });
    },
  });

  const packageList = (packages as any)?.packages ?? (Array.isArray(packages) ? packages : []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <Navbar />

      <div className="max-w-6xl mx-auto pt-24 px-6 pb-12 space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Database className="h-10 w-10 text-indigo-400" />
            <h1 className="text-3xl md:text-4xl font-bold">LatentMAS Marketplace</h1>
          </div>
          <p className="text-slate-300 max-w-2xl mx-auto mb-4">
            Trade LatentMAS memory packages with differential privacy guarantees,
            Procrustes orthogonality validation, and quality certification.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/50">
              <Lock className="h-3 w-3 mr-1" />
              Differential Privacy
            </Badge>
            <Badge className="bg-green-500/20 text-green-300 border-green-500/50">
              <CheckCircle className="h-3 w-3 mr-1" />
              Quality Certified
            </Badge>
            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/50">
              <Shield className="h-3 w-3 mr-1" />
              Procrustes Validated
            </Badge>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-2xl font-bold text-indigo-400">{(stats as any).totalPackages ?? 0}</div>
              <div className="text-xs text-slate-400">Packages</div>
            </Card>
            <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-2xl font-bold text-green-400">
                {(stats as any).averageEpsilon ? Number((stats as any).averageEpsilon).toFixed(4) : '—'}
              </div>
              <div className="text-xs text-slate-400">Avg Epsilon</div>
            </Card>
            <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {(stats as any).averageRating ? Number((stats as any).averageRating).toFixed(1) : '—'}
              </div>
              <div className="text-xs text-slate-400">Avg Rating</div>
            </Card>
            <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {Object.keys((stats as any).distribution || {}).length}
              </div>
              <div className="text-xs text-slate-400">Cert Levels</div>
            </Card>
          </div>
        )}

        <Tabs defaultValue="browse">
          <TabsList className="bg-slate-900/50">
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="privacy">Privacy Guide</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4 mt-4">
            {/* Filters */}
            <Card className="p-5 bg-slate-900/50 border-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search packages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <Select value={sourceModel} onValueChange={setSourceModel}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Source</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="claude-3">Claude 3</SelectItem>
                    <SelectItem value="llama-3">LLaMA 3</SelectItem>
                    <SelectItem value="qwen-2">Qwen 2</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={certLevel} onValueChange={setCertLevel}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Certification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Cert</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="bronze">Bronze</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  step="0.01"
                  placeholder="Max epsilon"
                  value={maxEpsilon}
                  onChange={(e) => setMaxEpsilon(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </Card>

            {/* Package Grid */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto mb-4" />
                <p className="text-slate-400">Loading packages...</p>
              </div>
            ) : packageList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {packageList
                  .filter((pkg: any) => {
                    if (!searchTerm) return true;
                    const s = searchTerm.toLowerCase();
                    return pkg.name?.toLowerCase().includes(s) || pkg.description?.toLowerCase().includes(s);
                  })
                  .map((pkg: any) => {
                    const cert = CERT_BADGES[pkg.certificationLevel] || CERT_BADGES.bronze;
                    return (
                      <Card
                        key={pkg.id || pkg.packageId}
                        className="p-5 bg-slate-900/50 border-slate-800 hover:border-indigo-500/50 transition-all group"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-white group-hover:text-indigo-400 transition-colors">
                              {pkg.name}
                            </h3>
                            <p className="text-xs text-slate-400 line-clamp-2 mt-1">{pkg.description}</p>
                          </div>
                          <Badge className={`ml-2 text-[10px] ${cert.color}`}>{cert.label}</Badge>
                        </div>

                        {/* Model pair */}
                        <div className="mb-3 p-2 bg-slate-800/30 rounded flex items-center justify-between text-xs">
                          <span className="font-mono text-white">{pkg.sourceModel}</span>
                          <Zap className="h-3 w-3 text-indigo-400" />
                          <span className="font-mono text-white">{pkg.targetModel}</span>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center p-2 bg-slate-800/50 rounded">
                            <div className="text-xs font-bold text-green-400">
                              {pkg.epsilon ? Number(pkg.epsilon).toFixed(4) : '—'}
                            </div>
                            <div className="text-[10px] text-slate-400">Epsilon</div>
                          </div>
                          <div className="text-center p-2 bg-slate-800/50 rounded">
                            <div className="text-xs font-bold text-cyan-400">
                              {pkg.dimension || pkg.sourceDimension || '—'}
                            </div>
                            <div className="text-[10px] text-slate-400">Dims</div>
                          </div>
                          <div className="text-center p-2 bg-slate-800/50 rounded">
                            <div className="text-xs font-bold text-yellow-400">
                              {pkg.informationRetention
                                ? `${(Number(pkg.informationRetention) * 100).toFixed(0)}%`
                                : '—'}
                            </div>
                            <div className="text-[10px] text-slate-400">Retention</div>
                          </div>
                        </div>

                        {/* Privacy badge */}
                        {pkg.differentialPrivacy && (
                          <div className="flex items-center gap-1 mb-3 text-[10px] text-indigo-300">
                            <Lock className="h-3 w-3" />
                            DP enabled (noise: {pkg.differentialPrivacy.noiseMultiplier || '—'})
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                          <div className="text-lg font-bold text-white">
                            ${pkg.price ? Number(pkg.price).toFixed(2) : '—'}
                          </div>
                          <Button
                            size="sm"
                            className="bg-indigo-500 hover:bg-indigo-600"
                            disabled={!isAuthenticated || purchaseMutation.isPending}
                            onClick={() => {
                              if (!isAuthenticated) {
                                setLocation('/auth');
                                return;
                              }
                              purchaseMutation.mutate({
                                packageId: String(pkg.id || pkg.packageId),
                              });
                            }}
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Buy
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No LatentMAS packages found</p>
                <p className="text-sm mt-1">Try adjusting filters or check back later</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="privacy" className="space-y-4 mt-4">
            <Card className="p-5 bg-slate-900/50 border-slate-800">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-indigo-400" />
                  Privacy Settings Guide
                </CardTitle>
                <CardDescription>
                  Recommended differential privacy settings by use case
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0 space-y-4">
                <div className="flex gap-2">
                  {['research', 'enterprise', 'medical'].map((uc) => (
                    <Button
                      key={uc}
                      variant={privacyUseCase === uc ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPrivacyUseCase(uc)}
                      className={privacyUseCase === uc ? 'bg-indigo-500 hover:bg-indigo-600' : ''}
                    >
                      {uc.charAt(0).toUpperCase() + uc.slice(1)}
                    </Button>
                  ))}
                </div>

                {privacyRecs && (
                  <div className="space-y-3">
                    {Object.entries(privacyRecs as Record<string, any>).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-slate-800/50 rounded">
                        <span className="text-sm text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-sm font-mono text-white">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="p-5 bg-slate-900/50 border-slate-800">
              <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Understanding Privacy Guarantees
              </h3>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="p-3 bg-slate-800/30 rounded">
                  <div className="font-medium text-white mb-1">Differential Privacy (DP)</div>
                  <p>Mathematical guarantee that the model's output doesn't reveal individual training data.
                  Lower noise = better quality but less privacy.</p>
                </div>
                <div className="p-3 bg-slate-800/30 rounded">
                  <div className="font-medium text-white mb-1">Procrustes Validation</div>
                  <p>Ensures W-Matrix maintains orthogonality during cross-model transfer,
                  preserving geometric relationships between embeddings.</p>
                </div>
                <div className="p-3 bg-slate-800/30 rounded">
                  <div className="font-medium text-white mb-1">Epsilon (ε)</div>
                  <p>Lower is better. Measures alignment loss during transfer.
                  Platinum: ε &lt; 0.05, Gold: ε &lt; 0.10, Silver: ε &lt; 0.15.</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
