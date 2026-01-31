/**
 * Socket.IO Event Handlers for Real-time Hive Mind Updates
 *
 * Broadcasts resonance events, memory uploads, and agent status changes
 * to connected clients for live visualization in NetworkBrain.
 *
 * Events:
 * - resonance:detected - New resonance connection found
 * - memory:uploaded - New memory added to network
 * - agent:joined - New agent registered
 * - agent:status - Agent online/offline status change
 * - network:stats - Periodic network statistics update
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from './logger.js';

export type ResonanceEvent = {
  consumerId: number;
  providerId: number;
  consumerName: string;
  providerName: string;
  memoryId: number;
  similarity: number;
  cost: number;
  timestamp: Date;
};

export type MemoryUploadEvent = {
  agentId: number;
  agentName: string;
  memoryId: number;
  title: string;
  isPublic: boolean;
  timestamp: Date;
};

export type AgentJoinEvent = {
  agentId: number;
  agentName: string;
  address: string;
  timestamp: Date;
};

export type NetworkStatsEvent = {
  totalAgents: number;
  activeAgents: number;
  totalMemories: number;
  totalResonances: number;
  recentResonances24h: number;
  timestamp: Date;
};

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server
 */
export function initializeSocketIO(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    logger.info('Socket.IO client connected', {
      socketId: socket.id,
      transport: socket.conn.transport.name,
    });

    // Send initial network stats on connection
    socket.emit('network:connected', {
      message: 'Connected to Awareness Network',
      timestamp: new Date(),
    });

    socket.on('disconnect', (reason) => {
      logger.info('Socket.IO client disconnected', {
        socketId: socket.id,
        reason,
      });
    });

    // Handle ping from clients
    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback({ timestamp: Date.now() });
      }
    });

    // Client can subscribe to specific agent updates
    socket.on('subscribe:agent', (agentId: number) => {
      socket.join(`agent:${agentId}`);
      logger.debug('Client subscribed to agent updates', { socketId: socket.id, agentId });
    });

    socket.on('unsubscribe:agent', (agentId: number) => {
      socket.leave(`agent:${agentId}`);
      logger.debug('Client unsubscribed from agent updates', { socketId: socket.id, agentId });
    });
  });

  // Periodic network stats broadcast (every 10 seconds)
  setInterval(() => {
    broadcastNetworkStats();
  }, 10000);

  logger.info('Socket.IO server initialized');
  return io;
}

/**
 * Broadcast a resonance detection event
 * Called from latentmas-resonance.ts when a match is found
 */
export function broadcastResonanceEvent(event: ResonanceEvent) {
  if (!io) {
    logger.warn('Cannot broadcast resonance event: Socket.IO not initialized');
    return;
  }

  io.emit('resonance:detected', {
    ...event,
    timestamp: event.timestamp.toISOString(),
  });

  // Also send to specific agent subscribers
  io.to(`agent:${event.consumerId}`).emit('resonance:own', {
    ...event,
    timestamp: event.timestamp.toISOString(),
  });

  logger.debug('Broadcast resonance event', {
    consumerId: event.consumerId,
    providerId: event.providerId,
    similarity: event.similarity,
  });
}

/**
 * Broadcast a memory upload event
 * Called from latentmas-upload.ts when a new memory is stored
 */
export function broadcastMemoryUpload(event: MemoryUploadEvent) {
  if (!io) {
    logger.warn('Cannot broadcast memory upload: Socket.IO not initialized');
    return;
  }

  io.emit('memory:uploaded', {
    ...event,
    timestamp: event.timestamp.toISOString(),
  });

  // Notify agent's own subscribers
  io.to(`agent:${event.agentId}`).emit('memory:own', {
    ...event,
    timestamp: event.timestamp.toISOString(),
  });

  logger.debug('Broadcast memory upload', {
    agentId: event.agentId,
    memoryId: event.memoryId,
  });
}

/**
 * Broadcast a new agent join event
 * Called from auth-phantom.ts when a new user is created
 */
export function broadcastAgentJoin(event: AgentJoinEvent) {
  if (!io) {
    logger.warn('Cannot broadcast agent join: Socket.IO not initialized');
    return;
  }

  io.emit('agent:joined', {
    ...event,
    timestamp: event.timestamp.toISOString(),
  });

  logger.info('Broadcast agent join', {
    agentId: event.agentId,
    agentName: event.agentName,
  });
}

/**
 * Broadcast network statistics
 * Called periodically to update dashboard metrics
 */
export async function broadcastNetworkStats() {
  if (!io) return;

  try {
    const { getDb } = await import('./db.js');
    const { users, latentVectors, memoryUsageLog } = await import('../drizzle/schema-pg.js');
    const { sql, gt } = await import('drizzle-orm');

    const db = await getDb();

    // Get total agents
    const totalAgentsResult = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const totalAgents = totalAgentsResult[0]?.count || 0;

    // Get active agents (signed in within last 24h)
    const activeAgentsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(gt(users.lastSignedIn, new Date(Date.now() - 24 * 60 * 60 * 1000)));
    const activeAgents = activeAgentsResult[0]?.count || 0;

    // Get total memories
    const totalMemoriesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(latentVectors);
    const totalMemories = totalMemoriesResult[0]?.count || 0;

    // Get total resonances
    const totalResonancesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(memoryUsageLog);
    const totalResonances = totalResonancesResult[0]?.count || 0;

    // Get recent resonances (last 24h)
    const recentResonancesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(memoryUsageLog)
      .where(gt(memoryUsageLog.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
    const recentResonances24h = recentResonancesResult[0]?.count || 0;

    const stats: NetworkStatsEvent = {
      totalAgents,
      activeAgents,
      totalMemories,
      totalResonances,
      recentResonances24h,
      timestamp: new Date(),
    };

    io.emit('network:stats', stats);

    logger.debug('Broadcast network stats', stats);
  } catch (error) {
    logger.error('Failed to broadcast network stats', { error });
  }
}

/**
 * Emit event to specific agent subscribers
 */
export function emitToAgent(agentId: number, event: string, data: any) {
  if (!io) {
    logger.warn('Cannot emit to agent: Socket.IO not initialized');
    return;
  }

  io.to(`agent:${agentId}`).emit(event, data);
}

/**
 * Get Socket.IO instance
 */
export function getSocketIO(): SocketIOServer | null {
  return io;
}

/**
 * Close Socket.IO server
 */
export function closeSocketIO() {
  if (io) {
    io.close();
    io = null;
    logger.info('Socket.IO server closed');
  }
}
