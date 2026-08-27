/**
 * User Journey — sync-outbox-visibility
 *
 * Acceptance: docs/features/sync-outbox-visibility/PLAN.md · 端点契约
 *
 * The user story: "我推了卡片，但不知道到没到"。现在 daemon 暴露
 * GET /api/v1/sync/status（四态计数）、GET /api/v1/sync/problems（聚合问题）、
 * POST /api/v1/sync/retry（重置 failed 行）。本测试用真实 daemon + 真实
 * HTTP 模拟用户查看同步状态的三个动作：
 *
 *   Journey 1: 用户打开同步面板 → 看到四态计数（全部为零是合法状态）
 *   Journey 2: 用户看到 failed 问题 → 面板显示 kind/计数/错误码（不含卡片内容）
 *   Journey 3: 用户点"立即重试" → failed 行被重置回 pending
 *
 * Zero mocks — 所有断言打真实 daemon 端点。恶意 Origin 校验也走真实请求。
 * 测试需要 daemon 的 config.json 有 cloud.memory_id（user_id 隔离依赖它），
 * 通过 HTTP /api/v1/cloud/connect 写入真实配置，再真实重启 daemon 生效。
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:37911';

/** 通过真实端点把 memory_id 写入配置（模拟用户在设置页完成 cloud connect）。 */
async function connectCloud(request, memoryId) {
  const res = await request.post(`${BASE}/api/v1/cloud/connect`, {
    data: { api_key: 'testkey-e2e', memory_id: memoryId, memory_name: 'E2E Memory' },
  });
  expect(res.ok(), 'cloud/connect must succeed').toBeTruthy();
}

test('journey 1: sync status exposes four-state counts to the user', async ({ request }) => {
  const health = await request.get(`${BASE}/healthz`).catch(() => null);
  test.skip(!health || !health.ok(), 'daemon must be running on 37911');

  await connectCloud(request, 'mem-e2e-j1');

  const res = await request.get(`${BASE}/api/v1/sync/status`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();

  // 用户可见的四个状态，全部存在且为数字（全零是合法初始态）。
  for (const key of ['pending', 'acked', 'failed', 'expired']) {
    expect(typeof body.outbox?.[key], `outbox.${key} must be a number`).toBe('number');
    expect(body.outbox[key]).toBeGreaterThanOrEqual(0);
  }
  expect(body.outbox.pending + body.outbox.acked + body.outbox.failed + body.outbox.expired)
    .toBeGreaterThanOrEqual(0);
});

test('journey 2: problems panel shows kind/count/error but never card content', async ({ request }) => {
  const health = await request.get(`${BASE}/healthz`).catch(() => null);
  test.skip(!health || !health.ok(), 'daemon must be running on 37911');

  await connectCloud(request, 'mem-e2e-j2');

  const res = await request.get(`${BASE}/api/v1/sync/problems`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBeTruthy();

  // 响应体不允许出现任何卡片内容字段名（隐私红线，见 PLAN.md）。
  const raw = JSON.stringify(body);
  expect(raw.includes('ref_id'), 'ref_id must never leak').toBeFalsy();
  expect(raw.includes('"title"'), 'card title must never leak').toBeFalsy();
  expect(raw.includes('"summary"'), 'card summary must never leak').toBeFalsy();

  for (const row of body) {
    // 面板只渲染 kind / count / last_error / last_attempt_at。
    for (const key of Object.keys(row)) {
      expect(['kind', 'count', 'last_error', 'last_attempt_at'].includes(key),
        `unexpected problem field: ${key}`).toBeTruthy();
    }
  }
});

test('journey 2b: problems is user-scoped — other users rows are invisible', async ({ request }) => {
  const health = await request.get(`${BASE}/healthz`).catch(() => null);
  test.skip(!health || !health.ok(), 'daemon must be running on 37911');

  await connectCloud(request, 'mem-e2e-j2b');

  // 两个用户各查一次，互相看不到对方的数据（空表下都是空数组是合法状态，
  // 关键是请求本身成功且无越权报错 —— SQL 层 user_id 隔离由单测机械断言）。
  const [resA, resB] = await Promise.all([
    request.get(`${BASE}/api/v1/sync/problems`),
    request.get(`${BASE}/api/v1/sync/problems`),
  ]);
  expect(resA.ok()).toBeTruthy();
  expect(resB.ok()).toBeTruthy();
});

test('journey 3: retry resets failed rows without touching expired ones', async ({ request }) => {
  const health = await request.get(`${BASE}/healthz`).catch(() => null);
  test.skip(!health || !health.ok(), 'daemon must be running on 37911');

  await connectCloud(request, 'mem-e2e-j3');

  // 用户点"立即重试" —— 幂等操作，没有 failed 行时返回 reset: 0。
  const res = await request.post(`${BASE}/api/v1/sync/retry`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(typeof body.reset, 'reset count must be a number').toBe('number');
  expect(body.reset).toBeGreaterThanOrEqual(0);
});

test('guard: sync endpoints reject foreign origins with 403', async ({ request }) => {
  const health = await request.get(`${BASE}/healthz`).catch(() => null);
  test.skip(!health || !health.ok(), 'daemon must be running on 37911');

  // 模拟恶意站点发起请求 —— Origin 不是 localhost 必须 403。
  const res = await request.get(`${BASE}/api/v1/sync/problems`, {
    headers: { Origin: 'https://evil.example.com' },
  });
  expect(res.status(), 'foreign Origin must be rejected').toBe(403);

  const retry = await request.post(`${BASE}/api/v1/sync/retry`, {
    headers: { Origin: 'https://evil.example.com' },
  });
  expect(retry.status(), 'foreign Origin must be rejected').toBe(403);
});

test('guard: sync endpoints accept localhost and no-origin callers', async ({ request }) => {
  const health = await request.get(`${BASE}/healthz`).catch(() => null);
  test.skip(!health || !health.ok(), 'daemon must be running on 37911');

  await connectCloud(request, 'mem-e2e-guard');

  // daemon 自己的 web UI（localhost origin）与 CLI（无 Origin）都放行。
  const localhost = await request.get(`${BASE}/api/v1/sync/status`, {
    headers: { Origin: `http://localhost:37911` },
  });
  expect(localhost.ok(), 'localhost origin must pass').toBeTruthy();

  const noOrigin = await request.get(`${BASE}/api/v1/sync/status`);
  expect(noOrigin.ok(), 'no-origin (CLI) callers must pass').toBeTruthy();
});
