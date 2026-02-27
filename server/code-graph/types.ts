/**
 * Code Knowledge Graph Types
 *
 * GitNexus-inspired data model for representing code structure
 * as an interactive knowledge graph (files, symbols, dependencies).
 */

// ============ Node Types ============

export type CodeNodeType = 'file' | 'function' | 'class' | 'interface' | 'type' | 'variable';
export type EdgeType = 'imports' | 'calls' | 'defined_in' | 'extends' | 'implements';

export interface CodeNode {
  id: string;                          // e.g. "file:server/routers.ts" or "fn:server/routers.ts::appRouter"
  type: CodeNodeType;
  label: string;                       // Short display name: "routers.ts" or "appRouter()"
  filePath: string;                    // Full path within repo
  directory: string;                   // Parent directory: "server/"
  language: string;                    // "typescript", "javascript", "python", etc.
  lineStart?: number;
  lineEnd?: number;
}

export interface CodeEdge {
  id: string;                          // "edge:{sourceId}->{targetId}"
  source: string;                      // CodeNode.id
  target: string;                      // CodeNode.id
  type: EdgeType;
  weight: number;                      // 0-1, used for line opacity
}

export interface CodeGraph {
  nodes: CodeNode[];
  edges: CodeEdge[];
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
