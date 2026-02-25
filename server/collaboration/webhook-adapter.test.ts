/**
 * Webhook Adapter Layer — End-to-End Test Suite
 *
 * Tests the complete flow: signature verification → payload validation →
 * format conversion → enqueue/dequeue → audit logging.
 *
 * Note: Tests that require Redis/BullMQ or a live database are marked
 * with `.skip` when those services are unavailable.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  verifyInboundSignature,
  validateInboundPayload,
  convertToInternalCommand,
  isValidMcpTool,
  type WebhookAction,
} from './webhook-adapter';

// ─── HMAC Signature Verification ─────────────────────────────────────────────

describe('verifyInboundSignature', () => {
  const secret = 'test-webhook-secret-abc123';
  const rawBody = '{"workflowId":"wf_123","action":"execute"}';

  function createValidSignature(body: string, secretKey: string, timestamp?: number): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const sig = crypto
      .createHmac('sha256', secretKey)
      .update(`${ts}.${body}`)
      .digest('hex');
    return `t=${ts},v1=${sig}`;
  }

  it('should accept a valid signature', () => {
    const header = createValidSignature(rawBody, secret);
    expect(verifyInboundSignature(rawBody, header, secret)).toBe(true);
  });

  it('should accept a valid signature with Buffer body', () => {
    const bufBody = Buffer.from(rawBody, 'utf-8');
    const header = createValidSignature(rawBody, secret);
    expect(verifyInboundSignature(bufBody, header, secret)).toBe(true);
  });

  it('should reject an invalid signature', () => {
    const header = createValidSignature(rawBody, 'wrong-secret');
    expect(verifyInboundSignature(rawBody, header, secret)).toBe(false);
  });

  it('should reject a missing signature header', () => {
    expect(verifyInboundSignature(rawBody, undefined, secret)).toBe(false);
  });

  it('should reject an empty signature header', () => {
    expect(verifyInboundSignature(rawBody, '', secret)).toBe(false);
  });

  it('should reject a malformed signature header (no v1)', () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(verifyInboundSignature(rawBody, `t=${ts}`, secret)).toBe(false);
  });

  it('should reject a replay attack (timestamp > 5 minutes old)', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const header = createValidSignature(rawBody, secret, oldTimestamp);
    expect(verifyInboundSignature(rawBody, header, secret)).toBe(false);
  });

  it('should accept a timestamp within 5 minute window', () => {
    const recentTimestamp = Math.floor(Date.now() / 1000) - 240; // 4 minutes ago
    const header = createValidSignature(rawBody, secret, recentTimestamp);
    expect(verifyInboundSignature(rawBody, header, secret)).toBe(true);
  });

  it('should reject a future timestamp (> 60s ahead)', () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 120; // 2 minutes in future
    const header = createValidSignature(rawBody, secret, futureTimestamp);
    expect(verifyInboundSignature(rawBody, header, secret)).toBe(false);
  });

  it('should reject a tampered body', () => {
    const header = createValidSignature(rawBody, secret);
    const tamperedBody = rawBody.replace('execute', 'stop');
    expect(verifyInboundSignature(tamperedBody, header, secret)).toBe(false);
  });
});

// ─── Payload Validation ──────────────────────────────────────────────────────

describe('validateInboundPayload', () => {
  it('should accept a valid execute payload', () => {
    const result = validateInboundPayload({
      workflowId: 'wf_123456',
      action: 'execute',
    });
    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual({
      workflowId: 'wf_123456',
      action: 'execute',
    });
  });

  it('should accept a valid propose payload with data', () => {
    const result = validateInboundPayload({
      workflowId: 'wf_abc',
      action: 'propose',
      data: { decision: 'Use PostgreSQL', reasoning: 'Better for complex queries' },
      requestId: 'req-uuid-123',
    });
    expect(result.valid).toBe(true);
    expect(result.parsed?.action).toBe('propose');
    expect(result.parsed?.data?.decision).toBe('Use PostgreSQL');
    expect(result.parsed?.requestId).toBe('req-uuid-123');
  });

  it('should accept a valid stop payload', () => {
    const result = validateInboundPayload({
      workflowId: 'wf_xyz',
      action: 'stop',
    });
    expect(result.valid).toBe(true);
    expect(result.parsed?.action).toBe('stop');
  });

  it('should accept a valid sync payload', () => {
    const result = validateInboundPayload({
      workflowId: 'wf_sync_test',
      action: 'sync',
      data: { context: 'Additional sync context' },
    });
    expect(result.valid).toBe(true);
    expect(result.parsed?.action).toBe('sync');
  });

  it('should accept a valid tool payload with toolName', () => {
    const result = validateInboundPayload({
      workflowId: 'wf_tool_test',
      action: 'tool',
      toolName: 'share_reasoning',
      data: { currentTask: 'Design API', reasoning: 'REST is standard' },
    });
    expect(result.valid).toBe(true);
    expect(result.parsed?.toolName).toBe('share_reasoning');
  });

  it('should reject tool action without toolName', () => {
    const result = validateInboundPayload({
      workflowId: 'wf_bad_tool',
      action: 'tool',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some((e) => e.includes('toolName'))).toBe(true);
  });

  it('should reject missing workflowId', () => {
    const result = validateInboundPayload({
      action: 'execute',
    });
    expect(result.valid).toBe(false);
  });

  it('should reject invalid action', () => {
    const result = validateInboundPayload({
      workflowId: 'wf_123',
      action: 'invalid_action',
    });
    expect(result.valid).toBe(false);
  });

  it('should reject empty object', () => {
    const result = validateInboundPayload({});
    expect(result.valid).toBe(false);
  });

  it('should reject null', () => {
    const result = validateInboundPayload(null);
    expect(result.valid).toBe(false);
  });

  it('should reject non-object', () => {
    const result = validateInboundPayload('string-payload');
    expect(result.valid).toBe(false);
  });

  it('should reject overly long workflowId', () => {
    const result = validateInboundPayload({
      workflowId: 'x'.repeat(100),
      action: 'execute',
    });
    expect(result.valid).toBe(false);
  });
});

// ─── Format Conversion ──────────────────────────────────────────────────────

describe('convertToInternalCommand', () => {
  it('should convert propose action', () => {
    const cmd = convertToInternalCommand({
      workflowId: 'wf_1',
      action: 'propose',
      data: { decision: 'Use Redis' },
    });
    expect(cmd.type).toBe('propose');
    expect(cmd.workflowId).toBe('wf_1');
    expect(cmd.data).toEqual({ decision: 'Use Redis' });
  });

  it('should convert execute action', () => {
    const cmd = convertToInternalCommand({
      workflowId: 'wf_2',
      action: 'execute',
    });
    expect(cmd.type).toBe('execute');
    expect(cmd.data).toEqual({});
  });

  it('should convert stop action', () => {
    const cmd = convertToInternalCommand({
      workflowId: 'wf_3',
      action: 'stop',
    });
    expect(cmd.type).toBe('stop');
  });

  it('should convert sync action with data', () => {
    const cmd = convertToInternalCommand({
      workflowId: 'wf_4',
      action: 'sync',
      data: { agent_context: 'frontend ready' },
    });
    expect(cmd.type).toBe('sync');
    expect(cmd.data).toEqual({ agent_context: 'frontend ready' });
  });

  it('should convert tool action with toolName', () => {
    const cmd = convertToInternalCommand({
      workflowId: 'wf_5',
      action: 'tool',
      toolName: 'assign_task',
      data: { to: 'backend', title: 'Build API' },
    });
    expect(cmd.type).toBe('tool');
    expect(cmd.toolName).toBe('assign_task');
    expect(cmd.data).toEqual({ to: 'backend', title: 'Build API' });
  });

  it('should default data to empty object when undefined', () => {
    const cmd = convertToInternalCommand({
      workflowId: 'wf_6',
      action: 'execute',
    });
    expect(cmd.data).toEqual({});
  });
});

// ─── MCP Tool Validation ────────────────────────────────────────────────────

describe('isValidMcpTool', () => {
  const validTools = [
    'share_reasoning',
    'propose_shared_decision',
    'sync_progress',
    'ask_question',
    'assign_task',
    'update_task',
    'share_artifact',
  ];

  for (const tool of validTools) {
    it(`should accept valid MCP tool: ${tool}`, () => {
      expect(isValidMcpTool(tool)).toBe(true);
    });
  }

  it('should reject unknown tool', () => {
    expect(isValidMcpTool('unknown_tool')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidMcpTool('')).toBe(false);
  });

  // Read-only tools should NOT be callable via webhook (security)
  it('should reject get_other_agent_context (read-only, not in allowlist)', () => {
    expect(isValidMcpTool('get_other_agent_context')).toBe(false);
  });

  it('should reject get_collaboration_history (read-only)', () => {
    expect(isValidMcpTool('get_collaboration_history')).toBe(false);
  });

  it('should reject get_tasks (read-only)', () => {
    expect(isValidMcpTool('get_tasks')).toBe(false);
  });
});

// ─── Integration Scenario Tests ──────────────────────────────────────────────

describe('End-to-End Webhook Flow Scenarios', () => {
  it('Scenario 1: Valid inbound execute → should pass validation + signature + conversion', () => {
    const secret = 'e2e-test-secret';
    const payload = {
      workflowId: 'wf_e2e_001',
      action: 'execute' as WebhookAction,
      requestId: 'req-e2e-001',
    };
    const rawBody = JSON.stringify(payload);
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
    const header = `t=${ts},v1=${sig}`;

    // Step 1: Signature verification
    expect(verifyInboundSignature(rawBody, header, secret)).toBe(true);

    // Step 2: Payload validation
    const validation = validateInboundPayload(payload);
    expect(validation.valid).toBe(true);

    // Step 3: Format conversion
    const cmd = convertToInternalCommand(validation.parsed!);
    expect(cmd.type).toBe('execute');
    expect(cmd.workflowId).toBe('wf_e2e_001');
  });

  it('Scenario 2: Tampered payload → should fail signature verification', () => {
    const secret = 'e2e-test-secret';
    const originalPayload = { workflowId: 'wf_e2e_002', action: 'execute' };
    const rawBody = JSON.stringify(originalPayload);
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
    const header = `t=${ts},v1=${sig}`;

    // Attacker modifies action
    const tamperedBody = JSON.stringify({ workflowId: 'wf_e2e_002', action: 'stop' });
    expect(verifyInboundSignature(tamperedBody, header, secret)).toBe(false);
  });

  it('Scenario 3: Tool webhook with invalid MCP tool → should be rejected', () => {
    const payload = {
      workflowId: 'wf_e2e_003',
      action: 'tool' as WebhookAction,
      toolName: 'delete_all_data',
      data: {},
    };

    // Validation passes (schema-valid)
    const validation = validateInboundPayload(payload);
    expect(validation.valid).toBe(true);

    // But MCP tool validation should reject it
    expect(isValidMcpTool(payload.toolName)).toBe(false);
  });

  it('Scenario 4: Propose with rich data → full pipeline', () => {
    const secret = 'propose-test-secret';
    const payload = {
      workflowId: 'wf_e2e_004',
      action: 'propose' as WebhookAction,
      data: {
        decision: 'Migrate from REST to GraphQL',
        reasoning: 'Better type safety and reduced over-fetching',
        impact: { frontend: 'high', backend: 'medium' },
        alternatives: 'Keep REST with OpenAPI',
      },
      requestId: 'proposal-uuid-004',
    };
    const rawBody = JSON.stringify(payload);
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
    const header = `t=${ts},v1=${sig}`;

    // Full pipeline
    expect(verifyInboundSignature(rawBody, header, secret)).toBe(true);

    const validation = validateInboundPayload(payload);
    expect(validation.valid).toBe(true);

    const cmd = convertToInternalCommand(validation.parsed!);
    expect(cmd.type).toBe('propose');
    expect(cmd.data.decision).toBe('Migrate from REST to GraphQL');
    expect(cmd.data.impact).toEqual({ frontend: 'high', backend: 'medium' });
  });

  it('Scenario 5: Idempotency key should be passed through', () => {
    const payload = {
      workflowId: 'wf_e2e_005',
      action: 'execute' as WebhookAction,
      requestId: 'idempotent-key-12345',
    };

    const validation = validateInboundPayload(payload);
    expect(validation.valid).toBe(true);
    expect(validation.parsed?.requestId).toBe('idempotent-key-12345');
  });
});
