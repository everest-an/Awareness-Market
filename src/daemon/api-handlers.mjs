import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

import { jsonResponse, nowISO, readBody } from './helpers.mjs';
import {
  apiScanStatus, apiScanTrigger, apiScanFiles,
  apiScanFileDetail, apiScanConfig, apiScanConfigUpdate,
} from './scan-api-handlers.mjs';
import {
  apiTelemetryStatus, apiTelemetryEnable,
  apiTelemetryRecent, apiTelemetryDelete, apiTelemetryTrack,
} from './telemetry-api-handlers.mjs';
import { apiPromptInject } from './prompt-injector.mjs';
import { track } from '../core/telemetry.mjs';
import { isUnsafeWorkspaceRoot } from '../core/workspace-root.mjs';
import { stats as outboxStats, problems as outboxProblems } from '../core/sync/sync-outbox.mjs';

export async function handleApiRoute(daemon, req, res, url) {
  const route = url.pathname.replace('/api/v1', '');

  // F-088: ERC-8350 anchoring routes (lazy import — module only loads when hit)
  if (route.startsWith('/anchor')) {
    const {handleAnchorRoute} = await import('./anchor-api-handlers.mjs');
    return handleAnchorRoute(daemon, req, res, route);
  }

  if (route === '/stats' && req.method === 'GET') {
    const stats = daemon.indexer ? daemon.indexer.getStats() : {};
    return jsonResponse(res, stats);
  }

  if (route === '/memories' && req.method === 'GET') {
    return apiListMemories(daemon, req, res, url);
  }

  // F-064 · External AI Memory Bridge write endpoint (browser-friendly).
  if (route === '/memories' && req.method === 'POST') {
    return apiRecordMemory(daemon, req, res);
  }

  if (route === '/memories/search' && req.method === 'GET') {
    return apiSearchMemories(daemon, req, res, url);
  }

  // F-072 · host-LLM friendly prompt injector (read-only)
  // F-085 (R1) · gated so a same-machine web page (untrusted Origin) can no
  // longer read local memories. Native host-LLM (no Origin) + extension (bridge
  // token) still pass. Escape hatch for rare web-based host-LLMs on a non-
  // whitelisted Origin: AWARENESS_PROMPT_INJECT_OPEN=1.
  if (route === '/prompt/inject' && req.method === 'GET') {
    if (process.env.AWARENESS_PROMPT_INJECT_OPEN !== '1'
      && !(await isBridgeRequestTrusted(daemon, req))) {
      return jsonResponse(res, { error: 'forbidden_origin' }, 403);
    }
    return apiPromptInject(daemon, req, res, url);
  }

  if (route === '/knowledge' && req.method === 'GET') {
    return apiListKnowledge(daemon, req, res, url);
  }

  if (route.startsWith('/knowledge/') && route.endsWith('/evolution') && req.method === 'GET') {
    const cardId = decodeURIComponent(route.replace('/knowledge/', '').replace('/evolution', ''));
    return apiGetEvolutionChain(daemon, req, res, cardId);
  }

  if (route === '/knowledge/cleanup' && req.method === 'DELETE') {
    return apiCleanupKnowledge(daemon, req, res);
  }

  if (route === '/tasks' && req.method === 'GET') {
    return apiListTasks(daemon, req, res, url);
  }

  if (route.startsWith('/tasks/') && req.method === 'PUT') {
    const taskId = decodeURIComponent(route.replace('/tasks/', ''));
    return apiUpdateTask(daemon, req, res, taskId);
  }

  if (route === '/sync/status' && req.method === 'GET') {
    return apiSyncStatus(daemon, req, res);
  }

  // Batch A · sync outbox visibility — bind 127.0.0.1 + validate Origin, response must
  // not contain card content (ref_id, title, summary).
  if (route === '/sync/problems' && req.method === 'GET') {
    if (!isLocalhostOrigin(req)) return jsonResponse(res, { error: 'forbidden_origin' }, 403);
    return apiSyncProblems(daemon, req, res);
  }

  if (route === '/sync/retry' && req.method === 'POST') {
    if (!isLocalhostOrigin(req)) return jsonResponse(res, { error: 'forbidden_origin' }, 403);
    return apiSyncRetry(daemon, req, res);
  }

  if (route === '/workspaces' && req.method === 'GET') {
    return apiWorkspaces(res, url);
  }

  // F-064 Phase 2 · Session CRUD (reuses the native sessions table — no new
  // table). Powers the browser extension's "bind this site to a session".
  if (route === '/sessions' && req.method === 'GET') {
    return apiListSessions(daemon, req, res, url);
  }
  if (route === '/sessions' && req.method === 'POST') {
    return apiCreateSession(daemon, req, res);
  }

  // F-064 Phase 2 · External bindings (site ↔ workspace ↔ session), global
  // routing table persisted at ~/.awareness/external-bindings.json.
  if (route === '/bindings' && req.method === 'GET') {
    return apiListBindings(daemon, req, res, url);
  }
  if (route === '/bindings' && req.method === 'POST') {
    return apiUpsertBinding(daemon, req, res);
  }
  if (route === '/bindings' && req.method === 'DELETE') {
    return apiDeleteBinding(daemon, req, res, url);
  }

  // F-064 Phase 3 · Bridge Token (Option C). The browser extension's service
  // worker runs off a chrome-extension://<id> origin that is NOT in the site
  // allowlist; a per-install bearer token bypasses the Origin check on write.
  // Minting is Origin-gated (isTokenMintOrigin) so websites can't steal one.
  if (route === '/bridge/token' && req.method === 'GET') {
    return apiBridgeTokenStatus(daemon, req, res);
  }
  if (route === '/bridge/token' && req.method === 'POST') {
    return apiMintBridgeToken(daemon, req, res);
  }
  if (route === '/bridge/token' && req.method === 'DELETE') {
    return apiRevokeBridgeToken(daemon, req, res, url);
  }

  if (route === '/config' && req.method === 'GET') {
    return apiGetConfig(daemon, req, res);
  }

  if (route === '/config' && req.method === 'PUT') {
    return apiUpdateConfig(daemon, req, res);
  }

  if (route === '/cloud/auth/start' && req.method === 'POST') {
    return apiCloudAuthStart(daemon, req, res);
  }

  if (route === '/cloud/auth/poll' && req.method === 'POST') {
    return apiCloudAuthPoll(daemon, req, res);
  }

  if (route === '/cloud/auth/open-browser' && req.method === 'POST') {
    return apiCloudAuthOpenBrowser(daemon, req, res);
  }

  if (route.startsWith('/cloud/memories') && req.method === 'GET') {
    return apiCloudListMemories(daemon, req, res, url);
  }

  if (route === '/cloud/profile' && req.method === 'POST') {
    return apiCloudGetProfile(daemon, req, res, url);
  }

  if (route === '/cloud/connect' && req.method === 'POST') {
    return apiCloudConnect(daemon, req, res);
  }

  if (route === '/cloud/disconnect' && req.method === 'POST') {
    return apiCloudDisconnect(daemon, req, res);
  }

  if (route === '/sync/recent' && req.method === 'GET') {
    return apiSyncRecent(daemon, req, res, url);
  }

  if (route === '/perceptions' && req.method === 'GET') {
    return apiListPerceptions(daemon, req, res, url);
  }

  if (route.startsWith('/perceptions/') && route.endsWith('/acknowledge') && req.method === 'POST') {
    const id = decodeURIComponent(route.replace('/perceptions/', '').replace('/acknowledge', ''));
    return apiAcknowledgePerception(daemon, req, res, id);
  }

  if (route.startsWith('/perceptions/') && route.endsWith('/dismiss') && req.method === 'POST') {
    const id = decodeURIComponent(route.replace('/perceptions/', '').replace('/dismiss', ''));
    return apiDismissPerception(daemon, req, res, id);
  }

  if (route.startsWith('/perceptions/') && route.endsWith('/restore') && req.method === 'POST') {
    const id = decodeURIComponent(route.replace('/perceptions/', '').replace('/restore', ''));
    return apiRestorePerception(daemon, req, res, id);
  }

  if (route === '/perceptions/refresh' && req.method === 'POST') {
    return apiRefreshPerceptions(daemon, req, res);
  }

  if (route === '/workspace/switch' && req.method === 'POST') {
    return apiSwitchWorkspace(daemon, req, res);
  }

  if (route.startsWith('/memories/') && req.method === 'GET') {
    const memId = decodeURIComponent(route.replace('/memories/', ''));
    return apiGetMemory(daemon, req, res, memId);
  }

  // ── Wiki UI endpoints ──────────────────────────────────────────────
  if (route === '/skills' && req.method === 'GET') {
    return apiListSkills(daemon, req, res, url);
  }

  if (route.startsWith('/skills/') && route.endsWith('/use') && req.method === 'POST') {
    const skillId = decodeURIComponent(route.replace('/skills/', '').replace('/use', ''));
    return apiMarkSkillUsed(daemon, req, res, skillId);
  }

  if (route.startsWith('/skills/') && route.endsWith('/export') && req.method === 'GET') {
    const skillId = decodeURIComponent(
      route.replace('/skills/', '').replace('/export', '')
    );
    return apiExportSkill(daemon, req, res, skillId, url);
  }

  if (route.startsWith('/skills/') && req.method === 'PUT') {
    const skillId = decodeURIComponent(route.replace('/skills/', ''));
    return apiUpdateSkill(daemon, req, res, skillId);
  }

  if (route === '/topics' && req.method === 'GET') {
    return apiListTopics(daemon, req, res, url);
  }

  if (route === '/timeline' && req.method === 'GET') {
    return apiTimeline(daemon, req, res, url);
  }

  if (route === '/search' && req.method === 'GET') {
    return apiHybridSearch(daemon, req, res, url);
  }

  if (route.startsWith('/knowledge/') && !route.endsWith('/evolution') && route !== '/knowledge/cleanup' && req.method === 'GET') {
    const cardId = decodeURIComponent(route.replace('/knowledge/', ''));
    return apiGetKnowledgeCard(daemon, req, res, cardId);
  }

  // --- F-038 Scan API ---
  if (route === '/scan/status' && req.method === 'GET') {
    return apiScanStatus(daemon, req, res);
  }

  if (route === '/scan/trigger' && req.method === 'POST') {
    return apiScanTrigger(daemon, req, res);
  }

  if (route === '/scan/files' && req.method === 'GET') {
    return apiScanFiles(daemon, req, res, url);
  }

  if (route.startsWith('/scan/file/') && req.method === 'GET') {
    const fileId = decodeURIComponent(route.replace('/scan/file/', ''));
    return apiScanFileDetail(daemon, req, res, fileId);
  }

  if (route === '/scan/config' && req.method === 'GET') {
    return apiScanConfig(daemon, req, res);
  }

  if (route === '/scan/config' && req.method === 'PUT') {
    return apiScanConfigUpdate(daemon, req, res);
  }

  // --- F-040 Telemetry API (opt-in anonymous analytics) ---
  if (route === '/telemetry/status' && req.method === 'GET') {
    return apiTelemetryStatus(daemon, req, res);
  }
  if (route === '/telemetry/enable' && req.method === 'POST') {
    return apiTelemetryEnable(daemon, req, res);
  }
  if (route === '/telemetry/recent' && req.method === 'GET') {
    return apiTelemetryRecent(daemon, req, res);
  }
  if (route === '/telemetry/data' && req.method === 'DELETE') {
    return apiTelemetryDelete(daemon, req, res);
  }

  if (route === '/telemetry/track' && req.method === 'POST') {
    return apiTelemetryTrack(daemon, req, res);
  }

  return jsonResponse(res, { error: 'Not found', route }, 404);
}

