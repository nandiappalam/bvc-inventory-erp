const db = require('../config/database');
const { ensureStockRegisterSchema } = require('../services/StockRegisterSchema');
const { backfillCompanyMovements } = require('../services/BackfillAndReconciliationService');

/**
 * rebuildStockLedger (Neutralized — Non-Destructive Mode)
 * Preserves existing `stock` and `stock_lots` records strictly intact without DELETE/wipe.
 * Synchronizes append-only `stock_movements` via idempotent posting_key backfill.
 */
async function rebuildStockLedger(targetCompanyId = null) {
  const store = db.asyncLocalStorage ? db.asyncLocalStorage.getStore() : null;
  const activeCompanyId = targetCompanyId || (store ? store.companyId : 1);

  try {
    await ensureStockRegisterSchema(activeCompanyId);
    const summary = await backfillCompanyMovements(activeCompanyId);
    return { success: true, nonDestructive: true, summary };
  } catch (err) {
    console.error(`[stockRebuilder] Non-destructive sync warning for company ${activeCompanyId}:`, err.message);
    return { success: false, nonDestructive: true, error: err.message };
  }
}

module.exports = { rebuildStockLedger };
