import { test, expect } from '@playwright/test';

test.describe('Creator / Upload Pages', () => {
  test('Upload Vector page loads', async ({ page }) => {
    await page.goto('/upload');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Upload Vector Package page has form fields', async ({ page }) => {
    await page.goto('/upload-vector-package');
    await page.waitForLoadState('networkidle');

    // Should have some form elements
    const inputs = page.locator('input, textarea, select');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Upload Memory Package page has form fields', async ({ page }) => {
    await page.goto('/upload-memory-package');
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('input, textarea, select');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Upload Chain Package page has form fields', async ({ page }) => {
    await page.goto('/upload-chain-package');
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('input, textarea, select');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Upload Multimodal Package page loads', async ({ page }) => {
    await page.goto('/upload-multimodal-package');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Creator Publish page loads', async ({ page }) => {
    await page.goto('/creator/publish');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Reasoning Chain Publish page loads', async ({ page }) => {
    await page.goto('/reasoning-chains/publish');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Creator Dashboard page loads', async ({ page }) => {
    await page.goto('/dashboard/creator');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });
});