export function apiListMemories(daemon, _req, res, url) {
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const sourceFilter = url.searchParams.get('source') || null;
  const sourceExclude = url.searchParams.get('source_exclude') || null;

  if (!daemon.indexer) {
    return jsonResponse(res, { items: [], total: 0 });
  }

  const conditions = [`status = 'active'`];
  const params = [];

  if (sourceFilter) {
    conditions.push(`source = ?`);
    params.push(sourceFilter);
  } else if (sourceExclude) {
    conditions.push(`source != ?`);
    params.push(sourceExclude);
  }

  const whereClause = conditions.join(' AND ');

  const rows = daemon.indexer.db
    .prepare(
      `SELECT m.*, f.content AS fts_content
       FROM memories m
       LEFT JOIN memories_fts f ON f.id = m.id
       WHERE ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  const total = daemon.indexer.db
    .prepare(`SELECT COUNT(*) AS c FROM memories WHERE ${whereClause}`)
    .all(...params)[0]?.c ?? 0;

  return jsonResponse(res, { items: rows, total, limit, offset });
}

// ---------------------------------------------------------------------------
// F-064 · External AI Memory Bridge — write endpoint (POST /api/v1/memories)
// ---------------------------------------------------------------------------

// Decision B · CSRF/origin allowlist. A browser capture on doubao.com sends
// `Origin: https://www.doubao.com`; a native/curl client sends none. Only
// localhost + the supported chat sites (and the product domain) may write.
const TRUSTED_ORIGIN_HOST_SUFFIXES = [
  'chatgpt.com',
  'openai.com',
  'gemini.google.com',
  'deepseek.com',
  'doubao.com',
  'yuanbao.tencent.com',
  // F-064 Phase 3 · Kimi (Moonshot) — two live domains: kimi.com (intl) and
  // kimi.moonshot.cn (CN). Content-script relays (no-token path) write from
  // these origins, so both suffixes must be trusted.
  'kimi.com',
  'moonshot.cn',
  'awareness.market',
];

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * F-064 · Validate the request Origin against the trust allowlist.
 * Missing Origin (native clients, curl) is allowed — only a present-but-
 * untrusted Origin is rejected (classic CSRF surface).
 * @param {string|undefined} originHeader
 * @returns {boolean}
 */
export function isTrustedBridgeOrigin(originHeader) {
  if (!originHeader) return true; // native / curl — no browser Origin
  let hostname;
  try {
    hostname = new URL(originHeader).hostname;
  } catch {
    return false; // malformed Origin → reject
  }
  if (LOCALHOST_HOSTNAMES.has(hostname)) return true;
  return TRUSTED_ORIGIN_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith('.' + suffix),
  );
}

/**
 * F-064 · When AWARENESS_BRIDGE_REQUIRE_AUTH=1 (cloud-facing deploy), the
 * write endpoint demands an Authorization header. Off by default so local
 * desktop users are unaffected.
 */
function bridgeRequiresAuth() {
  return process.env.AWARENESS_BRIDGE_REQUIRE_AUTH === '1';
}

/**
 * F-085 (R1) · Shared trust gate for browser-facing endpoints (record + inject).
 * A same-machine malicious web page's fetch ALWAYS carries its own (untrusted)
 * Origin, so Origin-checking is what blocks it. Passes when: a valid bridge
 * token is presented (the extension service worker), OR the Origin is absent
 * (native host-LLM runtime / curl) or whitelisted. Missing Origin is trusted
 * because non-browser callers can't be CSRF'd.
 */
async function isBridgeRequestTrusted(daemon, req) {
  const bridgeToken = req.headers['x-awareness-bridge-token'];
  const tokenValid = bridgeToken
    ? (await getBridgeTokenStore(daemon)).isValid(String(bridgeToken))
    : false;
  return tokenValid || isTrustedBridgeOrigin(req.headers.origin);
}

/**
 * Batch A · sync outbox Origin guard. The daemon binds 127.0.0.1, so any
 * request from the daemon's own web UI has a localhost origin. Absent Origin
 * (curl, native host-LLM) is also allowed — non-browser callers can't be CSRF'd.
 */
function isLocalhostOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser caller
  try {
    const hostname = new URL(origin).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch { return false; }
}

export async function apiRecordMemory(daemon, req, res) {
  // F-064 Phase 3 (Option C) · A valid Bridge Token bypasses the site Origin
  // allowlist — this is how the extension's service worker (which fetches off a
  // `chrome-extension://<id>` origin, not a whitelisted chat site) is trusted.
  // No token → fall back to the Decision B site Origin allowlist (CSRF guard).
  if (!(await isBridgeRequestTrusted(daemon, req))) {
    return jsonResponse(res, { error: 'forbidden_origin' }, 403);
  }

  // Decision B · cloud-mode Authorization
  if (bridgeRequiresAuth() && !req.headers.authorization) {
    return jsonResponse(res, { error: 'authorization_required' }, 401);
  }

  let body;
  try {
    const raw = await readBody(req);
    body = raw ? JSON.parse(raw) : {};
  } catch (err) {
    if (err && /too large/i.test(err.message || '')) {
      return jsonResponse(res, { error: 'payload_too_large' }, 413);
    }
    return jsonResponse(res, { error: 'invalid_json' }, 400);
  }

  if (!body || typeof body.content !== 'string' || !body.content.trim()) {
    return jsonResponse(res, { error: 'content is required' }, 400);
  }

  // F-064 Phase 2 · Session↔workspace ownership guard (FM-6). If the caller
  // passes a session_id that already exists in THIS workspace's DB but was
  // stamped to a different workspace, reject cross-workspace writes. Empty /
  // unknown / matching / legacy-null sessions pass through (lenient for
  // curl + fresh external sessions).
  if (typeof body.session_id === 'string' && body.session_id.trim() && daemon.indexer?.getSession) {
    const existing = daemon.indexer.getSession(body.session_id.trim());
    if (existing && existing.workspace) {
      const owner = path.resolve(existing.workspace);
      const current = path.resolve(daemon.projectDir || process.cwd());
      if (owner !== current) {
        return jsonResponse(res, { error: 'session_workspace_mismatch' }, 409);
      }
    }
  }

  // Decision C · reuse the existing session model. source defaults to
  // external_chat so the bridge captures are always source-scoped.
  const params = {
    content: body.content,
    source: body.source || 'external_chat',
    session_id: body.session_id || '',
    title: body.title || '',
    tags: Array.isArray(body.tags) ? body.tags : [],
    event_type: body.event_type || 'turn_summary',
    agent_role: body.agent_role || 'external_agent',
    metadata: sanitizeInboundMetadata(body.metadata),
    insights: body.insights || undefined,
    // Decision A · same-source dedup for bridge writes.
    dedup_same_source: true,
  };

  try {
    const result = await daemon._remember(params);
    // remember() returns { error } for validation failures — map to 4xx/5xx.
    if (result && result.error) {
      const status = /too large/i.test(result.error) ? 413 : 400;
      return jsonResponse(res, result, status);
    }
    return jsonResponse(res, result);
  } catch (err) {
    console.error('[api] POST /memories failed:', err.message);
    return jsonResponse(res, { error: 'record_failed', detail: err.message }, 500);
  }
}

/**
 * F-064 · Accept only a plain object as metadata; anything else (string,
 * array, number) degrades to null so a bad payload never breaks the write.
 * @param {*} value
 * @returns {object|null}
 */
export function sanitizeInboundMetadata(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return null;
}

// ---------------------------------------------------------------------------
// F-064 Phase 2 · Session CRUD (reuse native sessions table, decision C)
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/sessions — list sessions for the current workspace, newest first.
 * Optional `?source=external_chat` isolates bridge sessions from IDE sessions.
 * Optional `?limit=N` (default 100, capped 500).
 */
export function apiListSessions(daemon, _req, res, url) {
  if (!daemon.indexer?.listSessions) {
    return jsonResponse(res, { sessions: [], total: 0 });
  }
  const source = url.searchParams.get('source') || undefined;
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw != null ? parseInt(limitRaw, 10) : undefined;
  const sessions = daemon.indexer.listSessions({ source, limit });
  return jsonResponse(res, { sessions, total: sessions.length });
}

/**
 * POST /api/v1/sessions — create an external-chat session bound to the current
 * workspace. Body: { source?, agent_role?, prefix? }. Generates an `ext_...` id
 * (or honours a custom `prefix`) and stamps `workspace = resolve(projectDir)`.
 */
export async function apiCreateSession(daemon, req, res) {
  if (!daemon.indexer?.createSession) {
    return jsonResponse(res, { error: 'Indexer not available' }, 503);
  }

  let body = {};
  try {
    const raw = await readBody(req);
    if (raw) body = JSON.parse(raw);
  } catch {
    return jsonResponse(res, { error: 'invalid_json' }, 400);
  }

  const source = typeof body.source === 'string' && body.source.trim()
    ? body.source.trim()
    : 'external_chat';
  const agentRole = typeof body.agent_role === 'string' && body.agent_role.trim()
    ? body.agent_role.trim()
    : 'external_agent';

  // Normalise the id prefix to a safe slug; default `ext`.
  const rawPrefix = typeof body.prefix === 'string' ? body.prefix.trim() : '';
  const prefix = (rawPrefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'ext').slice(0, 24);
  const id = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const workspace = path.resolve(daemon.projectDir || process.cwd());
  try {
    const session = daemon.indexer.createSession(source, agentRole, { id, workspace });
    return jsonResponse(res, session);
  } catch (err) {
    return jsonResponse(res, { error: 'create_session_failed', detail: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// F-064 Phase 2 · External bindings (site ↔ workspace ↔ session)
// ---------------------------------------------------------------------------

/** Lazily construct the daemon-scoped BindingStore (global JSON file). */
async function getBindingStore(daemon) {
  if (!daemon.bindingStore) {
    const { BindingStore } = await import('../core/binding-store.mjs');
    daemon.bindingStore = new BindingStore();
  }
  return daemon.bindingStore;
}

// ---------------------------------------------------------------------------
// F-064 Phase 3 · Bridge Token (Option C) — SW-origin write authorization
// ---------------------------------------------------------------------------

/** Lazily construct the daemon-scoped BridgeTokenStore (global JSON file). */
async function getBridgeTokenStore(daemon) {
  if (!daemon.bridgeTokenStore) {
    const { BridgeTokenStore } = await import('../core/bridge-token-store.mjs');
    daemon.bridgeTokenStore = new BridgeTokenStore();
  }
  return daemon.bridgeTokenStore;
}

/**
 * Only an extension service worker (`chrome-extension://` / `moz-extension://`),
 * a localhost tool, or a native client (no Origin) may MINT a bridge token.
 * A website in a normal tab (https://evil.com) is rejected so it cannot steal a
 * token via the CORS-`*` response and then forge writes.
 * @param {string|undefined} originHeader
 * @returns {boolean}
 */
export function isTokenMintOrigin(originHeader) {
  if (!originHeader) return true; // native / curl
  let parsed;
  try {
    parsed = new URL(originHeader);
  } catch {
    return false;
  }
  if (parsed.protocol === 'chrome-extension:' || parsed.protocol === 'moz-extension:') return true;
  if (LOCALHOST_HOSTNAMES.has(parsed.hostname)) return true;
  return false;
}

/**
 * GET /api/v1/bridge/token — non-sensitive status (never returns token values).
 * `{ has_token: boolean, count: number }`.
 */
export async function apiBridgeTokenStatus(daemon, _req, res) {
  const store = await getBridgeTokenStore(daemon);
  return jsonResponse(res, { has_token: store.hasAny(), count: store.count() });
}

/**
 * POST /api/v1/bridge/token — mint a new token. Origin-gated (Journey 0b).
 * Body (optional): { label }. Returns `{ status:'ok', token, created_at }`.
 */
export async function apiMintBridgeToken(daemon, req, res) {
  if (!isTokenMintOrigin(req.headers.origin)) {
    return jsonResponse(res, { error: 'forbidden_origin' }, 403);
  }
  let label = null;
  try {
    const raw = await readBody(req);
    if (raw) label = JSON.parse(raw)?.label ?? null;
  } catch { /* body optional */ }
  const store = await getBridgeTokenStore(daemon);
  const minted = store.mint(label);
  return jsonResponse(res, { status: 'ok', ...minted });
}

/** DELETE /api/v1/bridge/token — revoke a token via `?token=` or JSON body. */
export async function apiRevokeBridgeToken(daemon, req, res, url) {
  let token = url.searchParams.get('token');
  if (!token) {
    try {
      const raw = await readBody(req);
      if (raw) token = JSON.parse(raw)?.token;
    } catch { /* ignore */ }
  }
  if (typeof token !== 'string' || !token.trim()) {
    return jsonResponse(res, { error: 'token is required' }, 400);
  }
  const store = await getBridgeTokenStore(daemon);
  const revoked = store.revoke(token);
  return jsonResponse(res, { status: 'ok', revoked });
}

/** GET /api/v1/bindings — list all bindings, or one via `?site=`. */
export async function apiListBindings(daemon, _req, res, url) {
  const store = await getBindingStore(daemon);
  const site = url.searchParams.get('site');
  if (site) {
    const binding = store.get(site);
    return jsonResponse(res, { bindings: binding ? [binding] : [], total: binding ? 1 : 0 });
  }
  const bindings = store.list();
  return jsonResponse(res, { bindings, total: bindings.length });
}

/**
 * POST /api/v1/bindings — upsert a site→workspace→session binding.
 * Body: { site, workspace?, session_id? }. `site` is required (FM-7).
 */
export async function apiUpsertBinding(daemon, req, res) {
  let body = {};
  try {
    const raw = await readBody(req);
    if (raw) body = JSON.parse(raw);
  } catch {
    return jsonResponse(res, { error: 'invalid_json' }, 400);
  }

  if (typeof body.site !== 'string' || !body.site.trim()) {
    return jsonResponse(res, { error: 'site is required' }, 400);
  }

  const store = await getBindingStore(daemon);
  try {
    const binding = store.upsert({
      site: body.site,
      workspace: body.workspace,
      session_id: body.session_id,
    });
    return jsonResponse(res, { status: 'ok', binding });
  } catch (err) {
    return jsonResponse(res, { error: 'binding_failed', detail: err.message }, 400);
  }
}

/** DELETE /api/v1/bindings?site=doubao.com — remove a binding. */
export async function apiDeleteBinding(daemon, req, res, url) {
  let site = url.searchParams.get('site');
  if (!site) {
    // Allow the site in a JSON body as a fallback for clients that can't set
    // a query string on DELETE.
    try {
      const raw = await readBody(req);
      if (raw) site = JSON.parse(raw)?.site;
    } catch { /* ignore */ }
  }
  if (typeof site !== 'string' || !site.trim()) {
    return jsonResponse(res, { error: 'site is required' }, 400);
  }
  const store = await getBindingStore(daemon);
  const removed = store.remove(site);
  return jsonResponse(res, { status: 'ok', removed });
}

export async function apiSearchMemories(daemon, _req, res, url) {
  const q = url.searchParams.get('q') || '';
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const budget = parseInt(url.searchParams.get('budget') || '20000', 10);

  if (!q) {
    return jsonResponse(res, { items: [], total: 0, query: q });
  }

  // F-053 Phase 3 · primary path: unifiedCascadeSearch gives query-type
  // routing, recency channel, budget-tier shaping, and cross-encoder rerank.
  if (daemon.search && typeof daemon.search.unifiedCascadeSearch === 'function') {
    try {
      const out = await daemon.search.unifiedCascadeSearch(q, { tokenBudget: budget, limit });
      const items = Array.isArray(out?.results) ? out.results : Array.isArray(out) ? out : [];
      return jsonResponse(res, { items, total: items.length, query: q });
    } catch (err) {
      console.error('[api] /memories/search cascade error:', err.message);
    }
  }

  // FTS-only last-resort fallback for daemons without the search module.
  if (!daemon.indexer) {
    return jsonResponse(res, { items: [], total: 0, query: q });
  }
  const results = daemon.indexer.search(q, { limit });
  return jsonResponse(res, { items: results, total: results.length, query: q });
}

export function apiListKnowledge(daemon, _req, res, url) {
  const category = url.searchParams.get('category') || null;
  const limit = parseInt(url.searchParams.get('limit') || '100', 10);

  if (!daemon.indexer) {
    return jsonResponse(res, { items: [], total: 0 });
  }

  let sql = `SELECT * FROM knowledge_cards WHERE status = 'active'`;
  const params = [];

  if (category) {
    sql += ` AND category = ?`;
    params.push(category);
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  const rows = daemon.indexer.db.prepare(sql).all(...params);
  return jsonResponse(res, { items: rows, total: rows.length });
}

export function apiGetEvolutionChain(daemon, _req, res, cardId) {
  if (!daemon.indexer?.getEvolutionChain) {
    return jsonResponse(res, { card_id: cardId, chain_length: 0, evolution_chain: [] });
  }
  const chain = daemon.indexer.getEvolutionChain(cardId);
  return jsonResponse(res, {
    card_id: cardId,
    chain_length: chain.length,
    evolution_chain: chain,
  });
}

export async function apiCleanupKnowledge(daemon, req, res) {
  if (!daemon.indexer) {
    return jsonResponse(res, { deleted: 0 });
  }

  let body;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(res, { error: 'Invalid JSON body' }, 400);
  }

  const patterns = body?.patterns;
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return jsonResponse(res, { error: 'patterns must be a non-empty array of regex strings' }, 400);
  }

  let regexes;
  try {
    regexes = patterns.map((pattern) => new RegExp(pattern));
  } catch (err) {
    return jsonResponse(res, { error: `Invalid regex: ${err.message}` }, 400);
  }

  const allCards = daemon.indexer.db
    .prepare("SELECT id, title, filepath FROM knowledge_cards WHERE status = 'active'")
    .all();

  const toDelete = allCards.filter((card) => regexes.some((regex) => regex.test(card.title)));

  if (toDelete.length === 0) {
    return jsonResponse(res, { deleted: 0 });
  }

  const deleteCard = daemon.indexer.db.prepare('DELETE FROM knowledge_cards WHERE id = ?');
  const deleteFts = daemon.indexer.db.prepare('DELETE FROM knowledge_fts WHERE id = ?');
  const deleteMany = daemon.indexer.db.transaction((cards) => {
    for (const card of cards) {
      deleteCard.run(card.id);
      deleteFts.run(card.id);
    }
  });
  deleteMany(toDelete);

  for (const card of toDelete) {
    if (card.filepath) {
      try { fs.unlinkSync(card.filepath); } catch { /* file may already be gone */ }
    }
  }

  return jsonResponse(res, { deleted: toDelete.length });
}

export function apiListTasks(daemon, _req, res, url) {
  const status = url.searchParams.get('status') || null;
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 0;

  if (!daemon.indexer) {
    return jsonResponse(res, { items: [], total: 0 });
  }

  let sql = `SELECT * FROM tasks`;
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ` ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, created_at DESC`;
  if (limit > 0) {
    sql += ` LIMIT ?`;
    params.push(limit);
  }

  const rows = daemon.indexer.db.prepare(sql).all(...params);
  return jsonResponse(res, { items: rows, total: rows.length });
}

export async function apiUpdateTask(daemon, req, res, taskId) {
  const body = await readBody(req);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return jsonResponse(res, { error: 'Invalid JSON' }, 400);
  }

  if (!daemon.indexer) {
    return jsonResponse(res, { error: 'Indexer not available' }, 503);
  }

  const task = daemon.indexer.db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(taskId);

  if (!task) {
    return jsonResponse(res, { error: 'Task not found' }, 404);
  }

  const newStatus = payload.status || task.status;
  const newPriority = payload.priority || task.priority;

  daemon.indexer.indexTask({
    ...task,
    status: newStatus,
    priority: newPriority,
    updated_at: nowISO(),
  });

  return jsonResponse(res, {
    status: 'ok',
    task_id: taskId,
    new_status: newStatus,
  });
}

export function apiSyncStatus(daemon, _req, res) {
  const config = daemon._loadConfig();
  const cloud = config.cloud || {};
  const history = daemon.cloudSync ? daemon.cloudSync.getSyncHistory() : [];

  // Previously last_push_at/last_pull_at read from a config field that's
  // never actually written — CloudSync records events into sync_state
  // via recordSyncEvent() but doesn't mirror them back to config.json.
  // Derive the two scalars from the history the same source the UI sees,
  // so the status panel no longer shows "Never synced" despite a recent
  // push. Config-level override still wins if the field is set explicitly.
  const deriveLast = (direction) => {
    for (const h of history) {
      if (h?.details?.direction === direction && h?.timestamp) return h.timestamp;
    }
    return null;
  };

  return jsonResponse(res, {
    cloud_enabled: !!cloud.enabled,
    api_base: cloud.api_base || null,
    memory_id: cloud.memory_id || null,
    memory_name: cloud.memory_name || null,
    auto_sync: cloud.auto_sync ?? true,
    last_push_at: cloud.last_push_at || deriveLast('push'),
    last_pull_at: cloud.last_pull_at || deriveLast('pull'),
    history,
    // Batch A · outbox stats for sync indicator
    outbox: getOutboxStats(daemon),
  });
}

/** Batch A · outbox stats scoped to the current cloud user. */
function getOutboxStats(daemon) {
  try {
    const db = daemon.indexer?.db;
    const config = daemon._loadConfig();
    const userId = config?.cloud?.memory_id;
    if (!db || !userId) return { pending: 0, acked: 0, failed: 0, expired: 0 };
    return outboxStats(db, userId);
  } catch { return { pending: 0, acked: 0, failed: 0, expired: 0 }; }
}

/**
 * Batch A · GET /api/v1/sync/problems — failed/expired outbox rows grouped by kind.
 * Response MUST NOT contain card content (ref_id, title, summary).
 */
export function apiSyncProblems(daemon, _req, res) {
  try {
    const db = daemon.indexer?.db;
    const config = daemon._loadConfig();
    const userId = config?.cloud?.memory_id;
    if (!db || !userId) return jsonResponse(res, []);
    const result = outboxProblems(db, userId);
    return jsonResponse(res, result);
  } catch { return jsonResponse(res, []); }
}

/**
 * Batch A · POST /api/v1/sync/retry — reset failed outbox rows back to pending
 * so the next sync cycle picks them up. Does NOT touch expired rows (those are
 * dead by definition — a day-old write is not safe to apply).
 */
export async function apiSyncRetry(daemon, req, res) {
  try {
    const db = daemon.indexer?.db;
    const config = daemon._loadConfig();
    const userId = config?.cloud?.memory_id;
    if (!db || !userId) return jsonResponse(res, { reset: 0 });
    const result = db.prepare(
      `UPDATE sync_outbox SET status = 'pending', attempts = 0, last_error = NULL,
       updated_at = ? WHERE user_id = ? AND status = 'failed'`,
    ).run(new Date().toISOString(), userId);
    return jsonResponse(res, { reset: result.changes });
  } catch { return jsonResponse(res, { reset: 0 }); }
}

/**
 * Workspace registry endpoint.
 *
 * Default response is the full `Record<path, entry>` map — kept for back-compat
 * with clients written before pagination existed.
 *
 * Query params (all optional):
 *   - `limit=<N>`    — return at most N entries, sorted by lastUsed desc.
 *                      When present, the response shape flips to
 *                      `{ workspaces: [{ path, ...entry }], total }` which
 *                      is much smaller for users with thousands of registered
 *                      workspaces (e.g. OCT-Agent Memory tab previously
 *                      pulled a 450KB 2600-entry blob on every load).
 *   - `q=<substr>`   — case-insensitive path substring filter. Applied before
 *                      limit.
 */
export async function apiWorkspaces(res, url) {
  try {
    const { loadWorkspaces } = await import('../core/config.mjs');
    const ws = loadWorkspaces() || {};
    const sanitizedEntries = Object.entries(ws).filter(([workspacePath]) => {
      const resolved = path.resolve(workspacePath);
      if (isUnsafeWorkspaceRoot(resolved)) return false;
      if (!fs.existsSync(resolved)) return false;
      return true;
    });

    const limitRaw = url?.searchParams?.get('limit');
    const q = (url?.searchParams?.get('q') || '').trim().toLowerCase();
    const limit = limitRaw != null ? Math.max(0, Math.min(500, Number(limitRaw) || 0)) : null;

    // Back-compat: no limit + no query → return the raw map.
    if (limit === null && !q) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(Object.fromEntries(sanitizedEntries)));
    }

    const filtered = q
      ? sanitizedEntries.filter(([p]) => p.toLowerCase().includes(q))
      : sanitizedEntries;
    filtered.sort(([, a], [, b]) => {
      const ta = Date.parse(a?.lastUsed || '') || 0;
      const tb = Date.parse(b?.lastUsed || '') || 0;
      return tb - ta;
    });
    const page = limit !== null ? filtered.slice(0, limit) : filtered;
    const workspaces = page.map(([p, entry]) => ({ path: p, ...entry }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ workspaces, total: filtered.length }));
  } catch {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{}');
  }
}

