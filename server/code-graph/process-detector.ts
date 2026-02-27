/**
 * Process Detector — Execution flow tracing
 *
 * Identifies execution paths from entry points through the call graph.
 * Entry points are scored by: export status, naming patterns, framework conventions.
 * BFS traversal follows CALLS edges with confidence filtering.
 */

import type { CodeNode, CodeEdge, Community, ProcessFlow } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('ProcessDetector');

const MAX_TRACE_DEPTH = 10;
const MAX_BRANCHING = 4;
const MIN_EDGE_CONFIDENCE = 0.5;
const MAX_PROCESSES = 75;
const TOP_ENTRY_POINTS = 30;

// Entry point naming patterns with score multipliers
const ENTRY_PATTERNS: Array<{ pattern: RegExp; score: number }> = [
  // Route handlers / HTTP
  { pattern: /^(handle|on|route|get|post|put|delete|patch)/i, score: 2.0 },
  // Initialization
  { pattern: /^(init|setup|configure|bootstrap|register|start|main)/i, score: 1.5 },
  // Middleware / hooks
  { pattern: /^(middleware|use|hook|intercept|guard)/i, score: 1.5 },
  // Event handlers
  { pattern: /^(on[A-Z]|emit|dispatch|trigger|listen|subscribe)/i, score: 1.5 },
  // Lifecycle
  { pattern: /^(create|mount|render|update|destroy|unmount)/i, score: 1.0 },
  // tRPC / API
  { pattern: /(router|procedure|mutation|query|resolver)/i, score: 2.5 },
  // Express-like
  { pattern: /(Router|Controller|Service|Handler)/i, score: 2.0 },
];

export function detectProcesses(
  nodes: CodeNode[],
  edges: CodeEdge[],
  communities: Community[],
): ProcessFlow[] {
  // Build adjacency list for CALLS edges only
  const callEdges = edges.filter(
    e => e.type === 'calls' && (e.confidence ?? 0) >= MIN_EDGE_CONFIDENCE,
  );

  if (callEdges.length === 0) return [];

  const adjacency = new Map<string, Array<{ target: string; confidence: number }>>();
  for (const edge of callEdges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push({
      target: edge.target,
      confidence: edge.confidence ?? 0.5,
    });
  }

  // Phase 1: Score entry points
  const functionNodes = nodes.filter(n => n.type === 'function' || n.type === 'class');
  const entryScores: Array<{ node: CodeNode; score: number }> = [];

  for (const node of functionNodes) {
    let score = 0;

    // Outgoing call count (more calls = more likely entry point)
    const outgoing = adjacency.get(node.id)?.length || 0;
    score += outgoing * 0.5;

    // Naming pattern match
    const cleanLabel = node.label.replace(/[()]/g, '');
    for (const { pattern, score: bonus } of ENTRY_PATTERNS) {
      if (pattern.test(cleanLabel)) {
        score += bonus;
        break; // Only count best match
      }
    }

    // Has outgoing but few incoming → likely entry
    const incoming = callEdges.filter(e => e.target === node.id).length;
    if (outgoing > 0 && incoming === 0) score += 2.0;

    if (score > 0) {
      entryScores.push({ node, score });
    }
  }

  // Sort by score, take top N
  entryScores.sort((a, b) => b.score - a.score);
  const entryPoints = entryScores.slice(0, TOP_ENTRY_POINTS);

  if (entryPoints.length === 0) return [];

  // Phase 2: BFS from each entry point
  const allPaths: Array<{ steps: string[]; entry: string; terminal: string }> = [];
  const communityMap = new Map<string, string>();
  for (const c of communities) {
    for (const id of c.memberIds) {
      communityMap.set(id, c.id);
    }
  }

  for (const { node: entry } of entryPoints) {
    const paths = bfsTrace(entry.id, adjacency);
    for (const path of paths) {
      allPaths.push({
        steps: path,
        entry: path[0],
        terminal: path[path.length - 1],
      });
    }
  }

  // Phase 3: Deduplicate
  // Remove subset paths
  const deduplicated = deduplicatePaths(allPaths);

  // Phase 4: Build ProcessFlow objects
  const processes: ProcessFlow[] = [];

  for (let i = 0; i < Math.min(deduplicated.length, MAX_PROCESSES); i++) {
    const { steps, entry, terminal } = deduplicated[i];

    const entryNode = nodes.find(n => n.id === entry);
    const terminalNode = nodes.find(n => n.id === terminal);
    if (!entryNode || !terminalNode) continue;

    const entryLabel = entryNode.label.replace(/[()]/g, '');
    const terminalLabel = terminalNode.label.replace(/[()]/g, '');

    // Check if path crosses community boundaries
    const communitiesInPath = new Set(
      steps.map(s => communityMap.get(s)).filter(Boolean),
    );
    const crossCommunity = communitiesInPath.size > 1;

    processes.push({
      id: `process:${i}`,
      name: `${entryLabel} → ${terminalLabel}`,
      entryPoint: entry,
      terminalPoint: terminal,
      steps,
      stepCount: steps.length,
      crossCommunity,
    });
  }

  logger.info('Processes detected', {
    entryPoints: entryPoints.length,
    rawPaths: allPaths.length,
    deduplicated: deduplicated.length,
    final: processes.length,
  });

  return processes;
}

function bfsTrace(
  startId: string,
  adjacency: Map<string, Array<{ target: string; confidence: number }>>,
): string[][] {
  const results: string[][] = [];
  const queue: Array<{ path: string[]; depth: number }> = [
    { path: [startId], depth: 0 },
  ];

  while (queue.length > 0) {
    const { path, depth } = queue.shift()!;
    const current = path[path.length - 1];
    const neighbors = adjacency.get(current) || [];

    if (depth >= MAX_TRACE_DEPTH || neighbors.length === 0) {
      // Terminal node — save path if it has at least 2 steps
      if (path.length >= 2) {
        results.push(path);
      }
      continue;
    }

    // Sort by confidence, take top N branches
    const sorted = [...neighbors]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_BRANCHING);

    let extended = false;
    for (const { target } of sorted) {
      // Avoid cycles
      if (path.includes(target)) continue;

      queue.push({ path: [...path, target], depth: depth + 1 });
      extended = true;
    }

    // If no extension possible, save current path
    if (!extended && path.length >= 2) {
      results.push(path);
    }
  }

  return results;
}

function deduplicatePaths(
  paths: Array<{ steps: string[]; entry: string; terminal: string }>,
): Array<{ steps: string[]; entry: string; terminal: string }> {
  // Sort by length (longest first)
  const sorted = [...paths].sort((a, b) => b.steps.length - a.steps.length);
  const kept: typeof sorted = [];

  for (const path of sorted) {
    const pathSet = new Set(path.steps);
    // Check if this path is a subset of any already-kept path
    const isSubset = kept.some(other => {
      if (other.steps.length <= path.steps.length) return false;
      return path.steps.every(s => new Set(other.steps).has(s));
    });
    if (isSubset) continue;

    // One path per entry→terminal pair
    const pairKey = `${path.entry}→${path.terminal}`;
    const existingPair = kept.find(
      k => `${k.entry}→${k.terminal}` === pairKey,
    );
    if (existingPair) continue;

    kept.push(path);
  }

  return kept;
}
