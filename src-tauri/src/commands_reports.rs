use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::AppState;

// Response type for reports
#[derive(Serialize, Deserialize)]
pub struct ReportResult {
    pub success: bool,
    pub data: Vec<serde_json::Value>,
    pub message: Option<String>,
}

// ==================== Day Book Report ====================

#[tauri::command]
pub fn get_daybook_report(
    state: State<AppState>,
    _from_date: Option<String>,
    _to_date: Option<String>,
) -> Result<ReportResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let mut transactions: Vec<serde_json::Value> = Vec::new();
    
    // Get purchases
    let purchase_sql = "SELECT date, 'Purchase' as voucher_type, s_no as voucher_no, supplier as ledger_name, grand_total as debit, 0 as credit FROM purchases ORDER BY date";
    if let Ok(rows) = db.query(&purchase_sql, &[]) {
        transactions.extend(rows);
    }
    
    // Get sales
    let sales_sql = "SELECT date, 'Sale' as voucher_type, s_no as voucher_no, customer as ledger_name, 0 as debit, total_amt as credit FROM sales ORDER BY date";
    if let Ok(rows) = db.query(&sales_sql, &[]) {
        transactions.extend(rows);
    }
    
    // Get advances (payments)
    let advance_sql = "SELECT date, 'Payment' as voucher_type, s_no as voucher_no, COALESCE(papad_company, supplier, customer) as ledger_name, 0 as debit, amount as credit FROM advances ORDER BY date";
    if let Ok(rows) = db.query(&advance_sql, &[]) {
        transactions.extend(rows);
    }
    
    // Sort by date
    transactions.sort_by(|a, b| {
        let date_a = a.get("date").and_then(|v| v.as_str()).unwrap_or("");
        let date_b = b.get("date").and_then(|v| v.as_str()).unwrap_or("");
        date_a.cmp(date_b)
    });
    
    // Calculate running balance (not used currently)
    let mut _balance = 0.0;
    for t in &transactions {
        let debit = t.get("debit").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let credit = t.get("credit").and_then(|v| v.as_f64()).unwrap_or(0.0);
        _balance += debit - credit;
    }
    
    Ok(ReportResult {
        success: true,
        data: transactions,
        message: None,
    })
}

// ==================== Trial Balance Report ====================

#[derive(Serialize)]
pub struct TrialBalanceResult {
    pub success: bool,
    pub ledgers: Vec<serde_json::Value>,
    pub total_debit: f64,
    pub total_credit: f64,
    pub is_balanced: bool,
    pub message: Option<String>,
}

