/**
 * Community Detector — Louvain algorithm for functional clustering
 *
 * Groups code symbols into functional communities based on
 * CALLS, EXTENDS, and IMPLEMENTS relationships.
 * Uses graphology + graphology-communities-louvain.
 */

import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import type { CodeNode, CodeEdge, Community } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('CommunityDetector');

const MIN_CONFIDENCE = 0.5;
const TIMEOUT_MS = 30_000;

export function detectCommunities(nodes: CodeNode[], edges: CodeEdge[]): Community[] {
  // Only consider symbol nodes (not file nodes)
  const symbolNodes = nodes.filter(n => n.type !== 'file');
  if (symbolNodes.length === 0) return [];

  const symbolIds = new Set(symbolNodes.map(n => n.id));

  // Filter edges to relevant types with sufficient confidence
  const relevantEdges = edges.filter(
    e =>
      (e.type === 'calls' || e.type === 'extends' || e.type === 'implements') &&
      (e.confidence ?? 1) >= MIN_CONFIDENCE &&
      symbolIds.has(e.source) &&
      symbolIds.has(e.target),
  );

  if (relevantEdges.length === 0) {
    // No relationships — put all in one community
    return [buildSingleCommunity(symbolNodes)];
  }

  try {
    return runLouvain(symbolNodes, relevantEdges, nodes);
  } catch (err) {
    logger.warn('Community detection failed, using fallback', { error: String(err) });
    return [buildSingleCommunity(symbolNodes)];
  }
}

function runLouvain(
  symbolNodes: CodeNode[],
  relevantEdges: CodeEdge[],
  allNodes: CodeNode[],
): Community[] {
  const graph = new Graph({ type: 'undirected', allowSelfLoops: false });

  // Add nodes
  for (const node of symbolNodes) {
    if (!graph.hasNode(node.id)) {
      graph.addNode(node.id, { label: node.label, filePath: node.filePath });
    }
  }

  // Add edges (undirected for community detection)
  for (const edge of relevantEdges) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      try {
        graph.addEdge(edge.source, edge.target, {
          weight: edge.confidence ?? 0.5,
        });
      } catch {
        // Ignore duplicate edges
      }
    }
  }

  // Adaptive resolution based on graph size
  const resolution = symbolNodes.length > 500 ? 2.0 : 1.0;

  // Run Louvain algorithm
  const communities = louvain(graph, {
    resolution,
    getEdgeWeight: 'weight',
  });

  // Group nodes by community
  const communityMap = new Map<number, string[]>();
  for (const [nodeId, communityId] of Object.entries(communities)) {
    const cid = communityId as number;
    if (!communityMap.has(cid)) communityMap.set(cid, []);
    communityMap.get(cid)!.push(nodeId);
  }

  // Build Community objects
  const result: Community[] = [];
  let idx = 0;

  for (const [cid, memberIds] of communityMap) {
    if (memberIds.length < 2) continue; // Skip singleton communities

    const members = memberIds
      .map(id => allNodes.find(n => n.id === id))
      .filter((n): n is CodeNode => n !== undefined);

    // Calculate cohesion (internal edge density)
    const memberSet = new Set(memberIds);
    const internalEdges = relevantEdges.filter(
      e => memberSet.has(e.source) && memberSet.has(e.target),
    ).length;
    const maxPossibleEdges = (memberIds.length * (memberIds.length - 1)) / 2;
    const cohesion = maxPossibleEdges > 0 ? Math.min(internalEdges / maxPossibleEdges, 1) : 0;

    // Extract keywords from member names
    const keywords = extractKeywords(members.map(m => m.label));

    // Name = primary directory + top keyword
    const dirs = members.map(m => m.directory);
    const primaryDir = mode(dirs) || 'unknown';
    const dirLabel = primaryDir.replace(/\/$/, '').split('/').pop() || primaryDir;
    const topKeyword = keywords[0] || '';
    const name = topKeyword ? `${dirLabel}/${topKeyword}` : dirLabel;

    result.push({
      id: `community:${idx}`,
      name,
      keywords,
      cohesion: Math.round(cohesion * 100) / 100,
      symbolCount: memberIds.length,
      memberIds,
    });
    idx++;
  }

  // Add uncategorized nodes to a catch-all community if needed
  const assigned = new Set(result.flatMap(c => c.memberIds));
  const unassigned = symbolNodes.filter(n => !assigned.has(n.id));
  if (unassigned.length > 0) {
    result.push({
      id: `community:${idx}`,
      name: 'Other',
      keywords: [],
      cohesion: 0,
      symbolCount: unassigned.length,
      memberIds: unassigned.map(n => n.id),
    });
  }

  logger.info('Communities detected', {
    total: result.length,
    largest: Math.max(...result.map(c => c.symbolCount)),
  });

  return result;
}

function buildSingleCommunity(symbolNodes: CodeNode[]): Community {
  return {
    id: 'community:0',
    name: 'All Symbols',
    keywords: extractKeywords(symbolNodes.map(n => n.label)),
    cohesion: 1,
    symbolCount: symbolNodes.length,
    memberIds: symbolNodes.map(n => n.id),
  };
}

function extractKeywords(labels: string[], maxKeywords = 5): string[] {
  const words = new Map<string, number>();

  for (const label of labels) {
    // Split camelCase/PascalCase and snake_case
    const parts = label
      .replace(/[()]/g, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2);

    for (const word of parts) {
      words.set(word, (words.get(word) || 0) + 1);
    }
  }

  return [...words.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

function mode(arr: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  let maxCount = 0;
  let maxItem: string | undefined;
  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxItem = item;
    }
  }
  return maxItem;
}
