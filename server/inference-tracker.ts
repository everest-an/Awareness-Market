/**
 * Inference Tracker - Server-side tracking for AI-to-AI inference events
 * Integrates with LatentMAS API to track vector alignments and transformations
 */

import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import type {
  InferenceSession,
  InferenceNode,
  InferenceEdge,
  InferenceEvent,
  InferenceEventType,
  InferenceStreamMessage,
} from '../shared/inference-types';
import { getModelColor, getQualityColor } from '../shared/inference-types';

class InferenceTracker extends EventEmitter {
  private sessions: Map<string, InferenceSession> = new Map();
  
  /**
   * Create a new inference session
   */
  createSession(params: {
    userId?: number;
    title: string;
    description?: string;
  }): InferenceSession {
    const session: InferenceSession = {
      id: nanoid(),
      userId: params.userId,
      title: params.title,
      description: params.description,
      status: 'active',
      startedAt: Date.now(),
      nodes: [],
      edges: [],
      events: [],
      metrics: {
        totalTransformations: 0,
        avgEpsilon: 0,
        avgInformationRetention: 1,
        totalLatency: 0,
        successRate: 1,
      },
    };
    
    this.sessions.set(session.id, session);
    
    this.broadcast(session.id, {
      type: 'session_start',
      sessionId: session.id,
      data: session,
      timestamp: Date.now(),
    });
    
    console.log(`[InferenceTracker] Created session: ${session.id}`);
    return session;
  }
  
  /**
   * Add a model node to the session
   */
  addNode(sessionId: string, params: {
    modelId: string;
    modelName: string;
    modelType: 'source' | 'target' | 'intermediate';
    dimension: number;
    metadata?: Record<string, any>;
  }): InferenceNode | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    // Check if node already exists
    const existing = session.nodes.find(n => n.modelId === params.modelId);
    if (existing) return existing;
    
    // Calculate position based on model type and existing nodes
    const position = this.calculateNodePosition(session, params.modelType);
    
    const node: InferenceNode = {
      id: nanoid(),
      modelId: params.modelId,
      modelName: params.modelName,
      modelType: params.modelType,
      position,
      dimension: params.dimension,
      color: getModelColor(params.modelId),
      status: 'idle',
      metadata: params.metadata,
    };
    
    session.nodes.push(node);
    
    this.broadcast(sessionId, {
      type: 'node_add',
      sessionId,
      data: node,
      timestamp: Date.now(),
    });
    
