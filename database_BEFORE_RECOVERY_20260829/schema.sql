-- BVC Purchase Management System Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    gst_number TEXT,
    contact TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Purchases table
DROP TABLE IF EXISTS purchases;
CREATE TABLE purchases (
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

    -- ERP totals (new)
    gross_amount REAL DEFAULT 0,            -- qty×rate
    discount_total REAL DEFAULT 0,          -- disc_amount
    taxable_amount REAL DEFAULT 0,         -- gross - discount

    sgst_amount REAL DEFAULT 0,
    cgst_amount REAL DEFAULT 0,
    igst_amount REAL DEFAULT 0,

    tax_total REAL DEFAULT 0,

    net_amount REAL DEFAULT 0,             -- taxable + tax_total

    addition_total REAL DEFAULT 0,
    deduction_total REAL DEFAULT 0,
    final_amount REAL DEFAULT 0,

    -- TEMPORARY compatibility mapping (old columns kept)
    total_amount REAL DEFAULT 0,            -- will mirror gross_amount
    base_amount REAL DEFAULT 0,             -- mirror gross_amount
    disc_amount REAL DEFAULT 0,             -- mirror discount_total
    tax_amount REAL DEFAULT 0,             -- mirror tax_total
    auto_wages REAL DEFAULT 0,
    vat_percent REAL DEFAULT 0,
    vat REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,            -- mirror final_amount

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Purchase deductions transaction table
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

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
);

-- Purchase items table

DROP TABLE IF EXISTS purchase_items;
CREATE TABLE purchase_items (
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
);

-- Purchase returns table
CREATE TABLE IF NOT EXISTS purchase_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s_no INTEGER NOT NULL,
    date DATE NOT NULL,
    return_inv_no TEXT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Purchase return items table
CREATE TABLE IF NOT EXISTS purchase_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_return_id INTEGER,
    lot_no TEXT,
    item_name TEXT NOT NULL,
    weight REAL,
    qty REAL,
    total_wt REAL,
    rate REAL,
    disc_percent REAL DEFAULT 0,
    tax_percent REAL DEFAULT 0,
    amount REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE
);

-- Grains table
CREATE TABLE IF NOT EXISTS grains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s_no INTEGER NOT NULL,
    flour_mill TEXT,
    date DATE NOT NULL,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Grain input items table
CREATE TABLE IF NOT EXISTS grain_input_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grain_id INTEGER,
    item_name TEXT NOT NULL,
    lot_no TEXT,
    weight REAL,
    qty REAL,
    total_wt REAL,
    wages_kg REAL,
    total_wages REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grain_id) REFERENCES grains(id) ON DELETE CASCADE
);

-- Grain output items table
CREATE TABLE IF NOT EXISTS grain_output_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grain_id INTEGER,
    item_name TEXT NOT NULL,
    weight REAL,
    qty REAL,
    total_wt REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grain_id) REFERENCES grains(id) ON DELETE CASCADE
);

-- Flour out table
CREATE TABLE IF NOT EXISTS flour_out (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s_no INTEGER NOT NULL,
    date DATE NOT NULL,
    papad_company TEXT,
    remarks TEXT,
    total_qty REAL DEFAULT 0,
    total_weight REAL DEFAULT 0,
    total_wages REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Flour out items table
DROP TABLE IF EXISTS flour_out_items;
CREATE TABLE flour_out_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flour_out_id INTEGER,
    item_name TEXT NOT NULL,
    lot_no TEXT,
    weight REAL,
    qty REAL,
    total_wt REAL,
    papad_kg REAL,
    wages_bag REAL,
    wages REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flour_out_id) REFERENCES flour_out(id) ON DELETE CASCADE
);

-- Flour out returns table
CREATE TABLE IF NOT EXISTS flour_out_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s_no INTEGER NOT NULL,
    date DATETIME NOT NULL,
    tax_type TEXT DEFAULT 'Cash',
    remarks TEXT,
    total_qty REAL DEFAULT 0,
    total_weight REAL DEFAULT 0,
    total_wages REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Flour out return items table
CREATE TABLE IF NOT EXISTS flour_out_return_items (
    id SERIAL PRIMARY KEY,
    flour_out_return_id INTEGER REFERENCES flour_out_returns(id) ON DELETE CASCADE,
    item_name VARCHAR(100) NOT NULL,
    weight DECIMAL(10,3),
    qty DECIMAL(10,3),
    total_wt DECIMAL(10,3),
    papad_kg DECIMAL(10,3),
    cost DECIMAL(10,2),
    wages_bag DECIMAL(10,2),
    wages DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    lot_no TEXT,
    quantity REAL DEFAULT 0,
    weight REAL DEFAULT 0,
    unit_price REAL,
    total_value REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stock table for lot-wise inventory tracking
CREATE TABLE IF NOT EXISTS stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    lot_no TEXT NOT NULL,
    qty REAL DEFAULT 0,
    weight REAL DEFAULT 0,
    rate REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    date DATE,
    type TEXT DEFAULT 'Purchase',
    reference_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_date ON purchase_returns(date);
CREATE INDEX IF NOT EXISTS idx_grains_date ON grains(date);
CREATE INDEX IF NOT EXISTS idx_flour_out_date ON flour_out(date);
CREATE INDEX IF NOT EXISTS idx_flour_out_returns_date ON flour_out_returns(date);
CREATE INDEX IF NOT EXISTS idx_inventory_item_name ON inventory(item_name);
CREATE INDEX IF NOT EXISTS idx_stock_item_name ON stock(item_name);
CREATE INDEX IF NOT EXISTS idx_stock_lot_no ON stock(lot_no);
CREATE INDEX IF NOT EXISTS idx_stock_type ON stock(type);

-- Master tables from BVC Master Pages.py

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
    tax REAL,
    status TEXT DEFAULT 'Active'
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
    ded_value REAL
);

