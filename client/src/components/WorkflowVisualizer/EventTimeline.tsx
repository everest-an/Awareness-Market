import { useMemo } from "react";
import type { WorkflowEvent } from "@shared/workflow-types";
import { cn } from "@/lib/utils";

interface EventTimelineProps {
  events: WorkflowEvent[];
  selectedEventId?: string;
  onEventClick?: (event: WorkflowEvent) => void;
  className?: string;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  prompt_llm: "bg-blue-500",
  llm_response: "bg-green-500",
  tool_call: "bg-purple-500",
  tool_result: "bg-pink-500",
  memory_load: "bg-cyan-500",
  memory_save: "bg-teal-500",
  w_matrix_transform: "bg-indigo-500",
  package_upload: "bg-orange-500",
  package_validate: "bg-yellow-500",
  package_process: "bg-amber-500",
  package_complete: "bg-emerald-500",
  error: "bg-red-500",
  user_input: "bg-gray-500",
  system_event: "bg-slate-500",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  prompt_llm: "Prompt",
  llm_response: "Response",
  tool_call: "Tool Call",
  tool_result: "Tool Result",
  memory_load: "Load Memory",
  memory_save: "Save Memory",
  w_matrix_transform: "Transform",
  package_upload: "Upload",
  package_validate: "Validate",
  package_process: "Process",
  package_complete: "Complete",
  error: "Error",
  user_input: "User Input",
  system_event: "System",
};

export function EventTimeline({ events, selectedEventId, onEventClick, className }: EventTimelineProps) {
  const { minTime, maxTime, timeRange } = useMemo(() => {
    if (events.length === 0) {
      return { minTime: 0, maxTime: 1000, timeRange: 1000 };
    }
    const timestamps = events.map(e => e.timestamp);
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    return {
      minTime: min,
      maxTime: max,
      timeRange: max - min || 1000,
    };
  }, [events]);

  const getEventPosition = (timestamp: number) => {
    if (timeRange === 0) return 0;
    return ((timestamp - minTime) / timeRange) * 100;
  };

  const getEventWidth = (event: WorkflowEvent) => {
    if (!event.duration || timeRange === 0) return 0.5;
    return Math.max(0.5, (event.duration / timeRange) * 100);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Timeline Header */}
      <div className="flex items-center justify-between mb-4 px-4">
        <h3 className="text-lg font-semibold">Event History</h3>
        <div className="text-sm text-muted-foreground">
          {events.length} events • {formatDuration(timeRange)} total
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative w-full h-32 bg-muted/30 rounded-lg border border-border overflow-x-auto">
        {/* Time Axis */}
        <div className="absolute top-0 left-0 right-0 h-6 border-b border-border bg-background/50">
          <div className="relative w-full h-full">
            {[0, 25, 50, 75, 100].map((percent) => {
              const time = minTime + (timeRange * percent) / 100;
              return (
                <div
                  key={percent}
                  className="absolute top-0 text-xs text-muted-foreground"
                  style={{ left: `${percent}%`, transform: "translateX(-50%)" }}
                >
                  {formatTime(time)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Events Track */}
        <div className="absolute top-6 left-0 right-0 bottom-0 px-2">
          <div className="relative w-full h-full">
            {/* Grid Lines */}
            {[0, 25, 50, 75, 100].map((percent) => (
              <div
                key={percent}
                className="absolute top-0 bottom-0 w-px bg-border/30"
                style={{ left: `${percent}%` }}
              />
            ))}

            {/* Events */}
            {events.map((event, index) => {
              const left = getEventPosition(event.timestamp);
              const width = getEventWidth(event);
              const color = EVENT_TYPE_COLORS[event.type] || "bg-gray-500";
              const isSelected = event.id === selectedEventId;
              const isError = event.status === "failed";

              return (
                <button
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className={cn(
                    "absolute top-2 h-16 rounded-md transition-all cursor-pointer group",
                    "hover:scale-105 hover:z-10 hover:shadow-lg",
                    color,
                    isSelected && "ring-2 ring-white ring-offset-2 ring-offset-background scale-105 z-10",
                    isError && "opacity-70 border-2 border-red-600"
                  )}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    minWidth: "4px",
                  }}
                  title={`${event.title}${event.duration ? ` (${formatDuration(event.duration)})` : ""}`}
                >
                  {/* Event Label (only show if wide enough) */}
                  {width > 5 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs font-medium px-1">
                      <div className="truncate w-full text-center">
                        {EVENT_TYPE_LABELS[event.type] || event.type}
                      </div>
                      {event.duration && (
                        <div className="text-[10px] opacity-80">
                          {formatDuration(event.duration)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hover Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                    <div className="font-semibold">{event.title}</div>
                    {event.duration && (
                      <div className="text-muted-foreground">
                        Duration: {formatDuration(event.duration)}
                      </div>
                    )}
                    <div className="text-muted-foreground">
                      {formatTime(event.timestamp)}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  {event.status === "running" && (
                    <div className="absolute inset-0 rounded-md animate-pulse bg-white/20" />
                  )}
                  {event.status === "failed" && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-red-600 rounded-full border-2 border-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 px-4">
        {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => {
          const hasEvents = events.some(e => e.type === type);
          if (!hasEvents) return null;
          
          const color = EVENT_TYPE_COLORS[type];
          return (
            <div key={type} className="flex items-center gap-2 text-sm">
              <div className={cn("w-3 h-3 rounded", color)} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
