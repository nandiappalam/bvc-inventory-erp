import { test, expect } from '@playwright/test';
import { loginToUI } from '../helpers/login';

test.describe('E2E: Stock & Inventory Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginToUI(page);
  });

  test('1. Stock Status report loads without crash', async ({ page }) => {
    await page.goto('/reports/stock-status');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('2. Godown Transfer page loads without crash', async ({ page }) => {
    await page.goto('/inventory/item-transfer');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
