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

    await db.run(`
      CREATE TABLE IF NOT EXISTS customer_complaint_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER NOT NULL,
        original_sales_id INTEGER,
        original_sales_item_id INTEGER,
        item_id INTEGER,
        item_name TEXT NOT NULL,
        product_code TEXT,
        lot_no TEXT,
        mfg_date TEXT,
        exp_date TEXT,
        uom TEXT DEFAULT 'Bags',
        weight_per_unit REAL DEFAULT 50,
        invoice_qty REAL DEFAULT 0,
        complaint_qty REAL DEFAULT 0,
        complaint_weight REAL DEFAULT 0,
        issue_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS capa_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        capa_no TEXT UNIQUE NOT NULL,
        capa_date TEXT NOT NULL,
        capa_source TEXT DEFAULT 'Customer Complaint',
        complaint_id INTEGER,
        complaint_no TEXT,
        sales_return_id INTEGER,
        sales_return_no TEXT,
        original_sales_id INTEGER,
        original_invoice_no TEXT,
        customer_id INTEGER,
        customer_name TEXT,
        customer_complaint_ref TEXT,
        reported_problem TEXT,
        complaint_category TEXT,
        complaint_date TEXT,
        affected_condition TEXT,
        evidence_json TEXT DEFAULT '[]',
        customer_communication TEXT,
        investigation_findings TEXT,
        qc_inspection_results TEXT,
        batch_traceability_json TEXT DEFAULT '[]',
        identified_root_cause TEXT,
        rca_method TEXT DEFAULT '5 Why',
        rca_details TEXT,
        immediate_containment TEXT,
        existing_problem_correction TEXT,
        corrective_action_desc TEXT,
        corrective_dept TEXT,
        corrective_person TEXT,
        corrective_target_date TEXT,
        corrective_completion_date TEXT,
        corrective_evidence TEXT,
        corrective_status TEXT DEFAULT 'Pending',
        preventive_action_desc TEXT,
        process_improvement TEXT,
        training_required INTEGER DEFAULT 0,
        training_details TEXT,
        inspection_testing_improvement TEXT,
        preventive_person TEXT,
        preventive_target_date TEXT,
        preventive_completion_date TEXT,
        preventive_status TEXT DEFAULT 'Pending',
        verification_method TEXT,
        verification_date TEXT,
        followup_inspection_results TEXT,
        effectiveness_evidence TEXT,
        effectiveness_status TEXT DEFAULT 'Pending',
        further_action_required INTEGER DEFAULT 0,
        further_action_notes TEXT,
        capa_status TEXT DEFAULT 'Open',
        prepared_by TEXT,
        quality_manager TEXT,
        production_manager TEXT,
        approved_by TEXT,
        approved_at TEXT,
        closure_date TEXT,
        final_remarks TEXT,
        waived_verification INTEGER DEFAULT 0,
        waiver_reason TEXT,
        waived_by TEXT,
        company_id INTEGER DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS capa_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        capa_id INTEGER NOT NULL,
        complaint_item_id INTEGER,
        sales_return_item_id INTEGER,
        item_id INTEGER,
        product_name TEXT NOT NULL,
        product_code TEXT,
        lot_no TEXT,
        mfg_date TEXT,
        exp_date TEXT,
        invoice_qty REAL DEFAULT 0,
        complaint_qty REAL DEFAULT 0,
        returned_qty REAL DEFAULT 0,
        uom TEXT DEFAULT 'Bags',
        batch_no TEXT,
        rm_lot_nos TEXT,
        qc_summary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS capa_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        capa_id INTEGER NOT NULL,
        capa_no TEXT,
        action TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        performed_by TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
