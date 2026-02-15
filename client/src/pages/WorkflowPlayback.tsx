import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  RotateCcw,
  FastForward
} from "lucide-react";
import { EventTimeline } from "@/components/WorkflowVisualizer/EventTimeline";
import { EventDetailsPanel } from "@/components/WorkflowVisualizer/EventDetailsPanel";
import type { WorkflowEvent } from "@/types/workflow";

/**
 * Workflow Playback Page
 * 
 * Replay workflow sessions with play/pause/step controls.
 * Allows users to see how AI reasoning unfolded over time.
 */
export function WorkflowPlayback() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [, setLocation] = useLocation();

  // Query session and events
  const { data: session } = trpc.workflowHistory.getSession.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId }
  );

  const { data: allEvents } = trpc.workflowHistory.getEvents.useQuery(
    { sessionId: sessionId!, sortOrder: "asc" },
    { enabled: !!sessionId }
  );

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 5x
  const [visibleEvents, setVisibleEvents] = useState<WorkflowEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<WorkflowEvent | null>(null);
  
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize visible events
  useEffect(() => {
    if (allEvents && allEvents.length > 0) {
      setVisibleEvents([allEvents[0] as unknown as WorkflowEvent]);
      setSelectedEvent(allEvents[0] as unknown as WorkflowEvent);
    }
  }, [allEvents]);

  // Playback logic
  useEffect(() => {
    if (!isPlaying || !allEvents || currentEventIndex >= allEvents.length - 1) {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      if (currentEventIndex >= (allEvents?.length || 0) - 1) {
        setIsPlaying(false);
      }
      return;
    }

    // Calculate delay based on actual event timestamps or use default
    let delay = 1000 / playbackSpeed; // Default 1 second per event
    
    if (currentEventIndex < allEvents.length - 1) {
      const currentEvent = allEvents[currentEventIndex];
      const nextEvent = allEvents[currentEventIndex + 1];
      const actualDelay = new Date(nextEvent.timestamp).getTime() - new Date(currentEvent.timestamp).getTime();
      
      // Use actual delay if reasonable (between 100ms and 5s), otherwise use default
      if (actualDelay > 100 && actualDelay < 5000) {
        delay = actualDelay / playbackSpeed;
      }
    }

    playbackTimerRef.current = setTimeout(() => {
      const nextIndex = currentEventIndex + 1;
      setCurrentEventIndex(nextIndex);
      setVisibleEvents(allEvents.slice(0, nextIndex + 1) as WorkflowEvent[]);
      setSelectedEvent(allEvents[nextIndex] as WorkflowEvent);
    }, delay);

    return () => {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
      }
    };
  }, [isPlaying, currentEventIndex, allEvents, playbackSpeed]);

  // Control functions
  const handlePlay = () => {
    if (currentEventIndex >= (allEvents?.length || 0) - 1) {
      handleReset();
    }
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleStepForward = () => {
    if (!allEvents || currentEventIndex >= allEvents.length - 1) return;
    const nextIndex = currentEventIndex + 1;
    setCurrentEventIndex(nextIndex);
    setVisibleEvents(allEvents.slice(0, nextIndex + 1) as WorkflowEvent[]);
    setSelectedEvent(allEvents[nextIndex] as WorkflowEvent);
  };

  const handleStepBackward = () => {
    if (currentEventIndex <= 0) return;
    const prevIndex = currentEventIndex - 1;
    setCurrentEventIndex(prevIndex);
    setVisibleEvents(allEvents!.slice(0, prevIndex + 1) as WorkflowEvent[]);
    setSelectedEvent(allEvents![prevIndex] as WorkflowEvent);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentEventIndex(0);
    if (allEvents && allEvents.length > 0) {
      setVisibleEvents([allEvents[0]] as WorkflowEvent[]);
      setSelectedEvent(allEvents[0] as WorkflowEvent);
    }
  };

  const handleSliderChange = (value: number[]) => {
    const newIndex = value[0];
    setCurrentEventIndex(newIndex);
    if (allEvents) {
      setVisibleEvents(allEvents.slice(0, newIndex + 1) as WorkflowEvent[]);
      setSelectedEvent(allEvents[newIndex] as WorkflowEvent);
    }
  };

  const cyclePlaybackSpeed = () => {
    setPlaybackSpeed((speed) => {
      if (speed === 1) return 2;
      if (speed === 2) return 5;
      return 1;
    });
  };

  // Format duration
  const formatDuration = (ms: number | null) => {
    if (!ms) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
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

  if (!session || !allEvents) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="pt-20 container mx-auto px-4 py-8 mt-20">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-400">Loading playback...</p>
          </div>
        </div>
  
      </div>
    );
  }

  const progress = ((currentEventIndex + 1) / allEvents.length) * 100;

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
              onClick={() => setLocation(`/workflow-history/${sessionId}`)}
              className="mb-4 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Session
            </Button>
            
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Workflow Playback
            </h1>
            <p className="text-gray-400">{sessionId}</p>
          </div>

          <Badge className={getStatusColor(session.status)}>
            {session.status}
          </Badge>
        </div>

        {/* Playback Controls */}
        <Card className="bg-gray-900/50 border-gray-800 mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Event {currentEventIndex + 1} of {allEvents.length}</span>
                  <span>{progress.toFixed(0)}% Complete</span>
                </div>
                <Slider
                  value={[currentEventIndex]}
                  onValueChange={handleSliderChange}
                  max={allEvents.length - 1}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleReset}
                  className="border-gray-700"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleStepBackward}
                  disabled={currentEventIndex === 0}
                  className="border-gray-700"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>

                {isPlaying ? (
                  <Button
                    size="icon"
                    onClick={handlePause}
                    className="bg-blue-600 hover:bg-blue-700 h-12 w-12"
                  >
                    <Pause className="h-6 w-6" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={handlePlay}
                    className="bg-blue-600 hover:bg-blue-700 h-12 w-12"
                  >
                    <Play className="h-6 w-6" />
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleStepForward}
                  disabled={currentEventIndex >= allEvents.length - 1}
                  className="border-gray-700"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={cyclePlaybackSpeed}
                  className="border-gray-700"
                >
                  <FastForward className="h-4 w-4 mr-2" />
                  {playbackSpeed}x
                </Button>
              </div>

              {/* Info */}
              <div className="text-center text-sm text-gray-400">
                {isPlaying ? "Playing..." : "Paused"} �?{formatDuration((session as any).duration || 0)} total duration
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Event Timeline */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle>Event Timeline</CardTitle>
                <CardDescription>
                  Showing {visibleEvents.length} of {allEvents.length} events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventTimeline
                  events={visibleEvents}
                  onEventClick={(event) => {
                    setSelectedEvent(event);
                    setIsPlaying(false);
                  }}
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
      </div>


    </div>
  );
}
