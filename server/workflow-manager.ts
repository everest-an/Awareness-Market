/**
 * Workflow Manager - Server-side event tracking and streaming
 * Manages workflow sessions and broadcasts events to connected clients
 */

import { EventEmitter } from "events";
import { nanoid } from "nanoid";
import type {
  WorkflowEvent,
  WorkflowSession,
  WorkflowStreamMessage,
  WorkflowEventType,
  WorkflowEventStatus,
} from "../shared/workflow-types";

class WorkflowManager extends EventEmitter {
  private sessions: Map<string, WorkflowSession> = new Map();
  private events: Map<string, WorkflowEvent[]> = new Map();

  /**
   * Create a new workflow session
   */
  createSession(params: {
    userId: number;
    type: WorkflowSession["type"];
    title: string;
    description?: string;
    tags?: string[];
  }): WorkflowSession {
    const session: WorkflowSession = {
      id: nanoid(),
      userId: params.userId,
      type: params.type,
      status: "active",
      startedAt: Date.now(),
      title: params.title,
      description: params.description,
      tags: params.tags,
      totalEvents: 0,
      totalDuration: 0,
      totalCost: 0,
      events: [],
    };

    this.sessions.set(session.id, session);
    this.events.set(session.id, []);

    // Broadcast session start
    this.broadcastMessage(session.id, {
      type: "session_start",
      workflowId: session.id,
      data: session,
      timestamp: Date.now(),
    });

    console.log(`[WorkflowManager] Created session: ${session.id}`);
    return session;
  }

  /**
   * Add an event to a workflow session
   */
  addEvent(workflowId: string, params: {
    type: WorkflowEventType;
    title: string;
    description?: string;
    input?: any;
    output?: any;
    metadata?: Record<string, any>;
    parentEventId?: string;
  }): WorkflowEvent {
    const session = this.sessions.get(workflowId);
    if (!session) {
      throw new Error(`Workflow session not found: ${workflowId}`);
    }

    const event: WorkflowEvent = {
      id: nanoid(),
      workflowId,
      type: params.type,
      status: "running",
      timestamp: Date.now(),
      title: params.title,
      description: params.description,
      input: params.input,
      output: params.output,
      metadata: params.metadata,
      parentEventId: params.parentEventId,
    };

    const sessionEvents = this.events.get(workflowId) || [];
    sessionEvents.push(event);
    this.events.set(workflowId, sessionEvents);

    // Update session stats
    session.totalEvents++;
    session.events = sessionEvents;

    // Broadcast event
    this.broadcastMessage(workflowId, {
      type: "event",
      workflowId,
      data: event,
      timestamp: Date.now(),
    });

    return event;
  }

  /**
   * Update an existing event
   */
  updateEvent(workflowId: string, eventId: string, updates: {
    status?: WorkflowEventStatus;
    duration?: number;
    output?: any;
    error?: {
      code: string;
      message: string;
      stack?: string;
    };
    metadata?: Record<string, any>;
  }): WorkflowEvent | null {
    const sessionEvents = this.events.get(workflowId);
    if (!sessionEvents) {
      return null;
    }

    const event = sessionEvents.find(e => e.id === eventId);
    if (!event) {
      return null;
    }

    // Apply updates
    if (updates.status) event.status = updates.status;
    if (updates.duration !== undefined) event.duration = updates.duration;
    if (updates.output !== undefined) event.output = updates.output;
    if (updates.error) event.error = updates.error;
    if (updates.metadata) {
      event.metadata = { ...event.metadata, ...updates.metadata };
    }

    // Update session stats
    const session = this.sessions.get(workflowId);
    if (session && updates.duration) {
      session.totalDuration += updates.duration;
    }

    // Broadcast updated event
    this.broadcastMessage(workflowId, {
      type: "event",
      workflowId,
      data: event,
      timestamp: Date.now(),
    });

    return event;
  }

  /**
   * Complete a workflow session
   */
  completeSession(workflowId: string, status: "completed" | "failed" = "completed"): WorkflowSession | null {
    const session = this.sessions.get(workflowId);
    if (!session) {
      return null;
    }

    session.status = status;
    session.completedAt = Date.now();

    // Broadcast session end
    this.broadcastMessage(workflowId, {
      type: "session_end",
      workflowId,
      data: session,
      timestamp: Date.now(),
    });

    console.log(`[WorkflowManager] Completed session: ${workflowId} (${status})`);
    return session;
  }

  /**
   * Get a workflow session
   */
  getSession(workflowId: string): WorkflowSession | null {
    return this.sessions.get(workflowId) || null;
  }

  /**
   * Get all events for a workflow
   */
  getEvents(workflowId: string): WorkflowEvent[] {
    return this.events.get(workflowId) || [];
  }

  /**
   * Broadcast a message to all listeners of a workflow
   */
  private broadcastMessage(workflowId: string, message: WorkflowStreamMessage) {
    this.emit(`workflow:${workflowId}`, message);
    this.emit("workflow:*", message); // Global listener
  }

  /**
   * Subscribe to workflow events
   */
  subscribe(workflowId: string, callback: (message: WorkflowStreamMessage) => void) {
    this.on(`workflow:${workflowId}`, callback);
    
    // Send current session state
    const session = this.sessions.get(workflowId);
    if (session) {
      callback({
        type: "session_start",
        workflowId,
        data: session,
        timestamp: Date.now(),
      });

      // Send all existing events
      const events = this.events.get(workflowId) || [];
      events.forEach(event => {
        callback({
          type: "event",
          workflowId,
          data: event,
          timestamp: Date.now(),
        });
      });
    }
  }

  /**
   * Unsubscribe from workflow events
   */
  unsubscribe(workflowId: string, callback: (message: WorkflowStreamMessage) => void) {
    this.off(`workflow:${workflowId}`, callback);
  }

  /**
   * Clean up old sessions (call periodically)
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;

    this.sessions.forEach((session, workflowId) => {
      const age = now - session.startedAt;
      if (age > maxAgeMs && session.status !== "active") {
        this.sessions.delete(workflowId);
        this.events.delete(workflowId);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      console.log(`[WorkflowManager] Cleaned up ${cleaned} old sessions`);
    }
  }
}

// Singleton instance
export const workflowManager = new WorkflowManager();

// Cleanup old sessions every hour
setInterval(() => {
  workflowManager.cleanup();
}, 60 * 60 * 1000);

/**
 * Helper function to track an async operation
 */
export async function trackOperation<T>(
  workflowId: string,
  params: {
    type: WorkflowEventType;
    title: string;
    description?: string;
    input?: any;
    metadata?: Record<string, any>;
  },
  operation: () => Promise<T>
): Promise<T> {
  const event = workflowManager.addEvent(workflowId, params);
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    workflowManager.updateEvent(workflowId, event.id, {
      status: "completed",
      duration,
      output: result,
    });

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;

    workflowManager.updateEvent(workflowId, event.id, {
      status: "failed",
      duration,
      error: {
        code: error.code || "UNKNOWN_ERROR",
        message: error.message || "An error occurred",
        stack: error.stack,
      },
    });

    throw error;
  }
}
