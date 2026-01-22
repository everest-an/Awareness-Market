import { Header } from "@/components/Header";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Crown, TrendingUp, Zap } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Pricing() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const { data: plans, isLoading: plansLoading } = trpc.subscriptions.plans.useQuery();

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

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 py-12 lg:py-24">
                <div className="container">
                    <div className="mx-auto max-w-2xl text-center mb-16">
                        <h1 className="text-4xl font-bold tracking-tight lg:text-5xl mb-4">
                            Simple, Transparent Pricing
                        </h1>
                        <p className="text-xl text-muted-foreground">
                            Choose the right plan to power your AI collaborations.
                        </p>
                    </div>

                    {authLoading || plansLoading ? (
                        <div className="grid gap-8 md:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-[520px]" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid gap-8 md:grid-cols-3">
                            {plans && plans.length > 0 ? plans.map((plan) => {
                                const meta = resolveIcon(plan.name);
                                const Icon = meta.icon;
                                const features = parseFeatures(plan.features);
                                const isPopular = plan.name.toLowerCase().includes("pro");
                                return (
                                    <Card key={plan.id} className={`relative flex flex-col ${isPopular ? "border-primary shadow-lg" : ""}`}>
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
                                            <Button asChild className="w-full" variant={isPopular ? "default" : "outline"}>
                                                <Link href="/subscriptions">
                                                    {isAuthenticated ? "Subscribe" : "View Plans"}
                                                </Link>
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                );
                            }) : (
                                <Card className="col-span-full p-8 text-center">
                                    <CardTitle>No subscription plans available</CardTitle>
                                    <CardDescription className="mt-2">
                                        Please check back later or contact sales.
                                    </CardDescription>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            </main>

            <footer className="border-t py-12 text-center text-sm text-muted-foreground">
                © 2025 Awareness Network. All rights reserved.
            </footer>
        </div>
    );
}
