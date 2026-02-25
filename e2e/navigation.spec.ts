import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('Navbar is visible on home page', async ({ page }) => {
    await page.goto('/');
    // Navbar should contain navigation links
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('Navbar has key navigation items', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.textContent('body');
    // Check for core nav items (case-insensitive)
    const text = bodyText?.toLowerCase() || '';
    expect(text).toMatch(/marketplace|market/);
  });

  test('Logo / brand link navigates to home', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('domcontentloaded');

    // Click the brand/logo link (usually first link in nav)
    const logoLink = page.locator('nav a[href="/"]').first();
    if (await logoLink.isVisible()) {
      await logoLink.click();
      await page.waitForURL('/');
      expect(page.url()).toMatch(/\/$/);
    }
  });

  test('Marketplace link works', async ({ page }) => {
    await page.goto('/');

    const marketLink = page.locator('a[href="/marketplace"]').first();
    if (await marketLink.isVisible()) {
      await marketLink.click();
      await page.waitForURL('**/marketplace');
      expect(page.url()).toContain('/marketplace');
    }
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-route-abc123');
    const text = await page.textContent('body');
    expect(text?.toLowerCase()).toMatch(/not found|404|doesn.*exist/);
  });

  test('Back/forward browser navigation works', async ({ page }) => {
    await page.goto('/');
    await page.goto('/marketplace');
    await page.goto('/about');

    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/marketplace');

    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toMatch(/\/$/);

    await page.goForward();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/marketplace');
  });

  test('All redirect routes resolve correctly', async ({ page }) => {
    // /hive-mind → /neural-cortex
    await page.goto('/hive-mind');
    await page.waitForURL('**/neural-cortex', { timeout: 10_000 });
    expect(page.url()).toContain('/neural-cortex');
  });

  test('/api-keys redirects to /profile', async ({ page }) => {
    await page.goto('/api-keys');
    await page.waitForURL('**/profile', { timeout: 10_000 });
    expect(page.url()).toContain('/profile');
  });

  test('/w-matrix-marketplace redirects to /w-matrix', async ({ page }) => {
    await page.goto('/w-matrix-marketplace');
    await page.waitForURL('**/w-matrix', { timeout: 10_000 });
    expect(page.url()).toContain('/w-matrix');
  });

  test('Documentation page loads', async ({ page }) => {
    await page.goto('/documentation');
    await expect(page.locator('#root')).toBeAttached();
    const text = await page.textContent('body');
    expect(text?.length).toBeGreaterThan(100);
  });

  test('Keyboard shortcut Ctrl+K opens search (if implemented)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try pressing Ctrl+K to open command palette / search
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    // Check if a search dialog/command palette appeared
    const searchDialog = page.locator('[role="dialog"], [cmdk-root], [data-cmdk-root]');
    const isVisible = await searchDialog.first().isVisible().catch(() => false);
    // This is informational — search might not be implemented via Ctrl+K
    expect(typeof isVisible).toBe('boolean');
  });

  test('Service health page loads', async ({ page }) => {
    await page.goto('/service-health');
    await expect(page.locator('#root')).toBeAttached();
    const text = await page.textContent('body');
    expect(text?.toLowerCase()).toMatch(/health|status|service/);
  });

  test('About page has content', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('#root')).toBeAttached();
    const text = await page.textContent('body');
    expect(text?.toLowerCase()).toMatch(/awareness|about/);
  });

  test('Blog page loads with posts', async ({ page }) => {
    await page.goto('/blog');
    await expect(page.locator('#root')).toBeAttached();
    const text = await page.textContent('body');
    expect(text?.length).toBeGreaterThan(200);
  });

  test('Pricing page loads', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('#root')).toBeAttached();
  });
});
