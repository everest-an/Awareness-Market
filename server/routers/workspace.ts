/**
 * Workspace Management tRPC Router
 *
 * Allows users to create workspaces, add agents, set permissions,
 * and generate MCP / REST API configs for each agent.
 *
 * Workspaces are stored in the AiMemory table under a special key prefix,
 * and MCP tokens are created for each workspace.
 */

import { z } from 'zod';
import crypto from 'crypto';
import { router, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import * as db from '../db';
import { createLogger } from '../utils/logger';
import { encryptKey, decryptKey } from '../provider-keys-service';

const logger = createLogger('Workspace');

// ============================================================================
// Schemas
// ============================================================================

const agentSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(50),
  model: z.string().min(1).max(100),
  integration: z.enum(['mcp', 'rest']),
  permissions: z.array(z.enum(['read', 'write', 'propose', 'execute'])).default(['read', 'write']),
  description: z.string().max(500).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  agents: z.array(agentSchema).min(1).max(10),
});

const addAgentSchema = z.object({
  workspaceId: z.string(),
  agent: agentSchema,
});

const updatePermissionsSchema = z.object({
  workspaceId: z.string(),
  agentId: z.string(),
  permissions: z.array(z.enum(['read', 'write', 'propose', 'execute'])),
});

// ============================================================================
// Helpers
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function generateToken(): string {
  return `mcp_collab_${crypto.randomBytes(16).toString('hex')}`;
}

interface WorkspaceAgent {
  id: string;
  name: string;
  role: string;
  model: string;
  integration: 'mcp' | 'rest';
  permissions: string[];
  description?: string;
}

interface WorkspaceData {
  id: string;
  name: string;
  description?: string;
  mcpTokenEncrypted: string;  // AES-256-GCM encrypted token
  mcpTokenMask: string;       // e.g. "mcp_collab_ab12...ef78"
  memoryKey: string;
  agents: WorkspaceAgent[];
  createdAt: string;
  status: 'active' | 'paused' | 'completed';
  /** @deprecated — old field, will be migrated on read */
  mcpToken?: string;
}

/** Decrypt token from workspace, handling legacy plaintext field */
function resolveToken(ws: WorkspaceData): string {
  if (ws.mcpTokenEncrypted) {
    return decryptKey(ws.mcpTokenEncrypted);
  }
  // Legacy migration: if only plaintext field exists
  if (ws.mcpToken) return ws.mcpToken;
  throw new Error('No MCP token stored for this workspace');
}

/** Mask a token for display: first 15 chars + ... + last 4 */
function maskToken(token: string): string {
  if (token.length < 20) return `${token.slice(0, 6)}...`;
  return `${token.substring(0, 15)}...${token.slice(-4)}`;
}

const WORKSPACE_PREFIX = '__workspace:';

// ============================================================================
// Audit logging — persisted to AiMemory under workspace:__audit key
// ============================================================================

