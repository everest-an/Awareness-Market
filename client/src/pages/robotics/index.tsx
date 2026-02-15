/**
 * Robotics Main Page
 *
 * Robot Management Main Page
 */

import React, { useState } from 'react';
import { RobotDashboard, VRControlPanel } from '../../components/robotics';

type TabType = 'dashboard' | 'vr';

export default function RoboticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                🤖 Robot Management System
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Powered by Awareness Network
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vr')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                activeTab === 'vr'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              VR Control
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="py-6">
        {activeTab === 'dashboard' && <RobotDashboard />}
        {activeTab === 'vr' && <VRControlPanel />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>Awareness Network - Robotics Middleware v1.0</p>
            <p className="mt-1">
              Production-ready with Redis, BullMQ, PostgreSQL, and Prometheus monitoring
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
