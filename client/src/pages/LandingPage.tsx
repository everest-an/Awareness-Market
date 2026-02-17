/**
 * Landing Page
 *
 * Main marketing page with Unicorn Studio animation
 */

import { HeroSection } from '../components/HeroSection';
import { Play, ArrowRight } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* Hero Section with Animation */}
      <div className="pt-20">
        <HeroSection
          title="Awareness Network"
          subtitle="Production-Grade Robot Management Middleware for the Next Generation"
          ctaText="Start Building"
          ctaHref="/robotics"
          showAnimation={true}
        />
      </div>

      {/* Features Section */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Built for Scale. Ready for Production.
            </h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">
              Connect, manage, and control 1,000+ robots with enterprise-grade reliability
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: Performance */}
            <div className="glass-card p-8 rounded-2xl">
              <div className="text-5xl font-bold text-white mb-4">125x</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Performance Boost
              </h3>
              <p className="text-white/50 text-sm">
                Redis caching delivers 125x faster RMC retrieval and 100x VR concurrency
              </p>
              <div className="mt-4">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  REDIS + BULLMQ
                </span>
              </div>
            </div>

            {/* Feature 2: Reliability */}
            <div className="glass-card p-8 rounded-2xl">
              <div className="text-5xl font-bold text-white mb-4">99.9%</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Uptime Guarantee
              </h3>
              <p className="text-white/50 text-sm">
                Multi-AZ deployment with automatic failover and health monitoring
              </p>
              <div className="mt-4">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  AWS MULTI-AZ
                </span>
              </div>
            </div>

            {/* Feature 3: Cost */}
            <div className="glass-card p-8 rounded-2xl">
              <div className="text-5xl font-bold text-white mb-4">$1.40</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Per Robot/Month
              </h3>
              <p className="text-white/50 text-sm">
                Cost-optimized infrastructure supporting 1,000+ robots at scale
              </p>
              <div className="mt-4">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  COST-EFFICIENT
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Enterprise Technology Stack
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Redis', desc: 'Caching Layer' },
              { name: 'BullMQ', desc: 'Task Queue' },
              { name: 'PostgreSQL', desc: 'Persistence' },
              { name: 'Prometheus', desc: 'Monitoring' },
              { name: 'WebXR', desc: 'VR Control' },
              { name: 'WebRTC', desc: 'Video Stream' },
              { name: 'ROS2', desc: 'Robot Bridge' },
              { name: 'TypeScript', desc: 'Type Safety' },
            ].map((tech, idx) => (
              <div
                key={idx}
                className="glass-card p-6 rounded-xl text-center"
              >
                <div className="text-xl font-bold text-white mb-1">
                  {tech.name}
                </div>
                <div className="text-xs text-white/40">{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Scale Your Robot Fleet?
          </h2>
          <p className="text-lg text-white/50 mb-8">
            Join the next generation of robot management with production-ready infrastructure
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/robotics"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-[#0a0a0f] text-lg font-semibold rounded-xl hover:bg-white/90 transition"
            >
              <Play className="w-5 h-5" />
              Start Free Trial
            </a>
            <a
              href="https://github.com/awareness-network"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 glass-card text-white text-lg font-semibold rounded-xl hover:bg-white/[0.08] transition"
            >
              View on GitHub
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white/30 text-sm">
            <p className="mb-2">&copy; 2026 Awareness Network. All rights reserved.</p>
            <p>Production-ready with Redis, BullMQ, PostgreSQL, and Prometheus monitoring</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
