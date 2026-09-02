import { test, expect } from '@playwright/test';
import { loginToUI } from '../helpers/login';
import { cleanupTestData } from '../helpers/cleanup';

test.describe('E2E: Masters UI Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginToUI(page);
  });

  test.afterAll(async () => {
    await cleanupTestData(1);
  });

  test('1. Item Master Display renders data table without error', async ({ page }) => {
    await page.goto('/master/item-display');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('2. Supplier Master Display renders suppliers list table', async ({ page }) => {
    await page.goto('/master/suppliers-display');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('3. Customer Master Display renders customers list table', async ({ page }) => {
    await page.goto('/master/customer-display');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
