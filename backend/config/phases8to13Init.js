const db = require('./database');

async function initPhases8To13Tables() {
  try {
    // 1. Cold Storage Facility Master
    await db.run(`
      CREATE TABLE IF NOT EXISTS cs_facilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        address TEXT,
        facility_type TEXT DEFAULT 'OWN', -- 'OWN' or 'EXTERNAL'
        capacity_kg REAL DEFAULT 50000,
        unit TEXT DEFAULT 'KG',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Cold Storage Chambers
    await db.run(`
      CREATE TABLE IF NOT EXISTS cs_chambers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facility_id INTEGER NOT NULL,
        chamber_name TEXT NOT NULL,
        capacity_kg REAL DEFAULT 20000,
        min_temp REAL DEFAULT 2.0,
        max_temp REAL DEFAULT 6.0,
        warning_temp REAL DEFAULT 8.0,
        critical_temp REAL DEFAULT 10.0,
        min_humidity REAL DEFAULT 80.0,
        max_humidity REAL DEFAULT 95.0,
        current_temp REAL DEFAULT 4.0,
        current_humidity REAL DEFAULT 85.0,
        status TEXT DEFAULT 'NORMAL',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (facility_id) REFERENCES cs_facilities(id) ON DELETE CASCADE
      )
    `);

    // 3. Cold Storage Racks
    await db.run(`
      CREATE TABLE IF NOT EXISTS cs_racks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chamber_id INTEGER NOT NULL,
        rack_name TEXT NOT NULL,
        positions_count INTEGER DEFAULT 10,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chamber_id) REFERENCES cs_chambers(id) ON DELETE CASCADE
      )
    `);

    // 4. Cold Storage Inward Records (CSI)
    await db.run(`
      CREATE TABLE IF NOT EXISTS cs_inward_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        csi_no TEXT UNIQUE NOT NULL,
        inward_date TEXT NOT NULL,
        supplier_name TEXT,
        item_name TEXT NOT NULL,
        inward_lot_no TEXT NOT NULL,
        original_purchase_lot_no TEXT,
        qty_bags REAL DEFAULT 0,
        weight_kg REAL NOT NULL,
        unit TEXT DEFAULT 'KG',
        facility_id INTEGER,
        facility_name TEXT,
        chamber_id INTEGER,
        chamber_name TEXT,
        rack_name TEXT,
        position_name TEXT,
        temp_recorded REAL,
        humidity_recorded REAL,
        qc_status TEXT DEFAULT 'PASSED',
        remarks TEXT,
        created_by TEXT DEFAULT 'Admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Cold Storage Outward Records (CSO)
    await db.run(`
      CREATE TABLE IF NOT EXISTS cs_outward_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cso_no TEXT UNIQUE NOT NULL,
        outward_date TEXT NOT NULL,
        facility_id INTEGER,
        facility_name TEXT,
        chamber_id INTEGER,
        chamber_name TEXT,
        rack_name TEXT,
        item_name TEXT NOT NULL,
        lot_no TEXT NOT NULL,
        qty_bags REAL DEFAULT 0,
        weight_kg REAL NOT NULL,
        purpose TEXT DEFAULT 'Production Milling',
        destination_godown_id INTEGER,
        destination_godown_name TEXT,
        reference_no TEXT,
        created_by TEXT DEFAULT 'Admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Cold Storage Temperature Logs
    await db.run(`
      CREATE TABLE IF NOT EXISTS cs_temperature_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facility_id INTEGER NOT NULL,
        chamber_id INTEGER NOT NULL,
        log_date TEXT NOT NULL,
        log_time TEXT NOT NULL,
        temperature REAL NOT NULL,
        humidity REAL NOT NULL,
        recorded_by TEXT DEFAULT 'Shift In-Charge',
        status TEXT DEFAULT 'NORMAL', -- 'NORMAL', 'WARNING', 'CRITICAL'
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Customer Order Fulfillment
    await db.run(`
      CREATE TABLE IF NOT EXISTS customer_order_fulfillment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        order_date TEXT NOT NULL,
        target_delivery_date TEXT NOT NULL,
        total_amount REAL DEFAULT 0,
        items_summary TEXT,
        status TEXT DEFAULT 'CONFIRMED', 
        progress_pct INTEGER DEFAULT 20,
        dispatch_vehicle_no TEXT,
        driver_name TEXT,
        driver_phone TEXT,
        invoice_no TEXT,
        notes TEXT,
        created_by TEXT DEFAULT 'Sales Coordinator',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. Order Fulfillment Stages
    await db.run(`
      CREATE TABLE IF NOT EXISTS order_fulfillment_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        stage_key TEXT NOT NULL, 
        stage_label TEXT NOT NULL,
        stage_order INTEGER NOT NULL,
        is_completed INTEGER DEFAULT 0,
        completed_at DATETIME,
        completed_by TEXT,
        remarks TEXT,
        FOREIGN KEY (order_id) REFERENCES customer_order_fulfillment(id) ON DELETE CASCADE
      )
    `);

    // 9. Order Stock Reservations
    await db.run(`
      CREATE TABLE IF NOT EXISTS order_stock_reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        lot_no TEXT NOT NULL,
        reserved_qty_kg REAL NOT NULL,
        uom TEXT DEFAULT 'KG',
        status TEXT DEFAULT 'RESERVED', -- 'RESERVED', 'RELEASED', 'CONSUMED'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES customer_order_fulfillment(id) ON DELETE CASCADE
      )
    `);

    // 10. Warehouse Mobile Operational Logs
    await db.run(`
      CREATE TABLE IF NOT EXISTS warehouse_mobile_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_type TEXT NOT NULL, -- 'RECEIVE', 'ISSUE', 'TRANSFER', 'DISPATCH'
        item_name TEXT NOT NULL,
        lot_no TEXT,
        qty REAL NOT NULL,
        uom TEXT DEFAULT 'KG',
        source_godown TEXT,
        dest_godown TEXT,
        location_code TEXT,
        purpose TEXT,
        operator_name TEXT DEFAULT 'Operator 1',
        sync_status TEXT DEFAULT 'SYNCED',
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. Barcode & QR Master
    await db.run(`
      CREATE TABLE IF NOT EXISTS barcode_qr_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_type TEXT NOT NULL, -- 'ITEM', 'LOT', 'PALLET', 'LOCATION', 'FINISHED_GOOD'
        entity_code TEXT NOT NULL,
        label_title TEXT NOT NULL,
        barcode_data TEXT NOT NULL,
        qr_data TEXT NOT NULL,
        metadata_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 12. Central Unified Notifications
    await db.run(`
      CREATE TABLE IF NOT EXISTS system_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_type TEXT NOT NULL, -- 'TEMP_ALERT', 'QC_HOLD', 'LOW_STOCK', 'PAYMENT_DUE', 'ORDER_DELAY', 'AGING_LOT'
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT DEFAULT 'WARNING', -- 'INFO', 'WARNING', 'CRITICAL'
        reference_module TEXT,
        reference_id TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 13. Enhanced Audit Log (if columns not present)
    await db.run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        old_value TEXT,
        new_value TEXT,
        reason TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure default facility and chambers if none exist
    const facCount = await db.query('SELECT COUNT(*) as cnt FROM cs_facilities');
    if (parseInt(facCount.rows[0]?.cnt || 0, 10) === 0) {
      await db.run(`
        INSERT INTO cs_facilities (name, address, facility_type, capacity_kg, unit, is_active)
        VALUES 
          ('BVC Central Cold Storage', 'Industrial Zone Phase II, Plot 42', 'OWN', 100000, 'KG', 1),
          ('AgroChill External Facility', 'National Highway 44, Bypass', 'EXTERNAL', 50000, 'KG', 1)
      `);

      const centralFac = await db.query("SELECT id FROM cs_facilities WHERE name = 'BVC Central Cold Storage'");
      const facId = centralFac.rows[0]?.id || 1;

      await db.run(`
        INSERT INTO cs_chambers (facility_id, chamber_name, capacity_kg, min_temp, max_temp, warning_temp, critical_temp, current_temp, current_humidity, status)
        VALUES 
          (?, 'Chamber 01 (Deep Chill)', 35000, 1.0, 4.0, 6.0, 8.0, 3.2, 86.0, 'NORMAL'),
          (?, 'Chamber 02 (Grain Vault)', 40000, 3.0, 6.0, 8.0, 10.0, 8.4, 91.0, 'WARNING'),
          (?, 'Chamber 03 (Flour & Papad)', 25000, 4.0, 8.0, 9.0, 12.0, 5.1, 82.0, 'NORMAL')
      `, [facId, facId, facId]);

      // Seed racks for Chamber 1
      const ch1 = await db.query("SELECT id FROM cs_chambers WHERE chamber_name LIKE '%Chamber 01%'");
      if (ch1.rows[0]?.id) {
        await db.run(`
          INSERT INTO cs_racks (chamber_id, rack_name, positions_count)
          VALUES 
            (?, 'Rack A', 10),
            (?, 'Rack B', 10),
            (?, 'Rack C', 10)
        `, [ch1.rows[0].id, ch1.rows[0].id, ch1.rows[0].id]);
      }
    }

    console.log('✅ Phases 8–13 Database Schemas Verified & Seeded');
  } catch (err) {
    console.error('Error initializing Phases 8-13 tables:', err);
  }
}

module.exports = { initPhases8To13Tables };
