/**
 * Awareness Neural Cortex Visualizer
 * 3D code knowledge graph visualization with GitNexus-style data
 *
 * Visual Elements:
 * - Points  = Code nodes (files, functions, classes, interfaces)
 * - Lines   = Dependency edges (imports, calls, defined_in)
 * - Colors  = Directory cluster + node type blend
 * - Flash   = White activation pulse (preserved GLSL shader)
 * - Blur    = Soft radial falloff particles (preserved GLSL shader)
 */

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { CodeEdge } from '../../../server/code-graph/types';

// ============ DATA TYPES ============

export interface CortexNode {
  id: string;
  title: string;
  category: string;
  position: [number, number, number];
  color: [number, number, number];     // RGB 0-1
  activation: number;
  agentId?: string;                    // directory cluster ID
  domain?: string;                     // language
  timestamp?: Date;
  // Code graph extensions
  codeNodeType?: string;
  filePath?: string;
  lineStart?: number;
}

export interface AgentNode {
  id: string;
  name: string;
  model: string;
  position: [number, number, number];
  color: string;
  activity: number;
  status: 'idle' | 'thinking' | 'transferring';
}

export interface NeuralCortexProps {
  agents?: AgentNode[];
  nodes?: CortexNode[];
  edges?: CodeEdge[];
  onNodeClick?: (node: CortexNode | null) => void;
  className?: string;
  showLabels?: boolean;
  selectedAgents?: Set<string>;
  selectedCategories?: Set<string>;
  onAgentToggle?: (agentId: string) => void;
  onCategoryToggle?: (category: string) => void;
  onClearFilters?: () => void;
  highlightNodes?: Set<string>;
  impactNodeIds?: { depth1: Set<string>; depth2: Set<string>; depth3: Set<string> };
}

export interface NeuralCortexHandle {
  triggerPulse: (indices: number[]) => void;
  triggerPulseByFilePaths: (filePaths: string[]) => void;
}

// ============ DEFAULT DEMO DATA (fallback) ============

const DEFAULT_AGENTS: AgentNode[] = [
  { id: 'server/', name: 'server', model: 'dir', position: [0, 0, 0], color: '#06b6d4', activity: 0.9, status: 'thinking' },
  { id: 'client/src/', name: 'client', model: 'dir', position: [30, 15, 10], color: '#f97316', activity: 0.85, status: 'idle' },
];

// ============ SHADER CODE (PRESERVED) ============

const vertexShader = `
  attribute vec3 color;
  attribute float activationTime;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uTime;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float timeSinceHit = uTime - activationTime;
    float intensity = 0.0;

    if (timeSinceHit > 0.0 && timeSinceHit < 3.0) {
      intensity = 1.0 / (1.0 + timeSinceHit * 3.0);
      gl_PointSize = (5.0 * (1.0 + intensity * 3.0)) * (300.0 / -mvPosition.z);
    } else {
      gl_PointSize = 4.0 * (300.0 / -mvPosition.z);
    }

    gl_Position = projectionMatrix * mvPosition;
    vColor = mix(color, vec3(1.0, 1.0, 1.0), intensity * 0.7);
    vAlpha = 0.6 + (intensity * 0.4);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    if(length(coord) > 0.5) discard;
    float strength = 1.0 - (length(coord) * 2.0);
    gl_FragColor = vec4(vColor, vAlpha * strength);
  }
`;

// ============ MAIN COMPONENT ============