#[tauri::command]
pub fn get_trial_balance_report(
    state: State<AppState>,
    _from_date: Option<String>,
    _to_date: Option<String>,
) -> Result<TrialBalanceResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let mut ledgers: std::collections::HashMap<String, serde_json::Value> = std::collections::HashMap::new();
    
    let add_to_summary = |ledger_name: &str, debit: f64, credit: f64, ledgers: &mut std::collections::HashMap<String, serde_json::Value>| {
        let entry = ledgers.entry(ledger_name.to_string()).or_insert_with(|| {
            serde_json::json!({
                "ledger_name": ledger_name,
                "debit": 0.0,
                "credit": 0.0
            })
        });
        if let Some(obj) = entry.as_object_mut() {
            if let Some(d) = obj.get_mut("debit") {
                if let serde_json::Value::Number(ref mut n) = *d {
                    *n = serde_json::Number::from_f64(n.as_f64().unwrap_or(0.0) + debit).unwrap_or(n.clone());
                }
            }
            if let Some(c) = obj.get_mut("credit") {
                if let serde_json::Value::Number(ref mut n) = *c {
                    *n = serde_json::Number::from_f64(n.as_f64().unwrap_or(0.0) + credit).unwrap_or(n.clone());
                }
            }
        }
    };
    
    // Get purchases (suppliers - credit side)
    let purchase_sql = "SELECT supplier, SUM(grand_total) as total FROM purchases GROUP BY supplier";
    if let Ok(rows) = db.query(purchase_sql, &[]) {
        for row in rows {
            if let (Some(supplier), Some(total)) = (
                row.get("supplier").and_then(|v| v.as_str()),
                row.get("total").and_then(|v| v.as_f64())
            ) {
                if !supplier.is_empty() {
                    add_to_summary(supplier, 0.0, total, &mut ledgers);
                }
            }
        }
    }
    
    // Get sales (customers - debit side)
    let sales_sql = "SELECT customer, SUM(total_amt) as total FROM sales GROUP BY customer";
    if let Ok(rows) = db.query(sales_sql, &[]) {
        for row in rows {
            if let (Some(customer), Some(total)) = (
                row.get("customer").and_then(|v| v.as_str()),
                row.get("total").and_then(|v| v.as_f64())
            ) {
                if !customer.is_empty() {
                    add_to_summary(customer, total, 0.0, &mut ledgers);
                }
            }
        }
    }
    
    // Get advances (payments - debit side)
    let advance_sql = "SELECT COALESCE(papad_company, supplier) as name, SUM(amount) as total FROM advances GROUP BY COALESCE(papad_company, supplier)";
    if let Ok(rows) = db.query(advance_sql, &[]) {
        for row in rows {
            if let (Some(name), Some(total)) = (
                row.get("name").and_then(|v| v.as_str()),
                row.get("total").and_then(|v| v.as_f64())
            ) {
                if !name.is_empty() {
                    add_to_summary(name, total, 0.0, &mut ledgers);
                }
            }
        }
    }
    
    let ledgers_vec: Vec<serde_json::Value> = ledgers.into_values().collect();
    
    let total_debit: f64 = ledgers_vec.iter()
        .filter_map(|v| v.get("debit").and_then(|n| n.as_f64()))
        .sum();
    let total_credit: f64 = ledgers_vec.iter()
        .filter_map(|v| v.get("credit").and_then(|n| n.as_f64()))
        .sum();
    
    Ok(TrialBalanceResult {
        success: true,
        ledgers: ledgers_vec,
        total_debit,
        total_credit,
        is_balanced: (total_debit - total_credit).abs() < 0.01,
        message: None,
    })
}

// ==================== Profit & Loss Report ====================

#[derive(Serialize)]
pub struct ProfitLossResult {
    pub success: bool,
    pub sales: f64,
    pub sales_returns: f64,
    pub purchases: f64,
    pub purchase_returns: f64,
    pub gross_profit: f64,
    pub expenses: f64,
    pub net_profit: f64,
    pub is_profit: bool,
    pub message: Option<String>,
}

