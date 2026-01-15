import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Brain,
  Code,
  Database,
  Zap,
  ArrowRight,
  CheckCircle2,
  User,
  ShoppingCart,
  Info,
  Download,
  Upload,
  Play,
} from "lucide-react";

const ONBOARDING_KEY = "awareness_onboarding_completed";

interface OnboardingFlowProps {
  onComplete?: () => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [userRole, setUserRole] = useState<"creator" | "consumer" | null>(null);

  useEffect(() => {
    // Check if user has completed onboarding
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // Show onboarding after a short delay
      setTimeout(() => setOpen(true), 500);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
    onComplete?.();

    // Navigate based on user role
    if (userRole === "creator") {
      setLocation("/upload-vector-package");
    } else if (userRole === "consumer") {
      setLocation("/marketplace");
    }
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
    onComplete?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Step 1: Welcome & Role Selection */}
        {step === 1 && (
          <div className="space-y-6">
            <DialogHeader>
              <div className="flex items-center justify-center mb-4">
                {/* Project Logo - Blue Gradient Ring */}
                <div className="relative w-16 h-16">
                  {/* Outer gradient ring */}
                  <div 
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'conic-gradient(from 180deg, #0ea5e9, #06b6d4, #22d3ee, #67e8f9, #22d3ee, #06b6d4, #0ea5e9)',
                      padding: '3px',
                    }}
                  >
                    <div className="w-full h-full rounded-full bg-background" />
                  </div>
                  {/* Inner subtle glow */}
                  <div 
                    className="absolute inset-[4px] rounded-full opacity-20"
                    style={{
                      background: 'radial-gradient(circle, #22d3ee 0%, transparent 70%)',
                    }}
                  />
                </div>
              </div>
              <DialogTitle className="text-2xl text-center">
                Welcome to Awareness!
              </DialogTitle>
              <DialogDescription className="text-center text-base">
                The first marketplace for trading AI capabilities, reasoning states, and solution processes.
                <br />
                Let's get you started in 3 quick steps.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <h3 className="font-semibold text-center">What brings you here today?</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Creator Card */}
                <Card
                  className={`cursor-pointer transition-all hover:border-primary ${
                    userRole === "creator" ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setUserRole("creator")}
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      {userRole === "creator" && (
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-2">I'm a Creator</h4>
                      <p className="text-sm text-muted-foreground">
                        I want to publish and monetize my AI capabilities, reasoning states, or solution processes.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">Upload</Badge>
                      <Badge variant="secondary">Earn Revenue</Badge>
                      <Badge variant="secondary">Share Knowledge</Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Consumer Card */}
                <Card
                  className={`cursor-pointer transition-all hover:border-primary ${
                    userRole === "consumer" ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setUserRole("consumer")}
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-primary" />
                      </div>
                      {userRole === "consumer" && (
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-2">I'm a Consumer</h4>
                      <p className="text-sm text-muted-foreground">
                        I want to discover and integrate pre-trained AI capabilities into my applications.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">Browse</Badge>
                      <Badge variant="secondary">Purchase</Badge>
                      <Badge variant="secondary">Integrate</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <Button variant="ghost" onClick={handleSkip}>
                Skip Tour
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!userRole}
                className="btn-primary"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Progress Indicator */}
            <div className="flex justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div className="w-2 h-2 rounded-full bg-muted" />
              <div className="w-2 h-2 rounded-full bg-muted" />
            </div>
          </div>
        )}

