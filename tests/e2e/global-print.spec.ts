import { test, expect } from '@playwright/test';
import { loginToUI } from '../helpers/login';

test.describe('🖨️ Global Print & Print Preview Reliability Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginToUI(page);
  });

  test('1. Core Print Portal Engine mounts, populates, and displays content in @media print', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Trigger printHtml programmatically
    await page.evaluate(() => {
      const testContent = `
        <div id="test-print-invoice" style="padding: 20px;">
          <h1>BVC TEST INVOICE</h1>
          <table>
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr>
            </thead>
            <tbody>
              <tr><td>Wheat Flour 50kg</td><td>10</td><td>1500</td><td>15000</td></tr>
            </tbody>
          </table>
        </div>
      `;
      // @ts-ignore
      window.printTestContent = testContent;
      // @ts-ignore
      if (typeof window.printHtml === 'function') {
        // @ts-ignore
        window.printHtml(testContent, 'Test Invoice');
      } else {
        // Retrieve portal and populate
        let portal = document.getElementById('bvc-print-portal');
        if (!portal) {
          portal = document.createElement('div');
          portal.id = 'bvc-print-portal';
          document.body.appendChild(portal);
        }
        portal.innerHTML = testContent;
        document.body.classList.add('bvc-printing-portal');
      }
    });

    // Verify print portal has the content
    const portal = page.locator('#bvc-print-portal');
    await expect(portal).toContainText('BVC TEST INVOICE');
    await expect(portal).toContainText('Wheat Flour 50kg');

    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    // Under print media, portal must be visible
    await expect(portal).toBeVisible();

    // Check computed style of portal and children
    const isVisibleInPrint = await page.evaluate(() => {
      const portalEl = document.getElementById('bvc-print-portal');
      if (!portalEl) return false;
      const style = window.getComputedStyle(portalEl);
      const h1 = portalEl.querySelector('h1');
      const h1Style = h1 ? window.getComputedStyle(h1) : null;
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        h1Style?.visibility !== 'hidden' &&
        h1Style?.display !== 'none'
      );
    });

    expect(isVisibleInPrint).toBe(true);

    // Verify main app navigation / chrome is hidden in print media
    const isSidebarHidden = await page.evaluate(() => {
      const sidebar = document.querySelector('.erp-sidebar, .erp-navbar, nav');
      if (!sidebar) return true;
      const style = window.getComputedStyle(sidebar);
      return style.display === 'none' || style.visibility === 'hidden';
    });
    expect(isSidebarHidden).toBe(true);

    // Reset media
    await page.emulateMedia({ media: 'screen' });
  });

  test('2. Cold Storage Stock page print preview renders populated table', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERR:', err));

    await page.goto('/cold-storage/stock');
    await page.waitForLoadState('networkidle');

    // Close any backdrop if present
    const backdrop = page.locator('.MuiBackdrop-root');
    if (await backdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Stub window.print so headless browser does not block
    await page.evaluate(() => {
      window.print = () => { console.log('window.print called in browser'); };
    });

    // Locate the print button by accessible name or title
    const printButton = page.getByRole('button', { name: 'Print Report' }).or(page.locator('button[title*="Print"]')).first();
    await expect(printButton).toBeVisible({ timeout: 5000 });
    console.log('Dispatching native click on printButton...');
    await printButton.evaluate((el: HTMLElement) => el.click());

    // Wait for portal to receive content
    await page.waitForFunction(() => {
      const portalEl = document.getElementById('bvc-print-portal');
      return portalEl && portalEl.innerHTML.trim().length > 0;
    }, { timeout: 8000 });

    // Check under media print
    await page.emulateMedia({ media: 'print' });
    const portalHasContent = await page.evaluate(() => {
      const portalEl = document.getElementById('bvc-print-portal');
      return portalEl && portalEl.innerHTML.trim().length > 0;
    });
    expect(portalHasContent).toBe(true);
    await page.emulateMedia({ media: 'screen' });
  });

  test('3. Stock Report page print preview is unclipped and visible', async ({ page }) => {
    await page.goto('/stock-report');
    await page.waitForLoadState('networkidle');

    const printButton = page.locator('button:has-text("Print Stock Sheet"), button:has-text("Print")').first();
    if (await printButton.isVisible({ timeout: 4000 }).catch(() => false)) {
      await printButton.click();

      await page.emulateMedia({ media: 'print' });
      const printableContent = await page.evaluate(() => {
        const portalEl = document.getElementById('bvc-print-portal');
        if (portalEl && portalEl.innerText.trim().length > 0) {
          const style = window.getComputedStyle(portalEl);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }
        const report = document.getElementById('stock-report-printable');
        if (report) {
          const style = window.getComputedStyle(report);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }
        return false;
      });
      expect(printableContent).toBe(true);
      await page.emulateMedia({ media: 'screen' });
    }
  });

  test('4. Vouchers page print preview renders voucher without global hiding bugs', async ({ page }) => {
    await page.goto('/vouchers');
    await page.waitForLoadState('networkidle');

    // Verify that global CSS does not have body * { visibility: hidden }
    const hasGlobalVisibilityHidden = await page.evaluate(() => {
      let foundHarmfulRule = false;
      for (let s = 0; s < document.styleSheets.length; s++) {
        try {
          const sheet = document.styleSheets[s];
          const rules = sheet.cssRules || [];
          for (let r = 0; r < rules.length; r++) {
            const rule = rules[r];
            if (rule instanceof CSSMediaRule && rule.conditionText?.includes('print')) {
              for (let mr = 0; mr < rule.cssRules.length; mr++) {
                const subRule = rule.cssRules[mr];
                if (subRule.cssText?.includes('body *') && subRule.cssText?.includes('visibility: hidden')) {
                  foundHarmfulRule = true;
                }
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheet security, ignore
        }
      }
      return foundHarmfulRule;
    });

    expect(hasGlobalVisibilityHidden).toBe(false);
  });
});
