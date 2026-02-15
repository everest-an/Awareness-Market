/**
 * VR Interface for Robot Control
 *
 * WebXR VR 控制界面
 * 支持 Meta Quest、HTC Vive、Valve Index 等 VR 设备
 */

import type { VRSession } from '../../../../server/robotics/types';

export interface VRController {
  hand: 'left' | 'right';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  buttons: boolean[];
  axes: number[];
}

export interface RobotControlCommand {
  type: 'move' | 'rotate' | 'action' | 'gesture';
  data: any;
}

export class VRRobotInterface {
  private xrSession: XRSession | null = null;
  private xrRefSpace: XRReferenceSpace | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private webSocket: WebSocket | null = null;
  private vrSession: VRSession | null = null;
  private animationFrameId: number | null = null;

  private onCommandCallback: ((command: RobotControlCommand) => void) | null = null;

  /**
   * 检查 VR 支持
   */
  async checkVRSupport(): Promise<boolean> {
    if (!navigator.xr) {
      console.warn('WebXR not supported');
      return false;
    }

    try {
      const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
      return isSupported;
    } catch (error) {
      console.error('Failed to check VR support:', error);
      return false;
    }
  }

  /**
   * 启动 VR 会话
   */
  async startVRSession(vrSession: VRSession): Promise<void> {
    this.vrSession = vrSession;

    // 请求 VR 会话
    try {
      this.xrSession = await navigator.xr!.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor', 'hand-tracking'],
        optionalFeatures: ['bounded-floor'],
      });

      // 设置参考空间
      this.xrRefSpace = await this.xrSession.requestReferenceSpace('local-floor');

      // 初始化视频流
      await this.initializeVideoStream(vrSession.videoStreamUrl!);

      // 连接 WebSocket 控制通道
      await this.connectControlChannel(vrSession.controlChannel!);

      // 开始渲染循环
      this.startRenderLoop();

