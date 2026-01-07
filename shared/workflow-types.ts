/**
 * Workflow Event Types for Real-time Visualization
 * Used for AI reasoning, memory transfer, and package processing
 */

export type WorkflowEventType =
  | "prompt_llm"          // LLM prompt sent
  | "llm_response"        // LLM response received
  | "tool_call"           // Tool/function called
  | "tool_result"         // Tool result returned
  | "memory_load"         // KV-Cache loading
  | "memory_save"         // KV-Cache saving
  | "w_matrix_transform"  // W-Matrix transformation
  | "package_upload"      // Package upload started
  | "package_validate"    // Package validation
  | "package_process"     // Package processing
  | "package_complete"    // Package completed
  | "error"               // Error occurred
  | "user_input"          // User input received
  | "system_event";       // System event

export type WorkflowEventStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface WorkflowEvent {
  id: string;
  workflowId: string;
  type: WorkflowEventType;
  status: WorkflowEventStatus;
  timestamp: number;
  duration?: number; // milliseconds
  
  // Event details
  title: string;
  description?: string;
  
  // Metadata
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
    cost?: number;
    [key: string]: any;
  };
  
  // Nested data
  input?: any;
  output?: any;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  
  // Relationships
  parentEventId?: string;
  childEventIds?: string[];
}

export interface WorkflowSession {
  id: string;
  userId: number;
  type: "ai_reasoning" | "memory_transfer" | "package_processing" | "w_matrix_training" | "vector_invocation" | "custom";
  status: "active" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  
  // Metadata
  title: string;
  description?: string;
  tags?: string[];
  
  // Statistics
  totalEvents: number;
  totalDuration: number;
  totalCost: number;
  
  // Events
  events: WorkflowEvent[];
}

export interface WorkflowStreamMessage {
  type: "event" | "session_start" | "session_end" | "error";
  workflowId: string;
  data: WorkflowEvent | WorkflowSession | { message: string };
  timestamp: number;
}

export interface WorkflowFilter {
  eventTypes?: WorkflowEventType[];
  status?: WorkflowEventStatus[];
  search?: string;
  timeRange?: {
    start: number;
    end: number;
  };
}

export interface WorkflowVisualizerConfig {
  showTimeline: boolean;
  showDetails: boolean;
  showFilters: boolean;
  autoScroll: boolean;
  compactMode: boolean;
  colorScheme: "light" | "dark" | "auto";
}
