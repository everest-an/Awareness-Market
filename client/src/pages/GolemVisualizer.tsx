import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { GolemVisualizer, type GolemPoint } from "@/components/GolemVisualizer";
import { trpc } from "@/lib/trpc";
import { Download, Search } from "lucide-react";

const colorMap: Record<string, string> = {
  finance: "#4a9eff",
  "code-generation": "#a855f7",
  "data-processing": "#10b981",
  "image-analysis": "#f59e0b",
  reasoning: "#ef4444",
};

export default function GolemVisualizerPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "popular" | "rating">("newest");

  const { data: vectors, isLoading } = trpc.vectors.search.useQuery({
    searchTerm: searchTerm || undefined,
    sortBy: sortBy === "popular" ? "popular" : sortBy === "rating" ? "rating" : "newest",
    limit: 60,
    offset: 0,
  });

  const points = useMemo<GolemPoint[]>(() => {
    if (!vectors) return [];

    const maxCalls = Math.max(...vectors.map((v) => v.totalCalls || 0), 1);
    const maxPrice = Math.max(...vectors.map((v) => parseFloat(v.basePrice)), 1);
    const maxRating = Math.max(...vectors.map((v) => parseFloat(v.averageRating || "0")), 1);

    return vectors.map((vector) => {
      const price = parseFloat(vector.basePrice);
      const calls = vector.totalCalls || 0;
      const rating = parseFloat(vector.averageRating || "0");

      const x = (price / maxPrice) * 40 - 20;
      const y = (calls / maxCalls) * 40 - 20;
      const z = (rating / maxRating) * 40 - 20;

      return {
        id: String(vector.id),
        x,
        y,
        z,
        label: vector.title,
        color: colorMap[vector.category?.toLowerCase()] || "#4a9eff",
        meta: {
          category: vector.category,
          price,
          calls,
          rating,
        },
      };
    });
  }, [vectors]);

  const [selectedPoint, setSelectedPoint] = useState<GolemPoint | null>(null);

  const handleExport = () => {
    const payload = {
      points,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `golem-visualization-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-10 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Golem Vector Space</h1>
          <p className="text-muted-foreground">
            Interactive visualization of marketplace vectors by price, calls, and rating.
          </p>
        </div>

        <Card>
          <CardContent className="py-4">
            <div className="grid gap-4 md:grid-cols-[1fr_180px_160px] items-end">
              <div>
                <label className="text-sm font-medium">Search</label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search vectors..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Sort By</label>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="popular">Most Calls</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="mt-6" onClick={handleExport} disabled={!points.length}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>3D Vector Space</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[600px]">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">Loading...</div>
                ) : (
                  <GolemVisualizer
                    data={points}
                    onPointClick={setSelectedPoint}
                    className="h-full"
                    autoRotate={true}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Vectors</span>
                  <span className="font-semibold">{points.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Selection</span>
                  <span className="font-semibold">{selectedPoint ? "Yes" : "No"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Selected Vector</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {selectedPoint ? (
                  <>
                    <div className="font-semibold">{selectedPoint.label}</div>
                    <Badge variant="secondary">{selectedPoint.meta?.category as string}</Badge>
                    <div className="text-muted-foreground">
                      Price: ${(selectedPoint.meta?.price as number)?.toFixed(2)}
                    </div>
                    <div className="text-muted-foreground">
                      Calls: {selectedPoint.meta?.calls ?? 0}
                    </div>
                    <div className="text-muted-foreground">
                      Rating: {(selectedPoint.meta?.rating as number)?.toFixed(1)}
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">Click a point to inspect</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
