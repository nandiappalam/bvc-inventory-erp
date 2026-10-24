const db = require('../config/database');

// Cache to avoid re-checking schema on every request for already-checked companies
const checkedCompanySchemas = new Set();

/**
 * Ensure all cold storage tables and columns exist in the tenant database
 * Handles both SQLite and PostgreSQL seamlessly and idempotently.
 */
async function ensureColdStorageSchema(companyId = 1) {
  const cId = parseInt(companyId, 10) || 1;

  try {
    if (db.isPostgres) {
      await ensurePostgresColdStorageSchema(cId);
    } else {
      await ensureSqliteColdStorageSchema(cId);
    }
  } catch (err) {
    console.error(`[ColdStorageSchema] Error ensuring cold storage schema for company ${cId}:`, err.message);
  }
}

// Guarantee schema initialization on module import
ensureColdStorageSchema(1).catch(err => console.error('Init cold storage schema error:', err.message));

/**
 * SQLite Schema Verification & Column Migrations
 */
async function ensureSqliteColdStorageSchema(companyId) {
  const compDb = db.forCompany(companyId);

  // 1. Create cold_storage_vouchers
  await compDb.run(`
    CREATE TABLE IF NOT EXISTS cold_storage_vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_no TEXT UNIQUE NOT NULL,
      voucher_type TEXT NOT NULL,
      voucher_date TEXT NOT NULL,
      cold_storage_id INTEGER,
      cold_storage_name TEXT NOT NULL,
      source_godown_id INTEGER,
      source_godown_name TEXT,
      destination_godown_id INTEGER,
      destination_godown_name TEXT,
      remarks TEXT,
      total_qty REAL DEFAULT 0,
      total_wt REAL DEFAULT 0,
      created_by TEXT DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      operator_id INTEGER,
      operator_name TEXT,
      inward_source_type TEXT DEFAULT 'Factory Godown',
      outward_dest_type TEXT DEFAULT 'Internal Godown',
      customer_id INTEGER,
      customer_name TEXT,
      sales_order_ref TEXT,
      vehicle_no TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      transporter_name TEXT,
      lr_no TEXT,
      lr_date TEXT,
      gate_pass_no TEXT,
      chamber_no TEXT DEFAULT 'Chamber 1',
      floor_no TEXT,
      rack_no TEXT,
      handling_rate REAL DEFAULT 0,
      handling_amount REAL DEFAULT 0,
      storage_rate REAL DEFAULT 0,
      storage_basis TEXT,
      billed_status TEXT DEFAULT 'Unbilled',
      bill_id INTEGER,
      purchase_id INTEGER,
      purchase_inv_no TEXT,
      supplier_id INTEGER,
      supplier_name TEXT,
      loadman_worker_id INTEGER,
      loadman_name TEXT,
      loadman_qty_kg REAL DEFAULT 0,
      loadman_rate_per_kg REAL DEFAULT 0,
      loadman_charges REAL DEFAULT 0,
      additional_charges REAL DEFAULT 0,
      storage_days INTEGER DEFAULT 0,
      storage_charges REAL DEFAULT 0,
      charge_snapshot_json TEXT,
      status TEXT DEFAULT 'Confirmed'
    )
  `);

  // 2. Create cold_storage_items
  await compDb.run(`
    CREATE TABLE IF NOT EXISTS cold_storage_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_id INTEGER NOT NULL,
      voucher_no TEXT NOT NULL,
      item_id INTEGER,
      item_name TEXT NOT NULL,
      purchase_lot_no TEXT NOT NULL,
      cold_storage_lot_no TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      weight REAL DEFAULT 0,
      total_wt REAL DEFAULT 0,
      unit TEXT DEFAULT 'KG',
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      purchase_id INTEGER,
      purchase_item_id INTEGER,
      inward_voucher_id INTEGER,
      inward_item_id INTEGER,
      inward_date TEXT,
      outward_date TEXT,
      storage_days INTEGER DEFAULT 0,
      storage_charge REAL DEFAULT 0,
      labour_charge REAL DEFAULT 0,
      remaining_quantity REAL,
      remaining_weight REAL
    )
  `);

  // 3. Create cold_storage_charge_master
  await compDb.run(`
    CREATE TABLE IF NOT EXISTS cold_storage_charge_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cold_storage_id INTEGER NOT NULL,
      item_group_id INTEGER,
      item_id INTEGER,
      charge_name TEXT,
      charge_type TEXT,
      slab_start_day INTEGER,
      slab_end_day INTEGER,
      rate REAL DEFAULT 0,
      billing_basis TEXT,
      billing_method TEXT,
      slab_calculation_type TEXT DEFAULT 'Progressive',
      free_days INTEGER DEFAULT 0,
      min_days INTEGER DEFAULT 0,
      min_charge REAL DEFAULT 0,
      gst_rate REAL DEFAULT 18,
      effective_from TEXT,
      effective_to TEXT,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Create cold_storage_bills
  await compDb.run(`
    CREATE TABLE IF NOT EXISTS cold_storage_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_no TEXT UNIQUE NOT NULL,
      bill_date TEXT NOT NULL,
      operator_id INTEGER,
      operator_name TEXT NOT NULL,
      cold_storage_id INTEGER,
      cold_storage_name TEXT NOT NULL,
      period_from TEXT,
      period_to TEXT,
      operator_invoice_no TEXT,
      operator_invoice_date TEXT,
      operator_invoice_amount REAL DEFAULT 0,
      erp_calculated_amount REAL DEFAULT 0,
      variance_amount REAL DEFAULT 0,
      storage_charges REAL DEFAULT 0,
      handling_charges REAL DEFAULT 0,
      insurance_charges REAL DEFAULT 0,
      mamool_charges REAL DEFAULT 0,
      other_charges REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      tax_rate REAL DEFAULT 18,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      status TEXT DEFAULT 'Pending',
      voucher_id INTEGER,
      voucher_no TEXT,
      remarks TEXT,
      items_json TEXT,
      created_by TEXT DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Helper to safely get columns
  const getExistingCols = async (tableName) => {
    try {
      const res = await compDb.query(`PRAGMA table_info(${tableName})`);
      return new Set((res.rows || []).map(r => r.name.toLowerCase()));
    } catch (_) {
      return new Set();
    }
  };

  // Safe column migration for cold_storage_vouchers
  const voucherCols = await getExistingCols('cold_storage_vouchers');
  const requiredVoucherCols = [
    ['operator_id', 'INTEGER'],
    ['operator_name', 'TEXT'],
    ['inward_source_type', 'TEXT DEFAULT "Factory Godown"'],
    ['outward_dest_type', 'TEXT DEFAULT "Internal Godown"'],
    ['customer_id', 'INTEGER'],
    ['customer_name', 'TEXT'],
    ['sales_order_ref', 'TEXT'],
    ['vehicle_no', 'TEXT'],
    ['driver_name', 'TEXT'],
    ['driver_phone', 'TEXT'],
    ['transporter_name', 'TEXT'],
    ['lr_no', 'TEXT'],
    ['lr_date', 'TEXT'],
    ['gate_pass_no', 'TEXT'],
    ['chamber_no', 'TEXT DEFAULT "Chamber 1"'],
    ['floor_no', 'TEXT'],
    ['rack_no', 'TEXT'],
    ['handling_rate', 'REAL DEFAULT 0'],
    ['handling_amount', 'REAL DEFAULT 0'],
    ['storage_rate', 'REAL DEFAULT 0'],
    ['storage_basis', 'TEXT'],
    ['billed_status', 'TEXT DEFAULT "Unbilled"'],
    ['bill_id', 'INTEGER'],
    ['purchase_id', 'INTEGER'],
    ['purchase_inv_no', 'TEXT'],
    ['supplier_id', 'INTEGER'],
    ['supplier_name', 'TEXT'],
    ['loadman_worker_id', 'INTEGER'],
    ['loadman_name', 'TEXT'],
    ['loadman_qty_kg', 'REAL DEFAULT 0'],
    ['loadman_rate_per_kg', 'REAL DEFAULT 0'],
    ['loadman_charges', 'REAL DEFAULT 0'],
    ['additional_charges', 'REAL DEFAULT 0'],
    ['storage_days', 'INTEGER DEFAULT 0'],
    ['storage_charges', 'REAL DEFAULT 0'],
    ['charge_snapshot_json', 'TEXT'],
    ['status', 'TEXT DEFAULT "Confirmed"']
  ];
  for (const [col, typeDef] of requiredVoucherCols) {
    if (!voucherCols.has(col.toLowerCase())) {
      try {
        await compDb.run(`ALTER TABLE cold_storage_vouchers ADD COLUMN ${col} ${typeDef}`);
      } catch (_) {}
    }
  }

  // Safe column migration for cold_storage_items
  const itemCols = await getExistingCols('cold_storage_items');
  const requiredItemCols = [
    ['purchase_id', 'INTEGER'],
    ['purchase_item_id', 'INTEGER'],
    ['inward_voucher_id', 'INTEGER'],
    ['inward_item_id', 'INTEGER'],
    ['inward_date', 'TEXT'],
    ['outward_date', 'TEXT'],
    ['storage_days', 'INTEGER DEFAULT 0'],
    ['storage_charge', 'REAL DEFAULT 0'],
    ['labour_charge', 'REAL DEFAULT 0'],
    ['remaining_quantity', 'REAL'],
    ['remaining_weight', 'REAL']
  ];
  for (const [col, typeDef] of requiredItemCols) {
    if (!itemCols.has(col.toLowerCase())) {
      try {
        await compDb.run(`ALTER TABLE cold_storage_items ADD COLUMN ${col} ${typeDef}`);
      } catch (_) {}
    }
  }

  // Safe column migration for cold_storage_charge_master
  const chargeCols = await getExistingCols('cold_storage_charge_master');
  const requiredChargeCols = [
    ['slab_calculation_type', 'TEXT DEFAULT "Progressive"'],
    ['free_days', 'INTEGER DEFAULT 0'],
    ['min_days', 'INTEGER DEFAULT 0'],
    ['min_charge', 'REAL DEFAULT 0']
  ];
  for (const [col, typeDef] of requiredChargeCols) {
    if (!chargeCols.has(col.toLowerCase())) {
      try {
        await compDb.run(`ALTER TABLE cold_storage_charge_master ADD COLUMN ${col} ${typeDef}`);
      } catch (_) {}
    }
  }

  // Safe column migration for godown_master
  const godownCols = await getExistingCols('godown_master');
  const requiredGodownCols = [
    ['is_cold_storage', 'INTEGER DEFAULT 0'],
    ['slab_calculation_type', 'TEXT DEFAULT "Progressive"'],
    ['inward_unloading_rate', 'REAL DEFAULT 0.50'],
    ['outward_loading_rate', 'REAL DEFAULT 0.50'],
    ['storage_rate_per_kg_day', 'REAL DEFAULT 0.20'],
    ['free_storage_days', 'INTEGER DEFAULT 0'],
    ['min_billable_days', 'INTEGER DEFAULT 1'],
    ['operator_id', 'INTEGER'],
    ['operator_name', 'TEXT'],
    ['rate_per_bag', 'REAL DEFAULT 0'],
    ['rate_per_kg', 'REAL DEFAULT 0.20'],
    ['rate_per_ton', 'REAL DEFAULT 0'],
    ['inward_handling_rate', 'REAL DEFAULT 0.50'],
    ['outward_handling_rate', 'REAL DEFAULT 0.50'],
    ['insurance_rate', 'REAL DEFAULT 0'],
    ['mamool_rate', 'REAL DEFAULT 0'],
    ['default_chamber', 'TEXT DEFAULT "Chamber 1"'],
    ['gst_rate', 'REAL DEFAULT 18'],
    ['billing_basis', 'TEXT DEFAULT "Per KG/Day"'],
    ['billing_method', 'TEXT DEFAULT "Progressive"'],
    ['storage_duration', 'INTEGER DEFAULT 10']
  ];
  for (const [col, typeDef] of requiredGodownCols) {
    if (!godownCols.has(col.toLowerCase())) {
      try {
        await compDb.run(`ALTER TABLE godown_master ADD COLUMN ${col} ${typeDef}`);
      } catch (_) {}
    }
  }

  // Safe column migration for cold_storage_bills
  const billCols = await getExistingCols('cold_storage_bills');
  const requiredBillCols = [
    ['purchase_id', 'INTEGER'],
    ['vehicle_no', 'TEXT'],
    ['driver_name', 'TEXT'],
    ['transporter_name', 'TEXT'],
    ['loadman_name', 'TEXT'],
    ['loadman_charges', 'REAL DEFAULT 0'],
    ['storage_days', 'INTEGER DEFAULT 0'],
    ['total_qty', 'REAL DEFAULT 0'],
    ['total_weight', 'REAL DEFAULT 0'],
    ['bill_type', 'TEXT DEFAULT "OUTWARD"'],
    ['paid_amount', 'REAL DEFAULT 0'],
    ['balance_amount', 'REAL DEFAULT 0'],
    ['payment_status', 'TEXT DEFAULT "Pending"'],
    ['accounting_voucher_no', 'TEXT']
  ];
  for (const [col, typeDef] of requiredBillCols) {
    if (!billCols.has(col.toLowerCase())) {
      try {
        await compDb.run(`ALTER TABLE cold_storage_bills ADD COLUMN ${col} ${typeDef}`);
      } catch (_) {}
    }
  }

  // Ensure BTS Cold Storage (Godown 2) is configured and has default day slabs
  try {
    const gCheck = await compDb.query(`SELECT id, godown_name, is_cold_storage FROM godown_master WHERE id = 2 OR godown_name LIKE '%Cold Storage%' LIMIT 1`);
    if (gCheck.rows && gCheck.rows.length > 0) {
      await compDb.run(`
        UPDATE godown_master SET
          is_cold_storage = 1,
          godown_type = 'Cold Storage',
          slab_calculation_type = COALESCE(slab_calculation_type, 'Progressive'),
          inward_unloading_rate = COALESCE(inward_unloading_rate, 0.50),
          outward_loading_rate = COALESCE(outward_loading_rate, 0.50),
          storage_rate_per_kg_day = COALESCE(storage_rate_per_kg_day, 0.20),
          operator_name = COALESCE(operator_name, 'BTS Logistics & Cold Chain')
        WHERE id = ?
      `, [gCheck.rows[0].id]);
    }

    // Seed default day slabs for BTS Cold Storage (Godown 2) if empty
    const cmCount = await compDb.query(`SELECT COUNT(*) as cnt FROM cold_storage_charge_master WHERE cold_storage_id = 2`);
    if (!cmCount.rows || parseInt(cmCount.rows[0]?.cnt || 0, 10) === 0) {
      const defaultSlabs = [
        { slab_start_day: 1, slab_end_day: 15, rate: 0.20, type: 'Storage', name: 'Slab 1 (Days 1-15)' },
        { slab_start_day: 16, slab_end_day: 30, rate: 0.30, type: 'Storage', name: 'Slab 2 (Days 16-30)' },
        { slab_start_day: 31, slab_end_day: 99999, rate: 0.40, type: 'Storage', name: 'Slab 3 (Day 31 onwards)' },
        { slab_start_day: 0, slab_end_day: 0, rate: 0.50, type: 'Inward Unloading', name: 'Inward Unloading Labour' },
        { slab_start_day: 0, slab_end_day: 0, rate: 0.50, type: 'Outward Loading', name: 'Outward Loading Labour' }
      ];
      for (const slab of defaultSlabs) {
        await compDb.run(`
          INSERT INTO cold_storage_charge_master
          (cold_storage_id, charge_name, charge_type, slab_start_day, slab_end_day, rate, billing_basis, billing_method, slab_calculation_type, free_days, min_days, min_charge, gst_rate, status)
          VALUES (2, ?, ?, ?, ?, ?, 'Per KG', 'Slab', 'Progressive', 0, 1, 0, 18, 'Active')
        `, [slab.name, slab.type, slab.slab_start_day, slab.slab_end_day, slab.rate]);
      }
    }
  } catch (_) {}
}

/**
 * PostgreSQL Schema Verification & Column Migrations
 */
async function ensurePostgresColdStorageSchema(companyId) {
  const schema = `company_${companyId}`;
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS "${schema}"."cold_storage_vouchers" (
      id SERIAL PRIMARY KEY,
      voucher_no TEXT UNIQUE NOT NULL,
      voucher_type TEXT NOT NULL,
      voucher_date TEXT NOT NULL,
      cold_storage_id INTEGER,
      cold_storage_name TEXT NOT NULL,
      source_godown_id INTEGER,
      source_godown_name TEXT,
      destination_godown_id INTEGER,
      destination_godown_name TEXT,
      remarks TEXT,
      total_qty REAL DEFAULT 0,
      total_wt REAL DEFAULT 0,
      created_by TEXT DEFAULT 'Admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      operator_id INTEGER,
      operator_name TEXT,
      inward_source_type TEXT DEFAULT 'Factory Godown',
      outward_dest_type TEXT DEFAULT 'Internal Godown',
      customer_id INTEGER,
      customer_name TEXT,
      sales_order_ref TEXT,
      vehicle_no TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      transporter_name TEXT,
      lr_no TEXT,
      lr_date TEXT,
      gate_pass_no TEXT,
      chamber_no TEXT DEFAULT 'Chamber 1',
      floor_no TEXT,
      rack_no TEXT,
      handling_rate REAL DEFAULT 0,
      handling_amount REAL DEFAULT 0,
      storage_rate REAL DEFAULT 0,
      storage_basis TEXT,
      billed_status TEXT DEFAULT 'Unbilled',
      bill_id INTEGER,
      purchase_id INTEGER,
      purchase_inv_no TEXT,
      supplier_id INTEGER,
      supplier_name TEXT,
      loadman_worker_id INTEGER,
      loadman_name TEXT,
      loadman_qty_kg REAL DEFAULT 0,
      loadman_rate_per_kg REAL DEFAULT 0,
      loadman_charges REAL DEFAULT 0,
      additional_charges REAL DEFAULT 0,
      storage_days INTEGER DEFAULT 0,
      storage_charges REAL DEFAULT 0,
      charge_snapshot_json TEXT,
      status TEXT DEFAULT 'Confirmed'
    )
  `, [], companyId);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "${schema}"."godown_transfers" (
      id SERIAL PRIMARY KEY,
      s_no TEXT,
      transfer_date TEXT,
      from_godown_id INTEGER,
      from_godown_name TEXT,
      to_godown_id INTEGER,
      to_godown_name TEXT,
      item_name TEXT,
      lot_no TEXT,
      qty REAL DEFAULT 0,
      weight REAL DEFAULT 0,
      vehicle_no TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      transporter_name TEXT,
      loadman_name TEXT,
      loadman_charges REAL DEFAULT 0,
      handling_amount REAL DEFAULT 0,
      storage_rate REAL DEFAULT 0,
      storage_days INTEGER DEFAULT 0,
      storage_charges REAL DEFAULT 0,
      insurance_charges REAL DEFAULT 0,
      remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, [], companyId);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "${schema}"."cold_storage_items" (
      id SERIAL PRIMARY KEY,
      voucher_id INTEGER NOT NULL,
      voucher_no TEXT NOT NULL,
      item_id INTEGER,
      item_name TEXT NOT NULL,
      purchase_lot_no TEXT NOT NULL,
      cold_storage_lot_no TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      weight REAL DEFAULT 0,
      total_wt REAL DEFAULT 0,
      unit TEXT DEFAULT 'KG',
      remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      purchase_id INTEGER,
      purchase_item_id INTEGER,
      inward_voucher_id INTEGER,
      inward_item_id INTEGER,
      inward_date TEXT,
      outward_date TEXT,
      storage_days INTEGER DEFAULT 0,
      storage_charge REAL DEFAULT 0,
      labour_charge REAL DEFAULT 0,
      remaining_quantity REAL,
      remaining_weight REAL
    )
  `, [], companyId);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "${schema}"."cold_storage_charge_master" (
      id SERIAL PRIMARY KEY,
      cold_storage_id INTEGER NOT NULL,
      item_group_id INTEGER,
      item_id INTEGER,
      charge_name TEXT,
      charge_type TEXT,
      slab_start_day INTEGER,
      slab_end_day INTEGER,
      rate REAL DEFAULT 0,
      billing_basis TEXT,
      billing_method TEXT,
      slab_calculation_type TEXT DEFAULT 'Progressive',
      free_days INTEGER DEFAULT 0,
      min_days INTEGER DEFAULT 0,
      min_charge REAL DEFAULT 0,
      gst_rate REAL DEFAULT 18,
      effective_from TEXT,
      effective_to TEXT,
      status TEXT DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, [], companyId);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "${schema}"."cold_storage_bills" (
      id SERIAL PRIMARY KEY,
      bill_no TEXT UNIQUE NOT NULL,
      bill_date TEXT NOT NULL,
      operator_id INTEGER,
      operator_name TEXT NOT NULL,
      cold_storage_id INTEGER,
      cold_storage_name TEXT NOT NULL,
      period_from TEXT,
      period_to TEXT,
      operator_invoice_no TEXT,
      operator_invoice_date TEXT,
      operator_invoice_amount REAL DEFAULT 0,
      erp_calculated_amount REAL DEFAULT 0,
      variance_amount REAL DEFAULT 0,
      storage_charges REAL DEFAULT 0,
      handling_charges REAL DEFAULT 0,
      insurance_charges REAL DEFAULT 0,
      mamool_charges REAL DEFAULT 0,
      other_charges REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      tax_rate REAL DEFAULT 18,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      status TEXT DEFAULT 'Pending',
      voucher_id INTEGER,
      voucher_no TEXT,
      remarks TEXT,
      items_json TEXT,
      created_by TEXT DEFAULT 'Admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, [], companyId);


  const pgCols = [
    'purchase_id INTEGER', 'vehicle_no TEXT', 'driver_name TEXT', 'transporter_name TEXT',
    'loadman_name TEXT', 'loadman_charges NUMERIC DEFAULT 0', 'storage_days INTEGER DEFAULT 0',
    'total_qty NUMERIC DEFAULT 0', 'total_weight NUMERIC DEFAULT 0', 'bill_type TEXT DEFAULT \'OUTWARD\'',
    'paid_amount NUMERIC DEFAULT 0', 'balance_amount NUMERIC DEFAULT 0', 'payment_status TEXT DEFAULT \'Pending\'',
    'accounting_voucher_no TEXT',
    'is_cold_storage INTEGER DEFAULT 0',
    'slab_calculation_type TEXT DEFAULT \'Progressive\'',
    'inward_unloading_rate NUMERIC DEFAULT 0.50',
    'outward_loading_rate NUMERIC DEFAULT 0.50',
    'storage_rate_per_kg_day NUMERIC DEFAULT 0.20',
    'free_storage_days INTEGER DEFAULT 0',
    'min_billable_days INTEGER DEFAULT 1',
    'operator_id INTEGER',
    'operator_name TEXT',
    'rate_per_bag NUMERIC DEFAULT 0',
    'rate_per_kg NUMERIC DEFAULT 0.20',
    'rate_per_ton NUMERIC DEFAULT 0',
    'inward_handling_rate NUMERIC DEFAULT 0.50',
    'outward_handling_rate NUMERIC DEFAULT 0.50',
    'insurance_rate NUMERIC DEFAULT 0',
    'mamool_rate NUMERIC DEFAULT 0',
    'default_chamber TEXT DEFAULT \'Chamber 1\'',
    'gst_rate NUMERIC DEFAULT 18',
    'billing_basis TEXT DEFAULT \'Per KG/Day\'',
    'billing_method TEXT DEFAULT \'Progressive\'',
    'storage_duration INTEGER DEFAULT 10'
  ];
  for (const colDef of pgCols) {
    try {
      await db.query(`ALTER TABLE "godown_master" ADD COLUMN IF NOT EXISTS ${colDef}`, [], companyId);
    } catch (_) {}
  }

  const pgBillCols = [
    'purchase_id INTEGER', 'vehicle_no TEXT', 'driver_name TEXT', 'transporter_name TEXT',
    'loadman_name TEXT', 'loadman_charges NUMERIC DEFAULT 0', 'storage_days INTEGER DEFAULT 0',
    'total_qty NUMERIC DEFAULT 0', 'total_weight NUMERIC DEFAULT 0', 'bill_type TEXT DEFAULT \'OUTWARD\'',
    'paid_amount NUMERIC DEFAULT 0', 'balance_amount NUMERIC DEFAULT 0', 'payment_status TEXT DEFAULT \'Pending\'',
    'accounting_voucher_no TEXT'
  ];
  for (const colDef of pgBillCols) {
    try {
      await db.query(`ALTER TABLE "${schema}"."cold_storage_bills" ADD COLUMN IF NOT EXISTS ${colDef}`, [], companyId);
    } catch (_) {}
  }
}

module.exports = {
  ensureColdStorageSchema
};
