import { useAuth } from '@/hooks/useAuth';
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
import { useState } from "react";
import { User, Mail, Shield, Key, Bell, CreditCard, BookOpen, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import { ApiTutorial } from "@/components/ApiTutorial";
import Navbar from "@/components/Navbar";
import { Button as UIButton } from "@/components/ui/button";

export default function Profile() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  const utils = trpc.useUtils();
  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully");
      utils.user.me.invalidate();
    },
    onError: (error: any) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    setLocation("/");
    return null;
  }

  const handleUpdateProfile = () => {
    updateProfileMutation.mutate({ name });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Header */}
      <div className="pt-20 border-b border-white/5">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Profile <span className="gradient-text">Settings</span></h1>
          <Button variant="outline" className="bg-transparent border-white/20" onClick={() => setLocation("/")}>
            Back to Home
          </Button>
        </div>
      </div>

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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="general">
              <User className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="privacy">
              <Lock className="h-4 w-4 mr-2" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="api">
              <Key className="h-4 w-4 mr-2" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="tutorial">
              <BookOpen className="h-4 w-4 mr-2" />
              API Tutorial
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
                    readOnly
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
                    {user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString() : 'Never'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <CardTitle>Differential Privacy Settings</CardTitle>
                <CardDescription>
                  Manage privacy protection for your vector uploads
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-medium text-blue-500">Advanced Privacy Controls</p>
                      <p className="text-sm text-muted-foreground">
                        Configure differential privacy protection, manage your privacy budget,
                        and test how noise affects your vectors.
                      </p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-center">
                  <UIButton
                    onClick={() => setLocation('/privacy-settings')}
                    className="w-full max-w-md"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Open Privacy Settings
                  </UIButton>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api">
            <ApiKeyManager />
          </TabsContent>

          {/* API Tutorial Tab */}
          <TabsContent value="tutorial">
            <ApiTutorial />
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
                    <label htmlFor="notif-transactions" className="flex-1 cursor-pointer">
                      <p className="font-medium">Transaction Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Get notified when transactions complete
                      </p>
                    </label>
                    <input id="notif-transactions" type="checkbox" defaultChecked className="h-4 w-4" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <label htmlFor="notif-recommendations" className="flex-1 cursor-pointer">
                      <p className="font-medium">Recommendation Updates</p>
                      <p className="text-sm text-muted-foreground">
                        Receive personalized recommendations
                      </p>
                    </label>
                    <input id="notif-recommendations" type="checkbox" defaultChecked className="h-4 w-4" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <label htmlFor="notif-market" className="flex-1 cursor-pointer">
                      <p className="font-medium">Market Changes</p>
                      <p className="text-sm text-muted-foreground">
                        Stay updated on market trends
                      </p>
                    </label>
                    <input id="notif-market" type="checkbox" defaultChecked className="h-4 w-4" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <label htmlFor="notif-email" className="flex-1 cursor-pointer">
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive updates via email
                      </p>
                    </label>
                    <input id="notif-email" type="checkbox" className="h-4 w-4" />
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
