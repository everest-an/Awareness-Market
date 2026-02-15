/**
 * Unicorn Studio Scene Component (Paid Version)
 *
 * Interactive 3D/Animation scene for website hero section.
 * Uses official Unicorn Studio SDK (paid plan - no watermark).
 * Scene JSON: /unicorn-scene.json (glyph texture changed to "01" pattern)
 */

import { useEffect, useRef } from 'react';

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
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initScene = () => {
      if (!window.UnicornStudio?.init) return;
      window.UnicornStudio.init().catch((err) => {
        console.warn('Unicorn Studio init error:', err);
      });
    };

    // Load official Unicorn Studio SDK (paid plan - no watermark)
    if (window.UnicornStudio?.init) {
      initScene();
    } else {
      const script = document.createElement('script');
      script.src =
        'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js';
      script.type = 'text/javascript';
      script.onload = initScene;
      (document.head || document.body).appendChild(script);
    }

    return () => {
      try { window.UnicornStudio?.destroy(); } catch { /* ignore */ }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="unicorn-hero-scene"
      className={`unicorn-scene ${className}`}
      data-us-project-src="/unicorn-scene.json"
      data-us-scale="1"
      data-us-dpi="1.5"
      style={{
        width,
        height,
      }}
    />
  );
};

export default UnicornScene;