export const NeuralCortexVisualizer = forwardRef<NeuralCortexHandle, NeuralCortexProps>(function NeuralCortexVisualizer({
  agents = DEFAULT_AGENTS,
  nodes: propNodes,
  edges: propEdges,
  onNodeClick,
  className,
  showLabels = true,
  selectedAgents = new Set(),
  selectedCategories = new Set(),
  onAgentToggle,
  onCategoryToggle,
  onClearFilters,
  highlightNodes,
  impactNodeIds,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const animationRef = useRef<number>(0);
  const nodesRef = useRef<CortexNode[]>([]);
  const edgesRef = useRef<CodeEdge[]>([]);

  const [hoveredNode, setHoveredNode] = useState<CortexNode | null>(null);
  const [categories, setCategories] = useState<Map<string, string>>(new Map());

  const handleZoomIn = useCallback(() => {
    if (cameraRef.current) cameraRef.current.position.multiplyScalar(0.8);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (cameraRef.current) cameraRef.current.position.multiplyScalar(1.25);
  }, []);

  const handleResetView = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 20, 80);
      (controlsRef.current as any).target.set(0, 0, 0);
    }
  }, []);

  // Trigger activation pulse on specific node indices
  const triggerPulse = useCallback((indices: number[]) => {
    if (!geometryRef.current) return;

    const currentTime = performance.now() / 1000;
    const activations = geometryRef.current.attributes.activationTime.array as Float32Array;

    indices.forEach((idx, i) => {
      if (idx < activations.length) {
        activations[idx] = currentTime + (i * 0.015);
      }
    });

    geometryRef.current.attributes.activationTime.needsUpdate = true;
  }, []);

  // Trigger pulse by file paths (for workspace code change events)
  const triggerPulseByFilePaths = useCallback((filePaths: string[]) => {
    const matchingIndices: number[] = [];
    nodesRef.current.forEach((node, i) => {
      if (node.filePath && filePaths.some(fp => node.filePath!.endsWith(fp) || fp.endsWith(node.filePath!))) {
        matchingIndices.push(i);
      }
    });
    if (matchingIndices.length > 0) {
      triggerPulse(matchingIndices);
    }
  }, [triggerPulse]);

  // Expose triggerPulse via ref for parent component
  useImperativeHandle(ref, () => ({
    triggerPulse,
    triggerPulseByFilePaths,
  }), [triggerPulse, triggerPulseByFilePaths]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !propNodes?.length) return;

    const nodes = propNodes;
    const edges = propEdges || [];
    nodesRef.current = nodes;
    edgesRef.current = edges;

    // Build category map for legend
    const catMap = new Map<string, string>();
    nodes.forEach(n => {
      if (!catMap.has(n.category)) {
        const r = Math.floor(n.color[0] * 255);
        const g = Math.floor(n.color[1] * 255);
        const b = Math.floor(n.color[2] * 255);
        catMap.set(n.category, `rgb(${r},${g},${b})`);
      }
    });
    setCategories(catMap);

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.003);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 20, 80);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controlsRef.current = controls;

    // ── Build point geometry ──
    const positions: number[] = [];
    const colors: number[] = [];
    const activationTimes: number[] = [];

    nodes.forEach(n => {
      positions.push(n.position[0], n.position[1], n.position[2]);
      colors.push(n.color[0], n.color[1], n.color[2]);
      activationTimes.push(-100.0);
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('activationTime', new THREE.Float32BufferAttribute(activationTimes, 1));
    (geometry.attributes.activationTime as any).setUsage(THREE.DynamicDrawUsage);
    geometryRef.current = geometry;

    // Shader material (preserved)
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    materialRef.current = material;

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // ── Build edge geometry (NEW: glowing dependency lines) ──
    let edgeGeometry: THREE.BufferGeometry | null = null;
    let edgeMaterial: THREE.LineBasicMaterial | null = null;

    if (edges.length > 0) {
      const nodeIndexMap = new Map<string, number>();
      nodes.forEach((n, i) => nodeIndexMap.set(n.id, i));

      const edgePositions: number[] = [];
      const edgeColors: number[] = [];

      for (const edge of edges) {
        const srcIdx = nodeIndexMap.get(edge.source);
        const tgtIdx = nodeIndexMap.get(edge.target);
        if (srcIdx === undefined || tgtIdx === undefined) continue;

        const src = nodes[srcIdx];
        const tgt = nodes[tgtIdx];

        edgePositions.push(
          src.position[0], src.position[1], src.position[2],
          tgt.position[0], tgt.position[1], tgt.position[2],
        );

        // Edge color: blend source + target
        const r = (src.color[0] + tgt.color[0]) / 2;
        const g = (src.color[1] + tgt.color[1]) / 2;
        const b = (src.color[2] + tgt.color[2]) / 2;
        edgeColors.push(r, g, b, r, g, b);
      }

      edgeGeometry = new THREE.BufferGeometry();
      edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
      edgeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(edgeColors, 3));

      edgeMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const lineSegments = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      scene.add(lineSegments);
    }

    // ── Mouse interaction ──
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 2 };
    const mouse = new THREE.Vector2();

    const handleMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(points);

      if (intersects.length > 0 && intersects[0].index !== undefined) {
        setHoveredNode(nodesRef.current[intersects[0].index]);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredNode(null);
        renderer.domElement.style.cursor = 'default';
      }
    };

    const handleClick = () => {
      if (hoveredNode) {
        onNodeClick?.(hoveredNode);
        const idx = nodesRef.current.findIndex(n => n.id === hoveredNode.id);
        if (idx >= 0) {
          // BFS pulse along edges
          const pulseIndices = bfsAlongEdges(idx, nodesRef.current, edgesRef.current, 30);
          triggerPulse(pulseIndices);
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleClick);

    // ── Animation loop ──
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      material.uniforms.uTime.value = performance.now() / 1000;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ── Demo: BFS pulse along dependency chains ──
    const demoInterval = setInterval(() => {
      if (edges.length > 0) {
        // Pick random start, BFS along edges
        const startIdx = Math.floor(Math.random() * nodes.length);
        const pulseIndices = bfsAlongEdges(startIdx, nodes, edges, 25);
        triggerPulse(pulseIndices);
      } else {
        // Fallback: old spatial proximity pulse
        const centerIdx = Math.floor(Math.random() * nodes.length);
        const centerPos = nodes[centerIdx].position;
        const randomIndices: number[] = [];
        nodes.forEach((n, i) => {
          const dist = Math.sqrt(
            Math.pow(n.position[0] - centerPos[0], 2) +
            Math.pow(n.position[1] - centerPos[1], 2) +
            Math.pow(n.position[2] - centerPos[2], 2),
          );
          if (dist < 20 && randomIndices.length < 30) randomIndices.push(i);
        });
        triggerPulse(randomIndices);
      }
    }, 3000);

    // ── Resize handler ──
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(demoInterval);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationRef.current);
      controls.dispose();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      edgeGeometry?.dispose();
      edgeMaterial?.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [agents, propNodes, propEdges, onNodeClick, triggerPulse]);

  // Update colors when filter / highlight / impact changes
  useEffect(() => {
    if (!nodesRef.current.length || !geometryRef.current) return;

    const colors = geometryRef.current.attributes.color;
    const nodes = nodesRef.current;
    const hasAgentFilter = selectedAgents.size > 0;
    const hasCategoryFilter = selectedCategories.size > 0;
    const hasHighlight = highlightNodes && highlightNodes.size > 0;
    const hasImpact = impactNodeIds && (impactNodeIds.depth1.size > 0 || impactNodeIds.depth2.size > 0 || impactNodeIds.depth3.size > 0);

    // Impact depth colors
    const IMPACT_D1 = new THREE.Color(1.0, 0.25, 0.25); // Red
    const IMPACT_D2 = new THREE.Color(1.0, 0.6, 0.15);  // Orange
    const IMPACT_D3 = new THREE.Color(1.0, 0.9, 0.2);   // Yellow

    nodes.forEach((node, i) => {
      const baseColor = new THREE.Color(node.color[0], node.color[1], node.color[2]);

      // Impact overlay takes highest priority
      if (hasImpact) {
        if (impactNodeIds.depth1.has(node.id)) {
          colors.setXYZ(i, IMPACT_D1.r, IMPACT_D1.g, IMPACT_D1.b);
        } else if (impactNodeIds.depth2.has(node.id)) {
          colors.setXYZ(i, IMPACT_D2.r, IMPACT_D2.g, IMPACT_D2.b);
        } else if (impactNodeIds.depth3.has(node.id)) {
          colors.setXYZ(i, IMPACT_D3.r, IMPACT_D3.g, IMPACT_D3.b);
        } else {
          colors.setXYZ(i, baseColor.r * 0.08, baseColor.g * 0.08, baseColor.b * 0.08);
        }
        return;
      }

      // Highlight mode (search results, flow paths, community members)
      if (hasHighlight) {
        if (highlightNodes.has(node.id)) {
          // Bright — boost luminosity
          colors.setXYZ(i, Math.min(baseColor.r * 1.5, 1), Math.min(baseColor.g * 1.5, 1), Math.min(baseColor.b * 1.5, 1));
        } else {
          // Dim non-highlighted
          colors.setXYZ(i, baseColor.r * 0.12, baseColor.g * 0.12, baseColor.b * 0.12);
        }
        return;
      }

      // Standard agent/category filter
      const matchesAgent = !hasAgentFilter || selectedAgents.has(node.agentId || '');
      const matchesCategory = !hasCategoryFilter || selectedCategories.has(node.category);
      const passesFilter = matchesAgent && matchesCategory;

      if (passesFilter) {
        colors.setXYZ(i, baseColor.r, baseColor.g, baseColor.b);
      } else {
        colors.setXYZ(i, baseColor.r * 0.1, baseColor.g * 0.1, baseColor.b * 0.1);
      }
    });

    colors.needsUpdate = true;
  }, [selectedAgents, selectedCategories, highlightNodes, impactNodeIds]);

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Zoom Controls - bottom right */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
        <button onClick={handleZoomIn} className="p-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl text-cyan-400 transition-all">
          <ZoomIn className="h-5 w-5" />
        </button>
        <button onClick={handleZoomOut} className="p-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl text-cyan-400 transition-all">
          <ZoomOut className="h-5 w-5" />
        </button>
        <button onClick={handleResetView} className="p-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl text-cyan-400 transition-all">
          <RotateCcw className="h-5 w-5" />
        </button>
      </div>

      {/* Node Type Legend - right side */}
      {showLabels && (
        <div className="absolute top-1/2 -translate-y-1/2 right-6 flex flex-col gap-2 z-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 font-medium mb-1">NODE TYPES</div>
          {Array.from(categories.entries()).sort().map(([cat, color]) => {
            const isSelected = selectedCategories.has(cat);
            const hasFilter = selectedCategories.size > 0;
            return (
              <div
                key={cat}
                className={`flex items-center justify-end gap-3 text-sm cursor-pointer transition-opacity ${
                  hasFilter && !isSelected ? 'opacity-30' : 'opacity-100'
                } hover:opacity-100`}
                onClick={() => onCategoryToggle?.(cat)}
              >
                <span className="text-white/80">{cat}</span>
                <div
                  className={`w-3 h-3 rounded-full border-2 transition-all ${
                    isSelected ? 'border-transparent' : 'border-white/30'
                  }`}
                  style={{
                    backgroundColor: isSelected ? color : 'transparent',
                    boxShadow: isSelected ? `0 0 8px ${color}` : 'none'
                  }}
                />
              </div>
            );
          })}
          {selectedCategories.size > 0 && (
            <button className="text-xs text-cyan-400 mt-2 hover:text-cyan-300" onClick={onClearFilters}>
              Clear ({selectedCategories.size})
            </button>
          )}
        </div>
      )}

      {/* Directory Legend - left side */}
      {showLabels && (
        <div className="absolute top-1/2 -translate-y-1/2 left-6 flex flex-col gap-2 z-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 max-h-[60vh] overflow-y-auto">
          <div className="text-xs text-white/50 font-medium mb-1">DIRECTORIES</div>
          {agents.map(agent => {
            const isSelected = selectedAgents.has(agent.id);
            const hasFilter = selectedAgents.size > 0;
            return (
              <div
                key={agent.id}
                className={`flex items-center gap-3 text-sm cursor-pointer transition-opacity ${
                  hasFilter && !isSelected ? 'opacity-30' : 'opacity-100'
                } hover:opacity-100`}
                onClick={() => onAgentToggle?.(agent.id)}
              >
                <div
                  className={`w-3 h-3 rounded-full border-2 transition-all shrink-0 ${
                    isSelected ? 'border-transparent' : 'border-white/30'
                  }`}
                  style={{
                    backgroundColor: isSelected ? agent.color : 'transparent',
                    boxShadow: isSelected ? `0 0 8px ${agent.color}` : 'none'
                  }}
                />
                <span className="text-white/80 truncate">{agent.name}</span>
              </div>
            );
          })}
          {selectedAgents.size > 0 && (
            <button className="text-xs text-cyan-400 mt-2 hover:text-cyan-300" onClick={onClearFilters}>
              Clear ({selectedAgents.size})
            </button>
          )}
        </div>
      )}

      {/* Hover Tooltip */}
      {hoveredNode && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 z-10 max-w-[400px]">
          <div className="text-cyan-400 text-sm font-medium truncate">{hoveredNode.title}</div>
          <div className="text-xs text-white/50 mt-1">
            {hoveredNode.category}
            {hoveredNode.filePath && ` • ${hoveredNode.filePath}`}
            {hoveredNode.lineStart && `:${hoveredNode.lineStart}`}
          </div>
        </div>
      )}

      {/* Node count */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/30 z-10">
        {nodesRef.current.length} NODES • {edgesRef.current.length} EDGES
      </div>
    </div>
  );
});

// ─── BFS along edges for pulse propagation ───────────────────────────────────

function bfsAlongEdges(
  startIdx: number,
  nodes: CortexNode[],
  edges: CodeEdge[],
  maxNodes: number,
): number[] {
  const startNode = nodes[startIdx];
  if (!startNode) return [startIdx];

  // Build adjacency from edges
  const nodeIdToIdx = new Map<string, number>();
  nodes.forEach((n, i) => nodeIdToIdx.set(n.id, i));

  const adjacency = new Map<number, number[]>();
  for (const edge of edges) {
    const si = nodeIdToIdx.get(edge.source);
    const ti = nodeIdToIdx.get(edge.target);
    if (si === undefined || ti === undefined) continue;
    if (!adjacency.has(si)) adjacency.set(si, []);
    if (!adjacency.has(ti)) adjacency.set(ti, []);
    adjacency.get(si)!.push(ti);
    adjacency.get(ti)!.push(si);
  }

  const visited = new Set<number>([startIdx]);
  const queue = [startIdx];
  const result: number[] = [];

  while (queue.length > 0 && result.length < maxNodes) {
    const current = queue.shift()!;
    result.push(current);
    const neighbors = adjacency.get(current) || [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }

  return result;
}

export default NeuralCortexVisualizer;
