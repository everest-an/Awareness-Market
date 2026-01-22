import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Crown, Zap, TrendingUp, Shield } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";

export default function Subscriptions() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: plans, isLoading: plansLoading } = trpc.subscriptions.plans.useQuery();
  const { data: currentSubscription } = trpc.subscriptions.current.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const checkoutMutation = trpc.subscriptions.checkout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      toast.error("Unable to start checkout");
    },
    onError: (error) => {
      toast.error("Subscription failed", {
        description: error.message || "Please try again later.",
      });
    },
  });

  const resolveIcon = (name: string) => {
    const lowered = name.toLowerCase();
    if (lowered.includes("enterprise")) return { icon: Crown, color: "text-amber-500" };
    if (lowered.includes("pro") || lowered.includes("professional")) return { icon: TrendingUp, color: "text-purple-500" };
    return { icon: Zap, color: "text-blue-500" };
  };

  const parseFeatures = (features?: string | null) => {
    if (!features) return [];
    try {
      const parsed = JSON.parse(features);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const handleSubscribe = (planId: number) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    checkoutMutation.mutate({ planId });
  };

  if (authLoading || plansLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-16">
          <Skeleton className="mx-auto mb-4 h-12 w-64" />
          <Skeleton className="mx-auto mb-12 h-6 w-96" />
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[500px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-gradient-to-b from-muted/50 to-background">
        <div className="container py-16 text-center">
          <h1 className="mb-4 text-4xl font-bold">Choose Your Plan</h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Unlock the full potential of AI collaboration with flexible subscription plans
          </p>
        </div>
      </div>

      <div className="container py-16">
        {/* Pricing Cards */}
        {currentSubscription && (
          <div className="mb-10 rounded-lg border bg-muted/30 p-6">
            <h2 className="text-xl font-semibold">Current Subscription</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Status: {currentSubscription.status}
            </p>
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {plans && plans.length > 0 ? plans.map((plan) => {
            const meta = resolveIcon(plan.name);
            const Icon = meta.icon;
            const features = parseFeatures(plan.features);
            const isPopular = plan.name.toLowerCase().includes("pro");
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  isPopular ? "border-primary shadow-lg scale-105" : ""
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary px-4 py-1">Most Popular</Badge>
                  </div>
                )}

                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Icon className={`h-8 w-8 ${meta.color}`} />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>
                    <div className="mt-4 flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        ${parseFloat(plan.price).toFixed(0)}
                      </span>
                      <span className="text-muted-foreground">/{plan.billingCycle}</span>
                    </div>
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isPopular ? "default" : "outline"}
                    size="lg"
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {isAuthenticated ? "Subscribe Now" : "Login to Subscribe"}
                  </Button>
                </CardFooter>
              </Card>
            );
          }) : (
            <Card className="col-span-full p-8 text-center">
              <CardTitle>No subscription plans available</CardTitle>
              <CardDescription className="mt-2">
                Please check back later or contact support.
              </CardDescription>
            </Card>
          )}
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-2 font-semibold">Secure & Reliable</h3>
            <p className="text-sm text-muted-foreground">
              Enterprise-grade security with 99.9% uptime SLA
            </p>
          </div>

          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-2 font-semibold">Instant Activation</h3>
            <p className="text-sm text-muted-foreground">
              Start using AI capabilities immediately after subscription
            </p>
          </div>

          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-2 font-semibold">Flexible Scaling</h3>
            <p className="text-sm text-muted-foreground">
              Upgrade or downgrade anytime without penalties
            </p>
          </div>
        </div>

        {/* FAQ Link */}
        <div className="mt-16 text-center">
          <p className="mb-4 text-muted-foreground">
            Have questions about our pricing?
          </p>
          <Button variant="outline" asChild>
            <Link href="/marketplace">
              Browse Marketplace
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
