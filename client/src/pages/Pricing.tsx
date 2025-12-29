import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { Link } from "wouter";

export default function Pricing() {
    const tiers = [
        {
            name: "Starter",
            price: "$0",
            description: "For individuals exploring the latent space.",
            features: ["Process up to 1GB vectors/mo", "Access public marketplace", "Standard community support", "Basic 768d vector alignment"],
            cta: "Get Started",
            href: "/marketplace",
        },
        {
            name: "Pro",
            price: "$29",
            description: "For creators and power users.",
            features: ["Process up to 50GB vectors/mo", "Access premium marketplace", "Priority email support", "Advanced LatentMAS alignment", "Zero transaction fees (Creator)"],
            cta: "Subscribe",
            href: "/dashboard/consumer", // In real app, checkout link
            popular: true,
        },
        {
            name: "Enterprise",
            price: "Custom",
            description: "For comprehensive AI organizations.",
            features: ["Unlimited vector processing", "Private vector marketplace", "24/7 Dedicated support", "Custom realignment matrices", "SLA & Compliance reports"],
            cta: "Contact Sales",
            href: "mailto:sales@awareness.market",
        },
    ];

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

                    <div className="grid gap-8 md:grid-cols-3">
                        {tiers.map((tier) => (
                            <Card key={tier.name} className={`flex flex-col ${tier.popular ? 'border-primary shadow-lg relative' : ''}`}>
                                {tier.popular && (
                                    <div className="absolute top-0 right-0 -mr-2 -mt-2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                                        POPULAR
                                    </div>
                                )}
                                <CardHeader>
                                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                                    <CardDescription>{tier.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="text-4xl font-bold mb-6">{tier.price}<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
                                    <ul className="space-y-3">
                                        {tier.features.map((feature) => (
                                            <li key={feature} className="flex items-center gap-2">
                                                <Check className="h-4 w-4 text-green-500" />
                                                <span className="text-sm">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild className="w-full" variant={tier.popular ? "default" : "outline"}>
                                        <Link href={tier.href}>{tier.cta}</Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            </main>

            <footer className="border-t py-12 text-center text-sm text-muted-foreground">
                © 2025 Awareness Network. All rights reserved.
            </footer>
        </div>
    );
}
