/**
 * Agent Collaboration Workflow Orchestration
 *
 * Enables automated multi-agent collaboration workflows with:
 * - Sequential and parallel task execution
 * - Shared memory coordination
 * - Automatic interaction tracking
 * - ERC-8004 on-chain reputation updates
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { ethers } from 'ethers';
import { getErrorMessage } from '../utils/error-handling';

// ============================================================================
// Input Schemas
// ============================================================================

const collaborateSchema = z.object({
  task: z.string().min(1).max(500),
  description: z.string().optional(),
  agents: z.array(z.string()).min(2).max(10), // agentId or walletAddress
  orchestration: z.enum(['sequential', 'parallel']).default('sequential'),
  memorySharing: z.boolean().default(true),
  memoryTTL: z.number().min(60).max(604800).default(86400), // 1 min to 7 days
  maxExecutionTime: z.number().min(60).max(3600).default(600), // 1 min to 1 hour
  inputData: z.record(z.any()).optional(),
  recordOnChain: z.boolean().default(true), // Record interactions to ERC-8004
});

const getWorkflowStatusSchema = z.object({
  workflowId: z.string(),
});

const stopWorkflowSchema = z.object({
  workflowId: z.string(),
  reason: z.string().optional(),
});

// ============================================================================
// Types
// ============================================================================

interface WorkflowStep {
  agentId: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  input?: unknown;
  output?: unknown;
  error?: string;
  memoryKeys?: string[];
}

interface Workflow {
  id: string;
  task: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  orchestration: 'sequential' | 'parallel';
  memorySharing: boolean;
  steps: WorkflowStep[];
  sharedMemory: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  totalExecutionTime?: number;
  createdBy: number; // userId
  recordOnChain: boolean;
}

// In-memory workflow storage (in production, use Redis or database)
const workflows = new Map<string, Workflow>();

// ERC-8004 Contract interaction
const ERC8004_ABI = [
  'function recordInteraction(bytes32 fromAgentId, bytes32 toAgentId, bool success, uint256 weight, string interactionType) external',
];

async function getERC8004Contract() {
  const registryAddress = process.env.ERC8004_REGISTRY_ADDRESS;
  if (!registryAddress) return null;

  const rpcUrl = process.env.POLYGON_RPC_URL || process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // For writing, we need a signer (would use backend wallet in production)
  const privateKey = process.env.ERC8004_RECORDER_PRIVATE_KEY;
  if (!privateKey) return null;

  const wallet = new ethers.Wallet(privateKey, provider);
  return new ethers.Contract(registryAddress, ERC8004_ABI, wallet);
}

/**
 * Record interaction on ERC-8004 registry
 */
async function recordInteractionOnChain(
  fromAgent: string,
  toAgent: string,
  success: boolean,
  weight: number = 50
): Promise<boolean> {
  try {
    const contract = await getERC8004Contract();
    if (!contract) {
      console.warn('[Collaboration] ERC-8004 contract not available, skipping on-chain record');
      return false;
    }

    const fromAgentId = fromAgent.startsWith('0x') ? fromAgent : ethers.id(fromAgent);
    const toAgentId = toAgent.startsWith('0x') ? toAgent : ethers.id(toAgent);

    const tx = await contract.recordInteraction(
      fromAgentId,
      toAgentId,
      success,
      weight,
      'collaboration'
    );

    await tx.wait();
    console.log(`[Collaboration] Recorded interaction on-chain: ${fromAgent} → ${toAgent} (${success ? 'success' : 'failed'})`);
    return true;
  } catch (error) {
    console.error('[Collaboration] Failed to record on-chain interaction:', error);
    return false;
  }
}

/**
 * Execute a single workflow step
 */
async function executeStep(
  workflow: Workflow,
  step: WorkflowStep,
  sharedMemory: Record<string, any>
): Promise<void> {
  step.status = 'running';
  step.startedAt = new Date();

  try {
    // Simulate AI agent execution
    // In production, this would:
    // 1. Call agent's MCP endpoint or API
    // 2. Pass shared memory context
    // 3. Collect output

    const db = await getDb();
    if (!db) throw new Error('Database unavailable');

    // Get agent info
    const agentRecords = await db
      .select()
      .from(users)
      .where(eq(users.openId, step.agentId))
      .limit(1);

    if (agentRecords.length === 0) {
      throw new Error(`Agent ${step.agentId} not found`);
    }

    // Prepare input with shared memory
    const input = {
      task: workflow.task,
      context: sharedMemory,
      previousSteps: workflow.steps
        .filter(s => s.status === 'completed')
        .map(s => ({ agent: s.agentName, output: s.output })),
      ...step.input,
    };

    // Simulated execution (replace with actual API call)
    console.log(`[Collaboration] Executing step: ${step.agentName} for task: ${workflow.task}`);

    // Mock output
    const output = {
      agent: step.agentName,
      status: 'success',
      result: `Completed ${workflow.task} analysis`,
      timestamp: new Date().toISOString(),
      confidence: 0.85 + Math.random() * 0.15,
    };

    // Store output in shared memory
    if (workflow.memorySharing) {
      const memoryKey = `step_${workflow.steps.indexOf(step)}_${step.agentName}`;
      sharedMemory[memoryKey] = output;
      step.memoryKeys = [memoryKey];
    }

    step.output = output;
    step.status = 'completed';
    step.completedAt = new Date();

    console.log(`[Collaboration] Step completed: ${step.agentName}`);
  } catch (error: unknown) {
    step.status = 'failed';
    step.error = getErrorMessage(error);
    step.completedAt = new Date();
    console.error(`[Collaboration] Step failed: ${step.agentName}`, error);
    throw error;
  }
}

/**
 * Execute workflow
 */
