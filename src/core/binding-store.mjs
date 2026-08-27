/**
 * F-064 Phase 2 · External Bindings persistence.
 *
 * Persists the routing table the browser extension needs: which chat site
 * (doubao.com / gemini.google.com / …) maps to which local workspace and
 * external session_id. Stored GLOBALLY at `~/.awareness/external-bindings.json`
 * (NOT per-workspace) because the extension must resolve a site → workspace
 * before it knows which daemon/workspace to talk to.
 *
 * Shape on disk:
 *   { "bindings": [ { id, site, workspace, session_id, created_at, updated_at } ] }
 *
 * One active binding per `site` — POSTing the same site upserts (replaces)
 * rather than appending a duplicate.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_BINDINGS_FILE = path.join(os.homedir(), '.awareness', 'external-bindings.json');

/** Normalise a site string: lowercase, strip scheme/path, keep bare hostname. */
export function normalizeSite(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.trim().toLowerCase();
  if (!s) return '';
  // Accept a full URL or a bare hostname.
  if (s.includes('://')) {
    try { s = new URL(s).hostname; } catch { /* fall through to manual strip */ }
  }
  // Strip any leftover path / port.
  s = s.replace(/[/:].*$/, '');
  return s;
}

export class BindingStore {
  /**
   * @param {string} [filePath] — override the on-disk location (tests inject a tmp path).
   */
  constructor(filePath = DEFAULT_BINDINGS_FILE) {
    this.filePath = filePath;
    this._bindings = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        if (Array.isArray(parsed?.bindings)) return parsed.bindings;
      }
    } catch { /* corrupted → start empty */ }
    return [];
  }

  _persist() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ bindings: this._bindings }, null, 2), 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }

  /** Return all bindings (defensive copy). */
  list() {
    return this._bindings.map((b) => ({ ...b }));
  }

  /** Look up the active binding for a site, or null. */
  get(site) {
    const key = normalizeSite(site);
    if (!key) return null;
    const found = this._bindings.find((b) => b.site === key);
    return found ? { ...found } : null;
  }

  /**
   * Upsert a binding keyed by site. Replaces any existing binding for the
   * same site (one route per site). Returns the stored record.
   *
   * @param {{ site: string, workspace?: string, session_id?: string }} entry
   * @returns {{ id, site, workspace, session_id, created_at, updated_at }}
   */
  upsert(entry) {
    const site = normalizeSite(entry?.site);
    if (!site) throw new Error('site is required');
    const now = new Date().toISOString();
    const idx = this._bindings.findIndex((b) => b.site === site);
    if (idx >= 0) {
      const prev = this._bindings[idx];
      const merged = {
        ...prev,
        site,
        workspace: entry.workspace != null ? String(entry.workspace) : prev.workspace ?? null,
        session_id: entry.session_id != null ? String(entry.session_id) : prev.session_id ?? null,
        updated_at: now,
      };
      this._bindings[idx] = merged;
      this._persist();
      return { ...merged };
    }
    const record = {
      id: `bind_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      site,
      workspace: entry.workspace != null ? String(entry.workspace) : null,
      session_id: entry.session_id != null ? String(entry.session_id) : null,
      created_at: now,
      updated_at: now,
    };
    this._bindings.push(record);
    this._persist();
    return { ...record };
  }

  /**
   * Remove the binding for a site.
   * @param {string} site
   * @returns {boolean} true if a binding was removed.
   */
  remove(site) {
    const key = normalizeSite(site);
    if (!key) return false;
    const before = this._bindings.length;
    this._bindings = this._bindings.filter((b) => b.site !== key);
    if (this._bindings.length === before) return false;
    this._persist();
    return true;
  }
}
