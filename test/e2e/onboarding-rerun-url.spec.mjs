/**
 * E2E: ?onboarding=1 re-opens the wizard for a user who already finished it.
 *
 * Completion lives in localStorage, so once a user completes the wizard they can
 * never see it again in that browser. The only re-run affordance was the status
 * chip's CTA — labelled "Connect cloud →" and hidden outright once cloud sync is
 * on, meaning a fully configured user had no way back in at all.
 *
 * These assertions are about what the user can actually do, not about internals:
 * a completed user sees no wizard on a normal visit, sees it again when they
 * open the documented URL, and a refresh afterwards does not restart it.
 */

import { test, expect } from '@playwright/test';

const OVERLAY = '.onb-overlay, [data-onboarding-overlay], .onb-modal';

/** Mark onboarding complete the same way the wizard itself does. */
async function markCompleted(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('awareness_onboarding_completed_at', new Date().toISOString());
    } catch { /* private mode */ }
  });
}

async function wizardVisible(page) {
  // The wizard mounts ~200ms after load by design (never blocks first paint).
  await page.waitForTimeout(900);
  return page.locator(OVERLAY).first().isVisible().catch(() => false);
}

test('completed user sees no wizard on a normal visit', async ({ page }) => {
  await markCompleted(page);
  await page.goto('/');
  expect(await wizardVisible(page)).toBe(false);
});

test('?onboarding=1 re-opens the wizard for a completed user', async ({ page }) => {
  await markCompleted(page);
  await page.goto('/?onboarding=1');
  expect(await wizardVisible(page)).toBe(true);
});

test('the parameter is stripped so a refresh does not restart it', async ({ page }) => {
  await markCompleted(page);
  await page.goto('/?onboarding=1');
  await page.waitForTimeout(900);

  // URL cleaned in place — no reload, no history entry the user can bounce off.
  expect(page.url()).not.toContain('onboarding=1');

  // Reloading the cleaned URL must not launch the wizard again: the reset above
  // cleared completion, so we re-mark it to represent "user finished it again".
  await page.evaluate(() => {
    localStorage.setItem('awareness_onboarding_completed_at', new Date().toISOString());
  });
  await page.reload();
  expect(await wizardVisible(page)).toBe(false);
});

test('unrelated query params survive the cleanup', async ({ page }) => {
  await markCompleted(page);
  await page.goto('/?onboarding=1&tab=cards');
  await page.waitForTimeout(900);

  const url = page.url();
  expect(url).not.toContain('onboarding=1');
  expect(url).toContain('tab=cards');
});

test('a normal visit by a fresh user still auto-launches', async ({ page }) => {
  // Guard against the fix accidentally gating first-run behind the URL param.
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  await page.goto('/');
  expect(await wizardVisible(page)).toBe(true);
});
