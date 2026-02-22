/**
 * Neural Cortex - Awareness AI Knowledge Network Visualization
 * Neural Bridge Multi-Agent Neural Network Visualizer
 */

import { useState, useCallback, useEffect } from 'react';
import { NeuralCortexVisualizer, AgentNode, CortexNode } from '@/components/NeuralCortexVisualizer';
import { Maximize2, Minimize2 } from 'lucide-react';
import Navbar from '@/components/Navbar';

// Default AI agent nodes — representative of supported model families on the platform
const AI_AGENTS: AgentNode[] = [
  { id: 'gpt-4', name: 'GPT-4', model: 'gpt', position: [0, 0, 0], color: '#a855f7', activity: 0.92, status: 'thinking' },
  { id: 'claude', name: 'Claude', model: 'claude', position: [30, 15, 10], color: '#06b6d4', activity: 0.88, status: 'transferring' },
  { id: 'llama', name: 'Llama', model: 'llama', position: [-25, -20, 15], color: '#f97316', activity: 0.7, status: 'thinking' },
  { id: 'gemini', name: 'Gemini', model: 'gemini', position: [20, -30, -10], color: '#22c55e', activity: 0.6, status: 'idle' },
  { id: 'mistral', name: 'Mistral', model: 'mistral', position: [-15, 25, -20], color: '#ec4899', activity: 0.5, status: 'idle' },
  { id: 'qwen', name: 'Qwen', model: 'qwen', position: [10, -15, 25], color: '#eab308', activity: 0.55, status: 'idle' },
  { id: 'deepseek', name: 'DeepSeek', model: 'deepseek', position: [-20, 10, -15], color: '#14b8a6', activity: 0.65, status: 'thinking' },
];

export default function NeuralCortex() {
  const [selectedNode, setSelectedNode] = useState<CortexNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  const handleNodeClick = useCallback((node: CortexNode | null) => {
    setSelectedNode(node);
  }, []);

  const handleAgentToggle = useCallback((agentId: string) => {
    setSelectedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }, []);

  const handleCategoryToggle = useCallback((category: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
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
      {/* Navbar - hidden in fullscreen */}
      {!isFullscreen && <Navbar />}
      
      {/* Main Content */}
      <div className={`relative ${isFullscreen ? 'h-screen' : 'h-[calc(100vh-64px)]'}`}>
        {/* Main Visualizer */}
        <div className="absolute inset-0">
          <NeuralCortexVisualizer
            agents={AI_AGENTS}
            onNodeClick={handleNodeClick}
            showLabels={true}
            selectedAgents={selectedAgents}
            selectedCategories={selectedCategories}
            onAgentToggle={handleAgentToggle}
            onCategoryToggle={handleCategoryToggle}
            onClearFilters={handleClearFilters}
          />
        </div>

        {/* Fullscreen Toggle - bottom right, above zoom controls */}
        <button
          onClick={toggleFullscreen}
          className="absolute bottom-[168px] right-6 z-20 p-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl text-cyan-400 transition-all"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>

        {/* Selected Node Detail Panel - bottom left corner */}
        {selectedNode && (
          <div className="absolute bottom-6 left-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl px-5 py-4 z-10 max-w-[280px]">
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
              <div className="flex justify-between">
                <span className="text-white/50">Title</span>
                <span className="text-white font-medium">{selectedNode.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Category</span>
                <span className="text-white">{selectedNode.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Agent</span>
                <span className="text-white">{AI_AGENTS.find(a => a.id === selectedNode.agentId)?.name}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="text-white/40 text-[10px] mb-1">INFERENCE</div>
              <div className="text-cyan-400 text-xs">
                KV: hit • Attn: {(Math.random() * 0.5 + 0.5).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
