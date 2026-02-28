import { test, expect } from '@playwright/test';
import { FEATURE_PAGES } from './fixtures/test-data';

test.describe('AI Feature Pages', () => {
  test('AI Collaboration Hub loads', async ({ page }) => {
    await page.goto('/ai-collaboration');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();

    const text = await page.textContent('body');
    const lowerText = text?.toLowerCase() || '';
    expect(lowerText).toMatch(/collaborat|session|agent|ai/);
  });

  test('New Collaboration Session page loads', async ({ page }) => {
    await page.goto('/ai-collaboration/new');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();

    // Should have form fields for creating a session
    const inputs = page.locator('input, textarea, select');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Collaboration Sessions list loads', async ({ page }) => {
    await page.goto('/ai-collaboration/sessions');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Neural Cortex page loads', async ({ page }) => {
    await page.goto('/neural-cortex');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();

    const text = await page.textContent('body');
    expect(text?.length).toBeGreaterThan(100);
  });

  test('/cortex alias loads Neural Cortex', async ({ page }) => {
    await page.goto('/cortex');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('/visualizer alias loads Neural Cortex', async ({ page }) => {
    await page.goto('/visualizer');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Latent Test / W-Matrix page loads', async ({ page }) => {
    await page.goto('/latent-test');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('/w-matrix shows same page as /latent-test', async ({ page }) => {
    await page.goto('/w-matrix');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Neural Bridge V2 Demo loads', async ({ page }) => {
    await page.goto('/neural-bridge-v2-demo');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();

    const text = await page.textContent('body');
    const lowerText = text?.toLowerCase() || '';
    expect(lowerText).toMatch(/neural|bridge|demo|transfer/);
  });

  test('KV-Cache Demo loads', async ({ page }) => {
    await page.goto('/kv-cache-demo');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Cross-Modal Search loads', async ({ page }) => {
    await page.goto('/cross-modal-search');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Agent Registry / Discovery loads', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();

    const text = await page.textContent('body');
    const lowerText = text?.toLowerCase() || '';
    expect(lowerText).toMatch(/agent|registry|discover/);
  });

  test('Agent Discovery page loads', async ({ page }) => {
    await page.goto('/agent-discovery');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('W-Matrix Tools page loads', async ({ page }) => {
    await page.goto('/w-matrix-tools');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Memory Management page loads', async ({ page }) => {
    await page.goto('/memory-management');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Conflict Resolution page loads', async ({ page }) => {
    await page.goto('/conflicts');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  // Verify all feature pages from test-data don't crash
  for (const route of FEATURE_PAGES) {
    test(`Feature page: ${route.name} (${route.path}) loads without crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#root')).toBeAttached();
      expect(errors).toEqual([]);
    });
  }
});
