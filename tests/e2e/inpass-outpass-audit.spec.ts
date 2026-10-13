import { test, expect } from '@playwright/test';
import { loginToUI } from '../helpers/login';

test.describe('Audit: INpass and OUTpass Create Pages Layout, Alignment & Dropdowns', () => {

  test.beforeEach(async ({ page }) => {
    // Authenticate and open application
    await loginToUI(page, 'admin', 'admin123', 1);
  });

  test('1. [AUDIT] OUTpass Create Page - Layout, Grid Alignment, Column Spacing & Dropdowns', async ({ page }) => {
    console.log('\n======================================================');
    console.log('>>> AUDIT: OUTpass Create Page (/entry/outpass-create)');
    console.log('======================================================\n');

    await page.goto('/entry/outpass-create');
    await page.waitForLoadState('networkidle');

    // Ensure page loaded
    const titleLocator = page.locator('text=Material Gate Outpass');
    await expect(titleLocator).toBeVisible();

    // 1. Audit Form Grid Geometry & Column Spacing
    const grid = page.locator('.outpass-grid-4').first();
    await expect(grid).toBeVisible();

    const gridBox = await grid.boundingBox();
    console.log(`[OUTPASS GRID] Bounding Box: Width=${gridBox?.width}px, Height=${gridBox?.height}px`);

    const fields = await page.locator('.outpass-grid-4 > .outpass-field').all();
    console.log(`[OUTPASS GRID] Detected ${fields.length} field containers in movement card.`);

    const fieldDetails: Array<{ name: string; x: number; y: number; width: number; height: number; boxSizing: string; marginLeft: string }> = [];

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const label = await field.locator('.outpass-label').textContent().catch(() => `Field ${i}`);
      const input = field.locator('input, select').first();
      const box = await input.boundingBox();
      const boxSizing = await input.evaluate((el) => window.getComputedStyle(el).boxSizing).catch(() => 'unknown');
      const marginLeft = await input.evaluate((el) => window.getComputedStyle(el).marginLeft).catch(() => '0px');
      
      if (box) {
        fieldDetails.push({
          name: label?.trim() || `Field ${i}`,
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
          boxSizing,
          marginLeft
        });
      }
    }

    console.log('\n--- Field Measurements & Alignment Table ---');
    console.table(fieldDetails);

    // Group fields into rows by approximate Y
    const rowsMap = new Map<number, typeof fieldDetails>();
    for (const fd of fieldDetails) {
      let matchedKey: number | null = null;
      for (const key of rowsMap.keys()) {
        if (Math.abs(key - fd.y) <= 4) {
          matchedKey = key;
          break;
        }
      }
      if (matchedKey !== null) {
        rowsMap.get(matchedKey)!.push(fd);
      } else {
        rowsMap.set(fd.y, [fd]);
      }
    }

    console.log(`\n[OUTPASS GRID] Grouped into ${rowsMap.size} horizontal rows:`);
    let rowIndex = 1;
    for (const [y, rowFields] of rowsMap.entries()) {
      console.log(`  Row ${rowIndex++} (Y baseline ~ ${y}px): ${rowFields.length} fields -> [${rowFields.map(f => f.name).join(', ')}]`);
      
      for (let c = 0; c < rowFields.length - 1; c++) {
        const leftField = rowFields[c];
        const rightField = rowFields[c + 1];
        const gap = rightField.x - (leftField.x + leftField.width);
        console.log(`    Spacing gap between "${leftField.name}" and "${rightField.name}": ${gap}px (Left Margin: ${leftField.marginLeft})`);
      }
    }

    // 2. Audit Dropdown Selection & Value Population
    console.log('\n--- Testing OUTpass Dropdowns & Dynamic Field Population ---');

    // Purpose Dropdown
    const purposeSelect = page.locator('select[name="purpose"]');
    await purposeSelect.selectOption('Job Work');
    const selectedPurpose = await purposeSelect.inputValue();
    console.log(`[DROPDOWN TEST] Purpose select updated to: "${selectedPurpose}"`);
    expect(selectedPurpose).toBe('Job Work');

    // Item Type Dropdown
    const itemTypeSelect = page.locator('select[name="item_type"]');
    await itemTypeSelect.selectOption('WIP');
    const selectedItemType = await itemTypeSelect.inputValue();
    console.log(`[DROPDOWN TEST] Item Type select updated to: "${selectedItemType}"`);
    expect(selectedItemType).toBe('WIP');

    // Reference Type Dropdown
    const refTypeSelect = page.locator('select[name="reference_type"]');
    await refTypeSelect.selectOption('Purchase');
    const selectedRefType = await refTypeSelect.inputValue();
    console.log(`[DROPDOWN TEST] Reference Module select updated to: "${selectedRefType}"`);
    expect(selectedRefType).toBe('Purchase');

    // External Mill / Party Name datalist / select
    const partyInput = page.locator('input[name="party_name"]');
    await partyInput.fill('abc');
    await partyInput.dispatchEvent('change');
    
    // Check destination
    const destInput = page.locator('input[name="destination"]');
    const destVal = await destInput.inputValue();
    console.log(`[PARTY AUTO-POPULATE] Party Name: "abc" -> Destination Field: "${destVal}"`);

    // Also manually fill destination and processing rate if needed
    await destInput.fill('Madurai Main Hub');
    const filledDest = await destInput.inputValue();
    expect(filledDest).toBe('Madurai Main Hub');

    const rateInput = page.locator('input[name="processing_rate_kg"]');
    await rateInput.fill('3.5');
    const rateVal = await rateInput.inputValue();
    console.log(`[PARTY AUTO-POPULATE] Agreed Processing Rate: "${rateVal}"`);
    expect(rateVal).toBe('3.5');

    // 3. Audit Items Table
    const itemRows = await page.locator('tbody tr').all();
    console.log(`[ITEMS TABLE] Initial rows count: ${itemRows.length}`);
    expect(itemRows.length).toBeGreaterThanOrEqual(1);

    // Test Add Row button
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Item Row'));
      if (btn) btn.click();
    });
    const rowsAfterAdd = await page.locator('tbody tr').all();
    console.log(`[ITEMS TABLE] After clicking "Add Item Row": ${rowsAfterAdd.length} rows`);
    expect(rowsAfterAdd.length).toBe(itemRows.length + 1);

    console.log('\n[PASS] OUTpass Create Page Audit Completed Successfully.');
  });


  test('2. [AUDIT] INpass Create Page - Layout, Grid Alignment, Dropdown Population & Mass Balance', async ({ page }) => {
    console.log('\n=====================================================');
    console.log('>>> AUDIT: INpass Create Page (/entry/inpass-create)');
    console.log('=====================================================\n');

    await page.goto('/entry/inpass-create');
    await page.waitForLoadState('networkidle');

    // Ensure page loaded
    const titleLocator = page.locator('text=Receive Material Gate Inpass');
    await expect(titleLocator).toBeVisible();

    // 1. Audit Form Grid Geometry & Column Spacing
    const grid = page.locator('.inpass-grid-4').first();
    await expect(grid).toBeVisible();

    const gridBox = await grid.boundingBox();
    console.log(`[INPASS GRID] Bounding Box: Width=${gridBox?.width}px, Height=${gridBox?.height}px`);

    const fields = await page.locator('.inpass-grid-4 > .inpass-field').all();
    console.log(`[INPASS GRID] Detected ${fields.length} field containers in receipt card.`);

    const fieldDetails: Array<{ name: string; x: number; y: number; width: number; height: number; boxSizing: string; marginLeft: string }> = [];

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const label = await field.locator('.inpass-label').textContent().catch(() => `Field ${i}`);
      const input = field.locator('input, select, label').first();
      const box = await input.boundingBox();
      const boxSizing = await input.evaluate((el) => window.getComputedStyle(el).boxSizing).catch(() => 'unknown');
      const marginLeft = await input.evaluate((el) => window.getComputedStyle(el).marginLeft).catch(() => '0px');
      
      if (box) {
        fieldDetails.push({
          name: label?.trim() || `Field ${i}`,
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
          boxSizing,
          marginLeft
        });
      }
    }

    console.log('\n--- Field Measurements & Alignment Table ---');
    console.table(fieldDetails);

    // Group fields into rows
    const rowsMap = new Map<number, typeof fieldDetails>();
    for (const fd of fieldDetails) {
      let matchedKey: number | null = null;
      for (const key of rowsMap.keys()) {
        if (Math.abs(key - fd.y) <= 4) {
          matchedKey = key;
          break;
        }
      }
      if (matchedKey !== null) {
        rowsMap.get(matchedKey)!.push(fd);
      } else {
        rowsMap.set(fd.y, [fd]);
      }
    }

    console.log(`\n[INPASS GRID] Grouped into ${rowsMap.size} horizontal rows:`);
    let rowIndex = 1;
    for (const [y, rowFields] of rowsMap.entries()) {
      console.log(`  Row ${rowIndex++} (Y baseline ~ ${y}px): ${rowFields.length} fields -> [${rowFields.map(f => f.name).join(', ')}]`);
      
      // Check column gaps
      for (let c = 0; c < rowFields.length - 1; c++) {
        const leftField = rowFields[c];
        const rightField = rowFields[c + 1];
        const gap = rightField.x - (leftField.x + leftField.width);
        console.log(`    Spacing gap between "${leftField.name}" and "${rightField.name}": ${gap}px (Left Margin: ${leftField.marginLeft})`);
      }
    }

    // 2. Audit "Reference Dispatched Outpass" Dropdown Selection & Value Population
    console.log('\n--- Testing INpass Outpass Dropdown Selection & Auto-Population ---');

    const outpassSelect = page.locator('select.inpass-select').first();
    await expect(outpassSelect).toBeVisible();

    // Inspect options available in dropdown
    const options = await outpassSelect.locator('option').all();
    console.log(`[DROPDOWN TEST] Outpass select options count: ${options.length}`);
    for (let o = 0; o < options.length; o++) {
      const optText = await options[o].textContent();
      const optVal = await options[o].getAttribute('value');
      console.log(`   Option [${o}]: value="${optVal}", text="${optText?.trim()}"`);
    }

    // Verify option 2 (OP-TEST-AUDIT) exists and select it
    if (options.length > 1) {
      const secondOptionVal = await options[1].getAttribute('value');
      if (secondOptionVal) {
        await outpassSelect.selectOption(secondOptionVal);
        const currentVal = await outpassSelect.inputValue();
        console.log(`[DROPDOWN TEST] Selected outpass ID: "${currentVal}" (Expected: "${secondOptionVal}")`);
        expect(currentVal).toBe(secondOptionVal);

        // Verify that fields are populated correctly with the selected outpass data
        const partyInput = page.locator('input[name="party_name"]');
        const partyVal = await partyInput.inputValue();
        console.log(`[AUTO-POPULATION] Party Name: "${partyVal}"`);
        expect(partyVal).toContain('Sri Amman Modern Mill');

        const vehicleInput = page.locator('input[name="vehicle_no"]');
        const vehicleVal = await vehicleInput.inputValue();
        console.log(`[AUTO-POPULATION] Vehicle No: "${vehicleVal}"`);
        expect(vehicleVal).toBe('TN-67-X-9999');

        const rateInput = page.locator('input[name="processing_charge_per_kg"]');
        const rateVal = await rateInput.inputValue();
        console.log(`[AUTO-POPULATION] Processing Rate: "${rateVal}"`);
        expect(rateVal).toBe('3');

        // Check Mass Balance KPI Card updates
        const kpiText = await page.locator('text=Dispatched Outpass RM').locator('..').textContent();
        console.log(`[MASS BALANCE KPI] Dispatched Outpass RM: "${kpiText?.replace(/\s+/g, ' ')}"`);
        expect(kpiText).toContain('5000');

        // Check Received Output Breakdown Table auto-population
        const tableRows = await page.locator('tbody tr').all();
        console.log(`[BREAKDOWN TABLE] Number of yield breakdown rows: ${tableRows.length}`);
        expect(tableRows.length).toBeGreaterThanOrEqual(3);

        const firstRowItem = await tableRows[0].locator('input[type="text"]').first().inputValue();
        const firstRowWeight = await tableRows[0].locator('td').nth(6).locator('input').inputValue();
        console.log(`[BREAKDOWN TABLE] Row 1 Item: "${firstRowItem}", Total Weight Input: "${firstRowWeight}"`);
        expect(Number(firstRowWeight)).toBe(4700); // 94% yield of 5000 kg
      }
    }

    // 3. Test Godown Dropdown Selection
    const godownSelect = page.locator('select[name="to_godown_id"]');
    const godownOptions = await godownSelect.locator('option').all();
    console.log(`[DROPDOWN TEST] Receiving Godown options count: ${godownOptions.length}`);
    if (godownOptions.length > 1) {
      const secondGodownVal = await godownOptions[1].getAttribute('value');
      if (secondGodownVal) {
        await godownSelect.selectOption(secondGodownVal);
        const currentGodown = await godownSelect.inputValue();
        console.log(`[DROPDOWN TEST] Selected Godown ID: "${currentGodown}"`);
        expect(currentGodown).toBe(secondGodownVal);
      }
    }

    console.log('\n[PASS] INpass Create Page Audit Completed Successfully.');
  });
});
