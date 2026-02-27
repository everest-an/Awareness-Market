/**
 * Code Knowledge Graph Types
 *
 * GitNexus-inspired data model for representing code structure
 * as an interactive knowledge graph (files, symbols, dependencies).
 */

// ============ Node Types ============

export type CodeNodeType = 'file' | 'function' | 'class' | 'interface' | 'type' | 'variable' | 'community' | 'process';
export type EdgeType = 'imports' | 'calls' | 'defined_in' | 'extends' | 'implements' | 'member_of' | 'step_in_process';

export interface CodeNode {
  id: string;                          // e.g. "file:server/routers.ts" or "fn:server/routers.ts::appRouter"
  type: CodeNodeType;
  label: string;                       // Short display name: "routers.ts" or "appRouter()"
  filePath: string;                    // Full path within repo
  directory: string;                   // Parent directory: "server/"
  language: string;                    // "typescript", "javascript", "python", etc.
  lineStart?: number;
  lineEnd?: number;
  communityId?: string;                // Assigned community
}

export interface CodeEdge {
  id: string;                          // "edge:{sourceId}->{targetId}"
  source: string;                      // CodeNode.id
  target: string;                      // CodeNode.id
  type: EdgeType;
  weight: number;                      // 0-1, used for line opacity
  confidence?: number;                 // 0-1, resolution confidence
  reason?: string;                     // e.g. "import-resolved", "same-file", "fuzzy-global"
}

// ============ Community Detection ============

export interface Community {
  id: string;
  name: string;
  keywords: string[];
  cohesion: number;                    // 0-1, internal edge density
  symbolCount: number;
  memberIds: string[];
}

// ============ Process / Execution Flow ============

export interface ProcessFlow {
  id: string;
  name: string;                        // e.g. "handleLogin → saveSession"
  entryPoint: string;                  // Entry node ID
  terminalPoint: string;               // Terminal node ID
  steps: string[];                     // Ordered node IDs in the path
  stepCount: number;
  crossCommunity: boolean;
}

// ============ Search ============

export interface SearchResult {
  nodeId: string;
  label: string;
  filePath: string;
  type: string;
  score: number;
  sources: ('bm25' | 'semantic')[];
  snippet?: string;
}

// ============ Impact Analysis ============

export interface ImpactNode {
  nodeId: string;
  label: string;
  filePath: string;
  reason: string;
}

export interface ImpactResult {
  depth1: ImpactNode[];
  depth2: ImpactNode[];
  depth3: ImpactNode[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedProcesses: string[];
}

// ============ Chat ============

export interface ChatToolCall {
  name: string;
  args: Record<string, any>;
  result?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ChatToolCall[];
}

// ============ Node Context (360-degree) ============

export interface NodeContext {
  node: CodeNode;
  callers: Array<{ node: CodeNode; confidence: number }>;
  callees: Array<{ node: CodeNode; confidence: number }>;
  community: Community | null;
  processes: ProcessFlow[];
  imports: CodeNode[];
  importedBy: CodeNode[];
}

// ============ Code Graph ============

export interface CodeGraph {
  nodes: CodeNode[];
  edges: CodeEdge[];
  communities: Community[];
  processes: ProcessFlow[];
  repoOwner: string;
  repoName: string;
  branch: string;
  fetchedAt: string;                   // ISO timestamp
}

// ============ GitHub API Types ============

export interface RepoSummary {
  id: number;
  fullName: string;                    // "owner/repo"
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  updatedAt: string;
}

export interface GitHubConnectionStatus {
  connected: boolean;
  username: string | null;
  tokenMask: string | null;
  scope: string | null;
}
