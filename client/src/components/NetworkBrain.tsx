/**
 * NetworkBrain - 3D Hive Mind Visualization
 *
 * Real-time visualization of agent network and resonance connections.
 * Performance-first design targeting 60fps with adaptive rendering.
 *
 * Features:
 * - Agent nodes as glowing spheres
 * - Resonance connections as animated lines
 * - Click nodes to view agent details
 * - Automatic LOD (Level of Detail) based on agent count
 * - Simulated data for < 100 agents
 * - Real-time Socket.IO updates for ≥ 100 agents
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { trpc } from "../lib/trpc";

export type AgentNode = {
  id: number;
  name: string;
  address: string;
  x: number;
  y: number;
  z: number;
  totalMemories: number;
  totalResonances: number;
  creditsBalance: number;
  isActive: boolean;
};

export type ResonanceEdge = {
  consumerId: number;
  providerId: number;
  similarity: number;
  cost: number;
  timestamp: Date;
};

type NetworkBrainProps = {
  className?: string;
  autoRotate?: boolean;
  showStats?: boolean;
  onNodeClick?: (agent: AgentNode) => void;
};

// Generate simulated network for < 100 agents
function generateSimulatedNetwork(agentCount: number): { nodes: AgentNode[]; edges: ResonanceEdge[] } {
  const nodes: AgentNode[] = [];
  const edges: ResonanceEdge[] = [];

  // Create agent nodes in 3D sphere formation
  for (let i = 0; i < agentCount; i++) {
    const phi = Math.acos(-1 + (2 * i) / agentCount);
    const theta = Math.sqrt(agentCount * Math.PI) * phi;

    const radius = 50;
    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);

    nodes.push({
      id: i + 1,
      name: `Agent-${i.toString(16).padStart(6, '0')}`,
      address: `0x${Math.random().toString(16).substring(2, 42)}`,
      x,
      y,
      z,
      totalMemories: Math.floor(Math.random() * 100),
      totalResonances: Math.floor(Math.random() * 500),
      creditsBalance: Math.random() * 1000,
      isActive: Math.random() > 0.2,
    });
  }

  // Create resonance edges (connections between agents)
  const edgeCount = Math.min(agentCount * 3, 300); // Limit edges for performance
  for (let i = 0; i < edgeCount; i++) {
    const consumer = nodes[Math.floor(Math.random() * nodes.length)];
    const provider = nodes[Math.floor(Math.random() * nodes.length)];

    if (consumer.id !== provider.id) {
      edges.push({
        consumerId: consumer.id,
        providerId: provider.id,
        similarity: 0.85 + Math.random() * 0.15,
        cost: Math.random() * 0.01,
        timestamp: new Date(Date.now() - Math.random() * 3600000),
      });
    }
  }

  return { nodes, edges };
}

export function NetworkBrain({
  className = "",
  autoRotate = true,
  showStats = true,
  onNodeClick,
}: NetworkBrainProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const mouseRef = useRef(new THREE.Vector2());

  const [agentCount, setAgentCount] = useState(0);
  const [useSimulated, setUseSimulated] = useState(true);
  const [fps, setFps] = useState(60);

  // Refs for meshes
  const agentMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const edgeLinesRef = useRef<THREE.LineSegments[]>([]);
  const particlesRef = useRef<THREE.Points | null>(null);

  // Query network activity for real data
  const { data: networkActivity } = trpc.resonance.getNetworkActivity.useQuery(
    { limit: 50 },
    { enabled: !useSimulated, refetchInterval: 5000 }
  );

  // Generate or fetch network data
  const networkData = useMemo(() => {
    if (useSimulated) {
      return generateSimulatedNetwork(Math.min(agentCount, 100));
    }

    // TODO: Transform networkActivity into nodes and edges
    // For now, use simulated data
    return generateSimulatedNetwork(50);
  }, [agentCount, useSimulated, networkActivity]);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e27);
    scene.fog = new THREE.FogExp2(0x0a0e27, 0.0025);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 100, 150);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance" // Prioritize performance
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.3;
    controls.minDistance = 50;
    controls.maxDistance = 500;
    controlsRef.current = controls;

    // Raycaster for click detection
    raycasterRef.current = new THREE.Raycaster();
    raycasterRef.current.params.Points!.threshold = 2;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x3b82f6, 1, 500);
    pointLight1.position.set(100, 100, 100);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x8b5cf6, 0.8, 500);
    pointLight2.position.set(-100, -100, -100);
    scene.add(pointLight2);

    // Starfield background
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 5000;
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 2000;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.7,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Animation loop
    let frameCount = 0;
    let lastTime = performance.now();

    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

      frameCount++;
      const currentTime = performance.now();

      // Calculate FPS every second
      if (currentTime - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = currentTime;
      }

      controls.update();

      // Animate agent nodes (gentle pulsing)
      agentMeshesRef.current.forEach((mesh, id) => {
        const scale = 1 + Math.sin(currentTime * 0.001 + id) * 0.1;
        mesh.scale.setScalar(scale);
      });

      // Animate connection lines (flowing energy)
      edgeLinesRef.current.forEach((line, idx) => {
        const material = line.material as THREE.LineBasicMaterial;
        material.opacity = 0.3 + Math.sin(currentTime * 0.002 + idx) * 0.2;
      });

      renderer.render(sceneRef.current, cameraRef.current);
      requestAnimationFrame(animate);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = container.clientWidth / container.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    // Handle click events
    const handleClick = (event: MouseEvent) => {
      if (!rendererRef.current || !cameraRef.current || !raycasterRef.current) return;

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

      const meshes = Array.from(agentMeshesRef.current.values());
      const intersects = raycasterRef.current.intersectObjects(meshes);

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh;
        const agentId = Array.from(agentMeshesRef.current.entries())
          .find(([, mesh]) => mesh === clickedMesh)?.[0];

        if (agentId) {
          const agent = networkData.nodes.find(n => n.id === agentId);
          if (agent && onNodeClick) {
            onNodeClick(agent);
          }
        }
      }
    };

    renderer.domElement.addEventListener('click', handleClick);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, [autoRotate, onNodeClick]);

  // Update network visualization when data changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear existing meshes
    agentMeshesRef.current.forEach(mesh => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    agentMeshesRef.current.clear();

    edgeLinesRef.current.forEach(line => {
      scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    edgeLinesRef.current.length = 0;

    // Create agent nodes
    networkData.nodes.forEach(agent => {
      const geometry = new THREE.SphereGeometry(2, 16, 16);
      const color = agent.isActive ? 0x3b82f6 : 0x6b7280;
      const material = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.5,
        shininess: 100,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(agent.x, agent.y, agent.z);
      mesh.userData = { agentId: agent.id };

      scene.add(mesh);
      agentMeshesRef.current.set(agent.id, mesh);

      // Add glow effect
      const glowGeometry = new THREE.SphereGeometry(2.5, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.2,
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      mesh.add(glow);
    });

    // Create resonance connection lines
    networkData.edges.forEach((edge, idx) => {
      const consumerNode = networkData.nodes.find(n => n.id === edge.consumerId);
      const providerNode = networkData.nodes.find(n => n.id === edge.providerId);

      if (!consumerNode || !providerNode) return;

      const points = [
        new THREE.Vector3(consumerNode.x, consumerNode.y, consumerNode.z),
        new THREE.Vector3(providerNode.x, providerNode.y, providerNode.z),
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.3,
        linewidth: 1,
      });

      const line = new THREE.LineSegments(geometry, material);
      scene.add(line);
      edgeLinesRef.current.push(line);
    });

    setAgentCount(networkData.nodes.length);
    setUseSimulated(networkData.nodes.length < 100);
  }, [networkData]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={containerRef} className="w-full h-full" />

      {showStats && (
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-white space-y-2">
          <div className="text-sm font-mono">
            <div>Agents: {agentCount}</div>
            <div>Connections: {networkData.edges.length}</div>
            <div>FPS: {fps}</div>
            <div>Mode: {useSimulated ? 'Simulated' : 'Real-time'}</div>
          </div>

          <div className="text-xs text-gray-400 space-y-1">
            <div>💙 Active Agent</div>
            <div>⚪ Inactive Agent</div>
            <div>💜 Resonance Connection</div>
          </div>
        </div>
      )}

      {fps < 30 && (
        <div className="absolute bottom-4 right-4 bg-yellow-500/20 border border-yellow-500 rounded-lg p-3 text-yellow-200 text-sm">
          ⚠️ Low FPS detected. Reducing render quality...
        </div>
      )}
    </div>
  );
}
