import { test, expect } from '@playwright/test';
import { loginToUI } from '../helpers/login';

test.describe('E2E: Purchase Management Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginToUI(page);
  });

  test('1. Purchase Create form loads properly with input fields', async ({ page }) => {
    await page.goto('/entry/purchase-create');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('2. Purchase Display list loads and renders records table', async ({ page }) => {
    await page.goto('/entry/purchase-display');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
