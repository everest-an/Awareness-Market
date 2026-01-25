/**
 * AI-to-AI Inference Types
 * Types for visualizing cross-model reasoning and W-Matrix transformations
 */

// Inference node representing an AI model in the visualization
export interface InferenceNode {
  id: string;
  modelId: string;
  modelName: string;
  modelType: 'source' | 'target' | 'intermediate';
  position: { x: number; y: number; z: number };
  dimension: number;
  color: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  metadata?: {
    architecture?: string;
    provider?: string;
    latency?: number;
  };
}

// Edge representing a W-Matrix transformation between models
export interface InferenceEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  wMatrixId?: string;
  quality: {
    epsilon: number;           // Alignment loss (0-1, lower is better)
    informationRetention: number; // How much info preserved (0-1)
    cosineSimilarity: number;  // Vector similarity after transform
  };
  status: 'pending' | 'transforming' | 'completed' | 'failed';
  timestamp: number;
  duration?: number;
}

// A single inference event in the reasoning chain
export interface InferenceEvent {
  id: string;
  sessionId: string;
  type: InferenceEventType;
  timestamp: number;
  duration?: number;
  
  // Source and target
  sourceModel: string;
  targetModel?: string;
  
  // Vector data
  inputVector?: number[];
  outputVector?: number[];
  inputDimension?: number;
  outputDimension?: number;
  
  // Quality metrics
  quality?: {
    epsilon: number;
    informationRetention: number;
    cosineSimilarity: number;
    euclideanDistance: number;
    confidence: number;
  };
  
  // W-Matrix info
  wMatrix?: {
    id: string;
    sourceModel: string;
    targetModel: string;
    method: 'linear' | 'nonlinear' | 'learned';
  };
  
  // Status
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  
  // Metadata
  metadata?: Record<string, any>;
}

export type InferenceEventType =
  | 'vector_align'        // W-Matrix alignment between models
  | 'dimension_transform' // Dimension change (e.g., 768 -> 1024)
  | 'memory_transfer'     // KV-Cache transfer
  | 'chain_step'          // Reasoning chain step
  | 'model_invoke'        // Model invocation
  | 'package_load'        // Package loaded
  | 'validation';         // Vector validation

// Inference session containing multiple events
export interface InferenceSession {
  id: string;
  userId?: number;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  
  // Nodes and edges for visualization
  nodes: InferenceNode[];
  edges: InferenceEdge[];
  events: InferenceEvent[];
  
  // Aggregate metrics
  metrics: {
    totalTransformations: number;
    avgEpsilon: number;
    avgInformationRetention: number;
    totalLatency: number;
    successRate: number;
  };
}

// WebSocket message for real-time updates
export interface InferenceStreamMessage {
  type: 'node_add' | 'node_update' | 'edge_add' | 'edge_update' | 'event' | 'session_start' | 'session_end' | 'metrics_update';
  sessionId: string;
  data: InferenceNode | InferenceEdge | InferenceEvent | InferenceSession | InferenceSession['metrics'];
  timestamp: number;
}

// Color scheme for quality visualization
export const QUALITY_COLORS = {
  excellent: '#22c55e', // Green - epsilon < 0.05
  good: '#84cc16',      // Lime - epsilon < 0.1
  fair: '#eab308',      // Yellow - epsilon < 0.2
  poor: '#f97316',      // Orange - epsilon < 0.3
  bad: '#ef4444',       // Red - epsilon >= 0.3
} as const;

// Get color based on epsilon value
export function getQualityColor(epsilon: number): string {
  if (epsilon < 0.05) return QUALITY_COLORS.excellent;
  if (epsilon < 0.1) return QUALITY_COLORS.good;
  if (epsilon < 0.2) return QUALITY_COLORS.fair;
  if (epsilon < 0.3) return QUALITY_COLORS.poor;
  return QUALITY_COLORS.bad;
}

// Model colors for visualization
export const MODEL_COLORS: Record<string, string> = {
  'gpt-4': '#10b981',
  'gpt-3.5': '#34d399',
  'claude': '#8b5cf6',
  'claude-3': '#a78bfa',
  'llama': '#f59e0b',
  'llama-2': '#fbbf24',
  'bert': '#3b82f6',
  'mistral': '#ec4899',
  'gemini': '#06b6d4',
  'default': '#6366f1',
};

export function getModelColor(modelId: string): string {
  const lowerModel = modelId.toLowerCase();
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (lowerModel.includes(key)) return color;
  }
  return MODEL_COLORS.default;
}
