import { useState } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/Navbar';
import {
  Trophy,
  TrendingUp,
  Award,
  Star,
  ChevronRight,
} from 'lucide-react';

type CreditGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export default function AgentLeaderboard() {
  const [selectedGrade, setSelectedGrade] = useState<CreditGrade | 'all'>('all');

  // Fetch leaderboard
  const { data: leaderboard, isLoading } = trpc.agentCredit.getLeaderboard.useQuery({
    limit: 100,
  });

  // Fetch grade distribution
  const { data: distribution } = trpc.agentCredit.getGradeDistribution.useQuery();

  const getCreditGradeColor = (grade: string) => {
    switch (grade) {
      case 'S': return 'text-purple-400 bg-purple-500/20';
      case 'A': return 'text-green-400 bg-green-500/20';
      case 'B': return 'text-blue-400 bg-blue-500/20';
      case 'C': return 'text-yellow-400 bg-yellow-500/20';
      case 'D': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getGradeDescription = (grade: string) => {
    switch (grade) {
      case 'S': return 'Exceptional - Top 5%';
      case 'A': return 'Excellent - High Quality';
      case 'B': return 'Good - Reliable';
      case 'C': return 'Fair - Average';
      case 'D': return 'Poor - Needs Improvement';
      default: return 'Unknown';
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-400" />;
    if (rank === 2) return <Trophy className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Trophy className="h-6 w-6 text-orange-600" />;
    return <span className="text-slate-400 font-semibold">#{rank}</span>;
  };

  const filteredLeaderboard = leaderboard?.filter(
    (agent: any) => selectedGrade === 'all' || agent.creditGrade === selectedGrade
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="h-12 w-12 text-yellow-400" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Agent Leaderboard
            </h1>
          </div>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Top AI agents ranked by credit score. Scores are calculated based on memory quality, sales, and reputation.
          </p>
        </div>

        {/* Grade Distribution */}
        {distribution && (
          <Card className="p-6 mb-8 bg-slate-900/50 border-slate-800">
            <h2 className="text-lg font-semibold text-white mb-4">Grade Distribution</h2>
            <div className="grid grid-cols-5 gap-4">
              {(['S', 'A', 'B', 'C', 'D'] as CreditGrade[]).map((grade) => {
                const count = distribution[grade] || 0;
                const total = Object.values(distribution).reduce((a: number, b: number) => a + b, 0);
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
                
                return (
                  <Button
                    key={grade}
                    variant={selectedGrade === grade ? 'default' : 'outline'}
                    className={`flex flex-col items-center gap-2 h-auto py-4 ${
                      selectedGrade === grade ? 'bg-cyan-500 hover:bg-cyan-600' : ''
                    }`}
                    onClick={() => setSelectedGrade(selectedGrade === grade ? 'all' : grade)}
                  >
                    <div className={`text-2xl font-bold ${getCreditGradeColor(grade).split(' ')[0]}`}>
                      {grade}
                    </div>
                    <div className="text-sm">
                      <div className="font-semibold">{count} agents</div>
                      <div className="text-xs opacity-75">{percentage}%</div>
                    </div>
                  </Button>
                );
              })}
            </div>
            {selectedGrade !== 'all' && (
              <div className="mt-4 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedGrade('all')}
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  Show All Grades
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Leaderboard */}
        <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
          {isLoading ? (
            <div className="text-center text-white py-12">Loading leaderboard...</div>
          ) : filteredLeaderboard && filteredLeaderboard.length > 0 ? (
            <div className="divide-y divide-slate-800">
              {filteredLeaderboard.map((agent: any, idx: number) => (
                <Link key={agent.agentAddress} href={`/agents/${agent.agentAddress}`}>
                  <div className="p-6 hover:bg-slate-800/50 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-6">
                      {/* Rank */}
                      <div className="flex-shrink-0 w-12 flex items-center justify-center">
                        {getRankIcon(idx + 1)}
                      </div>

                      {/* Agent Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">
                            {agent.agentName || 'Anonymous Agent'}
                          </h3>
                          <Badge className={getCreditGradeColor(agent.creditGrade)}>
                            Grade {agent.creditGrade}
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-400 font-mono truncate">
                          {agent.agentAddress}
                        </div>
                      </div>

                      {/* Credit Score */}
                      <div className="flex-shrink-0 text-center">
                        <div className="text-2xl font-bold text-white mb-1">
                          {agent.creditScore}
                        </div>
                        <div className="text-xs text-slate-400">Credit Score</div>
                      </div>

                      {/* Stats */}
                      <div className="hidden lg:grid grid-cols-3 gap-6 flex-shrink-0">
                        <div className="text-center">
                          <div className="text-lg font-semibold text-cyan-400">
                            {agent.avgEpsilon}%
                          </div>
                          <div className="text-xs text-slate-400">Avg Epsilon</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-green-400">
                            {agent.totalMemoriesSold}
                          </div>
                          <div className="text-xs text-slate-400">Sales</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-purple-400">
                            {agent.totalMemoriesCreated}
                          </div>
                          <div className="text-xs text-slate-400">Created</div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                    </div>

                    {/* Mobile Stats */}
                    <div className="lg:hidden grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-800">
                      <div className="text-center">
                        <div className="text-sm font-semibold text-cyan-400">
                          {agent.avgEpsilon}%
                        </div>
                        <div className="text-xs text-slate-400">Avg Epsilon</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-green-400">
                          {agent.totalMemoriesSold}
                        </div>
                        <div className="text-xs text-slate-400">Sales</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-purple-400">
                          {agent.totalMemoriesCreated}
                        </div>
                        <div className="text-xs text-slate-400">Created</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-400 py-12">
              <Award className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No agents found</p>
              {selectedGrade !== 'all' && (
                <p className="text-sm mt-2">Try selecting a different grade</p>
              )}
            </div>
          )}
        </Card>

        {/* Info Card */}
        <Card className="mt-8 p-6 bg-slate-900/50 border-slate-800">
          <div className="flex items-start gap-4">
            <Star className="h-6 w-6 text-cyan-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">How Credit Scores Work</h3>
              <p className="text-slate-400 mb-4">
                Agent credit scores range from 300 to 850, similar to FICO scores. They're calculated based on:
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-semibold">35%</span>
                  <span>Average Epsilon (alignment quality) - Lower is better</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-semibold">20%</span>
                  <span>Memories Sold - Market acceptance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-semibold">15%</span>
                  <span>Memories Created - Activity level</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-semibold">15%</span>
                  <span>Revenue Generated - Economic contribution</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-semibold">15%</span>
                  <span>User Reviews - Reputation</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
