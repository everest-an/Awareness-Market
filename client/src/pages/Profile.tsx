import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { User, Mail, Shield, Key, Bell, CreditCard } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

export default function Profile() {
  const { user, loading, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [notifications, setNotifications] = useState({
    transactions: true,
    recommendations: true,
    market: true,
    email: false,
  });

  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success("Profile updated successfully");
      await refresh();
    },
    onError: (error: any) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });

  const apiKeysQuery = trpc.apiKeys.list.useQuery();

  const generateApiKeyMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      apiKeysQuery.refetch();
      toast.success("API key generated");
      window.prompt("Copy your new API key (shown once):", data.apiKey);
    },
    onError: (error: any) => {
      toast.error(`Failed to generate API key: ${error.message}`);
    },
  });

  const revokeApiKeyMutation = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      apiKeysQuery.refetch();
      toast.success("API key revoked");
    },
    onError: (error: any) => {
      toast.error(`Failed to revoke API key: ${error.message}`);
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading) return;
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    const stored = window.localStorage.getItem("profile.notificationPrefs");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setNotifications((prev) => ({ ...prev, ...parsed }));
      } catch {
        // ignore invalid stored data
      }
    }
  }, [loading, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("profile.notificationPrefs", JSON.stringify(notifications));
  }, [notifications]);

  const handleUpdateProfile = () => {
    updateProfileMutation.mutate({ name, email });
  };

  const handleGenerateApiKey = () => {
    const keyName = prompt("Enter a name for this API key:");
    if (keyName) {
      generateApiKeyMutation.mutate({ name: keyName });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Profile Settings</h1>
          <Button variant="outline" onClick={() => setLocation("/")}>
            Back to Home
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{user.name || "User"}</h2>
                <p className="text-muted-foreground">{user.email}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                  <Badge variant="outline">{user.loginMethod}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">
              <User className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="api">
              <Key className="h-4 w-4 mr-2" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Information</CardTitle>
                <CardDescription>Update your profile information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                  />
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button
                    onClick={handleUpdateProfile}
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Login Method</Label>
                  <div className="flex items-center gap-2">
                    <Badge>{user.loginMethod}</Badge>
                    <span className="text-sm text-muted-foreground">
                      You're signed in via {user.loginMethod}
                    </span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Account Created</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Last Sign In</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(user.lastSignedIn).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Manage your API keys for programmatic access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Use API keys to authenticate your applications
                  </p>
                  <Button onClick={handleGenerateApiKey}>Generate New Key</Button>
                </div>
                <Separator />
                {apiKeysQuery.isLoading ? (
                  <div className="text-center py-4">Loading API keys...</div>
                ) : apiKeysQuery.data && apiKeysQuery.data.length > 0 ? (
                  <div className="space-y-2">
                    {apiKeysQuery.data.map((key: any) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{key.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {key.keyPrefix} • Created {new Date(key.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={key.isActive ? "default" : "secondary"}>
                            {key.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!key.isActive || revokeApiKeyMutation.isPending}
                            onClick={() => revokeApiKeyMutation.mutate({ keyId: key.id })}
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No API keys yet. Generate one to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose how you want to be notified
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Transaction Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Get notified when transactions complete
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label="Transaction notifications"
                      checked={notifications.transactions}
                      onChange={(e) =>
                        setNotifications((prev) => ({
                          ...prev,
                          transactions: e.target.checked,
                        }))
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Recommendation Updates</p>
                      <p className="text-sm text-muted-foreground">
                        Receive personalized recommendations
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label="Recommendation updates"
                      checked={notifications.recommendations}
                      onChange={(e) =>
                        setNotifications((prev) => ({
                          ...prev,
                          recommendations: e.target.checked,
                        }))
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Market Changes</p>
                      <p className="text-sm text-muted-foreground">
                        Stay updated on market trends
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label="Market change notifications"
                      checked={notifications.market}
                      onChange={(e) =>
                        setNotifications((prev) => ({
                          ...prev,
                          market: e.target.checked,
                        }))
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive updates via email
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label="Email notifications"
                      checked={notifications.email}
                      onChange={(e) =>
                        setNotifications((prev) => ({
                          ...prev,
                          email: e.target.checked,
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