#[tauri::command]
pub fn get_profit_loss_report(
    state: State<AppState>,
    _from_date: Option<String>,
    _to_date: Option<String>,
) -> Result<ProfitLossResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Calculate Total Sales
    let sales_sql = "SELECT COALESCE(SUM(total_amt), 0) as total FROM sales";
    let total_sales: f64 = if let Ok(rows) = db.query(sales_sql, &[]) {
        rows.first().and_then(|r| r.get("total").and_then(|v| v.as_f64())).unwrap_or(0.0)
    } else { 0.0 };
    
    // Calculate Sales Returns
    let sr_sql = "SELECT COALESCE(SUM(total_amt), 0) as total FROM sales_return";
    let sales_returns: f64 = if let Ok(rows) = db.query(sr_sql, &[]) {
        rows.first().and_then(|r| r.get("total").and_then(|v| v.as_f64())).unwrap_or(0.0)
    } else { 0.0 };
    
    // Calculate Total Purchases
    let purchase_sql = "SELECT COALESCE(SUM(grand_total), 0) as total FROM purchases";
    let total_purchases: f64 = if let Ok(rows) = db.query(purchase_sql, &[]) {
        rows.first().and_then(|r| r.get("total").and_then(|v| v.as_f64())).unwrap_or(0.0)
    } else { 0.0 };
    
    // Calculate Purchase Returns
    let pr_sql = "SELECT COALESCE(SUM(grand_total), 0) as total FROM purchase_returns";
    let purchase_returns: f64 = if let Ok(rows) = db.query(pr_sql, &[]) {
        rows.first().and_then(|r| r.get("total").and_then(|v| v.as_f64())).unwrap_or(0.0)
    } else { 0.0 };
    
    // Calculate Closing Stock
    let stock_sql = "SELECT COALESCE(SUM(qty * rate), 0) as total FROM stock WHERE qty > 0";
    let closing_stock: f64 = if let Ok(rows) = db.query(stock_sql, &[]) {
        rows.first().and_then(|r| r.get("total").and_then(|v| v.as_f64())).unwrap_or(0.0)
    } else { 0.0 };
    
    // Calculate Expenses
    let expense_sql = "SELECT COALESCE(SUM(amount), 0) as total FROM advances";
    let expenses: f64 = if let Ok(rows) = db.query(expense_sql, &[]) {
        rows.first().and_then(|r| r.get("total").and_then(|v| v.as_f64())).unwrap_or(0.0)
    } else { 0.0 };
    
    let net_sales = total_sales - sales_returns;
    let net_purchases = total_purchases - purchase_returns;
    let gross_profit = net_sales - net_purchases + closing_stock;
    let net_profit = gross_profit - expenses;
    
    Ok(ProfitLossResult {
        success: true,
        sales: total_sales,
        sales_returns,
        purchases: total_purchases,
        purchase_returns,
        gross_profit,
        expenses,
        net_profit,
        is_profit: net_profit >= 0.0,
        message: None,
    })
}

// ==================== Outstanding Summary Report ====================

#[tauri::command]
pub fn get_outstanding_summary_report(
    state: State<AppState>,
    _as_on_date: Option<String>,
) -> Result<ReportResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let mut outstanding: Vec<serde_json::Value> = Vec::new();
    
    // Get supplier outstanding (payables)
    let supplier_sql = "SELECT supplier as ledger_name, SUM(grand_total) as total_purchase, 0 as total_payment FROM purchases GROUP BY supplier";
    if let Ok(rows) = db.query(supplier_sql, &[]) {
        for row in rows {
            if let (Some(name), Some(purchase)) = (
                row.get("ledger_name").and_then(|v| v.as_str()),
                row.get("total_purchase").and_then(|v| v.as_f64())
            ) {
                if !name.is_empty() && purchase > 0.0 {
                    outstanding.push(serde_json::json!({
                        "ledger_name": name,
                        "total_purchase": purchase,
                        "total_payment": 0.0,
                        "balance": purchase,
                        "type": "Payable"
                    }));
                }
            }
        }
    }
    
    // Get customer outstanding (receivables)
    let customer_sql = "SELECT customer as ledger_name, SUM(total_amt) as total_sales, 0 as total_receipt FROM sales GROUP BY customer";
    if let Ok(rows) = db.query(customer_sql, &[]) {
        for row in rows {
            if let (Some(name), Some(sales)) = (
                row.get("ledger_name").and_then(|v| v.as_str()),
                row.get("total_sales").and_then(|v| v.as_f64())
            ) {
                if !name.is_empty() && sales > 0.0 {
                    outstanding.push(serde_json::json!({
                        "ledger_name": name,
                        "total_sales": sales,
                        "total_receipt": 0.0,
                        "balance": sales,
                        "type": "Receivable"
                    }));
                }
            }
        }
    }
    
    Ok(ReportResult {
        success: true,
        data: outstanding,
        message: None,
    })
}

// ==================== Outstanding Details Report ====================

