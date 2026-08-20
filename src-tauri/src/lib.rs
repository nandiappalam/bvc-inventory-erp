mod commands;
mod commands_reports;
mod database;
mod models;
use models::SaleInput;
use std::sync::Mutex;
use tauri::Manager;

pub fn main() {
    // Print startup message
    println!("===========================================");
    println!("Starting BVC ERP Application...");
    println!("===========================================");
    
    // Get the database path - use app data directory for production
    let db_path = database::get_db_path();
    println!("Database path: {}", db_path);
    
    // Try to initialize database with proper error handling
    let db = match database::Database::new(&db_path) {
        Ok(database) => {
            println!("Database initialized successfully!");
            database
        }
        Err(e) => {
            eprintln!("===========================================");
            eprintln!("FATAL: Failed to initialize database!");
            eprintln!("===========================================");
            eprintln!("Error: {}", e);
            eprintln!("");
            eprintln!("Possible causes:");
            eprintln!("1. Database directory doesn't exist");
            eprintln!("2. No write permissions to AppData folder");
            eprintln!("3. Database file is corrupted");
            eprintln!("");
            eprintln!("Please check:");
            eprintln!("- The database path: {}", db_path);
            eprintln!("- Ensure you have write permissions");
            eprintln!("- Try running as Administrator");
            eprintln!("===========================================");
            std::process::exit(1);
        }
    };
    
    println!("Building Tauri application...");
    
    // Create AppState with the database
    let app_state = commands::AppState { db: Mutex::new(db) };
    
    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Generic commands
            commands::health_check,
            commands::get_db_path,
            commands::execute_query,
            commands::execute_statement,
            // Auth
            commands::login,
            commands::seed_default_data,
            // Lot & Stock commands (with auto-generation)
            commands::get_available_lots,
            commands::get_stock_summary,
            commands::create_purchase_with_lots,
            commands::create_sale_with_lots,
            commands::create_flour_out,
            // Ledger
            commands::create_ledger_entry,
            commands::get_ledger_balance,
            // Generic Master CRUD
            commands::get_masters,
            commands::create_master,
            commands::update_master,
            commands::delete_master,
            // Company commands
            commands::get_companies,
            commands::get_company,
            commands::create_company,
            commands::update_company,
            commands::delete_company,
            // User commands
            commands::create_user,
            commands::check_users_exist,
            // Reports
            commands_reports::get_daybook_report,
            commands_reports::get_trial_balance_report,
            commands_reports::get_profit_loss_report,
            commands_reports::get_outstanding_summary_report,
            commands_reports::get_outstanding_details_report,
            commands_reports::get_balance_sheet_report,
            commands_reports::get_stock_status_report,
            commands_reports::get_purchase_register_report,
            commands_reports::get_sales_register_report,
            commands_reports::get_papad_ledger_report,
            commands_reports::get_ledger_statement_report,
            commands::get_next_lot,
            commands::get_available_lots,
        ])

        .setup(|app| {
            std::panic::set_hook(Box::new(|info| {
                eprintln!("===========================================");
                eprintln!("Application panic detected!");
                eprintln!("===========================================");
                eprintln!("Error info: {:?}", info);
                eprintln!("");
                eprintln!("Please check the error above and try:");
                eprintln!("1. Restarting the application");
                eprintln!("2. Checking database integrity");
                eprintln!("3. Looking at console for more details");
                eprintln!("===========================================");
            }));
            
            // Auto-seed default data if no companies exist
            let app_state = app.state::<commands::AppState>();
            if let Ok(db) = app_state.db.lock() {
                let check_sql = "SELECT COUNT(*) as count FROM companies";
                match db.query(check_sql, &[]) {
                    Ok(rows) => {
                        if let Some(row) = rows.first() {
                            let count = row.get("count").and_then(|v| v.as_i64()).unwrap_or(0);
                            if count == 0 {
                                println!("No companies found. Creating default company and admin user...");
                                
                                // Create default company and get the actual inserted ID
                                let company_id = db.execute(
                                    "INSERT INTO companies (name, address, contact) VALUES (?, ?, ?)",
                                    &[&"BVC Company", &"", &""],
                                );
                                
                                match company_id {
                                    Ok(actual_company_id) => {
                                        // Create admin user with hashed password
                                        use bcrypt::{hash, DEFAULT_COST};
                                        let admin_hash = hash("admin123", DEFAULT_COST).unwrap_or_default();
                                        let _ = db.execute(
                                            "INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)",
                                            &[&actual_company_id, &"admin", &admin_hash, &"admin"],
                                        );
                                        
                                        println!("Default company (ID: {}) and admin user created!", actual_company_id);
                                        println!("Login: admin / admin123");
                                    }
                                    Err(e) => {
                                        eprintln!("Error creating default company: {}", e);
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Warning: Could not check for existing companies: {}", e);
                    }
                }
            }
            
            println!("===========================================");
            println!("BVC Purchase Management System started successfully!");
            println!("Window should appear shortly...");
            println!("===========================================");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