export function apiGetConfig(daemon, _req, res) {
  const config = daemon._loadConfig();
  if (config.cloud && config.cloud.api_key) {
    const key = config.cloud.api_key;
    config.cloud.api_key = key.length > 8
      ? key.slice(0, 4) + '...' + key.slice(-4)
      : '****';
  }
  return jsonResponse(res, config);
}

export async function apiUpdateConfig(daemon, req, res) {
  const body = await readBody(req);
  let patch;
  try {
    patch = JSON.parse(body);
  } catch {
    return jsonResponse(res, { error: 'Invalid JSON' }, 400);
  }

  const configPath = path.join(daemon.awarenessDir, 'config.json');
  const config = daemon._loadConfig();
  const allowedSections = ['daemon', 'embedding', 'cloud', 'git_sync', 'agent', 'extraction', 'memory'];
  for (const section of allowedSections) {
    if (patch[section] && typeof patch[section] === 'object') {
      config[section] = { ...(config[section] || {}), ...patch[section] };
    }
  }

  try {
    const tmpCfg = configPath + '.tmp';
    fs.writeFileSync(tmpCfg, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tmpCfg, configPath);
  } catch (err) {
    return jsonResponse(res, { error: 'Failed to save config: ' + err.message }, 500);
  }

  if (config.cloud && config.cloud.api_key) {
    const key = config.cloud.api_key;
    config.cloud.api_key = key.length > 8
      ? key.slice(0, 4) + '...' + key.slice(-4)
      : '****';
  }

  return jsonResponse(res, { status: 'ok', config });
}