#[tauri::command]
pub fn get_outstanding_details_report(
    state: State<AppState>,
    _as_on_date: Option<String>,
) -> Result<ReportResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let mut details: Vec<serde_json::Value> = Vec::new();
    
    // Get pending purchase bills
    let purchase_sql = "SELECT supplier as ledger_name, inv_no as invoice_no, date, grand_total as amount, 'Payable' as type FROM purchases ORDER BY date DESC";
    if let Ok(rows) = db.query(purchase_sql, &[]) {
        for row in rows {
            details.push(serde_json::json!({
                "ledger_name": row.get("ledger_name").and_then(|v| v.as_str()).unwrap_or(""),
                "invoice_no": row.get("invoice_no").and_then(|v| v.as_str()).unwrap_or(""),
                "date": row.get("date").and_then(|v| v.as_str()).unwrap_or(""),
                "amount": row.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0),
                "type": "Payable"
            }));
        }
    }
    
    // Get pending sales bills
    let sales_sql = "SELECT customer as ledger_name, s_no as invoice_no, date, total_amt as amount, 'Receivable' as type FROM sales ORDER BY date DESC";
    if let Ok(rows) = db.query(sales_sql, &[]) {
        for row in rows {
            details.push(serde_json::json!({
                "ledger_name": row.get("ledger_name").and_then(|v| v.as_str()).unwrap_or(""),
                "invoice_no": row.get("invoice_no").and_then(|v| v.as_str()).unwrap_or(""),
                "date": row.get("date").and_then(|v| v.as_str()).unwrap_or(""),
                "amount": row.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0),
                "type": "Receivable"
            }));
        }
    }
    
    Ok(ReportResult {
        success: true,
        data: details,
        message: None,
    })
}

// ==================== Balance Sheet Report ====================

#[derive(Serialize)]
pub struct BalanceSheetResult {
    pub success: bool,
    pub stock_value: f64,
    pub cash_in_hand: f64,
    pub accounts_receivable: f64,
    pub total_assets: f64,
    pub accounts_payable: f64,
    pub total_liabilities: f64,
    pub capital: f64,
    pub is_balanced: bool,
    pub message: Option<String>,
}

#[tauri::command]
pub fn get_balance_sheet_report(
    state: State<AppState>,
    _as_on_date: Option<String>,
) -> Result<BalanceSheetResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Calculate Stock Value
    let stock_sql = "SELECT COALESCE(SUM(qty * rate), 0) as stock_value FROM stock WHERE qty > 0";
    let stock_value: f64 = if let Ok(rows) = db.query(stock_sql, &[]) {
        rows.first().and_then(|r| r.get("stock_value").and_then(|v| v.as_f64())).unwrap_or(0.0)
    } else { 0.0 };
    
    // Calculate Cash in Hand (from advances)
    let cash_sql = "SELECT COALESCE(SUM(amount), 0) as total_payments FROM advances";
    let cash_in_hand: f64 = if let Ok(rows) = db.query(cash_sql, &[]) {
        rows.first().and_then(|r| r.get("total_payments").and_then(|v| v.as_f64())).unwrap_or(0.0)
    } else { 0.0 };
    
    // Calculate Accounts Receivable (sales - advances)
    let sales_total: f64 = if let Ok(rows) = db.query("SELECT COALESCE(SUM(total_amt), 0) as total FROM sales", &[]) {
        rows.first().and_then(|r| r.get("total").and_then(|v| v.as_f64())).unwrap_or(0.0)
    } else { 0.0 };
    
    let accounts_receivable = sales_total;
    
    // Calculate Accounts Payable
    let payable_total: f64 = if let Ok(rows) = db.query("SELECT COALESCE(SUM(grand_total), 0) as total FROM purchases", &[]) {
        rows.first().and_then(|r| r.get("total").and_then(|v| v.as_f64())).unwrap_or(0.0)
    } else { 0.0 };
    
    let accounts_payable = payable_total;
    
    let total_assets = stock_value + cash_in_hand + accounts_receivable;
    let total_liabilities = accounts_payable;
    let capital = total_assets - total_liabilities;
    
    Ok(BalanceSheetResult {
        success: true,
        stock_value,
        cash_in_hand,
        accounts_receivable,
        total_assets,
        accounts_payable,
        total_liabilities,
        capital,
        is_balanced: true,
        message: None,
    })
}

// ==================== Stock Status Report ====================

