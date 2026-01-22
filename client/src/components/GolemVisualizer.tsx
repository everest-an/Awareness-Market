import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import "./GolemVisualizer.css";

export type GolemPoint = {
  id: string;
  x: number;
  y: number;
  z: number;
  label?: string;
  color?: string;
  meta?: {
    category?: string;
    price?: number;
    calls?: number;
    rating?: number;
  };
};

type GolemVisualizerProps = {
  data: GolemPoint[];
  className?: string;
  backgroundColor?: string;
  autoRotate?: boolean;
  onPointClick?: (point: GolemPoint) => void;
};

export function GolemVisualizer({
  data,
  className,
  backgroundColor = "#0a0e27",
  autoRotate = true,
  onPointClick,
}: GolemVisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<any>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const mouseRef = useRef(new THREE.Vector2());

  const pointData = useMemo(() => data, [data]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 80);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.6;
    controlsRef.current = controls;

    raycasterRef.current = new THREE.Raycaster();

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);

    const grid = new THREE.GridHelper(120, 12, 0x3a3a3a, 0x1e1e1e);
    scene.add(grid);

    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      controls.update();
      renderer.render(sceneRef.current, cameraRef.current);
      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = container.clientWidth / container.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    const handleClick = (event: MouseEvent) => {
      if (!rendererRef.current || !cameraRef.current || !raycasterRef.current || !pointsRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(pointsRef.current);
      if (intersects.length > 0) {
        const index = intersects[0].index ?? -1;
        const point = pointData[index];
        if (point && onPointClick) {
          onPointClick(point);
        }
      }
    };

    renderer.domElement.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", handleClick);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.clear();
    };
  }, [autoRotate, backgroundColor, onPointClick, pointData]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    if (pointsRef.current) {
      scene.remove(pointsRef.current);
      pointsRef.current.geometry.dispose();
      if (Array.isArray(pointsRef.current.material)) {
        pointsRef.current.material.forEach((mat: THREE.Material) => mat.dispose());
      } else {
        pointsRef.current.material.dispose();
      }
    }

    if (!pointData.length) return;

    const positions = new Float32Array(pointData.length * 3);
    const colors = new Float32Array(pointData.length * 3);

    pointData.forEach((point: GolemPoint, index: number) => {
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;

      const color = new THREE.Color(point.color || "#4a9eff");
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
    });

    const points = new THREE.Points(geometry, material);
    pointsRef.current = points;
    scene.add(points);
  }, [pointData]);

  return (
    <div
      ref={containerRef}
      className={["golem-visualizer", className].filter(Boolean).join(" ")}
    />
  );
}
