import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, X } from "lucide-react";
import { format } from "date-fns";

/**
 * Advanced Search Dialog for Workflow History
 * 
 * Provides detailed search filters including:
 * - Keyword search
 * - Session type filter
 * - Status filter
 * - Date range picker
 * - Metadata field search
 * - Content-based search (input/output)
 */

export interface AdvancedSearchFilters {
  keyword?: string;
  sessionType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  metadataKey?: string;
  metadataValue?: string;
  contentSearch?: string;
}

interface AdvancedSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (filters: AdvancedSearchFilters) => void;
  initialFilters?: AdvancedSearchFilters;
}

export function AdvancedSearchDialog({
  open,
  onOpenChange,
  onSearch,
  initialFilters = {},
}: AdvancedSearchDialogProps) {
  const [filters, setFilters] = useState<AdvancedSearchFilters>(initialFilters);

  const handleSearch = () => {
    onSearch(filters);
    onOpenChange(false);
  };

  const handleReset = () => {
    setFilters({});
  };

  const updateFilter = (key: keyof AdvancedSearchFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Advanced Search
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Search workflow sessions with detailed filters
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Keyword Search */}
          <div className="space-y-2">
            <Label htmlFor="keyword" className="text-gray-300">
              Keyword
            </Label>
            <Input
              id="keyword"
              placeholder="Search in session ID, type, or metadata..."
              value={filters.keyword || ""}
              onChange={(e) => updateFilter("keyword", e.target.value)}
              className="bg-gray-800 border-gray-700"
            />
          </div>

          {/* Session Type */}
          <div className="space-y-2">
            <Label htmlFor="sessionType" className="text-gray-300">
              Session Type
            </Label>
            <Select
              value={filters.sessionType || "all"}
              onValueChange={(value) =>
                updateFilter("sessionType", value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ai_reasoning">AI Reasoning</SelectItem>
                <SelectItem value="memory_transfer">Memory Transfer</SelectItem>
                <SelectItem value="package_processing">Package Processing</SelectItem>
                <SelectItem value="w_matrix_training">W-Matrix Training</SelectItem>
                <SelectItem value="vector_invocation">Vector Invocation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-gray-300">
              Status
            </Label>
            <Select
              value={filters.status || "all"}
              onValueChange={(value) =>
                updateFilter("status", value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-gray-800 border-gray-700"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.startDate ? (
                      format(filters.startDate, "PPP")
                    ) : (
                      <span className="text-gray-500">Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-800">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) => updateFilter("startDate", date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-gray-800 border-gray-700"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.endDate ? (
                      format(filters.endDate, "PPP")
                    ) : (
                      <span className="text-gray-500">Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-800">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) => updateFilter("endDate", date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Metadata Search */}
          <div className="space-y-2">
            <Label className="text-gray-300">Metadata Search</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Key (e.g., model)"
                value={filters.metadataKey || ""}
                onChange={(e) => updateFilter("metadataKey", e.target.value)}
                className="bg-gray-800 border-gray-700"
              />
              <Input
                placeholder="Value (e.g., gpt-4)"
                value={filters.metadataValue || ""}
                onChange={(e) => updateFilter("metadataValue", e.target.value)}
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>

          {/* Content Search */}
          <div className="space-y-2">
            <Label htmlFor="contentSearch" className="text-gray-300">
              Content Search
            </Label>
            <Input
              id="contentSearch"
              placeholder="Search in event data (input/output)..."
              value={filters.contentSearch || ""}
              onChange={(e) => updateFilter("contentSearch", e.target.value)}
              className="bg-gray-800 border-gray-700"
            />
            <p className="text-xs text-gray-500">
              Search within event payloads and results
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleReset}
            className="border-gray-700"
          >
            <X className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
