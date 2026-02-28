import { test, expect } from '@playwright/test';

test.describe('Workspace Pages', () => {
  test('Workspace List page loads', async ({ page }) => {
    await page.goto('/workspace');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('New Workspace page loads with form', async ({ page }) => {
    await page.goto('/workspace/new');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();

    // Should have some form elements for workspace creation
    const inputs = page.locator('input, textarea, select');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });
});
