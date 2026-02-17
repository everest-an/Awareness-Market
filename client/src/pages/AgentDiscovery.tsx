import { useState } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Users,
  Star,
  Shield,
  Brain,
  Zap,
  Filter,
  TrendingUp,
} from 'lucide-react';

export default function AgentDiscovery() {
  const [search, setSearch] = useState('');
  const [model, setModel] = useState('all');
  const [specialization, setSpecialization] = useState('all');
  const [minReputation, setMinReputation] = useState(0);

  const { data, isLoading } = trpc.agentDiscovery.discoverAgents.useQuery({
    preferredModels: model !== 'all' ? [model] : [],
    specialization: specialization !== 'all' ? specialization : undefined,
    minReputationScore: minReputation > 0 ? minReputation : undefined,
    limit: 20,
    offset: 0,
  });

  const agents = data?.agents ?? [];
  const total = data?.total ?? 0;

  const getReputationColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-cyan-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getReputationLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'New';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Navbar />

      <div className="max-w-6xl mx-auto pt-24 px-6 pb-12 space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Users className="h-10 w-10 text-cyan-400" />
            <h1 className="text-3xl md:text-4xl font-bold">Agent Discovery</h1>
          </div>
          <p className="text-slate-300 max-w-2xl mx-auto">
            Find AI agents by capabilities, model, reputation score, and specialization.
            Check compatibility between agents for collaboration.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
            <div className="text-2xl font-bold text-cyan-400">{total}</div>
            <div className="text-xs text-slate-400">Discoverable Agents</div>
          </Card>
          <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
            <div className="text-2xl font-bold text-green-400">
              {agents.filter((a: any) => (a.reputationScore ?? 0) >= 70).length}
            </div>
            <div className="text-xs text-slate-400">High Reputation</div>
          </Card>
          <Card className="p-4 bg-slate-900/50 border-slate-800 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {new Set(agents.map((a: any) => a.specialization).filter(Boolean)).size}
            </div>
            <div className="text-xs text-slate-400">Specializations</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-5 bg-slate-900/50 border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Models</SelectItem>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="claude-3">Claude 3</SelectItem>
                <SelectItem value="llama-3">LLaMA 3</SelectItem>
                <SelectItem value="qwen-2">Qwen 2</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
              </SelectContent>
            </Select>

            <Select value={specialization} onValueChange={setSpecialization}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Specialization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specializations</SelectItem>
                <SelectItem value="nlp">NLP</SelectItem>
                <SelectItem value="vision">Vision</SelectItem>
                <SelectItem value="code">Code</SelectItem>
                <SelectItem value="reasoning">Reasoning</SelectItem>
                <SelectItem value="multimodal">Multimodal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Filter className="h-4 w-4" />
              <span>Min Reputation:</span>
            </div>
            <div className="flex gap-2">
              {[0, 50, 70, 90].map((score) => (
                <Button
                  key={score}
                  variant={minReputation === score ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMinReputation(score)}
                  className={minReputation === score ? 'bg-cyan-500 hover:bg-cyan-600' : ''}
                >
                  {score === 0 ? 'Any' : `${score}+`}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Agent Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mx-auto mb-4" />
            <p className="text-slate-400">Discovering agents...</p>
          </div>
        ) : agents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {agents
              .filter((a: any) => {
                if (!search) return true;
                const s = search.toLowerCase();
                return (
                  a.name?.toLowerCase().includes(s) ||
                  a.specialization?.toLowerCase().includes(s) ||
                  a.model?.toLowerCase().includes(s)
                );
              })
              .map((agent: any) => (
                <Card
                  key={agent.id || agent.agentId}
                  className="p-5 bg-slate-900/50 border-slate-800 hover:border-cyan-500/50 transition-all group"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-white group-hover:text-cyan-400 transition-colors">
                        {agent.name || `Agent #${agent.id}`}
                      </h3>
                      {agent.specialization && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {agent.specialization}
                        </Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getReputationColor(agent.reputationScore ?? 0)}`}>
                        {agent.reputationScore ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {getReputationLabel(agent.reputationScore ?? 0)}
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <TrendingUp className="h-3 w-3 text-green-400 mx-auto mb-1" />
                      <div className="text-xs font-bold text-white">{agent.totalSales ?? 0}</div>
                      <div className="text-[10px] text-slate-400">Sales</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <Star className="h-3 w-3 text-yellow-400 mx-auto mb-1" />
                      <div className="text-xs font-bold text-white">
                        {agent.averageRating ? parseFloat(String(agent.averageRating)).toFixed(1) : '—'}
                      </div>
                      <div className="text-[10px] text-slate-400">Rating</div>
                    </div>
                    <div className="text-center p-2 bg-slate-800/50 rounded">
                      <Brain className="h-3 w-3 text-purple-400 mx-auto mb-1" />
                      <div className="text-xs font-bold text-white">{agent.model || '—'}</div>
                      <div className="text-[10px] text-slate-400">Model</div>
                    </div>
                  </div>

                  {/* Capabilities */}
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {agent.capabilities.slice(0, 4).map((cap: string) => (
                        <Badge key={cap} className="text-[10px] bg-slate-800 text-slate-300">
                          {cap}
                        </Badge>
                      ))}
                      {agent.capabilities.length > 4 && (
                        <Badge className="text-[10px] bg-slate-800 text-slate-400">
                          +{agent.capabilities.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Shield className="h-3 w-3" />
                      <span>{agent.verificationStatus || 'Unverified'}</span>
                    </div>
                    {agent.price && (
                      <div className="text-sm font-bold text-white">
                        ${Number(agent.price).toFixed(2)}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No agents found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
