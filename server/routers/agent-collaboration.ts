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
import * as db from '../db';
import { fireWorkflowWebhook } from '../collaboration/webhook-dispatcher';

const logger = createLogger('Agent:Collaboration');

// ============================================================================
// Input Schemas
// ============================================================================

/**
 * Per-agent decision authority config.
 *
 * weight : 0.0–1.0 multiplier applied when combining outputs (default: 1.0).
 *          e.g.  { weight: 0.5 }  →  advisory role, half the vote
 *          e.g.  { weight: 1.0 }  →  equal authority (default)
 *
 * roles  : semantic labels for this agent's responsibility.
 *          e.g. ["planner", "spec"] or ["backend"] or ["deployment"]
 *          Passed to the agent in the request body so it can self-limit its scope.
 *
 * scope  : memory namespace prefixes this agent is allowed to write to.
 *          e.g. ["org-123/planning/", "org-123/spec/"]
 *          Empty/omitted = no restriction (agent may write anywhere).
 */
const agentAuthoritySchema = z.object({
  weight: z.number().min(0).max(1).default(1.0),
  roles: z.array(z.string()).optional(),
  scope: z.array(z.string()).optional(),
});

const collaborateSchema = z.object({
  task: z.string().min(1).max(500),
  description: z.string().optional(),
  workspaceId: z.string().optional(),
  agents: z.array(z.string()).min(2).max(10), // agentId or walletAddress
  orchestration: z.enum(['sequential', 'parallel']).default('sequential'),
  memorySharing: z.boolean().default(true),
  memoryTTL: z.number().min(60).max(604800).default(86400), // 1 min to 7 days
  maxExecutionTime: z.number().min(60).max(3600).default(600), // 1 min to 1 hour
  inputData: z.record(z.string(), z.unknown()).optional(),
  recordOnChain: z.boolean().default(true), // Record interactions to ERC-8004
  /**
   * Optional per-agent decision authority.
   * Key = agentId (openId).  Value = authority config.
   *
   * Example:
   * {
   *   "ai_kiro_xxx":   { weight: 1.0, roles: ["planner", "spec"] },
   *   "ai_claude_yyy": { weight: 1.0, roles: ["backend"] },
   *   "ai_v0_zzz":     { weight: 0.8, roles: ["deployment"] }
   * }
   */
  agentAuthority: z.record(z.string(), agentAuthoritySchema).optional(),
  /** Optional webhook URL to receive lifecycle events (propose, execute, complete, fail) */
  webhookUrl: z.string().url().max(2048).optional(),
  /** Shared secret for HMAC-SHA256 webhook signatures. Auto-generated if omitted. */
  webhookSecret: z.string().max(255).optional(),
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

  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.AVALANCHE_RPC_URL || process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
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

  // Fire step-started webhook
  try {
    const wfForHook = await workflowDb.getWorkflow(workflowId);
    if (wfForHook?.webhookUrl) {
      fireWorkflowWebhook(workflowId, wfForHook.webhookUrl, wfForHook.webhookSecret, 'workflow.step.started', {
        stepIndex,
        agentId: step.agentId,
        agentName: step.agentName,
      });
    }
  } catch { /* non-critical */ }

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

        // Extract this agent's authority config (if configured)
        const authorityMap = typeof sharedMemory.agentAuthority === 'object' && sharedMemory.agentAuthority !== null
          ? (sharedMemory.agentAuthority as Record<string, { weight?: number; roles?: string[]; scope?: string[] }>)
          : {};
        const myAuthority = authorityMap[step.agentId] ?? { weight: 1.0 };

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
            // Tell the agent what its authority is, so it can self-limit scope
            authority: {
              myAgent: {
                id: step.agentId,
                name: step.agentName,
                ...myAuthority,
              },
              allAgents: authorityMap,
            },
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
      // No endpoint configured — run in simulation mode so caller can detect it
      logger.warn(`[Collaboration] No endpoint for agent ${step.agentName} (id: ${step.agentId}) — step running in simulation mode`);
      output = {
        agent: step.agentName,
        status: 'simulated',
        result: `Simulated output for: ${task}`,
        timestamp: new Date().toISOString(),
        simulated: true,
        note: `Agent "${step.agentName}" has no endpoint configured. Register an endpoint via sharedMemory.agentEndpoints["${step.agentId}"] to run real execution.`,
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

    // Fire step-completed webhook
    try {
      const wfAfter = await workflowDb.getWorkflow(workflowId);
      if (wfAfter?.webhookUrl) {
        fireWorkflowWebhook(workflowId, wfAfter.webhookUrl, wfAfter.webhookSecret, 'workflow.step.completed', {
          stepIndex,
          agentId: step.agentId,
          agentName: step.agentName,
          executionTime,
        });
      }
    } catch { /* non-critical */ }
  } catch (error: unknown) {
    const executionTime = Date.now() - startTime;

    await workflowDb.updateWorkflowStep(workflowId, stepIndex, {
      status: 'failed',
      error: getErrorMessage(error),
      completedAt: new Date(),
      executionTime,
    });

    // Fire step-failed webhook
    try {
      const wfErr = await workflowDb.getWorkflow(workflowId);
      if (wfErr?.webhookUrl) {
        fireWorkflowWebhook(workflowId, wfErr.webhookUrl, wfErr.webhookSecret, 'workflow.step.failed', {
          stepIndex,
          agentId: step.agentId,
          agentName: step.agentName,
          error: getErrorMessage(error),
        });
      }
    } catch { /* non-critical */ }

    logger.error(`[Collaboration] Step failed: ${step.agentName}`, { error });
    throw error;
  }
}

/**
 * Execute workflow.
 * Exported for use by the webhook-inbound-worker (async decoupled trigger).
 */
export async function executeWorkflow(workflowId: string): Promise<void> {
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
          // Use authority weight (0–1) scaled to 0–100 for ERC-8004; default 70
          const authorityMap = typeof workflow.sharedMemory.agentAuthority === 'object' && workflow.sharedMemory.agentAuthority !== null
            ? (workflow.sharedMemory.agentAuthority as Record<string, { weight?: number }>)
            : {};
          const stepWeight = Math.round((authorityMap[step.agentId]?.weight ?? 0.7) * 100);
          const txHash = await recordInteractionOnChain(
            prevStep.agentId,
            step.agentId,
            step.status === 'completed',
            stepWeight
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

      // ✅ Authority-weighted consensus for parallel workflows
      // Re-fetch after all steps complete to get final outputs
      const finalWorkflow = await workflowDb.getWorkflow(workflowId);
      if (finalWorkflow) {
        const authorityMap = typeof finalWorkflow.sharedMemory.agentAuthority === 'object' && finalWorkflow.sharedMemory.agentAuthority !== null
          ? (finalWorkflow.sharedMemory.agentAuthority as Record<string, { weight?: number; roles?: string[]; scope?: string[] }>)
          : {};

        // Collect completed steps with their weights
        const weightedResults = finalWorkflow.steps
          .filter(s => s.status === 'completed' && s.output)
          .map(s => ({
            agentId: s.agentId,
            agentName: s.agentName,
            weight: authorityMap[s.agentId]?.weight ?? 1.0,
            roles: authorityMap[s.agentId]?.roles ?? [],
            output: s.output,
          }))
          .sort((a, b) => b.weight - a.weight); // highest authority first

        if (weightedResults.length > 0) {
          // Primary = highest authority agent's output
          const primary = weightedResults[0];
          const consensus = {
            primary: {
              agentId: primary.agentId,
              agentName: primary.agentName,
              weight: primary.weight,
              roles: primary.roles,
              output: primary.output,
            },
            all: weightedResults,
            totalWeight: weightedResults.reduce((sum, r) => sum + r.weight, 0),
            generatedAt: new Date().toISOString(),
          };

          await workflowDb.updateSharedMemory(workflowId, {
            ...finalWorkflow.sharedMemory,
            _consensus: consensus,
          });

          logger.info(`[Collaboration] Parallel consensus: primary agent "${primary.agentName}" (weight=${primary.weight})`);
        }
      }

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

    // Fire workflow-completed webhook
    try {
      const completedWf = await workflowDb.getWorkflow(workflowId);
      if (completedWf?.webhookUrl) {
        fireWorkflowWebhook(workflowId, completedWf.webhookUrl, completedWf.webhookSecret, 'workflow.completed', {
          totalExecutionTime,
          stepsCompleted: workflow.steps.length,
        });
      }
    } catch { /* non-critical */ }
  } catch (error: unknown) {
    await workflowDb.updateWorkflowStatus(workflowId, 'failed', {
      completedAt: new Date(),
    });

    logger.error(`[Collaboration] Workflow ${workflowId} failed:`, { error });

    // Fire workflow-failed webhook
    try {
      const failedWf = await workflowDb.getWorkflow(workflowId);
      if (failedWf?.webhookUrl) {
        fireWorkflowWebhook(workflowId, failedWf.webhookUrl, failedWf.webhookSecret, 'workflow.failed', {
          error: getErrorMessage(error),
        });
      }
    } catch { /* non-critical */ }
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

      // Merge agentAuthority into sharedMemory so it's available during execution
      const sharedMemoryInit: Record<string, unknown> = { ...(input.inputData || {}) };
      if (input.agentAuthority && Object.keys(input.agentAuthority).length > 0) {
        sharedMemoryInit.agentAuthority = input.agentAuthority;
      }

      await workflowDb.createWorkflow({
        id: workflowId,
        task: input.task,
        description: input.description,
        workspaceId: input.workspaceId,
        orchestration: input.orchestration,
        memorySharing: input.memorySharing,
        memoryTTL: input.memoryTTL,
        maxExecutionTime: input.maxExecutionTime,
        recordOnChain: input.recordOnChain,
        createdBy: ctx.user.id,
        sharedMemory: sharedMemoryInit,
        steps,
      });

      // ── Auto-generate MCP token for this session ──────────────────────
      let mcpToken: string | undefined;
      let mcpTokenPrefix: string | undefined;
      try {
        const tokenResult = await db.createMcpToken({
          userId: ctx.user.id,
          name: `Collab: ${input.task.slice(0, 60)} (${workflowId})`,
          permissions: ['read', 'write', 'propose'],
          expiresInDays: 7,
        });
        mcpToken = tokenResult.token;
        mcpTokenPrefix = tokenResult.tokenPrefix;

        // Store prefix in sharedMemory so getSessionEndpoints can retrieve it
        sharedMemoryInit._mcpTokenPrefix = mcpTokenPrefix;
        await workflowDb.updateSharedMemory(workflowId, sharedMemoryInit);
      } catch (err) {
        logger.warn('[Collaboration] Failed to auto-create MCP token:', { error: err });
      }

      // ── Webhook config ────────────────────────────────────────────────
      const webhookSecret = input.webhookSecret || (input.webhookUrl ? randomUUID() : undefined);
      if (input.webhookUrl) {
        await workflowDb.updateWorkflowWebhook(workflowId, {
          webhookUrl: input.webhookUrl,
          webhookSecret: webhookSecret!,
          webhookEvents: JSON.stringify(['propose', 'execute', 'complete', 'fail']),
        });

        fireWorkflowWebhook(workflowId, input.webhookUrl, webhookSecret!, 'workflow.created', {
          task: input.task,
          agents: input.agents,
          orchestration: input.orchestration,
        });
      }

      // Start execution asynchronously
      executeWorkflow(workflowId).catch(error => {
        logger.error(`[Collaboration] Workflow ${workflowId} execution error:`, { error });
      });

      const baseUrl = process.env.BASE_URL || 'https://api.awareness.market';

      return {
        success: true,
        workflowId,
        message: `Workflow started with ${input.agents.length} agents (${input.orchestration} mode)`,
        estimatedTime: input.orchestration === 'sequential'
          ? input.agents.length * 30 // 30s per step
          : 30, // 30s for parallel
        // Both API and MCP endpoints auto-generated
        endpoints: {
          api: {
            baseUrl: `${baseUrl}/api/collab`,
            workflowId,
            headers: {
              'X-Workspace-Key': `workspace:${workflowId}`,
            },
          },
          mcp: {
            endpoint: `${baseUrl}/mcp`,
            token: mcpToken ?? null,           // one-time display
            tokenPrefix: mcpTokenPrefix ?? null,
          },
        },
        webhookSecret: input.webhookUrl ? webhookSecret : undefined,
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
          agentId: step.agentId,
          status: step.status,
          output: step.output ?? null,
          simulated: (step.output as any)?.simulated === true,
          authority: (workflow.sharedMemory.agentAuthority as any)?.[step.agentId] ?? null,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          error: step.error,
        })),
        hasSimulatedSteps: workflow.steps.some(s => (s.output as any)?.simulated === true),
        consensus: (workflow.sharedMemory as any)._consensus ?? null,
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
   * Get API + MCP endpoints for a session (token prefix only)
   */
  getSessionEndpoints: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ input, ctx }) => {
      const workflow = await workflowDb.getWorkflow(input.workflowId);
      if (!workflow) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow not found' });
      }
      if (workflow.createdBy !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not your workflow' });
      }
      const baseUrl = process.env.BASE_URL || 'https://api.awareness.market';
      return {
        api: {
          baseUrl: `${baseUrl}/api/collab`,
          workflowId: workflow.id,
        },
        mcp: {
          endpoint: `${baseUrl}/mcp`,
          tokenPrefix: (workflow.sharedMemory as any)?._mcpTokenPrefix ?? null,
        },
        webhookUrl: workflow.webhookUrl ?? null,
      };
    }),

  // NOTE: triggerWebhook procedure removed — replaced by POST /api/webhooks/inbound
  // External systems now use the Webhook Adapter Layer (async, queued, rate-limited)
  // See: server/routes/webhook-inbound.ts + server/workers/webhook-inbound-worker.ts

  /**
   * List user's workflows (optionally filtered by workspace)
   */
  listWorkflows: protectedProcedure
    .input(z.object({ workspaceId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const userWorkflows = input?.workspaceId
        ? await workflowDb.listWorkflowsByWorkspace(input.workspaceId, 50)
        : await workflowDb.listWorkflowsByUser(ctx.user.id, 50);

      return {
        workflows: userWorkflows.map(w => ({
          id: w.id,
          task: w.task,
          status: w.status,
          agentCount: w.steps.length,
          orchestration: w.orchestration,
          workspaceId: w.workspaceId,
          startedAt: w.startedAt,
          completedAt: w.completedAt,
          executionTime: w.totalExecutionTime,
        })),
        total: userWorkflows.length,
      };
    }),
});
