/**
 * VR Controller for Remote Robot Operation
 *
 * 使用 WebRTC 实时视频流和 WebSocket 控制指令
 * 支持 Meta Quest, PICO 等 VR 设备
 */

import type { VRSession, RobotSession } from './types';
import { nanoid } from 'nanoid';

export class VRController {
  private vrSessions: Map<string, VRSession> = new Map();
  private controlChannels: Map<string, any> = new Map(); // WebSocket connections

  /**
   * 创建 VR 控制会话
   */
  async createVRSession(
    userId: number,
    robotId: string,
    robotSession: RobotSession
  ): Promise<VRSession> {
    if (!robotSession.capabilities.canMove) {
      throw new Error('Robot does not have movement permission');
    }

    const sessionId = `vr_${nanoid()}`;

    const vrSession: VRSession = {
      sessionId,
      userId,
      robotId,
      status: 'connecting',
      startedAt: new Date(),
    };

    this.vrSessions.set(sessionId, vrSession);

    console.log(`[VRController] Created VR session ${sessionId} for robot ${robotId}`);

    return vrSession;
  }

  /**
   * 设置视频流 URL（机器人摄像头 → VR 头显）
   */
  async setupVideoStream(sessionId: string, robotCameraUrl: string): Promise<string> {
    const session = this.vrSessions.get(sessionId);
    if (!session) {
      throw new Error('VR session not found');
    }

    // 在实际环境中，这里会配置 WebRTC peer connection
    // 现在返回模拟的流 URL
    const streamUrl = `wss://${process.env.DOMAIN || 'localhost:5000'}/vr/stream/${sessionId}`;

    session.videoStreamUrl = streamUrl;
    session.status = 'connected';

    console.log(`[VRController] Video stream configured for session ${sessionId}`);

    return streamUrl;
  }

  /**
   * 设置控制通道（VR 手柄 → 机器人运动）
   */
  async setupControlChannel(sessionId: string, wsConnection: any): Promise<string> {
    const session = this.vrSessions.get(sessionId);
    if (!session) {
      throw new Error('VR session not found');
    }

    const channelUrl = `wss://${process.env.DOMAIN || 'localhost:5000'}/vr/control/${sessionId}`;

    session.controlChannel = channelUrl;
    this.controlChannels.set(sessionId, wsConnection);

    console.log(`[VRController] Control channel configured for session ${sessionId}`);

    return channelUrl;
  }

  /**
   * 处理 VR 控制指令
   */
  async handleVRCommand(sessionId: string, command: any): Promise<any> {
    const session = this.vrSessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('VR session not active');
    }

    // 解析 VR 手柄输入
    const { type, data } = command;

    switch (type) {
      case 'movement':
        return this.handleMovement(session, data);

      case 'gesture':
        return this.handleGesture(session, data);

      case 'teleport':
        return this.handleTeleport(session, data);

      case 'action':
        return this.handleAction(session, data);

      default:
        console.warn(`[VRController] Unknown command type: ${type}`);
        return { success: false, error: 'Unknown command' };
    }
  }

  /**
   * 处理运动控制（VR 摇杆 → ROS2 /cmd_vel）
   */
  private async handleMovement(session: VRSession, data: any): Promise<any> {
    const { linear, angular } = data;

    // 转换为 ROS2 Twist 消息
    const ros2Message = {
      type: '/cmd_vel',
      data: {
        linear: {
          x: linear.x || 0,
          y: linear.y || 0,
          z: linear.z || 0,
        },
        angular: {
          x: angular.x || 0,
          y: angular.y || 0,
          z: angular.z || 0,
        },
      },
      timestamp: Date.now(),
      robotId: session.robotId,
    };

    // 发送到机器人（通过 ROS2 Bridge）
    console.log(`[VRController] Movement command:`, ros2Message);

    return { success: true, command: 'movement', data: ros2Message };
  }

  /**
   * 处理手势映射（VR 手势 → 机器人动作）
   */
  private async handleGesture(session: VRSession, data: any): Promise<any> {
    const { gesture, intensity } = data;

    // 手势库映射
    const gestureMap: Record<string, string> = {
      wave: 'greet',
      point: 'indicate',
      grab: 'grasp',
      push: 'push_object',
    };

    const action = gestureMap[gesture] || 'unknown';

    console.log(`[VRController] Gesture ${gesture} → Action ${action}`);

    return { success: true, command: 'gesture', action, intensity };
  }

  /**
   * 处理瞬移（VR 传送 → 机器人导航）
   */
  private async handleTeleport(session: VRSession, data: any): Promise<any> {
    const { targetX, targetY, targetZ } = data;

    // 转换为 ROS2 导航目标
    const navigationGoal = {
      type: '/move_base_simple/goal',
      data: {
        pose: {
          position: { x: targetX, y: targetY, z: targetZ },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        },
      },
      timestamp: Date.now(),
      robotId: session.robotId,
    };

    console.log(`[VRController] Teleport to:`, navigationGoal);

    return { success: true, command: 'teleport', goal: navigationGoal };
  }

  /**
   * 处理自定义动作
   */
  private async handleAction(session: VRSession, data: any): Promise<any> {
    const { actionName, parameters } = data;

    console.log(`[VRController] Custom action: ${actionName}`, parameters);

    return { success: true, command: 'action', actionName, parameters };
  }

  /**
   * 更新会话指标（延迟、帧率等）
   */
  updateMetrics(sessionId: string, metrics: { latency?: number; fps?: number; bandwidth?: number }): void {
    const session = this.vrSessions.get(sessionId);
    if (session) {
      session.metrics = {
        latency: metrics.latency ?? session.metrics?.latency ?? 0,
        fps: metrics.fps ?? session.metrics?.fps ?? 0,
        bandwidth: metrics.bandwidth ?? session.metrics?.bandwidth ?? 0,
      };
    }
  }

  /**
   * 获取会话状态
   */
  getVRSession(sessionId: string): VRSession | null {
    return this.vrSessions.get(sessionId) || null;
  }

  /**
   * 终止 VR 会话
   */
  async terminateSession(sessionId: string): Promise<void> {
    const session = this.vrSessions.get(sessionId);
    if (session) {
      session.status = 'disconnected';
      session.endedAt = new Date();

      // 关闭 WebSocket 连接
      const wsConnection = this.controlChannels.get(sessionId);
      if (wsConnection && typeof wsConnection.close === 'function') {
        wsConnection.close();
      }

      this.controlChannels.delete(sessionId);

      console.log(`[VRController] VR session ${sessionId} terminated`);
    }
  }

  /**
   * 列出所有活跃的 VR 会话
   */
  listActiveSessions(): VRSession[] {
    return Array.from(this.vrSessions.values()).filter(
      (s) => s.status === 'connected' || s.status === 'connecting'
    );
  }
}

// 单例实例
let vrControllerInstance: VRController | null = null;

export function getVRController(): VRController {
  if (!vrControllerInstance) {
    vrControllerInstance = new VRController();
  }
  return vrControllerInstance;
}
