/**
 * Unicorn Studio Scene Component
 *
 * Interactive 3D/Animation scene for website hero section
 * Based on Unicorn Studio project: DHrYV5fcnlpS1Vj341CH
 */

import React, { useEffect } from 'react';

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
  useEffect(() => {
    // Check if Unicorn Studio is already loaded
    const w = window as any;

    if (w.UnicornStudio && w.UnicornStudio.init) {
      // If already loaded, initialize
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          w.UnicornStudio.init();
        });
      } else {
        w.UnicornStudio.init();
      }
    } else {
      // Load Unicorn Studio script
      w.UnicornStudio = { isInitialized: false };

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js';
      script.type = 'text/javascript';

      script.onload = () => {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            w.UnicornStudio.init();
          });
        } else {
          w.UnicornStudio.init();
        }
      };

      (document.head || document.body).appendChild(script);
    }

    // Cleanup function
    return () => {
      // Optional: Clean up if needed
    };
  }, []);

  return (
    <div
      className={`unicorn-scene ${className}`}
      data-us-project={projectId}
      style={{ width, height }}
    />
  );
};

export default UnicornScene;
