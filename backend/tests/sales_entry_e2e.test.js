const assert = require('assert');
const db = require('../config/database');
const SalesService = require('../services/SalesService');

async function run() {
  const companyId = 1;
  await SalesService.ensureSalesSchema(companyId);
  const runner = db.forCompany(companyId);

  console.log('1. Checking Sales lookups, customer context, available lots, and serials...');
  let lookups = await SalesService.getFormLookups(companyId);
  assert(Array.isArray(lookups.items) && lookups.items.length > 0, 'Expected at least 1 item in lookups');
  assert(Array.isArray(lookups.godowns) && lookups.godowns.length > 0, 'Expected at least 1 godown in lookups');

  let tempCustomerId = null;
  if (!lookups.customers || lookups.customers.length === 0) {
    const insCust = await runner.run(
      `INSERT INTO customer_master (name, print_name, state, state_code, gst_number, mobile1, limit_days, limit_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
      ['E2E Test Buyer', 'E2E Test Buyer', 'Tamil Nadu', '33', '33AABCU9603R1ZM', '9876543210', 15, 500000]
    );
    tempCustomerId = insCust.lastID;
    lookups = await SalesService.getFormLookups(companyId);
  }
  assert(Array.isArray(lookups.customers) && lookups.customers.length > 0, 'Expected at least 1 customer in lookups');

  const firstCust = lookups.customers[0];
  const custCtx = await SalesService.getCustomerContext(companyId, firstCust.id);
  assert(custCtx && String(custCtx.id) === String(firstCust.id), 'Customer context must resolve');

  const fgLots = await SalesService.getAvailableLots(companyId, { stock_type: 'FG' });
  const chosenLot = fgLots.find((l) => Number(l.available_qty) >= 3) || fgLots[0];
  assert(chosenLot, 'Expected at least 1 available FG lot in stock');
  const takeQty = Math.min(2, Number(chosenLot.available_qty));
  assert(takeQty > 0, 'Available lot must have positive qty');

  const preLotRes = await runner.query(
    `SELECT SUM(remaining_quantity) AS rem FROM stock_lots WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))`,
    [chosenLot.item_name, chosenLot.lot_no]
  );
  const preLotRem = Number(preLotRes.rows?.[0]?.rem || 0);

  const nextOutpassNo = await SalesService.getNextOutpassNo(companyId);
  assert(/^OP-\d{5,}$/.test(nextOutpassNo), `Expected OP-xxxxx format, got ${nextOutpassNo}`);
  const nextSalesNo = await SalesService.getNextSalesNo(companyId, false);
  assert(Number(nextSalesNo) >= 1, 'Expected valid next sales s_no');

  const createdSalesIds = [];

  try {
    console.log('2. Creating Sales Invoice (Per Kg + Weighbridge + Auto-Outpass + Seller Recovered Freight + Partial Payment)...');
    const unitWt = Number(chosenLot.unit_weight) || 50;
    const netProductWt = Number((takeQty * unitWt).toFixed(3));
    const saleRes = await SalesService.createSale(companyId, {
      formData: {
        date: '2026-11-22',
        is_order: 0,
        auto_outpass: 1,
        customer_id: firstCust.id,
        customer_name: custCtx.name,
        party_state: lookups.company?.state || 'Tamil Nadu',
        party_state_code: lookups.company?.state_code || '33',
        tax_type: 'Exclusive',
        pay_type: 'Credit',
        payment_mode: 'Bank Transfer',
        received_amount: 500,
        advance_adjusted: 100,
        lorry_no: 'TN-59-AB-1234',
        driver: 'Ramesh',
        weighment_mode: 'Weighbridge Slip',
        weighment_slip_no: 'WB-991',
        vehicle_gross_weight: 12000,
        vehicle_tare_weight: 9000,
        freight_type: 'Fixed',
        freight_amount: 1500,
        freight_paid_by: 'Seller',
        recover_freight_on_invoice: 1,
        loading_charges_amt: 200,
        other_charges: 50,
        tcs_amount: 25,
        round_off: 0.4,
        godown_from_id: chosenLot.godown_id,
        godown_from_name: chosenLot.godown_name,
        stock_type: 'FG'
      },
      items: [
        {
          item_id: chosenLot.item_id,
          item_name: chosenLot.item_name,
          category: 'FG',
          lot_no: chosenLot.lot_no,
          parent_rm_lot_no: chosenLot.parent_rm_lot_no || '',
          godown_id: chosenLot.godown_id,
          godown_name: chosenLot.godown_name,
          package_type: 'Bag',
          package_tare_wt: 0.25,
          uom: 'Bags',
          weight: unitWt,
          qty: takeQty,
          net_product_wt: netProductWt,
          rate: 40,
          rate_type: 'Per Kg',
          disc: 10,
          tax_rate: 5
        }
      ]
    }, { username: 'e2e_tester' });

    assert(saleRes.success && saleRes.id, 'createSale must return success & id');
    createdSalesIds.push(saleRes.id);
    assert(saleRes.outpass_id && saleRes.outpass_no === nextOutpassNo, `Expected auto-outpass ${nextOutpassNo}, got ${saleRes.outpass_no}`);
    assert(saleRes.receipt_voucher_no, 'Expected separate REC voucher for partial payment');
    assert(saleRes.freight_voucher_no, 'Seller freight must generate sales_freight voucher');

    const savedRes = await runner.query(`SELECT * FROM sales WHERE id = ?`, [saleRes.id]);
    const saved = savedRes.rows[0];
    assert.strictEqual(Number(saved.net_load_weight), 3000, 'Net Load Weight must equal 12000 - 9000 = 3000');
    assert.strictEqual(Number(saved.package_tare_weight), Number((takeQty * 0.25).toFixed(3)), 'Package tare must calculate separately');
    assert(Number(saved.cgst_amt) > 0 && Number(saved.sgst_amt) > 0 && Number(saved.igst_amt) === 0, 'Intra-state must populate CGST+SGST only');
    assert.strictEqual(Number(saved.freight_recovery_amt), 1500, 'Freight recovery amount must be 1500');
    assert(Number(saved.balance_receivable) === Number((saved.grand_total - 600).toFixed(2)), 'Balance receivable must deduct received + advance');

    // Verify zero duplicate stock movement across SALES + OUTPASS
    const smSalesRes = await runner.query(
      `SELECT COUNT(*) AS cnt, SUM(qty) AS qty_sum FROM stock WHERE reference_id = ? AND type = 'Sale'`,
      [saleRes.id]
    );
    const smOutpassRes = await runner.query(
      `SELECT COUNT(*) AS cnt FROM stock WHERE reference_id = ? AND type = 'Outpass'`,
      [saleRes.outpass_id]
    );
    assert.strictEqual(Number(smSalesRes.rows[0].cnt), 1, 'Expected exactly 1 SALES stock movement row');
    assert.strictEqual(Math.abs(Number(smSalesRes.rows[0].qty_sum)), takeQty, 'Expected exact qty deduction in stock');
    assert.strictEqual(Number(smOutpassRes.rows[0].cnt), 0, 'Expected ZERO stock movement rows from auto-generated Sales Outpass');

    const midLotRes = await runner.query(
      `SELECT SUM(remaining_quantity) AS rem FROM stock_lots WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))`,
      [chosenLot.item_name, chosenLot.lot_no]
    );
    assert(Math.abs(Number(midLotRes.rows[0].rem) - (preLotRem - takeQty)) < 1e-6, 'stock_lots remaining_quantity must decrement accurately');

    console.log('3. Updating Sale to Inter-State (IGST) + Seller Non-Recovered Freight (JNL Voucher)...');
    const updRes = await SalesService.updateSale(companyId, saleRes.id, {
      formData: {
        date: '2026-11-22',
        is_order: 0,
        auto_outpass: 1,
        customer_id: firstCust.id,
        customer_name: custCtx.name,
        party_state: 'Karnataka',
        party_state_code: '29',
        tax_type: 'Exclusive',
        pay_type: 'Credit',
        received_amount: 500,
        advance_adjusted: 0,
        lorry_no: 'TN-59-AB-1234',
        vehicle_gross_weight: 12000,
        vehicle_tare_weight: 9000,
        freight_type: 'Fixed',
        freight_amount: 1800,
        freight_paid_by: 'Seller',
        recover_freight_on_invoice: 0,
        godown_from_id: chosenLot.godown_id,
        godown_from_name: chosenLot.godown_name,
        stock_type: 'FG'
      },
      items: [
        {
          item_id: chosenLot.item_id,
          item_name: chosenLot.item_name,
          category: 'FG',
          lot_no: chosenLot.lot_no,
          godown_id: chosenLot.godown_id,
          godown_name: chosenLot.godown_name,
          uom: 'Bags',
          weight: unitWt,
          qty: takeQty,
          net_product_wt: netProductWt,
          rate: 42,
          rate_type: 'Per Kg',
          disc: 0,
          tax_rate: 5
        }
      ]
    }, { username: 'e2e_tester' });

    assert.strictEqual(updRes.outpass_no, saleRes.outpass_no, 'Update must preserve linked Outpass serial');
    assert(updRes.freight_voucher_no, 'Seller non-recovered freight must generate JNL freight voucher');
    const updRow = (await runner.query(`SELECT * FROM sales WHERE id = ?`, [saleRes.id])).rows[0];
    assert(Number(updRow.igst_amt) > 0 && Number(updRow.cgst_amt) === 0 && Number(updRow.sgst_amt) === 0, 'Inter-state must populate IGST only');

    // Verify voucher double-entry balance
    const vouchersRes = await runner.query(
      `SELECT v.id, v.voucher_no, v.source_module,
              (SELECT COALESCE(SUM(debit), 0) FROM voucher_entry WHERE voucher_id = v.id) AS tot_dr,
              (SELECT COALESCE(SUM(credit), 0) FROM voucher_entry WHERE voucher_id = v.id) AS tot_cr
       FROM voucher v
       WHERE v.source_id = ? AND v.source_module IN ('sales', 'sales_receipt', 'sales_freight')`,
      [saleRes.id]
    );
    assert.strictEqual(vouchersRes.rows.length, 3, 'Expected 3 separate vouchers: sales, sales_receipt, sales_freight');
    for (const v of vouchersRes.rows) {
      assert(Math.abs(Number(v.tot_dr) - Number(v.tot_cr)) < 0.01, `Voucher ${v.voucher_no} must balance Dr === Cr`);
    }

    console.log('4. Creating Sales Order (is_order = 1) and verifying zero stock/outpass/voucher side effects...');
    const orderRes = await SalesService.createSale(companyId, {
      formData: {
        date: '2026-11-22',
        is_order: 1,
        auto_outpass: 1,
        customer_id: firstCust.id,
        customer_name: custCtx.name,
        party_state: 'Tamil Nadu',
        party_state_code: '33',
        tax_type: 'Exclusive',
        pay_type: 'Credit',
        stock_type: 'FG'
      },
      items: [
        {
          item_id: chosenLot.item_id,
          item_name: chosenLot.item_name,
          category: 'FG',
          lot_no: chosenLot.lot_no,
          godown_id: chosenLot.godown_id,
          godown_name: chosenLot.godown_name,
          weight: unitWt,
          qty: takeQty,
          net_product_wt: netProductWt,
          rate: 40,
          rate_type: 'Per Kg',
          tax_rate: 5
        }
      ]
    }, { username: 'e2e_tester' });

    assert(orderRes.success && orderRes.id, 'Sales Order creation must succeed');
    createdSalesIds.push(orderRes.id);
    assert(!orderRes.outpass_id && !orderRes.outpass_no, 'Sales Order must NOT generate Outpass');
    const orderVouchers = await runner.query(`SELECT COUNT(*) AS cnt FROM voucher WHERE source_id = ? AND source_module LIKE 'sales%'`, [orderRes.id]);
    assert.strictEqual(Number(orderVouchers.rows[0].cnt), 0, 'Sales Order must NOT create accounting vouchers');
    const orderMoves = await runner.query(`SELECT COUNT(*) AS cnt FROM stock WHERE reference_id = ? AND type = 'Sale'`, [orderRes.id]);
    assert.strictEqual(Number(orderMoves.rows[0].cnt), 0, 'Sales Order must NOT create stock movements');

    console.log('5. Deleting test Sales Invoice & Order and verifying complete rollback...');
    for (const sid of createdSalesIds) {
      await SalesService.deleteSale(companyId, sid, { username: 'e2e_tester' });
      // Remove test recycle_bin entries created during test
      await runner.run(`DELETE FROM recycle_bin WHERE module_name = 'Sales' AND record_id = ?`, [sid]).catch(() => {});
    }

    const postLotRes = await runner.query(
      `SELECT SUM(remaining_quantity) AS rem FROM stock_lots WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))`,
      [chosenLot.item_name, chosenLot.lot_no]
    );
    const postLotRem = Number(postLotRes.rows?.[0]?.rem || 0);
    assert(Math.abs(postLotRem - preLotRem) < 1e-6, `Expected stock_lots.remaining_quantity restored to ${preLotRem}, got ${postLotRem}`);

    const remVouchers = await runner.query(`SELECT COUNT(*) AS cnt FROM voucher WHERE source_id = ? AND source_module LIKE 'sales%'`, [saleRes.id]);
    assert.strictEqual(Number(remVouchers.rows[0].cnt), 0, 'All linked sales/receipt/freight vouchers must be deleted');
    const remOutpass = await runner.query(`SELECT COUNT(*) AS cnt FROM outpasses WHERE reference_type = 'SALES' AND reference_id = ?`, [saleRes.id]);
    assert.strictEqual(Number(remOutpass.rows[0].cnt), 0, 'Linked Sales Outpass must be deleted');

    if (tempCustomerId) {
      await runner.run(`DELETE FROM customer_master WHERE id = ?`, [tempCustomerId]).catch(() => {});
    }
    console.log('✅ ALL SALES ENTRY E2E CHECKS PASSED & CLEANED UP!');
  } catch (err) {
    // Attempt cleanup on failure
    for (const sid of createdSalesIds) {
      try {
        await SalesService.deleteSale(companyId, sid, { username: 'e2e_cleanup' });
        await runner.run(`DELETE FROM recycle_bin WHERE module_name = 'Sales' AND record_id = ?`, [sid]).catch(() => {});
      } catch (_) {}
    }
    if (tempCustomerId) {
      await runner.run(`DELETE FROM customer_master WHERE id = ?`, [tempCustomerId]).catch(() => {});
    }
    throw err;
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ E2E test failed:', err);
    process.exit(1);
  });