interface AuditEntry {
  action: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

async function logWorkspaceAudit(
  userId: number,
  workspaceId: string,
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const memoryKey = `workspace:${workspaceId}:__audit`;
  const entry: AuditEntry = {
    action,
    timestamp: new Date().toISOString(),
    details,
  };

  try {
    const existing = await db.getAIMemoryByKey({ userId, memoryKey });
    let entries: AuditEntry[] = [];

    if (existing?.memoryData) {
      try {
        const data = JSON.parse(existing.memoryData);
        entries = Array.isArray(data.entries) ? data.entries : [];
      } catch { /* fresh start */ }
    }

    entries.push(entry);
    // Keep last 500 audit entries
    if (entries.length > 500) {
      entries = entries.slice(-500);
    }

    await db.upsertAIMemory({
      userId,
      memoryKey,
      data: { entries } as unknown as Record<string, unknown>,
      ttlDays: 365,
    });
  } catch (err) {
    // Audit logging should never break the main flow
    logger.warn('Failed to write audit log', { workspaceId, action, error: err });
  }
}

async function loadWorkspace(
  userId: number,
  workspaceId: string
): Promise<WorkspaceData | null> {
  const mem = await db.getAIMemoryByKey({
    userId,
    memoryKey: `${WORKSPACE_PREFIX}${workspaceId}`,
  });

  if (!mem?.memoryData) return null;

  try {
    return JSON.parse(mem.memoryData) as WorkspaceData;
  } catch {
    return null;
  }
}

async function saveWorkspace(
  userId: number,
  workspace: WorkspaceData
): Promise<void> {
  await db.upsertAIMemory({
    userId,
    memoryKey: `${WORKSPACE_PREFIX}${workspace.id}`,
    data: workspace as unknown as Record<string, unknown>,
    ttlDays: 365,
  });
}

// ============================================================================
// Router
// ============================================================================

export const workspaceRouter = router({
  /**
   * Create a new workspace with agents
   */
  create: protectedProcedure
    .input(createSchema)
    .mutation(async ({ input, ctx }) => {
      const workspaceId = generateId('ws');
      const mcpToken = generateToken();
      const memoryKey = `workspace:${workspaceId}`;

      // Create MCP token in database
      const tokenData = await db.createMcpToken({
        userId: ctx.user.id,
        name: `Workspace: ${input.name}`,
        permissions: ['sync', 'memory', 'collab'],
        expiresInDays: 365,
      });

      const agents: WorkspaceAgent[] = input.agents.map((a) => ({
        id: generateId('agent'),
        name: a.name,
        role: a.role,
        model: a.model,
        integration: a.integration,
        permissions: a.permissions,
        description: a.description,
      }));

      const workspace: WorkspaceData = {
        id: workspaceId,
        name: input.name,
        description: input.description,
        mcpTokenEncrypted: encryptKey(tokenData.token),
        mcpTokenMask: maskToken(tokenData.token),
        memoryKey,
        agents,
        createdAt: new Date().toISOString(),
        status: 'active',
      };

      await saveWorkspace(ctx.user.id, workspace);

      // Also store permissions map for the REST collab API
      const permMap: Record<string, string[]> = {};
      for (const agent of agents) {
        permMap[agent.role] = agent.permissions;
      }
      await db.upsertAIMemory({
        userId: ctx.user.id,
        memoryKey: `${memoryKey}:__permissions`,
        data: permMap,
        ttlDays: 365,
      });

      // Audit log
      await logWorkspaceAudit(ctx.user.id, workspaceId, 'workspace_created', {
        name: input.name,
        agentCount: agents.length,
        agents: agents.map((a) => ({ name: a.name, role: a.role, integration: a.integration })),
      });

      logger.info('Workspace created', {
        workspaceId,
        name: input.name,
        agentCount: agents.length,
      });

      return {
        success: true,
        workspaceId,
        memoryKey,
        tokenPrefix: tokenData.tokenPrefix,
        agents: agents.map((a) => ({ id: a.id, name: a.name, role: a.role })),
      };
    }),

  /**
   * List user's workspaces
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    // Search for workspace memories by prefix
    // AiMemory doesn't have a built-in prefix search, so we use a raw query
    const { prisma } = await import('../db-prisma');

    const mems = await prisma.aiMemory.findMany({
      where: {
        userId: ctx.user.id,
        memoryKey: { startsWith: WORKSPACE_PREFIX },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const workspaces = mems
      .map((m) => {
        try {
          const ws = JSON.parse(m.memoryData) as WorkspaceData;
          return {
            id: ws.id,
            name: ws.name,
            description: ws.description,
            agentCount: ws.agents.length,
            agents: ws.agents.map((a) => ({
              name: a.name,
              role: a.role,
              model: a.model,
              integration: a.integration,
            })),
            status: ws.status,
            createdAt: ws.createdAt,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return { workspaces };
  }),

  /**
   * Get workspace details + generated configs for each agent
   */
  get: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input, ctx }) => {
      const workspace = await loadWorkspace(ctx.user.id, input.workspaceId);

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      // Never expose encrypted or plaintext token in get response
      const { mcpTokenEncrypted, mcpToken: _legacyToken, ...safeWorkspace } = workspace;
      return {
        ...safeWorkspace,
        mcpTokenMask: workspace.mcpTokenMask || maskToken(resolveToken(workspace)),
      };
    }),

  /**
   * Generate configs for all agents in a workspace
   */
  getConfigs: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input, ctx }) => {
      const workspace = await loadWorkspace(ctx.user.id, input.workspaceId);

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      const apiBaseUrl = process.env.VITE_APP_URL || 'https://awareness.market';
      const rawToken = resolveToken(workspace);

      const configs = workspace.agents.map((agent) => {
        if (agent.integration === 'mcp') {
          return {
            agentId: agent.id,
            agentName: agent.name,
            role: agent.role,
            model: agent.model,
            integration: 'mcp' as const,
            config: {
              mcpServers: {
                [`awareness-collab-${workspace.id}`]: {
                  command: 'node',
                  args: ['./mcp-server/dist/index-collaboration.js'],
                  env: {
                    VITE_APP_URL: apiBaseUrl,
                    MCP_COLLABORATION_TOKEN: rawToken,
                    AGENT_ROLE: agent.role,
                    PROJECT_ID: workspace.id,
                    PROJECT_NAME: workspace.name,
                    MEMORY_KEY: workspace.memoryKey,
                    AGENT_PERMISSIONS: JSON.stringify(agent.permissions),
                  },
                  description: `${workspace.name} — ${agent.name} (${agent.role})`,
                  autoApprove: [
                    'share_reasoning',
                    'get_other_agent_context',
                    'sync_progress',
                  ],
                },
              },
            },
          };
        } else {
          return {
            agentId: agent.id,
            agentName: agent.name,
            role: agent.role,
            model: agent.model,
            integration: 'rest' as const,
            config: {
              baseUrl: `${apiBaseUrl}/api/collab`,
              headers: {
                'X-MCP-Token': rawToken,
                'Content-Type': 'application/json',
              },
              examples: {
                share: {
                  method: 'POST',
                  url: `${apiBaseUrl}/api/collab/share`,
                  body: {
                    workspace: workspace.memoryKey,
                    role: agent.role,
                    task: 'Describe what you are working on',
                    reasoning: 'Your reasoning and decisions',
                  },
                },
                getContext: {
                  method: 'GET',
                  url: `${apiBaseUrl}/api/collab/context?workspace=${encodeURIComponent(workspace.memoryKey)}`,
                },
                status: {
                  method: 'GET',
                  url: `${apiBaseUrl}/api/collab/status?workspace=${encodeURIComponent(workspace.memoryKey)}`,
                },
              },
              curlShare: [
                `curl -X POST ${apiBaseUrl}/api/collab/share \\`,
                `  -H "X-MCP-Token: ${rawToken}" \\`,
                `  -H "Content-Type: application/json" \\`,
                `  -d '{"workspace":"${workspace.memoryKey}","role":"${agent.role}","task":"Built login page","reasoning":"Used shadcn/ui form components..."}'`,
              ].join('\n'),
              curlContext: [
                `curl "${apiBaseUrl}/api/collab/context?workspace=${encodeURIComponent(workspace.memoryKey)}" \\`,
                `  -H "X-MCP-Token: ${rawToken}"`,
              ].join('\n'),
            },
          };
        }
      });

      return { workspaceId: workspace.id, name: workspace.name, configs };
    }),

  /**
   * Add an agent to a workspace
   */
  addAgent: protectedProcedure
    .input(addAgentSchema)
    .mutation(async ({ input, ctx }) => {
      const workspace = await loadWorkspace(ctx.user.id, input.workspaceId);

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      if (workspace.agents.length >= 10) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Maximum 10 agents per workspace',
        });
      }

      const newAgent: WorkspaceAgent = {
        id: generateId('agent'),
        name: input.agent.name,
        role: input.agent.role,
        model: input.agent.model,
        integration: input.agent.integration,
        permissions: input.agent.permissions,
        description: input.agent.description,
      };

      workspace.agents.push(newAgent);
      await saveWorkspace(ctx.user.id, workspace);

      // Update permissions map
      const permMap: Record<string, string[]> = {};
      for (const agent of workspace.agents) {
        permMap[agent.role] = agent.permissions;
      }
      await db.upsertAIMemory({
        userId: ctx.user.id,
        memoryKey: `${workspace.memoryKey}:__permissions`,
        data: permMap,
        ttlDays: 365,
      });

      await logWorkspaceAudit(ctx.user.id, input.workspaceId, 'agent_added', {
        agentName: newAgent.name,
        role: newAgent.role,
        integration: newAgent.integration,
      });

      return { success: true, agent: newAgent };
    }),

  /**
   * Remove an agent from a workspace
   */
  removeAgent: protectedProcedure
    .input(z.object({ workspaceId: z.string(), agentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const workspace = await loadWorkspace(ctx.user.id, input.workspaceId);

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      const idx = workspace.agents.findIndex((a) => a.id === input.agentId);
      if (idx === -1) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      }

      const removed = workspace.agents[idx];
      workspace.agents.splice(idx, 1);
      await saveWorkspace(ctx.user.id, workspace);

      await logWorkspaceAudit(ctx.user.id, input.workspaceId, 'agent_removed', {
        agentName: removed.name,
        role: removed.role,
      });

      return { success: true };
    }),

  /**
   * Update agent permissions
   */
  updatePermissions: protectedProcedure
    .input(updatePermissionsSchema)
    .mutation(async ({ input, ctx }) => {
      const workspace = await loadWorkspace(ctx.user.id, input.workspaceId);

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      const agent = workspace.agents.find((a) => a.id === input.agentId);
      if (!agent) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      }

      agent.permissions = input.permissions;
      await saveWorkspace(ctx.user.id, workspace);

      // Update permissions map
      const permMap: Record<string, string[]> = {};
      for (const a of workspace.agents) {
        permMap[a.role] = a.permissions;
      }
      await db.upsertAIMemory({
        userId: ctx.user.id,
        memoryKey: `${workspace.memoryKey}:__permissions`,
        data: permMap,
        ttlDays: 365,
      });

      await logWorkspaceAudit(ctx.user.id, input.workspaceId, 'permissions_updated', {
        agentId: input.agentId,
        newPermissions: input.permissions,
      });

      return { success: true, agent: { id: agent.id, permissions: agent.permissions } };
    }),

  /**
   * Delete a workspace and its associated data
   */
  delete: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const workspace = await loadWorkspace(ctx.user.id, input.workspaceId);

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      const { prisma } = await import('../db-prisma');

      // 1. Delete the workspace memory blob
      await prisma.aiMemory.deleteMany({
        where: {
          userId: ctx.user.id,
          memoryKey: `${WORKSPACE_PREFIX}${workspace.id}`,
        },
      });

      // 2. Delete the permissions memory blob
      await prisma.aiMemory.deleteMany({
        where: {
          userId: ctx.user.id,
          memoryKey: `${workspace.memoryKey}:__permissions`,
        },
      });

      // 3. Delete the collaboration history memory blob
      await prisma.aiMemory.deleteMany({
        where: {
          userId: ctx.user.id,
          memoryKey: workspace.memoryKey,
        },
      });

      // 4. Deactivate the MCP token (don't hard-delete, for audit trail)
      try {
        const rawToken = resolveToken(workspace);
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        await prisma.mcpToken.updateMany({
          where: { tokenHash, userId: ctx.user.id },
          data: { isActive: false },
        });
      } catch {
        // Token may already be invalid — not critical
      }

      // Audit log (write to a separate key since workspace blob is gone)
      await logWorkspaceAudit(ctx.user.id, workspace.id, 'workspace_deleted', {
        name: workspace.name,
      });

      logger.info('Workspace deleted', { workspaceId: workspace.id, name: workspace.name });

      return { success: true };
    }),

  /**
   * Update workspace status (active/paused/completed)
   */
  updateStatus: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      status: z.enum(['active', 'paused', 'completed']),
    }))
    .mutation(async ({ input, ctx }) => {
      const workspace = await loadWorkspace(ctx.user.id, input.workspaceId);

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      workspace.status = input.status;
      await saveWorkspace(ctx.user.id, workspace);

      await logWorkspaceAudit(ctx.user.id, workspace.id, 'status_changed', {
        newStatus: input.status,
      });

      logger.info('Workspace status updated', {
        workspaceId: workspace.id,
        status: input.status,
      });

      return { success: true, status: input.status };
    }),

  /**
   * Rotate the MCP token for a workspace (invalidate old, issue new)
   */
  rotateToken: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const workspace = await loadWorkspace(ctx.user.id, input.workspaceId);

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      const { prisma } = await import('../db-prisma');

      // 1. Deactivate old token
      try {
        const oldToken = resolveToken(workspace);
        const oldHash = crypto.createHash('sha256').update(oldToken).digest('hex');
        await prisma.mcpToken.updateMany({
          where: { tokenHash: oldHash, userId: ctx.user.id },
          data: { isActive: false },
        });
      } catch {
        // Old token may already be invalid
      }

      // 2. Create new MCP token
      const newTokenData = await db.createMcpToken({
        userId: ctx.user.id,
        name: `Workspace: ${workspace.name} (rotated)`,
        permissions: ['sync', 'memory', 'collab'],
        expiresInDays: 365,
      });

      // 3. Update workspace with encrypted new token
      workspace.mcpTokenEncrypted = encryptKey(newTokenData.token);
      workspace.mcpTokenMask = maskToken(newTokenData.token);
      delete workspace.mcpToken; // Remove legacy field if present
      await saveWorkspace(ctx.user.id, workspace);

      // 4. Log the rotation
      await logWorkspaceAudit(ctx.user.id, workspace.id, 'token_rotated', {
        oldTokenPrefix: workspace.mcpTokenMask,
        newTokenPrefix: newTokenData.tokenPrefix,
      });

      logger.info('Workspace token rotated', {
        workspaceId: workspace.id,
        newPrefix: newTokenData.tokenPrefix,
      });

      return {
        success: true,
        mcpTokenMask: maskToken(newTokenData.token),
        message: 'Token rotated. All agents must update their configs with the new token.',
      };
    }),

  /**
   * Get audit log for a workspace
   */
  getAuditLog: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const workspace = await loadWorkspace(ctx.user.id, input.workspaceId);

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      const auditMem = await db.getAIMemoryByKey({
        userId: ctx.user.id,
        memoryKey: `${workspace.memoryKey}:__audit`,
      });

      if (!auditMem?.memoryData) {
        return { entries: [] };
      }

      try {
        const data = JSON.parse(auditMem.memoryData);
        const entries = Array.isArray(data.entries) ? data.entries.slice(-input.limit) : [];
        return { entries };
      } catch {
        return { entries: [] };
      }
    }),
});
