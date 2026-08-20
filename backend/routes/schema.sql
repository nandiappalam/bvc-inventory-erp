-- Schema for Purchase Orders module

CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s_no INTEGER NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    inv_no TEXT,
    inv_date TEXT,
    godown_id INTEGER,
    pay_type TEXT,
    tax_type TEXT,
    tax_rate REAL,
    type TEXT,
    remarks TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    qty REAL NOT NULL,
    rate REAL NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
);