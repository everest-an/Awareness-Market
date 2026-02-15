/**
 * Robot Dashboard Component
 *
 * 机器人管理仪表板
 */

import React, { useState, useEffect } from 'react';
import { roboticsClient } from '../../lib/robotics/robotics-client';
import type { RobotInfo, MultiRobotTask } from '../../../../server/robotics/types';

export const RobotDashboard: React.FC = () => {
  const [robots, setRobots] = useState<RobotInfo[]>([]);
  const [tasks, setTasks] = useState<MultiRobotTask[]>([]);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // 加载数据
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // 每 5 秒刷新
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'healthy':
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'busy':
      case 'in_progress':
        return 'text-yellow-600 bg-yellow-100';
      case 'offline':
      case 'error':
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getBatteryColor = (battery?: number) => {
    if (!battery) return 'text-gray-400';
    if (battery > 50) return 'text-green-600';
    if (battery > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* A. 全局觉察条 - Global Awareness Bar */}
      <div className="bg-white border-b-2 border-gray-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">System Status:</span>
              <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                healthStatus?.status === 'healthy'
                  ? 'bg-gray-100 text-gray-900 border-2 border-gray-900'
                  : 'bg-gray-200 text-gray-700 border-2 border-gray-500'
              }`}>
                [{healthStatus?.status === 'healthy' ? 'OPERATIONAL' : 'DEGRADED'}]
              </span>
            </div>

            <div className="h-6 w-px bg-gray-300" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Online Robots:</span>
              <span className="text-2xl font-black text-gray-900">{robots.length}</span>
            </div>

            <div className="h-6 w-px bg-gray-300" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Active Tasks:</span>
              <span className="text-2xl font-black text-gray-900">
                {tasks.filter(t => t.status === 'in_progress').length}
              </span>
            </div>

            <div className="h-6 w-px bg-gray-300" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Cache Hit:</span>
              <span className="text-lg font-bold text-gray-900">
                {healthStatus?.metrics ? (healthStatus.metrics.cacheHitRate * 100).toFixed(0) : '0'}%
              </span>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Last Update: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Robot Management Dashboard</h1>

        {/* B. 显性觉察引导 - Empty State Hero */}
        {!loading && robots.length === 0 && (
          <div className="mb-6 bg-white border-4 border-gray-900 rounded-lg p-8">
            <div className="max-w-2xl mx-auto text-center">
              <div className="mb-4">
                <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                  <svg className="w-16 h-16 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
              </div>

              <h2 className="text-2xl font-black text-gray-900 mb-3">
                System Ready - Awaiting Robot Connection
              </h2>

              <p className="text-gray-600 mb-6 text-lg">
                You haven't connected any robots yet. To start using the robot management system, please take the following action immediately:
              </p>

              <div className="space-y-3 mb-6">
                <button type="button" className="w-full bg-gray-900 text-white py-4 px-6 text-lg font-bold hover:bg-gray-800 transition border-4 border-gray-900">
                  ▶ Connect My First Robot
                </button>

                <button type="button" className="w-full bg-white text-gray-900 py-3 px-6 text-base font-medium hover:bg-gray-50 transition border-2 border-gray-300">
                  View Quick Start Guide →
                </button>
              </div>

              <div className="text-sm text-gray-500 space-y-1">
                <p>💡 Tip: You can connect Unitree Go2, Boston Dynamics Spot and other mainstream robots</p>
                <p>📚 Need help? Check <a href="#" className="underline font-medium">API Documentation</a></p>
              </div>
            </div>
          </div>
        )}

        {/* C. 关键指标觉察 - Key Metrics with High Contrast */}
        {healthStatus && robots.length > 0 && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-gray-300 rounded-lg p-6">
              <div className="text-sm text-gray-600 mb-2">System Health</div>
              <div className="flex items-baseline gap-3">
                <div className="text-5xl font-black text-gray-900">
                  {healthStatus.status === 'healthy' ? '100' : '75'}
                </div>
                <div className="text-xl text-gray-600">%</div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-bold border-2 ${
                  healthStatus.status === 'healthy'
                    ? 'border-gray-900 bg-gray-100 text-gray-900'
                    : 'border-gray-500 bg-gray-200 text-gray-700'
                }`}>
                  [Status: {healthStatus.status === 'healthy' ? 'EXCELLENT' : 'WARNING'}]
                </span>
              </div>
              <div className="mt-4 space-y-1 text-sm text-gray-600">
                <div>Redis: {healthStatus.services.redis.latency}ms</div>
                <div>PostgreSQL: {healthStatus.services.postgres.latency}ms</div>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-300 rounded-lg p-6">
              <div className="text-sm text-gray-600 mb-2">Active Sessions</div>
              <div className="flex items-baseline gap-3">
                <div className="text-5xl font-black text-gray-900">
                  {healthStatus.metrics?.activeSessions || 0}
                </div>
                <div className="text-xl text-gray-600">sessions</div>
              </div>
              <div className="mt-3">
                <div className="text-xs text-gray-500">
                  Capacity: {healthStatus.metrics?.activeSessions || 0} / 1,000
                </div>
                <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gray-900 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(((healthStatus.metrics?.activeSessions || 0) / 1000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-300 rounded-lg p-6">
              <div className="text-sm text-gray-600 mb-2">Cache Efficiency</div>
              <div className="flex items-baseline gap-3">
                <div className="text-5xl font-black text-gray-900">
                  {healthStatus.metrics ? (healthStatus.metrics.cacheHitRate * 100).toFixed(0) : '0'}
                </div>
                <div className="text-xl text-gray-600">%</div>
              </div>
              <div className="mt-3">
                <span className={`px-2 py-1 text-xs font-bold border-2 ${
                  (healthStatus.metrics?.cacheHitRate || 0) > 0.8
                    ? 'border-gray-900 bg-gray-100 text-gray-900'
                    : 'border-gray-500 bg-gray-200 text-gray-700'
                }`}>
                  [Performance: {(healthStatus.metrics?.cacheHitRate || 0) > 0.8 ? 'EXCELLENT' : 'FAIR'}]
                </span>
              </div>
            </div>
          </div>
        )}

      {/* Robots List */}
      {robots.length > 0 && (
        <div className="mb-6 bg-white border-2 border-gray-300 rounded-lg">
          <div className="p-4 border-b-2 border-gray-300 bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Online Robots
                <span className="ml-3 px-3 py-1 bg-gray-900 text-white text-sm font-bold">
                  {robots.length}
                </span>
              </h2>
              <button type="button" className="px-4 py-2 bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition">
                + Connect New Robot
              </button>
            </div>
          </div>
          <div className="p-4">
            {loading && robots.length === 0 ? (
              <div className="text-center py-8 text-gray-500 font-medium">Loading robots...</div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {robots.map((robot) => (
                <div key={robot.robotId} className="border-2 border-gray-300 rounded-lg p-4 hover:border-gray-900 transition">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900">{robot.name}</h3>
                      <p className="text-xs text-gray-500 font-mono">{robot.robotId}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-black border-2 ${
                      robot.status === 'online'
                        ? 'border-gray-900 bg-gray-100 text-gray-900'
                        : 'border-gray-400 bg-gray-200 text-gray-600'
                    }`}>
                      [{robot.status.toUpperCase()}]
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-xs">Type:</span>
                      <span className="font-bold text-gray-900">{robot.type}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-xs">Model:</span>
                      <span className="font-medium text-gray-900">{robot.manufacturer} {robot.model}</span>
                    </div>
                    {robot.battery !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-xs">Battery:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black text-gray-900">
                            {robot.battery}
                          </span>
                          <span className="text-sm text-gray-600">%</span>
                          {robot.battery < 20 && (
                            <span className="text-xs font-bold text-gray-700">⚠️</span>
                          )}
                        </div>
                      </div>
                    )}
                    {robot.location && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-xs">Location:</span>
                        <span className="font-mono text-xs text-gray-900">
                          ({robot.location.x.toFixed(1)}, {robot.location.y.toFixed(1)}, {robot.location.z.toFixed(1)})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t-2 border-gray-200">
                    <div className="text-xs font-bold text-gray-700 mb-2">Capabilities:</div>
                    <div className="flex flex-wrap gap-1">
                      {robot.capabilities.slice(0, 3).map((cap, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-900 text-xs font-medium border border-gray-300">
                          {cap}
                        </span>
                      ))}
                      {robot.capabilities.length > 3 && (
                        <span className="px-2 py-1 bg-gray-900 text-white text-xs font-bold">
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
        <div className="bg-white border-2 border-gray-300 rounded-lg">
          <div className="p-4 border-b-2 border-gray-300 bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Recent Tasks
                <span className="ml-3 px-3 py-1 bg-gray-900 text-white text-sm font-bold">
                  {tasks.length}
                </span>
              </h2>
              <div className="flex gap-2 text-xs font-medium text-gray-600">
                <span>In Progress: <strong className="text-gray-900 text-lg">{tasks.filter(t => t.status === 'in_progress').length}</strong></span>
                <span className="mx-2">|</span>
                <span>Completed: <strong className="text-gray-900 text-lg">{tasks.filter(t => t.status === 'completed').length}</strong></span>
              </div>
            </div>
          </div>
          <div className="p-4">
            {loading && tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500 font-medium">Loading tasks...</div>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 10).map((task) => (
                  <div key={task.taskId} className="border-2 border-gray-300 rounded-lg p-4 hover:border-gray-900 transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{task.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-black border-2 whitespace-nowrap ${
                        task.status === 'completed'
                          ? 'border-gray-900 bg-gray-100 text-gray-900'
                          : task.status === 'in_progress'
                          ? 'border-gray-600 bg-gray-50 text-gray-900'
                          : 'border-gray-400 bg-gray-200 text-gray-700'
                      }`}>
                        [{task.status.replace('_', ' ').toUpperCase()}]
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-600 mt-3">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Robots:</span>
                        <span className="font-black text-lg text-gray-900">{task.robotIds.length}</span>
                      </div>
                      <div className="h-4 w-px bg-gray-300" />
                      <div>
                        Created: {new Date(task.createdAt).toLocaleString('en-US')}
                      </div>
                      {task.completedAt && (
                        <>
                          <div className="h-4 w-px bg-gray-300" />
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

      {/* Error Display with High Awareness */}
      {error && (
        <div className="mt-4 bg-white border-4 border-gray-900 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-gray-900 mb-2">[SYSTEM ERROR]</h3>
              <p className="text-gray-700 font-medium">{error}</p>
              <button
                type="button"
                onClick={loadData}
                className="mt-4 px-4 py-2 bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition"
              >
                Retry Loading
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
