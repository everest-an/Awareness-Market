/**
 * Workspace Collaboration REST API
 *
 * Provides HTTP endpoints that mirror the MCP collaboration tools,
 * so any HTTP-capable client (v0, browser, scripts) can participate
 * in multi-agent collaboration alongside MCP-connected agents.
 *
 * All endpoints read/write the same AiMemory table that MCP agents use,
 * ensuring MCP and REST agents share the same context.
 *
 * Auth: X-API-Key or X-MCP-Token header
 */

import { Router } from 'express';
import { z } from 'zod';
import * as db from '../db';
import { prisma } from '../db-prisma';
import { validateApiKey, AuthenticatedRequest } from '../ai-auth-api';
import { createLogger } from '../utils/logger';

const logger = createLogger('Collab:REST');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const orm = prisma as any;

/**
 * Auto-update agent heartbeat when an agent interacts via the collab API.
 * Matches by workspace memoryKey + agent role to find the WorkspaceAgent record.
 */
async function touchAgentHeartbeat(userId: number, memoryKey: string, role: string): Promise<void> {
  try {
    // memoryKey format: "workspace:ws_xxxx" — extract workspace id
    const wsIdMatch = memoryKey.match(/^workspace:(ws_[a-f0-9]+)/);
    if (!wsIdMatch) return;
    const wsId = wsIdMatch[1];
    // Find the agent by workspace + role
    const agent = await orm.workspaceAgent.findFirst({
      where: {
        workspace: { id: wsId, userId },
        role,
      },
      select: { id: true, name: true },
    });
    if (agent) {
      const now = new Date();
      await orm.workspaceAgent.update({
        where: { id: agent.id },
        data: { connectionStatus: 'connected', lastSeenAt: now },
      });
      // Broadcast via WebSocket
      try {
        const { broadcastAgentStatus } = await import('../socket-events.js');
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
  } catch {
    // Non-critical — don't fail the request
  }
}

const collabRouter = Router();

// ============================================================================
// Auth helper — accept X-API-Key or X-MCP-Token
// ============================================================================

async function resolveUser(req: any): Promise<{ userId: number } | null> {
  // Try API key first (already validated by middleware if present)
  if ((req as AuthenticatedRequest).apiKeyUserId) {
    return { userId: (req as AuthenticatedRequest).apiKeyUserId as number };
  }

  // Try MCP token
  const mcpToken = req.headers['x-mcp-token'] as string | undefined;
  if (mcpToken) {
    const record = await db.getMcpTokenByToken(mcpToken);
    if (record) {
      return { userId: record.userId };
    }
  }

  // Try Bearer JWT (set by flexAuth)
  if ((req as any)._bearerUserId) {
    return { userId: (req as any)._bearerUserId };
  }

  return null;
}

// Apply validateApiKey optionally — allow MCP token or Bearer JWT fallback
async function flexAuth(req: any, res: any, next: any) {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    return validateApiKey(req, res, next);
  }

  const mcpToken = req.headers['x-mcp-token'] as string | undefined;
  if (mcpToken) {
    return next(); // Will be resolved in handler via resolveUser
  }

  // Bearer JWT token (for CLI and web clients)
  const authHeader = req.headers.authorization as string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { getUserFromToken } = await import('../auth-standalone');
      const result = await getUserFromToken(authHeader.slice(7));
      if (result.success && result.user) {
        (req as AuthenticatedRequest).apiKeyUserId = result.user.id;
        (req as AuthenticatedRequest).apiKeyPermissions = ['read', 'write', 'propose'];
        (req as any)._bearerUserId = result.user.id;
        return next();
      }
    } catch (error) {
      logger.error('Bearer token validation error:', { error });
    }
    return res.status(401).json({ error: 'Invalid Bearer token' });
  }

  return res.status(401).json({ error: 'Missing authentication. Provide X-API-Key, X-MCP-Token, or Authorization: Bearer header.' });
}

// ============================================================================
// Permission checking
// ============================================================================

