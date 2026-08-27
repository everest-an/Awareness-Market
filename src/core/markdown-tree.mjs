/**
 * markdown-tree.mjs — Wiki-style folder layout + stable slug generation.
 *
 * Part of F-082 (Markdown-First Memory). All writes are event-driven:
 * the layout helpers are invoked synchronously from awareness_record's
 * submit-insights pipeline. No cron, no background scan.
 *
 * Layout (under daemon.awarenessDir, typically `~/.awareness/`):
 *   cards/YYYY/MM/<date>-<category>-<slug>.md   knowledge cards
 *   topics/<slug>.md                             topic aggregation pages
 *   journal/<YYYY-MM-DD>.md                      daily live-append journal
 *   entities/<slug>.md                           named entities
 *   facts/<id>.md                                bi-temporal facts (F-074)
 *   skills/<slug>.md                             reusable procedures
 *   rules/<slug>.md                              extraction / language rules
 *   action-items/{open,done}/<id>.md             tasks
 *   INDEX.md                                     wiki home (live-updated)
 *   README.md                                    user-readable orientation
 *
 * Existing daemon writes keep going to `knowledge/<category>/<id>.md` for
 * backward compatibility. This module is additive only.
 */

import path from 'node:path';

const SUBDIRS = Object.freeze({
  cards: 'cards',
  topics: 'topics',
  journal: 'journal',
  entities: 'entities',
  facts: 'facts',
  skills: 'skills',
  rules: 'rules',
  actionItemsOpen: path.join('action-items', 'open'),
  actionItemsDone: path.join('action-items', 'done'),
});

/**
 * Slugify a free-form string into a filesystem-safe slug.
 * - Lowercase
 * - ASCII letters/digits/dash only (drops accents but preserves CJK characters as-is)
 * - Collapses whitespace and punctuation to single dash
 * - Trims leading/trailing dashes
 * - Truncates to 60 chars
 *
 * Note: CJK characters ARE preserved (filesystems handle them fine on
 * macOS/Linux/WSL). This matches Obsidian / Logseq behavior.
 */
export function slugify(input) {
  const s = String(input ?? '').trim();
  if (!s) return 'untitled';
  const lowered = s.toLowerCase();
  // Replace any run of non-alphanumeric (allowing CJK \u4e00-\u9fff) with -
  const dashed = lowered
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  if (!dashed) return 'untitled';
  return dashed.slice(0, 60);
}

/**
 * @param {string} dateISO  ISO timestamp (created_at). Defaults to now.
 * @returns {{ year: string, month: string, day: string, ymd: string }}
 */
export function dateBucket(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  if (Number.isNaN(d.getTime())) {
    return dateBucket(new Date().toISOString());
  }
  // Use UTC to keep paths deterministic across timezones.
  const year = String(d.getUTCFullYear());
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return { year, month, day, ymd: `${year}-${month}-${day}` };
}

/**
 * Resolve the canonical card path for a given card.
 * @param {string} awarenessDir  absolute path to ~/.awareness/
 * @param {{ category?: string, title?: string, created_at?: string }} card
 * @returns {{ relPath: string, absPath: string, slug: string }}
 */
// relPath is an identifier, not a filesystem path, so it is built with path.posix
// while absPath keeps path.join. The two are not interchangeable on Windows: path.join
// yields `cards\2026\04\x.md`, and wiki-generator.mjs groups by directory with
// `relPath.includes('/')` / `lastIndexOf('/')`, which silently finds nothing. The same
// value also travels into markdown links, cross-device sync, and Obsidian wikilinks,
// none of which accept a backslash. A card written on Windows was therefore unfindable
// from any other platform — and the round-trip tests that would have said so had been
// red long enough to read as normal.
export function resolveCardPath(awarenessDir, card) {
  const { year, month, ymd } = dateBucket(card.created_at);
  const cat = slugify(card.category || 'insight');
  const titleSlug = slugify(card.title || '');
  const slug = `${ymd}-${cat}-${titleSlug}`;
  const relPath = path.posix.join(SUBDIRS.cards, year, month, `${slug}.md`);
  return {
    relPath,
    absPath: path.join(awarenessDir, relPath),
    slug,
  };
}

/**
 * Resolve a topic page path (under topics/<slug>.md).
 */
export function resolveTopicPath(awarenessDir, topicName) {
  const slug = slugify(topicName);
  const relPath = path.posix.join(SUBDIRS.topics, `${slug}.md`);
  return { relPath, absPath: path.join(awarenessDir, relPath), slug };
}

/**
 * Resolve a journal page path for a given date (defaults to today).
 */
export function resolveJournalPath(awarenessDir, dateISO) {
  const { ymd } = dateBucket(dateISO);
  const relPath = path.posix.join(SUBDIRS.journal, `${ymd}.md`);
  return { relPath, absPath: path.join(awarenessDir, relPath), slug: ymd };
}

/**
 * Resolve an entity page path.
 */
export function resolveEntityPath(awarenessDir, entityName) {
  const slug = slugify(entityName);
  const relPath = path.posix.join(SUBDIRS.entities, `${slug}.md`);
  return { relPath, absPath: path.join(awarenessDir, relPath), slug };
}

export const MARKDOWN_TREE_SUBDIRS = SUBDIRS;
