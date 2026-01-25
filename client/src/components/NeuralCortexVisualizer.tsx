/**
 * NeuralCortexVisualizer - AI Neural Cortex Visualization
 * Displays AI knowledge clusters as a brain-like neural network
 * Inspired by Project Golem's cortex visualization
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Knowledge domain definitions
export interface KnowledgeDomain {
  id: string;
  name: string;
  color: string;
  nodeCount: number;
  center: [number, number, number];
  spread: number;
}

export interface CortexNode {
  id: string;
  domain: string;
  position: [number, number, number];
  connections: string[];
  activation: number; // 0-1, how "active" this node is
  label?: string;
}

export interface NeuralCortexProps {
  domains?: KnowledgeDomain[];
  nodes?: CortexNode[];
  searchQuery?: string;
  onNodeHover?: (node: CortexNode | null) => void;
  onDomainClick?: (domain: KnowledgeDomain) => void;
  className?: string;
  showLabels?: boolean;
  particleSize?: number;
  connectionOpacity?: number;
}

// Default knowledge domains for LatentMAS
const DEFAULT_DOMAINS: KnowledgeDomain[] = [
  { id: 'ancient-egypt', name: 'ANCIENT EGYPT', color: '#f59e0b', nodeCount: 800, center: [40, 25, 10], spread: 12 },
  { id: 'artificial-intelligence', name: 'ARTIFICIAL INTELLIGENCE', color: '#a855f7', nodeCount: 1200, center: [-15, 30, 5], spread: 18 },
  { id: 'astrophysics', name: 'ASTROPHYSICS', color: '#ec4899', nodeCount: 600, center: [-30, 20, -5], spread: 10 },
  { id: 'behavioral', name: 'BEHAVIORAL', color: '#f97316', nodeCount: 500, center: [25, 10, 15], spread: 8 },
  { id: 'botany', name: 'BOTANY', color: '#22c55e', nodeCount: 400, center: [50, -10, 5], spread: 8 },
  { id: 'chess', name: 'CHESS', color: '#eab308', nodeCount: 300, center: [35, -25, 0], spread: 6 },
  { id: 'cryptography', name: 'CRYPTOGRAPHY', color: '#06b6d4', nodeCount: 700, center: [15, -15, 20], spread: 10 },
  { id: 'cybernetics', name: 'CYBERNETICS', color: '#8b5cf6', nodeCount: 900, center: [-5, 15, 10], spread: 14 },
  { id: 'game-theory', name: 'GAME THEORY', color: '#f43f5e', nodeCount: 450, center: [20, 0, -10], spread: 8 },
  { id: 'genetics', name: 'GENETICS', color: '#10b981', nodeCount: 800, center: [45, 5, -15], spread: 12 },
  { id: 'immunology', name: 'IMMUNOLOGY', color: '#14b8a6', nodeCount: 550, center: [55, -5, 10], spread: 9 },
  { id: 'industrial-revolution', name: 'INDUSTRIAL REVOLUTION', color: '#78716c', nodeCount: 400, center: [30, -35, 5], spread: 7 },
  { id: 'music-theory', name: 'MUSIC THEORY', color: '#d946ef', nodeCount: 350, center: [-25, -10, 15], spread: 7 },
  { id: 'neurology', name: 'NEUROLOGY', color: '#3b82f6', nodeCount: 750, center: [-10, 5, -5], spread: 11 },
  { id: 'optics', name: 'OPTICS', color: '#0ea5e9', nodeCount: 400, center: [-35, -5, 0], spread: 7 },
  { id: 'quantum-mechanics', name: 'QUANTUM MECHANICS', color: '#6366f1', nodeCount: 650, center: [-45, 10, 10], spread: 10 },
  { id: 'renaissance', name: 'RENAISSANCE', color: '#84cc16', nodeCount: 500, center: [10, 35, -5], spread: 9 },
  { id: 'robotics', name: 'ROBOTICS', color: '#ef4444', nodeCount: 850, center: [0, -20, 0], spread: 13 },
  { id: 'roman-empire', name: 'ROMAN EMPIRE', color: '#b91c1c', nodeCount: 450, center: [40, 40, 0], spread: 8 },
  { id: 'thermodynamics', name: 'THERMODYNAMICS', color: '#fb923c', nodeCount: 500, center: [-20, -25, -10], spread: 8 },
];

// Generate nodes for a domain with organic clustering
function generateDomainNodes(domain: KnowledgeDomain): CortexNode[] {
  const nodes: CortexNode[] = [];
  const [cx, cy, cz] = domain.center;
  
  for (let i = 0; i < domain.nodeCount; i++) {
    // Use gaussian-like distribution for organic clustering
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = domain.spread * Math.pow(Math.random(), 0.5); // Denser at center
    
    // Add some noise for organic feel
    const noise = () => (Math.random() - 0.5) * 2;
    
    const x = cx + r * Math.sin(phi) * Math.cos(theta) + noise();
    const y = cy + r * Math.sin(phi) * Math.sin(theta) + noise();
    const z = cz + r * Math.cos(phi) + noise();
    
    nodes.push({
      id: `${domain.id}-${i}`,
      domain: domain.id,
      position: [x, y, z],
      connections: [],
      activation: 0.3 + Math.random() * 0.7,
    });
  }
  
  return nodes;
}

export function NeuralCortexVisualizer({
  domains = DEFAULT_DOMAINS,
  nodes: externalNodes,
  searchQuery,
  onNodeHover,
  onDomainClick,
  className,
  showLabels = true,
  particleSize = 0.15,
  connectionOpacity = 0.1,
}: NeuralCortexProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const connectionsRef = useRef<THREE.LineSegments | null>(null);
  const animationRef = useRef<number>(0);
  const nodesRef = useRef<CortexNode[]>([]);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [matchInfo, setMatchInfo] = useState<{ domain: string; count: number } | null>(null);

  // Generate all nodes
  const allNodes = useCallback(() => {
    if (externalNodes) return externalNodes;
    
    let nodes: CortexNode[] = [];
    domains.forEach(domain => {
      nodes = nodes.concat(generateDomainNodes(domain));
    });
    return nodes;
  }, [domains, externalNodes]);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 100);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controlsRef.current = controls;

    // Generate nodes
    const nodes = allNodes();
    nodesRef.current = nodes;

    // Create particles
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);
    const sizes = new Float32Array(nodes.length);

    nodes.forEach((node, i) => {
      positions[i * 3] = node.position[0];
      positions[i * 3 + 1] = node.position[1];
      positions[i * 3 + 2] = node.position[2];

      const domain = domains.find(d => d.id === node.domain);
      const color = new THREE.Color(domain?.color || '#ffffff');
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = particleSize * (0.5 + node.activation * 0.5);
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader for glowing particles
    const material = new THREE.ShaderMaterial({
      uniforms: {
        pointSize: { value: particleSize * 10 },
      },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          gl_FragColor = vec4(vColor, alpha * 0.9);
        }
      `,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    particlesRef.current = particles;
    scene.add(particles);

    // Create inter-domain connections (sparse)
    const connectionPositions: number[] = [];
    const connectionColors: number[] = [];
    
    // Connect nearby nodes from different domains
    const connectionDensity = 0.001; // Very sparse
    for (let i = 0; i < nodes.length; i++) {
      if (Math.random() > connectionDensity) continue;
      
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.random() > connectionDensity * 10) continue;
        if (nodes[i].domain === nodes[j].domain) continue;
        
        const dx = nodes[i].position[0] - nodes[j].position[0];
        const dy = nodes[i].position[1] - nodes[j].position[1];
        const dz = nodes[i].position[2] - nodes[j].position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (dist < 25) { // Only connect nearby nodes
          connectionPositions.push(
            nodes[i].position[0], nodes[i].position[1], nodes[i].position[2],
            nodes[j].position[0], nodes[j].position[1], nodes[j].position[2]
          );
          
          const color1 = new THREE.Color(domains.find(d => d.id === nodes[i].domain)?.color || '#fff');
          const color2 = new THREE.Color(domains.find(d => d.id === nodes[j].domain)?.color || '#fff');
          connectionColors.push(
            color1.r, color1.g, color1.b,
            color2.r, color2.g, color2.b
          );
        }
      }
    }

    if (connectionPositions.length > 0) {
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(connectionPositions, 3));
      lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(connectionColors, 3));
      
      const lineMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: connectionOpacity,
        blending: THREE.AdditiveBlending,
      });
      
      const connections = new THREE.LineSegments(lineGeometry, lineMaterial);
      connectionsRef.current = connections;
      scene.add(connections);
    }

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = container.clientWidth / container.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationRef.current);
      controls.dispose();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [domains, allNodes, particleSize, connectionOpacity]);

  // Handle search query - highlight matching domain
  useEffect(() => {
    if (!searchQuery || !particlesRef.current) {
      setMatchInfo(null);
      setActiveDomain(null);
      return;
    }

    const query = searchQuery.toLowerCase();
    const matchedDomain = domains.find(d => 
      d.name.toLowerCase().includes(query) ||
      d.id.toLowerCase().includes(query)
    );

    if (matchedDomain) {
      setActiveDomain(matchedDomain.id);
      setMatchInfo({ domain: matchedDomain.name, count: matchedDomain.nodeCount });
      
      // Update particle colors to highlight matched domain
      const colors = particlesRef.current.geometry.attributes.color;
      const nodes = nodesRef.current;
      
      nodes.forEach((node, i) => {
        const domain = domains.find(d => d.id === node.domain);
        const isMatch = node.domain === matchedDomain.id;
        const color = new THREE.Color(domain?.color || '#ffffff');
        
        if (!isMatch) {
          color.multiplyScalar(0.2); // Dim non-matching
        }
        
        colors.setXYZ(i, color.r, color.g, color.b);
      });
      
      colors.needsUpdate = true;
    } else {
      setActiveDomain(null);
      setMatchInfo(null);
      
      // Reset colors
      const colors = particlesRef.current.geometry.attributes.color;
      const nodes = nodesRef.current;
      
      nodes.forEach((node, i) => {
        const domain = domains.find(d => d.id === node.domain);
        const color = new THREE.Color(domain?.color || '#ffffff');
        colors.setXYZ(i, color.r, color.g, color.b);
      });
      
      colors.needsUpdate = true;
    }
  }, [searchQuery, domains]);

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Domain Legend */}
      {showLabels && (
        <div className="absolute top-4 right-4 text-xs font-mono space-y-1 max-h-[60%] overflow-y-auto">
          {domains.map(domain => (
            <div
              key={domain.id}
              className={`flex items-center gap-2 cursor-pointer transition-opacity ${
                activeDomain && activeDomain !== domain.id ? 'opacity-30' : 'opacity-100'
              }`}
              onClick={() => onDomainClick?.(domain)}
            >
              <span className="text-slate-400 text-right" style={{ minWidth: '140px' }}>
                {domain.name}
              </span>
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: domain.color }}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Match Info */}
      {matchInfo && (
        <div className="absolute top-4 left-4 font-mono text-xs">
          <div className="text-green-400">
            &gt; Top Match: {matchInfo.domain}
          </div>
          <div className="text-cyan-400">
            [{matchInfo.count} nodes]
          </div>
        </div>
      )}
    </div>
  );
}

export default NeuralCortexVisualizer;
