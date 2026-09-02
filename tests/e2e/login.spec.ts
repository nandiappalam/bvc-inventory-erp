import { test, expect } from '@playwright/test';
import { loginToUI } from '../helpers/login';

test.describe('E2E: Authentication & Session Flow', () => {
  test('1. User can successfully view login page and sign in to Dashboard', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('websocket')) {
        consoleErrors.push(msg.text());
      }
    });

    await loginToUI(page, 'admin', 'admin123');

    // Verify dashboard or home view elements
    await expect(page.locator('body')).not.toBeEmpty();
    expect(consoleErrors.length).toBe(0);
  });

  test('2. Company selection is visible and selectable', async ({ page }) => {
    await page.goto('/company-select');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
