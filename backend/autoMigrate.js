// Standalone auto-migration module
// Usage: require('./autoMigrate')()
const db = require('./config/database');
const { syncFlourOutAndPapadInStock } = require('./utils/stockSync');

const safeAddColumn = async (table, column, def) => {
  try {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    console.log(`✓ Added ${column} to ${table}`);
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('duplicate column') || msg.includes('already exists') || (msg.includes('column') && msg.includes('exists'))) {
      console.log(`✓ ${column} already exists in ${table}`);
    } else {
      console.log(`✗ Notice on ${column} in ${table}:`, err.message);
    }
  }
};

module.exports = async function autoMigrate() {
  console.log('🔧 Running auto-migrations...');

  // Safe drop of conflicting foreign key constraints in PostgreSQL multi-tenant mode
  if (db.isPostgres) {
    try {
      await db.run(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (
            SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname AS constraint_name
            FROM pg_constraint con
            JOIN pg_class c ON con.conrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE con.contype = 'f'
              AND (n.nspname = 'public' OR n.nspname LIKE 'company_%')
          ) LOOP
            BEGIN
              EXECUTE 'ALTER TABLE "' || r.schema_name || '"."' || r.table_name || '" DROP CONSTRAINT IF EXISTS "' || r.constraint_name || '" CASCADE';
            EXCEPTION WHEN OTHERS THEN
            END;
          END LOOP;
        END $$;
      `);
    } catch (e) {
      console.log('Notice dropping foreign key constraints in autoMigrate:', e.message);
    }
  }

  // First ensure base DB tables exist
  try {
    const initDb = require('./init_db');
    await initDb();
  } catch (err) {
    console.log('Notice when running init_db inside autoMigrate:', err.message);
  }

  // Ensure core tables exist before running column migrations
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT NOT NULL, 
        address TEXT, 
        gst_number TEXT, 
        contact TEXT, 
        email TEXT, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        username TEXT NOT NULL, 
        password_hash TEXT NOT NULL, 
        role TEXT DEFAULT 'user', 
        company_id INTEGER, 
        status TEXT DEFAULT 'Active', 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, company_id)
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS login_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER NOT NULL, 
        company_id INTEGER, 
        login_time DATETIME DEFAULT CURRENT_TIMESTAMP, 
        logout_time DATETIME, 
        ip_address TEXT
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS item_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_no TEXT,
        date TEXT,
        from_godown_id INTEGER,
        from_godown_name TEXT,
        to_godown_id INTEGER,
        to_godown_name TEXT,
        item_id INTEGER,
        item_code TEXT,
        item_name TEXT,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        unit TEXT DEFAULT 'kg',
        available_qty REAL DEFAULT 0,
        transfer_qty REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        remarks TEXT,
        created_by TEXT DEFAULT 'Admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS godown_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS financial_years (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL DEFAULT 1,
        financial_year TEXT NOT NULL,
        year_name TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT DEFAULT 'Active',
        is_active INTEGER DEFAULT 0,
        is_current INTEGER DEFAULT 0,
        is_locked INTEGER DEFAULT 0,
        remarks TEXT,
        created_by TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT,
        updated_at DATETIME,
        closed_by TEXT,
        closed_at DATETIME
      )
    `);
    const countRes = await db.query('SELECT COUNT(*) as count FROM financial_years');
    if (countRes.rows && countRes.rows[0] && countRes.rows[0].count === 0) {
      await db.run(`
        INSERT INTO financial_years (company_id, financial_year, year_name, start_date, end_date, status, is_active, is_current, remarks, created_by)
        VALUES (1, '2026-2027', '2026-2027', '2026-04-01', '2027-03-31', 'Active', 1, 1, 'Initial Financial Year 2026-2027', 'admin')
      `);
    }
    console.log('✓ Core auth & financial_years tables are ready');
  } catch (err) {
    console.log('✗ Error ensuring auth tables:', err.message);
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS employee_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        print_name TEXT,
        designation TEXT,
        phone TEXT,
        address TEXT,
        status TEXT DEFAULT 'Active'
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS packing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT,
        date TEXT,
        type TEXT,
        papad_comp TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS packing_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        packing_id INTEGER,
        item_name TEXT,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        tot_wt REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (packing_id) REFERENCES packing(id) ON DELETE CASCADE
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS stock_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        item_name TEXT,
        lot_no TEXT,
        purchase_id INTEGER,
        quantity REAL DEFAULT 0,
        remaining_quantity REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        qc_status TEXT DEFAULT 'QC_PENDING',
        usable_for_production INTEGER DEFAULT 0,
        ledger_posted INTEGER DEFAULT 0,
        approval_status TEXT DEFAULT 'PENDING_APPROVAL',
        approval_date TEXT,
        approved_by TEXT,
        hold_reason TEXT,
        rejection_reason TEXT,
        unloading_status TEXT DEFAULT 'PENDING_DECISION',
        godown_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Table stock_lots is ready');
  } catch (err) {
    console.log('✗ Error ensuring stock_lots:', err.message);
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        module_name TEXT NOT NULL,
        page_name TEXT NOT NULL,
        can_view INTEGER DEFAULT 0,
        can_create INTEGER DEFAULT 0,
        can_edit INTEGER DEFAULT 0,
        can_delete INTEGER DEFAULT 0,
        can_print INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, module_name, page_name)
      )
    `);
    console.log('✓ Table user_permissions is ready');
  } catch (err) {
    console.log('✗ Error ensuring user_permissions:', err.message);
  }

  // Stock Alert Tables
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS stock_alert_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        item_name TEXT NOT NULL,
        godown_id INTEGER,
        godown_name TEXT NOT NULL DEFAULT 'All Godowns',
        minimum_qty REAL DEFAULT 0,
        reorder_level REAL DEFAULT 0,
        critical_level REAL DEFAULT 0,
        alert_enabled INTEGER DEFAULT 1,
        in_app_enabled INTEGER DEFAULT 1,
        email_enabled INTEGER DEFAULT 1,
        sms_enabled INTEGER DEFAULT 0,
        whatsapp_enabled INTEGER DEFAULT 0,
        offline_enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS stock_alert_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_name TEXT NOT NULL,
        department TEXT DEFAULT 'Purchase',
        phone TEXT,
        email TEXT,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS stock_alert_config_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_id INTEGER NOT NULL,
        contact_id INTEGER NOT NULL,
        is_primary INTEGER DEFAULT 0,
        is_cc INTEGER DEFAULT 1,
        FOREIGN KEY (config_id) REFERENCES stock_alert_config(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES stock_alert_contacts(id) ON DELETE CASCADE
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS stock_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_id INTEGER,
        item_id INTEGER,
        item_name TEXT NOT NULL,
        godown_id INTEGER,
        godown_name TEXT NOT NULL DEFAULT 'Main Godown',
        alert_type TEXT NOT NULL,
        current_qty REAL DEFAULT 0,
        minimum_qty REAL DEFAULT 0,
        reorder_level REAL DEFAULT 0,
        critical_level REAL DEFAULT 0,
        status TEXT DEFAULT 'OPEN',
        triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        resolved_reason TEXT
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS stock_alert_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_id INTEGER,
        contact_id INTEGER,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        channel TEXT NOT NULL,
        message TEXT,
        status TEXT DEFAULT 'PENDING',
        sent_at DATETIME,
        failure_reason TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_stock_alert_cfg ON stock_alert_config(item_name, godown_name)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_stock_alerts_status ON stock_alerts(status, alert_type)`);
    console.log('✓ Stock alert engine tables are ready');
  } catch (err) {
    console.log('✗ Error ensuring stock alert tables:', err.message);
  }

  await safeAddColumn('item_master', 'minimum_qty', 'REAL DEFAULT 0');
  await safeAddColumn('item_master', 'reorder_level', 'REAL DEFAULT 0');
  await safeAddColumn('item_master', 'critical_level', 'REAL DEFAULT 0');
  await safeAddColumn('item_master', 'alert_enabled', 'INTEGER DEFAULT 1');
  await safeAddColumn('stock', 'status', "TEXT DEFAULT 'Active'");
  await safeAddColumn('stock', 'godown', "TEXT DEFAULT 'Main Godown'");
  await safeAddColumn('stock', 'godown_id', 'INTEGER DEFAULT 1');
  await safeAddColumn('stock', 'remarks', 'TEXT');
  await safeAddColumn('stock_lots', 'godown_id', 'INTEGER DEFAULT 1');
  await safeAddColumn('item_master', 'weight', 'REAL DEFAULT 1');
  await safeAddColumn('item_master', 'unit', "TEXT DEFAULT 'kg'");
  await safeAddColumn('advances', 'dr_cr', "TEXT DEFAULT 'Dr'");
  await safeAddColumn('stock', 'weight', 'REAL DEFAULT 0');
  await safeAddColumn('stock', 'amount', 'REAL DEFAULT 0');
  await safeAddColumn('stock', 'reference_id', 'INTEGER');
  await safeAddColumn('item_master', 'type', "TEXT DEFAULT 'Urad'");
  await safeAddColumn('item_master', 'lab_parameters', 'TEXT');

  // Ensure Masala item group and items exist
  try {
    await db.run(`INSERT OR IGNORE INTO item_groups (group_code, group_name, print_name, tax, status) VALUES ('MSL', 'Masala', 'MASALA', 5, 'Active')`);
    const sampleMasalas = [
      { code: 'MSL001', name: 'Papad Masala', print_name: 'PAPAD MASALA', group: 'Masala', tax: 5, hsn: '210390' },
      { code: 'MSL002', name: 'Red Chilli Powder', print_name: 'RED CHILLI POWDER', group: 'Masala', tax: 5, hsn: '090422' },
      { code: 'MSL003', name: 'Black Pepper Powder', print_name: 'BLACK PEPPER POWDER', group: 'Masala', tax: 5, hsn: '090412' },
      { code: 'MSL004', name: 'Hing (Asafoetida)', print_name: 'HING (ASAFOETIDA)', group: 'Masala', tax: 5, hsn: '130190' },
      { code: 'MSL005', name: 'Jeera Powder', print_name: 'JEERA POWDER', group: 'Masala', tax: 5, hsn: '090932' }
    ];
    for (const m of sampleMasalas) {
      const check = await db.query('SELECT id FROM item_master WHERE LOWER(item_name) = LOWER(?)', [m.name]);
      if (!check.rows || check.rows.length === 0) {
        await db.run(
          'INSERT INTO item_master (item_code, item_name, print_name, item_group, tax, hsn_code, status, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [m.code, m.name, m.print_name, m.group, m.tax, m.hsn, 'Active', 'Masala']
        );
      }
    }
  } catch (err) {
    console.log('Notice in seeding Masala items:', err.message);
  }

  // Ensure purchase entry compatibility with ERP fields
  await safeAddColumn('purchases', 'contact_person', 'TEXT');
  await safeAddColumn('purchases', 'phone', 'TEXT');
  await safeAddColumn('purchases', 'area', 'TEXT');
  await safeAddColumn('purchases', 'gst_no', 'TEXT');
  await safeAddColumn('purchases', 'email', 'TEXT');
  await safeAddColumn('purchases', 'type', "TEXT DEFAULT 'Urad'");
  await safeAddColumn('purchases', 'total_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'grand_total', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'total_qty', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'total_weight', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'base_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'disc_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'tax_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'net_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'po_no', 'TEXT');
  await safeAddColumn('purchases', 'purchase_order_id', 'INTEGER');
  await safeAddColumn('purchases', 'source_order_id', 'INTEGER');
  await safeAddColumn('purchases', 'source_order_no', 'TEXT');
  await safeAddColumn('purchases', 'inv_date', 'TEXT');
  await safeAddColumn('purchases', 'pay_type', "TEXT DEFAULT 'Credit'");

  await safeAddColumn('sales', 'total_amt', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'total_wt', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'total_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'total_weight', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'grand_total', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'total_qty', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'po_no', 'TEXT');

  await safeAddColumn('purchase_returns', 'total_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_returns', 'grand_total', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_returns', 'total_qty', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_returns', 'total_weight', 'REAL DEFAULT 0');

  await safeAddColumn('purchase_deductions', 'type', "TEXT DEFAULT 'LESS'");
  await safeAddColumn('purchase_deductions', 'ded_type', "TEXT DEFAULT 'LESS'");
  await safeAddColumn('purchase_deductions', 'calc_type', "TEXT DEFAULT 'Fixed'");
  await safeAddColumn('purchase_deductions', 'value', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_deductions', 'rate', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_deductions', 'deduction_id', 'INTEGER');
  await safeAddColumn('purchase_deductions', 'deduction_purchase_id', 'INTEGER');
  await safeAddColumn('purchase_deductions', 'deduction_name', 'TEXT');
  await safeAddColumn('purchase_deductions', 'affect_cost_of_goods', 'INTEGER DEFAULT 0');
  await safeAddColumn('purchase_deductions', 'debit_side_adjust', 'INTEGER DEFAULT 0');
  await safeAddColumn('purchase_deductions', 'account_head_id', 'INTEGER');

  await safeAddColumn('flour_out', 'papad_company', 'TEXT');
  await safeAddColumn('flour_out', 'mill_id', 'INTEGER');
  await safeAddColumn('flour_out', 'mill_name', 'TEXT');
  await safeAddColumn('flour_out', 'vehicle_no', 'TEXT');
  await safeAddColumn('flour_out', 'total_wages', 'REAL DEFAULT 0');
  await safeAddColumn('flour_out', 'total_qty', 'REAL DEFAULT 0');
  await safeAddColumn('flour_out', 'total_weight', 'REAL DEFAULT 0');
  await safeAddColumn('flour_out', 'address', 'TEXT');

  await safeAddColumn('grains', 'total_input_kg', 'REAL DEFAULT 0');
  await safeAddColumn('grains', 'total_output_kg', 'REAL DEFAULT 0');
  await safeAddColumn('grains', 'total_wastage_kg', 'REAL DEFAULT 0');
  await safeAddColumn('grains', 'recovery_percent', 'REAL DEFAULT 0');
  await safeAddColumn('grains', 'operator', 'TEXT');
  await safeAddColumn('grains', 'machine_no', 'TEXT');
  await safeAddColumn('grains', 'shift', 'TEXT');

  await safeAddColumn('purchases', 'sub_total', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'total_deductions', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'round_off', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'gross_weight', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'tare_weight', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'net_weight', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'transporter', 'TEXT');
  await safeAddColumn('purchases', 'transport', 'TEXT');
  await safeAddColumn('purchases', 'vehicle_no', 'TEXT');
  await safeAddColumn('purchases', 'lorry_no', 'TEXT');
  await safeAddColumn('purchases', 'driver_name', 'TEXT');
  await safeAddColumn('purchases', 'driver', 'TEXT');

  await safeAddColumn('sales', 'sub_total', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'tax_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'round_off', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'pay_type', "TEXT DEFAULT 'Credit'");
  await safeAddColumn('sales', 'tax_type', "TEXT DEFAULT 'GST'");
  await safeAddColumn('sales', 'lorry_no', 'TEXT');
  await safeAddColumn('sales', 'p_o_no', 'TEXT');
  await safeAddColumn('sales', 'driver', 'TEXT');
  await safeAddColumn('sales', 'pur_trans', 'TEXT');
  await safeAddColumn('sales', 'customer_id', 'INTEGER');
  await safeAddColumn('sales', 'address', 'TEXT');
  await safeAddColumn('sales', 'phone', 'TEXT');
  await safeAddColumn('sales', 'sender_id', 'INTEGER');
  await safeAddColumn('sales', 'consignee_id', 'INTEGER');
  await safeAddColumn('sales', 'godown_from_id', 'INTEGER');
  await safeAddColumn('sales', 'bill_amt', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'tax_amt', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'base_amt', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'deduction', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'deduction_remarks', 'TEXT');
  await safeAddColumn('sales', 'deductions_json', 'TEXT');
  await safeAddColumn('sales', 'deduction_amount', 'REAL DEFAULT 0');

  await safeAddColumn('sales_return', 'total_amt', 'REAL DEFAULT 0');
  await safeAddColumn('sales_return', 'total_wt', 'REAL DEFAULT 0');
  await safeAddColumn('sales_return', 'total_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales_return', 'total_weight', 'REAL DEFAULT 0');
  await safeAddColumn('sales_return', 'grand_total', 'REAL DEFAULT 0');
  await safeAddColumn('sales_return', 'total_qty', 'REAL DEFAULT 0');

  await safeAddColumn('grains', 'flour_mill', 'TEXT');
  await safeAddColumn('grain_input_items', 'wages_kg', 'REAL DEFAULT 0');
  await safeAddColumn('grain_input_items', 'total_wages', 'REAL DEFAULT 0');

  await safeAddColumn('godown_master', 'godown_name', 'TEXT');
  await safeAddColumn('godown_master', 'name', 'TEXT');
  await safeAddColumn('financial_years', 'is_current', 'INTEGER DEFAULT 0');
  await safeAddColumn('financial_years', 'is_active', 'INTEGER DEFAULT 0');
  await safeAddColumn('financial_years', 'financial_year', 'TEXT');
  await safeAddColumn('financial_years', 'year_name', 'TEXT');
  await safeAddColumn('financial_years', 'status', "TEXT DEFAULT 'Active'");
  await safeAddColumn('financial_years', 'is_locked', 'INTEGER DEFAULT 0');

  // Ensure purchase_orders compatibility
  await safeAddColumn('purchase_orders', 'supplier_name', 'TEXT');
  await safeAddColumn('purchase_orders', 'po_date', 'TEXT');
  await safeAddColumn('purchase_orders', 'terms', 'TEXT');
  await safeAddColumn('purchase_orders', 'fob', 'TEXT');
  await safeAddColumn('purchase_orders', 'ship_via', 'TEXT');
  await safeAddColumn('purchase_orders', 'sign', 'TEXT');
  await safeAddColumn('purchase_orders', 'address', 'TEXT');
  await safeAddColumn('purchase_orders', 'sender', 'TEXT');
  await safeAddColumn('purchase_orders', 'tax_percent', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_orders', 'amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_orders', 'bill_amt', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_orders', 'tax_amt', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_orders', 'total_amt', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_orders', 'status', "TEXT DEFAULT 'Active'");

  // Ensure purchase_order_items compatibility
  await safeAddColumn('purchase_order_items', 'item_name', 'TEXT');
  await safeAddColumn('purchase_order_items', 'tot_wt', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_order_items', 'ed_percent', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'tax_percent', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'deduction_amount', 'REAL DEFAULT 0');

  await safeAddColumn('purchase_items', 'item_id', 'INTEGER');
  await safeAddColumn('purchase_items', 'per_unit_weight', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_items', 'total_weight', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_items', 'disc_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_items', 'tax_amount', 'REAL DEFAULT 0');

  await safeAddColumn('godown_master', 'contact_person', 'TEXT');
  await safeAddColumn('godown_master', 'address', 'TEXT');
  await safeAddColumn('godown_master', 'phone_off', 'TEXT');
  await safeAddColumn('godown_master', 'mobile1', 'TEXT');
  await safeAddColumn('godown_master', 'email', 'TEXT');
  await safeAddColumn('godown_master', 'website', 'TEXT');
  await safeAddColumn('godown_master', 'area', 'TEXT');
  await safeAddColumn('godown_master', 'gst_number', 'TEXT');

  await safeAddColumn('deduction_purchase', 'affect_cost_of_goods', "TEXT DEFAULT 'No'");
  await safeAddColumn('deduction_purchase', 'type', "TEXT DEFAULT 'Add'");
  await safeAddColumn('deduction_purchase', 'debit_side_adjust', "TEXT DEFAULT 'None'");
  await safeAddColumn('deduction_purchase', 'deduction_type', "TEXT DEFAULT 'Add'");
  await safeAddColumn('deduction_purchase', 'calculation_type', "TEXT DEFAULT 'Percentage'");
  await safeAddColumn('deduction_purchase', 'deduction_value', 'REAL DEFAULT 0');
  await safeAddColumn('deduction_purchase', 'status', "TEXT DEFAULT 'Active'");
  await safeAddColumn('flour_out_returns', 'papad_company', 'TEXT');
  await safeAddColumn('flour_out_return_items', 'lot_no', 'TEXT');
  await safeAddColumn('flour_out_items', 'box_papad', 'REAL DEFAULT 0');
  await safeAddColumn('flour_out_items', 'wt_papad', 'REAL DEFAULT 0');
  await safeAddColumn('flour_out_items', 'box_empty', 'REAL DEFAULT 0');
  await safeAddColumn('flour_out_items', 'wt_empty', 'REAL DEFAULT 0');
  await safeAddColumn('flour_out_items', 'papad_details', 'TEXT');
  await safeAddColumn('flour_out_items', 'empty_details', 'TEXT');
  await safeAddColumn('purchase_returns', 'lot_no', 'TEXT');
  await safeAddColumn('purchase_returns', 'purchase_id', 'TEXT');

  // Table for Papad Return
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS papad_return (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT,
        date TEXT,
        papad_company TEXT,
        papad_balance REAL DEFAULT 0,
        payment_balance REAL DEFAULT 0,
        type TEXT DEFAULT 'Less',
        papad_less REAL DEFAULT 0,
        payment_less REAL DEFAULT 0,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Table papad_return is ready');
  } catch (err) {
    console.log('✗ Error creating papad_return:', err.message);
  }

  // Table for Cheque Printing
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS cheque_printing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_name TEXT,
        ac_name TEXT,
        chq_date TEXT,
        chq_amount REAL DEFAULT 0,
        ac_payee TEXT DEFAULT 'Yes',
        auth_sign TEXT DEFAULT 'Yes',
        no_of_copies INTEGER DEFAULT 1,
        ac_no TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Table cheque_printing is ready');
  } catch (err) {
    console.log('✗ Error creating cheque_printing:', err.message);
  }

  await safeAddColumn('deduction_purchase', 'ded_type', "TEXT");
  await safeAddColumn('deduction_purchase', 'calc_type', "TEXT");

  // Purchase Deductions table
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS purchase_deductions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER,
        deduction_purchase_id INTEGER,
        deduction_name TEXT,
        type TEXT,
        calc_type TEXT,
        value REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        affect_cost_of_goods TEXT,
        debit_side_adjust TEXT,
        account_head_id INTEGER,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Table purchase_deductions is ready');
  } catch (err) {
    console.log('✗ Error creating purchase_deductions:', err.message);
  }

  // Purchase Order Deductions table
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS purchase_order_deductions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_order_id INTEGER NOT NULL,
        deduction_name TEXT,
        type TEXT DEFAULT 'less',
        value REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Table purchase_order_deductions is ready');
  } catch (err) {
    console.log('✗ Error creating purchase_order_deductions:', err.message);
  }

  // Purchase Requests tables
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_no TEXT UNIQUE NOT NULL,
        request_date TEXT,
        required_date TEXT,
        department TEXT,
        department_id INTEGER,
        requested_by TEXT,
        supplier_id INTEGER,
        supplier_name TEXT,
        godown_id INTEGER,
        godown_name TEXT,
        priority TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'Draft',
        remarks TEXT,
        approved_by TEXT,
        approved_date TEXT,
        approval_remarks TEXT,
        converted_to_po_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Table purchase_requests is ready');
  } catch (err) {
    console.log('✗ Error creating purchase_requests:', err.message);
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS purchase_request_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_request_id INTEGER NOT NULL,
        item_id INTEGER,
        item_code TEXT,
        item_name TEXT NOT NULL,
        description TEXT,
        requested_qty REAL DEFAULT 0,
        approved_qty REAL DEFAULT 0,
        unit TEXT DEFAULT 'kg',
        current_stock REAL DEFAULT 0,
        minimum_stock REAL DEFAULT 0,
        suggested_qty REAL DEFAULT 0,
        estimated_rate REAL DEFAULT 0,
        estimated_amount REAL DEFAULT 0,
        remarks TEXT
      )
    `);
    console.log('✓ Table purchase_request_items is ready');
  } catch (err) {
    console.log('✗ Error creating purchase_request_items:', err.message);
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS purchase_request_approval_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_request_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        performed_by TEXT,
        remarks TEXT,
        performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Table purchase_request_approval_history is ready');
  } catch (err) {
    console.log('✗ Error creating purchase_request_approval_history:', err.message);
  }

  await safeAddColumn('customer_master', 'email', 'TEXT');
  await safeAddColumn('customer_master', 'transport', 'TEXT');
  await safeAddColumn('customer_master', 'limit_days', 'INTEGER');
  await safeAddColumn('customer_master', 'limit_amount', 'REAL');
  await safeAddColumn('customer_master', 'balance_type', "TEXT DEFAULT 'Dr'");
  await safeAddColumn('customer_master', 'status', "TEXT DEFAULT 'Active'");
  await safeAddColumn('supplier_master', 'email', 'TEXT');
  await safeAddColumn('supplier_master', 'transport', 'TEXT');
  await safeAddColumn('supplier_master', 'limit_days', 'INTEGER');
  await safeAddColumn('supplier_master', 'limit_amount', 'REAL');
  await safeAddColumn('supplier_master', 'balance_type', "TEXT DEFAULT 'Dr'");
  await safeAddColumn('supplier_master', 'status', "TEXT DEFAULT 'Active'");

  // Item groups status
  await safeAddColumn('item_groups', 'status', "TEXT DEFAULT 'Active'");

  // Weight conversion columns
  await safeAddColumn('weight_conversion', 'type', "TEXT");
  await safeAddColumn('weight_conversion_items', 'type', "TEXT DEFAULT 'input'");

  // Weight status
  await safeAddColumn('weightmaster', 'status', "TEXT DEFAULT 'Active'");

  // Ledger group status
  await safeAddColumn('ledgergroupmaster', 'status', "TEXT DEFAULT 'Active'");

  // Ledger master new fields
  await safeAddColumn('ledgermaster', 'alias_name', 'TEXT');
  await safeAddColumn('ledgermaster', 'opening_type', "TEXT DEFAULT 'Dr'");
  await safeAddColumn('ledgermaster', 'ledger_type', "TEXT DEFAULT 'General'");
  await safeAddColumn('ledgermaster', 'status', "TEXT DEFAULT 'Active'");

  // Papad company master new fields
  await safeAddColumn('papad_company_master', 'email', 'TEXT');
  await safeAddColumn('papad_company_master', 'address', 'TEXT');
  await safeAddColumn('papad_company_master', 'mobile', 'TEXT');

  // Flour mill master new fields
  await safeAddColumn('flour_mill_master', 'tin_no', 'TEXT');
  await safeAddColumn('flour_mill_master', 'opening_balance_type', "TEXT DEFAULT 'Cr'");

  // Papad company entry table
  try {
    await db.run(`CREATE TABLE IF NOT EXISTS papad_company_entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      from_date TEXT,
      to_date TEXT,
      papad_per_bag REAL DEFAULT 0,
      wages_per_bag REAL DEFAULT 0,
      advance_deduction_per_bag REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES papad_company_master(id) ON DELETE CASCADE
    )`);
    console.log('✓ Table papad_company_entry is ready');
  } catch (err) {
    console.log('✗ Error creating papad_company_entry:', err.message);
  }

  // Grains table columns
  await safeAddColumn('grains', 'work_order_id', 'INTEGER');
  await safeAddColumn('grains', 'work_order_no', 'TEXT');
  await safeAddColumn('grain_input_items', 'rate', 'REAL DEFAULT 0');
  await safeAddColumn('grain_input_items', 'supplier_name', 'TEXT');
  await safeAddColumn('grain_output_items', 'lot_no', 'TEXT');
  await safeAddColumn('grain_wastage_items', 'category', 'TEXT');

  // Purchase Request <-> Purchase Order <-> Purchase linkage columns
  await safeAddColumn('purchase_requests', 'converted_to_po_id', 'INTEGER');
  await safeAddColumn('purchase_requests', 'po_no', 'TEXT');
  await safeAddColumn('purchase_orders', 'purchase_request_id', 'INTEGER');
  await safeAddColumn('purchase_orders', 'pr_no', 'TEXT');
  await safeAddColumn('purchase_orders', 'inward_purchase_id', 'INTEGER');
  await safeAddColumn('purchases', 'purchase_order_id', 'INTEGER');
  await safeAddColumn('purchases', 'po_no', 'TEXT');
  await safeAddColumn('purchases', 'source_order_id', 'INTEGER');
  await safeAddColumn('purchases', 'source_order_no', 'TEXT');

  // QC Inspections and Quality Register tables & columns
  console.log('🔧 Running QC / Quality / FSMS auto-migrations...');

  // Create Grind CCP, OPRP, and Production Verification tables
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS grind_ccp_monitoring (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grind_id INTEGER NOT NULL,
        voucher_number TEXT,
        lot_number TEXT,
        ccp_required INTEGER DEFAULT 1,
        ccp_category TEXT,
        critical_limit TEXT,
        actual_reading REAL DEFAULT 0,
        unit TEXT DEFAULT 'g/MT',
        status TEXT DEFAULT 'Pass',
        corrective_action TEXT,
        checked_by TEXT,
        checked_date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grind_id) REFERENCES grains(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Table grind_ccp_monitoring is ready');
  } catch (err) {
    console.log('✗ Error creating grind_ccp_monitoring:', err.message);
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS grind_oprp_monitoring (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grind_id INTEGER NOT NULL,
        voucher_number TEXT,
        date TEXT,
        material TEXT,
        rm_fg TEXT DEFAULT 'RM',
        lot_number TEXT,
        quantity REAL DEFAULT 0,
        alp INTEGER DEFAULT 0,
        g INTEGER DEFAULT 0,
        alp_gram REAL DEFAULT 0,
        checked_by TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grind_id) REFERENCES grains(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Table grind_oprp_monitoring is ready');
  } catch (err) {
    console.log('✗ Error creating grind_oprp_monitoring:', err.message);
  }

  await safeAddColumn('grind_oprp_monitoring', 'alp_gram', 'REAL DEFAULT 0');

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS grind_production_verification (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grind_id INTEGER NOT NULL,
        voucher_number TEXT,
        operator TEXT,
        shift TEXT DEFAULT 'Shift-1',
        production_incharge TEXT,
        qc_technologist TEXT,
        qa_manager TEXT,
        final_approval TEXT DEFAULT 'APPROVED',
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grind_id) REFERENCES grains(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Table grind_production_verification is ready');
  } catch (err) {
    console.log('✗ Error creating grind_production_verification:', err.message);
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS grind_operator_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grind_id INTEGER NOT NULL,
        voucher_number TEXT,
        lot_number TEXT,
        operator TEXT,
        shift TEXT,
        action TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Table grind_operator_log is ready');
  } catch (err) {
    console.log('✗ Error creating grind_operator_log:', err.message);
  }
  await safeAddColumn('stock_lots', 'qc_status', "TEXT DEFAULT 'QC_PENDING'");
  await safeAddColumn('stock_lots', 'usable_for_production', "INTEGER DEFAULT 0");
  await safeAddColumn('stock_lots', 'ledger_posted', "INTEGER DEFAULT 0");
  await safeAddColumn('stock_lots', 'approval_status', "TEXT DEFAULT 'PENDING_APPROVAL'");
  await safeAddColumn('stock_lots', 'approval_date', "TEXT");
  await safeAddColumn('stock_lots', 'approved_by', "TEXT");
  await safeAddColumn('stock_lots', 'hold_reason', "TEXT");
  await safeAddColumn('stock_lots', 'rejection_reason', "TEXT");
  await safeAddColumn('stock_lots', 'unloading_status', "TEXT DEFAULT 'PENDING_DECISION'");
  await safeAddColumn('stock_lots', 'godown_id', "INTEGER");
  await safeAddColumn('stock_lots', 'godown_name', "TEXT");

  try {
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
    console.log('✓ Table qc_inspections is ready');
  } catch (err) {
    console.log('✗ Error creating qc_inspections:', err.message);
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS qc_inspection_params (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qc_id INTEGER NOT NULL,
        param_key TEXT NOT NULL,
        param_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Table qc_inspection_params is ready');
  } catch (err) {
    console.log('✗ Error creating qc_inspection_params:', err.message);
  }

  try {
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
    console.log('✓ Table incoming_quality_reports is ready');
  } catch (err) {
    console.log('✗ Error creating incoming_quality_reports:', err.message);
  }

  try {
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
    console.log('✓ Table qc_approval_history is ready');
  } catch (err) {
    console.log('✗ Error creating qc_approval_history:', err.message);
  }

  // Sales return tables migration
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS sales_return (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no INTEGER NOT NULL,
        date DATE NOT NULL,
        customer TEXT,
        pay_type TEXT,
        tax_type TEXT,
        address TEXT,
        remarks TEXT,
        total_qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        total_amt REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Table sales_return is ready');
  } catch (err) {
    console.log('✗ Error creating sales_return:', err.message);
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS sales_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_return_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        total_wt REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        disc_perc REAL DEFAULT 0,
        tax_perc REAL DEFAULT 0,
        total_amt REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_return_id) REFERENCES sales_return(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Table sales_return_items is ready');
  } catch (err) {
    console.log('✗ Error creating sales_return_items:', err.message);
  }

  // Open / Opening Entry and Opening items tables setup
  await safeAddColumn('open', 'type', 'TEXT');
  await safeAddColumn('open', 'papad_comp', 'TEXT');

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS open_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        open_id INTEGER NOT NULL,
        lot_no TEXT,
        item_name TEXT,
        weight TEXT,
        qty REAL DEFAULT 0,
        tot_wt REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (open_id) REFERENCES open(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Table open_items is ready');
  } catch (err) {
    console.log('✗ Error creating open_items:', err.message);
  }

  // Ensure vehicle_movements table has all the custom ERP columns
  await safeAddColumn('vehicle_movements', 'item_name', 'TEXT');
  await safeAddColumn('vehicle_movements', 'qty', 'REAL DEFAULT 0');
  await safeAddColumn('vehicle_movements', 'weight', 'REAL DEFAULT 0');
  await safeAddColumn('vehicle_movements', 'party_name', 'TEXT');
  await safeAddColumn('vehicle_movements', 'lot_no', 'TEXT');
  await safeAddColumn('vehicle_movements', 'analyzing_team', 'TEXT');
  await safeAddColumn('vehicle_movements', 'analyzing_area', 'TEXT');
  await safeAddColumn('vehicle_movements', 'transporter_name', 'TEXT');

  // Ensure sales compatibility with deductions and ERP fields
  await safeAddColumn('sales', 'deductions_json', 'TEXT');
  await safeAddColumn('sales', 'deduction_amount', 'REAL DEFAULT 0');

  // Seed default godowns if godown_master is empty
  try {
    const godownsCount = await db.query('SELECT COUNT(*) as cnt FROM godown_master');
    if (!godownsCount.rows[0]?.cnt) {
      const defaultGodowns = [
        { name: 'Main Godown', print: 'MAIN GODOWN', area: 'Main Factory' },
        { name: 'Godown 1', print: 'GODOWN 1', area: 'Unit 1' },
        { name: 'Raw Material Godown', print: 'RM GODOWN', area: 'Storage' },
        { name: 'Finished Goods Godown', print: 'FG GODOWN', area: 'Warehouse' }
      ];
      for (const g of defaultGodowns) {
        await db.run(
          'INSERT INTO godown_master (godown_name, print_name, area, status) VALUES (?, ?, ?, ?)',
          [g.name, g.print, g.area, 'Active']
        );
      }
      console.log('✓ Seeded default godowns in godown_master');
    }
  } catch (err) {
    console.log('Error seeding default godowns:', err.message);
  }

  // Ensure packing_items table has new fields for Box, Packet, Total Packet, Employee
  await safeAddColumn('packing_items', 'employee_name', 'TEXT');
  await safeAddColumn('packing_items', 'box', 'REAL DEFAULT 0');
  await safeAddColumn('packing_items', 'packet', 'REAL DEFAULT 0');
  await safeAddColumn('packing_items', 'total_packet', 'REAL DEFAULT 0');

  // ============================================================================
  // CENTRALIZED GST / TAX ENGINE SCHEMA MIGRATIONS
  // ============================================================================
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS tax_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tax_name TEXT NOT NULL,
        hsn_code TEXT NOT NULL,
        tax_type TEXT DEFAULT 'Taxable',
        description TEXT,
        gst_rate REAL DEFAULT 0,
        cgst_rate REAL DEFAULT 0,
        sgst_rate REAL DEFAULT 0,
        igst_rate REAL DEFAULT 0,
        cess_rate REAL DEFAULT 0,
        calc_type TEXT DEFAULT 'Exclusive',
        effective_from TEXT,
        effective_to TEXT,
        status TEXT DEFAULT 'Active',
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ tax_master table verified');
  } catch (err) {
    console.log('Error creating tax_master table:', err.message);
  }

  // Company State & GST configuration
  await safeAddColumn('companies', 'state', "TEXT DEFAULT 'Tamil Nadu'");
  await safeAddColumn('companies', 'state_code', "TEXT DEFAULT '33'");
  await safeAddColumn('companies', 'tax_reg_type', "TEXT DEFAULT 'Regular'");

  // Supplier State & GST configuration
  await safeAddColumn('supplier_master', 'state', "TEXT DEFAULT 'Tamil Nadu'");
  await safeAddColumn('supplier_master', 'state_code', "TEXT DEFAULT '33'");
  await safeAddColumn('supplier_master', 'tax_reg_type', "TEXT DEFAULT 'Regular'");

  // Customer State & GST configuration
  await safeAddColumn('customer_master', 'state', "TEXT DEFAULT 'Tamil Nadu'");
  await safeAddColumn('customer_master', 'state_code', "TEXT DEFAULT '33'");
  await safeAddColumn('customer_master', 'tax_reg_type', "TEXT DEFAULT 'Regular'");

  // Item Master Tax Link & HSN
  await safeAddColumn('item_master', 'tax_master_id', 'INTEGER');
  await safeAddColumn('item_master', 'hsn_code', 'TEXT');
  await safeAddColumn('item_master', 'tax_type', "TEXT DEFAULT 'Taxable'");
  await safeAddColumn('item_master', 'gst_rate', 'REAL DEFAULT 5');

  // Purchases Tax Snapshot Columns
  await safeAddColumn('purchases', 'company_state', "TEXT DEFAULT 'Tamil Nadu'");
  await safeAddColumn('purchases', 'party_state', "TEXT DEFAULT 'Tamil Nadu'");
  await safeAddColumn('purchases', 'company_state_code', "TEXT DEFAULT '33'");
  await safeAddColumn('purchases', 'party_state_code', "TEXT DEFAULT '33'");
  await safeAddColumn('purchases', 'tax_mode', "TEXT DEFAULT 'Exclusive'");
  await safeAddColumn('purchases', 'cgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'sgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'igst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchases', 'cess_amount', 'REAL DEFAULT 0');

  // Purchase Items Line Snapshots
  await safeAddColumn('purchase_items', 'hsn_code', 'TEXT');
  await safeAddColumn('purchase_items', 'tax_type', "TEXT DEFAULT 'Taxable'");
  await safeAddColumn('purchase_items', 'gst_rate', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_items', 'cgst_rate', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_items', 'cgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_items', 'sgst_rate', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_items', 'sgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_items', 'igst_rate', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_items', 'igst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_items', 'cess_rate', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_items', 'cess_amount', 'REAL DEFAULT 0');

  // Sales Tax Snapshot Columns
  await safeAddColumn('sales', 'company_state', "TEXT DEFAULT 'Tamil Nadu'");
  await safeAddColumn('sales', 'party_state', "TEXT DEFAULT 'Tamil Nadu'");
  await safeAddColumn('sales', 'company_state_code', "TEXT DEFAULT '33'");
  await safeAddColumn('sales', 'party_state_code', "TEXT DEFAULT '33'");
  await safeAddColumn('sales', 'tax_mode', "TEXT DEFAULT 'Exclusive'");
  await safeAddColumn('sales', 'cgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'sgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'igst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales', 'cess_amount', 'REAL DEFAULT 0');

  // Sales Items Line Snapshots
  await safeAddColumn('sales_items', 'hsn_code', 'TEXT');
  await safeAddColumn('sales_items', 'tax_type', "TEXT DEFAULT 'Taxable'");
  await safeAddColumn('sales_items', 'gst_rate', 'REAL DEFAULT 0');
  await safeAddColumn('sales_items', 'cgst_rate', 'REAL DEFAULT 0');
  await safeAddColumn('sales_items', 'cgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales_items', 'sgst_rate', 'REAL DEFAULT 0');
  await safeAddColumn('sales_items', 'sgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales_items', 'igst_rate', 'REAL DEFAULT 0');
  await safeAddColumn('sales_items', 'igst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales_items', 'cess_rate', 'REAL DEFAULT 0');
  await safeAddColumn('sales_items', 'cess_amount', 'REAL DEFAULT 0');

  // Purchase Returns & Items
  await safeAddColumn('purchase_returns', 'company_state', "TEXT DEFAULT 'Tamil Nadu'");
  await safeAddColumn('purchase_returns', 'party_state', "TEXT DEFAULT 'Tamil Nadu'");
  await safeAddColumn('purchase_returns', 'cgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_returns', 'sgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_returns', 'igst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_returns', 'cess_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_return_items', 'hsn_code', 'TEXT');
  await safeAddColumn('purchase_return_items', 'tax_type', "TEXT DEFAULT 'Taxable'");
  await safeAddColumn('purchase_return_items', 'gst_rate', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_return_items', 'cgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_return_items', 'sgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('purchase_return_items', 'igst_amount', 'REAL DEFAULT 0');

  // Sales Returns & Items
  await safeAddColumn('sales_return', 'company_state', "TEXT DEFAULT 'Tamil Nadu'");
  await safeAddColumn('sales_return', 'party_state', "TEXT DEFAULT 'Tamil Nadu'");
  await safeAddColumn('sales_return', 'cgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales_return', 'sgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales_return', 'igst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales_return', 'cess_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales_return_items', 'hsn_code', 'TEXT');
  await safeAddColumn('sales_return_items', 'tax_type', "TEXT DEFAULT 'Taxable'");
  await safeAddColumn('sales_return_items', 'gst_rate', 'REAL DEFAULT 0');
  await safeAddColumn('sales_return_items', 'cgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales_return_items', 'sgst_amount', 'REAL DEFAULT 0');
  await safeAddColumn('sales_return_items', 'igst_amount', 'REAL DEFAULT 0');

  // Seed default Tax Ledgers if needed
  try {
    const taxLedgers = [
      { name: 'Input CGST', under: 'Duties & Taxes', type: 'Tax' },
      { name: 'Input SGST', under: 'Duties & Taxes', type: 'Tax' },
      { name: 'Input IGST', under: 'Duties & Taxes', type: 'Tax' },
      { name: 'Output CGST', under: 'Duties & Taxes', type: 'Tax' },
      { name: 'Output SGST', under: 'Duties & Taxes', type: 'Tax' },
      { name: 'Output IGST', under: 'Duties & Taxes', type: 'Tax' }
    ];
    for (const tl of taxLedgers) {
      const exists = await db.query('SELECT id FROM ledgermaster WHERE TRIM(name) = ?', [tl.name.trim()]);
      if (!exists.rows || exists.rows.length === 0) {
        await db.run(
          'INSERT INTO ledgermaster (name, printname, under, ledger_type, openingbalance, status) VALUES (?, ?, ?, ?, ?, ?)',
          [tl.name, tl.name, tl.under, tl.type, 0, 'Active']
        );
      }
    }
  } catch (err) {
    console.log('Notice seeding tax ledgers:', err.message);
  }

  // Sync Flour Out & Papad In stock
  await syncFlourOutAndPapadInStock();

  // Sync Item Transfers Stock
  await syncItemTransfersStock();

  console.log('✅ Auto-migrations complete');
};

async function syncItemTransfersStock() {
  try {
    const trfsRes = await db.query('SELECT * FROM item_transfers');
    const trfs = trfsRes.rows || [];
    for (const trf of trfs) {
      const trfNo = trf.transfer_no;
      const checkStock = await db.query(
        'SELECT id FROM stock WHERE remarks LIKE ?',
        [`%${trfNo}%`]
      );
      if (!checkStock.rows || checkStock.rows.length === 0) {
        console.log(`Syncing missing stock records for Item Transfer ${trfNo}...`);
        const trfQty = parseFloat(trf.transfer_qty) || 0;
        const trfWt = parseFloat(trf.weight) || 50;
        const totWt = trfQty * trfWt;
        const trfRate = parseFloat(trf.rate) || 0;
        const trfDate = trf.date || new Date().toISOString().split('T')[0];

        // 1. Outward entry from source godown
        await db.run(`
          INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, godown, godown_id, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          trfDate,
          trf.item_id || null,
          trf.item_name,
          trf.lot_no,
          'Item Transfer Out',
          -Math.abs(trfQty),
          -Math.abs(totWt),
          trfRate,
          trf.from_godown_name,
          trf.from_godown_id,
          `[${trfNo}] Transferred to ${trf.to_godown_name}. ${trf.remarks || ''}`
        ]);

        // 2. Inward entry to destination godown
        await db.run(`
          INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, godown, godown_id, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          trfDate,
          trf.item_id || null,
          trf.item_name,
          trf.lot_no,
          'Item Transfer In',
          Math.abs(trfQty),
          Math.abs(totWt),
          trfRate,
          trf.to_godown_name,
          trf.to_godown_id,
          `[${trfNo}] Transferred from ${trf.from_godown_name}. ${trf.remarks || ''}`
        ]);

        // 3. Update stock_lots
        if (trf.lot_no) {
          // Reduce from source
          await db.run(`
            UPDATE stock_lots
            SET remaining_quantity = MAX(0, remaining_quantity - ?)
            WHERE LOWER(item_name) = LOWER(?) AND LOWER(lot_no) = LOWER(?) AND (godown_id = ? OR godown_id = CAST(? AS INTEGER) OR godown_id IS NULL)
          `, [trfQty, trf.item_name, trf.lot_no, trf.from_godown_id, trf.from_godown_id]);

          // Increase or create in destination
          const destLotCheck = await db.query(`
            SELECT id FROM stock_lots
            WHERE LOWER(item_name) = LOWER(?) AND LOWER(lot_no) = LOWER(?) AND (godown_id = ? OR godown_id = CAST(? AS INTEGER))
          `, [trf.item_name, trf.lot_no, trf.to_godown_id, trf.to_godown_id]);

          if (destLotCheck.rows && destLotCheck.rows.length > 0) {
            await db.run(`
              UPDATE stock_lots
              SET remaining_quantity = remaining_quantity + ?
              WHERE id = ?
            `, [trfQty, destLotCheck.rows[0].id]);
          } else {
            const srcLotRes = await db.query(`
              SELECT item_id, purchase_id, qc_status, usable_for_production, approval_status, unloading_status
              FROM stock_lots
              WHERE LOWER(item_name) = LOWER(?) AND LOWER(lot_no) = LOWER(?)
              LIMIT 1
            `, [trf.item_name, trf.lot_no]);
            const sInfo = (srcLotRes.rows && srcLotRes.rows[0]) ? srcLotRes.rows[0] : {};

            await db.run(`
              INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, godown_id, quantity, remaining_quantity, rate, qc_status, usable_for_production, approval_status, unloading_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              sInfo.item_id || trf.item_id || null,
              trf.item_name,
              trf.lot_no,
              sInfo.purchase_id || null,
              trf.to_godown_id,
              0,
              trfQty,
              trfRate,
              sInfo.qc_status || 'ACCEPTED',
              sInfo.usable_for_production !== undefined ? sInfo.usable_for_production : 1,
              sInfo.approval_status || 'APPROVED',
              sInfo.unloading_status || 'UNLOADED'
            ]);
          }
        }
      }
    }
  } catch (err) {
    console.error('Notice in syncItemTransfersStock:', err.message);
  }
}
