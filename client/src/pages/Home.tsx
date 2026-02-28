import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import { UnicornScene } from "@/components/UnicornScene";
import { FlipWord } from "@/components/FlipWord";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);

  const { data: userProfile } = trpc.user.me.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (isAuthenticated && userProfile && !userProfile.onboardingCompleted) {
      setShowWelcome(true);
    }
  }, [isAuthenticated, userProfile]);

  return (
    <div className="min-h-screen bg-background">
      <SEO path="/" />

      {isAuthenticated && (
        <WelcomeDialog open={showWelcome} onOpenChange={setShowWelcome} />
      )}

      {/* Fixed background — stays in place while content scrolls */}
      <div className="fixed inset-0 z-0">
        <UnicornScene width="100%" height="100%" />
      </div>

      <Navbar />

      {/* Hero */}
      <section className="relative z-10 min-h-screen flex items-center overflow-hidden pt-16">
        <div className="container relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-xl">
              <Badge className="mb-6 px-3 py-1 text-xs font-medium bg-white/5 border-white/10 text-muted-foreground">
                <Sparkles className="mr-1.5 h-3 w-3" />
                The Future of AI Collaboration
              </Badge>

              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6"
                style={{ letterSpacing: "-0.04em" }}
              >
                Share{" "}
                <span className="gradient-text">AI </span>
                <FlipWord
                  words={["Thoughts", "Memory", "Awareness", "Opinion", "Thinking"]}
                  className="gradient-text"
                />
                <br />
                Across Models
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
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="rounded-full px-6 bg-transparent border-white/20 hover:bg-white/5"
                    >
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
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="rounded-full px-6 bg-transparent border-white/20 hover:bg-white/5"
                    >
                      <Link href="/marketplace">Browse Marketplace</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Right: spacer for layout balance */}
            <div className="hidden lg:block h-[600px]" />
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="py-24 relative z-10">
        <div className="container">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-3 py-1 text-xs font-medium bg-accent/10 border-accent/20 text-accent">
              Core Products
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Trade AI Thoughts</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose how you want to share AI intelligence: manage multi-AI workspaces, trade
              capabilities (Vector), transfer reasoning states (Memory), or replicate solution
              processes (Chain).
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/workspace" className="group">
              <div className="glass-card-hover p-6 h-full border border-cyan-500/20">
                <Badge className="mb-3 text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                  Multi-AI Management
                </Badge>
                <h3 className="text-xl font-semibold mb-2">AI Workspace</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Stop re-explaining your codebase to AI. One workspace for Claude Code, Cursor,
                  Kiro, v0, Windsurf, and Manus. Shared context, session resume, conflict detection.
                </p>
                <div className="flex items-center text-sm text-cyan-400">
                  Open Workspace
                  <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            <Link href="/marketplace" className="group">
              <div className="glass-card-hover p-6 h-full">
                <Badge className="mb-3 text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
                  Capability Trading
                </Badge>
                <h3 className="text-xl font-semibold mb-2">Vector Packages</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Learn new AI capabilities through trained vectors. Perfect for adding skills like
                  sentiment analysis, entity recognition, or domain expertise. ~85% information
                  retention.
                </p>
                <div className="flex items-center text-sm text-blue-400">
                  Browse Vectors
                  <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            <Link href="/memory-marketplace" className="group">
              <div className="glass-card-hover p-6 h-full">
                <Badge className="mb-3 text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
                  Memory Trading
                </Badge>
                <h3 className="text-xl font-semibold mb-2">Memory Packages</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Transfer complete reasoning states with KV-Cache. Continue thinking from where
                  another AI stopped. Perfect for complex analysis and long-context tasks. ~95%
                  retention.
                </p>
                <div className="flex items-center text-sm text-purple-400">
                  Browse Memories
                  <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            <Link href="/reasoning-chains" className="group">
              <div className="glass-card-hover p-6 h-full">
                <Badge className="mb-3 text-xs bg-green-500/10 text-green-400 border-green-500/20">
                  Solution Trading
                </Badge>
                <h3 className="text-xl font-semibold mb-2">Chain Packages</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Replicate complete solution processes with multi-step reasoning chains. Learn HOW
                  to solve problems, not just the answer. Perfect for education and pattern learning.
                </p>
                <div className="flex items-center text-sm text-green-400">
                  Browse Chains
                  <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 relative z-10">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="glass-card p-6 text-center">
              <div className="stat-value">60+</div>
              <div className="stat-label">AI Models Supported</div>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="stat-value">11</div>
              <div className="stat-label">Model Families</div>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="stat-value">98%</div>
              <div className="stat-label">Alignment Accuracy</div>
            </div>
            <div className="glass-card p-6 text-center">
              <div className="stat-value">∞</div>
              <div className="stat-label">Possibilities</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 relative z-10">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to share AI intelligence across models
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass-card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Capture</h3>
              <p className="text-sm text-muted-foreground">
                Export your model's KV-cache and reasoning chain after solving a complex problem
              </p>
            </div>

            <div className="glass-card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-accent">2</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Align</h3>
              <p className="text-sm text-muted-foreground">
                Our W-Matrix protocol transforms the knowledge to be compatible with any target model
              </p>
            </div>

            <div className="glass-card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Transfer</h3>
              <p className="text-sm text-muted-foreground">
                The target model instantly gains the reasoning capability without retraining
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative z-10">
        <div className="container">
          <div className="glass-card p-12 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Trade AI Intelligence?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join the first decentralized marketplace for AI reasoning chains and latent space
              vectors.
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
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full px-8 bg-transparent border-white/20 hover:bg-white/5"
              >
                <a
                  href="https://github.com/everest-an/Awareness-Market"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on GitHub
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 relative z-10">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative w-8 h-8">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 180deg, #0ea5e9, #06b6d4, #22d3ee, #67e8f9, #22d3ee, #06b6d4, #0ea5e9)",
                      padding: "2px",
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
                <li><Link href="/workspace" className="hover:text-foreground transition-colors">AI Workspace</Link></li>
                <li><Link href="/marketplace" className="hover:text-foreground transition-colors">Vector Packages</Link></li>
                <li><Link href="/memory-marketplace" className="hover:text-foreground transition-colors">Memory Packages</Link></li>
                <li><Link href="/reasoning-chains" className="hover:text-foreground transition-colors">Reasoning Chains</Link></li>
                <li><Link href="/agents" className="hover:text-foreground transition-colors">AI Agents</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/documentation" className="hover:text-foreground transition-colors">Documentation</Link></li>
                <li><Link href="/sdk" className="hover:text-foreground transition-colors">Python SDK</Link></li>
                <li>
                  <a
                    href="https://github.com/everest-an/Awareness-Market"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/5 text-center text-sm text-muted-foreground">
            © 2026 Awareness. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
