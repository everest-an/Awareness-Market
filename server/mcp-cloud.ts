/**
 * Cloud-Hosted MCP Server (Streamable HTTP Transport)
 *
 * Provides the same 6 collaboration tools as the local stdio MCP server,
 * but runs inside the Express process using the MCP Streamable HTTP transport.
 *
 * Users configure their MCP client to point to:
 *   POST https://api.awareness.market/mcp
 *   GET  https://api.awareness.market/mcp  (SSE stream)
 *   DELETE https://api.awareness.market/mcp (close session)
 *
 * Auth: Bearer <mcp_token> in the Authorization header
 *       (or custom header X-MCP-Token for backwards compat)
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import * as db from './db';
import { prisma } from './db-prisma';
import { createLogger } from './utils/logger';

const logger = createLogger('MCP:Cloud');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const orm = prisma as any;

// ─── Session storage ────────────────────────────────────────────────────
// Maps sessionId → { transport, server, userId, workspaceId, role, permissions, lastActivity }
interface McpSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  userId: number;
  memoryKey: string;
  role: string;
  permissions: string[];
  lastActivity: number;
}

const sessions = new Map<string, McpSession>();

// Cleanup stale sessions every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30min idle
  for (const [id, session] of sessions) {
    if (session.lastActivity < cutoff) {
      try { session.transport.close(); } catch { /* ignore */ }
      sessions.delete(id);
      logger.info('Cleaned up stale MCP session', { sessionId: id });
    }
  }
}, 10 * 60 * 1000);

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
          try { return JSON.parse(record.permissions as string); } catch { return ['read', 'write', 'propose']; }
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
        try { return JSON.parse(record.permissions as string); } catch { return ['read', 'write', 'propose']; }
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
};

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
      // Filter out own entries, show others
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

      // Apply filters
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

  return server;
}

// ─── Express Router ─────────────────────────────────────────────────────

const mcpCloudRouter = Router();

// Middleware: authenticate + extract workspace context from headers
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

// POST /mcp — Handle MCP JSON-RPC requests (initialize, tool calls, etc.)
mcpCloudRouter.post('/', async (req: Request, res: Response) => {
  const auth = (req as any)._mcpAuth as AuthResult;
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Extract workspace context from custom headers
  const agentRole = (req.headers['x-agent-role'] as string) || 'default';
  const workspaceKey = (req.headers['x-workspace-key'] as string) || '';

  try {
    if (sessionId && sessions.has(sessionId)) {
      // Existing session — route request
      const session = sessions.get(sessionId)!;
      session.lastActivity = Date.now();
      await session.transport.handleRequest(req, res, req.body);
    } else {
      // New session — create MCP server + transport
      const memoryKey = workspaceKey || `workspace:default_${auth.userId}`;

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId: string) => {
          sessions.set(newSessionId, {
            transport,
            server: mcpServer,
            userId: auth.userId,
            memoryKey,
            role: agentRole,
            permissions: auth.permissions,
            lastActivity: Date.now(),
          });
          logger.info('MCP cloud session created', {
            sessionId: newSessionId,
            userId: auth.userId,
            role: agentRole,
            memoryKey,
          });
        },
      });

      const mcpServer = createCollaborationMcpServer(
        auth.userId,
        memoryKey,
        agentRole,
        auth.permissions,
      );

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    }
  } catch (error: any) {
    logger.error('MCP cloud request failed', { error: error.message, sessionId });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: null,
      });
    }
  }
});

// GET /mcp — SSE stream for server-to-client notifications
mcpCloudRouter.get('/', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Invalid or missing session. Send a POST first to initialize.' },
      id: null,
    });
    return;
  }

  const session = sessions.get(sessionId)!;
  session.lastActivity = Date.now();

  try {
    await session.transport.handleRequest(req, res);
  } catch (error: any) {
    logger.error('MCP SSE stream error', { error: error.message, sessionId });
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
});

// DELETE /mcp — Close session
mcpCloudRouter.delete('/', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    try { await session.transport.close(); } catch { /* ignore */ }
    sessions.delete(sessionId);
    logger.info('MCP cloud session closed', { sessionId });
  }

  res.status(200).json({ success: true });
});

export { mcpCloudRouter };
export default mcpCloudRouter;
