const db = require('../config/database');

const SCHEMA_TABLES_DDL = [
  `CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL DEFAULT 1,
    financial_year TEXT NOT NULL DEFAULT 'DEFAULT',
    movement_date TEXT NOT NULL,
    movement_time TEXT DEFAULT '00:00:00',
    movement_timestamp TEXT NOT NULL,
    identity_key TEXT NOT NULL,
    posting_key TEXT,
    stock_category TEXT NOT NULL,
    storage_type TEXT NOT NULL DEFAULT 'Factory',
    wastage_subtype TEXT,
    item_id INTEGER,
    item_code TEXT,
    item_name TEXT NOT NULL,
    uom TEXT DEFAULT 'Bags',
    unit_weight REAL DEFAULT 0,
    bag_breakdown_json TEXT,
    lot_no TEXT,
    rm_lot_no TEXT,
    fg_lot_no TEXT,
    parent_lot_no TEXT,
    godown_id INTEGER,
    godown_name TEXT,
    supplier_id INTEGER,
    supplier_name TEXT,
    supplier_invoice_no TEXT,
    party_name TEXT,
    direction TEXT NOT NULL,
    movement_type TEXT NOT NULL,
    qty REAL NOT NULL DEFAULT 0,
    weight REAL NOT NULL DEFAULT 0,
    rate REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    source_module TEXT NOT NULL,
    source_table TEXT,
    source_id INTEGER,
    source_line_id INTEGER,
    source_ref_no TEXT,
    nav_route TEXT,
    stock_status TEXT DEFAULT 'Available',
    is_physical_stock INTEGER NOT NULL DEFAULT 1,
    is_reversed INTEGER NOT NULL DEFAULT 0,
    is_reversal INTEGER NOT NULL DEFAULT 0,
    reversed_movement_id INTEGER,
    reversal_reason TEXT,
    remarks TEXT,
    created_by TEXT DEFAULT 'admin',
    approved_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS daily_stock_opening (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL DEFAULT 1,
    financial_year TEXT NOT NULL,
    stock_date TEXT NOT NULL,
    identity_key TEXT NOT NULL,
    stock_category TEXT NOT NULL,
    storage_type TEXT NOT NULL DEFAULT 'Factory',
    item_id INTEGER,
    item_code TEXT,
    item_name TEXT NOT NULL,
    supplier_id INTEGER,
    supplier_name TEXT,
    supplier_invoice_no TEXT,
    lot_no TEXT,
    rm_lot_no TEXT,
    fg_lot_no TEXT,
    parent_lot_no TEXT,
    godown_id INTEGER,
    godown_name TEXT,
    uom TEXT DEFAULT 'Bags',
    unit_weight REAL DEFAULT 0,
    prev_closing_qty REAL DEFAULT 0,
    prev_closing_weight REAL DEFAULT 0,
    opening_adjustment_qty REAL DEFAULT 0,
    opening_adjustment_weight REAL DEFAULT 0,
    opening_qty REAL DEFAULT 0,
    opening_weight REAL DEFAULT 0,
    bag_breakdown_json TEXT,
    stock_status TEXT DEFAULT 'Available',
    is_provisional INTEGER NOT NULL DEFAULT 0,
    is_first_day_fy INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    source_closing_id INTEGER,
    remarks TEXT,
    prepared_by TEXT,
    approved_by TEXT,
    approved_at DATETIME,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS daily_stock_closing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL DEFAULT 1,
    financial_year TEXT NOT NULL,
    closing_date TEXT NOT NULL,
    cutoff_time TEXT DEFAULT '23:59:59',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    is_locked INTEGER NOT NULL DEFAULT 0,
    total_system_qty REAL DEFAULT 0,
    total_system_weight REAL DEFAULT 0,
    total_physical_qty REAL DEFAULT 0,
    total_physical_weight REAL DEFAULT 0,
    total_shortage_qty REAL DEFAULT 0,
    total_shortage_weight REAL DEFAULT 0,
    total_excess_qty REAL DEFAULT 0,
    total_excess_weight REAL DEFAULT 0,
    total_adjustment_qty REAL DEFAULT 0,
    total_adjustment_weight REAL DEFAULT 0,
    total_final_qty REAL DEFAULT 0,
    total_final_weight REAL DEFAULT 0,
    variance_summary TEXT,
    remarks TEXT,
    prepared_by TEXT,
    prepared_at DATETIME,
    verified_by TEXT,
    verified_at DATETIME,
    approved_by TEXT,
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS daily_stock_closing_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    closing_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL DEFAULT 1,
    financial_year TEXT NOT NULL,
    closing_date TEXT NOT NULL,
    identity_key TEXT NOT NULL,
    stock_category TEXT NOT NULL,
    storage_type TEXT NOT NULL DEFAULT 'Factory',
    item_id INTEGER,
    item_code TEXT,
    item_name TEXT NOT NULL,
    supplier_name TEXT,
    supplier_invoice_no TEXT,
    lot_no TEXT,
    rm_lot_no TEXT,
    fg_lot_no TEXT,
    parent_lot_no TEXT,
    godown_id INTEGER,
    godown_name TEXT,
    uom TEXT DEFAULT 'Bags',
    unit_weight REAL DEFAULT 0,
    opening_qty REAL DEFAULT 0,
    opening_weight REAL DEFAULT 0,
    purchase_in_qty REAL DEFAULT 0,
    purchase_in_weight REAL DEFAULT 0,
    production_in_qty REAL DEFAULT 0,
    production_in_weight REAL DEFAULT 0,
    sales_return_in_qty REAL DEFAULT 0,
    sales_return_in_weight REAL DEFAULT 0,
    transfer_in_qty REAL DEFAULT 0,
    transfer_in_weight REAL DEFAULT 0,
    adjustment_in_qty REAL DEFAULT 0,
    adjustment_in_weight REAL DEFAULT 0,
    other_in_qty REAL DEFAULT 0,
    other_in_weight REAL DEFAULT 0,
    total_in_qty REAL DEFAULT 0,
    total_in_weight REAL DEFAULT 0,
    production_out_qty REAL DEFAULT 0,
    production_out_weight REAL DEFAULT 0,
    material_used_qty REAL DEFAULT 0,
    material_used_weight REAL DEFAULT 0,
    packing_material_used_qty REAL DEFAULT 0,
    packing_material_used_weight REAL DEFAULT 0,
    sales_out_qty REAL DEFAULT 0,
    sales_out_weight REAL DEFAULT 0,
    purchase_return_out_qty REAL DEFAULT 0,
    purchase_return_out_weight REAL DEFAULT 0,
    transfer_out_qty REAL DEFAULT 0,
    transfer_out_weight REAL DEFAULT 0,
    wastage_disposal_qty REAL DEFAULT 0,
    wastage_disposal_weight REAL DEFAULT 0,
    adjustment_out_qty REAL DEFAULT 0,
    adjustment_out_weight REAL DEFAULT 0,
    other_out_qty REAL DEFAULT 0,
    other_out_weight REAL DEFAULT 0,
    total_out_qty REAL DEFAULT 0,
    total_out_weight REAL DEFAULT 0,
    system_closing_qty REAL DEFAULT 0,
    system_closing_weight REAL DEFAULT 0,
    physical_count_qty REAL,
    physical_count_weight REAL,
    variance_qty REAL DEFAULT 0,
    variance_weight REAL DEFAULT 0,
    variance_reason TEXT,
    approved_adjustment_qty REAL DEFAULT 0,
    approved_adjustment_weight REAL DEFAULT 0,
    final_closing_qty REAL DEFAULT 0,
    final_closing_weight REAL DEFAULT 0,
    bag_breakdown_json TEXT,
    stock_status TEXT DEFAULT 'Available',
    line_status TEXT DEFAULT 'DRAFT',
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS physical_stock_verification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL DEFAULT 1,
    financial_year TEXT NOT NULL,
    verification_no TEXT NOT NULL,
    verification_date TEXT NOT NULL,
    closing_id INTEGER,
    godown_id INTEGER,
    godown_name TEXT,
    stock_category TEXT DEFAULT 'ALL',
    status TEXT DEFAULT 'DRAFT',
    counted_by TEXT,
    verified_by TEXT,
    approved_by TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS physical_stock_verification_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verification_id INTEGER NOT NULL,
    closing_line_id INTEGER,
    identity_key TEXT NOT NULL,
    stock_category TEXT NOT NULL,
    storage_type TEXT DEFAULT 'Factory',
    item_id INTEGER,
    item_code TEXT,
    item_name TEXT NOT NULL,
    lot_no TEXT,
    rm_lot_no TEXT,
    fg_lot_no TEXT,
    parent_lot_no TEXT,
    godown_id INTEGER,
    godown_name TEXT,
    system_qty REAL DEFAULT 0,
    system_weight REAL DEFAULT 0,
    physical_qty REAL DEFAULT 0,
    physical_weight REAL DEFAULT 0,
    variance_qty REAL DEFAULT 0,
    variance_weight REAL DEFAULT 0,
    variance_reason TEXT,
    adjustment_movement_id INTEGER,
    status TEXT DEFAULT 'COUNTED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stock_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL DEFAULT 1,
    financial_year TEXT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    entity_ref TEXT,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    performed_by TEXT DEFAULT 'admin',
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
];

const ADDITIVE_COLUMNS = [
  { table: 'item_master', column: 'stock_category', ddl: 'TEXT' },
  { table: 'stock_lots', column: 'parent_lot_no', ddl: 'TEXT' },
  { table: 'stock_lots', column: 'bag_breakdown_json', ddl: 'TEXT' },
  { table: 'stock_lots', column: 'outside_processing_qty', ddl: 'REAL DEFAULT 0' },
  { table: 'stock_lots', column: 'custody_status', ddl: "TEXT DEFAULT 'AVAILABLE'" },
  { table: 'godown_master', column: 'is_cold_storage', ddl: 'INTEGER DEFAULT 0' },
  { table: 'daily_stock_opening', column: 'supplier_invoice_no', ddl: 'TEXT' },
  { table: 'daily_stock_opening', column: 'bag_breakdown_json', ddl: 'TEXT' },
  { table: 'daily_stock_closing_lines', column: 'supplier_invoice_no', ddl: 'TEXT' },
  { table: 'daily_stock_closing_lines', column: 'bag_breakdown_json', ddl: 'TEXT' }
];

const SCHEMA_TABLE_NAMES = [
  'stock_movements',
  'daily_stock_opening',
  'daily_stock_closing',
  'daily_stock_closing_lines',
  'physical_stock_verification',
  'physical_stock_verification_items',
  'stock_audit_logs'
];

const initializedCompanies = new Set();
const inFlightPromises = new Map();

function invalidateSchemaCache(companyId = null) {
  if (companyId) {
    initializedCompanies.delete(Number(companyId));
  } else {
    initializedCompanies.clear();
  }
}

async function safeAddColumn(runner, companyId, table, column, ddl) {
  try {
    if (db.isPostgres) {
      await runner.run(
        `ALTER TABLE "company_${companyId}"."${table}" ADD COLUMN IF NOT EXISTS "${column}" ${ddl}`
      );
    } else {
      const info = await runner.all(`PRAGMA table_info("${table}")`);
      const exists = (info || []).some(c => String(c.name).toLowerCase() === column.toLowerCase());
      if (!exists) {
        await runner.run(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${ddl}`);
      }
    }
  } catch (err) {
    // Ignore benign duplicate column or missing legacy table warnings
  }
}

