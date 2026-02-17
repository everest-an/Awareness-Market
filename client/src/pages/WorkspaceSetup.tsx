import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Settings2,
  Network,
  Shield,
  Code,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';

// ── Preset agent templates ──────────────────────────────────────────────────
const AGENT_PRESETS = [
  { name: 'v0', model: 'v0 (Vercel)', role: 'frontend', integration: 'rest' as const, description: 'Web-based UI generation' },
  { name: 'Kiro', model: 'Kiro (AWS)', role: 'architect', integration: 'mcp' as const, description: 'Architecture & planning' },
  { name: 'Claude Code', model: 'Claude (Anthropic)', role: 'backend', integration: 'mcp' as const, description: 'Backend development in VSCode' },
  { name: 'Manus', model: 'Manus', role: 'reviewer', integration: 'mcp' as const, description: 'Code review & deployment' },
  { name: 'Cursor', model: 'Cursor', role: 'fullstack', integration: 'mcp' as const, description: 'AI-assisted coding' },
  { name: 'Windsurf', model: 'Windsurf', role: 'fullstack', integration: 'mcp' as const, description: 'Codeium AI IDE' },
  { name: 'Custom', model: 'Custom', role: 'custom', integration: 'rest' as const, description: 'Custom agent or script' },
] as const;

const AVAILABLE_PERMISSIONS = [
  { id: 'read' as const, label: 'Read', description: 'See other agents\' context' },
  { id: 'write' as const, label: 'Write', description: 'Share its own context' },
  { id: 'propose' as const, label: 'Propose', description: 'Propose shared decisions' },
  { id: 'execute' as const, label: 'Execute', description: 'Trigger deployment actions' },
];

const ROLE_OPTIONS = [
  'frontend', 'backend', 'fullstack', 'architect', 'reviewer', 'deployer', 'tester', 'custom',
];

// ── Types ───────────────────────────────────────────────────────────────────
interface AgentDraft {
  id: string;
  name: string;
  model: string;
  role: string;
  integration: 'mcp' | 'rest';
  permissions: ('read' | 'write' | 'propose' | 'execute')[];
  description?: string;
}

type Step = 'info' | 'agents' | 'permissions' | 'configs';

