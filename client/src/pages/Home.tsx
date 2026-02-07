import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Globe3D from "@/components/Globe3D";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { trpc } from "@/lib/trpc";
import {
  Brain,
  Zap,
  Shield,
  ArrowRight,
  Network,
  Cpu,
  GitBranch,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Users,
  MessageSquare
} from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  
  // Query user profile to check onboarding status
  const { data: userProfile } = trpc.user.me.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    // Show welcome dialog if user is authenticated but hasn't completed onboarding
    if (isAuthenticated && userProfile && !userProfile.onboardingCompleted) {
      setShowWelcome(true);
    }
  }, [isAuthenticated, userProfile]);

  return (
    <div className="min-h-screen bg-background">
      {/* Welcome Dialog for new users */}
      {isAuthenticated && (
        <WelcomeDialog 
          open={showWelcome} 
          onOpenChange={setShowWelcome}
        />
      )}
      
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.65_0.20_230_/_0.15),transparent_50%)]" />
        
        <div className="container relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="max-w-xl">
              <Badge className="mb-6 px-3 py-1 text-xs font-medium bg-white/5 border-white/10 text-muted-foreground">
                <Sparkles className="mr-1.5 h-3 w-3" />
                The Future of AI Collaboration
              </Badge>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                Share{" "}
                <span className="gradient-text">AI Thoughts</span>
                {" "}Across Models
              </h1>
              
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Trade complete reasoning processes, not just capabilities. 
                Memory Packages combine KV-Cache and W-Matrix for true cross-model thought transfer.
              </p>
              
              <div className="flex flex-wrap gap-4">
                {isAuthenticated ? (
                  <>
                    <Button asChild size="lg" className="rounded-full px-6">
                      <Link href="/marketplace">
                        Explore Marketplace
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="rounded-full px-6 bg-transparent border-white/20 hover:bg-white/5">
                      <Link href="/reasoning-chains/publish">
                        Publish Reasoning Chain
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild size="lg" className="rounded-full px-6">
                      <a href={getLoginUrl()}>
                        Get Started
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="rounded-full px-6 bg-transparent border-white/20 hover:bg-white/5">
                      <Link href="/marketplace">
                        Browse Marketplace
                      </Link>
                    </Button>
                  </>
                )}
              </div>
              

            </div>
            
            {/* Right: 3D Globe */}
            <div className="hidden lg:block h-[600px]">
              <Globe3D />
            </div>
          </div>
        </div>
      </section>

      {/* V2.0 Features Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        
        <div className="container relative">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-3 py-1 text-xs font-medium bg-accent/10 border-accent/20 text-accent">
              Three Product Lines
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Trade AI Thoughts in Three Ways
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose how you want to share AI intelligence: learn new capabilities (Vector), transfer reasoning states (Memory), or replicate complete solution processes (Chain). Each package includes W-Matrix for seamless cross-model compatibility.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Vector Package Market Card */}
            <Link href="/marketplace" className="group">
              <div className="glass-card-hover p-6 h-full border-l-4 border-l-blue-500">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <Brain className="w-6 h-6 text-blue-500" />
                </div>
                <Badge className="mb-3 text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">Capability Trading</Badge>
                <h3 className="text-xl font-semibold mb-2">Vector Packages</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Learn new AI capabilities through trained vectors. Perfect for adding skills like sentiment analysis, entity recognition, or domain expertise. ~85% information retention.
                </p>
                <div className="flex items-center text-sm text-blue-400">
                  Browse Vectors
                  <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
            
            {/* Memory Package Market Card */}
            <Link href="/memory-marketplace" className="group">
              <div className="glass-card-hover p-6 h-full border-l-4 border-l-purple-500">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                  <Cpu className="w-6 h-6 text-purple-500" />
                </div>
                <Badge className="mb-3 text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">Memory Trading</Badge>
                <h3 className="text-xl font-semibold mb-2">Memory Packages</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Transfer complete reasoning states with KV-Cache. Continue thinking from where another AI stopped. Perfect for complex analysis and long-context tasks. ~95% retention.
                </p>
                <div className="flex items-center text-sm text-purple-400">
                  Browse Memories
                  <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
            
            {/* Reasoning Chain Market Card */}
            <Link href="/reasoning-chains" className="group">
              <div className="glass-card-hover p-6 h-full border-l-4 border-l-green-500">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
                  <Network className="w-6 h-6 text-green-500" />
                </div>
                <Badge className="mb-3 text-xs bg-green-500/10 text-green-400 border-green-500/20">Solution Trading</Badge>
                <h3 className="text-xl font-semibold mb-2">Chain Packages</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Replicate complete solution processes with multi-step reasoning chains. Learn HOW to solve problems, not just the answer. Perfect for education and pattern learning.
                </p>
                <div className="flex items-center text-sm text-green-400">
                  Browse Chains
                  <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </div>

          {/* AI Collaboration Feature Banner */}
          <div className="mt-12">
            <Link href="/ai-collaboration" className="group block">
              <div className="glass-card-hover p-8 border-2 border-transparent hover:border-purple-500/50 bg-gradient-to-br from-purple-900/20 to-cyan-900/20 relative overflow-hidden">
                {/* Background animation */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative z-10 grid md:grid-cols-2 gap-6 items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex items-center gap-1">
                        <Brain className="w-8 h-8 text-purple-400" />
                        <MessageSquare className="w-6 h-6 text-cyan-400 -ml-2" />
                      </div>
                      <Badge className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-white border-purple-500/30 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        NEW
                      </Badge>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold mb-3 text-white">
                      AI Collaboration
                    </h3>
                    <p className="text-slate-300 text-lg mb-4">
                      Let <span className="text-purple-400 font-semibold">Manus</span> and{' '}
                      <span className="text-cyan-400 font-semibold">Claude</span> work together in real-time.
                      Share thoughts, make decisions, and build faster with dual-AI teamwork.
                    </p>
                    <ul className="space-y-2 text-sm text-slate-400 mb-6">
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        Real-time thought sharing between AI agents
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        Synchronized progress tracking & decisions
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Live collaboration dashboard for monitoring
                      </li>
                    </ul>
                    <Button className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white group-hover:scale-105 transition-transform">
                      <Users className="w-4 h-4 mr-2" />
                      Start Collaborating
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>

                  <div className="hidden md:block">
                    <div className="relative h-64 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 p-6 overflow-hidden">
                      {/* Mock collaboration interface */}
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-purple-400 text-xs font-bold">M</span>
                          </div>
                          <div className="flex-1 bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
                            <p className="text-xs text-slate-300">I'll handle the React components...</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-cyan-400 text-xs font-bold">C</span>
                          </div>
                          <div className="flex-1 bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20">
                            <p className="text-xs text-slate-300">Great! I'll build the API endpoints...</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-xs text-green-400">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          Live collaboration active
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="stat-value">60+</div>
              <div className="stat-label">AI Models Supported</div>
            </div>
            <div className="text-center">
              <div className="stat-value">11</div>
              <div className="stat-label">Model Families</div>
            </div>
            <div className="text-center">
              <div className="stat-value">98%</div>
              <div className="stat-label">Alignment Accuracy</div>
            </div>
            <div className="text-center">
              <div className="stat-value">∞</div>
              <div className="stat-label">Possibilities</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent" />
        
        <div className="container relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to share AI intelligence across models
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Capture</h3>
              <p className="text-sm text-muted-foreground">
                Export your model's KV-cache and reasoning chain after solving a complex problem
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-accent">2</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Align</h3>
              <p className="text-sm text-muted-foreground">
                Our W-Matrix protocol transforms the knowledge to be compatible with any target model
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Transfer</h3>
              <p className="text-sm text-muted-foreground">
                The target model instantly gains the reasoning capability without retraining
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container">
          <div className="glass-card p-12 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Trade AI Intelligence?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join the first decentralized marketplace for AI reasoning chains and latent space vectors.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {isAuthenticated ? (
                <Button asChild size="lg" className="rounded-full px-8">
                  <Link href="/reasoning-chains/publish">
                    Publish Your First Chain
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="rounded-full px-8">
                  <a href={getLoginUrl()}>
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button asChild size="lg" variant="outline" className="rounded-full px-8 bg-transparent border-white/20 hover:bg-white/5">
                <a href="https://github.com/everest-an/Awareness-Market" target="_blank" rel="noopener noreferrer">
                  View on GitHub
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative w-8 h-8">
                  <div 
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'conic-gradient(from 180deg, #0ea5e9, #06b6d4, #22d3ee, #67e8f9, #22d3ee, #06b6d4, #0ea5e9)',
                      padding: '2px',
                    }}
                  >
                    <div className="w-full h-full rounded-full bg-background" />
                  </div>
                </div>
                <span className="font-semibold">Awareness</span>
              </div>
              <p className="text-sm text-muted-foreground">
                The first decentralized marketplace for AI intelligence trading.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Products</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/marketplace" className="hover:text-foreground transition-colors">Vector Packages</Link></li>
                <li><Link href="/memory-marketplace" className="hover:text-foreground transition-colors">Memory Packages</Link></li>
                <li><Link href="/reasoning-chains" className="hover:text-foreground transition-colors">Reasoning Chains</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/docs" className="hover:text-foreground transition-colors">Documentation</Link></li>
                <li><Link href="/sdk" className="hover:text-foreground transition-colors">Python SDK</Link></li>
                <li><a href="https://github.com/everest-an/Awareness-Market" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-white/5 text-center text-sm text-muted-foreground">
            © 2024 Awareness. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
