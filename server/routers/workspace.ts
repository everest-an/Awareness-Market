/**
 * Workspace Management tRPC Router
 *
 * Allows users to create workspaces, add agents, set permissions,
 * and generate MCP / REST API configs for each agent.
 *
 * Uses dedicated Workspace + WorkspaceAgent Prisma tables.
 * MCP tokens are AES-256-GCM encrypted at rest.
 */

import { z } from 'zod';
import crypto from 'crypto';
import { router, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import * as db from '../db';
import { prisma } from '../db-prisma';
import { createLogger } from '../utils/logger';
import { encryptKey, decryptKey } from '../provider-keys-service';

const logger = createLogger('Workspace');

// After adding Workspace/WorkspaceAgent models to schema.prisma, run:
//   npx prisma generate && npx prisma migrate dev --name add-workspaces
// The `orm` alias provides runtime access to the new tables before
// the generated client types are available.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const orm = prisma as any;

// ============================================================================
// Schemas
// ============================================================================

const agentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(100),
  role: z.string().min(1, 'Agent role is required').max(50),
  model: z.string().min(1, 'Model is required').max(100),
  integration: z.enum(['mcp', 'rest']),
  permissions: z.array(z.enum(['read', 'write', 'propose', 'execute'])).min(1, 'At least one permission required').default(['read', 'write']),
  description: z.string().max(500).optional(),
});

const createSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(200).trim(),
  description: z.string().max(1000).optional(),
  agents: z.array(agentSchema).min(1, 'At least one agent is required').max(10),
});

const addAgentSchema = z.object({
  workspaceId: z.string().min(1),
  agent: agentSchema,
});

