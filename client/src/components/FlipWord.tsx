/**
 * FlipWord Component
 *
 * Vertical page-flip text animation. Current word slides up and out,
 * next word slides up from below. Uses requestAnimationFrame for
 * smooth transition triggering.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface FlipWordProps {
  words: string[];
  /** Duration each word is displayed (ms) */
  interval?: number;
  /** Animation duration (ms) */
  duration?: number;
}

export const FlipWord: React.FC<FlipWordProps> = ({
  words,
  interval = 2500,
  duration = 600,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'ready' | 'animating'>('idle');
  const nextIndexRef = useRef(0);

  const startFlip = useCallback(() => {
    nextIndexRef.current = (currentIndex + 1) % words.length;
    // First frame: position incoming word below (no transition)
    setPhase('ready');
  }, [currentIndex, words.length]);

  useEffect(() => {
    if (phase === 'ready') {
      // Next frame: trigger the slide-up animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase('animating'));
      });
    }
    if (phase === 'animating') {
      const timer = setTimeout(() => {
        setCurrentIndex(nextIndexRef.current);
        setPhase('idle');
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [phase, duration]);

  useEffect(() => {
    const timer = setInterval(startFlip, interval);
    return () => clearInterval(timer);
  }, [startFlip, interval]);

  const isMoving = phase === 'animating';
  const nextIndex = nextIndexRef.current;

  return (
    <span
      className="inline-block relative overflow-hidden"
      style={{ height: '1.2em', lineHeight: '1.2em', verticalAlign: 'bottom' }}
    >
      {/* Current word */}
      <span
        className="inline-block"
        style={{
          transform: isMoving ? 'translateY(-100%)' : 'translateY(0)',
          transition: isMoving ? `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none',
        }}
      >
        {words[currentIndex]}
      </span>

      {/* Incoming word (positioned below, slides up) */}
      {phase !== 'idle' && (
        <span
          className="absolute left-0 inline-block"
          style={{
            top: '100%',
            transform: isMoving ? 'translateY(-100%)' : 'translateY(0)',
            transition: isMoving ? `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none',
          }}
        >
          {words[nextIndex]}
        </span>
      )}
    </span>
  );
};

export default FlipWord;
