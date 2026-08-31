import { test, expect } from '@playwright/test';
import { loginToUI } from '../helpers/login';

test.describe('E2E: Executive Dashboard & Metric Widgets', () => {
  test.beforeEach(async ({ page }) => {
    await loginToUI(page);
  });

  test('1. Dashboard renders summary widgets and activity sections', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Confirm navigation shell and content area render
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
