import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  Clock,
  Activity,
  Sparkles,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MemoryScore {
  totalScore: number;
  baseScore: number;
  timeDecay: number;
  usageBoost: number;
  confidence: number;
  usageCount: number;
  createdAt: Date;
}

interface MemoryScoreBreakdownProps {
  score: MemoryScore;
  className?: string;
}

export function MemoryScoreBreakdown({ score, className }: MemoryScoreBreakdownProps) {
  const {
    totalScore,
    baseScore,
    timeDecay,
    usageBoost,
    confidence,
    usageCount,
    createdAt,
  } = score;

  // Calculate age in days
  const ageInDays = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate percentages for progress bars
  const basePercentage = (baseScore / totalScore) * 100;
  const decayPercentage = ((baseScore * timeDecay) / totalScore) * 100;
  const boostPercentage = (usageBoost / totalScore) * 100;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Memory Score Breakdown
            </CardTitle>
            <CardDescription>
              Detailed scoring metrics and components
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {totalScore.toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground">Total Score</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Confidence Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Base Score</span>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Based on confidence level ({confidence.toFixed(2)}) and content type.
                    Higher confidence = higher base score.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Badge variant="secondary">{baseScore.toFixed(3)}</Badge>
          </div>
          <Progress value={basePercentage} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Confidence: {(confidence * 100).toFixed(0)}%
          </p>
        </div>

        <Separator />

        {/* Time Decay */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Time Decay Factor</span>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Memories lose relevance over time. Decay rate varies by content type.
                    Current age: {ageInDays} days.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Badge
              variant={timeDecay > 0.8 ? "default" : timeDecay > 0.5 ? "secondary" : "destructive"}
            >
              {(timeDecay * 100).toFixed(1)}%
            </Badge>
          </div>
          <Progress value={timeDecay * 100} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Age: {ageInDays} days • Decayed Score: {(baseScore * timeDecay).toFixed(3)}
          </p>
        </div>

        <Separator />

        {/* Usage Boost */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Usage Boost</span>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Frequently accessed memories get a boost.
                    Usage count: {usageCount} times.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Badge variant="outline" className="text-green-600">
              +{usageBoost.toFixed(3)}
            </Badge>
          </div>
          <Progress value={boostPercentage} className="h-2 bg-green-100" />
          <p className="text-xs text-muted-foreground">
            Retrieved {usageCount} times • Boost multiplier: {(1 + usageCount * 0.01).toFixed(2)}x
          </p>
        </div>

        <Separator />

        {/* Score Formula */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Score Formula</p>
          <div className="font-mono text-sm space-y-1">
            <div className="text-blue-600">
              base_score = {baseScore.toFixed(3)}
            </div>
            <div className="text-orange-600">
              time_factor = {timeDecay.toFixed(3)} ({(timeDecay * 100).toFixed(1)}%)
            </div>
            <div className="text-green-600">
              usage_boost = {usageBoost.toFixed(3)}
            </div>
            <Separator className="my-2" />
            <div className="text-purple-600 font-semibold">
              total_score = {baseScore.toFixed(3)} × {timeDecay.toFixed(3)} + {usageBoost.toFixed(3)} = {totalScore.toFixed(3)}
            </div>
          </div>
        </div>

        {/* Score Quality Badge */}
        <div className="flex justify-center">
          {totalScore >= 0.9 && (
            <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500">
              ⭐ Platinum Quality
            </Badge>
          )}
          {totalScore >= 0.7 && totalScore < 0.9 && (
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500">
              💎 High Quality
            </Badge>
          )}
          {totalScore >= 0.5 && totalScore < 0.7 && (
            <Badge variant="secondary">
              ✓ Good Quality
            </Badge>
          )}
          {totalScore < 0.5 && (
            <Badge variant="outline">
              ⚠ Needs Refresh
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
