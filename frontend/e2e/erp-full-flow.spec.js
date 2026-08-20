import { test, expect } from '@playwright/test';

test.describe('ERP Full Application Flow', () => {
  const baseURL = 'http://localhost:5173';

  const itemName = 'Test Item 1';
  const supplierName = 'Test Supplier 1';
  const customerName = 'Test Customer 1';

  test('🟣 Complete ERP Flow - Masters + Purchase CRUD', async ({ page }) => {
    // Console error monitoring
    page.on('console', msg => msg.type() !== 'info' && console.log('PAGE LOG:', msg.text()));

    // ---------------------------
    // 🔐 STEP 0: LAUNCH & AUTH (IF NEEDED)
    // ---------------------------
    await page.goto(baseURL);

    // ⚠️ UNCOMMENT IF LOGIN REQUIRED:
    // await page.waitForSelector('input[placeholder*="Username"], input[name="username"]', {timeout: 5000}).catch(() => {});
    // await page.fill('input[placeholder*="Username"], input[name="username"]', 'admin');
    // await page.fill('input[placeholder*="Password"], input[name="password"]', 'admin');
    // await page.click('button:has-text("Login"), button:has-text("Sign In")');
    // await page.waitForURL('**/dashboard');

    // ---------------------------
    // 🟣 PHASE 1: MASTER CREATION
    // ---------------------------

    // 1. Item Master
    await page.goto(`${baseURL}/master/item-create`);
    await page.locator('input[name="item_name"]').fill(itemName);
    await page.locator('input[name="print_name"]').fill(itemName);
    await page.click('text=Save, button[type="submit"], .save-btn');
    await page.waitForSelector('.message.success, text="saved successfully"', {timeout: 3000 });

    await page.goto(`${baseURL}/master/item-display`);
    await expect(page.locator(`text=${itemName}`)).toBeVisible({timeout: 5000});

    // 2. Supplier Master
    await page.goto(`${baseURL}/master/suppliers-create`);
    await page.locator('input[name="name"]').fill(supplierName);
    await page.locator('textarea[name="address1"], input[name="address"]').fill('Test Address');
    await page.locator('input[name="mobile1"], input[name="phone"]').fill('1234567890');
    await page.click('text=Save, button[type="submit"], .save-btn');
    await page.waitForSelector('.message.success');

    await page.goto(`${baseURL}/master/suppliers-display`);
    await expect(page.locator(`text=${supplierName}`)).toBeVisible();

    // 3. Customer Master (for completeness)
    await page.goto(`${baseURL}/master/customer-create`);
    await page.locator('input[name="name"]').fill(customerName);
    await page.locator('textarea[name="address1"]').fill('Customer Address');
    await page.locator('input[name="mobile1"]').fill('9876543210');
    await page.click('text=Save');
    await page.waitForSelector('.message.success');

    await page.goto(`${baseURL}/master/customer-display`);
    await expect(page.locator(`text=${customerName}`)).toBeVisible();

    // ---------------------------
    // 🟣 PHASE 2: ENTRY DROPDOWN VALIDATION
    // ---------------------------
    await page.goto(`${baseURL}/entry/purchase-create`);

    // Supplier dropdown shows created supplier
    await page.locator('select[name="supplier"], [data-testid="supplier-select"]').click();
    await expect(page.locator(`text=${supplierName}`)).toBeVisible();
    await expect(page.locator(`option:has-text("${supplierName}")`)).toBeVisible();

    // Item dropdown shows created item
    const itemCell = page.locator('table tbody tr:first-child td:has(input, select)').first();
    await itemCell.locator('select, input').click();
    await expect(page.locator(`text=${itemName}`)).toBeVisible();

    // ---------------------------
    // 🟣 PHASE 3: ENTRY CREATION
    // ---------------------------
    // Select Supplier (autofill verify)
    await page.locator('select[name="supplier"]').selectOption({ label: supplierName });
    await page.waitForTimeout(500); // Autofill

    // Row 1: S.No auto=1
    const firstRowSno = page.locator('table tbody tr:first-child td:first-child');
    await expect(firstRowSno).toContainText('1');

    // Item select
    const firstRowItemSelect = page.locator('table tbody tr:first-child td:has(select[name*="item"]) select');
    await firstRowItemSelect.selectOption({ label: itemName });

    // Qty=10, Rate=5
    const firstRowQty = page.locator('table tbody tr:first-child input[name*="qty"]').first();
    const firstRowRate = page.locator('table tbody tr:first-child input[name*="rate"]').first();
    await firstRowQty.fill('10');
    await firstRowRate.fill('5');

    // Amount calc=50
    const firstRowAmount = page.locator('table tbody tr:first-child input[name*="amount"]').first();
    await expect(firstRowAmount).toHaveValue('50', { timeout: 2000 });

    // LOT auto-generated (LOT001+)
    const firstRowLot = page.locator('table tbody tr:first-child input[name*="lot_no"]').first();
    const lotValue = await firstRowLot.inputValue();
    expect(lotValue).toMatch(/^LOT\d+/i);

    // Save
    await page.locator('button:has-text("💾 Save Purchase"), button:has-text("Save Purchase"), .save-btn').click();
    await page.waitForSelector('text="saved successfully", .message.success', { timeout: 5000 });

    // ---------------------------
    // 🟣 PHASE 4: DATA STORAGE CHECK
    // ---------------------------
    await page.goto(`${baseURL}/entry/purchase-display`);

    await expect(page.locator(`text=${supplierName}`)).toBeVisible();
    await expect(page.locator(`text=${itemName}`)).toBeVisible();
    await expect(page.locator('text=10')).toBeVisible(); // Qty

    // ---------------------------
    // 🟣 PHASE 5: CRUD OPERATIONS
    // ---------------------------
    // Get latest row selector (most recent purchase)
    const latestRow = page.locator('table tbody tr:last-child');
    const updateBtn = latestRow.locator('button:has-text("Update")');
    await updateBtn.click();

    // Back to edit → change qty to 20
    await page.waitForURL(/purchase-create/);
    await firstRowQty.fill('20');
    await expect(firstRowAmount).toHaveValue('100'); // Re-calc verify

    await page.locator('button:has-text("Save Purchase")').click();

    // Verify update in display
    await page.goto(`${baseURL}/entry/purchase-display`);
    await expect(page.locator('text=20')).toBeVisible();

    // Delete
    await latestRow.locator('button:has-text("Delete")').click();
    await page.locator('text=Confirm, button:has-text("Delete")').click(); // Confirm dialog if present

    await expect(latestRow).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator(`text=${supplierName}`)).not.toBeVisible();
  });
});
