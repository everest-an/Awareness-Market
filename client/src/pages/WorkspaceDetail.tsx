import { useState } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Copy,
  Trash2,
  ArrowLeft,
  Loader2,
  Shield,
  Code,
  Users,
  AlertCircle,
  Pause,
  Play,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';

const AVAILABLE_PERMISSIONS = [
  { id: 'read' as const, label: 'Read', description: 'See other agents\' context' },
  { id: 'write' as const, label: 'Write', description: 'Share its own context' },
  { id: 'propose' as const, label: 'Propose', description: 'Propose shared decisions' },
  { id: 'execute' as const, label: 'Execute', description: 'Trigger deployment actions' },
];

type Perm = 'read' | 'write' | 'propose' | 'execute';

export default function WorkspaceDetail() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute('/workspace/:id');
  const workspaceId = params?.id ?? '';

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [showConfigs, setShowConfigs] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  // Queries
  const wsQuery = trpc.workspace.get.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  );

  const configsQuery = trpc.workspace.getConfigs.useQuery(
    { workspaceId },
    { enabled: showConfigs && !!workspaceId },
  );

  const auditQuery = trpc.workspace.getAuditLog.useQuery(
    { workspaceId, limit: 50 },
    { enabled: showAudit && !!workspaceId },
  );

  // Mutations
  const deleteMut = trpc.workspace.delete.useMutation();
  const statusMut = trpc.workspace.updateStatus.useMutation();
  const permMut = trpc.workspace.updatePermissions.useMutation();
  const removeAgentMut = trpc.workspace.removeAgent.useMutation();
  const rotateMut = trpc.workspace.rotateToken.useMutation();

  const ws = wsQuery.data;

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${label} copied to clipboard` });
  }

  async function handleDelete() {
    try {
      await deleteMut.mutateAsync({ workspaceId });
      toast({ title: 'Workspace deleted' });
      navigate('/workspace');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function handleRotateToken() {
    try {
      const result = await rotateMut.mutateAsync({ workspaceId });
      setRotateDialogOpen(false);
      wsQuery.refetch();
      if (showConfigs) configsQuery.refetch();
      toast({
        title: 'Token rotated',
        description: result.message,
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function handleStatusChange(status: 'active' | 'paused' | 'completed') {
    try {
      await statusMut.mutateAsync({ workspaceId, status });
      wsQuery.refetch();
      toast({ title: `Status changed to ${status}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function handleTogglePermission(agentId: string, currentPerms: string[], perm: Perm) {
    const has = currentPerms.includes(perm);
    const newPerms = has
      ? currentPerms.filter((p) => p !== perm) as Perm[]
      : [...currentPerms, perm] as Perm[];

    try {
      await permMut.mutateAsync({ workspaceId, agentId, permissions: newPerms });
      wsQuery.refetch();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  async function handleRemoveAgent(agentId: string, agentName: string) {
    try {
      await removeAgentMut.mutateAsync({ workspaceId, agentId });
      wsQuery.refetch();
      toast({ title: `${agentName} removed` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  // ── Loading / Error ─────────────────────────────────────────────────────
  if (wsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center pt-40">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      </div>
    );
  }

  if (wsQuery.error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-28 pb-16 max-w-4xl">
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {wsQuery.error.message || 'Failed to load workspace'}
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button variant="ghost" onClick={() => navigate('/workspace')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Workspaces
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!ws) return null;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-28 pb-16 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <Link href="/workspace">
              <Button variant="ghost" size="sm" className="mb-2 -ml-3 text-slate-400">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Workspaces
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-white">{ws.name}</h1>
            {ws.description && (
              <p className="text-slate-400 mt-1">{ws.description}</p>
            )}
            <div className="flex items-center gap-3 mt-3">
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
              <span className="text-xs text-slate-500">
                Created {new Date(ws.createdAt).toLocaleDateString()}
              </span>
              <span className="text-xs text-slate-500">
                Token: <code className="bg-white/5 px-1 rounded">{ws.mcpTokenMask}</code>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status controls */}
            {ws.status === 'active' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('paused')}
                disabled={statusMut.isPending}
                className="bg-white/5 border-white/10"
              >
                <Pause className="w-3.5 h-3.5 mr-1.5" />
                Pause
              </Button>
            )}
            {ws.status === 'paused' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('active')}
                disabled={statusMut.isPending}
                className="bg-white/5 border-white/10"
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Resume
              </Button>
            )}
            {ws.status !== 'completed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('completed')}
                disabled={statusMut.isPending}
                className="bg-white/5 border-white/10"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Complete
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRotateDialogOpen(true)}
              className="bg-white/5 border-white/10"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Rotate Token
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* ── Agents & Permissions ──────────────────────────────────────── */}
        <Card className="bg-[#0a0a0f] border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              Agents & Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 text-sm text-slate-400 font-medium">Agent</th>
                    <th className="text-left py-2 pr-4 text-sm text-slate-400 font-medium">Role</th>
                    <th className="text-left py-2 pr-4 text-sm text-slate-400 font-medium">Type</th>
                    {AVAILABLE_PERMISSIONS.map((p) => (
                      <th key={p.id} className="text-center py-2 px-3 text-sm text-slate-400 font-medium">
                        {p.label}
                      </th>
                    ))}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {ws.agents.map((agent: any) => (
                    <tr key={agent.id} className="border-b border-white/5">
                      <td className="py-3 pr-4 text-white text-sm">{agent.name}</td>
                      <td className="py-3 pr-4 text-sm text-slate-400">{agent.role}</td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant="outline"
                          className={agent.integration === 'mcp' ? 'text-purple-400 border-purple-500/30' : 'text-blue-400 border-blue-500/30'}
                        >
                          {agent.integration.toUpperCase()}
                        </Badge>
                      </td>
                      {AVAILABLE_PERMISSIONS.map((perm) => (
                        <td key={perm.id} className="py-3 px-3 text-center">
                          <Checkbox
                            checked={agent.permissions?.includes(perm.id)}
                            onCheckedChange={() =>
                              handleTogglePermission(agent.id, agent.permissions || [], perm.id)
                            }
                            disabled={permMut.isPending}
                          />
                        </td>
                      ))}
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAgent(agent.id, agent.name)}
                          disabled={removeAgentMut.isPending}
                          className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 h-7 w-7"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Config Panels ────────────────────────────────────────────── */}
        <Card className="bg-[#0a0a0f] border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Code className="w-5 h-5 text-cyan-400" />
                Agent Configs
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowConfigs(true);
                  if (configsQuery.data) configsQuery.refetch();
                }}
                className="bg-white/5 border-white/10"
              >
                {configsQuery.isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                {showConfigs ? 'Refresh' : 'Show Configs'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!showConfigs && (
              <p className="text-sm text-slate-500">
                Click "Show Configs" to generate connection configs for each agent.
              </p>
            )}

            {configsQuery.isLoading && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              </div>
            )}

            {configsQuery.error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{configsQuery.error.message}</AlertDescription>
              </Alert>
            )}

            {configsQuery.data && (
              <div className="space-y-4">
                {configsQuery.data.configs.map((cfg: any) => (
                  <div key={cfg.agentId} className="border border-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-white font-medium text-sm">{cfg.agentName}</span>
                      <Badge className={cfg.integration === 'mcp' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}>
                        {cfg.integration.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-slate-500">({cfg.role})</span>
                    </div>

                    {cfg.integration === 'mcp' ? (
                      <div className="relative">
                        <pre className="bg-black/50 border border-white/10 rounded-lg p-3 text-xs text-green-300 overflow-x-auto whitespace-pre max-h-64">
                          {JSON.stringify(cfg.config, null, 2)}
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(JSON.stringify(cfg.config, null, 2), `${cfg.agentName} config`)}
                          className="absolute top-2 right-2 text-slate-400 hover:text-white"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <pre className="bg-black/50 border border-white/10 rounded-lg p-3 text-xs text-cyan-300 overflow-x-auto whitespace-pre">
                            {cfg.config.curlShare}
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(cfg.config.curlShare, 'curl share')}
                            className="absolute top-2 right-2 text-slate-400 hover:text-white"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="relative">
                          <pre className="bg-black/50 border border-white/10 rounded-lg p-3 text-xs text-cyan-300 overflow-x-auto whitespace-pre">
                            {cfg.config.curlContext}
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(cfg.config.curlContext, 'curl context')}
                            className="absolute top-2 right-2 text-slate-400 hover:text-white"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Audit Log ──────────────────────────────────────────────── */}
        <Card className="bg-[#0a0a0f] border-white/10 mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-400" />
                Audit Log
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAudit(true);
                  if (auditQuery.data) auditQuery.refetch();
                }}
                className="bg-white/5 border-white/10"
              >
                {auditQuery.isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                {showAudit ? 'Refresh' : 'Show Log'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!showAudit && (
              <p className="text-sm text-slate-500">
                Click "Show Log" to view workspace activity history.
              </p>
            )}

            {auditQuery.data && auditQuery.data.entries.length === 0 && (
              <p className="text-sm text-slate-500">No audit entries yet.</p>
            )}

            {auditQuery.data && auditQuery.data.entries.length > 0 && (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {[...auditQuery.data.entries].reverse().map((entry: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                    <span className="text-[10px] text-slate-600 font-mono w-32 shrink-0">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <Badge variant="outline" className="text-[10px] border-white/15 shrink-0">
                      {entry.action}
                    </Badge>
                    <span className="text-xs text-slate-400 truncate">
                      {entry.details ? JSON.stringify(entry.details) : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Rotate Token Dialog ──────────────────────────────────────── */}
        <Dialog open={rotateDialogOpen} onOpenChange={setRotateDialogOpen}>
          <DialogContent className="bg-card border-white/10">
            <DialogHeader>
              <DialogTitle>Rotate MCP Token</DialogTitle>
              <DialogDescription>
                This will invalidate the current token and generate a new one.
                All agents must update their configs with the new token.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRotateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRotateToken}
                disabled={rotateMut.isPending}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {rotateMut.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Rotate Token
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Dialog ────────────────────────────────────────────── */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="bg-card border-white/10">
            <DialogHeader>
              <DialogTitle>Delete Workspace</DialogTitle>
              <DialogDescription>
                This will permanently delete "{ws.name}", deactivate its MCP token,
                and remove all collaboration history. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete Workspace
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
