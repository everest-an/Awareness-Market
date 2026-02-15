/**
 * Landing Page
 *
 * Main marketing page with Unicorn Studio animation
 */

import React from 'react';
import { HeroSection } from '../components/HeroSection';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section with Animation */}
      <HeroSection
        title="Awareness Network"
        subtitle="Production-Grade Robot Management Middleware for the Next Generation"
        ctaText="Start Building"
        ctaHref="/robotics"
        showAnimation={true}
      />

      {/* Features Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-4">
              Built for Scale. Ready for Production.
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Connect, manage, and control 1,000+ robots with enterprise-grade reliability
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1: Performance */}
            <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-8 hover:border-gray-900 transition">
              <div className="text-6xl font-black text-gray-900 mb-4">125x</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Performance Boost
              </h3>
              <p className="text-gray-600">
                Redis caching delivers 125x faster RMC retrieval and 100x VR concurrency
              </p>
              <div className="mt-4">
                <span className="px-3 py-1 bg-gray-900 text-white text-xs font-bold">
                  [REDIS + BULLMQ]
                </span>
              </div>
            </div>

            {/* Feature 2: Reliability */}
            <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-8 hover:border-gray-900 transition">
              <div className="text-6xl font-black text-gray-900 mb-4">99.9%</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Uptime Guarantee
              </h3>
              <p className="text-gray-600">
                Multi-AZ deployment with automatic failover and health monitoring
              </p>
              <div className="mt-4">
                <span className="px-3 py-1 bg-gray-900 text-white text-xs font-bold">
                  [AWS MULTI-AZ]
                </span>
              </div>
            </div>

            {/* Feature 3: Cost */}
            <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-8 hover:border-gray-900 transition">
              <div className="text-6xl font-black text-gray-900 mb-4">$1.40</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Per Robot/Month
              </h3>
              <p className="text-gray-600">
                Cost-optimized infrastructure supporting 1,000+ robots at scale
              </p>
              <div className="mt-4">
                <span className="px-3 py-1 bg-gray-900 text-white text-xs font-bold">
                  [COST-EFFICIENT]
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="bg-gray-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-4">
              Enterprise Technology Stack
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
                className="bg-white border-2 border-gray-300 rounded-lg p-6 text-center hover:border-gray-900 transition"
              >
                <div className="text-2xl font-black text-gray-900 mb-2">
                  {tech.name}
                </div>
                <div className="text-sm text-gray-600">{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-black text-white mb-6">
            Ready to Scale Your Robot Fleet?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join the next generation of robot management with production-ready infrastructure
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/robotics"
              className="px-8 py-4 bg-white text-gray-900 text-lg font-black hover:bg-gray-100 transition border-4 border-white inline-block"
            >
              ▶ Start Free Trial
            </a>
            <a
              href="https://github.com/awareness-network"
              className="px-8 py-4 bg-transparent text-white text-lg font-bold hover:bg-white hover:text-gray-900 transition border-2 border-white inline-block"
            >
              View on GitHub →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t-2 border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-500 text-sm">
            <p className="mb-2">© 2026 Awareness Network. All rights reserved.</p>
            <p>Production-ready with Redis, BullMQ, PostgreSQL, and Prometheus monitoring</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
