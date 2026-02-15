import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { ArrowLeft, Play, Download, Clock, Activity } from "lucide-react";
import { EventTimeline } from "@/components/WorkflowVisualizer/EventTimeline";
import { EventDetailsPanel } from "@/components/WorkflowVisualizer/EventDetailsPanel";
import { useState } from "react";
import type { WorkflowEvent } from "@/types/workflow";

/**
 * Workflow Session Detail Page
 * 
 * Shows detailed information about a single workflow session
 * including all events and metadata.
 */
export function WorkflowSessionDetail() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [, setLocation] = useLocation();
  const [selectedEvent, setSelectedEvent] = useState<WorkflowEvent | null>(null);

  // Query session details
  const { data: session, isLoading: sessionLoading, error: sessionError } = trpc.workflowHistory.getSession.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId }
  );

  // Query session events
  const { data: events, isLoading: eventsLoading, error: eventsError } = trpc.workflowHistory.getEvents.useQuery(
    { sessionId: sessionId!, sortOrder: "asc" },
    { enabled: !!sessionId }
  );

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

  // Handle playback
  const handlePlayback = () => {
    setLocation(`/workflow-playback/${sessionId}`);
  };

  // Export session data
  const handleExport = () => {
    if (!session || !events) return;
    
    const exportData = {
      session,
      events,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Loading state
  if (sessionLoading || eventsLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="pt-20 container mx-auto px-4 py-8 mt-20">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-400">Loading session details...</p>
          </div>
        </div>

      </div>
    );
  }

  // Error state
  if (sessionError || eventsError) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="container mx-auto px-4 py-8 mt-20">
          <Card className="bg-red-900/20 border-red-500/50">
            <CardContent className="pt-6">
              <p className="text-red-400">
                Error loading session: {sessionError?.message || eventsError?.message}
              </p>
            </CardContent>
          </Card>
        </div>

      </div>
    );
  }

  if (!session || !events) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="container mx-auto px-4 py-8 mt-20">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="pt-6 text-center py-12">
              <p className="text-gray-400">Session not found</p>
            </CardContent>
          </Card>
        </div>

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 mt-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/workflow-history")}
              className="mb-4 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to History
            </Button>
            
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Workflow Session
            </h1>
            <p className="text-gray-400">{sessionId}</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              className="border-gray-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
            <Button
              onClick={handlePlayback}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Replay
            </Button>
          </div>
        </div>

        {/* Session Info */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="pb-2">
              <CardDescription>Status</CardDescription>
              <Badge className={getStatusColor(session.status)}>
                {session.status}
              </Badge>
            </CardHeader>
          </Card>
          
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="pb-2">
              <CardDescription>Type</CardDescription>
              <CardTitle className="text-lg">{getSessionTypeLabel(session.type)}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="pb-2">
              <CardDescription>Duration</CardDescription>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {formatDuration((session as any).duration || 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="pb-2">
              <CardDescription>Events</CardDescription>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {(session as any).eventCount || 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Timeline and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Event Timeline */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle>Event Timeline</CardTitle>
                <CardDescription>
                  {events.length} events recorded
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventTimeline
                  events={events as WorkflowEvent[]}
                  onEventClick={setSelectedEvent}
                  selectedEventId={selectedEvent?.id}
                />
              </CardContent>
            </Card>
          </div>

          {/* Event Details */}
          <div className="lg:col-span-1">
            <EventDetailsPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          </div>
        </div>

        {/* Session Metadata */}
        {(session as any).metadata && (
          <Card className="bg-gray-900/50 border-gray-800 mt-6">
            <CardHeader>
              <CardTitle>Session Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm text-gray-400 overflow-x-auto">
                {JSON.stringify((session as any).metadata, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Timestamps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardDescription>Created At</CardDescription>
              <CardTitle className="text-lg">{formatDate(session.createdAt)}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardDescription>Updated At</CardDescription>
              <CardTitle className="text-lg">{formatDate((session as any).updatedAt || session.createdAt)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
