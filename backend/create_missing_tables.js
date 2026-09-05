const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/bvc.db');
const db = new sqlite3.Database(dbPath);

const tables = [
  // Open table
  `CREATE TABLE IF NOT EXISTS open (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s_no TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    amount REAL DEFAULT 0,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Weight conversion tables
  `CREATE TABLE IF NOT EXISTS weight_conversion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s_no INTEGER,
    date TEXT,
    remarks TEXT,
    type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  `CREATE TABLE IF NOT EXISTS weight_conversion_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weight_conversion_id INTEGER,
    s_no INTEGER,
    item_name TEXT,
    lot_no TEXT,
    weight REAL,
    qty REAL,
    total_wt REAL,
    FOREIGN KEY (weight_conversion_id) REFERENCES weight_conversion(id) ON DELETE CASCADE
  )`,
  
  // Sales export orders tables
  `CREATE TABLE IF NOT EXISTS sales_export_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_no TEXT,
    date TEXT,
    order_no_dt TEXT,
    dis_port TEXT,
    dest_country TEXT,
    final_destin TEXT,
    sender TEXT,
    net_wt REAL,
    advance REAL,
    exporter TEXT,
    consignee TEXT,
    buyer_other TEXT,
    other_ref TEXT,
    pre_carriage TEXT,
    vessel_flt_no TEXT,
    consigned_to TEXT,
    gross_wt REAL,
    sign TEXT,
    place_of_rcpt TEXT,
    loading_port TEXT,
    origin_country TEXT,
    delivery_terms TEXT,
    payment_terms TEXT,
    pur_transport TEXT,
    driver TEXT,
    lorry_no TEXT,
    remarks TEXT,
    total_qty REAL,
    total_usd_amt REAL,
    total_inr_amt REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  `CREATE TABLE IF NOT EXISTS sales_export_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_export_order_id INTEGER,
    container_no TEXT,
    kind_of_package TEXT,
    description TEXT,
    qty_in_kg REAL,
    mfd_exp_dt TEXT,
    lot_no TEXT,
    qty REAL,
    usd_rate REAL,
    conv_rate REAL,
    usd_amt REAL,
    inr_amt REAL,
    FOREIGN KEY (sales_export_order_id) REFERENCES sales_export_orders(id) ON DELETE CASCADE
  )`,
  
  // Sales return table (additional columns)
  `CREATE TABLE IF NOT EXISTS sales_return (
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
  )`,
  
  `CREATE TABLE IF NOT EXISTS sales_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_return_id INTEGER,
    item_name TEXT NOT NULL,
    lot_no TEXT,
    weight REAL,
    qty REAL,
    total_wt REAL,
    rate REAL,
    disc_perc REAL DEFAULT 0,
    tax_perc REAL DEFAULT 0,
    total_amt REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sales_return_id) REFERENCES sales_return(id)
  )`,
  
  // Deduction Sales table
  `CREATE TABLE IF NOT EXISTS deduction_sales (
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
];

console.log('Creating missing tables...');

db.serialize(() => {
  tables.forEach((sql, index) => {
    db.run(sql, (err) => {
      if (err) {
        console.error(`Error creating table ${index + 1}:`, err.message);
      } else {
        console.log(`✓ Table ${index + 1} created/verified`);
      }
    });
  });
  
  // Add status column to deduction_sales if missing
  db.run("ALTER TABLE deduction_sales ADD COLUMN status TEXT DEFAULT 'Active'", (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.log('Note: status column may already exist');
    }
  });
});

setTimeout(() => {
  console.log('Done!');
  db.close();
}, 1000);
