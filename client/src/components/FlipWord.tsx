/**
 * FlipWord Component
 *
 * Displays a word that flips vertically (slide up) to cycle through
 * a list of words. Creates a smooth page-flip effect where the current
 * word slides up and out while the next word slides up from below.
 */

import { useState, useEffect, useCallback } from 'react';

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
  duration = 500,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);

  const flip = useCallback(() => {
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
      setIsFlipping(false);
    }, duration);
  }, [words.length, duration]);

  useEffect(() => {
    const timer = setInterval(flip, interval);
    return () => clearInterval(timer);
  }, [flip, interval]);

  return (
    <span
      className="inline-block relative overflow-hidden align-bottom"
      style={{ height: '1.15em', verticalAlign: 'baseline' }}
    >
      <span
        className="inline-block transition-transform"
        style={{
          transform: isFlipping ? 'translateY(-100%)' : 'translateY(0)',
          transitionDuration: `${duration}ms`,
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {words[currentIndex]}
      </span>
      {isFlipping && (
        <span
          className="absolute left-0 top-full inline-block transition-transform"
          style={{
            transform: 'translateY(-100%)',
            transitionDuration: `${duration}ms`,
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {words[(currentIndex + 1) % words.length]}
        </span>
      )}
    </span>
  );
};

export default FlipWord;
