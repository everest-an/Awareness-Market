import { useState } from "react";
import type { WorkflowEvent } from "@shared/workflow-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventDetailsPanelProps {
  event: WorkflowEvent | null;
  className?: string;
  onClose?: () => void;
}

export function EventDetailsPanel({ event, className, onClose }: EventDetailsPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!event) {
    return (
      <Card className={cn("h-full", className)}>
        <CardContent className="flex items-center justify-center h-full text-muted-foreground">
          Select an event to view details
        </CardContent>
      </Card>
    );
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const formatJSON = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "running":
        return "bg-blue-500";
      case "failed":
        return "bg-red-500";
      case "pending":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{event.title}</CardTitle>
            {event.description && (
              <CardDescription className="mt-1">{event.description}</CardDescription>
            )}
          </div>
          <Badge className={cn("ml-2", getStatusColor(event.status))}>
            {event.status}
          </Badge>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline">{event.type}</Badge>
          {event.metadata?.model && (
            <Badge variant="outline">Model: {event.metadata.model}</Badge>
          )}
          {event.metadata?.tokens && (
            <Badge variant="outline">Tokens: {event.metadata.tokens}</Badge>
          )}
          {event.duration && (
            <Badge variant="outline">Duration: {formatDuration(event.duration)}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <Tabs defaultValue="overview" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="input">Input</TabsTrigger>
            <TabsTrigger value="output">Output</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Event Information</h4>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-muted-foreground">Event ID:</dt>
                    <dd className="font-mono text-xs">{event.id}</dd>
                    
                    <dt className="text-muted-foreground">Workflow ID:</dt>
                    <dd className="font-mono text-xs">{event.workflowId}</dd>
                    
                    <dt className="text-muted-foreground">Timestamp:</dt>
                    <dd>{formatTime(event.timestamp)}</dd>
                    
                    {event.duration && (
                      <>
                        <dt className="text-muted-foreground">Duration:</dt>
                        <dd>{formatDuration(event.duration)}</dd>
                      </>
                    )}
                    
                    {event.parentEventId && (
                      <>
                        <dt className="text-muted-foreground">Parent Event:</dt>
                        <dd className="font-mono text-xs">{event.parentEventId}</dd>
                      </>
                    )}
                  </dl>
                </div>

                {event.error && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-red-600">Error Details</h4>
                    <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-3">
                      <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                        {event.error.code}
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        {event.error.message}
                      </p>
                      {event.error.stack && (
                        <pre className="text-xs text-red-600 dark:text-red-400 mt-2 overflow-x-auto">
                          {event.error.stack}
                        </pre>
                      )}
                    </div>
                  </div>
                )}

                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Quick Stats</h4>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(event.metadata).map(([key, value]) => (
                        <div key={key} className="contents">
                          <dt className="text-muted-foreground capitalize">
                            {key.replace(/_/g, " ")}:
                          </dt>
                          <dd>{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="input" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {event.input ? (
                <div className="relative">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(formatJSON(event.input), "input")}
                  >
                    {copiedField === "input" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
                    {formatJSON(event.input)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No input data</p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="output" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {event.output ? (
                <div className="relative">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(formatJSON(event.output), "output")}
                  >
                    {copiedField === "output" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
                    {formatJSON(event.output)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No output data</p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="metadata" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {event.metadata && Object.keys(event.metadata).length > 0 ? (
                <div className="relative">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(formatJSON(event.metadata), "metadata")}
                  >
                    {copiedField === "metadata" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
                    {formatJSON(event.metadata)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No metadata</p>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
