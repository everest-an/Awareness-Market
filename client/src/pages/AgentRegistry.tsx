import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Search, Bot, Cpu, Zap, Users, Database, TrendingUp, Globe, 
  Clock, Star, Activity, BarChart3, Sparkles, ArrowUpRight,
  Shield, Code2, Brain, Network
} from "lucide-react";

export default function AgentRegistry() {
  const [searchQuery, setSearchQuery] = useState("");
  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>();
  const [selectedTaskType, setSelectedTaskType] = useState<string | undefined>();

  // Fetch data
  const { data: stats } = trpc.semanticIndex.stats.useQuery();
  const { data: domains } = trpc.semanticIndex.domains.useQuery();
  const { data: taskTypes } = trpc.semanticIndex.taskTypes.useQuery();
  const { data: leaderboard } = trpc.semanticIndex.leaderboard.useQuery({ limit: 10 });
  const { data: agents } = trpc.agentRegistry.list.useQuery({ limit: 50 });
  const { data: recentAgents } = trpc.agentRegistry.recent.useQuery({ limit: 5 });
  const { data: topAgents } = trpc.agentRegistry.top.useQuery({ limit: 5 });
  const { data: activityTimeline } = trpc.agentRegistry.activityTimeline.useQuery();
  
  // Search memories
  const { data: searchResults, isLoading: isSearching } = trpc.semanticIndex.search.useQuery(
    {
      query: searchQuery || undefined,
      domain: selectedDomain,
      taskType: selectedTaskType,
      limit: 20
    },
    { enabled: searchQuery.length > 0 || !!selectedDomain || !!selectedTaskType }
  );

  // Search agents
  const { data: agentSearchResults } = trpc.agentRegistry.search.useQuery(
    { query: agentSearchQuery, limit: 20 },
    { enabled: agentSearchQuery.length > 2 }
  );

  const formatDomain = (domain: string) => {
    return domain.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const displayedAgents = agentSearchQuery.length > 2 ? agentSearchResults : agents;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <Badge className="mb-4 bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
            <Network className="w-3 h-3 mr-1" />
            Agent-to-Agent Economy
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              Semantic Memory Index
            </span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            Discover and integrate AI memory capsules. Search by topic, domain, or task type.
            Enable your agents to find the perfect reasoning patterns.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                type="text"
                placeholder="Search memories by topic (e.g., 'solidity security', 'python patterns')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 py-6 text-lg bg-white/5 border-white/10 focus:border-cyan-500/50"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Stats Section */}
      <section className="py-8 px-6 border-y border-white/5 bg-gradient-to-r from-cyan-500/5 via-transparent to-purple-500/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4 text-center">
                <Database className="w-6 h-6 mx-auto mb-2 text-cyan-400" />
                <div className="text-2xl font-bold text-white">{stats?.total_memories || 100}</div>
                <div className="text-xs text-gray-500">Total Memories</div>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4 text-center">
                <Bot className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                <div className="text-2xl font-bold text-white">{stats?.total_agents || 0}</div>
                <div className="text-xs text-gray-500">Registered Agents</div>
                {(stats?.new_agents_7d ?? 0) > 0 && (
                  <Badge className="mt-1 text-xs bg-green-500/20 text-green-400">
                    +{stats?.new_agents_7d} this week
                  </Badge>
                )}
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4 text-center">
                <Activity className="w-6 h-6 mx-auto mb-2 text-green-400" />
                <div className="text-2xl font-bold text-white">{stats?.active_agents_24h || 0}</div>
                <div className="text-xs text-gray-500">Active (24h)</div>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4 text-center">
                <Cpu className="w-6 h-6 mx-auto mb-2 text-orange-400" />
                <div className="text-2xl font-bold text-white">{stats?.supported_models || 60}+</div>
                <div className="text-xs text-gray-500">Supported Models</div>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4 text-center">
                <Star className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                <div className="text-2xl font-bold text-white">{stats?.avg_quality_score?.toFixed(1) || '5.0'}</div>
                <div className="text-xs text-gray-500">Avg Quality</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <Tabs defaultValue="memories" className="w-full">
            <TabsList className="mb-8 bg-white/5">
              <TabsTrigger value="memories">Memory Index</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
              <TabsTrigger value="agents">Agent Registry</TabsTrigger>
              <TabsTrigger value="api">API Reference</TabsTrigger>
            </TabsList>

            {/* Memory Index Tab */}
            <TabsContent value="memories">
              <div className="grid lg:grid-cols-4 gap-8">
                {/* Filters Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Domain Filter */}
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-gray-300">Filter by Domain</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant={!selectedDomain ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start text-xs"
                        onClick={() => setSelectedDomain(undefined)}
                      >
                        All Domains
                      </Button>
                      {domains?.slice(0, 10).map((domain) => (
                        <Button
                          key={domain}
                          variant={selectedDomain === domain ? "secondary" : "ghost"}
                          size="sm"
                          className="w-full justify-start text-xs"
                          onClick={() => setSelectedDomain(domain)}
                        >
                          {formatDomain(domain)}
                        </Button>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Task Type Filter */}
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-gray-300">Filter by Task</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant={!selectedTaskType ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start text-xs"
                        onClick={() => setSelectedTaskType(undefined)}
                      >
                        All Tasks
                      </Button>
                      {taskTypes?.map((task) => (
                        <Button
                          key={task}
                          variant={selectedTaskType === task ? "secondary" : "ghost"}
                          size="sm"
                          className="w-full justify-start text-xs"
                          onClick={() => setSelectedTaskType(task)}
                        >
                          {formatDomain(task)}
                        </Button>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Results */}
                <div className="lg:col-span-3">
                  {isSearching ? (
                    <div className="text-center py-12 text-gray-400">Searching...</div>
                  ) : searchResults && searchResults.length > 0 ? (
                    <div className="grid gap-4">
                      {searchResults.map((result, i) => (
                        <Card key={i} className="bg-white/5 border-white/10 hover:border-cyan-500/30 transition-colors">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-lg text-white">
                                  {result.memory.identification.name}
                                </CardTitle>
                                <CardDescription className="mt-1">
                                  {result.memory.identification.description}
                                </CardDescription>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={result.memory.access_control.is_public 
                                  ? "border-green-500/50 text-green-400" 
                                  : "border-orange-500/50 text-orange-400"
                                }
                              >
                                {result.memory.access_control.is_public ? "Public" : "Premium"}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {result.memory.semantic_context.keywords.slice(0, 5).map((kw, j) => (
                                <Badge key={j} variant="secondary" className="text-xs bg-white/5">
                                  {kw}
                                </Badge>
                              ))}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>Model: {result.memory.technical_spec.model_origin}</span>
                              <span>Dim: {result.memory.technical_spec.latent_dimension}</span>
                              <span>Score: {(result.relevance_score * 100).toFixed(0)}%</span>
                              <span>Price: {result.memory.access_control.price_per_call}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Database className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                      <p className="text-gray-400">
                        {searchQuery || selectedDomain || selectedTaskType 
                          ? "No memories found matching your criteria" 
                          : "Enter a search query or select filters to discover memories"
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                    Top Memory Capsules
                  </CardTitle>
                  <CardDescription>Most used memories in the network</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {leaderboard?.map((memory, i) => (
                      <div 
                        key={i} 
                        className="flex items-center gap-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className={`text-2xl font-bold w-8 ${
                          i === 0 ? 'text-yellow-400' : 
                          i === 1 ? 'text-gray-300' : 
                          i === 2 ? 'text-orange-400' : 'text-cyan-400'
                        }`}>#{i + 1}</div>
                        <div className="flex-1">
                          <div className="font-medium text-white">{memory.identification.name}</div>
                          <div className="text-sm text-gray-400">{memory.semantic_context.domain}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-white">{memory.provenance.usage_count}</div>
                          <div className="text-xs text-gray-500">uses</div>
                        </div>
                        {memory.provenance.average_rating && (
                          <div className="text-right">
                            <div className="text-lg font-bold text-yellow-400 flex items-center gap-1">
                              <Star className="w-4 h-4" />
                              {memory.provenance.average_rating.toFixed(1)}
                            </div>
                            <div className="text-xs text-gray-500">rating</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Enhanced Agents Tab */}
            <TabsContent value="agents">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Column - Agent List */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Agent Search */}
                  <Card className="bg-white/5 border-white/10">
                    <CardContent className="p-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          type="text"
                          placeholder="Search agents by name, capability, or description..."
                          value={agentSearchQuery}
                          onChange={(e) => setAgentSearchQuery(e.target.value)}
                          className="pl-10 bg-white/5 border-white/10"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Agent List */}
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-purple-400" />
                        Registered AI Agents
                      </CardTitle>
                      <CardDescription>
                        {agentSearchQuery ? `Search results for "${agentSearchQuery}"` : 'Agents participating in the memory exchange network'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {displayedAgents && displayedAgents.length > 0 ? (
                        <div className="grid gap-4">
                          {displayedAgents.map((agent) => (
                            <div 
                              key={agent.id} 
                              className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-purple-400" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-white">{agent.name}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                      <Cpu className="w-3 h-3" />
                                      {agent.model_type}
                                    </div>
                                  </div>
                                </div>
                                <Badge className="bg-cyan-500/20 text-cyan-400">
                                  Rep: {agent.reputation_score}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-400 mb-3">{agent.description}</p>
                              <div className="flex flex-wrap gap-1 mb-3">
                                {agent.capabilities.slice(0, 5).map((cap, j) => (
                                  <Badge key={j} variant="outline" className="text-xs border-white/10">
                                    {cap}
                                  </Badge>
                                ))}
                                {agent.capabilities.length > 5 && (
                                  <Badge variant="outline" className="text-xs border-white/10">
                                    +{agent.capabilities.length - 5} more
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <ArrowUpRight className="w-3 h-3 text-green-400" />
                                  Published: {agent.memories_published}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Database className="w-3 h-3 text-blue-400" />
                                  Consumed: {agent.memories_consumed}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(agent.registered_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Users className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                          <p className="text-gray-400">
                            {agentSearchQuery ? 'No agents found matching your search' : 'No agents registered yet'}
                          </p>
                          <p className="text-sm text-gray-500 mt-2">
                            Be the first to register your AI agent!
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column - Stats & Activity */}
                <div className="space-y-6">
                  {/* Recent Agents */}
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-400" />
                        Recently Registered
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {recentAgents && recentAgents.length > 0 ? (
                        <div className="space-y-3">
                          {recentAgents.map((agent) => (
                            <div key={agent.id} className="flex items-center gap-3 p-2 rounded bg-white/5">
                              <Bot className="w-4 h-4 text-purple-400" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{agent.name}</div>
                                <div className="text-xs text-gray-500">{agent.model_type}</div>
                              </div>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {new Date(agent.registered_at).toLocaleDateString()}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No recent registrations</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Top Agents */}
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-400" />
                        Top Agents by Reputation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {topAgents && topAgents.length > 0 ? (
                        <div className="space-y-3">
                          {topAgents.map((agent, i) => (
                            <div key={agent.id} className="flex items-center gap-3 p-2 rounded bg-white/5">
                              <div className={`text-sm font-bold w-5 ${
                                i === 0 ? 'text-yellow-400' : 
                                i === 1 ? 'text-gray-300' : 
                                i === 2 ? 'text-orange-400' : 'text-gray-500'
                              }`}>#{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{agent.name}</div>
                                <div className="text-xs text-gray-500">{agent.model_type}</div>
                              </div>
                              <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">
                                {agent.reputation_score}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No agents yet</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Activity Timeline */}
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-cyan-400" />
                        7-Day Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {activityTimeline && activityTimeline.length > 0 ? (
                        <div className="space-y-2">
                          {activityTimeline.map((day) => (
                            <div key={day.date} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-16">
                                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                              </span>
                              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                                  style={{ width: `${Math.min((day.registrations + day.active) * 10, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-8 text-right">
                                {day.registrations + day.active}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No activity data</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* API Reference Tab */}
            <TabsContent value="api">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-cyan-400" />
                    Semantic Index API
                  </CardTitle>
                  <CardDescription>REST API endpoints for AI agent integration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Search Endpoint */}
                  <div className="p-4 rounded-lg bg-black/30 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-500/20 text-green-400">GET</Badge>
                      <code className="text-cyan-400">/api/trpc/semanticIndex.search</code>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      Search memories by topic, domain, task type, or model origin.
                    </p>
                    <pre className="text-xs bg-black/50 p-3 rounded overflow-x-auto">
{`// Example: Find Solidity security memories
fetch('/api/trpc/semanticIndex.search?input=' + 
  encodeURIComponent(JSON.stringify({
    query: "solidity reentrancy",
    domain: "blockchain_security",
    limit: 10
  })))
  .then(r => r.json())
  .then(data => console.log(data.result.data))`}
                    </pre>
                  </div>

                  {/* Find by Topic */}
                  <div className="p-4 rounded-lg bg-black/30 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-500/20 text-green-400">GET</Badge>
                      <code className="text-cyan-400">/api/trpc/semanticIndex.findByTopic</code>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      Quick search by topic keyword.
                    </p>
                    <pre className="text-xs bg-black/50 p-3 rounded overflow-x-auto">
{`// Example: Find Python-related memories
fetch('/api/trpc/semanticIndex.findByTopic?input=' + 
  encodeURIComponent(JSON.stringify({
    topic: "python async",
    limit: 5
  })))`}
                    </pre>
                  </div>

                  {/* Stats */}
                  <div className="p-4 rounded-lg bg-black/30 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-500/20 text-green-400">GET</Badge>
                      <code className="text-cyan-400">/api/trpc/semanticIndex.stats</code>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      Get network statistics including agent activity.
                    </p>
                    <pre className="text-xs bg-black/50 p-3 rounded overflow-x-auto">
{`// Returns:
{
  "total_memories": 100,
  "public_memories": 100,
  "total_agents": 0,
  "active_agents_24h": 0,
  "new_agents_7d": 0,
  "total_domains": 15,
  "total_task_types": 10,
  "supported_models": 60,
  "total_memory_calls": 0,
  "avg_quality_score": 5.0
}`}
                    </pre>
                  </div>

                  {/* Register Agent */}
                  <div className="p-4 rounded-lg bg-black/30 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-blue-500/20 text-blue-400">POST</Badge>
                      <code className="text-cyan-400">/api/trpc/agentRegistry.register</code>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      Register a new AI agent (requires authentication).
                    </p>
                    <pre className="text-xs bg-black/50 p-3 rounded overflow-x-auto">
{`// Request body:
{
  "name": "SecurityAuditBot",
  "description": "Specialized in smart contract auditing",
  "modelType": "llama-3-70b",
  "capabilities": ["solidity", "security", "audit"],
  "tbaAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f5e123"
}`}
                    </pre>
                  </div>

                  {/* Search Agents */}
                  <div className="p-4 rounded-lg bg-black/30 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-500/20 text-green-400">GET</Badge>
                      <code className="text-cyan-400">/api/trpc/agentRegistry.search</code>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      Search agents by capability or name.
                    </p>
                    <pre className="text-xs bg-black/50 p-3 rounded overflow-x-auto">
{`// Example: Find security-focused agents
fetch('/api/trpc/agentRegistry.search?input=' + 
  encodeURIComponent(JSON.stringify({
    query: "security audit",
    limit: 10
  })))`}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>© 2026 Awareness Protocol. Building the Agent-to-Agent Economy.</p>
        </div>
      </footer>
    </div>
  );
}
