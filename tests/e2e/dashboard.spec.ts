import { test, expect } from '@playwright/test';

test.describe('Dashboard & Settings', () => {
  test('Main Dashboard loads', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Dashboard shows user-related content', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const text = await page.textContent('body');
    expect(text?.length).toBeGreaterThan(100);
  });

  test('Consumer Dashboard loads', async ({ page }) => {
    await page.goto('/dashboard/consumer');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Profile page loads with user info', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();

    // Should have some profile-related content
    const text = await page.textContent('body');
    const lowerText = text?.toLowerCase() || '';
    expect(lowerText).toMatch(/profile|name|email|api.?key|settings/);
  });

  test('Profile page has editable fields', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('input, textarea');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Provider Keys page loads', async ({ page }) => {
    await page.goto('/provider-keys');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();

    const text = await page.textContent('body');
    const lowerText = text?.toLowerCase() || '';
    expect(lowerText).toMatch(/provider|key|api|byok|openai|anthropic/);
  });

  test('Privacy Settings page loads', async ({ page }) => {
    await page.goto('/privacy-settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Subscriptions page loads', async ({ page }) => {
    await page.goto('/subscriptions');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Usage Analytics page loads', async ({ page }) => {
    await page.goto('/usage-analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Dev Dashboard loads', async ({ page }) => {
    await page.goto('/dev');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });
});
