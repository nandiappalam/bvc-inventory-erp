import { test, expect } from '@playwright/test';
import { loginToUI } from '../helpers/login';

test.describe('E2E: Sales Management Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginToUI(page);
  });

  test('1. Sales Create page loads without crash', async ({ page }) => {
    await page.goto('/entry/sales-create');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('2. Sales Display page loads without crash', async ({ page }) => {
    await page.goto('/entry/sales-display');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
