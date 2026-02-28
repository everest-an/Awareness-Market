/**
 * Workflow History Schema
 * Stores workflow sessions and events for history replay
 */

import { pgTable, integer, varchar, text, timestamp, numeric, json, pgEnum, index, bigint } from "drizzle-orm/pg-core";

// Define enums at the top level
export const workflowTypeEnum = pgEnum("workflow_type", [
  "ai_reasoning",
  "memory_transfer",
  "package_processing",
  "w_matrix_training",
  "vector_invocation",
  "custom"
]);
export const workflowStatusEnum = pgEnum("workflow_status", ["active", "completed", "failed"]);
export const eventTypeEnum = pgEnum("event_type", [
  "prompt_llm",
  "llm_response",
  "tool_call",
  "tool_result",
  "memory_load",
  "memory_save",
  "w_matrix_transform",
  "package_upload",
  "package_validate",
  "package_process",
  "package_complete",
  "error",
  "user_input",
  "system_event"
]);
export const eventStatusEnum = pgEnum("event_status", ["pending", "running", "completed", "failed"]);

/**
 * Workflow sessions - top-level workflow executions
 */
export const workflowSessions = pgTable("workflow_sessions", {
  id: varchar("id", { length: 32 }).primaryKey(), // nanoid
  userId: integer("user_id").notNull(),
  type: workflowTypeEnum("type").notNull(),
  status: workflowStatusEnum("status").notNull(),
  
  // Metadata
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  tags: text("tags"), // JSON array of strings
  
  // Timing
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  
  // Statistics
  totalEvents: integer("total_events").default(0).notNull(),
  totalDuration: integer("total_duration").default(0).notNull(), // milliseconds
  totalCost: numeric("total_cost", { precision: 10, scale: 4 }).default("0.0000").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  typeIdx: index("type_idx").on(table.type),
  statusIdx: index("status_idx").on(table.status),
  startedAtIdx: index("started_at_idx").on(table.startedAt),
}));

/**
 * Workflow events - individual steps within a workflow
 */
export const workflowEvents = pgTable("workflow_events", {
  id: varchar("id", { length: 32 }).primaryKey(), // nanoid
  workflowId: varchar("workflow_id", { length: 32 }).notNull(),

  // Event type and status
  type: eventTypeEnum("type").notNull(),
  status: eventStatusEnum("status").notNull(),
  
  // Event details
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  
  // Timing
  timestamp: bigint("timestamp", { mode: "number" }).notNull(), // Unix timestamp in ms
  duration: integer("duration"), // milliseconds
  
  // Data (stored as JSON)
  input: json("input"), // Input data for the event
  output: json("output"), // Output/result data
  metadata: json("metadata"), // Additional metadata (model, tokens, cost, etc.)
  error: json("error"), // Error details if failed: {code, message, stack}
  
  // Relationships
  parentEventId: varchar("parent_event_id", { length: 32 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  workflowIdx: index("workflow_idx").on(table.workflowId),
  typeIdx: index("type_idx").on(table.type),
  statusIdx: index("status_idx").on(table.status),
  timestampIdx: index("timestamp_idx").on(table.timestamp),
  parentIdx: index("parent_idx").on(table.parentEventId),
}));
