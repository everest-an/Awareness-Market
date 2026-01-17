import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Brain, Menu, X } from "lucide-react";
import { useState } from "react";

export function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { user, isAuthenticated } = useAuth();
    const [location] = useLocation();

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    const navLinks = [
        { href: "/marketplace", label: "Marketplace" },
        { href: "/pricing", label: "Pricing" },
        { href: "/about", label: "About" },
    ];

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
                    {isAuthenticated ? (
                        <Button asChild>
                            <Link href={user?.role === "creator" ? "/dashboard/creator" : "/dashboard/consumer"}>
                                Dashboard
                            </Link>
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" asChild>
                                <a href={getLoginUrl()}>Login</a>
                            </Button>
                            <Button asChild>
                                <a href={getLoginUrl()}>Get Started</a>
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
                        {isAuthenticated ? (
                            <Button asChild className="w-full">
                                <Link href={user?.role === "creator" ? "/dashboard/creator" : "/dashboard/consumer"}>
                                    Dashboard
                                </Link>
                            </Button>
                        ) : (
                            <>
                                <Button variant="ghost" asChild className="w-full justify-start">
                                    <a href={getLoginUrl()}>Login</a>
                                </Button>
                                <Button asChild className="w-full">
                                    <a href={getLoginUrl()}>Get Started</a>
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
