/**
 * GitHubConnectPanel — Top-right overlay for GitHub repo connection
 *
 * States:
 * 1. Not connected → "Connect GitHub" button
 * 2. Connected → username + repo dropdown + disconnect
 * 3. Repo selected → repo name displayed
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Github, ChevronDown, Loader2, Unplug, Sparkles } from 'lucide-react';
import type { RepoSummary, GitHubConnectionStatus } from '../../../server/code-graph/types';

interface GitHubConnectPanelProps {
  onRepoSelect: (owner: string, repo: string, branch?: string) => void;
  onReset: () => void;
  connectionStatus: GitHubConnectionStatus | undefined;
  repos: RepoSummary[];
  selectedRepo: { owner: string; repo: string } | null;
  isLoading: boolean;
}

export function GitHubConnectPanel({
  onRepoSelect,
  onReset,
  connectionStatus,
  repos,
  selectedRepo,
  isLoading,
}: GitHubConnectPanelProps) {
  const [showRepoList, setShowRepoList] = useState(false);
  const utils = trpc.useUtils();

  const getConnectUrl = trpc.codeGraph.getConnectUrl.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const disconnectMutation = trpc.codeGraph.disconnect.useMutation({
    onSuccess: () => {
      utils.codeGraph.status.invalidate();
      onReset();
    },
  });

  const isConnected = connectionStatus?.connected;

  return (
    <div className="absolute top-6 right-6 z-20 flex flex-col items-end gap-2">
      {/* Connection Button / Status */}
      {!isConnected ? (
        <button
          onClick={() => getConnectUrl.mutate()}
          disabled={getConnectUrl.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl text-white/80 hover:text-white transition-all text-sm group"
        >
          <Github className="h-4 w-4 group-hover:text-cyan-400 transition-colors" />
          {getConnectUrl.isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <span>Connect GitHub</span>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRepoList(!showRepoList)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl text-white/80 hover:text-white transition-all text-sm"
          >
            <Github className="h-4 w-4 text-green-400" />
            <span className="max-w-[200px] truncate">
              {selectedRepo
                ? `${selectedRepo.owner}/${selectedRepo.repo}`
                : connectionStatus?.username}
            </span>
            <ChevronDown className={`h-3 w-3 transition-transform ${showRepoList ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="p-2.5 bg-white/5 hover:bg-red-500/20 backdrop-blur-xl border border-white/10 rounded-xl text-white/40 hover:text-red-400 transition-all"
            title="Disconnect GitHub"
          >
            <Unplug className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Repo Dropdown */}
      {showRepoList && isConnected && (
        <div className="max-h-[400px] w-[320px] overflow-y-auto bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl">
          <div className="px-3 py-2 text-xs text-white/40 font-medium tracking-wider">
            SELECT REPOSITORY
          </div>

          {/* Default option */}
          <button
            onClick={() => {
              onReset();
              setShowRepoList(false);
            }}
            className={`w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm transition-colors flex items-center gap-2 ${
              !selectedRepo ? 'text-cyan-400' : 'text-white/60'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Awareness Market (demo)</span>
          </button>

          <div className="my-1 border-t border-white/5" />

          {/* User repos */}
          {repos.map((repo) => (
            <button
              key={repo.id}
              onClick={() => {
                onRepoSelect(repo.owner, repo.name, repo.defaultBranch);
                setShowRepoList(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm transition-colors ${
                selectedRepo?.owner === repo.owner && selectedRepo?.repo === repo.name
                  ? 'text-cyan-400 bg-white/5'
                  : 'text-white/70'
              }`}
            >
              <div className="font-medium truncate">{repo.fullName}</div>
              {repo.description && (
                <div className="text-white/30 text-xs truncate mt-0.5">
                  {repo.description}
                </div>
              )}
              <div className="text-white/20 text-xs mt-0.5 flex items-center gap-2">
                {repo.language && <span>{repo.language}</span>}
                <span>{repo.isPrivate ? 'Private' : 'Public'}</span>
              </div>
            </button>
          ))}

          {repos.length === 0 && !isLoading && (
            <div className="px-3 py-4 text-center text-white/30 text-xs">
              No repositories found
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
