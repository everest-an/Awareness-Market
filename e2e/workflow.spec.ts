import { test, expect } from '@playwright/test';

test.describe('Workflow Pages', () => {
  test('Workflow Demo page loads', async ({ page }) => {
    await page.goto('/workflow-demo');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();

    const text = await page.textContent('body');
    const lowerText = text?.toLowerCase() || '';
    expect(lowerText).toMatch(/workflow|demo|step|process/);
  });

  test('Workflow History page loads', async ({ page }) => {
    await page.goto('/workflow-history');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('Workflow Performance page loads', async ({ page }) => {
    await page.goto('/workflow-performance');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });
});
