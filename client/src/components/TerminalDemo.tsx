import { useState, useEffect } from 'react';

const DEMO_LINES = [
  { text: '$ npx awareness init', type: 'command' as const, delay: 0 },
  { text: '', type: 'output' as const, delay: 400 },
  { text: '✔ Project scanned', type: 'success' as const, delay: 800 },
  { text: '', type: 'output' as const, delay: 900 },
  { text: '  Name:     my-saas-app', type: 'output' as const, delay: 1000 },
  { text: '  Stack:    React + Express + Prisma + PostgreSQL', type: 'output' as const, delay: 1100 },
  { text: '  Files:    245', type: 'output' as const, delay: 1200 },
  { text: '  Database: PostgreSQL', type: 'output' as const, delay: 1300 },
  { text: '  Recent:   3 commits today', type: 'output' as const, delay: 1400 },
  { text: '', type: 'output' as const, delay: 1500 },
  { text: '  AI Tools detected: Claude Code, Cursor', type: 'success' as const, delay: 1700 },
  { text: '', type: 'output' as const, delay: 1800 },
  { text: '✔ Workspace created', type: 'success' as const, delay: 2200 },
  { text: '✔ Project brain stored', type: 'success' as const, delay: 2600 },
  { text: '', type: 'output' as const, delay: 2700 },
  { text: '  awareness knows your project!', type: 'highlight' as const, delay: 3000 },
  { text: '', type: 'output' as const, delay: 3100 },
  { text: '  Workspace: ws_a1b2c3d4', type: 'output' as const, delay: 3200 },
  { text: '  Run `awareness status` to see your project brain.', type: 'dim' as const, delay: 3400 },
];

export function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    DEMO_LINES.forEach((line, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), line.delay));
    });

    // Loop animation
    const loopTimer = setTimeout(() => {
      setVisibleLines(0);
      // Restart after a brief pause
      setTimeout(() => {
        DEMO_LINES.forEach((line, i) => {
          timers.push(setTimeout(() => setVisibleLines(i + 1), line.delay));
        });
      }, 500);
    }, 8000);
    timers.push(loopTimer);

    return () => timers.forEach(clearTimeout);
  }, [visibleLines === 0]);

  const getLineClass = (type: string) => {
    switch (type) {
      case 'command': return 'text-green-400 font-bold';
      case 'success': return 'text-green-400';
      case 'highlight': return 'text-cyan-400 font-bold';
      case 'dim': return 'text-white/40';
      default: return 'text-white/70';
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-white/30 ml-2 font-mono">terminal</span>
      </div>

      {/* Terminal content */}
      <div className="p-4 font-mono text-sm leading-6 min-h-[320px]">
        {DEMO_LINES.slice(0, visibleLines).map((line, i) => (
          <div key={i} className={getLineClass(line.type)}>
            {line.text || '\u00A0'}
          </div>
        ))}
        {visibleLines < DEMO_LINES.length && (
          <span className="inline-block w-2 h-4 bg-green-400 animate-pulse" />
        )}
      </div>
    </div>
  );
}
