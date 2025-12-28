import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { 
  Brain, 
  Zap, 
  Shield, 
  TrendingUp, 
  Users, 
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Network
} from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-accent/5 to-background py-20 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.75_0.15_210_/_0.15),transparent_50%),radial-gradient(circle_at_70%_60%,oklch(0.55_0.18_250_/_0.15),transparent_50%)]" />
        
        <div className="container relative">
          <div className="mx-auto max-w-4xl text-center">
            <Badge className="mb-6 px-4 py-1.5 text-sm" variant="secondary">
              <Sparkles className="mr-2 h-4 w-4" />
              The Future of AI Collaboration
            </Badge>
            
            <h1 className="mb-6 text-5xl font-bold tracking-tight lg:text-7xl">
              Trade AI Capabilities
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> Directly</span>
            </h1>
            
            <p className="mb-10 text-xl text-muted-foreground lg:text-2xl">
              The first marketplace for latent space vectors. Enable direct mind-to-mind collaboration between AI agents through LatentMAS technology.
            </p>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              {isAuthenticated ? (
                <>
                  <Button asChild size="lg" className="text-lg">
                    <Link href="/marketplace">
                      <Brain className="mr-2 h-5 w-5" />
                      Explore Marketplace
                    </Link>
                  </Button>
                  {user?.role === "creator" && (
                    <Button asChild size="lg" variant="outline" className="text-lg">
                      <Link href="/dashboard">
                        <TrendingUp className="mr-2 h-5 w-5" />
                        Creator Dashboard
                      </Link>
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button asChild size="lg" className="text-lg">
                    <a href={getLoginUrl()}>
                      Get Started
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="text-lg">
                    <Link href="/marketplace">
                      Browse Marketplace
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-32">
        <div className="container">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-4xl font-bold">Why Awareness Network?</h2>
            <p className="text-xl text-muted-foreground">
              Revolutionary technology meets seamless marketplace experience
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-2 transition-all hover:border-primary/50 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Network className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>LatentMAS Protocol</CardTitle>
                <CardDescription>
                  Direct latent space communication between AI models, 4.3x faster than traditional APIs
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 transition-all hover:border-primary/50 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>MCP Integration</CardTitle>
                <CardDescription>
                  Standardized Model Context Protocol for seamless AI agent interoperability
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 transition-all hover:border-primary/50 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Secure Trading</CardTitle>
                <CardDescription>
                  Encrypted vector transmission with granular access control and usage tracking
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 transition-all hover:border-primary/50 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <TrendingUp className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Dynamic Pricing</CardTitle>
                <CardDescription>
                  Smart pricing engine based on performance, scarcity, and demand metrics
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 transition-all hover:border-primary/50 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Creator Economy</CardTitle>
                <CardDescription>
                  Monetize your AI capabilities with transparent revenue sharing (80-85% to creators)
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 transition-all hover:border-primary/50 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <Brain className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>AI-Powered Matching</CardTitle>
                <CardDescription>
                  Intelligent recommendations using LLM analysis of your needs and behavior
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-muted/30 py-20 lg:py-32">
        <div className="container">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-4xl font-bold">How It Works</h2>
            <p className="text-xl text-muted-foreground">
              Three simple steps to start trading AI capabilities
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-3">
            <div className="relative">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                1
              </div>
              <h3 className="mb-3 text-2xl font-semibold">Create or Browse</h3>
              <p className="text-muted-foreground">
                AI creators upload their latent vectors with performance metrics and pricing. Consumers browse the marketplace to find capabilities that match their needs.
              </p>
            </div>

            <div className="relative">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-foreground">
                2
              </div>
              <h3 className="mb-3 text-2xl font-semibold">Secure Purchase</h3>
              <p className="text-muted-foreground">
                Complete transactions through our Stripe-powered payment system. Access tokens are generated with configurable expiration and call limits.
              </p>
            </div>

            <div className="relative">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                3
              </div>
              <h3 className="mb-3 text-2xl font-semibold">Integrate & Use</h3>
              <p className="text-muted-foreground">
                Access purchased vectors via our MCP-compatible API. Track usage, performance, and ROI through comprehensive analytics dashboards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 lg:py-32">
        <div className="container">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-4xl font-bold">Use Cases</h2>
            <p className="text-xl text-muted-foreground">
              Powering innovation across industries
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Financial Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Access specialized models for market prediction, risk assessment, and algorithmic trading strategies trained on proprietary financial data.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Code Generation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Leverage domain-specific code generation models fine-tuned for frameworks, languages, or architectural patterns.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Medical Diagnosis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Integrate specialized medical AI capabilities for image analysis, symptom assessment, and treatment recommendations.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Content Creation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Access creative AI models for copywriting, design generation, video editing, and multimedia content production.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-primary to-accent py-20 text-primary-foreground lg:py-32">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-6 text-4xl font-bold lg:text-5xl">
              Ready to Join the AI Capability Revolution?
            </h2>
            <p className="mb-10 text-xl opacity-90">
              Whether you're creating AI capabilities or looking to integrate them, Awareness Network is your gateway to the future of AI collaboration.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              {isAuthenticated ? (
                <Button asChild size="lg" variant="secondary" className="text-lg">
                  <Link href="/marketplace">
                    Start Exploring
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" variant="secondary" className="text-lg">
                    <a href={getLoginUrl()}>
                      Sign Up Now
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-primary-foreground bg-transparent text-primary-foreground hover:bg-primary-foreground/10 text-lg">
                    <Link href="/marketplace">
                      View Marketplace
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="mb-4 font-semibold">Awareness Network</h3>
              <p className="text-sm text-muted-foreground">
                The first marketplace for AI latent space vectors, powered by LatentMAS and MCP technology.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/marketplace" className="hover:text-foreground">Marketplace</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground">About</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            © 2025 Awareness Network. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
