import SEO from "@/components/SEO";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from '@/hooks/useAuth';
import { RecommendationCard } from "@/components/RecommendationCard";
import Navbar from "@/components/Navbar";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { 
  Search, 
  SlidersHorizontal, 
  Star, 
  TrendingUp, 
  DollarSign,
  Brain,
  ChevronRight,
  Filter
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type SortOption = "newest" | "oldest" | "price_low" | "price_high" | "rating" | "popular";

export default function Marketplace() {
  const { isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [minRating, setMinRating] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 12;

  // Fetch categories
  const { data: categories } = trpc.vectors.getCategories.useQuery();

  // Fetch AI recommendations if user is authenticated
  const { data: recommendations } = trpc.recommendations.getRecommendations.useQuery(
    { limit: 3 },
    { enabled: isAuthenticated }
  );

  // Fetch vectors with filters
  const { data: vectors, isLoading } = trpc.vectors.search.useQuery({
    searchTerm: searchTerm || undefined,
    category: selectedCategory,
    minPrice: priceRange[0],
    maxPrice: priceRange[1],
    minRating,
    sortBy,
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCategory(undefined);
    setPriceRange([0, 1000]);
    setMinRating(undefined);
    setSortBy("newest");
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
            {categories?.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 font-semibold">Price Range</h3>
        <div className="space-y-4">
          <Slider
            value={priceRange}
            onValueChange={(value) => setPriceRange(value as [number, number])}
            min={0}
            max={1000}
            step={10}
            className="w-full"
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>${priceRange[0]}</span>
            <span>${priceRange[1]}</span>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-3 font-semibold">Minimum Rating</h3>
        <Select 
          value={minRating?.toString()} 
          onValueChange={(value) => setMinRating(value === "all" ? undefined : parseFloat(value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Rating</SelectItem>
            <SelectItem value="4">4+ Stars</SelectItem>
            <SelectItem value="3">3+ Stars</SelectItem>
            <SelectItem value="2">2+ Stars</SelectItem>
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
    <div className="min-h-screen bg-[#0a0a0f]">
      <SEO
        title="AI Marketplace"
        description="Browse and trade AI capability vectors, memory packages, and reasoning chains. Find latent space vectors for sentiment analysis, code generation, creative writing, and more across 60+ AI models."
        path="/marketplace"
      />
      {/* Navbar */}
      <Navbar />

      {/* Header */}
      <div className="pt-20 border-b border-white/5 bg-muted/10">
        <div className="container py-8">
          <h1 className="mb-2 text-4xl font-bold">AI Capability <span className="gradient-text">Marketplace</span></h1>
          <p className="text-lg text-muted-foreground">
            Discover and integrate cutting-edge AI capabilities powered by Awareness Protocol
          </p>
        </div>
      </div>

      <div className="container py-8">
        {/* AI Recommendations Section */}
        {isAuthenticated && recommendations && recommendations.length > 0 && (
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Recommended for You
              </h2>
              <p className="text-muted-foreground mt-1">
                AI-powered suggestions based on your browsing history and preferences
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((rec: any) => (
                <RecommendationCard key={rec.vectorId} recommendation={rec} />
              ))}
            </div>
            <div className="mt-6 border-t" />
          </div>
        )}

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
            {/* Search and Sort Bar */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <form onSubmit={handleSearch} className="flex flex-1 gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search AI capabilities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button type="submit">Search</Button>
              </form>

              <div className="flex gap-2">
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
                        Refine your search with advanced filters
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6">
                      <FilterPanel />
                    </div>
                  </SheetContent>
                </Sheet>

                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="price_low">Price: Low to High</SelectItem>
                    <SelectItem value="price_high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Count */}
            {vectors && (
              <div className="text-sm text-muted-foreground">
                Found {vectors.length} AI capabilities
              </div>
            )}

            {/* Vector Grid */}
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
            ) : vectors && vectors.length > 0 ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {vectors.map((vector) => (
                    <Card key={vector.id} className="group transition-all hover:shadow-lg">
                      <CardHeader>
                        <div className="mb-2 flex items-start justify-between">
                          <Badge variant="secondary">{vector.category}</Badge>
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">
                              {parseFloat((vector.averageRating || "0").toString()).toFixed(1)}
                            </span>
                            <span className="text-muted-foreground">
                              ({vector.reviewCount})
                            </span>
                          </div>
                        </div>
                        <CardTitle className="line-clamp-1">{vector.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {vector.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {vector.modelArchitecture && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Brain className="h-4 w-4" />
                              <span>{vector.modelArchitecture}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingUp className="h-4 w-4" />
                            <span>{vector.totalCalls} calls</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-5 w-5 text-primary" />
                          <span className="text-2xl font-bold">
                            {parseFloat(vector.basePrice.toString()).toFixed(2)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            /{vector.pricingModel === "per-call" ? "call" : "month"}
                          </span>
                        </div>
                        <Button asChild size="sm" className="group-hover:gap-2">
                          <Link href={`/marketplace/${vector.id}`}>
                            View
                            <ChevronRight className="h-4 w-4 transition-all group-hover:translate-x-1" />
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {vectors.length === ITEMS_PER_PAGE && (
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
                      disabled={vectors.length < ITEMS_PER_PAGE}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Card className="p-12">
                <div className="text-center">
                  <Brain className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold">No AI capabilities found</h3>
                  <p className="mb-4 text-muted-foreground">
                    Try adjusting your filters or search terms
                  </p>
                  <Button onClick={resetFilters}>Reset Filters</Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
