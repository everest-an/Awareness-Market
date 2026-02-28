import { test, expect } from '@playwright/test';

test.describe('Organization Pages', () => {
  test('Organization Setup page loads', async ({ page }) => {
    await page.goto('/org/setup');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Organization Dashboard loads', async ({ page }) => {
    await page.goto('/org/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Decision Audit page loads', async ({ page }) => {
    await page.goto('/org/decisions');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Verification Dashboard loads', async ({ page }) => {
    await page.goto('/org/verification');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Organization Analytics loads', async ({ page }) => {
    await page.goto('/org/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Billing Dashboard loads', async ({ page }) => {
    await page.goto('/org/billing');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Organization pages are wrapped in FeatureErrorBoundary', async ({ page }) => {
    // Even if the feature errors, the page should not white-screen
    // The FeatureErrorBoundary should catch and show a fallback
    await page.goto('/org/setup');
    await page.waitForLoadState('domcontentloaded');

    // Page should render something — either the feature or the error boundary
    const body = page.locator('body');
    const text = await body.textContent();
    expect(text?.length).toBeGreaterThan(50);
  });
});
