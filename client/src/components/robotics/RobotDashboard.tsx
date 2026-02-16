/**
 * Robot Dashboard Component
 *
 * Dark glassmorphism theme matching the rest of the site.
 */

import { useState, useEffect } from 'react';
import { roboticsClient } from '../../lib/robotics/robotics-client';
import type { RobotInfo, MultiRobotTask } from '../../../../server/robotics/types';

export const RobotDashboard: React.FC = () => {
  const [robots, setRobots] = useState<RobotInfo[]>([]);
  const [tasks, setTasks] = useState<MultiRobotTask[]>([]);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [robotsData, tasksData, health] = await Promise.all([
        roboticsClient.listOnlineRobots(),
        roboticsClient.listTasks(),
        roboticsClient.healthCheck(),
      ]);

      setRobots(robotsData);
      setTasks(tasksData);
      setHealthStatus(health);
      setLastUpdate(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      {/* Global Awareness Bar */}
      <div className="glass-card p-4 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/50">System Status</span>
              <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                healthStatus?.status === 'healthy'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
              }`}>
                {healthStatus?.status === 'healthy' ? 'OPERATIONAL' : 'DEGRADED'}
              </span>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-white/50">Online Robots</span>
              <span className="text-2xl font-black text-white">{robots.length}</span>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-white/50">Active Tasks</span>
              <span className="text-2xl font-black text-white">
                {tasks.filter(t => t.status === 'in_progress').length}
              </span>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-white/50">Cache Hit</span>
              <span className="text-lg font-bold text-white">
                {healthStatus?.metrics ? (healthStatus.metrics.cacheHitRate * 100).toFixed(0) : '0'}%
              </span>
            </div>
          </div>

          <div className="text-xs text-white/30">
            Last Update: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-6">Robot Management Dashboard</h1>

      {/* Empty State Hero */}
      {!loading && robots.length === 0 && (
        <div className="mb-8 glass-card p-8 border border-white/10">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-4">
              <div className="inline-block p-4 bg-white/5 rounded-full mb-4">
                <svg className="w-16 h-16 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-black text-white mb-3">
              System Ready — Awaiting Robot Connection
            </h2>

            <p className="text-white/50 mb-6 text-lg">
              No robots connected yet. Connect your first robot to start using the management system.
            </p>

            <div className="space-y-3 mb-6">
              <button type="button" className="w-full rounded-full px-6 py-4 text-lg font-bold bg-white/[0.06] backdrop-blur-md border border-white/[0.1] text-white hover:bg-white/[0.12] hover:border-white/[0.18] transition-all">
                Connect My First Robot
              </button>

              <button type="button" className="w-full rounded-full px-6 py-3 text-base font-medium text-white/50 hover:text-white/80 transition-colors">
                View Quick Start Guide
              </button>
            </div>

            <div className="text-sm text-white/30 space-y-1">
              <p>Supports Unitree Go2, Boston Dynamics Spot and more</p>
              <p>Need help? Check <a href="/docs/sdk" className="underline text-white/50 hover:text-white/70">API Documentation</a></p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      {healthStatus && robots.length > 0 && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-6">
            <div className="text-sm text-white/50 mb-2">System Health</div>
            <div className="flex items-baseline gap-3">
              <div className="text-5xl font-black text-white">
                {healthStatus.status === 'healthy' ? '100' : '75'}
              </div>
              <div className="text-xl text-white/40">%</div>
            </div>
            <div className="mt-3">
              <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                healthStatus.status === 'healthy'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
              }`}>
                {healthStatus.status === 'healthy' ? 'EXCELLENT' : 'WARNING'}
              </span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-white/40">
              <div>Redis: {healthStatus.services.redis.latency}ms</div>
              <div>PostgreSQL: {healthStatus.services.postgres.latency}ms</div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="text-sm text-white/50 mb-2">Active Sessions</div>
            <div className="flex items-baseline gap-3">
              <div className="text-5xl font-black text-white">
                {healthStatus.metrics?.activeSessions || 0}
              </div>
              <div className="text-xl text-white/40">sessions</div>
            </div>
            <div className="mt-3">
              <div className="text-xs text-white/30">
                Capacity: {healthStatus.metrics?.activeSessions || 0} / 1,000
              </div>
              <div className="mt-2 bg-white/5 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-white/40 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(((healthStatus.metrics?.activeSessions || 0) / 1000) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="text-sm text-white/50 mb-2">Cache Efficiency</div>
            <div className="flex items-baseline gap-3">
              <div className="text-5xl font-black text-white">
                {healthStatus.metrics ? (healthStatus.metrics.cacheHitRate * 100).toFixed(0) : '0'}
              </div>
              <div className="text-xl text-white/40">%</div>
            </div>
            <div className="mt-3">
              <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                (healthStatus.metrics?.cacheHitRate || 0) > 0.8
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
              }`}>
                {(healthStatus.metrics?.cacheHitRate || 0) > 0.8 ? 'EXCELLENT' : 'FAIR'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Robots List */}
      {robots.length > 0 && (
        <div className="mb-8 glass-card overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Online Robots
                <span className="ml-3 px-3 py-1 bg-white/10 text-white text-sm font-bold rounded-full">
                  {robots.length}
                </span>
              </h2>
              <button type="button" className="px-4 py-2 text-sm font-medium rounded-full bg-white/[0.06] border border-white/[0.1] text-white/80 hover:bg-white/[0.12] transition-all">
                + Connect New Robot
              </button>
            </div>
          </div>
          <div className="p-4">
            {loading && robots.length === 0 ? (
              <div className="text-center py-8 text-white/30">Loading robots...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {robots.map((robot) => (
                  <div key={robot.robotId} className="glass-card p-4 hover:border-white/20 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-white">{robot.name}</h3>
                        <p className="text-xs text-white/30 font-mono">{robot.robotId}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        robot.status === 'online'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-white/5 text-white/40 border border-white/10'
                      }`}>
                        {robot.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-white/40 text-xs">Type</span>
                        <span className="font-medium text-white">{robot.type}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/40 text-xs">Model</span>
                        <span className="font-medium text-white">{robot.manufacturer} {robot.model}</span>
                      </div>
                      {robot.battery !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-white/40 text-xs">Battery</span>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-white">
                              {robot.battery}
                            </span>
                            <span className="text-sm text-white/40">%</span>
                          </div>
                        </div>
                      )}
                      {robot.location && (
                        <div className="flex justify-between items-center">
                          <span className="text-white/40 text-xs">Location</span>
                          <span className="font-mono text-xs text-white/60">
                            ({robot.location.x.toFixed(1)}, {robot.location.y.toFixed(1)}, {robot.location.z.toFixed(1)})
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="text-xs text-white/30 mb-2">Capabilities</div>
                      <div className="flex flex-wrap gap-1">
                        {robot.capabilities.slice(0, 3).map((cap, idx) => (
                          <span key={idx} className="px-2 py-1 bg-white/5 text-white/60 text-xs rounded border border-white/10">
                            {cap}
                          </span>
                        ))}
                        {robot.capabilities.length > 3 && (
                          <span className="px-2 py-1 bg-white/10 text-white/80 text-xs rounded font-bold">
                            +{robot.capabilities.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tasks List */}
      {tasks.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Recent Tasks
                <span className="ml-3 px-3 py-1 bg-white/10 text-white text-sm font-bold rounded-full">
                  {tasks.length}
                </span>
              </h2>
              <div className="flex gap-4 text-xs text-white/40">
                <span>In Progress: <strong className="text-white text-lg">{tasks.filter(t => t.status === 'in_progress').length}</strong></span>
                <span>Completed: <strong className="text-white text-lg">{tasks.filter(t => t.status === 'completed').length}</strong></span>
              </div>
            </div>
          </div>
          <div className="p-4">
            {loading && tasks.length === 0 ? (
              <div className="text-center py-8 text-white/30">Loading tasks...</div>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 10).map((task) => (
                  <div key={task.taskId} className="glass-card p-4 hover:border-white/20 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-white">{task.name}</h3>
                        <p className="text-sm text-white/40 mt-1">{task.description}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap ${
                        task.status === 'completed'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : task.status === 'in_progress'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-white/5 text-white/40 border border-white/10'
                      }`}>
                        {task.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-white/30 mt-3">
                      <div className="flex items-center gap-1">
                        <span>Robots:</span>
                        <span className="font-black text-lg text-white">{task.robotIds.length}</span>
                      </div>
                      <div className="h-4 w-px bg-white/10" />
                      <div>
                        Created: {new Date(task.createdAt).toLocaleString('en-US')}
                      </div>
                      {task.completedAt && (
                        <>
                          <div className="h-4 w-px bg-white/10" />
                          <div>
                            Completed: {new Date(task.completedAt).toLocaleString('en-US')}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 glass-card p-6 border border-red-500/20">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-red-400 mb-2">SYSTEM ERROR</h3>
              <p className="text-white/60">{error}</p>
              <button
                type="button"
                onClick={loadData}
                className="mt-4 px-4 py-2 text-sm font-medium rounded-full bg-white/[0.06] border border-white/[0.1] text-white/80 hover:bg-white/[0.12] transition-all"
              >
                Retry Loading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
