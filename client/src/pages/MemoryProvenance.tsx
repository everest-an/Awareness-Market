import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'wouter';
import * as d3 from 'd3';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/components/Navbar';
import {
  GitBranch,
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Download,
  ArrowLeft,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface MemoryNode {
  id: string;
  title: string;
  creator: string;
  createdAt: string;
  epsilon: number;
  price: number;
  downloads: number;
  royaltyShare: number;
  children?: MemoryNode[];
}

export default function MemoryProvenance() {
  const { id } = useParams();
  const svgRef = useRef<SVGSVGElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<MemoryNode | null>(null);

  // Fetch provenance data
  const { data: provenance, isLoading } = trpc.memoryNFT.getProvenance.useQuery(
    { memoryId: id! },
    { enabled: !!id }
  );


  useEffect(() => {
    if (!svgRef.current) return;
    if (!provenance) return;

    const data = provenance as MemoryNode;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll('*').remove();

    // Set up dimensions
    const width = isFullscreen ? window.innerWidth - 100 : 1200;
    const height = isFullscreen ? window.innerHeight - 200 : 600;
    const margin = { top: 40, right: 120, bottom: 40, left: 120 };

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .style('font', '12px sans-serif')
      .style('user-select', 'none');

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create tree layout
    const treeLayout = d3.tree<MemoryNode>()
      .size([height - margin.top - margin.bottom, width - margin.left - margin.right]);

    // Create hierarchy
    const root = d3.hierarchy(data);
    const treeData = treeLayout(root);

    // Add links (edges)
    type TreeNode = d3.HierarchyPointNode<MemoryNode>;
    type TreeLink = d3.HierarchyPointLink<MemoryNode>;

    g.selectAll('.link')
      .data(treeData.links())
      .join('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#64748b')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .attr('d', d3.linkHorizontal<TreeLink, TreeNode>()
        .x((d) => d.y)
        .y((d) => d.x)
      );

    // Add nodes
    const nodes = g.selectAll('.node')
      .data(treeData.descendants())
      .join('g')
      .attr('class', 'node')
      .attr('transform', (d: TreeNode) => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')
      .on('click', (_event: MouseEvent, d: TreeNode) => {
        setSelectedNode(d.data);
      });

    // Add circles for nodes
    nodes.append('circle')
      .attr('r', 8)
      .attr('fill', (d: TreeNode) => {
        const epsilon = d.data.epsilon;
        if (epsilon < 3) return '#10b981'; // Green (Platinum/Gold)
        if (epsilon < 4) return '#3b82f6'; // Blue (Silver)
        return '#f59e0b'; // Orange (Bronze)
      })
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 2);

    // Add labels
    nodes.append('text')
      .attr('dy', '0.31em')
      .attr('x', (d: TreeNode) => d.children ? -12 : 12)
      .attr('text-anchor', (d: TreeNode) => d.children ? 'end' : 'start')
      .text((d: TreeNode) => d.data.title)
      .attr('fill', '#f1f5f9')
      .attr('font-size', '13px')
      .attr('font-weight', '500')
      .clone(true).lower()
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 3);

    // Add epsilon labels
    nodes.append('text')
      .attr('dy', '1.8em')
      .attr('x', (d: TreeNode) => d.children ? -12 : 12)
      .attr('text-anchor', (d: TreeNode) => d.children ? 'end' : 'start')
      .text((d: TreeNode) => `ε: ${d.data.epsilon}%`)
      .attr('fill', '#94a3b8')
      .attr('font-size', '11px');

    // Add royalty flow indicators
    treeData.links().forEach((link: TreeLink) => {
      const midX = (link.source.y + link.target.y) / 2;
      const midY = (link.source.x + link.target.x) / 2;

      g.append('circle')
        .attr('cx', midX)
        .attr('cy', midY)
        .attr('r', 4)
        .attr('fill', '#f59e0b')
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1)
        .append('title')
        .text(`Royalty: ${link.target.data.royaltyShare}%`);
    });

  }, [provenance, isFullscreen]);

  const getCertificationLevel = (epsilon: number) => {
    if (epsilon < 2.5) return { label: 'Platinum', color: 'bg-purple-500/20 text-purple-400' };
    if (epsilon < 3.5) return { label: 'Gold', color: 'bg-yellow-500/20 text-yellow-400' };
    if (epsilon < 4.5) return { label: 'Silver', color: 'bg-gray-400/20 text-gray-300' };
    return { label: 'Bronze', color: 'bg-orange-500/20 text-orange-400' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="pt-20 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/memory-marketplace">
            <Button variant="ghost" className="mb-4 text-cyan-400 hover:text-cyan-300">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Marketplace
            </Button>
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Memory Provenance
              </h1>
              <p className="text-slate-400 text-lg">
                Explore the derivation chain and royalty flow of this memory
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="border-slate-700 hover:bg-slate-800"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-4 w-4 mr-2" />
                  Exit Fullscreen
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4 mr-2" />
                  Fullscreen
                </>
              )}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-white py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p>Loading provenance data...</p>
          </div>
        ) : !provenance ? (
          <div className="text-center text-white py-20">
            <p>No provenance data available for this memory yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Family Tree Visualization */}
            <Card className={`${isFullscreen ? 'lg:col-span-3' : 'lg:col-span-2'} bg-slate-900/50 border-slate-800 p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-cyan-400" />
                  Derivation Family Tree
                </h2>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>Platinum/Gold</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span>Silver</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span>Bronze</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/50 rounded-lg p-4 overflow-auto">
                <svg ref={svgRef}></svg>
              </div>

              <div className="mt-4 text-sm text-slate-400">
                <p className="mb-2">
                  <strong className="text-slate-300">How to use:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Click on any node to view detailed information</li>
                  <li>Scroll to zoom in/out</li>
                  <li>Drag to pan around the tree</li>
                  <li>Orange dots on edges represent royalty flow</li>
                </ul>
              </div>
            </Card>

            {/* Node Details Panel */}
            {!isFullscreen && (
              <Card className="bg-slate-900/50 border-slate-800 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">
                  {selectedNode ? 'Node Details' : 'Select a Node'}
                </h2>

                {selectedNode ? (
                  <div className="space-y-4">
                    {/* Title */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {selectedNode.title}
                      </h3>
                      <Badge className={getCertificationLevel(selectedNode.epsilon).color}>
                        {getCertificationLevel(selectedNode.epsilon).label}
                      </Badge>
                    </div>

                    {/* Creator */}
                    <div className="flex items-center gap-2 text-slate-300">
                      <Users className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm">Creator:</span>
                      <span className="font-semibold">{selectedNode.creator}</span>
                    </div>

                    {/* Created Date */}
                    <div className="flex items-center gap-2 text-slate-300">
                      <Calendar className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm">Created:</span>
                      <span className="font-semibold">
                        {new Date(selectedNode.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Epsilon */}
                    <div className="flex items-center gap-2 text-slate-300">
                      <TrendingUp className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm">Epsilon:</span>
                      <span className="font-semibold">{selectedNode.epsilon}%</span>
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-2 text-slate-300">
                      <DollarSign className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm">Price:</span>
                      <span className="font-semibold">${selectedNode.price.toFixed(2)}</span>
                    </div>

                    {/* Downloads */}
                    <div className="flex items-center gap-2 text-slate-300">
                      <Download className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm">Downloads:</span>
                      <span className="font-semibold">{selectedNode.downloads}</span>
                    </div>

                    {/* Royalty Share */}
                    <div className="p-4 bg-slate-950/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">Royalty Share</span>
                        <span className="text-2xl font-bold text-cyan-400">
                          {selectedNode.royaltyShare}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full"
                          style={{ width: `${selectedNode.royaltyShare}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Percentage of revenue shared with parent creators
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 space-y-2">
                      <Link href={`/memory/${selectedNode.id}`}>
                        <Button className="w-full bg-cyan-500 hover:bg-cyan-600">
                          View in Marketplace
                        </Button>
                      </Link>
                      <Link href={`/package/memory/${selectedNode.id}`}>
                        <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800">
                          <Download className="mr-2 h-4 w-4" />
                          Download Memory
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-12">
                    <GitBranch className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Click on any node in the tree to view its details</p>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* Royalty Flow Explanation */}
        <Card className="mt-8 bg-slate-900/50 border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-cyan-400" />
            How Royalty Flow Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold text-white mb-2">1. Original Creator</h3>
              <p className="text-sm text-slate-400">
                The original memory creator receives 100% of their sales revenue and 30% royalty from all derivative works.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">2. Derivative Creator</h3>
              <p className="text-sm text-slate-400">
                When you create a derivative, you keep 70% of your sales. The remaining 30% is distributed to parent creators.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-2">3. Multi-Level Royalties</h3>
              <p className="text-sm text-slate-400">
                Royalties flow up the entire chain. Each level receives a proportional share, incentivizing quality improvements.
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <p className="text-sm text-cyan-300">
              <strong>Example:</strong> If a 3rd-generation derivative sells for $20, the immediate parent gets $6 (30%), 
              the grandparent gets $1.80 (30% of $6), and the original creator gets $0.54 (30% of $1.80). 
              The derivative creator keeps $11.66.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
