import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Search,
  Loader2,
  FileText,
  Image as ImageIcon,
  Music,
  ArrowRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";

type Modality = 'text' | 'image' | 'audio' | 'video';

export default function CrossModalSearch() {
  const [, setLocation] = useLocation();

  // Search state
  const [queryVector, setQueryVector] = useState('');
  const [queryModality, setQueryModality] = useState<Modality>('text');
  const [targetModality, setTargetModality] = useState<Modality | ''>('');
  const [minSimilarity, setMinSimilarity] = useState(0.7);
  const [limit, setLimit] = useState(10);

  // Results
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchStats, setSearchStats] = useState<any>(null);

  // Search query (using enabled flag to control execution)
  const [searchParams, setSearchParams] = useState<any>(null);
  const searchQuery = trpc.multimodal.crossModalSearch.useQuery(
    searchParams || {
      queryModality: 'text' as const,
      queryVector: [],
      targetModality: 'image' as const,
      limit: 10,
    },
    {
      enabled: !!searchParams,
    }
  );

  // Handle search results
  useEffect(() => {
    if (searchQuery.data) {
      setSearchResults(searchQuery.data.results);
      setSearchStats((searchQuery.data as any).stats || searchQuery.data.info);
      toast.success(`Found ${searchQuery.data.results.length} cross-modal matches!`);
    }
    if (searchQuery.error) {
      toast.error(`Search failed: ${(searchQuery.error as any).message}`);
    }
  }, [searchQuery.data, searchQuery.error]);

  const handleSearch = () => {
    try {
      const vector = JSON.parse(queryVector);
      if (!Array.isArray(vector)) {
        toast.error("Query vector must be a JSON array of numbers");
        return;
      }

      setSearchParams({
        queryVector: vector,
        queryModality,
        targetModality: targetModality || 'image',
        limit,
      });
    } catch (error) {
      toast.error("Invalid JSON format");
    }
  };

  const modalityIcons: Record<Modality, any> = {
    text: FileText,
    image: ImageIcon,
    audio: Music,
    video: Music,
  };

  const modalityColors: Record<Modality, string> = {
    text: 'blue',
    image: 'green',
    audio: 'orange',
    video: 'purple',
  };

  const QueryIcon = modalityIcons[queryModality];
  const TargetIcon = targetModality ? modalityIcons[targetModality as Modality] : Sparkles;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <div className="pt-20 border-b border-white/5">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-purple-500" />
                Cross-Modal <span className="gradient-text">Search</span>
              </h1>
              <p className="text-muted-foreground mt-1">
                Search across modalities - find images with text, audio with images, and more
              </p>
            </div>
            <Button variant="outline" onClick={() => setLocation("/marketplace")}>
              Back to Marketplace
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Search Query</CardTitle>
                <CardDescription>
                  Search with one modality, find in another
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Query Vector (JSON Array)</Label>
                  <Textarea
                    placeholder='[0.1, 0.2, 0.3, ..., 0.768]'
                    value={queryVector}
                    onChange={(e) => setQueryVector(e.target.value)}
                    className="font-mono text-sm min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Query Modality</Label>
                  <Select value={queryModality} onValueChange={(value: Modality) => setQueryModality(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Text
                        </div>
                      </SelectItem>
                      <SelectItem value="image">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Image
                        </div>
                      </SelectItem>
                      <SelectItem value="audio">
                        <div className="flex items-center gap-2">
                          <Music className="h-4 w-4" />
                          Audio
                        </div>
                      </SelectItem>
                      <SelectItem value="video">
                        <div className="flex items-center gap-2">
                          <Music className="h-4 w-4" />
                          Video
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-center py-2">
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                </div>

                <div className="space-y-2">
                  <Label>Target Modality (optional)</Label>
                  <Select value={targetModality} onValueChange={(value) => setTargetModality(value as Modality | '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="All modalities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Modalities</SelectItem>
                      <SelectItem value="text">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Text
                        </div>
                      </SelectItem>
                      <SelectItem value="image">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Image
                        </div>
                      </SelectItem>
                      <SelectItem value="audio">
                        <div className="flex items-center gap-2">
                          <Music className="h-4 w-4" />
                          Audio
                        </div>
                      </SelectItem>
                      <SelectItem value="video">
                        <div className="flex items-center gap-2">
                          <Music className="h-4 w-4" />
                          Video
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Similarity</Label>
                    <Input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={minSimilarity}
                      onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Limit</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={limit}
                      onChange={(e) => setLimit(parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSearch}
                  disabled={searchQuery.isLoading || !queryVector}
                  className="w-full"
                >
                  {searchQuery.isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search Cross-Modal
                    </>
                  )}
                </Button>

                {/* Search Info */}
                {searchStats && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Search Time:</span>
                      <Badge variant="outline">{searchStats.searchTime}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Results:</span>
                      <Badge>{searchStats.resultCount}</Badge>
                    </div>
                    {searchStats.avgSimilarity && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Avg Similarity:</span>
                        <Badge variant="outline">{searchStats.avgSimilarity.toFixed(3)}</Badge>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Search Results</h2>
                {searchResults.length > 0 && (
                  <Badge variant="outline">
                    {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
                  </Badge>
                )}
              </div>

              {searchResults.length === 0 && !searchQuery.isLoading && (
                <Card className="p-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Sparkles className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No results yet</h3>
                    <p className="text-muted-foreground">
                      Enter a query vector and search to find cross-modal matches
                    </p>
                  </div>
                </Card>
              )}

              {searchResults.map((result, index) => {
                const ResultIcon = modalityIcons[result.modality as Modality] || Sparkles;
                const colorClass = modalityColors[result.modality as Modality] || 'gray';

                return (
                  <Card key={index} className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 bg-${colorClass}-500/10 rounded-lg`}>
                            <ResultIcon className={`h-5 w-5 text-${colorClass}-500`} />
                          </div>
                          <div>
                            <h3 className="font-medium">{result.packageName || `Result ${index + 1}`}</h3>
                            <p className="text-sm text-muted-foreground capitalize">
                              {result.modality} modality
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <Badge variant="outline" className="text-green-500">
                            {(result.similarity * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>

                      {result.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {result.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="secondary" className="text-xs">
                          Dim: {result.dimension}
                        </Badge>
                        {result.packageId && (
                          <Badge variant="secondary" className="text-xs">
                            ID: {result.packageId.substring(0, 12)}...
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <QueryIcon className="h-4 w-4" />
                          <span>{queryModality}</span>
                          <ArrowRight className="h-4 w-4" />
                          <ResultIcon className="h-4 w-4" />
                          <span>{result.modality}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => {
                          if (result.packageId) {
                            setLocation(`/package/multimodal/${result.packageId}`);
                          }
                        }}>
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
