/**
 * InferenceVisualizer - 3D visualization of AI-to-AI inference
 * Shows model nodes, W-Matrix transformation edges, and quality metrics
 */

import { useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import type { InferenceNode, InferenceEdge, InferenceSession } from '../../../shared/inference-types';
import { getQualityColor, MODEL_COLORS } from '../../../shared/inference-types';

export interface InferenceVisualizerProps {
  session: InferenceSession | null;
  onNodeClick?: (node: InferenceNode) => void;
  onEdgeClick?: (edge: InferenceEdge) => void;
  className?: string;
  backgroundColor?: string;
  autoRotate?: boolean;
  showLabels?: boolean;
  showGrid?: boolean;
}

export function InferenceVisualizer({
  session,
  onNodeClick,
  onEdgeClick,
  className,
  backgroundColor = '#0a0e27',
  autoRotate = false,
  showLabels = true,
  showGrid = true,
}: InferenceVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const edgesRef = useRef<Map<string, THREE.Line>>(new Map());
  const labelsRef = useRef<Map<string, THREE.Sprite>>(new Map());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 20, 50);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.5;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // Grid
    if (showGrid) {
      const gridHelper = new THREE.GridHelper(100, 20, 0x3a3a3a, 0x1e1e1e);
      gridHelper.position.y = -10;
      scene.add(gridHelper);
    }

    // Animation loop
    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
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

    // Click handler
    const handleClick = (event: MouseEvent) => {
      if (!rendererRef.current || !cameraRef.current) return;
      
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      // Check node intersections
      const nodeMeshes = Array.from(nodesRef.current.values());
      const nodeIntersects = raycasterRef.current.intersectObjects(nodeMeshes);
      
      if (nodeIntersects.length > 0 && onNodeClick) {
        const mesh = nodeIntersects[0].object as THREE.Mesh;
        const nodeId = mesh.userData.nodeId;
        const node = session?.nodes.find(n => n.id === nodeId);
        if (node) onNodeClick(node);
      }
    };
    renderer.domElement.addEventListener('click', handleClick);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.clear();
    };
  }, [backgroundColor, autoRotate, showGrid, onNodeClick, session]);

  // Update nodes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !session) return;

    // Remove old nodes
    nodesRef.current.forEach((mesh, id) => {
      if (!session.nodes.find(n => n.id === id)) {
        scene.remove(mesh);
        nodesRef.current.delete(id);
      }
    });

    // Add/update nodes
    session.nodes.forEach(node => {
      let mesh = nodesRef.current.get(node.id);
      
      if (!mesh) {
        // Create new node mesh
        const geometry = new THREE.SphereGeometry(2, 32, 32);
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(node.color),
          emissive: new THREE.Color(node.color).multiplyScalar(0.3),
          shininess: 100,
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.userData.nodeId = node.id;
        nodesRef.current.set(node.id, mesh);
        scene.add(mesh);
      }

      // Update position
      mesh.position.set(node.position.x, node.position.y, node.position.z);

      // Update color based on status
      const material = mesh.material as THREE.MeshPhongMaterial;
      if (node.status === 'processing') {
        material.emissive.setHex(0xffff00);
      } else if (node.status === 'error') {
        material.emissive.setHex(0xff0000);
      } else {
        material.emissive.set(node.color).multiplyScalar(0.3);
      }
    });
  }, [session?.nodes]);

  // Update edges
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !session) return;

    // Remove old edges
    edgesRef.current.forEach((line, id) => {
      if (!session.edges.find(e => e.id === id)) {
        scene.remove(line);
        edgesRef.current.delete(id);
      }
    });

    // Add/update edges
    session.edges.forEach(edge => {
      const sourceNode = session.nodes.find(n => n.id === edge.sourceNodeId);
      const targetNode = session.nodes.find(n => n.id === edge.targetNodeId);
      if (!sourceNode || !targetNode) return;

      let line = edgesRef.current.get(edge.id);
      
      if (!line) {
        // Create new edge line
        const points = [
          new THREE.Vector3(sourceNode.position.x, sourceNode.position.y, sourceNode.position.z),
          new THREE.Vector3(targetNode.position.x, targetNode.position.y, targetNode.position.z),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Color based on quality (epsilon)
        const color = getQualityColor(edge.quality.epsilon);
        const material = new THREE.LineBasicMaterial({
          color: new THREE.Color(color),
          linewidth: 2,
        });
        
        line = new THREE.Line(geometry, material);
        line.userData.edgeId = edge.id;
        edgesRef.current.set(edge.id, line);
        scene.add(line);
      } else {
        // Update existing edge
        const positions = line.geometry.attributes.position;
        positions.setXYZ(0, sourceNode.position.x, sourceNode.position.y, sourceNode.position.z);
        positions.setXYZ(1, targetNode.position.x, targetNode.position.y, targetNode.position.z);
        positions.needsUpdate = true;
        
        // Update color
        const color = getQualityColor(edge.quality.epsilon);
        (line.material as THREE.LineBasicMaterial).color.set(color);
      }
    });
  }, [session?.edges, session?.nodes]);

  // Update labels
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !session || !showLabels) return;

    // Remove old labels
    labelsRef.current.forEach((sprite, id) => {
      if (!session.nodes.find(n => n.id === id)) {
        scene.remove(sprite);
        labelsRef.current.delete(id);
      }
    });

    // Add/update labels
    session.nodes.forEach(node => {
      let sprite = labelsRef.current.get(node.id);
      
      if (!sprite) {
        sprite = createTextSprite(node.modelName, node.color);
        labelsRef.current.set(node.id, sprite);
        scene.add(sprite);
      }

      // Position label above node
      sprite.position.set(
        node.position.x,
        node.position.y + 4,
        node.position.z
      );
    });
  }, [session?.nodes, showLabels]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className || ''}`}
      style={{ minHeight: '400px' }}
    />
  );
}

// Helper function to create text sprite
function createTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = 256;
  canvas.height = 64;

  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  context.font = 'Bold 24px Arial';
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(10, 2.5, 1);

  return sprite;
}

export default InferenceVisualizer;
