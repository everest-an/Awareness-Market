import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Brain, Globe, Menu, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { user, isAuthenticated } = useAuth();
    const [location] = useLocation();
    const { t, i18n } = useTranslation();

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    const navLinks = [
        { href: "/marketplace", label: t("nav.marketplace") },
        { href: "/pricing", label: t("nav.pricing") },
        { href: "/about", label: t("nav.about") },
        { href: "/leaderboard", label: t("nav.leaderboard") },
        { href: "/golem-visualizer", label: t("nav.visualizer") },
    ];

    const setLanguage = (lang: "en" | "zh") => {
        i18n.changeLanguage(lang);
        if (typeof window !== "undefined") {
            localStorage.setItem("lang", lang);
        }
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
            <div className="container flex h-16 items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center space-x-2">
                    <Brain className="h-6 w-6 text-primary" />
                    <span className="text-xl font-bold">Awareness Network</span>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-6">
                    {navLinks.map((link) => (
                        <Link key={link.href} href={link.href}>
                            <span className={`text-sm font-medium transition-colors hover:text-primary ${location === link.href ? "text-foreground" : "text-muted-foreground"}`}>
                                {link.label}
                            </span>
                        </Link>
                    ))}
                </nav>

                {/* Auth Buttons (Desktop) */}
                <div className="hidden md:flex items-center gap-4">
                    <div className="flex items-center gap-2 rounded-full border px-2 py-1 text-xs text-muted-foreground">
                        <Globe className="h-3.5 w-3.5" />
                        <button
                            className={`rounded px-2 py-0.5 ${i18n.language === "en" ? "bg-primary text-primary-foreground" : "hover:text-foreground"}`}
                            onClick={() => setLanguage("en")}
                            type="button"
                        >
                            {t("nav.english")}
                        </button>
                        <button
                            className={`rounded px-2 py-0.5 ${i18n.language === "zh" ? "bg-primary text-primary-foreground" : "hover:text-foreground"}`}
                            onClick={() => setLanguage("zh")}
                            type="button"
                        >
                            {t("nav.chinese")}
                        </button>
                    </div>
                    {isAuthenticated ? (
                        <Button asChild>
                            <Link href={user?.role === "creator" ? "/dashboard/creator" : "/dashboard/consumer"}>
                                {t("nav.dashboard")}
                            </Link>
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" asChild>
                                <a href={getLoginUrl()}>{t("nav.login")}</a>
                            </Button>
                            <Button asChild>
                                <a href={getLoginUrl()}>{t("nav.getStarted")}</a>
                            </Button>
                        </div>
                    )}
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden p-2 text-muted-foreground hover:text-foreground"
                    onClick={toggleMenu}
                >
                    {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden border-t p-4 space-y-4 bg-background">
                    <nav className="flex flex-col space-y-4">
                        {navLinks.map((link) => (
                            <Link key={link.href} href={link.href} onClick={() => setIsMenuOpen(false)}>
                                <span className={`text-sm font-medium ${location === link.href ? "text-foreground" : "text-muted-foreground"}`}>
                                    {link.label}
                                </span>
                            </Link>
                        ))}
                    </nav>
                    <div className="flex flex-col gap-2 pt-4 border-t">
                        <div className="flex items-center gap-2 rounded-full border px-2 py-1 text-xs text-muted-foreground">
                            <Globe className="h-3.5 w-3.5" />
                            <button
                                className={`rounded px-2 py-0.5 ${i18n.language === "en" ? "bg-primary text-primary-foreground" : "hover:text-foreground"}`}
                                onClick={() => setLanguage("en")}
                                type="button"
                            >
                                {t("nav.english")}
                            </button>
                            <button
                                className={`rounded px-2 py-0.5 ${i18n.language === "zh" ? "bg-primary text-primary-foreground" : "hover:text-foreground"}`}
                                onClick={() => setLanguage("zh")}
                                type="button"
                            >
                                {t("nav.chinese")}
                            </button>
                        </div>
                        {isAuthenticated ? (
                            <Button asChild className="w-full">
                                <Link href={user?.role === "creator" ? "/dashboard/creator" : "/dashboard/consumer"}>
                                    {t("nav.dashboard")}
                                </Link>
                            </Button>
                        ) : (
                            <>
                                <Button variant="ghost" asChild className="w-full justify-start">
                                    <a href={getLoginUrl()}>{t("nav.login")}</a>
                                </Button>
                                <Button asChild className="w-full">
                                    <a href={getLoginUrl()}>{t("nav.getStarted")}</a>
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
