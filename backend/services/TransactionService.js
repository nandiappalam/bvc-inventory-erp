const db = require('../config/database');
const { createPurchaseVoucher, deleteVoucherChain } = require('./VoucherService');
const { deleteEntriesByReference } = require('./LedgerService');
const { validateTransition } = require('./WorkflowService');
const { logEvent } = require('./AuditService');

async function ensureTransactionTables() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS transaction_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_type TEXT NOT NULL,
        transaction_id TEXT NOT NULL,
        source_module TEXT,
        source_document TEXT,
        parent_transaction TEXT,
        parent_id TEXT,
        state TEXT DEFAULT 'DRAFT',
        branch_id TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(transaction_type, transaction_id)
      )
    `);
  } catch (error) {
    console.warn('Transaction registry table setup skipped:', error.message);
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS transaction_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_type TEXT NOT NULL,
        transaction_id TEXT NOT NULL,
        state TEXT NOT NULL,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.warn('Transaction history table setup skipped:', error.message);
  }
}

async function registerTransaction({
  transactionType,
  transactionId,
  sourceModule,
  sourceDocument,
  parentTransaction = null,
  parentId = null,
  state = 'DRAFT',
  branchId = null,
  createdBy = null,
}) {
  await ensureTransactionTables();
  const existing = await db.query('SELECT id FROM transaction_registry WHERE transaction_type = ? AND transaction_id = ?', [transactionType, String(transactionId)]);

  if (existing.rows.length > 0) {
    await db.run(`
      UPDATE transaction_registry
      SET source_module = ?, source_document = ?, parent_transaction = ?, parent_id = ?, state = ?, branch_id = ?, created_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE transaction_type = ? AND transaction_id = ?
    `, [sourceModule, sourceDocument, parentTransaction, parentId, state, branchId, createdBy, transactionType, String(transactionId)]);
    await db.run('INSERT INTO transaction_history (transaction_type, transaction_id, state, note) VALUES (?, ?, ?, ?)', [transactionType, String(transactionId), state, 'Registered']);
    return existing.rows[0].id;
  }

  const result = await db.run(`
    INSERT INTO transaction_registry (
      transaction_type, transaction_id, source_module, source_document, parent_transaction, parent_id, state, branch_id, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [transactionType, String(transactionId), sourceModule, sourceDocument, parentTransaction, parentId, state, branchId, createdBy]);

  await db.run('INSERT INTO transaction_history (transaction_type, transaction_id, state, note) VALUES (?, ?, ?, ?)', [transactionType, String(transactionId), state, 'Registered']);

  return result.lastInsertRowid;
}

async function transitionState({
  transactionType,
  transactionId,
  state,
  note = '',
}) {
  await ensureTransactionTables();
  const current = await getTransaction(transactionType, transactionId);
  const previousState = current?.state || 'DRAFT';
  validateTransition(previousState, state);
  await db.run('UPDATE transaction_registry SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE transaction_type = ? AND transaction_id = ?', [state, transactionType, String(transactionId)]);
  await db.run('INSERT INTO transaction_history (transaction_type, transaction_id, state, note) VALUES (?, ?, ?, ?)', [transactionType, String(transactionId), state, note]);
  await logEvent({
    entityType: transactionType,
    entityId: String(transactionId),
    action: 'STATE_TRANSITION',
    details: `${previousState} -> ${state}`,
    metadata: note,
  });
  return true;
}

async function getTransaction(transactionType, transactionId) {
  await ensureTransactionTables();
  const result = await db.query('SELECT * FROM transaction_registry WHERE transaction_type = ? AND transaction_id = ?', [transactionType, String(transactionId)]);
  return result.rows[0] || null;
}

async function getHistory(transactionType, transactionId) {
  await ensureTransactionTables();
  const result = await db.query('SELECT * FROM transaction_history WHERE transaction_type = ? AND transaction_id = ? ORDER BY id ASC', [transactionType, String(transactionId)]);
  return result.rows;
}

async function completePurchase({
  purchaseId,
  supplier,
  date,
  invNo,
  baseAmount = 0,
  taxAmount = 0,
  discAmount = 0,
  netAmount = 0,
  narration = '',
  sourceModule = 'Procurement',
  sourceDocument = 'Purchase',
  createdBy = null,
}) {
  await ensureTransactionTables();

  await registerTransaction({
    transactionType: 'Purchase',
    transactionId: purchaseId,
    sourceModule,
    sourceDocument,
    state: 'RECEIVED',
    createdBy,
  });

  await logEvent({
    entityType: 'Purchase',
    entityId: String(purchaseId),
    action: 'PURCHASE_CREATED',
    details: 'Purchase workflow initialized',
    createdBy,
  });

  const voucher = await createPurchaseVoucher({
    purchaseId,
    supplier,
    date,
    invNo,
    baseAmount,
    taxAmount,
    discAmount,
    netAmount,
    narration,
  });

  await transitionState({
    transactionType: 'Purchase',
    transactionId: purchaseId,
    state: 'POSTED',
    note: 'Purchase received, voucher posted, ledger entries created',
  });

  await logEvent({
    entityType: 'Purchase',
    entityId: String(purchaseId),
    action: 'PURCHASE_POSTED',
    details: 'Purchase voucher and ledger chain completed',
    createdBy,
  });

  return {
    ...voucher,
    transactionId: purchaseId,
    state: 'POSTED',
  };
}

async function cancelPurchase(purchaseId) {
  await ensureTransactionTables();
  await transitionState({
    transactionType: 'Purchase',
    transactionId: purchaseId,
    state: 'CANCELLED',
    note: 'Purchase cancelled and voucher chain removed',
  });
  await logEvent({
    entityType: 'Purchase',
    entityId: String(purchaseId),
    action: 'PURCHASE_CANCELLED',
    details: 'Purchase cancelled and related voucher chain removed',
  });
  await deleteVoucherChain(purchaseId, 'Purchase');
  await deleteEntriesByReference(purchaseId, 'purchase');
  return true;
}

module.exports = {
  ensureTransactionTables,
  registerTransaction,
  transitionState,
  getTransaction,
  getHistory,
  completePurchase,
  cancelPurchase,
};
