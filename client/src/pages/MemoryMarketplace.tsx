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
  GitBranch,
  Zap,
  Filter,
} from 'lucide-react';

export default function MemoryMarketplace() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'price' | 'quality' | 'popular'>('recent');
  const [memoryType, setMemoryType] = useState<string>('all');
  const [certification, setCertification] = useState<string>('all');

  // Fetch memory listings
  const { data: memories, isLoading } = trpc.memoryNFT.browse.useQuery({
    sortBy,
    memoryType: memoryType === 'all' ? undefined : memoryType,
    certification: certification === 'all' ? undefined : certification,
    limit: 20,
    offset: 0,
  });

  // Fetch marketplace stats
  const { data: stats } = trpc.memoryNFT.getStats.useQuery();

  const getCertificationColor = (cert: string) => {
    switch (cert) {
      case 'platinum': return 'bg-purple-500';
      case 'gold': return 'bg-yellow-500';
      case 'silver': return 'bg-gray-400';
      case 'bronze': return 'bg-orange-600';
      default: return 'bg-gray-500';
    }
  };

  const getQualityColor = (grade: string) => {
    switch (grade) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'fair': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Memory Marketplace
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Trade AI memories as NFTs. Each memory comes with provenance tracking, quality certification, and automatic royalty distribution.
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-cyan-400 mb-2">{stats.totalMemories}</div>
              <div className="text-sm text-slate-400">Total Memories</div>
            </Card>
            <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">{stats.totalSales}</div>
              <div className="text-sm text-slate-400">Total Sales</div>
            </Card>
            <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-purple-400 mb-2">${stats.totalVolume}</div>
              <div className="text-sm text-slate-400">Total Volume</div>
            </Card>
            <Card className="p-6 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-yellow-400 mb-2">{stats.avgEpsilon}%</div>
              <div className="text-sm text-slate-400">Avg Epsilon</div>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card className="p-6 mb-8 bg-slate-900/50 border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search memories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <Select value={memoryType} onValueChange={setMemoryType}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Memory Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="kv-cache">KV-Cache</SelectItem>
                <SelectItem value="w-matrix">W-Matrix</SelectItem>
                <SelectItem value="reasoning-chain">Reasoning Chain</SelectItem>
              </SelectContent>
            </Select>

            <Select value={certification} onValueChange={setCertification}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Certification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Certifications</SelectItem>
                <SelectItem value="platinum">Platinum</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="silver">Silver</SelectItem>
                <SelectItem value="bronze">Bronze</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Filter className="h-4 w-4" />
              <span>Sort by:</span>
            </div>
            <div className="flex gap-2">
              {['recent', 'price', 'quality', 'popular'].map((sort) => (
                <Button
                  key={sort}
                  variant={sortBy === sort ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy(sort as any)}
                  className={sortBy === sort ? 'bg-cyan-500 hover:bg-cyan-600' : ''}
                >
                  {sort.charAt(0).toUpperCase() + sort.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Memory Grid */}
        {isLoading ? (
          <div className="text-center text-white py-12">Loading memories...</div>
        ) : memories && memories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {memories.map((memory: any) => (
              <Link key={memory.id} href={`/memory/${memory.id}`}>
                <Card className="p-6 bg-slate-900/50 border-slate-800 hover:border-cyan-500 transition-all cursor-pointer group">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors mb-1">
                        {memory.name}
                      </h3>
                      <p className="text-sm text-slate-400 line-clamp-2">{memory.description}</p>
                    </div>
                    <Badge className={`${getCertificationColor(memory.certification)} text-white ml-2`}>
                      {memory.certification?.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <div className="text-sm font-bold text-cyan-400">{memory.epsilon}%</div>
                      <div className="text-xs text-slate-400">Epsilon</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <div className={`text-sm font-bold ${getQualityColor(memory.qualityGrade)}`}>
                        {memory.qualityGrade}
                      </div>
                      <div className="text-xs text-slate-400">Quality</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <div className="text-sm font-bold text-purple-400">{memory.memoryType}</div>
                      <div className="text-xs text-slate-400">Type</div>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex items-center gap-3 mb-4 text-xs text-slate-400">
                    {memory.hasProvenance && (
                      <Link href={`/memory-provenance/${memory.id}`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 hover:text-cyan-400 transition-colors cursor-pointer">
                          <GitBranch className="h-3 w-3" />
                          <span>View Provenance</span>
                        </div>
                      </Link>
                    )}
                    {memory.hasTBA && (
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        <span>TBA</span>
                      </div>
                    )}
                    {memory.certified && (
                      <div className="flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        <span>Certified</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div>
                      <div className="text-xs text-slate-400">Price</div>
                      <div className="text-lg font-bold text-white">
                        {memory.price ? `$${memory.price}` : 'Not for sale'}
                      </div>
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
            <p className="text-lg">No memories found</p>
            <p className="text-sm mt-2">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
