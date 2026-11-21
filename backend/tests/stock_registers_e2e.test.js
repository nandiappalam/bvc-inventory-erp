const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const db = require('../config/database');
const { COMPANY_TABLES } = require('../database/companySchema');
const { ensureStockRegisterSchema } = require('../services/StockRegisterSchema');
const { resolveCategory, STOCK_CATEGORIES, STORAGE_TYPES } = require('../services/CategoryResolverService');
const { postMovement, reverseDocumentMovements } = require('../services/InventoryService');
const { getReconciliationReport } = require('../services/BackfillAndReconciliationService');
const StockRegisterService = require('../services/StockRegisterService');
const SourceMovementSync = require('../services/SourceMovementSync');

const COMP_A = 99;
const COMP_B = 98;
const DB_DIR = path.join(__dirname, '..', '..', 'database');

function removeTestDbIfExists(cId) {
  for (const suffix of ['', '-wal', '-shm']) {
    const f = path.join(DB_DIR, `company_${cId}.db${suffix}`);
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (_) {}
    }
  }
}

async function initTempCompany(cId) {
  const runner = db.forCompany(cId);
  for (const ddl of COMPANY_TABLES) {
    await runner.run(ddl);
  }
  await ensureStockRegisterSchema(cId, runner);
  return runner;
}

