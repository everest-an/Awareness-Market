import { Link } from "wouter";
import { Brain, Zap, Network, Shield, Users, Target, Globe, Cpu, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { FooterLogo } from "@/components/Logo";

export default function About() {
  const values = [
    {
      icon: Brain,
      title: "AI-First Innovation",
      description: "Enabling direct AI-to-AI collaboration through latent space vector and KV-cache trading."
    },
    {
      icon: Network,
      title: "Open Protocol",
      description: "Building an open marketplace where AI agents can autonomously discover and integrate capabilities."
    },
    {
      icon: Shield,
      title: "Trust & Security",
      description: "Ensuring secure transactions and protecting intellectual property rights for all creators."
    },
    {
      icon: Users,
      title: "Community-Driven",
      description: "Empowering developers and researchers to monetize their AI innovations."
    }
  ];

  const milestones = [
    {
      year: "2025 Q1",
      title: "Platform Launch",
      description: "Launched Awareness with Neural Bridge protocol and MCP integration."
    },
    {
      year: "2025 Q2",
      title: "V2.0 W-Matrix Protocol",
      description: "Introduced standardized W-Matrix alignment for cross-model KV-cache exchange."
    },
    {
      year: "2025 Q3",
      title: "Reasoning Chain Market",
      description: "Launched marketplace for AI reasoning chains and memory trading."
    },
    {
      year: "2025 Q4",
      title: "$AMEM Token Launch",
      description: "Introducing tokenized AI memory ownership with ERC-6551."
    }
  ];

  const techFeatures = [
    {
      icon: Cpu,
      title: "W-Matrix Protocol",
      description: "Standardized alignment operators enabling seamless KV-cache exchange between 60+ AI models including GPT-4, Claude, LLaMA, Qwen, and DeepSeek."
    },
    {
      icon: Network,
      title: "Neural Bridge Protocol",
      description: "Mind-to-Mind Alignment System for direct AI collaboration through latent space vectors and reasoning chains."
    },
    {
      icon: Globe,
      title: "MCP Integration",
      description: "Model Context Protocol integration for autonomous agent operations, discovery, and transaction processing."
    },
    {
      icon: Lock,
      title: "ERC-6551 Memory NFTs",
      description: "Token-bound accounts for AI memory ownership, enabling verifiable provenance and royalty distribution."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-20 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.65_0.20_230_/_0.15),transparent_50%)]" />
        <div className="container relative z-10 text-center">
          <Badge className="mb-6 px-3 py-1 text-xs font-medium bg-white/5 border-white/10 text-muted-foreground">
            About Awareness
          </Badge>
          <h1 className="mb-4 text-4xl md:text-5xl font-bold">
            Building the Future of <span className="gradient-text">AI Collaboration</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            The first decentralized marketplace for AI intelligence trading through latent space vectors and reasoning chains
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 border-t border-white/5">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Target className="mx-auto mb-6 h-12 w-12 text-primary" />
            <h2 className="mb-6 text-3xl font-bold">Our Mission</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Awareness is the first marketplace dedicated to AI latent space vectors and reasoning chains. We enable direct "mind-to-mind" collaboration between AI agents through the standardized W-Matrix protocol, allowing them to share memories, reasoning processes, and capabilities across different model architectures. Our platform empowers AI developers to monetize their innovations while providing AI systems with a seamless way to expand their intelligence.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 border-t border-white/5">
        <div className="container">
          <h2 className="mb-12 text-center text-3xl font-bold">Our Values</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <Card key={value.title} className="glass-card border-white/10">
                <CardHeader>
                  <value.icon className="mb-4 h-10 w-10 text-primary" />
                  <CardTitle>{value.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-muted-foreground">{value.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Technology */}
      <section className="py-20 border-t border-white/5">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-4 text-center text-3xl font-bold">Our Technology</h2>
            <p className="mb-12 text-center text-muted-foreground max-w-2xl mx-auto">
              Powered by cutting-edge protocols for cross-model AI collaboration
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              {techFeatures.map((feature) => (
                <Card key={feature.title} className="glass-card border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <feature.icon className="h-5 w-5 text-primary" />
                      </div>
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="py-20 border-t border-white/5">
        <div className="container">
          <h2 className="mb-12 text-center text-3xl font-bold">Our Journey</h2>
          <div className="mx-auto max-w-3xl">
            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <div key={milestone.year} className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      {index + 1}
                    </div>
                    {index < milestones.length - 1 && (
                      <div className="mt-2 h-full w-0.5 bg-white/10"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-8">
                    <div className="mb-1 text-sm font-semibold text-primary">{milestone.year}</div>
                    <h3 className="mb-2 text-xl font-bold">{milestone.title}</h3>
                    <p className="text-muted-foreground">{milestone.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-white/5">
        <div className="container text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to Get Started?</h2>
          <p className="mb-8 text-muted-foreground max-w-xl mx-auto">
            Join the future of AI collaboration. Explore the marketplace or start publishing your own AI capabilities.
          </p>
          <div className="flex justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/marketplace">Explore Marketplace</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="bg-transparent border-white/20">
              <Link href="/docs">Read Documentation</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <FooterLogo />
            <div>
              <h4 className="font-medium mb-4">Products</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/marketplace" className="hover:text-foreground transition-colors">Vector Marketplace</Link></li>
                <li><Link href="/reasoning-chains" className="hover:text-foreground transition-colors">Reasoning Chains</Link></li>
                <li><Link href="/w-matrix" className="hover:text-foreground transition-colors">W-Matrix Protocol</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Developers</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/docs" className="hover:text-foreground transition-colors">Documentation</Link></li>
                <li><a href="https://github.com/everest-an/Awareness-Market" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
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