export default function WorkspaceSetup() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Wizard state
  const [step, setStep] = useState<Step>('info');

  // Step 1: workspace info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: agents
  const [agents, setAgents] = useState<AgentDraft[]>([]);

  // Step 3–4: created workspace
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Mutations
  const createMut = trpc.workspace.create.useMutation();
  const configsQuery = trpc.workspace.getConfigs.useQuery(
    { workspaceId: workspaceId ?? '' },
    { enabled: !!workspaceId },
  );

  // ── Helpers ─────────────────────────────────────────────────────────────
  function addAgentFromPreset(preset: typeof AGENT_PRESETS[number]) {
    const id = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setAgents((prev) => [
      ...prev,
      {
        id,
        name: preset.name,
        model: preset.model,
        role: preset.role,
        integration: preset.integration,
        permissions: ['read', 'write'],
        description: preset.description,
      },
    ]);
  }

  function removeAgent(id: string) {
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }

  function updateAgent(id: string, patch: Partial<AgentDraft>) {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function togglePermission(agentId: string, perm: 'read' | 'write' | 'propose' | 'execute') {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id !== agentId) return a;
        const has = a.permissions.includes(perm);
        return {
          ...a,
          permissions: has
            ? a.permissions.filter((p) => p !== perm)
            : [...a.permissions, perm],
        };
      }),
    );
  }

  async function handleCreate() {
    try {
      const result = await createMut.mutateAsync({
        name,
        description: description || undefined,
        agents: agents.map((a) => ({
          name: a.name,
          role: a.role,
          model: a.model,
          integration: a.integration,
          permissions: a.permissions,
          description: a.description,
        })),
      });
      setWorkspaceId(result.workspaceId);
      setStep('configs');
      toast({ title: 'Workspace created', description: `${name} is ready` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${label} copied to clipboard` });
  }

  // ── Steps ───────────────────────────────────────────────────────────────
  const steps: { key: Step; label: string; icon: any }[] = [
    { key: 'info', label: 'Workspace', icon: Settings2 },
    { key: 'agents', label: 'Agents', icon: Network },
    { key: 'permissions', label: 'Permissions', icon: Shield },
    { key: 'configs', label: 'Configs', icon: Code },
  ];

  const currentIndex = steps.findIndex((s) => s.key === step);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-28 pb-16 max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-2">Create Workspace</h1>
        <p className="text-slate-400 mb-8">
          Connect your AI tools — MCP for IDEs, REST API for web-based tools
        </p>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-10">
          {steps.map((s, i) => {
            const isActive = i === currentIndex;
            const isDone = i < currentIndex || (step === 'configs' && i < steps.length);
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : isDone
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {isDone && !isActive ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <s.icon className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-8 h-px ${i < currentIndex ? 'bg-green-500/50' : 'bg-white/10'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ─── Step 1: Workspace Info ───────────────────────────────────── */}
        {step === 'info' && (
          <Card className="bg-[#0a0a0f] border-white/10">
            <CardHeader>
              <CardTitle className="text-xl text-white">Workspace Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-300">Workspace Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My SaaS Project"
                  className="mt-1.5 bg-white/5 border-white/10"
                />
              </div>
              <div>
                <Label className="text-slate-300">Description (optional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Building a full-stack SaaS app with v0 + Claude + Manus"
                  className="mt-1.5 bg-white/5 border-white/10"
                />
              </div>
              <div className="flex justify-end pt-4">
                <Button
                  disabled={!name.trim()}
                  onClick={() => setStep('agents')}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  Next: Add Agents
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 2: Add Agents ──────────────────────────────────────── */}
        {step === 'agents' && (
          <div className="space-y-6">
            {/* Quick-add presets */}
            <Card className="bg-[#0a0a0f] border-white/10">
              <CardHeader>
                <CardTitle className="text-lg text-white">Quick Add</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {AGENT_PRESETS.map((p) => (
                    <Button
                      key={p.name}
                      variant="outline"
                      size="sm"
                      onClick={() => addAgentFromPreset(p)}
                      className="bg-white/5 border-white/10 hover:bg-white/10"
                    >
                      <Plus className="w-3 h-3 mr-1.5" />
                      {p.name}
                      <Badge variant="outline" className="ml-2 text-[10px] border-white/20">
                        {p.integration.toUpperCase()}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Agent list */}
            {agents.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                Click a preset above to add agents, or add a custom one
              </div>
            )}

            {agents.map((agent) => (
              <Card key={agent.id} className="bg-[#0a0a0f] border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Badge className={agent.integration === 'mcp' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}>
                        {agent.integration.toUpperCase()}
                      </Badge>
                      <span className="text-white font-medium">{agent.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAgent(agent.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-slate-400 text-xs">Name</Label>
                      <Input
                        value={agent.name}
                        onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                        className="mt-1 bg-white/5 border-white/10"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-xs">Role</Label>
                      <Select
                        value={agent.role}
                        onValueChange={(v) => updateAgent(agent.id, { role: v })}
                      >
                        <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-400 text-xs">Integration</Label>
                      <Select
                        value={agent.integration}
                        onValueChange={(v: 'mcp' | 'rest') => updateAgent(agent.id, { integration: v })}
                      >
                        <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcp">MCP (IDE)</SelectItem>
                          <SelectItem value="rest">REST API (Web)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep('info')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                disabled={agents.length === 0}
                onClick={() => setStep('permissions')}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                Next: Set Permissions
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Permissions ─────────────────────────────────────── */}
        {step === 'permissions' && (
          <div className="space-y-6">
            <Card className="bg-[#0a0a0f] border-white/10">
              <CardHeader>
                <CardTitle className="text-lg text-white">Agent Permissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-2 pr-4 text-sm text-slate-400 font-medium">Agent</th>
                        <th className="text-left py-2 pr-4 text-sm text-slate-400 font-medium">Role</th>
                        {AVAILABLE_PERMISSIONS.map((p) => (
                          <th key={p.id} className="text-center py-2 px-3 text-sm text-slate-400 font-medium">
                            <div>{p.label}</div>
                            <div className="text-[10px] text-slate-500 font-normal">{p.description}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((agent) => (
                        <tr key={agent.id} className="border-b border-white/5">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm">{agent.name}</span>
                              <Badge variant="outline" className="text-[10px] border-white/20">
                                {agent.integration.toUpperCase()}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-sm text-slate-400">{agent.role}</td>
                          {AVAILABLE_PERMISSIONS.map((perm) => (
                            <td key={perm.id} className="py-3 px-3 text-center">
                              <Checkbox
                                checked={agent.permissions.includes(perm.id)}
                                onCheckedChange={() => togglePermission(agent.id, perm.id)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep('agents')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMut.isPending}
                className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
              >
                {createMut.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Workspace
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 4: Generated Configs ───────────────────────────────── */}
        {step === 'configs' && (
          <div className="space-y-6">
            <div className="glass-card p-6 text-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-white mb-1">Workspace Ready!</h2>
              <p className="text-slate-400">
                Copy each agent's config into its respective tool settings.
              </p>
            </div>

            {configsQuery.isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              </div>
            )}

            {configsQuery.data?.configs.map((cfg) => (
              <Card key={cfg.agentId} className="bg-[#0a0a0f] border-white/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      {cfg.agentName}
                      <Badge className={cfg.integration === 'mcp' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}>
                        {cfg.integration.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-normal text-slate-400">({cfg.role})</span>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {cfg.integration === 'mcp' ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400">
                        Add to your MCP settings (e.g. <code className="bg-white/10 px-1.5 py-0.5 rounded">claude_desktop_config.json</code>,
                        Kiro settings, or Manus config):
                      </p>
                      <div className="relative">
                        <pre className="bg-black/50 border border-white/10 rounded-lg p-4 text-xs text-green-300 overflow-x-auto whitespace-pre">
                          {JSON.stringify(cfg.config, null, 2)}
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(JSON.stringify(cfg.config, null, 2), `${cfg.agentName} MCP config`)}
                          className="absolute top-2 right-2 text-slate-400 hover:text-white"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-400">
                        Use these REST API calls from v0 or any HTTP-capable tool:
                      </p>

                      {/* Share example */}
                      <div>
                        <Label className="text-xs text-slate-500">Share your work:</Label>
                        <div className="relative mt-1">
                          <pre className="bg-black/50 border border-white/10 rounded-lg p-4 text-xs text-cyan-300 overflow-x-auto whitespace-pre">
                            {(cfg.config as any).curlShare}
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard((cfg.config as any).curlShare, 'curl share')}
                            className="absolute top-2 right-2 text-slate-400 hover:text-white"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Get context example */}
                      <div>
                        <Label className="text-xs text-slate-500">See what others are doing:</Label>
                        <div className="relative mt-1">
                          <pre className="bg-black/50 border border-white/10 rounded-lg p-4 text-xs text-cyan-300 overflow-x-auto whitespace-pre">
                            {(cfg.config as any).curlContext}
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard((cfg.config as any).curlContext, 'curl context')}
                            className="absolute top-2 right-2 text-slate-400 hover:text-white"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Go to workspace list */}
            <div className="flex justify-center pt-4 gap-4">
              <Button
                variant="outline"
                onClick={() => navigate('/workspace')}
                className="bg-white/5 border-white/10"
              >
                View All Workspaces
              </Button>
              <Button
                onClick={() => {
                  setStep('info');
                  setName('');
                  setDescription('');
                  setAgents([]);
                  setWorkspaceId(null);
                }}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Another
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
