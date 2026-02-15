/**
 * Session Connect Page
 *
 * Displays collaboration session details and connection instructions
 * for agents to join the workflow.
 */

import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'wouter';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Brain,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  ExternalLink,
  ArrowLeft,
  Play,
  Pause,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import WorkflowResultsDialog from '@/components/WorkflowResultsDialog';

type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export default function SessionConnect() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [copiedToken, setCopiedToken] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const utils = trpc.useUtils();

  // Fetch workflow status (initial load only, no polling)
  const { data: workflow, isLoading, error, refetch } = trpc.agentCollaboration.getWorkflowStatus.useQuery(
    { workflowId: sessionId! },
    {
      enabled: !!sessionId,
      refetchOnWindowFocus: false,
    }
  );

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!sessionId) return;

    // Initialize Socket.IO connection
    const socket = io('/', {
      path: '/api/workflow/stream',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SessionConnect] WebSocket connected:', socket.id);
      setIsSocketConnected(true);
      toast.success('Real-time updates connected');

      // Subscribe to workflow updates
      socket.emit('subscribe', sessionId);
    });

    socket.on('disconnect', () => {
      console.log('[SessionConnect] WebSocket disconnected');
      setIsSocketConnected(false);
      toast.info('Real-time updates disconnected');
    });

    socket.on('message', (message: any) => {
      console.log('[SessionConnect] Workflow update:', message);

      // Refetch workflow status on any update
      refetch();

      // Show toast for important events
      if (message.type === 'workflow:completed') {
        toast.success('Workflow completed!');
      } else if (message.type === 'workflow:failed') {
        toast.error('Workflow failed');
      } else if (message.type === 'step:completed') {
        toast.info(`Step completed: ${message.data?.agentName || 'Agent'}`);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[SessionConnect] Connection error:', err);
      toast.error('Failed to connect to real-time updates');
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.emit('unsubscribe', sessionId);
        socket.disconnect();
      }
    };
  }, [sessionId, refetch]);

  // Stop workflow mutation
  const stopWorkflow = trpc.agentCollaboration.stopWorkflow.useMutation({
    onSuccess: () => {
      toast.success('Workflow stopped successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to stop workflow: ${error.message}`);
    },
  });

  const handleCopyToken = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      setCopiedToken(true);
      toast.success('Session ID copied to clipboard');
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleStopWorkflow = () => {
    if (sessionId) {
      stopWorkflow.mutate({
        workflowId: sessionId,
        reason: 'User requested cancellation',
      });
    }
  };

  const getStatusBadge = (status: WorkflowStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
      case 'running':
        return <Badge className="gap-1 bg-blue-500"><Loader2 className="w-3 h-3 animate-spin" /> Running</Badge>;
      case 'completed':
        return <Badge className="gap-1 bg-green-500"><CheckCircle className="w-3 h-3" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="gap-1"><AlertTriangle className="w-3 h-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navbar />
        <div className="pt-20 container mx-auto px-4 py-16 max-w-4xl">
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navbar />
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error?.message || 'Workflow not found'}
            </AlertDescription>
          </Alert>
          <Link href="/ai-collaboration">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Collaboration Hub
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/ai-collaboration">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                {workflow.task}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(workflow.status as WorkflowStatus)}
              {/* WebSocket Status Indicator */}
              <Badge variant="outline" className={isSocketConnected ? 'border-green-500/50 text-green-400' : 'border-gray-500/50 text-gray-400'}>
                {isSocketConnected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                {isSocketConnected ? 'Live' : 'Offline'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{workflow.steps?.length || 0} agents</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span className="capitalize">{workflow.orchestration} mode</span>
            </div>
          </div>
        </div>

        {/* Session Info Card */}
        <Card className="mb-6 glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Session Information
            </CardTitle>
            <CardDescription>
              Use this session ID to connect agents to the collaboration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="glass-subtle p-4 rounded-lg">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Session ID
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-foreground bg-muted/50 px-3 py-2 rounded">
                  {sessionId}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyToken}
                  className="flex-shrink-0"
                >
                  {copiedToken ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {workflow.memorySharing === 'enabled' && (
              <Alert className="bg-blue-500/10 border-blue-500/50">
                <Brain className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-200">
                  <strong>Shared Memory Enabled</strong> - Agents can access and contribute to shared context
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Workflow Steps */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Workflow Steps</CardTitle>
            <CardDescription>
              {workflow.orchestration === 'sequential'
                ? 'Agents will execute in sequence, passing outputs to the next step'
                : 'Agents will execute in parallel, results will be aggregated'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workflow.steps && workflow.steps.length > 0 ? (
                workflow.steps.map((step, index) => (
                  <div
                    key={index}
                    className="glass-subtle p-4 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-mono text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">
                          {step.agentName || step.agentId}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Agent ID: {step.agentId}
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(step.status as WorkflowStatus)}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No workflow steps available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {(workflow.status === 'running' || workflow.status === 'pending') && (
            <Button
              variant="destructive"
              onClick={handleStopWorkflow}
              disabled={stopWorkflow.isPending}
            >
              {stopWorkflow.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Pause className="w-4 h-4 mr-2" />
              )}
              Stop Workflow
            </Button>
          )}

          <Link href="/ai-collaboration">
            <Button variant="outline">
              View All Sessions
            </Button>
          </Link>

          {workflow.status === 'completed' && (
            <Button
              variant="default"
              onClick={() => setIsResultsDialogOpen(true)}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Results
            </Button>
          )}
        </div>

        {/* Results Dialog */}
        <WorkflowResultsDialog
          open={isResultsDialogOpen}
          onOpenChange={setIsResultsDialogOpen}
          workflowId={sessionId || ''}
          task={workflow.task}
          status={workflow.status}
          orchestration={workflow.orchestration}
          steps={workflow.steps?.map((step: any) => ({
            agent: step.agent || step.agentName,
            agentId: step.agentId,
            status: step.status,
            output: step.output,
            error: step.error,
            startedAt: step.startedAt,
            completedAt: step.completedAt,
            executionTime: step.executionTime,
          })) || []}
          sharedMemory={workflow.sharedMemory || {}}
          executionTime={workflow.executionTime}
        />
      </div>
    </div>
  );
}
