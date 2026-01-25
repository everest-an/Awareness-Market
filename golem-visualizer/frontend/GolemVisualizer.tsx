/**
 * Golem 3D Vector Space Visualizer
 * 
 * React 组件，用于在 Three.js 中可视化高维向量空间
 * 集成到 Awareness Market 项目
 * 
 * 功能：
 * - 实时 3D 场景渲染
 * - 交互式相机控制
 * - 向量点云可视化
 * - 查询脉冲动画
 * - 实时数据流更新
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface VectorData {
  id: string;
  vector: number[];
  label?: string;
  color?: string;
}

interface GolemVisualizerProps {
  data: VectorData[];
  onPointClick?: (point: VectorData) => void;
  width?: string | number;
  height?: string | number;
  backgroundColor?: string;
  showLegend?: boolean;
  autoRotate?: boolean;
  rotateSpeed?: number;
  pointScale?: number;
}

export const GolemVisualizer: React.FC<GolemVisualizerProps> = ({
  data,
  onPointClick,
  width = '100%',
  height = '600px',
  backgroundColor = '#0a0e27',
  showLegend = true,
  autoRotate = true,
  rotateSpeed = 0.5,
  pointScale = 8,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // 初始化 Three.js 场景
  useEffect(() => {
    if (!containerRef.current) return;

    // 场景设置
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    scene.fog = new THREE.FogExp2(backgroundColor, 0.002);
    sceneRef.current = scene;

    // 相机设置
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 20, 120);
    cameraRef.current = camera;

    // 渲染器设置
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.4);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // 轨道控制
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = rotateSpeed;
    controlsRef.current = controls;

    // 鼠标事件处理
    const onMouseClick = (event: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const localWidth = rect.width;
      const localHeight = rect.height;
      mouseRef.current.x = ((event.clientX - rect.left) / localWidth) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / localHeight) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      if (pointsRef.current) {
        const intersects = raycasterRef.current.intersectObject(pointsRef.current);
        if (intersects.length > 0) {
          const index = intersects[0].index;
          if (typeof index === 'number') {
            if (onPointClick) {
              onPointClick(data[index]);
            }
            triggerPulse([index]);
          }
        }
      }
    };

    containerRef.current.addEventListener('click', onMouseClick);

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = performance.now() / 1000;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 窗口大小调整
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeEventListener('click', onMouseClick);
      if (containerRef.current && renderer.domElement.parentElement === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      controlsRef.current?.dispose();
      renderer.dispose();
    };
  }, [backgroundColor, autoRotate, rotateSpeed, data, onPointClick]);

  // 更新点云数据
  const createShaderMaterial = () => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
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
            gl_PointSize = (4.0 * (1.0 + intensity * 5.0)) * (300.0 / -mvPosition.z);
          } else {
            gl_PointSize = 2.5 * (300.0 / -mvPosition.z);
          }

          gl_Position = projectionMatrix * mvPosition;
          vColor = mix(color, vec3(1.0, 1.0, 1.0), intensity);
          vAlpha = 0.4 + (intensity * 0.6);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          if (length(coord) > 0.5) discard;
          float strength = 1.0 - (length(coord) * 2.0);
          gl_FragColor = vec4(vColor, vAlpha * strength);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
  };

  const triggerPulse = (indices: number[]) => {
    if (!geometryRef.current) return;
    const activationTimes = geometryRef.current.getAttribute('activationTime');
    if (!activationTimes) return;
    const currentTime = performance.now() / 1000;
    const array = activationTimes.array as Float32Array;

    indices.forEach((idx, i) => {
      array[idx] = currentTime + i * 0.02;
    });
    activationTimes.needsUpdate = true;
  };

  useEffect(() => {
    if (!sceneRef.current || data.length === 0) return;

    // 移除旧点
    if (pointsRef.current) {
      sceneRef.current.remove(pointsRef.current);
    }

    // 创建几何体
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const activationTimes: number[] = [];

    data.forEach((point) => {
      const x = (point.vector[0] || 0) * pointScale;
      const y = (point.vector[1] || 0) * pointScale;
      const z = (point.vector[2] || 0) * pointScale;

      positions.push(x, y, z);

      const color = new THREE.Color(point.color || '#4a9eff');
      colors.push(color.r, color.g, color.b);
      activationTimes.push(-100.0);
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geometry.setAttribute('activationTime', new THREE.BufferAttribute(new Float32Array(activationTimes), 1));
    const activationAttr = geometry.getAttribute('activationTime') as THREE.BufferAttribute;
    activationAttr.setUsage(THREE.DynamicDrawUsage);

    const material = createShaderMaterial();

    materialRef.current = material;
    geometryRef.current = geometry;

    const points = new THREE.Points(geometry, material);
    pointsRef.current = points;
    sceneRef.current.add(points);
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    />
  );
};

export default GolemVisualizer;
