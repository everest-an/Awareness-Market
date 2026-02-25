/**
 * Webhook Inbound Worker
 *
 * BullMQ worker that processes inbound webhook requests asynchronously.
 * Converts webhook actions into internal commands and routes them to
 * the appropriate MCP/collaboration layer — ensuring external requests
 * never directly interfere with agent MCP sync communication.
 */

import { Worker, Queue } from 'bullmq';
import { prisma } from '../db-prisma';
import * as workflowDb from '../db-workflows';
import {
  convertToInternalCommand,
  enqueueOutbound,
  isValidMcpTool,
} from '../collaboration/webhook-adapter';
import { createLogger } from '../utils/logger';

const logger = createLogger('Worker:WebhookInbound');

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// ─── Queue ───────────────────────────────────────────────────────────────────

export const webhookInboundQueue = new Queue('webhook-inbound', {
  connection: redisConnection,
});

// ─── executeWorkflow import ──────────────────────────────────────────────────
// Lazy import to avoid circular dependency with agent-collaboration router.
// The router file exposes executeWorkflow as a module-level function.
let _executeWorkflow: ((workflowId: string) => Promise<void>) | null = null;

async function getExecuteWorkflow(): Promise<(workflowId: string) => Promise<void>> {
  if (!_executeWorkflow) {
    // Dynamic import to break circular dependency
    const mod = await import('../routers/agent-collaboration');
    _executeWorkflow = (mod as any).executeWorkflow;
    if (!_executeWorkflow) {
      throw new Error('executeWorkflow not exported from agent-collaboration router');
    }
  }
  return _executeWorkflow;
}

// ─── Worker ──────────────────────────────────────────────────────────────────

export const webhookInboundWorker = new Worker(
  'webhook-inbound',
  async (job) => {
    const { requestId, workflowId, action, data, toolName } = job.data;
    logger.info('Processing inbound webhook', { requestId, workflowId, action });

    // Update audit record → processing
    await prisma.webhookEvent.update({
      where: { requestId },
      data: { status: 'processing', attempts: { increment: 1 } },
    });

    try {
      // Fetch workflow
      const workflow = await workflowDb.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const command = convertToInternalCommand({ workflowId, action, data, toolName });

      switch (command.type) {
        // ── Propose: store proposal in shared memory ──────────────────
        case 'propose': {
          const proposals = (workflow.sharedMemory as any)?._proposals ?? [];
          proposals.push({
            ...command.data,
            proposedAt: new Date().toISOString(),
            source: 'webhook',
          });
          await workflowDb.updateSharedMemory(workflowId, {
            ...workflow.sharedMemory,
            _proposals: proposals,
          });

          enqueueOutbound(
            workflowId,
            workflow.webhookUrl,
            workflow.webhookSecret,
            'workflow.propose',
            { proposal: command.data },
          );

          logger.info('Proposal stored via webhook', { requestId, workflowId });
          break;
        }

        // ── Execute: trigger workflow execution ───────────────────────
        case 'execute': {
          if (workflow.status !== 'pending') {
            throw new Error(`Cannot execute workflow in "${workflow.status}" state (requires "pending")`);
          }

          enqueueOutbound(
            workflowId,
            workflow.webhookUrl,
            workflow.webhookSecret,
            'workflow.execute',
            {},
          );

          const executeWorkflow = await getExecuteWorkflow();
          // Fire async — don't block the worker
          executeWorkflow(workflowId).catch((err) => {
            logger.error('Webhook-triggered execution error', { workflowId, error: err.message });
          });

          logger.info('Workflow execution triggered via webhook', { requestId, workflowId });
          break;
        }

        // ── Stop: cancel workflow ────────────────────────────────────
        case 'stop': {
          if (workflow.status === 'completed' || workflow.status === 'cancelled') {
            throw new Error(`Cannot stop workflow in "${workflow.status}" state`);
          }

          await workflowDb.updateWorkflowStatus(workflowId, 'cancelled', {
            completedAt: new Date(),
          });

          enqueueOutbound(
            workflowId,
            workflow.webhookUrl,
            workflow.webhookSecret,
            'workflow.failed',
            { reason: 'Stopped via webhook', stoppedAt: new Date().toISOString() },
          );

          logger.info('Workflow stopped via webhook', { requestId, workflowId });
          break;
        }

        // ── Sync: call MCP sync endpoint ─────────────────────────────
        case 'sync': {
          const mcpToken = (workflow.sharedMemory as any)?._mcpTokenPrefix
            ? undefined // We'd need the full token; use stored one if available
            : undefined;

          const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
          const syncUrl = `${baseUrl}/api/mcp/sync`;

          const agents = workflow.steps.map((s) => ({
            id: s.agentId,
            messages: [{ role: 'user' as const, content: workflow.task }],
          }));

          const syncHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
          if (mcpToken) syncHeaders['X-MCP-Token'] = mcpToken;

          const response = await fetch(syncUrl, {
            method: 'POST',
            headers: syncHeaders,
            body: JSON.stringify({
              agents,
              shared_context: { ...(command.data || {}), source: 'webhook' },
              memory_key: `collab_${workflowId}`,
              memory_ttl_days: 7,
            }),
          });

          if (!response.ok) {
            throw new Error(`MCP sync failed: ${response.status} ${response.statusText}`);
          }

          logger.info('MCP sync executed via webhook', { requestId, workflowId });
          break;
        }

        // ── Tool: call specific MCP tool ─────────────────────────────
        case 'tool': {
          if (!command.toolName || !isValidMcpTool(command.toolName)) {
            throw new Error(`Invalid or unsupported MCP tool: ${command.toolName}`);
          }

          const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
          const mcpEndpoint = `${baseUrl}/mcp`;

          // Call MCP Cloud Server as JSON-RPC
          const response = await fetch(mcpEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Agent-Role': 'webhook-adapter',
              'X-Workspace-Key': `workspace:${workflowId}`,
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: requestId,
              method: 'tools/call',
              params: {
                name: command.toolName,
                arguments: command.data,
              },
            }),
          });

          if (!response.ok) {
            throw new Error(`MCP tool call failed: ${response.status} ${response.statusText}`);
          }

          logger.info('MCP tool call executed via webhook', {
            requestId,
            workflowId,
            toolName: command.toolName,
          });
          break;
        }

        default:
          throw new Error(`Unknown webhook action: ${command.type}`);
      }

      // Update audit record → delivered
      await prisma.webhookEvent.update({
        where: { requestId },
        data: {
          status: 'delivered',
          processedAt: new Date(),
        },
      });

      return { success: true, action, workflowId };
    } catch (error: any) {
      logger.error('Inbound webhook processing failed', {
        requestId,
        workflowId,
        action,
        error: error.message,
      });

      // Update audit record → failed
      await prisma.webhookEvent.update({
        where: { requestId },
        data: {
          status: 'failed',
          error: error.message,
          processedAt: new Date(),
        },
      });

      throw error; // Let BullMQ handle retry if configured
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 1000,
    },
  },
);

// ─── Event Handlers ──────────────────────────────────────────────────────────

webhookInboundWorker.on('completed', (job) => {
  logger.debug('Inbound webhook job completed', { jobId: job?.id });
});

webhookInboundWorker.on('failed', (job, err) => {
  logger.error('Inbound webhook job failed', {
    jobId: job?.id,
    error: err.message,
    attempts: job?.attemptsMade,
  });
});
