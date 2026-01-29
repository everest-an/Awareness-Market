import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Shield, Info, AlertTriangle, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

interface PrivacySelectorProps {
  onPrivacyChange: (config: {
    enabled: boolean;
    epsilon: number;
    delta: number;
  }) => void;
  defaultEnabled?: boolean;
  defaultEpsilon?: number;
  defaultDelta?: number;
}

export function PrivacySelector({
  onPrivacyChange,
  defaultEnabled = false,
  defaultEpsilon = 1.0,
  defaultDelta = 1e-5,
}: PrivacySelectorProps) {
  const [, setLocation] = useLocation();
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [epsilon, setEpsilon] = useState(defaultEpsilon);
  const [delta, setDelta] = useState(defaultDelta);

  // Fetch user's default privacy settings
  const { data: privacySettings } = trpc.user.getPrivacySettings.useQuery();

  // Initialize from user's saved settings
  useEffect(() => {
    if (privacySettings) {
      setEnabled(privacySettings.differentialPrivacyEnabled);
      setEpsilon(privacySettings.defaultEpsilon);
      setDelta(privacySettings.defaultDelta);
    }
  }, [privacySettings]);

  // Notify parent of changes
  useEffect(() => {
    onPrivacyChange({ enabled, epsilon, delta });
  }, [enabled, epsilon, delta, onPrivacyChange]);

  const budgetRemaining = privacySettings?.budgetRemaining ?? 0;
  const budgetWarning = budgetRemaining < epsilon;
  const budgetCritical = budgetRemaining < epsilon * 0.5;

  const getPrivacyLevel = (eps: number): { label: string; color: string } => {
    if (eps <= 1.0) return { label: "High Privacy", color: "text-green-500" };
    if (eps <= 3.0) return { label: "Balanced", color: "text-blue-500" };
    return { label: "High Utility", color: "text-orange-500" };
  };

  const privacyLevel = getPrivacyLevel(epsilon);

  return (
    <Card className="border-blue-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <CardTitle>Differential Privacy</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/privacy-settings')}
            className="text-xs"
          >
            Advanced Settings <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
        <CardDescription>
          Add calibrated noise to protect vector privacy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable Switch */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Enable Privacy Protection</Label>
            <p className="text-xs text-muted-foreground">
              Adds (ε, δ)-differential privacy noise
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <>
            {/* Budget Warning */}
            {budgetWarning && (
              <div className={`${budgetCritical ? 'bg-red-500/10 border-red-500/20' : 'bg-orange-500/10 border-orange-500/20'} border rounded-lg p-3`}>
                <div className="flex gap-2">
                  <AlertTriangle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${budgetCritical ? 'text-red-500' : 'text-orange-500'}`} />
                  <div className="text-sm">
                    <p className={`font-medium ${budgetCritical ? 'text-red-500' : 'text-orange-500'}`}>
                      {budgetCritical ? 'Insufficient Budget' : 'Low Budget Warning'}
                    </p>
                    <p className="text-muted-foreground">
                      Budget remaining: {budgetRemaining.toFixed(2)} ε (need: {epsilon.toFixed(2)} ε)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Epsilon Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Privacy Budget (ε)</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{epsilon.toFixed(2)}</Badge>
                  <span className={`text-xs font-medium ${privacyLevel.color}`}>
                    {privacyLevel.label}
                  </span>
                </div>
              </div>
              <Slider
                value={[epsilon]}
                onValueChange={(values) => setEpsilon(values[0])}
                min={0.1}
                max={10}
                step={0.1}
              />
              <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                <div className="text-center">
                  <p className="font-medium text-green-500">0.1</p>
                  <p>Max Privacy</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-blue-500">1.0</p>
                  <p>Balanced</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-orange-500">10</p>
                  <p>Max Utility</p>
                </div>
              </div>
            </div>

            {/* Privacy Info */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="flex gap-2">
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-blue-500">Privacy Guarantee</p>
                  <p className="text-muted-foreground">
                    This upload will consume <strong>{epsilon.toFixed(2)} ε</strong> from your monthly budget.
                    Lower ε provides stronger privacy but may affect vector quality.
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                    <span>ε = {epsilon.toFixed(2)}</span>
                    <span>δ = {delta.toExponential(1)}</span>
                    <span>Remaining: {budgetRemaining.toFixed(2)} ε</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <Label className="text-xs">Quick Presets</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={epsilon === 0.5 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEpsilon(0.5)}
                  className="text-xs"
                >
                  High Privacy
                  <br />
                  (ε=0.5)
                </Button>
                <Button
                  variant={epsilon === 1.0 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEpsilon(1.0)}
                  className="text-xs"
                >
                  Balanced
                  <br />
                  (ε=1.0)
                </Button>
                <Button
                  variant={epsilon === 3.0 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEpsilon(3.0)}
                  className="text-xs"
                >
                  High Utility
                  <br />
                  (ε=3.0)
                </Button>
              </div>
            </div>
          </>
        )}

        {!enabled && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground text-center">
              Privacy protection is disabled. Your vector will be uploaded without noise addition.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
