import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from '@/hooks/useAuth';
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/GlobalSearch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu,
  X,
  ChevronDown,
  Brain,
  Network,
  Cpu,
  FileCode,
  BookOpen,
  User,
  Users,
  LogOut,
  LayoutDashboard,
  Key,
  Upload,
  Settings,
  Server,
  Rocket,
  BarChart3,
  Code,
  Github,
  Search,
  History
} from "lucide-react";

const navLinks = [
  {
    label: "Products",
    children: [
      { label: "Vector Packages", href: "/marketplace", icon: Brain, description: "Trade AI capabilities" },
      { label: "Memory Packages", href: "/memory-marketplace", icon: Cpu, description: "Transfer reasoning states" },
      { label: "Reasoning Chains", href: "/reasoning-chains", icon: Network, description: "Share solution processes" },
      { label: "AI Agents", href: "/agents", icon: Rocket, description: "ERC-8004 agent registry" },
    ]
  },
  {
    label: "Tools",
    children: [
      { label: "AI Collaboration", href: "/ai-collaboration", icon: Users, description: "Manus + Claude teamwork", featured: true },
      { label: "Hive Mind", href: "/hive-mind", icon: Network, description: "3D network visualization" },
      { label: "Latent Test", href: "/latent-test", icon: Cpu, description: "LatentMAS workflow testing" },
      { label: "Workflow History", href: "/workflow-history", icon: History, description: "Browse and replay workflows" },
      { label: "Performance Dashboard", href: "/workflow-performance", icon: BarChart3, description: "Analyze workflow performance" },
      { label: "Neural Cortex", href: "/neural-cortex", icon: Brain, description: "AI neural network visualizer" },
      { label: "API Keys", href: "/api-keys", icon: Key, description: "Manage API access" },
      { label: "Agent Login", href: "/auth/agent", icon: Server, description: "AI agent authentication" },
    ]
  },
  {
    label: "Resources",
    children: [
      { label: "Documentation", href: "/docs", icon: FileCode, description: "API & SDK guides" },
      { label: "AI Collaboration", href: "/docs/collaboration", icon: Network, description: "Manus + Claude MCP Guide" },
      { label: "Python SDK", href: "/sdk", icon: Code, description: "Python integration" },
      { label: "MCP Integration", href: "/sdk#mcp", icon: Cpu, description: "Model Context Protocol" },
      { label: "GitHub", href: "https://github.com/everest-an/Awareness-Market", icon: Github, description: "View source code", external: true },
      { label: "Blog", href: "/blog", icon: BookOpen, description: "Latest updates" },
    ]
  },
  { label: "About", href: "/about" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Ctrl+K / Cmd+K shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="container">
        <div className="flex h-16 items-center justify-between">
          {/* Logo - Blue Gradient Ring */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative w-9 h-9">
              {/* Outer gradient ring */}
              <div 
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'conic-gradient(from 180deg, #0ea5e9, #06b6d4, #22d3ee, #67e8f9, #22d3ee, #06b6d4, #0ea5e9)',
                  padding: '2px',
                }}
              >
                <div className="w-full h-full rounded-full bg-background" />
              </div>
              {/* Inner subtle glow */}
              <div 
                className="absolute inset-[3px] rounded-full opacity-20"
                style={{
                  background: 'radial-gradient(circle, #22d3ee 0%, transparent 70%)',
                }}
              />
            </div>
            <span className="font-semibold text-lg tracking-tight">Awareness</span>
            {/* Dynamic page title based on route */}
            {location === '/neural-cortex' && (
              <>
                <span className="text-white/30 mx-1">/</span>
                <span className="text-cyan-400 font-medium">Neural Cortex</span>
              </>
            )}
            {location === '/marketplace' && (
              <>
                <span className="text-white/30 mx-1">/</span>
                <span className="text-cyan-400 font-medium">Vector Packages</span>
              </>
            )}
            {location === '/memory-marketplace' && (
              <>
                <span className="text-white/30 mx-1">/</span>
                <span className="text-cyan-400 font-medium">Memory Packages</span>
              </>
            )}
            {location === '/reasoning-chains' && (
              <>
                <span className="text-white/30 mx-1">/</span>
                <span className="text-cyan-400 font-medium">Reasoning Chains</span>
              </>
            )}
            {(location === '/hive-mind' || location === '/network') && (
              <>
                <span className="text-white/30 mx-1">/</span>
                <span className="text-cyan-400 font-medium">Hive Mind</span>
              </>
            )}
            {location === '/latent-test' && (
              <>
                <span className="text-white/30 mx-1">/</span>
                <span className="text-cyan-400 font-medium">Latent Test</span>
              </>
            )}
            {location === '/workflow-history' && (
              <>
                <span className="text-white/30 mx-1">/</span>
                <span className="text-cyan-400 font-medium">Workflow History</span>
              </>
            )}
            {location === '/workflow-performance' && (
              <>
                <span className="text-white/30 mx-1">/</span>
                <span className="text-cyan-400 font-medium">Performance</span>
              </>
            )}
            {location === '/dashboard' && (
              <>
                <span className="text-white/30 mx-1">/</span>
                <span className="text-cyan-400 font-medium">Dashboard</span>
              </>
            )}
            {location === '/docs' && (
              <>
                <span className="text-white/30 mx-1">/</span>
                <span className="text-cyan-400 font-medium">Documentation</span>
              </>
            )}
            {location === '/api-keys' && (
              <>
                <span className="text-white/30 mx-1">/</span>
                <span className="text-cyan-400 font-medium">API Keys</span>
              </>
            )}
          </Link>

          {/* Search Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-muted-foreground"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
            <kbd className="hidden lg:inline-block px-2 py-0.5 text-xs bg-white/10 rounded border border-white/20">
              ⌘K
            </kbd>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              link.children ? (
                <DropdownMenu key={link.label}>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 bg-card/95 backdrop-blur-xl border-white/10">
                    {link.children.map((child) => (
                      <DropdownMenuItem key={child.href} asChild>
                        {(child as any).external ? (
                          <a href={child.href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-3 cursor-pointer">
                            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <child.icon className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{child.label}</div>
                              <div className="text-xs text-muted-foreground">{child.description}</div>
                            </div>
                          </a>
                        ) : (
                          <Link href={child.href} className="flex items-start gap-3 p-3 cursor-pointer">
                            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <child.icon className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{child.label}</div>
                              <div className="text-xs text-muted-foreground">{child.description}</div>
                            </div>
                          </Link>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  key={link.label}
                  href={link.href!}
                  className={`px-3 py-2 text-sm transition-colors ${
                    location === link.href
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              )
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* AI Collaboration CTA Button */}
            <Link href="/ai-collaboration/new">
              <Button
                size="sm"
                className="hidden md:flex bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-0"
              >
                <Users className="w-4 h-4 mr-1.5" />
                AI Collab
              </Button>
            </Link>

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <span className="text-xs font-medium text-white">
                        {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-white/10">
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/api-keys" className="flex items-center gap-2 cursor-pointer">
                      <Key className="w-4 h-4" />
                      API Keys
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/usage-analytics" className="flex items-center gap-2 cursor-pointer">
                      <BarChart3 className="w-4 h-4" />
                      Usage Analytics
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem asChild>
                    <Link href="/upload-vector-package" className="flex items-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Upload Vector Package
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/upload-memory-package" className="flex items-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Upload Memory Package
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/upload-chain-package" className="flex items-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Upload Chain Package
                    </Link>
                  </DropdownMenuItem>
                  {user?.role === "admin" && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
                          <Settings className="w-4 h-4" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/service-health" className="flex items-center gap-2 cursor-pointer">
                          <Server className="w-4 h-4" />
                          Service Health
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem 
                    onClick={() => logout()}
                    className="flex items-center gap-2 cursor-pointer text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link
                  href="/auth"
                  className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign In
                </Link>
                <Button asChild size="sm" className="rounded-full px-4">
                  <Link href="/auth">Get Started</Link>
                </Button>
              </>
            )}

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/5">
            <div className="space-y-1">
              {navLinks.map((link) => (
                link.children ? (
                  <div key={link.label} className="space-y-1">
                    <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {link.label}
                    </div>
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-white/5 rounded-lg"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <child.icon className="w-4 h-4 text-primary" />
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href!}
                    className="block px-3 py-2 text-sm text-foreground hover:bg-white/5 rounded-lg"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Global Search Modal */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </nav>
  );
}
