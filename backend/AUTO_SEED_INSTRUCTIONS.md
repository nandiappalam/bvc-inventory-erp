/**
 * AUTO-SEED DEFAULT USER - Instructions
 * 
 * This file contains the changes needed to auto-create admin user on first run.
 * 
 * ============================================
 * FILE 1: src-tauri/src/main.rs
 * ============================================
 * 
 * Add this at the start of your main() function to auto-create admin user:
 */

#![allow(unused)]
use std::sync::Mutex;
use tauri::Manager;

// Add this struct for app state
pub struct AppState {
    pub db: Mutex<Database>,
}

fn main() {
    // Add this at the beginning of main(), before tauri::Builder
    println!("Initializing BVC ERP...");
    
    tauri::Builder::default()
        .setup(|app| {
            // Auto-seed default data on first run
            let state = app.state::<AppState>();
            let db = state.db.lock().unwrap();
            
            // Check if admin exists, if not create default
            let check_sql = "SELECT COUNT(*) as count FROM users";
            if let Ok(rows) = db.query(check_sql, &[]) {
                if let Some(row) = rows.first() {
                    let count = row.get("count").and_then(|v| v.as_i64()).unwrap_or(0);
                    if count == 0 {
                        println!("First run - creating default admin user...");
                        // Create default company
                        let _ = db.execute(
                            "INSERT INTO companies (name, address, contact) VALUES (?, ?, ?)",
                            &["BVC Company", "", ""],
                        );
                        // Create default admin (password: admin123)
                        // Note: Use bcrypt hash in production
                        let _ = db.execute(
                            "INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)",
                            &[&1, &"admin", &"$2a$10$123456789012345678901234567890123456789012345678901234567890", &"admin"],
                        );
                        println!("Default admin created!");
                    }
                }
            }
            Ok(())
        })
        // ... rest of your code
}

/**
 * ============================================
 * SIMPLER APPROACH - Modify get_companies
 * ============================================
 * 
 * Instead of modifying main.rs, modify the get_companies command in commands.rs
 * to auto-create default company + admin if none exist:
 */

/*
#[tauri::command]
pub fn get_companies(state: State<AppState>) -> Result<QueryResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Check if companies exist
    let check_sql = "SELECT COUNT(*) as count FROM companies";
    let rows = db.query(check_sql, &[]).map_err(|e| e.to_string())?;
    
    let count = rows.first()
        .and_then(|r| r.get("count"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    
    // Auto-create default if none exist
    if count == 0 {
        println!("Auto-creating default company and admin...");
        
        // Create default company
        db.execute(
            "INSERT INTO companies (name, address, contact) VALUES (?, ?, ?)",
            &["BVC Company", "", ""],
        ).map_err(|e| e.to_string())?;
        
        // Create admin user (password: admin123 hashed with bcrypt)
        // Hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
        db.execute(
            "INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)",
            &[&1, &"admin", &"$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", &"admin"],
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
*/