test('Three-Register Stock System — End-to-End Domain & Lifecycle Verification', async (t) => {
  removeTestDbIfExists(COMP_A);
  removeTestDbIfExists(COMP_B);

  const runnerA = await initTempCompany(COMP_A);
  const runnerB = await initTempCompany(COMP_B);

  // Clean shutdown cleanup (note: SQLite Handle in dbCache stays open until process exit; delete test rows + try unlink)
  t.after(async () => {
    try {
      await runnerA.run(`DELETE FROM stock_movements WHERE company_id = ?`, [COMP_A]);
      await runnerA.run(`DELETE FROM daily_stock_opening WHERE company_id = ?`, [COMP_A]);
      await runnerA.run(`DELETE FROM daily_stock_closing_lines WHERE company_id = ?`, [COMP_A]);
      await runnerA.run(`DELETE FROM daily_stock_closing WHERE company_id = ?`, [COMP_A]);
    } catch (_) {}
    removeTestDbIfExists(COMP_A);
    removeTestDbIfExists(COMP_B);
  });

  // Seed basic masters in COMP_A
  await runnerA.run(`INSERT OR IGNORE INTO godown_master (id, godown_name, godown_type, is_cold_storage, status) VALUES (1, 'Main Godown', 'Normal', 0, 'Active')`);
  await runnerA.run(`INSERT OR IGNORE INTO godown_master (id, godown_name, godown_type, is_cold_storage, status) VALUES (2, 'BTS Cold Storage', 'Cold Storage', 1, 'Active')`);
  await runnerA.run(`INSERT OR IGNORE INTO financial_years (company_id, financial_year, start_date, end_date, is_active) VALUES (?, '2025-2026', '2025-04-01', '2026-03-31', 1)`, [COMP_A]);
  await runnerA.run(`INSERT OR IGNORE INTO item_master (id, item_name, item_code, item_group, unit, status) VALUES (1, 'Urad Dal Whole', 'RM-URAD-01', 'Raw Materials', 'Bags', 'Active')`);
  await runnerA.run(`INSERT OR IGNORE INTO item_master (id, item_name, item_code, item_group, unit, status) VALUES (2, 'Urad Flour Special', 'FG-FLR-01', 'Flour', 'Bags', 'Active')`);
  await runnerA.run(`INSERT OR IGNORE INTO item_master (id, item_name, item_code, item_group, unit, status) VALUES (3, 'PP Printed Bag 50KG', 'PKG-BAG-01', 'Bag Material', 'Pcs', 'Active')`);
  await runnerA.run(`INSERT OR IGNORE INTO item_master (id, item_name, item_code, item_group, unit, status) VALUES (4, 'Vacuum Pouch 500G', 'PKG-VAC-01', 'Vacuum Material', 'Pcs', 'Active')`);
  await runnerA.run(`INSERT OR IGNORE INTO item_master (id, item_name, item_code, item_group, unit, status) VALUES (5, 'Urad Husk Wastage', 'WST-01', 'Wastage', 'KG', 'Active')`);

  // 1. Explicit Company ID check (Never silent fallback to Company 1)
  await assert.rejects(
    () => StockRegisterService.getCurrentLiveStockReport(null, { stockDate: '2025-04-01' }),
    /Explicit positive companyId is required/
  );

  // 2. Six-category resolver check
  assert.equal((await resolveCategory(COMP_A, { itemName: 'Urad Dal Whole' }, runnerA)).stockCategory, STOCK_CATEGORIES.RM);
  assert.equal((await resolveCategory(COMP_A, { itemName: 'Urad Flour Special' }, runnerA)).stockCategory, STOCK_CATEGORIES.FG);
  assert.equal((await resolveCategory(COMP_A, { itemName: 'PP Printed Bag 50KG' }, runnerA)).stockCategory, STOCK_CATEGORIES.BAG);
  assert.equal((await resolveCategory(COMP_A, { itemName: 'Vacuum Pouch 500G' }, runnerA)).stockCategory, STOCK_CATEGORIES.VACUUM);
  assert.equal((await resolveCategory(COMP_A, { itemName: 'Urad Husk Wastage' }, runnerA)).stockCategory, STOCK_CATEGORIES.WASTAGE);
  assert.equal((await resolveCategory(COMP_A, { itemName: 'Urad Dal Whole', godownName: 'BTS Cold Storage' }, runnerA)).storageType, STORAGE_TYPES.COLD_STORAGE);

  // 3. First-Day FY (2025-04-01) explicit Opening + Duplicate Guard + Lock Protection
  const pkOpen = `OPEN:${COMP_A}:OPEN:1:1:IN:OPENING`;
  const openRes1 = await postMovement(COMP_A, {
    postingKey: pkOpen,
    financialYear: '2025-04-01' ? '2025-2026' : '2025-2026',
    movementDate: '2025-04-01',
    movementTime: '08:00:00',
    itemId: 1,
    itemName: 'Urad Dal Whole',
    lotNo: 'RM-OPEN-01',
    godownId: 1,
    godownName: 'Main Godown',
    direction: 'IN',
    movementType: 'OPENING',
    qty: 100,
    unitWeight: 50,
    weight: 5000,
    sourceModule: 'OPEN',
    sourceId: 1,
    sourceLineId: 1,
    sourceRefNo: 'OPEN-1'
  }, runnerA);
  assert.ok(!openRes1.duplicate);

  // Same postingKey must not duplicate
  const openResDup = await postMovement(COMP_A, {
    postingKey: pkOpen,
    movementDate: '2025-04-01',
    itemName: 'Urad Dal Whole',
    lotNo: 'RM-OPEN-01',
    godownId: 1,
    godownName: 'Main Godown',
    direction: 'IN',
    movementType: 'OPENING',
    qty: 100,
    weight: 5000,
    sourceModule: 'OPEN',
    sourceId: 1,
    sourceLineId: 1
  }, runnerA);
  assert.equal(openResDup.duplicate, true);

  const day1Opening = await StockRegisterService.getDailyOpeningRegister(COMP_A, { stockDate: '2025-04-01', financialYear: '2025-2026' });
  assert.equal(day1Opening.isFirstDayOfFy, true);
  assert.equal(day1Opening.isProvisional, false, 'First day of FY with explicit opening must not trigger missing D-1 warning');
  assert.equal(day1Opening.rows[0].opening_qty, 100);

  // Approve & lock opening snapshot, then verify regeneration throws 409
  await StockRegisterService.generateOpeningSnapshot(COMP_A, { stockDate: '2025-04-01', financialYear: '2025-2026', approve: true, preparedBy: 'admin' });
  await assert.rejects(
    () => StockRegisterService.generateOpeningSnapshot(COMP_A, { stockDate: '2025-04-01', financialYear: '2025-2026', approve: false }),
    /APPROVED_LOCKED/
  );

  // 4. Intraday Purchase, Production Issue, FG Output, Recoverable Wastage, Non-Physical Process Loss, Time Cutoffs & Reservations
  await postMovement(COMP_A, {
    postingKey: `PUR:${COMP_A}:10:1:IN`,
    movementDate: '2025-04-01',
    movementTime: '10:00:00',
    itemId: 1,
    itemName: 'Urad Dal Whole',
    lotNo: 'RM-PUR-10',
    godownId: 1,
    godownName: 'Main Godown',
    supplierName: 'Gujarat Agro',
    supplierInvoiceNo: 'INV-10',
    direction: 'IN',
    movementType: 'PURCHASE_IN',
    qty: 50,
    unitWeight: 50,
    weight: 2500,
    sourceModule: 'PURCHASE',
    sourceId: 10,
    sourceLineId: 1,
    sourceRefNo: 'PUR-10'
  }, runnerA);

  // Milling Issue RM (11:00:00) -> Out 30 bags (1500 KG)
  await postMovement(COMP_A, {
    postingKey: `GRD:${COMP_A}:20:in1:OUT`,
    movementDate: '2025-04-01',
    movementTime: '11:00:00',
    itemId: 1,
    itemName: 'Urad Dal Whole',
    lotNo: 'RM-OPEN-01',
    godownId: 1,
    godownName: 'Main Godown',
    direction: 'OUT',
    movementType: 'PRODUCTION_ISSUE',
    qty: 30,
    unitWeight: 50,
    weight: 1500,
    sourceModule: 'GRAIN',
    sourceId: 20,
    sourceLineId: 1,
    sourceRefNo: 'GRD-20'
  }, runnerA);

  // Milling Output FG (11:15:00) -> In 25 bags (1250 KG) with FG + Parent Lot genealogy
  await postMovement(COMP_A, {
    postingKey: `GRD:${COMP_A}:20:out1:IN`,
    movementDate: '2025-04-01',
    movementTime: '11:15:00',
    itemId: 2,
    itemName: 'Urad Flour Special',
    lotNo: 'FG-MILL-20',
    rmLotNo: 'RM-OPEN-01',
    fgLotNo: 'FG-MILL-20',
    parentLotNo: 'RM-OPEN-01',
    godownId: 1,
    godownName: 'Main Godown',
    direction: 'IN',
    movementType: 'PRODUCTION_OUTPUT',
    qty: 25,
    unitWeight: 50,
    weight: 1250,
    sourceModule: 'GRAIN',
    sourceId: 20,
    sourceLineId: 2,
    sourceRefNo: 'GRD-20'
  }, runnerA);

  // Non-physical PROCESS_LOSS (must NOT deduct physical stock)
  await postMovement(COMP_A, {
    postingKey: `GRD:${COMP_A}:20:loss:OUT`,
    movementDate: '2025-04-01',
    movementTime: '11:20:00',
    itemId: 1,
    itemName: 'Urad Dal Whole',
    lotNo: 'RM-OPEN-01',
    godownId: 1,
    godownName: 'Main Godown',
    direction: 'OUT',
    movementType: 'PROCESS_LOSS',
    qty: 2,
    unitWeight: 50,
    weight: 100,
    isPhysicalStock: false,
    sourceModule: 'GRAIN',
    sourceId: 20,
    sourceLineId: 3,
    sourceRefNo: 'GRD-20'
  }, runnerA);

  // Afternoon Sales Dispatch (15:00:00) -> 5 bags FG
  await postMovement(COMP_A, {
    postingKey: `SAL:${COMP_A}:30:1:OUT`,
    movementDate: '2025-04-01',
    movementTime: '15:00:00',
    itemId: 2,
    itemName: 'Urad Flour Special',
    lotNo: 'FG-MILL-20',
    godownId: 1,
    godownName: 'Main Godown',
    direction: 'OUT',
    movementType: 'SALES_DISPATCH',
    qty: 5,
    unitWeight: 50,
    weight: 250,
    sourceModule: 'SALES',
    sourceId: 30,
    sourceLineId: 1,
    sourceRefNo: 'INV-30'
  }, runnerA);

  // Open Sales Order reservation (does NOT reduce physical stock!) -> 8 bags FG
  await runnerA.run(`INSERT INTO sales (id, s_no, date, customer, is_order) VALUES (31, 31, '2025-04-01', 'Test Buyer', 1)`);
  await runnerA.run(`INSERT INTO sales_items (sales_id, item_name, qty, weight, total_wt, lot_no) VALUES (31, 'Urad Flour Special', 8, 50, 400, 'FG-MILL-20')`);

  // Check As-Of Time Cutoff 11:30:00 (excludes 15:00:00 dispatch!)
  const midDay = await StockRegisterService.getCurrentLiveStockReport(COMP_A, {
    stockDate: '2025-04-01',
    asOfTime: '11:30:00',
    financialYear: '2025-2026'
  });
  const fgMidDay = midDay.rows.find(r => r.item_name === 'Urad Flour Special');
  assert.equal(fgMidDay.current_balance_qty, 25, '11:30 cutoff must show 25 FG before 15:00 dispatch');
  assert.equal(fgMidDay.reserved_qty, 8, 'Open order reserves 8 FG');
  assert.equal(fgMidDay.available_stock_qty, 17, 'Available = 25 - 8 = 17');

  const rmMidDay = midDay.rows.find(r => r.lot_no === 'RM-OPEN-01');
  assert.equal(rmMidDay.current_balance_qty, 70, 'Non-physical PROCESS_LOSS must NOT reduce RM physical balance (100 - 30 = 70)');

  // Check EOD Live Stock (includes 15:00:00 dispatch)
  const eodLive = await StockRegisterService.getCurrentLiveStockReport(COMP_A, {
    stockDate: '2025-04-01',
    asOfTime: '23:59:59',
    financialYear: '2025-2026'
  });
  const fgEod = eodLive.rows.find(r => r.item_name === 'Urad Flour Special');
  assert.equal(fgEod.current_balance_qty, 20);
  assert.equal(fgEod.available_stock_qty, 12);

  // 5. Source Document Edit / Delete Reversal
  await reverseDocumentMovements(COMP_A, { sourceModule: 'SALES', sourceId: 30, reason: 'Sales invoice cancelled', conn: runnerA });
  const afterCancel = await StockRegisterService.getCurrentLiveStockReport(COMP_A, {
    stockDate: '2025-04-01',
    asOfTime: '23:59:59',
    financialYear: '2025-2026'
  });
  const fgAfterCancel = afterCancel.rows.find(r => r.item_name === 'Urad Flour Special');
  assert.equal(fgAfterCancel.current_balance_qty, 25, 'Reversing sales dispatch restores FG physical balance to 25');

  // Verify drill-down preserves audit trail
  const drill = await StockRegisterService.getRowMovementDrilldown(COMP_A, {
    itemName: 'Urad Flour Special',
    lotNo: 'FG-MILL-20',
    viewMode: 'full_lot'
  });
  assert.ok(drill.movements.some(m => m.reversal_status === 'Reversed'), 'Drilldown preserves reversed movement audit entry');
  assert.equal(drill.totals.currentBalanceQty, 25);

  // 6. Provisional Warning on D+1 before D-1 Closing is approved
  const day2Provisional = await StockRegisterService.getDailyOpeningRegister(COMP_A, { stockDate: '2025-04-02', financialYear: '2025-2026' });
  assert.equal(day2Provisional.isProvisional, true);
  assert.equal(day2Provisional.provisionalWarning, 'PROVISIONAL OPENING — PREVIOUS DAY CLOSING NOT APPROVED');

  // 7. Closing Register Lifecycle: Draft -> Physical Count -> Verify -> Approve & Lock -> Carry-Forward to 2025-04-02
  const draft = await StockRegisterService.createOrRefreshClosingDraft(COMP_A, {
    closingDate: '2025-04-01',
    financialYear: '2025-2026',
    preparedBy: 'admin'
  });
  assert.equal(draft.status, 'DRAFT');

  const rmLine = draft.rows.find(r => r.lot_no === 'RM-OPEN-01');
  // Record physical count shortage of 2 bags (70 -> 68)
  await StockRegisterService.savePhysicalCounts(COMP_A, draft.header.id, {
    lines: [{ line_id: rmLine.id, physical_count_qty: 68, physical_count_weight: 3400, variance_reason: 'Moisture & handling shrinkage' }],
    performedBy: 'supervisor'
  });

  const verified = await StockRegisterService.verifyClosing(COMP_A, draft.header.id, { verifiedBy: 'supervisor' });
  assert.equal(verified.status, 'VERIFIED');

  const locked = await StockRegisterService.approveAndLockClosing(COMP_A, draft.header.id, { approvedBy: 'admin' });
  assert.equal(locked.status, 'APPROVED_LOCKED');
  assert.equal(locked.isLocked, true);

  // Day 2 Opening now carries forward APPROVED_LOCKED closing WITHOUT provisional warning
  const day2LockedCarry = await StockRegisterService.getDailyOpeningRegister(COMP_A, { stockDate: '2025-04-02', financialYear: '2025-2026' });
  assert.equal(day2LockedCarry.isProvisional, false);
  const rmDay2 = day2LockedCarry.rows.find(r => r.lot_no === 'RM-OPEN-01');
  assert.equal(rmDay2.opening_qty, 68, 'Day 2 carried-forward opening reflects approved physical closing count (68)');

  // 8. Cold Storage + Godown Transfer double-posting guard test
  await runnerA.run(`INSERT INTO godown_transfers (id, s_no, transfer_date, item_name, lot_no, from_godown_id, from_godown_name, to_godown_id, to_godown_name, qty, weight)
    VALUES (50, 'GT-50', '2025-04-02', 'Urad Dal Whole', 'RM-PUR-10', 1, 'Main Godown', 2, 'BTS Cold Storage', 10, 500)`);
  await runnerA.run(`INSERT INTO cold_storage_vouchers (id, voucher_no, voucher_type, voucher_date, cold_storage_id, cold_storage_name, source_godown_id, source_godown_name, remarks, total_qty, total_wt)
    VALUES (51, 'CSI-51', 'IN', '2025-04-02', 2, 'BTS Cold Storage', 1, 'Main Godown', 'Auto-created from Godown Transfer GT-50', 10, 500)`);
  await SourceMovementSync.syncDocumentMovements(COMP_A, 'GODOWN_TRANSFER', 50);
  await SourceMovementSync.syncDocumentMovements(COMP_A, 'COLD_STORAGE', 51);
  const csCheck = await runnerA.all(`SELECT * FROM stock_movements WHERE company_id = ? AND movement_date = '2025-04-02' AND source_module = 'COLD_STORAGE'`, [COMP_A]);
  assert.equal(csCheck.length, 0, 'Auto-created cold storage voucher mirrored from godown transfer must be skipped to prevent double posting');

  // 9. Multi-Company Isolation (COMP_B sees zero COMP_A movements)
  const compBLive = await StockRegisterService.getCurrentLiveStockReport(COMP_B, { stockDate: '2025-04-02' });
  assert.equal(compBLive.rows.length, 0, 'Company B must see zero rows from Company A');

  // 10. Shadow Reconciliation runs read-only without error
  const recon = await getReconciliationReport(COMP_A, { financialYear: '2025-2026' }, runnerA);
  assert.ok(Array.isArray(recon.rows));
  assert.ok(recon.rows.length > 0);
});
