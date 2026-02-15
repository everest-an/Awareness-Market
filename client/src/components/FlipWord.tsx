/**
 * FlipWord Component
 *
 * Vertical page-flip text animation. Current word slides up and out,
 * next word slides up from below. Accepts optional className to apply
 * styles (like gradient-text) directly to each word span.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface FlipWordProps {
  words: string[];
  /** CSS class applied to each word span (e.g. 'gradient-text') */
  className?: string;
  /** Duration each word is displayed (ms) */
  interval?: number;
  /** Animation duration (ms) */
  duration?: number;
}

export const FlipWord: React.FC<FlipWordProps> = ({
  words,
  className = '',
  interval = 2500,
  duration = 600,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const nextIndex = (currentIndex + 1) % words.length;

  useEffect(() => {
    const timer = setInterval(() => {
      setIsAnimating(true);
    }, interval);
    return () => clearInterval(timer);
  }, [interval]);

  const handleTransitionEnd = useCallback(() => {
    if (isAnimating) {
      setIsAnimating(false);
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }
  }, [isAnimating, words.length]);

  return (
    <span
      className="inline-flex relative overflow-hidden"
      style={{ height: '1.2em', verticalAlign: 'baseline' }}
    >
      {/* Current word - slides up and out */}
      <span
        className={`inline-block ${className}`}
        onTransitionEnd={handleTransitionEnd}
        style={{
          transform: isAnimating ? 'translateY(-100%)' : 'translateY(0)',
          transition: isAnimating
            ? `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`
            : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {words[currentIndex]}
      </span>

      {/* Next word - positioned below, slides up into view */}
      <span
        className={`absolute left-0 top-full inline-block ${className}`}
        style={{
          transform: isAnimating ? 'translateY(-100%)' : 'translateY(0)',
          transition: isAnimating
            ? `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`
            : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {words[nextIndex]}
      </span>
    </span>
  );
};

export default FlipWord;
