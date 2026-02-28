import { test, expect } from '@playwright/test';

test.describe('Wallet & Credits', () => {
  test('Wallet Dashboard loads', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();

    const text = await page.textContent('body');
    const lowerText = text?.toLowerCase() || '';
    expect(lowerText).toMatch(/wallet|balance|transaction|credit/);
  });

  test('Credits & Payments page loads', async ({ page }) => {
    await page.goto('/credits');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('ZKP Dashboard loads', async ({ page }) => {
    await page.goto('/zkp-dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('/zkp alias loads ZKP Dashboard', async ({ page }) => {
    await page.goto('/zkp');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeAttached();
  });
});
