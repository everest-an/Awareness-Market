/**
 * Database Operations for Agent Collaboration Workflows
 *
 * Replaces in-memory Map storage with persistent database
 */

import { getDb } from './db';
import { workflows, workflowSteps, onChainInteractions } from '../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createLogger } from './utils/logger';

const logger = createLogger('DB:Workflows');

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
  sharedMemory?: Record<string, any>;
  steps: Array<{ agentId: string; agentName: string }>;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.transaction(async (tx) => {
    // Insert workflow
    await tx.insert(workflows).values({
      id: data.id,
      task: data.task,
      description: data.description,
      status: 'pending',
      orchestration: data.orchestration,
      memorySharing: data.memorySharing ? 'enabled' : 'disabled',
      memoryTTL: data.memoryTTL || 86400,
      maxExecutionTime: data.maxExecutionTime || 600,
      recordOnChain: data.recordOnChain ? 'yes' : 'no',
      createdBy: data.createdBy,
      sharedMemory: data.sharedMemory || {},
    });

    // Insert workflow steps
    const stepValues = data.steps.map((step, index) => ({
      workflowId: data.id,
      stepIndex: index,
      agentId: step.agentId,
      agentName: step.agentName,
      status: 'pending' as const,
    }));

    if (stepValues.length > 0) {
      await tx.insert(workflowSteps).values(stepValues);
    }
  });

  logger.info(`[createWorkflow] Created workflow ${data.id} with ${data.steps.length} steps`);
}

/**
 * Get workflow by ID
 */
export async function getWorkflow(workflowId: string): Promise<WorkflowData | null> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1);

  if (!workflow) return null;

  const steps = await db
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.workflowId, workflowId))
    .orderBy(workflowSteps.stepIndex);

  return {
    id: workflow.id,
    task: workflow.task,
    description: workflow.description || undefined,
    status: workflow.status,
    orchestration: workflow.orchestration,
    memorySharing: workflow.memorySharing === 'enabled',
    steps: steps.map(step => ({
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
    recordOnChain: workflow.recordOnChain === 'yes',
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
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db
    .update(workflows)
    .set({
      status,
      startedAt: updates?.startedAt,
      completedAt: updates?.completedAt,
      totalExecutionTime: updates?.totalExecutionTime,
    })
    .where(eq(workflows.id, workflowId));

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
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db
    .update(workflowSteps)
    .set(updates)
    .where(
      and(
        eq(workflowSteps.workflowId, workflowId),
        eq(workflowSteps.stepIndex, stepIndex)
      )
    );

  logger.info(`[updateWorkflowStep] Updated step ${stepIndex} in workflow ${workflowId}`);
}

/**
 * Update shared memory
 */
export async function updateSharedMemory(
  workflowId: string,
  sharedMemory: Record<string, any>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db
    .update(workflows)
    .set({ sharedMemory })
    .where(eq(workflows.id, workflowId));
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
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.insert(onChainInteractions).values({
    workflowId: data.workflowId,
    fromAgentId: data.fromAgentId,
    toAgentId: data.toAgentId,
    success: data.success ? 'yes' : 'no',
    weight: data.weight,
    interactionType: data.interactionType || 'collaboration',
    txHash: data.txHash,
    blockNumber: data.blockNumber,
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
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const workflowRecords = await db
    .select()
    .from(workflows)
    .where(eq(workflows.createdBy, userId))
    .orderBy(desc(workflows.createdAt))
    .limit(limit);

  const results: WorkflowData[] = [];

  for (const workflow of workflowRecords) {
    const steps = await db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowId, workflow.id))
      .orderBy(workflowSteps.stepIndex);

    results.push({
      id: workflow.id,
      task: workflow.task,
      description: workflow.description || undefined,
      status: workflow.status,
      orchestration: workflow.orchestration,
      memorySharing: workflow.memorySharing === 'enabled',
      steps: steps.map(step => ({
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
      recordOnChain: workflow.recordOnChain === 'yes',
    });
  }

  return results;
}
