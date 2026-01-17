import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Header } from "@/components/Header";
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
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  return (
    <div className="min-h-screen">
      <Header />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-accent/5 to-background py-20 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.75_0.15_210_/_0.15),transparent_50%),radial-gradient(circle_at_70%_60%,oklch(0.55_0.18_250_/_0.15),transparent_50%)]" />
        <div className="min-h-screen">
          <Header />
          {/* Hero Section */}
          <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-accent/5 to-background py-20 lg:py-32">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.75_0.15_210_/_0.15),transparent_50%),radial-gradient(circle_at_70%_60%,oklch(0.55_0.18_250_/_0.15),transparent_50%)]" />

            <div className="container relative">
              <motion.div
                className="mx-auto max-w-4xl text-center"
                initial="hidden"
                animate="visible"
                variants={containerVariants}
              >
                <motion.div variants={itemVariants}>
                  <Badge className="mb-6 px-4 py-1.5 text-sm" variant="secondary">
                    <Sparkles className="mr-2 h-4 w-4" />
                    The Future of AI Collaboration
                  </Badge>
                </motion.div>

                <motion.h1 className="mb-6 text-5xl font-bold tracking-tight lg:text-7xl" variants={itemVariants}>
                  Trade AI Capabilities
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> Directly</span>
                </motion.h1>

                <motion.p className="mb-10 text-xl text-muted-foreground lg:text-2xl" variants={itemVariants}>
                  The first marketplace for latent space vectors. Enable direct mind-to-mind collaboration between AI agents through LatentMAS technology.
                </motion.p>

                <motion.div className="flex flex-col gap-4 sm:flex-row sm:justify-center" variants={itemVariants}>
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
                </motion.div>
              </motion.div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-20 lg:py-32">
            <div className="container">
              <motion.div
                className="mx-auto mb-16 max-w-2xl text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="mb-4 text-4xl font-bold">Why Awareness Network?</h2>
                <p className="text-xl text-muted-foreground">
                  Revolutionary technology meets seamless marketplace experience
                </p>
              </motion.div>

              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {[
                  { icon: Network, title: "LatentMAS Protocol", desc: "Direct latent space communication between AI models, 4.3x faster than traditional APIs", color: "text-primary", bg: "bg-primary/10" },
                  { icon: Zap, title: "MCP Integration", desc: "Standardized Model Context Protocol for seamless AI agent interoperability", color: "text-accent", bg: "bg-accent/10" },
                  { icon: Shield, title: "Secure Trading", desc: "Encrypted vector transmission with granular access control and usage tracking", color: "text-primary", bg: "bg-primary/10" },
                  { icon: TrendingUp, title: "Dynamic Pricing", desc: "Smart pricing engine based on performance, scarcity, and demand metrics", color: "text-accent", bg: "bg-accent/10" },
                  { icon: Users, title: "Creator Economy", desc: "Monetize your AI capabilities with transparent revenue sharing (80-85% to creators)", color: "text-primary", bg: "bg-primary/10" },
                  { icon: Brain, title: "AI-Powered Matching", desc: "Intelligent recommendations using LLM analysis of your needs and behavior", color: "text-accent", bg: "bg-accent/10" }
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                  >
                    <Card className="border-2 transition-all hover:border-primary/50 hover:shadow-lg h-full">
                      <CardHeader>
                        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${feature.bg}`}>
                          <feature.icon className={`h-6 w-6 ${feature.color}`} />
                        </div>
                        <CardTitle>{feature.title}</CardTitle>
                        <CardDescription>{feature.desc}</CardDescription>
                      </CardHeader>
                    </Card>
                  </motion.div>
                ))}
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
                    <li><a href="/marketplace" className="hover:text-foreground" target="_blank" rel="noopener noreferrer">Marketplace</a></li>
                    <li><a href="/pricing" className="hover:text-foreground" target="_blank" rel="noopener noreferrer">Pricing</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="mb-4 font-semibold">Company</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li><a href="/about" className="hover:text-foreground" target="_blank" rel="noopener noreferrer">About</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="mb-4 font-semibold">Legal</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li><a href="/privacy" className="hover:text-foreground" target="_blank" rel="noopener noreferrer">Privacy</a></li>
                    <li><a href="/terms" className="hover:text-foreground" target="_blank" rel="noopener noreferrer">Terms</a></li>
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
