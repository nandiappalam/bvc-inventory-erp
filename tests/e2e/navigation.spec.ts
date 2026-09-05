import { test, expect } from '@playwright/test';
import { loginToUI } from '../helpers/login';

test.describe('E2E: Comprehensive Navigation Crawler & White Screen Detection', () => {
  const routesToTest = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Item Master Create', path: '/master/item-create' },
    { name: 'Item Master Display', path: '/master/item-display' },
    { name: 'Supplier Master Display', path: '/master/suppliers-display' },
    { name: 'Customer Master Display', path: '/master/customer-display' },
    { name: 'Purchase Create', path: '/entry/purchase-create' },
    { name: 'Purchase Display', path: '/entry/purchase-display' },
    { name: 'Sales Create', path: '/entry/sales-create' },
    { name: 'Sales Display', path: '/entry/sales-display' },
    { name: 'Stock Reports', path: '/reports/stock-status' },
    { name: 'Godown Stock', path: '/reports/godown-stock' },
    { name: 'Quality & Compliance Hub', path: '/compliance' },
    { name: 'Voucher Display', path: '/entry/voucher-display' },
    { name: 'Godown Transfer', path: '/inventory/item-transfer' },
    { name: 'Tax Master Display', path: '/master/tax-display' }
  ];

  test.beforeEach(async ({ page }) => {
    await loginToUI(page);
  });

  for (const route of routesToTest) {
    test(`Crawl page: ${route.name} (${route.path})`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', err => pageErrors.push(err.message));

      await page.goto(route.path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      // Verify page is not blank/white screen
      await expect(page.locator('#root, body').first()).toBeVisible();

      // Verify no critical uncaught JavaScript exceptions
      expect(pageErrors.length).toBe(0);
    });
  }
});
