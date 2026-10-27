/* Verify the client half of the optional email opt-in (welcome step).
 *
 * The contract that matters:
 *   - nothing is sent unless the user actually typed an address
 *   - it fires ONLY on the explicit "next" CTA, never on skip-all
 *   - no installation_id is transmitted, so a volunteer's address is never
 *     linked to their anonymous usage history
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox, loadModules, installBaseI18n } from './helpers/onboarding-env.mjs';

function makeInteractiveRoot({ email = '', telemetry = false } = {}) {
  const els = {
    '#onb-email-opt': { value: email },
    '#onb-telemetry-opt': { checked: telemetry },
    '[data-action="next"]': { onclick: null },
  };
  const skipAll = [{ onclick: null }];
  return {
    root: {
      set innerHTML(_) { /* render is not under test here */ },
      get innerHTML() { return ''; },
      querySelector: (s) => els[s] ?? null,
      querySelectorAll: (s) => (s === '[data-action="skip-all"]' ? skipAll : []),
    },
    els,
    skipAll,
  };
}

function load() {
  const calls = [];
  const ctx = makeSandbox({
    fetchImpl: async (url, opts) => {
      calls.push({ url: String(url), opts });
      return { ok: true, json: async () => ({}) };
    },
  });
  installBaseI18n(ctx, {
    en: { 'onb.step_of': 'Step {n} of {total}', 'onb.skip_step': 'Skip', 'onb.skip_finish': 'Finish' },
    zh: {},
  });
  loadModules(ctx, ['steps.js']);
  return { ctx, calls, Steps: ctx.window.AwarenessOnboardingSteps };
}

const signups = (calls) => calls.filter((c) => c.url.includes('/api/v1/subscribe'));

test('email opt-in: blank field sends nothing', async () => {
  const { Steps, calls } = load();
  const { root, els } = makeInteractiveRoot({ email: '' });
  Steps.renderWelcome(root, { onNext() {}, onSkipAll() {} });
  await els['[data-action="next"]'].onclick();
  assert.equal(signups(calls).length, 0, 'no request when the field is empty');
});

test('email opt-in: whitespace-only field sends nothing', async () => {
  const { Steps, calls } = load();
  const { root, els } = makeInteractiveRoot({ email: '   ' });
  Steps.renderWelcome(root, { onNext() {}, onSkipAll() {} });
  await els['[data-action="next"]'].onclick();
  assert.equal(signups(calls).length, 0, 'whitespace is not an address');
});

test('email opt-in: next posts the trimmed address with no installation_id', async () => {
  const { Steps, calls } = load();
  const { root, els } = makeInteractiveRoot({ email: '  User@Example.com ' });
  Steps.renderWelcome(root, { onNext() {}, onSkipAll() {} });
  await els['[data-action="next"]'].onclick();

  const s = signups(calls);
  assert.equal(s.length, 1, 'exactly one signup request');
  const body = JSON.parse(s[0].opts.body);
  assert.equal(body.email, 'User@Example.com', 'address is trimmed');
  assert.equal(body.source, 'daemon-onboarding');
  assert.ok(!('installation_id' in body), 'must not link the address to the anonymous install');
});

test('email opt-in: skip-all never signs the user up', async () => {
  const { Steps, calls } = load();
  const { root, skipAll } = makeInteractiveRoot({ email: 'user@example.com' });
  Steps.renderWelcome(root, { onNext() {}, onSkipAll() {} });
  await skipAll[0].onclick();
  assert.equal(signups(calls).length, 0, 'an abandoned onboarding must not sign anyone up');
});

test('email opt-in: the telemetry opt-out still posts independently', async () => {
  const { Steps, calls } = load();
  const { root, els } = makeInteractiveRoot({ email: '', telemetry: false });
  Steps.renderWelcome(root, { onNext() {}, onSkipAll() {} });
  await els['[data-action="next"]'].onclick();
  const tel = calls.filter((c) => c.url.includes('/api/v1/telemetry/enable'));
  assert.equal(tel.length, 1, 'telemetry opt-out is still persisted');
  assert.equal(JSON.parse(tel[0].opts.body).enabled, false);
});
