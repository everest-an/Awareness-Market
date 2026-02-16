/**
 * Memory Graph Viewer
 *
 * Visualizes memory relationships using D3.js force-directed graph.
 * Shows entities, relations, and allows interactive exploration.
 */

import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Network,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Download,
} from 'lucide-react';
import * as d3 from 'd3';

interface MemoryGraphViewerProps {
  memoryId: string;
  depth?: number;
  className?: string;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  content: string;
  type: 'center' | 'related';
  confidence?: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  strength: number;
  reason?: string;
}

export function MemoryGraphViewer({ memoryId, depth = 1, className }: MemoryGraphViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const { data: graphData, isLoading, refetch } = trpc.memory.getMemoryGraph.useQuery({
    memory_id: memoryId,
    depth,
    orgId: 1, // TODO: Get orgId from props or context
  });

  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return;

    // Clear previous graph
    d3.select(svgRef.current).selectAll('*').remove();

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create nodes from relations
    const nodesMap = new Map<string, GraphNode>();

    // Add center node
    nodesMap.set(graphData.center_memory_id, {
      id: graphData.center_memory_id,
      content: 'Center Memory',
      type: 'center',
    });

    // Add nodes from relations
    graphData.relations.forEach((rel) => {
      if (!nodesMap.has(rel.source.id)) {
        nodesMap.set(rel.source.id, {
          id: rel.source.id,
          content: rel.source.content,
          type: 'related',
        });
      }
      if (!nodesMap.has(rel.target.id)) {
        nodesMap.set(rel.target.id, {
          id: rel.target.id,
          content: rel.target.content,
          type: 'related',
        });
      }
    });

    const nodes: GraphNode[] = Array.from(nodesMap.values());
    const links: GraphLink[] = graphData.relations.map((rel) => ({
      source: rel.source.id,
      target: rel.target.id,
      type: rel.type,
      strength: rel.strength,
      reason: rel.reason ?? undefined,
    }));

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    // Create container for zoom
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setScale(event.transform.k);
      });

    svg.call(zoom as any);

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(100)
          .strength((d) => d.strength * 0.5)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    // Draw links
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => {
        // Color by relation type
        const colors: Record<string, string> = {
          CAUSES: '#ef4444',
          SUPPORTS: '#22c55e',
          CONTRADICTS: '#f97316',
          IMPACTS: '#3b82f6',
          TEMPORAL_BEFORE: '#8b5cf6',
          TEMPORAL_AFTER: '#ec4899',
        };
        return colors[d.type] || '#94a3b8';
      })
      .attr('stroke-width', (d) => Math.max(1, d.strength * 3))
      .attr('stroke-opacity', 0.6);

    // Draw link labels
    const linkLabel = g
      .append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('class', 'text-xs fill-muted-foreground')
      .attr('text-anchor', 'middle')
      .attr('dy', -5)
      .text((d) => d.type);

    // Draw nodes
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d) => (d.type === 'center' ? 20 : 10))
      .attr('fill', (d) => (d.type === 'center' ? '#8b5cf6' : '#6366f1'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any
      )
      .on('click', (event, d) => {
        setSelectedNode(d);
      });

    // Draw node labels
    const nodeLabel = g
      .append('g')
      .attr('class', 'node-labels')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .attr('class', 'text-xs font-medium')
      .attr('text-anchor', 'middle')
      .attr('dy', 25)
      .text((d) => d.content.substring(0, 30) + (d.content.length > 30 ? '...' : ''));

    // Update positions on each tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);

      nodeLabel.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graphData]);

  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call((d3.zoom() as any).scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call((d3.zoom() as any).scaleBy, 0.7);
    }
  };

  const handleReset = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg
        .transition()
        .duration(300)
        .call((d3.zoom() as any).transform, d3.zoomIdentity);
    }
  };

  const handleDownload = () => {
    if (!svgRef.current) return;

    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `memory-graph-${memoryId}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-purple-500" />
              <CardTitle>Memory Relationship Graph</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {graphData?.count || 0} relations
              </Badge>
              <Badge variant="outline">Zoom: {(scale * 100).toFixed(0)}%</Badge>
            </div>
          </div>
          <CardDescription>
            Interactive visualization of memory relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4 mr-1" />
              Zoom In
            </Button>
            <Button size="sm" variant="outline" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4 mr-1" />
              Zoom Out
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset}>
              <Maximize2 className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" />
              Download SVG
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Graph Canvas */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-[600px] flex items-center justify-center text-muted-foreground">
              Loading graph...
            </div>
          ) : !graphData || graphData.count === 0 ? (
            <div className="h-[600px] flex flex-col items-center justify-center text-muted-foreground">
              <Network className="h-12 w-12 mb-4" />
              <p>No relationships found for this memory</p>
            </div>
          ) : (
            <div ref={containerRef} className="relative h-[600px] w-full overflow-hidden">
              <svg ref={svgRef} className="w-full h-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Node Details */}
      {selectedNode && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Node</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="font-medium">ID:</span> {selectedNode.id.substring(0, 8)}...
              </div>
              <div>
                <span className="font-medium">Content:</span> {selectedNode.content}
              </div>
              <div>
                <span className="font-medium">Type:</span>{' '}
                <Badge variant={selectedNode.type === 'center' ? 'default' : 'secondary'}>
                  {selectedNode.type}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Relation Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-red-500" />
              <span className="text-sm">CAUSES</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-green-500" />
              <span className="text-sm">SUPPORTS</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-orange-500" />
              <span className="text-sm">CONTRADICTS</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-blue-500" />
              <span className="text-sm">IMPACTS</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-purple-500" />
              <span className="text-sm">TEMPORAL_BEFORE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-pink-500" />
              <span className="text-sm">TEMPORAL_AFTER</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