export async function apiCloudAuthOpenBrowser(_daemon, req, res) {
  const body = await readBody(req);
  let params;
  try { params = JSON.parse(body); } catch { return jsonResponse(res, { error: 'Invalid JSON' }, 400); }
  const { url: targetUrl } = params;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return jsonResponse(res, { error: 'url required' }, 400);
  }
  if (!targetUrl.startsWith('https://awareness.market/')) {
    return jsonResponse(res, { error: 'URL not allowed' }, 403);
  }
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  execFile(cmd, [targetUrl], (err) => {
    if (err) console.warn('[awareness-local] failed to open browser:', err.message);
  });
  return jsonResponse(res, { status: 'ok' });
}

/**
 * Detect whether the daemon itself is running on a headless / remote host.
 * Used by apiCloudAuthStart to advise callers (OCT-Agent UI, CLI) that
 * opening a browser on the daemon side makes no sense. See F-035.
 */
function daemonIsHeadless() {
  const env = process.env;
  const flag = String(env.AWARENESS_HEADLESS ?? '').toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(flag)) return true;
  if (['0', 'false', 'no', 'off'].includes(flag)) return false;
  if (env.SSH_CONNECTION || env.SSH_CLIENT || env.SSH_TTY) return true;
  if (String(env.CODESPACES ?? '').toLowerCase() === 'true') return true;
  if (env.GITPOD_WORKSPACE_ID) return true;
  if (String(env.CLOUD_SHELL ?? '').toLowerCase() === 'true') return true;
  if (process.platform === 'linux' && !env.DISPLAY && !env.WAYLAND_DISPLAY) return true;
  return false;
}

