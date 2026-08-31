const db = require('../config/database');

async function columnExists(table, column) {
  const info = await db.query(`PRAGMA table_info(${table})`);
  const cols = new Set(info.rows.map(r => r.name));
  return cols.has(column);
}

async function addColumnIfMissing(table, column, ddlForAdd) {
  if (await columnExists(table, column)) {
    console.log(`[skip] ${table}.${column} already exists`);
    return false;
  }
  await db.run(`ALTER TABLE ${table} ADD COLUMN ${ddlForAdd}`);
  console.log(`[add] ${table}.${column}`);
  return true;
}

async function ensureTables() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS qc_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      qc_no TEXT UNIQUE,
      purchase_id INTEGER,
      purchase_item_id INTEGER,
      rm_lot_no TEXT NOT NULL,
      inspection_date TEXT,
      inspector TEXT,
      overall_result TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS qc_inspection_params (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      qc_id INTEGER NOT NULL,
      param_key TEXT NOT NULL,
      param_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (qc_id) REFERENCES qc_inspections(id) ON DELETE CASCADE
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS incoming_quality_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      iqr_no TEXT UNIQUE,
      qc_id INTEGER NOT NULL,
      rm_lot_no TEXT NOT NULL,
      report_file TEXT,
      uploaded_date TEXT,
      uploaded_by TEXT,
      version INTEGER DEFAULT 1,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (qc_id) REFERENCES qc_inspections(id) ON DELETE CASCADE
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS qc_approval_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      qc_id INTEGER NOT NULL,
      approval_level TEXT NOT NULL,
      approved_by TEXT,
      approved_date TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (qc_id) REFERENCES qc_inspections(id) ON DELETE CASCADE
    )
  `);
}

async function run() {
  console.log('--- Phase 1A QC migration starting ---');

  // Wrap in a transaction where possible; CREATE TABLE IF NOT EXISTS is safe/idempotent.
  // If SQLite rejects some statements inside the transaction, the script will fail fast.
  await db.run('BEGIN');

  try {
    // stock_lots is the RM lot owner table
    await addColumnIfMissing('stock_lots', 'qc_status', "qc_status TEXT DEFAULT 'QC_PENDING'");
    await addColumnIfMissing('stock_lots', 'usable_for_production', "usable_for_production INTEGER DEFAULT 0");
    await addColumnIfMissing('stock_lots', 'ledger_posted', "ledger_posted INTEGER DEFAULT 0");
    await addColumnIfMissing('stock_lots', 'approval_status', "approval_status TEXT DEFAULT 'PENDING_APPROVAL'");
    await addColumnIfMissing('stock_lots', 'approval_date', "approval_date TEXT");
    await addColumnIfMissing('stock_lots', 'approved_by', "approved_by TEXT");
    await addColumnIfMissing('stock_lots', 'hold_reason', "hold_reason TEXT");
    await addColumnIfMissing('stock_lots', 'rejection_reason', "rejection_reason TEXT");

    await ensureTables();

    await db.run('COMMIT');
  } catch (e) {
    console.error('Phase 1A migration failed, rolling back:', e);
    try {
      await db.run('ROLLBACK');
    } catch (rbErr) {
      console.error('Rollback error:', rbErr);
    }
    throw e;
  }

  // Quick post-check (non-fatal logs)
  const stockCols = await db.query(`PRAGMA table_info(stock_lots)`);
  const stockColsSet = new Set(stockCols.rows.map(r => r.name));
  const required = [
    'qc_status',
    'usable_for_production',
    'ledger_posted',
    'approval_status',
    'approval_date',
    'approved_by',
    'hold_reason',
    'rejection_reason'
  ];
  for (const c of required) {
    if (!stockColsSet.has(c)) {
      console.warn(`[warn] Missing column after migration: stock_lots.${c}`);
    }
  }

  const tablesToCheck = ['qc_inspections', 'qc_inspection_params', 'incoming_quality_reports', 'qc_approval_history'];
  const allTables = await db.query(`SELECT name FROM sqlite_master WHERE type='table'`);
  const tableSet = new Set(allTables.rows.map(r => r.name));
  for (const t of tablesToCheck) {
    if (!tableSet.has(t)) console.warn(`[warn] Missing table after migration: ${t}`);
  }

  console.log('--- Phase 1A QC migration complete ---');
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
