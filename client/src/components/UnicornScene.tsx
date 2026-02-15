/**
 * Unicorn Studio Scene Component
 *
 * Interactive 3D/Animation scene for website hero section
 * Based on Unicorn Studio project: DHrYV5fcnlpS1Vj341CH
 */

import React, { useEffect, useRef } from 'react';

interface UnicornSceneProps {
  projectId?: string;
  width?: string;
  height?: string;
  className?: string;
}

export const UnicornScene: React.FC<UnicornSceneProps> = ({
  projectId = 'DHrYV5fcnlpS1Vj341CH',
  width = '100%',
  height = '500px',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as any;

    const initAndClean = () => {
      if (w.UnicornStudio && w.UnicornStudio.init) {
        w.UnicornStudio.init();
      }
      // Remove watermark link injected by Unicorn Studio SDK
      removeWatermark();
    };

    const removeWatermark = () => {
      // The SDK injects an <a> tag linking to unicorn.studio
      // We use a MutationObserver to catch it whenever it appears
      const observer = new MutationObserver(() => {
        if (containerRef.current) {
          const watermarks = containerRef.current.querySelectorAll('a[href*="unicorn.studio"]');
          watermarks.forEach((el) => el.remove());
        }
        // Also check document-wide
        const globalWatermarks = document.querySelectorAll('a[href*="unicorn.studio"]');
        globalWatermarks.forEach((el) => el.remove());
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Also do an immediate sweep
      setTimeout(() => {
        const watermarks = document.querySelectorAll('a[href*="unicorn.studio"]');
        watermarks.forEach((el) => el.remove());
      }, 1000);
      setTimeout(() => {
        const watermarks = document.querySelectorAll('a[href*="unicorn.studio"]');
        watermarks.forEach((el) => el.remove());
      }, 3000);

      // Disconnect observer after 10 seconds to avoid memory leaks
      setTimeout(() => observer.disconnect(), 10000);
    };

    if (w.UnicornStudio && w.UnicornStudio.init) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAndClean);
      } else {
        initAndClean();
      }
    } else {
      w.UnicornStudio = { isInitialized: false };

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js';
      script.type = 'text/javascript';

      script.onload = () => {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initAndClean);
        } else {
          initAndClean();
        }
      };

      (document.head || document.body).appendChild(script);
    }

    return () => {
      // Cleanup
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`unicorn-scene ${className}`}
      data-us-project={projectId}
      style={{ width, height }}
    />
  );
};

export default UnicornScene;
