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
  TrendingUp,
  Award,
  Layers,
  Zap,
  Filter,
  Box,
  Eye,
  Mic,
  Image as ImageIcon,
  Globe,
} from 'lucide-react';

export default function VectorPackageMarket() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'price_asc' | 'price_desc'>('recent');
  const [category, setCategory] = useState<string>('all');
  const [sourceModel, setSourceModel] = useState<string>('all');

  // Fetch vector packages
  const { data: packagesData, isLoading } = trpc.packages.browsePackages.useQuery({
    packageType: 'vector',
    category: category === 'all' ? undefined : category,
    sourceModel: sourceModel === 'all' ? undefined : sourceModel,
    search: searchTerm || undefined,
    sortBy,
    limit: 20,
    offset: 0,
  });

  const packages = packagesData?.packages || [];

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'nlp': return <Layers className="h-4 w-4" />;
      case 'vision': return <Eye className="h-4 w-4" />;
      case 'audio': return <Mic className="h-4 w-4" />;
      case 'multimodal': return <Globe className="h-4 w-4" />;
      default: return <Box className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'nlp': return 'bg-blue-500';
      case 'vision': return 'bg-purple-500';
      case 'audio': return 'bg-green-500';
      case 'multimodal': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getEpsilonColor = (epsilon: number) => {
    if (epsilon < 0.05) return 'text-green-400';
    if (epsilon < 0.10) return 'text-blue-400';
    if (epsilon < 0.15) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Box className="h-12 w-12 text-cyan-400" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Vector Package Market
            </h1>
          </div>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Trade AI capabilities as vector packages. Each package includes a trained vector and W-Matrix for cross-model alignment.
          </p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/50">
              <Layers className="h-3 w-3 mr-1" />
              Static Embeddings
            </Badge>
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50">
              <Zap className="h-3 w-3 mr-1" />
              Cross-Model Transfer
            </Badge>
            <Badge className="bg-green-500/20 text-green-300 border-green-500/50">
              <Award className="h-3 w-3 mr-1" />
              Quality Certified
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
            <div className="text-3xl font-bold text-cyan-400 mb-2">{packages.length}</div>
            <div className="text-sm text-slate-400">Vector Packages</div>
          </Card>
          <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">
              {packages.reduce((sum, p: any) => sum + (p.purchaseCount || 0), 0)}
            </div>
            <div className="text-sm text-slate-400">Total Purchases</div>
          </Card>
          <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
            <div className="text-3xl font-bold text-purple-400 mb-2">
              {packages.reduce((sum, p: any) => sum + (p.downloadCount || 0), 0)}
            </div>
            <div className="text-sm text-slate-400">Total Downloads</div>
          </Card>
          <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
            <div className="text-3xl font-bold text-yellow-400 mb-2">
              {packages.length > 0
                ? ((packages.reduce((sum: number, p: any) => sum + p.epsilon, 0) / packages.length) * 100).toFixed(1)
                : '0'}%
            </div>
            <div className="text-sm text-slate-400">Avg Epsilon</div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="p-6 mb-8 bg-slate-900/50 border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search vector packages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="nlp">NLP</SelectItem>
                <SelectItem value="vision">Vision</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="multimodal">Multimodal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceModel} onValueChange={setSourceModel}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Source Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Models</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="claude-3">Claude-3</SelectItem>
                <SelectItem value="llama-3">LLaMA-3</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
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
                { value: 'recent', label: 'Recent' },
                { value: 'popular', label: 'Popular' },
                { value: 'price_asc', label: 'Price ↑' },
                { value: 'price_desc', label: 'Price ↓' },
              ].map((sort) => (
                <Button
                  key={sort.value}
                  variant={sortBy === sort.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy(sort.value as any)}
                  className={sortBy === sort.value ? 'bg-cyan-500 hover:bg-cyan-600' : ''}
                >
                  {sort.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Package Grid */}
        {isLoading ? (
          <div className="text-center text-white py-12">Loading vector packages...</div>
        ) : packages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg: any) => (
              <Link key={pkg.packageId} href={`/vector-package/${pkg.packageId}`}>
                <Card className="p-6 bg-slate-900/50 border-slate-800 hover:border-cyan-500 transition-all cursor-pointer group">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors mb-1">
                        {pkg.name}
                      </h3>
                      <p className="text-sm text-slate-400 line-clamp-2">{pkg.description}</p>
                    </div>
                    <Badge className={`${getCategoryColor(pkg.category)} text-white ml-2`}>
                      {getCategoryIcon(pkg.category)}
                      <span className="ml-1">{pkg.category?.toUpperCase()}</span>
                    </Badge>
                  </div>

                  {/* Model Transfer */}
                  <div className="flex items-center gap-2 mb-4 p-3 bg-slate-800/50 rounded">
                    <span className="text-xs font-medium text-cyan-400">{pkg.sourceModel}</span>
                    <Zap className="h-3 w-3 text-slate-500" />
                    <span className="text-xs font-medium text-purple-400">{pkg.targetModel}</span>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <div className={`text-sm font-bold ${getEpsilonColor(pkg.epsilon)}`}>
                        {(pkg.epsilon * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-slate-400">Epsilon</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <div className="text-sm font-bold text-blue-400">{pkg.dimension}</div>
                      <div className="text-xs text-slate-400">Dimension</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <div className="text-sm font-bold text-green-400">{pkg.downloadCount || 0}</div>
                      <div className="text-xs text-slate-400">Downloads</div>
                    </div>
                  </div>

                  {/* Tags */}
                  {pkg.tags && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {pkg.tags.split(',').slice(0, 3).map((tag: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs border-slate-700 text-slate-400">
                          {tag.trim()}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div>
                      <div className="text-xs text-slate-400">Price</div>
                      <div className="text-lg font-bold text-white">${pkg.price}</div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-cyan-500 hover:bg-cyan-600 text-white"
                      onClick={(e) => {
                        e.preventDefault();
                        // Handle quick purchase
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center text-slate-400 py-12">
            <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No vector packages found</p>
            <p className="text-sm mt-2">Try adjusting your filters or be the first to publish!</p>
            <Button className="mt-6 bg-cyan-500 hover:bg-cyan-600" asChild>
              <Link href="/upload-vector-package">
                <Box className="h-4 w-4 mr-2" />
                Publish Vector Package
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
