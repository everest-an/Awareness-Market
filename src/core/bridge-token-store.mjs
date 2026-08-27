/**
 * F-064 Phase 3 · Bridge Token persistence (Option C).
 *
 * The browser extension's service worker runs off a `chrome-extension://<id>`
 * origin, which is NOT in the daemon's site Origin allowlist. Rather than
 * blanket-trusting every extension origin (which any malicious extension could
 * spoof-free but still abuse), each install mints a random bearer token that
 * the daemon validates on `POST /api/v1/memories`.
 *
 * Security model:
 *  - Token MINTING is Origin-gated (only chrome-extension://* / moz-extension://*
 *    / localhost / no-Origin may mint) so a random website in a normal tab
 *    cannot steal a token via the CORS-`*` response. (See api-handlers.mjs
 *    isTokenMintOrigin.)
 *  - A VALID token bypasses the site Origin allowlist on write.
 *  - Residual risk (documented): a locally-installed *malicious extension*
 *    could mint its own token. Phase 4 upgrades to a WebUI pairing-code so the
 *    user explicitly authorizes a specific extension. For a single-user local
 *    desktop daemon this is an accepted MVP tradeoff.
 *
 * Stored GLOBALLY at `~/.awareness/bridge-tokens.json` (NOT per-workspace) —
 * one daemon serves all workspaces and the extension pairs once per machine.
 *
 * Shape on disk:
 *   { "tokens": [ { token, label, created_at, last_used_at } ] }
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const DEFAULT_TOKENS_FILE = path.join(os.homedir(), '.awareness', 'bridge-tokens.json');

/** Generate an unguessable token with a readable prefix. */
export function generateBridgeToken() {
  return `brg_${crypto.randomBytes(24).toString('hex')}`;
}

export class BridgeTokenStore {
  /**
   * @param {string} [filePath] — override on-disk location (tests inject tmp path).
   */
  constructor(filePath = DEFAULT_TOKENS_FILE) {
    this.filePath = filePath;
    this._tokens = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        if (Array.isArray(parsed?.tokens)) return parsed.tokens;
      }
    } catch { /* corrupted → start empty */ }
    return [];
  }

  _persist() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ tokens: this._tokens }, null, 2), 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }

  /** True if at least one token has been minted. */
  hasAny() {
    return this._tokens.length > 0;
  }

  /** Number of minted tokens (non-sensitive; safe to expose). */
  count() {
    return this._tokens.length;
  }

  /**
   * Constant-time-ish validity check. Also stamps last_used_at.
   * @param {string} token
   * @returns {boolean}
   */
  isValid(token) {
    if (typeof token !== 'string' || !token.trim()) return false;
    const idx = this._tokens.findIndex((t) => t.token === token);
    if (idx < 0) return false;
    this._tokens[idx].last_used_at = new Date().toISOString();
    try { this._persist(); } catch { /* last_used stamp is best-effort */ }
    return true;
  }

  /**
   * Mint and persist a new token.
   * @param {string} [label] — optional human label (e.g. "chrome-ext").
   * @returns {{ token: string, label: string|null, created_at: string }}
   */
  mint(label) {
    const record = {
      token: generateBridgeToken(),
      label: label != null ? String(label) : null,
      created_at: new Date().toISOString(),
      last_used_at: null,
    };
    this._tokens.push(record);
    this._persist();
    return { token: record.token, label: record.label, created_at: record.created_at };
  }

  /**
   * Revoke a token.
   * @param {string} token
   * @returns {boolean} true if a token was removed.
   */
  revoke(token) {
    if (typeof token !== 'string' || !token.trim()) return false;
    const before = this._tokens.length;
    this._tokens = this._tokens.filter((t) => t.token !== token);
    if (this._tokens.length === before) return false;
    this._persist();
    return true;
  }
}
