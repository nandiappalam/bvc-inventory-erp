use crate::database::Database;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
/* params not used */
use bcrypt::{hash, verify, DEFAULT_COST};

pub struct AppState {
    pub db: Mutex<Database>,
}

// Query result response
#[derive(Serialize, Deserialize)]
pub struct QueryResult {
    pub success: bool,
    pub data: Vec<serde_json::Value>,
    pub message: Option<String>,
}

// Execute result response
#[derive(Serialize, Deserialize)]
pub struct ExecuteResult {
    pub success: bool,
    pub last_id: i64,
    pub changes: usize,
    pub message: String,
}

// Lot info for responses
#[derive(Serialize, Deserialize)]
pub struct LotInfo {
    pub lot_no: String,
    pub remaining_qty: f64,
}

// Helper to convert params
fn convert_params(params: &[serde_json::Value]) -> Vec<Box<dyn rusqlite::ToSql>> {
    params
        .iter()
        .map(|p| {
            match p {
                serde_json::Value::Null => Box::new(rusqlite::types::Null) as Box<dyn rusqlite::ToSql>,
                serde_json::Value::Bool(b) => Box::new(*b as i32) as Box<dyn rusqlite::ToSql>,
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        Box::new(i) as Box<dyn rusqlite::ToSql>
                    } else if let Some(f) = n.as_f64() {
                        Box::new(f) as Box<dyn rusqlite::ToSql>
                    } else {
                        Box::new(n.to_string()) as Box<dyn rusqlite::ToSql>
                    }
                }
                serde_json::Value::String(s) => Box::new(s.clone()) as Box<dyn rusqlite::ToSql>,
                _ => Box::new(p.to_string()) as Box<dyn rusqlite::ToSql>,
            }
        })
        .collect()
}

// ==================== GENERIC COMMANDS ====================

#[tauri::command]
pub fn execute_query(
    state: State<AppState>,
    sql: String,
    params: Vec<serde_json::Value>,
) -> Result<QueryResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let string_params = convert_params(&params);
    let param_refs: Vec<&dyn rusqlite::ToSql> = string_params.iter().map(|p| p.as_ref()).collect();
    
    match db.query(&sql, &param_refs) {
        Ok(rows) => Ok(QueryResult {
            success: true,
            data: rows,
            message: None,
        }),
        Err(e) => {
            // Always return empty array in data field to prevent frontend crashes
            println!("[execute_query] Error: {}", e);
            Ok(QueryResult {
                success: false,
                data: vec![],
                message: Some(e.to_string()),
            })
        }
    }
}

#[tauri::command]
pub fn execute_statement(
    state: State<AppState>,
    sql: String,
    params: Vec<serde_json::Value>,
) -> Result<ExecuteResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let string_params = convert_params(&params);
    let param_refs: Vec<&dyn rusqlite::ToSql> = string_params.iter().map(|p| p.as_ref()).collect();
    
    let sql_upper = sql.to_uppercase();
    if sql_upper.starts_with("SELECT") || sql_upper.starts_with("PRAGMA") {
        return Err("Use execute_query for SELECT statements".to_string());
    }
    
    if sql_upper.starts_with("UPDATE") || sql_upper.starts_with("DELETE") {
        match db.update(&sql, &param_refs) {
            Ok(changes) => Ok(ExecuteResult {
                success: true,
                last_id: 0,
                changes,
                message: format!("{} row(s) affected", changes),
            }),
            Err(e) => Ok(ExecuteResult {
                success: false,
                last_id: 0,
                changes: 0,
                message: e.to_string(),
            }),
        }
    } else {
        match db.execute(&sql, &param_refs) {
            Ok(last_id) => Ok(ExecuteResult {
                success: true,
                last_id,
                changes: 1,
                message: "Record inserted successfully".to_string(),
            }),
            Err(e) => Ok(ExecuteResult {
                success: false,
                last_id: 0,
                changes: 0,
                message: e.to_string(),
            }),
        }
    }
}

// Health check
#[tauri::command]
pub fn health_check() -> String {
    "BVC Tauri Backend is running".to_string()
}

#[tauri::command]
pub fn get_db_path() -> String {
    crate::database::get_db_path()
}

// ==================== AUTH COMMANDS ====================

#[derive(Serialize, Deserialize)]
pub struct LoginResponse {
    pub user_id: i32,
    pub username: String,
    pub role: String,
    pub company_id: i32,
    pub company_name: String,
}

// Add this function to commands.rs


