import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Save, Link2, X, Copy, Check } from "lucide-react";

export interface AgentDetailData {
  id: string;
  name: string;
  role: string;
  model: string;
  integration: string;
  permissions: string[];
  description?: string | null;
  goal?: string | null;
  backstory?: string | null;
  tools?: string[];
  priority?: number;
  endpoint?: string | null;
  connectionStatus?: string;
  lastSeenAt?: string | null;
  config?: Record<string, unknown> | null;
}

interface AgentDetailPanelProps {
  agent: AgentDetailData;
  workspaceName: string;
  mcpTokenMask: string;
  onSave: (agentId: string, data: Partial<AgentDetailData>) => void;
  onClose: () => void;
  saving?: boolean;
}

const AVAILABLE_TOOLS = [
  "code_edit", "terminal", "search", "browser", "file_read", "file_write",
  "git", "test_run", "deploy", "database", "api_call", "screen_control",
];

const MODEL_OPTIONS = [
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-6",
  "gpt-4o",
  "gpt-4.1",
  "gemini-2.5-pro",
  "llama-4-maverick",
  "deepseek-v3",
  "custom",
];

const statusColors: Record<string, { dot: string; label: string }> = {
  connected: { dot: "bg-green-400", label: "Connected" },
  idle: { dot: "bg-yellow-400", label: "Idle" },
  pending: { dot: "bg-blue-400", label: "Pending" },
  disconnected: { dot: "bg-gray-500", label: "Disconnected" },
};

