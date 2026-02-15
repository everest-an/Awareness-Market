/**
 * AI Collaboration Sessions List
 *
 * Displays user's collaboration workflow sessions with filtering and sorting.
 * Integrates with agentCollaboration.listWorkflows API.
 */

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Brain,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Search,
  ArrowLeft,
  Play,
  Users,
  Zap,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { trpc } from '@/lib/trpc';

type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export default function SessionsList() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orchestrationFilter, setOrchestrationFilter] = useState<string>('all');

  // Fetch user's workflows
  const { data: workflowData, isLoading, error, refetch } = trpc.agentCollaboration.listWorkflows.useQuery(
    undefined,
    {
      refetchInterval: 5000, // Refresh every 5 seconds
    }
  );

  // Filter workflows based on search and filters
  const filteredWorkflows = workflowData?.workflows.filter((workflow) => {
    const matchesSearch = searchQuery
      ? workflow.task.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter;
    const matchesOrchestration = orchestrationFilter === 'all' || workflow.orchestration === orchestrationFilter;

    return matchesSearch && matchesStatus && matchesOrchestration;
  }) || [];

  // Calculate statistics
  const stats = {
    total: workflowData?.workflows.length || 0,
    running: workflowData?.workflows.filter(w => w.status === 'running' || w.status === 'pending').length || 0,
    completed: workflowData?.workflows.filter(w => w.status === 'completed').length || 0,
    failed: workflowData?.workflows.filter(w => w.status === 'failed' || w.status === 'cancelled').length || 0,
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

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="pt-20 container mx-auto px-4 py-16 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/ai-collaboration">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Hub
            </Button>
          </Link>

          <h1 className="text-4xl font-bold text-white mb-2">
            My Collaboration Sessions
          </h1>
          <p className="text-slate-400">
            View and manage your AI collaboration workflows
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardDescription>Total Sessions</CardDescription>
              <CardTitle className="text-3xl text-foreground">{stats.total}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardDescription>Running</CardDescription>
              <CardTitle className="text-3xl text-blue-400">{stats.running}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-3xl text-green-400">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardDescription>Failed</CardDescription>
              <CardTitle className="text-3xl text-red-400">{stats.failed}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card className="glass-panel mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sessions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background/50"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px] bg-background/50">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Orchestration Filter */}
              <Select value={orchestrationFilter} onValueChange={setOrchestrationFilter}>
                <SelectTrigger className="w-full md:w-[180px] bg-background/50">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="sequential">Sequential</SelectItem>
                  <SelectItem value="parallel">Parallel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
            <p className="text-muted-foreground">Loading sessions...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load sessions: {error.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredWorkflows.length === 0 && (
          <Card className="glass-panel">
            <CardContent className="pt-6 text-center py-12">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
              <p className="text-foreground mb-2">
                {workflowData?.workflows.length === 0
                  ? 'No collaboration sessions yet'
                  : 'No sessions match your filters'}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                {workflowData?.workflows.length === 0
                  ? 'Create your first AI collaboration session to get started'
                  : 'Try adjusting your search or filters'}
              </p>
              {workflowData?.workflows.length === 0 && (
                <Link href="/ai-collaboration/new">
                  <Button className="bg-gradient-to-r from-purple-500 to-cyan-500">
                    <Play className="w-4 h-4 mr-2" />
                    Create Session
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sessions List */}
        {!isLoading && !error && filteredWorkflows.length > 0 && (
          <div className="space-y-4">
            {filteredWorkflows.map((workflow) => (
              <Card
                key={workflow.id}
                className="glass-card-hover cursor-pointer"
                onClick={() => setLocation(`/ai-collaboration/connect/${workflow.id}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <Brain className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-semibold text-foreground">
                          {workflow.task}
                        </h3>
                        {getStatusBadge(workflow.status as WorkflowStatus)}
                      </div>

                      {/* Metadata Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Users className="w-4 h-4" />
                            <span>Agents</span>
                          </div>
                          <p className="font-mono text-foreground">{workflow.agentCount}</p>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Zap className="w-4 h-4" />
                            <span>Mode</span>
                          </div>
                          <p className="capitalize text-foreground">{workflow.orchestration}</p>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Clock className="w-4 h-4" />
                            <span>Duration</span>
                          </div>
                          <p className="font-mono text-foreground">
                            {formatDuration(workflow.executionTime)}
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Clock className="w-4 h-4" />
                            <span>Started</span>
                          </div>
                          <p className="text-foreground">
                            {formatDate(workflow.startedAt)}
                          </p>
                        </div>
                      </div>

                      {/* Completion Info */}
                      {workflow.completedAt && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          Completed: {formatDate(workflow.completedAt)}
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/ai-collaboration/connect/${workflow.id}`);
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create New Session Button */}
        {!isLoading && filteredWorkflows.length > 0 && (
          <div className="mt-8 text-center">
            <Link href="/ai-collaboration/new">
              <Button size="lg" className="bg-gradient-to-r from-purple-500 to-cyan-500">
                <Play className="w-4 h-4 mr-2" />
                Create New Session
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