#[tauri::command]
pub fn login(
    state: State<AppState>,
    username: String,
    password: String,
    companyId: i64,
) -> Result<LoginResponse, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // First, check if any users exist for this company
    // If no users exist, auto-create admin user for first login
    let user_count_sql = "SELECT COUNT(*) as count FROM users WHERE company_id = ?";
    let user_count_rows = db.query(user_count_sql, &[&companyId]).map_err(|e| e.to_string())?;
    let user_count = user_count_rows.first()
        .and_then(|r| r.get("count"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    
    // If no users exist for this company, auto-create admin
    if user_count == 0 {
        println!("No users found for company {}. Creating default admin user...", companyId);
        
        // Verify company exists
        let company_rows = db.query("SELECT id, name FROM companies WHERE id = ?", &[&companyId]).map_err(|e| e.to_string())?;
        
        if let Some(company_row) = company_rows.first() {
            let company_name = company_row.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            
            // Create admin user with hashed password
            let admin_hash = hash("admin123", DEFAULT_COST).map_err(|e| e.to_string())?;
            let user_id = db.execute(
                "INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)",
                &[&companyId, &"admin", &admin_hash, &"admin"],
            ).map_err(|e| e.to_string())?;
            
            println!("Admin user created with ID: {}", user_id);
            
            return Ok(LoginResponse {
                user_id: user_id as i32,
                username: "admin".to_string(),
                role: "admin".to_string(),
                company_id: companyId as i32,
                company_name,
            });
        }
    }
    
    // Now try to find the user with the given credentials
    let sql = "SELECT u.id, u.username, u.password_hash, u.role, u.company_id, c.name
               FROM users u
               JOIN companies c ON u.company_id = c.id
               WHERE u.username = ? AND u.company_id = ?";
    
    let rows = db.query(sql, &[&username, &companyId]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.first() {
        let stored_hash = row.get("password_hash")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        
        if verify(&password, stored_hash).map_err(|e| e.to_string())? {
            return Ok(LoginResponse {
                user_id: row.get("id").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                username: row.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                role: row.get("role").and_then(|v| v.as_str()).unwrap_or("user").to_string(),
                company_id: row.get("company_id").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                company_name: row.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            });
        }
    }
    
    // Special fallback: If attempting to login with admin/admin123 but user exists with different password
    // Allow login by creating/updating the user (helps with password reset scenarios)
    if username == "admin" && password == "admin123" {
        // Check if company exists
        let company_rows = db.query("SELECT id, name FROM companies WHERE id = ?", &[&companyId]).map_err(|e| e.to_string())?;
        
        if let Some(company_row) = company_rows.first() {
            let company_name = company_row.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            
            // Check if user already exists for this company
            let existing_user_rows = db.query(
                "SELECT id, username, password_hash, role FROM users WHERE username = ? AND company_id = ?",
                &[&username, &companyId]
            ).map_err(|e| e.to_string())?;
            
            if let Some(existing_user) = existing_user_rows.first() {
                // User exists but password didn't match above - update password
                let admin_hash = hash("admin123", DEFAULT_COST).map_err(|e| e.to_string())?;
                let _ = db.update(
                    "UPDATE users SET password_hash = ? WHERE username = ? AND company_id = ?",
                    &[&admin_hash, &username, &companyId]
                );
                
                return Ok(LoginResponse {
                    user_id: existing_user.get("id").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                    username: "admin".to_string(),
                    role: existing_user.get("role").and_then(|v| v.as_str()).unwrap_or("admin").to_string(),
                    company_id: companyId as i32,
                    company_name,
                });
            }
            
            // Create admin user for this company
            let admin_hash = hash("admin123", DEFAULT_COST).map_err(|e| e.to_string())?;
            let user_id = db.execute(
                "INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)",
                &[&companyId, &"admin", &admin_hash, &"admin"],
            ).map_err(|e| e.to_string())?;
            
            return Ok(LoginResponse {
                user_id: user_id as i32,
                username: "admin".to_string(),
                role: "admin".to_string(),
                company_id: companyId as i32,
                company_name,
            });
        }
    }
    
    Err("Invalid username or password".into())
}

#[tauri::command]
pub fn seed_default_data(state: State<AppState>) -> Result<ExecuteResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Check if admin exists
    let check_sql = "SELECT COUNT(*) as count FROM users WHERE username = 'admin'";
    let rows = db.query(check_sql, &[]).map_err(|e| e.to_string())?;
    
    if let Some(row) = rows.first() {
        let count = row.get("count").and_then(|v| v.as_i64()).unwrap_or(0);
        if count > 0 {
            return Ok(ExecuteResult {
                success: true,
                last_id: 0,
                changes: 0,
                message: "Default data already exists".to_string(),
            });
        }
    }
    
    // Create default company
    let company_id = db.execute(
        "INSERT INTO companies (name, address, contact) VALUES (?, ?, ?)",
        &[&"BVC Company", &"", &""],
    ).map_err(|e| e.to_string())?;
    
    // Create admin user
    let admin_hash = hash("admin123", DEFAULT_COST).map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)",
        &[&company_id, &"admin", &admin_hash, &"admin"],
    ).map_err(|e| e.to_string())?;
    
    Ok(ExecuteResult {
        success: true,
        last_id: company_id,
        changes: 2,
        message: "Default data seeded! Login: admin / admin123".to_string(),
    })
}

