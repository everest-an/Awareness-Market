/**
 * Telemetry — opt-in anonymous usage analytics (F-040 Phase 2).
 *
 * Principles:
 *  - Default-on with explicit opt-out: enabled unless config.telemetry.enabled === false.
 *  - Anonymous: installation_id = SHA-256(device_id + salt). No user identity.
 *  - No sensitive payloads: only whitelisted event_types + sanitized properties.
 *  - Fire-and-forget: batched POST, silent failure, never blocks daemon.
 *  - Offline-resilient: queue persisted to .awareness/telemetry-queue.json.
 *
 * Server endpoint: POST {endpoint}/telemetry/events
 *   Default endpoint: https://awareness.market/api/v1
 *   Override via config.telemetry.endpoint or AWARENESS_TELEMETRY_ENDPOINT env.
 *
 * PRD: docs/features/onboarding-and-telemetry/README.md §5
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const INSTALLATION_SALT = 'awareness-telemetry-v1';
const DEFAULT_ENDPOINT = 'https://awareness.market/api/v1';
// node:test sets NODE_TEST_CONTEXT in its worker process. Used as a structural
// guard so a test run can never ship events to the PRODUCTION endpoint by
// accident (see the `remote` note below).
const IS_TEST_RUN = Boolean(process.env.NODE_TEST_CONTEXT);
const FLUSH_MS = 60_000;
const BATCH_TRIGGER = 20;
const MAX_QUEUE = 500; // hard cap before dropping oldest

const ALLOWED_EVENT_TYPES = new Set([
  'daemon_started',
  'onboarding_step',
  'onboarding_completed',
  'onboarding_skipped',
  'mcp_tool_called',
  'recall_mode_used',
  'project_scanned',
  'cloud_auth_initiated',
  'cloud_auth_completed',
  'feature_blocked',
  'error_occurred',
]);

// Whitelist of property keys allowed per event type. Anything else is dropped.
const ALLOWED_PROPERTY_KEYS = new Set([
  'daemon_version', 'os', 'node_version', 'arch', 'locale',
  'step_number', 'step_name', 'at_step', 'skipped_steps', 'duration_sec',
  'tool_name', 'success',
  'mode', 'scope',
  'file_count_bucket',
  'from_step',
  'feature_name',
  'error_code', 'component',
]);

export class Telemetry {
  constructor({ config, projectDir, version = 'unknown', remote } = {}) {
    const telCfg = config?.telemetry || {};
    // Default-on: only disabled when user explicitly sets enabled=false.
    this.enabled = telCfg.enabled !== false;
    // Remote shipping. enabled=true still records events in-memory (so the
    // Privacy Settings page can show them), but network sends can be turned
    // off independently.
    //
    // `remote:false` disables it outright. Belt-and-braces: a TEST RUN is never
    // allowed to reach the PRODUCTION endpoint even if the test forgot to opt
    // out — that leak shipped 965 fixture rows to prod analytics over 6 months.
    // Tests that deliberately exercise the network point at their own endpoint
    // (the established `https://example.test/...` convention), so only the real
    // production URL is blocked, not the send path itself.
    this.endpoint = telCfg.endpoint || process.env.AWARENESS_TELEMETRY_ENDPOINT || DEFAULT_ENDPOINT;
    const hitsProdDefault = this.endpoint === DEFAULT_ENDPOINT;
    this.remote =
      remote !== false && telCfg.remote !== false && !(IS_TEST_RUN && hitsProdDefault);
    this.version = version;
    this.projectDir = projectDir;
    this.deviceId = config?.device?.id || '';
    this.installationId = this._deriveInstallationId(this.deviceId);
    this.queue = this._restoreQueue();
    this.timer = null;

    if (this.enabled) this._startFlushLoop();
  }

  _deriveInstallationId(deviceId) {
    if (!deviceId) return 'anon-' + crypto.randomBytes(6).toString('hex');
    return crypto.createHash('sha256').update(deviceId + INSTALLATION_SALT).digest('hex');
  }

  _queuePath() {
    if (!this.projectDir) return null;
    return path.join(this.projectDir, '.awareness', 'telemetry-queue.json');
  }

  _restoreQueue() {
    const p = this._queuePath();
    if (!p || !fs.existsSync(p)) return [];
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE) : [];
    } catch { return []; }
  }

  _persistQueue() {
    const p = this._queuePath();
    if (!p) return;
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(this.queue), 'utf-8');
    } catch { /* silent */ }
  }

  _sanitize(props = {}) {
    const out = {};
    for (const [k, v] of Object.entries(props)) {
      if (!ALLOWED_PROPERTY_KEYS.has(k)) continue;
      if (v == null) continue;
      if (typeof v === 'string' && v.length > 100) continue; // guard against leaks
      if (typeof v === 'object' && !Array.isArray(v)) continue;
      out[k] = v;
    }
    return out;
  }

  setEnabled(enabled) {
    const changed = this.enabled !== !!enabled;
    this.enabled = !!enabled;
    if (this.enabled && !this.timer) this._startFlushLoop();
    if (!this.enabled && this.timer) { clearInterval(this.timer); this.timer = null; }
    if (changed && !this.enabled) {
      // Stopped: drop queued events to respect opt-out immediately.
      this.queue = [];
      this._persistQueue();
    }
  }

  /**
   * Track an event. No-op when disabled.
   * @param {string} eventType
   * @param {object} properties
   */
  track(eventType, properties = {}) {
    if (!this.enabled) return;
    if (!ALLOWED_EVENT_TYPES.has(eventType)) return;
    const evt = {
      event_type: eventType,
      installation_id: this.installationId,
      timestamp: new Date().toISOString(),
      properties: this._sanitize(properties),
    };
    this.queue.push(evt);
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
    this._persistQueue();
    if (this.queue.length >= BATCH_TRIGGER) this.flush();
  }

  async flush() {
    if (!this.enabled || this.queue.length === 0) return;
    // remote=false (tests): keep the events in memory and never touch the network.
    if (!this.remote) return;
    const batch = this.queue.splice(0);
    this._persistQueue();
    try {
      const url = this.endpoint.replace(/\/$/, '') + '/telemetry/events';
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      }).catch(() => {});
    } catch { /* silent fire-and-forget */ }
  }

  _startFlushLoop() {
    if (this.timer) return;
    this.timer = setInterval(() => { this.flush(); }, FLUSH_MS);
    this.timer.unref?.();
  }

  /** Recent events (for Privacy Settings page). */
  listRecent(limit = 50) {
    return this.queue.slice(-limit);
  }

  /** Deletion: clear local queue + send delete signal to server. */
  async deleteLocal() {
    this.queue = [];
    this._persistQueue();
    if (!this.remote) return;
    try {
      const url = this.endpoint.replace(/\/$/, '') + '/telemetry/forget';
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installation_id: this.installationId }),
      }).catch(() => {});
    } catch {}
  }

  shutdown() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    return this.flush();
  }
}

let _singleton = null;

export function initTelemetry(opts) {
  _singleton = new Telemetry(opts);
  return _singleton;
}

export function getTelemetry() { return _singleton; }

export function track(eventType, properties) {
  _singleton?.track(eventType, properties);
}
