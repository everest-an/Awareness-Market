import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Eye, ArrowLeft, User } from "lucide-react";
import { Streamdown } from "streamdown";
import Navbar from "@/components/Navbar";
import { FooterLogo } from "@/components/Logo";

export default function BlogPost() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "";

  const { data: post, isLoading } = trpc.blog.getBySlug.useQuery({ slug });

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container pt-24 py-12">
          <div className="max-w-4xl mx-auto animate-pulse">
            <div className="h-8 bg-white/10 rounded w-3/4 mb-4" />
            <div className="h-4 bg-white/10 rounded w-1/2 mb-8" />
            <div className="h-64 bg-white/10 rounded mb-8" />
            <div className="space-y-3">
              <div className="h-4 bg-white/10 rounded" />
              <div className="h-4 bg-white/10 rounded" />
              <div className="h-4 bg-white/10 rounded w-5/6" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container pt-24 py-12 text-center">
          <h1 className="text-3xl font-bold mb-4">Article Not Found</h1>
          <p className="text-muted-foreground mb-8">The article you're looking for doesn't exist or has been removed.</p>
          <Link href="/blog">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Article Header */}
      <section className="pt-24 pb-12 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.65_0.20_230_/_0.15),transparent_50%)]" />
        <div className="container relative z-10">
          <div className="max-w-4xl mx-auto">
            <Link href="/blog" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Link>
            
            {post.category && (
              <Badge className="mb-4 bg-primary/10 border-primary/20 text-primary">
                {post.category}
              </Badge>
            )}
            
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              {post.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
              {post.authorId && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Author
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatDate(post.publishedAt)}
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {post.viewCount} views
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {parseTags(post.tags as any).map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-white/5">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Cover Image */}
      {post.coverImage && (
        <section className="pb-12">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full rounded-lg border border-white/10"
              />
            </div>
          </div>
        </section>
      )}

      {/* Article Content */}
      <section className="pb-20">
        <div className="container">
          <article className="max-w-4xl mx-auto prose prose-invert prose-lg">
            <Streamdown>{post.content}</Streamdown>
          </article>
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
