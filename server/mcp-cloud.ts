/**
 * Cloud-Hosted MCP Server (Stateless Streamable HTTP Transport)
 *
 * Provides 10 collaboration tools (6 communication + 4 task/artifact):
 * but runs inside the Express process using the MCP Streamable HTTP transport.
 *
 * STATELESS MODE: Each request creates a fresh MCP server instance.
 * This is required because PM2 runs in cluster mode (multiple processes),
 * so session state cannot be kept in-memory.
 *
 * Users configure their MCP client to point to:
 *   POST https://api.awareness.market/mcp
 *
 * Auth: Bearer <mcp_token> in the Authorization header
 *       (or custom header X-MCP-Token for backwards compat)
 *
 * Custom headers for workspace context:
 *   X-Agent-Role: frontend|backend|designer|...
 *   X-Workspace-Key: workspace:ws_xxxxx
 */

import { Router, Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import * as db from './db';
import { prisma } from './db-prisma';
import { createLogger } from './utils/logger';

const logger = createLogger('MCP:Cloud');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const orm = prisma as any;

// ─── Auth helper ────────────────────────────────────────────────────────

interface AuthResult {
  userId: number;
  permissions: string[];
}

async function authenticateMcpRequest(req: Request): Promise<AuthResult | null> {
  // Try Authorization: Bearer mcp_xxx
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token.startsWith('mcp_')) {
      const record = await db.getMcpTokenByToken(token);
      if (record) {
        const perms = (() => {
          try { return normalizePermissions(JSON.parse(record.permissions as string)); } catch { return ['read', 'write', 'propose']; }
        })();
        return { userId: record.userId, permissions: perms };
      }
    }
  }

  // Try X-MCP-Token header (backwards compat)
  const mcpToken = req.headers['x-mcp-token'] as string | undefined;
  if (mcpToken) {
    const record = await db.getMcpTokenByToken(mcpToken);
    if (record) {
      const perms = (() => {
        try { return normalizePermissions(JSON.parse(record.permissions as string)); } catch { return ['read', 'write', 'propose']; }
      })();
      return { userId: record.userId, permissions: perms };
    }
  }

  return null;
}

// ─── Tool permission map ────────────────────────────────────────────────

const TOOL_PERMISSION_MAP: Record<string, string> = {
  share_reasoning: 'write',
  get_other_agent_context: 'read',
  propose_shared_decision: 'propose',
  get_collaboration_history: 'read',
  sync_progress: 'write',
  ask_question: 'write',
  assign_task: 'write',
  get_tasks: 'read',
  update_task: 'write',
  share_artifact: 'write',
};

// Backwards-compatible mapping: workspace tokens were created with
// ['sync', 'memory', 'collab'] but tools check for ['read', 'write', 'propose'].
// Normalize legacy permission names so existing tokens keep working.
function normalizePermissions(perms: string[]): string[] {
  const LEGACY_MAP: Record<string, string[]> = {
    sync: ['write'],
    memory: ['read'],
    collab: ['propose'],
  };
  const normalized = new Set<string>();
  for (const p of perms) {
    if (LEGACY_MAP[p]) {
      for (const mapped of LEGACY_MAP[p]) normalized.add(mapped);
    }
    normalized.add(p); // keep original too
  }
  return [...normalized];
}

// ─── Auto-heartbeat helper ──────────────────────────────────────────────

async function touchAgentHeartbeat(userId: number, memoryKey: string, role: string): Promise<void> {
  try {
    const wsIdMatch = memoryKey.match(/^workspace:(ws_[a-f0-9]+)/);
    if (!wsIdMatch) return;
    const wsId = wsIdMatch[1];
    const agent = await orm.workspaceAgent.findFirst({
      where: { workspace: { id: wsId, userId }, role },
      select: { id: true, name: true },
    });
    if (agent) {
      const now = new Date();
      await orm.workspaceAgent.update({
        where: { id: agent.id },
        data: { connectionStatus: 'connected', lastSeenAt: now },
      });
      try {
        const { broadcastAgentStatus } = await import('./socket-events.js');
        broadcastAgentStatus({
          workspaceId: wsId,
          agentId: agent.id,
          agentName: agent.name,
          role,
          connectionStatus: 'connected',
          lastSeenAt: now.toISOString(),
        });
      } catch { /* non-critical */ }
    }
  } catch { /* non-critical */ }
}

