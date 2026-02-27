/**
 * CodeSearchPanel — Top-center search bar with hybrid BM25 + semantic results
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Search, X, Loader2 } from 'lucide-react';
import type { SearchResult } from '../../../server/code-graph/types';

interface CodeSearchPanelProps {
  owner: string;
  repo: string;
  onResultClick: (nodeId: string) => void;
  onHighlight: (nodeIds: Set<string>) => void;
}

const TYPE_BADGES: Record<string, string> = {
  file: 'bg-cyan-500/20 text-cyan-400',
  function: 'bg-green-500/20 text-green-400',
  class: 'bg-orange-500/20 text-orange-400',
  interface: 'bg-purple-500/20 text-purple-400',
  type: 'bg-yellow-500/20 text-yellow-400',
  variable: 'bg-gray-500/20 text-gray-400',
};

export function CodeSearchPanel({ owner, repo, onResultClick, onHighlight }: CodeSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const panelRef = useRef<HTMLDivElement>(null);

  const searchMutation = trpc.codeGraph.search.useMutation({
    onSuccess: (data) => {
      setResults(data as SearchResult[]);
      setShowResults(true);
      onHighlight(new Set((data as SearchResult[]).map(r => r.nodeId)));
    },
  });

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults([]);
      setShowResults(false);
      onHighlight(new Set());
      return;
    }

    debounceRef.current = setTimeout(() => {
      if (owner && repo) {
        searchMutation.mutate({ query: value, owner, repo });
      }
    }, 300);
  }, [owner, repo, searchMutation, onHighlight]);

  const handleResultClick = useCallback((nodeId: string) => {
    onResultClick(nodeId);
    setShowResults(false);
  }, [onResultClick]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    onHighlight(new Set());
  }, [onHighlight]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={panelRef} className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[380px]">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl">
        <Search className="h-4 w-4 text-white/40 flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search code graph..."
          className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/30"
        />
        {searchMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />}
        {query && (
          <button onClick={handleClear} className="text-white/40 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="mt-2 max-h-[350px] overflow-y-auto bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 shadow-2xl">
          {results.map((result) => (
            <button
              key={result.nodeId}
              onClick={() => handleResultClick(result.nodeId)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${TYPE_BADGES[result.type] || TYPE_BADGES.variable}`}>
                  {result.type}
                </span>
                <span className="text-sm text-white font-medium truncate">{result.label}</span>
                <span className="ml-auto text-[10px] text-white/30">{result.score.toFixed(3)}</span>
              </div>
              <div className="text-xs text-white/30 truncate mt-0.5 pl-0.5">{result.filePath}</div>
              <div className="flex gap-1 mt-1">
                {result.sources.map((s) => (
                  <span key={s} className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-white/40">
                    {s}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && query && !searchMutation.isPending && (
        <div className="mt-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center text-white/30 text-xs">
          No results found
        </div>
      )}
    </div>
  );
}
