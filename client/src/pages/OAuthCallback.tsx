/**
 * OAuth Callback Page
 * 
 * Handles OAuth provider callbacks (GitHub, Google).
 * Exchanges authorization code for tokens and redirects to home.
 */

import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Github } from "lucide-react";

type OAuthProvider = "github" | "google";

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/api/auth/callback/:provider");
  const utils = trpc.useUtils();
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const provider = (params?.provider as OAuthProvider) || "github";

  const oauthCallbackMutation = trpc.auth.oauthCallback.useMutation({
    onSuccess: async (data) => {
      if (data.success) {
        setStatus("success");
        await utils.auth.me.invalidate();
        // Redirect after short delay
        setTimeout(() => setLocation("/"), 1500);
      } else {
        setStatus("error");
        setErrorMessage(data.error || "Authentication failed");
      }
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message || "Authentication failed");
    },
  });

  useEffect(() => {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");

    if (error) {
      setStatus("error");
      setErrorMessage(errorDescription || error || "OAuth authorization denied");
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setErrorMessage("Missing authorization code or state");
      return;
    }

    // Exchange code for tokens
    oauthCallbackMutation.mutate({
      provider,
      code,
      state,
    });
  }, [provider]);

  const getProviderIcon = () => {
    if (provider === "github") {
      return <Github className="h-8 w-8" />;
    }
    return (
      <svg className="h-8 w-8" viewBox="0 0 24 24">
        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    );
  };

  const getProviderName = () => {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 text-muted-foreground">
            {getProviderIcon()}
          </div>
          <CardTitle>
            {status === "loading" && `Signing in with ${getProviderName()}...`}
            {status === "success" && "Welcome!"}
            {status === "error" && "Authentication Failed"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Please wait while we complete your sign in."}
            {status === "success" && "You have been successfully signed in."}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex flex-col items-center gap-4">
          {status === "loading" && (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          )}
          
          {status === "success" && (
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          )}
          
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setLocation("/auth")}>
                  Try Again
                </Button>
                <Button onClick={() => setLocation("/")}>
                  Go Home
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
