import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { Search, Calendar, Eye, ArrowRight, ExternalLink } from "lucide-react";

// Featured external articles (Medium, etc.)
const externalArticles = [
  {
    id: "medium-1",
    title: "Awareness: A Decentralized Protocol for Cross-Model Latent Memory Exchange via Standardized W-Matrix Alignment",
    excerpt: "Introducing the Awareness protocol - a groundbreaking approach to enable direct mind-to-mind collaboration between AI agents through standardized W-Matrix alignment operators.",
    url: "https://medium.com/@an_15429/awareness-a-decentralized-protocol-for-cross-model-latent-memory-exchange-via-standardized-15b00f2fc4de",
    source: "Medium",
    publishedAt: "2025-01-02",
    coverImage: null,
    tags: ["Protocol", "W-Matrix", "AI Collaboration"],
    featured: true,
  },
  {
    id: "medium-2",
    title: "LatentMAS and the Evolution of Agent Communication: Technical Mechanisms, Protocol Ecosystem, and Trillion-Dollar Agent Economy Research",
    excerpt: "How LatentMAS solves the efficiency and expressiveness challenges of traditional text communication through direct latent space interaction. Using training-free linear alignment matrices to achieve lossless transmission of cognitive states between agents, improving inference speed by several times and reducing token consumption by over 80%.",
    url: "https://medium.com/@an_15429/latentmas%E4%B8%8E%E6%99%BA%E8%83%BD%E4%BD%93%E9%80%9A%E4%BF%A1%E7%9A%84%E6%BC%94%E8%BF%9B-%E6%8A%80%E6%9C%AF%E6%9C%BA%E5%88%B6-%E5%8D%8F%E8%AE%AE%E7%94%9F%E6%80%81%E4%B8%8E%E4%B8%87%E4%BA%BF%E7%BA%A7%E4%BB%A3%E7%90%86%E7%BB%8F%E6%B5%8E%E5%B8%82%E5%9C%BA%E6%B7%B1%E5%BA%A6%E7%A0%94%E7%A9%B6-fedf860bbb8a",
    source: "Medium",
    publishedAt: "2025-12-28",
    coverImage: null,
    tags: ["LatentMAS", "Agent Economy", "Protocol Research", "Deep Research"],
    featured: false,
  },
  {
    id: "medium-3",
    title: "What is the Medium of Communication in LatentMAS?",
    excerpt: "The core breakthrough of LatentMAS lies in abandoning traditional text and using high-dimensional tensors as the communication medium. Latent Thoughts and Shared KV Cache enable direct mind-to-mind collaboration between AI agents.",
    url: "https://medium.com/@an_15429/what-is-the-medium-of-communication-in-latentmas-8c5f517b5d53",
    source: "Medium",
    publishedAt: "2026-01-03",
    coverImage: null,
    tags: ["LatentMAS", "KV Cache", "Latent Space", "AI Communication"],
    featured: false,
  },
  {
    id: "medium-4",
    title: "What is the Communication Medium of LatentMAS? (Chinese)",
    excerpt: "The core breakthrough of LatentMAS lies in abandoning traditional text as a carrier and using high-dimensional tensors as the communication medium. Latent thoughts and shared working memory (KV Cache) enable direct mind-to-mind collaboration between AI agents.",
    url: "https://medium.com/@an_15429/latentmas-%E7%9A%84%E8%BD%BD%E4%BD%93%E6%98%AF%E4%BB%80%E4%B9%88-7608fb13c76f",
    source: "Medium",
    publishedAt: "2025-12-28",
    coverImage: null,
    tags: ["LatentMAS", "Latent Space", "KV Cache", "Agent Economy"],
    featured: false,
  },
];

