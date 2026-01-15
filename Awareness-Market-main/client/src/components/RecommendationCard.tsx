import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, DollarSign, Star } from "lucide-react";
import { Link } from "wouter";

interface RecommendationCardProps {
  recommendation: {
    vectorId: number;
    score: number;
    reason: string;
    vector?: {
      id: number;
      title: string;
      description: string;
      category: string;
      basePrice: string;
      averageRating: string | null;
      reviewCount: number;
      totalCalls: number;
    };
  };
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const { vector, score, reason } = recommendation;

  if (!vector) return null;

  const rating = parseFloat(vector.averageRating || "0");

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:border-primary/50">
      {/* AI Badge */}
      <div className="absolute right-4 top-4 z-10">
        <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
          <Sparkles className="h-3 w-3" />
          AI Recommended
        </Badge>
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="line-clamp-1 text-lg group-hover:text-primary transition-colors">
              {vector.title}
            </CardTitle>
            <CardDescription className="mt-1">
              <Badge variant="outline" className="text-xs">
                {vector.category}
              </Badge>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Recommendation Reason */}
        <div className="rounded-lg bg-muted/50 p-3 border border-primary/20">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              {reason}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {vector.description}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">${parseFloat(vector.basePrice).toFixed(2)}</span>
          </div>

          {rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{rating.toFixed(1)}</span>
              <span className="text-muted-foreground">({vector.reviewCount})</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-muted-foreground">
            <span>{vector.totalCalls.toLocaleString()} calls</span>
          </div>
        </div>

        {/* Match Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Match Score</span>
            <span className="font-semibold text-primary">{Math.round(score)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all"
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* Action Button */}
        <Button asChild className="w-full">
          <Link href={`/marketplace/${vector.id}`}>
            View Details
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
