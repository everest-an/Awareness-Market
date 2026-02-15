import { useState } from 'react';
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
  GitBranch,
  Zap,
  Filter,
  Upload,
  Brain,
} from 'lucide-react';

interface ReasoningChainPackage {
  id: number;
  packageId: string;
  name: string;
  description: string;
  version?: string;
  problemType?: string;
  stepCount?: number;
  solutionQuality?: number;
  rating?: number | string;
  sourceModel?: string;
  targetModel?: string;
  price: number | string;
  downloads?: number;
}

type SortOption = 'recent' | 'popular' | 'price_asc' | 'price_desc' | 'rating';

const REASONING_CATEGORIES = [
  'math',
  'coding',
  'analysis',
  'research',
  'creative',
  'logic',
  'science',
  'business',
];

export default function ReasoningChainMarket() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [sourceModel, setSourceModel] = useState<string>('all');
  const [problemType, setProblemType] = useState<string>('all');

  // Fetch chain packages using new unified API
  const { data: packages, isLoading } = trpc.packages.browsePackages.useQuery({
    packageType: 'chain',
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="pt-20 container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <GitBranch className="h-12 w-12 text-cyan-400" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Reasoning Chain Market
            </h1>
          </div>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-6">
            Trade AI reasoning chains. Direct transplant + learning capability with step-by-step KV snapshots.
          </p>
          <Link href="/reasoning-chains/publish">
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">
              <Upload className="h-4 w-4 mr-2" />
              Publish Reasoning Chain
            </Button>
          </Link>
        </div>

        {/* Stats */}
        {packages?.packages && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-cyan-400 mb-2">{packages.packages.length}</div>
              <div className="text-sm text-slate-400">Available Chains</div>
            </Card>
            <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-purple-400 mb-2">
                {packages.packages.reduce((sum: number, pkg: ReasoningChainPackage) => sum + (pkg.downloads || 0), 0)}
              </div>
              <div className="text-sm text-slate-400">Total Downloads</div>
            </Card>
            <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">
                {packages.packages.length > 0 
                  ? (packages.packages.reduce((sum: number, pkg: ReasoningChainPackage) => sum + (Number(pkg.rating) || 0), 0) / packages.packages.length).toFixed(1)
                  : '0.0'}
              </div>
              <div className="text-sm text-slate-400">Average Rating</div>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card className="p-6 mb-8 bg-slate-900/50 border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search reasoning chains..."
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
                <SelectItem value="o1">O1</SelectItem>
                <SelectItem value="claude-3">Claude 3</SelectItem>
                <SelectItem value="deepseek-v3">DeepSeek V3</SelectItem>
                <SelectItem value="qwen-2">Qwen 2</SelectItem>
              </SelectContent>
            </Select>

            <Select value={problemType} onValueChange={setProblemType}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Problem Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {REASONING_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
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
                  className={sortBy === sort.value ? 'bg-cyan-500 hover:bg-cyan-600' : ''}
                >
                  {sort.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Chain Package Grid */}
        {isLoading ? (
          <div className="text-center text-white py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
            <p>Loading reasoning chains...</p>
          </div>
        ) : packages?.packages && packages.packages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.packages
              .filter((pkg: ReasoningChainPackage) =>
                problemType === 'all' || pkg.problemType === problemType
              )
              .map((pkg: ReasoningChainPackage) => (
              <Link key={pkg.id} href={`/package/chain/${pkg.packageId}`}>
                <Card className="p-6 bg-slate-900/50 border-slate-800 hover:border-cyan-500 transition-all cursor-pointer group h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors mb-1">
                        {pkg.name}
                      </h3>
                      <p className="text-sm text-slate-400 line-clamp-2">{pkg.description}</p>
                    </div>
                    <Badge className="bg-cyan-500 text-white ml-2">
                      v{pkg.version}
                    </Badge>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <div className="text-sm font-bold text-purple-400">
                        {pkg.stepCount || 0}
                      </div>
                      <div className="text-xs text-slate-400">Steps</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <div className="text-sm font-bold text-green-400">
                        {pkg.solutionQuality ? `${(pkg.solutionQuality * 100).toFixed(0)}%` : 'N/A'}
                      </div>
                      <div className="text-xs text-slate-400">Quality</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <div className="text-sm font-bold text-yellow-400">
                        {pkg.rating ? parseFloat(String(pkg.rating)).toFixed(1) : 'N/A'}
                      </div>
                      <div className="text-xs text-slate-400">Rating</div>
                    </div>
                  </div>

                  {/* Problem Type */}
                  {pkg.problemType && (
                    <div className="mb-4">
                      <Badge variant="outline" className="border-cyan-500/50 text-cyan-400">
                        <Brain className="h-3 w-3 mr-1" />
                        {pkg.problemType}
                      </Badge>
                    </div>
                  )}

                  {/* Model Info */}
                  <div className="mb-4 p-3 bg-slate-800/30 rounded">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400">From:</span>
                        <span className="text-white ml-1 font-mono">{pkg.sourceModel}</span>
                      </div>
                      <Zap className="h-3 w-3 text-cyan-400" />
                      <div>
                        <span className="text-slate-400">To:</span>
                        <span className="text-white ml-1 font-mono">{pkg.targetModel}</span>
                      </div>
                    </div>
                  </div>

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
                      <div className="text-sm font-semibold text-cyan-400">
                        {formatNumber(pkg.downloads || 0)}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center text-slate-400 py-12">
            <GitBranch className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No reasoning chains found</p>
            <p className="text-sm mt-2">Be the first to publish a reasoning chain!</p>
            <Link href="/reasoning-chains/publish">
              <Button className="mt-4 bg-cyan-500 hover:bg-cyan-600">
                <Upload className="h-4 w-4 mr-2" />
                Publish Reasoning Chain
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
