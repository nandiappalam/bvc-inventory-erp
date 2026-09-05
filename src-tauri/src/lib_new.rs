mod commands;
mod database;

use commands::AppState;
use std::sync::Mutex;
use tauri::Manager;

pub fn main() {
    let db = database::Database::new().expect("Failed to initialize database");
    
    tauri::Builder::default()
        .manage(Mutex::new(db))
        .invoke_handler(tauri::generate_handler![
            commands::health_check,
            commands::get_db_path,
            commands::execute_query,
            commands::execute_statement,
            commands::get_purchases,
            commands::create_purchase,
            commands::update_purchase,
            commands::delete_purchase,
            commands::get_sales,
            commands::create_sale,
            commands::update_sale,
            commands::delete_sale,
            commands::get_customers,
            commands::create_customer,
            commands::update_customer,
            commands::delete_customer,
            commands::get_suppliers,
            commands::create_supplier,
            commands::update_supplier,
            commands::delete_supplier,
            commands::get_items,
            commands::create_item,
            commands::update_item,
            commands::delete_item,
            commands::login,
            commands::create_user,
        ])
        .setup(|_app| {
            std::panic::set_hook(Box::new(|info| {
                eprintln!("Application panic: {:?}", info);
            }));
            println!("BVC Purchase Management System started successfully");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