-- Deduction Purchase
CREATE TABLE IF NOT EXISTS deduction_purchase (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ded_code TEXT UNIQUE,
    ded_name TEXT,
    print_name TEXT,
    affect_cost_of_goods TEXT DEFAULT 'No',
    type TEXT DEFAULT 'Add',
    debit_side_adjust TEXT DEFAULT 'None',
    account_head TEXT,
    credit_adjust TEXT DEFAULT 'None',
    deduction_type TEXT DEFAULT 'Add',
    calculation_type TEXT DEFAULT 'Percentage',
    deduction_value REAL DEFAULT 0,
    status TEXT DEFAULT 'Active'
);

-- Customer Master
CREATE TABLE IF NOT EXISTS customer_master (
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
);

-- Supplier Master
CREATE TABLE IF NOT EXISTS supplier_master (
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
);

-- Flour Mill Master
CREATE TABLE IF NOT EXISTS flour_mill_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flourmill TEXT UNIQUE,
    print_name TEXT,
    contact_person TEXT,
    address TEXT,
    area TEXT,
    phone_res TEXT,
    phone_off TEXT,
    mobile TEXT,
    tin_no TEXT,
    wages_kg REAL,
    opening_balance REAL,
    opening_balance_type TEXT DEFAULT 'Dr',
    status TEXT DEFAULT 'Active'
);

-- Papad Company Master
CREATE TABLE IF NOT EXISTS papad_company_master (
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
    wages_kg REAL,
    opening_balance REAL,
    opening_advance REAL
);

-- Papad Wages History
CREATE TABLE IF NOT EXISTS papad_wages_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    papad_company TEXT,
    from_date TEXT,
    to_date TEXT,
    papad_kg_bag REAL,
    wages_bag REAL,
    adv_ded_bag REAL,
    FOREIGN KEY(papad_company) REFERENCES papad_company_master(name)
);

-- Weight Master
CREATE TABLE IF NOT EXISTS weightmaster (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    printname TEXT,
    weight REAL
);

-- Ledger Group Master
CREATE TABLE IF NOT EXISTS ledgergroupmaster (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    printname TEXT,
    under TEXT
);

-- Ledger Master
CREATE TABLE IF NOT EXISTS ledgermaster (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    printname TEXT,
    alias_name TEXT,
    under TEXT,
    openingbalance REAL DEFAULT 0,
    opening_type TEXT DEFAULT 'Dr',
    ledger_type TEXT DEFAULT 'General',
    status TEXT DEFAULT 'Active'
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s_no INTEGER NOT NULL,
    date DATE NOT NULL,
    customer TEXT,
    remarks TEXT,
    total_qty REAL DEFAULT 0,
    total_wt REAL DEFAULT 0,
    total_amt REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sales Items table
CREATE TABLE IF NOT EXISTS sales_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_id INTEGER,
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
    FOREIGN KEY (sales_id) REFERENCES sales(id)
);

-- Sales Return table
CREATE TABLE IF NOT EXISTS sales_return (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s_no INTEGER NOT NULL,
    date DATE NOT NULL,
    customer TEXT,
    remarks TEXT,
    total_qty REAL DEFAULT 0,
    total_wt REAL DEFAULT 0,
    total_amt REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sales Return Items table
CREATE TABLE IF NOT EXISTS sales_return_items (
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

-- Godown Master
CREATE TABLE IF NOT EXISTS godown_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    godown_name TEXT UNIQUE,
    print_name TEXT,
    contact_person TEXT,
    address TEXT,
    phone_off TEXT,
    mobile1 TEXT,
    email TEXT,
    website TEXT,
    area TEXT,
    gst_number TEXT,
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

-- Advances table
CREATE TABLE IF NOT EXISTS advances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s_no TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    papad_company TEXT NOT NULL,
    amount REAL NOT NULL,
    pay_mode TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ledger Entries table for accounting
CREATE TABLE IF NOT EXISTS ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ledger_id INTEGER,
    ledger_name TEXT NOT NULL,
    date DATE NOT NULL,
    voucher_type TEXT NOT NULL,
    voucher_no TEXT,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    reference_id INTEGER,
    reference_type TEXT,
    particulars TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ledger_id) REFERENCES ledgermaster(id)
);