type Permission = 'read' | 'write' | 'propose' | 'execute';

async function checkWorkspacePermission(
  memoryKey: string,
  userId: number,
  requiredPermission: Permission
): Promise<{ allowed: boolean; reason?: string }> {
  // Look up workspace permissions from stored memory
  const permMemory = await db.getAIMemoryByKey({
    userId,
    memoryKey: `${memoryKey}:__permissions`,
  });

  if (!permMemory?.memoryData) {
    // No permission record = deny (fail-closed)
    return { allowed: false, reason: 'No permission record found for this workspace. Ensure the workspace was created properly.' };
  }

  try {
    const permData = JSON.parse(permMemory.memoryData);
    // permData format: { "agent_role": ["read","write","propose"], ... }
    const allPerms: string[] = Object.values(permData).flat() as string[];
    if (allPerms.includes(requiredPermission)) {
      return { allowed: true };
    }
    return { allowed: false, reason: `Missing '${requiredPermission}' permission` };
  } catch {
    // Malformed permissions = deny (fail-closed)
    return { allowed: false, reason: 'Workspace permission record is corrupted. Recreate the workspace.' };
  }
}

// ============================================================================
// POST /api/collab/share — Share reasoning / context (like share_reasoning MCP tool)
// ============================================================================

const shareSchema = z.object({
  workspace: z.string().min(1).max(200),
  role: z.string().min(1).max(50),
  task: z.string().min(1).max(2000),
  reasoning: z.string().min(1).max(10000),
  decision: z.string().max(2000).optional(),
  filesModified: z.array(z.string()).optional(),
  needsInput: z.boolean().optional(),
  question: z.string().max(2000).optional(),
});

