import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { Clock, Search, Filter, ChevronLeft, ChevronRight, Play, Download, SlidersHorizontal } from "lucide-react";
import { useLocation } from "wouter";
import { AdvancedSearchDialog, type AdvancedSearchFilters } from "@/components/WorkflowVisualizer/AdvancedSearchDialog";

/**
 * Workflow History Page
 * 
 * Browse and search historical workflow sessions.
 * Provides filtering, sorting, and pagination.
 */
export function WorkflowHistory() {
  const [, setLocation] = useLocation();
  
  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  // Filter state
  const [sessionType, setSessionType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "duration">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>({});

  // Query workflow history
  const { data, isLoading, error } = trpc.workflowHistory.getHistory.useQuery({
    page,
    pageSize,
    sessionType: sessionType === "all" ? undefined : sessionType as any,
    status: status === "all" ? undefined : status as any,
    sortBy,
    sortOrder,
  });

  // Query statistics
  const { data: stats } = trpc.workflowHistory.getStatistics.useQuery({});

  // Handle search
  const handleSearch = () => {
    if (searchQuery.trim()) {
      // TODO: Implement search using searchSessions endpoint
      console.log("Search:", searchQuery);
    }
  };

  // Handle advanced search
  const handleAdvancedSearch = (filters: AdvancedSearchFilters) => {
    setAdvancedFilters(filters);
    // Apply filters to the query
    if (filters.sessionType) {
      setSessionType(filters.sessionType);
    }
    if (filters.status) {
      setStatus(filters.status);
    }
    if (filters.keyword) {
      setSearchQuery(filters.keyword);
    }
    // Reset to first page when applying new filters
    setPage(1);
  };

  // Handle session click
  const handleSessionClick = (sessionId: string) => {
    setLocation(`/workflow-history/${sessionId}`);
  };

  // Handle playback
  const handlePlayback = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLocation(`/workflow-playback/${sessionId}`);
  };

  // Format duration
  const formatDuration = (ms: number | null) => {
    if (!ms) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Format date
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-400 border-green-500/50";
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      case "active":
        return "bg-blue-500/20 text-blue-400 border-blue-500/50";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/50";
    }
  };

  // Get session type label
  const getSessionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ai_reasoning: "AI Reasoning",
      memory_transfer: "Memory Transfer",
      package_processing: "Package Processing",
      w_matrix_training: "W-Matrix Training",
      vector_invocation: "Vector Invocation",
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 mt-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Workflow History
          </h1>
          <p className="text-gray-400">
            Browse and replay past AI reasoning and memory transfer workflows
          </p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <CardDescription>Total Sessions</CardDescription>
                <CardTitle className="text-3xl">{stats.totalSessions}</CardTitle>
              </CardHeader>
            </Card>
            
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <CardDescription>Completed</CardDescription>
                <CardTitle className="text-3xl text-green-400">{stats.completedSessions}</CardTitle>
              </CardHeader>
            </Card>
            
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <CardDescription>Failed</CardDescription>
                <CardTitle className="text-3xl text-red-400">{stats.failedSessions}</CardTitle>
              </CardHeader>
            </Card>
            
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="pb-2">
                <CardDescription>Avg Duration</CardDescription>
                <CardTitle className="text-3xl">{formatDuration(stats.avgDuration)}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="bg-gray-900/50 border-gray-800 mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Search and Advanced Search Button */}
              <div className="flex gap-2">
                <Input
                  placeholder="Search sessions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="bg-gray-800 border-gray-700 flex-1"
                />
                <Button onClick={handleSearch} size="icon" className="bg-blue-600 hover:bg-blue-700">
                  <Search className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setIsAdvancedSearchOpen(true)}
                  variant="outline"
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Advanced
                </Button>
              </div>

              {/* Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Session Type Filter */}
              <Select value={sessionType} onValueChange={setSessionType}>
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

              {/* Status Filter */}
              <Select value={status} onValueChange={setStatus}>
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

              {/* Sort */}
              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [by, order] = value.split("-");
                setSortBy(by as any);
                setSortOrder(order as any);
              }}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">Newest First</SelectItem>
                  <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                  <SelectItem value="duration-desc">Longest Duration</SelectItem>
                  <SelectItem value="duration-asc">Shortest Duration</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Search Dialog */}
        <AdvancedSearchDialog
          open={isAdvancedSearchOpen}
          onOpenChange={setIsAdvancedSearchOpen}
          onSearch={handleAdvancedSearch}
          initialFilters={advancedFilters}
        />

        {/* Session List */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-400">Loading workflow history...</p>
          </div>
        )}

        {error && (
          <Card className="bg-red-900/20 border-red-500/50">
            <CardContent className="pt-6">
              <p className="text-red-400">Error loading workflow history: {error.message}</p>
            </CardContent>
          </Card>
        )}

        {data && data.sessions.length === 0 && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="pt-6 text-center py-12">
              <Filter className="h-12 w-12 mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">No workflow sessions found</p>
              <p className="text-sm text-gray-500 mt-2">Try adjusting your filters</p>
            </CardContent>
          </Card>
        )}

        {data && data.sessions.length > 0 && (
          <div className="space-y-4">
            {data.sessions.map((session) => (
              <Card
                key={session.sessionId}
                className="bg-gray-900/50 border-gray-800 hover:border-blue-500/50 transition-all cursor-pointer"
                onClick={() => handleSessionClick(session.sessionId)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{session.sessionId}</h3>
                        <Badge className={getStatusColor(session.status)}>
                          {session.status}
                        </Badge>
                        <Badge variant="outline" className="border-gray-700">
                          {getSessionTypeLabel(session.sessionType)}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-400 mt-4">
                        <div>
                          <p className="text-gray-500">Created</p>
                          <p>{formatDate(session.createdAt)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Duration</p>
                          <p>{formatDuration(session.duration)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Events</p>
                          <p>{session.eventCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">User ID</p>
                          <p>{session.userId || "N/A"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                        onClick={(e) => handlePlayback(session.sessionId, e)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Replay
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-8">
            <p className="text-sm text-gray-400">
              Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.totalCount} total sessions)
            </p>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!data.pagination.hasPrev}
                onClick={() => setPage(page - 1)}
                className="border-gray-700"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                disabled={!data.pagination.hasNext}
                onClick={() => setPage(page + 1)}
                className="border-gray-700"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
