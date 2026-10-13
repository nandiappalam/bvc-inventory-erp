const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Set auth tokens in localStorage
  await page.addInitScript(() => {
    window.localStorage.setItem('erp_token', 'mock-or-real');
    window.localStorage.setItem('erp_user', JSON.stringify({ id: 1, username: 'admin', role: 'admin' }));
    window.localStorage.setItem('erp_company', JSON.stringify({ id: 1, name: 'BVC Exports Pvt Ltd' }));
    window.localStorage.setItem('erp_selected_company', JSON.stringify({ id: 1, name: 'BVC Exports Pvt Ltd' }));
    window.localStorage.setItem('erp_isAdmin', 'true');
  });

  console.log('Navigating to /entry/outpass-create...');
  await page.goto('http://localhost:3000/entry/outpass-create');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  const outpassInfo = await page.evaluate(() => {
    const grid = document.querySelector('.outpass-grid-4');
    if (!grid) return { error: 'Grid not found' };
    const gridRect = grid.getBoundingClientRect();
    const gridStyle = window.getComputedStyle(grid);
    
    const children = Array.from(grid.children);
    const childData = children.map((child, idx) => {
      const childRect = child.getBoundingClientRect();
      const childStyle = window.getComputedStyle(child);
      const input = child.querySelector('input, select');
      const inputRect = input ? input.getBoundingClientRect() : null;
      const inputStyle = input ? window.getComputedStyle(input) : null;
      const label = child.querySelector('.outpass-label');
      const labelText = label ? label.textContent : '';

      return {
        idx,
        labelText,
        childClass: child.className,
        childRect: { x: childRect.x, y: childRect.y, width: childRect.width, height: childRect.height },
        inputRect: inputRect ? { x: inputRect.x, y: inputRect.y, width: inputRect.width, height: inputRect.height } : null,
        childComputed: {
          gridColumn: childStyle.gridColumn,
          margin: childStyle.margin,
          padding: childStyle.padding,
          boxSizing: childStyle.boxSizing
        },
        inputComputed: inputStyle ? {
          boxSizing: inputStyle.boxSizing,
          width: inputStyle.width,
          height: inputStyle.height,
          margin: inputStyle.margin,
          padding: inputStyle.padding,
          border: inputStyle.border
        } : null
      };
    });

    return {
      gridRect: { x: gridRect.x, y: gridRect.y, width: gridRect.width, height: gridRect.height },
      gridStyle: {
        display: gridStyle.display,
        gridTemplateColumns: gridStyle.gridTemplateColumns,
        columnGap: gridStyle.columnGap,
        rowGap: gridStyle.rowGap,
        gap: gridStyle.gap
      },
      childData
    };
  });

  console.log('=== OUTPASS GRID INFO ===');
  console.log('Grid Rect:', outpassInfo.gridRect);
  console.log('Grid Style:', outpassInfo.gridStyle);
  console.log('\nChildren:');
  outpassInfo.childData?.forEach(c => {
    console.log(`[#${c.idx}] "${c.labelText}"`);
    console.log(`    Child: x=${c.childRect.x}, y=${c.childRect.y}, w=${c.childRect.width}, h=${c.childRect.height}, col=${c.childComputed.gridColumn}`);
    if (c.inputRect) {
      console.log(`    Input: x=${c.inputRect.x}, y=${c.inputRect.y}, w=${c.inputRect.width}, h=${c.inputRect.height}, boxSizing=${c.inputComputed.boxSizing}`);
    }
  });

  // Now audit InpassCreate
  console.log('\nNavigating to /entry/inpass-create...');
  await page.goto('http://localhost:3000/entry/inpass-create');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  const inpassInfo = await page.evaluate(() => {
    const grid = document.querySelector('.inpass-grid-4');
    if (!grid) return { error: 'Grid not found' };
    const gridRect = grid.getBoundingClientRect();
    const gridStyle = window.getComputedStyle(grid);
    
    const children = Array.from(grid.children);
    const childData = children.map((child, idx) => {
      const childRect = child.getBoundingClientRect();
      const childStyle = window.getComputedStyle(child);
      const input = child.querySelector('input, select');
      const inputRect = input ? input.getBoundingClientRect() : null;
      const inputStyle = input ? window.getComputedStyle(input) : null;
      const label = child.querySelector('.inpass-label');
      const labelText = label ? label.textContent : '';

      return {
        idx,
        labelText,
        childClass: child.className,
        childRect: { x: childRect.x, y: childRect.y, width: childRect.width, height: childRect.height },
        inputRect: inputRect ? { x: inputRect.x, y: inputRect.y, width: inputRect.width, height: inputRect.height } : null,
        childComputed: {
          gridColumn: childStyle.gridColumn,
          margin: childStyle.margin,
          padding: childStyle.padding,
          boxSizing: childStyle.boxSizing
        },
        inputComputed: inputStyle ? {
          boxSizing: inputStyle.boxSizing,
          width: inputStyle.width,
          height: inputStyle.height,
          margin: inputStyle.margin,
          padding: inputStyle.padding
        } : null
      };
    });

    return {
      gridRect: { x: gridRect.x, y: gridRect.y, width: gridRect.width, height: gridRect.height },
      gridStyle: {
        display: gridStyle.display,
        gridTemplateColumns: gridStyle.gridTemplateColumns,
        columnGap: gridStyle.columnGap,
        rowGap: gridStyle.rowGap
      },
      childData
    };
  });

  console.log('\n=== INPASS GRID INFO ===');
  console.log('Grid Rect:', inpassInfo.gridRect);
  console.log('Grid Style:', inpassInfo.gridStyle);
  console.log('\nChildren:');
  inpassInfo.childData?.forEach(c => {
    console.log(`[#${c.idx}] "${c.labelText}"`);
    console.log(`    Child: x=${c.childRect.x}, y=${c.childRect.y}, w=${c.childRect.width}, h=${c.childRect.height}, col=${c.childComputed.gridColumn}`);
    if (c.inputRect) {
      console.log(`    Input: x=${c.inputRect.x}, y=${c.inputRect.y}, w=${c.inputRect.width}, h=${c.inputRect.height}, boxSizing=${c.inputComputed.boxSizing}`);
    }
  });

  await browser.close();
})();
