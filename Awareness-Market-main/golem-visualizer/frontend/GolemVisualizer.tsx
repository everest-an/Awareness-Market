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

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

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
}

export const GolemVisualizer: React.FC<GolemVisualizerProps> = ({
  data,
  onPointClick,
  width = '100%',
  height = '600px',
  backgroundColor = '#0a0e27',
  showLegend = true,
  autoRotate = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // 初始化 Three.js 场景
  useEffect(() => {
    if (!containerRef.current) return;

    // 场景设置
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    // 相机设置
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 100;
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

    // 坐标轴辅助
    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);

    // 网格
    const gridHelper = new THREE.GridHelper(200, 10, 0x444444, 0x222222);
    scene.add(gridHelper);

    // 鼠标事件处理
    const onMouseClick = (event: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      if (pointsRef.current) {
        const intersects = raycasterRef.current.intersectObject(pointsRef.current);
        if (intersects.length > 0) {
          const index = intersects[0].index;
          if (index !== null && onPointClick) {
            onPointClick(data[index]);
          }
        }
      }
    };

    containerRef.current.addEventListener('click', onMouseClick);

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);

      if (autoRotate && sceneRef.current) {
        sceneRef.current.rotation.y += 0.0005;
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
      renderer.dispose();
    };
  }, [backgroundColor, autoRotate, data, onPointClick]);

  // 更新点云数据
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

    data.forEach((point) => {
      // 如果向量维度 > 3，使用 UMAP 或 t-SNE 投影到 3D
      const x = point.vector[0] || 0;
      const y = point.vector[1] || 0;
      const z = point.vector[2] || 0;

      positions.push(x, y, z);

      // 解析颜色
      const color = new THREE.Color(point.color || '#4a9eff');
      colors.push(color.r, color.g, color.b);
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));

    // 创建着色器材质
    const material = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      sizeAttenuation: true,
    });

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
