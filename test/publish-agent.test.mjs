/**
 * Tests for publish-agent.mjs (F-081 Part B vibe-publish daemon side).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleContextBundle,
  synthesisInstructions,
  reviewDraft,
  handlePublishAgent,
} from '../src/daemon/engine/publish-agent.mjs';

const fakeDaemon = {
  runtime: 'cursor',
  indexer: {
    db: {
      prepare: (sql) => ({
        all: () => [
          { id: 'kc_1', category: 'decision', title: 'Pick pgvector', summary: 'reasons.', created_at: '2026-04-25T10:00:00Z' },
          { id: 'kc_2', category: 'pitfall', title: 'Webhook drift', summary: 'fix.', created_at: '2026-04-25T11:00:00Z' },
        ],
      }),
    },
  },
};

test('assembleContextBundle: includes recent cards and runtime', () => {
  const bundle = assembleContextBundle({ daemon: fakeDaemon, slug: 'foo', description: 'demo' });
  assert.equal(bundle.slug, 'foo');
  assert.equal(bundle.runtime, 'cursor');
  assert.equal(bundle.description, 'demo');
  assert.equal(bundle.recent_cards.length, 2);
  // F-075 / D17 SSOT: instructions come from sdks/_shared/prompts/publish.md,
  // whose canonical output object is named `publish_draft`.
  assert.match(bundle.instructions, /publish_draft/);
});

test('assembleContextBundle: handles missing daemon gracefully', () => {
  const bundle = assembleContextBundle({ daemon: null, slug: 'x' });
  assert.equal(bundle.slug, 'x');
  assert.equal(bundle.recent_cards.length, 0);
  assert.match(bundle.warning, /no daemon indexer/);
});

test('synthesisInstructions: contains JSON schema example', () => {
  const s = synthesisInstructions('mypack', 'desc');
  assert.match(s, /"slug"/);
  assert.match(s, /"skill_md"/);
  // F-075 / D17 SSOT: the canonical template constrains tagline length to
  // 120 chars (not the older hand-written 280-char description rule).
  assert.match(s, /120 chars/);
});

test('reviewDraft: blocks when draft contains secret', () => {
  const r = reviewDraft({
    name: 'Foo',
    slug: 'foo',
    description: 'My anthropic key sk-ant-' + 'A'.repeat(40),
    skill_md: 'safe content',
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /secret_scan_blocked.*anthropic_key/);
  assert.equal(r.report.blocked, true);
});

test('reviewDraft: clean draft passes', () => {
  const r = reviewDraft({
    name: 'Clean Pack',
    slug: 'clean-pack',
    description: 'A clean description.',
    skill_md: '# Clean SKILL.md\nNo secrets here.',
  });
  assert.equal(r.ok, true);
  assert.equal(r.report.blocked, false);
});

test('reviewDraft: rejects null/undefined draft', () => {
  const r = reviewDraft(null);
  assert.equal(r.ok, false);
  assert.match(r.error, /draft is required/);
});

test('handlePublishAgent: blocked draft returns ok=false', async () => {
  const r = await handlePublishAgent({
    daemon: fakeDaemon,
    draft: { name: 'X', slug: 'x', description: 'AKIA1234567890ABCDEF' },
    apiBase: 'http://invalid-host-that-should-not-be-reached.invalid',
    apiKey: 'k',
    memoryId: 'm',
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /secret_scan_blocked/);
});

test('handlePublishAgent: clean draft tries POST (network error gracefully reported)', async () => {
  const r = await handlePublishAgent({
    daemon: fakeDaemon,
    draft: {
      name: 'Clean',
      slug: 'clean',
      description: 'Clean description.',
      skill_md: '# Clean',
    },
    apiBase: 'http://127.0.0.1:1', // Definitely refused
    apiKey: 'k',
    memoryId: 'm',
  });
  assert.equal(r.ok, false);
  // Either fetch error or POST failure - both are acceptable for this test
  assert.ok(r.error, 'should have an error message');
});
