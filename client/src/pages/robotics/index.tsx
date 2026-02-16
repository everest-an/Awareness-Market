/**
 * Robotics Main Page
 *
 * Robot Management with dark glassmorphism theme
 */

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { RobotDashboard, VRControlPanel } from '../../components/robotics';

type TabType = 'dashboard' | 'vr';

export default function RoboticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      <Navbar />

      {/* Tab Navigation */}
      <div className="container">
        <div className="flex items-center gap-6 border-b border-white/10 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`py-4 px-1 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'dashboard'
                ? 'border-white text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vr')}
            className={`py-4 px-1 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'vr'
                ? 'border-white text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            VR Control
          </button>
        </div>
      </div>

      {/* Content */}
      <main>
        {activeTab === 'dashboard' && <RobotDashboard />}
        {activeTab === 'vr' && <VRControlPanel />}
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 mt-12">
        <div className="container text-center text-sm text-white/30">
          <p>Awareness Network — Robotics Middleware v1.0</p>
          <p className="mt-1">
            Production-ready with Redis, BullMQ, PostgreSQL, and Prometheus
          </p>
        </div>
      </footer>
    </div>
  );
}
