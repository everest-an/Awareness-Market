/**
 * Unicorn Studio Scene Component
 *
 * Interactive 3D/Animation scene for website hero section
 * Uses locally hosted modified project JSON (text changed from UNICORN to 01,
 * watermark layer removed).
 */

import React, { useEffect, useRef } from 'react';

interface UnicornSceneProps {
  width?: string;
  height?: string;
  className?: string;
}

declare global {
  interface Window {
    UnicornStudio?: {
      addScene: (opts: Record<string, unknown>) => Promise<{ destroy: () => void; resize: () => void }>;
      destroy: () => void;
      init: () => Promise<unknown[]>;
      scenes: unknown[];
      unbindEvents: () => void;
    };
  }
}

export const UnicornScene: React.FC<UnicornSceneProps> = ({
  width = '100%',
  height = '100%',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ destroy: () => void } | null>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const loadScene = () => {
      if (!mounted || !containerRef.current || !window.UnicornStudio) return;

      // Use addScene with filePath to load our modified local JSON
      // (watermark layer removed, glyph texture changed to 01)
      window.UnicornStudio.addScene({
        elementId: containerRef.current.id,
        fps: 60,
        scale: 1,
        dpi: 1.5,
        filePath: '/unicorn-scene.json',
        lazyLoad: false,
        interactivity: {
          mouse: {
            disableMobile: false,
            disabled: false,
          },
        },
      })
        .then((scene) => {
          if (mounted) {
            sceneRef.current = scene;
          } else {
            scene.destroy();
          }
        })
        .catch((err) => {
          console.warn('Unicorn Studio scene load error:', err);
        });
    };

    const loadScript = () => {
      if (window.UnicornStudio?.addScene) {
        loadScene();
        return;
      }

      if (scriptLoadedRef.current) return;
      scriptLoadedRef.current = true;

      const script = document.createElement('script');
      script.src =
        'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js';
      script.type = 'text/javascript';
      script.onload = () => {
        loadScene();
      };
      (document.head || document.body).appendChild(script);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadScript);
    } else {
      loadScene();
      // If SDK not loaded yet, load it
      if (!window.UnicornStudio?.addScene) {
        loadScript();
      }
    }

    return () => {
      mounted = false;
      if (sceneRef.current) {
        sceneRef.current.destroy();
        sceneRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="unicorn-hero-scene"
      className={`unicorn-scene ${className}`}
      style={{ width, height }}
    />
  );
};

export default UnicornScene;
