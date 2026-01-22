import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Header } from "@/components/Header";
import {
  Brain,
  Zap,
  Shield,
  TrendingUp,
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Network
} from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();

  const features = [
    {
      icon: Network,
      title: t("features.items.latentmas.title"),
      desc: t("features.items.latentmas.desc"),
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Zap,
      title: t("features.items.mcp.title"),
      desc: t("features.items.mcp.desc"),
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      icon: Shield,
      title: t("features.items.secure.title"),
      desc: t("features.items.secure.desc"),
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: TrendingUp,
      title: t("features.items.pricing.title"),
      desc: t("features.items.pricing.desc"),
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      icon: Users,
      title: t("features.items.economy.title"),
      desc: t("features.items.economy.desc"),
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Brain,
      title: t("features.items.matching.title"),
      desc: t("features.items.matching.desc"),
      color: "text-accent",
      bg: "bg-accent/10",
    },
  ];

  const steps = [
    {
      number: 1,
      title: t("howItWorks.steps.create.title"),
      desc: t("howItWorks.steps.create.desc"),
      bg: "bg-primary",
      text: "text-primary-foreground",
    },
    {
      number: 2,
      title: t("howItWorks.steps.purchase.title"),
      desc: t("howItWorks.steps.purchase.desc"),
      bg: "bg-accent",
      text: "text-accent-foreground",
    },
    {
      number: 3,
      title: t("howItWorks.steps.integrate.title"),
      desc: t("howItWorks.steps.integrate.desc"),
      bg: "bg-primary",
      text: "text-primary-foreground",
    },
  ];

  const useCases = [
    {
      title: t("useCases.items.finance.title"),
      desc: t("useCases.items.finance.desc"),
    },
    {
      title: t("useCases.items.code.title"),
      desc: t("useCases.items.code.desc"),
    },
    {
      title: t("useCases.items.medical.title"),
      desc: t("useCases.items.medical.desc"),
    },
    {
      title: t("useCases.items.content.title"),
      desc: t("useCases.items.content.desc"),
    },
  ];
  return (
    <div className="min-h-screen">
      <Header />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-accent/5 to-background py-20 lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.75_0.15_210_/_0.15),transparent_50%),radial-gradient(circle_at_70%_60%,oklch(0.55_0.18_250_/_0.15),transparent_50%)]" />
        <div className="min-h-screen">
          <Header />
          {/* Hero Section */}
          <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-accent/5 to-background py-20 lg:py-32">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.75_0.15_210_/_0.15),transparent_50%),radial-gradient(circle_at_70%_60%,oklch(0.55_0.18_250_/_0.15),transparent_50%)]" />

            <div className="container relative">
              <motion.div
                className="mx-auto max-w-4xl text-center"
                initial="hidden"
                animate="visible"
                variants={containerVariants}
              >
                <motion.div variants={itemVariants}>
                  <Badge className="mb-6 px-4 py-1.5 text-sm" variant="secondary">
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t("hero.badge")}
                  </Badge>
                </motion.div>

                <motion.h1 className="mb-6 text-5xl font-bold tracking-tight lg:text-7xl" variants={itemVariants}>
                  {t("hero.title")}
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> {t("hero.titleHighlight")}</span>
                </motion.h1>

                <motion.p className="mb-10 text-xl text-muted-foreground lg:text-2xl" variants={itemVariants}>
                  {t("hero.subtitle")}
                </motion.p>

                <motion.div className="flex flex-col gap-4 sm:flex-row sm:justify-center" variants={itemVariants}>
                  {isAuthenticated ? (
                    <>
                      <Button asChild size="lg" className="text-lg">
                        <Link href="/marketplace">
                          <Brain className="mr-2 h-5 w-5" />
                          {t("hero.ctaExplore")}
                        </Link>
                      </Button>
                      {user?.role === "creator" && (
                        <Button asChild size="lg" variant="outline" className="text-lg">
                          <Link href="/dashboard/creator">
                            <TrendingUp className="mr-2 h-5 w-5" />
                            {t("hero.ctaCreator")}
                          </Link>
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button asChild size="lg" className="text-lg">
                        <a href={getLoginUrl()}>
                          {t("hero.ctaGetStarted")}
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </a>
                      </Button>
                      <Button asChild size="lg" variant="outline" className="text-lg">
                        <Link href="/marketplace">
                          {t("hero.ctaBrowse")}
                        </Link>
                      </Button>
                    </>
                  )}
                </motion.div>
              </motion.div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-20 lg:py-32">
            <div className="container">
              <motion.div
                className="mx-auto mb-16 max-w-2xl text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="mb-4 text-4xl font-bold">{t("features.heading")}</h2>
                <p className="text-xl text-muted-foreground">
                  {t("features.subheading")}
                </p>
              </motion.div>

              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {features.map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                  >
                    <Card className="border-2 transition-all hover:border-primary/50 hover:shadow-lg h-full">
                      <CardHeader>
                        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${feature.bg}`}>
                          <feature.icon className={`h-6 w-6 ${feature.color}`} />
                        </div>
                        <CardTitle>{feature.title}</CardTitle>
                        <CardDescription>{feature.desc}</CardDescription>
                      </CardHeader>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="bg-muted/30 py-20 lg:py-32">
            <div className="container">
              <div className="mx-auto mb-16 max-w-2xl text-center">
                <h2 className="mb-4 text-4xl font-bold">{t("howItWorks.heading")}</h2>
                <p className="text-xl text-muted-foreground">
                  {t("howItWorks.subheading")}
                </p>
              </div>

              <div className="grid gap-12 lg:grid-cols-3">
                {steps.map((step) => (
                  <div className="relative" key={step.number}>
                    <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full ${step.bg} text-2xl font-bold ${step.text}`}>
                      {step.number}
                    </div>
                    <h3 className="mb-3 text-2xl font-semibold">{step.title}</h3>
                    <p className="text-muted-foreground">
                      {step.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Use Cases Section */}
          <section className="py-20 lg:py-32">
            <div className="container">
              <div className="mx-auto mb-16 max-w-2xl text-center">
                <h2 className="mb-4 text-4xl font-bold">{t("useCases.heading")}</h2>
                <p className="text-xl text-muted-foreground">
                  {t("useCases.subheading")}
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {useCases.map((useCase) => (
                  <Card key={useCase.title}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        {useCase.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        {useCase.desc}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="bg-gradient-to-br from-primary to-accent py-20 text-primary-foreground lg:py-32">
            <div className="container">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="mb-6 text-4xl font-bold lg:text-5xl">
                  {t("finalCta.heading")}
                </h2>
                <p className="mb-10 text-xl opacity-90">
                  {t("finalCta.subheading")}
                </p>
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                  {isAuthenticated ? (
                    <Button asChild size="lg" variant="secondary" className="text-lg">
                      <Link href="/marketplace">
                        {t("finalCta.primary")}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild size="lg" variant="secondary" className="text-lg">
                        <a href={getLoginUrl()}>
                          {t("finalCta.secondary")}
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </a>
                      </Button>
                      <Button asChild size="lg" variant="outline" className="border-primary-foreground bg-transparent text-primary-foreground hover:bg-primary-foreground/10 text-lg">
                        <Link href="/marketplace">
                          {t("finalCta.tertiary")}
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t py-12">
            <div className="container">
              <div className="grid gap-8 md:grid-cols-4">
                <div>
                  <h3 className="mb-4 font-semibold">Awareness Network</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("footer.tagline")}
                  </p>
                </div>
                <div>
                  <h4 className="mb-4 font-semibold">{t("footer.product")}</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li><a href="/marketplace" className="hover:text-foreground" target="_blank" rel="noopener noreferrer">{t("footer.marketplace")}</a></li>
                    <li><a href="/pricing" className="hover:text-foreground" target="_blank" rel="noopener noreferrer">{t("footer.pricing")}</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="mb-4 font-semibold">{t("footer.company")}</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li><a href="/about" className="hover:text-foreground" target="_blank" rel="noopener noreferrer">{t("footer.about")}</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="mb-4 font-semibold">{t("footer.legal")}</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li><a href="/privacy" className="hover:text-foreground" target="_blank" rel="noopener noreferrer">{t("footer.privacy")}</a></li>
                    <li><a href="/terms" className="hover:text-foreground" target="_blank" rel="noopener noreferrer">{t("footer.terms")}</a></li>
                  </ul>
                </div>
              </div>
              <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
                {t("footer.rights")}
              </div>
            </div>
          </footer>
        </div>
        );
}
