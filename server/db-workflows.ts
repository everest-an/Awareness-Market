/**
 * Database Operations for Agent Collaboration Workflows (Prisma)
 *
 * Replaces in-memory Map storage with persistent Prisma database
 */

import { PrismaClient, WorkflowStatus, StepStatus, Orchestration, MemorySharing, Prisma } from '@prisma/client';
import { createLogger } from './utils/logger';

const logger = createLogger('DB:Workflows');

// Singleton Prisma Client
let prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export interface WorkflowStepData {
  agentId: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  input?: unknown;
  output?: unknown;
  error?: string;
  memoryKeys?: string[];
  executionTime?: number;
}

export interface WorkflowData {
  id: string;
  task: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  orchestration: 'sequential' | 'parallel';
  memorySharing: boolean;
  steps: WorkflowStepData[];
  sharedMemory: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  totalExecutionTime?: number;
  createdBy: number;
  workspaceId?: string;
  recordOnChain: boolean;
}

/**
 * Create a new workflow
 */
export async function createWorkflow(data: {
  id: string;
  task: string;
  description?: string;
  orchestration: 'sequential' | 'parallel';
  memorySharing: boolean;
  memoryTTL?: number;
  maxExecutionTime?: number;
  recordOnChain: boolean;
  createdBy: number;
  workspaceId?: string;
  sharedMemory?: Record<string, any>;
  steps: Array<{ agentId: string; agentName: string }>;
}): Promise<void> {
  const db = getPrisma();

  await db.$transaction(async (tx) => {
    // Insert workflow
    await tx.workflow.create({
      data: {
        id: data.id,
        task: data.task,
        description: data.description,
        status: WorkflowStatus.pending,
        orchestration: data.orchestration as Orchestration,
        memorySharing: data.memorySharing ? MemorySharing.enabled : MemorySharing.disabled,
        memoryTTL: data.memoryTTL || 86400,
        maxExecutionTime: data.maxExecutionTime || 600,
        recordOnChain: data.recordOnChain,
        createdBy: data.createdBy,
        workspaceId: data.workspaceId,
        sharedMemory: data.sharedMemory || {},
      },
    });

    // Insert workflow steps
    if (data.steps.length > 0) {
      await tx.workflowStep.createMany({
        data: data.steps.map((step, index) => ({
          workflowId: data.id,
          stepIndex: index,
          agentId: step.agentId,
          agentName: step.agentName,
          status: StepStatus.pending,
        })),
      });
    }
  });

  logger.info(`[createWorkflow] Created workflow ${data.id} with ${data.steps.length} steps`);
}

/**
 * Get workflow by ID
 */
export async function getWorkflow(workflowId: string): Promise<WorkflowData | null> {
  const db = getPrisma();

  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    include: {
      steps: {
        orderBy: { stepIndex: 'asc' },
      },
    },
  });

  if (!workflow) return null;

  return mapWorkflow(workflow);
}

function mapWorkflow(workflow: any): WorkflowData {
  return {
    id: workflow.id,
    task: workflow.task,
    description: workflow.description || undefined,
    status: workflow.status,
    orchestration: workflow.orchestration,
    memorySharing: workflow.memorySharing === MemorySharing.enabled || workflow.memorySharing === 'enabled',
    steps: (workflow.steps || []).map((step: any) => ({
      agentId: step.agentId,
      agentName: step.agentName || '',
      status: step.status,
      startedAt: step.startedAt || undefined,
      completedAt: step.completedAt || undefined,
      input: step.input,
      output: step.output,
      error: step.error || undefined,
      memoryKeys: step.memoryKeys as string[] | undefined,
      executionTime: step.executionTime || undefined,
    })),
    sharedMemory: (workflow.sharedMemory as Record<string, any>) || {},
    startedAt: workflow.startedAt || new Date(),
    completedAt: workflow.completedAt || undefined,
    totalExecutionTime: workflow.totalExecutionTime || undefined,
    createdBy: workflow.createdBy,
    workspaceId: workflow.workspaceId || undefined,
    recordOnChain: workflow.recordOnChain,
  };
}

/**
 * Update workflow status
 */
export async function updateWorkflowStatus(
  workflowId: string,
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
  updates?: {
    startedAt?: Date;
    completedAt?: Date;
    totalExecutionTime?: number;
  }
): Promise<void> {
  const db = getPrisma();

  await db.workflow.update({
    where: { id: workflowId },
    data: {
      status: status as WorkflowStatus,
      startedAt: updates?.startedAt,
      completedAt: updates?.completedAt,
      totalExecutionTime: updates?.totalExecutionTime,
    },
  });

  logger.info(`[updateWorkflowStatus] Updated workflow ${workflowId} status to ${status}`);
}

/**
 * Update workflow step
 */
export async function updateWorkflowStep(
  workflowId: string,
  stepIndex: number,
  updates: {
    status?: 'pending' | 'running' | 'completed' | 'failed';
    startedAt?: Date;
    completedAt?: Date;
    input?: unknown;
    output?: unknown;
    error?: string;
    memoryKeys?: string[];
    executionTime?: number;
  }
): Promise<void> {
  const db = getPrisma();

  await db.workflowStep.updateMany({
    where: {
      workflowId,
      stepIndex,
    },
    data: {
      status: updates.status as StepStatus | undefined,
      startedAt: updates.startedAt,
      completedAt: updates.completedAt,
      input: updates.input as Prisma.InputJsonValue | undefined,
      output: updates.output as Prisma.InputJsonValue | undefined,
      error: updates.error,
      memoryKeys: updates.memoryKeys,
      executionTime: updates.executionTime,
    },
  });

  logger.info(`[updateWorkflowStep] Updated step ${stepIndex} in workflow ${workflowId}`);
}

/**
 * Update shared memory
 */
export async function updateSharedMemory(
  workflowId: string,
  sharedMemory: Record<string, any>
): Promise<void> {
  const db = getPrisma();

  await db.workflow.update({
    where: { id: workflowId },
    data: { sharedMemory },
  });
}

/**
 * Record on-chain interaction
 */
export async function recordOnChainInteraction(data: {
  workflowId?: string;
  fromAgentId: string;
  toAgentId: string;
  success: boolean;
  weight: number;
  interactionType?: string;
  txHash?: string;
  blockNumber?: number;
}): Promise<void> {
  const db = getPrisma();

  await db.onChainInteraction.create({
    data: {
      workflowId: data.workflowId,
      fromAgentId: data.fromAgentId,
      toAgentId: data.toAgentId,
      success: data.success,
      weight: data.weight,
      interactionType: data.interactionType || 'collaboration',
      txHash: data.txHash,
      blockNumber: data.blockNumber,
    },
  });

  logger.info(
    `[recordOnChainInteraction] Recorded interaction: ${data.fromAgentId} → ${data.toAgentId} (${data.success})`
  );
}

/**
 * List workflows by user
 */
export async function listWorkflowsByUser(
  userId: number,
  limit: number = 50
): Promise<WorkflowData[]> {
  const db = getPrisma();

  const workflows = await db.workflow.findMany({
    where: { createdBy: userId },
    include: {
      steps: {
        orderBy: { stepIndex: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return workflows.map(mapWorkflow);
}

/**
 * List workflows by workspace
 */
export async function listWorkflowsByWorkspace(
  workspaceId: string,
  limit: number = 50
): Promise<WorkflowData[]> {
  const db = getPrisma();

  const workflows = await db.workflow.findMany({
    where: { workspaceId },
    include: {
      steps: {
        orderBy: { stepIndex: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return workflows.map(mapWorkflow);
}
