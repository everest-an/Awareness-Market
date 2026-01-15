import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Brain } from "lucide-react";

export default function Pricing() {
  const plans = [
    {
      name: "Free",
      price: "$0",
      description: "Perfect for trying out the platform",
      features: [
        "3 free trial calls per vector",
        "Browse all vectors",
        "Basic analytics",
        "Community support",
      ],
      cta: "Get Started",
      href: "/marketplace",
    },
    {
      name: "Creator",
      price: "15%",
      description: "For AI developers selling capabilities",
      features: [
        "Upload unlimited vectors",
        "15% platform fee",
        "Advanced analytics",
        "Priority support",
        "Custom pricing models",
        "API access",
      ],
      cta: "Start Selling",
      href: "/upload",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For organizations with specific needs",
      features: [
        "Custom platform fee",
        "Dedicated account manager",
        "SLA guarantees",
        "Custom integrations",
        "White-label options",
        "24/7 priority support",
      ],
      cta: "Contact Sales",
      href: "mailto:sales@awareness-network.com",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-2">
              <Brain className="h-6 w-6" />
              <span className="font-bold">Awareness Network</span>
            </a>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/marketplace">
              <a className="text-sm font-medium hover:text-primary">Marketplace</a>
            </Link>
            <Link href="/profile">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-muted/30 py-20">
        <div className="container text-center">
          <h1 className="mb-4 text-5xl font-bold">Simple, Transparent Pricing</h1>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
            Choose the plan that works best for you. No hidden fees, no surprises.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20">
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={plan.popular ? "border-primary shadow-lg" : ""}
              >
                {plan.popular && (
                  <div className="rounded-t-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.name === "Creator" && (
                      <span className="text-muted-foreground"> commission</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {plan.href.startsWith("mailto:") ? (
                    <Button asChild className="w-full" variant={plan.popular ? "default" : "outline"}>
                      <a href={plan.href}>{plan.cta}</a>
                    </Button>
                  ) : (
                    <Button asChild className="w-full" variant={plan.popular ? "default" : "outline"}>
                      <Link href={plan.href}>{plan.cta}</Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t py-20">
        <div className="container">
          <h2 className="mb-12 text-center text-3xl font-bold">Frequently Asked Questions</h2>
          <div className="mx-auto max-w-3xl space-y-8">
            <div>
              <h3 className="mb-2 text-lg font-semibold">How does the platform fee work?</h3>
              <p className="text-muted-foreground">
                For creators, we charge a 15% commission on each transaction. This covers platform maintenance, payment processing, and support services.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">Can I try vectors before purchasing?</h3>
              <p className="text-muted-foreground">
                Yes! Each vector comes with 3 free trial calls, allowing you to test the capability before committing to a purchase.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">
                We accept all major credit cards through Stripe. Enterprise customers can also arrange for invoicing.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">Can I change my plan later?</h3>
              <p className="text-muted-foreground">
                Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
