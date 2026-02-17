import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Key, Trash2, AlertTriangle, Check, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function ApiKeyManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyData, setNewKeyData] = useState<{ apiKey: string; keyPrefix: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.apiKeys.list.useQuery();
  
  const createMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (result) => {
      setNewKeyData({ apiKey: result.key, keyPrefix: result.keyPrefix });
      toast.success('API key created successfully');
      utils.apiKeys.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to create API key: ${error.message}`);
    },
  });

  const revokeMutation = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      toast.success('API key revoked');
      utils.apiKeys.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to revoke API key: ${error.message}`);
    },
  });

  const deleteMutation = trpc.apiKeys.delete.useMutation({
    onSuccess: () => {
      toast.success('API key deleted');
      utils.apiKeys.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete API key: ${error.message}`);
    },
  });

  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    createMutation.mutate({ name: newKeyName, permissions: ['*'] });
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    toast.success('API key copied to clipboard');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setNewKeyName('');
    setNewKeyData(null);
    setCopiedKey(false);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Keys</h2>
          <p className="text-muted-foreground">
            Manage your API keys for programmatic access
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create New Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key for programmatic access to your account.
              </DialogDescription>
            </DialogHeader>

            {!newKeyData ? (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    placeholder="e.g., Production Server"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    A descriptive name to help you identify this key later.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Save this key now!</strong> For security reasons, you won't be able to see it again.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Your API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newKeyData.apiKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopyKey(newKeyData.apiKey)}
                    >
                      {copiedKey ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Store this key in a secure location (e.g., environment variables, password manager).
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              {!newKeyData ? (
                <>
                  <Button variant="outline" onClick={handleCloseCreateDialog}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateKey}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Key'}
                  </Button>
                </>
              ) : (
                <Button onClick={handleCloseCreateDialog}>
                  Done
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-pulse">Loading API keys...</div>
          </CardContent>
        </Card>
      ) : data?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
            <p className="text-muted-foreground mb-4">
              Create your first API key to start using the API.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data?.map((key) => (
            <Card key={key.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{key.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {key.keyPrefix}•••••••••••••••�?
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {key.isActive ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Revoked</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">{formatDate(key.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Used</p>
                    <p className="font-medium">{formatDate(key.lastUsedAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expires</p>
                    <p className="font-medium">
                      {key.expiresAt ? formatDate(key.expiresAt) : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Permissions</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {key.permissions.map((perm: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {key.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeMutation.mutate({ keyId: key.id })}
                      disabled={revokeMutation.isPending}
                    >
                      Revoke
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
                        deleteMutation.mutate({ keyId: key.id });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Authentication:</strong> Include your API key in the <code className="bg-muted px-1 py-0.5 rounded">X-API-Key</code> header.
          </p>
          <p>
            <strong>Base URL:</strong> <code className="bg-muted px-1 py-0.5 rounded">{window.location.origin}/api</code>
          </p>
          <p>
            <strong>Example:</strong>
          </p>
          <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs">
{`curl ${window.location.origin}/api/vectors \\
  -H "X-API-Key: your_api_key_here"`}
          </pre>
          <p className="pt-2">
            <a href="/api-docs" target="_blank" className="text-primary hover:underline">
              View full API documentation �?
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
