// Comprehensive initialization script
// Run this after server.js to ensure all tables and routes work

const db = require('./config/database');

const allTables = [
  // Core tables from schema
  {
    name: 'users',
    sql: `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    name: 'item_master',
    sql: `CREATE TABLE IF NOT EXISTS item_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT UNIQUE,
      item_name TEXT NOT NULL,
      print_name TEXT,
      item_group TEXT,
      type TEXT DEFAULT 'Urad',
      tax REAL DEFAULT 0,
      hsn_code TEXT,
      ed_percent REAL DEFAULT 0,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    name: 'item_groups',
    sql: `CREATE TABLE IF NOT EXISTS item_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_code TEXT UNIQUE,
      group_name TEXT,
      print_name TEXT,
      tax REAL DEFAULT 0,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'customer_master',
    sql: `CREATE TABLE IF NOT EXISTS customer_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      print_name TEXT,
      contact_person TEXT,
      address1 TEXT,
      address2 TEXT,
      address3 TEXT,
      address4 TEXT,
      gst_number TEXT,
      phone_off TEXT,
      phone_res TEXT,
      mobile1 TEXT,
      mobile2 TEXT,
      area TEXT,
      opening_balance REAL DEFAULT 0,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    name: 'supplier_master',
    sql: `CREATE TABLE IF NOT EXISTS supplier_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      print_name TEXT,
      contact_person TEXT,
      address1 TEXT,
      address2 TEXT,
      address3 TEXT,
      address4 TEXT,
      gst_number TEXT,
      phone_off TEXT,
      phone_res TEXT,
      mobile1 TEXT,
      mobile2 TEXT,
      area TEXT,
      opening_balance REAL DEFAULT 0,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    name: 'area_master',
    sql: `CREATE TABLE IF NOT EXISTS area_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      print_name TEXT,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'city_master',
    sql: `CREATE TABLE IF NOT EXISTS city_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      print_name TEXT,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'transport_master',
    sql: `CREATE TABLE IF NOT EXISTS transport_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      print_name TEXT,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'consignee_master',
    sql: `CREATE TABLE IF NOT EXISTS consignee_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      print_name TEXT,
      contact_person TEXT,
      address TEXT,
      area TEXT,
      phone_res TEXT,
      phone_off TEXT,
      mobile TEXT,
      tin_no TEXT,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'sender_master',
    sql: `CREATE TABLE IF NOT EXISTS sender_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      print_name TEXT,
      contact_person TEXT,
      address TEXT,
      area TEXT,
      phone_res TEXT,
      phone_off TEXT,
      mobile TEXT,
      tin_no TEXT,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'ptrans_master',
    sql: `CREATE TABLE IF NOT EXISTS ptrans_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      print_name TEXT,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'weight_master',
    sql: `CREATE TABLE IF NOT EXISTS weight_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      printname TEXT,
      weight REAL DEFAULT 0,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'ledgergroupmaster',
    sql: `CREATE TABLE IF NOT EXISTS ledgergroupmaster (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      printname TEXT,
      under TEXT,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'ledgermaster',
    sql: `CREATE TABLE IF NOT EXISTS ledgermaster (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      printname TEXT,
      under TEXT,
      openingbalance REAL DEFAULT 0,
      area TEXT,
      credit REAL DEFAULT 0,
      debit REAL DEFAULT 0,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'deduction_sales',
    sql: `CREATE TABLE IF NOT EXISTS deduction_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ded_code TEXT UNIQUE,
      ded_name TEXT,
      print_name TEXT,
      adjust_with_sales TEXT,
      account_head TEXT,
      ded_type TEXT,
      calc_type TEXT,
      ded_value REAL DEFAULT 0,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'deduction_purchase',
    sql: `CREATE TABLE IF NOT EXISTS deduction_purchase (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ded_code TEXT UNIQUE,
      ded_name TEXT,
      print_name TEXT,
      debit_adjust TEXT,
      account_head TEXT,
      credit_adjust TEXT,
      ded_type TEXT,
      calc_type TEXT,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'flour_mill_master',
    sql: `CREATE TABLE IF NOT EXISTS flour_mill_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flourmill TEXT UNIQUE,
      print_name TEXT,
      contact_person TEXT,
      address1 TEXT,
      address2 TEXT,
      address3 TEXT,
      address4 TEXT,
      gst_number TEXT,
      phone_off TEXT,
      phone_res TEXT,
      mobile1 TEXT,
      mobile2 TEXT,
      area TEXT,
      wages_kg REAL DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      status TEXT DEFAULT 'Active'
    )`
  },
  {
    name: 'papad_company_master',
    sql: `CREATE TABLE IF NOT EXISTS papad_company_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      print_name TEXT,
      contact_person TEXT,
      address1 TEXT,
      address2 TEXT,
      address3 TEXT,
      address4 TEXT,
      gst_no TEXT,
      phone_off TEXT,
      phone_res TEXT,
      mobile1 TEXT,
      mobile2 TEXT,
      area TEXT,
      wages_kg REAL DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      opening_advance REAL DEFAULT 0,
      status TEXT DEFAULT 'Active'
    )`
  },
  // Entry tables
  {
    name: 'purchases',
    sql: `CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      s_no INTEGER NOT NULL,
      date DATE NOT NULL,
      inv_no TEXT,
      supplier TEXT,
      pay_type TEXT DEFAULT 'Credit',
      inv_date DATE,
      type TEXT DEFAULT 'Urad',
      address TEXT,
      tax_type TEXT DEFAULT 'Exclusive',
      godown TEXT,
      remarks TEXT,
      total_qty REAL DEFAULT 0,
      total_weight REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      base_amount REAL DEFAULT 0,
      disc_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      net_amount REAL DEFAULT 0,
      auto_wages REAL DEFAULT 0,
      vat_percent REAL DEFAULT 0,
      vat REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      lorry_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    name: 'purchase_items',
    sql: `CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER,
      item_name TEXT NOT NULL,
      lot_no TEXT,
      weight REAL,
      qty REAL,
      total_wt REAL,
      rate REAL,
      disc_percent REAL DEFAULT 0,
      tax_percent REAL DEFAULT 0,
      amount REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
    )`
  },
  {
    name: 'sales',
    sql: `CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      s_no INTEGER NOT NULL,
      date DATE NOT NULL,
      bill_no TEXT,
      customer TEXT,
      address TEXT,
      pay_type TEXT DEFAULT 'Credit',
      lorry_no TEXT,
      po_no TEXT,
      driver TEXT,
      sender TEXT,
      consigned_to TEXT,
      tax_type TEXT DEFAULT 'Exclusive',
      godown_from TEXT,
      remarks TEXT,
      total_qty REAL DEFAULT 0,
      total_weight REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      base_amount REAL DEFAULT 0,
      disc_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      net_amount REAL DEFAULT 0,
      vat_percent REAL DEFAULT 0,
      vat REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      deduction REAL DEFAULT 0,
      deduction_remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    name: 'sales_items',
    sql: `CREATE TABLE IF NOT EXISTS sales_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      item_name TEXT NOT NULL,
      lot_no TEXT,
      qty REAL,
      weight REAL,
      box TEXT,
      rate REAL,
      disc_percent REAL DEFAULT 0,
      tax_percent REAL DEFAULT 0,
      amount REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    )`
  },
  // Stock tables
  {
    name: 'stock',
    sql: `CREATE TABLE IF NOT EXISTS stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGERNOT NULL,
      lot_no TEXT NOT NULL,
      qty REAL DEFAULT 0,
      weight REAL DEFAULT 0,
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      date TEXT, DEFAULT 'Purchase',
      reference_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    name: 'stock_lots',
    sql: `CREATE TABLE IF NOT EXISTS stock_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      lot_no TEXT NOT NULL UNIQUE,
      item_name TEXT NOT NULL,
      qty REAL DEFAULT 0,
      balance_qty REAL DEFAULT 0,
      rate REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_from TEXT,
      reference_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  }
];

async function initializeDatabase() {
  console.log('=== Comprehensive Database Initialization ===\n');
  
  // Create all tables
  for (const table of allTables) {
    try {
      await db.run(table.sql);
      console.log(`✓ Created/verified table: ${table.name}`);
    } catch (error) {
      console.log(`✗ Error with table '${table.name}': ${error.message}`);
    }
  }
  
  // Verify tables
  console.log('\n=== Verifying Tables ===');
  const result = await db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log(`\nTotal tables: ${result.rows.length}`);
  result.rows.forEach(r => console.log(`  - ${r.name}`));
  
  // Test basic queries
  console.log('\n=== Testing Basic Queries ===');
  
  // Test item_master
  try {
    const items = await db.query('SELECT COUNT(*) as count FROM item_master');
    console.log(`  item_master: ${items.rows[0].count} records`);
  } catch (e) {
    console.log(`  item_master: ERROR - ${e.message}`);
  }
  
  // Test purchases
  try {
    const purchases = await db.query('SELECT COUNT(*) as count FROM purchases');
    console.log(`  purchases: ${purchases.rows[0].count} records`);
  } catch (e) {
    console.log(`  purchases: ERROR - ${e.message}`);
  }
  
  // Test sales
  try {
    const sales = await db.query('SELECT COUNT(*) as count FROM sales');
    console.log(`  sales: ${sales.rows[0].count} records`);
  } catch (e) {
    console.log(`  sales: ERROR - ${e.message}`);
  }
  
  // Test stock
  try {
    const stock = await db.query('SELECT COUNT(*) as count FROM stock');
    console.log(`  stock: ${stock.rows[0].count} records`);
  } catch (e) {
    console.log(`  stock: ERROR - ${e.message}`);
  }
  
  console.log('\n=== Initialization Complete ===');
  console.log('\nTo test the API, make sure:');
  console.log('1. Backend is running on port 3000: node server.js');
  console.log('2. Frontend is running on port 5173: npm run dev');
  console.log('3. Browser cache is cleared (Ctrl+Shift+R)');
  console.log('\nTest endpoints:');
  console.log('  GET  http://localhost:3000/api/health');
  console.log('  GET  http://localhost:3000/api/masters/items');
  console.log('  POST http://localhost:3000/api/masters/record/item_master');
  
  process.exit(0);
}

initializeDatabase().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
