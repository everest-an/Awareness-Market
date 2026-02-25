import { useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import Navbar from '@/components/Navbar';
import { Brain, Users, Code, Server, ArrowRight, Loader2, Info, ChevronDown, Settings, ShieldCheck, MessageSquare, ExternalLink } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { AIChatBox, type Message } from '@/components/AIChatBox';

export default function NewCollaborationSession() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/workspace/:id/session/new');
  const workspaceId = params?.id ?? '';
  const [isCreating, setIsCreating] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'frontend-backend',
    privacy: 'shared',
  });
  const [agentEndpoints, setAgentEndpoints] = useState<Record<string, string>>({});
  const [agentAuthTokens, setAgentAuthTokens] = useState<Record<string, string>>({});
  // agentAuthority: per-agent decision weight
  const [agentAuthority, setAgentAuthority] = useState<
    Record<string, { weight: number; scope: string[] }>
  >({
    'manus-frontend': { weight: 1.0, scope: [] },
    'claude-backend': { weight: 1.0, scope: [] },
  });
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);

  // tRPC mutation for AI config chat
  const suggestConfig = trpc.agentConfigChat.suggestConfig.useMutation({
    onSuccess: (data) => {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant' as const, content: data.assistantMessage },
      ]);

      // If the AI returned a suggestion, apply it to the form
      if (data.suggestion) {
        if (data.suggestion.sessionName) {
          setFormData((prev) => ({ ...prev, name: data.suggestion.sessionName }));
        }
        if (data.suggestion.description) {
          setFormData((prev) => ({ ...prev, description: data.suggestion.description }));
        }
        if (data.suggestion.type) {
          setFormData((prev) => ({ ...prev, type: data.suggestion.type }));
        }
        if (data.suggestion.agents && Array.isArray(data.suggestion.agents)) {
          const newAuthority: Record<string, { weight: number; scope: string[] }> = {};
          for (const a of data.suggestion.agents) {
            newAuthority[a.id] = { weight: a.weight ?? 1.0, scope: [] };
          }
          setAgentAuthority(newAuthority);
        }
      }
    },
    onError: (err) => {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant' as const, content: `Error: ${err.message}` },
      ]);
    },
  });

  const handleChatSend = (content: string) => {
    const newMessages: Message[] = [...chatMessages, { role: 'user', content }];
    setChatMessages(newMessages);
    suggestConfig.mutate({
      messages: newMessages.filter((m) => m.role !== 'system'),
    });
  };

  // tRPC mutation for creating collaboration
  const createCollaboration = trpc.agentCollaboration.collaborate.useMutation({
    onSuccess: (data: any) => {
      toast.success('Collaboration session created successfully!');
      // Pass endpoint data via sessionStorage so SessionConnect can display it
      if (data.endpoints) {
        try {
          sessionStorage.setItem(
            `endpoints_${data.workflowId}`,
            JSON.stringify(data.endpoints),
          );
        } catch { /* non-critical */ }
      }
      setLocation(`/workspace/${workspaceId}/session/${data.workflowId}`);
    },
    onError: (error) => {
      toast.error(`Failed to create session: ${error.message}`);
      console.error('[NewSession] Collaboration creation failed:', error);
    },
  });

  const collaborationTypes = [
    {
      value: 'frontend-backend',
      label: 'Frontend + Backend',
      description: 'One AI handles UI, another builds the API',
      icon: Users,
      recommended: true,
    },
    {
      value: 'dual-frontend',
      label: 'Two Frontend Agents',
      description: 'Collaborative UI development',
      icon: Code,
    },
    {
      value: 'dual-backend',
      label: 'Two Backend Agents',
      description: 'API design and implementation together',
      icon: Server,
    },
    {
      value: 'custom',
      label: 'Custom Roles',
      description: 'Define your own collaboration pattern',
      icon: Brain,
    },
  ];

  const privacyOptions = [
    {
      value: 'private',
      label: 'Private',
      description: 'Only you can view this session',
    },
    {
      value: 'shared',
      label: 'Shared Link',
      description: 'Anyone with the link can view (recommended)',
    },
    {
      value: 'public',
      label: 'Public',
      description: 'Listed in community gallery',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error('Please enter a session name');
      return;
    }

    setIsCreating(true);

    try {
      // Map collaboration type to agent configuration
      const agentConfig = getAgentConfigForType(formData.type);

      // Prepare API payload
      const payload = {
        task: formData.name,
        description: formData.description || `${formData.type} collaboration session`,
        workspaceId: workspaceId || undefined,
        agents: agentConfig.agents,
        orchestration: agentConfig.orchestration as 'sequential' | 'parallel',
        memorySharing: formData.privacy === 'shared',
        memoryTTL: formData.privacy === 'private' ? 3600 : 86400,
        maxExecutionTime: 1800,
        recordOnChain: true,
        inputData: {
          agentEndpoints: Object.keys(agentEndpoints).length > 0 ? agentEndpoints : undefined,
          agentAuthTokens: Object.keys(agentAuthTokens).length > 0 ? agentAuthTokens : undefined,
        },
        agentAuthority: Object.keys(agentAuthority).length > 0 ? agentAuthority : undefined,
        webhookUrl: webhookUrl || undefined,
      };

      // Call real API
      await createCollaboration.mutateAsync(payload);
    } catch (error: any) {
      // Error already handled by mutation onError
      console.error('[NewSession] Failed to create collaboration:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Helper function to map collaboration type to agent configuration
  function getAgentConfigForType(type: string) {
    switch (type) {
      case 'frontend-backend':
        return {
          agents: ['manus-frontend', 'claude-backend'],
          orchestration: 'sequential',
        };
      case 'dual-frontend':
        return {
          agents: ['manus-frontend-1', 'manus-frontend-2'],
          orchestration: 'parallel',
        };
      case 'dual-backend':
        return {
          agents: ['claude-backend-1', 'claude-backend-2'],
          orchestration: 'sequential',
        };
      case 'full-stack':
        return {
          agents: ['manus-frontend', 'claude-backend', 'visualizer-ui'],
          orchestration: 'sequential',
        };
      default:
        return {
          agents: ['manus-agent', 'claude-agent'],
          orchestration: 'sequential',
        };
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="pt-20 container mx-auto px-4 py-16 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Brain className="h-12 w-12 text-purple-400" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Create Collaboration Session
            </h1>
          </div>
          <p className="text-xl text-slate-300">
            Set up a shared cognitive space for AI teamwork
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card className="p-8 bg-slate-900/50 border-slate-800 space-y-8">
            {/* Session Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white text-lg">
                Session Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., User Dashboard Development"
                className="bg-slate-800 border-slate-700 text-white text-lg"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-white text-lg">
                Project Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Building a user dashboard with real-time charts and settings management..."
                className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
              />
            </div>

            {/* AI Configuration Assistant (Chat Box) */}
            <Collapsible open={isChatOpen} onOpenChange={setIsChatOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full flex items-center justify-between text-white hover:bg-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                    <span className="font-medium">AI Configuration Assistant</span>
                    <span className="text-xs text-slate-400">(Describe your project)</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isChatOpen ? 'rotate-180' : ''}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <AIChatBox
                  messages={chatMessages}
                  onSendMessage={handleChatSend}
                  isLoading={suggestConfig.isPending}
                  placeholder="Describe what you want to build..."
                  height="320px"
                  emptyStateMessage="Describe your project and I'll suggest the best agent configuration"
                  suggestedPrompts={[
                    "Build a dashboard with real-time charts",
                    "Create a REST API with authentication",
                    "Design a landing page with animations",
                  ]}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Collaboration Type */}
            <div className="space-y-4">
              <Label className="text-white text-lg">Collaboration Type</Label>
              <RadioGroup
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <div className="grid md:grid-cols-2 gap-4">
                  {collaborationTypes.map((type) => (
                    <label
                      key={type.value}
                      className={`relative flex cursor-pointer ${
                        formData.type === type.value
                          ? 'ring-2 ring-purple-500'
                          : 'hover:border-slate-600'
                      } rounded-lg border-2 border-slate-700 p-4 transition-all`}
                    >
                      <RadioGroupItem value={type.value} className="sr-only" />
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="bg-purple-500/10 p-2 rounded-lg">
                            <type.icon className="h-5 w-5 text-purple-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">
                                {type.label}
                              </span>
                              {type.recommended && (
                                <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">
                                  Recommended
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                              {type.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Privacy */}
            <div className="space-y-4">
              <Label className="text-white text-lg">Privacy Settings</Label>
              <RadioGroup
                value={formData.privacy}
                onValueChange={(value) => setFormData({ ...formData, privacy: value })}
              >
                <div className="space-y-3">
                  {privacyOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`relative flex cursor-pointer ${
                        formData.privacy === option.value
                          ? 'ring-2 ring-purple-500'
                          : 'hover:border-slate-600'
                      } rounded-lg border border-slate-700 p-4 transition-all`}
                    >
                      <RadioGroupItem value={option.value} className="mt-1" />
                      <div className="ml-4 flex-1">
                        <span className="font-medium text-white">{option.label}</span>
                        <p className="text-sm text-slate-400 mt-1">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Advanced Configuration */}
            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full flex items-center justify-between text-white hover:bg-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <span className="font-medium">Advanced Configuration</span>
                    <span className="text-xs text-slate-400">(Optional)</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      isAdvancedOpen ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="glass-subtle p-4 rounded-lg space-y-4">
                  <div className="flex items-start gap-2 text-sm text-slate-400">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>
                      Configure custom API endpoints for your agents. Leave blank to use
                      default fallback simulation.
                    </p>
                  </div>

                  {/* Manus Frontend Endpoint */}
                  <div className="space-y-2">
                    <Label htmlFor="manus-endpoint" className="text-white">
                      Manus Frontend Endpoint
                    </Label>
                    <Input
                      id="manus-endpoint"
                      value={agentEndpoints['manus-frontend'] || ''}
                      onChange={(e) =>
                        setAgentEndpoints({
                          ...agentEndpoints,
                          'manus-frontend': e.target.value,
                        })
                      }
                      placeholder="https://manus-api.example.com/execute"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  {/* Manus Auth Token */}
                  <div className="space-y-2">
                    <Label htmlFor="manus-token" className="text-white">
                      Manus Auth Token
                    </Label>
                    <Input
                      id="manus-token"
                      type="password"
                      value={agentAuthTokens['manus-frontend'] || ''}
                      onChange={(e) =>
                        setAgentAuthTokens({
                          ...agentAuthTokens,
                          'manus-frontend': e.target.value,
                        })
                      }
                      placeholder="Bearer token or API key"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  {/* Claude Backend Endpoint */}
                  <div className="space-y-2">
                    <Label htmlFor="claude-endpoint" className="text-white">
                      Claude Backend Endpoint
                    </Label>
                    <Input
                      id="claude-endpoint"
                      value={agentEndpoints['claude-backend'] || ''}
                      onChange={(e) =>
                        setAgentEndpoints({
                          ...agentEndpoints,
                          'claude-backend': e.target.value,
                        })
                      }
                      placeholder="https://claude-api.example.com/execute"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                  {/* Claude Auth Token */}
                  <div className="space-y-2">
                    <Label htmlFor="claude-token" className="text-white">
                      Claude Auth Token
                    </Label>
                    <Input
                      id="claude-token"
                      type="password"
                      value={agentAuthTokens['claude-backend'] || ''}
                      onChange={(e) =>
                        setAgentAuthTokens({
                          ...agentAuthTokens,
                          'claude-backend': e.target.value,
                        })
                      }
                      placeholder="Bearer token or API key"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>

                {/* ── Decision Authority ─────────────────────────────── */}
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    <span className="text-white font-medium">Decision Authority</span>
                    <span className="text-xs text-slate-400">(optional)</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Set the relative influence of each agent. The highest-weight agent's output
                    becomes the primary result in parallel workflows.
                  </p>

                  {Object.keys(agentAuthority).map((agentId) => {
                    const auth = agentAuthority[agentId];
                    return (
                      <div key={agentId} className="bg-slate-800/60 rounded-lg p-4 mb-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{agentId}</span>
                          <span className="text-xs text-purple-300 font-mono">
                            weight: {auth.weight.toFixed(2)}
                          </span>
                        </div>

                        {/* Weight slider */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Advisory (0.1)</span>
                            <span>Equal (1.0)</span>
                          </div>
                          <Slider
                            min={0.1}
                            max={1.0}
                            step={0.05}
                            value={[auth.weight]}
                            onValueChange={([val]) =>
                              setAgentAuthority({
                                ...agentAuthority,
                                [agentId]: { ...auth, weight: val },
                              })
                            }
                            className="w-full"
                          />
                        </div>

                      </div>
                    );
                  })}

                  {/* Preset examples */}
                  <div className="mt-2">
                    <p className="text-xs text-slate-500 mb-2">Quick presets:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Equal', weights: [1.0, 1.0] },
                        { label: 'Primary + Reviewer', weights: [1.0, 0.5] },
                        { label: 'Lead + Advisory', weights: [1.0, 0.2] },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            const keys = Object.keys(agentAuthority);
                            const updated = { ...agentAuthority };
                            keys.forEach((k, i) => {
                              updated[k] = {
                                ...agentAuthority[k],
                                weight: preset.weights[i] ?? preset.weights[preset.weights.length - 1],
                              };
                            });
                            setAgentAuthority(updated);
                          }}
                          className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Webhook Configuration ────────────────────────────── */}
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <div className="flex items-center gap-2 mb-3">
                    <ExternalLink className="w-4 h-4 text-purple-400" />
                    <span className="text-white font-medium">Webhook Notifications</span>
                    <span className="text-xs text-slate-400">(optional)</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Receive HTTP POST notifications when Propose, Execute, or completion events occur.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url" className="text-white">
                      Webhook URL
                    </Label>
                    <Input
                      id="webhook-url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://your-server.com/api/webhook"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Submit */}
            <div className="flex justify-end gap-4 pt-6 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation(workspaceId ? `/workspace/${workspaceId}` : '/workspace')}
                className="border-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
                className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Session
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        </form>

        {/* Info Card */}
        <Card className="mt-6 p-6 bg-slate-900/30 border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            What happens next?
          </h3>
          <ul className="text-sm text-slate-400 space-y-2 list-disc list-inside">
            <li>You'll get a unique session ID and shareable link</li>
            <li>Connect your AI agents (Manus, Claude) via QR code or config</li>
            <li>Watch real-time collaboration on the live dashboard</li>
            <li>Export transcripts and code when complete</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
