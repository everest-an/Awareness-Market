import { useState } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Brain,
  Users,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  Settings,
  Plus,
  ArrowRight,
  Zap,
  MessageSquare,
  FileText,
  RefreshCw,
  BarChart3,
} from 'lucide-react';

export default function DevDashboard() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [showResume, setShowResume] = useState(false);
  const [copied, setCopied] = useState(false);

  // List workspaces
  const { data: wsData } = trpc.workspace.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const workspaces = wsData?.workspaces ?? [];

  // Auto-select first workspace
  const activeWsId = selectedWorkspace || workspaces[0]?.id || '';

  // Get workspace status
  const { data: status, isLoading: statusLoading } = trpc.workspace.getStatus.useQuery(
    { workspaceId: activeWsId },
    { enabled: !!activeWsId },
  );

  // Get context timeline
  const { data: contextData } = trpc.workspace.getContext.useQuery(
    { workspaceId: activeWsId, limit: 10, offset: 0 },
    { enabled: !!activeWsId },
  );

  // Generate resume
  const { data: resumeData, refetch: fetchResume } = trpc.workspace.generateResume.useQuery(
    { workspaceId: activeWsId },
    { enabled: false },
  );

  const handleResume = async () => {
    await fetchResume();
    setShowResume(true);
  };

  const copyResume = () => {
    if (resumeData?.markdown) {
      navigator.clipboard.writeText(resumeData.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied', description: 'Session resume copied to clipboard' });
    }
  };

  const getAgentStatusColor = (lastSeen: string | null) => {
    if (!lastSeen) return 'bg-slate-500';
    const diffMin = (Date.now() - new Date(lastSeen).getTime()) / 60000;
    if (diffMin < 5) return 'bg-green-500';
    if (diffMin < 60) return 'bg-yellow-500';
    return 'bg-slate-500';
  };

  const formatTimeAgo = (ts: string | null) => {
    if (!ts) return 'No activity';
    const diffMin = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <Card className="p-8 bg-slate-900/50 border-slate-800 text-center max-w-md">
            <Brain className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Sign in to view your Project Brain</h2>
            <p className="text-slate-400 text-sm mb-4">Manage your AI workspaces, agents, and shared context.</p>
            <Button asChild className="bg-cyan-500 hover:bg-cyan-600">
              <Link href="/auth">Sign In</Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Navbar />

      <div className="max-w-6xl mx-auto pt-24 px-6 pb-12 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Brain className="h-7 w-7 text-cyan-400" />
              Project Brain
            </h1>
            <p className="text-sm text-white/30 mt-1">
              Your AI workspace at a glance — agents, context, decisions
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Workspace selector */}
            {workspaces.length > 0 && (
              <Select value={activeWsId} onValueChange={setSelectedWorkspace}>
                <SelectTrigger className="w-[220px] bg-slate-900 border-slate-700 text-white">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((ws: any) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/workspace/new">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Link>
            </Button>
          </div>
        </div>

        {workspaces.length === 0 ? (
          /* Empty state */
          <Card className="p-12 bg-slate-900/50 border-slate-800 text-center">
            <Users className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">No workspaces yet</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
              Create a workspace to connect your AI tools. They'll share context,
              track decisions, and stop conflicting with each other.
            </p>
            <div className="flex justify-center gap-4">
              <Button asChild className="bg-cyan-500 hover:bg-cyan-600">
                <Link href="/workspace/new">
                  Create Workspace
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700">
                <code className="text-sm font-mono text-green-400">npx awareness init</code>
              </div>
            </div>
          </Card>
        ) : (
          <>
            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Agents panel */}
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-cyan-400" />
                    Agents ({status?.agents?.length ?? 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {statusLoading ? (
                    <div className="text-center py-6 text-slate-400">Loading...</div>
                  ) : status?.agents && status.agents.length > 0 ? (
                    status.agents.map((agent: any) => (
                      <div key={agent.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${getAgentStatusColor(agent.lastSeen)}`} />
                          <div>
                            <div className="text-sm font-medium text-white">{agent.name}</div>
                            <div className="text-xs text-slate-400">{agent.role}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500">{formatTimeAgo(agent.lastSeen)}</div>
                          <Badge className="text-[9px] mt-0.5 bg-slate-700 text-slate-300">
                            {agent.integration}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      No agents configured
                    </div>
                  )}

                  {status?.agents && status.agents.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" /> Active
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" /> Idle
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-slate-500" /> Offline
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Context timeline */}
              <Card className="lg:col-span-2 bg-slate-900/50 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-purple-400" />
                    Context Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {contextData?.entries && contextData.entries.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {contextData.entries.map((entry: any, i: number) => (
                        <div key={i} className="flex gap-3 p-3 bg-slate-800/30 rounded-lg">
                          <div className="shrink-0 mt-0.5">
                            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <Zap className="h-3 w-3 text-purple-400" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-cyan-400">{entry.role || entry.agent}</span>
                              {entry.timestamp && (
                                <span className="text-[10px] text-slate-500">{formatTimeAgo(entry.timestamp)}</span>
                              )}
                            </div>
                            <p className="text-sm text-white/70 break-words">{entry.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No context shared yet</p>
                      <p className="text-xs mt-1">AI tools will appear here when they share context via MCP or REST</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Decisions + Conflicts row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Decisions */}
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-400" />
                    Decisions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {status?.decisions && status.decisions.length > 0 ? (
                    <div className="space-y-2">
                      {status.decisions.map((dec: any, i: number) => (
                        <div key={i} className="p-3 bg-slate-800/30 rounded-lg">
                          <p className="text-sm text-white mb-1">{dec.proposal}</p>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400">by {dec.proposedBy}</span>
                            <Badge className={`text-[10px] ${
                              dec.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                              dec.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {dec.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      No decisions yet
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Conflicts */}
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    Conflicts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {status?.conflicts && status.conflicts.length > 0 ? (
                    <div className="space-y-2">
                      {status.conflicts.map((c: any, i: number) => (
                        <div key={i} className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                          <p className="text-sm text-yellow-300">{c.description || c.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      <Check className="h-6 w-6 text-green-500 mx-auto mb-2" />
                      No conflicts detected
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleResume} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Resume Session
                  </Button>
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link href="/workflow-performance?tab=agents">
                      <BarChart3 className="h-4 w-4" />
                      Control Center
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link href={`/workspace/${activeWsId}`}>
                      <Settings className="h-4 w-4" />
                      Workspace Settings
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link href="/documentation">
                      <FileText className="h-4 w-4" />
                      Docs
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resume modal */}
            {showResume && resumeData?.markdown && (
              <Card className="bg-slate-900/80 border-cyan-500/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-cyan-400" />
                      Session Resume
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button onClick={copyResume} size="sm" variant="ghost" className="gap-1 text-xs">
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                      <Button onClick={() => setShowResume(false)} size="sm" variant="ghost" className="text-xs">
                        Close
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm text-white/70 whitespace-pre-wrap font-mono bg-slate-800/50 p-4 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                    {resumeData.markdown}
                  </pre>
                  <p className="text-xs text-slate-500 mt-3">
                    Copy this and paste it into any AI tool to resume context.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
