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

    // SEED INITIAL DATA FOR PHASES 14-18 IF EMPTY
    const scheduleCount = await db.query('SELECT COUNT(*) as cnt FROM compliance_schedules');
    if (parseInt(scheduleCount.rows[0]?.cnt || 0, 10) === 0) {
      // 1. Seed Compliance Schedules
      await db.run(`
        INSERT INTO compliance_schedules (schedule_code, task_name, task_type, module, frequency, responsible_dept, assigned_to, priority)
        VALUES 
          ('SCH-001', 'Machine & Mill Deep Cleaning', 'CLEANING', 'Production', 'Daily', 'Production', 'Production Operator A', 'High'),
          ('SCH-002', 'Godown & Warehouse Sanitization', 'CLEANING', 'Warehouse', 'Daily', 'Warehouse', 'Warehouse Supervisor', 'Medium'),
          ('SCH-003', 'Pest Control Chemical Spray & Audit', 'PEST_CONTROL', 'Admin', 'Monthly', 'Admin', 'Pest Control Lead', 'High'),
          ('SCH-004', 'Moisture & Weighbridge Calibration', 'CALIBRATION', 'QC', 'Quarterly', 'QC', 'QC Technician 1', 'Critical'),
          ('SCH-005', 'Water Tank & Food Safety Inspection', 'INSPECTION', 'QC', 'Monthly', 'QC', 'Food Safety Inspector', 'High'),
          ('SCH-006', 'Fire Safety & Cold Storage Temp Check', 'SAFETY', 'Maintenance', 'Weekly', 'Maintenance', 'Safety Officer', 'Medium')
      `);

      // 2. Seed Compliance Tasks
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const next3Days = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
      const past3Days = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];

      await db.run(`
        INSERT INTO compliance_tasks (task_code, task_name, task_type, module, frequency, scheduled_date, due_date, assigned_to, priority, status, completed_at, completed_by, approved_at, approved_by, remarks)
        VALUES 
          ('TSK-1001', 'Machine & Mill Deep Cleaning', 'CLEANING', 'Production', 'Daily', ?, ?, 'Production Operator A', 'High', 'Approved', ?, 'Production Lead', ?, 'Super Lead', 'Cleaned main grinding rollers and sieve filters.'),
          ('TSK-1002', 'Godown & Warehouse Sanitization', 'CLEANING', 'Warehouse', 'Daily', ?, ?, 'Warehouse Supervisor', 'Medium', 'Completed', ?, 'Warehouse Supervisor', NULL, NULL, 'Completed floor sweep and pallet spacing.'),
          ('TSK-1003', 'Pest Control Chemical Spray & Audit', 'PEST_CONTROL', 'Admin', 'Monthly', ?, ?, 'Pest Control Lead', 'High', 'Pending Approval', NULL, NULL, NULL, NULL, 'Spraying completed for Zone A & Zone B.'),
          ('TSK-1004', 'Moisture & Weighbridge Calibration', 'CALIBRATION', 'QC', 'Quarterly', ?, ?, 'QC Technician 1', 'Critical', 'Overdue', NULL, NULL, NULL, NULL, 'Awaiting external lab calibration standards.'),
          ('TSK-1005', 'Water Tank & Food Safety Inspection', 'INSPECTION', 'QC', 'Monthly', ?, ?, 'Food Safety Inspector', 'High', 'In Progress', NULL, NULL, NULL, NULL, 'Water sample submitted for lab analysis.'),
          ('TSK-1006', 'Fire Safety & Cold Storage Temp Check', 'SAFETY', 'Maintenance', 'Weekly', ?, ?, 'Safety Officer', 'Medium', 'Scheduled', NULL, NULL, NULL, NULL, 'Scheduled for routine check.')
      `, [yesterday, yesterday, yesterday, yesterday, today, today, today, today, past3Days, past3Days, today, today, next3Days, next3Days]);

      // 3. Seed Customer Complaints
      await db.run(`
        INSERT INTO customer_complaints (complaint_no, complaint_date, customer_name, invoice_no, sales_order_no, product_name, lot_no, qty_affected, complaint_type, description, severity, status, received_by)
        VALUES 
          ('CMP-2026-001', ?, 'Apex Agro Industries', 'INV-1042', 'SO-801', 'Urad Dal Premium 30kg', 'LOT000245', 150, 'Moisture', 'Elevated moisture level detected during customer QA test (14.2% vs standard 12.0%).', 'High', 'CAPA Assigned', 'Customer Support'),
          ('CMP-2026-002', ?, 'Standard Food Distributors', 'INV-1038', 'SO-794', 'Moong Flour Fine 25kg', 'LOT000210', 50, 'Packaging', 'Bags delivered with torn outer seams leading to minor leakage.', 'Medium', 'Under Investigation', 'Logistics Officer'),
          ('CMP-2026-003', ?, 'Royal Supermarkets Ltd', 'INV-1015', 'SO-760', 'Chana Dal Super 50kg', 'LOT000185', 200, 'Foreign Material', 'Minor dust residue reported in bulk sack lot.', 'Low', 'Resolved', 'Quality Auditor')
      `, [past3Days, yesterday, '2026-09-01']);

      // 4. Seed Complaint Investigations
      const cmp1 = await db.query("SELECT id FROM customer_complaints WHERE complaint_no = 'CMP-2026-001'");
      if (cmp1.rows[0]?.id) {
        await db.run(`
          INSERT INTO complaint_investigations (complaint_id, lot_no, qc_findings, production_findings, supplier_findings, root_cause, immediate_correction, corrective_action, preventive_action, responsible_person, target_date, capa_status)
          VALUES 
            (?, 'LOT000245', 'Lab test confirmed moisture content of 14.1% on retention sample.', 'Milling dryer temperature dropped from 65C to 52C during batch run.', 'Raw grain supplier purchase lot LOT-RAW-992 had normal initial moisture of 11.8%.', 'Dryer heating coil malfunction during final milling stage.', 'Quarantined remaining 800 KG stock of LOT000245 in Chamber 2.', 'Re-dry affected lot under controlled 65C air recirculation and re-test.', 'Install automated digital temperature logger with real-time audio alert on milling dryer.', 'Production Supervisor', ?, 'Action Assigned')
        `, [cmp1.rows[0].id, next3Days]);
      }

      // 5. Seed Recall Record
      await db.run(`
        INSERT INTO recalls (recall_no, recall_date, product_name, lot_no, reason, severity, status, created_by)
        VALUES 
          ('RCL-2026-001', ?, 'Urad Dal Premium 30kg', 'LOT000245', 'Elevated moisture exceeding safety spec causing potential storage spoilage.', 'HIGH', 'CUSTOMER_NOTIFIED', 'Quality Manager')
      `, [yesterday]);

      const rcl1 = await db.query("SELECT id FROM recalls WHERE recall_no = 'RCL-2026-001'");
      if (rcl1.rows[0]?.id) {
        const recallId = rcl1.rows[0].id;
        await db.run(`
          INSERT INTO recall_lots (recall_id, lot_no, produced_qty_kg, current_stock_kg, sold_qty_kg, returned_qty_kg, quarantined_qty_kg, disposed_qty_kg)
          VALUES 
            (?, 'LOT000245', 5000, 800, 4000, 200, 800, 0)
        `, [recallId]);

        await db.run(`
          INSERT INTO recall_customers (recall_id, customer_name, invoice_no, lot_no, supplied_qty_kg, contact_info, recall_status, recovered_qty_kg, credit_note_no)
          VALUES 
            (?, 'Apex Agro Industries', 'INV-1042', 'LOT000245', 1500, '+91 9876543210', 'RECOVERED', 1500, 'CN-2026-881'),
            (?, 'Standard Food Distributors', 'INV-1043', 'LOT000245', 1500, '+91 9876543211', 'PARTIAL_RECOVERED', 1000, 'CN-2026-882'),
            (?, 'Royal Supermarkets Ltd', 'INV-1044', 'LOT000245', 1000, '+91 9876543212', 'NOTIFIED', 0, NULL)
        `, [recallId, recallId, recallId]);
      }
    }

    console.log('✅ Phases 14–18 Database Schemas Verified & Seeded Successfully');
  } catch (err) {
    console.error('Error initializing Phases 14-18 tables:', err);
  }
}

module.exports = { initPhases14To18Tables };
