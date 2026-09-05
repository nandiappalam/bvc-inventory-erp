const db = require('../config/database');

const ensureWorkflowTables = async () => {
  await db.run(`
    CREATE TABLE IF NOT EXISTS workflow_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      workflow_state TEXT NOT NULL,
      status TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS workflow_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      from_state TEXT,
      to_state TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const upsertState = async ({ entityType, entityId, workflowState, status, metadata }) => {
  await ensureWorkflowTables();
  const existing = await db.query(
    'SELECT id FROM workflow_state WHERE entity_type = ? AND entity_id = ? LIMIT 1',
    [entityType, entityId]
  );

  if (existing.rows.length > 0) {
    await db.run(
      `UPDATE workflow_state
       SET workflow_state = ?, status = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
       WHERE entity_type = ? AND entity_id = ?`,
      [workflowState, status, metadata ? JSON.stringify(metadata) : null, entityType, entityId]
    );
    return { id: existing.rows[0].id };
  }

  const created = await db.run(
    `INSERT INTO workflow_state (entity_type, entity_id, workflow_state, status, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [entityType, entityId, workflowState, status, metadata ? JSON.stringify(metadata) : null]
  );
  return { id: created.lastID };
};

const appendHistory = async ({ entityType, entityId, fromState, toState, action, actor, remarks }) => {
  await ensureWorkflowTables();
  await db.run(
    `INSERT INTO workflow_history (entity_type, entity_id, from_state, to_state, action, actor, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entityType, entityId, fromState, toState, action, actor, remarks || null]
  );
};

const getState = async ({ entityType, entityId }) => {
  await ensureWorkflowTables();
  const result = await db.query(
    'SELECT * FROM workflow_state WHERE entity_type = ? AND entity_id = ? LIMIT 1',
    [entityType, entityId]
  );
  return result.rows[0] || null;
};

const getHistory = async ({ entityType, entityId }) => {
  await ensureWorkflowTables();
  const result = await db.query(
    'SELECT * FROM workflow_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC',
    [entityType, entityId]
  );
  return result.rows || [];
};

module.exports = {
  ensureWorkflowTables,
  upsertState,
  appendHistory,
  getState,
  getHistory,
};
