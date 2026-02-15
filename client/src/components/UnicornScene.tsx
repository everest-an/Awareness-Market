/**
 * Unicorn Studio Scene Component
 *
 * Interactive 3D/Animation scene for website hero section.
 * Uses locally hosted modified project JSON:
 *   - Glyph texture changed from "UNICORN" to "01" pattern
 *   - Watermark layer hidden with transparent texture
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
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Remove watermark links injected by Unicorn Studio SDK
    const removeWatermarks = () => {
      document.querySelectorAll('a[href*="unicorn.studio"]').forEach(el => el.remove());
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLAnchorElement && node.href?.includes('unicorn.studio')) {
            node.remove();
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const initScene = () => {
      if (!window.UnicornStudio?.init) return;
      window.UnicornStudio.init()
        .then(() => {
          removeWatermarks();
          setTimeout(removeWatermarks, 500);
          setTimeout(removeWatermarks, 2000);
        })
        .catch((err) => {
          console.warn('Unicorn Studio init error:', err);
        });
    };

    // Load the SDK script
    if (window.UnicornStudio?.init) {
      initScene();
    } else {
      const script = document.createElement('script');
      script.src =
        'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js';
      script.type = 'text/javascript';
      script.onload = () => {
        initScene();
      };
      (document.head || document.body).appendChild(script);
    }

    return () => {
      observer.disconnect();
      try {
        window.UnicornStudio?.destroy();
      } catch {
        // ignore cleanup errors
      }
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
        filter: 'hue-rotate(120deg) saturate(1.3)',
      }}
    />
  );
};

export default UnicornScene;
