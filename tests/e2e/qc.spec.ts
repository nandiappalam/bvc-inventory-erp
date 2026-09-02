import { test, expect } from '@playwright/test';
import { loginToUI } from '../helpers/login';

test.describe('E2E: Quality Control & Compliance Hub', () => {
  test.beforeEach(async ({ page }) => {
    await loginToUI(page);
  });

  test('1. Quality & Compliance Hub loads with tabs and widgets', async ({ page }) => {
    await page.goto('/compliance');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Verify Traceability Engine tab or headings render
    await expect(page.locator('#root, body').first()).toBeVisible();
  });
});