-- Create indexes for ledger entries
CREATE INDEX IF NOT EXISTS idx_ledger_entries_date ON ledger_entries(date);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_ledger_id ON ledger_entries(ledger_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_voucher ON ledger_entries(voucher_type, voucher_no);

-- Vehicle Movements Table (NEW)
CREATE TABLE IF NOT EXISTS vehicle_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_type TEXT NOT NULL,  -- PURCHASE|SALES|PURCHASE_RETURN|SALES_RETURN
  reference_id INTEGER NOT NULL,
  movement_type TEXT NOT NULL,   -- INBOUND|OUTBOUND
  operation_type TEXT NOT NULL,  -- LOAD|UNLOAD
  vehicle_no TEXT NOT NULL,
  driver_name TEXT,
  transporter_id INTEGER,
  gate_in_time DATETIME,
  gate_out_time DATETIME,
  gross_weight REAL DEFAULT 0,
  tare_weight REAL DEFAULT 0,
  net_weight REAL DEFAULT 0,
  status TEXT DEFAULT 'IN',      -- IN|LOADED|UNLOADED|OUT
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transporter_id) REFERENCES transport_master(id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_ref ON vehicle_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_status ON vehicle_movements(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_vehicle_no ON vehicle_movements(vehicle_no);

-- Stock Lots table for GLOBAL lot tracking (LOT001, LOT002...)
CREATE TABLE IF NOT EXISTS stock_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lot_no TEXT UNIQUE,
  item_name TEXT,
  quantity REAL,
  remaining_qty REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for stock_lots performance
CREATE INDEX IF NOT EXISTS idx_stock_lots_lot_no ON stock_lots(lot_no);
CREATE INDEX IF NOT EXISTS idx_stock_lots_item_name ON stock_lots(item_name);
CREATE INDEX IF NOT EXISTS idx_stock_lots_remaining ON stock_lots(remaining_qty);

-- RESET MASTER TABLES (clear duplicates)
DELETE FROM godown_master;
DELETE FROM item_master;
DELETE FROM item_groups;
DELETE FROM area_master;
DELETE FROM city_master;
DELETE FROM transport_master;
DELETE FROM supplier_master;
DELETE FROM customer_master;
DELETE FROM consignee_group_master;
DELETE FROM sender_group_master;
DELETE FROM person_master;
DELETE FROM ptrans_master;
DELETE FROM flour_mill_master;
DELETE FROM papad_company_master;
DELETE FROM deduction_sales;
DELETE FROM deduction_purchase;
DELETE FROM weightmaster;
DELETE FROM ledgergroupmaster;
DELETE FROM ledgermaster;

-- Insert sample companies first
INSERT OR IGNORE INTO companies (name, address, gst_number, contact, email) VALUES
('BVC Exports Pvt Ltd', 'Mumbai, Maharashtra', '27AABCB1234C1ZZ', '9876543210', 'info@bvcexports.com');

-- Insert sample users with company_id (password is 'admin123' and 'user123' hashed with bcrypt)
INSERT OR IGNORE INTO users (company_id, username, password_hash, role) VALUES
(1, 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4beK7xIp.q3qHGKC', 'admin'),
(1, 'user', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4beK7xIp.q3qHGKC', 'user');

-- Voucher Master Table
CREATE TABLE IF NOT EXISTS voucher (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    voucher_type TEXT NOT NULL CHECK(voucher_type IN ('Payment', 'Receipt', 'Contra', 'Journal')),
    voucher_no TEXT UNIQUE NOT NULL,
    date DATE NOT NULL,
    reference_no TEXT,
    narration TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Voucher Entry Table
CREATE TABLE IF NOT EXISTS voucher_entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('Dr','Cr')),
    ledger_id INTEGER,
    debit REAL DEFAULT 0 CHECK(debit >= 0),
    credit REAL DEFAULT 0 CHECK(credit >= 0),
    remarks TEXT,
    FOREIGN KEY (voucher_id) REFERENCES voucher(id) ON DELETE CASCADE,
    FOREIGN KEY (ledger_id) REFERENCES ledgermaster(id)
);

-- Indexes for voucher tables
CREATE INDEX IF NOT EXISTS idx_voucher_date ON voucher(date);
CREATE INDEX IF NOT EXISTS idx_voucher_type_no ON voucher(voucher_type, voucher_no);
CREATE INDEX IF NOT EXISTS idx_voucher_entry_voucher ON voucher_entry(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_entry_ledger ON voucher_entry(ledger_id);
CREATE INDEX IF NOT EXISTS idx_voucher_entry_type ON voucher_entry(type);

-- Sample ledgers for voucher testing (if none exist)
INSERT OR IGNORE INTO ledgergroupmaster (id, name, printname) VALUES (1, 'Direct Expenses', 'Direct Expenses');
INSERT OR IGNORE INTO ledgermaster (id, name, under, openingbalance, opening_type, ledger_type) VALUES
(1, 'Cash', 'Cash-in-Hand', 0, 'Dr', 'Cash'),
(2, 'Purchase A/c', 'Direct Expenses', 0, 'Dr', 'General'),
(3, 'Sales A/c', 'Direct Income', 0, 'Cr', 'General');