// ==================== STOCK & LOT COMMANDS ====================

#[derive(Serialize, Deserialize)]
pub struct Lot {
    pub lot_no: String,
}

#[tauri::command]
pub fn get_next_lot(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let count_rows = db.query("SELECT COUNT(*) as count FROM stock_lots WHERE lot_no LIKE 'LOT%'", &[]).map_err(|e| e.to_string())?;
    let count: i64 = count_rows.first().and_then(|r| r.get("count")).and_then(|v| v.as_i64()).unwrap_or(0);

    let next_number = count + 1;
    let lot = format!("LOT{:03}", next_number);

    Ok(lot)
}

#[tauri::command]
pub fn get_available_lots(
    state: State<AppState>,
    item_name: String, 
) -> Result<Vec<Lot>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT lot_no FROM stock_lots 
         WHERE item_name = ? AND remaining_qty > 0 
         ORDER BY created_at ASC"
    ).map_err(|e| e.to_string())?;

    let lots = stmt
        .query_map([&item_name], |row| {
            Ok(Lot {
                lot_no: row.get::<usize, String>(0).unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    Ok(lots)
}

#[tauri::command]
pub fn get_stock_summary(state: State<AppState>) -> Result<QueryResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let sql = r#"
        SELECT 
            item_name,
            SUM(remaining_quantity) as total_qty,
            AVG(rate) as avg_rate
        FROM stock_lots 
        WHERE remaining_quantity > 0
        GROUP BY item_name
        ORDER BY item_name
    "#;
    
    match db.query(sql, &[]) {
        Ok(rows) => Ok(QueryResult {
            success: true,
            data: rows,
            message: None,
        }),
        Err(e) => Ok(QueryResult {
            success: false,
            data: vec![],
            message: Some(e.to_string()),
        }),
    }
}

// ==================== PURCHASE WITH LOT AUTO-GENERATION ====================

#[tauri::command]
pub fn create_purchase_with_lots(
    state: State<AppState>,
    form_data: serde_json::Value,
    items: Vec<serde_json::Value>,
    totals: serde_json::Value,
) -> Result<ExecuteResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let date = form_data["date"].as_str().unwrap_or("");
    let supplier = form_data["supplier"].as_str().unwrap_or("");
    let sno = form_data["sno"].as_i64().unwrap_or(1);
    let inv_no = form_data["invNo"].as_str().unwrap_or("");
    let pay_type = form_data["payType"].as_str().unwrap_or("Credit");
    let inv_date = form_data["invDate"].as_str().unwrap_or("");
    let item_type = form_data["type"].as_str().unwrap_or("Urad");
    let address = form_data["address"].as_str().unwrap_or("");
    let tax_type = form_data["taxType"].as_str().unwrap_or("Exclusive");
    let godown = form_data["godown"].as_str().unwrap_or("");
    let remarks = form_data["remarks"].as_str().unwrap_or("");

    let total_qty = totals["totalQty"].as_f64().unwrap_or(0.0);
    let total_weight = totals["totalWeight"].as_f64().unwrap_or(0.0);
    let total_amount = totals["totalAmount"].as_f64().unwrap_or(0.0);
    let base_amount = totals["baseAmount"].as_f64().unwrap_or(0.0);
    let disc_amount = totals["discAmount"].as_f64().unwrap_or(0.0);
    let tax_amount = totals["taxAmount"].as_f64().unwrap_or(0.0);
    let net_amount = totals["netAmount"].as_f64().unwrap_or(0.0);
    let grand_total = totals["grandTotal"].as_f64().unwrap_or(0.0);

    // Store items count before consuming the vector
    let items_count = items.len();

    // Insert purchase header
    let purchase_id = db.execute(
        "INSERT INTO purchases (s_no, date, inv_no, supplier, pay_type, inv_date, type, address, tax_type, godown, remarks, total_qty, total_weight, total_amount, base_amount, disc_amount, tax_amount, net_amount, grand_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        &[&sno, &date, &inv_no, &supplier, &pay_type, &inv_date, &item_type, &address, &tax_type, &godown, &remarks, &total_qty, &total_weight, &total_amount, &base_amount, &disc_amount, &tax_amount, &net_amount, &grand_total],
    ).map_err(|e| e.to_string())?;

    // Process each item with lot auto-generation
    for item in items {
        let item_name = item["itemName"].as_str().unwrap_or("");
        let qty = item["qty"].as_f64().unwrap_or(0.0);
        let weight = item["weight"].as_f64().unwrap_or(0.0);
        let rate = item["rate"].as_f64().unwrap_or(0.0);
        let amount = item["amount"].as_f64().unwrap_or(0.0);
        
        // FIXED: Use global sequential LOT001+ for ALL creations
        let lot_no = get_next_lot(state.clone()).map_err(|e| e.to_string())?;

        // Insert purchase item
        db.execute(
            "INSERT INTO purchase_items (purchase_id, item_name, lot_no, weight, qty, total_wt, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            &[&purchase_id, &item_name, &lot_no, &weight, &qty, &(weight * qty), &rate, &amount],
        ).map_err(|e| e.to_string())?;

        // Get item_id
        let item_rows = db.query("SELECT id FROM item_master WHERE item_name = ?", &[&item_name]).map_err(|e| e.to_string())?;
        let item_id: Option<i64> = item_rows.first().and_then(|r| r.get("id")).and_then(|v| v.as_i64());

        // Insert into stock_lots
        db.execute(
            "INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate) VALUES (?, ?, ?, ?, ?, ?, ?)",
            &[&item_id, &item_name, &lot_no, &purchase_id, &qty, &qty, &rate],
        ).map_err(|e| e.to_string())?;

        // Insert into stock table
        db.execute(
            "INSERT INTO stock (item_name, lot_no, qty, weight, rate, amount, date, type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'Purchase', ?)",
            &[&item_name, &lot_no, &qty, &weight, &rate, &amount, &date, &purchase_id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(ExecuteResult {
        success: true,
        last_id: purchase_id,
        changes: items_count,
        message: format!("Purchase saved with {} lot(s) generated!", items_count),
    })
}

// ==================== SALES WITH FIFO LOT DEDUCTION ====================

#[tauri::command]
pub fn create_sale_with_lots(
    state: State<AppState>,
    form_data: serde_json::Value,
    items: Vec<serde_json::Value>,
    totals: serde_json::Value,
) -> Result<ExecuteResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let date = form_data["date"].as_str().unwrap_or("");
    let customer = form_data["customer"].as_str().unwrap_or("");
    let sno = form_data["sno"].as_i64().unwrap_or(1);
    let inv_no = form_data["invNo"].as_str().unwrap_or("");
    let pay_type = form_data["payType"].as_str().unwrap_or("Credit");
    let remarks = form_data["remarks"].as_str().unwrap_or("");

    let total_qty = totals["totalQty"].as_f64().unwrap_or(0.0);
    let total_amount = totals["totalAmount"].as_f64().unwrap_or(0.0);

    // Store items count before consuming the vector
    let items_count = items.len();

    // Insert sales header
    let sale_id = db.execute(
        "INSERT INTO sales (s_no, date, inv_no, customer, pay_type, remarks, total_qty, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        &[&sno, &date, &inv_no, &customer, &pay_type, &remarks, &total_qty, &total_amount],
    ).map_err(|e| e.to_string())?;

    // Process each item with FIFO lot deduction
    for item in items {
        let item_name = item["itemName"].as_str().unwrap_or("");
        let requested_qty = item["qty"].as_f64().unwrap_or(0.0);
        let rate = item["rate"].as_f64().unwrap_or(0.0);
        let amount = item["amount"].as_f64().unwrap_or(0.0);
        let lot_no = item["lotNo"].as_str().unwrap_or("");
        
        // Insert sales item
        db.execute(
            "INSERT INTO sales_items (sales_id, item_name, lot_no, qty, rate, amount) VALUES (?, ?, ?, ?, ?, ?)",
            &[&sale_id, &item_name, &lot_no, &requested_qty, &rate, &amount],
        ).map_err(|e| e.to_string())?;

        // Deduct from stock_lots using FIFO if no specific lot selected
        if lot_no.is_empty() {
            // Get available lots ordered by FIFO (oldest first)
            let lots_sql = "SELECT id, lot_no, remaining_quantity FROM stock_lots WHERE item_name = ? AND remaining_quantity > 0 ORDER BY created_at ASC";
            let lot_rows = db.query(lots_sql, &[&item_name]).map_err(|e| e.to_string())?;
            
            let mut remaining_to_deduct = requested_qty;
            for lot_row in lot_rows {
                if remaining_to_deduct <= 0.0 { break; }
                
                let lot_id = lot_row.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
                let lot_no = lot_row.get("lot_no").and_then(|v| v.as_str()).unwrap_or("");
                let lot_qty = lot_row.get("remaining_quantity").and_then(|v| v.as_f64()).unwrap_or(0.0);
                
                let deduct_this = lot_qty.min(remaining_to_deduct);
                
                // Update remaining quantity
                db.execute(
                    "UPDATE stock_lots SET remaining_quantity = remaining_quantity - ? WHERE id = ?",
                    &[&deduct_this, &lot_id],
                ).map_err(|e| e.to_string())?;
                
                // Add negative stock entry
                db.execute(
                    "INSERT INTO stock (item_name, lot_no, qty, rate, amount, date, type, reference_id) VALUES (?, ?, ?, ?, ?, ?, 'Sale', ?)",
                    &[&item_name, &lot_no, &(-deduct_this), &rate, &(-amount * deduct_this / requested_qty), &date, &sale_id],
                ).map_err(|e| e.to_string())?;
                
                remaining_to_deduct -= deduct_this;
            }
            
            if remaining_to_deduct > 0.0 {
                return Err(format!("Insufficient stock for {}. Short by {}", item_name, remaining_to_deduct));
            }
        } else {
            // Specific lot selected - deduct from that lot
            db.execute(
                "UPDATE stock_lots SET remaining_quantity = remaining_quantity - ? WHERE item_name = ? AND lot_no = ?",
                &[&requested_qty, &item_name, &lot_no],
            ).map_err(|e| e.to_string())?;
            
            db.execute(
                "INSERT INTO stock (item_name, lot_no, qty, rate, amount, date, type, reference_id) VALUES (?, ?, ?, ?, ?, ?, 'Sale', ?)",
                &[&item_name, &lot_no, &(-requested_qty), &rate, &(-amount), &date, &sale_id],
            ).map_err(|e| e.to_string())?;
        }
    }

    Ok(ExecuteResult {
        success: true,
        last_id: sale_id,
        changes: items_count,
        message: "Sale saved with lot deduction!".to_string(),
    })
}

// ==================== FLOUR OUT (GRIND) WITH LOT CONVERSION ====================

#[tauri::command]
pub fn create_flour_out(
    state: State<AppState>,
    form_data: serde_json::Value,
    items: Vec<serde_json::Value>,
) -> Result<ExecuteResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let date = form_data["date"].as_str().unwrap_or("");
    let papad_company = form_data["papadCompany"].as_str().unwrap_or("");
    let remarks = form_data["remarks"].as_str().unwrap_or("");
    let total_qty: f64 = items.iter().map(|i| i["qty"].as_f64().unwrap_or(0.0)).sum();
    let total_weight: f64 = items.iter().map(|i| i["totalWt"].as_f64().unwrap_or(0.0)).sum();
    let total_wages: f64 = items.iter().map(|i| i["wages"].as_f64().unwrap_or(0.0)).sum();

    // Store items count before consuming the vector
    let items_count = items.len();

    // Insert flour_out header
    let flour_out_id = db.execute(
        "INSERT INTO flour_out (s_no, date, papad_company, remarks, total_qty, total_weight, total_wages) VALUES (?, ?, ?, ?, ?, ?, ?)",
        &[&1, &date, &papad_company, &remarks, &total_qty, &total_weight, &total_wages],
    ).map_err(|e| e.to_string())?;

    // Process each item - convert grain lot to flour lot
    for item in items {
        let item_name = item["itemName"].as_str().unwrap_or("");
        let input_lot_no = item["lotNo"].as_str().unwrap_or("");
        let qty = item["qty"].as_f64().unwrap_or(0.0);
        let total_wt = item["totalWt"].as_f64().unwrap_or(0.0);
        let wages = item["wages"].as_f64().unwrap_or(0.0);
        
        // Deduct from grain lot
        if !input_lot_no.is_empty() {
            db.execute(
                "UPDATE stock_lots SET remaining_quantity = remaining_quantity - ? WHERE item_name = ? AND lot_no = ?",
                &[&qty, &item_name, &input_lot_no],
            ).map_err(|e| e.to_string())?;
            
            // Add grain deduction to stock
            db.execute(
                "INSERT INTO stock (item_name, lot_no, qty, weight, date, type, reference_id) VALUES (?, ?, ?, ?, ?, 'Grind', ?)",
                &[&item_name, &input_lot_no, &(-qty), &(-total_wt), &date, &flour_out_id],
            ).map_err(|e| e.to_string())?;
        }
        
        // FIXED: Use global sequential LOT001+ for ALL creations (output)
        let flour_item_name = format!("Flour - {}", item_name);
        let flour_lot_no = get_next_lot(state.clone()).map_err(|e| e.to_string())?;
        
        // Insert flour out item
        db.execute(
            "INSERT INTO flour_out_items (flour_out_id, item_name, lot_no, qty, total_wt, wages) VALUES (?, ?, ?, ?, ?, ?)",
            &[&flour_out_id, &item_name, &flour_lot_no, &qty, &total_wt, &wages],
        ).map_err(|e| e.to_string())?;
        
        // Add flour lot to stock_lots
        db.execute(
            "INSERT INTO stock_lots (item_name, lot_no, purchase_id, quantity, remaining_quantity, rate) VALUES (?, ?, ?, ?, ?, ?)",
            &[&flour_item_name, &flour_lot_no, &flour_out_id, &qty, &qty, &0.0],
        ).map_err(|e| e.to_string())?;
        
        // Add flour stock entry
        db.execute(
            "INSERT INTO stock (item_name, lot_no, qty, weight, date, type, reference_id) VALUES (?, ?, ?, ?, ?, 'Flour Out', ?)",
            &[&flour_item_name, &flour_lot_no, &qty, &total_wt, &date, &flour_out_id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(ExecuteResult {
        success: true,
        last_id: flour_out_id,
        changes: items_count,
        message: format!("Flour Out saved! {} grain lot(s) converted to flour lot(s)", items_count),
    })
}

// ==================== LEDGER ENTRIES ====================

#[tauri::command]
pub fn create_ledger_entry(
    state: State<AppState>,
    date: String,
    ledger_name: String,
    debit: f64,
    credit: f64,
    voucher_no: String,
    company_id: i64,
) -> Result<ExecuteResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let id = db.execute(
        "INSERT INTO ledger_entries (date, ledger_name, debit, credit, voucher_no, company_id) VALUES (?, ?, ?, ?, ?, ?)",
        &[&date, &ledger_name, &debit, &credit, &voucher_no, &company_id],
    ).map_err(|e| e.to_string())?;

    Ok(ExecuteResult {
        success: true,
        last_id: id,
        changes: 1,
        message: "Ledger entry created".to_string(),
    })
}

#[tauri::command]
pub fn get_ledger_balance(state: State<AppState>, company_id: i64) -> Result<QueryResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let sql = r#"
        SELECT 
            SUM(debit) as total_debit, 
            SUM(credit) as total_credit 
        FROM ledger_entries 
        WHERE company_id = ?
    "#;
    
    match db.query(sql, &[&company_id]) {
        Ok(rows) => Ok(QueryResult {
            success: true,
            data: rows,
            message: None,
        }),
        Err(e) => Ok(QueryResult {
            success: false,
            data: vec![],
            message: Some(e.to_string()),
        }),
    }
}

// ==================== MASTER CRUD COMMANDS ====================

// Table name mapping: frontend short names -> actual database table names
fn get_actual_table_name(table: &str) -> String {
    match table {
        // Master tables - short names to full names
        "items" => "item_master".to_string(),
        "senders" => "sender_group_master".to_string(),
        "consignees" => "consignee_group_master".to_string(),
        "customers" => "customer_master".to_string(),
        "suppliers" => "supplier_master".to_string(),
        "cities" => "city_master".to_string(),
        "areas" => "area_master".to_string(),
        "transports" => "transport_master".to_string(),
        "flour_mills" => "flour_mill_master".to_string(),
        "papad_companies" => "papad_company_master".to_string(),
        "ptrans" => "ptrans_master".to_string(),
        "ledgers" => "ledgermaster".to_string(),
        "ledger_groups" => "ledgergroupmaster".to_string(),
        "item_groups" => "item_groups".to_string(),
        "weights" => "weightmaster".to_string(),
        "deduction_sales" => "deduction_sales".to_string(),
        "deduction_purchase" => "deduction_purchase".to_string(),
        "godowns" => "godown_master".to_string(),
        // Entry tables
        "purchases" => "purchases".to_string(),

        "sales" => "sales".to_string(),
        "advances" => "advances".to_string(),
        "grains" => "grains".to_string(),
        "flour_out" => "flour_out".to_string(),
        "flour_out_returns" => "flour_out_returns".to_string(),
        "papad_in" => "papad_in".to_string(),
        "purchase_returns" => "purchase_returns".to_string(),
        "sales_returns" => "sales_returns".to_string(),
        "quotations" => "quotations".to_string(),
        "packing" => "packing".to_string(),
        "sales_export_orders" => "sales_export_orders".to_string(),
        "stock_adjust" => "stock_adjust".to_string(),
        "open_entries" => "open_entries".to_string(),
        "weight_conversion" => "weight_conversion".to_string(),
        "stock_lots" => "stock_lots".to_string(),
        "stock" => "stock".to_string(),
        // Default - use as-is
        _ => table.to_string(),
    }
}

// ==================== SPECIFIC MASTER CREATE WRAPPERS ====================
/* DEPRECATED WRAPPERS REMOVED - Use create_master(table, data) directly */

// Generic master get
#[tauri::command]
pub fn get_masters(state: State<AppState>, table: String, where_clause: Option<String>) -> Result<QueryResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Translate frontend table name to actual database table name
    let actual_table = get_actual_table_name(&table);
    
    // Log what we're querying
    println!("[get_masters] Requested table: '{}' -> Actual table: '{}'", table, actual_table);
    
    let sql = if let Some(where_str) = where_clause {
        format!("SELECT * FROM {} WHERE {}", actual_table, where_str)
    } else {
        format!("SELECT * FROM {}", actual_table)
    };
    
    match db.query(&sql, &[]) {
        Ok(rows) => Ok(QueryResult { success: true, data: rows, message: None }),
        Err(e) => {
            // Always return empty array in data field to prevent frontend crashes
            println!("[get_masters] Error on table '{}' (original: '{}'): {}", actual_table, table, e);
            Ok(QueryResult { success: false, data: vec![], message: Some(e.to_string()) })
        }
    }
}

// Generic master create
#[tauri::command]
pub fn create_master(
    state: State<AppState>,
    table: String,
    data: serde_json::Value
) -> Result<String, String> {

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // ✅ FIELD MAPPING
    let (field, value) = match table.as_str() {

        "item_master" => ("item_name", data["item_name"].as_str()),

        "flour_mill_master" => ("flourmill", data["flourmill"].as_str()),

        "item_groups" => ("group_name", data["group_name"].as_str()),

        "deduction_sales" | "deduction_purchase" => ("ded_name", data["ded_name"].as_str()),

        _ => ("name", data["name"].as_str()),
    };

    let name = value.unwrap_or("").trim();

    // ✅ VALIDATION
    if name.is_empty() {
        return Err(format!("{} is required", field));
    }

    // ✅ DUPLICATE CHECK
    let query = format!("SELECT COUNT(*) FROM {} WHERE {} = ?1", table, field);

    let exists: i64 = conn
        .query_row(&query, [name], |row| row.get(0))
        .unwrap_or(0);

    if exists > 0 {
        return Err(format!("'{}' already exists", name));
    }

    // ✅ INSERT
    if table == "item_master" {
        let mut stmt = conn.prepare("SELECT COALESCE(MAX(id),0)+1 FROM item_master").unwrap();
        let mut rows = stmt.query([]).unwrap();
        let next_id: i64 = rows.next().unwrap().unwrap().get(0).unwrap_or(1);
        let code = format!("ITM{:04}", next_id);

        conn.execute(
            "INSERT INTO item_master (item_code, item_name, status)
             VALUES (?1, ?2, 'Active')",
            [&code, name],
        ).map_err(|e| e.to_string())?;

    } else {
        let insert = format!(
            "INSERT INTO {} ({}, status) VALUES (?1, 'Active')",
            table, field
        );

        conn.execute(&insert, [name])
            .map_err(|e| e.to_string())?;
    }

    Ok("Saved successfully".into())
}

// Generic master update
#[tauri::command]
pub fn update_master(
    state: State<AppState>,
    table: String,
    id: i64,
    data: serde_json::Value,
) -> Result<ExecuteResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Translate frontend table name to actual database table name
    let actual_table = get_actual_table_name(&table);
    
    let mut set_clauses = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(obj) = data.as_object() {
        for (key, value) in obj {
            set_clauses.push(format!("{} = ?", key));
            match value {
                serde_json::Value::Null => params.push(Box::new(rusqlite::types::Null)),
                serde_json::Value::Bool(b) => params.push(Box::new(*b as i32)),
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        params.push(Box::new(i));
                    } else if let Some(f) = n.as_f64() {
                        params.push(Box::new(f));
                    } else {
                        params.push(Box::new(n.to_string()));
                    }
                }
                serde_json::Value::String(s) => params.push(Box::new(s.clone())),
                _ => params.push(Box::new(value.to_string())),
            }
        }
    }
    
    // Add id to params
    params.push(Box::new(id));
    
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let sql = format!(
        "UPDATE {} SET {} WHERE id = ?",
        actual_table,
        set_clauses.join(", ")
    );
    
    let changes = db.update(&sql, &param_refs).map_err(|e| e.to_string())?;
    
    Ok(ExecuteResult {
        success: true,
        last_id: id,
        changes,
        message: format!("{} updated successfully", table),
    })
}

