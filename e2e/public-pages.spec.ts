import { test, expect } from '@playwright/test';
import { PUBLIC_ROUTES, REDIRECT_ROUTES } from './fixtures/test-data';

test.describe('Public Pages — Smoke Tests', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) loads without error`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      // Should not be a server error
      expect(response?.status()).toBeLessThan(500);

      // Page should have the root React mount
      await expect(page.locator('#root')).toBeAttached();

      // Should not be a blank white screen — some content must render
      const body = page.locator('body');
      await expect(body).not.toBeEmpty();

      // No fatal JS errors
      expect(errors).toEqual([]);
    });
  }
});

test.describe('Redirect Routes', () => {
  for (const route of REDIRECT_ROUTES) {
    test(`${route.name}: ${route.from} → ${route.to}`, async ({ page }) => {
      await page.goto(route.from, { waitUntil: 'domcontentloaded' });

      // After client-side redirect, URL should end with target
      await page.waitForURL(`**${route.to}`, { timeout: 10_000 });
      expect(page.url()).toContain(route.to);
    });
  }
});

test.describe('404 Page', () => {
  test('Unknown route shows NotFound page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345');
    await expect(page.locator('#root')).toBeAttached();
    // Should display some kind of "not found" message
    const text = await page.textContent('body');
    expect(text?.toLowerCase()).toMatch(/not found|404|page.*exist/);
  });
});

test.describe('SEO & Meta', () => {
  test('Home page has correct title and meta tags', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.toLowerCase()).toContain('awareness');

    // og:title should exist
    const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
    expect(ogTitle).toBeTruthy();

    // description meta should exist
    const desc = await page.getAttribute('meta[name="description"]', 'content');
    expect(desc).toBeTruthy();
    expect(desc!.length).toBeGreaterThan(50);
  });

  test('Canonical URL is set', async ({ page }) => {
    await page.goto('/');
    const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
    expect(canonical).toContain('awareness.market');
  });
});
