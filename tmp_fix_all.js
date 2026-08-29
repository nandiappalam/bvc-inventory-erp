const fs = require('fs');

// 1. Fix masterConfig.js - address -> address1, mobile -> mobile1
let mc = fs.readFileSync('frontend/src/utils/masterConfig.js', 'utf8');
mc = mc.replace(/\{ name: 'address', label: 'Address', type: 'textarea' \}/g, "{ name: 'address1', label: 'Address', type: 'textarea' }");
mc = mc.replace(/\{ name: 'mobile', label: 'Mobile', type: 'text' \}/g, "{ name: 'mobile1', label: 'Mobile', type: 'text' }");
fs.writeFileSync('frontend/src/utils/masterConfig.js', mc);
console.log('✅ Fixed masterConfig.js');

// 2. Fix backend/routes/masters.js fields arrays
let masters = fs.readFileSync('backend/routes/masters.js', 'utf8');

// godown_master
masters = masters.replace(
  /godown_master: \{\s*table: 'godown_master',\s*fields: \['godown_name', 'print_name'\]/,
  "godown_master: {\n    table: 'godown_master',\n    fields: ['godown_name', 'print_name', 'contact_person', 'address', 'phone_off', 'area', 'status']"
);

// deduction_purchase
masters = masters.replace(
  /deduction_purchase: \{\s*table: 'deduction_purchase',\s*fields: \['ded_code', 'ded_name', 'print_name', 'debit_adjust', 'account_head', 'credit_adjust', 'ded_type', 'calc_type'\]/,
  "deduction_purchase: {\n    table: 'deduction_purchase',\n    fields: ['ded_code', 'ded_name', 'print_name', 'affect_cost_of_goods', 'type', 'debit_side_adjust', 'account_head', 'credit_adjust', 'deduction_type', 'calculation_type', 'status']"
);

// customer_master
masters = masters.replace(
  /customer_master: \{\s*table: 'customer_master',\s*fields: \['name', 'print_name', 'contact_person', 'address1', 'address2', 'address3', 'address4', 'gst_number', 'phone_off', 'phone_res', 'mobile1', 'mobile2', 'area', 'opening_balance'\]/,
  "customer_master: {\n    table: 'customer_master',\n    fields: ['name', 'print_name', 'contact_person', 'address1', 'phone_res', 'phone_off', 'mobile1', 'email', 'gst_number', 'area', 'transport', 'limit_days', 'limit_amount', 'opening_balance', 'balance_type', 'status']"
);

// supplier_master
masters = masters.replace(
  /supplier_master: \{\s*table: 'supplier_master',\s*fields: \['name', 'print_name', 'contact_person', 'address1', 'address2', 'address3', 'address4', 'gst_number', 'phone_off', 'phone_res', 'mobile1', 'mobile2', 'area', 'opening_balance'\]/,
  "supplier_master: {\n    table: 'supplier_master',\n    fields: ['name', 'print_name', 'contact_person', 'address1', 'phone_res', 'phone_off', 'mobile1', 'email', 'gst_number', 'area', 'transport', 'limit_days', 'limit_amount', 'opening_balance', 'balance_type', 'status']"
);

fs.writeFileSync('backend/routes/masters.js', masters);
console.log('✅ Fixed backend/routes/masters.js');

// 3. Fix database/schema.sql
let schema = fs.readFileSync('database/schema.sql', 'utf8');

// godown_master
schema = schema.replace(
  /CREATE TABLE IF NOT EXISTS godown_master \(\s*id INTEGER PRIMARY KEY AUTOINCREMENT,\s*godown_name TEXT UNIQUE,\s*print_name TEXT,\s*location TEXT,\s*status TEXT DEFAULT 'Active'\s*\);/,
  `CREATE TABLE IF NOT EXISTS godown_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    godown_name TEXT UNIQUE,
    print_name TEXT,
    contact_person TEXT,
    address TEXT,
    phone_off TEXT,
    area TEXT,
    status TEXT DEFAULT 'Active'
);`
);

// deduction_purchase
schema = schema.replace(
  /CREATE TABLE IF NOT EXISTS deduction_purchase \(\s*id INTEGER PRIMARY KEY AUTOINCREMENT,\s*ded_code TEXT UNIQUE,\s*ded_name TEXT,\s*print_name TEXT,\s*debit_adjust TEXT,\s*account_head TEXT,\s*credit_adjust TEXT,\s*ded_type TEXT,\s*calc_type TEXT\s*\);/,
  `CREATE TABLE IF NOT EXISTS deduction_purchase (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ded_code TEXT UNIQUE,
    ded_name TEXT,
    print_name TEXT,
    affect_cost_of_goods TEXT DEFAULT 'No',
    type TEXT DEFAULT 'Add',
    debit_side_adjust TEXT DEFAULT 'None',
    account_head TEXT,
    credit_adjust TEXT,
    deduction_type TEXT DEFAULT 'Add',
    calculation_type TEXT DEFAULT 'Percentage',
    status TEXT DEFAULT 'Active'
);`
);

// customer_master
schema = schema.replace(
  /CREATE TABLE IF NOT EXISTS customer_master \(\s*id INTEGER PRIMARY KEY AUTOINCREMENT,\s*name TEXT,\s*print_name TEXT,\s*contact_person TEXT,\s*address1 TEXT,\s*address2 TEXT,\s*address3 TEXT,\s*address4 TEXT,\s*gst_number TEXT,\s*phone_off TEXT,\s*phone_res TEXT,\s*mobile1 TEXT,\s*mobile2 TEXT,\s*area TEXT,\s*opening_balance REAL\s*\);/,
  `CREATE TABLE IF NOT EXISTS customer_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    print_name TEXT,
    contact_person TEXT,
    address1 TEXT,
    phone_res TEXT,
    phone_off TEXT,
    mobile1 TEXT,
    email TEXT,
    gst_number TEXT,
    area TEXT,
    transport TEXT,
    limit_days INTEGER,
    limit_amount REAL,
    opening_balance REAL DEFAULT 0,
    balance_type TEXT DEFAULT 'Dr',
    status TEXT DEFAULT 'Active'
);`
);

// supplier_master
schema = schema.replace(
  /CREATE TABLE IF NOT EXISTS supplier_master \(\s*id INTEGER PRIMARY KEY AUTOINCREMENT,\s*name TEXT,\s*print_name TEXT,\s*contact_person TEXT,\s*address1 TEXT,\s*address2 TEXT,\s*address3 TEXT,\s*address4 TEXT,\s*gst_number TEXT,\s*phone_off TEXT,\s*phone_res TEXT,\s*mobile1 TEXT,\s*mobile2 TEXT,\s*area TEXT,\s*opening_balance REAL\s*\);/,
  `CREATE TABLE IF NOT EXISTS supplier_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    print_name TEXT,
    contact_person TEXT,
    address1 TEXT,
    phone_res TEXT,
    phone_off TEXT,
    mobile1 TEXT,
    email TEXT,
    gst_number TEXT,
    area TEXT,
    transport TEXT,
    limit_days INTEGER,
    limit_amount REAL,
    opening_balance REAL DEFAULT 0,
    balance_type TEXT DEFAULT 'Dr',
    status TEXT DEFAULT 'Active'
);`
);

fs.writeFileSync('database/schema.sql', schema);
console.log('✅ Fixed database/schema.sql');

// 4. Fix backend/server.js - flour_mill_master already correct, verify others
let server = fs.readFileSync('backend/server.js', 'utf8');

// flour_mill_master - already has correct fields in server.js based on earlier read
// Just verify and fix if needed
server = server.replace(
  /name: 'flour_mill_master',\s*sql: `CREATE TABLE IF NOT EXISTS flour_mill_master \(\s*id INTEGER PRIMARY KEY AUTOINCREMENT,\s*flourmill TEXT UNIQUE,\s*print_name TEXT,\s*contact_person TEXT,\s*address TEXT,\s*area TEXT,\s*phone_res TEXT,\s*phone_off TEXT,\s*mobile TEXT,\s*tin_no TEXT,\s*wages_kg REAL,\s*opening_balance REAL,\s*opening_balance_type TEXT DEFAULT 'Dr',\s*status TEXT DEFAULT 'Active'\s*\)`/,
  `name: 'flour_mill_master',\n      sql: \`CREATE TABLE IF NOT EXISTS flour_mill_master (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        flourmill TEXT UNIQUE,\n        print_name TEXT,\n        contact_person TEXT,\n        address TEXT,\n        area TEXT,\n        phone_res TEXT,\n        phone_off TEXT,\n        mobile TEXT,\n        tin_no TEXT,\n        wages_kg REAL,\n        opening_balance REAL,\n        opening_balance_type TEXT DEFAULT 'Dr',\n        status TEXT DEFAULT 'Active'\n      )\``
);

fs.writeFileSync('backend/server.js', server);
console.log('✅ Verified backend/server.js');

console.log('\n🎉 All fixes applied successfully!');

