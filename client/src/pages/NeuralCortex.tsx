/**
 * Neural Cortex - LatentMAS AI Knowledge Network Visualization
 * Displays the "brain" of the AI network with knowledge clusters
 */

import React, { useState, useCallback } from 'react';
import { NeuralCortexVisualizer, KnowledgeDomain } from '@/components/NeuralCortexVisualizer';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

// LatentMAS knowledge domains
const LATENTMAS_DOMAINS: KnowledgeDomain[] = [
  // Core AI domains
  { id: 'artificial-intelligence', name: 'ARTIFICIAL INTELLIGENCE', color: '#a855f7', nodeCount: 1500, center: [-10, 25, 5], spread: 20 },
  { id: 'machine-learning', name: 'MACHINE LEARNING', color: '#8b5cf6', nodeCount: 1200, center: [-25, 20, 10], spread: 16 },
  { id: 'deep-learning', name: 'DEEP LEARNING', color: '#7c3aed', nodeCount: 1000, center: [-20, 35, 0], spread: 14 },
  { id: 'neural-networks', name: 'NEURAL NETWORKS', color: '#6366f1', nodeCount: 900, center: [-5, 15, 15], spread: 12 },
  
  // Reasoning & Logic
  { id: 'reasoning-chains', name: 'REASONING CHAINS', color: '#22c55e', nodeCount: 800, center: [30, 20, 5], spread: 12 },
  { id: 'logic-systems', name: 'LOGIC SYSTEMS', color: '#10b981', nodeCount: 600, center: [40, 10, 10], spread: 10 },
  { id: 'game-theory', name: 'GAME THEORY', color: '#14b8a6', nodeCount: 500, center: [35, 30, -5], spread: 9 },
  
  // Memory & Knowledge
  { id: 'kv-cache', name: 'KV-CACHE MEMORY', color: '#06b6d4', nodeCount: 1100, center: [15, -15, 10], spread: 15 },
  { id: 'semantic-memory', name: 'SEMANTIC MEMORY', color: '#0ea5e9', nodeCount: 900, center: [5, -25, 5], spread: 13 },
  { id: 'episodic-memory', name: 'EPISODIC MEMORY', color: '#3b82f6', nodeCount: 700, center: [25, -20, 0], spread: 11 },
  
  // Vector Operations
  { id: 'vector-embeddings', name: 'VECTOR EMBEDDINGS', color: '#f59e0b', nodeCount: 1300, center: [-35, -10, 0], spread: 18 },
  { id: 'w-matrix', name: 'W-MATRIX TRANSFORMS', color: '#f97316', nodeCount: 800, center: [-45, 0, 10], spread: 12 },
  { id: 'latent-space', name: 'LATENT SPACE', color: '#fb923c', nodeCount: 1000, center: [-30, -20, 5], spread: 14 },
  
  // Language & NLP
  { id: 'natural-language', name: 'NATURAL LANGUAGE', color: '#ec4899', nodeCount: 1100, center: [0, 40, -10], spread: 15 },
  { id: 'tokenization', name: 'TOKENIZATION', color: '#f43f5e', nodeCount: 600, center: [10, 45, 0], spread: 10 },
  { id: 'attention-mechanism', name: 'ATTENTION MECHANISM', color: '#e11d48', nodeCount: 850, center: [-15, 45, 5], spread: 12 },
  
  // Multi-Agent Systems
  { id: 'agent-communication', name: 'AGENT COMMUNICATION', color: '#84cc16', nodeCount: 750, center: [45, -5, -10], spread: 11 },
  { id: 'consensus-protocols', name: 'CONSENSUS PROTOCOLS', color: '#a3e635', nodeCount: 500, center: [50, 5, 0], spread: 9 },
  { id: 'swarm-intelligence', name: 'SWARM INTELLIGENCE', color: '#bef264', nodeCount: 600, center: [55, -15, 5], spread: 10 },
  
  // Specialized Domains
  { id: 'computer-vision', name: 'COMPUTER VISION', color: '#d946ef', nodeCount: 900, center: [-50, 15, -5], spread: 13 },
  { id: 'robotics', name: 'ROBOTICS', color: '#c026d3', nodeCount: 700, center: [-55, 5, 5], spread: 11 },
  { id: 'quantum-computing', name: 'QUANTUM COMPUTING', color: '#a21caf', nodeCount: 500, center: [-60, -5, 0], spread: 9 },
  
  // Knowledge Domains
  { id: 'mathematics', name: 'MATHEMATICS', color: '#eab308', nodeCount: 800, center: [20, 0, 20], spread: 12 },
  { id: 'physics', name: 'PHYSICS', color: '#facc15', nodeCount: 700, center: [10, 5, 25], spread: 11 },
  { id: 'biology', name: 'BIOLOGY', color: '#fde047', nodeCount: 600, center: [30, -5, 15], spread: 10 },
];

export default function NeuralCortex() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomain | null>(null);

  const handleDomainClick = useCallback((domain: KnowledgeDomain) => {
    setSelectedDomain(domain);
    setSearchQuery(domain.name.toLowerCase());
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-green-400 font-mono text-sm tracking-wider">
              PROJECT GOLEM // ACTIVE RETRIEVAL
            </h1>
            <p className="text-green-600 font-mono text-xs mt-1">
              LATENTMAS CORTEX: MIND IN CONTEXT
            </p>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="mt-4 max-w-md">
          <div className="relative">
            <Input
              type="text"
              placeholder="ask how robots connect to the renaissance"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border border-green-600 text-green-400 font-mono text-sm placeholder:text-green-800 focus:border-green-400 focus:ring-0 pr-10"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
          </div>
        </div>
      </div>

      {/* Main Visualizer */}
      <NeuralCortexVisualizer
        domains={LATENTMAS_DOMAINS}
        searchQuery={searchQuery}
        onDomainClick={handleDomainClick}
        showLabels={true}
        particleSize={0.12}
        connectionOpacity={0.08}
      />

      {/* Bottom Info */}
      <div className="absolute bottom-4 left-4 font-mono text-xs text-green-600">
        <div>Total Nodes: {LATENTMAS_DOMAINS.reduce((sum, d) => sum + d.nodeCount, 0).toLocaleString()}</div>
        <div>Knowledge Domains: {LATENTMAS_DOMAINS.length}</div>
        <div className="mt-2 text-green-800">
          Drag to rotate • Scroll to zoom • Click domain to filter
        </div>
      </div>

      {/* Selected Domain Info */}
      {selectedDomain && (
        <div className="absolute bottom-4 right-4 font-mono text-xs text-right">
          <div className="text-green-400">{selectedDomain.name}</div>
          <div className="text-green-600">{selectedDomain.nodeCount} nodes</div>
          <div 
            className="w-3 h-3 rounded-full mt-1 ml-auto"
            style={{ backgroundColor: selectedDomain.color }}
          />
        </div>
      )}
    </div>
  );
}
