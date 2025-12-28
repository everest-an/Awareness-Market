import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Crown, Zap, TrendingUp, Shield } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Subscriptions() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: plans, isLoading: plansLoading } = trpc.vectors.getCategories.useQuery();
  
  // Mock subscription plans data (in production, fetch from backend)
  const subscriptionPlans = [
    {
      id: "basic",
      name: "Basic",
      price: 29,
      interval: "month",
      features: [
        "Up to 1,000 API calls/month",
        "Access to basic AI capabilities",
        "Standard support",
        "Usage analytics",
      ],
      icon: Zap,
      color: "text-blue-500",
    },
    {
      id: "pro",
      name: "Professional",
      price: 99,
      interval: "month",
      popular: true,
      features: [
        "Up to 10,000 API calls/month",
        "Access to all AI capabilities",
        "Priority support",
        "Advanced analytics",
        "Custom integrations",
        "API rate limit boost",
      ],
      icon: TrendingUp,
      color: "text-purple-500",
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: 299,
      interval: "month",
      features: [
        "Unlimited API calls",
        "Access to premium AI capabilities",
        "24/7 dedicated support",
        "Custom model training",
        "SLA guarantee",
        "White-label options",
        "Team collaboration tools",
      ],
      icon: Crown,
      color: "text-amber-500",
    },
  ];

  const handleSubscribe = (planId: string) => {
    if (!isAuthenticated) {
      toast.error("Please login to subscribe");
      return;
    }
    
    // In production, integrate with Stripe Checkout
    toast.info("Redirecting to payment...", {
      description: "This will integrate with Stripe Checkout in production.",
    });
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
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {subscriptionPlans.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  plan.popular ? "border-primary shadow-lg scale-105" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary px-4 py-1">Most Popular</Badge>
                  </div>
                )}

                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Icon className={`h-8 w-8 ${plan.color}`} />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>
                    <div className="mt-4 flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        ${plan.price}
                      </span>
                      <span className="text-muted-foreground">/{plan.interval}</span>
                    </div>
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
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
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {isAuthenticated ? "Subscribe Now" : "Login to Subscribe"}
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
