/**
 * WebSocket Server for Workflow Streaming
 * Provides real-time workflow event streaming to clients
 */

import type { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { workflowManager } from "./workflow-manager";
import type { WorkflowStreamMessage } from "../shared/workflow-types";
import { createLogger } from "./utils/logger";

const logger = createLogger('WorkflowWebSocket');

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initializeWorkflowWebSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*", // Configure appropriately for production
      methods: ["GET", "POST"],
    },
    path: "/api/workflow/stream",
  });

  io.on("connection", (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Handle workflow subscription
    socket.on("subscribe", (workflowId: string) => {
      logger.info(`Client ${socket.id} subscribing to workflow: ${workflowId}`);
      
      // Join workflow room
      socket.join(`workflow:${workflowId}`);

      // Create callback for workflow events
      const callback = (message: WorkflowStreamMessage) => {
        socket.emit("message", message);
      };

      // Subscribe to workflow manager
      workflowManager.subscribe(workflowId, callback);

      // Store callback for cleanup
      socket.data.workflowCallbacks = socket.data.workflowCallbacks || new Map();
      socket.data.workflowCallbacks.set(workflowId, callback);
    });

    // Handle workflow unsubscription
    socket.on("unsubscribe", (workflowId: string) => {
      logger.info(`Client ${socket.id} unsubscribing from workflow: ${workflowId}`);
      
      // Leave workflow room
      socket.leave(`workflow:${workflowId}`);

      // Unsubscribe from workflow manager
      const callback = socket.data.workflowCallbacks?.get(workflowId);
      if (callback) {
        workflowManager.unsubscribe(workflowId, callback);
        socket.data.workflowCallbacks.delete(workflowId);
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      logger.info(`Client disconnected: ${socket.id}`);
      
      // Clean up all subscriptions
      if (socket.data.workflowCallbacks) {
        socket.data.workflowCallbacks.forEach(
          (callback: (message: WorkflowStreamMessage) => void, workflowId: string) => {
            workflowManager.unsubscribe(workflowId, callback);
          }
        );
        socket.data.workflowCallbacks.clear();
      }
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

/**
 * Broadcast a message to all clients subscribed to a workflow
 */
export function broadcastToWorkflow(workflowId: string, message: WorkflowStreamMessage) {
  if (!io) {
    logger.warn('WebSocket server not initialized');
    return;
  }

  io.to(`workflow:${workflowId}`).emit("message", message);
}

/**
 * Get Socket.IO server instance
 */
export function getSocketIO(): SocketIOServer | null {
  return io;
}
