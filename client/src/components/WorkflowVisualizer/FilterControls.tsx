import { useState } from "react";
import type { WorkflowFilter, WorkflowEventType, WorkflowEventStatus } from "@shared/workflow-types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterControlsProps {
  filter: WorkflowFilter;
  onFilterChange: (filter: WorkflowFilter) => void;
  totalEvents: number;
  filteredEvents: number;
  className?: string;
}

const EVENT_TYPES: { value: WorkflowEventType; label: string }[] = [
  { value: "prompt_llm", label: "LLM Prompt" },
  { value: "llm_response", label: "LLM Response" },
  { value: "tool_call", label: "Tool Call" },
  { value: "tool_result", label: "Tool Result" },
  { value: "memory_load", label: "Memory Load" },
  { value: "memory_save", label: "Memory Save" },
  { value: "w_matrix_transform", label: "W-Matrix Transform" },
  { value: "package_upload", label: "Package Upload" },
  { value: "package_validate", label: "Package Validate" },
  { value: "package_process", label: "Package Process" },
  { value: "package_complete", label: "Package Complete" },
  { value: "error", label: "Error" },
  { value: "user_input", label: "User Input" },
  { value: "system_event", label: "System Event" },
];

const STATUS_OPTIONS: { value: WorkflowEventStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export function FilterControls({
  filter,
  onFilterChange,
  totalEvents,
  filteredEvents,
  className,
}: FilterControlsProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handleSearchChange = (search: string) => {
    onFilterChange({ ...filter, search: search || undefined });
  };

  const toggleEventType = (type: WorkflowEventType) => {
    const current = filter.eventTypes || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    onFilterChange({ ...filter, eventTypes: updated.length > 0 ? updated : undefined });
  };

  const toggleStatus = (status: WorkflowEventStatus) => {
    const current = filter.status || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    onFilterChange({ ...filter, status: updated.length > 0 ? updated : undefined });
  };

  const clearFilters = () => {
    onFilterChange({});
    setShowFilters(false);
  };

  const hasActiveFilters = 
    (filter.eventTypes && filter.eventTypes.length > 0) ||
    (filter.status && filter.status.length > 0) ||
    filter.search ||
    filter.timeRange;

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Search and Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={filter.search || ""}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {[
                    filter.eventTypes?.length || 0,
                    filter.status?.length || 0,
                  ].reduce((a, b) => a + b, 0)}
                </Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {/* Filter Results Summary */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {filteredEvents} of {totalEvents} events
            </span>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="space-y-4 pt-4 border-t">
              {/* Event Types */}
              <div>
                <label className="text-sm font-semibold mb-2 block">Event Types</label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map(({ value, label }) => (
                    <Badge
                      key={value}
                      variant={filter.eventTypes?.includes(value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleEventType(value)}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-semibold mb-2 block">Status</label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(({ value, label }) => (
                    <Badge
                      key={value}
                      variant={filter.status?.includes(value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleStatus(value)}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
