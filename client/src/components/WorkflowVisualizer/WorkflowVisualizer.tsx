import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { WorkflowEvent, WorkflowSession, WorkflowFilter } from "@shared/workflow-types";
import { EventTimeline } from "./EventTimeline";
import { EventDetailsPanel } from "./EventDetailsPanel";
import { FilterControls } from "./FilterControls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowVisualizerProps {
  workflowId: string;
  title?: string;
  className?: string;
  onClose?: () => void;
}

export function WorkflowVisualizer({ 
  workflowId, 
  title = "Workflow Visualization",
  className,
  onClose 
}: WorkflowVisualizerProps) {
  const [session, setSession] = useState<WorkflowSession | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<WorkflowEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<WorkflowEvent | null>(null);
  const [filter, setFilter] = useState<WorkflowFilter>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Socket.IO connection for real-time updates
  useEffect(() => {
    // Connect to Socket.IO server
    const socket = io({
      path: "/api/workflow/stream",
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[WorkflowVisualizer] Socket.IO connected:", socket.id);
      setIsConnected(true);
      
      // Subscribe to workflow events
      socket.emit("subscribe", workflowId);
    });

    socket.on("message", (message) => {
      try {
        console.log("[WorkflowVisualizer] Received message:", message);
        
        switch (message.type) {
          case "session_start":
            setSession(message.data as WorkflowSession);
            break;
            
          case "event":
            const newEvent = message.data as WorkflowEvent;
            setEvents(prev => {
              // Update existing event or add new one
              const index = prev.findIndex(e => e.id === newEvent.id);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = newEvent;
                return updated;
              }
              return [...prev, newEvent];
            });
            break;
            
          case "session_end":
            setSession(message.data as WorkflowSession);
            break;
            
          case "error":
            console.error("[WorkflowVisualizer] Error:", message.data);
            break;
        }
      } catch (error) {
        console.error("[WorkflowVisualizer] Failed to process message:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("[WorkflowVisualizer] Socket.IO disconnected");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("[WorkflowVisualizer] Connection error:", error);
      setIsConnected(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("unsubscribe", workflowId);
        socketRef.current.disconnect();
      }
    };
  }, [workflowId]);

  // Apply filters
  useEffect(() => {
    let filtered = [...events];

    // Filter by event types
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      filtered = filtered.filter(e => filter.eventTypes!.includes(e.type));
    }

    // Filter by status
    if (filter.status && filter.status.length > 0) {
      filtered = filtered.filter(e => filter.status!.includes(e.status));
    }

    // Filter by search
    if (filter.search) {
      const search = filter.search.toLowerCase();
      filtered = filtered.filter(e => 
        e.title.toLowerCase().includes(search) ||
        e.description?.toLowerCase().includes(search) ||
        e.type.toLowerCase().includes(search)
      );
    }

    // Filter by time range
    if (filter.timeRange) {
      filtered = filtered.filter(e => 
        e.timestamp >= filter.timeRange!.start &&
        e.timestamp <= filter.timeRange!.end
      );
    }

    // Sort by timestamp
    filtered.sort((a, b) => a.timestamp - b.timestamp);

    setFilteredEvents(filtered);
  }, [events, filter]);

  const handleEventClick = useCallback((event: WorkflowEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleExport = useCallback(() => {
    const data = {
      session,
      events,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-${workflowId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [session, events, workflowId]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className={cn(
      "flex flex-col gap-4",
      isFullscreen && "fixed inset-0 z-50 bg-background p-4",
      className
    )}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl">{title}</CardTitle>
              {session && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={session.status === "active" ? "default" : "secondary"}>
                    {session.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {session.totalEvents} events
                  </span>
                  {session.totalDuration > 0 && (
                    <span className="text-sm text-muted-foreground">
                      • {formatDuration(session.totalDuration)}
                    </span>
                  )}
                  {isConnected && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                      Live
                    </Badge>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={events.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              {onClose && (
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <FilterControls
        filter={filter}
        onFilterChange={setFilter}
        totalEvents={events.length}
        filteredEvents={filteredEvents.length}
      />

      {/* Timeline */}
      <EventTimeline
        events={filteredEvents}
        selectedEventId={selectedEvent?.id}
        onEventClick={handleEventClick}
      />

      {/* Details Panel */}
      <div className="flex-1 min-h-[400px]">
        <EventDetailsPanel event={selectedEvent} className="h-full" />
      </div>

      {/* Empty State */}
      {events.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground text-center">
              <p className="text-lg font-semibold mb-2">No events yet</p>
              <p className="text-sm">
                {isConnected 
                  ? "Waiting for workflow events..."
                  : "Connecting to workflow stream..."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
