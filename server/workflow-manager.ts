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
import { getDb } from "./db";
import { workflowSessions, workflowEvents } from "../drizzle/schema";
import { eq, type InferInsertModel } from "drizzle-orm";
import { getErrorMessage } from "./utils/error-handling";
import { createLogger } from "./utils/logger";

const logger = createLogger('WorkflowManager');

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

    // Save to database (async, don't wait)
    this.saveSessionToDb(session).catch(err => 
      logger.error(`Failed to save session to DB:`, { error: err })
    );

    // Broadcast session start
    this.broadcastMessage(session.id, {
      type: "session_start",
      workflowId: session.id,
      data: session,
      timestamp: Date.now(),
    });

    logger.info(`Created session: ${session.id}`);
    return session;
  }

  /**
   * Add an event to a workflow session
   */
  addEvent(workflowId: string, params: {
    type: WorkflowEventType;
    title: string;
    description?: string;
    input?: unknown;
    output?: unknown;
    metadata?: Record<string, unknown>;
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

    // Save to database (async, don't wait)
    this.saveEventToDb(event).catch((err: unknown) =>
      logger.error(`Failed to save event to DB:`, { error: err })
    );

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
    output?: unknown;
    error?: {
      code: string;
      message: string;
      stack?: string;
    };
    metadata?: Record<string, unknown>;
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

    // Update database (async, don't wait)
    this.updateEventInDb(eventId, updates).catch((err: unknown) =>
      logger.error(`Failed to update event in DB:`, { error: err })
    );

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

    // Update database (async, don't wait)
    this.updateSessionInDb(workflowId, { status, completedAt: session.completedAt! }).catch(err =>
      logger.error(`Failed to update session in DB:`, { error: err })
    );

    logger.info(`Completed session: ${workflowId} (${status})`);
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
   * Save session to database
   */
  private async saveSessionToDb(session: WorkflowSession): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;

      await db.insert(workflowSessions).values({
        id: session.id,
        userId: session.userId,
        type: session.type,
        status: session.status,
        title: session.title,
        description: session.description || null,
        tags: session.tags ? JSON.stringify(session.tags) : null,
        startedAt: new Date(session.startedAt),
        completedAt: session.completedAt ? new Date(session.completedAt) : null,
        totalEvents: session.totalEvents,
        totalDuration: session.totalDuration,
        totalCost: session.totalCost.toString(),
      });
    } catch (error: unknown) {
      logger.error(`DB save error:`, { error });
    }
  }

  /**
   * Update session in database
   */
  private async updateSessionInDb(workflowId: string, updates: Partial<WorkflowSession>): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;

      type SessionUpdate = Partial<InferInsertModel<typeof workflowSessions>>;

      const dbUpdates: SessionUpdate = {};
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.completedAt) dbUpdates.completedAt = new Date(updates.completedAt);
      if (updates.totalEvents !== undefined) dbUpdates.totalEvents = updates.totalEvents;
      if (updates.totalDuration !== undefined) dbUpdates.totalDuration = updates.totalDuration;
      if (updates.totalCost !== undefined) dbUpdates.totalCost = updates.totalCost.toString();

      await db
        .update(workflowSessions)
        .set(dbUpdates)
        .where(eq(workflowSessions.id, workflowId));
    } catch (error: unknown) {
      logger.error(`DB update error:`, { error });
    }
  }

  /**
   * Save event to database
   */
  private async saveEventToDb(event: WorkflowEvent): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;

      await db.insert(workflowEvents).values({
        id: event.id,
        workflowId: event.workflowId,
        type: event.type,
        status: event.status,
        title: event.title,
        description: event.description || null,
        timestamp: event.timestamp,
        duration: event.duration || null,
        input: event.input || null,
        output: event.output || null,
        metadata: event.metadata || null,
        error: event.error || null,
        parentEventId: event.parentEventId || null,
      });
    } catch (error: unknown) {
      logger.error(`DB save event error:`, { error });
    }
  }

  /**
   * Update event in database
   */
  private async updateEventInDb(eventId: string, updates: Partial<WorkflowEvent>): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;

      type EventUpdate = Partial<InferInsertModel<typeof workflowEvents>>;

      const dbUpdates: EventUpdate = {};
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
      if (updates.output !== undefined) dbUpdates.output = JSON.stringify(updates.output);
      if (updates.error !== undefined) dbUpdates.error = JSON.stringify(updates.error);

      await db
        .update(workflowEvents)
        .set(dbUpdates)
        .where(eq(workflowEvents.id, eventId));
    } catch (error: unknown) {
      logger.error(`DB update event error:`, { error });
    }
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
      logger.info(`Cleaned up ${cleaned} old sessions`);
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
    input?: unknown;
    metadata?: Record<string, unknown>;
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
  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    const errorObj = error instanceof Error ? error : new Error(String(error));
    workflowManager.updateEvent(workflowId, event.id, {
      status: "failed",
      duration,
      error: {
        code: (error && typeof error === 'object' && 'code' in error) ? String(error.code) : "UNKNOWN_ERROR",
        message: getErrorMessage(error),
        stack: errorObj.stack,
      },
    });

    throw error;
  }
}
