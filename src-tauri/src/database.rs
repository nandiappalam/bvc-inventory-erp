use rusqlite::{Connection, params};
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self, String> {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA foreign_keys = ON").map_err(|e| e.to_string())?;
        
        // Initialize tables
        Self::init_tables(&conn)?;
        
        Ok(Database {
            conn: Mutex::new(conn),
        })
    }
    
    fn init_tables(conn: &Connection) -> Result<(), String> {
        // Companies table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                address TEXT,
                gst_number TEXT,
                contact TEXT,
                email TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Users table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                company_id INTEGER,
                role TEXT DEFAULT 'user',
                status TEXT DEFAULT 'Active',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Cities table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS city_master (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                print_name TEXT,
                status TEXT DEFAULT 'Active'
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Areas table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS area_master (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                print_name TEXT,
                status TEXT DEFAULT 'Active'
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Customers table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS customer_master (
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
                status TEXT DEFAULT 'Active'
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Suppliers table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS supplier_master (
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
                status TEXT DEFAULT 'Active'
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Items table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS item_master (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_code TEXT UNIQUE,
                item_name TEXT,
                print_name TEXT,
                item_group TEXT,
                tax REAL DEFAULT 0,
                hsn_code TEXT,
                status TEXT DEFAULT 'Active'
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Item groups table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS item_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_code TEXT UNIQUE,
                group_name TEXT,
                print_name TEXT,
                tax REAL
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Ledger groups table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS ledgergroupmaster (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                printname TEXT,
                under TEXT
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Ledgers table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS ledgermaster (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                printname TEXT,
                under TEXT,
                openingbalance REAL DEFAULT 0,
                area TEXT,
                credit REAL DEFAULT 0,
                debit REAL DEFAULT 0,
                status TEXT DEFAULT 'Active'
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Transport table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS transport_master (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                print_name TEXT,
                status TEXT DEFAULT 'Active'
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Weight master table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS weightmaster (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                printname TEXT,
                weight REAL
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Ptrans master table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS ptrans_master (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                print_name TEXT,
                status TEXT DEFAULT 'Active'
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Flour mill master table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS flour_mill_master (
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
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Papad company master table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS papad_company_master (
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
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Consignee master table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS consignee_group_master (
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
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Sender master table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sender_group_master (
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
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Deduction sales table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS deduction_sales (
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
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Deduction purchase table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS deduction_purchase (
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
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Stock lots table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS stock_lots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER,
                item_name TEXT,
                lot_no TEXT UNIQUE,
                purchase_id INTEGER,
                quantity REAL DEFAULT 0,
                remaining_quantity REAL DEFAULT 0,
                rate REAL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES item_master(id),
                FOREIGN KEY (purchase_id) REFERENCES purchases(id)
            )",
            [],
        ).map_err(|e| e.to_string())?;

        // Stock table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS stock (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                item_name TEXT,
                lot_no TEXT,
                qty REAL DEFAULT 0,
                weight REAL DEFAULT 0,
                rate REAL DEFAULT 0,
                amount REAL DEFAULT 0,
                type TEXT,
                reference_id INTEGER,
                status TEXT DEFAULT 'Active',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;

        // Purchases table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                inv_no TEXT,
                supplier TEXT,
                pay_type TEXT,
                inv_date TEXT,
                type TEXT,
                address TEXT,
                tax_type TEXT,
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
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;

        // Purchase items table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS purchase_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                purchase_id INTEGER,
                item_name TEXT,
                lot_no TEXT,
                weight REAL DEFAULT 0,
                qty REAL DEFAULT 0,
                total_wt REAL DEFAULT 0,
                rate REAL DEFAULT 0,
                disc_percent REAL DEFAULT 0,
                tax_percent REAL DEFAULT 0,
                amount REAL DEFAULT 0,
                FOREIGN KEY (purchase_id) REFERENCES purchases(id)
            )",
            [],
        ).map_err(|e| e.to_string())?;

        // Sales table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                inv_no TEXT,
                customer TEXT,
                pay_type TEXT,
                inv_date TEXT,
                type TEXT,
                address TEXT,
                tax_type TEXT,
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
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;

        // Sales items table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sales_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sales_id INTEGER,
                item_name TEXT,
                lot_no TEXT,
                weight REAL DEFAULT 0,
                qty REAL DEFAULT 0,
                total_wt REAL DEFAULT 0,
                rate REAL DEFAULT 0,
                disc_percent REAL DEFAULT 0,
                tax_percent REAL DEFAULT 0,
                amount REAL DEFAULT 0,
                FOREIGN KEY (sales_id) REFERENCES sales(id)
            )",
            [],
        ).map_err(|e| e.to_string())?;

        // Financial years table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS financial_years (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                year TEXT UNIQUE,
                start_date TEXT,
                end_date TEXT,
                is_active INTEGER DEFAULT 0
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // ==================== ENTRY TABLES ====================
        
        // Advances table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS advances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no TEXT,
                date TEXT,
                papad_company TEXT,
                amount REAL DEFAULT 0,
                pay_mode TEXT,
                remarks TEXT,
                dr_cr TEXT DEFAULT 'Dr',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Flour Out table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS flour_out (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                papad_company TEXT,
                remarks TEXT,
                total_qty REAL DEFAULT 0,
                total_weight REAL DEFAULT 0,
                total_wages REAL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Flour Out Items table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS flour_out_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                flour_out_id INTEGER,
                item_name TEXT,
                lot_no TEXT,
                qty REAL DEFAULT 0,
                total_wt REAL DEFAULT 0,
                wages REAL DEFAULT 0,
                FOREIGN KEY (flour_out_id) REFERENCES flour_out(id)
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Flour Out Returns table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS flour_out_returns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                company TEXT,
                total_qty REAL DEFAULT 0,
                total_weight REAL DEFAULT 0,
                wages REAL DEFAULT 0,
                remarks TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Grains table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS grains (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                party TEXT,
                item_name TEXT,
                qty REAL DEFAULT 0,
                weight REAL DEFAULT 0,
                rate REAL DEFAULT 0,
                amount REAL DEFAULT 0,
                transport TEXT,
                vehicle_no TEXT,
                bags INTEGER DEFAULT 0,
                remarks TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Papad In table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS papad_in (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                company TEXT,
                item_name TEXT,
                qty REAL DEFAULT 0,
                packets INTEGER DEFAULT 0,
                weight REAL DEFAULT 0,
                rate REAL DEFAULT 0,
                amount REAL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Purchase Returns table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS purchase_returns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                supplier TEXT,
                inv_no TEXT,
                item_name TEXT,
                qty REAL DEFAULT 0,
                weight REAL DEFAULT 0,
                rate REAL DEFAULT 0,
                amount REAL DEFAULT 0,
                reason TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Sales Returns table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sales_returns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                customer TEXT,
                inv_no TEXT,
                item_name TEXT,
                qty REAL DEFAULT 0,
                weight REAL DEFAULT 0,
                rate REAL DEFAULT 0,
                amount REAL DEFAULT 0,
                reason TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Quotations table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS quotations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                customer TEXT,
                items TEXT,
                total_amount REAL DEFAULT 0,
                remarks TEXT,
                status TEXT DEFAULT 'Pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Packing table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS packing (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                company TEXT,
                item_name TEXT,
                qty REAL DEFAULT 0,
                packets INTEGER DEFAULT 0,
                weight REAL DEFAULT 0,
                rate REAL DEFAULT 0,
                amount REAL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Sales Export Orders table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sales_export_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                customer TEXT,
                items TEXT,
                total_qty REAL DEFAULT 0,
                total_amount REAL DEFAULT 0,
                status TEXT DEFAULT 'Pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Stock Adjust table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS stock_adjust (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                item_name TEXT,
                lot_no TEXT,
                adjustment REAL DEFAULT 0,
                reason TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Open Entries table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS open_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                ledger TEXT,
                debit REAL DEFAULT 0,
                credit REAL DEFAULT 0,
                remarks TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Weight Conversion table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS weight_conversion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                s_no INTEGER,
                date TEXT,
                from_item TEXT,
                to_item TEXT,
                from_qty REAL DEFAULT 0,
                to_qty REAL DEFAULT 0,
                rate REAL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Ledger Entries table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS ledger_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                ledger_name TEXT,
                debit REAL DEFAULT 0,
                credit REAL DEFAULT 0,
                voucher_no TEXT,
                company_id INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )",
            [],
        ).map_err(|e| e.to_string())?;
        
        // Seed initial data if tables are empty
        Self::seed_data(conn)?;
        
        Ok(())
    }
    
    fn seed_data(conn: &Connection) -> Result<(), String> {
        // Check if companies exist
        let company_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM companies",
            [],
            |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        
        if company_count == 0 {
            // Insert default company
            conn.execute(
                "INSERT INTO companies (name, address, contact) VALUES (?, ?, ?)",
                ["BVC Exports Pvt Ltd", "123 Business Park, Mumbai", "+91 9876543210"],
            ).map_err(|e| e.to_string())?;
        }
        
        // Check if users exist
        let user_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM users",
            [],
            |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        
        if user_count == 0 {
            // Insert default admin user (password: admin123)
            // bcrypt hash for "admin123" with DEFAULT_COST
            let hashed_password = "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi";
            conn.execute(
                "INSERT INTO users (username, password_hash, company_id, role) VALUES (?, ?, ?, ?)",
                params!("admin", hashed_password, 1, "admin"),
            ).map_err(|e| e.to_string())?;
        }
        
        Ok(())
    }
    
    // Generic query methods
    pub fn query(&self, sql: &str, params: &[&dyn rusqlite::ToSql]) -> Result<Vec<serde_json::Value>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        
        let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let rows = stmt.query_map(params, |row| {
            let mut map = serde_json::Map::new();
            for (i, col) in columns.iter().enumerate() {
                let value: Result<rusqlite::types::Value, _> = row.get(i);
                let json_value = match value {
                    Ok(rusqlite::types::Value::Null) => serde_json::Value::Null,
                    Ok(rusqlite::types::Value::Integer(i)) => serde_json::Value::Number(i.into()),
                    Ok(rusqlite::types::Value::Real(f)) => serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap_or(serde_json::Number::from(0))),
                    Ok(rusqlite::types::Value::Text(s)) => serde_json::Value::String(s),
                    Ok(rusqlite::types::Value::Blob(b)) => serde_json::Value::String(format!("[blob: {} bytes]", b.len())),
                    Err(_) => serde_json::Value::Null,
                };
                map.insert(col.clone(), json_value);
            }
            Ok(serde_json::Value::Object(map))
        });
        
        let mapped_rows = rows.map_err(|e| e.to_string())?;
        
        let mut results = Vec::new();
        for row in mapped_rows {
            results.push(row.map_err(|e| e.to_string())?);
        }
        
        Ok(results)
    }
    
    pub fn execute(&self, sql: &str, params: &[&dyn rusqlite::ToSql]) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(sql, params).map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }
    
    pub fn update(&self, sql: &str, params: &[&dyn rusqlite::ToSql]) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        Ok(conn.execute(sql, params).map_err(|e| e.to_string())?)
    }
    
    pub fn delete(&self, sql: &str, params: &[&dyn rusqlite::ToSql]) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        Ok(conn.execute(sql, params).map_err(|e| e.to_string())?)
    }
}

// Helper function to get database path - uses AppData for proper Windows compatibility
pub fn get_db_path() -> String {
    // Try to use AppData directory (standard Windows location for app data)
    // This is better than exe directory because Program Files requires admin rights
    let app_data_dir = if let Some(app_data) = std::env::var_os("APPDATA") {
        std::path::PathBuf::from(app_data).join("BVC ERP")
    } else {
        // Fallback to exe directory if APPDATA is not available
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| std::path::PathBuf::from("."))
    };
    
    // Create the BVC ERP directory in AppData
    let db_dir = app_data_dir.join("database");
    
    // Create the database directory if it doesn't exist
    match std::fs::create_dir_all(&db_dir) {
        Ok(_) => {
            println!("Database directory ensured at: {:?}", db_dir);
        }
        Err(e) => {
            eprintln!("Warning: Failed to create database directory: {}", e);
        }
    }
    
    let db_path = db_dir.join("bvc.db");
    
    // Return this path - SQLite will create it if it doesn't exist
    let path_str = db_path.to_string_lossy().to_string();
    println!("Database path: {}", path_str);
    path_str
}
