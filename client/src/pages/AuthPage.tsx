/**
 * AuthPage Component
 * 
 * A standalone authentication page supporting:
 * - Email/Password login and registration
 * - OAuth login (GitHub, Google)
 * - Wallet login (MetaMask / WalletConnect)
 * - AI Agent login (ERC-8004)
 * - Password strength indicator
 * - Rate limiting feedback
 * - Password reset flow
 */

import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { Loader2, Mail, Lock, User, AlertCircle, Github, CheckCircle2, Wallet, Bot, ArrowRight } from "lucide-react";

// Form validation helpers
const validateEmail = (email: string): string | null => {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email format";
  return null;
};

// Form state types
interface LoginFormState {
  email: string;
  password: string;
  errors: { email?: string; password?: string };
}

interface RegisterFormState {
  name: string;
  email: string;
  password: string;
  errors: { name?: string; email?: string; password?: string };
}

// Password strength colors
const strengthColors: Record<string, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
  emerald: "bg-emerald-500",
};

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // Check if already authenticated
  const { data: currentUser, isLoading: isCheckingAuth } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Get OAuth status
  const { data: oauthStatus } = trpc.auth.oauthStatus.useQuery();

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser && !isCheckingAuth) {
      setLocation("/");
    }
  }, [currentUser, isCheckingAuth, setLocation]);

  // Form states
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);

  const [loginForm, setLoginForm] = useState<LoginFormState>({
    email: "",
    password: "",
    errors: {},
  });

  const [registerForm, setRegisterForm] = useState<RegisterFormState>({
    name: "",
    email: "",
    password: "",
    errors: {},
  });

  // Password validation query (debounced)
  const [debouncedPassword, setDebouncedPassword] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPassword(registerForm.password);
    }, 300);
    return () => clearTimeout(timer);
  }, [registerForm.password]);

  const { data: passwordValidation } = trpc.auth.validatePassword.useQuery(
    { password: debouncedPassword, email: registerForm.email || undefined },
    { enabled: debouncedPassword.length > 0 }
  );

  // Login mutation
  const loginMutation = trpc.auth.loginEmail.useMutation({
    onMutate: () => setIsSubmitting(true),
    onSuccess: async (data) => {
      if (data.success) {
        toast({ title: "Welcome back!", description: "Login successful." });
        await new Promise(resolve => setTimeout(resolve, 100));
        await utils.auth.me.invalidate();
        setTimeout(() => setLocation("/"), 200);
      } else {
        toast({ 
          title: "Login failed", 
          description: data.error || "Invalid credentials", 
          variant: "destructive" 
        });
        setLoginForm(prev => ({
          ...prev,
          errors: { password: data.error || "Invalid credentials" }
        }));
      }
    },
    onError: (error) => {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    },
    onSettled: () => setIsSubmitting(false),
  });

  // Register mutation
  const registerMutation = trpc.auth.registerEmail.useMutation({
    onMutate: () => setIsSubmitting(true),
    onSuccess: (data) => {
      if (data.success) {
        if ((data as any).requiresVerification) {
          toast({ 
            title: "Account created!", 
            description: "Please check your email for a verification code." 
          });
          setLocation(`/auth/verify?email=${encodeURIComponent(registerForm.email)}`);
        } else {
          toast({ title: "Account created!", description: "Please sign in." });
          setLoginForm({ email: registerForm.email, password: registerForm.password, errors: {} });
          setActiveTab("login");
          setRegisterForm({ name: "", email: "", password: "", errors: {} });
        }
      } else {
        toast({ title: "Registration failed", description: data.error, variant: "destructive" });
        if (data.error?.toLowerCase().includes("email")) {
          setRegisterForm(prev => ({ ...prev, errors: { email: data.error } }));
        } else if ((data as any).passwordErrors) {
          setRegisterForm(prev => ({ ...prev, errors: { password: (data as any).passwordErrors[0] } }));
        }
      }
    },
    onError: (error) => {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    },
    onSettled: () => setIsSubmitting(false),
  });

  // OAuth mutations
  const { refetch: getGithubUrl } = trpc.auth.oauthAuthorizeUrl.useQuery(
    { provider: "github" },
    { enabled: false }
  );

  const { refetch: getGoogleUrl } = trpc.auth.oauthAuthorizeUrl.useQuery(
    { provider: "google" },
    { enabled: false }
  );

  const handleOAuthLogin = useCallback(async (provider: "github" | "google") => {
    try {
      if (provider === "github") {
        const { data } = await getGithubUrl();
        if (data?.url) window.location.href = data.url;
      } else {
        const { data } = await getGoogleUrl();
        if (data?.url) window.location.href = data.url;
      }
    } catch (error) {
      toast({ title: "OAuth Error", description: "Failed to start OAuth flow", variant: "destructive" });
    }
  }, [getGithubUrl, getGoogleUrl, toast]);

  // Wallet login mutation
  const walletLoginMutation = trpc.auth.walletLogin.useMutation({
    onSuccess: async (data) => {
      if (data.success) {
        toast({ title: "Wallet connected!", description: `Welcome, ${data.user?.name || 'User'}` });
        await utils.auth.me.invalidate();
        setTimeout(() => setLocation("/"), 200);
      } else {
        toast({ title: "Wallet login failed", description: data.error || "Authentication failed", variant: "destructive" });
      }
    },
    onError: (error) => {
      toast({ title: "Wallet login failed", description: error.message, variant: "destructive" });
    },
  });

  // Wallet connect handler
  const handleWalletConnect = useCallback(async () => {
    setIsConnectingWallet(true);
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        toast({ 
          title: "Wallet not found", 
          description: "Please install MetaMask or another Web3 wallet to continue.", 
          variant: "destructive" 
        });
        return;
      }
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        // Sign a message for authentication
        const message = `Sign in to Awareness Market\nAddress: ${address}\nTimestamp: ${Date.now()}`;
        const signature = await ethereum.request({
          method: "personal_sign",
          params: [message, address],
        });
        // Send signature to backend for verification and JWT session creation
        await walletLoginMutation.mutateAsync({ address, signature, message });
      }
    } catch (error: any) {
      if (error.code === 4001) {
        toast({ title: "Connection cancelled", description: "You rejected the wallet connection.", variant: "destructive" });
      } else {
        toast({ title: "Wallet error", description: error.message || "Failed to connect wallet", variant: "destructive" });
      }
    } finally {
      setIsConnectingWallet(false);
    }
  }, [toast, setLocation, walletLoginMutation]);

  // Form handlers
  const handleLoginSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(loginForm.email);
    if (emailError) {
      setLoginForm(prev => ({ ...prev, errors: { email: emailError } }));
      return;
    }
    if (!loginForm.password) {
      setLoginForm(prev => ({ ...prev, errors: { password: "Password is required" } }));
      return;
    }
    setLoginForm(prev => ({ ...prev, errors: {} }));
    loginMutation.mutate({ email: loginForm.email.trim().toLowerCase(), password: loginForm.password });
  }, [loginForm, loginMutation]);

  const handleRegisterSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(registerForm.email);
    if (emailError) {
      setRegisterForm(prev => ({ ...prev, errors: { email: emailError } }));
      return;
    }
    if (!passwordValidation?.valid) {
      setRegisterForm(prev => ({ ...prev, errors: { password: passwordValidation?.errors[0] || "Invalid password" } }));
      return;
    }
    setRegisterForm(prev => ({ ...prev, errors: {} }));
    registerMutation.mutate({
      email: registerForm.email.trim().toLowerCase(),
      password: registerForm.password,
      name: registerForm.name.trim() || undefined,
    });
  }, [registerForm, passwordValidation, registerMutation]);

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Navbar />
      
      <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] py-12">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Welcome to Awareness</CardTitle>
            <CardDescription>Sign in to your account or create a new one</CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value, errors: { ...prev.errors, email: undefined } }))}
                        className={`pl-10 ${loginForm.errors.email ? 'border-destructive' : ''}`}
                        disabled={isSubmitting}
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                    {loginForm.errors.email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />{loginForm.errors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value, errors: { ...prev.errors, password: undefined } }))}
                        className={`pl-10 ${loginForm.errors.password ? 'border-destructive' : ''}`}
                        disabled={isSubmitting}
                        autoComplete="current-password"
                      />
                    </div>
                    {loginForm.errors.password && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />{loginForm.errors.password}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : "Sign In"}
                  </Button>
                  
                  <div className="text-center">
                    <Button type="button" variant="link" className="text-sm text-muted-foreground" onClick={() => setForgotPasswordOpen(true)}>
                      Forgot password?
                    </Button>
                  </div>
                </form>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                {/* Wallet & AI Agent Login */}
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full h-11 justify-between group hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all"
                    onClick={handleWalletConnect}
                    disabled={isConnectingWallet}
                  >
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-emerald-500" />
                      <span>Connect Wallet</span>
                    </div>
                    {isConnectingWallet ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="text-xs text-muted-foreground group-hover:text-emerald-500 transition-colors">MetaMask</span>
                    )}
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full h-11 justify-between group hover:border-violet-500/50 hover:bg-violet-500/5 transition-all"
                    onClick={() => setLocation("/auth/agent")}
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-violet-500" />
                      <span>AI Agent Login</span>
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-violet-500 transition-colors flex items-center gap-1">
                      ERC-8004 <ArrowRight className="h-3 w-3" />
                    </span>
                  </Button>
                </div>

                {/* OAuth Section */}
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    disabled={!oauthStatus?.github}
                    onClick={() => handleOAuthLogin("github")}
                    className={!oauthStatus?.github ? "opacity-50" : ""}
                  >
                    <Github className="mr-2 h-4 w-4" />
                    GitHub
                  </Button>
                  <Button 
                    variant="outline" 
                    disabled={!oauthStatus?.google}
                    onClick={() => handleOAuthLogin("google")}
                    className={!oauthStatus?.google ? "opacity-50" : ""}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                  </Button>
                </div>
                {(!oauthStatus?.github && !oauthStatus?.google) && (
                  <p className="text-xs text-center text-muted-foreground">
                    OAuth providers not configured
                  </p>
                )}
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Name (Optional)</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-name"
                        type="text"
                        placeholder="Your Name"
                        value={registerForm.name}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, name: e.target.value }))}
                        className="pl-10"
                        disabled={isSubmitting}
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="you@example.com"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value, errors: { ...prev.errors, email: undefined } }))}
                        className={`pl-10 ${registerForm.errors.email ? 'border-destructive' : ''}`}
                        disabled={isSubmitting}
                        autoComplete="email"
                      />
                    </div>
                    {registerForm.errors.email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />{registerForm.errors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="••••••••"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value, errors: { ...prev.errors, password: undefined } }))}
                        className={`pl-10 ${registerForm.errors.password ? 'border-destructive' : ''}`}
                        disabled={isSubmitting}
                        autoComplete="new-password"
                      />
                    </div>
                    
                    {/* Password Strength Indicator */}
                    {registerForm.password && passwordValidation && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Password strength:</span>
                          <span className={`font-medium ${
                            passwordValidation.strengthColor === 'red' ? 'text-red-500' :
                            passwordValidation.strengthColor === 'orange' ? 'text-orange-500' :
                            passwordValidation.strengthColor === 'yellow' ? 'text-yellow-500' :
                            passwordValidation.strengthColor === 'green' ? 'text-green-500' :
                            'text-emerald-500'
                          }`}>
                            {passwordValidation.strength}
                          </span>
                        </div>
                        <Progress 
                          value={passwordValidation.score} 
                          className={`h-1.5 ${strengthColors[passwordValidation.strengthColor] || 'bg-gray-500'}`}
                        />
                        
                        {/* Password requirements checklist */}
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div className={`flex items-center gap-1 ${registerForm.password.length >= 8 ? 'text-green-500' : 'text-muted-foreground'}`}>
                            <CheckCircle2 className="h-3 w-3" /> 8+ characters
                          </div>
                          <div className={`flex items-center gap-1 ${/[A-Z]/.test(registerForm.password) ? 'text-green-500' : 'text-muted-foreground'}`}>
                            <CheckCircle2 className="h-3 w-3" /> Uppercase
                          </div>
                          <div className={`flex items-center gap-1 ${/[a-z]/.test(registerForm.password) ? 'text-green-500' : 'text-muted-foreground'}`}>
                            <CheckCircle2 className="h-3 w-3" /> Lowercase
                          </div>
                          <div className={`flex items-center gap-1 ${/[0-9]/.test(registerForm.password) ? 'text-green-500' : 'text-muted-foreground'}`}>
                            <CheckCircle2 className="h-3 w-3" /> Number
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {registerForm.errors.password && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />{registerForm.errors.password}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting || (passwordValidation && !passwordValidation.valid)}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : "Create Account"}
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or register with</span>
                  </div>
                </div>

                {/* Wallet Registration */}
                <Button 
                  variant="outline" 
                  className="w-full h-11 justify-between group hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all"
                  onClick={handleWalletConnect}
                  disabled={isConnectingWallet}
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-500" />
                    <span>Register with Wallet</span>
                  </div>
                  {isConnectingWallet ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-xs text-muted-foreground group-hover:text-emerald-500 transition-colors">MetaMask</span>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground mt-4">
                  By creating an account, you agree to our{" "}
                  <a href="/terms" className="underline hover:text-primary">Terms</a>
                  {" "}and{" "}
                  <a href="/privacy" className="underline hover:text-primary">Privacy Policy</a>
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      <ForgotPasswordDialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen} />
    </div>
  );
}
