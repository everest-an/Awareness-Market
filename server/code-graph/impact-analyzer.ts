/**
 * Impact Analyzer — Blast radius analysis for code changes
 *
 * Given a set of changed symbols, traces the impact through the call graph:
 * - depth 1: Direct callers (will break)
 * - depth 2: Callers of callers (needs testing)
 * - depth 3: Secondary chain (needs investigation)
 *
 * Also identifies affected execution flows.
 */

import type { CodeNode, CodeEdge, ProcessFlow, ImpactResult, ImpactNode } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('ImpactAnalyzer');

export function analyzeImpact(
  changedSymbolIds: string[],
  nodes: CodeNode[],
  edges: CodeEdge[],
  processes: ProcessFlow[],
): ImpactResult {
  const changedSet = new Set(changedSymbolIds);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Build reverse adjacency (who calls this symbol?)
  const calledBy = new Map<string, Array<{ source: string; confidence: number }>>();
  for (const edge of edges) {
    if (edge.type === 'calls') {
      if (!calledBy.has(edge.target)) calledBy.set(edge.target, []);
      calledBy.get(edge.target)!.push({
        source: edge.source,
        confidence: edge.confidence ?? 0.5,
      });
    }
  }

  // Also consider imports and extends
  for (const edge of edges) {
    if (edge.type === 'imports' || edge.type === 'extends') {
      if (!calledBy.has(edge.target)) calledBy.set(edge.target, []);
      calledBy.get(edge.target)!.push({
        source: edge.source,
        confidence: edge.confidence ?? 0.5,
      });
    }
  }

  // Depth 1: Direct callers of changed symbols
  const depth1Set = new Set<string>();
  for (const changedId of changedSymbolIds) {
    const callers = calledBy.get(changedId) || [];
    for (const { source } of callers) {
      if (!changedSet.has(source)) {
        depth1Set.add(source);
      }
    }
  }

  // Depth 2: Callers of depth-1 symbols
  const depth2Set = new Set<string>();
  for (const d1Id of depth1Set) {
    const callers = calledBy.get(d1Id) || [];
    for (const { source } of callers) {
      if (!changedSet.has(source) && !depth1Set.has(source)) {
        depth2Set.add(source);
      }
    }
  }

  // Depth 3: Callers of depth-2 symbols
  const depth3Set = new Set<string>();
  for (const d2Id of depth2Set) {
    const callers = calledBy.get(d2Id) || [];
    for (const { source } of callers) {
      if (!changedSet.has(source) && !depth1Set.has(source) && !depth2Set.has(source)) {
        depth3Set.add(source);
      }
    }
  }

  // Build impact nodes
  const toImpactNodes = (ids: Set<string>, reason: string): ImpactNode[] => {
    return [...ids]
      .map(id => {
        const node = nodeMap.get(id);
        if (!node) return null;
        return {
          nodeId: id,
          label: node.label,
          filePath: node.filePath,
          reason,
        };
      })
      .filter((n): n is ImpactNode => n !== null);
  };

  const depth1 = toImpactNodes(depth1Set, 'Direct caller — will break');
  const depth2 = toImpactNodes(depth2Set, 'Indirect caller — needs testing');
  const depth3 = toImpactNodes(depth3Set, 'Secondary chain — investigate');

  // Risk level
  const d1Count = depth1.length;
  let riskLevel: ImpactResult['riskLevel'];
  if (d1Count > 10) riskLevel = 'CRITICAL';
  else if (d1Count > 5) riskLevel = 'HIGH';
  else if (d1Count > 2) riskLevel = 'MEDIUM';
  else riskLevel = 'LOW';

  // Affected processes
  const allAffected = new Set([...changedSet, ...depth1Set, ...depth2Set]);
  const affectedProcesses = processes
    .filter(p => p.steps.some(s => allAffected.has(s)))
    .map(p => p.name);

  logger.info('Impact analysis complete', {
    changed: changedSymbolIds.length,
    depth1: depth1.length,
    depth2: depth2.length,
    depth3: depth3.length,
    riskLevel,
    affectedProcesses: affectedProcesses.length,
  });

  return {
    depth1,
    depth2,
    depth3,
    riskLevel,
    affectedProcesses,
  };
}
