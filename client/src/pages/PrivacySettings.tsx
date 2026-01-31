import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Shield, Activity, TestTube, Info, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
} from 'recharts';

interface SimulationResult {
  analysis: {
    noiseScale: number;
    meanNoise: number;
    stdDevNoise: number;
  };
  interpretation: string;
  noisyVector: number[];
}

interface PrivacySettingsData {
  differentialPrivacyEnabled?: boolean;
  defaultEpsilon?: number;
  defaultDelta?: number;
  monthlyBudget?: number;
  totalPrivacyBudget?: number;
  autoRenewBudget?: boolean;
  budgetRemaining?: number;
  remainingPrivacyBudget?: number;
  nextResetDate?: string;
}

interface BudgetHistoryItem {
  date: string;
  budgetRemaining: number;
  budgetUsed: number;
}

export default function PrivacySettings() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Privacy Settings State
  const [epsilonEnabled, setEpsilonEnabled] = useState(false);
  const [epsilon, setEpsilon] = useState(1.0);
  const [delta, setDelta] = useState(1e-5);
  const [monthlyBudget, setMonthlyBudget] = useState(10.0);
  const [autoRenew, setAutoRenew] = useState(true);

  // Simulator State
  const [simulatorVector, setSimulatorVector] = useState('');
  const [simulatorEpsilon, setSimulatorEpsilon] = useState(1.0);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  // Fetch current settings
  const { data: privacySettings, refetch: refetchSettings } = trpc.user.getPrivacySettings.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Fetch budget history
  const { data: budgetHistory } = trpc.user.getPrivacyBudgetHistory.useQuery(
    { limit: 30 },
    { enabled: !!user }
  );

  // Update settings mutation
  const updateSettingsMutation = trpc.user.updatePrivacySettings.useMutation({
    onSuccess: () => {
      toast.success("Privacy settings updated successfully");
      refetchSettings();
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });

  // Simulate privacy mutation
  const simulateMutation = trpc.user.simulatePrivacy.useMutation({
    onSuccess: (data) => {
      setSimulationResult(data);
      toast.success("Privacy simulation completed");
    },
    onError: (error) => {
      toast.error(`Simulation failed: ${error.message}`);
    },
  });

  // Initialize from fetched settings
  useEffect(() => {
    if (privacySettings) {
      const settings = privacySettings as PrivacySettingsData;
      setEpsilonEnabled(settings.differentialPrivacyEnabled ?? true);
      setEpsilon(settings.defaultEpsilon ?? 1.0);
      setDelta(settings.defaultDelta ?? 1e-5);
      setMonthlyBudget(settings.monthlyBudget ?? settings.totalPrivacyBudget ?? 10.0);
      setAutoRenew(settings.autoRenewBudget ?? false);
    }
  }, [privacySettings]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      defaultPrivacyLevel: 'medium',
      enableAutoPrivacy: epsilonEnabled,
    });
  };

  const handleSimulate = () => {
    try {
      const vector = JSON.parse(simulatorVector);
      if (!Array.isArray(vector)) {
        toast.error("Vector must be a JSON array of numbers");
        return;
      }
      simulateMutation.mutate({
        vectorDimension: vector.length,
        privacyLevel: 'custom',
        customEpsilon: simulatorEpsilon,
      });
    } catch (error) {
      toast.error("Invalid JSON format");
    }
  };

  const settings = privacySettings as PrivacySettingsData | undefined;
  const budgetRemaining = settings?.budgetRemaining ?? settings?.remainingPrivacyBudget ?? monthlyBudget;
  const budgetUsed = monthlyBudget - budgetRemaining;
  const budgetPercentage = (budgetUsed / monthlyBudget) * 100;

  // Chart data
  const budgetChartData = budgetHistory?.history?.map((item: BudgetHistoryItem) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    remaining: item.budgetRemaining,
    used: item.budgetUsed,
  })) || [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <div className="pt-20 border-b border-white/5">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Privacy <span className="gradient-text">Settings</span>
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage differential privacy protection for your vector uploads
              </p>
            </div>
            <Button variant="outline" onClick={() => setLocation("/profile")}>
              Back to Profile
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Privacy Budget Status */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Monthly Budget</span>
                </div>
                <p className="text-3xl font-bold">{monthlyBudget.toFixed(2)} ε</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Remaining</span>
                </div>
                <p className="text-3xl font-bold">{budgetRemaining.toFixed(2)} ε</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Usage</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold">{budgetPercentage.toFixed(0)}%</p>
                  <Badge variant={budgetPercentage > 80 ? "destructive" : "secondary"}>
                    {budgetPercentage > 80 ? "High" : "Normal"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Budget Progress Bar */}
            <div className="mt-4">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${budgetPercentage > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings">
              <Shield className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="history">
              <Activity className="h-4 w-4 mr-2" />
              Budget History
            </TabsTrigger>
            <TabsTrigger value="simulator">
              <TestTube className="h-4 w-4 mr-2" />
              Privacy Simulator
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Differential Privacy Configuration</CardTitle>
                <CardDescription>
                  Configure (ε, δ)-differential privacy for your vector uploads
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Differential Privacy</Label>
                    <p className="text-sm text-muted-foreground">
                      Add calibrated noise to vectors for privacy protection
                    </p>
                  </div>
                  <Switch
                    checked={epsilonEnabled}
                    onCheckedChange={setEpsilonEnabled}
                  />
                </div>

                <Separator />

                {/* Epsilon Setting */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Privacy Budget (ε - Epsilon)</Label>
                    <Badge variant="outline">{epsilon.toFixed(2)}</Badge>
                  </div>
                  <Slider
                    value={[epsilon]}
                    onValueChange={(values) => setEpsilon(values[0])}
                    min={0.1}
                    max={10}
                    step={0.1}
                    disabled={!epsilonEnabled}
                  />
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <p className="font-medium">0.1-1.0</p>
                      <p>High privacy</p>
                    </div>
                    <div>
                      <p className="font-medium">1.0-3.0</p>
                      <p>Balanced</p>
                    </div>
                    <div>
                      <p className="font-medium">3.0-10.0</p>
                      <p>High utility</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Delta Setting */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Failure Probability (δ - Delta)</Label>
                    <Badge variant="outline">{delta.toExponential(1)}</Badge>
                  </div>
                  <Input
                    type="number"
                    value={delta}
                    onChange={(e) => setDelta(parseFloat(e.target.value))}
                    step={1e-6}
                    disabled={!epsilonEnabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended: 1e-5 to 1e-9 (smaller is more private)
                  </p>
                </div>

                <Separator />

                {/* Monthly Budget */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Monthly Privacy Budget</Label>
                    <Badge variant="outline">{monthlyBudget.toFixed(1)} ε</Badge>
                  </div>
                  <Slider
                    value={[monthlyBudget]}
                    onValueChange={(values) => setMonthlyBudget(values[0])}
                    min={5}
                    max={50}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total privacy budget available per month (resets on 1st)
                  </p>
                </div>

                <Separator />

                {/* Auto-Renew */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Auto-Renew Budget</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically reset budget on the 1st of each month
                    </p>
                  </div>
                  <Switch
                    checked={autoRenew}
                    onCheckedChange={setAutoRenew}
                  />
                </div>

                {/* Info Box */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-blue-500">How Differential Privacy Works</p>
                      <p className="text-muted-foreground">
                        Your vectors are protected with Gaussian noise calibrated to (ε={epsilon.toFixed(2)}, δ={delta.toExponential(1)}).
                        Lower ε means stronger privacy but may reduce vector utility. Each upload consumes ε from your monthly budget.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Budget History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Budget History</CardTitle>
                <CardDescription>
                  Track your privacy budget consumption over time
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Budget Chart */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={budgetChartData}>
                      <defs>
                        <linearGradient id="colorRemaining" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#666" />
                      <YAxis stroke="#666" />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          borderRadius: '8px'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="remaining"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorRemaining)"
                        name="Budget Remaining"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <Separator />

                {/* Budget Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Total Budget Used</p>
                    <p className="text-2xl font-bold">{budgetUsed.toFixed(2)} ε</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">Next Reset</p>
                    <p className="text-2xl font-bold">
                      {settings?.nextResetDate
                        ? new Date(settings.nextResetDate).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Recent Activity */}
                {budgetHistory?.history && budgetHistory.history.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">Recent Activity</h3>
                    <div className="space-y-2">
                      {budgetHistory.history.slice(0, 5).map((item: BudgetHistoryItem, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div>
                            <p className="font-medium">{new Date(item.date).toLocaleDateString()}</p>
                            <p className="text-sm text-muted-foreground">
                              Used: {item.budgetUsed.toFixed(2)} ε
                            </p>
                          </div>
                          <Badge variant="outline">
                            {item.budgetRemaining.toFixed(2)} ε remaining
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Simulator Tab */}
          <TabsContent value="simulator">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Simulator</CardTitle>
                <CardDescription>
                  Test how differential privacy affects your vectors
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Input Vector (JSON Array)</Label>
                    <textarea
                      className="w-full h-32 p-3 bg-muted rounded-lg font-mono text-sm"
                      placeholder='[0.1, 0.2, 0.3, ..., 0.768]'
                      value={simulatorVector}
                      onChange={(e) => setSimulatorVector(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Epsilon (ε)</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[simulatorEpsilon]}
                        onValueChange={(values) => setSimulatorEpsilon(values[0])}
                        min={0.1}
                        max={10}
                        step={0.1}
                        className="flex-1"
                      />
                      <Badge variant="outline" className="min-w-16 justify-center">
                        {simulatorEpsilon.toFixed(2)}
                      </Badge>
                    </div>
                  </div>

                  <Button
                    onClick={handleSimulate}
                    disabled={simulateMutation.isPending || !simulatorVector}
                    className="w-full"
                  >
                    {simulateMutation.isPending ? "Simulating..." : "Run Simulation"}
                  </Button>
                </div>

                {simulationResult && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="font-medium flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Simulation Results
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-muted/50 rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Noise Scale (σ)</p>
                          <p className="text-xl font-bold">
                            {simulationResult.analysis.noiseScale.toFixed(4)}
                          </p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Mean Noise</p>
                          <p className="text-xl font-bold">
                            {simulationResult.analysis.meanNoise.toFixed(4)}
                          </p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Std Dev Noise</p>
                          <p className="text-xl font-bold">
                            {simulationResult.analysis.stdDevNoise.toFixed(4)}
                          </p>
                        </div>
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <p className="text-sm font-medium mb-2">Interpretation</p>
                        <p className="text-sm text-muted-foreground">
                          {simulationResult.interpretation}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Noisy Vector (First 10 dimensions)</Label>
                        <div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto">
                          {JSON.stringify(simulationResult.noisyVector.slice(0, 10), null, 2)}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
