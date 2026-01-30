import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cpu,
  Zap,
  TrendingUp,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

interface GPUStatusIndicatorProps {
  showDetails?: boolean;
  showChart?: boolean;
  compact?: boolean;
}

export function GPUStatusIndicator({
  showDetails = false,
  showChart = false,
  compact = false,
}: GPUStatusIndicatorProps) {
  const [expanded, setExpanded] = useState(showDetails);

  // Fetch GPU acceleration status
  const { data: gpuStatus, refetch } = trpc.neuralBridge.getGPUStatus.useQuery();

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (!gpuStatus) {
    return null;
  }

  const { backend, gpuAvailable, stats } = gpuStatus;
  const memoryUsage = (gpuStatus as any).memoryUsage ?? 0;
  const operationsCount = stats?.operationsCount ?? 0;
  const averageTime = stats?.averageTime ?? 0;
  const isGPU = backend === 'gpu' && gpuAvailable;

  // Mock performance comparison data
  const performanceData = [
    { operation: 'Alignment', cpu: 150, gpu: 8 },
    { operation: 'Normalize', cpu: 50, gpu: 3 },
    { operation: 'Similarity', cpu: 100, gpu: 5 },
  ];

  if (compact) {
    return (
      <Badge
        variant={isGPU ? "default" : "secondary"}
        className="flex items-center gap-1.5"
      >
        {isGPU ? (
          <>
            <Zap className="h-3 w-3" />
            GPU
          </>
        ) : (
          <>
            <Cpu className="h-3 w-3" />
            CPU
          </>
        )}
      </Badge>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isGPU ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
              {isGPU ? (
                <Zap className="h-5 w-5 text-green-500" />
              ) : (
                <Cpu className="h-5 w-5 text-blue-500" />
              )}
            </div>
            <div>
              <p className="font-medium">Compute Backend</p>
              <p className="text-sm text-muted-foreground">
                {isGPU ? 'GPU Acceleration Active' : 'CPU Mode'}
              </p>
            </div>
          </div>
          <Badge variant={isGPU ? "default" : "secondary"} className="uppercase">
            {backend}
          </Badge>
        </div>

        {/* Stats Grid */}
        {!compact && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-muted-foreground">Operations</p>
              </div>
              <p className="text-xl font-bold">{operationsCount || 0}</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-orange-500" />
                <p className="text-xs text-muted-foreground">Avg Time</p>
              </div>
              <p className="text-xl font-bold">{averageTime?.toFixed(1) || 0}ms</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <p className="text-xs text-muted-foreground">Speedup</p>
              </div>
              <p className="text-xl font-bold">{isGPU ? '10-50x' : '1x'}</p>
            </div>
          </div>
        )}

        {/* Expandable Details */}
        {!compact && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Show Performance Comparison
              </>
            )}
          </Button>
        )}

        {/* Performance Chart */}
        {expanded && showChart && (
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-sm font-medium mb-3">CPU vs GPU Performance</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="operation" stroke="#666" />
                  <YAxis stroke="#666" label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="cpu" fill="#3b82f6" name="CPU" />
                  <Bar dataKey="gpu" fill="#10b981" name="GPU" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Cpu className="h-4 w-4 text-blue-500" />
                  <p className="font-medium text-blue-500">CPU</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  JavaScript fallback, works everywhere
                </p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-green-500" />
                  <p className="font-medium text-green-500">GPU</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  TensorFlow.js acceleration, 10-50x faster
                </p>
              </div>
            </div>
          </div>
        )}

        {/* GPU Info */}
        {expanded && !showChart && (gpuStatus as any).gpuDevice && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">GPU Device:</span>
                <span className="font-mono">{(gpuStatus as any).gpuDevice}</span>
              </div>
              {memoryUsage !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Memory Usage:</span>
                  <span className="font-mono">{(memoryUsage / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for embedding in headers/sidebars
export function GPUBadge() {
  const { data: gpuStatus } = trpc.neuralBridge.getGPUStatus.useQuery();

  if (!gpuStatus) return null;

  const isGPU = gpuStatus.backend === 'gpu' && gpuStatus.gpuAvailable;

  return (
    <Badge
      variant={isGPU ? "default" : "secondary"}
      className="flex items-center gap-1.5"
    >
      {isGPU ? (
        <>
          <Zap className="h-3 w-3" />
          GPU
        </>
      ) : (
        <>
          <Cpu className="h-3 w-3" />
          CPU
        </>
      )}
    </Badge>
  );
}
