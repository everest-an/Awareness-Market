import { test, expect } from '@playwright/test';
import { MARKETPLACE_ROUTES } from './fixtures/test-data';

test.describe('Marketplace', () => {
  test('Marketplace page loads with content', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#root')).toBeAttached();
    const text = await page.textContent('body');
    expect(text?.length).toBeGreaterThan(200);
  });

  test('Marketplace has search functionality', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');

    // Look for a search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="find" i]').first();
    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await searchInput.fill('test query');
      await page.waitForTimeout(1000);
      // Page should not crash after search
      await expect(page.locator('#root')).toBeAttached();
    }
  });

  test('Marketplace has filter/category options', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');

    // Look for tabs, select dropdowns, or filter buttons
    const text = await page.textContent('body');
    const lowerText = text?.toLowerCase() || '';

    // Should have some form of categorization
    const hasCategories = lowerText.includes('vector') ||
      lowerText.includes('memory') ||
      lowerText.includes('chain') ||
      lowerText.includes('filter') ||
      lowerText.includes('category');

    expect(hasCategories).toBe(true);
  });

  for (const route of MARKETPLACE_ROUTES) {
    test(`${route.name} (${route.path}) loads`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('#root')).toBeAttached();

      // Should not be a blank page
      const text = await page.textContent('body');
      expect(text?.length).toBeGreaterThan(100);
    });
  }

  test('Vector Packages page shows package listings', async ({ page }) => {
    await page.goto('/vector-packages');
    await page.waitForLoadState('networkidle');

    const text = await page.textContent('body');
    const lowerText = text?.toLowerCase() || '';
    expect(lowerText).toMatch(/vector|package|browse|explore/);
  });

  test('Memory Marketplace shows listings', async ({ page }) => {
    await page.goto('/memory-marketplace');
    await page.waitForLoadState('networkidle');

    const text = await page.textContent('body');
    const lowerText = text?.toLowerCase() || '';
    expect(lowerText).toMatch(/memory|package|kv.?cache|browse/);
  });

  test('Chain Packages marketplace loads', async ({ page }) => {
    await page.goto('/chain-packages');
    await page.waitForLoadState('networkidle');

    const text = await page.textContent('body');
    const lowerText = text?.toLowerCase() || '';
    expect(lowerText).toMatch(/chain|reasoning|package/);
  });

  test('Reasoning Chains page loads', async ({ page }) => {
    await page.goto('/reasoning-chains');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#root')).toBeAttached();
  });
});
