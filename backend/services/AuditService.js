const db = require('../config/database');

async function ensureAuditTable() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.warn('Audit table setup skipped:', error.message);
  }
}

async function logEvent({ entityType, entityId, action, details = '', createdBy = null, metadata = null }) {
  await ensureAuditTable();
  await db.run(
    'INSERT INTO audit_log (entity_type, entity_id, action, details, created_by) VALUES (?, ?, ?, ?, ?)',
    [entityType, String(entityId), action, details || metadata || '', createdBy]
  );
  return true;
}

async function getAuditTrail(entityType, entityId) {
  await ensureAuditTable();
  const result = await db.query('SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY id ASC', [entityType, String(entityId)]);
  return result.rows;
}

module.exports = {
  ensureAuditTable,
  logEvent,
  getAuditTrail,
};
