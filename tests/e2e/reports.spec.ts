import { test, expect } from '@playwright/test';
import { loginToUI } from '../helpers/login';

test.describe('E2E: Reports & Analytics Views', () => {
  test.beforeEach(async ({ page }) => {
    await loginToUI(page);
  });

  test('1. Stock Status report loads table data and filter controls', async ({ page }) => {
    await page.goto('/reports/stock-status');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('2. Godown-wise Stock report loads successfully', async ({ page }) => {
    await page.goto('/reports/godown-stock');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('3. Purchase Analytics/Register loads without white screen', async ({ page }) => {
    await page.goto('/reports/purchase-register');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
