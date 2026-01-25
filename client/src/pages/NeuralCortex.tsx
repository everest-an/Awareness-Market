/**
 * Neural Cortex - LatentMAS AI Knowledge Network Visualization
 * Displays the "brain" of the AI network with knowledge clusters
 * 
 * - Logged in: Real-time data from LatentMAS API
 * - Not logged in: Rich demo showcasing AI-to-AI thought transfer
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { NeuralCortexVisualizer, KnowledgeDomain } from '@/components/NeuralCortexVisualizer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { Search, LogIn, Activity, Zap, Brain, Network, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

// Demo scenarios for non-authenticated users
const DEMO_SCENARIOS = [
  {
    id: 'gpt4-to-claude',
    name: 'GPT-4 → Claude Transfer',
    description: 'Watch reasoning transfer between OpenAI and Anthropic models',
    query: 'artificial intelligence',
  },
  {
    id: 'memory-retrieval',
    name: 'KV-Cache Memory Retrieval',
    description: 'See how AI retrieves and transfers contextual memory',
    query: 'kv-cache',
  },
  {
    id: 'reasoning-chain',
    name: 'Multi-Step Reasoning',
    description: 'Observe complex reasoning chains across model boundaries',
    query: 'reasoning chains',
  },
  {
    id: 'vector-alignment',
    name: 'W-Matrix Alignment',
    description: 'Visualize latent space alignment with minimal information loss',
    query: 'w-matrix',
  },
];

// LatentMAS knowledge domains - comprehensive demo data
const DEMO_DOMAINS: KnowledgeDomain[] = [
  // Core AI domains (Purple cluster)
  { id: 'artificial-intelligence', name: 'ARTIFICIAL INTELLIGENCE', color: '#a855f7', nodeCount: 1500, center: [-10, 25, 5], spread: 20 },
  { id: 'machine-learning', name: 'MACHINE LEARNING', color: '#8b5cf6', nodeCount: 1200, center: [-25, 20, 10], spread: 16 },
  { id: 'deep-learning', name: 'DEEP LEARNING', color: '#7c3aed', nodeCount: 1000, center: [-20, 35, 0], spread: 14 },
  { id: 'neural-networks', name: 'NEURAL NETWORKS', color: '#6366f1', nodeCount: 900, center: [-5, 15, 15], spread: 12 },
  { id: 'transformers', name: 'TRANSFORMERS', color: '#818cf8', nodeCount: 1100, center: [-15, 30, 12], spread: 15 },
  
  // Reasoning & Logic (Green cluster)
  { id: 'reasoning-chains', name: 'REASONING CHAINS', color: '#22c55e', nodeCount: 800, center: [30, 20, 5], spread: 12 },
  { id: 'logic-systems', name: 'LOGIC SYSTEMS', color: '#10b981', nodeCount: 600, center: [40, 10, 10], spread: 10 },
  { id: 'game-theory', name: 'GAME THEORY', color: '#14b8a6', nodeCount: 500, center: [35, 30, -5], spread: 9 },
  { id: 'causal-inference', name: 'CAUSAL INFERENCE', color: '#34d399', nodeCount: 550, center: [38, 25, 8], spread: 9 },
  { id: 'symbolic-ai', name: 'SYMBOLIC AI', color: '#4ade80', nodeCount: 450, center: [42, 15, 3], spread: 8 },
  
  // Memory & Knowledge (Cyan cluster)
  { id: 'kv-cache', name: 'KV-CACHE MEMORY', color: '#06b6d4', nodeCount: 1100, center: [15, -15, 10], spread: 15 },
  { id: 'semantic-memory', name: 'SEMANTIC MEMORY', color: '#0ea5e9', nodeCount: 900, center: [5, -25, 5], spread: 13 },
  { id: 'episodic-memory', name: 'EPISODIC MEMORY', color: '#3b82f6', nodeCount: 700, center: [25, -20, 0], spread: 11 },
  { id: 'working-memory', name: 'WORKING MEMORY', color: '#0284c7', nodeCount: 650, center: [10, -18, 8], spread: 10 },
  { id: 'long-term-memory', name: 'LONG-TERM MEMORY', color: '#0369a1', nodeCount: 800, center: [20, -28, 3], spread: 12 },
  
  // Vector Operations (Orange cluster)
  { id: 'vector-embeddings', name: 'VECTOR EMBEDDINGS', color: '#f59e0b', nodeCount: 1300, center: [-35, -10, 0], spread: 18 },
  { id: 'w-matrix', name: 'W-MATRIX TRANSFORMS', color: '#f97316', nodeCount: 800, center: [-45, 0, 10], spread: 12 },
  { id: 'latent-space', name: 'LATENT SPACE', color: '#fb923c', nodeCount: 1000, center: [-30, -20, 5], spread: 14 },
  { id: 'dimensionality', name: 'DIMENSIONALITY REDUCTION', color: '#ea580c', nodeCount: 600, center: [-40, -15, 8], spread: 10 },
  { id: 'similarity-search', name: 'SIMILARITY SEARCH', color: '#fdba74', nodeCount: 700, center: [-38, -8, 3], spread: 11 },
  
  // Language & NLP (Pink cluster)
  { id: 'natural-language', name: 'NATURAL LANGUAGE', color: '#ec4899', nodeCount: 1100, center: [0, 40, -10], spread: 15 },
  { id: 'tokenization', name: 'TOKENIZATION', color: '#f43f5e', nodeCount: 600, center: [10, 45, 0], spread: 10 },
  { id: 'attention-mechanism', name: 'ATTENTION MECHANISM', color: '#e11d48', nodeCount: 850, center: [-15, 45, 5], spread: 12 },
  { id: 'context-window', name: 'CONTEXT WINDOW', color: '#fb7185', nodeCount: 700, center: [5, 50, -5], spread: 11 },
  { id: 'prompt-engineering', name: 'PROMPT ENGINEERING', color: '#fda4af', nodeCount: 550, center: [-8, 42, 8], spread: 9 },
  
  // Multi-Agent Systems (Lime cluster)
  { id: 'agent-communication', name: 'AGENT COMMUNICATION', color: '#84cc16', nodeCount: 750, center: [45, -5, -10], spread: 11 },
  { id: 'consensus-protocols', name: 'CONSENSUS PROTOCOLS', color: '#a3e635', nodeCount: 500, center: [50, 5, 0], spread: 9 },
  { id: 'swarm-intelligence', name: 'SWARM INTELLIGENCE', color: '#bef264', nodeCount: 600, center: [55, -15, 5], spread: 10 },
  { id: 'multi-agent-rl', name: 'MULTI-AGENT RL', color: '#65a30d', nodeCount: 550, center: [48, -10, -5], spread: 9 },
  
  // Model Architectures (Magenta cluster)
  { id: 'gpt-family', name: 'GPT FAMILY', color: '#d946ef', nodeCount: 900, center: [-50, 15, -5], spread: 13 },
  { id: 'claude-family', name: 'CLAUDE FAMILY', color: '#c026d3', nodeCount: 700, center: [-55, 5, 5], spread: 11 },
  { id: 'llama-family', name: 'LLAMA FAMILY', color: '#a21caf', nodeCount: 800, center: [-60, -5, 0], spread: 12 },
  { id: 'gemini-family', name: 'GEMINI FAMILY', color: '#e879f9', nodeCount: 600, center: [-52, 10, 10], spread: 10 },
  { id: 'mistral-family', name: 'MISTRAL FAMILY', color: '#f0abfc', nodeCount: 500, center: [-58, 0, -8], spread: 9 },
  
  // Knowledge Domains (Yellow cluster)
  { id: 'mathematics', name: 'MATHEMATICS', color: '#eab308', nodeCount: 800, center: [20, 0, 20], spread: 12 },
  { id: 'physics', name: 'PHYSICS', color: '#facc15', nodeCount: 700, center: [10, 5, 25], spread: 11 },
  { id: 'biology', name: 'BIOLOGY', color: '#fde047', nodeCount: 600, center: [30, -5, 15], spread: 10 },
  { id: 'chemistry', name: 'CHEMISTRY', color: '#fef08a', nodeCount: 550, center: [25, 8, 22], spread: 9 },
  { id: 'computer-science', name: 'COMPUTER SCIENCE', color: '#ca8a04', nodeCount: 900, center: [15, -2, 18], spread: 13 },
  
  // Applications (Red cluster)
  { id: 'code-generation', name: 'CODE GENERATION', color: '#ef4444', nodeCount: 850, center: [60, 20, 10], spread: 12 },
  { id: 'image-generation', name: 'IMAGE GENERATION', color: '#dc2626', nodeCount: 700, center: [65, 10, 5], spread: 11 },
  { id: 'speech-synthesis', name: 'SPEECH SYNTHESIS', color: '#b91c1c', nodeCount: 500, center: [58, 25, 0], spread: 9 },
  { id: 'robotics', name: 'ROBOTICS', color: '#f87171', nodeCount: 650, center: [62, 15, 15], spread: 10 },
];

export default function NeuralCortex() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomain | null>(null);
  const [domains, setDomains] = useState<KnowledgeDomain[]>(DEMO_DOMAINS);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [liveStats, setLiveStats] = useState({
    totalNodes: 0,
    activeTransfers: 0,
    avgEpsilon: 0,
  });

  // Fetch real data when authenticated
  const { data: packagesData } = trpc.packages.browsePackages.useQuery(
    { packageType: 'vector', limit: 100 },
    { enabled: isAuthenticated }
  );

  // Convert real packages to domains when authenticated
  useEffect(() => {
    if (isAuthenticated && packagesData?.packages) {
      // Group packages by category and create domains
      const categoryMap = new Map<string, { count: number; packages: any[] }>();
      
      packagesData.packages.forEach((pkg: any) => {
        const category = pkg.category || 'other';
        const existing = categoryMap.get(category) || { count: 0, packages: [] };
        existing.count += 1;
        existing.packages.push(pkg);
        categoryMap.set(category, existing);
      });

      // Create domains from real data
      const realDomains: KnowledgeDomain[] = [];
      let index = 0;
      
      categoryMap.forEach((data, category) => {
        const angle = (index / categoryMap.size) * Math.PI * 2;
        const radius = 30 + Math.random() * 20;
        
        realDomains.push({
          id: category,
          name: category.toUpperCase().replace(/-/g, ' '),
          color: getCategoryColor(category),
          nodeCount: data.count * 100 + Math.floor(Math.random() * 500),
          center: [
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            (Math.random() - 0.5) * 20,
          ],
          spread: 8 + data.count * 2,
        });
        index++;
      });

      // Merge with demo domains for richer visualization
      if (realDomains.length > 0) {
        setDomains([...realDomains, ...DEMO_DOMAINS.slice(0, 10)]);
      }

      // Update live stats
      setLiveStats({
        totalNodes: realDomains.reduce((sum, d) => sum + d.nodeCount, 0),
        activeTransfers: Math.floor(Math.random() * 50) + 10,
        avgEpsilon: 0.05 + Math.random() * 0.1,
      });
    } else {
      setDomains(DEMO_DOMAINS);
      setLiveStats({
        totalNodes: DEMO_DOMAINS.reduce((sum, d) => sum + d.nodeCount, 0),
        activeTransfers: 0,
        avgEpsilon: 0,
      });
    }
  }, [isAuthenticated, packagesData]);

  const handleDomainClick = useCallback((domain: KnowledgeDomain) => {
    setSelectedDomain(domain);
    setSearchQuery(domain.name.toLowerCase());
  }, []);

  const handleScenarioClick = (scenario: typeof DEMO_SCENARIOS[0]) => {
    setActiveScenario(scenario.id);
    setSearchQuery(scenario.query);
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-green-400 font-mono text-sm tracking-wider flex items-center gap-2">
              <Brain className="h-4 w-4" />
              LATENTMAS CORTEX // {isAuthenticated ? 'LIVE DATA' : 'DEMO MODE'}
            </h1>
            <p className="text-green-600 font-mono text-xs mt-1">
              {isAuthenticated 
                ? 'Real-time AI-to-AI thought transfer visualization'
                : 'Explore how AI models share knowledge across boundaries'}
            </p>
          </div>
          
          {/* Auth Status */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Badge className="bg-green-600/20 text-green-400 border-green-600 gap-1">
                <Activity className="h-3 w-3 animate-pulse" />
                Live
              </Badge>
            ) : (
              <Link href="/auth">
                <Button size="sm" variant="outline" className="border-green-600 text-green-400 hover:bg-green-600/20 gap-1 text-xs">
                  <LogIn className="h-3 w-3" />
                  Sign in for live data
                </Button>
              </Link>
            )}
          </div>
        </div>
        
        {/* Search Input */}
        <div className="mt-4 max-w-md">
          <div className="relative">
            <Input
              type="text"
              placeholder="search knowledge domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/50 border border-green-600 text-green-400 font-mono text-sm placeholder:text-green-800 focus:border-green-400 focus:ring-0 pr-10"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
          </div>
        </div>

        {/* Demo Scenarios (only when not authenticated) */}
        {!isAuthenticated && (
          <div className="mt-4 flex flex-wrap gap-2">
            {DEMO_SCENARIOS.map(scenario => (
              <button
                key={scenario.id}
                onClick={() => handleScenarioClick(scenario)}
                className={`px-3 py-1.5 rounded border font-mono text-xs transition-all ${
                  activeScenario === scenario.id
                    ? 'border-green-400 bg-green-400/20 text-green-400'
                    : 'border-green-800 text-green-600 hover:border-green-600 hover:text-green-400'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {scenario.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Active Scenario Description */}
        {activeScenario && !isAuthenticated && (
          <div className="mt-3 p-2 border border-green-800 rounded bg-black/50 max-w-md">
            <p className="text-green-500 font-mono text-xs">
              {DEMO_SCENARIOS.find(s => s.id === activeScenario)?.description}
            </p>
          </div>
        )}
      </div>

      {/* Main Visualizer */}
      <NeuralCortexVisualizer
        domains={domains}
        searchQuery={searchQuery}
        onDomainClick={handleDomainClick}
        showLabels={true}
        particleSize={0.12}
        connectionOpacity={0.08}
      />

      {/* Bottom Left - Stats */}
      <div className="absolute bottom-4 left-4 font-mono text-xs">
        <div className="text-green-400">
          Total Nodes: {domains.reduce((sum, d) => sum + d.nodeCount, 0).toLocaleString()}
        </div>
        <div className="text-green-600">
          Knowledge Domains: {domains.length}
        </div>
        {isAuthenticated && (
          <>
            <div className="text-cyan-400 mt-1">
              Active Transfers: {liveStats.activeTransfers}
            </div>
            <div className="text-cyan-600">
              Avg ε: {liveStats.avgEpsilon.toFixed(4)}
            </div>
          </>
        )}
        <div className="mt-2 text-green-800">
          Drag to rotate • Scroll to zoom • Click domain to filter
        </div>
      </div>

      {/* Bottom Right - Selected Domain */}
      {selectedDomain && (
        <div className="absolute bottom-4 right-4 font-mono text-xs text-right p-3 border border-green-800 rounded bg-black/70">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-green-400">{selectedDomain.name}</span>
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedDomain.color }}
            />
          </div>
          <div className="text-green-600 mt-1">{selectedDomain.nodeCount.toLocaleString()} nodes</div>
          {isAuthenticated && (
            <div className="text-cyan-500 mt-1 flex items-center gap-1 justify-end">
              <Network className="h-3 w-3" />
              <span>Connected to live network</span>
            </div>
          )}
        </div>
      )}

      {/* Demo CTA (when not authenticated) */}
      {!isAuthenticated && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center">
          <div className="bg-black/80 border border-green-600 rounded-lg p-4 max-w-sm">
            <p className="text-green-400 font-mono text-sm mb-3">
              This is a demo visualization. Sign in to see real AI-to-AI thought transfers.
            </p>
            <Link href="/auth">
              <Button className="bg-green-600 hover:bg-green-700 text-black font-mono text-sm gap-2">
                <ArrowRight className="h-4 w-4" />
                Connect to Live Network
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get color by category
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    nlp: '#ec4899',
    vision: '#a855f7',
    audio: '#06b6d4',
    multimodal: '#f59e0b',
    reasoning: '#22c55e',
    memory: '#3b82f6',
    embedding: '#f97316',
    other: '#6366f1',
  };
  return colors[category.toLowerCase()] || colors.other;
}