    return node;
  }
  
  /**
   * Calculate node position for 3D visualization
   */
  private calculateNodePosition(
    session: InferenceSession,
    modelType: 'source' | 'target' | 'intermediate'
  ): { x: number; y: number; z: number } {
    const sourceNodes = session.nodes.filter(n => n.modelType === 'source');
    const targetNodes = session.nodes.filter(n => n.modelType === 'target');
    const intermediateNodes = session.nodes.filter(n => n.modelType === 'intermediate');
    
    const spacing = 15;
    
    switch (modelType) {
      case 'source':
        return {
          x: -20,
          y: sourceNodes.length * spacing - (sourceNodes.length * spacing) / 2,
          z: 0,
        };
      case 'target':
        return {
          x: 20,
          y: targetNodes.length * spacing - (targetNodes.length * spacing) / 2,
          z: 0,
        };
      case 'intermediate':
        return {
          x: 0,
          y: intermediateNodes.length * spacing - (intermediateNodes.length * spacing) / 2,
          z: 10,
        };
    }
  }
  
  /**
   * Track a vector alignment event
   */
  trackAlignment(sessionId: string, params: {
    sourceModel: string;
    targetModel: string;
    inputVector: number[];
    outputVector: number[];
    quality: {
      epsilon: number;
      informationRetention: number;
      cosineSimilarity: number;
      euclideanDistance: number;
      confidence: number;
    };
    wMatrix?: {
      id: string;
      method: 'linear' | 'nonlinear' | 'learned';
    };
    duration: number;
  }): { event: InferenceEvent; edge: InferenceEdge } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    // Ensure nodes exist
    let sourceNode = session.nodes.find(n => n.modelId === params.sourceModel);
    let targetNode = session.nodes.find(n => n.modelId === params.targetModel);
    
    if (!sourceNode) {
      sourceNode = this.addNode(sessionId, {
        modelId: params.sourceModel,
        modelName: params.sourceModel,
        modelType: 'source',
        dimension: params.inputVector.length,
      })!;
    }
    
    if (!targetNode) {
      targetNode = this.addNode(sessionId, {
        modelId: params.targetModel,
        modelName: params.targetModel,
        modelType: 'target',
        dimension: params.outputVector.length,
      })!;
    }
    
    // Update node status
    sourceNode.status = 'completed';
    targetNode.status = 'completed';
    
    // Create edge
    const edge: InferenceEdge = {
      id: nanoid(),
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      wMatrixId: params.wMatrix?.id,
      quality: {
        epsilon: params.quality.epsilon,
        informationRetention: params.quality.informationRetention,
        cosineSimilarity: params.quality.cosineSimilarity,
      },
      status: 'completed',
      timestamp: Date.now(),
      duration: params.duration,
    };
    
    session.edges.push(edge);
    
    // Create event
    const event: InferenceEvent = {
      id: nanoid(),
      sessionId,
      type: 'vector_align',
      timestamp: Date.now(),
      duration: params.duration,
      sourceModel: params.sourceModel,
      targetModel: params.targetModel,
      inputVector: params.inputVector.slice(0, 10), // Store first 10 dims only
      outputVector: params.outputVector.slice(0, 10),
      inputDimension: params.inputVector.length,
      outputDimension: params.outputVector.length,
      quality: params.quality,
      wMatrix: params.wMatrix ? {
        id: params.wMatrix.id,
        sourceModel: params.sourceModel,
        targetModel: params.targetModel,
        method: params.wMatrix.method,
      } : undefined,
      status: 'completed',
    };
    
    session.events.push(event);
    
    // Update metrics
    this.updateMetrics(session);
    
    // Broadcast updates
    this.broadcast(sessionId, {
      type: 'edge_add',
      sessionId,
      data: edge,
      timestamp: Date.now(),
    });
    
    this.broadcast(sessionId, {
      type: 'event',
      sessionId,
      data: event,
      timestamp: Date.now(),
    });
    
    return { event, edge };
  }
  
  /**
   * Track a dimension transformation event
   */
  trackTransformation(sessionId: string, params: {
    sourceModel: string;
    inputDimension: number;
    outputDimension: number;
    method: 'pca' | 'autoencoder' | 'interpolation';
    quality: {
      informationRetention: number;
      reconstructionError: number;
    };
    duration: number;
  }): InferenceEvent | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    const event: InferenceEvent = {
      id: nanoid(),
      sessionId,
      type: 'dimension_transform',
      timestamp: Date.now(),
      duration: params.duration,
      sourceModel: params.sourceModel,
      inputDimension: params.inputDimension,
      outputDimension: params.outputDimension,
      quality: {
        epsilon: params.quality.reconstructionError,
        informationRetention: params.quality.informationRetention,
        cosineSimilarity: params.quality.informationRetention,
        euclideanDistance: params.quality.reconstructionError,
        confidence: params.quality.informationRetention,
      },
      status: 'completed',
      metadata: { method: params.method },
    };
    
    session.events.push(event);
    this.updateMetrics(session);
    
    this.broadcast(sessionId, {
      type: 'event',
      sessionId,
      data: event,
      timestamp: Date.now(),
    });
    
    return event;
  }
  
  /**
   * Track a generic inference event
   */
  trackEvent(sessionId: string, params: {
    type: InferenceEventType;
    sourceModel: string;
    targetModel?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    duration?: number;
    quality?: InferenceEvent['quality'];
    metadata?: Record<string, any>;
    error?: string;
  }): InferenceEvent | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    const event: InferenceEvent = {
      id: nanoid(),
      sessionId,
      type: params.type,
      timestamp: Date.now(),
      duration: params.duration,
      sourceModel: params.sourceModel,
      targetModel: params.targetModel,
      quality: params.quality,
      status: params.status,
      error: params.error,
      metadata: params.metadata,
    };
    
    session.events.push(event);
    
    if (params.status === 'completed' || params.status === 'failed') {
      this.updateMetrics(session);
    }
    
    this.broadcast(sessionId, {
      type: 'event',
      sessionId,
      data: event,
      timestamp: Date.now(),
    });
    
    return event;
  }
  
  /**
   * Update session metrics
   */
  private updateMetrics(session: InferenceSession): void {
    const completedEvents = session.events.filter(e => e.status === 'completed' && e.quality);
    const failedEvents = session.events.filter(e => e.status === 'failed');
    
    if (completedEvents.length === 0) return;
    
    const totalEpsilon = completedEvents.reduce((sum, e) => sum + (e.quality?.epsilon || 0), 0);
    const totalRetention = completedEvents.reduce((sum, e) => sum + (e.quality?.informationRetention || 1), 0);
    const totalLatency = completedEvents.reduce((sum, e) => sum + (e.duration || 0), 0);
    
    session.metrics = {
      totalTransformations: completedEvents.length,
      avgEpsilon: totalEpsilon / completedEvents.length,
      avgInformationRetention: totalRetention / completedEvents.length,
      totalLatency,
      successRate: completedEvents.length / (completedEvents.length + failedEvents.length),
    };
    
    this.broadcast(session.id, {
      type: 'metrics_update',
      sessionId: session.id,
      data: session.metrics,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Complete a session
   */
  completeSession(sessionId: string, status: 'completed' | 'failed' = 'completed'): InferenceSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    session.status = status;
    session.completedAt = Date.now();
    
    this.broadcast(sessionId, {
      type: 'session_end',
      sessionId,
      data: session,
      timestamp: Date.now(),
    });
    
    console.log(`[InferenceTracker] Completed session: ${sessionId} (${status})`);
    return session;
  }
  
  /**
   * Get session by ID
   */
  getSession(sessionId: string): InferenceSession | null {
    return this.sessions.get(sessionId) || null;
  }
  
  /**
   * Get all active sessions
   */
  getActiveSessions(): InferenceSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }
  
  /**
   * Subscribe to session updates
   */
  subscribe(sessionId: string, callback: (message: InferenceStreamMessage) => void): void {
    this.on(`session:${sessionId}`, callback);
    
    // Send current state
    const session = this.sessions.get(sessionId);
    if (session) {
      callback({
        type: 'session_start',
        sessionId,
        data: session,
        timestamp: Date.now(),
      });
    }
  }
  
  /**
   * Unsubscribe from session updates
   */
  unsubscribe(sessionId: string, callback: (message: InferenceStreamMessage) => void): void {
    this.off(`session:${sessionId}`, callback);
  }
  
  /**
   * Broadcast message to subscribers
   */
  private broadcast(sessionId: string, message: InferenceStreamMessage): void {
    this.emit(`session:${sessionId}`, message);
    this.emit('session:*', message); // Global listener
  }
  
  /**
   * Generate demo session for visualization testing
   */
  generateDemoSession(): InferenceSession {
    const session = this.createSession({
      title: 'Demo: GPT-4 to Claude Reasoning Transfer',
      description: 'Demonstration of cross-model inference using W-Matrix alignment',
    });
    
    // Add nodes
    this.addNode(session.id, {
      modelId: 'gpt-4',
      modelName: 'GPT-4',
      modelType: 'source',
      dimension: 1024,
      metadata: { provider: 'OpenAI', architecture: 'transformer' },
    });
    
    this.addNode(session.id, {
      modelId: 'claude-3',
      modelName: 'Claude 3',
      modelType: 'target',
      dimension: 1024,
      metadata: { provider: 'Anthropic', architecture: 'transformer' },
    });
    
    this.addNode(session.id, {
      modelId: 'bert-base',
      modelName: 'BERT Base',
      modelType: 'intermediate',
      dimension: 768,
      metadata: { provider: 'Google', architecture: 'encoder' },
    });
    
    // Simulate alignment events
    const demoVector = Array.from({ length: 1024 }, () => Math.random() - 0.5);
    
    this.trackAlignment(session.id, {
      sourceModel: 'gpt-4',
      targetModel: 'bert-base',
      inputVector: demoVector,
      outputVector: demoVector.slice(0, 768),
      quality: {
        epsilon: 0.08,
        informationRetention: 0.92,
        cosineSimilarity: 0.89,
        euclideanDistance: 0.23,
        confidence: 0.91,
      },
      wMatrix: { id: 'wm-gpt4-bert', method: 'learned' },
      duration: 45,
    });
    
    this.trackAlignment(session.id, {
      sourceModel: 'bert-base',
      targetModel: 'claude-3',
      inputVector: demoVector.slice(0, 768),
      outputVector: demoVector,
      quality: {
        epsilon: 0.06,
        informationRetention: 0.94,
        cosineSimilarity: 0.92,
        euclideanDistance: 0.18,
        confidence: 0.93,
      },
      wMatrix: { id: 'wm-bert-claude', method: 'learned' },
      duration: 38,
    });
    
    return session;
  }
}

// Singleton instance
export const inferenceTracker = new InferenceTracker();
