/**
 * Robotics Integration Types
 */

export interface RobotSession {
  robotId: string;
  sessionId: string;
  userId: number;
  capabilities: RobotCapabilities;
  authenticatedAt: Date;
  lastHeartbeat: Date;
  vrSessionId?: string; // VR 控制会话
}

export interface RobotCapabilities {
  canMove: boolean; // 运动控制权限
  canSense: boolean; // 传感器访问权限
  canLearn: boolean; // 学习和记忆权限
  canCollaborate: boolean; // 多机协作权限
}

export interface ROS2Message {
  type: string; // ROS2 topic name
  data: any; // Message payload
  timestamp: number;
  robotId: string;
}

export interface RobotInfo {
  robotId: string;
  name: string;
  type: 'quadruped' | 'humanoid' | 'wheeled' | 'arm' | 'other';
  manufacturer: 'unitree' | 'boston_dynamics' | 'other';
  model: string; // e.g., "Go2", "G1", "Spot"
  capabilities: string[];
  status: 'online' | 'offline' | 'busy' | 'error';
  location?: {
    x: number;
    y: number;
    z: number;
  };
  battery?: number; // 0-100
  lastSeen: Date;
}

export interface MultiRobotTask {
  taskId: string;
  name: string;
  description: string;
  robotIds: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignments: RobotAssignment[];
  createdAt: Date;
  completedAt?: Date;
}

export interface RobotAssignment {
  robotId: string;
  subtask: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
}

export interface VRSession {
  sessionId: string;
  userId: number;
  robotId: string;
  status: 'connecting' | 'connected' | 'disconnected';
  videoStreamUrl?: string;
  controlChannel?: string; // WebSocket URL
  startedAt: Date;
  endedAt?: Date;
  metrics?: {
    latency: number; // ms
    fps: number;
    bandwidth: number; // Mbps
  };
}

export interface RobotMemory {
  memoryId: string;
  robotId: string;
  content: string;
  memoryType: 'observation' | 'conversation' | 'task' | 'event';
  metadata: {
    location?: { x: number; y: number; z: number };
    timestamp: Date;
    confidence?: number;
    entities?: string[];
  };
  createdAt: Date;
}

export interface RobotCollaborationRequest {
  requestId: string;
  initiatorRobotId: string;
  participantRobotIds: string[];
  task: string;
  context: any;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  responses: Map<string, any>;
}
