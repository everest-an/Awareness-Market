/**
 * Neural Cortex - Code Knowledge Graph Visualization
 *
 * Integrates:
 * - useCodeGraph hook (GitHub connection, repo selection, 3D layout)
 * - NeuralCortexVisualizer (Three.js rendering with edges + BFS pulse)
 * - GitHubConnectPanel (top-right GitHub connection UI)
 * - Socket.IO listener for cortex:code_change workspace events
 */

import SEO from "@/components/SEO";
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { NeuralCortexVisualizer, AgentNode, CortexNode } from '@/components/NeuralCortexVisualizer';
import type { NeuralCortexHandle } from '@/components/NeuralCortexVisualizer';
import { GitHubConnectPanel } from '@/components/GitHubConnectPanel';
import { useCodeGraph } from '@/hooks/useCodeGraph';
import { Maximize2, Minimize2, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { io } from 'socket.io-client';

// Map directory IDs to display colors for the legend
const DIR_DISPLAY_COLORS: Record<string, string> = {
  'server/_core/':          '#06b6d4',
  'server/':                '#06b6d4',
  'server/routers/':        '#4ade80',
  'server/code-graph/':     '#38bdf8',
  'server/memory-core/':    '#a855f7',
  'server/latentmas/':      '#3b82f6',
  'client/src/':            '#f97316',
  'client/src/pages/':      '#ef4444',
  'client/src/components/': '#eab308',
  'client/src/hooks/':      '#ec4899',
  'client/src/lib/':        '#d97706',
  'client/src/data/':       '#ca8a04',
  'prisma/':                '#14b8a6',
};

export default function NeuralCortex() {
  const [selectedNode, setSelectedNode] = useState<CortexNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const visualizerRef = useRef<NeuralCortexHandle>(null);

  const {
    connectionStatus,
    repos,
    selectedRepo,
    cortexNodes,
    edges,
    isLoading,
    selectRepo,
    resetToDefault,
  } = useCodeGraph();

  // Derive directory-based "agent" nodes for the visualizer legend
  const directoryAgents = useMemo<AgentNode[]>(() => {
    const dirSet = new Set<string>();
    for (const node of cortexNodes) {
      if (node.agentId) dirSet.add(node.agentId);
    }
    const dirs = [...dirSet].sort();
    return dirs.map((dir, i) => {
      const angle = (i / dirs.length) * Math.PI * 2;
      const r = 40;
      return {
        id: dir,
        name: dir.replace(/\/$/, '').split('/').pop() || dir,
        model: 'dir',
        position: [
          Math.cos(angle) * r,
          (i % 3 - 1) * 14,
          Math.sin(angle) * r,
        ] as [number, number, number],
        color: DIR_DISPLAY_COLORS[dir] || '#6b7280',
        activity: 0.7 + Math.random() * 0.3,
        status: 'idle' as const,
      };
    });
  }, [cortexNodes]);

  // Socket.IO: listen for code_change events from workspace
  useEffect(() => {
    const socket = io({ path: '/socket.io', transports: ['websocket'] });

    socket.on('cortex:code_change', (data: { filePaths?: string[] }) => {
      if (data.filePaths && visualizerRef.current) {
        visualizerRef.current.triggerPulseByFilePaths(data.filePaths);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleNodeClick = useCallback((node: CortexNode | null) => {
    setSelectedNode(node);
  }, []);

  const handleAgentToggle = useCallback((agentId: string) => {
    setSelectedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  }, []);

  const handleCategoryToggle = useCallback((category: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedAgents(new Set());
    setSelectedCategories(new Set());
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      <SEO
        title="Neural Cortex"
        description="3D visualization of the Awareness AI code knowledge graph. Explore file dependencies, function relationships, and code architecture."
        path="/neural-cortex"
      />
      {!isFullscreen && <Navbar />}

      <div className={`relative ${isFullscreen ? 'h-screen' : 'h-[calc(100vh-64px)]'}`}>
        {/* Main Visualizer */}
        <div className="absolute inset-0">
          <NeuralCortexVisualizer
            ref={visualizerRef}
            agents={directoryAgents}
            nodes={cortexNodes}
            edges={edges}
            onNodeClick={handleNodeClick}
            showLabels={true}
            selectedAgents={selectedAgents}
            selectedCategories={selectedCategories}
            onAgentToggle={handleAgentToggle}
            onCategoryToggle={handleCategoryToggle}
            onClearFilters={handleClearFilters}
          />
        </div>

        {/* GitHub Connect Panel - top right */}
        <GitHubConnectPanel
          onRepoSelect={selectRepo}
          onReset={resetToDefault}
          connectionStatus={connectionStatus}
          repos={repos}
          selectedRepo={selectedRepo}
          isLoading={isLoading}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <span className="text-white/60 text-sm">Building code graph...</span>
            </div>
          </div>
        )}

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="absolute bottom-[168px] right-6 z-20 p-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl text-cyan-400 transition-all"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>

        {/* Selected Node Detail Panel */}
        {selectedNode && (
          <div className="absolute bottom-6 left-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl px-5 py-4 z-10 max-w-[320px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Selected Node</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-white/40 hover:text-white text-sm px-1"
              >
                ×
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-white/50">Name</span>
                <span className="text-white font-medium truncate">{selectedNode.title}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/50">Type</span>
                <span className="text-cyan-400 font-mono">
                  {selectedNode.codeNodeType || selectedNode.category}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/50">Directory</span>
                <span className="text-white/70 truncate">{selectedNode.agentId || '—'}</span>
              </div>
              {selectedNode.domain && (
                <div className="flex justify-between gap-4">
                  <span className="text-white/50">Language</span>
                  <span className="text-white/70">{selectedNode.domain}</span>
                </div>
              )}
            </div>
            {selectedNode.filePath && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-white/40 text-[10px] mb-1">FILE PATH</div>
                <div className="text-cyan-400 text-xs font-mono truncate">
                  {selectedNode.filePath}
                  {selectedNode.lineStart != null && (
                    <span className="text-white/40">:{selectedNode.lineStart}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