#[tauri::command]
pub fn get_stock_status_report(
    state: State<AppState>,
    _item_id: Option<i64>,
    _from_date: Option<String>,
    _to_date: Option<String>,
) -> Result<ReportResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let sql = "SELECT item_name, SUM(CASE WHEN qty > 0 THEN qty ELSE 0 END) as total_purchased, SUM(CASE WHEN qty < 0 THEN ABS(qty) ELSE 0 END) as total_sold, SUM(qty) as current_balance FROM stock GROUP BY item_name ORDER BY item_name";
    
    let result = db.query(sql, &[]).map_err(|e| e.to_string())?;
    
    Ok(ReportResult {
        success: true,
        data: result,
        message: None,
    })
}

// ==================== Purchase Register Report ====================

#[tauri::command]
pub fn get_purchase_register_report(
    state: State<AppState>,
    _supplier_id: Option<i64>,
    _from_date: Option<String>,
    _to_date: Option<String>,
) -> Result<ReportResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let sql = "SELECT date, s_no as bill_no, supplier, total_amt as amount FROM purchases ORDER BY date DESC";
    
    let result = db.query(sql, &[]).map_err(|e| e.to_string())?;
    
    Ok(ReportResult {
        success: true,
        data: result,
        message: None,
    })
}

// ==================== Sales Register Report ====================

#[tauri::command]
pub fn get_sales_register_report(
    state: State<AppState>,
    _customer_id: Option<i64>,
    _from_date: Option<String>,
    _to_date: Option<String>,
) -> Result<ReportResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let sql = "SELECT date, s_no as invoice_no, customer, total_amt as amount FROM sales ORDER BY date DESC";
    
    let result = db.query(sql, &[]).map_err(|e| e.to_string())?;
    
    Ok(ReportResult {
        success: true,
        data: result,
        message: None,
    })
}

// ==================== Papad Ledger Report ====================

#[tauri::command]
pub fn get_papad_ledger_report(
    state: State<AppState>,
    _from_date: Option<String>,
    _to_date: Option<String>,
) -> Result<ReportResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let sql = "SELECT a.date, a.s_no as voucher_no, pc.name as particulars, 'Payment' as type, a.amount as credit, 0 as debit FROM advances a LEFT JOIN papadcompany_master pc ON a.papad_company = pc.name ORDER BY a.date DESC";
    
    let result = db.query(sql, &[]).map_err(|e| e.to_string())?;
    
    Ok(ReportResult {
        success: true,
        data: result,
        message: None,
    })
}

// ==================== Ledger Statement Report ====================

#[tauri::command]
pub fn get_ledger_statement_report(
    state: State<AppState>,
    ledger_name: String,
    _from_date: Option<String>,
    _to_date: Option<String>,
) -> Result<ReportResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let mut transactions: Vec<serde_json::Value> = Vec::new();
    
    // Get purchases for this ledger
    let purchase_sql = format!(
        "SELECT date, 'Purchase' as voucher_type, inv_no as voucher_no, 'By Purchase' as particulars, grand_total as debit, 0 as credit FROM purchases WHERE supplier = '{}' ORDER BY date",
        ledger_name
    );
    if let Ok(rows) = db.query(&purchase_sql, &[]) {
        transactions.extend(rows);
    }
    
    // Get advances for this ledger
    let advance_sql = format!(
        "SELECT date, 'Payment' as voucher_type, s_no as voucher_no, 'By Payment' as particulars, 0 as debit, amount as credit FROM advances WHERE papad_company = '{}' OR supplier = '{}' ORDER BY date",
        ledger_name, ledger_name
    );
    if let Ok(rows) = db.query(&advance_sql, &[]) {
        transactions.extend(rows);
    }
    
    // Sort by date
    transactions.sort_by(|a, b| {
        let date_a = a.get("date").and_then(|v| v.as_str()).unwrap_or("");
        let date_b = b.get("date").and_then(|v| v.as_str()).unwrap_or("");
        date_a.cmp(date_b)
    });
    
    Ok(ReportResult {
        success: true,
        data: transactions,
        message: None,
    })
}
