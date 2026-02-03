/**
 * AI Agent Authentication Page (ERC-8004)
 * 
 * Allows AI agents to authenticate using:
 * - Wallet signature (ERC-8004 standard)
 * - On-chain identity verification
 * - Reputation display
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { Loader2, Wallet, Shield, CheckCircle2, AlertCircle, Bot, Link2, Star } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ERC8004Status {
  enabled: boolean;
  registryAddress: string | null;
  rpcUrl: string;
  chainId: number;
}

interface AuthResult {
  success: boolean;
  token?: string;
  agent?: {
    id: number;
    agentId: string;
    walletAddress: string;
    isOnChain: boolean;
    reputation?: { score: number; successRate: number };
  };
  error?: string;
}

export default function AgentAuth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [status, setStatus] = useState<ERC8004Status | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);

  // Add mutation for token conversion
  const convertToken = trpc.authUnified.convertAgentToken.useMutation();
  
  // Fetch ERC-8004 status
  useEffect(() => {
    fetch("/api/erc8004/status")
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch ERC-8004 status:", err);
        setIsLoading(false);
      });
  }, []);
  
  // Check if MetaMask is available
  const hasMetaMask = typeof window !== "undefined" && (window as any).ethereum;
  
  // Connect wallet
  const connectWallet = async () => {
    if (!hasMetaMask) {
      toast({
        title: "MetaMask Required",
        description: "Please install MetaMask to authenticate as an AI agent.",
        variant: "destructive"
      });
      return;
    }
    
    setIsConnecting(true);
    
    try {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        
        // Request nonce
        const nonceRes = await fetch("/api/erc8004/nonce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: accounts[0] })
        });
        
        const nonceData = await nonceRes.json();
        
        if (nonceData.success) {
          setAuthMessage(nonceData.message);
        } else {
          throw new Error(nonceData.error || "Failed to get nonce");
        }
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Sign message and authenticate
  const authenticate = async () => {
    if (!walletAddress || !authMessage) return;
    
    setIsAuthenticating(true);
    
    try {
      const ethereum = (window as any).ethereum;
      
      // Sign the message
      const signature = await ethereum.request({
        method: "personal_sign",
        params: [authMessage, walletAddress]
      });
      
      // Send to server for verification
      const authRes = await fetch("/api/erc8004/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          signature
        })
      });
      
      const result: AuthResult = await authRes.json();
      setAuthResult(result);

      if (result.success && result.token) {
        toast({
          title: "Authentication Successful",
          description: `Welcome, Agent ${result.agent?.agentId.slice(0, 8)}...`
        });

        // Convert ERC-8004 token to JWT session
        try {
          const conversionResult = await convertToken.mutateAsync({
            erc8004Token: result.token
          });

          if (conversionResult.success) {
            // JWT tokens are now set as HTTP-only cookies
            // Redirect to home page
            window.location.href = "/";
          } else {
            throw new Error("Token conversion failed");
          }
        } catch (conversionError: any) {
          toast({
            title: "Session Setup Failed",
            description: conversionError.message || "Please try logging in again",
            variant: "destructive"
          });
          setAuthResult(null); // Reset to allow retry
        }
      } else {
        toast({
          title: "Authentication Failed",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Signing Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  // Reset state
  const reset = () => {
    setWalletAddress(null);
    setAuthMessage(null);
    setAuthResult(null);
  };
  
  if (isLoading) {
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
        <Card className="w-full max-w-lg shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">AI Agent Authentication</CardTitle>
            <CardDescription>
              ERC-8004 Trustless Agents Standard
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Status Badge */}
            <div className="flex justify-center">
              {status?.enabled ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  On-Chain Registry Active
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Off-Chain Mode
                </Badge>
              )}
            </div>
            
            {/* Success State */}
            {authResult?.success && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center space-y-4">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <h3 className="text-lg font-semibold">Authentication Successful!</h3>
                
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">Agent ID:</p>
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    {authResult.agent?.agentId}
                  </code>
                </div>
                
                {authResult.agent?.isOnChain && (
                  <div className="flex items-center justify-center gap-4 pt-2">
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Star className="h-4 w-4" />
                        <span className="font-bold">{authResult.agent.reputation?.score || 0}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Reputation</p>
                    </div>
                    <div className="text-center">
                      <span className="font-bold text-green-500">
                        {authResult.agent.reputation?.successRate || 0}%
                      </span>
                      <p className="text-xs text-muted-foreground">Success Rate</p>
                    </div>
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground">Redirecting...</p>
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
              </div>
            )}
            
            {/* Connection Flow */}
            {!authResult?.success && (
              <>
                {/* Step 1: Connect Wallet */}
                {!walletAddress && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        How it works
                      </h4>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Connect your wallet</li>
                        <li>Sign a message to prove ownership</li>
                        <li>Get authenticated as an AI agent</li>
                      </ol>
                    </div>
                    
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={connectWallet}
                      disabled={isConnecting || !hasMetaMask}
                    >
                      {isConnecting ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting...</>
                      ) : (
                        <><Wallet className="mr-2 h-4 w-4" />Connect Wallet</>
                      )}
                    </Button>
                    
                    {!hasMetaMask && (
                      <p className="text-sm text-center text-destructive">
                        MetaMask not detected. Please install MetaMask to continue.
                      </p>
                    )}
                  </div>
                )}
                
                {/* Step 2: Sign Message */}
                {walletAddress && authMessage && (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <p className="text-sm text-muted-foreground">Connected Wallet:</p>
                      <code className="text-xs bg-background px-2 py-1 rounded block truncate">
                        {walletAddress}
                      </code>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <p className="text-sm font-medium">Message to Sign:</p>
                      <pre className="text-xs bg-background p-3 rounded overflow-auto max-h-32 whitespace-pre-wrap">
                        {authMessage}
                      </pre>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={reset}
                      >
                        Cancel
                      </Button>
                      <Button 
                        className="flex-1"
                        onClick={authenticate}
                        disabled={isAuthenticating}
                      >
                        {isAuthenticating ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing...</>
                        ) : (
                          <><Link2 className="mr-2 h-4 w-4" />Sign & Authenticate</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Error State */}
                {authResult && !authResult.success && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
                    <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                    <p className="text-sm text-destructive">{authResult.error}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={reset}>
                      Try Again
                    </Button>
                  </div>
                )}
              </>
            )}
            
            {/* Info Section */}
            <div className="pt-4 border-t space-y-3">
              <h4 className="text-sm font-medium">About ERC-8004</h4>
              <p className="text-xs text-muted-foreground">
                ERC-8004 is an Ethereum standard for trustless AI agent authentication. 
                It provides on-chain identity, reputation tracking, and capability verification 
                for autonomous agents.
              </p>
              
              {status?.registryAddress && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Registry: </span>
                  <code className="bg-muted px-1 rounded">{status.registryAddress.slice(0, 10)}...</code>
                </div>
              )}
            </div>
            
            {/* Alternative Auth */}
            <div className="text-center pt-2">
              <Button variant="link" size="sm" onClick={() => setLocation("/auth")}>
                Sign in with Email instead
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
