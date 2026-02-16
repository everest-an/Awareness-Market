import { useMemo } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import {
  Play,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function AiCollaborationHub() {
  // Fetch real collaboration workflows
  const { data: workflowData } = trpc.agentCollaboration.listWorkflows.useQuery(undefined, {
    refetchInterval: 10000,
  });

  // Calculate real statistics from API data
  const stats = useMemo(() => {
    if (!workflowData?.workflows) {
      return { activeSessions: 0, totalCollaborations: 0, avgDuration: '0 min', successRate: 0 };
    }

    const workflows = workflowData.workflows;
    const activeSessions = workflows.filter(
      w => w.status === 'running' || w.status === 'pending'
    ).length;

    const completedWorkflows = workflows.filter(w => w.status === 'completed');
    const totalCollaborations = workflows.length;
    const successRate = totalCollaborations > 0
      ? Math.round((completedWorkflows.length / totalCollaborations) * 100)
      : 0;

    const durations = completedWorkflows
      .map(w => w.executionTime)
      .filter((d): d is number => d !== null && d !== undefined);

    const avgDurationMs = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    const avgDuration = avgDurationMs > 0
      ? `${Math.round(avgDurationMs / 60000)} min`
      : '0 min';

    return { activeSessions, totalCollaborations, avgDuration, successRate };
  }, [workflowData]);

  const useCases = [
    {
      title: 'Full-Stack Development',
      description: 'Manus handles React frontend while Claude builds the API',
    },
    {
      title: 'Code Review & Refactoring',
      description: 'Two AIs collaborate to review and improve code quality',
    },
    {
      title: 'Debugging Together',
      description: 'Share context and reasoning to solve complex bugs faster',
    },
  ];

  const features = [
    'Real-time thought sharing between AIs',
    'Synchronized progress tracking',
    'Shared decision-making system',
    'Live collaboration dashboard',
    'Automatic context handoff',
    'Cross-model memory transfer',
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-28 pb-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            AI Collaboration
          </h1>
          <p className="text-2xl text-slate-300 max-w-3xl mx-auto mb-8">
            Let <span className="text-purple-400 font-semibold">Manus</span> and{' '}
            <span className="text-cyan-400 font-semibold">Claude</span> work together
            in a shared cognitive space
          </p>

          <div className="flex items-center justify-center gap-4 mb-12">
            <Link href="/ai-collaboration/new">
              <Button size="lg" className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-lg px-8">
                <Play className="h-5 w-5 mr-2" />
                Start New Session
              </Button>
            </Link>
            <Link href="/ai-collaboration/sessions">
              <Button size="lg" variant="outline" className="text-lg bg-transparent border-white/20 hover:bg-white/5">
                My Sessions
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="glass-card p-4 text-center">
              <div className="text-3xl font-bold text-purple-400 mb-1">{stats.activeSessions}</div>
              <div className="text-sm text-slate-400">Active Sessions</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-3xl font-bold text-cyan-400 mb-1">{stats.totalCollaborations}</div>
              <div className="text-sm text-slate-400">Total Collaborations</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-3xl font-bold text-green-400 mb-1">{stats.avgDuration}</div>
              <div className="text-sm text-slate-400">Avg Duration</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400 mb-1">{stats.successRate}%</div>
              <div className="text-sm text-slate-400">Success Rate</div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-10">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="glass-card p-8">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <span className="text-purple-400 font-bold text-lg">1</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Create Session</h3>
              <p className="text-slate-400">
                Start a new collaboration session with a single click. Define roles and objectives.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <span className="text-cyan-400 font-bold text-lg">2</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Connect AIs</h3>
              <p className="text-slate-400">
                Connect Manus and Claude to the session via QR code or one-click link.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <span className="text-green-400 font-bold text-lg">3</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Watch Magic</h3>
              <p className="text-slate-400">
                View real-time collaboration as AIs share thoughts, make decisions, and build together.
              </p>
            </div>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-10">
            Popular Use Cases
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {useCases.map((useCase) => (
              <div key={useCase.title} className="glass-card-hover p-6 cursor-pointer">
                <h3 className="text-lg font-semibold text-white mb-2">{useCase.title}</h3>
                <p className="text-sm text-slate-400">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-10">
            Key Features
          </h2>
          <div className="glass-card p-8 max-w-3xl mx-auto">
            <div className="grid md:grid-cols-2 gap-4">
              {features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <div className="glass-card p-12 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to unlock AI teamwork?
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Experience the future of collaborative AI development
            </p>
            <Link href="/ai-collaboration/new">
              <Button size="lg" className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-lg px-12">
                <Play className="h-5 w-5 mr-2" />
                Start Your First Session
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
