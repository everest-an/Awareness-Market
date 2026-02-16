/**
 * VR Control Panel Component
 *
 * Dark glassmorphism theme matching the rest of the site.
 */

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    checkVRSupport();
    loadRobots();
  }, []);

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
      const mcpToken = localStorage.getItem('mcp_token') || '';
      const session = await roboticsClient.createVRSession(selectedRobotId, mcpToken);
      setVrSession(session);
      await vrInterface.startVRSession(session);
      vrInterface.onCommand((command) => {
        setCommands((prev) => [
          { timestamp: new Date().toISOString(), ...command },
          ...prev.slice(0, 19),
        ]);
      });
    } catch (err: any) {
      setError(err.message || 'Failed to start VR session');
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
    } catch (err: any) {
      setError(err.message || 'Failed to end VR session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1 className="text-3xl font-bold mb-6">VR Robot Control</h1>

      {/* VR Support Warning */}
      {!vrSupported && (
        <div className="mb-6 glass-card p-4 border border-yellow-500/20">
          <p className="text-yellow-400 text-sm">
            <strong>Warning:</strong> WebXR not supported in this browser. Please use a VR-compatible browser like Chrome or Firefox.
          </p>
        </div>
      )}

      {/* Control Panel */}
      <div className="mb-6 glass-card p-6">
        <h2 className="text-xl font-semibold mb-4">VR Session Control</h2>

        {!vrSession ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/50 mb-2">
                Select Robot
              </label>
              <select
                value={selectedRobotId}
                onChange={(e) => setSelectedRobotId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30 transition-colors"
                disabled={loading}
                title="Select a robot for VR control"
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
              type="button"
              onClick={startVRSession}
              disabled={!selectedRobotId || loading || !vrSupported}
              className="px-6 py-3 font-medium rounded-full bg-white/[0.06] backdrop-blur-md border border-white/[0.1] text-white hover:bg-white/[0.12] hover:border-white/[0.18] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Starting...' : 'Start VR Session'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 glass-card border border-green-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-green-400">VR Session Active</div>
                  <div className="text-sm text-white/40 mt-1">
                    Session: {vrSession.sessionId}
                  </div>
                  <div className="text-sm text-white/40">
                    Robot: {selectedRobotId}
                  </div>
                </div>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  {vrSession.status.toUpperCase()}
                </span>
              </div>

              {sessionStatus && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-white/40">VR Active</span>
                      <span className="ml-2 font-medium text-white">
                        {sessionStatus.active ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/40">Connection</span>
                      <span className="ml-2 font-medium text-white capitalize">
                        {sessionStatus.connectionStatus}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/40">Started</span>
                      <span className="ml-2 font-medium text-white">
                        {new Date(vrSession.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={endVRSession}
              disabled={loading}
              className="px-6 py-3 font-medium rounded-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition-all"
            >
              {loading ? 'Ending...' : 'End VR Session'}
            </button>
          </div>
        )}
      </div>

      {/* Command Log */}
      {vrSession && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-xl font-semibold">Command Log</h2>
          </div>
          <div className="p-4">
            {commands.length === 0 ? (
              <div className="text-center py-8 text-white/30">
                No commands sent yet. Put on your VR headset and start controlling the robot!
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {commands.map((cmd, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 glass-card">
                    <div className="text-xs text-white/30 w-24 flex-shrink-0">
                      {new Date(cmd.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-blue-400">{cmd.type}</span>
                      <div className="text-sm text-white/40 mt-1 break-all">
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
        <div className="mt-6 glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-3">VR Control Instructions</h3>
          <div className="space-y-2 text-sm text-white/50">
            <div><strong className="text-white/70">Right Controller:</strong></div>
            <ul className="list-disc ml-6 space-y-1">
              <li>Joystick Up/Down: Move forward/backward</li>
              <li>Joystick Left/Right: Rotate left/right</li>
              <li>Trigger: Execute action</li>
            </ul>
            <div className="mt-3"><strong className="text-white/70">Left Controller:</strong></div>
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
        <div className="mt-4 glass-card p-4 border border-red-500/20">
          <p className="text-red-400 text-sm"><strong>Error:</strong> {error}</p>
        </div>
      )}
    </div>
  );
};
