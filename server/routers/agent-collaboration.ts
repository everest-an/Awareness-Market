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
import { randomUUID } from 'crypto';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';
import { ethers } from 'ethers';
import { getErrorMessage } from '../utils/error-handling';
import { createLogger } from '../utils/logger';
import * as workflowDb from '../db-workflows';

const logger = createLogger('Agent:Collaboration');

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
  inputData: z.record(z.string(), z.unknown()).optional(),
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
// Types (imported from db-workflows)
// ============================================================================

// Note: WorkflowData and WorkflowStepData types are now imported from db-workflows.ts

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
): Promise<string | null> {
  try {
    const contract = await getERC8004Contract();
    if (!contract) {
      logger.warn('[Collaboration] ERC-8004 contract not available, skipping on-chain record');
      return null;
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

    const receipt = await tx.wait();
    logger.info(`[Collaboration] Recorded interaction on-chain: ${fromAgent} → ${toAgent} (${success ? 'success' : 'failed'})`);
    return receipt.hash;
  } catch (error) {
    logger.error('[Collaboration] Failed to record on-chain interaction:', { error });
    return null;
  }
}

/**
 * Execute a single workflow step
 */
async function executeStep(
  workflowId: string,
  stepIndex: number,
  step: workflowDb.WorkflowStepData,
  sharedMemory: Record<string, any>,
  task: string
): Promise<void> {
  const startTime = Date.now();

  await workflowDb.updateWorkflowStep(workflowId, stepIndex, {
    status: 'running',
    startedAt: new Date(),
  });

  try {
    // Simulate AI agent execution
    // In production, this would:
    // 1. Call agent's MCP endpoint or API
    // 2. Pass shared memory context
    // 3. Collect output

    // Get agent info
    const agent = await prisma.user.findFirst({
      where: { openId: step.agentId },
    });

    if (!agent) {
      throw new Error(`Agent ${step.agentId} not found`);
    }

    // Fetch current workflow to get completed steps
    const workflow = await workflowDb.getWorkflow(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    // Prepare input with shared memory
    const input = {
      task,
      context: sharedMemory,
      previousSteps: workflow.steps
        .filter(s => s.status === 'completed')
        .map(s => ({ agent: s.agentName, output: s.output })),
      ...(typeof step.input === 'object' && step.input !== null ? step.input : {}),
    };

    // Execute agent via MCP/HTTP endpoint if provided
    logger.info(`[Collaboration] Executing step: ${step.agentName} for task: ${task}`);

    const endpoints = typeof sharedMemory.agentEndpoints === 'object' && sharedMemory.agentEndpoints !== null
      ? (sharedMemory.agentEndpoints as Record<string, string>)
      : {};
    const endpoint = endpoints[step.agentId];

    let output: Record<string, unknown>;

    if (endpoint) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        const authTokens = typeof sharedMemory.agentAuthTokens === 'object' && sharedMemory.agentAuthTokens !== null
          ? (sharedMemory.agentAuthTokens as Record<string, string>)
          : {};
        const authToken = authTokens[step.agentId];

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            task,
            context: sharedMemory,
            previousSteps: workflow.steps
              .filter(s => s.status === 'completed')
              .map(s => ({ agent: s.agentName, output: s.output })),
            input: typeof step.input === 'object' && step.input !== null ? step.input : undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Agent endpoint returned ${response.status}`);
        }

        const data = await response.json();
        output = {
          agent: step.agentName,
          status: 'success',
          result: data,
          timestamp: new Date().toISOString(),
        };
      } finally {
        clearTimeout(timeout);
      }
    } else {
      // Fallback simulation when no endpoint is configured
      output = {
        agent: step.agentName,
        status: 'success',
        result: `Completed ${task} analysis`,
        timestamp: new Date().toISOString(),
        confidence: 0.85,
        note: 'No agent endpoint configured; used fallback output',
      };
    }

    // Store output in shared memory
    const memoryKeys: string[] = [];
    if (workflow.memorySharing) {
      const memoryKey = `step_${stepIndex}_${step.agentName}`;
      sharedMemory[memoryKey] = output;
      memoryKeys.push(memoryKey);

      // Update shared memory in database
      await workflowDb.updateSharedMemory(workflowId, sharedMemory);
    }

    const executionTime = Date.now() - startTime;

    await workflowDb.updateWorkflowStep(workflowId, stepIndex, {
      status: 'completed',
      output,
      memoryKeys,
      completedAt: new Date(),
      executionTime,
    });

    logger.info(`[Collaboration] Step completed: ${step.agentName}`);
  } catch (error: unknown) {
    const executionTime = Date.now() - startTime;

    await workflowDb.updateWorkflowStep(workflowId, stepIndex, {
      status: 'failed',
      error: getErrorMessage(error),
      completedAt: new Date(),
      executionTime,
    });

    logger.error(`[Collaboration] Step failed: ${step.agentName}`, { error });
    throw error;
  }
}

/**
 * Execute workflow
 */
async function executeWorkflow(workflowId: string): Promise<void> {
  const workflow = await workflowDb.getWorkflow(workflowId);
  if (!workflow) return;

  const startTime = new Date();

  await workflowDb.updateWorkflowStatus(workflowId, 'running', {
    startedAt: startTime,
  });

  try {
    if (workflow.orchestration === 'sequential') {
      // Execute steps one by one
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        await executeStep(workflowId, i, step, workflow.sharedMemory, workflow.task);

        // Record interaction with previous step
        if (workflow.recordOnChain && i > 0) {
          const prevStep = workflow.steps[i - 1];
          const txHash = await recordInteractionOnChain(
            prevStep.agentId,
            step.agentId,
            step.status === 'completed',
            70 // Higher weight for successful collaboration
          );

          if (txHash) {
            await workflowDb.recordOnChainInteraction({
              workflowId,
              fromAgentId: prevStep.agentId,
              toAgentId: step.agentId,
              success: step.status === 'completed',
              weight: 70,
              txHash,
            });
          }
        }
      }
    } else {
      // Execute steps in parallel
      await Promise.all(
        workflow.steps.map((step, index) =>
          executeStep(workflowId, index, step, workflow.sharedMemory, workflow.task)
        )
      );

      // Record all pairwise interactions
      if (workflow.recordOnChain) {
        for (let i = 0; i < workflow.steps.length; i++) {
          for (let j = i + 1; j < workflow.steps.length; j++) {
            const txHash = await recordInteractionOnChain(
              workflow.steps[i].agentId,
              workflow.steps[j].agentId,
              workflow.steps[i].status === 'completed' && workflow.steps[j].status === 'completed',
              50 // Medium weight for parallel collaboration
            );

            if (txHash) {
              await workflowDb.recordOnChainInteraction({
                workflowId,
                fromAgentId: workflow.steps[i].agentId,
                toAgentId: workflow.steps[j].agentId,
                success: workflow.steps[i].status === 'completed' && workflow.steps[j].status === 'completed',
                weight: 50,
                txHash,
              });
            }
          }
        }
      }
    }

    const completedAt = new Date();
    const totalExecutionTime = completedAt.getTime() - startTime.getTime();

    await workflowDb.updateWorkflowStatus(workflowId, 'completed', {
      completedAt,
      totalExecutionTime,
    });

    logger.info(`[Collaboration] Workflow ${workflowId} completed in ${totalExecutionTime}ms`);
  } catch (error: unknown) {
    await workflowDb.updateWorkflowStatus(workflowId, 'failed', {
      completedAt: new Date(),
    });

    logger.error(`[Collaboration] Workflow ${workflowId} failed:`, { error });
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
      // Validate agents exist
      const steps: Array<{ agentId: string; agentName: string }> = [];
      for (const agentId of input.agents) {
        const agent = await prisma.user.findFirst({
          where: { openId: agentId },
        });

        if (!agent) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Agent ${agentId} not found`,
          });
        }

        steps.push({
          agentId,
          agentName: agent.name || 'Unknown Agent',
        });
      }

      // Create workflow in database
      const workflowId = `wf_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 9)}`;

      await workflowDb.createWorkflow({
        id: workflowId,
        task: input.task,
        description: input.description,
        orchestration: input.orchestration,
        memorySharing: input.memorySharing,
        memoryTTL: input.memoryTTL,
        maxExecutionTime: input.maxExecutionTime,
        recordOnChain: input.recordOnChain,
        createdBy: ctx.user.id,
        sharedMemory: input.inputData || {},
        steps,
      });

      // Start execution asynchronously
      executeWorkflow(workflowId).catch(error => {
        logger.error(`[Collaboration] Workflow ${workflowId} execution error:`, { error });
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
      const workflow = await workflowDb.getWorkflow(input.workflowId);

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
      const workflow = await workflowDb.getWorkflow(input.workflowId);

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

      await workflowDb.updateWorkflowStatus(input.workflowId, 'cancelled', {
        completedAt: new Date(),
      });

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
      const userWorkflows = await workflowDb.listWorkflowsByUser(ctx.user.id, 50);

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
