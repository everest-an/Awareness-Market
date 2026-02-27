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
  integration: z.enum(['mcp', 'rest', 'windows_mcp']),
  permissions: z.array(z.enum(['read', 'write', 'propose', 'execute'])).min(1, 'At least one permission required').default(['read', 'write']),
  description: z.string().max(500).optional(),
  goal: z.string().max(500).optional(),
  backstory: z.string().max(5000).optional(),
  tools: z.array(z.string().max(50)).max(20).default([]),
  priority: z.number().int().min(1).max(10).default(5),
  endpoint: z.string().url().max(512).optional().or(z.literal('')),
  config: z.record(z.string(), z.string().max(2000)).refine(obj => Object.keys(obj).length <= 50, { message: 'Config limited to 50 keys' }).optional(),
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
  goal: string | null;
  backstory: string | null;
  tools: string[];
  priority: number;
  endpoint: string | null;
  authTokenEnc: string | null;
  connectionStatus: string;
  lastSeenAt: Date | null;
  config: Record<string, unknown> | null;
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
      // Pre-flight: check that workspace tables exist
      try {
        const tableCheck: any[] = await prisma.$queryRawUnsafe(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces'`,
        );
        if (tableCheck.length === 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Workspace tables not found in database. Please run database migrations first: npx tsx scripts/run-migrations.ts',
          });
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logger.error('Failed to check workspace table existence', { error: err });
      }

      const workspaceId = generateId('ws');
      const memoryKey = `workspace:${workspaceId}`;
      // Note: generateToken() was previously called here but unused;
      // the actual token comes from db.createMcpToken() below.

      // Create MCP token in database
      const tokenData = await db.createMcpToken({
        userId: ctx.user.id,
        name: `Workspace: ${input.name}`,
        permissions: ['read', 'write', 'propose'],
        expiresInDays: 365,
      });

      // Create workspace in dedicated table
      let workspace: WsRecord;
      try {
        workspace = await orm.workspace.create({
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
                goal: a.goal?.trim() || null,
                backstory: a.backstory?.trim() || null,
                tools: a.tools || [],
                priority: a.priority ?? 5,
                endpoint: a.endpoint || null,
                config: a.config || null,
              })),
            },
          },
          include: { agents: true },
        });
      } catch (dbErr: any) {
        logger.error('Failed to create workspace in database', { error: dbErr.message, workspaceId });
        const msg = dbErr.message?.includes('does not exist')
          ? 'Workspace database tables not found. Run migrations: npx tsx scripts/run-migrations.ts'
          : dbErr.message?.includes('Unique constraint')
            ? 'A workspace with this configuration already exists'
            : `Failed to create workspace: ${dbErr.message?.substring(0, 100)}`;
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg });
      }

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
        mcpToken: tokenData.token,
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

      let workspaces: WsRecord[];
      try {
        workspaces = await orm.workspace.findMany({
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
      } catch (dbErr: any) {
        if (dbErr.message?.includes('does not exist') || dbErr.message?.includes('relation')) {
          logger.warn('Workspace tables not found — returning empty list');
          return { workspaces: [], nextCursor: undefined };
        }
        throw dbErr;
      }

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
          goal: a.goal,
          backstory: a.backstory,
          tools: a.tools || [],
          priority: a.priority ?? 5,
          endpoint: a.endpoint,
          connectionStatus: a.connectionStatus || 'disconnected',
          lastSeenAt: a.lastSeenAt?.toISOString() || null,
          config: a.config,
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

      const apiBaseUrl = process.env.BASE_URL || 'https://api.awareness.market';
      const rawToken = resolveToken(workspace.mcpTokenEncrypted);

      // Cloud MCP server URL (no local process needed)
      const mcpCloudUrl = `${apiBaseUrl}/mcp`;

      const configs = workspace.agents.map((agent: AgentRecord) => {
        if (agent.integration === 'mcp' || agent.integration === 'windows_mcp') {
          return {
            agentId: agent.id,
            agentName: agent.name,
            role: agent.role,
            model: agent.model,
            integration: 'mcp' as const,
            config: {
              // Cloud MCP — recommended (no local process needed)
              mcpServers: {
                [`awareness-collab-${workspace.id}`]: {
                  type: 'streamable-http',
                  url: mcpCloudUrl,
                  headers: {
                    'Authorization': `Bearer ${rawToken}`,
                    'X-Agent-Role': agent.role,
                    'X-Workspace-Key': workspace.memoryKey,
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
          goal: input.agent.goal?.trim() || null,
          backstory: input.agent.backstory?.trim() || null,
          tools: input.agent.tools || [],
          priority: input.agent.priority ?? 5,
          endpoint: input.agent.endpoint || null,
          config: input.agent.config || null,
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
        permissions: ['read', 'write', 'propose'],
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
      // The collab REST API writes to `workspace:${id}` memoryKey with { history: [...] } format
      const historyMem = await db.getAIMemoryByKey({
        userId: ctx.user.id,
        memoryKey: workspace.memoryKey,
      });

      let recentContext: Array<{ agent: string; agentRole: string; content: string; timestamp: string }> = [];
      let decisions: Array<{ proposal: string; proposedBy: string; status: string; timestamp: string }> = [];
      let agentActivity: Record<string, { lastSeen: string; lastContext: string }> = {};

      if (historyMem?.memoryData) {
        try {
          const data = JSON.parse(historyMem.memoryData);
          // Collab REST API stores as { history: [...] }, also check entries for compatibility
          const historyArray = Array.isArray(data.history) ? data.history : Array.isArray(data.entries) ? data.entries : [];

          // Extract context entries (share, progress_sync, reasoning_update)
          recentContext = historyArray
            .filter((e: any) => e.type === 'share' || e.type === 'progress_sync' || e.type === 'reasoning_update' || e.reasoning)
            .slice(-20)
            .map((e: any) => ({
              agent: e.agentName || e.agent || e.agent_role || 'unknown',
              agentRole: e.agentRole || e.agent_role || e.role || 'unknown',
              content: e.reasoning || e.current_task || e.task || e.content || (e.completed_tasks ? `Completed: ${e.completed_tasks.join(', ')}` : ''),
              timestamp: e.timestamp || e.createdAt || '',
            }));

          // Extract decisions (decision_proposal type)
          decisions = historyArray
            .filter((e: any) => e.type === 'decision_proposal')
            .slice(-10)
            .map((d: any) => ({
              proposal: d.decision || d.proposal || d.content || '',
              proposedBy: d.agent_role || d.proposedBy || d.agent || 'unknown',
              status: d.status || 'pending',
              timestamp: d.timestamp || '',
            }));

          // Also check dedicated decisions/agentActivity keys
          if (Array.isArray(data.decisions)) {
            for (const d of data.decisions) {
              decisions.push({
                proposal: d.proposal || d.decision || d.content || '',
                proposedBy: d.proposedBy || d.agent || 'unknown',
                status: d.status || 'pending',
                timestamp: d.timestamp || '',
              });
            }
          }

          // Build per-agent last activity from history
          for (const entry of historyArray) {
            const role = entry.agent_role || entry.agentRole || entry.role;
            if (role && entry.timestamp) {
              const existing = agentActivity[role];
              if (!existing || new Date(entry.timestamp) > new Date(existing.lastSeen)) {
                agentActivity[role] = {
                  lastSeen: entry.timestamp,
                  lastContext: entry.reasoning || entry.current_task || entry.task || '',
                };
              }
            }
          }
          if (data.agentActivity && typeof data.agentActivity === 'object') {
            Object.assign(agentActivity, data.agentActivity);
          }
        } catch { /* corrupted data, return empty */ }
      }

      // Also check individual agent context keys
      const agents = workspace.agents.map((a: AgentRecord) => {
        const activity = agentActivity[a.role] || agentActivity[a.name];
        // Determine connection status based on lastSeenAt
        let connStatus = a.connectionStatus || 'disconnected';
        if (a.lastSeenAt) {
          const ageMs = Date.now() - new Date(a.lastSeenAt).getTime();
          if (ageMs < 90_000) connStatus = 'connected'; // within 90s
          else if (ageMs < 300_000) connStatus = 'idle'; // within 5min
          else connStatus = 'disconnected';
        }
        return {
          id: a.id,
          name: a.name,
          role: a.role,
          model: a.model,
          integration: a.integration,
          permissions: a.permissions,
          goal: a.goal,
          priority: a.priority ?? 5,
          connectionStatus: connStatus,
          lastSeen: a.lastSeenAt?.toISOString() || activity?.lastSeen || null,
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

      // Read collab history — the REST API stores at workspace.memoryKey with { history: [...] }
      const historyMem = await db.getAIMemoryByKey({
        userId: ctx.user.id,
        memoryKey: workspace.memoryKey,
      });

      let allEntries: Array<{ agent: string; role: string; content: string; type: string; timestamp: string }> = [];

      // Detect mojibake — high ratio of C1 control chars or replacement chars
      const isMojibake = (s: string): boolean => {
        if (!s || s.length < 5) return false;
        const suspicious = s.replace(/[\x20-\x7E\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF\n\r\t]/g, '');
        return suspicious.length > s.length * 0.3;
      };

      // Strip mojibake sequences from a string, keeping valid chars
      const cleanText = (s: string): string => {
        if (!s) return s;
        return s.replace(/[\x80-\x9F\uFFFD]/g, '').replace(/�+/g, '').trim();
      };

      if (historyMem?.memoryData) {
        try {
          const data = JSON.parse(historyMem.memoryData);
          const historyArray = Array.isArray(data.history) ? data.history : Array.isArray(data.entries) ? data.entries : [];
          allEntries = historyArray.map((e: any) => {
            // Build content based on entry type so no timeline entry is blank
            let rawContent = '';
            switch (e.type) {
              case 'task_assigned':
                rawContent = `Task: ${e.task_title || 'Untitled'}` + (e.assigned_to ? ` → ${e.assigned_to}` : '') + (e.priority ? ` [${e.priority}]` : '');
                break;
              case 'task_updated':
                rawContent = `Task: ${e.task_title || e.task_id || 'Untitled'}` + (e.new_status ? ` — ${e.new_status}` : '') + (e.result_summary ? `: ${e.result_summary}` : '');
                break;
              case 'artifact_shared':
                rawContent = `Artifact: ${e.artifact_name || 'Unnamed'}` + (e.artifact_type ? ` (${e.artifact_type})` : '') + (e.message ? ` — ${e.message}` : '');
                break;
              case 'question':
                rawContent = e.question || e.content || '';
                break;
              case 'decision_proposal':
                rawContent = e.decision || e.reasoning || '';
                break;
              case 'progress_sync':
                rawContent = (Array.isArray(e.completed_tasks) ? `Completed: ${e.completed_tasks.join(', ')}` : '')
                  + (Array.isArray(e.next_steps) ? ` | Next: ${e.next_steps.join(', ')}` : (e.next_steps || ''))
                  + (e.progress || '');
                break;
              case 'session_summary':
                rawContent = `📋 Summary (${e.entries_compacted || 0} entries compacted): ${e.summary || ''}`;
                break;
              default:
                rawContent = e.reasoning || e.current_task || e.task || e.content || e.progress || (Array.isArray(e.completed_tasks) ? `Completed: ${e.completed_tasks.join(', ')}` : '') || '';
                break;
            }
            return {
              agent: e.agentName || e.agent || e.agent_role || 'unknown',
              role: e.agentRole || e.agent_role || e.role || 'unknown',
              content: isMojibake(rawContent) ? cleanText(rawContent) || '[encoding error — original message garbled]' : rawContent,
              type: e.type || 'context',
              timestamp: e.timestamp || e.createdAt || '',
            };
          });
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

      // Get collab history — REST API stores at workspace.memoryKey with { history: [...] }
      let entries: any[] = [];
      let decisions: any[] = [];
      const historyMem = await db.getAIMemoryByKey({
        userId: ctx.user.id,
        memoryKey: workspace.memoryKey,
      });
      if (historyMem?.memoryData) {
        try {
          const data = JSON.parse(historyMem.memoryData);
          const historyArray = Array.isArray(data.history) ? data.history : Array.isArray(data.entries) ? data.entries : [];
          entries = historyArray.slice(-15);
          decisions = historyArray.filter((e: any) => e.type === 'decision_proposal').slice(-5);
          if (Array.isArray(data.decisions)) {
            decisions = decisions.concat(data.decisions.slice(-5));
          }
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
      const contextEntries = entries.filter((e: any) => e.reasoning || e.current_task || e.task || e.content || e.completed_tasks);
      if (contextEntries.length > 0) {
        lines.push('### What happened:');
        for (const entry of contextEntries.slice(-10)) {
          const agent = entry.agentRole || entry.agent_role || entry.agent || 'Agent';
          const text = entry.reasoning || entry.current_task || entry.task || entry.content || (entry.completed_tasks ? `Completed: ${entry.completed_tasks.join(', ')}` : '');
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

  /**
   * Update a single agent's configuration (all editable fields)
   */
  updateAgent: protectedProcedure
    .input(z.object({
      workspaceId: z.string().min(1),
      agentId: z.string().min(1),
      data: z.object({
        name: z.string().min(1).max(100).optional(),
        role: z.string().min(1).max(50).optional(),
        model: z.string().min(1).max(100).optional(),
        integration: z.enum(['mcp', 'rest', 'windows_mcp']).optional(),
        permissions: z.array(z.enum(['read', 'write', 'propose', 'execute'])).min(1).optional(),
        description: z.string().max(500).optional().nullable(),
        goal: z.string().max(500).optional().nullable(),
        backstory: z.string().max(5000).optional().nullable(),
        tools: z.array(z.string().max(50)).max(20).optional(),
        priority: z.number().int().min(1).max(10).optional(),
        endpoint: z.string().url().max(512).or(z.literal('')).optional().nullable(),
        config: z.record(z.string(), z.string().max(2000)).refine(obj => Object.keys(obj).length <= 50, { message: 'Config limited to 50 keys' }).optional().nullable(),
      }),
    }))
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

      const updateData: Record<string, unknown> = {};
      const d = input.data;
      if (d.name !== undefined) updateData.name = d.name.trim();
      if (d.role !== undefined) updateData.role = d.role;
      if (d.model !== undefined) updateData.model = d.model;
      if (d.integration !== undefined) updateData.integration = d.integration;
      if (d.permissions !== undefined) updateData.permissions = d.permissions;
      if (d.description !== undefined) updateData.description = d.description?.trim() || null;
      if (d.goal !== undefined) updateData.goal = d.goal?.trim() || null;
      if (d.backstory !== undefined) updateData.backstory = d.backstory?.trim() || null;
      if (d.tools !== undefined) updateData.tools = d.tools;
      if (d.priority !== undefined) updateData.priority = d.priority;
      if (d.endpoint !== undefined) updateData.endpoint = d.endpoint || null;
      if (d.config !== undefined) updateData.config = d.config || null;

      const updated: AgentRecord = await orm.workspaceAgent.update({
        where: { id: input.agentId },
        data: updateData,
      });

      // Update permissions map if permissions changed
      if (d.permissions !== undefined) {
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
      }

      await logWorkspaceAudit(ctx.user.id, input.workspaceId, 'agent_updated', {
        agentId: input.agentId,
        agentName: updated.name,
        fields: Object.keys(updateData),
      });

      return {
        success: true,
        agent: {
          id: updated.id,
          name: updated.name,
          role: updated.role,
          model: updated.model,
          integration: updated.integration,
          permissions: updated.permissions,
          description: updated.description,
          goal: updated.goal,
          backstory: updated.backstory,
          tools: updated.tools || [],
          priority: updated.priority ?? 5,
          endpoint: updated.endpoint,
          connectionStatus: updated.connectionStatus || 'disconnected',
          lastSeenAt: updated.lastSeenAt?.toISOString() || null,
          config: updated.config,
        },
      };
    }),

  /**
   * Agent heartbeat — called periodically by MCP/REST agents to report online status
   */
  heartbeat: protectedProcedure
    .input(z.object({
      workspaceId: z.string().min(1),
      agentId: z.string().min(1),
    }))
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

      const now = new Date();
      await orm.workspaceAgent.update({
        where: { id: input.agentId },
        data: {
          connectionStatus: 'connected',
          lastSeenAt: now,
        },
      });

      // Broadcast real-time status via WebSocket
      try {
        const { broadcastAgentStatus } = await import('../socket-events.js');
        broadcastAgentStatus({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          agentName: agent.name,
          role: agent.role,
          connectionStatus: 'connected',
          lastSeenAt: now.toISOString(),
        });
      } catch { /* non-critical */ }

      return { success: true, status: 'connected' };
    }),

  // ─── Tasks & Artifacts (read namespaced AiMemory stores) ───────────────

  /**
   * Get tasks for this workspace (assigned via MCP assign_task tool)
   */
  getTasks: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      status: z.enum(['pending', 'in_progress', 'done', 'failed', 'blocked', 'all']).default('all'),
    }))
    .query(async ({ input, ctx }) => {
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
        select: { id: true, memoryKey: true },
      });
      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      const mem = await db.getAIMemoryByKey({
        userId: ctx.user.id,
        memoryKey: `${workspace.memoryKey}:tasks`,
      });

      let tasks: any[] = [];
      if (mem?.memoryData) {
        try {
          const data = JSON.parse(mem.memoryData);
          tasks = Array.isArray(data.items) ? data.items : [];
        } catch { /* empty */ }
      }

      if (input.status !== 'all') {
        tasks = tasks.filter((t: any) => t.status === input.status);
      }

      // Newest first
      tasks.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return { tasks, total: tasks.length };
    }),

  /**
   * Get artifacts shared via MCP share_artifact tool
   */
  getArtifacts: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      type: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const workspace: WsRecord | null = await orm.workspace.findFirst({
        where: { id: input.workspaceId, userId: ctx.user.id },
        select: { id: true, memoryKey: true },
      });
      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
      }

      const mem = await db.getAIMemoryByKey({
        userId: ctx.user.id,
        memoryKey: `${workspace.memoryKey}:artifacts`,
      });

      let artifacts: any[] = [];
      if (mem?.memoryData) {
        try {
          const data = JSON.parse(mem.memoryData);
          artifacts = Array.isArray(data.items) ? data.items : [];
        } catch { /* empty */ }
      }

      if (input.type) {
        artifacts = artifacts.filter((a: any) => a.type === input.type);
      }

      // Newest first
      artifacts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return { artifacts: artifacts.slice(0, input.limit), total: artifacts.length };
    }),
});
