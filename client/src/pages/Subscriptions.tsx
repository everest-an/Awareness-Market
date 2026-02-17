import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Crown, Zap, TrendingUp, Shield } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Subscriptions() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: subscriptionPlans, isLoading: plansLoading } = trpc.subscriptions.listPlans.useQuery();

  const checkoutMutation = trpc.subscriptions.createCheckout.useMutation({
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (error) => {
      toast.error(`Failed to start checkout: ${error.message}`);
    },
  });

  const getPlanMeta = (name: string) => {
    const normalized = name.toLowerCase();
    if (normalized.includes("enterprise")) {
      return { icon: Crown, color: "text-amber-500", popular: false };
    }
    if (normalized.includes("pro") || normalized.includes("professional")) {
      return { icon: TrendingUp, color: "text-purple-500", popular: true };
    }
    if (normalized.includes("basic") || normalized.includes("starter")) {
      return { icon: Zap, color: "text-blue-500", popular: false };
    }
    return { icon: Shield, color: "text-emerald-500", popular: false };
  };

  const handleSubscribe = (planId: number) => {
    if (!isAuthenticated) {
      toast.error("Please login to subscribe");
      return;
    }

    checkoutMutation.mutate({
      planId,
      successUrl: `${window.location.origin}/subscriptions?success=true`,
      cancelUrl: `${window.location.origin}/subscriptions?canceled=true`,
    });
  };

  if (authLoading || plansLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
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
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />
      {/* Header */}
      <div className="border-b bg-gradient-to-b from-muted/50 to-background mt-20">
        <div className="container py-16 text-center">
          <h1 className="mb-4 text-4xl font-bold">Choose Your Plan</h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Unlock the full potential of AI collaboration with flexible subscription plans
          </p>
        </div>
      </div>

      <div className="container py-16">
        {/* Pricing Cards */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {(subscriptionPlans || []).map((plan) => {
            const meta = getPlanMeta(plan.name);
            const Icon = meta.icon;
            const features = plan.features ? JSON.parse(plan.features) as string[] : [];
            const price = Number(plan.price);
            const interval = plan.billingCycle === "yearly" ? "year" : "month";
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  meta.popular ? "border-primary shadow-lg scale-105" : ""
                }`}
              >
                {meta.popular && (
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
                        ${price.toFixed(0)}
                      </span>
                      <span className="text-muted-foreground">/{interval}</span>
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
                    variant={meta.popular ? "default" : "outline"}
                    size="lg"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? "Redirecting..." : isAuthenticated ? "Subscribe Now" : "Login to Subscribe"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
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
