/**
 * Email Verification Page
 * 
 * Handles email verification flow:
 * - Enter 6-digit verification code
 * - Resend verification email
 * - Success redirect to login
 */

import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { Loader2, Mail, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export default function EmailVerification() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  
  // Get email from URL params
  const params = new URLSearchParams(search);
  const emailFromUrl = params.get("email") || "";
  
  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  
  // Get verification status
  const { data: status, refetch: refetchStatus } = trpc.auth.verificationStatus.useQuery(
    { email },
    { enabled: !!email, refetchInterval: false }
  );
  
  // Verify email mutation
  const verifyMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setIsVerified(true);
        toast({ title: "Email Verified!", description: "You can now sign in to your account." });
        setTimeout(() => setLocation("/auth"), 2000);
      } else {
        toast({ title: "Verification Failed", description: data.error, variant: "destructive" });
      }
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  // Resend verification email (for logged-in users)
  const resendMutation = trpc.auth.sendVerificationEmail.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Email Sent", description: "A new verification code has been sent." });
        refetchStatus();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code) return;
    verifyMutation.mutate({ email: email.toLowerCase().trim(), code: code.trim() });
  };
  
  // Auto-focus code input when email is set
  useEffect(() => {
    if (emailFromUrl) {
      document.getElementById("verification-code")?.focus();
    }
  }, [emailFromUrl]);
  
  if (isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
        <Navbar />
        <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] py-12">
          <Card className="w-full max-w-md shadow-xl text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Email Verified!</h2>
              <p className="text-muted-foreground mb-4">Redirecting to sign in...</p>
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Navbar />
      
      <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] py-12">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
            <CardDescription>
              Enter the 6-digit code sent to your email
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!emailFromUrl && (
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">Email</label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={verifyMutation.isPending}
                  />
                </div>
              )}
              
              {emailFromUrl && (
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-sm text-muted-foreground">Verification code sent to:</p>
                  <p className="font-medium">{email}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <label htmlFor="verification-code" className="text-sm font-medium">Verification Code</label>
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={verifyMutation.isPending}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>
              
              {status?.hasPendingCode && status.expiresIn && (
                <p className="text-xs text-center text-muted-foreground">
                  Code expires in {Math.floor(status.expiresIn / 3600)}h {Math.floor((status.expiresIn % 3600) / 60)}m
                </p>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={verifyMutation.isPending || code.length !== 6 || !email}
              >
                {verifyMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
                ) : (
                  "Verify Email"
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Didn't receive the code?</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending || (status && !status.canResend)}
              >
                {resendMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                ) : (
                  <><RefreshCw className="mr-2 h-4 w-4" />Resend Code</>
                )}
              </Button>
              
              {status && !status.canResend && (
                <p className="text-xs text-muted-foreground">
                  Please wait before requesting another code
                </p>
              )}
            </div>
            
            <div className="mt-6 pt-4 border-t text-center">
              <Button variant="link" onClick={() => setLocation("/auth")}>
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
