import { test, expect } from '@playwright/test';
import { loginToUI } from '../helpers/login';

test.describe('E2E: Accounting & Vouchers Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginToUI(page);
  });

  test('1. Voucher List loads without crash', async ({ page }) => {
    await page.goto('/entry/voucher-display');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('2. Ledger Display master page loads without crash', async ({ page }) => {
    await page.goto('/master/ledger-display');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
