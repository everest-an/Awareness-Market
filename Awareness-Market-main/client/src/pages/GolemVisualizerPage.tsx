import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navbar from '@/components/Navbar';
// Temporary mock for GolemVisualizer while fixing TypeScript errors
const GolemVisualizer = ({ vectors, onPointClick, onPointHover }: any) => (
  <div className="w-full h-[600px] bg-slate-900 rounded-lg flex items-center justify-center text-slate-400">
    <div className="text-center">
      <p>GolemVisualizer</p>
      <p className="text-sm">3D visualization loading...</p>
      <p className="text-xs mt-2">{vectors?.length || 0} vectors</p>
    </div>
  </div>
);
import { trpc } from '@/lib/trpc';
import {
  Zap,
  Download,
  Upload,
  Search,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface VectorData {
  id: string;
  vector: number[];
  label?: string;
  color?: string;
}

export default function GolemVisualizerPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [vectors, setVectors] = useState<VectorData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<VectorData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [packageType, setPackageType] = useState<'vector' | 'memory' | 'chain'>('vector');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'rating'>('recent');
  const [dataSource, setDataSource] = useState<'live' | 'live+demo' | 'demo'>('demo');

  // 查询包数据 - 仅在登录后获取真实数据
  const { data: packagesData } = trpc.packages.browsePackages.useQuery({
    packageType,
    sortBy,
    search: searchQuery || undefined,
    limit: 50,
  }, {
    enabled: isAuthenticated, // 仅在登录时获取真实数据
  });

  const generateDemoVectors = (count: number): VectorData[] => {
    const categories = ['nlp', 'vision', 'audio', 'multimodal', 'other'];
    const clusters = [
      { center: [2, 1, 0], color: '#4a9eff' },
      { center: [-2, 1.5, 1], color: '#a855f7' },
      { center: [1, -2, -1], color: '#10b981' },
      { center: [-1.5, -1.5, 2], color: '#f59e0b' },
      { center: [0, 2.5, -2], color: '#6366f1' },
    ];

    return Array.from({ length: count }).map((_, i) => {
      const cluster = clusters[i % clusters.length];
      const jitter = () => (Math.random() - 0.5) * 1.2;
      return {
        id: `demo-${packageType}-${i}`,
        vector: [
          cluster.center[0] + jitter(),
          cluster.center[1] + jitter(),
          cluster.center[2] + jitter(),
        ],
        label: `Demo ${packageType} node ${i + 1}`,
        color: cluster.color,
      } as VectorData;
    });
  };

  // 将包数据转换为向量用于可视化
  // 未登录: 显示演示数据 | 已登录: 显示真实客户数据
  useEffect(() => {
    const minPoints = 300;

    // 未登录 - 显示精心设计的演示数据
    if (!isAuthenticated) {
      setVectors(generateDemoVectors(minPoints));
      setDataSource('demo');
      return;
    }

    // 已登录但数据未加载
    if (!packagesData?.packages) return;

    // 已登录 - 映射真实客户数据
    const vectorizedPackages = packagesData.packages.map((pkg: any, index: number) => ({
      id: pkg.packageId,
      vector: [
        // 基于实际数据属性生成3D坐标
        (pkg.epsilon || Math.random()) * 10,
        (pkg.downloads || 0) / 100,
        (pkg.rating || 3) * 10 + (index * 0.5),
      ],
      label: pkg.name,
      color: getColorByCategory(pkg.category),
    }));

    // 如果真实数据不足，补充演示数据
    if (vectorizedPackages.length === 0) {
      setVectors(generateDemoVectors(minPoints));
      setDataSource('demo');
      return;
    }

    if (vectorizedPackages.length < minPoints) {
      const extra = generateDemoVectors(minPoints - vectorizedPackages.length);
      setVectors([...vectorizedPackages, ...extra]);
      setDataSource('live+demo');
      return;
    }

    setVectors(vectorizedPackages);
    setDataSource('live');
  }, [packagesData, packageType, isAuthenticated]);

  const getColorByCategory = (category?: string): string => {
    const colors: Record<string, string> = {
      nlp: '#4a9eff',
      vision: '#a855f7',
      audio: '#10b981',
      multimodal: '#f59e0b',
      other: '#6366f1',
    };
    return colors[category as string] || '#4a9eff';
  };

  const handlePointClick = (point: VectorData) => {
    setSelectedPoint(point);
    toast.info(`Selected: ${point.label}`);
  };

  const exportVisualization = () => {
    const data = {
      vectors,
      timestamp: new Date().toISOString(),
      packageType,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `golem-visualization-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Visualization exported!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="h-8 w-8 text-cyan-400" />
            <h1 className="text-4xl font-bold text-white">
              Golem Vector Space Visualizer
            </h1>
          </div>
          <p className="text-slate-300">
            3D interactive visualization of AI memory packages and their relationships
          </p>
        </div>

        {/* Controls */}
        <Card className="p-6 mb-8 bg-slate-900/50 border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Package Type
              </label>
              <Select value={packageType} onValueChange={(val: any) => setPackageType(val)}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vector">Vector Packages</SelectItem>
                  <SelectItem value="memory">Memory Packages</SelectItem>
                  <SelectItem value="chain">Chain Packages</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Sort By
              </label>
              <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recent</SelectItem>
                  <SelectItem value="popular">Popular</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Search
              </label>
              <Input
                placeholder="Search packages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={exportVisualization}
                className="bg-cyan-600 hover:bg-cyan-700 w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-400">
              Visualizing {vectors.length} packages in 3D vector space
              <span className="ml-2 text-slate-500">• Source: {dataSource}</span>
            </div>
            {!isAuthenticated && (
              <div className="text-amber-400/80 text-xs">
                💡 Login to view your real data
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Visualizer */}
          <div className="lg:col-span-3">
            <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
              {loading ? (
                <div className="h-[600px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                </div>
              ) : (
                <GolemVisualizer
                  data={vectors}
                  onPointClick={handlePointClick}
                  height="600px"
                  backgroundColor="#0a0e27"
                  autoRotate={true}
                  rotateSpeed={0.6}
                  pointScale={8}
                />
              )}
            </Card>
          </div>

          {/* Sidebar - Info Panel */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              {/* Statistics */}
              <Card className="p-4 bg-slate-900/50 border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Statistics
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Packages:</span>
                    <span className="text-cyan-400 font-semibold">{vectors.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Type:</span>
                    <span className="text-cyan-400 font-semibold capitalize">{packageType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dimensions:</span>
                    <span className="text-cyan-400 font-semibold">3D</span>
                  </div>
                </div>
              </Card>

              {/* Selected Point Info */}
              {selectedPoint && (
                <Card className="p-4 bg-slate-900/50 border-slate-800 border-cyan-500/50">
                  <h3 className="text-sm font-semibold text-white mb-3">
                    Selected Point
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="break-words">
                      <span className="text-slate-400">ID: </span>
                      <span className="text-cyan-400">{selectedPoint.id}</span>
                    </div>
                    {selectedPoint.label && (
                      <div>
                        <span className="text-slate-400">Label: </span>
                        <span className="text-cyan-400">{selectedPoint.label}</span>
                      </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <span className="text-slate-400 text-xs">Vector (3D):</span>
                      <div className="text-cyan-400 text-xs font-mono mt-1">
                        [{selectedPoint.vector.map((v) => v.toFixed(2)).join(', ')}]
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Legend */}
              <Card className="p-4 bg-slate-900/50 border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-3">Color Legend</h3>
                <div className="space-y-2 text-xs">
                  {[
                    { name: 'NLP', color: '#4a9eff' },
                    { name: 'Vision', color: '#a855f7' },
                    { name: 'Audio', color: '#10b981' },
                    { name: 'Multimodal', color: '#f59e0b' },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-slate-300">{item.name}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Instructions */}
              <Card className="p-4 bg-slate-900/50 border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-3">Controls</h3>
                <ul className="space-y-1 text-xs text-slate-400">
                  <li>• Drag to rotate</li>
                  <li>• Scroll to zoom</li>
                  <li>• Click to select</li>
                  <li>• Auto-rotate enabled</li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
