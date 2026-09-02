/**
 * Safe Transaction Runner for BVC Inventory ERP
 * Guarantees BEGIN -> WORK -> COMMIT or ROLLBACK -> RELEASE
 */

const db = require('../config/database');

/**
 * Execute an atomic transaction callback safely
 * @param {Function} callback - Async function (conn) => Promise<any>
 * @param {number|string} [companyId] - Optional specific company context
 * @returns {Promise<any>}
 */
async function executeSafeTransaction(callback, companyId = null) {
  const conn = await db.getConnection(companyId);
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      console.error('[Transaction Rollback Error]:', rollbackErr.message);
    }
    throw err;
  } finally {
    if (typeof conn.release === 'function') {
      conn.release();
    }
  }
}

module.exports = {
  executeSafeTransaction,
};
