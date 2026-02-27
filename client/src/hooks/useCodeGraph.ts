/**
 * useCodeGraph — React hook for code knowledge graph state + 3D layout
 *
 * Manages GitHub connection, repo selection, and converts CodeGraph data
 * into positioned CortexNode[] for the NeuralCortexVisualizer.
 */

import { useState, useCallback, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import type { CodeGraph, CodeEdge, Community, ProcessFlow } from '../../../server/code-graph/types';
import type { CortexNode } from '@/components/NeuralCortexVisualizer';
import { DEFAULT_CODE_GRAPH } from '@/data/default-code-graph';

// ─── Color Palettes ──────────────────────────────────────────────────────────

const DIR_COLORS: Record<string, [number, number, number]> = {
  'server/_core/':           [0.40, 0.30, 0.95],   // Deep purple
  'server/':                 [0.02, 0.71, 0.83],   // Cyan
  'server/routers/':         [0.29, 0.87, 0.50],   // Green
  'server/code-graph/':      [0.14, 0.85, 0.96],   // Sky
  'server/memory-core/':     [0.66, 0.33, 0.97],   // Purple
  'server/latentmas/':       [0.23, 0.51, 0.96],   // Blue
  'client/src/':             [0.98, 0.45, 0.09],   // Orange
  'client/src/pages/':       [0.96, 0.26, 0.21],   // Red
  'client/src/components/':  [0.93, 0.69, 0.13],   // Yellow
  'client/src/hooks/':       [0.93, 0.35, 0.63],   // Pink
  'client/src/lib/':         [0.85, 0.55, 0.25],   // Amber
  'client/src/data/':        [0.75, 0.65, 0.40],   // Gold
  'prisma/':                 [0.50, 0.80, 0.70],   // Teal
};

const NODE_TYPE_COLORS: Record<string, [number, number, number]> = {
  file:      [0.50, 0.80, 1.00],   // Light cyan
  function:  [0.30, 1.00, 0.50],   // Green
  class:     [1.00, 0.50, 0.30],   // Orange
  interface: [0.80, 0.30, 1.00],   // Purple
  type:      [1.00, 0.80, 0.30],   // Yellow
  variable:  [0.60, 0.60, 0.60],   // Gray
};

// ─── 3D Layout Algorithm ─────────────────────────────────────────────────────

function computeLayout(graph: CodeGraph): { nodes: CortexNode[]; edges: CodeEdge[] } {
  // Collect unique directories and assign 3D cluster centers (ring layout)
  const directories = [...new Set(graph.nodes.map(n => n.directory))];
  const dirCenters = new Map<string, [number, number, number]>();

  const RING_RADIUS = 40;
  directories.forEach((dir, i) => {
    const angle = (i / directories.length) * Math.PI * 2;
    const tier = i % 3;
    const y = (tier - 1) * 14;
    dirCenters.set(dir, [
      Math.cos(angle) * RING_RADIUS,
      y,
      Math.sin(angle) * RING_RADIUS,
    ]);
  });

  const cortexNodes: CortexNode[] = [];
  const filePositions = new Map<string, [number, number, number]>();

  // ── Pass 1: Position file nodes around directory centers ──
  const filesByDir = new Map<string, typeof graph.nodes>();
  for (const n of graph.nodes) {
    if (n.type !== 'file') continue;
    const list = filesByDir.get(n.directory) || [];
    list.push(n);
    filesByDir.set(n.directory, list);
  }

  for (const [dir, files] of filesByDir) {
    const center = dirCenters.get(dir) || [0, 0, 0];
    files.forEach((file, i) => {
      const subAngle = (i / files.length) * Math.PI * 2;
      const subRadius = 5 + Math.random() * 8;
      const pos: [number, number, number] = [
        center[0] + Math.cos(subAngle) * subRadius,
        center[1] + (Math.random() - 0.5) * 6,
        center[2] + Math.sin(subAngle) * subRadius,
      ];
      filePositions.set(file.filePath, pos);

      const dc = dirColor(dir);
      const tc = NODE_TYPE_COLORS.file;

      cortexNodes.push({
        id: file.id,
        title: file.label,
        category: 'file',
        position: pos,
        color: blend(dc, tc, 0.6),
        activation: 0,
        agentId: dir,
        domain: file.language,
        codeNodeType: 'file',
        filePath: file.filePath,
      });
    });
  }

  // ── Pass 2: Position symbol nodes orbiting their parent file ──
  const symbolNodes = graph.nodes.filter(n => n.type !== 'file');
  symbolNodes.forEach((sym, i) => {
    const parentPos = filePositions.get(sym.filePath) || [0, 0, 0];
    // Golden angle for even spread
    const angle = i * 2.399 + Math.random() * 0.5;
    const r = 1.5 + Math.random() * 3;
    const pos: [number, number, number] = [
      parentPos[0] + Math.cos(angle) * r,
      parentPos[1] + (Math.random() - 0.5) * 3,
      parentPos[2] + Math.sin(angle) * r,
    ];

    const dc = dirColor(sym.directory);
    const tc = NODE_TYPE_COLORS[sym.type] || NODE_TYPE_COLORS.variable;

    cortexNodes.push({
      id: sym.id,
      title: sym.label,
      category: sym.type,
      position: pos,
      color: blend(dc, tc, 0.4),
      activation: 0,
      agentId: sym.directory,
      domain: sym.language,
      codeNodeType: sym.type as any,
      filePath: sym.filePath,
      lineStart: sym.lineStart,
    });
  });

  return { nodes: cortexNodes, edges: graph.edges };
}

function dirColor(dir: string): [number, number, number] {
  if (DIR_COLORS[dir]) return DIR_COLORS[dir];
  // Try parent directories
  const parts = dir.split('/').filter(Boolean);
  while (parts.length > 1) {
    parts.pop();
    const parent = parts.join('/') + '/';
    if (DIR_COLORS[parent]) return DIR_COLORS[parent];
  }
  return [0.5, 0.5, 0.5];
}

function blend(
  a: [number, number, number],
  b: [number, number, number],
  aWeight: number,
): [number, number, number] {
  const bWeight = 1 - aWeight;
  return [
    a[0] * aWeight + b[0] * bWeight,
    a[1] * aWeight + b[1] * bWeight,
    a[2] * aWeight + b[2] * bWeight,
  ];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useCodeGraph() {
  const [selectedRepo, setSelectedRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [codeGraph, setCodeGraph] = useState<CodeGraph>(DEFAULT_CODE_GRAPH);
  const [isLoading, setIsLoading] = useState(false);

  const connectionStatus = trpc.codeGraph.status.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const repoList = trpc.codeGraph.listRepos.useQuery(undefined, {
    enabled: connectionStatus.data?.connected === true,
    retry: false,
  });

  const fetchGraphMutation = trpc.codeGraph.fetchGraph.useMutation({
    onSuccess: (data) => {
      setCodeGraph(data);
      setIsLoading(false);
    },
    onError: () => {
      setIsLoading(false);
    },
  });

  const selectRepo = useCallback(
    (owner: string, repo: string, branch?: string) => {
      setSelectedRepo({ owner, repo });
      setIsLoading(true);
      fetchGraphMutation.mutate({ owner, repo, branch });
    },
    [fetchGraphMutation],
  );

  const resetToDefault = useCallback(() => {
    setSelectedRepo(null);
    setCodeGraph(DEFAULT_CODE_GRAPH);
  }, []);

  // Compute 3D layout (memoized on graph change)
  const layout = useMemo(() => computeLayout(codeGraph), [codeGraph]);

  return {
    connectionStatus: connectionStatus.data,
    repos: repoList.data?.repos || [],
    selectedRepo,
    codeGraph,
    cortexNodes: layout.nodes,
    edges: layout.edges,
    communities: codeGraph.communities,
    processes: codeGraph.processes,
    isLoading,
    selectRepo,
    resetToDefault,
  };
}
