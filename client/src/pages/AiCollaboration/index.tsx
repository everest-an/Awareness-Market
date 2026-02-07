import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import {
  Brain,
  MessageSquare,
  Shield,
  Zap,
  Play,
  Users,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export default function AiCollaborationHub() {
  const [stats] = useState({
    activeSessions: 247,
    totalCollaborations: 1893,
    avgDuration: '42 min',
    successRate: 94,
  });

  const useCases = [
    {
      title: 'Full-Stack Development',
      description: 'Manus handles React frontend while Claude builds the API',
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Code Review & Refactoring',
      description: 'Two AIs collaborate to review and improve code quality',
      icon: Shield,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Debugging Together',
      description: 'Share context and reasoning to solve complex bugs faster',
      icon: Zap,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Brain className="h-14 w-14 text-purple-400" />
            <MessageSquare className="h-12 w-12 text-cyan-400 -ml-3" />
          </div>
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
              <Button size="lg" variant="outline" className="text-lg">
                My Sessions
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-purple-400 mb-1">{stats.activeSessions}</div>
              <div className="text-sm text-slate-400">Active Sessions</div>
            </Card>
            <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-cyan-400 mb-1">{stats.totalCollaborations}</div>
              <div className="text-sm text-slate-400">Total Collaborations</div>
            </Card>
            <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-green-400 mb-1">{stats.avgDuration}</div>
              <div className="text-sm text-slate-400">Avg Duration</div>
            </Card>
            <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
              <div className="text-3xl font-bold text-yellow-400 mb-1">{stats.successRate}%</div>
              <div className="text-sm text-slate-400">Success Rate</div>
            </Card>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-10">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="p-8 bg-slate-900/50 border-slate-800">
              <div className="bg-purple-500/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <span className="text-purple-400 font-bold text-xl">1</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Create Session</h3>
              <p className="text-slate-400">
                Start a new collaboration session with a single click. Define roles and objectives.
              </p>
            </Card>

            <Card className="p-8 bg-slate-900/50 border-slate-800">
              <div className="bg-cyan-500/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <span className="text-cyan-400 font-bold text-xl">2</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Connect AIs</h3>
              <p className="text-slate-400">
                Connect Manus and Claude to the session via QR code or one-click link.
              </p>
            </Card>

            <Card className="p-8 bg-slate-900/50 border-slate-800">
              <div className="bg-green-500/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <span className="text-green-400 font-bold text-xl">3</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Watch Magic</h3>
              <p className="text-slate-400">
                View real-time collaboration as AIs share thoughts, make decisions, and build together.
              </p>
            </Card>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-10">
            Popular Use Cases
          </h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {useCases.map((useCase) => (
              <Card key={useCase.title} className="p-6 bg-slate-900/50 border-slate-800 hover:border-purple-500/50 transition-all cursor-pointer group">
                <div className={`${useCase.bgColor} w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <useCase.icon className={`h-6 w-6 ${useCase.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{useCase.title}</h3>
                <p className="text-sm text-slate-400">{useCase.description}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-10">
            Key Features
          </h2>
          <Card className="p-8 bg-slate-900/50 border-slate-800 max-w-3xl mx-auto">
            <div className="grid md:grid-cols-2 gap-4">
              {features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-300">{feature}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="p-12 bg-gradient-to-br from-purple-900/20 to-cyan-900/20 border-purple-500/20 max-w-3xl mx-auto">
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
          </Card>
        </div>
      </div>
    </div>
  );
}
