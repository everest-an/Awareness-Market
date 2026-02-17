import { useState, useCallback } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Settings2, Users, Loader2, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function WorkspaceList() {
  const [extraPages, setExtraPages] = useState<Array<{ workspaces: any[]; nextCursor?: string }>>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, isLoading, error, refetch } = trpc.workspace.list.useQuery({ limit: 20 });
  const utils = trpc.useUtils();

  const allWorkspaces = [
    ...(data?.workspaces ?? []),
    ...extraPages.flatMap((p) => p.workspaces),
  ];

  const lastCursor = extraPages.length > 0
    ? extraPages[extraPages.length - 1].nextCursor
    : data?.nextCursor;

  const loadMore = useCallback(async () => {
    if (!lastCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await utils.workspace.list.fetch({ limit: 20, cursor: lastCursor });
      setExtraPages((prev) => [...prev, { workspaces: result.workspaces, nextCursor: result.nextCursor }]);
    } finally {
      setLoadingMore(false);
    }
  }, [lastCursor, loadingMore, utils]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-28 pb-16 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Workspaces</h1>
            <p className="text-slate-400 mt-1">Manage your multi-AI collaboration hubs</p>
          </div>
          <Link href="/workspace/new">
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="w-4 h-4 mr-2" />
              New Workspace
            </Button>
          </Link>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error.message || 'Failed to load workspaces. Please sign in or try again.'}</span>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-4 shrink-0">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && allWorkspaces.length === 0 && (
          <Card className="bg-[#0a0a0f] border-white/10">
            <CardContent className="py-16 text-center">
              <Settings2 className="w-10 h-10 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No workspaces yet</h3>
              <p className="text-slate-400 mb-6">
                Create a workspace to connect your AI tools — Claude, v0, Kiro, Manus, and more.
              </p>
              <Link href="/workspace/new">
                <Button className="bg-gradient-to-r from-purple-500 to-cyan-500">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Workspace
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {allWorkspaces.map((ws: any) => (
            <Link key={ws.id} href={`/workspace/${ws.id}`}>
              <Card className="bg-[#0a0a0f] border-white/10 hover:border-white/20 transition-colors cursor-pointer">
                <CardContent className="py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium text-lg">{ws.name}</h3>
                      {ws.description && (
                        <p className="text-sm text-slate-400 mt-0.5">{ws.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs text-slate-500">{ws.agentCount} agents</span>
                        <span className="text-slate-600">|</span>
                        {ws.agents?.map((a: any) => (
                          <Badge
                            key={a.name}
                            variant="outline"
                            className="text-[10px] border-white/15"
                          >
                            {a.name}
                            <span className="ml-1 text-slate-500">({a.integration})</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge
                      className={
                        ws.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : ws.status === 'paused'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-slate-500/20 text-slate-400'
                      }
                    >
                      {ws.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Load More */}
        {lastCursor && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
              className="bg-white/5 border-white/10"
            >
              {loadingMore ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ChevronDown className="w-4 h-4 mr-2" />
              )}
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
