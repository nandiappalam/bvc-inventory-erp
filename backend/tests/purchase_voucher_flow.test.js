const assert = require('assert');
const db = require('../config/database');
const { completePurchase } = require('../services/TransactionService');
const { deleteVoucherChain } = require('../services/VoucherService');
const { deleteEntriesByReference } = require('../services/LedgerService');

(async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS test_ledger_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);

    await db.run(`DELETE FROM test_ledger_master WHERE name IN ('Test Supplier','Purchase Account','Input Tax','Discount Received')`);
    await db.run(`DELETE FROM voucher_entry WHERE voucher_id IN (SELECT id FROM voucher WHERE reference_no = ? AND voucher_type = ?)`, ['999999', 'Purchase']);
    await db.run(`DELETE FROM ledger_entries WHERE reference_id = ? AND voucher_type = ?`, [999999, 'Purchase']);
    await db.run(`DELETE FROM voucher WHERE reference_no = ? AND voucher_type = ?`, ['999999', 'Purchase']);
    await db.run(`INSERT OR IGNORE INTO test_ledger_master (name) VALUES ('Test Supplier')`);
    await db.run(`INSERT OR IGNORE INTO test_ledger_master (name) VALUES ('Purchase Account')`);
    await db.run(`INSERT OR IGNORE INTO test_ledger_master (name) VALUES ('Input Tax')`);
    await db.run(`INSERT OR IGNORE INTO test_ledger_master (name) VALUES ('Discount Received')`);

    const result = await completePurchase({
      purchaseId: 999999,
      supplier: 'Test Supplier',
      date: '2026-07-01',
      invNo: 'INV-TEST-1',
      baseAmount: 100,
      taxAmount: 10,
      discAmount: 5,
      netAmount: 105,
      narration: 'Test purchase orchestration',
    });

    assert.ok(result?.voucherId, 'voucher should be created');
    assert.ok(result?.voucherNo, 'voucher number should be generated');
    assert.strictEqual(result?.state, 'POSTED', 'purchase should reach posted state');

    const voucherRows = await db.query('SELECT * FROM voucher WHERE reference_no = ? AND voucher_type = ?', ['999999', 'Purchase']);
    assert.strictEqual(voucherRows.rows.length, 1, 'one purchase voucher should exist');

    const ledgerRows = await db.query('SELECT * FROM ledger_entries WHERE reference_id = ? AND voucher_type = ?', [999999, 'Purchase']);
    assert.ok(ledgerRows.rows.length >= 2, 'ledger entries should be created for the purchase');

    const historyRows = await db.query('SELECT * FROM transaction_history WHERE transaction_type = ? AND transaction_id = ?', ['Purchase', '999999']);
    assert.ok(historyRows.rows.length >= 2, 'transaction history should record workflow transitions');

    await deleteVoucherChain(999999, 'Purchase');
    await deleteEntriesByReference(999999, 'purchase');
    const afterDelete = await db.query('SELECT * FROM voucher WHERE reference_no = ? AND voucher_type = ?', ['999999', 'Purchase']);
    assert.strictEqual(afterDelete.rows.length, 0, 'purchase voucher chain should be removed on delete');

    console.log('purchase voucher flow test passed');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();
