import SEO from "@/components/SEO";
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/Navbar';
import {
  Search,
  TrendingUp,
  Database,
  Zap,
  Filter,
  Upload,
} from 'lucide-react';

interface MemoryPackage {
  id: number;
  packageId: string;
  name: string;
  description: string;
  version?: string;
  tokenCount?: number;
  compressionRatio?: number;
  rating?: number | string;
  sourceModel?: string;
  targetModel?: string;
  price: number | string;
  downloads?: number;
  contextDescription?: string;
}

type SortOption = 'recent' | 'popular' | 'price_asc' | 'price_desc' | 'rating';

export default function MemoryMarketplace() {
  const { isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [sourceModel, setSourceModel] = useState<string>('all');

  // Fetch memory packages using new unified API
  const { data: packages, isLoading } = trpc.packages.browsePackages.useQuery({
    packageType: 'memory',
    sortBy,
    sourceModel: sourceModel === 'all' ? undefined : sourceModel,
    search: searchTerm || undefined,
    limit: 20,
    offset: 0,
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Featured = top 3 from real query, or hardcoded examples as fallback when DB is empty
  const realFeatured = (packages?.packages || [])
    .slice()
    .sort((a: any, b: any) => (b.downloads || 0) - (a.downloads || 0))
    .slice(0, 3);

  const featuredCases = realFeatured.length > 0 ? realFeatured : [
    {
      id: 1,
      packageId: 'case-legal-review',
      name: 'Legal Reasoning Continuation',
      description: 'Transfer multi-step contract analysis from GPT-4 to Claude for follow-up negotiation and compliance checks.',
      version: '1.3.0',
      tokenCount: 180000,
      compressionRatio: 0.92,
      rating: 4.8,
      price: 29.0,
      sourceModel: 'gpt-4',
      targetModel: 'claude-3',
      downloads: 1200,
      contextDescription: 'Enterprise contract review and risk analysis',
    },
    {
      id: 2,
      packageId: 'case-research-synthesis',
      name: 'Research Synthesis Memory',
      description: 'Carry over a 40-page literature synthesis into a new model without losing citations or reasoning structure.',
      version: '2.1.0',
      tokenCount: 240000,
      compressionRatio: 0.95,
      rating: 4.9,
      price: 45.0,
      sourceModel: 'claude-3',
      targetModel: 'gpt-4',
      downloads: 980,
      contextDescription: 'Academic literature review and hypothesis mapping',
    },
    {
      id: 3,
      packageId: 'case-product-design',
      name: 'Product Strategy Memory',
      description: 'Move a complete product discovery process across models for roadmap planning and stakeholder alignment.',
      version: '1.0.4',
      tokenCount: 150000,
      compressionRatio: 0.9,
      rating: 4.7,
      price: 24.0,
      sourceModel: 'llama-3',
      targetModel: 'qwen-2',
      downloads: 740,
      contextDescription: 'Product discovery, market sizing, and roadmap planning',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <SEO title="Memory Package Marketplace" description="Trade KV-Cache memory packages for AI models. Transfer complete reasoning states between models using latent memory exchange technology." path="/memory-marketplace" />
      <Navbar />

      <div className="pt-20 container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Database className="h-12 w-12 text-purple-400" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Memory Marketplace
            </h1>
          </div>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-6">
            Trade AI memories with KV-Cache. Direct memory transplant between models with W-Matrix transformation.
          </p>
          {isAuthenticated && (
            <Link href="/upload-memory-package">
              <Button className="bg-purple-500 hover:bg-purple-600 text-white">
                <Upload className="h-4 w-4 mr-2" />
                Upload Memory Package
              </Button>
            </Link>
          )}
        </div>

        {/* Stats */}
        {packages?.packages && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-purple-400 mb-2">{packages.packages.length}</div>
              <div className="text-sm text-slate-400">Available Memories</div>
            </Card>
            <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-cyan-400 mb-2">
                {packages.packages.reduce((sum: number, pkg: MemoryPackage) => sum + (pkg.downloads || 0), 0)}
              </div>
              <div className="text-sm text-slate-400">Total Downloads</div>
            </Card>
            <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">
                {packages.packages.length > 0 
                  ? (packages.packages.reduce((sum: number, pkg: MemoryPackage) => sum + (Number(pkg.rating) || 0), 0) / packages.packages.length).toFixed(1)
                  : '0.0'}
              </div>
              <div className="text-sm text-slate-400">Average Rating</div>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card className="p-6 mb-8 bg-slate-900/50 border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search memory packages..."
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
                <SelectItem value="all">All Models</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="claude-3">Claude 3</SelectItem>
                <SelectItem value="llama-3">LLaMA 3</SelectItem>
                <SelectItem value="qwen-2">Qwen 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Filter className="h-4 w-4" />
              <span>Sort by:</span>
            </div>
            <div className="flex gap-2">
              {[
                { value: 'recent', label: 'Newest' },
                { value: 'popular', label: 'Popular' },
                { value: 'price_asc', label: 'Cheapest' },
                { value: 'rating', label: 'Top Rated' },
              ].map((sort) => (
                <Button
                  key={sort.value}
                  variant={sortBy === sort.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy(sort.value as SortOption)}
                  className={sortBy === sort.value ? 'bg-purple-500 hover:bg-purple-600' : ''}
                >
                  {sort.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Memory Package Grid */}
        {isLoading ? (
          <div className="text-center text-white py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p>Loading memory packages...</p>
          </div>
        ) : packages?.packages && packages.packages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.packages.map((pkg: MemoryPackage) => (
              <Link key={pkg.id} href={`/package/memory/${pkg.packageId}`}>
                <Card className="p-6 bg-slate-900/50 border-slate-800 hover:border-purple-500 transition-all cursor-pointer group h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors mb-1">
                        {pkg.name}
                      </h3>
                      <p className="text-sm text-slate-400 line-clamp-2">{pkg.description}</p>
                    </div>
                    <Badge className="bg-purple-500 text-white ml-2">
                      v{pkg.version}
                    </Badge>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <div className="text-sm font-bold text-cyan-400">
                        {formatNumber(pkg.tokenCount || 0)}
                      </div>
                      <div className="text-xs text-slate-400">Tokens</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <div className="text-sm font-bold text-green-400">
                        {((pkg.compressionRatio || 0) * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-slate-400">Compression</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <div className="text-sm font-bold text-yellow-400">
                        {pkg.rating ? parseFloat(String(pkg.rating)).toFixed(1) : 'N/A'}
                      </div>
                      <div className="text-xs text-slate-400">Rating</div>
                    </div>
                  </div>

                  {/* Model Info */}
                  <div className="mb-4 p-3 bg-slate-800/30 rounded">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400">From:</span>
                        <span className="text-white ml-1 font-mono">{pkg.sourceModel}</span>
                      </div>
                      <Zap className="h-3 w-3 text-purple-400" />
                      <div>
                        <span className="text-slate-400">To:</span>
                        <span className="text-white ml-1 font-mono">{pkg.targetModel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Context Description */}
                  {pkg.contextDescription && (
                    <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                      💭 {pkg.contextDescription}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div>
                      <div className="text-xs text-slate-400">Price</div>
                      <div className="text-lg font-bold text-white">
                        ${Number(pkg.price).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Downloads</div>
                      <div className="text-sm font-semibold text-purple-400">
                        {formatNumber(pkg.downloads || 0)}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            <div className="text-center text-slate-400 py-6">
              <Database className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No memory packages found</p>
              <p className="text-sm mt-2">Here are featured memory market cases to explore.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Featured Memory Cases</h2>
                <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20">Examples</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredCases.map((pkg) => (
                  <Card key={pkg.id} className="p-6 bg-slate-900/50 border-slate-800 hover:border-purple-500 transition-all group h-full">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors mb-1">
                          {pkg.name}
                        </h3>
                        <p className="text-sm text-slate-400 line-clamp-2">{pkg.description}</p>
                      </div>
                      <Badge className="bg-purple-500 text-white ml-2">v{pkg.version}</Badge>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center p-2 bg-slate-800/50 rounded">
                        <div className="text-sm font-bold text-cyan-400">{formatNumber(pkg.tokenCount)}</div>
                        <div className="text-xs text-slate-400">Tokens</div>
                      </div>
                      <div className="text-center p-2 bg-slate-800/50 rounded">
                        <div className="text-sm font-bold text-green-400">{Math.round(pkg.compressionRatio * 100)}%</div>
                        <div className="text-xs text-slate-400">Compression</div>
                      </div>
                      <div className="text-center p-2 bg-slate-800/50 rounded">
                        <div className="text-sm font-bold text-yellow-400">{parseFloat(String(pkg.rating)).toFixed(1)}</div>
                        <div className="text-xs text-slate-400">Rating</div>
                      </div>
                    </div>

                    {/* Model Info */}
                    <div className="mb-4 p-3 bg-slate-800/30 rounded">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-400">From:</span>
                          <span className="text-white ml-1 font-mono">{pkg.sourceModel}</span>
                        </div>
                        <Zap className="h-3 w-3 text-purple-400" />
                        <div>
                          <span className="text-slate-400">To:</span>
                          <span className="text-white ml-1 font-mono">{pkg.targetModel}</span>
                        </div>
                      </div>
                    </div>

                    {/* Context Description */}
                    {pkg.contextDescription && (
                      <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                        💭 {pkg.contextDescription}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                      <div>
                        <div className="text-xs text-slate-400">Price</div>
                        <div className="text-lg font-bold text-white">${pkg.price.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Downloads</div>
                        <div className="text-sm font-semibold text-purple-400">{formatNumber(pkg.downloads)}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {isAuthenticated && (
              <div className="text-center">
                <Link href="/upload-memory-package">
                  <Button className="bg-purple-500 hover:bg-purple-600">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Memory Package
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
