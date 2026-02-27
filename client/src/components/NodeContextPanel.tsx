/**
 * NodeContextPanel — 360-degree node context panel
 *
 * Shows callers, callees, community, processes, imports for a selected node.
 * Replaces the simple detail panel in NeuralCortex.tsx.
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { X, ChevronDown, ChevronRight, Loader2, Crosshair } from 'lucide-react';
import type { CortexNode } from '@/components/NeuralCortexVisualizer';
import type { NodeContext } from '../../../server/code-graph/types';

interface NodeContextPanelProps {
  node: CortexNode;
  owner: string;
  repo: string;
  onClose: () => void;
  onNodeNavigate: (nodeId: string) => void;
  onImpactAnalysis: (symbolIds: string[]) => void;
}

export function NodeContextPanel({
  node,
  owner,
  repo,
  onClose,
  onNodeNavigate,
  onImpactAnalysis,
}: NodeContextPanelProps) {
  const [callersExpanded, setCallersExpanded] = useState(true);
  const [calleesExpanded, setCalleesExpanded] = useState(true);

  const contextQuery = trpc.codeGraph.nodeContext.useQuery(
    { nodeId: node.id, owner, repo },
    { enabled: !!owner && !!repo, retry: false },
  );

  const ctx = contextQuery.data as NodeContext | undefined;

  return (
    <div className="absolute bottom-6 left-6 z-20 w-[320px] max-h-[420px] flex flex-col bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-cyan-500/20 text-cyan-400">
            {node.codeNodeType || node.category}
          </span>
          <span className="text-sm text-white font-medium truncate">{node.title}</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white flex-shrink-0 ml-2">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-3 space-y-3">
        {/* Basic Info */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-white/40">Directory</span>
            <span className="text-white/70 truncate">{node.agentId || '—'}</span>
          </div>
          {node.domain && (
            <div className="flex justify-between gap-2">
              <span className="text-white/40">Language</span>
              <span className="text-white/70">{node.domain}</span>
            </div>
          )}
          {node.filePath && (
            <div className="flex justify-between gap-2">
              <span className="text-white/40">Path</span>
              <span className="text-cyan-400 font-mono text-[10px] truncate">
                {node.filePath}{node.lineStart != null ? `:${node.lineStart}` : ''}
              </span>
            </div>
          )}
        </div>

        {contextQuery.isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          </div>
        )}

        {ctx && (
          <>
            {/* Callers */}
            {ctx.callers.length > 0 && (
              <div>
                <button
                  onClick={() => setCallersExpanded(!callersExpanded)}
                  className="flex items-center gap-1.5 text-[10px] text-white/50 font-medium tracking-wider w-full"
                >
                  {callersExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  CALLED BY ({ctx.callers.length})
                </button>
                {callersExpanded && (
                  <div className="mt-1 space-y-0.5">
                    {ctx.callers.map((c) => (
                      <button
                        key={c.node.id}
                        onClick={() => onNodeNavigate(c.node.id)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-xs text-white/60 flex justify-between"
                      >
                        <span className="truncate">{c.node.label}</span>
                        <span className="text-white/20 text-[10px] ml-2">{c.confidence}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Callees */}
            {ctx.callees.length > 0 && (
              <div>
                <button
                  onClick={() => setCalleesExpanded(!calleesExpanded)}
                  className="flex items-center gap-1.5 text-[10px] text-white/50 font-medium tracking-wider w-full"
                >
                  {calleesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  CALLS ({ctx.callees.length})
                </button>
                {calleesExpanded && (
                  <div className="mt-1 space-y-0.5">
                    {ctx.callees.map((c) => (
                      <button
                        key={c.node.id}
                        onClick={() => onNodeNavigate(c.node.id)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-xs text-white/60 flex justify-between"
                      >
                        <span className="truncate">{c.node.label}</span>
                        <span className="text-white/20 text-[10px] ml-2">{c.confidence}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Community */}
            {ctx.community && (
              <div className="text-xs">
                <div className="text-[10px] text-white/50 font-medium tracking-wider mb-1">COMMUNITY</div>
                <div className="px-2 py-1.5 rounded bg-white/5 text-white/60">
                  <span className="text-cyan-400">{ctx.community.name}</span>
                  <span className="text-white/30 ml-2">cohesion: {ctx.community.cohesion}</span>
                </div>
              </div>
            )}

            {/* Processes */}
            {ctx.processes.length > 0 && (
              <div className="text-xs">
                <div className="text-[10px] text-white/50 font-medium tracking-wider mb-1">
                  IN {ctx.processes.length} FLOW{ctx.processes.length > 1 ? 'S' : ''}
                </div>
                {ctx.processes.slice(0, 3).map((p) => (
                  <div key={p.id} className="px-2 py-1 text-white/40 truncate">
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Impact Button */}
      <div className="px-3 py-2 border-t border-white/5">
        <button
          onClick={() => onImpactAnalysis([node.id])}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-colors"
        >
          <Crosshair className="h-3.5 w-3.5" />
          Impact Analysis
        </button>
      </div>
    </div>
  );
}
