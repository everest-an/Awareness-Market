import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import { 
  Search, 
  SlidersHorizontal, 
  Star, 
  TrendingUp, 
  DollarSign,
  Brain,
  ChevronRight,
  Filter,
  Zap,
  Network,
  Cpu,
  GitBranch
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const REASONING_CATEGORIES = [
  "math",
  "coding",
  "analysis",
  "research",
  "creative",
  "logic",
  "science",
  "business",
];

const MODEL_FAMILIES = [
  { label: "OpenAI GPT", models: ["gpt-4", "gpt-4-turbo", "gpt-4o", "o1", "o1-mini"] },
  { label: "Anthropic Claude", models: ["claude-3-opus", "claude-3-sonnet", "claude-3.5-sonnet"] },
  { label: "Meta LLaMA", models: ["llama-3-8b", "llama-3-70b", "llama-3.1-8b", "llama-3.1-70b"] },
  { label: "Alibaba Qwen", models: ["qwen-2-7b", "qwen-2-72b", "qwen-2.5-7b", "qwen-2.5-72b"] },
  { label: "DeepSeek", models: ["deepseek-v2", "deepseek-v2.5", "deepseek-v3", "deepseek-coder-33b"] },
  { label: "Google Gemini", models: ["gemini-pro", "gemini-1.5-pro", "gemini-1.5-flash"] },
  { label: "Mistral", models: ["mistral-7b", "mixtral-8x7b", "mistral-large"] },
];

export default function ReasoningChainMarket() {
  const { isAuthenticated, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedModel, setSelectedModel] = useState<string | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [page, setPage] = useState(0);
  const [selectedChain, setSelectedChain] = useState<any>(null);
  const [targetModel, setTargetModel] = useState<string>("gpt-4");
  const ITEMS_PER_PAGE = 12;

  // Fetch reasoning chains
  const { data: chainsData, isLoading, refetch } = trpc.reasoningChains.browse.useQuery({
    category: selectedCategory,
    sourceModel: selectedModel,
    maxPrice,
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
  });

  // Use reasoning chain mutation
  const useChainMutation = trpc.reasoningChains.use.useMutation({
    onSuccess: (data) => {
      toast.success("Reasoning chain applied successfully!", {
        description: `Alignment quality: ${(data.alignedKVCache.alignmentQuality.cosineSimilarity * 100).toFixed(1)}%`,
      });
      setSelectedChain(null);
    },
    onError: (error) => {
      toast.error("Failed to use reasoning chain", {
        description: error.message,
      });
    },
  });

  const handleUseChain = (chain: any) => {
    if (!isAuthenticated) {
      toast.error("Please login to use reasoning chains");
      return;
    }
    setSelectedChain(chain);
  };

  const confirmUseChain = () => {
    if (selectedChain) {
      useChainMutation.mutate({
        chainId: selectedChain.id,
        targetModel,
      });
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCategory(undefined);
    setSelectedModel(undefined);
    setMaxPrice(undefined);
    setPage(0);
  };

  const FilterPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 font-semibold">Category</h3>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {REASONING_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 font-semibold">Source Model</h3>
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger>
            <SelectValue placeholder="All Models" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Models</SelectItem>
            {MODEL_FAMILIES.map((family) => (
              <div key={family.label}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {family.label}
                </div>
                {family.models.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 font-semibold">Max Price</h3>
        <Select 
          value={maxPrice?.toString()} 
          onValueChange={(value) => setMaxPrice(value === "all" ? undefined : parseFloat(value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any Price" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Price</SelectItem>
            <SelectItem value="1">Under $1</SelectItem>
            <SelectItem value="5">Under $5</SelectItem>
            <SelectItem value="10">Under $10</SelectItem>
            <SelectItem value="50">Under $50</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <Button variant="outline" className="w-full" onClick={resetFilters}>
        Reset Filters
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />
      
      {/* Header */}
      <div className="border-b bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10 pt-16">
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
              <GitBranch className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold">Reasoning Chain Market</h1>
            <Badge variant="secondary" className="ml-2">V2.0</Badge>
          </div>
          <p className="text-lg text-muted-foreground">
            Trade AI reasoning processes directly. Skip the thinking, get the results.
          </p>
          <div className="mt-4 flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span>KV-Cache Exchange</span>
            </div>
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-blue-500" />
              <span>W-Matrix Alignment</span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-green-500" />
              <span>60+ Models Supported</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Desktop Filters Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-6 rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Filters</h2>
                <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
              </div>
              <Separator />
              <FilterPanel />
            </div>
          </aside>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search reasoning chains..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Mobile Filter Button */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden">
                    <Filter className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>
                      Filter reasoning chains by category and model
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterPanel />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Results Count */}
            {chainsData && (
              <div className="text-sm text-muted-foreground">
                Found {chainsData.total} reasoning chains
              </div>
            )}

            {/* Chain Grid */}
            {isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : chainsData && chainsData.chains.length > 0 ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {chainsData.chains.map((chain: any) => (
                    <Card key={chain.id} className="group transition-all hover:shadow-lg border-l-4 border-l-purple-500">
                      <CardHeader>
                        <div className="mb-2 flex items-start justify-between">
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                            {chain.category}
                          </Badge>
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">
                              {parseFloat(chain.avgQuality || "0").toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <CardTitle className="line-clamp-1">{chain.chainName}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {chain.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Brain className="h-4 w-4" />
                            <span>{chain.sourceModel}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <GitBranch className="h-4 w-4" />
                            <span>{chain.stepCount || "?"} reasoning steps</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingUp className="h-4 w-4" />
                            <span>{chain.usageCount} uses</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-5 w-5 text-primary" />
                          <span className="text-2xl font-bold">
                            {parseFloat(chain.pricePerUse).toFixed(2)}
                          </span>
                          <span className="text-sm text-muted-foreground">/use</span>
                        </div>
                        <Button 
                          size="sm" 
                          className="group-hover:gap-2"
                          onClick={() => handleUseChain(chain)}
                        >
                          Use Chain
                          <ChevronRight className="h-4 w-4 transition-all group-hover:translate-x-1" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {chainsData.chains.length === ITEMS_PER_PAGE && (
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={chainsData.chains.length < ITEMS_PER_PAGE}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Card className="p-12">
                <div className="text-center">
                  <GitBranch className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold">No reasoning chains found</h3>
                  <p className="mb-4 text-muted-foreground">
                    Be the first to publish a reasoning chain!
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={resetFilters} variant="outline">Reset Filters</Button>
                    <Button asChild>
                      <Link href="/creator/publish">Publish Chain</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Use Chain Dialog */}
      <Dialog open={!!selectedChain} onOpenChange={() => setSelectedChain(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use Reasoning Chain</DialogTitle>
            <DialogDescription>
              Select your target model to align the reasoning chain
            </DialogDescription>
          </DialogHeader>
          {selectedChain && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold">{selectedChain.chainName}</h4>
                <p className="text-sm text-muted-foreground mt-1">{selectedChain.description}</p>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span>Source: {selectedChain.sourceModel}</span>
                  <span>Price: ${parseFloat(selectedChain.pricePerUse).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Target Model</label>
                <Select value={targetModel} onValueChange={setTargetModel}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_FAMILIES.map((family) => (
                      <div key={family.label}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {family.label}
                        </div>
                        {family.models.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelectedChain(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={confirmUseChain}
                  disabled={useChainMutation.isPending}
                >
                  {useChainMutation.isPending ? "Processing..." : "Confirm & Pay"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