      console.log('[VR] Session started');
    } catch (error) {
      console.error('[VR] Failed to start session:', error);
      throw error;
    }
  }

  /**
   * 初始化视频流
   */
  private async initializeVideoStream(streamUrl: string): Promise<void> {
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.muted = false;

    // WebRTC 连接
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.ontrack = (event) => {
      if (this.videoElement) {
        this.videoElement.srcObject = event.streams[0];
      }
    };

    // 获取 Offer
    const response = await fetch(streamUrl);
    const offer = await response.json();

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // 发送 Answer
    await fetch(streamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answer),
    });

    console.log('[VR] Video stream initialized');
  }

  /**
   * 连接控制通道
   */
  private async connectControlChannel(channelUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.webSocket = new WebSocket(channelUrl);

      this.webSocket.onopen = () => {
        console.log('[VR] Control channel connected');
        resolve();
      };

      this.webSocket.onerror = (error) => {
        console.error('[VR] WebSocket error:', error);
        reject(error);
      };

      this.webSocket.onmessage = (event) => {
        // 接收机器人反馈
        const message = JSON.parse(event.data);
        console.log('[VR] Received message:', message);
      };
    });
  }

  /**
   * 开始渲染循环
   */
  private startRenderLoop(): void {
    if (!this.xrSession) return;

    const onXRFrame = (time: number, frame: XRFrame) => {
      if (!this.xrSession || !this.xrRefSpace) return;

      this.xrSession.requestAnimationFrame(onXRFrame);

      // 获取姿态
      const pose = frame.getViewerPose(this.xrRefSpace);
      if (!pose) return;

      // 处理控制器输入
      this.processControllerInput(frame);
    };

    this.xrSession.requestAnimationFrame(onXRFrame);
  }

  /**
   * 处理控制器输入
   */
  private processControllerInput(frame: XRFrame): void {
    if (!this.xrSession || !this.xrRefSpace) return;

    const inputSources = this.xrSession.inputSources;

    for (const source of inputSources) {
      if (!source.gamepad) continue;

      const pose = frame.getPose(source.gripSpace!, this.xrRefSpace);
      if (!pose) continue;

      const controller: VRController = {
        hand: source.handedness === 'left' ? 'left' : 'right',
        position: {
          x: pose.transform.position.x,
          y: pose.transform.position.y,
          z: pose.transform.position.z,
        },
        rotation: {
          x: pose.transform.orientation.x,
          y: pose.transform.orientation.y,
          z: pose.transform.orientation.z,
          w: pose.transform.orientation.w,
        },
        buttons: Array.from(source.gamepad.buttons).map((btn) => btn.pressed),
        axes: Array.from(source.gamepad.axes),
      };

      // 解析控制命令
      const command = this.parseControllerCommand(controller);
      if (command) {
        this.sendCommand(command);
      }
    }
  }

  /**
   * 解析控制器命令
   */
  private parseControllerCommand(controller: VRController): RobotControlCommand | null {
    // 右手控制器 - 移动和旋转
    if (controller.hand === 'right') {
      // 摇杆前后 - 前进/后退
      if (Math.abs(controller.axes[3]) > 0.1) {
        return {
          type: 'move',
          data: {
            direction: 'forward',
            speed: controller.axes[3],
          },
        };
      }

      // 摇杆左右 - 旋转
      if (Math.abs(controller.axes[2]) > 0.1) {
        return {
          type: 'rotate',
          data: {
            direction: controller.axes[2] > 0 ? 'right' : 'left',
            speed: Math.abs(controller.axes[2]),
          },
        };
      }

      // 扳机键 - 动作
      if (controller.buttons[0]) {
        return {
          type: 'action',
          data: { action: 'trigger' },
        };
      }
    }

    // 左手控制器 - 手势和特殊动作
    if (controller.hand === 'left') {
      // A 键 - 跳跃
      if (controller.buttons[4]) {
        return {
          type: 'action',
          data: { action: 'jump' },
        };
      }

      // B 键 - 蹲下
      if (controller.buttons[5]) {
        return {
          type: 'action',
          data: { action: 'crouch' },
        };
      }

      // 手势识别（基于位置和旋转）
      const gesture = this.recognizeGesture(controller);
      if (gesture) {
        return {
          type: 'gesture',
          data: { gesture },
        };
      }
    }

    return null;
  }

  /**
   * 识别手势
   */
  private recognizeGesture(controller: VRController): string | null {
    // 简单的手势识别逻辑
    // 挥手 - Y 轴位置高于 1.5m 且快速移动
    if (controller.position.y > 1.5) {
      return 'wave';
    }

    // 指向 - 手伸直指向前方
    if (controller.position.z < -0.3) {
      return 'point';
    }

    return null;
  }

  /**
   * 发送控制命令
   */
  private sendCommand(command: RobotControlCommand): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.warn('[VR] WebSocket not connected');
      return;
    }

    this.webSocket.send(JSON.stringify(command));

    // 触发回调
    if (this.onCommandCallback) {
      this.onCommandCallback(command);
    }
  }

  /**
   * 设置命令回调
   */
  onCommand(callback: (command: RobotControlCommand) => void): void {
    this.onCommandCallback = callback;
  }

  /**
   * 结束 VR 会话
   */
  async endSession(): Promise<void> {
    // 关闭 WebSocket
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    // 停止视频流
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    // 结束 XR 会话
    if (this.xrSession) {
      await this.xrSession.end();
      this.xrSession = null;
      this.xrRefSpace = null;
    }

    console.log('[VR] Session ended');
  }

  /**
   * 获取当前会话状态
   */
  getSessionStatus(): {
    active: boolean;
    vrSession: VRSession | null;
    connectionStatus: 'connected' | 'connecting' | 'disconnected';
  } {
    return {
      active: this.xrSession !== null,
      vrSession: this.vrSession,
      connectionStatus: this.webSocket
        ? this.webSocket.readyState === WebSocket.OPEN
          ? 'connected'
          : 'connecting'
        : 'disconnected',
    };
  }
}

// 导出单例
export const vrInterface = new VRRobotInterface();
