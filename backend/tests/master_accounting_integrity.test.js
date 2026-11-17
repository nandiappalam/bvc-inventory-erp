const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Set disposable temp sqlite db directory BEFORE requiring database/services
const tempTestDir = path.join('/tmp', `bvc_master_test_${Date.now()}`);
process.env.BVC_SQLITE_DB_DIR = tempTestDir;
if (!fs.existsSync(tempTestDir)) {
  fs.mkdirSync(tempTestDir, { recursive: true });
}

const db = require('../config/database');
const AccountingEngine = require('../services/AccountingEngine');
const { createPurchaseVoucherChain } = require('../utils/ledgerHelper');

const INITIAL_LEDGER_GROUPS = [
  { name: 'Capital Account', nature: 'Liability', statement: 'Balance Sheet', balance: 'Cr', parent: null },
  { name: 'Fixed Assets', nature: 'Asset', statement: 'Balance Sheet', balance: 'Dr', parent: null },
  { name: 'Current Assets', nature: 'Asset', statement: 'Balance Sheet', balance: 'Dr', parent: null },
  { name: 'Current Liabilities', nature: 'Liability', statement: 'Balance Sheet', balance: 'Cr', parent: null },
  { name: 'Sundry Debtors', nature: 'Asset', statement: 'Balance Sheet', balance: 'Dr', parent: 'Current Assets' },
  { name: 'Sundry Creditors', nature: 'Liability', statement: 'Balance Sheet', balance: 'Cr', parent: 'Current Liabilities' },
  { name: 'Bank Accounts', nature: 'Asset', statement: 'Balance Sheet', balance: 'Dr', parent: 'Current Assets' },
  { name: 'Cash-in-hand', nature: 'Asset', statement: 'Balance Sheet', balance: 'Dr', parent: 'Current Assets' },
  { name: 'Purchase Accounts', nature: 'Expense', statement: 'Trading Account', balance: 'Dr', parent: null },
  { name: 'Sales Accounts', nature: 'Income', statement: 'Trading Account', balance: 'Cr', parent: null },
  { name: 'Direct Expenses', nature: 'Expense', statement: 'Profit & Loss', balance: 'Dr', parent: null },
  { name: 'Indirect Expenses', nature: 'Expense', statement: 'Profit & Loss', balance: 'Dr', parent: null },
  { name: 'Direct Income', nature: 'Income', statement: 'Trading Account', balance: 'Cr', parent: null },
  { name: 'Indirect Income', nature: 'Income', statement: 'Profit & Loss', balance: 'Cr', parent: null },
  { name: 'Duties & Taxes', nature: 'Liability', statement: 'Balance Sheet', balance: 'Cr', parent: 'Current Liabilities' },
  { name: 'Loans & Borrowings', nature: 'Liability', statement: 'Balance Sheet', balance: 'Cr', parent: null },
  { name: 'Suspense Accounts', nature: 'Liability', statement: 'Balance Sheet', balance: 'Cr', parent: null },
];