collabRouter.post('/share', flexAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const body = shareSchema.parse(req.body);

    // Build memory key compatible with MCP server format
    const memoryKey = body.workspace.startsWith('client:')
      ? body.workspace
      : `workspace:${body.workspace}`;

    // Check write permission
    const perm = await checkWorkspacePermission(memoryKey, user.userId, 'write');
    if (!perm.allowed) {
      return res.status(403).json({ error: perm.reason });
    }

    // Build the context entry (same format MCP server writes)
    const entry = {
      type: 'reasoning_update',
      agent_role: body.role,
      current_task: body.task,
      reasoning: body.reasoning,
      decision: body.decision,
      files_modified: body.filesModified,
      needs_input: body.needsInput,
      question: body.question,
      source: 'rest_api',
      timestamp: new Date().toISOString(),
    };

    // Read existing context and append
    const existing = await db.getAIMemoryByKey({ userId: user.userId, memoryKey });
    let contextHistory: unknown[] = [];

    if (existing?.memoryData) {
      try {
        const data = JSON.parse(existing.memoryData);
        contextHistory = Array.isArray(data.history) ? data.history : [];
      } catch { /* fresh start */ }
    }

    contextHistory.push(entry);

    // Keep last 100 entries
    if (contextHistory.length > 100) {
      contextHistory = contextHistory.slice(-100);
    }

    const stored = await db.upsertAIMemory({
      userId: user.userId,
      memoryKey,
      data: {
        workspace: body.workspace,
        history: contextHistory,
        last_update: entry,
        updated_at: new Date().toISOString(),
      },
      ttlDays: 30,
    });

    // Auto-heartbeat: mark agent as connected
    touchAgentHeartbeat(user.userId, memoryKey, body.role);

    logger.info('REST context shared', {
      workspace: body.workspace,
      role: body.role,
      task: body.task.substring(0, 80),
    });

    res.json({
      success: true,
      version: stored?.version ?? 1,
      historyLength: contextHistory.length,
      message: `Context shared by ${body.role}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.issues });
    }
    logger.error('Share failed:', { error });
    res.status(500).json({ error: 'Failed to share context' });
  }
});

// ============================================================================
// GET /api/collab/context — Get all agents' context (like get_other_agent_context)
// ============================================================================

collabRouter.get('/context', flexAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const workspace = req.query.workspace as string;
    if (!workspace) {
      return res.status(400).json({ error: 'Missing workspace query parameter' });
    }

    const memoryKey = workspace.startsWith('client:')
      ? workspace
      : `workspace:${workspace}`;

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const existing = await db.getAIMemoryByKey({ userId: user.userId, memoryKey });

    if (!existing?.memoryData) {
      return res.json({ workspace, history: [], lastUpdate: null });
    }

    const data = JSON.parse(existing.memoryData);
    const history = Array.isArray(data.history) ? data.history.slice(-limit) : [];

    res.json({
      workspace,
      history,
      lastUpdate: data.last_update ?? null,
      totalEntries: Array.isArray(data.history) ? data.history.length : 0,
      version: existing.version ?? 1,
    });
  } catch (error) {
    logger.error('Context fetch failed:', { error });
    res.status(500).json({ error: 'Failed to fetch context' });
  }
});

// ============================================================================
// POST /api/collab/decision — Propose a shared decision
// ============================================================================

const decisionSchema = z.object({
  workspace: z.string().min(1).max(200),
  role: z.string().min(1).max(50),
  decision: z.string().min(1).max(5000),
  reasoning: z.string().min(1).max(5000),
  impact: z.enum(['frontend', 'backend', 'both', 'architecture', 'deployment']),
  urgency: z.enum(['low', 'medium', 'high']).default('medium'),
});

collabRouter.post('/decision', flexAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const body = decisionSchema.parse(req.body);
    const memoryKey = body.workspace.startsWith('client:')
      ? body.workspace
      : `workspace:${body.workspace}`;

    const perm = await checkWorkspacePermission(memoryKey, user.userId, 'propose');
    if (!perm.allowed) {
      return res.status(403).json({ error: perm.reason });
    }

    // Store as a decision entry in the same workspace memory
    const existing = await db.getAIMemoryByKey({ userId: user.userId, memoryKey });
    let contextHistory: unknown[] = [];

    if (existing?.memoryData) {
      try {
        const data = JSON.parse(existing.memoryData);
        contextHistory = Array.isArray(data.history) ? data.history : [];
      } catch { /* fresh start */ }
    }

    const entry = {
      type: 'decision_proposal',
      agent_role: body.role,
      decision: body.decision,
      reasoning: body.reasoning,
      impact: body.impact,
      urgency: body.urgency,
      source: 'rest_api',
      timestamp: new Date().toISOString(),
    };

    contextHistory.push(entry);
    if (contextHistory.length > 100) {
      contextHistory = contextHistory.slice(-100);
    }

    await db.upsertAIMemory({
      userId: user.userId,
      memoryKey,
      data: {
        workspace: body.workspace,
        history: contextHistory,
        last_update: entry,
        updated_at: new Date().toISOString(),
      },
      ttlDays: 30,
    });

    // Auto-heartbeat
    touchAgentHeartbeat(user.userId, memoryKey, body.role);

    logger.info('REST decision proposed', {
      workspace: body.workspace,
      role: body.role,
      impact: body.impact,
    });

    res.json({
      success: true,
      message: `Decision proposed by ${body.role}: ${body.decision.substring(0, 100)}...`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.issues });
    }
    logger.error('Decision failed:', { error });
    res.status(500).json({ error: 'Failed to propose decision' });
  }
});

// ============================================================================
// POST /api/collab/progress — Sync progress (like sync_progress MCP tool)
// ============================================================================

const progressSchema = z.object({
  workspace: z.string().min(1).max(200),
  role: z.string().min(1).max(50),
  completedTasks: z.array(z.string()),
  currentTask: z.string().optional(),
  blockers: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional(),
  filesModified: z.array(z.string()).optional(),
});

collabRouter.post('/progress', flexAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const body = progressSchema.parse(req.body);
    const memoryKey = body.workspace.startsWith('client:')
      ? body.workspace
      : `workspace:${body.workspace}`;

    const perm = await checkWorkspacePermission(memoryKey, user.userId, 'write');
    if (!perm.allowed) {
      return res.status(403).json({ error: perm.reason });
    }

    const existing = await db.getAIMemoryByKey({ userId: user.userId, memoryKey });
    let contextHistory: unknown[] = [];

    if (existing?.memoryData) {
      try {
        const data = JSON.parse(existing.memoryData);
        contextHistory = Array.isArray(data.history) ? data.history : [];
      } catch { /* fresh start */ }
    }

    const entry = {
      type: 'progress_sync',
      agent_role: body.role,
      completed_tasks: body.completedTasks,
      current_task: body.currentTask,
      blockers: body.blockers,
      next_steps: body.nextSteps,
      files_modified: body.filesModified,
      source: 'rest_api',
      timestamp: new Date().toISOString(),
    };

    contextHistory.push(entry);
    if (contextHistory.length > 100) {
      contextHistory = contextHistory.slice(-100);
    }

    await db.upsertAIMemory({
      userId: user.userId,
      memoryKey,
      data: {
        workspace: body.workspace,
        history: contextHistory,
        last_update: entry,
        updated_at: new Date().toISOString(),
      },
      ttlDays: 30,
    });

    // Auto-heartbeat
    touchAgentHeartbeat(user.userId, memoryKey, body.role);

    res.json({
      success: true,
      message: `Progress synced by ${body.role}: ${body.completedTasks.length} tasks completed`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.issues });
    }
    logger.error('Progress sync failed:', { error });
    res.status(500).json({ error: 'Failed to sync progress' });
  }
});

// ============================================================================
// GET /api/collab/status — Workspace overview (all agents' latest status)
// ============================================================================

collabRouter.get('/status', flexAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const workspace = req.query.workspace as string;
    if (!workspace) {
      return res.status(400).json({ error: 'Missing workspace query parameter' });
    }

    const memoryKey = workspace.startsWith('client:')
      ? workspace
      : `workspace:${workspace}`;

    const existing = await db.getAIMemoryByKey({ userId: user.userId, memoryKey });

    if (!existing?.memoryData) {
      return res.json({ workspace, agents: [], decisions: [], lastActivity: null });
    }

    const data = JSON.parse(existing.memoryData);
    const history: any[] = Array.isArray(data.history) ? data.history : [];

    // Extract per-agent latest status
    const agentMap = new Map<string, any>();
    const decisions: any[] = [];

    for (const entry of history) {
      if (entry.agent_role) {
        agentMap.set(entry.agent_role, {
          role: entry.agent_role,
          lastActivity: entry.type,
          lastTask: entry.current_task || entry.decision || entry.completed_tasks?.[0],
          source: entry.source || 'mcp',
          timestamp: entry.timestamp,
        });
      }
      if (entry.type === 'decision_proposal') {
        decisions.push(entry);
      }
    }

    res.json({
      workspace,
      agents: Array.from(agentMap.values()),
      recentDecisions: decisions.slice(-5),
      totalEntries: history.length,
      lastActivity: history[history.length - 1]?.timestamp ?? null,
    });
  } catch (error) {
    logger.error('Status fetch failed:', { error });
    res.status(500).json({ error: 'Failed to fetch workspace status' });
  }
});

// ============================================================================
// POST /api/collab/heartbeat — Agent heartbeat (connection status update)
// ============================================================================

const heartbeatSchema = z.object({
  workspace: z.string().min(1).max(200),
  role: z.string().min(1).max(50),
});

collabRouter.post('/heartbeat', flexAuth, async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const body = heartbeatSchema.parse(req.body);
    const memoryKey = body.workspace.startsWith('client:')
      ? body.workspace
      : `workspace:${body.workspace}`;

    await touchAgentHeartbeat(user.userId, memoryKey, body.role);

    res.json({ success: true, status: 'connected' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.issues });
    }
    logger.error('Heartbeat failed:', { error });
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

export default collabRouter;
