import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PLANS = [
  {
    id: 'FREE_TRIAL',
    name: 'Free Trial',
    description: '15-day free trial with full access',
    price: 0,
    interval: 'trial',
    features: [
      'Unlimited OCR processing',
      'AI document generation',
      'Company information lookup',
      'Basic storage (R2)',
      'Web and mobile access',
    ],
    popular: false,
  },
  {
    id: 'MONTHLY',
    name: 'Monthly',
    description: 'Full access with monthly billing',
    price: 9.99,
    interval: 'month',
    features: [
      'Unlimited OCR processing',
      'AI document generation',
      'Company information lookup',
      'Advanced storage (R2)',
      'Web and mobile access',
      'Priority support',
    ],
    popular: true,
  },
  {
    id: 'YEARLY',
    name: 'Yearly',
    description: 'Save 20% with yearly billing',
    price: 95.99,
    interval: 'year',
    originalPrice: 119.88,
    features: [
      'Unlimited OCR processing',
      'AI document generation',
      'Company information lookup',
      'Advanced storage (R2)',
      'IPFS distributed storage',
      'Web and mobile access',
      'Priority support',
      'Early access to new features',
    ],
    popular: false,
  },
  {
    id: 'LIFETIME',
    name: 'Lifetime',
    description: 'One-time payment for lifetime access',
    price: 299.99,
    interval: 'lifetime',
    features: [
      'Unlimited OCR processing',
      'AI document generation',
      'Company information lookup',
      'Advanced storage (R2)',
      'IPFS distributed storage',
      'Arweave permanent storage',
      'Web and mobile access',
      'Priority support',
      'Lifetime updates',
    ],
    popular: false,
  },
];

export default function Subscription() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  const { data: subscription, isLoading: subLoading } = trpc.subscription.current.useQuery(undefined, {
    enabled: !!user,
  });

  const startTrialMutation = trpc.subscription.startFreeTrial.useMutation({
    onSuccess: () => {
      toast.success('Free trial activated! Enjoy 15 days of full access.');
      setLocation('/dashboard');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start free trial');
    },
  });

  const createCheckoutMutation = trpc.subscription.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      toast.info('Redirecting to checkout...');
      window.open(data.checkoutUrl, '_blank');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create checkout session');
    },
  });

  const handleSelectPlan = (planId: string) => {
    if (!user) {
      toast.error('Please login first');
      return;
    }

    if (planId === 'FREE_TRIAL') {
      startTrialMutation.mutate();
    } else {
      createCheckoutMutation.mutate({ planId: planId as 'MONTHLY' | 'YEARLY' | 'LIFETIME' });
    }
  };

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active';
  const hasSubscription = isTrialing || isActive;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-muted-foreground text-lg">
            Start with a free trial or upgrade to unlock advanced features
          </p>
        </div>

        {hasSubscription && (
          <Card className="mb-8 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{subscription.plan}</p>
                  <p className="text-sm text-muted-foreground">
                    Status: <Badge variant={isActive ? 'default' : 'secondary'}>{subscription.status}</Badge>
                  </p>
                  {subscription.currentPeriodEnd && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {isTrialing ? 'Trial ends' : 'Renews'} on{' '}
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {isTrialing && (
                  <Button onClick={() => handleSelectPlan('MONTHLY')}>
                    Upgrade Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  {plan.interval !== 'trial' && plan.interval !== 'lifetime' && (
                    <span className="text-muted-foreground">/{plan.interval}</span>
                  )}
                  {plan.originalPrice && (
                    <div className="text-sm text-muted-foreground line-through">
                      ${plan.originalPrice}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={
                    startTrialMutation.isPending ||
                    createCheckoutMutation.isPending ||
                    (hasSubscription && plan.id === 'FREE_TRIAL')
                  }
                >
                  {startTrialMutation.isPending || createCheckoutMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : hasSubscription && plan.id === 'FREE_TRIAL' ? (
                    'Already Subscribed'
                  ) : plan.id === 'FREE_TRIAL' ? (
                    'Start Free Trial'
                  ) : (
                    'Subscribe'
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            All plans include a 15-day free trial. No credit card required.
          </p>
          <p className="mt-2">
            You can test payments using card number 4242 4242 4242 4242
          </p>
        </div>
      </div>
    </div>
  );
}