async function executeWorkflow(workflowId: string): Promise<void> {
  const workflow = workflows.get(workflowId);
  if (!workflow) return;

  workflow.status = 'running';
  workflow.startedAt = new Date();

  try {
    if (workflow.orchestration === 'sequential') {
      // Execute steps one by one
      for (const step of workflow.steps) {
        await executeStep(workflow, step, workflow.sharedMemory);

        // Record interaction with previous step
        if (workflow.recordOnChain && workflow.steps.indexOf(step) > 0) {
          const prevStep = workflow.steps[workflow.steps.indexOf(step) - 1];
          await recordInteractionOnChain(
            prevStep.agentId,
            step.agentId,
            step.status === 'completed',
            70 // Higher weight for successful collaboration
          );
        }
      }
    } else {
      // Execute steps in parallel
      await Promise.all(
        workflow.steps.map(step => executeStep(workflow, step, workflow.sharedMemory))
      );

      // Record all pairwise interactions
      if (workflow.recordOnChain) {
        for (let i = 0; i < workflow.steps.length; i++) {
          for (let j = i + 1; j < workflow.steps.length; j++) {
            await recordInteractionOnChain(
              workflow.steps[i].agentId,
              workflow.steps[j].agentId,
              workflow.steps[i].status === 'completed' && workflow.steps[j].status === 'completed',
              50 // Medium weight for parallel collaboration
            );
          }
        }
      }
    }

    workflow.status = 'completed';
    workflow.completedAt = new Date();
    workflow.totalExecutionTime = workflow.completedAt.getTime() - workflow.startedAt.getTime();

    console.log(`[Collaboration] Workflow ${workflowId} completed in ${workflow.totalExecutionTime}ms`);
  } catch (error: unknown) {
    workflow.status = 'failed';
    workflow.completedAt = new Date();
    console.error(`[Collaboration] Workflow ${workflowId} failed:`, error);
  }
}

// ============================================================================
// Agent Collaboration Router
// ============================================================================

export const agentCollaborationRouter = router({
  /**
   * Create and start a collaboration workflow
   */
  collaborate: protectedProcedure
    .input(collaborateSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      }

      // Validate agents exist
      const steps: WorkflowStep[] = [];
      for (const agentId of input.agents) {
        const agentRecords = await db
          .select()
          .from(users)
          .where(eq(users.openId, agentId))
          .limit(1);

        if (agentRecords.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Agent ${agentId} not found`,
          });
        }

        steps.push({
          agentId,
          agentName: agentRecords[0].name || 'Unknown Agent',
          status: 'pending',
        });
      }

      // Create workflow
      const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const workflow: Workflow = {
        id: workflowId,
        task: input.task,
        description: input.description,
        status: 'pending',
        orchestration: input.orchestration,
        memorySharing: input.memorySharing,
        steps,
        sharedMemory: input.inputData || {},
        startedAt: new Date(),
        createdBy: ctx.user.id,
        recordOnChain: input.recordOnChain,
      };

      workflows.set(workflowId, workflow);

      // Start execution asynchronously
      executeWorkflow(workflowId).catch(error => {
        console.error(`[Collaboration] Workflow ${workflowId} execution error:`, error);
      });

      return {
        success: true,
        workflowId,
        message: `Workflow started with ${input.agents.length} agents (${input.orchestration} mode)`,
        estimatedTime: input.orchestration === 'sequential'
          ? input.agents.length * 30 // 30s per step
          : 30, // 30s for parallel
      };
    }),

  /**
   * Get workflow status
   */
  getWorkflowStatus: publicProcedure
    .input(getWorkflowStatusSchema)
    .query(async ({ input }) => {
      const workflow = workflows.get(input.workflowId);

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow not found',
        });
      }

      return {
        id: workflow.id,
        task: workflow.task,
        status: workflow.status,
        orchestration: workflow.orchestration,
        progress: {
          total: workflow.steps.length,
          completed: workflow.steps.filter(s => s.status === 'completed').length,
          failed: workflow.steps.filter(s => s.status === 'failed').length,
          running: workflow.steps.filter(s => s.status === 'running').length,
        },
        steps: workflow.steps.map(step => ({
          agent: step.agentName,
          status: step.status,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          error: step.error,
        })),
        sharedMemory: workflow.memorySharing ? Object.keys(workflow.sharedMemory) : [],
        executionTime: workflow.completedAt
          ? workflow.totalExecutionTime
          : Date.now() - workflow.startedAt.getTime(),
      };
    }),

  /**
   * Stop a running workflow
   */
  stopWorkflow: protectedProcedure
    .input(stopWorkflowSchema)
    .mutation(async ({ input, ctx }) => {
      const workflow = workflows.get(input.workflowId);

      if (!workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow not found',
        });
      }

      if (workflow.createdBy !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only stop workflows you created',
        });
      }

      if (workflow.status !== 'running') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot stop workflow in ${workflow.status} status`,
        });
      }

      workflow.status = 'cancelled';
      workflow.completedAt = new Date();

      return {
        success: true,
        message: 'Workflow stopped',
      };
    }),

  /**
   * List user's workflows
   */
  listWorkflows: protectedProcedure
    .query(async ({ ctx }) => {
      const userWorkflows = Array.from(workflows.values())
        .filter(w => w.createdBy === ctx.user.id)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, 50);

      return {
        workflows: userWorkflows.map(w => ({
          id: w.id,
          task: w.task,
          status: w.status,
          agentCount: w.steps.length,
          orchestration: w.orchestration,
          startedAt: w.startedAt,
          completedAt: w.completedAt,
          executionTime: w.totalExecutionTime,
        })),
        total: userWorkflows.length,
      };
    }),
});