export default function Blog() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  const { data: posts, isLoading } = trpc.blog.list.useQuery({
    status: "published",
    category: selectedCategory,
    search: search || undefined,
    limit: 20,
  });

  const { data: categories } = trpc.blog.getCategories.useQuery();

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const parseTags = (tags: string | null): string[] => {
    if (!tags) return [];
    try {
      return JSON.parse(tags);
    } catch {
      return [];
    }
  };

  // Combine external articles with database posts
  const allPosts = [
    ...externalArticles.map(article => ({
      ...article,
      isExternal: true,
    })),
    ...(posts || []).map(post => ({
      ...post,
      isExternal: false,
    })),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="pt-24 pb-16 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.65_0.20_230_/_0.15),transparent_50%)]" />
        <div className="container relative z-10 text-center">
          <Badge className="mb-6 px-3 py-1 text-xs font-medium bg-white/5 border-white/10 text-muted-foreground">
            Insights & Updates
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Awareness <span className="gradient-text">Blog</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Insights on AI capabilities, latent space vectors, W-Matrix protocol, and the future of AI collaboration
          </p>
        </div>
      </section>

      {/* Search and Filter */}
      <section className="py-8 border-b border-white/5">
        <div className="container">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-white/5 border-white/10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={!selectedCategory ? "default" : "outline"}
                onClick={() => setSelectedCategory(undefined)}
                size="sm"
              >
                All
              </Button>
              {categories?.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  onClick={() => setSelectedCategory(cat)}
                  size="sm"
                  className={selectedCategory !== cat ? "bg-transparent border-white/20" : ""}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Article */}
      {externalArticles.filter(a => a.featured).map((article) => (
        <section key={article.id} className="py-12">
          <div className="container">
            <h2 className="text-sm font-medium text-muted-foreground mb-6 uppercase tracking-wider">Featured Article</h2>
            <a 
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <div className="glass-card-hover p-8 md:p-12">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary">
                    {article.source}
                  </Badge>
                  <span>•</span>
                  <Calendar className="h-4 w-4" />
                  {formatDate(article.publishedAt)}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-4 group-hover:text-primary transition-colors">
                  {article.title}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-3xl">
                  {article.excerpt}
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {article.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="bg-white/5">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-primary font-medium">
                  Read on {article.source}
                  <ExternalLink className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </a>
          </div>
        </section>
      ))}

      {/* Blog Posts Grid */}
      <section className="py-12">
        <div className="container">
          <h2 className="text-sm font-medium text-muted-foreground mb-6 uppercase tracking-wider">All Articles</h2>
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="animate-pulse bg-white/5 border-white/10">
                  <div className="h-48 bg-white/10" />
                  <CardHeader>
                    <div className="h-6 bg-white/10 rounded mb-2" />
                    <div className="h-4 bg-white/10 rounded w-2/3" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : allPosts && allPosts.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allPosts.filter(p => !(p as any).featured).map((post: any) => (
                <Card key={post.id} className="glass-card-hover group border-white/10">
                  {post.coverImage && (
                    <div className="h-48 overflow-hidden">
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      {post.isExternal && (
                        <Badge variant="outline" className="text-xs bg-primary/10 border-primary/20 text-primary">
                          {post.source}
                        </Badge>
                      )}
                      <Calendar className="h-4 w-4" />
                      {formatDate(post.publishedAt)}
                      {!post.isExternal && (
                        <>
                          <span className="mx-2">•</span>
                          <Eye className="h-4 w-4" />
                          {post.viewCount} views
                        </>
                      )}
                    </div>
                    <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </CardTitle>
                    {post.excerpt && (
                      <CardDescription className="line-clamp-3 mt-2">
                        {post.excerpt}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {(post.isExternal ? post.tags : parseTags(post.tags)).slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="bg-white/5">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    {post.isExternal ? (
                      <a 
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
                      >
                        Read on {post.source} <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <Link href={`/blog/${post.slug}`} className="flex items-center gap-2 text-primary hover:text-primary/80 font-medium">
                        Read More <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No articles found</p>
              <p className="text-sm text-muted-foreground mt-2">Check back soon for new content!</p>
            </div>
          )}
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