// Generic master delete (soft delete)
#[tauri::command]
pub fn delete_master(
    state: State<AppState>,
    table: String,
    id: i64,
) -> Result<ExecuteResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let has_status = table == "area_master" || table == "city_master" || 
                     table == "customer_master" || table == "supplier_master" ||
                     table == "item_master" || table == "ledgermaster";
    
    let sql = if has_status {
        format!("UPDATE {} SET status = 'Inactive' WHERE id = ?", table)
    } else {
        format!("DELETE FROM {} WHERE id = ?", table)
    };
    
    let changes = db.update(&sql, &[&id]).map_err(|e| e.to_string())?;
    
    Ok(ExecuteResult {
        success: true,
        last_id: 0,
        changes,
        message: format!("{} deleted successfully", table),
    })
}

// ==================== COMPANY COMMANDS ====================

#[tauri::command]
pub fn get_companies(state: State<AppState>) -> Result<QueryResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Check if companies exist, if not create default
    let check_sql = "SELECT COUNT(*) as count FROM companies";
    let rows = db.query(check_sql, &[]).map_err(|e| e.to_string())?;
    
    let count = rows.first()
        .and_then(|r| r.get("count"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    
    // Auto-create default company and admin if none exist
    if count == 0 {
        println!("Auto-creating default company and admin...");
        
        // Create default company
        let company_id = db.execute(
            "INSERT INTO companies (name, address, contact) VALUES (?, ?, ?)",
            &[&"BVC Company", &"", &""],
        ).map_err(|e| e.to_string())?;
        
        // Create admin user (password: admin123)
        let admin_hash = hash("admin123", DEFAULT_COST).map_err(|e| e.to_string())?;
        db.execute(
            "INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)",
            &[&company_id, &"admin", &admin_hash, &"admin"],
        ).map_err(|e| e.to_string())?;
        
        println!("Default company and admin created!");
    }
    
    // Now get companies
    let sql = "SELECT * FROM companies ORDER BY name ASC";
    match db.query(sql, &[]) {
        Ok(rows) => Ok(QueryResult { success: true, data: rows, message: None }),
        Err(e) => Ok(QueryResult { success: false, data: vec![], message: Some(e.to_string()) }),
    }
}


#[tauri::command]
pub fn get_company(state: State<AppState>, id: i64) -> Result<QueryResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let sql = "SELECT * FROM companies WHERE id = ?";
    
    match db.query(sql, &[&id]) {
        Ok(rows) => Ok(QueryResult { success: true, data: rows, message: None }),
        Err(e) => Ok(QueryResult { success: false, data: vec![], message: Some(e.to_string()) }),
    }
}

