/**
 * AI Inference Dashboard
 * Real-time visualization of AI-to-AI reasoning and W-Matrix transformations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Navbar from '@/components/Navbar';
import { InferenceVisualizer } from '@/components/InferenceVisualizer';
import type {
  InferenceSession,
  InferenceNode,
  InferenceEdge,
  InferenceEvent,
  InferenceStreamMessage,
} from '../../../shared/inference-types';
import { getQualityColor, QUALITY_COLORS } from '../../../shared/inference-types';
import {
  Zap,
  Play,
  Pause,
  RotateCcw,
  Activity,
  Cpu,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Loader2,
  Network,
  Layers,
  GitBranch,
} from 'lucide-react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';

export default function InferenceDashboard() {
  const { isAuthenticated } = useAuth();
  const [session, setSession] = useState<InferenceSession | null>(null);
  const [selectedNode, setSelectedNode] = useState<InferenceNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<InferenceEdge | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [demoComplexity, setDemoComplexity] = useState<'simple' | 'medium' | 'complex'>('medium');

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io({
      path: '/api/inference/stream',
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[InferenceDashboard] Connected to inference stream');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[InferenceDashboard] Disconnected from inference stream');
      setIsConnected(false);
    });

    newSocket.on('message', (message: InferenceStreamMessage) => {
      if (!isPlaying) return;
      handleStreamMessage(message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Handle incoming stream messages
  const handleStreamMessage = useCallback((message: InferenceStreamMessage) => {
    switch (message.type) {
      case 'session_start':
        setSession(message.data as InferenceSession);
        break;
      case 'session_end':
        setSession(prev => prev ? { ...prev, ...(message.data as InferenceSession) } : null);
        break;
      case 'node_add':
      case 'node_update':
        setSession(prev => {
          if (!prev) return null;
          const node = message.data as InferenceNode;
          const existingIndex = prev.nodes.findIndex(n => n.id === node.id);
          const nodes = existingIndex >= 0
            ? prev.nodes.map((n, i) => i === existingIndex ? node : n)
            : [...prev.nodes, node];
          return { ...prev, nodes };
        });
        break;
      case 'edge_add':
      case 'edge_update':
        setSession(prev => {
          if (!prev) return null;
          const edge = message.data as InferenceEdge;
          const existingIndex = prev.edges.findIndex(e => e.id === edge.id);
          const edges = existingIndex >= 0
            ? prev.edges.map((e, i) => i === existingIndex ? edge : e)
            : [...prev.edges, edge];
          return { ...prev, edges };
        });
        break;
      case 'event':
        setSession(prev => {
          if (!prev) return null;
          const event = message.data as InferenceEvent;
          return { ...prev, events: [...prev.events, event] };
        });
        break;
      case 'metrics_update':
        setSession(prev => {
          if (!prev) return null;
          return { ...prev, metrics: message.data as InferenceSession['metrics'] };
        });
        break;
    }
  }, [isPlaying]);

  // Start demo session
  const startDemoSession = async () => {
    try {
      const response = await fetch('/api/inference/demo', { method: 'POST' });
      const data = await response.json();
      if (data.session) {
        setSession(data.session);
        toast.success('Demo session started');
      }
    } catch (error) {
      // Generate client-side demo if API not available
      generateClientDemo();
    }
  };

  // Generate client-side demo with configurable complexity
  const generateClientDemo = () => {
    // Model definitions with layer information
    const modelDefs = {
      'gpt-4': { name: 'GPT-4', color: '#10b981', provider: 'OpenAI', dim: 1024, layers: 96 },
      'gpt-3.5': { name: 'GPT-3.5', color: '#34d399', provider: 'OpenAI', dim: 768, layers: 48 },
      'claude-3': { name: 'Claude 3', color: '#8b5cf6', provider: 'Anthropic', dim: 1024, layers: 80 },
      'claude-2': { name: 'Claude 2', color: '#a78bfa', provider: 'Anthropic', dim: 768, layers: 64 },
      'bert-base': { name: 'BERT Base', color: '#3b82f6', provider: 'Google', dim: 768, layers: 12 },
      'bert-large': { name: 'BERT Large', color: '#2563eb', provider: 'Google', dim: 1024, layers: 24 },
      'llama-2-70b': { name: 'Llama 2 70B', color: '#f59e0b', provider: 'Meta', dim: 8192, layers: 80 },
      'llama-2-13b': { name: 'Llama 2 13B', color: '#fbbf24', provider: 'Meta', dim: 5120, layers: 40 },
      'mistral-7b': { name: 'Mistral 7B', color: '#ec4899', provider: 'Mistral', dim: 4096, layers: 32 },
      'gemini-pro': { name: 'Gemini Pro', color: '#06b6d4', provider: 'Google', dim: 1024, layers: 64 },
      'phi-2': { name: 'Phi-2', color: '#84cc16', provider: 'Microsoft', dim: 2560, layers: 32 },
      'qwen-72b': { name: 'Qwen 72B', color: '#f97316', provider: 'Alibaba', dim: 8192, layers: 80 },
    };

    // Network configurations by complexity
    const configs = {
      simple: {
        title: 'Simple: GPT-4 → Claude Transfer',
        models: ['gpt-4', 'claude-3'],
        connections: [['gpt-4', 'claude-3']],
      },
      medium: {
        title: 'Medium: Multi-Model Reasoning Chain',
        models: ['gpt-4', 'bert-base', 'claude-3', 'llama-2-13b', 'mistral-7b'],
        connections: [
          ['gpt-4', 'bert-base'],
          ['bert-base', 'claude-3'],
          ['gpt-4', 'llama-2-13b'],
          ['llama-2-13b', 'mistral-7b'],
          ['bert-base', 'mistral-7b'],
        ],
      },
      complex: {
        title: 'Complex: Enterprise AI Mesh Network',
        models: ['gpt-4', 'gpt-3.5', 'claude-3', 'claude-2', 'bert-base', 'bert-large', 'llama-2-70b', 'llama-2-13b', 'mistral-7b', 'gemini-pro', 'phi-2', 'qwen-72b'],
        connections: [
          // GPT family connections
          ['gpt-4', 'gpt-3.5'],
          ['gpt-4', 'bert-large'],
          ['gpt-3.5', 'bert-base'],
          // Claude family
          ['claude-3', 'claude-2'],
          ['claude-3', 'bert-large'],
          ['claude-2', 'bert-base'],
          // Cross-family transfers
          ['gpt-4', 'claude-3'],
          ['gpt-4', 'llama-2-70b'],
          ['claude-3', 'llama-2-70b'],
          ['bert-large', 'gemini-pro'],
          // Llama family
          ['llama-2-70b', 'llama-2-13b'],
          ['llama-2-13b', 'mistral-7b'],
          ['llama-2-70b', 'qwen-72b'],
          // Smaller models
          ['bert-base', 'phi-2'],
          ['mistral-7b', 'phi-2'],
          ['gemini-pro', 'mistral-7b'],
          ['qwen-72b', 'gemini-pro'],
        ],
      },
    };

    const config = configs[demoComplexity];
    
    // Calculate node positions in a circular/hierarchical layout
    const calculatePosition = (index: number, total: number, modelId: string): { x: number; y: number; z: number } => {
      const def = modelDefs[modelId as keyof typeof modelDefs];
      
      if (demoComplexity === 'simple') {
        return { x: index === 0 ? -20 : 20, y: 0, z: 0 };
      }
      
      if (demoComplexity === 'medium') {
        // Layered layout
        const layers = [
          ['gpt-4'],
          ['bert-base', 'llama-2-13b'],
          ['claude-3', 'mistral-7b'],
        ];
        for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
          const layerModels = layers[layerIdx];
          const modelIdx = layerModels.indexOf(modelId);
          if (modelIdx >= 0) {
            const x = (layerIdx - 1) * 25;
            const y = (modelIdx - (layerModels.length - 1) / 2) * 20;
            const z = Math.sin(layerIdx) * 5;
            return { x, y, z };
          }
        }
      }
      
      // Complex: 3D spherical distribution
      const phi = Math.acos(-1 + (2 * index) / total);
      const theta = Math.sqrt(total * Math.PI) * phi;
      const radius = 35 + (def?.layers || 32) / 10;
      
      return {
        x: radius * Math.cos(theta) * Math.sin(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(phi) * 0.5,
      };
    };

    // Create nodes
    const nodes: InferenceNode[] = config.models.map((modelId, index) => {
      const def = modelDefs[modelId as keyof typeof modelDefs];
      const pos = calculatePosition(index, config.models.length, modelId);
      
      return {
        id: `node-${modelId}`,
        modelId,
        modelName: def?.name || modelId,
        modelType: index === 0 ? 'source' : index === config.models.length - 1 ? 'target' : 'intermediate',
        position: pos,
        dimension: def?.dim || 768,
        color: def?.color || '#6366f1',
        status: 'completed',
        metadata: {
          provider: def?.provider || 'Unknown',
          architecture: 'Transformer',
          layers: def?.layers || 32,
        },
      };
    });

    // Create edges with realistic quality metrics
    const edges: InferenceEdge[] = config.connections.map(([src, tgt], index) => {
      const srcDef = modelDefs[src as keyof typeof modelDefs];
      const tgtDef = modelDefs[tgt as keyof typeof modelDefs];
      
      // Calculate quality based on dimension compatibility
      const dimRatio = Math.min(srcDef?.dim || 768, tgtDef?.dim || 768) / Math.max(srcDef?.dim || 768, tgtDef?.dim || 768);
      const baseEpsilon = 0.02 + (1 - dimRatio) * 0.15 + Math.random() * 0.05;
      const infoRetention = 0.98 - baseEpsilon - Math.random() * 0.05;
      
      return {
        id: `edge-${index}`,
        sourceNodeId: `node-${src}`,
        targetNodeId: `node-${tgt}`,
        wMatrixId: `wm-${src}-${tgt}`,
        quality: {
          epsilon: Math.min(0.3, Math.max(0.02, baseEpsilon)),
          informationRetention: Math.max(0.7, Math.min(0.98, infoRetention)),
          cosineSimilarity: Math.max(0.75, Math.min(0.98, 1 - baseEpsilon * 1.5)),
        },
        status: 'completed',
        timestamp: Date.now() - (config.connections.length - index) * 1000,
        duration: 20 + Math.floor(Math.random() * 80),
      };
    });

    // Create events
    const events: InferenceEvent[] = edges.map((edge, index) => {
      const srcNode = nodes.find(n => n.id === edge.sourceNodeId);
      const tgtNode = nodes.find(n => n.id === edge.targetNodeId);
      
      return {
        id: `evt-${index}`,
        sessionId: 'demo',
        type: srcNode?.dimension !== tgtNode?.dimension ? 'dimension_transform' : 'vector_align',
        timestamp: edge.timestamp,
        duration: edge.duration,
        sourceModel: srcNode?.modelId || '',
        targetModel: tgtNode?.modelId || '',
        inputDimension: srcNode?.dimension || 768,
        outputDimension: tgtNode?.dimension || 768,
        quality: {
          ...edge.quality,
          euclideanDistance: edge.quality.epsilon * 2,
          confidence: edge.quality.informationRetention,
        },
        status: 'completed',
        wMatrix: {
          id: edge.wMatrixId || '',
          sourceModel: srcNode?.modelId || '',
          targetModel: tgtNode?.modelId || '',
          method: 'learned',
        },
      };
    });

    // Calculate metrics
    const avgEpsilon = edges.reduce((sum, e) => sum + e.quality.epsilon, 0) / edges.length;
    const avgRetention = edges.reduce((sum, e) => sum + e.quality.informationRetention, 0) / edges.length;
    const totalLatency = edges.reduce((sum, e) => sum + (e.duration || 0), 0);

    const demoSession: InferenceSession = {
      id: 'demo-' + Date.now(),
      title: config.title,
      description: `${nodes.length} models, ${edges.length} W-Matrix transformations`,
      status: 'completed',
      startedAt: Date.now() - totalLatency,
      completedAt: Date.now(),
      nodes,
      edges,
      events,
      metrics: {
        totalTransformations: edges.length,
        avgEpsilon,
        avgInformationRetention: avgRetention,
        totalLatency,
        successRate: 1.0,
      },
    };

    setSession(demoSession);
    toast.success(`Loaded ${demoComplexity} demo: ${nodes.length} models, ${edges.length} connections`);
  };

  // Reset session
  const resetSession = () => {
    setSession(null);
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  // Handle node click
  const handleNodeClick = (node: InferenceNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    toast.info(`Selected: ${node.modelName}`);
  };

  // Handle edge click
  const handleEdgeClick = (edge: InferenceEdge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Get quality badge
  const getQualityBadge = (epsilon: number) => {
    const color = getQualityColor(epsilon);
    const label = epsilon < 0.05 ? 'Excellent' : epsilon < 0.1 ? 'Good' : epsilon < 0.2 ? 'Fair' : 'Poor';
    return (
      <Badge style={{ backgroundColor: color, color: '#fff' }}>
        ε = {epsilon.toFixed(3)} ({label})
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 pt-20 pb-8">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Network className="h-7 w-7 text-cyan-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  AI Inference Network
                </h1>
                <p className="text-slate-400 text-xs">
                  Cross-model reasoning visualization with W-Matrix transformations
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Connection status */}
              <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1 text-xs">
                <Activity className={`h-3 w-3 ${isConnected ? 'text-green-400' : 'text-slate-400'}`} />
                {isConnected ? 'Live' : 'Demo'}
              </Badge>
              
              {/* Complexity selector */}
              <div className="flex rounded-md overflow-hidden border border-slate-700">
                {(['simple', 'medium', 'complex'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setDemoComplexity(level)}
                    className={`px-2 py-1 text-xs capitalize transition-colors ${
                      demoComplexity === level
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              
              {/* Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                className="gap-1 h-7 text-xs"
              >
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={resetSession}
                className="gap-1 h-7 text-xs"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
              
              <Button
                onClick={startDemoSession}
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 gap-1 h-7 text-xs"
              >
                <Play className="h-3 w-3" />
                Load Demo
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Visualizer */}
          <div className="lg:col-span-3">
            <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
              <div className="h-[600px]">
                {session ? (
                  <InferenceVisualizer
                    session={session}
                    onNodeClick={handleNodeClick}
                    onEdgeClick={handleEdgeClick}
                    backgroundColor="#0a0e27"
                    autoRotate={false}
                    showLabels={true}
                    showGrid={true}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <Cpu className="h-16 w-16 mb-4 opacity-50" />
                    <p className="text-lg mb-2">No active inference session</p>
                    <p className="text-sm mb-4">Click "Start Demo" to see AI-to-AI reasoning in action</p>
                    <Button onClick={startDemoSession} className="bg-cyan-600 hover:bg-cyan-700">
                      <Play className="h-4 w-4 mr-2" />
                      Start Demo Session
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Event Timeline */}
            {session && session.events.length > 0 && (
              <Card className="mt-4 p-4 bg-slate-900/50 border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Event Timeline
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {session.events.slice(-10).reverse().map(event => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-2 rounded bg-slate-800/50 text-sm"
                    >
                      {event.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                      ) : event.status === 'failed' ? (
                        <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                      ) : (
                        <Loader2 className="h-4 w-4 text-cyan-400 animate-spin flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{event.sourceModel}</span>
                          <ArrowRight className="h-3 w-3 text-slate-500" />
                          <span className="text-white font-medium">{event.targetModel || 'N/A'}</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {event.type.replace('_', ' ')} • {event.inputDimension}D → {event.outputDimension}D
                        </div>
                      </div>
                      {event.quality && (
                        <div className="text-right flex-shrink-0">
                          {getQualityBadge(event.quality.epsilon)}
                        </div>
                      )}
                      {event.duration && (
                        <span className="text-xs text-slate-500 flex-shrink-0">
                          {formatDuration(event.duration)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Session Metrics */}
            {session && (
              <Card className="p-4 bg-slate-900/50 border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Session Metrics
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Avg. Epsilon (ε)</span>
                      <span className="text-cyan-400">{session.metrics.avgEpsilon.toFixed(4)}</span>
                    </div>
                    <Progress
                      value={(1 - session.metrics.avgEpsilon) * 100}
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Info Retention</span>
                      <span className="text-cyan-400">{(session.metrics.avgInformationRetention * 100).toFixed(1)}%</span>
                    </div>
                    <Progress
                      value={session.metrics.avgInformationRetention * 100}
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Success Rate</span>
                      <span className="text-cyan-400">{(session.metrics.successRate * 100).toFixed(0)}%</span>
                    </div>
                    <Progress
                      value={session.metrics.successRate * 100}
                      className="h-2"
                    />
                  </div>
                  <div className="pt-2 border-t border-slate-700 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Transformations</span>
                      <div className="text-white font-semibold">{session.metrics.totalTransformations}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Total Latency</span>
                      <div className="text-white font-semibold">{formatDuration(session.metrics.totalLatency)}</div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Selected Node Info */}
            {selectedNode && (
              <Card className="p-4 bg-slate-900/50 border-slate-800 border-cyan-500/50">
                <h3 className="text-sm font-semibold text-white mb-3">
                  Selected Model
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedNode.color }}
                    />
                    <span className="text-white font-medium">{selectedNode.modelName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Type</span>
                      <div className="text-white capitalize">{selectedNode.modelType}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Dimension</span>
                      <div className="text-white">{selectedNode.dimension}D</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Status</span>
                      <div className="text-white capitalize">{selectedNode.status}</div>
                    </div>
                    {selectedNode.metadata?.provider && (
                      <div>
                        <span className="text-slate-400">Provider</span>
                        <div className="text-white">{selectedNode.metadata.provider}</div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Selected Edge Info */}
            {selectedEdge && (
              <Card className="p-4 bg-slate-900/50 border-slate-800 border-cyan-500/50">
                <h3 className="text-sm font-semibold text-white mb-3">
                  W-Matrix Transformation
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    {getQualityBadge(selectedEdge.quality.epsilon)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Info Retention</span>
                      <div className="text-white">{(selectedEdge.quality.informationRetention * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Cosine Similarity</span>
                      <div className="text-white">{selectedEdge.quality.cosineSimilarity.toFixed(3)}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Status</span>
                      <div className="text-white capitalize">{selectedEdge.status}</div>
                    </div>
                    {selectedEdge.duration && (
                      <div>
                        <span className="text-slate-400">Duration</span>
                        <div className="text-white">{formatDuration(selectedEdge.duration)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Quality Legend */}
            <Card className="p-4 bg-slate-900/50 border-slate-800">
              <h3 className="text-sm font-semibold text-white mb-3">Quality Legend (ε)</h3>
              <div className="space-y-2 text-xs">
                {Object.entries(QUALITY_COLORS).map(([label, color]) => (
                  <div key={label} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-slate-300 capitalize">{label}</span>
                    <span className="text-slate-500 ml-auto">
                      {label === 'excellent' && '< 0.05'}
                      {label === 'good' && '< 0.10'}
                      {label === 'fair' && '< 0.20'}
                      {label === 'poor' && '< 0.30'}
                      {label === 'bad' && '≥ 0.30'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Controls */}
            <Card className="p-4 bg-slate-900/50 border-slate-800">
              <h3 className="text-sm font-semibold text-white mb-3">Controls</h3>
              <ul className="space-y-1 text-xs text-slate-400">
                <li>Drag to rotate view</li>
                <li>Scroll to zoom</li>
                <li>Click node to select</li>
                <li>Click edge to see quality</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