export function AgentDetailPanel({ agent, workspaceName, mcpTokenMask, onSave, onClose, saving }: AgentDetailPanelProps) {
  const [form, setForm] = useState({
    name: agent.name,
    role: agent.role,
    model: agent.model,
    integration: agent.integration,
    goal: agent.goal || "",
    backstory: agent.backstory || "",
    tools: agent.tools || [],
    priority: agent.priority ?? 5,
    endpoint: agent.endpoint || "",
    description: agent.description || "",
    permissions: agent.permissions || ["read", "write"],
  });

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setForm({
      name: agent.name,
      role: agent.role,
      model: agent.model,
      integration: agent.integration,
      goal: agent.goal || "",
      backstory: agent.backstory || "",
      tools: agent.tools || [],
      priority: agent.priority ?? 5,
      endpoint: agent.endpoint || "",
      description: agent.description || "",
      permissions: agent.permissions || ["read", "write"],
    });
  }, [agent.id]);

  const status = statusColors[agent.connectionStatus || "disconnected"] || statusColors.disconnected;

  const toggleTool = (tool: string) => {
    setForm(f => ({
      ...f,
      tools: f.tools.includes(tool)
        ? f.tools.filter(t => t !== tool)
        : [...f.tools, tool],
    }));
  };

  const togglePermission = (perm: string) => {
    setForm(f => {
      const has = f.permissions.includes(perm);
      const updated = has ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm];
      return { ...f, permissions: updated.length > 0 ? updated : f.permissions };
    });
  };

  const handleSave = () => {
    onSave(agent.id, {
      name: form.name,
      role: form.role,
      model: form.model,
      integration: form.integration,
      goal: form.goal || null,
      backstory: form.backstory || null,
      tools: form.tools,
      priority: form.priority,
      endpoint: form.endpoint || null,
      description: form.description || null,
      permissions: form.permissions,
    });
  };

  const mcpConfig = JSON.stringify({
    mcpServers: {
      [`awareness-collab`]: {
        command: "node",
        args: ["./mcp-server/dist/index-collaboration.js"],
        env: {
          MCP_COLLABORATION_TOKEN: `<your-token>`,
          AGENT_ROLE: form.role,
          PROJECT_NAME: workspaceName,
        },
      },
    },
  }, null, 2);

  const copyConfig = () => {
    navigator.clipboard.writeText(mcpConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-5 space-y-4 overflow-y-auto max-h-[calc(100vh-280px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
          <h3 className="font-semibold text-white">Edit Agent</h3>
          <span className="text-xs text-gray-500">{status.label}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Name + Role */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-400">Name</Label>
          <Input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="bg-gray-800 border-gray-700 mt-1"
            placeholder="Claude Code"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-400">Role</Label>
          <Input
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className="bg-gray-800 border-gray-700 mt-1"
            placeholder="backend"
          />
        </div>
      </div>

      {/* Goal */}
      <div>
        <Label className="text-xs text-gray-400">Goal</Label>
        <Input
          value={form.goal}
          onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
          className="bg-gray-800 border-gray-700 mt-1"
          placeholder="Handle all backend API development..."
        />
      </div>

      {/* Backstory */}
      <div>
        <Label className="text-xs text-gray-400">Backstory / System Prompt</Label>
        <Textarea
          value={form.backstory}
          onChange={e => setForm(f => ({ ...f, backstory: e.target.value }))}
          className="bg-gray-800 border-gray-700 mt-1 min-h-[80px]"
          placeholder="You are an expert Node.js backend architect..."
        />
      </div>

      {/* Model + Integration */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-400">Model</Label>
          <Select value={form.model} onValueChange={v => setForm(f => ({ ...f, model: v }))}>
            <SelectTrigger className="bg-gray-800 border-gray-700 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-gray-400">Integration</Label>
          <Select value={form.integration} onValueChange={v => setForm(f => ({ ...f, integration: v }))}>
            <SelectTrigger className="bg-gray-800 border-gray-700 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mcp">MCP</SelectItem>
              <SelectItem value="rest">REST API</SelectItem>
              <SelectItem value="windows_mcp">Windows MCP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Priority Slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs text-gray-400">Priority</Label>
          <span className="text-xs text-blue-400 font-mono">{form.priority}/10</span>
        </div>
        <Slider
          value={[form.priority]}
          onValueChange={([v]) => setForm(f => ({ ...f, priority: v }))}
          min={1}
          max={10}
          step={1}
          className="mt-1"
        />
      </div>

      {/* Tools */}
      <div>
        <Label className="text-xs text-gray-400 mb-2 block">Tools</Label>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_TOOLS.map(tool => (
            <Badge
              key={tool}
              variant={form.tools.includes(tool) ? "default" : "outline"}
              className="cursor-pointer text-[11px] transition-colors"
              onClick={() => toggleTool(tool)}
            >
              {tool}
            </Badge>
          ))}
        </div>
      </div>

      {/* Permissions */}
      <div>
        <Label className="text-xs text-gray-400 mb-2 block">Permissions</Label>
        <div className="flex gap-2">
          {["read", "write", "propose", "execute"].map(perm => (
            <Badge
              key={perm}
              variant={form.permissions.includes(perm) ? "default" : "outline"}
              className="cursor-pointer text-[11px] transition-colors"
              onClick={() => togglePermission(perm)}
            >
              {perm}
            </Badge>
          ))}
        </div>
      </div>

      {/* Endpoint (optional) */}
      <div>
        <Label className="text-xs text-gray-400">Endpoint (optional)</Label>
        <Input
          value={form.endpoint}
          onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))}
          className="bg-gray-800 border-gray-700 mt-1"
          placeholder="https://..."
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2 border-t border-gray-800">
        <Button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save"}
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="border-gray-600">
              <Link2 className="h-4 w-4 mr-2" />
              Link Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-700 max-w-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Link Agent: {form.name}</h3>
            <p className="text-sm text-gray-400 mb-4">
              {form.integration === "mcp" && "Add this MCP server config to your AI tool:"}
              {form.integration === "rest" && "Use these REST API credentials:"}
              {form.integration === "windows_mcp" && "Set up Windows MCP bridge:"}
            </p>

            {form.integration === "mcp" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">
                    Paste into <code className="text-blue-400">.claude/mcp_config.json</code> or <code className="text-blue-400">.cursor/mcp.json</code>
                  </p>
                  <Button size="sm" variant="ghost" onClick={copyConfig}>
                    {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <pre className="bg-gray-950 p-3 rounded text-xs text-green-300 overflow-auto max-h-48 font-mono">
                  {mcpConfig}
                </pre>
                <p className="text-xs text-gray-500 mt-2">
                  Token: <code className="text-yellow-400">{mcpTokenMask}</code>
                </p>
              </div>
            )}

            {form.integration === "rest" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-gray-400">Base URL</Label>
                  <code className="block bg-gray-950 p-2 rounded text-xs text-green-300 mt-1">
                    {window.location.origin}/api/collab
                  </code>
                </div>
                <div>
                  <Label className="text-xs text-gray-400">Header</Label>
                  <code className="block bg-gray-950 p-2 rounded text-xs text-green-300 mt-1">
                    X-MCP-Token: {mcpTokenMask}
                  </code>
                </div>
              </div>
            )}

            {form.integration === "windows_mcp" && (
              <div className="space-y-3 text-sm text-gray-300">
                <p>1. Install: <code className="text-blue-400">npx windows-mcp-server</code></p>
                <p>2. Configure bridge to point at workspace MCP token</p>
                <p>3. Define screen region for your target tool</p>
                <p>4. Test connection from the Control Center</p>
                <a
                  href="https://windowsmcpserver.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline text-xs"
                >
                  windowsmcpserver.dev
                </a>
              </div>
            )}

            <DialogClose asChild>
              <Button variant="outline" className="mt-4 w-full border-gray-600">Close</Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
