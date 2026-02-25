import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
  test('Admin page loads', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();

    // Admin panel should render some content (may show access denied for non-admins)
    const text = await page.textContent('body');
    expect(text?.length).toBeGreaterThan(50);
  });
});