#[tauri::command]
pub fn create_company(
    state: State<AppState>,
    companyName: String,
    address: String,
    gstNumber: String,
    contact: String,
    email: String,
) -> Result<ExecuteResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let id = db.execute(
        "INSERT INTO companies (name, address, gst_number, contact, email) VALUES (?, ?, ?, ?, ?)",
        &[&companyName, &address, &gstNumber, &contact, &email],
    ).map_err(|e| e.to_string())?;
    
    // Auto-create admin user for the new company
    let admin_hash = hash("admin123", DEFAULT_COST).map_err(|e| e.to_string())?;
    let user_result = db.execute(
        "INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)",
        &[&id, &"admin", &admin_hash, &"admin"],
    );
    
    match user_result {
        Ok(_) => Ok(ExecuteResult {
            success: true,
            last_id: id,
            changes: 1,
            message: "Company created successfully. Default login: admin / admin123".to_string(),
        }),
        Err(e) => {
            // Company was created, but user failed - still return success but warn
            Ok(ExecuteResult {
                success: true,
                last_id: id,
                changes: 1,
                message: format!("Company created but user creation failed: {}. Login with existing user.", e),
            })
        }
    }
}

#[tauri::command]
pub fn update_company(
    state: State<AppState>,
    id: i64,
    companyName: String,
    address: String,
    gstNumber: String,
    contact: String,
    email: String,
) -> Result<ExecuteResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let changes = db.update(
        "UPDATE companies SET name = ?, address = ?, gst_number = ?, contact = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        &[&companyName, &address, &gstNumber, &contact, &email, &id],
    ).map_err(|e| e.to_string())?;
    
    Ok(ExecuteResult {
        success: true,
        last_id: id,
        changes,
        message: "Company updated successfully".to_string(),
    })
}

