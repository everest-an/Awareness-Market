import { Link } from "wouter";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

/**
 * Awareness Logo Component
 * Blue gradient ring logo with optional text
 */
export default function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  const textSizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  };

  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      {/* Blue Gradient Ring Logo */}
      <div className={`relative ${sizeClasses[size]}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#logoGradient)"
            strokeWidth="4"
          />
        </svg>
      </div>
      {showText && (
        <span className={`font-semibold ${textSizeClasses[size]}`}>Awareness</span>
      )}
    </Link>
  );
}

/**
 * Logo SVG only (for favicon, etc.)
 */
export function LogoIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
      <defs>
        <linearGradient id="logoIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="url(#logoIconGradient)"
        strokeWidth="4"
      />
    </svg>
  );
}

/**
 * Footer Logo with brand info
 */
export function FooterLogo({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <Link href="/" className="flex items-center gap-2 mb-4">
        <div className="relative w-8 h-8">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id="footerLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#footerLogoGradient)"
              strokeWidth="4"
            />
          </svg>
        </div>
        <span className="font-semibold">Awareness</span>
      </Link>
      <p className="text-sm text-muted-foreground">
        The first decentralized marketplace for AI intelligence trading.
      </p>
    </div>
  );
}
