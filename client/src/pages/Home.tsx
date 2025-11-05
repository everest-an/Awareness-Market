import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Users, Check, ArrowRight, Camera, FileText, UserPlus } from "lucide-react";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Home page - Landing page matching official website design
 * Pure black background, pink-purple gradient buttons, modern tech aesthetic
 */
export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
            <span className="text-xl font-bold">{APP_TITLE}</span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => window.open("https://github.com/everest-an/Awareness-Network", "_blank")}
            >
              查看演示
            </Button>
            <Button
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
              onClick={() => window.location.href = getLoginUrl()}
            >
              开始使用
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container max-w-5xl mx-auto text-center">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 tracking-tight">
            {APP_TITLE}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12">
            AI-powered knowledge graph and social network platform
          </p>

          {/* Main Feature Cards */}
          <div className="grid md:grid-cols-2 gap-6 mt-16">
            {/* Knowledge Graph Card */}
            <Card className="bg-card border-border hover:border-primary/50 transition-all duration-300 group">
              <CardHeader className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Knowledge Graph</CardTitle>
                <CardDescription className="text-base">
                  Visualize connections between people, places, and events.
                  Use natural language to search your memories.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity group-hover:shadow-lg group-hover:shadow-primary/50"
                  onClick={() => window.location.href = getLoginUrl()}
                >
                  Explore Knowledge Graph
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Social Network Card */}
            <Card className="bg-card border-border hover:border-secondary/50 transition-all duration-300 group">
              <CardHeader className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary/20 to-primary/20 flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8 text-secondary" />
                </div>
                <CardTitle className="text-2xl">Social Network</CardTitle>
                <CardDescription className="text-base">
                  Track interactions with contacts, analyze company
                  information, and maintain meaningful relationships.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full bg-gradient-to-r from-secondary to-primary hover:opacity-90 transition-opacity group-hover:shadow-lg group-hover:shadow-secondary/50"
                  onClick={() => window.location.href = getLoginUrl()}
                >
                  View Network
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-20 px-4">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Key Features</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <Card className="bg-card border-border p-6">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Check className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Natural Language Search</h3>
                  <p className="text-muted-foreground">
                    Search using everyday language like "photos from Paris 2023"
                  </p>
                </div>
              </div>
            </Card>

            {/* Feature 2 */}
            <Card className="bg-card border-border p-6">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Check className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Relationship Visualization</h3>
                  <p className="text-muted-foreground">
                    See connection strength through visual line thickness
                  </p>
                </div>
              </div>
            </Card>

            {/* Feature 3 */}
            <Card className="bg-card border-border p-6">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Check className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Contact Frequency Analysis</h3>
                  <p className="text-muted-foreground">
                    Track how often you interact with each contact
                  </p>
                </div>
              </div>
            </Card>

            {/* Feature 4 */}
            <Card className="bg-card border-border p-6">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Check className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Company Insights</h3>
                  <p className="text-muted-foreground">
                    Analyze industry types and business information
                  </p>
                </div>
              </div>
            </Card>

            {/* Feature 5 */}
            <Card className="bg-card border-border p-6">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Check className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">OCR & AI Document Generation</h3>
                  <p className="text-muted-foreground">
                    Automatically extract text and generate knowledge documents
                  </p>
                </div>
              </div>
            </Card>

            {/* Feature 6 */}
            <Card className="bg-card border-border p-6">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Check className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Distributed Storage</h3>
                  <p className="text-muted-foreground">
                    IPFS and Arweave support for privacy and permanence
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-card/30">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">How It Works</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
                <Camera className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">1. Capture</h3>
              <p className="text-muted-foreground">
                Take photos of documents, business cards, or any information you want to remember
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">2. Process</h3>
              <p className="text-muted-foreground">
                AI automatically extracts text, generates documents, and enriches with company information
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
                <UserPlus className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">3. Connect</h3>
              <p className="text-muted-foreground">
                Build your knowledge graph and maintain meaningful relationships with contacts
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Start Building Your Knowledge Network
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of users who are organizing their knowledge and relationships with AI
          </p>
          <Button
            size="lg"
            className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity shadow-lg shadow-primary/50"
            onClick={() => window.location.href = getLoginUrl()}
          >
            Get Started for Free
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            15-day free trial • No credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container text-center text-sm text-muted-foreground">
          © 2025 {APP_TITLE}. Built with React, tRPC, and Tailwind CSS.
        </div>
      </footer>
    </div>
  );
}
