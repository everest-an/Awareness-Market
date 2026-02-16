/**
 * Hero Section with Unicorn Studio Animation
 *
 * Main landing page hero with interactive 3D background
 */

import React from 'react';
import { UnicornScene } from './UnicornScene';

interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
  showAnimation?: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  title = 'Awareness Network',
  subtitle = 'Next-Generation Robot Management Middleware',
  ctaText = 'Get Started',
  ctaHref = '/robotics',
  showAnimation = true,
}) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-900">
      {/* Background Animation */}
      {showAnimation && (
        <div className="absolute inset-0 z-0">
          <UnicornScene
            width="100%"
            height="100vh"
          />
        </div>
      )}

      {/* Content Overlay */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Title with High Awareness Design */}
        <h1 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tight">
          {title}
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto font-medium">
          {subtitle}
        </p>

        {/* Key Features - High Contrast Tags */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <span className="px-4 py-2 bg-white text-gray-900 text-sm font-bold border-2 border-white">
            [PRODUCTION-READY]
          </span>
          <span className="px-4 py-2 bg-transparent text-white text-sm font-bold border-2 border-white">
            [125X PERFORMANCE]
          </span>
          <span className="px-4 py-2 bg-transparent text-white text-sm font-bold border-2 border-white">
            [1,000+ ROBOTS]
          </span>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={ctaHref}
            className="px-8 py-4 bg-white text-gray-900 text-lg font-black hover:bg-gray-100 transition border-4 border-white inline-block"
          >
            ▶ {ctaText}
          </a>

          <a
            href="/docs"
            className="px-8 py-4 bg-transparent text-white text-lg font-bold hover:bg-white hover:text-gray-900 transition border-2 border-white inline-block"
          >
            View Documentation →
          </a>
        </div>

        {/* Tech Stack Indicators */}
        <div className="mt-16 pt-8 border-t-2 border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
            Powered By
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400 font-medium">
            <span>Redis</span>
            <span>•</span>
            <span>BullMQ</span>
            <span>•</span>
            <span>PostgreSQL</span>
            <span>•</span>
            <span>Prometheus</span>
            <span>•</span>
            <span>WebXR</span>
          </div>
        </div>
      </div>

      {/* Gradient Overlay for Better Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 via-gray-900/30 to-gray-900/70 pointer-events-none z-[5]" />
    </section>
  );
};

export default HeroSection;
