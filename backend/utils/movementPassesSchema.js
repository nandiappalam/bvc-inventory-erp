const db = require('../config/database');

/**
 * Ensures Outpass and Inpass tables, columns, and stock_lots tracking fields exist across companies.
 */
async function ensureMovementPassesSchema(companyId = null) {
  try {
    const cId = companyId || 1;

    // 1. outpasses table
    await db.run(`
      CREATE TABLE IF NOT EXISTS outpasses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outpass_no TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        purpose TEXT NOT NULL DEFAULT 'Outside Processing',
        item_type TEXT DEFAULT 'RM',
        reference_type TEXT DEFAULT 'Grind',
        reference_id INTEGER,
        reference_no TEXT,
        party_type TEXT DEFAULT 'Flour Mill',
        party_id INTEGER,
        party_name TEXT,
        from_location TEXT DEFAULT 'Inside Factory',
        from_godown_id INTEGER,
        from_godown_name TEXT,
        destination TEXT,
        vehicle_no TEXT,
        driver_name TEXT,
        driver_phone TEXT,
        transporter TEXT,
        expected_return_date TEXT,
        status TEXT DEFAULT 'OUTPASSED',
        total_qty REAL DEFAULT 0,
        total_weight REAL DEFAULT 0,
        returned_qty REAL DEFAULT 0,
        returned_weight REAL DEFAULT 0,
        processing_rate_kg REAL DEFAULT 0,
        estimated_charges REAL DEFAULT 0,
        remarks TEXT,
        created_by TEXT DEFAULT 'Admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, [], cId);

    // 2. outpass_items table
    await db.run(`
      CREATE TABLE IF NOT EXISTS outpass_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outpass_id INTEGER NOT NULL,
        outpass_no TEXT NOT NULL,
        item_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
        godown_id INTEGER,
        godown_name TEXT,
        qty REAL DEFAULT 0,
        weight REAL DEFAULT 0,
        total_weight REAL DEFAULT 0,
        uom TEXT DEFAULT 'KG',
        rate REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        returned_qty REAL DEFAULT 0,
        returned_weight REAL DEFAULT 0,
        status TEXT DEFAULT 'OUTSIDE_PROCESSING',
        reason TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, [], cId);

    // 3. inpasses table
    await db.run(`
      CREATE TABLE IF NOT EXISTS inpasses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inpass_no TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        outpass_id INTEGER,
        outpass_no TEXT,
        reference_type TEXT DEFAULT 'Grind',
        reference_id INTEGER,
        reference_no TEXT,
        party_id INTEGER,
        party_name TEXT,
        vehicle_no TEXT,
        driver_name TEXT,
        received_by TEXT DEFAULT 'Admin',
        to_godown_id INTEGER,
        to_godown_name TEXT,
        qc_required INTEGER DEFAULT 1,
        qc_status TEXT DEFAULT 'QC_PENDING',
        input_weight REAL DEFAULT 0,
        output_weight REAL DEFAULT 0,
        byproduct_weight REAL DEFAULT 0,
        loss_weight REAL DEFAULT 0,
        discrepancy_weight REAL DEFAULT 0,
        discrepancy_reason TEXT,
        yield_percent REAL DEFAULT 0,
        loss_percent REAL DEFAULT 0,
        processing_charge_per_kg REAL DEFAULT 0,
        total_processing_charges REAL DEFAULT 0,
        status TEXT DEFAULT 'RECEIVED',
        remarks TEXT,
        created_by TEXT DEFAULT 'Admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, [], cId);

    // 4. inpass_items table
    await db.run(`
      CREATE TABLE IF NOT EXISTS inpass_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inpass_id INTEGER NOT NULL,
        inpass_no TEXT NOT NULL,
        outpass_item_id INTEGER,
        original_item_name TEXT,
        original_lot_no TEXT,
        item_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
        output_type TEXT DEFAULT 'PROCESSED_OUTPUT',
        qty REAL DEFAULT 0,
        weight REAL DEFAULT 0,
        total_weight REAL DEFAULT 0,
        uom TEXT DEFAULT 'KG',
        rate REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        qc_status TEXT DEFAULT 'PASS',
        godown_id INTEGER,
        godown_name TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, [], cId);

    // 5. Ensure outside_processing_qty and custody_status columns exist in stock_lots
    try {
      await db.run(`ALTER TABLE stock_lots ADD COLUMN outside_processing_qty REAL DEFAULT 0`, [], cId);
    } catch (_) {}
    try {
      await db.run(`ALTER TABLE stock_lots ADD COLUMN custody_status TEXT DEFAULT 'AVAILABLE'`, [], cId);
    } catch (_) {}

    // 6. Ensure grains table has outside mill process columns
    const grainCols = [
      'ALTER TABLE grains ADD COLUMN process_mode TEXT DEFAULT "INSIDE_MILL"',
      'ALTER TABLE grains ADD COLUMN mill_type TEXT DEFAULT "Inside Mill"',
      'ALTER TABLE grains ADD COLUMN external_mill_id INTEGER',
      'ALTER TABLE grains ADD COLUMN external_mill_name TEXT',
      'ALTER TABLE grains ADD COLUMN outpass_id INTEGER',
      'ALTER TABLE grains ADD COLUMN outpass_no TEXT',
      'ALTER TABLE grains ADD COLUMN inpass_id INTEGER',
      'ALTER TABLE grains ADD COLUMN inpass_no TEXT',
      'ALTER TABLE grains ADD COLUMN processing_charge_per_kg REAL DEFAULT 0',
      'ALTER TABLE grains ADD COLUMN total_processing_charges REAL DEFAULT 0',
      'ALTER TABLE grains ADD COLUMN discrepancy_kg REAL DEFAULT 0',
      'ALTER TABLE grains ADD COLUMN discrepancy_reason TEXT'
    ];
    for (const sql of grainCols) {
      try {
        await db.run(sql, [], cId);
      } catch (_) {}
    }

    console.log(`✓ Movement Passes & Outside Processing schema verified for Company ${cId}`);
  } catch (err) {
    console.warn(`Warning ensuring movement passes schema:`, err.message);
  }
}

// Bootstrap automatically
ensureMovementPassesSchema();

module.exports = {
  ensureMovementPassesSchema
};
