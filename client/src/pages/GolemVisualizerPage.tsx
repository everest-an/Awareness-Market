import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Navbar from '@/components/Navbar';
// Production GolemVisualizer component
import { GolemVisualizer } from '@/components/GolemVisualizer';
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
  x: number;
  y: number;
  z: number;
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

  // Query package data - Get real data only after login
  const { data: packagesData } = trpc.packages.browsePackages.useQuery({
    packageType,
    sortBy,
    search: searchQuery || undefined,
    limit: 50,
  }, {
    enabled: isAuthenticated, // Get real data only when logged in
  });

  const generateDemoVectors = (count: number): VectorData[] => {
    // Package templates based on real market scenarios
    const templates = [
      // Finance
      { category: 'finance', name: 'Financial Risk Analyzer', center: [3.2, 2.1, 0.8], color: '#10b981', rating: 4.8 },
      { category: 'finance', name: 'Stock Market Predictor', center: [3.5, 2.3, 1.2], color: '#10b981', rating: 4.6 },
      { category: 'finance', name: 'Portfolio Optimizer', center: [2.9, 1.9, 0.5], color: '#10b981', rating: 4.7 },
      { category: 'finance', name: 'Fraud Detection Expert', center: [3.8, 2.5, 1.5], color: '#10b981', rating: 4.9 },
      
      // Code Generation
      { category: 'code-generation', name: 'React Component Generator', center: [-2.1, 1.8, 1.3], color: '#8b5cf6', rating: 4.5 },
      { category: 'code-generation', name: 'Python Backend Architect', center: [-2.5, 2.1, 1.6], color: '#8b5cf6', rating: 4.7 },
      { category: 'code-generation', name: 'SQL Query Optimizer', center: [-1.9, 1.5, 0.9], color: '#8b5cf6', rating: 4.4 },
      { category: 'code-generation', name: 'API Documentation Writer', center: [-2.3, 1.7, 1.1], color: '#8b5cf6', rating: 4.6 },
      
      // Medical
      { category: 'medical', name: 'Medical Image Analyzer', center: [1.2, -2.3, -1.1], color: '#ec4899', rating: 4.9 },
      { category: 'medical', name: 'Drug Interaction Checker', center: [1.5, -2.6, -1.4], color: '#ec4899', rating: 4.8 },
      { category: 'medical', name: 'Symptom Diagnosis Assistant', center: [0.9, -2.0, -0.8], color: '#ec4899', rating: 4.7 },
      { category: 'medical', name: 'Clinical Note Summarizer', center: [1.3, -2.4, -1.2], color: '#ec4899', rating: 4.6 },
      
      // NLP
      { category: 'nlp', name: 'Sentiment Analysis Pro', center: [-1.2, -1.8, 2.1], color: '#4a9eff', rating: 4.5 },
      { category: 'nlp', name: 'Multilingual Translator', center: [-1.5, -2.1, 2.4], color: '#4a9eff', rating: 4.8 },
      { category: 'nlp', name: 'Text Summarization Engine', center: [-0.9, -1.5, 1.8], color: '#4a9eff', rating: 4.6 },
      { category: 'nlp', name: 'Named Entity Recognizer', center: [-1.3, -1.9, 2.2], color: '#4a9eff', rating: 4.7 },
      
      // Vision
      { category: 'vision', name: 'Object Detection Expert', center: [0.2, 2.8, -2.1], color: '#a855f7', rating: 4.7 },
      { category: 'vision', name: 'Facial Recognition System', center: [0.5, 3.1, -2.4], color: '#a855f7', rating: 4.8 },
      { category: 'vision', name: 'Image Classification Pro', center: [-0.1, 2.5, -1.8], color: '#a855f7', rating: 4.6 },
      { category: 'vision', name: 'Scene Understanding AI', center: [0.3, 2.9, -2.2], color: '#a855f7', rating: 4.9 },
      
      // Audio
      { category: 'audio', name: 'Speech Recognition Engine', center: [2.5, 0.3, -2.5], color: '#10b981', rating: 4.5 },
      { category: 'audio', name: 'Voice Synthesis Expert', center: [2.8, 0.6, -2.8], color: '#10b981', rating: 4.7 },
      { category: 'audio', name: 'Audio Classification System', center: [2.2, 0.0, -2.2], color: '#10b981', rating: 4.4 },
      { category: 'audio', name: 'Music Generation AI', center: [2.6, 0.4, -2.6], color: '#10b981', rating: 4.8 },
      
      // Multimodal
      { category: 'multimodal', name: 'Video Understanding AI', center: [-2.8, -0.5, -1.5], color: '#f59e0b', rating: 4.8 },
      { category: 'multimodal', name: 'Cross-Modal Retrieval', center: [-3.1, -0.8, -1.8], color: '#f59e0b', rating: 4.7 },
      { category: 'multimodal', name: 'Image Caption Generator', center: [-2.5, -0.2, -1.2], color: '#f59e0b', rating: 4.6 },
      { category: 'multimodal', name: 'Document Understanding AI', center: [-2.9, -0.6, -1.6], color: '#f59e0b', rating: 4.9 },
      
      // Reasoning Chain
      { category: 'reasoning_chain', name: 'Mathematical Reasoning', center: [0.8, 0.2, 3.2], color: '#22c55e', rating: 4.9 },
      { category: 'reasoning_chain', name: 'Logical Deduction Engine', center: [1.1, 0.5, 3.5], color: '#22c55e', rating: 4.8 },
      { category: 'reasoning_chain', name: 'Causal Inference System', center: [0.5, -0.1, 2.9], color: '#22c55e', rating: 4.7 },
      { category: 'reasoning_chain', name: 'Strategic Planning AI', center: [0.9, 0.3, 3.3], color: '#22c55e', rating: 4.8 },
      
      // Expert Knowledge
      { category: 'expert_knowledge', name: 'Legal Document Analyzer', center: [-0.5, 3.2, 1.5], color: '#f97316', rating: 4.7 },
      { category: 'expert_knowledge', name: 'Patent Search Expert', center: [-0.8, 3.5, 1.8], color: '#f97316', rating: 4.6 },
      { category: 'expert_knowledge', name: 'Research Paper Reviewer', center: [-0.2, 2.9, 1.2], color: '#f97316', rating: 4.8 },
      { category: 'expert_knowledge', name: 'Technical Writing Assistant', center: [-0.6, 3.3, 1.6], color: '#f97316', rating: 4.5 },
    ];

    const result: VectorData[] = [];
    const templatesPerCluster = Math.ceil(count / templates.length);

    templates.forEach((template, templateIdx) => {
      for (let i = 0; i < templatesPerCluster && result.length < count; i++) {
        const jitter = () => (Math.random() - 0.5) * 0.8;
        const variance = i * 0.15;
        
        result.push({
          id: `demo-${packageType}-${templateIdx}-${i}`,
          x: template.center[0] + jitter() + variance,
          y: template.center[1] + jitter() + variance * 0.8,
          z: template.center[2] + jitter() + variance * 1.2,
          label: i === 0 
            ? template.name 
            : `${template.name} v${i + 1}`,
          color: template.color,
        } as VectorData);
      }
    });

    return result.slice(0, count);
  };

  // Convert package data to vectors for visualization
  // Not logged in: show rich demo data (600+ nodes) | Logged in: show real customer data
  useEffect(() => {
    // If auth is still loading, show demo data first
    if (authLoading) {
      setVectors(generateDemoVectors(600));
      setDataSource('demo');
      return;
    }

    const minPoints = isAuthenticated ? 300 : 600; // Show more demo data when not logged in

    // Not logged in - show carefully designed demo data
    if (!isAuthenticated) {
      setVectors(generateDemoVectors(minPoints));
      setDataSource('demo');
      return;
    }

    // Logged in but data not loaded
    if (!packagesData?.packages) return;

    // Logged in - map real customer data (actual inference data)
    const vectorizedPackages = packagesData.packages.map((pkg: any, index: number) => ({
      id: pkg.packageId || pkg.id,
      // Generate 3D coordinates based on actual inference data attributes
      // X: based on alignmentLoss (epsilon) or downloads - represents alignment loss
      x: parseFloat(pkg.epsilon || '0') * 50 + (Math.random() - 0.5) * 2,
      // Y: based on fidelityScore or rating - represents fidelity
      y: parseFloat(pkg.informationRetention || '0.95') * 30 + (pkg.rating || 3) * 5,
      // Z: based on dimension or usage count - represents model complexity
      z: (pkg.dimension ? pkg.dimension / 200 : 0) + (pkg.downloads || 0) / 50 + index * 0.3,
      label: pkg.name || pkg.title,
      color: getColorByCategory(pkg.category || pkg.vectorType || pkg.memoryType),
    }));

    // If real data is insufficient, supplement with demo data
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
  }, [packagesData, packageType, isAuthenticated, authLoading]);

  const getColorByCategory = (category?: string): string => {
    const colors: Record<string, string> = {
      // Package types
      nlp: '#4a9eff',
      vision: '#a855f7',
      audio: '#10b981',
      multimodal: '#f59e0b',
      other: '#6366f1',
      // Vector types
      embedding: '#4a9eff',
      kv_cache: '#ef4444',
      reasoning_chain: '#22c55e',
      // Memory types
      latent_vector: '#3b82f6',
      expert_knowledge: '#f97316',
      // Model categories
      finance: '#10b981',
      'code-generation': '#8b5cf6',
      medical: '#ec4899',
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

      {/* DEBUG PANEL - Remove in production */}
      {process.env.NODE_ENV === 'development' && !isAuthenticated && (
        <div style={{position: 'fixed', top: 8, right: 8, zIndex: 1000, background: '#222', color: '#fff', padding: '12px', borderRadius: '8px', fontSize: '12px', maxWidth: '400px', boxShadow: '0 2px 8px #0008'}}>
          <div><strong>DEBUG:</strong> Demo vectors count: {vectors.length}</div>
          <div>First 3 demo nodes:</div>
          <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '11px', background: '#333', padding: '6px', borderRadius: '4px', marginTop: '4px'}}>{JSON.stringify(vectors.slice(0,3), null, 2)}</pre>
        </div>
      )}

      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="h-8 w-8 text-cyan-400" />
            <h1 className="text-4xl font-bold text-white">
              Golem Vector Space Visualizer
            </h1>
          </div>
          <p className="text-slate-300 mb-2">
            3D interactive visualization of AI memory packages and their relationships
          </p>
          {!isAuthenticated && (
            <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-4 py-2 mt-3">
              <BarChart3 className="h-4 w-4" />
              <span>
                Viewing <strong>600+ demo samples</strong> across 36 categories. 
                <a href="/login" className="ml-1 underline hover:text-amber-300">
                  Sign in
                </a> to explore your real deployment data.
              </span>
            </div>
          )}
          {isAuthenticated && dataSource !== 'live' && (
            <div className="flex items-center gap-2 text-sm text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded-lg px-4 py-2 mt-3">
              <BarChart3 className="h-4 w-4" />
              <span>
                Data source: <strong>{dataSource === 'demo' ? 'Demo samples' : 'Live data + demo samples'}</strong>
              </span>
            </div>
          )}
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
              <span className="ml-2 text-slate-500">| Source: {dataSource}</span>
            </div>
            {!isAuthenticated && (
              <div className="text-amber-400/80 text-xs">
                Login to view your real data
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
                  backgroundColor="#0a0e27"
                  autoRotate={true}
                  className="h-[600px]"
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
                    <span className="text-cyan-400 font-semibold">3D Space</span>
                  </div>
                  {!isAuthenticated && (
                    <>
                      <div className="h-px bg-slate-700 my-3" />
                      <div className="text-xs text-slate-500 space-y-1">
                        <div>36 distinct categories</div>
                        <div>10 industry verticals</div>
                        <div>Finance, Medical, NLP, Vision</div>
                        <div>Code Gen, Audio, Multimodal</div>
                      </div>
                    </>
                  )}
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
                        [{selectedPoint.x.toFixed(2)}, {selectedPoint.y.toFixed(2)}, {selectedPoint.z.toFixed(2)}]
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
                  <li>Drag to rotate</li>
                  <li>Scroll to zoom</li>
                  <li>Click to select</li>
                  <li>Auto-rotate enabled</li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
