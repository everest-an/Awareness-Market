/**
 * Neural Cortex - Code Knowledge Graph Visualization
 *
 * Integrates:
 * - useCodeGraph hook (GitHub connection, repo selection, 3D layout)
 * - NeuralCortexVisualizer (Three.js rendering with edges + BFS pulse)
 * - GitHubConnectPanel (top-right GitHub connection UI)
 * - CodeSearchPanel (top-center hybrid search)
 * - ProcessFlowPanel (left sidebar — execution flows + communities)
 * - NodeContextPanel (bottom-left 360-degree node context)
 * - CodeChatPanel (right sidebar AI chat)
 * - Socket.IO listener for cortex:code_change workspace events
 */

import SEO from "@/components/SEO";
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { NeuralCortexVisualizer, AgentNode, CortexNode } from '@/components/NeuralCortexVisualizer';
import type { NeuralCortexHandle } from '@/components/NeuralCortexVisualizer';
import { GitHubConnectPanel } from '@/components/GitHubConnectPanel';
import { CodeSearchPanel } from '@/components/CodeSearchPanel';
import { ProcessFlowPanel } from '@/components/ProcessFlowPanel';
import { NodeContextPanel } from '@/components/NodeContextPanel';
import { CodeChatPanel } from '@/components/CodeChatPanel';
import { useCodeGraph } from '@/hooks/useCodeGraph';
import { Maximize2, Minimize2, Loader2, MessageCircle, Zap } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { io } from 'socket.io-client';
import { trpc } from '@/lib/trpc';
import type { ProcessFlow, Community, ImpactResult } from '../../../server/code-graph/types';

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
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [showChat, setShowChat] = useState(false);
  const [showFlows, setShowFlows] = useState(false);
  const [impactOverlay, setImpactOverlay] = useState<{
    depth1: Set<string>;
    depth2: Set<string>;
    depth3: Set<string>;
  } | undefined>(undefined);
  const visualizerRef = useRef<NeuralCortexHandle>(null);

  const {
    connectionStatus,
    repos,
    selectedRepo,
    cortexNodes,
    edges,
    communities,
    processes,
    isLoading,
    selectRepo,
    resetToDefault,
  } = useCodeGraph();

  const owner = selectedRepo?.owner || '';
  const repo = selectedRepo?.repo || '';

  // Impact analysis mutation
  const impactMutation = trpc.codeGraph.impact.useMutation({
    onSuccess: (data) => {
      const result = data as ImpactResult;
      setImpactOverlay({
        depth1: new Set(result.depth1.map(n => n.nodeId)),
        depth2: new Set(result.depth2.map(n => n.nodeId)),
        depth3: new Set(result.depth3.map(n => n.nodeId)),
      });
    },
  });

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

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleNodeClick = useCallback((node: CortexNode | null) => {
    setSelectedNode(node);
    // Clear impact when selecting a new node
    setImpactOverlay(undefined);
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
    setHighlightedNodes(new Set());
    setImpactOverlay(undefined);
  }, []);

  // Search result → highlight + navigate
  const handleSearchResultClick = useCallback((nodeId: string) => {
    setHighlightedNodes(new Set([nodeId]));
    // Find the node and trigger a pulse
    const idx = cortexNodes.findIndex(n => n.id === nodeId);
    if (idx >= 0 && visualizerRef.current) {
      visualizerRef.current.triggerPulse([idx]);
    }
  }, [cortexNodes]);

  const handleSearchHighlight = useCallback((nodeIds: Set<string>) => {
    setHighlightedNodes(nodeIds);
  }, []);

  // Flow click → highlight path nodes in sequence
  const handleFlowClick = useCallback((flow: ProcessFlow) => {
    setHighlightedNodes(new Set(flow.steps));
    setImpactOverlay(undefined);
    // Trigger sequential pulse along the path
    const indices = flow.steps
      .map(stepId => cortexNodes.findIndex(n => n.id === stepId))
      .filter(idx => idx >= 0);
    if (indices.length > 0 && visualizerRef.current) {
      visualizerRef.current.triggerPulse(indices);
    }
  }, [cortexNodes]);

  // Community click → highlight all member nodes
  const handleCommunityClick = useCallback((community: Community) => {
    setHighlightedNodes(new Set(community.memberIds));
    setImpactOverlay(undefined);
  }, []);

  // Node context → navigate to another node
  const handleNodeNavigate = useCallback((nodeId: string) => {
    const node = cortexNodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      const idx = cortexNodes.indexOf(node);
      if (idx >= 0 && visualizerRef.current) {
        visualizerRef.current.triggerPulse([idx]);
      }
    }
  }, [cortexNodes]);

  // Impact analysis
  const handleImpactAnalysis = useCallback((symbolIds: string[]) => {
    if (owner && repo) {
      impactMutation.mutate({ symbolIds, owner, repo });
    }
  }, [owner, repo, impactMutation]);

  // Chat node highlight
  const handleChatNodeHighlight = useCallback((nodeIds: string[]) => {
    setHighlightedNodes(new Set(nodeIds));
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
            showLabels={!showFlows}
            selectedAgents={selectedAgents}
            selectedCategories={selectedCategories}
            onAgentToggle={handleAgentToggle}
            onCategoryToggle={handleCategoryToggle}
            onClearFilters={handleClearFilters}
            highlightNodes={highlightedNodes.size > 0 ? highlightedNodes : undefined}
            impactNodeIds={impactOverlay}
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

        {/* Code Search Panel - top center */}
        {owner && repo && (
          <CodeSearchPanel
            owner={owner}
            repo={repo}
            onResultClick={handleSearchResultClick}
            onHighlight={handleSearchHighlight}
          />
        )}

        {/* Process Flow Panel - left sidebar */}
        {showFlows && (
          <ProcessFlowPanel
            processes={processes}
            communities={communities}
            onFlowClick={handleFlowClick}
            onCommunityClick={handleCommunityClick}
            onClose={() => setShowFlows(false)}
          />
        )}

        {/* Node Context Panel - bottom left (replaces old simple detail panel) */}
        {selectedNode && owner && repo && (
          <NodeContextPanel
            node={selectedNode}
            owner={owner}
            repo={repo}
            onClose={() => setSelectedNode(null)}
            onNodeNavigate={handleNodeNavigate}
            onImpactAnalysis={handleImpactAnalysis}
          />
        )}

        {/* Fallback detail panel when no repo is connected */}
        {selectedNode && (!owner || !repo) && (
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

        {/* Code Chat Panel - right sidebar */}
        {showChat && owner && repo && (
          <CodeChatPanel
            owner={owner}
            repo={repo}
            onClose={() => setShowChat(false)}
            onNodeHighlight={handleChatNodeHighlight}
          />
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <span className="text-white/60 text-sm">Building code graph...</span>
            </div>
          </div>
        )}

        {/* Toggle Buttons - bottom right (above zoom controls) */}
        <div className="absolute bottom-[168px] right-6 z-20 flex flex-col gap-2">
          {/* Flows Panel Toggle */}
          <button
            onClick={() => setShowFlows(!showFlows)}
            className={`p-2.5 backdrop-blur-xl border border-white/10 rounded-xl transition-all ${
              showFlows
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : 'bg-white/5 hover:bg-white/10 text-cyan-400'
            }`}
            title="Execution Flows & Communities"
          >
            <Zap className="h-5 w-5" />
          </button>

          {/* Chat Toggle */}
          {owner && repo && (
            <button
              onClick={() => setShowChat(!showChat)}
              className={`p-2.5 backdrop-blur-xl border border-white/10 rounded-xl transition-all ${
                showChat
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-cyan-400'
              }`}
              title="AI Chat"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl text-cyan-400 transition-all"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>

        {/* Impact Legend */}
        {impactOverlay && (
          <div className="absolute top-6 left-6 z-20 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 space-y-1.5">
            <div className="text-xs text-white/60 font-medium mb-2">IMPACT ANALYSIS</div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-white/60">Depth 1 — Direct callers ({impactOverlay.depth1.size})</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-white/60">Depth 2 — Indirect ({impactOverlay.depth2.size})</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-white/60">Depth 3 — Secondary ({impactOverlay.depth3.size})</span>
            </div>
            <button
              onClick={() => setImpactOverlay(undefined)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 mt-1"
            >
              Clear impact view
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