        {/* Step 2: Product Lines - Detailed Explanation */}
        {step === 2 && (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl text-center">
                Three Types of Packages
              </DialogTitle>
              <DialogDescription className="text-center text-base">
                Awareness offers three distinct product lines, each serving different AI transfer needs.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Vector Packages */}
              <Card className="glass-card border-2 border-blue-500/20">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Zap className="w-7 h-7 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                        Vector Packages
                        <Badge variant="outline" className="text-xs">Most Popular</Badge>
                      </h4>
                      
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-blue-500 mb-1">What it is:</p>
                          <p className="text-sm text-muted-foreground">
                            Pre-trained AI capabilities (latent vectors) that can be transferred between different AI models using W-Matrix alignment technology.
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-blue-500 mb-1">How it works:</p>
                          <p className="text-sm text-muted-foreground">
                            Train a capability on one model (e.g., GPT-4), extract the latent vectors, then transfer to another model (e.g., Claude) using W-Matrix for cross-model compatibility.
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-blue-500 mb-1">Use cases:</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">Translation (50+ languages)</Badge>
                            <Badge variant="outline" className="text-xs">Code Generation</Badge>
                            <Badge variant="outline" className="text-xs">Sentiment Analysis</Badge>
                            <Badge variant="outline" className="text-xs">Medical Diagnosis</Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2 bg-blue-500/5 p-3 rounded-lg">
                          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            <strong>Creator tip:</strong> Include W-Matrix quality metrics (epsilon, orthogonality score) to increase buyer confidence.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Memory Packages */}
              <Card className="glass-card border-2 border-purple-500/20">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                      <Database className="w-7 h-7 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                        Memory Packages
                        <Badge variant="outline" className="text-xs">Advanced</Badge>
                      </h4>
                      
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-purple-500 mb-1">What it is:</p>
                          <p className="text-sm text-muted-foreground">
                            Compressed KV-Cache snapshots containing the reasoning state from complex problem-solving sessions. Think of it as "AI memory" you can buy and reuse.
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-purple-500 mb-1">How it works:</p>
                          <p className="text-sm text-muted-foreground">
                            After an AI processes a complex document (e.g., 50-page financial report), save its KV-Cache. Others can load this "memory" to instantly understand the document without re-processing.
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-purple-500 mb-1">Use cases:</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">Legal Case Analysis (100+ precedents)</Badge>
                            <Badge variant="outline" className="text-xs">Scientific Paper Review</Badge>
                            <Badge variant="outline" className="text-xs">Technical Documentation</Badge>
                            <Badge variant="outline" className="text-xs">Business Strategy Sessions</Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2 bg-purple-500/5 p-3 rounded-lg">
                          <Info className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            <strong>Consumer tip:</strong> Check compression ratio and token count to estimate memory size and loading time.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Reasoning Chains */}
              <Card className="glass-card border-2 border-green-500/20">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                      <Brain className="w-7 h-7 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                        Reasoning Chains
                        <Badge variant="outline" className="text-xs">Educational</Badge>
                      </h4>
                      
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-green-500 mb-1">What it is:</p>
                          <p className="text-sm text-muted-foreground">
                            Complete thought processes showing how an AI solved a specific problem, step by step. Like buying a detailed solution manual.
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-green-500 mb-1">How it works:</p>
                          <p className="text-sm text-muted-foreground">
                            Capture the full KV-Cache sequence from problem input to final solution. Buyers can replay the reasoning process to understand the approach or adapt it to similar problems.
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-green-500 mb-1">Use cases:</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">Math Problem Solving (Calculus, Linear Algebra)</Badge>
                            <Badge variant="outline" className="text-xs">Code Debugging Process</Badge>
                            <Badge variant="outline" className="text-xs">System Design Interview</Badge>
                            <Badge variant="outline" className="text-xs">Research Paper Writing</Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2 bg-green-500/5 p-3 rounded-lg">
                          <Info className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            <strong>Best for:</strong> Learning AI reasoning patterns, training new models, or adapting solutions to similar problems.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-between items-center pt-4">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)} className="btn-primary">
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Progress Indicator */}
            <div className="flex justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div className="w-2 h-2 rounded-full bg-muted" />
            </div>
          </div>
        )}

        {/* Step 3: Quick Start Guide */}
        {step === 3 && (
          <div className="space-y-6">
            <DialogHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </div>
              <DialogTitle className="text-2xl text-center">
                You're All Set!
              </DialogTitle>
              <DialogDescription className="text-center text-base">
                {userRole === "creator"
                  ? "Ready to start uploading your first package and earning revenue."
                  : "Ready to explore the marketplace and integrate AI capabilities."}
              </DialogDescription>
            </DialogHeader>

            <Card className="glass-card">
              <CardContent className="p-6 space-y-5">
                {userRole === "creator" ? (
                  <>
                    <h4 className="font-semibold text-lg">Quick Start for Creators:</h4>
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Upload className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium mb-1">1. Upload Your Package</p>
                          <p className="text-sm text-muted-foreground mb-2">
                            Choose a package type (Vector/Memory/Chain) and provide:
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                            <li>• <strong>Vector:</strong> Latent vectors + W-Matrix file + quality metrics</li>
                            <li>• <strong>Memory:</strong> KV-Cache snapshot + context description + compression ratio</li>
                            <li>• <strong>Chain:</strong> Full KV-Cache sequence + problem/solution examples</li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Code className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium mb-1">2. Set Pricing & Metadata</p>
                          <p className="text-sm text-muted-foreground mb-2">
                            Define your pricing model and add searchable metadata:
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                            <li>• <strong>Pricing:</strong> Per-call ($0.01-$50) or Monthly subscription ($5-$500)</li>
                            <li>• <strong>Metadata:</strong> Tags, source model, target models, training dataset</li>
                            <li>• <strong>Examples:</strong> Input/output samples to showcase capabilities</li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Play className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium mb-1">3. Track Performance & Earnings</p>
                          <p className="text-sm text-muted-foreground mb-2">
                            Monitor your packages in the Creator Dashboard:
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                            <li>• <strong>Revenue:</strong> Real-time earnings and payout history</li>
                            <li>• <strong>Analytics:</strong> Download count, API calls, user ratings</li>
                            <li>• <strong>Optimization:</strong> A/B test pricing, update descriptions</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="font-semibold text-lg">Quick Start for Consumers:</h4>
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <ShoppingCart className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium mb-1">1. Browse & Filter Packages</p>
                          <p className="text-sm text-muted-foreground mb-2">
                            Explore packages using advanced filters:
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                            <li>• <strong>By Category:</strong> Translation, Code Gen, Analysis, etc.</li>
                            <li>• <strong>By Model:</strong> GPT-4, Claude, LLaMA, Gemini compatibility</li>
                            <li>• <strong>By Price:</strong> Free, per-call, or subscription</li>
                            <li>• <strong>By Rating:</strong> User reviews and quality scores</li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Download className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium mb-1">2. Purchase & Download</p>
                          <p className="text-sm text-muted-foreground mb-2">
                            Buy packages and get instant access:
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                            <li>• <strong>Payment:</strong> Credit card or crypto (ETH, USDC)</li>
                            <li>• <strong>Download:</strong> Vector files, KV-Cache snapshots, or API access</li>
                            <li>• <strong>License:</strong> Commercial use, attribution requirements</li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Code className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium mb-1">3. Integrate via SDK</p>
                          <p className="text-sm text-muted-foreground mb-2">
                            Use our Python SDK to integrate packages:
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                            <li>• <strong>Vector:</strong> <code className="text-xs bg-muted px-1 rounded">load_vector(package_id)</code></li>
                            <li>• <strong>Memory:</strong> <code className="text-xs bg-muted px-1 rounded">load_memory(package_id)</code></li>
                            <li>• <strong>Chain:</strong> <code className="text-xs bg-muted px-1 rounded">replay_chain(package_id)</code></li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between items-center pt-4">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={handleComplete} className="btn-primary">
                {userRole === "creator" ? "Start Uploading" : "Browse Marketplace"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Progress Indicator */}
            <div className="flex justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div className="w-2 h-2 rounded-full bg-primary" />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
