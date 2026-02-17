import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Key, Trash2, CheckCircle2, XCircle, Loader2, Plus,
  Zap, AlertCircle, ExternalLink, Eye, EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";

const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4, text-embedding-3, DALL-E",
    docsUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-proj-...",
    color: "bg-green-500",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude 4.5 Sonnet, Claude 3.5, Claude Haiku",
    docsUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
    color: "bg-orange-500",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini 2.5 Flash, Gemini 2.0, Deep Research",
    docsUrl: "https://aistudio.google.com/app/apikey",
    placeholder: "AIza...",
    color: "bg-blue-500",
  },
  {
    id: "forge",
    name: "Forge / Manus",
    description: "Internal Forge API proxy or Manus platform",
    docsUrl: "",
    placeholder: "forge-...",
    color: "bg-purple-500",
  },
  {
    id: "custom",
    name: "Custom / Local",
    description: "Ollama, LM Studio, OpenAI-compatible endpoint",
    docsUrl: "",
    placeholder: "any-key",
    color: "bg-slate-500",
  },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

interface FormState {
  provider: ProviderId;
  apiKey: string;
  label: string;
  baseUrl: string;
  showKey: boolean;
}

export default function ProviderKeysPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    provider: "openai",
    apiKey: "",
    label: "",
    baseUrl: "",
    showKey: false,
  });
  const [testingId, setTestingId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.providerKeys.list.useQuery();

  const upsertMutation = trpc.providerKeys.upsert.useMutation({
    onSuccess: (res) => {
      toast({
        title: "Key saved",
        description: res.message,
      });
      utils.providerKeys.list.invalidate();
      setIsDialogOpen(false);
      setForm({ provider: "openai", apiKey: "", label: "", baseUrl: "", showKey: false });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = trpc.providerKeys.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Key removed" });
      utils.providerKeys.list.invalidate();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = trpc.providerKeys.test.useMutation({
    onSuccess: (res, vars) => {
      if (res.ok) {
        toast({
          title: "Connection OK",
          description: `${vars.provider} key is valid (${res.latencyMs}ms)`,
        });
      } else {
        toast({
          title: "Connection failed",
          description: res.error,
          variant: "destructive",
        });
      }
      setTestingId(null);
    },
    onError: (err) => {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
      setTestingId(null);
    },
  });

  const handleSave = () => {
    if (!form.apiKey.trim()) {
      toast({ title: "API key is required", variant: "destructive" });
      return;
    }
    upsertMutation.mutate({
      provider: form.provider,
      apiKey: form.apiKey.trim(),
      label: form.label.trim() || undefined,
      baseUrl: form.baseUrl.trim() || undefined,
    });
  };

  const selectedProviderInfo = PROVIDERS.find((p) => p.id === form.provider)!;
  const savedKeys = data?.keys ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Key className="w-6 h-6" />
              AI Provider Keys
            </h1>
            <p className="text-muted-foreground mt-1">
              Bring your own API keys (BYOK) — stored encrypted on our servers, never exposed in plaintext.
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Key
          </Button>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Your API keys are encrypted with AES-256-GCM before storage. We show only a masked version
            after saving. Keys are used only when you make requests — never shared with third parties.
          </AlertDescription>
        </Alert>

        {/* Provider cards */}
        <div className="space-y-4">
          {PROVIDERS.map((provider) => {
            const savedKey = savedKeys.find((k) => k.provider === provider.id);
            return (
              <Card key={provider.id} className={savedKey ? "border-primary/40" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${provider.color}`} />
                      <div>
                        <CardTitle className="text-base">{provider.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {provider.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {savedKey ? (
                        <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Configured
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground gap-1">
                          <XCircle className="w-3 h-3" />
                          Not set
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {savedKey && (
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between bg-muted rounded-md px-3 py-2">
                      <div className="text-sm">
                        <span className="font-mono text-muted-foreground">{savedKey.keyMask}</span>
                        {savedKey.label && (
                          <span className="ml-3 text-xs text-muted-foreground">({savedKey.label})</span>
                        )}
                        {savedKey.baseUrl && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            URL: {savedKey.baseUrl}
                          </div>
                        )}
                        {savedKey.lastUsedAt && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Last used: {new Date(savedKey.lastUsedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={testingId === savedKey.id}
                          onClick={() => {
                            setTestingId(savedKey.id);
                            testMutation.mutate({ provider: provider.id as ProviderId });
                          }}
                        >
                          {testingId === savedKey.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Zap className="w-3 h-3" />
                          )}
                          <span className="ml-1 hidden sm:inline">Test</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setForm({
                              provider: provider.id as ProviderId,
                              apiKey: "",
                              label: savedKey.label ?? "",
                              baseUrl: savedKey.baseUrl ?? "",
                              showKey: false,
                            });
                            setIsDialogOpen(true);
                          }}
                        >
                          Update
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate({ id: savedKey.id })}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Add / Update Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add Provider API Key</DialogTitle>
            <DialogDescription>
              Your key is encrypted before being saved. It will never be shown again after saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Provider selector */}
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => setForm({ ...form, provider: v as ProviderId, apiKey: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${p.color}`} />
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API key input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>API Key</Label>
                {selectedProviderInfo.docsUrl && (
                  <a
                    href={selectedProviderInfo.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    Get a key <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="relative">
                <Input
                  type={form.showKey ? "text" : "password"}
                  placeholder={selectedProviderInfo.placeholder}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  onClick={() => setForm({ ...form, showKey: !form.showKey })}
                >
                  {form.showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* Label (optional) */}
            <div className="space-y-1.5">
              <Label>Label <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="e.g. Work Account"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>

            {/* Base URL override (for custom / forge / local) */}
            {(form.provider === "custom" || form.provider === "forge") && (
              <div className="space-y-1.5">
                <Label>Base URL</Label>
                <Input
                  placeholder="https://your-proxy.example.com or http://localhost:11434"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Must expose an OpenAI-compatible <code>/v1/</code> API.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
