/**
 * VR Control Panel Component
 *
 * VR Robot Control Panel
 */

import React, { useState, useEffect } from 'react';
import { roboticsClient } from '../../lib/robotics/robotics-client';
import { vrInterface } from '../../lib/robotics/vr-interface';
import type { VRSession, RobotInfo } from '../../../../server/robotics/types';

export const VRControlPanel: React.FC = () => {
  const [robots, setRobots] = useState<RobotInfo[]>([]);
  const [selectedRobotId, setSelectedRobotId] = useState<string>('');
  const [vrSession, setVrSession] = useState<VRSession | null>(null);
  const [vrSupported, setVrSupported] = useState<boolean>(false);
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const [commands, setCommands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check VR support
  useEffect(() => {
    checkVRSupport();
    loadRobots();
  }, []);

  // Monitor VR session status
  useEffect(() => {
    if (!vrSession) return;

    const interval = setInterval(() => {
      const status = vrInterface.getSessionStatus();
      setSessionStatus(status);
    }, 1000);

    return () => clearInterval(interval);
  }, [vrSession]);

  const checkVRSupport = async () => {
    const supported = await vrInterface.checkVRSupport();
    setVrSupported(supported);
  };

  const loadRobots = async () => {
    try {
      const data = await roboticsClient.listOnlineRobots();
      setRobots(data.filter(r => r.status === 'online'));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startVRSession = async () => {
    if (!selectedRobotId) {
      setError('Please select a robot');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create VR session
      const mcpToken = localStorage.getItem('mcp_token') || '';
      const session = await roboticsClient.createVRSession(selectedRobotId, mcpToken);
      setVrSession(session);

      // Start VR interface
      await vrInterface.startVRSession(session);

      // Listen to control commands
      vrInterface.onCommand((command) => {
        setCommands((prev) => [
          { timestamp: new Date().toISOString(), ...command },
          ...prev.slice(0, 19), // 保留最近 20 条
        ]);
      });

      console.log('VR session started:', session);
    } catch (err: any) {
      setError(err.message || 'Failed to start VR session');
      console.error('VR session error:', err);
    } finally {
      setLoading(false);
    }
  };

  const endVRSession = async () => {
    try {
      setLoading(true);
      setError(null);

      if (vrSession) {
        await roboticsClient.terminateVRSession(vrSession.sessionId);
      }

      await vrInterface.endSession();
      setVrSession(null);
      setSessionStatus(null);
      setCommands([]);

      console.log('VR session ended');
    } catch (err: any) {
      setError(err.message || 'Failed to end VR session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">VR Robot Control</h1>

      {/* VR Support Check */}
      {!vrSupported && (
        <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
          <strong>Warning:</strong> WebXR not supported in this browser. Please use a VR-compatible browser like Chrome or Firefox.
        </div>
      )}

      {/* Control Panel */}
      <div className="mb-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">VR Session Control</h2>

        {!vrSession ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Robot
              </label>
              <select
                value={selectedRobotId}
                onChange={(e) => setSelectedRobotId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">-- Select a robot --</option>
                {robots.map((robot) => (
                  <option key={robot.robotId} value={robot.robotId}>
                    {robot.name} ({robot.manufacturer} {robot.model})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={startVRSession}
              disabled={!selectedRobotId || loading || !vrSupported}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Starting...' : 'Start VR Session'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-100 border border-green-400 rounded">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-green-800">VR Session Active</div>
                  <div className="text-sm text-green-700">
                    Session ID: {vrSession.sessionId}
                  </div>
                  <div className="text-sm text-green-700">
                    Robot: {selectedRobotId}
                  </div>
                </div>
                <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-medium">
                  {vrSession.status.toUpperCase()}
                </span>
              </div>

              {sessionStatus && (
                <div className="mt-3 pt-3 border-t border-green-300">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-green-700">VR Active:</span>
                      <span className="ml-2 font-medium">
                        {sessionStatus.active ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-green-700">Connection:</span>
                      <span className="ml-2 font-medium capitalize">
                        {sessionStatus.connectionStatus}
                      </span>
                    </div>
                    <div>
                      <span className="text-green-700">Started:</span>
                      <span className="ml-2 font-medium">
                        {new Date(vrSession.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={endVRSession}
              disabled={loading}
              className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 transition"
            >
              {loading ? 'Ending...' : 'End VR Session'}
            </button>
          </div>
        )}
      </div>

      {/* Command Log */}
      {vrSession && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">Command Log</h2>
          </div>
          <div className="p-4">
            {commands.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No commands sent yet. Put on your VR headset and start controlling the robot!
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {commands.map((cmd, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50">
                    <div className="text-xs text-gray-500 w-24">
                      {new Date(cmd.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-blue-600">{cmd.type}</span>
                      <div className="text-sm text-gray-600 mt-1">
                        {JSON.stringify(cmd.data)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      {!vrSession && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">VR Control Instructions</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <div><strong>Right Controller:</strong></div>
            <ul className="list-disc ml-6 space-y-1">
              <li>Joystick Up/Down: Move forward/backward</li>
              <li>Joystick Left/Right: Rotate left/right</li>
              <li>Trigger: Execute action</li>
            </ul>
            <div className="mt-3"><strong>Left Controller:</strong></div>
            <ul className="list-disc ml-6 space-y-1">
              <li>A Button: Jump</li>
              <li>B Button: Crouch</li>
              <li>Hand Gestures: Wave, Point</li>
            </ul>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
};
