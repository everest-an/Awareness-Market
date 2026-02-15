/**
 * FlipWord Component
 *
 * Smooth vertical flip animation using CSS @keyframes.
 * Avoids React state-driven transitions to prevent re-render stutter.
 * The animation runs entirely in CSS — no JS state changes during flip.
 */

import { useMemo } from 'react';

interface FlipWordProps {
  words: string[];
  /** CSS class applied to each word span (e.g. 'gradient-text') */
  className?: string;
  /** Duration each word is displayed (ms) */
  interval?: number;
  /** Flip transition duration (ms) */
  duration?: number;
}

export const FlipWord: React.FC<FlipWordProps> = ({
  words,
  className = '',
  interval = 2500,
  duration = 600,
}) => {
  const totalCycle = words.length * interval;
  const flipPct = (duration / totalCycle) * 100;
  const holdPct = (interval / totalCycle) * 100;

  // Each word is 1/N of the total column height
  // translateY(-100%) moves by the full column height
  // To move by one word, we need translateY(-(1/N * 100)%)
  const stepPct = 100 / words.length; // e.g. 20% for 5 words

  // Build CSS keyframes: each word holds, then flips up
  const keyframes = useMemo(() => {
    const frames: string[] = [];
    words.forEach((_, i) => {
      const timeStart = i * holdPct;
      const flipStart = timeStart + holdPct - flipPct;
      const flipEnd = timeStart + holdPct;
      const yOffset = i * stepPct;

      // Hold position
      if (i === 0) {
        frames.push(`0% { transform: translateY(-${yOffset}%); }`);
      }
      frames.push(`${flipStart.toFixed(2)}% { transform: translateY(-${yOffset}%); }`);
      // Flip to next
      if (i < words.length - 1) {
        frames.push(`${flipEnd.toFixed(2)}% { transform: translateY(-${yOffset + stepPct}%); }`);
      }
    });
    // Last word holds, then flips back to first
    const lastFlipStart = 100 - flipPct;
    const lastYOffset = (words.length - 1) * stepPct;
    frames.push(`${lastFlipStart.toFixed(2)}% { transform: translateY(-${lastYOffset}%); }`);
    frames.push(`100% { transform: translateY(0%); }`);

    return frames.join('\n    ');
  }, [words, holdPct, flipPct, stepPct]);

  const animationName = `flipword-${words.length}`;
  const styleTag = `
    @keyframes ${animationName} {
      ${keyframes}
    }
  `;

  return (
    <>
      <style>{styleTag}</style>
      <span
        className="inline-block relative overflow-hidden"
        style={{ height: '1.25em', verticalAlign: 'text-bottom' }}
      >
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            animation: `${animationName} ${totalCycle}ms cubic-bezier(0.4, 0, 0.2, 1) infinite`,
          }}
        >
          {words.map((word, i) => (
            <span
              key={i}
              className={`inline-block ${className}`}
              style={{ whiteSpace: 'nowrap', height: '1.25em', lineHeight: '1.25em' }}
            >
              {word}
            </span>
          ))}
        </span>
      </span>
    </>
  );
};

export default FlipWord;
