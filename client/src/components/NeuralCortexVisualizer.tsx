/**
 * Awareness Neural Cortex Visualizer
 * 3D visualization of AI neural memory structures
 * 
 * Visual Elements mapped to Neural Bridge data:
 * - Points = Memory nodes (KV-cache entries, tokens)
 * - Colors = Agent/Domain ownership
 * - Activation pulse = Query hit / active inference
 * - Position = Embedding vector in latent space
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// ============ DATA TYPES ============

export interface CortexNode {
  id: string;
  title: string;
  category: string;
  position: [number, number, number];  // 3D position from UMAP
  color: [number, number, number];     // RGB 0-1
  activation: number;                   // Current activation level
  agentId?: string;
  domain?: string;
  timestamp?: Date;
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
  onNodeClick?: (node: CortexNode | null) => void;
  className?: string;
  showLabels?: boolean;
  selectedAgents?: Set<string>;
  selectedCategories?: Set<string>;
  onAgentToggle?: (agentId: string) => void;
  onCategoryToggle?: (category: string) => void;
  onClearFilters?: () => void;
}

// ============ DEFAULT DEMO DATA ============

const CATEGORIES = [
  { name: 'REASONING', color: [0.29, 0.87, 0.50] },      // Green
  { name: 'MEMORY', color: [0.66, 0.33, 0.97] },         // Purple  
  { name: 'LANGUAGE', color: [0.02, 0.71, 0.83] },       // Cyan
  { name: 'CODE', color: [0.98, 0.45, 0.09] },           // Orange
  { name: 'MATH', color: [0.96, 0.26, 0.21] },           // Red
  { name: 'KNOWLEDGE', color: [0.93, 0.69, 0.13] },      // Yellow
  { name: 'VISION', color: [0.93, 0.35, 0.63] },         // Pink
  { name: 'AUDIO', color: [0.23, 0.51, 0.96] },          // Blue
];

const DEFAULT_AGENTS: AgentNode[] = [
  { id: 'gpt-4', name: 'GPT-4', model: 'gpt', position: [0, 0, 0], color: '#a855f7', activity: 0.9, status: 'thinking' },
  { id: 'claude-3', name: 'Claude 3', model: 'claude', position: [30, 15, 10], color: '#06b6d4', activity: 0.85, status: 'transferring' },
  { id: 'llama-3', name: 'Llama 3', model: 'llama', position: [-25, -20, 15], color: '#f97316', activity: 0.7, status: 'thinking' },
  { id: 'gemini', name: 'Gemini', model: 'gemini', position: [20, -30, -10], color: '#22c55e', activity: 0.6, status: 'idle' },
  { id: 'mistral', name: 'Mistral', model: 'mistral', position: [-15, 25, -20], color: '#ec4899', activity: 0.5, status: 'idle' },
];

// Generate demo cortex nodes
function generateDemoNodes(agents: AgentNode[]): CortexNode[] {
  const nodes: CortexNode[] = [];
  const nodeCount = 2500;
  
  for (let i = 0; i < nodeCount; i++) {
    // Pick random agent and category
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    
    // Spherical distribution around agent with some global spread
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 5 + Math.random() * 35;
    
    // Mix agent position with global position
    const agentInfluence = 0.3 + Math.random() * 0.4;
    const x = agent.position[0] * agentInfluence + r * Math.sin(phi) * Math.cos(theta) * (1 - agentInfluence);
    const y = agent.position[1] * agentInfluence + r * Math.sin(phi) * Math.sin(theta) * (1 - agentInfluence);
    const z = agent.position[2] * agentInfluence + r * Math.cos(phi) * (1 - agentInfluence);
    
    // Blend agent color with category color
    const agentColor = new THREE.Color(agent.color);
    const blendFactor = 0.3 + Math.random() * 0.4;
    
    nodes.push({
      id: `node-${i}`,
      title: `Memory ${i}`,
      category: cat.name,
      position: [x, y, z],
      color: [
        cat.color[0] * blendFactor + agentColor.r * (1 - blendFactor),
        cat.color[1] * blendFactor + agentColor.g * (1 - blendFactor),
        cat.color[2] * blendFactor + agentColor.b * (1 - blendFactor),
      ],
      activation: 0,
      agentId: agent.id,
      domain: cat.name,
      timestamp: new Date(Date.now() - Math.random() * 3600000),
    });
  }
  
  return nodes;
}

// ============ SHADER CODE ============

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

export function NeuralCortexVisualizer({
  agents = DEFAULT_AGENTS,
  nodes: propNodes,
  onNodeClick,
  className,
  showLabels = true,
  selectedAgents = new Set(),
  selectedCategories = new Set(),
  onAgentToggle,
  onCategoryToggle,
  onClearFilters,
}: NeuralCortexProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const animationRef = useRef<number>(0);
  const nodesRef = useRef<CortexNode[]>([]);
  
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

  // Trigger activation pulse on specific nodes
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Generate or use provided nodes
    const nodes = propNodes || generateDemoNodes(agents);
    nodesRef.current = nodes;

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
    scene.background = new THREE.Color(0x000000);  // Pure black
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

    // Build geometry
    const positions: number[] = [];
    const colors: number[] = [];
    const activationTimes: number[] = [];

    nodes.forEach(n => {
      positions.push(n.position[0], n.position[1], n.position[2]);
      colors.push(n.color[0], n.color[1], n.color[2]);
      activationTimes.push(-100.0);  // Not activated
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('activationTime', new THREE.Float32BufferAttribute(activationTimes, 1));
    (geometry.attributes.activationTime as any).setUsage(THREE.DynamicDrawUsage);
    geometryRef.current = geometry;

    // Shader material
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

    // Mouse interaction
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
        // Trigger pulse on clicked node and nearby nodes
        const idx = nodesRef.current.findIndex(n => n.id === hoveredNode.id);
        if (idx >= 0) {
          const nearbyIndices = [idx];
          // Find nearby nodes
          const pos = nodesRef.current[idx].position;
          nodesRef.current.forEach((n, i) => {
            if (i !== idx) {
              const dist = Math.sqrt(
                Math.pow(n.position[0] - pos[0], 2) +
                Math.pow(n.position[1] - pos[1], 2) +
                Math.pow(n.position[2] - pos[2], 2)
              );
              if (dist < 15) nearbyIndices.push(i);
            }
          });
          triggerPulse(nearbyIndices);
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleClick);

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      material.uniforms.uTime.value = performance.now() / 1000;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Demo: random activations
    const demoInterval = setInterval(() => {
      const randomIndices: number[] = [];
      const count = 20 + Math.floor(Math.random() * 30);
      const centerIdx = Math.floor(Math.random() * nodes.length);
      const centerPos = nodes[centerIdx].position;
      
      nodes.forEach((n, i) => {
        const dist = Math.sqrt(
          Math.pow(n.position[0] - centerPos[0], 2) +
          Math.pow(n.position[1] - centerPos[1], 2) +
          Math.pow(n.position[2] - centerPos[2], 2)
        );
        if (dist < 20 && randomIndices.length < count) {
          randomIndices.push(i);
        }
      });
      
      triggerPulse(randomIndices);
    }, 3000);

    // Resize handler
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
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [agents, propNodes, onNodeClick, triggerPulse]);

  // Update colors when filter changes
  useEffect(() => {
    if (!nodesRef.current.length || !geometryRef.current) return;
    
    const colors = geometryRef.current.attributes.color;
    const nodes = nodesRef.current;
    const hasAgentFilter = selectedAgents.size > 0;
    const hasCategoryFilter = selectedCategories.size > 0;
    
    nodes.forEach((node, i) => {
      const baseColor = new THREE.Color(
        node.color[0],
        node.color[1],
        node.color[2]
      );
      
      // Check if this node should be highlighted or dimmed
      const matchesAgent = !hasAgentFilter || selectedAgents.has(node.agentId || '');
      const matchesCategory = !hasCategoryFilter || selectedCategories.has(node.category);
      const isHighlighted = matchesAgent && matchesCategory;
      
      if (isHighlighted) {
        // Full brightness
        colors.setXYZ(i, baseColor.r, baseColor.g, baseColor.b);
      } else {
        // Dimmed - 10% brightness
        colors.setXYZ(i, baseColor.r * 0.1, baseColor.g * 0.1, baseColor.b * 0.1);
      }
    });
    
    colors.needsUpdate = true;
  }, [selectedAgents, selectedCategories]);

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

      {/* Category Legend - right side, vertically centered */}
      {showLabels && (
        <div className="absolute top-1/2 -translate-y-1/2 right-6 flex flex-col gap-2 z-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 font-medium mb-1">DOMAINS</div>
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
            <button 
              className="text-xs text-cyan-400 mt-2 hover:text-cyan-300"
              onClick={onClearFilters}
            >
              Clear ({selectedCategories.size})
            </button>
          )}
        </div>
      )}

      {/* Agent Legend - left side, vertically centered */}
      {showLabels && (
        <div className="absolute top-1/2 -translate-y-1/2 left-6 flex flex-col gap-2 z-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
          <div className="text-xs text-white/50 font-medium mb-1">AI AGENTS</div>
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
                  className={`w-3 h-3 rounded-full border-2 transition-all ${
                    isSelected ? 'border-transparent' : 'border-white/30'
                  }`}
                  style={{ 
                    backgroundColor: isSelected ? agent.color : 'transparent',
                    boxShadow: isSelected ? `0 0 8px ${agent.color}` : 'none'
                  }}
                />
                <span className="text-white/80">{agent.name}</span>
              </div>
            );
          })}
          {selectedAgents.size > 0 && (
            <button 
              className="text-xs text-cyan-400 mt-2 hover:text-cyan-300"
              onClick={onClearFilters}
            >
              Clear ({selectedAgents.size})
            </button>
          )}
        </div>
      )}

      {/* Hover Tooltip - bottom center, above node count */}
      {hoveredNode && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 z-10">
          <div className="text-cyan-400 text-sm font-medium">{hoveredNode.title}</div>
          <div className="text-xs text-white/50 mt-1">
            {hoveredNode.category} • {agents.find(a => a.id === hoveredNode.agentId)?.name}
          </div>
        </div>
      )}

      {/* Node count - bottom center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/30 z-10">
        {nodesRef.current.length} NODES
      </div>
    </div>
  );
}

export default NeuralCortexVisualizer;