// ─── Create MCP server with collaboration tools ─────────────────────────

function createCollaborationMcpServer(
  userId: number,
  memoryKey: string,
  role: string,
  permissions: string[],
): McpServer {
  const server = new McpServer({
    name: 'awareness-collaboration-cloud',
    version: '1.0.0',
  });

  function checkPermission(toolName: string): void {
    const required = TOOL_PERMISSION_MAP[toolName];
    if (required && !permissions.includes(required)) {
      throw new Error(
        `Permission denied: tool "${toolName}" requires "${required}" permission. ` +
        `This agent has: [${permissions.join(', ')}].`
      );
    }
  }

  // ── Tool 1: share_reasoning ──────────────────────────────────────────
  server.tool(
    'share_reasoning',
    'Share your reasoning process with other AI agents. Use this frequently to keep other agents informed of your thoughts, decisions, and progress.',
    {
      currentTask: z.string().describe('What you are currently working on'),
      reasoning: z.string().describe('Your detailed thought process and reasoning'),
      decision: z.string().optional().describe('Any decision you have made'),
      needsInput: z.boolean().optional().describe('Set to true if you need input from another agent'),
      question: z.string().optional().describe('Specific question for the other agent'),
      filesModified: z.array(z.string()).optional().describe('List of files you created or modified'),
    },
    async (params) => {
      checkPermission('share_reasoning');
      const timestamp = new Date().toISOString();

      const existing = await db.getAIMemoryByKey({ userId, memoryKey });
      let history: unknown[] = [];
      if (existing?.memoryData) {
        try {
          const data = JSON.parse(existing.memoryData);
          history = Array.isArray(data.history) ? data.history : [];
        } catch { /* fresh */ }
      }

      const entry = {
        type: 'reasoning_update',
        agent_role: role,
        current_task: params.currentTask,
        reasoning: params.reasoning,
        decision: params.decision,
        files_modified: params.filesModified,
        needs_input: params.needsInput,
        question: params.question,
        source: 'cloud_mcp',
        timestamp,
      };

      history.push(entry);
      if (history.length > 100) history = history.slice(-100);

      const stored = await db.upsertAIMemory({
        userId,
        memoryKey,
        data: { workspace: memoryKey, history, last_update: entry, updated_at: timestamp },
        ttlDays: 30,
      });

      touchAgentHeartbeat(userId, memoryKey, role);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'shared',
            timestamp,
            version: stored?.version ?? 1,
            historyLength: history.length,
            message: 'Your reasoning has been shared with other agents',
          }, null, 2),
        }],
      };
    },
  );

  // ── Tool 2: get_other_agent_context ──────────────────────────────────
  server.tool(
    'get_other_agent_context',
    'Get the current context and latest reasoning from other AI agents. Use this before starting a task to understand what other agents are working on.',
    {
      limit: z.number().optional().default(10).describe('Number of recent updates to retrieve'),
    },
    async (params) => {
      checkPermission('get_other_agent_context');

      const existing = await db.getAIMemoryByKey({ userId, memoryKey });
      if (!existing?.memoryData) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ history: [], message: 'No collaboration history yet' }, null, 2),
          }],
        };
      }

      const data = JSON.parse(existing.memoryData);
      const history = Array.isArray(data.history) ? data.history : [];
      const otherEntries = history
        .filter((e: any) => e.agent_role !== role)
        .slice(-(params.limit || 10));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            myRole: role,
            otherAgentUpdates: otherEntries,
            totalEntries: history.length,
            message: `Retrieved ${otherEntries.length} updates from other agents`,
          }, null, 2),
        }],
      };
    },
  );

  // ── Tool 3: propose_shared_decision ──────────────────────────────────
  server.tool(
    'propose_shared_decision',
    'Propose a decision that affects multiple agents. Other agents should acknowledge or provide feedback on this proposal.',
    {
      decision: z.string().describe('The decision being proposed'),
      reasoning: z.string().describe('Why this decision makes sense'),
      impact: z.object({
        frontend: z.string().describe('How this affects frontend development'),
        backend: z.string().describe('How this affects backend development'),
      }),
      alternatives: z.string().optional().describe('Other options considered'),
    },
    async (params) => {
      checkPermission('propose_shared_decision');
      const timestamp = new Date().toISOString();

      const existing = await db.getAIMemoryByKey({ userId, memoryKey });
      let history: unknown[] = [];
      if (existing?.memoryData) {
        try {
          const data = JSON.parse(existing.memoryData);
          history = Array.isArray(data.history) ? data.history : [];
        } catch { /* fresh */ }
      }

      const entry = {
        type: 'decision_proposal',
        agent_role: role,
        decision: params.decision,
        reasoning: params.reasoning,
        impact: params.impact,
        alternatives: params.alternatives,
        source: 'cloud_mcp',
        timestamp,
      };

      history.push(entry);
      if (history.length > 100) history = history.slice(-100);

      await db.upsertAIMemory({
        userId,
        memoryKey,
        data: { workspace: memoryKey, history, last_update: entry, updated_at: timestamp },
        ttlDays: 30,
      });

      touchAgentHeartbeat(userId, memoryKey, role);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'proposed',
            decision: params.decision,
            timestamp,
            impact: params.impact,
            message: 'Decision proposal shared. Other agents will see this in their context.',
          }, null, 2),
        }],
      };
    },
  );

  // ── Tool 4: get_collaboration_history ────────────────────────────────
  server.tool(
    'get_collaboration_history',
    'Get the full collaboration history and reasoning chain. Useful for reviewing past decisions or catching up.',
    {
      limit: z.number().optional().default(20).describe('Number of recent steps to retrieve'),
      filterBy: z.enum(['all', 'decisions', 'questions', 'frontend', 'backend']).optional().default('all').describe('Filter history by type'),
    },
    async (params) => {
      checkPermission('get_collaboration_history');

      const existing = await db.getAIMemoryByKey({ userId, memoryKey });
      if (!existing?.memoryData) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ history: [], message: 'No history available' }, null, 2),
          }],
        };
      }

      const data = JSON.parse(existing.memoryData);
      let history = Array.isArray(data.history) ? data.history : [];

      if (params.filterBy === 'decisions') {
        history = history.filter((e: any) => e.type === 'decision_proposal');
      } else if (params.filterBy === 'questions') {
        history = history.filter((e: any) => e.type === 'question' || e.needs_input);
      } else if (params.filterBy === 'frontend') {
        history = history.filter((e: any) => e.agent_role === 'frontend');
      } else if (params.filterBy === 'backend') {
        history = history.filter((e: any) => e.agent_role === 'backend');
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            history: history.slice(-(params.limit || 20)),
            filter: params.filterBy,
            totalMatching: history.length,
          }, null, 2),
        }],
      };
    },
  );

  // ── Tool 5: sync_progress ────────────────────────────────────────────
  server.tool(
    'sync_progress',
    'Sync your current progress, files modified, and next steps. Use this after completing a significant chunk of work.',
    {
      completed: z.array(z.string()).describe('Tasks or features you completed'),
      filesModified: z.array(z.string()).describe('Files you created or modified'),
      nextSteps: z.array(z.string()).describe('What you plan to work on next'),
      blockers: z.array(z.string()).optional().describe('Any blockers or issues you encountered'),
      needsFromOtherAgent: z.string().optional().describe('What you need from the other agent to proceed'),
    },
    async (params) => {
      checkPermission('sync_progress');
      const timestamp = new Date().toISOString();

      const existing = await db.getAIMemoryByKey({ userId, memoryKey });
      let history: unknown[] = [];
      if (existing?.memoryData) {
        try {
          const data = JSON.parse(existing.memoryData);
          history = Array.isArray(data.history) ? data.history : [];
        } catch { /* fresh */ }
      }

      const entry = {
        type: 'progress_sync',
        agent_role: role,
        completed_tasks: params.completed,
        files_modified: params.filesModified,
        next_steps: params.nextSteps,
        blockers: params.blockers,
        needs_from_other_agent: params.needsFromOtherAgent,
        source: 'cloud_mcp',
        timestamp,
      };

      history.push(entry);
      if (history.length > 100) history = history.slice(-100);

      await db.upsertAIMemory({
        userId,
        memoryKey,
        data: { workspace: memoryKey, history, last_update: entry, updated_at: timestamp },
        ttlDays: 30,
      });

      touchAgentHeartbeat(userId, memoryKey, role);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'synced',
            timestamp,
            summary: {
              completed: params.completed.length,
              filesModified: params.filesModified.length,
              nextSteps: params.nextSteps.length,
              blockers: params.blockers?.length || 0,
            },
            message: 'Progress synced with other agents',
          }, null, 2),
        }],
      };
    },
  );

  // ── Tool 6: ask_question ─────────────────────────────────────────────
  server.tool(
    'ask_question',
    'Ask a specific question to other agents. Use this when you need clarification or input.',
    {
      question: z.string().describe('Your question for the other agent'),
      context: z.string().describe('Context for the question'),
      urgency: z.enum(['low', 'medium', 'high']).optional().default('medium').describe('How urgently you need an answer'),
    },
    async (params) => {
      checkPermission('ask_question');
      const timestamp = new Date().toISOString();

      const existing = await db.getAIMemoryByKey({ userId, memoryKey });
      let history: unknown[] = [];
      if (existing?.memoryData) {
        try {
          const data = JSON.parse(existing.memoryData);
          history = Array.isArray(data.history) ? data.history : [];
        } catch { /* fresh */ }
      }

      const entry = {
        type: 'question',
        agent_role: role,
        question: params.question,
        context: params.context,
        urgency: params.urgency,
        source: 'cloud_mcp',
        timestamp,
      };

      history.push(entry);
      if (history.length > 100) history = history.slice(-100);

      await db.upsertAIMemory({
        userId,
        memoryKey,
        data: { workspace: memoryKey, history, last_update: entry, updated_at: timestamp },
        ttlDays: 30,
      });

      touchAgentHeartbeat(userId, memoryKey, role);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'asked',
            question: params.question,
            urgency: params.urgency,
            timestamp,
            message: 'Question sent. Other agents will see it in their context.',
          }, null, 2),
        }],
      };
    },
  );

  // ── Helper: read/write namespaced task/artifact stores ─────────────────
  const tasksKey = `${memoryKey}:tasks`;
  const artifactsKey = `${memoryKey}:artifacts`;

  async function readStore(key: string): Promise<any[]> {
    const existing = await db.getAIMemoryByKey({ userId, memoryKey: key });
    if (!existing?.memoryData) return [];
    try {
      const data = JSON.parse(existing.memoryData);
      return Array.isArray(data.items) ? data.items : [];
    } catch { return []; }
  }

  async function writeStore(key: string, items: any[]): Promise<void> {
    // Keep last 200 items max
    const trimmed = items.length > 200 ? items.slice(-200) : items;
    await db.upsertAIMemory({
      userId,
      memoryKey: key,
      data: { items: trimmed, updated_at: new Date().toISOString() },
      ttlDays: 30,
    });
  }

  // ── Tool 7: assign_task ────────────────────────────────────────────────
  server.tool(
    'assign_task',
    'Assign a task to another agent. Use this to delegate testing, code review, deployment verification, or any actionable work to a specific agent role.',
    {
      to: z.string().describe('Target agent role (e.g. "reviewer", "frontend", "backend")'),
      type: z.enum(['test', 'review', 'deploy', 'fix', 'investigate', 'other']).describe('Task type'),
      title: z.string().describe('Short task title'),
      description: z.string().optional().describe('Detailed description of what needs to be done'),
      spec: z.record(z.string(), z.any()).optional().describe('Structured spec (e.g. { endpoint, method, expectedStatus })'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium').describe('Task priority'),
    },
    async (params) => {
      checkPermission('assign_task');
      const timestamp = new Date().toISOString();
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const tasks = await readStore(tasksKey);
      const task = {
        id: taskId,
        from: role,
        to: params.to,
        type: params.type,
        title: params.title,
        description: params.description,
        spec: params.spec,
        priority: params.priority || 'medium',
        status: 'pending',
        result: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      tasks.push(task);
      await writeStore(tasksKey, tasks);

      // Also push a notification into the main collab history
      const existing = await db.getAIMemoryByKey({ userId, memoryKey });
      let history: unknown[] = [];
      if (existing?.memoryData) {
        try { const d = JSON.parse(existing.memoryData); history = Array.isArray(d.history) ? d.history : []; } catch { /* */ }
      }
      history.push({
        type: 'task_assigned',
        agent_role: role,
        task_id: taskId,
        task_title: params.title,
        assigned_to: params.to,
        priority: params.priority || 'medium',
        source: 'cloud_mcp',
        timestamp,
      });
      if (history.length > 100) history = history.slice(-100);
      await db.upsertAIMemory({
        userId, memoryKey,
        data: { workspace: memoryKey, history, last_update: history[history.length - 1], updated_at: timestamp },
        ttlDays: 30,
      });

      touchAgentHeartbeat(userId, memoryKey, role);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'assigned',
            taskId,
            to: params.to,
            title: params.title,
            priority: params.priority || 'medium',
            message: `Task assigned to ${params.to}. They will see it via get_tasks.`,
          }, null, 2),
        }],
      };
    },
  );

  // ── Tool 8: get_tasks ──────────────────────────────────────────────────
  server.tool(
    'get_tasks',
    'Get tasks assigned to you or tasks you assigned to others. Check this regularly to pick up new work.',
    {
      filter: z.enum(['mine', 'assigned_by_me', 'all']).optional().default('mine').describe('Which tasks to retrieve'),
      status: z.enum(['pending', 'in_progress', 'done', 'failed', 'all']).optional().default('all').describe('Filter by status'),
    },
    async (params) => {
      checkPermission('get_tasks');
      const allTasks = await readStore(tasksKey);

      let filtered = allTasks;
      if (params.filter === 'mine') {
        filtered = allTasks.filter((t: any) => t.to === role);
      } else if (params.filter === 'assigned_by_me') {
        filtered = allTasks.filter((t: any) => t.from === role);
      }

      if (params.status && params.status !== 'all') {
        filtered = filtered.filter((t: any) => t.status === params.status);
      }

      touchAgentHeartbeat(userId, memoryKey, role);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            myRole: role,
            filter: params.filter,
            statusFilter: params.status,
            tasks: filtered.slice(-50),
            total: filtered.length,
          }, null, 2),
        }],
      };
    },
  );

  // ── Tool 9: update_task ────────────────────────────────────────────────
  server.tool(
    'update_task',
    'Update the status of a task (accept it, mark as done, or report failure). Attach results, evidence, or error details.',
    {
      taskId: z.string().describe('The task ID to update'),
      status: z.enum(['in_progress', 'done', 'failed', 'blocked']).describe('New task status'),
      result: z.string().optional().describe('Result summary or error details'),
      evidence: z.record(z.string(), z.any()).optional().describe('Structured evidence (e.g. { passed: true, response: "...", screenshot: "url" })'),
    },
    async (params) => {
      checkPermission('update_task');
      const timestamp = new Date().toISOString();
      const tasks = await readStore(tasksKey);

      const idx = tasks.findIndex((t: any) => t.id === params.taskId);
      if (idx === -1) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Task not found', taskId: params.taskId }) }],
        };
      }

      tasks[idx] = {
        ...tasks[idx],
        status: params.status,
        result: params.result || tasks[idx].result,
        evidence: params.evidence || tasks[idx].evidence,
        updatedAt: timestamp,
        updatedBy: role,
      };
      await writeStore(tasksKey, tasks);

      // Notify in main history
      const existing = await db.getAIMemoryByKey({ userId, memoryKey });
      let history: unknown[] = [];
      if (existing?.memoryData) {
        try { const d = JSON.parse(existing.memoryData); history = Array.isArray(d.history) ? d.history : []; } catch { /* */ }
      }
      history.push({
        type: 'task_updated',
        agent_role: role,
        task_id: params.taskId,
        task_title: tasks[idx].title,
        new_status: params.status,
        result_summary: params.result,
        source: 'cloud_mcp',
        timestamp,
      });
      if (history.length > 100) history = history.slice(-100);
      await db.upsertAIMemory({
        userId, memoryKey,
        data: { workspace: memoryKey, history, last_update: history[history.length - 1], updated_at: timestamp },
        ttlDays: 30,
      });

      touchAgentHeartbeat(userId, memoryKey, role);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'updated',
            taskId: params.taskId,
            newStatus: params.status,
            title: tasks[idx].title,
            message: `Task "${tasks[idx].title}" updated to ${params.status}.`,
          }, null, 2),
        }],
      };
    },
  );

  // ── Tool 10: share_artifact ────────────────────────────────────────────
  server.tool(
    'share_artifact',
    'Share a file, code snippet, test result, log output, or any artifact with other agents. Use this to pass concrete deliverables between agents.',
    {
      type: z.enum(['code_patch', 'test_result', 'log', 'screenshot', 'config', 'report', 'other']).describe('Artifact type'),
      name: z.string().describe('Artifact name (e.g. "fix-auth.patch", "api-test-results.json")'),
      content: z.string().describe('Artifact content (code, logs, JSON, etc.)'),
      message: z.string().optional().describe('Brief message explaining the artifact'),
      relatedTaskId: z.string().optional().describe('Link this artifact to a specific task ID'),
    },
    async (params) => {
      checkPermission('share_artifact');
      const timestamp = new Date().toISOString();
      const artifactId = `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const artifacts = await readStore(artifactsKey);
      const artifact = {
        id: artifactId,
        from: role,
        type: params.type,
        name: params.name,
        content: params.content.slice(0, 50000), // 50KB max per artifact
        message: params.message,
        relatedTaskId: params.relatedTaskId,
        createdAt: timestamp,
      };
      artifacts.push(artifact);
      await writeStore(artifactsKey, artifacts);

      // Notify in main history
      const existing = await db.getAIMemoryByKey({ userId, memoryKey });
      let history: unknown[] = [];
      if (existing?.memoryData) {
        try { const d = JSON.parse(existing.memoryData); history = Array.isArray(d.history) ? d.history : []; } catch { /* */ }
      }
      history.push({
        type: 'artifact_shared',
        agent_role: role,
        artifact_id: artifactId,
        artifact_name: params.name,
        artifact_type: params.type,
        message: params.message,
        related_task_id: params.relatedTaskId,
        content_length: params.content.length,
        source: 'cloud_mcp',
        timestamp,
      });
      if (history.length > 100) history = history.slice(-100);
      await db.upsertAIMemory({
        userId, memoryKey,
        data: { workspace: memoryKey, history, last_update: history[history.length - 1], updated_at: timestamp },
        ttlDays: 30,
      });

      touchAgentHeartbeat(userId, memoryKey, role);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'shared',
            artifactId,
            name: params.name,
            type: params.type,
            contentLength: params.content.length,
            message: `Artifact "${params.name}" shared. Other agents can retrieve it via get_collaboration_history.`,
          }, null, 2),
        }],
      };
    },
  );

  return server;
}

// ─── Express Router ─────────────────────────────────────────────────────

const mcpCloudRouter = Router();

// Middleware: authenticate
async function mcpAuthMiddleware(req: Request, res: Response, next: () => void) {
  const auth = await authenticateMcpRequest(req);
  if (!auth) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized. Provide Bearer <mcp_token> or X-MCP-Token header.' },
      id: null,
    });
    return;
  }
  (req as any)._mcpAuth = auth;
  next();
}

mcpCloudRouter.use(mcpAuthMiddleware);

/**
 * POST /mcp — Stateless MCP handler
 *
 * Each request creates a fresh McpServer + StreamableHTTPServerTransport.
 * This works with PM2 cluster mode (no shared in-memory sessions).
 * The trade-off is slightly higher latency per request (~5ms overhead)
 * but perfect compatibility with multi-process deployments.
 */
mcpCloudRouter.post('/', async (req: Request, res: Response) => {
  const auth = (req as any)._mcpAuth as AuthResult;

  // Extract workspace context from custom headers
  const agentRole = (req.headers['x-agent-role'] as string) || 'default';
  const workspaceKey = (req.headers['x-workspace-key'] as string) || '';
  const memoryKey = workspaceKey || `workspace:default_${auth.userId}`;

  try {
    // Create a fresh server + transport for each request (stateless)
    const mcpServer = createCollaborationMcpServer(
      auth.userId,
      memoryKey,
      agentRole,
      auth.permissions,
    );

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — no sessions
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
    await transport.close();
    await mcpServer.close();
  } catch (error: any) {
    logger.error('MCP cloud request failed', { error: error.message });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: null,
      });
    }
  }
});

// GET /mcp — Not supported in stateless mode
mcpCloudRouter.get('/', (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'SSE streaming not available in stateless mode. Use POST for all requests.' },
    id: null,
  });
});

// DELETE /mcp — No-op in stateless mode
mcpCloudRouter.delete('/', (_req: Request, res: Response) => {
  res.status(200).json({ success: true });
});

export { mcpCloudRouter };
export default mcpCloudRouter;