const updatePermissionsSchema = z.object({
  workspaceId: z.string().min(1),
  agentId: z.string().min(1),
  permissions: z.array(z.enum(['read', 'write', 'propose', 'execute'])).min(1, 'At least one permission required'),
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

/** Decrypt token from workspace */
function resolveToken(encrypted: string): string {
  return decryptKey(encrypted);
}

/** Mask a token for display: first 15 chars + ... + last 4 */
function maskToken(token: string): string {
  if (token.length < 20) return `${token.slice(0, 6)}...`;
  return `${token.substring(0, 15)}...${token.slice(-4)}`;
}

// Type shapes for orm results (before prisma generate creates real types)
interface WsRecord {
  id: string;
  userId: number;
  name: string;
  description: string | null;
  status: string;
  mcpTokenEncrypted: string;
  mcpTokenMask: string;
  memoryKey: string;
  createdAt: Date;
  updatedAt: Date;
  agents: AgentRecord[];
}

interface AgentRecord {
  id: string;
  workspaceId: string;
  name: string;
  role: string;
  model: string;
  integration: string;
  permissions: string[];
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Audit logging — persisted to AiMemory under workspace:{id}:__audit key
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
    logger.warn('Failed to write audit log', { workspaceId, action, error: err });
  }
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

      // Create workspace in dedicated table
      const workspace: WsRecord = await orm.workspace.create({
        data: {
          id: workspaceId,
          userId: ctx.user.id,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          mcpTokenEncrypted: encryptKey(tokenData.token),
          mcpTokenMask: maskToken(tokenData.token),
          memoryKey,
          agents: {
            create: input.agents.map((a) => ({
              id: generateId('agent'),
              name: a.name.trim(),
              role: a.role,
              model: a.model,
              integration: a.integration,
              permissions: a.permissions,
              description: a.description?.trim() || null,
            })),
          },
        },
        include: { agents: true },
      });

      // Store permissions map for the REST collab API
      const permMap: Record<string, string[]> = {};
      for (const agent of workspace.agents as AgentRecord[]) {
        permMap[agent.role] = agent.permissions;
      }
      await db.upsertAIMemory({
        userId: ctx.user.id,
        memoryKey: `${memoryKey}:__permissions`,
        data: permMap,
        ttlDays: 365,
      });

      await logWorkspaceAudit(ctx.user.id, workspaceId, 'workspace_created', {
        name: input.name,
        agentCount: workspace.agents.length,
        agents: (workspace.agents as AgentRecord[]).map((a) => ({ name: a.name, role: a.role, integration: a.integration })),
      });

      logger.info('Workspace created', {
        workspaceId,
        name: input.name,
        agentCount: workspace.agents.length,
      });

      return {
        success: true,
        workspaceId,
        memoryKey,
        tokenPrefix: tokenData.tokenPrefix,
        agents: (workspace.agents as AgentRecord[]).map((a) => ({ id: a.id, name: a.name, role: a.role })),
      };
    }),

  /**
   * List user's workspaces with cursor-based pagination
   */
  list: protectedProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }).optional())
    .query(async ({ input, ctx }) => {
      const limit = input?.limit ?? 20;
      const cursor = input?.cursor;

      const workspaces: WsRecord[] = await orm.workspace.findMany({
        where: { userId: ctx.user.id },
        include: {
          agents: {
            select: {
              name: true,
              role: true,
              model: true,
              integration: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (workspaces.length > limit) {
        const next = workspaces.pop();
        nextCursor = next?.id;
      }

      return {
        workspaces: workspaces.map((ws: WsRecord) => ({
          id: ws.id,
          name: ws.name,
          description: ws.description,
          agentCount: ws.agents.length,
          agents: ws.agents,
          status: ws.status,
          createdAt: ws.createdAt.toISOString(),
        })),
        nextCursor,
      };
    }),

  /**
   * Get workspace details
   */
  get: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input, ctx }) => {
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
        include: { agents: true },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      return {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        mcpTokenMask: workspace.mcpTokenMask,
        memoryKey: workspace.memoryKey,
        agents: workspace.agents.map((a: AgentRecord) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          model: a.model,
          integration: a.integration,
          permissions: a.permissions,
          description: a.description,
        })),
        createdAt: workspace.createdAt.toISOString(),
        status: workspace.status,
      };
    }),

  /**
   * Generate configs for all agents in a workspace
   */
  getConfigs: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input, ctx }) => {
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
        include: { agents: true },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      const apiBaseUrl = process.env.VITE_APP_URL || 'https://awareness.market';
      const rawToken = resolveToken(workspace.mcpTokenEncrypted);

      const configs = workspace.agents.map((agent: AgentRecord) => {
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
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
        include: { agents: true },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      if (workspace.agents.length >= 10) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Maximum 10 agents per workspace',
        });
      }

      const newAgent: AgentRecord = await orm.workspaceAgent.create({
        data: {
          id: generateId('agent'),
          workspaceId: workspace.id,
          name: input.agent.name.trim(),
          role: input.agent.role,
          model: input.agent.model,
          integration: input.agent.integration,
          permissions: input.agent.permissions,
          description: input.agent.description?.trim() || null,
        },
      });

      // Update permissions map
      const allAgents: AgentRecord[] = await orm.workspaceAgent.findMany({
        where: { workspaceId: workspace.id },
      });
      const permMap: Record<string, string[]> = {};
      for (const a of allAgents) {
        permMap[a.role] = a.permissions;
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
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      const agent: AgentRecord | null = await orm.workspaceAgent.findFirst({
        where: { id: input.agentId, workspaceId: workspace.id },
      });

      if (!agent) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      }

      await orm.workspaceAgent.delete({ where: { id: input.agentId } });

      await logWorkspaceAudit(ctx.user.id, input.workspaceId, 'agent_removed', {
        agentName: agent.name,
        role: agent.role,
      });

      return { success: true };
    }),

  /**
   * Update agent permissions
   */
  updatePermissions: protectedProcedure
    .input(updatePermissionsSchema)
    .mutation(async ({ input, ctx }) => {
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      const agent: AgentRecord | null = await orm.workspaceAgent.findFirst({
        where: { id: input.agentId, workspaceId: workspace.id },
      });

      if (!agent) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      }

      await orm.workspaceAgent.update({
        where: { id: input.agentId },
        data: { permissions: input.permissions },
      });

      // Update permissions map
      const allAgents: AgentRecord[] = await orm.workspaceAgent.findMany({
        where: { workspaceId: workspace.id },
      });
      const permMap: Record<string, string[]> = {};
      for (const a of allAgents) {
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

      return { success: true, agent: { id: agent.id, permissions: input.permissions } };
    }),

  /**
   * Delete a workspace and its associated data
   */
  delete: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      // 1. Deactivate the MCP token
      try {
        const rawToken = resolveToken(workspace.mcpTokenEncrypted);
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        await prisma.mcpToken.updateMany({
          where: { tokenHash, userId: ctx.user.id },
          data: { isActive: false },
        });
      } catch {
        // Token may already be invalid
      }

      // 2. Delete workspace (cascades to agents via onDelete: Cascade)
      await orm.workspace.delete({ where: { id: workspace.id } });

      // 3. Clean up AiMemory blobs (permissions, collaboration history, audit)
      await prisma.aiMemory.deleteMany({
        where: {
          userId: ctx.user.id,
          memoryKey: { startsWith: `workspace:${workspace.id}` },
        },
      });

      // Audit log (write after deletion for audit trail)
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
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      await orm.workspace.update({
        where: { id: workspace.id },
        data: { status: input.status },
      });

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
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      // 1. Deactivate old token
      try {
        const oldToken = resolveToken(workspace.mcpTokenEncrypted);
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
      const newMask = maskToken(newTokenData.token);
      await orm.workspace.update({
        where: { id: workspace.id },
        data: {
          mcpTokenEncrypted: encryptKey(newTokenData.token),
          mcpTokenMask: newMask,
        },
      });

      await logWorkspaceAudit(ctx.user.id, workspace.id, 'token_rotated', {
        newTokenPrefix: newTokenData.tokenPrefix,
      });

      logger.info('Workspace token rotated', {
        workspaceId: workspace.id,
        newPrefix: newTokenData.tokenPrefix,
      });

      return {
        success: true,
        mcpTokenMask: newMask,
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
      // Verify ownership
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
        select: { id: true, memoryKey: true },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      const auditMem = await db.getAIMemoryByKey({
        userId: ctx.user.id,
        memoryKey: `workspace:${workspace.id}:__audit`,
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

  /**
   * Get workspace status — agent activity, recent decisions, conflicts
   * (Used by DevDashboard and CLI `awareness status`)
   */
  getStatus: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input, ctx }) => {
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
        include: { agents: true },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      // Read collaboration history from AiMemory
      const historyMem = await db.getAIMemoryByKey({
        userId: ctx.user.id,
        memoryKey: `${workspace.memoryKey}:__collab_history`,
      });

      let recentContext: Array<{ agent: string; agentRole: string; content: string; timestamp: string }> = [];
      let decisions: Array<{ proposal: string; proposedBy: string; status: string; timestamp: string }> = [];
      let agentActivity: Record<string, { lastSeen: string; lastContext: string }> = {};

      if (historyMem?.memoryData) {
        try {
          const data = JSON.parse(historyMem.memoryData);
          // Extract context entries
          if (Array.isArray(data.entries)) {
            recentContext = data.entries
              .filter((e: any) => e.type === 'share' || e.reasoning)
              .slice(-20)
              .map((e: any) => ({
                agent: e.agentName || e.agent || 'unknown',
                agentRole: e.agentRole || e.role || 'unknown',
                content: e.reasoning || e.task || e.content || '',
                timestamp: e.timestamp || e.createdAt || '',
              }));
          }
          // Extract decisions
          if (Array.isArray(data.decisions)) {
            decisions = data.decisions.slice(-10).map((d: any) => ({
              proposal: d.proposal || d.decision || d.content || '',
              proposedBy: d.proposedBy || d.agent || 'unknown',
              status: d.status || 'pending',
              timestamp: d.timestamp || '',
            }));
          }
          // Extract per-agent last activity
          if (data.agentActivity && typeof data.agentActivity === 'object') {
            agentActivity = data.agentActivity;
          }
        } catch { /* corrupted data, return empty */ }
      }

      // Also check individual agent context keys
      const agents = workspace.agents.map((a: AgentRecord) => {
        const activity = agentActivity[a.role] || agentActivity[a.name];
        return {
          id: a.id,
          name: a.name,
          role: a.role,
          model: a.model,
          integration: a.integration,
          permissions: a.permissions,
          lastSeen: activity?.lastSeen || null,
          lastContext: activity?.lastContext || null,
        };
      });

      return {
        workspaceId: workspace.id,
        name: workspace.name,
        status: workspace.status,
        agents,
        recentContext,
        decisions,
        conflicts: [], // Placeholder — conflict detection can read from memory governance
      };
    }),

  /**
   * Get context timeline for a workspace (paginated)
   * (Used by DevDashboard context panel)
   */
  getContext: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
        select: { id: true, memoryKey: true },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      // Read all AiMemory entries for this workspace's collab history
      const historyMem = await db.getAIMemoryByKey({
        userId: ctx.user.id,
        memoryKey: `${workspace.memoryKey}:__collab_history`,
      });

      let allEntries: Array<{ agent: string; role: string; content: string; type: string; timestamp: string }> = [];

      if (historyMem?.memoryData) {
        try {
          const data = JSON.parse(historyMem.memoryData);
          if (Array.isArray(data.entries)) {
            allEntries = data.entries.map((e: any) => ({
              agent: e.agentName || e.agent || 'unknown',
              role: e.agentRole || e.role || 'unknown',
              content: e.reasoning || e.task || e.content || e.progress || '',
              type: e.type || 'context',
              timestamp: e.timestamp || e.createdAt || '',
            }));
          }
        } catch { /* return empty */ }
      }

      // Sort newest first
      allEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const paginated = allEntries.slice(input.offset, input.offset + input.limit);

      return {
        entries: paginated,
        total: allEntries.length,
        hasMore: input.offset + input.limit < allEntries.length,
      };
    }),

  /**
   * Generate session resume markdown
   * (Used by DevDashboard "Resume Session" button and CLI `awareness resume`)
   */
  generateResume: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input, ctx }) => {
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
        include: { agents: true },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      // Get project brain
      let brain: any = null;
      const brainMem = await db.getAIMemoryByKey({
        userId: ctx.user.id,
        memoryKey: `${workspace.memoryKey}:project-brain`,
      });
      if (brainMem?.memoryData) {
        try { brain = JSON.parse(brainMem.memoryData); } catch { /* ignore */ }
      }

      // Get collab history
      let entries: any[] = [];
      let decisions: any[] = [];
      const historyMem = await db.getAIMemoryByKey({
        userId: ctx.user.id,
        memoryKey: `${workspace.memoryKey}:__collab_history`,
      });
      if (historyMem?.memoryData) {
        try {
          const data = JSON.parse(historyMem.memoryData);
          entries = Array.isArray(data.entries) ? data.entries.slice(-15) : [];
          decisions = Array.isArray(data.decisions) ? data.decisions.slice(-5) : [];
        } catch { /* ignore */ }
      }

      // Build markdown
      const lines: string[] = [];
      const today = new Date().toISOString().split('T')[0];

      lines.push(`## Session Resume - ${workspace.name}`);
      lines.push(`**Date**: ${today}`);
      lines.push('');

      // Stack info from brain
      if (brain?.stack) {
        const stack = Array.isArray(brain.stack) ? brain.stack.join(' + ') : brain.stack;
        lines.push(`**Stack**: ${stack}`);
        if (brain.databaseType) lines.push(`**Database**: ${brain.databaseType}`);
        lines.push('');
      }

      // What happened
      const contextEntries = entries.filter((e: any) => e.reasoning || e.task || e.content);
      if (contextEntries.length > 0) {
        lines.push('### What happened:');
        for (const entry of contextEntries.slice(-10)) {
          const agent = entry.agentRole || entry.agent || 'Agent';
          const text = entry.reasoning || entry.task || entry.content || '';
          if (text) lines.push(`- **${agent}**: ${text}`);
        }
        lines.push('');
      }

      // Decisions
      if (decisions.length > 0) {
        lines.push('### Decisions:');
        for (const dec of decisions) {
          const text = dec.proposal || dec.decision || dec.content || '';
          const status = dec.status || 'pending';
          const by = dec.proposedBy || dec.agent || 'unknown';
          lines.push(`- ${text} (${status}, by ${by})`);
        }
        lines.push('');
      }

      // Active agents
      const agents = workspace.agents as AgentRecord[];
      if (agents.length > 0) {
        lines.push('### Active agents:');
        for (const a of agents) {
          lines.push(`- **${a.name}** (${a.role}) — ${a.model}`);
        }
        lines.push('');
      }

      lines.push('### Instructions:');
      lines.push('Continue from where the team left off. Check the decisions above and coordinate with other agents through Awareness.');

      return { markdown: lines.join('\n') };
    }),
});
