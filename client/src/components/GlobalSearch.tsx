import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, Filter, Package, Brain, GitBranch } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const PACKAGE_TYPE_ICONS = {
  vector: Package,
  memory: Brain,
  chain: GitBranch,
};

const PACKAGE_TYPE_LABELS = {
  vector: "Vector Package",
  memory: "Memory Package",
  chain: "Reasoning Chain",
};

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [packageTypes, setPackageTypes] = useState<string[]>([]);
  const [sourceModel, setSourceModel] = useState<string>("");
  const [targetModel, setTargetModel] = useState<string>("");
  const [category, setCategory] = useState<string>("all");
  const [epsilonRange, setEpsilonRange] = useState<[number, number]>([0, 1]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Search query
  const { data: searchResults, isLoading } = trpc.packages.globalSearch.useQuery(
    {
      query: debouncedQuery || undefined,
      packageTypes: packageTypes.length > 0 ? packageTypes as any : undefined,
      sourceModel: sourceModel || undefined,
      targetModel: targetModel || undefined,
      category: category && category !== "all" ? category : undefined,
      minEpsilon: epsilonRange[0],
      maxEpsilon: epsilonRange[1],
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
      limit: 20,
    },
    {
      enabled: isOpen && (debouncedQuery.length > 0 || packageTypes.length > 0 || !!sourceModel || !!targetModel || !!category),
    }
  );

  // Focus input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset filters
  const resetFilters = useCallback(() => {
    setPackageTypes([]);
    setSourceModel("");
    setTargetModel("");
    setCategory("all");
    setEpsilonRange([0, 1]);
    setPriceRange([0, 1000]);
  }, []);

  // Handle package click
  const handlePackageClick = (type: string, packageId: string) => {
    setLocation(`/package/${type}/${packageId}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Search Modal */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-3xl z-50 px-4">
        <Card className="bg-background border-border shadow-2xl">
          {/* Search Bar */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search packages by name, model, or category..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters && "bg-accent")}
            >
              <Filter className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="p-4 border-b border-border space-y-4 bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Package Type */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Package Type</label>
                  <div className="flex gap-2">
                    {["vector", "memory", "chain"].map((type) => (
                      <Button
                        key={type}
                        variant={packageTypes.includes(type) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setPackageTypes((prev) =>
                            prev.includes(type)
                              ? prev.filter((t) => t !== type)
                              : [...prev, type]
                          );
                        }}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="nlp">NLP</SelectItem>
                      <SelectItem value="vision">Vision</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                      <SelectItem value="multimodal">Multimodal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Source Model */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Source Model</label>
                  <Input
                    type="text"
                    placeholder="e.g., gpt-4"
                    value={sourceModel}
                    onChange={(e) => setSourceModel(e.target.value)}
                  />
                </div>

                {/* Target Model */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Target Model</label>
                  <Input
                    type="text"
                    placeholder="e.g., claude-3"
                    value={targetModel}
                    onChange={(e) => setTargetModel(e.target.value)}
                  />
                </div>
              </div>

              {/* Epsilon Range */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Epsilon Range: {epsilonRange[0].toFixed(2)} - {epsilonRange[1].toFixed(2)}
                </label>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={epsilonRange}
                  onValueChange={(value) => setEpsilonRange(value as [number, number])}
                  className="w-full"
                />
              </div>

              {/* Price Range */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Price Range: ${priceRange[0]} - ${priceRange[1]}
                </label>
                <Slider
                  min={0}
                  max={1000}
                  step={10}
                  value={priceRange}
                  onValueChange={(value) => setPriceRange(value as [number, number])}
                  className="w-full"
                />
              </div>

              {/* Reset Button */}
              <Button variant="outline" size="sm" onClick={resetFilters} className="w-full">
                Reset Filters
              </Button>
            </div>
          )}

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading && (
              <div className="p-8 text-center text-muted-foreground">
                Searching...
              </div>
            )}

            {!isLoading && searchResults && searchResults.results.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No packages found. Try adjusting your filters.
              </div>
            )}

            {!isLoading && searchResults && searchResults.results.length > 0 && (
              <div className="divide-y divide-border">
                {searchResults.results.map((result) => {
                  const Icon = PACKAGE_TYPE_ICONS[result.type];
                  const typeLabel = PACKAGE_TYPE_LABELS[result.type];
                  const pkg = result.package;

                  return (
                    <button
                      key={`${result.type}-${pkg.packageId}`}
                      onClick={() => handlePackageClick(result.type, pkg.packageId)}
                      className="w-full p-4 hover:bg-accent/50 transition-colors text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate">
                              {pkg.name}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {typeLabel}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {pkg.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{pkg.sourceModel} â†?{pkg.targetModel}</span>
                            <span>Îµ: {(pkg.epsilon * 100).toFixed(1)}%</span>
                            <span className="font-semibold text-primary">${pkg.price}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border bg-muted/30 text-xs text-muted-foreground text-center">
            Press <kbd className="px-2 py-1 bg-background border border-border rounded">ESC</kbd> to close
          </div>
        </Card>
      </div>
    </>
  );
}
