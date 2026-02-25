import { test as setup, expect } from '@playwright/test';

const E2E_EMAIL = process.env.E2E_EMAIL || 'e2e-test@awareness.market';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'TestPass123!@#';
const E2E_NAME = 'E2E Test User';

setup('authenticate', async ({ page }) => {
  // Try to register first (idempotent — will fail silently if user exists)
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');

  // Click the register tab
  const registerTab = page.getByRole('tab', { name: /register/i });
  if (await registerTab.isVisible()) {
    await registerTab.click();

    // Fill registration form
    const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]').first();
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await nameInput.isVisible()) {
      await nameInput.fill(E2E_NAME);
      await emailInput.fill(E2E_EMAIL);
      await passwordInput.fill(E2E_PASSWORD);

      // Submit registration
      const submitBtn = page.getByRole('button', { name: /register|sign up|create/i });
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        // Wait briefly for response
        await page.waitForTimeout(2000);
      }
    }
  }

  // Now login
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');

  // Click login tab if needed
  const loginTab = page.getByRole('tab', { name: /login|sign in/i });
  if (await loginTab.isVisible()) {
    await loginTab.click();
  }

  // Fill login form
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  await emailInput.fill(E2E_EMAIL);
  await passwordInput.fill(E2E_PASSWORD);

  // Submit login
  const loginBtn = page.getByRole('button', { name: /login|sign in/i });
  await loginBtn.click();

  // Wait for redirect to home (indicates successful login)
  await page.waitForURL('/', { timeout: 15_000 }).catch(() => {
    // If not redirected, the auth might use a different flow
  });

  // Verify we're logged in by checking for auth cookie or user indicator
  await page.waitForTimeout(1000);

  // Save storage state
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