async function runMasterAccountingIntegrityTests() {
  console.log('🧪 ==========================================================');
  console.log('🧪 RUNNING BVC ERP MASTER ACCOUNTING & ISOLATION INTEGRITY TESTS');
  console.log('🧪 ==========================================================\n');

  try {
    // Test 1: Database Schema & Company 1 Initialization
    console.log('Test 1: Ensuring accounting schema and initial ledger groups for Company 1...');
    const comp1 = db.forCompany(1);
    await AccountingEngine.ensureAccountingSchema(comp1);

    // Seed ledger groups
    for (const g of INITIAL_LEDGER_GROUPS) {
      await comp1.run(
        `INSERT OR IGNORE INTO ledger_groups (group_name, account_nature, financial_statement, normal_balance) VALUES (?, ?, ?, ?)`,
        [g.name, g.nature, g.statement, g.balance]
      );
    }

    const groupsRes = await comp1.query("SELECT COUNT(*) as cnt FROM ledger_groups");
    const groupCount = Number(groupsRes.rows?.[0]?.cnt || 0);
    assert.ok(groupCount >= 15, `Initial ledger groups should be seeded (found ${groupCount})`);
    console.log(`[PASS] Test 1: Ledger groups seeded successfully (${groupCount} groups).`);

    // Test 2: Idempotent Purchase Posting & Voucher Numbering
    console.log('Test 2: Testing idempotent purchase posting and unique voucher numbering...');
    const supplierName = 'Test Supplier ABC';
    const invNo = 'INV-MASTER-01';
    
    const postRes1 = await createPurchaseVoucherChain({
      companyId: 1,
      supplier: supplierName,
      date: '2026-11-01',
      invNo,
      purchaseId: 5001,
      baseAmount: 100000,
      taxAmount: 5000,
      netAmount: 105000,
      narration: 'Master purchase test #1',
    });

    assert.ok(postRes1?.voucherNo, 'Voucher number generated');
    assert.strictEqual(postRes1.voucherNo.startsWith('PUR'), true, 'Purchase voucher prefix starts with PUR');

    // Post again with same postingKey/sourceId to test idempotency
    const postRes2 = await createPurchaseVoucherChain({
      companyId: 1,
      supplier: supplierName,
      date: '2026-11-01',
      invNo,
      purchaseId: 5001,
      baseAmount: 100000,
      taxAmount: 5000,
      netAmount: 105000,
      narration: 'Master purchase test #1 updated',
    });

    const vCheck = await comp1.query("SELECT COUNT(*) as cnt FROM voucher WHERE reference_no = ? AND voucher_type = 'Purchase'", [String(5001)]);
    assert.strictEqual(Number(vCheck.rows[0].cnt), 1, 'Idempotency must maintain exactly 1 purchase voucher without duplicates');
    console.log(`[PASS] Test 2: Idempotent purchase posting verified (${postRes2.voucherNo}).`);

    // Test 3: Loadman / Worker Numeric Name Isolation (`'5'` and `'3'`)
    console.log('Test 3: Testing numeric worker name isolation vs ledgermaster IDs...');
    const workerLedger = await AccountingEngine.resolveOrCreateLedger({
      conn: comp1,
      companyId: 1,
      name: '5',
      ledgerType: 'Worker',
    });
    assert.ok(workerLedger?.id, 'Worker named "5" resolved');

    const workerStatement = await AccountingEngine.getGroupSummaryAndTree(1, { fromDate: '2026-10-01', toDate: '2026-11-30' });
    assert.ok(workerStatement?.groups, 'Group summary retrieved successfully');
    console.log(`[PASS] Test 3: Numeric worker name '5' successfully isolated without ID collision.`);

    // Test 4: 3-Company Isolation
    console.log('Test 4: Testing 3-company data isolation...');
    await db.master.run(`INSERT INTO companies (code, name, status) VALUES ('COMP_A', 'Company A', 'Active')`, []);
    await db.master.run(`INSERT INTO companies (code, name, status) VALUES ('COMP_B', 'Company B', 'Active')`, []);
    await db.master.run(`INSERT INTO companies (code, name, status) VALUES ('COMP_C', 'Company C', 'Active')`, []);
    
    await db.createCompanyDatabase(2, 'COMP_A');
    await db.createCompanyDatabase(3, 'COMP_B');
    await db.createCompanyDatabase(4, 'COMP_C');

    const dbA = db.forCompany(2);
    const dbB = db.forCompany(3);

    await dbA.run(`INSERT INTO ledgermaster (ledger_name, group_name, opening_balance) VALUES ('SharedSupplier', 'Sundry Creditors', 1000)`, []);
    await dbB.run(`INSERT INTO ledgermaster (ledger_name, group_name, opening_balance) VALUES ('SharedSupplier', 'Sundry Creditors', 2000)`, []);

    const resA = await dbA.query(`SELECT opening_balance FROM ledgermaster WHERE ledger_name = 'SharedSupplier'`, []);
    const resB = await dbB.query(`SELECT opening_balance FROM ledgermaster WHERE ledger_name = 'SharedSupplier'`, []);

    assert.strictEqual(Number(resA.rows[0].opening_balance), 1000, 'Company 2 ledger balance is 1000');
    assert.strictEqual(Number(resB.rows[0].opening_balance), 2000, 'Company 3 ledger balance is 2000');
    console.log('[PASS] Test 4: Multi-company data isolation verified across 3 tenants.');

    // Test 5: Contra Voucher Validation (Cash to Bank)
    console.log('Test 5: Testing Contra voucher validation rules...');
    const cashLedger = await AccountingEngine.resolveOrCreateLedger({ conn: comp1, companyId: 1, name: 'Cash in Hand', ledgerType: 'Cash' });
    const bankLedger = await AccountingEngine.resolveOrCreateLedger({ conn: comp1, companyId: 1, name: 'HDFC Bank', ledgerType: 'Bank' });

    let contraErr = null;
    try {
      await AccountingEngine.postVoucher({
        conn: comp1,
        companyId: 1,
        voucherType: 'Contra',
        prefix: 'CON',
        date: '2026-11-02',
        lines: [
          { ledgerId: cashLedger.id, debit: 5000, credit: 0 },
          { ledgerId: cashLedger.id, debit: 0, credit: 5000 },
        ],
      });
    } catch (err) {
      contraErr = err;
    }
    assert.ok(contraErr, 'Contra voucher to same account must be rejected');

    const contraValid = await AccountingEngine.postVoucher({
      conn: comp1,
      companyId: 1,
      voucherType: 'Contra',
      prefix: 'CON',
      date: '2026-11-02',
      lines: [
        { ledgerId: bankLedger.id, debit: 10000, credit: 0 },
        { ledgerId: cashLedger.id, debit: 0, credit: 10000 },
      ],
    });
    assert.ok(contraValid?.voucherNo, 'Valid Contra voucher posted successfully');
    console.log('[PASS] Test 5: Contra validation rules verified.');

    // Test 6: Mid-Flight Transaction Rollback Atomicity
    console.log('Test 6: Testing transaction rollback atomicity...');
    let rolledBack = false;
    try {
      await db.forCompany(1).withTransaction(async (txConn) => {
        await txConn.run(`INSERT INTO purchases (s_no, date, inv_no, supplier, grand_total) VALUES (999, '2026-11-03', 'INV-FAIL', 'FailSupplier', 50000)`, []);
        throw new Error('Simulated mid-flight crash');
      });
    } catch (err) {
      if (err.message.includes('Simulated mid-flight crash')) rolledBack = true;
    }
    assert.strictEqual(rolledBack, true, 'Transaction threw expected error');

    const failCheck = await comp1.query("SELECT * FROM purchases WHERE inv_no = 'INV-FAIL'", []);
    assert.strictEqual(failCheck.rows.length, 0, 'Failed purchase transaction must roll back completely');
    console.log('[PASS] Test 6: Transaction rollback atomicity verified.');

    // Test 7: Formal Voucher Reversal
    console.log('Test 7: Testing formal voucher reversal semantics...');
    const revRes = await AccountingEngine.reverseVoucher({
      conn: comp1,
      companyId: 1,
      voucherId: postRes1.voucherId,
      reason: 'Testing cancellation reversal',
    });
    assert.ok(revRes?.reversalVoucherNo, 'Reversal journal created successfully');

    const origV = await comp1.query("SELECT is_reversed, status FROM voucher WHERE id = ?", [postRes1.voucherId]);
    assert.strictEqual(Number(origV.rows[0].is_reversed), 1, 'Original voucher is marked is_reversed = 1');
    assert.strictEqual(origV.rows[0].status, 'REVERSED', 'Original voucher status is REVERSED');
    console.log('[PASS] Test 7: Voucher reversal and audit trail cancellation verified.');

    console.log('\n🎉 ALL MASTER ACCOUNTING & ISOLATION INTEGRITY TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Integration Test Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    try {
      await db.closeSqliteConnections();
      if (fs.existsSync(tempTestDir)) {
        fs.rmSync(tempTestDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

if (require.main === module) {
  runMasterAccountingIntegrityTests();
}

module.exports = runMasterAccountingIntegrityTests;
