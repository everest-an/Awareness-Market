import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function SubscriptionCancel() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-orange-500/10 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-orange-500" />
            </div>
          </div>
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
          <CardDescription>
            Your subscription payment was not completed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              You cancelled the payment process. No charges have been made to your account.
            </p>
            <p className="text-sm text-muted-foreground">
              If you encountered any issues or have questions, please contact our support team.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Still interested?</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Try our 15-day free trial</li>
              <li>Explore all features before subscribing</li>
              <li>No credit card required for trial</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setLocation("/subscription")}
              className="flex-1"
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/dashboard")}
              className="flex-1"
            >
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
