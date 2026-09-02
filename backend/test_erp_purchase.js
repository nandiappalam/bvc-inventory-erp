const db = require('./config/database');
const axios = require('axios');

const BASE_URL = process.env.BVC_BASE_URL || 'http://localhost:10000/api';

(async () => {
  try {
    console.log('=== ERP PURCHASE TEST ===\n');

    // 1. Get suppliers
    const suppliersRes = await db.query('SELECT id, name FROM supplier_master LIMIT 3');
    console.log('Available Suppliers:');
    suppliersRes.rows.forEach(s => console.log(`  ${s.id}: ${s.name}`));
    const supplierId = suppliersRes.rows[0]?.id || 1;
    const supplierName = suppliersRes.rows[0]?.name || 'ABC Traders';
    console.log(`Using supplier: ${supplierName} (ID: ${supplierId})\n`);

    // 2. Get items
    const itemsRes = await db.query("SELECT id, item_name FROM item_master WHERE item_name LIKE '%Rice%' LIMIT 1");
    console.log('Rice Item:');
    if (itemsRes.rows.length > 0) {
      console.log(`  ${itemsRes.rows[0].id}: ${itemsRes.rows[0].item_name}`);
    } else {
      console.log('  No Rice item found');
    }
    const itemName = itemsRes.rows[0]?.item_name || 'Rice';
    console.log(`Using item: ${itemName}\n`);

    // 3. Check current max lot number
    const maxLotRes = await db.query('SELECT MAX(id) as maxId FROM purchase_items');
    const nextLotSeq = (maxLotRes.rows[0]?.maxId || 0) + 1;
    const expectedLotNo = `LOT${String(nextLotSeq).padStart(4, '0')}`;
    console.log(`Next expected lot number: ${expectedLotNo}\n`);

    // 4. Prepare purchase payload
    const formData = {
      sno: 1,
      date: new Date().toISOString().slice(0, 10),
      inv_no: 'TEST-001',
      supplier: supplierId,
      inv_date: new Date().toISOString().slice(0, 10),
      type: 'Rice',
      address: 'Test Address',
      tax_type: 'Exclusive',
      godown: 'Godown 1',
      pay_type: 'Credit',
      remarks: 'ERP Test Purchase'
    };

    // ERP calculation (from spec)
    const qty = 50;
    const perUnitWeight = 50;
    const rate = 2000;
    const discPercent = 2;
    const taxPercent = 5;

    const baseAmount = qty * rate; // 50 * 2000 = 100000
    const discountAmount = baseAmount * discPercent / 100; // 2000
    const taxableAmount = baseAmount - discountAmount; // 98000
    const taxAmount = taxableAmount * taxPercent / 100; // 4900
    const netAmount = taxableAmount + taxAmount; // 102900
    const totalWeight = qty * perUnitWeight; // 2500

    console.log('EXPECTED CALCULATIONS:');
    console.log(`  Base Amount: ${baseAmount}`);
    console.log(`  Discount Amount: ${discountAmount}`);
    console.log(`  Taxable Amount: ${taxableAmount}`);
    console.log(`  Tax Amount: ${taxAmount}`);
    console.log(`  Net Amount: ${netAmount}`);
    console.log(`  Total Weight: ${totalWeight}\n`);

    const items = [
      {
        itemName,
        item_name: itemName,
        lotNo: '',
        lot_no: '',
        qty,
        weight: perUnitWeight,
        totalWt: totalWeight,
        total_wt: totalWeight,
        rate,
        disc: discPercent,
        disc_percent: discPercent,
        tax: taxPercent,
        tax_percent: taxPercent,
        amount: Number(taxableAmount.toFixed(2))
      }
    ];

    const totals = {
      totalQty: qty,
      totalWeight,
      totalAmount: netAmount,
      baseAmount,
      discAmount: discountAmount,
      taxAmount,
      netAmount,
      grandTotal: netAmount,
      deductions: { autoWages: 0, vatPercent: 0, vat: 0 }
    };

    const payload = { formData, items, totals };

    console.log('POSTING PURCHASE TO API...');
    const response = await axios.post(`${BASE_URL}/purchases`, payload);
    console.log('Response:', response.data);

    if (response.data.id) {
      console.log(`\n✓ Purchase created with ID: ${response.data.id}`);

      // 5. Query the database to verify saved values
      console.log('\nVERIFYING SAVED DATA IN DATABASE...\n');
      
      const purchaseRes = await db.query('SELECT * FROM purchases WHERE id = ?', [response.data.id]);
      if (purchaseRes.rows.length > 0) {
        const purchase = purchaseRes.rows[0];
        console.log('Purchase record:');
        console.log(`  base_amount: ${purchase.base_amount} (expected: ${baseAmount})`);
        console.log(`  disc_amount: ${purchase.disc_amount} (expected: ${discountAmount})`);
        console.log(`  tax_amount: ${purchase.tax_amount} (expected: ${taxAmount})`);
        console.log(`  net_amount: ${purchase.net_amount} (expected: ${netAmount})`);
        console.log(`  grand_total: ${purchase.grand_total} (expected: ${netAmount})`);
        console.log(`  total_weight: ${purchase.total_weight} (expected: ${totalWeight})`);
      }

      const itemsRes = await db.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [response.data.id]);
      if (itemsRes.rows.length > 0) {
        const item = itemsRes.rows[0];
        console.log('\nPurchase item record:');
        console.log(`  lot_no: ${item.lot_no} (expected: ${expectedLotNo})`);
        console.log(`  qty: ${item.qty} (expected: ${qty})`);
        console.log(`  weight (per-unit): ${item.weight} (expected: ${perUnitWeight})`);
        console.log(`  total_wt: ${item.total_wt} (expected: ${totalWeight})`);
        console.log(`  rate: ${item.rate} (expected: ${rate})`);
        console.log(`  disc_percent: ${item.disc_percent} (expected: ${discPercent})`);
        console.log(`  tax_percent: ${item.tax_percent} (expected: ${taxPercent})`);
        console.log(`  amount (taxable): ${item.amount} (expected: ${taxableAmount})`);
      }

      // 6. Check the purchase-list display query
      console.log('\nVERIFYING DISPLAY PAGE QUERY...\n');
      const displayRes = await db.query(`
        SELECT
          p.id,
          p.inv_no,
          p.date,
          CASE WHEN s_join.name IS NOT NULL THEN s_join.name ELSE p.supplier END AS supplier_name,
          pi.item_name AS item_name_text,
          pi.lot_no,
          pi.weight,
          pi.total_wt AS total_weight,
          pi.rate,
          ROUND((pi.qty * pi.rate), 2) AS base_amount,
          pi.disc_percent,
          ROUND((pi.qty * pi.rate) * (pi.disc_percent / 100.0), 2) AS disc_amount,
          pi.tax_percent,
          ROUND(((pi.qty * pi.rate) - ((pi.qty * pi.rate) * (pi.disc_percent / 100.0))) * (pi.tax_percent / 100.0), 2) AS tax_amount,
          ROUND(((pi.qty * pi.rate) - ((pi.qty * pi.rate) * (pi.disc_percent / 100.0))) + (((pi.qty * pi.rate) - ((pi.qty * pi.rate) * (pi.disc_percent / 100.0))) * (pi.tax_percent / 100.0)), 2) AS amount,
          ROUND((pi.qty * pi.rate) - ((pi.qty * pi.rate) * (pi.disc_percent / 100.0)), 2) AS taxable_amount,
          COALESCE(p.grand_total, p.net_amount, 0) AS final_total
        FROM purchases p
        LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
        LEFT JOIN supplier_master s_join ON (
          CAST(s_join.id AS TEXT) = CAST(p.supplier AS TEXT)
          OR s_join.name = p.supplier
        )
        WHERE p.id = ?
        ORDER BY p.id DESC
      `, [response.data.id]);

      if (displayRes.rows.length > 0) {
        const row = displayRes.rows[0];
        console.log('Display page query result:');
        console.log(`  supplier_name: ${row.supplier_name} (expected: ${supplierName})`);
        console.log(`  item_name_text: ${row.item_name_text} (expected: ${itemName})`);
        console.log(`  lot_no: ${row.lot_no} (expected: ${expectedLotNo})`);
        console.log(`  weight: ${row.weight} (expected: ${perUnitWeight})`);
        console.log(`  total_weight: ${row.total_weight} (expected: ${totalWeight})`);
        console.log(`  rate: ${row.rate} (expected: ${rate})`);
        console.log(`  base_amount: ${row.base_amount} (expected: ${baseAmount})`);
        console.log(`  disc_percent: ${row.disc_percent} (expected: ${discPercent})`);
        console.log(`  disc_amount: ${row.disc_amount} (expected: ${discountAmount})`);
        console.log(`  tax_percent: ${row.tax_percent} (expected: ${taxPercent})`);
        console.log(`  tax_amount: ${row.tax_amount} (expected: ${taxAmount})`);
        console.log(`  taxable_amount: ${row.taxable_amount} (expected: ${taxableAmount})`);
        console.log(`  amount: ${row.amount} (expected: ${netAmount})`);
        console.log(`  final_total: ${row.final_total} (expected: ${netAmount})`);

        // Validation
        console.log('\n✓ VALIDATION CHECKS:');
        let allPass = true;
        const checks = [
          { name: 'Lot No Format', actual: row.lot_no, expected: expectedLotNo },
          { name: 'Total Weight', actual: row.total_weight, expected: totalWeight },
          { name: 'Base Amount', actual: row.base_amount, expected: baseAmount },
          { name: 'Discount Amount', actual: row.disc_amount, expected: discountAmount },
          { name: 'Taxable Amount', actual: row.taxable_amount, expected: taxableAmount },
          { name: 'Tax Amount', actual: row.tax_amount, expected: taxAmount },
          { name: 'Net Amount', actual: row.amount, expected: netAmount }
        ];

        checks.forEach(check => {
          const pass = check.actual === check.expected;
          console.log(`  ${pass ? '✓' : '✗'} ${check.name}: ${check.actual} === ${check.expected}`);
          if (!pass) allPass = false;
        });

        if (allPass) {
          console.log('\n✓✓✓ ALL ERP CALCULATIONS CORRECT ✓✓✓');
        } else {
          console.log('\n✗✗✗ SOME CALCULATIONS FAILED ✗✗✗');
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error?.message || error);
    console.error('ERROR NAME:', error?.name);
    console.error('ERROR CODE:', error?.code);
    console.error('HTTP STATUS:', error?.response?.status);
    console.error('HTTP STATUS TEXT:', error?.response?.statusText);
    if (error?.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('Full error:', error);
    process.exit(1);
  }
})();

