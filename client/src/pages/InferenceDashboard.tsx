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

  // Generate client-side demo
  const generateClientDemo = () => {
    const demoSession: InferenceSession = {
      id: 'demo-' + Date.now(),
      title: 'Demo: Cross-Model Reasoning Transfer',
      description: 'GPT-4 → BERT → Claude inference chain',
      status: 'active',
      startedAt: Date.now(),
      nodes: [
        {
          id: 'node-gpt4',
          modelId: 'gpt-4',
          modelName: 'GPT-4',
          modelType: 'source',
          position: { x: -25, y: 0, z: 0 },
          dimension: 1024,
          color: '#10b981',
          status: 'completed',
          metadata: { provider: 'OpenAI', architecture: 'Transformer' },
        },
        {
          id: 'node-bert',
          modelId: 'bert-base',
          modelName: 'BERT Base',
          modelType: 'intermediate',
          position: { x: 0, y: 10, z: 5 },
          dimension: 768,
          color: '#3b82f6',
          status: 'completed',
          metadata: { provider: 'Google', architecture: 'Encoder' },
        },
        {
          id: 'node-claude',
          modelId: 'claude-3',
          modelName: 'Claude 3',
          modelType: 'target',
          position: { x: 25, y: 0, z: 0 },
          dimension: 1024,
          color: '#8b5cf6',
          status: 'completed',
          metadata: { provider: 'Anthropic', architecture: 'Transformer' },
        },
        {
          id: 'node-llama',
          modelId: 'llama-2',
          modelName: 'Llama 2',
          modelType: 'target',
          position: { x: 25, y: -15, z: 0 },
          dimension: 4096,
          color: '#f59e0b',
          status: 'idle',
          metadata: { provider: 'Meta', architecture: 'Transformer' },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          sourceNodeId: 'node-gpt4',
          targetNodeId: 'node-bert',
          quality: { epsilon: 0.08, informationRetention: 0.92, cosineSimilarity: 0.89 },
          status: 'completed',
          timestamp: Date.now() - 5000,
          duration: 45,
        },
        {
          id: 'edge-2',
          sourceNodeId: 'node-bert',
          targetNodeId: 'node-claude',
          quality: { epsilon: 0.05, informationRetention: 0.95, cosineSimilarity: 0.93 },
          status: 'completed',
          timestamp: Date.now() - 3000,
          duration: 38,
        },
        {
          id: 'edge-3',
          sourceNodeId: 'node-gpt4',
          targetNodeId: 'node-llama',
          quality: { epsilon: 0.15, informationRetention: 0.85, cosineSimilarity: 0.82 },
          status: 'completed',
          timestamp: Date.now() - 1000,
          duration: 62,
        },
      ],
      events: [
        {
          id: 'evt-1',
          sessionId: 'demo',
          type: 'vector_align',
          timestamp: Date.now() - 5000,
          duration: 45,
          sourceModel: 'gpt-4',
          targetModel: 'bert-base',
          inputDimension: 1024,
          outputDimension: 768,
          quality: { epsilon: 0.08, informationRetention: 0.92, cosineSimilarity: 0.89, euclideanDistance: 0.23, confidence: 0.91 },
          status: 'completed',
        },
        {
          id: 'evt-2',
          sessionId: 'demo',
          type: 'vector_align',
          timestamp: Date.now() - 3000,
          duration: 38,
          sourceModel: 'bert-base',
          targetModel: 'claude-3',
          inputDimension: 768,
          outputDimension: 1024,
          quality: { epsilon: 0.05, informationRetention: 0.95, cosineSimilarity: 0.93, euclideanDistance: 0.18, confidence: 0.94 },
          status: 'completed',
        },
        {
          id: 'evt-3',
          sessionId: 'demo',
          type: 'dimension_transform',
          timestamp: Date.now() - 1000,
          duration: 62,
          sourceModel: 'gpt-4',
          targetModel: 'llama-2',
          inputDimension: 1024,
          outputDimension: 4096,
          quality: { epsilon: 0.15, informationRetention: 0.85, cosineSimilarity: 0.82, euclideanDistance: 0.35, confidence: 0.80 },
          status: 'completed',
        },
      ],
      metrics: {
        totalTransformations: 3,
        avgEpsilon: 0.093,
        avgInformationRetention: 0.907,
        totalLatency: 145,
        successRate: 1.0,
      },
    };

    setSession(demoSession);
    toast.success('Demo session loaded');
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

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-cyan-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">
                  AI Inference Dashboard
                </h1>
                <p className="text-slate-400 text-sm">
                  Real-time visualization of cross-model reasoning and W-Matrix transformations
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Connection status */}
              <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1">
                <Activity className={`h-3 w-3 ${isConnected ? 'text-green-400' : 'text-slate-400'}`} />
                {isConnected ? 'Live' : 'Offline'}
              </Badge>
              
              {/* Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                className="gap-1"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? 'Pause' : 'Resume'}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={resetSession}
                className="gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              
              <Button
                onClick={startDemoSession}
                className="bg-cyan-600 hover:bg-cyan-700 gap-1"
              >
                <Play className="h-4 w-4" />
                Start Demo
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
