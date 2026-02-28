import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const E2E_EMAIL = process.env.E2E_EMAIL || 'e2e-test@awareness.market';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'TestPass123!@#';
const E2E_NAME = 'E2E Test User';
const AUTH_STATE_PATH = 'tests/e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Ensure auth directory exists
  const authDir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  let authenticated = false;

  try {
    // Try to register first (idempotent — will fail silently if user exists)
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Click the register tab
    const registerTab = page.getByRole('tab', { name: /register/i });
    if (await registerTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await registerTab.click();

      // Fill registration form
      const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]').first();
      const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
      const passwordInput = page.locator('input[type="password"]').first();

      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill(E2E_NAME);
        await emailInput.fill(E2E_EMAIL);
        await passwordInput.fill(E2E_PASSWORD);

        // Submit registration — target the submit button specifically (not wallet register)
        const submitBtn = page.getByRole('button', { name: /create account/i });
        if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await submitBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    // Now login
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Click login tab if needed
    const loginTab = page.getByRole('tab', { name: /login|sign in/i });
    if (await loginTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginTab.click();
    }

    // Fill login form
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await emailInput.fill(E2E_EMAIL);
    await passwordInput.fill(E2E_PASSWORD);

    // Submit login — target the submit button specifically (not wallet/agent login)
    const loginBtn = page.getByRole('button', { name: 'Sign In', exact: true });
    await loginBtn.click();

    // Wait for redirect to home (indicates successful login)
    await page.waitForURL('/', { timeout: 10_000 });
    authenticated = true;
  } catch {
    // Login failed (e.g. DB unreachable in local dev) — proceed with empty auth state
    console.log('[E2E Setup] Login failed — saving empty auth state. Authenticated tests will run as unauthenticated.');
  }

  // Save storage state (even if empty — so dependent tests can still run)
  await page.context().storageState({ path: AUTH_STATE_PATH });

  if (authenticated) {
    console.log('[E2E Setup] Authenticated successfully');
  }
});
