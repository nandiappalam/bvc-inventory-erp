const db = require('./database');

async function initPhases14To18Tables() {
  try {
    // 1. Compliance Schedules (Phase 14)
    await db.run(`
      CREATE TABLE IF NOT EXISTS compliance_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_code TEXT UNIQUE NOT NULL,
        task_name TEXT NOT NULL,
        task_type TEXT NOT NULL,
        module TEXT NOT NULL,
        frequency TEXT NOT NULL,
        responsible_dept TEXT,
        assigned_to TEXT,
        priority TEXT DEFAULT 'Medium',
        is_active INTEGER DEFAULT 1,
        company_id INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Compliance Tasks (Phase 14)
    await db.run(`
      CREATE TABLE IF NOT EXISTS compliance_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_code TEXT UNIQUE NOT NULL,
        task_name TEXT NOT NULL,
        task_type TEXT NOT NULL,
        module TEXT NOT NULL,
        frequency TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        assigned_to TEXT,
        priority TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'Scheduled',
        completed_at DATETIME,
        completed_by TEXT,
        approved_at DATETIME,
        approved_by TEXT,
        remarks TEXT,
        attachment TEXT,
        company_id INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Compliance Audit Trail (Phase 14)
    await db.run(`
      CREATE TABLE IF NOT EXISTS compliance_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        action TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Customer Complaints (Phase 15)
    await db.run(`
      CREATE TABLE IF NOT EXISTS customer_complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_no TEXT UNIQUE NOT NULL,
        complaint_date TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        invoice_no TEXT,
        sales_order_no TEXT,
        product_name TEXT NOT NULL,
        lot_no TEXT NOT NULL,
        qty_affected REAL DEFAULT 0,
        complaint_type TEXT NOT NULL,
        description TEXT,
        severity TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'Registered',
        received_by TEXT,
        company_id INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Complaint Investigations & CAPA (Phase 15)
    await db.run(`
      CREATE TABLE IF NOT EXISTS complaint_investigations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER NOT NULL,
        lot_no TEXT NOT NULL,
        qc_findings TEXT,
        production_findings TEXT,
        supplier_findings TEXT,
        root_cause TEXT,
        immediate_correction TEXT,
        corrective_action TEXT,
        preventive_action TEXT,
        responsible_person TEXT,
        target_date TEXT,
        completion_date TEXT,
        capa_status TEXT DEFAULT 'Open',
        verified_by TEXT,
        effectiveness TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (complaint_id) REFERENCES customer_complaints(id) ON DELETE CASCADE
      )
    `);

    // 6. Recalls (Phase 16)
    await db.run(`
      CREATE TABLE IF NOT EXISTS recalls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recall_no TEXT UNIQUE NOT NULL,
        recall_date TEXT NOT NULL,
        product_name TEXT NOT NULL,
        lot_no TEXT NOT NULL,
        reason TEXT NOT NULL,
        severity TEXT DEFAULT 'HIGH',
        status TEXT DEFAULT 'INITIATED',
        created_by TEXT DEFAULT 'Quality Manager',
        company_id INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Recall Lots (Phase 16)
    await db.run(`
      CREATE TABLE IF NOT EXISTS recall_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recall_id INTEGER NOT NULL,
        lot_no TEXT NOT NULL,
        produced_qty_kg REAL DEFAULT 0,
        current_stock_kg REAL DEFAULT 0,
        sold_qty_kg REAL DEFAULT 0,
        returned_qty_kg REAL DEFAULT 0,
        quarantined_qty_kg REAL DEFAULT 0,
        disposed_qty_kg REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recall_id) REFERENCES recalls(id) ON DELETE CASCADE
      )
    `);

    // 8. Recall Customers (Phase 16)
    await db.run(`
      CREATE TABLE IF NOT EXISTS recall_customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recall_id INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        invoice_no TEXT,
        lot_no TEXT NOT NULL,
        supplied_qty_kg REAL NOT NULL,
        contact_info TEXT,
        recall_status TEXT DEFAULT 'NOTIFIED',
        recovered_qty_kg REAL DEFAULT 0,
        credit_note_no TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recall_id) REFERENCES recalls(id) ON DELETE CASCADE
      )
    `);

    // 9. AI Predictions & Intelligence Observations (Phase 18)
    await db.run(`
      CREATE TABLE IF NOT EXISTS ai_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_type TEXT NOT NULL,
        target_entity TEXT NOT NULL,
        input_params_json TEXT,
        prediction_output_json TEXT,
        confidence_score REAL DEFAULT 0.85,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Remove legacy example/dummy data
    try {
      await db.run("DELETE FROM customer_complaints WHERE complaint_no IN ('CMP-2026-001', 'CMP-2026-002', 'CMP-2026-003')");
      await db.run("DELETE FROM recalls WHERE recall_no = 'RCL-2026-001'");
      await db.run("DELETE FROM compliance_tasks WHERE task_code IN ('TSK-1001', 'TSK-1002', 'TSK-1003', 'TSK-1004', 'TSK-1005', 'TSK-1006')");
    } catch (e) {}

    console.log('✅ Phases 14–18 Database Schemas Verified (clean without sample data)');
  } catch (err) {
    console.error('Error initializing Phases 14-18 tables:', err);
  }
}

module.exports = { initPhases14To18Tables };
