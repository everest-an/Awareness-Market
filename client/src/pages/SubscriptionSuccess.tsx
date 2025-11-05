import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";

export default function SubscriptionSuccess() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Get session_id from URL params
    const params = new URLSearchParams(window.location.search);
    const id = params.get("session_id");
    setSessionId(id);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your subscription has been activated
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Thank you for subscribing to Awareness Network 2.0!
            </p>
            <p className="text-sm text-muted-foreground">
              Your payment has been processed successfully and your account has been upgraded.
            </p>
            {sessionId && (
              <p className="text-xs text-muted-foreground font-mono mt-2">
                Session ID: {sessionId}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">What's next?</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Access all premium features</li>
              <li>Upload files to IPFS storage</li>
              <li>Increased storage quota</li>
              <li>Priority support</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setLocation("/dashboard")}
              className="flex-1"
            >
              Go to Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/subscription")}
              className="flex-1"
            >
              View Subscription
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