async function createIndexSafe(runner, companyId, indexName, table, colsExpr, whereClause = '') {
  const targetTable = db.isPostgres ? `"company_${companyId}"."${table}"` : `"${table}"`;
  const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${targetTable} (${colsExpr})${whereClause ? ' ' + whereClause : ''}`;
  try {
    await runner.run(sql);
  } catch (_) {}
}

async function createUniqueIndexSafe(runner, companyId, indexName, table, colsExpr, whereClause = '') {
  const targetTable = db.isPostgres ? `"company_${companyId}"."${table}"` : `"${table}"`;
  const sql = `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${targetTable} (${colsExpr})${whereClause ? ' ' + whereClause : ''}`;
  try {
    await runner.run(sql);
  } catch (_) {}
}

async function ensureStockRegisterSchema(companyId, conn = null, options = {}) {
  const cId = parseInt(companyId, 10);
  if (!Number.isSafeInteger(cId) || cId <= 0) {
    throw new Error(`Valid companyId is required for ensureStockRegisterSchema (got: ${companyId})`);
  }

  if (!options.force && initializedCompanies.has(cId)) {
    return true;
  }

  if (!conn && inFlightPromises.has(cId)) {
    return inFlightPromises.get(cId);
  }

  const runInit = async () => {
    const runner = conn && typeof conn.run === 'function' ? conn : db.forCompany(cId);

    for (const ddl of SCHEMA_TABLES_DDL) {
      await runner.run(ddl);
    }

    for (const colDef of ADDITIVE_COLUMNS) {
      await safeAddColumn(runner, cId, colDef.table, colDef.column, colDef.ddl);
    }

    // Performance & uniqueness indexes (PG requires schema-qualified table names)
    await createIndexSafe(runner, cId, 'idx_sm_comp_fy_ts', 'stock_movements', 'company_id, financial_year, movement_timestamp');
    await createIndexSafe(runner, cId, 'idx_sm_identity', 'stock_movements', 'company_id, financial_year, identity_key, is_reversed');
    await createIndexSafe(runner, cId, 'idx_sm_lot', 'stock_movements', 'lot_no, rm_lot_no, fg_lot_no, parent_lot_no');
    await createIndexSafe(runner, cId, 'idx_sm_source', 'stock_movements', 'source_module, source_id');
    await createIndexSafe(runner, cId, 'idx_sm_item', 'stock_movements', 'item_name, godown_name');
    await createUniqueIndexSafe(
      runner,
      cId,
      'idx_sm_posting_key_active',
      'stock_movements',
      'posting_key',
      'WHERE posting_key IS NOT NULL AND COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0'
    );

    await createUniqueIndexSafe(
      runner,
      cId,
      'idx_dso_unique_identity',
      'daily_stock_opening',
      'company_id, financial_year, stock_date, identity_key'
    );
    await createIndexSafe(runner, cId, 'idx_dso_lookup', 'daily_stock_opening', 'company_id, financial_year, stock_date, status');

    await createUniqueIndexSafe(
      runner,
      cId,
      'idx_dsc_unique_date',
      'daily_stock_closing',
      'company_id, financial_year, closing_date'
    );

    await createUniqueIndexSafe(
      runner,
      cId,
      'idx_dscl_unique_line',
      'daily_stock_closing_lines',
      'closing_id, identity_key'
    );
    await createIndexSafe(runner, cId, 'idx_dscl_lookup', 'daily_stock_closing_lines', 'company_id, financial_year, closing_date');

    await createIndexSafe(runner, cId, 'idx_psv_lookup', 'physical_stock_verification', 'company_id, financial_year, verification_date');
    await createIndexSafe(runner, cId, 'idx_psvi_lookup', 'physical_stock_verification_items', 'verification_id, identity_key');
    await createIndexSafe(runner, cId, 'idx_sal_lookup', 'stock_audit_logs', 'company_id, entity_type, entity_id');

    initializedCompanies.add(cId);
    return true;
  };

  if (conn) {
    return runInit();
  }

  const p = runInit().finally(() => {
    inFlightPromises.delete(cId);
  });
  inFlightPromises.set(cId, p);
  return p;
}

module.exports = {
  SCHEMA_TABLES_DDL,
  SCHEMA_TABLE_NAMES,
  ensureStockRegisterSchema,
  invalidateSchemaCache
};