export async function apiCloudAuthStart(daemon, _req, res) {
  const config = daemon._loadConfig();
  const apiBase = config?.cloud?.api_base || 'https://awareness.market/api/v1';
  try {
    const data = await daemon._httpJson('POST', `${apiBase}/auth/device/init`, {});
    track('cloud_auth_initiated', { from_step: 'onboarding' });
    // Enrich response with headless hint + UI-ready verification URL so
    // callers (OCT-Agent Memory UI, setup wizard, etc.) know whether
    // to skip their own "open browser" attempt.
    const verificationUrl = data.user_code && data.verification_uri
      ? `${data.verification_uri}?code=${encodeURIComponent(data.user_code)}`
      : data.verification_uri;
    return jsonResponse(res, {
      ...data,
      verification_url: verificationUrl,
      is_headless: daemonIsHeadless(),
    });
  } catch (err) {
    return jsonResponse(res, { error: 'Failed to start auth: ' + err.message }, 502);
  }
}

export async function apiCloudAuthPoll(daemon, req, res) {
  const body = await readBody(req);
  let params;
  try { params = JSON.parse(body); } catch { return jsonResponse(res, { error: 'Invalid JSON' }, 400); }

  const config = daemon._loadConfig();
  const apiBase = config?.cloud?.api_base || 'https://awareness.market/api/v1';
  const interval = Math.max((params.interval || 5) * 1000, 3000);

  // Headless / cross-device auth needs a much longer total wait than the
  // old 30s cap. Clamp between 30s and 900s (= backend Redis TTL). Default
  // 60s so short-running pollers still return quickly, but callers can
  // pass longer windows for headless flows.
  const requestedTotalMs = Number(params.total_wait_ms ?? params.timeout_ms ?? 60000);
  const totalWaitMs = Math.max(30000, Math.min(900000, requestedTotalMs));
  const maxPolls = Math.max(1, Math.floor(totalWaitMs / interval));

  for (let i = 0; i < maxPolls; i++) {
    try {
      const data = await daemon._httpJson('POST', `${apiBase}/auth/device/poll`, {
        device_code: params.device_code,
      });
      if (data.status === 'approved' && data.api_key) {
        return jsonResponse(res, { api_key: data.api_key, user_id: data.user_id });
      }
      if (data.status === 'expired') {
        return jsonResponse(res, { error: 'Auth expired' }, 410);
      }
    } catch { /* continue polling */ }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return jsonResponse(res, { error: 'Auth timeout', status: 'pending' }, 408);
}

export async function apiCloudListMemories(daemon, _req, res, url) {
  const config = daemon._loadConfig();
  const apiKey = url.searchParams.get('api_key') || config?.cloud?.api_key;
  if (!apiKey) {
    return jsonResponse(res, { error: 'Cloud not configured. Connect via /api/v1/cloud/connect first.' }, 400);
  }

  const apiBase = config?.cloud?.api_base || 'https://awareness.market/api/v1';
  try {
    const data = await daemon._httpJson('GET', `${apiBase}/memories`, null, {
      'Authorization': `Bearer ${apiKey}`,
    });
    return jsonResponse(res, data);
  } catch (err) {
    return jsonResponse(res, { error: 'Failed to list memories: ' + err.message }, 502);
  }
}

export async function apiCloudGetProfile(daemon, _req, res, url) {
  const config = daemon._loadConfig();
  let params = {};
  try {
    const raw = await readBody(_req);
    if (raw) params = JSON.parse(raw);
  } catch {
    return jsonResponse(res, { error: 'Invalid JSON' }, 400);
  }

  const apiKey = params.api_key || config?.cloud?.api_key;
  if (!apiKey) {
    return jsonResponse(res, { error: 'Cloud not configured. Connect via /api/v1/cloud/connect first.' }, 400);
  }

  const apiBase = config?.cloud?.api_base || 'https://awareness.market/api/v1';
  try {
    const data = await daemon._httpJson('GET', `${apiBase}/users/me`, null, {
      'Authorization': `Bearer ${apiKey}`,
    });
    return jsonResponse(res, data);
  } catch (err) {
    return jsonResponse(res, { error: 'Failed to fetch profile: ' + err.message }, 502);
  }
}

export async function apiCloudConnect(daemon, req, res) {
  const body = await readBody(req);
  let params;
  try { params = JSON.parse(body); } catch { return jsonResponse(res, { error: 'Invalid JSON' }, 400); }

  const { api_key, memory_id, memory_name } = params;
  if (!api_key) return jsonResponse(res, { error: 'api_key required' }, 400);

  const configPath = path.join(daemon.awarenessDir, 'config.json');
  const config = daemon._loadConfig();
  config.cloud = {
    ...config.cloud,
    enabled: true,
    api_key,
    memory_id: memory_id || '',
    memory_name: memory_name || '',
    auto_sync: true,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  daemon.config = config;

  if (daemon.cloudSync) {
    try { await daemon.cloudSync.stop(); } catch { /* best-effort */ }
  }
  track('cloud_auth_completed', {});
  try {
    const { CloudSync } = await import('../core/cloud-sync.mjs');
    daemon.cloudSync = new CloudSync(config, daemon.indexer, daemon.memoryStore);
    daemon.cloudSync.start().catch((err) => {
      console.warn('[awareness-local] cloud sync start failed:', err.message);
    });
  } catch { /* CloudSync not available */ }

  return jsonResponse(res, { status: 'ok', cloud_enabled: true });
}

export async function apiCloudDisconnect(daemon, _req, res) {
  const configPath = path.join(daemon.awarenessDir, 'config.json');
  const config = daemon._loadConfig();
  config.cloud = { ...config.cloud, enabled: false, api_key: '', memory_id: '' };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  daemon.config = config;

  if (daemon.cloudSync) {
    try { await daemon.cloudSync.stop(); } catch { /* best-effort */ }
    daemon.cloudSync = null;
  }

  return jsonResponse(res, { status: 'ok', cloud_enabled: false });
}

// =====================================================================
// Wiki UI API endpoints
// =====================================================================

export function apiListSkills(daemon, _req, res, url) {
  const status = url.searchParams.get('status') || 'active';
  const limit = parseInt(url.searchParams.get('limit') || '200', 10);

  if (!daemon.indexer) {
    return jsonResponse(res, { items: [], total: 0 });
  }

  try {
    const rows = daemon.indexer.db
      .prepare(
        `SELECT * FROM skills WHERE status = ? ORDER BY decay_score DESC, created_at DESC LIMIT ?`
      )
      .all(status, limit);

    const total = daemon.indexer.db
      .prepare(`SELECT COUNT(*) AS c FROM skills WHERE status = ?`)
      .get(status)?.c ?? 0;

    const items = rows.map((s) => ({
      ...s,
      methods: _safeJsonParse(s.methods, []),
      trigger_conditions: _safeJsonParse(s.trigger_conditions, []),
      tags: _safeJsonParse(s.tags, []),
      source_card_ids: _safeJsonParse(s.source_card_ids, []),
    }));

    return jsonResponse(res, { items, total });
  } catch {
    // skills table may not exist
    return jsonResponse(res, { items: [], total: 0 });
  }
}

export function apiMarkSkillUsed(daemon, _req, res, skillId) {
  if (!daemon.indexer) {
    return jsonResponse(res, { error: 'Indexer not available' }, 503);
  }

  const now = nowISO();
  try {
    const result = daemon.indexer.db
      .prepare(
        `UPDATE skills SET usage_count = usage_count + 1, last_used_at = ?, decay_score = 1.0, updated_at = ? WHERE id = ?`
      )
      .run(now, now, skillId);

    if (result.changes === 0) {
      return jsonResponse(res, { error: 'Skill not found' }, 404);
    }
    return jsonResponse(res, { success: true, skill_id: skillId });
  } catch {
    return jsonResponse(res, { error: 'Skills table not available' }, 503);
  }
}

export async function apiExportSkill(daemon, _req, res, skillId, url) {
  const format = (url?.searchParams?.get('format') || 'skillmd').toLowerCase();
  if (format !== 'skillmd' && format !== 'md' && format !== 'markdown') {
    return jsonResponse(res, { error: `Unsupported format '${format}'. Use format=skillmd.` }, 400);
  }
  if (!daemon.indexer) {
    return jsonResponse(res, { error: 'Indexer not available' }, 503);
  }

  let row;
  try {
    row = daemon.indexer.db
      .prepare('SELECT * FROM skills WHERE id = ?')
      .get(skillId);
  } catch {
    return jsonResponse(res, { error: 'Skills table not available' }, 503);
  }
  if (!row) return jsonResponse(res, { error: 'Skill not found' }, 404);

  // Rehydrate JSON-encoded columns.
  const parse = (s, fallback) => {
    try { return JSON.parse(s); } catch { return fallback; }
  };
  const skill = {
    name: row.name,
    summary: row.summary,
    methods: Array.isArray(row.methods) ? row.methods : parse(row.methods, []),
    trigger_conditions: Array.isArray(row.trigger_conditions)
      ? row.trigger_conditions
      : parse(row.trigger_conditions, []),
    tags: Array.isArray(row.tags) ? row.tags : parse(row.tags, []),
  };

  const { buildSkillMd } = await import('../core/skill-md-formatter.mjs');
  const { slug, content } = buildSkillMd(skill);

  res.writeHead(200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Disposition': `attachment; filename="${slug}.skill.md"`,
    'Cache-Control': 'no-store',
  });
  res.end(content);
}

export async function apiUpdateSkill(daemon, req, res, skillId) {
  if (!daemon.indexer) {
    return jsonResponse(res, { error: 'Indexer not available' }, 503);
  }

  const raw = await readBody(req);
  let payload;
  try { payload = JSON.parse(raw); } catch { return jsonResponse(res, { error: 'Invalid JSON' }, 400); }

  const skill = daemon.indexer.db.prepare('SELECT * FROM skills WHERE id = ?').get(skillId);
  if (!skill) {
    return jsonResponse(res, { error: 'Skill not found' }, 404);
  }

  const now = nowISO();
  const updates = [];
  const params = [];

  if (payload.status !== undefined) { updates.push('status = ?'); params.push(payload.status); }
  if (payload.pinned !== undefined) {
    updates.push('pinned = ?');
    params.push(payload.pinned ? 1 : 0);
    if (payload.pinned) { updates.push('decay_score = 1.0'); }
  }
  if (payload.name !== undefined) { updates.push('name = ?'); params.push(payload.name); }
  if (payload.summary !== undefined) { updates.push('summary = ?'); params.push(payload.summary); }

  if (updates.length === 0) {
    return jsonResponse(res, { error: 'No valid fields to update' }, 400);
  }

  updates.push('updated_at = ?');
  params.push(now, skillId);

  daemon.indexer.db
    .prepare(`UPDATE skills SET ${updates.join(', ')} WHERE id = ?`)
    .run(...params);

  const updated = daemon.indexer.db.prepare('SELECT * FROM skills WHERE id = ?').get(skillId);
  return jsonResponse(res, {
    status: 'ok',
    skill: {
      ...updated,
      methods: _safeJsonParse(updated.methods, []),
      trigger_conditions: _safeJsonParse(updated.trigger_conditions, []),
      tags: _safeJsonParse(updated.tags, []),
      source_card_ids: _safeJsonParse(updated.source_card_ids, []),
    },
  });
}

/**
 * Compute the live, authoritative member count for a MOC card by counting
 * DISTINCT active non-MOC cards whose tags JSON contains ANY of the MOC's
 * tags. Uses the same tag-LIKE query shape as indexer.tryAutoMoc so counts
 * stay consistent across write / read paths.
 *
 * Stored `link_count_outgoing` can go stale when member cards are deleted or
 * superseded — `tryAutoMoc` only runs on write, so it won't catch removals.
 * We recount on every read to guarantee the sidebar badge matches what the
 * topic detail page actually renders.
 *
 * @param {object} db  better-sqlite3 database handle
 * @param {string[]} tags  MOC card's parsed tags array
 * @returns {number}
 */
function _countMocMembers(db, tags) {
  if (!Array.isArray(tags) || tags.length === 0) return 0;
  const seen = new Set();
  const stmt = db.prepare(
    `SELECT id FROM knowledge_cards
     WHERE status = 'active'
       AND (card_type IS NULL OR card_type != 'moc')
       AND tags LIKE ?`
  );
  for (const rawTag of tags) {
    const tag = String(rawTag || '').trim().toLowerCase();
    if (!tag) continue;
    const rows = stmt.all(`%"${tag}"%`);
    for (const row of rows) seen.add(row.id);
  }
  return seen.size;
}

export function apiListTopics(daemon, _req, res, _url) {
  if (!daemon.indexer) {
    return jsonResponse(res, { items: [], total: 0 });
  }

  // Primary: Topics = MOC cards (card_type='moc'), matching cloud backend
  const mocRows = daemon.indexer.db
    .prepare(
      `SELECT id, title, summary, tags, link_count_outgoing, created_at, last_touched_at
       FROM knowledge_cards
       WHERE card_type = 'moc' AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 100`
    )
    .all();

  // Step 1: materialize MOC-based topics (if any).
  const mocItems = [];
  const coveredTags = new Set();
  for (const r of mocRows) {
    const parsedTags = _safeJsonParse(r.tags, []);
    const liveCount = _countMocMembers(daemon.indexer.db, parsedTags);
    if (liveCount <= 0) continue;
    for (const tg of parsedTags) coveredTags.add(String(tg).trim().toLowerCase());
    mocItems.push({
      id: r.id,
      title: r.title,
      summary: r.summary || null,
      card_count: liveCount,
      last_updated_at: r.last_touched_at || r.created_at,
      source: 'moc',
      tags: parsedTags,
    });
  }

  // Step 2: ALWAYS augment with tag-hotness topics (not just fallback).
  // An MOC only exists where tryAutoMoc fired; most older cards — the
  // bulk of the knowledge base — never produced one. Without this merge
  // the sidebar shows just the handful of MOCs and hides hundreds of
  // cards behind no topic at all.
  const tagRows = daemon.indexer.db
    .prepare(
      `SELECT tags FROM knowledge_cards
       WHERE status = 'active' AND tags IS NOT NULL AND tags != '' AND tags != '[]'`
    )
    .all();

  const tagCounts = {};
  for (const row of tagRows) {
    let tags;
    try { tags = JSON.parse(row.tags); } catch { continue; }
    if (!Array.isArray(tags)) continue;
    for (const tag of tags) {
      const t = String(tag).trim().toLowerCase();
      if (!t || t.length < 2 || t === 'test' || t === 'null') continue;
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }

  // Only show tags with 2+ cards as topics, drop any tag already covered by
  // an MOC (so we don't list the same theme twice).
  const tagItems = Object.entries(tagCounts)
    .filter(([tag, count]) => count >= 2 && !coveredTags.has(tag))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([tag, count]) => ({
      id: `tag_${tag}`,
      title: tag.replace(/\b\w/g, (c) => c.toUpperCase()),
      summary: null,
      card_count: count,
      last_updated_at: null,
      source: 'tag',
    }));

  const items = [...mocItems, ...tagItems];
  return jsonResponse(res, { items, total: items.length });
}

export function apiTimeline(daemon, _req, res, url) {
  const days = parseInt(url.searchParams.get('days') || '30', 10);
  const limit = parseInt(url.searchParams.get('limit') || '500', 10);

  if (!daemon.indexer) {
    return jsonResponse(res, { by_day: [], total: 0 });
  }

  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const rows = daemon.indexer.db
    .prepare(
      `SELECT id, title, type, source, created_at, tags
       FROM memories
       WHERE status = 'active' AND created_at > ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(cutoff, limit);

  // Group by day
  const dayMap = {};
  for (const r of rows) {
    const day = r.created_at ? r.created_at.substring(0, 10) : 'unknown';
    if (!dayMap[day]) dayMap[day] = [];
    dayMap[day].push(r);
  }

  const by_day = Object.entries(dayMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, events]) => ({ date, events, count: events.length }));

  return jsonResponse(res, { by_day, total: rows.length });
}

export async function apiHybridSearch(daemon, _req, res, url) {
  const q = url.searchParams.get('q') || '';
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const budget = parseInt(url.searchParams.get('budget') || '20000', 10);
  const scope = url.searchParams.get('scope') || 'all';

  if (!q) {
    return jsonResponse(res, { items: [], total: 0, query: q });
  }

  if (daemon.search) {
    // F-053 Phase 3 · primary path: unifiedCascadeSearch applies query-type
    // routing (recall-recent / concept / default), recency channel, budget-tier
    // bucket shaping, and cross-encoder rerank. Web UI + onboarding must hit
    // this path so they match the MCP `awareness_recall` behavior.
    if (typeof daemon.search.unifiedCascadeSearch === 'function') {
      try {
        const out = await daemon.search.unifiedCascadeSearch(q, { tokenBudget: budget, limit });
        const items = Array.isArray(out?.results) ? out.results : Array.isArray(out) ? out : [];
        return jsonResponse(res, { items, total: items.length, query: q });
      } catch (err) {
        console.error('[api] unified cascade search error:', err.message);
      }
    }
    // Legacy fallback for pre-Phase-3 daemon builds (no unifiedCascadeSearch).
    try {
      const results = await daemon.search.recall({
        semantic_query: q,
        keyword_query: q,
        scope,
        recall_mode: 'hybrid',
        limit,
        detail: 'summary',
      });
      return jsonResponse(res, { items: results, total: results.length, query: q });
    } catch (err) {
      console.error('[api] hybrid search recall fallback error:', err.message);
    }
  }

  // Fallback to FTS-only
  if (daemon.indexer) {
    const ftsResults = daemon.indexer.search(q, { limit });
    const kcResults = daemon.indexer.searchKnowledge(q, { limit: Math.ceil(limit / 2) });
    const merged = [...kcResults.map((r) => ({ ...r, type: 'knowledge_card' })), ...ftsResults];
    const seen = new Set();
    const deduped = merged.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    return jsonResponse(res, { items: deduped.slice(0, limit), total: deduped.length, query: q });
  }

  return jsonResponse(res, { items: [], total: 0, query: q });
}

export async function apiGetKnowledgeCard(daemon, _req, res, cardId) {
  if (!daemon.indexer) {
    return jsonResponse(res, { error: 'Indexer not available' }, 503);
  }

  // Tag pseudo-topic support (id prefix `tag_<tagname>`). The sidebar lists
  // both MOC cards and tag aggregations as topics; when a user clicks a
  // tag topic we need the authoritative member list from the daemon
  // rather than relying on the client's capped 50-card snapshot. Without
  // this fallback, tag topics whose members are older than the top-50
  // render as "indexing… then blank" because the client never fetches
  // them from SQLite directly.
  if (typeof cardId === 'string' && cardId.startsWith('tag_')) {
    const tag = cardId.slice(4).trim().toLowerCase();
    if (!tag) return jsonResponse(res, { error: 'Empty tag' }, 400);
    const rows = daemon.indexer.db.prepare(
      `SELECT id, title, summary, category, growth_stage, confidence, created_at, tags
       FROM knowledge_cards
       WHERE status = 'active'
         AND (card_type IS NULL OR card_type != 'moc')
         AND tags LIKE ?
       ORDER BY created_at DESC
       LIMIT 500`
    ).all(`%"${tag}"%`);
    // Yield to event loop after the synchronous full-table LIKE scan so a
    // burst of clicks (sidebar topic → detail) doesn't block /healthz or
    // other parallel GETs while a single request hogs better-sqlite3.
    await new Promise((r) => setImmediate(r));
    const members = rows.map((row) => ({ ...row, tags: _safeJsonParse(row.tags, []) }));
    return jsonResponse(res, {
      id: cardId,
      card_type: 'tag',
      title: tag.replace(/\b\w/g, (c) => c.toUpperCase()),
      tags: [tag],
      source_memories: [],
      related_cards: [],
      evolution_chain: [],
      members,
    });
  }

  const card = daemon.indexer.db
    .prepare('SELECT * FROM knowledge_cards WHERE id = ?')
    .get(cardId);

  if (!card) {
    return jsonResponse(res, { error: 'Card not found' }, 404);
  }

  // Get related cards (same category, recent)
  const related = daemon.indexer.db
    .prepare(
      `SELECT id, title, category, growth_stage, confidence, created_at
       FROM knowledge_cards
       WHERE status = 'active' AND category = ? AND id != ?
       ORDER BY created_at DESC LIMIT 5`
    )
    .all(card.category, cardId);

  // Parse source_memories to find linked memory IDs
  let sourceMemories = [];
  try {
    sourceMemories = JSON.parse(card.source_memories || '[]');
  } catch { sourceMemories = []; }

  // Get evolution chain
  const chain = daemon.indexer.getEvolutionChain
    ? daemon.indexer.getEvolutionChain(cardId)
    : [];

  // MOC cards: resolve members via tag-match. PRIOR IMPLEMENTATION ran one
  // full-table `tags LIKE '%"<tag>"%'` per MOC tag — for a 5-tag MOC over
  // 2.5k active cards this means 5 sequential synchronous scans, each
  // ~50-150 ms in better-sqlite3, blocking the event loop the whole time.
  // NEW: pull the candidate set ONCE with a single `tags LIKE '%"' || ? || '"%' OR ...`
  // (one pass), parse tags in JS, and check intersection with mocTags Set.
  // Same result set, ~5× less wall-time, and we yield to the loop after
  // the scan so concurrent /healthz / other GETs don't queue.
  let members = [];
  if (card.card_type === 'moc') {
    const mocTags = _safeJsonParse(card.tags, [])
      .map((t) => String(t || '').trim().toLowerCase())
      .filter(Boolean);
    if (mocTags.length > 0) {
      const tagSet = new Set(mocTags);
      // Build OR-of-LIKEs so SQLite scans the table exactly once instead
      // of once per tag. The LIMIT 500 sort still applies post-OR.
      const orClause = mocTags.map(() => 'tags LIKE ?').join(' OR ');
      const params = mocTags.map((t) => `%"${t}"%`);
      const rows = daemon.indexer.db.prepare(
        `SELECT id, title, summary, category, growth_stage, confidence, created_at, tags
         FROM knowledge_cards
         WHERE status = 'active'
           AND (card_type IS NULL OR card_type != 'moc')
           AND (${orClause})
         ORDER BY created_at DESC
         LIMIT 500`
      ).all(...params);
      // Yield before the JS filter so even a 500-row response can't tail
      // a 100ms scan with another 50ms of synchronous JSON.parse work.
      await new Promise((r) => setImmediate(r));
      const seen = new Set();
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        const parsedTags = _safeJsonParse(row.tags, []);
        // Defensive intersect — the OR-of-LIKEs may match substrings, so
        // re-confirm the tag is actually present in the parsed array.
        const hasMocTag = Array.isArray(parsedTags) &&
          parsedTags.some((t) => tagSet.has(String(t || '').trim().toLowerCase()));
        if (!hasMocTag) continue;
        seen.add(row.id);
        members.push({ ...row, tags: parsedTags });
      }
    }
  }

  return jsonResponse(res, {
    ...card,
    tags: _safeJsonParse(card.tags, []),
    source_memories: sourceMemories,
    related_cards: related,
    evolution_chain: chain,
    members,
  });
}

export function apiSyncRecent(daemon, _req, res, _url) {
  if (!daemon.indexer) {
    return jsonResponse(res, { pushed_memories: [], pushed_cards: [], pulled_cards: [] });
  }

  const pushed_memories = daemon.indexer.db.prepare(
    `SELECT id, title, type, last_pushed_at FROM memories
     WHERE sync_status = 'synced' AND last_pushed_at IS NOT NULL
     ORDER BY last_pushed_at DESC LIMIT 10`
  ).all();

  const pushed_cards = daemon.indexer.db.prepare(
    `SELECT id, title, category, card_type, last_pushed_at FROM knowledge_cards
     WHERE sync_status = 'synced' AND last_pushed_at IS NOT NULL
     ORDER BY last_pushed_at DESC LIMIT 10`
  ).all();

  const pulled_cards = daemon.indexer.db.prepare(
    `SELECT id, title, category, card_type, last_pulled_at FROM knowledge_cards
     WHERE last_pulled_at IS NOT NULL
     ORDER BY last_pulled_at DESC LIMIT 10`
  ).all();

  // Skills sync status
  let skills_count = 0;
  try {
    skills_count = daemon.indexer.db.prepare(
      "SELECT COUNT(*) AS c FROM skills WHERE status = 'active'"
    ).get()?.c ?? 0;
  } catch { /* skills table may not exist */ }

  return jsonResponse(res, {
    pushed_memories,
    pushed_cards,
    pulled_cards,
    skills_sync: { local_count: skills_count, cloud_sync_supported: true },
  });
}

export function apiGetMemory(daemon, _req, res, memId) {
  if (!daemon.indexer) {
    return jsonResponse(res, { error: 'Indexer not available' }, 503);
  }

  const row = daemon.indexer.db
    .prepare(
      `SELECT m.*, f.content AS fts_content
       FROM memories m
       LEFT JOIN memories_fts f ON f.id = m.id
       WHERE m.id = ?`
    )
    .get(memId);

  if (!row) {
    return jsonResponse(res, { error: 'Memory not found' }, 404);
  }

  // Also try to read full content from file if available
  let fullContent = row.fts_content || '';
  if (row.filepath) {
    try {
      const raw = fs.readFileSync(row.filepath, 'utf-8');
      // Strip YAML frontmatter if present
      const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
      fullContent = fmMatch ? fmMatch[1].trim() : raw;
    } catch { /* file may not exist, use fts_content */ }
  }

  return jsonResponse(res, {
    ...row,
    content: fullContent,
    tags: _safeJsonParse(row.tags, []),
  });
}

export async function apiSwitchWorkspace(daemon, req, res) {
  const raw = await readBody(req);
  let payload;
  try { payload = JSON.parse(raw); } catch { return jsonResponse(res, { error: 'Invalid JSON' }, 400); }

  const { project_dir } = payload;
  if (!project_dir) return jsonResponse(res, { error: 'project_dir required' }, 400);

  if (!daemon.switchProject) {
    return jsonResponse(res, { error: 'Workspace switching not supported in this daemon version' }, 501);
  }

  try {
    const result = await daemon.switchProject(project_dir);
    return jsonResponse(res, { status: 'ok', ...result });
  } catch (err) {
    return jsonResponse(res, { error: err.message }, 500);
  }
}

// =====================================================================
// Perception API
// =====================================================================

export function apiListPerceptions(daemon, _req, res, url) {
  if (!daemon.indexer?.listPerceptionStates) {
    return jsonResponse(res, { items: [], counts: {}, total: 0 });
  }

  const stateParam = url.searchParams.get('state') || 'active';
  const type = url.searchParams.get('type') || null;
  const limit = parseInt(url.searchParams.get('limit') || '100', 10);

  // Special: 'all' means no filter
  const stateFilter = stateParam === 'all' ? null : stateParam.split(',');
  const opts = { limit };
  if (stateFilter) opts.state = stateFilter;
  if (type) opts.type = type;

  const rows = daemon.indexer.listPerceptionStates(opts);
  const items = rows.map((r) => ({
    ...r,
    metadata: _safeJsonParse(r.metadata, null),
  }));

  const counts = daemon.indexer.countPerceptions();
  return jsonResponse(res, { items, counts, total: items.length });
}

export async function apiAcknowledgePerception(daemon, req, res, signalId) {
  if (!daemon.indexer?.acknowledgePerception) {
    return jsonResponse(res, { error: 'Perception not supported' }, 503);
  }

  let body = {};
  try {
    const raw = await readBody(req);
    if (raw) body = JSON.parse(raw);
  } catch { /* empty body ok */ }

  const snoozeDays = Number.isFinite(body.snooze_days) ? body.snooze_days : 7;
  const ok = daemon.indexer.acknowledgePerception(signalId, snoozeDays);
  if (!ok) return jsonResponse(res, { error: 'Signal not found' }, 404);
  return jsonResponse(res, { status: 'ok', signal_id: signalId, snoozed_days: snoozeDays });
}

export function apiDismissPerception(daemon, _req, res, signalId) {
  if (!daemon.indexer?.dismissPerception) {
    return jsonResponse(res, { error: 'Perception not supported' }, 503);
  }
  const ok = daemon.indexer.dismissPerception(signalId);
  if (!ok) return jsonResponse(res, { error: 'Signal not found' }, 404);
  return jsonResponse(res, { status: 'ok', signal_id: signalId });
}

export function apiRestorePerception(daemon, _req, res, signalId) {
  if (!daemon.indexer?.restorePerception) {
    return jsonResponse(res, { error: 'Perception not supported' }, 503);
  }
  const ok = daemon.indexer.restorePerception(signalId);
  if (!ok) return jsonResponse(res, { error: 'Signal not found' }, 404);
  return jsonResponse(res, { status: 'ok', signal_id: signalId });
}

export function apiRefreshPerceptions(daemon, _req, res) {
  // Refresh is a no-op at the moment — perceptions regenerate on every record/init.
  // But we clean up stale rows to keep the state table tidy.
  if (!daemon.indexer?.cleanupPerceptionState) {
    return jsonResponse(res, { status: 'ok', cleaned: 0 });
  }
  const cleaned = daemon.indexer.cleanupPerceptionState();
  return jsonResponse(res, { status: 'ok', cleaned });
}

function _safeJsonParse(val, fallback) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); if (Array.isArray(p)) return p; } catch {}
  }
  return fallback;
}