#[tauri::command]
pub fn delete_company(state: State<AppState>, id: i64) -> Result<ExecuteResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let changes = db.update("DELETE FROM companies WHERE id = ?", &[&id])
        .map_err(|e| e.to_string())?;
    
    Ok(ExecuteResult {
        success: true,
        last_id: 0,
        changes,
        message: "Company deleted successfully".to_string(),
    })
}

// ==================== USER COMMANDS ====================

#[tauri::command]
pub fn create_user(
    state: State<AppState>,
    companyId: i64,
    username: String,
    password: String,
    role: String,
) -> Result<ExecuteResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Hash the password
    let password_hash = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;
    
    let id = db.execute(
        "INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)",
        &[&companyId, &username, &password_hash, &role],
    ).map_err(|e| e.to_string())?;
    
    Ok(ExecuteResult {
        success: true,
        last_id: id,
        changes: 1,
        message: "User created successfully".to_string(),
    })
}

#[tauri::command]
pub fn check_users_exist(state: State<AppState>, companyId: i64) -> Result<QueryResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let sql = "SELECT COUNT(*) as count FROM users WHERE company_id = ?";
    
    match db.query(sql, &[&companyId]) {
        Ok(rows) => Ok(QueryResult {
            success: true,
            data: rows,
            message: None,
        }),
        Err(e) => Ok(QueryResult {
            success: false,
            data: vec![],
            message: Some(e.to_string()),
        }),
    }
}
