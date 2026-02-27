/**
 * ProcessFlowPanel — Left sidebar showing execution flows + communities
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Zap, Network, X } from 'lucide-react';
import type { Community, ProcessFlow } from '../../../server/code-graph/types';

interface ProcessFlowPanelProps {
  processes: ProcessFlow[];
  communities: Community[];
  onFlowClick: (flow: ProcessFlow) => void;
  onCommunityClick: (community: Community) => void;
  onClose: () => void;
}

export function ProcessFlowPanel({
  processes,
  communities,
  onFlowClick,
  onCommunityClick,
  onClose,
}: ProcessFlowPanelProps) {
  const [flowsExpanded, setFlowsExpanded] = useState(true);
  const [communitiesExpanded, setCommunitiesExpanded] = useState(true);
  const [activeFlow, setActiveFlow] = useState<string | null>(null);
  const [activeCommunity, setActiveCommunity] = useState<string | null>(null);

  return (
    <div className="absolute top-6 left-6 z-20 w-[280px] max-h-[calc(100vh-180px)] flex flex-col bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-sm text-white font-medium">
          <Zap className="h-4 w-4 text-cyan-400" />
          Analysis
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {/* Execution Flows Section */}
        <div className="px-3 pt-3">
          <button
            onClick={() => setFlowsExpanded(!flowsExpanded)}
            className="flex items-center gap-2 w-full text-left text-xs text-white/50 font-medium tracking-wider hover:text-white/70 transition-colors"
          >
            {flowsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            EXECUTION FLOWS ({processes.length})
          </button>

          {flowsExpanded && (
            <div className="mt-2 space-y-0.5">
              {processes.map((flow) => (
                <button
                  key={flow.id}
                  onClick={() => {
                    setActiveFlow(flow.id === activeFlow ? null : flow.id);
                    setActiveCommunity(null);
                    onFlowClick(flow);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                    activeFlow === flow.id
                      ? 'bg-cyan-500/10 text-cyan-400'
                      : 'hover:bg-white/5 text-white/60'
                  }`}
                >
                  <div className="font-medium truncate">{flow.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/30">
                    <span>{flow.stepCount} steps</span>
                    {flow.crossCommunity && (
                      <span className="px-1 py-0.5 bg-purple-500/10 text-purple-400 rounded">
                        cross-module
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {processes.length === 0 && (
                <div className="px-3 py-3 text-center text-white/20 text-[10px]">
                  No execution flows detected
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mx-3 my-3 border-t border-white/5" />

        {/* Communities Section */}
        <div className="px-3 pb-3">
          <button
            onClick={() => setCommunitiesExpanded(!communitiesExpanded)}
            className="flex items-center gap-2 w-full text-left text-xs text-white/50 font-medium tracking-wider hover:text-white/70 transition-colors"
          >
            {communitiesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            COMMUNITIES ({communities.length})
          </button>

          {communitiesExpanded && (
            <div className="mt-2 space-y-0.5">
              {communities.map((community) => (
                <button
                  key={community.id}
                  onClick={() => {
                    setActiveCommunity(community.id === activeCommunity ? null : community.id);
                    setActiveFlow(null);
                    onCommunityClick(community);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                    activeCommunity === community.id
                      ? 'bg-cyan-500/10 text-cyan-400'
                      : 'hover:bg-white/5 text-white/60'
                  }`}
                >
                  <div className="font-medium">{community.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/30">
                    <span>{community.symbolCount} symbols</span>
                    <span>cohesion: {community.cohesion}</span>
                  </div>
                  {community.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {community.keywords.slice(0, 3).map((kw) => (
                        <span key={kw} className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-white/30">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
              {communities.length === 0 && (
                <div className="px-3 py-3 text-center text-white/20 text-[10px]">
                  No communities detected
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
