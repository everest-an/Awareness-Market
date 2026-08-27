/**
 * Tests for secret-scanner.mjs (F-081 Part B).
 *
 * Critical: real tokens MUST be redacted. False positives on plain prose
 * should be near-zero. Soft hits flag PII without blocking.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText, scanDraft } from '../src/core/secret-scanner.mjs';

// ── HARD blockers ──────────────────────────────────────────────────────

test('hard: anthropic key redacted + blocked', () => {
  // Use a fake but realistic-shape key to avoid leaking a real one
  const fake = 'sk-ant-' + 'A'.repeat(40);
  const r = scanText(`Authorization: ${fake}`);
  assert.equal(r.blocked, true);
  assert.equal(r.hits[0].category, 'anthropic_key');
  assert.match(r.redacted, /<REDACTED:anthropic_key>/);
  assert.doesNotMatch(r.redacted, new RegExp(fake.slice(10)));
});

test('hard: AWS access key', () => {
  const r = scanText('AKIA1234567890ABCDEF in config');
  assert.equal(r.blocked, true);
  assert.equal(r.hits[0].category, 'aws_access_key');
});

test('hard: Google API key', () => {
  const r = scanText('key=AIza' + 'a'.repeat(35));
  assert.equal(r.blocked, true);
  assert.equal(r.hits[0].category, 'google_api_key');
});

test('hard: GitHub PAT', () => {
  const r = scanText('export GH=ghp_' + 'b'.repeat(36));
  assert.equal(r.blocked, true);
  assert.equal(r.hits[0].category, 'github_token');
});

test('hard: npm token', () => {
  const r = scanText('npm_abcdefghijklmnopqrstuvwxyz0123456789');
  assert.equal(r.blocked, true);
  assert.equal(r.hits[0].category, 'npm_token');
});

test('hard: PEM private key block', () => {
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQE...\n-----END RSA PRIVATE KEY-----';
  const r = scanText(`Got key:\n${pem}\nDone.`);
  assert.equal(r.blocked, true);
  assert.equal(r.hits[0].category, 'private_key_block');
  assert.doesNotMatch(r.redacted, /MIIEpAIBAA/);
});

test('hard: JWT', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIs.eyJzdWIiOiIxMjM0NTY3OD.SflKxwRJSMeKKF2QT4f';
  const r = scanText(`Bearer ${jwt}`);
  assert.equal(r.blocked, true);
  assert.equal(r.hits[0].category, 'jwt');
});

test('hard: postgres URL with password', () => {
  const r = scanText('DATABASE_URL=postgres://user:hunter2@db.host.com:5432/foo');
  assert.equal(r.blocked, true);
  assert.equal(r.hits[0].category, 'db_url_with_password');
  assert.doesNotMatch(r.redacted, /hunter2/);
});

test('hard: generic password=...', () => {
  const r = scanText('password = "abcdefghijklmnopqr"');
  assert.equal(r.blocked, true);
  assert.equal(r.hits[0].category, 'generic_secret_assignment');
});

// ── SOFT warnings ──────────────────────────────────────────────────────

test('soft: real email is flagged but not blocked', () => {
  const r = scanText('Contact me at jane.doe@gmail.com please.');
  assert.equal(r.blocked, false);
  assert.ok(r.hits.find((h) => h.category === 'email_address'));
});

test('soft: example.com email NOT flagged', () => {
  const r = scanText('Use placeholder@example.com');
  assert.equal(r.blocked, false);
  assert.equal(r.hits.length, 0);
});

test('soft: absolute /Users path flagged', () => {
  const r = scanText('Open /Users/everestan/Awareness/foo.md');
  assert.equal(r.blocked, false);
  assert.ok(r.hits.find((h) => h.category === 'absolute_unix_path'));
});

test('soft: RFC1918 IP NOT flagged', () => {
  const r = scanText('Server is at 192.168.1.5 internal');
  // Internal hostname tag may catch ".internal" — but the IP itself shouldn't
  assert.equal(r.hits.filter((h) => h.category === 'public_ipv4').length, 0);
});

test('soft: public IP flagged', () => {
  const r = scanText('CDN endpoint 8.8.8.8 cached');
  assert.ok(r.hits.find((h) => h.category === 'public_ipv4'));
});

// ── False-positive guards ─────────────────────────────────────────────

test('clean prose: no hits', () => {
  const r = scanText('We chose pgvector over Pinecone for cold-start P99 reasons.');
  assert.equal(r.hits.length, 0);
  assert.equal(r.blocked, false);
});

test('code with file paths but no secrets: clean', () => {
  const r = scanText('See `backend/awareness/api/routes/auth.py:120` for the helper.');
  // backend/awareness/... is relative — should not match absolute path rule
  assert.equal(r.hits.filter((h) => h.severity === 'hard').length, 0);
});

// ── Draft scan ─────────────────────────────────────────────────────────

test('scanDraft: redacts skill_md + description', () => {
  const draft = {
    slug: 'foo',
    skill_md: 'My Anthropic key: sk-ant-' + 'X'.repeat(40),
    description: 'Use AKIA1234567890ABCDEF for AWS',
    contents: ['Plain content'],
  };
  const r = scanDraft(draft);
  assert.equal(r.report.blocked, true);
  assert.equal(r.report.hard_hits.length, 2);
  assert.match(r.draft.skill_md, /<REDACTED:anthropic_key>/);
  assert.match(r.draft.description, /<REDACTED:aws_access_key>/);
});

test('scanDraft: array of content objects', () => {
  const draft = {
    contents: [
      { body: 'Visit https://gmail.com for jane@gmail.com' },
      'Just a plain string with sk-ant-' + 'Z'.repeat(40),
    ],
  };
  const r = scanDraft(draft);
  // hard hit on the sk-ant
  assert.equal(r.report.blocked, true);
  // soft hit on email
  assert.ok(r.report.soft_hits.find((h) => h.category === 'email_address'));
});

test('scanDraft: clean draft → not blocked', () => {
  const draft = {
    slug: 'clean-pack',
    skill_md: '# A clean skill\n\nThis is fine.',
    description: 'No secrets here.',
  };
  const r = scanDraft(draft);
  assert.equal(r.report.blocked, false);
  assert.equal(r.report.hard_hits.length, 0);
});

// ── Redaction prefix ───────────────────────────────────────────────────

test('redact keeps short prefix for triage', () => {
  const fake = 'sk-ant-' + 'P'.repeat(40);
  const r = scanText(fake);
  // First 4 chars `sk-a` then redaction marker
  assert.match(r.redacted, /^sk-a<REDACTED:anthropic_key>$/);
});
