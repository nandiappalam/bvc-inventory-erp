const db = require('./config/database')

const masterTablesSQL = `
-- Item Master
CREATE TABLE IF NOT EXISTS item_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT UNIQUE,
    item_name TEXT,
    print_name TEXT,
    item_group TEXT,
    type TEXT,
    tax REAL,
    hsn_code TEXT,
    ed_percent REAL,
    status TEXT DEFAULT 'Active'
);

-- Item Groups
CREATE TABLE IF NOT EXISTS item_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_code TEXT UNIQUE,
    group_name TEXT,
    print_name TEXT,
    tax REAL
);

-- Deduction Sales
CREATE TABLE IF NOT EXISTS deduction_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ded_code TEXT UNIQUE,
    ded_name TEXT,
    print_name TEXT,
    adjust_with_sales TEXT,
    account_head TEXT,
    ded_type TEXT,
    calc_type TEXT,
    ded_value REAL,
    status TEXT DEFAULT 'Active'
);

-- Deduction Purchase
CREATE TABLE IF NOT EXISTS deduction_purchase (
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
);

-- Customer Master
CREATE TABLE IF NOT EXISTS customer_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
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
    status TEXT DEFAULT 'Active'
);

-- Supplier Master
CREATE TABLE IF NOT EXISTS supplier_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
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
    status TEXT DEFAULT 'Active'
);

-- Flour Mill Master
CREATE TABLE IF NOT EXISTS flour_mill_master (
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
);

-- Papad Company Master
CREATE TABLE IF NOT EXISTS papad_company_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    print_name TEXT,
    contact_person TEXT,
<<<<<<< HEAD
    address TEXT,
=======
>>>>>>> origin/main
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
);

-- Papad Wages History
CREATE TABLE IF NOT EXISTS papad_wages_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    papad_company TEXT,
    from_date TEXT,
    to_date TEXT,
    papad_kg_bag REAL,
    wages_bag REAL,
    adv_ded_bag REAL
);

-- Weight Master
CREATE TABLE IF NOT EXISTS weightmaster (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    printname TEXT,
    weight REAL,
    status TEXT DEFAULT 'Active'
);

-- Ledger Group Master
CREATE TABLE IF NOT EXISTS ledgergroupmaster (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    printname TEXT,
    under TEXT,
    status TEXT DEFAULT 'Active'
);

-- Ledger Master
CREATE TABLE IF NOT EXISTS ledgermaster (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    printname TEXT,
    under TEXT,
    openingbalance REAL DEFAULT 0,
    area TEXT,
    credit REAL DEFAULT 0,
    debit REAL DEFAULT 0,
    status TEXT DEFAULT 'Active'
);

-- Area Master
CREATE TABLE IF NOT EXISTS area_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    print_name TEXT,
    status TEXT DEFAULT 'Active'
);

-- City Master
CREATE TABLE IF NOT EXISTS city_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    print_name TEXT,
    status TEXT DEFAULT 'Active'
);

-- Transport Master
CREATE TABLE IF NOT EXISTS transport_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    print_name TEXT,
    status TEXT DEFAULT 'Active'
);

-- Consignee Group Master
CREATE TABLE IF NOT EXISTS consignee_group_master (
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
);

-- Sender Group Master
CREATE TABLE IF NOT EXISTS sender_group_master (
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
);

-- Person Master
CREATE TABLE IF NOT EXISTS person_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    print_name TEXT,
    contact_person TEXT,
    address TEXT,
    area TEXT,
    phone_res TEXT,
    phone_off TEXT,
    mobile TEXT,
    status TEXT DEFAULT 'Active'
);

-- PTrans Master
CREATE TABLE IF NOT EXISTS ptrans_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    print_name TEXT,
    status TEXT DEFAULT 'Active'
);
`

async function initializeTables() {
  console.log('Initializing master tables...')
  
  const statements = masterTablesSQL.split(';').filter(stmt => stmt.trim().length > 0 && !stmt.trim().startsWith('--'))
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await db.run(statement.trim())
        console.log('✓ Created:', statement.trim().split('\n')[0].trim().substring(0, 50))
      } catch (error) {
        console.log('✗ Error:', error.message.substring(0, 80))
      }
    }
  }
  
  // Verify tables were created
  console.log('\nVerifying tables...')
  try {
    const result = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%master%'")
    console.log('Found tables:', result.rows.map(r => r.name).join(', '))
  } catch (error) {
    console.log('Error verifying:', error.message)
  }
  
  console.log('\nInitialization complete!')
  process.exit(0)
}

initializeTables().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
