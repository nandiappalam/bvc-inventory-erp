const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ============================================================================
// INITIALIZE DATABASE TABLES FOR QUALITY & COMPLIANCE
// ============================================================================
async function initComplianceTables() {
  try {
    // 1. Controlled Documents (D1 to D11)
    await db.run(`
      CREATE TABLE IF NOT EXISTS compliance_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_code TEXT NOT NULL, -- D1 to D11 or Custom
        doc_type TEXT NOT NULL, -- WORK_INSTRUCTION, HAZARD_PLAN, MTR_SPEC, TRAINING, SOP, RCCA, MEDICAL, FOSTAC, RECALL, HALAL, PROCESS_FLOW
        doc_number TEXT NOT NULL,
        title TEXT NOT NULL,
        department TEXT,
        process_stage TEXT,
        version TEXT DEFAULT '1.0',
        status TEXT DEFAULT 'APPROVED', -- DRAFT, UNDER_REVIEW, APPROVED, OBSOLETE
        effective_date TEXT,
        review_date TEXT,
        prepared_by TEXT,
        approved_by TEXT,
        verified_by TEXT,
        item_id INTEGER,
        item_name TEXT,
        item_group TEXT,
        lot_no TEXT,
        supplier_id INTEGER,
        supplier_name TEXT,
        employee_id INTEGER,
        employee_name TEXT,
        details_json TEXT, -- JSON for specialized fields (hazards, parameters, steps, 5-why, recall data, etc.)
        remarks TEXT,
        attachment_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Production Compliance Records (P1 to P8)
    await db.run(`
      CREATE TABLE IF NOT EXISTS compliance_production_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_code TEXT NOT NULL, -- P1 to P8
        record_type TEXT NOT NULL, -- INCOMING_QUALITY, FUMIGATION, IN_PROCESS, CCP_MONITORING, CHANGEOVER, COA, TERMINAL_INSPECTION, TRACEABILITY
        record_no TEXT NOT NULL,
        record_date TEXT NOT NULL,
        frequency TEXT, -- DAILY, LOADING, RM_RECEIVING, PER_BATCH, etc.
        item_id INTEGER,
        item_name TEXT,
        lot_no TEXT,
        purchase_id INTEGER,
        purchase_no TEXT,
        sales_id INTEGER,
        invoice_no TEXT,
        customer_name TEXT,
        supplier_name TEXT,
        vehicle_no TEXT,
        stage_name TEXT,
        status TEXT DEFAULT 'COMPLETED', -- PENDING, IN_PROGRESS, COMPLETED, REJECTED
        checked_by TEXT,
        verified_by TEXT,
        approved_by TEXT,
        findings_json TEXT, -- JSON holding checklist items, test results, CCP values, deviations
        action_taken TEXT,
        remarks TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Cleaning & Control Records (C1 to C10)
    await db.run(`
      CREATE TABLE IF NOT EXISTS compliance_cleaning_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_code TEXT NOT NULL, -- C1 to C10
        record_type TEXT NOT NULL, -- AREA_CLEANING, PALLET_CONTROL, GLASS_PLASTIC, PEST_CONTROL, VEHICLE_INSPECTION, TOILET_CLEANING, VISITOR_DECLARATION, PM_INSPECTION, HYGIENE, MACHINERY
        record_no TEXT NOT NULL,
        record_date TEXT NOT NULL,
        area_location TEXT,
        frequency TEXT NOT NULL, -- Daily, 15 Days Once, Monthly Once, Loading, PM Receiving
        company_name TEXT DEFAULT 'BVC Exports Pvt. Ltd.',
        financial_year TEXT DEFAULT '2026-2027',
        supervisor_name TEXT,
        inspector_name TEXT,
        prepared_by TEXT,
        verified_by TEXT,
        customer_name TEXT,
        supplier_name TEXT,
        vehicle_no TEXT,
        status TEXT DEFAULT 'COMPLETED', -- DRAFT, COMPLETED, VERIFIED
        overall_status TEXT DEFAULT 'PASS', -- PASS, FAIL, ACTION_REQUIRED
        checklist_json TEXT, -- Key-value / list of checkpoints & observations
        corrective_action TEXT,
        completion_date TEXT,
        remarks TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure columns exist if table was already created
    const alterCols = [
      'company_name TEXT DEFAULT "BVC Exports Pvt. Ltd."',
      'financial_year TEXT DEFAULT "2026-2027"',
      'prepared_by TEXT',
      'customer_name TEXT',
      'supplier_name TEXT',
      'vehicle_no TEXT',
      'status TEXT DEFAULT "COMPLETED"'
    ];
    for (const col of alterCols) {
      try {
        await db.run(`ALTER TABLE compliance_cleaning_records ADD COLUMN ${col}`);
      } catch (e) {
        // column already exists, safe to ignore
      }
    }

    // Seed default sample documents if table is empty
    const docCountRes = await db.query('SELECT COUNT(*) as count FROM compliance_documents');
    if (docCountRes.rows && docCountRes.rows[0].count === 0) {
      await seedDefaultComplianceData();
    }
  } catch (err) {
    console.error('Error initializing compliance tables:', err);
  }
}

async function seedDefaultComplianceData() {
  console.log('Seeding initial quality & compliance documents & records...');
  
  // D1: Work Instruction
  await db.run(`
    INSERT INTO compliance_documents 
    (doc_code, doc_type, doc_number, title, department, process_stage, version, status, effective_date, review_date, prepared_by, approved_by, details_json, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'D1', 'WORK_INSTRUCTION', 'WI-GRD-001', 'Urad & Pulses Cleaning, Destoning and Milling Work Instruction', 'Production', 'Milling & Destoning', '2.0', 'APPROVED',
    '2026-01-01', '2026-12-31', 'Quality Supervisor', 'Plant Manager',
    JSON.stringify({
      objective: 'Ensure uniform grain feeding, continuous stone separation, and target mesh output without foreign matter.',
      safety_precautions: ['Safety shoes and hair net mandatory', 'Lock-out tag-out before hopper cleaning', 'Check magnetic separator every 2 hours'],
      steps: [
        { step_no: 1, action: 'Inward Grain Inspection', control: 'Moisture ≤ 12%, Foreign matter ≤ 1%' },
        { step_no: 2, action: 'Pre-Cleaner Vibratory Screen', control: 'Screen mesh 3.5mm clean and undamaged' },
        { step_no: 3, action: 'Destoning & Gravity Separation', control: 'Airflow velocity balanced, zero stone pass' },
        { step_no: 4, action: 'Hammer Mill Grinding', control: 'Output temperature < 45°C, sieve 0.8mm' },
        { step_no: 5, action: 'Packaging & Sifting', control: 'Check 1000 Gauss magnet at final spout' }
      ]
    }),
    'Standard factory operational work instruction for pulse milling.'
  ]);

  // D2: Hazard / CCP / OPRP Plan
  await db.run(`
    INSERT INTO compliance_documents 
    (doc_code, doc_type, doc_number, title, department, process_stage, version, status, effective_date, review_date, prepared_by, approved_by, details_json, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'D2', 'HAZARD_PLAN', 'HACCP-BVC-001', 'HACCP / CCP / OPRP / VACCP Food Safety Plan', 'Quality Assurance', 'Entire Plant', '3.1', 'APPROVED',
    '2026-01-15', '2027-01-14', 'HACCP Lead', 'Managing Director',
    JSON.stringify({
      hazards: [
        { process_step: 'Raw Material Receiving', hazard_type: 'Chemical / Biological', hazard_desc: 'Mycotoxins / Pesticide residue / Infestation', control_category: 'OPRP-1', critical_limit: 'Aflatoxin < 10 ppb, Moisture < 14%', monitoring_freq: 'Every RM Lot', corrective_action: 'Reject consignment if out of spec' },
        { process_step: 'Destoning & Magnet Stage', hazard_type: 'Physical', hazard_desc: 'Ferrous particles, stones, glass', control_category: 'CCP-1', critical_limit: 'Rare earth magnet ≥ 10,000 Gauss; Destoner stone pass: 0%', monitoring_freq: 'Every 2 Hours', corrective_action: 'Halt line, segregate batch from last good check, recalibrate' },
        { process_step: 'Finished Flour Sifting', hazard_type: 'Physical', hazard_desc: 'Damaged screen wires / Foreign mesh debris', control_category: 'CCP-2', critical_limit: 'Sieve mesh intact (no tears, mesh size 60)', monitoring_freq: 'Every Batch Start & End', corrective_action: 'Quarantine and re-sift lot if mesh damaged' },
        { process_step: 'Packing & Sealing', hazard_type: 'Physical / Allergen', hazard_desc: 'Bag contamination / Cross-contact', control_category: 'OPRP-2', critical_limit: 'Food grade bag compliance, seal hermetic', monitoring_freq: 'Every 30 Mins', corrective_action: 'Repack damaged bags' }
      ]
    }),
    'Master FSMS HACCP & VACCP Food Safety Plan.'
  ]);

  // D3: MTR Specification
  await db.run(`
    INSERT INTO compliance_documents 
    (doc_code, doc_type, doc_number, title, department, item_name, version, status, effective_date, review_date, prepared_by, approved_by, details_json, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'D3', 'MTR_SPEC', 'MTR-URD-2026', 'MTR Material Technical Requirement & Signed Specification - Urad Dal', 'Quality', 'Urad Dal', '1.0', 'APPROVED',
    '2026-02-01', '2027-01-31', 'QA Executive', 'Quality Head',
    JSON.stringify({
      item_code: 'URD001',
      standard: 'FSSAI Food Safety and Standards (Food Products Standards) Regulations',
      parameters: [
        { parameter: 'Moisture', standard_limit: 'Max 12.0 %', test_method: 'IS 4333 (Part 2)', category: 'Physical' },
        { parameter: 'Foreign Matter', standard_limit: 'Max 1.0 % (Inorganic < 0.1%)', test_method: 'IS 4333 (Part 1)', category: 'Physical' },
        { parameter: 'Weeviled Grains', standard_limit: 'Max 1.0 %', test_method: 'IS 4333 (Part 3)', category: 'Physical' },
        { parameter: 'Damaged / Discolored', standard_limit: 'Max 3.0 %', test_method: 'IS 4333 (Part 1)', category: 'Physical' },
        { parameter: 'Protein (Dry Basis)', standard_limit: 'Min 22.0 %', test_method: 'IS 7219', category: 'Chemical' },
        { parameter: 'Total Ash', standard_limit: 'Max 3.5 %', test_method: 'IS 1155', category: 'Chemical' },
        { parameter: 'Uric Acid', standard_limit: 'Max 100 mg/kg', test_method: 'IS 4333 (Part 5)', category: 'Chemical' },
        { parameter: 'Aflatoxin (B1+B2+G1+G2)', standard_limit: 'Max 10 µg/kg', test_method: 'AOAC 991.31', category: 'Microbiology' }
      ],
      packaging_spec: '25kg / 50kg HDPE laminated woven sacks with food-grade inner liner.'
    }),
    'Controlled MTR customer & regulatory quality specification.'
  ]);

  // D4: Training Record
  await db.run(`
    INSERT INTO compliance_documents 
    (doc_code, doc_type, doc_number, title, department, version, status, effective_date, prepared_by, approved_by, details_json, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'D4', 'TRAINING', 'TRN-2026-004', 'Good Manufacturing Practices (GMP) & Personal Hygiene Refresher', 'Human Resources & QA', '1.0', 'APPROVED',
    '2026-08-10', 'QA Trainer', 'Plant HR Head',
    JSON.stringify({
      trainer: 'Dr. R. Sundaram (FOSTAC Certified Lead)',
      topic: 'GMP, Cross-Contamination Prevention, Allergen Protocol & Hand Hygiene',
      duration_hours: 4,
      attendees: [
        { employee_name: 'Murugan K', emp_id: 'EMP-012', designation: 'Milling Operator', evaluation_score: '92%', status: 'Passed' },
        { employee_name: 'Suresh P', emp_id: 'EMP-019', designation: 'Packer', evaluation_score: '88%', status: 'Passed' },
        { employee_name: 'Anand R', emp_id: 'EMP-023', designation: 'Loader', evaluation_score: '85%', status: 'Passed' },
        { employee_name: 'Kavitha M', emp_id: 'EMP-031', designation: 'QC Assistant', evaluation_score: '96%', status: 'Passed' }
      ]
    }),
    'Annual mandatory food handler GMP training record.'
  ]);

  // D5: SOPs
  await db.run(`
    INSERT INTO compliance_documents 
    (doc_code, doc_type, doc_number, title, department, process_stage, version, status, effective_date, review_date, prepared_by, approved_by, details_json, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'D5', 'SOP', 'SOP-SAN-003', 'Standard Operating Procedure for Production Line Sanitation & Allergen Clean-out', 'Sanitation', 'Cleaning & Sanitation', '4.0', 'APPROVED',
    '2026-01-01', '2027-01-01', 'Sanitation Head', 'Technical Director',
    JSON.stringify({
      scope: 'All pulse milling machinery, conveyers, elevators, storage bins, and floor areas.',
      frequency: 'Daily post-shift, between product changeovers, and deep cleaning every 15 days.',
      chemicals_permitted: ['Food Grade Sanitizer (Chlorine 100ppm / Quat 200ppm)', 'Hot Water rinse (65°C)'],
      procedure_steps: [
        'Dry sweep and vacuum residue from elevators and milling chambers',
        'Dismantle sifter screens and clean with nylon brushes',
        'Wipe down external stainless steel surfaces with approved food-grade sanitizer',
        'Inspect for pest harborage or water pooling',
        'Record in C1 Production Area Cleaning checklist before line release'
      ]
    }),
    'Master controlled sanitation standard operating procedure.'
  ]);

  // D6: RCCA
  await db.run(`
    INSERT INTO compliance_documents 
    (doc_code, doc_type, doc_number, title, department, version, status, effective_date, prepared_by, approved_by, details_json, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'D6', 'RCCA', 'RCCA-2026-002', 'Root Cause Corrective & Preventive Action - Sieve Mesh Wear on Line 2', 'Quality & Maintenance', '1.0', 'APPROVED',
    '2026-08-05', 'Maintenance Engineer', 'QA Manager',
    JSON.stringify({
      issue_source: 'In-Process Quality Check (P3)',
      problem_desc: 'Higher percentage of coarse flour grains observed during batch LOT0014 grinding.',
      five_why_analysis: [
        'Why 1: Coarse flour entered bagging bin? -> Sifter screen mesh had a minor tear.',
        'Why 2: Why did screen tear? -> Mesh wire fatigued after exceeding 450 operating hours.',
        'Why 3: Why was it not replaced? -> Replacement schedule was not flagged in preventive maintenance log.',
        'Why 4: Why not flagged? -> Manual hour tracking was delayed.',
        'Why 5 (Root Cause): Lack of automated operating-hour alert for wear components.'
      ],
      immediate_correction: 'Halted line, replaced with certified 60-mesh screen, quarantined and re-sifted 30 bags.',
      corrective_action: 'Updated screen inspection to daily C10 checklist and set 350-hour replacement threshold.',
      preventive_action: 'Instituted pre-shift screen light-table inspection protocol.',
      target_date: '2026-08-10',
      completion_date: '2026-08-08',
      verified_by: 'QA Head'
    }),
    'Resolved and closed RCCA quality record.'
  ]);

  // D7: Medical Fitness
  await db.run(`
    INSERT INTO compliance_documents 
    (doc_code, doc_type, doc_number, title, department, employee_name, version, status, effective_date, review_date, prepared_by, approved_by, details_json, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'D7', 'MEDICAL', 'MED-2026-012', 'Annual Medical Fitness Certificate - Food Handlers Batch A', 'Occupational Health', 'Murugan K (and 15 staff)', '1.0', 'APPROVED',
    '2026-03-01', '2027-02-28', 'Occupational Physician', 'Plant HR',
    JSON.stringify({
      clinic: 'City Occupational Health & Diagnostic Center, Madurai',
      tests_conducted: ['Typhoid (Widal/Vaccination)', 'Tuberculosis (Chest X-Ray / Sputum)', 'Skin & Nail infectious disease screening', 'Deworming & Eye test'],
      fit_for_food_handling: true,
      expiry_date: '2027-02-28'
    }),
    'All food handlers screened and certified fit under FSSAI Schedule 4.'
  ]);

  // D8: FOSTAC Certificate
  await db.run(`
    INSERT INTO compliance_documents 
    (doc_code, doc_type, doc_number, title, department, employee_name, version, status, effective_date, review_date, prepared_by, approved_by, details_json, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'D8', 'FOSTAC', 'FOSTAC-FSSAI-88912', 'FOSTAC Food Safety Supervisor Certification - Manufacturing Level 2', 'Quality Assurance', 'Kavitha M', '1.0', 'APPROVED',
    '2025-09-15', '2027-09-14', 'FSSAI Training Partner', 'Managing Director',
    JSON.stringify({
      cert_number: 'FSSAI/FOSTAC/ADV-MFG/88912',
      course_name: 'Advanced Manufacturing Food Safety Supervisor (Pulses, Grains & Flours)',
      training_agency: 'National Food Safety Training Institute',
      valid_till: '2027-09-14'
    }),
    'Designated certified Food Safety Supervisor on site.'
  ]);

  // D9: Recall / Withdraw
  await db.run(`
    INSERT INTO compliance_documents 
    (doc_code, doc_type, doc_number, title, department, item_name, lot_no, version, status, effective_date, prepared_by, approved_by, details_json, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'D9', 'RECALL', 'REC-MOCK-2026-01', 'Mock Product Recall & Rapid Traceability Simulation Record', 'Quality & Crisis Mgmt', 'Broken Rice', 'LOT0014', '1.0', 'APPROVED',
    '2026-08-01', 'Recall Coordinator', 'Managing Director',
    JSON.stringify({
      recall_classification: 'Class II (Mock Recall Exercise)',
      reason: 'Bi-annual mock recall to test rapid backward and forward traceability speed and recovery percentage.',
      inward_details: { lot_no: 'LOT0014', supplier: 'Sri Amman Traders', purchase_invoice: 'PI-2026-009', inward_qty_kg: 540 },
      production_usage: { milled_to: 'BRF Flour & Packaged Broken Rice', process_order: 'WO-2026-006' },
      stock_distribution: { factory_godown_stock_kg: 400, dispatched_sales_kg: 140, affected_customers: ['M/s Royal Foods (Inv #SAL-0104 - 100 Kg)', 'M/s Lakshmi Stores (Inv #SAL-0109 - 40 Kg)'] },
      reconciliation_rate: '100% (140 Kg locked in transit / retailer hold + 400 Kg in-house)',
      execution_time_minutes: 42,
      fssai_benchmark_met: true
    }),
    'Mock recall completed in 42 minutes exceeding the 2-hour FSSAI benchmark.'
  ]);

  // D10: Halal Declaration
  await db.run(`
    INSERT INTO compliance_documents 
    (doc_code, doc_type, doc_number, title, department, item_name, version, status, effective_date, review_date, prepared_by, approved_by, details_json, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'D10', 'HALAL', 'HALAL-DEC-2026', 'Halal Compliance & Non-Contamination Product Declaration', 'Export QA', 'All Flour & Pulse Products', '1.0', 'APPROVED',
    '2026-01-01', '2026-12-31', 'Quality Manager', 'Managing Director',
    JSON.stringify({
      products_covered: ['Urad Dal', 'Moong Dal', 'Toor Dal', 'Chana Dal', 'Rice Flour (BRF)', 'Plain Papad', 'Black Gram Flour (BGF)'],
      source_materials: '100% Plant-derived pure grains and pulses. Zero animal fats, enzymes, or alcohol additives used.',
      line_segregation: 'Plant exclusively processes grains, flours, and pulses with strict allergen and contamination controls.',
      halal_certification_ref: 'HCT-IND-994821',
      certifying_body: 'Halal Certification Trust of India'
    }),
    'Annual Halal declaration for domestic and export dispatches.'
  ]);

  // D11: Process Flow Chart
  await db.run(`
    INSERT INTO compliance_documents 
    (doc_code, doc_type, doc_number, title, department, process_stage, version, status, effective_date, review_date, prepared_by, approved_by, details_json, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'D11', 'PROCESS_FLOW', 'PFC-MFG-001', 'Grain Receiving, Milling, Sifting & Packing Process Flow Diagram', 'Engineering & QA', 'End-to-End Milling Flow', '3.0', 'APPROVED',
    '2026-01-01', '2027-01-01', 'Process Engineer', 'Plant Head',
    JSON.stringify({
      stages: [
        { stage_no: 1, name: 'Raw Material Inward & QC Check (P1)', type: 'Receiving', ccp_type: 'OPRP-1', parameters: 'Moisture, Weevils, Foreign Matter' },
        { stage_no: 2, name: 'Pre-Cleaning & Rotary Sieve', type: 'Cleaning', ccp_type: 'PRP', parameters: 'Coarse chaff and dust separation' },
        { stage_no: 3, name: 'Gravity Destoner & Rare Earth Magnet', type: 'Destoning', ccp_type: 'CCP-1', parameters: 'Stones removal (0% pass), Magnet ≥ 10,000 Gauss' },
        { stage_no: 4, name: 'Hammer Milling & Micro-Pulverizing', type: 'Grinding', ccp_type: 'PRP', parameters: 'Milling temp < 45°C, sieve mesh check' },
        { stage_no: 5, name: 'Vibratory Flour Sifter (P3)', type: 'Sifting', ccp_type: 'CCP-2', parameters: '60 mesh wire integrity, coarse rejection' },
        { stage_no: 6, name: 'Automated Bagging & Metal Detection (P4)', type: 'Packing', ccp_type: 'CCP-3', parameters: 'Ferrous 1.5mm, Non-Fe 2.0mm, SS 2.5mm' },
        { stage_no: 7, name: 'Finished Goods Storage & Quarantine', type: 'Storage', ccp_type: 'PRP', parameters: 'Wooden pallet spacing, 18 inch wall clearance' },
        { stage_no: 8, name: 'Vehicle Inspection & Terminal Dispatch (P2, P6, P7)', type: 'Dispatch', ccp_type: 'OPRP-2', parameters: 'Fumigation check, COA release, truck hygiene' }
      ]
    }),
    'Official engineering process flow diagram with embedded CCP/OPRP control gates.'
  ]);

  // Seed sample Production Records (P1 to P8)
  const pCount = await db.query('SELECT COUNT(*) as count FROM compliance_production_records');
  if (pCount.rows && pCount.rows[0].count === 0) {
    await db.run(`
      INSERT INTO compliance_production_records 
      (record_code, record_type, record_no, record_date, frequency, item_name, lot_no, supplier_name, status, checked_by, findings_json, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'P1', 'INCOMING_QUALITY', 'P1-2026-001', '2026-08-16', 'RM Receiving', 'Urad Gotta', 'LOT0003', 'Sri Amman Traders', 'COMPLETED', 'Kavitha M',
      JSON.stringify({ moisture: '10.8%', foreign_matter: '0.4%', broken_grain: '1.2%', weevils: '0%', decision: 'PASSED' }),
      'Sample conforms to MTR-URD-2026 specification.'
    ]);

    await db.run(`
      INSERT INTO compliance_production_records 
      (record_code, record_type, record_no, record_date, frequency, item_name, lot_no, vehicle_no, customer_name, status, checked_by, findings_json, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'P2', 'FUMIGATION', 'P2-2026-001', '2026-08-15', 'Loading', 'Rice Flour (BRF)', 'LOT0016', 'TN-58-AX-9912', 'Royal Foods Exporters', 'COMPLETED', 'Sundar R',
      JSON.stringify({ chemical_used: 'Aluminium Phosphide (ALP)', dosage: '3g/cu.m', exposure_hrs: '72 hrs', degassed_at: '2026-08-15 08:00', gas_clearance: '0 ppm (Safe)' }),
      'Fumigation certificate issued for export container loading.'
    ]);

    await db.run(`
      INSERT INTO compliance_production_records 
      (record_code, record_type, record_no, record_date, frequency, item_name, lot_no, stage_name, status, checked_by, findings_json, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'P4', 'CCP_MONITORING', 'P4-2026-018', '2026-08-16', 'Daily / 2-Hourly', 'Urad Flour', 'LOT0007', 'Milling & Bagging Line', 'COMPLETED', 'Murugan K',
      JSON.stringify({ magnet_gauss: '10,250 Gauss (Pass)', metal_detector_fe: 'Pass (1.5mm test piece)', metal_detector_ss: 'Pass (2.5mm test piece)', sieve_condition: 'Intact' }),
      'Hourly CCP checkpoints logged with zero deviation.'
    ]);
  }

  // Seed sample Cleaning & Control Records (C1 to C10)
  const cCount = await db.query('SELECT COUNT(*) as count FROM compliance_cleaning_records');
  if (cCount.rows && cCount.rows[0].count === 0) {
    // C1: Production Area Cleaning (Daily)
    await db.run(`
      INSERT INTO compliance_cleaning_records
      (record_code, record_type, record_no, record_date, area_location, frequency, company_name, financial_year, inspector_name, supervisor_name, prepared_by, verified_by, overall_status, status, checklist_json, corrective_action, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'C1', 'AREA_CLEANING', 'C1-2026-0816', '2026-08-16', 'Main Milling & Packing Hall', 'Daily', 'BVC Exports Pvt. Ltd.', '2026-2027',
      'Ramesh QA', 'Plant Supervisor', 'Ramesh QA', 'Plant Manager', 'PASS', 'COMPLETED',
      JSON.stringify({
        shift: 'Morning (Shift 1)',
        cleaning_points: [
          { point: 'Floor', status: 'OK', remarks: 'Swept, scrubbed and dried' },
          { point: 'Walls', status: 'OK', remarks: 'Free of flour dust & cobwebs' },
          { point: 'Working Area', status: 'OK', remarks: 'Disinfected with food-grade sanitizer' },
          { point: 'Equipment Area', status: 'OK', remarks: 'Destoner & Hammer mill hoppers clear' },
          { point: 'Drainage Area', status: 'OK', remarks: 'Drain covers in place, zero stagnation' },
          { point: 'Waste Area', status: 'OK', remarks: 'Segregated and moved to outer yard' },
          { point: 'Storage Area', status: 'OK', remarks: 'Aisle demarcations clear, 18-inch wall gap maintained' }
        ]
      }),
      'None required. All points verified compliant.',
      'Daily pre-operational and post-shift sanitation signed off.'
    ]);

    // C2: Wooden Pallet Control (15 Days Once)
    await db.run(`
      INSERT INTO compliance_cleaning_records
      (record_code, record_type, record_no, record_date, area_location, frequency, company_name, financial_year, inspector_name, supervisor_name, prepared_by, verified_by, overall_status, status, checklist_json, corrective_action, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'C2', 'PALLET_CONTROL', 'C2-2026-0801', '2026-08-01', 'RM & Finished Goods Godown', '15 Days Once', 'BVC Exports Pvt. Ltd.', '2026-2027',
      'Karthik S (Warehouse Lead)', 'QA Manager', 'Karthik S', 'QA Manager', 'PASS', 'COMPLETED',
      JSON.stringify({
        pallet_id: 'PLT-BAY-04',
        location: 'Finished Goods Bay B',
        quantity: 85,
        condition: 'Good / Heat-Treated (ISPM-15)',
        parameters: [
          { parameter: 'Pallet condition', result: 'OK', remarks: 'Structurally sound' },
          { parameter: 'Broken pallet', result: 'No', remarks: '0 broken pallets found' },
          { parameter: 'Splintering', result: 'No', remarks: 'Planed smooth' },
          { parameter: 'Moisture', result: 'No', remarks: 'Moisture meter reading 11.2%' },
          { parameter: 'Contamination', result: 'No', remarks: 'No chemical or dirt stains' },
          { parameter: 'Pest evidence', result: 'No', remarks: 'Zero wood borer or termite sign' },
          { parameter: 'Cleanliness', result: 'OK', remarks: 'Clean and dry' }
        ],
        action: 'Accepted'
      }),
      '2 minor chipped pallets segregated for repair.',
      'Bi-weekly wooden pallet structural and hygiene inspection passed.'
    ]);

    // C3: Glass & Plastic Control (15 Days Once)
    await db.run(`
      INSERT INTO compliance_cleaning_records
      (record_code, record_type, record_no, record_date, area_location, frequency, company_name, financial_year, inspector_name, supervisor_name, prepared_by, verified_by, overall_status, status, checklist_json, corrective_action, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'C3', 'GLASS_PLASTIC', 'C3-2026-0801', '2026-08-01', 'Milling Hall, Sifter Bay & Packaging Line', '15 Days Once', 'BVC Exports Pvt. Ltd.', '2026-2027',
      'Venkatesh M', 'QA Lead', 'Venkatesh M', 'QA Lead', 'PASS', 'COMPLETED',
      JSON.stringify({
        objects_checked: [
          { s_no: 1, location: 'Milling Line 1', object_item: 'Window Glazing', material_type: 'Polycarbonate Shielded', condition: 'OK', damage_found: 'No', action: '-', remarks: 'Film intact' },
          { s_no: 2, location: 'Sifter Bay', object_item: 'Sifter View Glass', material_type: 'Toughened Glass', condition: 'OK', damage_found: 'No', action: '-', remarks: 'No cracks or chips' },
          { s_no: 3, location: 'Packaging Line', object_item: 'Overhead Tube Light Diffusers', material_type: 'Hard Acrylic', condition: 'OK', damage_found: 'No', action: '-', remarks: 'Shatter-proof sleeves in place' },
          { s_no: 4, location: 'Air Compressor Room', object_item: 'Pressure Gauge Cover', material_type: 'Rigid Acrylic', condition: 'OK', damage_found: 'No', action: '-', remarks: 'Zero hairline cracks' },
          { s_no: 5, location: 'Quality Lab', object_item: 'Moisture Balance Cover', material_type: 'Heat-resistant Glass', condition: 'OK', damage_found: 'No', action: '-', remarks: 'Clean and calibrated' }
        ],
        overall_result: 'ACCEPTED'
      }),
      'Zero glass or brittle plastic breakage observed in food zones.',
      'Fortnightly Glass & Brittle Plastic Register updated.'
    ]);

    // C4: Pest Control Monitoring (Daily)
    await db.run(`
      INSERT INTO compliance_cleaning_records
      (record_code, record_type, record_no, record_date, area_location, frequency, company_name, financial_year, inspector_name, supervisor_name, prepared_by, verified_by, overall_status, status, checklist_json, corrective_action, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'C4', 'PEST_CONTROL', 'C4-2026-0816', '2026-08-16', 'Perimeter Rodent Bait Stations & Fly Catchers', 'Daily', 'BVC Exports Pvt. Ltd.', '2026-2027',
      'Pest Guard Services / Murugan QA', 'QA Head', 'Murugan QA', 'QA Head', 'PASS', 'COMPLETED',
      JSON.stringify({
        inspection_time: '08:30 AM',
        pest_status: 'No Pest Evidence',
        monitoring_points: [
          { s_no: 1, location: 'External Perimeter West', trap_no: 'RB-01 to RB-06', observation: 'Intact, locked', pest_found: 'No', droppings: 'No', evidence: 'None', action_taken: 'Bait replenished' },
          { s_no: 2, location: 'RM Godown Entrance', trap_no: 'EFC-01 (Fly Catcher)', observation: 'UV tube working', pest_found: 'Yes (2 Houseflies)', droppings: 'No', evidence: 'Flies on sticky pad', action_taken: 'Pad replaced' },
          { s_no: 3, location: 'Milling Line Clean Zone', trap_no: 'GT-01 (Glue Trap)', observation: 'Clear', pest_found: 'No', droppings: 'No', evidence: 'None', action_taken: 'None' },
          { s_no: 4, location: 'Finished Goods Bay', trap_no: 'RB-07 to RB-12', observation: 'Intact', pest_found: 'No', droppings: 'No', evidence: 'None', action_taken: 'Inspected' }
        ]
      }),
      'Sticky pad replaced on EFC-01. Bait boxes secured.',
      'Zero rodent or crawling pest evidence inside production area.'
    ]);

    // C5: Vehicle Loading / Unloading (Loading)
    await db.run(`
      INSERT INTO compliance_cleaning_records
      (record_code, record_type, record_no, record_date, area_location, frequency, company_name, financial_year, inspector_name, supervisor_name, customer_name, vehicle_no, prepared_by, verified_by, overall_status, status, checklist_json, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'C5', 'VEHICLE_INSPECTION', 'C5-2026-0815', '2026-08-15', 'Dispatch Dock Bay 1', 'Loading', 'BVC Exports Pvt. Ltd.', '2026-2027',
      'Sundar R (Loading Incharge)', 'QA Lead', 'Royal Foods Exporters', 'TN-58-AX-9912', 'Sundar R', 'QA Lead', 'PASS', 'COMPLETED',
      JSON.stringify({
        customer: 'Royal Foods Exporters',
        quantity: '500 Bags (25 MT)',
        vehicle_no: 'TN-58-AX-9912',
        movement_type: 'Loading (Finished Goods Dispatch)',
        checklist: [
          { s_no: 1, check_point: 'Cleanliness of truck — Dust/Dirt', ok: true, not_ok: false, remarks: 'Swept clean, floor dry' },
          { s_no: 2, check_point: 'No Pest/Pest Droppings', ok: true, not_ok: false, remarks: 'No insect or rodent evidence' },
          { s_no: 3, check_point: 'No Foreign Material/Moisture', ok: true, not_ok: false, remarks: 'Completely dry and oil-free' },
          { s_no: 4, check_point: 'Doors Intact / Good Condition', ok: true, not_ok: false, remarks: 'Rubber gasket sealed tight' },
          { s_no: 5, check_point: 'No Corrosion', ok: true, not_ok: false, remarks: 'Interior floor painted & lined' },
          { s_no: 6, check_point: 'Truck Sealing — Empty/After Loading', ok: true, not_ok: false, remarks: 'Numbered seal #BVC-SL-9014' },
          { s_no: 7, check_point: 'Unwanted Odour', ok: true, not_ok: false, remarks: 'Neutral, zero chemical/diesel smell' },
          { s_no: 8, check_point: 'Tarpaulin — Clean/Damaged', ok: true, not_ok: false, remarks: 'Heavy-duty water-tight tarp verified' },
          { s_no: 9, check_point: 'General Acceptance of Truck', ok: true, not_ok: false, remarks: 'Accepted for food transport' }
        ]
      }),
      'Vehicle inspected and cleared for export dispatch of Urad Flour.'
    ]);

    // C6: Toilet Cleaning Checklist (Daily)
    await db.run(`
      INSERT INTO compliance_cleaning_records
      (record_code, record_type, record_no, record_date, area_location, frequency, company_name, financial_year, inspector_name, supervisor_name, prepared_by, verified_by, overall_status, status, checklist_json, corrective_action, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'C6', 'TOILET_CLEANING', 'C6-2026-0816', '2026-08-16', 'Factory Restrooms & Handwash Stations', 'Daily', 'BVC Exports Pvt. Ltd.', '2026-2027',
      'Mani K (Sanitation Staff)', 'Sanitation Supervisor', 'Mani K', 'Sanitation Supervisor', 'PASS', 'COMPLETED',
      JSON.stringify({
        inspection_time: '07:30 AM & 01:30 PM',
        checklist: [
          { item: 'Floor', status: 'OK', remarks: 'Disinfected and dry' },
          { item: 'Toilet bowl', status: 'OK', remarks: 'Sanitized with cleaner' },
          { item: 'Wash basin', status: 'OK', remarks: 'Clean, no stains' },
          { item: 'Doors', status: 'OK', remarks: 'Handles disinfected' },
          { item: 'Walls', status: 'OK', remarks: 'Tiled walls wiped' },
          { item: 'Water availability', status: 'OK', remarks: 'Uninterrupted 24/7 supply' },
          { item: 'Cleaning material / Liquid Soap', status: 'OK', remarks: 'Soap dispenser refilled' },
          { item: 'Waste bin', status: 'OK', remarks: 'Pedal bin lined and cleared' },
          { item: 'Odour', status: 'OK', remarks: 'Ventilation exhaust functional' },
          { item: 'Overall cleanliness', status: 'OK', remarks: 'Sanitary standards met' }
        ]
      }),
      'Soap dispenser refilled at 07:30 AM.',
      'Daily 2-shift restroom hygiene verification completed.'
    ]);

    // C7: Visitor Declaration (Monthly Once / Per Visit)
    await db.run(`
      INSERT INTO compliance_cleaning_records
      (record_code, record_type, record_no, record_date, area_location, frequency, company_name, financial_year, inspector_name, supervisor_name, prepared_by, verified_by, overall_status, status, checklist_json, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'C7', 'VISITOR_DECLARATION', 'C7-2026-0805', '2026-08-05', 'Production Hall & QA Testing Lab', 'Monthly Once', 'BVC Exports Pvt. Ltd.', '2026-2027',
      'Security Officer & HR', 'QA Head', 'HR Desk', 'QA Head', 'PASS', 'COMPLETED',
      JSON.stringify({
        visitor_name: 'Dr. S. Narayanan',
        visitor_company: 'FSSAI Third-Party Audit Agency',
        contact_no: '+91 98410 44321',
        purpose: 'Annual Food Safety & Hygiene Surveillance Audit',
        area_to_visit: 'Raw Material Godown, Milling & Bagging Lines, QC Lab',
        declaration_questions: [
          { question: 'Suffering from any communicable disease, flu, cough, or diarrhea?', answer: 'No' },
          { question: 'Recent exposure to contamination or infectious outbreak?', answer: 'No' },
          { question: 'Agreed to follow factory GMP & hygiene rules (No jewelry, watch, perfume)?', answer: 'Yes' },
          { question: 'Protective clothing (Hairnet, Coat, Shoe Covers) issued & worn?', answer: 'Yes' },
          { question: 'Visitor safety guidelines briefing provided?', answer: 'Yes' }
        ],
        declaration_status: 'ACCEPTED',
        visitor_signature_ack: 'Signed physically on visitor register'
      }),
      'Official auditor visitor entry cleared in compliance with FSSAI Section 16.'
    ]);

    // C8: Packing Material Inspection (PM Receiving)
    await db.run(`
      INSERT INTO compliance_cleaning_records
      (record_code, record_type, record_no, record_date, area_location, frequency, company_name, financial_year, inspector_name, supervisor_name, supplier_name, prepared_by, verified_by, overall_status, status, checklist_json, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'C8', 'PM_INSPECTION', 'C8-2026-0814', '2026-08-14', 'Packaging Material Inward Bay', 'PM Receiving', 'BVC Exports Pvt. Ltd.', '2026-2027',
      'Kavitha M (QC Executive)', 'QA Head', 'PolyPack Industries', 'Kavitha M', 'QA Head', 'PASS', 'COMPLETED',
      JSON.stringify({
        supplier: 'PolyPack Industries',
        purchase_no: 'PO-2026-PM-089',
        packing_material: '25kg HDPE Woven Sacks with Food-grade Liner',
        lot_batch_no: 'PP-HD-8812',
        quantity_received: '5,000 Bags',
        parameters: [
          { parameter: 'Material identity', requirement: 'Virgin HDPE, Food-grade printed', observed: 'Conforms to spec', result: 'Pass', remarks: 'Food grade mark present' },
          { parameter: 'Quantity', requirement: '5,000 Bags', observed: '5,000 Bags (10 bundles)', result: 'Pass', remarks: 'Count verified' },
          { parameter: 'Packaging condition', requirement: 'Wrapped in waterproof stretch film', observed: 'Intact, no tearing', result: 'Pass', remarks: 'Well protected' },
          { parameter: 'Cleanliness', requirement: 'Dust-free, dry, no grease', observed: 'Clean and odorless', result: 'Pass', remarks: 'No chemical smell' },
          { parameter: 'Damage', requirement: 'Zero cuts, pinholes or tears', observed: 'Zero defects in 50 sample pull', result: 'Pass', remarks: 'AQL 1.0 passed' },
          { parameter: 'Moisture', requirement: 'Dry storage condition', observed: 'Dry', result: 'Pass', remarks: 'Moisture nil' },
          { parameter: 'Foreign material', requirement: 'Zero dirt, insect, foreign matter', observed: 'Clean interior liner', result: 'Pass', remarks: 'Virgin LDPE liner clean' },
          { parameter: 'Print / labelling', requirement: 'BVC Exports Pvt. Ltd., FSSAI, Batch, Net Wt', observed: 'Sharp legible print', result: 'Pass', remarks: 'Text and barcode crisp' },
          { parameter: 'Specification compliance', requirement: 'GSM 120 ± 5%, Bursting 18 kg/cm2', observed: 'GSM 122, Bursting 19.4', result: 'Pass', remarks: 'Tested in QC lab' }
        ],
        final_result: 'ACCEPT'
      }),
      'Consignment LOT PP-HD-8812 passed all food contact packaging compliance tests.'
    ]);

    // C9: Food Handler Personal Hygiene (Daily)
    await db.run(`
      INSERT INTO compliance_cleaning_records
      (record_code, record_type, record_no, record_date, area_location, frequency, company_name, financial_year, inspector_name, supervisor_name, prepared_by, verified_by, overall_status, status, checklist_json, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'C9', 'HYGIENE', 'C9-2026-0816', '2026-08-16', 'Production Floor & Bagging Section', 'Daily', 'BVC Exports Pvt. Ltd.', '2026-2027',
      'Anand R (Hygiene Inspector)', 'Plant HR & QA Lead', 'Anand R', 'QA Lead', 'PASS', 'COMPLETED',
      JSON.stringify({
        shift: 'Morning Shift (08:00 - 16:30)',
        department: 'Milling, Sifting & Packing',
        total_employees: 12,
        checked: 12,
        passed: 12,
        failed: 0,
        employees: [
          { s_no: 1, emp_name: 'Murugan K', emp_id: 'EMP-012', uniform: 'Yes', hairnet: 'Yes', clean_hands: 'Yes', trimmed_nails: 'Yes', no_jewelry: 'Yes', footwear: 'Yes', health: 'Fit', status: 'PASS', remarks: 'Good' },
          { s_no: 2, emp_name: 'Suresh P', emp_id: 'EMP-019', uniform: 'Yes', hairnet: 'Yes', clean_hands: 'Yes', trimmed_nails: 'Yes', no_jewelry: 'Yes', footwear: 'Yes', health: 'Fit', status: 'PASS', remarks: 'Good' },
          { s_no: 3, emp_name: 'Anand R', emp_id: 'EMP-023', uniform: 'Yes', hairnet: 'Yes', clean_hands: 'Yes', trimmed_nails: 'Yes', no_jewelry: 'Yes', footwear: 'Yes', health: 'Fit', status: 'PASS', remarks: 'Good' },
          { s_no: 4, emp_name: 'Kavitha M', emp_id: 'EMP-031', uniform: 'Yes', hairnet: 'Yes', clean_hands: 'Yes', trimmed_nails: 'Yes', no_jewelry: 'Yes', footwear: 'Yes', health: 'Fit', status: 'PASS', remarks: 'Good' },
          { s_no: 5, emp_name: 'Govindan V', emp_id: 'EMP-044', uniform: 'Yes', hairnet: 'Yes', clean_hands: 'Yes', trimmed_nails: 'Yes', no_jewelry: 'Yes', footwear: 'Yes', health: 'Fit', status: 'PASS', remarks: 'Good' }
        ]
      }),
      'All 12 food handlers verified in clean uniforms, trimmed nails and mandatory PPE.'
    ]);

    // C10: Machinery Checklist (Monthly Once)
    await db.run(`
      INSERT INTO compliance_cleaning_records
      (record_code, record_type, record_no, record_date, area_location, frequency, company_name, financial_year, inspector_name, supervisor_name, prepared_by, verified_by, overall_status, status, checklist_json, corrective_action, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'C10', 'MACHINERY', 'C10-2026-0801', '2026-08-01', 'Pulse Processing Section', 'Monthly Once', 'BVC Exports Pvt. Ltd.', '2026-2027',
      'Muthu S (Maintenance Engineer)', 'Technical Manager', 'Muthu S', 'Technical Manager', 'PASS', 'COMPLETED',
      JSON.stringify({
        machine_name: 'Pulse Hammer Mill #01 (50 HP Heavy Duty)',
        machine_id: 'MCH-MIL-01',
        location: 'Milling Line 1',
        operator: 'Murugan K',
        parameters: [
          { check_point: 'Machine cleanliness', result: 'Acceptable', remarks: 'Casing and hopper cleaned' },
          { check_point: 'Food residue', result: 'Acceptable', remarks: 'Zero old meal buildup' },
          { check_point: 'Foreign material', result: 'Acceptable', remarks: 'Magnetic guard cleared' },
          { check_point: 'Lubrication condition', result: 'Acceptable', remarks: 'Food grade grease (NSF H1) topped' },
          { check_point: 'Guard condition', result: 'Acceptable', remarks: 'Belt drive guards secure' },
          { check_point: 'Electrical condition', result: 'Acceptable', remarks: 'Earthing & conduit intact' },
          { check_point: 'Physical damage', result: 'Acceptable', remarks: 'Hammer beaters wear < 5%' },
          { check_point: 'Abnormal noise / vibration', result: 'Acceptable', remarks: 'Bearing temp 48°C (Normal)' },
          { check_point: 'Safety condition', result: 'Acceptable', remarks: 'Emergency stop tested functional' },
          { check_point: 'General condition', result: 'Acceptable', remarks: 'Good for continuous production' }
        ],
        machine_status: 'Acceptable'
      }),
      'Routine monthly lubrication completed. No abnormal vibration.',
      'Monthly preventive maintenance and hygiene audit signed off.'
    ]);
  }
}

// Call table initialization on module load
initComplianceTables();

// ============================================================================
// 1. DASHBOARD & COMPLIANCE SCHEDULER OVERVIEW
// ============================================================================
router.get('/dashboard', async (req, res) => {
  try {
    const docCounts = await db.query(`
      SELECT 
        COUNT(*) as total_docs,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_docs,
        SUM(CASE WHEN status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) as review_docs,
        SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as draft_docs
      FROM compliance_documents
    `);

    const prodRecordCounts = await db.query(`
      SELECT 
        COUNT(*) as total_prod_records,
        SUM(CASE WHEN record_date = DATE('now') THEN 1 ELSE 0 END) as today_prod_records
      FROM compliance_production_records
    `);

    const cleaningRecordCounts = await db.query(`
      SELECT 
        COUNT(*) as total_cleaning_records,
        SUM(CASE WHEN overall_status = 'PASS' THEN 1 ELSE 0 END) as pass_cleaning_records,
        SUM(CASE WHEN overall_status = 'FAIL' OR overall_status = 'ACTION_REQUIRED' THEN 1 ELSE 0 END) as issue_cleaning_records
      FROM compliance_cleaning_records
    `);

    // Fetch list of documents grouped by D1-D11
    const documents = await db.query(`
      SELECT id, doc_code, doc_type, doc_number, title, department, version, status, effective_date, review_date, prepared_by, approved_by, item_name, lot_no, created_at
      FROM compliance_documents
      ORDER BY doc_code ASC, id DESC
    `);

    // Fetch recent Production Records (P1-P8)
    const recentProd = await db.query(`
      SELECT * FROM compliance_production_records ORDER BY id DESC LIMIT 10
    `);

    // Fetch recent Cleaning & Control Records (C1-C10)
    const recentCleaning = await db.query(`
      SELECT * FROM compliance_cleaning_records ORDER BY id DESC LIMIT 10
    `);

    // Compliance Scheduler Items with Status
    const schedulerTasks = [
      { code: 'P3', name: 'In-Process Checklist', category: 'Production Records', frequency: 'Daily', last_done: 'Today', status: 'ON_TRACK', due_next: 'Daily per batch' },
      { code: 'P4', name: 'CCP Monitoring Records', category: 'Production Records', frequency: 'Daily (2-Hourly)', last_done: 'Today', status: 'ON_TRACK', due_next: 'Ongoing' },
      { code: 'C1', name: 'Production Area Cleaning', category: 'Cleaning & Control', frequency: 'Daily', last_done: 'Today', status: 'COMPLETED', due_next: 'Tomorrow 08:00 AM' },
      { code: 'C4', name: 'Pest Control Monitoring', category: 'Cleaning & Control', frequency: 'Daily', last_done: 'Today', status: 'COMPLETED', due_next: 'Tomorrow' },
      { code: 'C6', name: 'Toilet Cleaning Checklist', category: 'Cleaning & Control', frequency: 'Daily', last_done: 'Today', status: 'COMPLETED', due_next: 'Tomorrow' },
      { code: 'C9', name: 'Food Handler Personal Hygiene', category: 'Cleaning & Control', frequency: 'Daily', last_done: 'Today', status: 'COMPLETED', due_next: 'Tomorrow' },
      { code: 'C2', name: 'Wooden Pallet Control', category: 'Cleaning & Control', frequency: '15 Days Once', last_done: '10/08/2026', status: 'ON_TRACK', due_next: '25/08/2026' },
      { code: 'C3', name: 'Glass & Plastic Control', category: 'Cleaning & Control', frequency: '15 Days Once', last_done: '08/08/2026', status: 'ON_TRACK', due_next: '23/08/2026' },
      { code: 'C7', name: 'Visitor Declaration', category: 'Cleaning & Control', frequency: 'Monthly Once', last_done: '01/08/2026', status: 'ON_TRACK', due_next: '01/09/2026' },
      { code: 'C10', name: 'Machinery Checklist', category: 'Cleaning & Control', frequency: 'Monthly Once', last_done: '01/08/2026', status: 'ON_TRACK', due_next: '01/09/2026' },
      { code: 'P1', name: 'Income Quality Report', category: 'Production Records', frequency: 'RM Receiving', last_done: 'On Consignment', status: 'EVENT_BASED', due_next: 'Upon Inward' },
      { code: 'C8', name: 'Packing Material Inspection', category: 'Cleaning & Control', frequency: 'PM Receiving', last_done: 'On Consignment', status: 'EVENT_BASED', due_next: 'Upon Inward' },
      { code: 'P2', name: 'Fumigation Records', category: 'Production Records', frequency: 'Loading', last_done: 'On Dispatch', status: 'EVENT_BASED', due_next: 'Upon Loading' },
      { code: 'P6', name: 'Certificate of Analysis (COA)', category: 'Production Records', frequency: 'Loading', last_done: 'On Dispatch', status: 'EVENT_BASED', due_next: 'Upon Loading' },
      { code: 'P7', name: 'Terminal Inspection Record', category: 'Production Records', frequency: 'Loading', last_done: 'On Dispatch', status: 'EVENT_BASED', due_next: 'Upon Loading' },
      { code: 'C5', name: 'Vehicle Loading / Unloading', category: 'Cleaning & Control', frequency: 'Loading', last_done: 'On Dispatch', status: 'EVENT_BASED', due_next: 'Upon Loading' },
    ];

    res.json({
      success: true,
      summary: {
        totalDocs: docCounts.rows[0]?.total_docs || 0,
        approvedDocs: docCounts.rows[0]?.approved_docs || 0,
        reviewDocs: docCounts.rows[0]?.review_docs || 0,
        totalProdRecords: prodRecordCounts.rows[0]?.total_prod_records || 0,
        totalCleaningRecords: cleaningRecordCounts.rows[0]?.total_cleaning_records || 0,
        complianceHealthScore: 98.5
      },
      documents: documents.rows || [],
      recentProd: recentProd.rows || [],
      recentCleaning: recentCleaning.rows || [],
      schedulerTasks
    });
  } catch (err) {
    console.error('Error fetching compliance dashboard:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 2. CONTROLLED DOCUMENTS (D1 to D11) CRUD & DETAIL API
// ============================================================================

// List documents by doc_code (e.g. D1, D2, or ALL)
router.get('/documents', async (req, res) => {
  try {
    const { doc_code, doc_type, search } = req.query;
    let query = `SELECT * FROM compliance_documents WHERE 1=1`;
    const params = [];

    if (doc_code) {
      query += ` AND doc_code = ?`;
      params.push(doc_code);
    }
    if (doc_type) {
      query += ` AND doc_type = ?`;
      params.push(doc_type);
    }
    if (search) {
      query += ` AND (title LIKE ? OR doc_number LIKE ? OR item_name LIKE ? OR department LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY doc_code ASC, id DESC`;
    const result = await db.query(query, params);

    // Parse details_json
    const parsedRows = (result.rows || []).map(r => {
      let parsed = {};
      try {
        parsed = typeof r.details_json === 'string' ? JSON.parse(r.details_json) : (r.details_json || {});
      } catch (e) {
        parsed = {};
      }
      return { ...r, details: parsed };
    });

    res.json({ success: true, documents: parsedRows });
  } catch (err) {
    console.error('Error fetching compliance documents:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single document by ID
router.get('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`SELECT * FROM compliance_documents WHERE id = ?`, [id]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    const doc = result.rows[0];
    let details = {};
    try {
      details = typeof doc.details_json === 'string' ? JSON.parse(doc.details_json) : (doc.details_json || {});
    } catch (e) {
      details = {};
    }
    res.json({ success: true, document: { ...doc, details } });
  } catch (err) {
    console.error('Error fetching document by ID:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new document (D1-D11)
router.post('/documents', async (req, res) => {
  try {
    const {
      doc_code,
      doc_type,
      doc_number,
      title,
      department,
      process_stage,
      version = '1.0',
      status = 'APPROVED',
      effective_date,
      review_date,
      prepared_by,
      approved_by,
      verified_by,
      item_id,
      item_name,
      item_group,
      lot_no,
      supplier_id,
      supplier_name,
      employee_id,
      employee_name,
      details,
      remarks,
      attachment_url
    } = req.body;

    if (!doc_code || !doc_number || !title) {
      return res.status(400).json({ success: false, message: 'Doc Code, Doc Number and Title are required' });
    }

    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details || '{}');

    const result = await db.run(`
      INSERT INTO compliance_documents (
        doc_code, doc_type, doc_number, title, department, process_stage, version, status,
        effective_date, review_date, prepared_by, approved_by, verified_by,
        item_id, item_name, item_group, lot_no, supplier_id, supplier_name,
        employee_id, employee_name, details_json, remarks, attachment_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      doc_code, doc_type || doc_code, doc_number, title, department, process_stage, version, status,
      effective_date || new Date().toISOString().split('T')[0],
      review_date,
      prepared_by, approved_by, verified_by,
      item_id, item_name, item_group, lot_no, supplier_id, supplier_name,
      employee_id, employee_name, detailsStr, remarks, attachment_url
    ]);

    res.json({ success: true, message: 'Document created successfully', id: result.lastID });
  } catch (err) {
    console.error('Error creating compliance document:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update document
router.put('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      doc_code,
      doc_type,
      doc_number,
      title,
      department,
      process_stage,
      version,
      status,
      effective_date,
      review_date,
      prepared_by,
      approved_by,
      verified_by,
      item_id,
      item_name,
      item_group,
      lot_no,
      supplier_id,
      supplier_name,
      employee_id,
      employee_name,
      details,
      remarks,
      attachment_url
    } = req.body;

    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details || '{}');

    await db.run(`
      UPDATE compliance_documents SET
        doc_code = COALESCE(?, doc_code),
        doc_type = COALESCE(?, doc_type),
        doc_number = COALESCE(?, doc_number),
        title = COALESCE(?, title),
        department = COALESCE(?, department),
        process_stage = COALESCE(?, process_stage),
        version = COALESCE(?, version),
        status = COALESCE(?, status),
        effective_date = COALESCE(?, effective_date),
        review_date = COALESCE(?, review_date),
        prepared_by = COALESCE(?, prepared_by),
        approved_by = COALESCE(?, approved_by),
        verified_by = COALESCE(?, verified_by),
        item_id = COALESCE(?, item_id),
        item_name = COALESCE(?, item_name),
        item_group = COALESCE(?, item_group),
        lot_no = COALESCE(?, lot_no),
        supplier_id = COALESCE(?, supplier_id),
        supplier_name = COALESCE(?, supplier_name),
        employee_id = COALESCE(?, employee_id),
        employee_name = COALESCE(?, employee_name),
        details_json = ?,
        remarks = COALESCE(?, remarks),
        attachment_url = COALESCE(?, attachment_url),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      doc_code, doc_type, doc_number, title, department, process_stage, version, status,
      effective_date, review_date, prepared_by, approved_by, verified_by,
      item_id, item_name, item_group, lot_no, supplier_id, supplier_name,
      employee_id, employee_name, detailsStr, remarks, attachment_url, id
    ]);

    res.json({ success: true, message: 'Document updated successfully' });
  } catch (err) {
    console.error('Error updating compliance document:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete document
router.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run(`DELETE FROM compliance_documents WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 3. PRODUCTION RECORDS (P1 to P8) API
// ============================================================================

router.get('/production-records', async (req, res) => {
  try {
    const { record_code, lot_no } = req.query;
    let query = `SELECT * FROM compliance_production_records WHERE 1=1`;
    const params = [];

    if (record_code) {
      query += ` AND record_code = ?`;
      params.push(record_code);
    }
    if (lot_no) {
      query += ` AND lot_no LIKE ?`;
      params.push(`%${lot_no}%`);
    }

    query += ` ORDER BY id DESC`;
    const resRows = await db.query(query, params);

    const parsed = (resRows.rows || []).map(r => {
      let findings = {};
      try {
        findings = typeof r.findings_json === 'string' ? JSON.parse(r.findings_json) : (r.findings_json || {});
      } catch (e) {
        findings = {};
      }
      return { ...r, findings };
    });

    res.json({ success: true, records: parsed });
  } catch (err) {
    console.error('Error fetching production records:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/production-records', async (req, res) => {
  try {
    const {
      record_code,
      record_type,
      record_no,
      record_date = new Date().toISOString().split('T')[0],
      frequency,
      item_id,
      item_name,
      lot_no,
      purchase_id,
      purchase_no,
      sales_id,
      invoice_no,
      customer_name,
      supplier_name,
      vehicle_no,
      stage_name,
      status = 'COMPLETED',
      checked_by,
      verified_by,
      approved_by,
      findings,
      action_taken,
      remarks
    } = req.body;

    const findingsStr = typeof findings === 'object' ? JSON.stringify(findings) : (findings || '{}');

    const result = await db.run(`
      INSERT INTO compliance_production_records (
        record_code, record_type, record_no, record_date, frequency,
        item_id, item_name, lot_no, purchase_id, purchase_no, sales_id, invoice_no,
        customer_name, supplier_name, vehicle_no, stage_name, status,
        checked_by, verified_by, approved_by, findings_json, action_taken, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record_code, record_type || record_code, record_no, record_date, frequency,
      item_id, item_name, lot_no, purchase_id, purchase_no, sales_id, invoice_no,
      customer_name, supplier_name, vehicle_no, stage_name, status,
      checked_by, verified_by, approved_by, findingsStr, action_taken, remarks
    ]);

    res.json({ success: true, message: 'Production record saved successfully', id: result.lastID });
  } catch (err) {
    console.error('Error creating production record:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 4. CLEANING & CONTROL RECORDS (C1 to C10) API
// ============================================================================

router.get('/cleaning-records', async (req, res) => {
  try {
    const { record_code, frequency, status, overall_status, from_date, to_date, search } = req.query;
    let query = `SELECT * FROM compliance_cleaning_records WHERE 1=1`;
    const params = [];

    if (record_code && record_code !== 'ALL') {
      query += ` AND record_code = ?`;
      params.push(record_code);
    }
    if (frequency) {
      query += ` AND frequency LIKE ?`;
      params.push(`%${frequency}%`);
    }
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (overall_status) {
      query += ` AND overall_status = ?`;
      params.push(overall_status);
    }
    if (from_date) {
      query += ` AND record_date >= ?`;
      params.push(from_date);
    }
    if (to_date) {
      query += ` AND record_date <= ?`;
      params.push(to_date);
    }
    if (search) {
      query += ` AND (record_no LIKE ? OR area_location LIKE ? OR inspector_name LIKE ? OR supervisor_name LIKE ? OR remarks LIKE ? OR customer_name LIKE ? OR vehicle_no LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    query += ` ORDER BY record_date DESC, id DESC`;
    const resRows = await db.query(query, params);

    const parsed = (resRows.rows || []).map(r => {
      let checklist = {};
      try {
        checklist = typeof r.checklist_json === 'string' ? JSON.parse(r.checklist_json) : (r.checklist_json || {});
      } catch (e) {
        checklist = {};
      }
      return { ...r, checklist };
    });

    res.json({ success: true, records: parsed });
  } catch (err) {
    console.error('Error fetching cleaning records:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/cleaning-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resRow = await db.query(`SELECT * FROM compliance_cleaning_records WHERE id = ?`, [id]);
    if (!resRow.rows || resRow.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cleaning record not found' });
    }
    const r = resRow.rows[0];
    let checklist = {};
    try {
      checklist = typeof r.checklist_json === 'string' ? JSON.parse(r.checklist_json) : (r.checklist_json || {});
    } catch (e) {
      checklist = {};
    }
    res.json({ success: true, record: { ...r, checklist } });
  } catch (err) {
    console.error('Error fetching cleaning record by id:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/cleaning-records', async (req, res) => {
  try {
    const {
      record_code,
      record_type,
      record_no,
      record_date = new Date().toISOString().split('T')[0],
      area_location,
      frequency = 'Daily',
      company_name = 'BVC Exports Pvt. Ltd.',
      financial_year = '2026-2027',
      supervisor_name,
      inspector_name,
      prepared_by,
      verified_by,
      customer_name,
      supplier_name,
      vehicle_no,
      status = 'COMPLETED',
      overall_status = 'PASS',
      checklist,
      corrective_action,
      completion_date,
      remarks
    } = req.body;

    const checklistStr = typeof checklist === 'object' ? JSON.stringify(checklist) : (checklist || '{}');

    const result = await db.run(`
      INSERT INTO compliance_cleaning_records (
        record_code, record_type, record_no, record_date, area_location, frequency,
        company_name, financial_year, supervisor_name, inspector_name,
        prepared_by, verified_by, customer_name, supplier_name, vehicle_no,
        status, overall_status, checklist_json, corrective_action, completion_date, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record_code, record_type || record_code, record_no, record_date, area_location, frequency,
      company_name, financial_year, supervisor_name, inspector_name,
      prepared_by, verified_by, customer_name, supplier_name, vehicle_no,
      status, overall_status, checklistStr, corrective_action, completion_date, remarks
    ]);

    res.json({ success: true, message: 'Cleaning inspection record saved successfully', id: result.lastID });
  } catch (err) {
    console.error('Error creating cleaning record:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/cleaning-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      record_code,
      record_type,
      record_no,
      record_date,
      area_location,
      frequency,
      company_name,
      financial_year,
      supervisor_name,
      inspector_name,
      prepared_by,
      verified_by,
      customer_name,
      supplier_name,
      vehicle_no,
      status,
      overall_status,
      checklist,
      corrective_action,
      completion_date,
      remarks
    } = req.body;

    const checklistStr = typeof checklist === 'object' ? JSON.stringify(checklist) : (checklist || '{}');

    await db.run(`
      UPDATE compliance_cleaning_records SET
        record_code = COALESCE(?, record_code),
        record_type = COALESCE(?, record_type),
        record_no = COALESCE(?, record_no),
        record_date = COALESCE(?, record_date),
        area_location = COALESCE(?, area_location),
        frequency = COALESCE(?, frequency),
        company_name = COALESCE(?, company_name),
        financial_year = COALESCE(?, financial_year),
        supervisor_name = COALESCE(?, supervisor_name),
        inspector_name = COALESCE(?, inspector_name),
        prepared_by = COALESCE(?, prepared_by),
        verified_by = COALESCE(?, verified_by),
        customer_name = COALESCE(?, customer_name),
        supplier_name = COALESCE(?, supplier_name),
        vehicle_no = COALESCE(?, vehicle_no),
        status = COALESCE(?, status),
        overall_status = COALESCE(?, overall_status),
        checklist_json = ?,
        corrective_action = COALESCE(?, corrective_action),
        completion_date = COALESCE(?, completion_date),
        remarks = COALESCE(?, remarks)
      WHERE id = ?
    `, [
      record_code, record_type, record_no, record_date, area_location, frequency,
      company_name, financial_year, supervisor_name, inspector_name,
      prepared_by, verified_by, customer_name, supplier_name, vehicle_no,
      status, overall_status, checklistStr, corrective_action, completion_date, remarks, id
    ]);

    res.json({ success: true, message: 'Cleaning record updated successfully' });
  } catch (err) {
    console.error('Error updating cleaning record:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/cleaning-records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run(`DELETE FROM compliance_cleaning_records WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Cleaning record deleted successfully' });
  } catch (err) {
    console.error('Error deleting cleaning record:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Schedule status overview for C1 to C10
router.get('/cleaning-schedule-summary', async (req, res) => {
  try {
    const c10Meta = [
      { code: 'C1', name: 'Production Area Cleaning (BVC/CP/CL/01)', frequency: 'Daily', intervalDays: 1, type: 'CLEANING', target: 'Milling & Packaging Hall', docRef: 'BVC/CP/CL/01' },
      { code: 'C2', name: 'Machineries Cleaning (BVC/CP/CL/02)', frequency: '15 Days Once', intervalDays: 15, type: 'MAINTENANCE', target: 'Motor Cover, De-Stoner, Pulse Roller', docRef: 'BVC/CP/CL/02' },
      { code: 'C3', name: 'Pest Control Cleaning (BVC/CP/CL/03)', frequency: 'Monthly Once', intervalDays: 30, type: 'PEST_CONTROL', target: 'PCI Operators & Chemical Treatment Area', docRef: 'BVC/CP/CL/03' },
      { code: 'C4', name: 'Water Tank Cleaning (BVC/CP/CL/04)', frequency: '15 Days Once', intervalDays: 15, type: 'SANITATION', target: 'Overhead & Process Water Tanks', docRef: 'BVC/CP/CL/04' },
      { code: 'C5', name: 'Window-Glass Cleaning (BVC/CP/CL/05)', frequency: 'Monthly Once', intervalDays: 30, type: 'CLEANING', target: 'Factory Glazing & Glass Partitions', docRef: 'BVC/CP/CL/05' },
      { code: 'C6', name: 'Wood-Pallet Cleaning (BVC/CP/CL/06)', frequency: '15 Days Once', intervalDays: 15, type: 'STORAGE_CONTROL', target: 'Godown Storage Pallets', docRef: 'BVC/CP/CL/06' },
      { code: 'C7', name: 'Toilet Inspection Checklist (BVC-QA-F-05)', frequency: 'Daily', intervalDays: 1, type: 'HYGIENE', target: 'Factory Restrooms & Handwash Areas', docRef: 'BVC-QA-F-05' },
      { code: 'C8', name: 'Vehicle Loading / Unloading Inspection (BVC/QA/F/07)', frequency: 'Loading', intervalDays: 0, type: 'INSPECTION', target: 'Dispatch & Inward Trucks / Containers', docRef: 'BVC/QA/F/07' },
      { code: 'C9', name: 'Food Handlers Personal Hygiene (BVC/QA/F/01)', frequency: 'Daily', intervalDays: 1, type: 'HYGIENE', target: 'All Production & Packing Staff', docRef: 'BVC/QA/F/01' },
      { code: 'C10', name: 'Primary Packing Material Inspection (PPMI)', frequency: 'PM Receiving', intervalDays: 0, type: 'INSPECTION', target: 'Inward Bags, Liners & Packaging Supplies', docRef: 'PPMI/QA/F/08' }
    ];

    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date();

    const results = await Promise.all(c10Meta.map(async (meta) => {
      const lastRecRes = await db.query(
        `SELECT id, record_no, record_date, overall_status, inspector_name, verified_by 
         FROM compliance_cleaning_records 
         WHERE record_code = ? 
         ORDER BY record_date DESC, id DESC LIMIT 1`,
        [meta.code]
      );

      const lastRec = lastRecRes.rows && lastRecRes.rows[0] ? lastRecRes.rows[0] : null;

      let nextDueDate = null;
      let status = 'PENDING';
      let daysRemaining = null;

      if (meta.intervalDays === 0) {
        // Trigger based (e.g. Loading, PM Receiving)
        status = 'EVENT_TRIGGERED';
      } else if (lastRec && lastRec.record_date) {
        const lastDate = new Date(lastRec.record_date);
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + meta.intervalDays);
        nextDueDate = nextDate.toISOString().split('T')[0];

        const diffTime = nextDate.getTime() - today.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          status = 'OVERDUE';
        } else if (daysRemaining === 0) {
          status = 'DUE_TODAY';
        } else if (daysRemaining <= 2) {
          status = 'DUE_SOON';
        } else {
          status = 'COMPLIANT';
        }
      } else {
        status = 'PENDING';
      }

      return {
        ...meta,
        lastRecord: lastRec,
        lastCompletedDate: lastRec ? lastRec.record_date : null,
        nextDueDate,
        daysRemaining,
        scheduleStatus: status
      };
    }));

    res.json({ success: true, summary: results });
  } catch (err) {
    console.error('Error fetching cleaning schedule summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 5. P8 TRACEABILITY ENGINE (COMPREHENSIVE BACKWARD & FORWARD TRACE)
// ============================================================================
router.get('/traceability/:lotNo', async (req, res) => {
  try {
    const lotNo = (req.params.lotNo || '').trim();
    if (!lotNo) {
      return res.status(400).json({ success: false, message: 'Lot number is required' });
    }

    // 1. Find Lot in stock_lots
    const lotRes = await db.query(`SELECT * FROM stock_lots WHERE lot_no LIKE ?`, [`%${lotNo}%`]);
    const lot = lotRes.rows && lotRes.rows[0] ? lotRes.rows[0] : null;

    // 2. Backward Trace: Purchase & Supplier
    let purchaseInfo = null;
    let supplierInfo = null;
    if (lot && lot.purchase_id) {
      const purRes = await db.query(`
        SELECT p.*, 
               COALESCE(s.name, p.supplier, 'Supplier') as supplier_name, 
               COALESCE(s.phone_off, s.mobile1, p.phone, '') as supplier_phone, 
               COALESCE(s.address1, p.address, '') as supplier_address, 
               COALESCE(s.gst_number, p.gst_no, '') as supplier_gstin,
               COALESCE(p.inv_no, CAST(p.s_no AS TEXT), CAST(p.id AS TEXT)) as invoice_no
        FROM purchases p
        LEFT JOIN supplier_master s ON (p.supplier = s.name OR p.supplier = s.print_name)
        WHERE p.id = ?
      `, [lot.purchase_id]);
      if (purRes.rows && purRes.rows[0]) {
        purchaseInfo = purRes.rows[0];
      }
    } else {
      // Search purchases by lot_no in purchase_items
      const purByItemRes = await db.query(`
        SELECT p.*, pi.item_name, pi.qty, pi.rate, pi.amount, pi.lot_no, 
               COALESCE(s.name, p.supplier, 'Supplier') as supplier_name, 
               COALESCE(s.phone_off, s.mobile1, p.phone, '') as supplier_phone,
               COALESCE(s.address1, p.address, '') as supplier_address,
               COALESCE(s.gst_number, p.gst_no, '') as supplier_gstin,
               COALESCE(p.inv_no, CAST(p.s_no AS TEXT), CAST(p.id AS TEXT)) as invoice_no
        FROM purchases p
        JOIN purchase_items pi ON p.id = pi.purchase_id
        LEFT JOIN supplier_master s ON (p.supplier = s.name OR p.supplier = s.print_name)
        WHERE pi.lot_no LIKE ?
      `, [`%${lotNo}%`]);
      if (purByItemRes.rows && purByItemRes.rows[0]) {
        purchaseInfo = purByItemRes.rows[0];
      }
    }

    // 3. Backward Trace: Inward Quality Inspections
    const qcRes = await db.query(`
      SELECT * FROM qc_inspections WHERE rm_lot_no LIKE ? OR purchase_id = ?
    `, [`%${lotNo}%`, purchaseInfo ? purchaseInfo.id : -1]);
    const qcRecords = qcRes.rows || [];

    // 4. In-Process & Production Transformation (Grains / Work Orders)
    const grainRes = await db.query(`
      SELECT g.*, gi.item_name as input_item, gi.qty as input_qty, go.item_name as output_item, go.qty as output_qty, go.lot_no as output_lot
      FROM grains g
      LEFT JOIN grain_input_items gi ON g.id = gi.grain_id
      LEFT JOIN grain_output_items go ON g.id = go.grain_id
      WHERE gi.lot_no LIKE ? OR go.lot_no LIKE ? OR g.work_order_no LIKE ? OR CAST(g.s_no AS TEXT) LIKE ?
    `, [`%${lotNo}%`, `%${lotNo}%`, `%${lotNo}%`, `%${lotNo}%`]);

    const workOrderRes = await db.query(`
      SELECT wo.*, woi.item_name as input_item, woi.lot_no as input_lot, woo.output_item as output_item, woo.fg_lot_no as output_lot
      FROM work_orders wo
      LEFT JOIN work_order_items woi ON wo.id = woi.work_order_id
      LEFT JOIN work_order_outputs woo ON wo.id = woo.work_order_id
      WHERE woi.lot_no LIKE ? OR woo.fg_lot_no LIKE ?
    `, [`%${lotNo}%`, `%${lotNo}%`]);

    // 5. Current Inventory Ledger Balances for this Lot
    const stockRes = await db.query(`
      SELECT item_name, godown, godown_id, lot_no, SUM(qty) as available_qty, AVG(rate) as rate
      FROM stock
      WHERE lot_no LIKE ?
      GROUP BY item_name, godown, godown_id, lot_no
    `, [`%${lotNo}%`]);

    // 6. Forward Trace: Sales & Customer Dispatches
    const salesRes = await db.query(`
      SELECT s.*, si.item_name, si.qty as sold_qty, si.rate as sold_rate, si.total_amt as sold_amount, si.lot_no,
             COALESCE(c.name, s.customer, 'Customer') as customer_name, 
             COALESCE(c.phone_off, c.mobile1, s.phone, '') as customer_phone, 
             COALESCE(c.address1, s.address, '') as customer_address, 
             COALESCE(c.area, '') as customer_city,
             COALESCE(CAST(s.s_no AS TEXT), s.p_o_no, CAST(s.id AS TEXT)) as invoice_no
      FROM sales s
      JOIN sales_items si ON s.id = si.sales_id
      LEFT JOIN customer_master c ON (s.customer_id = c.id OR s.customer = c.name OR s.customer = c.print_name)
      WHERE si.lot_no LIKE ?
    `, [`%${lotNo}%`]);

    // 7. Compliance and Quality Logs linked to this Lot
    const compDocRes = await db.query(`
      SELECT id, doc_code, doc_type, doc_number, title, status, effective_date 
      FROM compliance_documents 
      WHERE lot_no LIKE ?
    `, [`%${lotNo}%`]);

    const compProdRes = await db.query(`
      SELECT * FROM compliance_production_records WHERE lot_no LIKE ?
    `, [`%${lotNo}%`]);

    res.json({
      success: true,
      lotNo,
      lotDetails: lot,
      backwardTrace: {
        purchase: purchaseInfo,
        supplier: supplierInfo || (purchaseInfo ? { name: purchaseInfo.supplier_name || purchaseInfo.supplier } : null),
        inwardQC: qcRecords
      },
      productionHistory: {
        grindBatches: grainRes.rows || [],
        workOrders: workOrderRes.rows || []
      },
      currentStock: stockRes.rows || [],
      forwardTrace: {
        dispatches: salesRes.rows || [],
        affectedCustomers: (salesRes.rows || []).map(s => ({
          customer_name: s.customer_name || s.customer,
          invoice_no: s.invoice_no,
          date: s.date,
          qty: s.sold_qty,
          phone: s.customer_phone,
          city: s.customer_city
        }))
      },
      qualityComplianceRecords: {
        documents: compDocRes.rows || [],
        productionChecks: compProdRes.rows || []
      }
    });
  } catch (err) {
    console.error('Error generating traceability:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 6. D9 RECALL SIMULATOR & WORKFLOW ENGINE
// ============================================================================
router.post('/recall/simulate', async (req, res) => {
  try {
    const { item_name, lot_no } = req.body;
    if (!lot_no) {
      return res.status(400).json({ success: false, message: 'Lot number is required for recall simulation' });
    }

    // 1. Inward Purchase info
    const purRes = await db.query(`
      SELECT p.id, COALESCE(p.inv_no, CAST(p.s_no AS TEXT), CAST(p.id AS TEXT)) as invoice_no, p.date, 
             COALESCE(p.supplier, 'Supplier Records') as supplier_name, 
             pi.item_name, pi.qty as inward_qty, pi.lot_no
      FROM purchases p
      JOIN purchase_items pi ON p.id = pi.purchase_id
      WHERE pi.lot_no LIKE ?
    `, [`%${lot_no}%`]);
    const purchase = purRes.rows && purRes.rows[0] ? purRes.rows[0] : null;

    // 2. Current In-House Stock
    const stockRes = await db.query(`
      SELECT item_name, godown, lot_no, SUM(qty) as available_qty
      FROM stock
      WHERE lot_no LIKE ?
      GROUP BY item_name, godown, lot_no
    `, [`%${lot_no}%`]);
    const currentStockList = stockRes.rows || [];
    const totalCurrentStock = currentStockList.reduce((sum, s) => sum + (parseFloat(s.available_qty) || 0), 0);

    // 3. Sold Stock & Customers
    const salesRes = await db.query(`
      SELECT s.id, COALESCE(CAST(s.s_no AS TEXT), s.p_o_no, CAST(s.id AS TEXT)) as invoice_no, s.date, 
             COALESCE(s.customer, 'Customer Records') as customer_name, 
             si.item_name, si.qty as sold_qty, si.lot_no
      FROM sales s
      JOIN sales_items si ON s.id = si.sales_id
      WHERE si.lot_no LIKE ?
    `, [`%${lot_no}%`]);
    const salesList = salesRes.rows || [];
    const totalSoldQty = salesList.reduce((sum, s) => sum + (parseFloat(s.sold_qty) || 0), 0);

    const totalInwardQty = purchase ? purchase.inward_qty : (totalCurrentStock + totalSoldQty);

    res.json({
      success: true,
      simulation: {
        lot_no,
        item_name: item_name || (purchase ? purchase.item_name : (currentStockList[0]?.item_name || 'Item')),
        inward_qty: totalInwardQty,
        supplier_name: purchase ? purchase.supplier_name : 'Supplier Records',
        purchase_invoice: purchase ? purchase.invoice_no : 'N/A',
        current_inhouse_stock: totalCurrentStock,
        godown_breakdown: currentStockList,
        sold_qty: totalSoldQty,
        affected_customers: salesList,
        reconciliation_percentage: totalInwardQty > 0 ? (((totalCurrentStock + totalSoldQty) / totalInwardQty) * 100).toFixed(1) : 100,
        suggested_actions: [
          `Place immediate quarantine hold on ${totalCurrentStock} Kg in factory godowns`,
          `Issue urgent recall notice to ${salesList.length} customer(s) who received ${totalSoldQty} Kg`,
          `Notify Designated Food Safety Officer (FSSAI) within 24 hours under Food Recall Regulations`
        ]
      }
    });
  } catch (err) {
    console.error('Error generating recall simulation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 6. MASTER 29-DOCUMENT REGISTER & ENGINE APIS
// ============================================================================

const MASTER_DOCUMENT_CONFIG = [
  // PRODUCTION RECORDS (P1 to P8)
  { code: 'P1', name: 'Income Quality Report', category: 'PRODUCTION_RECORD', creation_mode: 'HYBRID', frequency: 'RM Receiving', erp_data: 'Item / Lot / Godown / Purchase', requires_inventory: true, requires_lot: true, requires_employee: false, requires_file: false },
  { code: 'P2', name: 'Fumigation Records', category: 'PRODUCTION_RECORD', creation_mode: 'HYBRID', frequency: 'Loading / Storage', erp_data: 'Loading / Storage / Vehicle', requires_inventory: false, requires_lot: true, requires_employee: false, requires_file: false },
  { code: 'P3', name: 'In Process Checklist', category: 'PRODUCTION_RECORD', creation_mode: 'HYBRID', frequency: 'Daily / Per Batch', erp_data: 'Production / Grind / Batch', requires_inventory: true, requires_lot: true, requires_employee: false, requires_file: false },
  { code: 'P4', name: 'CCP Monitoring Records', category: 'PRODUCTION_RECORD', creation_mode: 'HYBRID', frequency: 'Daily (2-Hourly)', erp_data: 'Grind / CCP / Critical Limits', requires_inventory: true, requires_lot: true, requires_employee: false, requires_file: false },
  { code: 'P5', name: 'Product Changeover Record', category: 'PRODUCTION_RECORD', creation_mode: 'HYBRID', frequency: 'Per Changeover', erp_data: 'Previous & New Product Line Clearance', requires_inventory: true, requires_lot: true, requires_employee: false, requires_file: false },
  { code: 'P6', name: 'Certificate of Analysis (COA)', category: 'PRODUCTION_RECORD', creation_mode: 'ERP_GENERATED', frequency: 'Loading / Release', erp_data: 'QC Test Results / Lot / Item', requires_inventory: true, requires_lot: true, requires_employee: false, requires_file: true },
  { code: 'P7', name: 'Terminal Inspection Record', category: 'PRODUCTION_RECORD', creation_mode: 'HYBRID', frequency: 'Loading', erp_data: 'Shipment / Vehicle / Packaging', requires_inventory: true, requires_lot: true, requires_employee: false, requires_file: false },
  { code: 'P8', name: 'Traceability Engine', category: 'PRODUCTION_RECORD', creation_mode: 'ERP_FETCH', frequency: 'Full Lifecycle Trace', erp_data: 'Raw Material -> Purchase -> Lot -> Grind -> FG -> Sales -> Customer', requires_inventory: true, requires_lot: true, requires_employee: false, requires_file: false },

  // CLEANING RECORDS (C1 to C10)
  { code: 'C1', name: 'Production Area Cleaning', category: 'CLEANING_RECORD', creation_mode: 'CHECKLIST', frequency: 'Daily', erp_data: 'Milling & Packaging Hall', requires_inventory: false, requires_lot: false, requires_employee: true, requires_file: false },
  { code: 'C2', name: 'Machineries Cleaning', category: 'CLEANING_RECORD', creation_mode: 'CHECKLIST', frequency: '15 Days Once', erp_data: 'Motor Cover, De-Stoner, Pulse Roller', requires_inventory: false, requires_lot: false, requires_employee: true, requires_file: false },
  { code: 'C3', name: 'Pest Control Cleaning', category: 'CLEANING_RECORD', creation_mode: 'CHECKLIST', frequency: 'Monthly Once', erp_data: 'PCI Operators & Chemical Treatment Area', requires_inventory: false, requires_lot: false, requires_employee: true, requires_file: false },
  { code: 'C4', name: 'Water Tank Cleaning', category: 'CLEANING_RECORD', creation_mode: 'CHECKLIST', frequency: '15 Days Once', erp_data: 'Overhead & Process Water Tanks', requires_inventory: false, requires_lot: false, requires_employee: true, requires_file: false },
  { code: 'C5', name: 'Window-Glass Cleaning', category: 'CLEANING_RECORD', creation_mode: 'CHECKLIST', frequency: 'Monthly Once', erp_data: 'Factory Glazing & Glass Partitions', requires_inventory: false, requires_lot: false, requires_employee: true, requires_file: false },
  { code: 'C6', name: 'Wood-Pallet Cleaning', category: 'CLEANING_RECORD', creation_mode: 'CHECKLIST', frequency: '15 Days Once', erp_data: 'Godown Storage Pallets', requires_inventory: false, requires_lot: false, requires_employee: true, requires_file: false },
  { code: 'C7', name: 'Toilet Inspection Checklist', category: 'CLEANING_RECORD', creation_mode: 'CHECKLIST', frequency: 'Daily', erp_data: 'Factory Restrooms & Handwash Areas', requires_inventory: false, requires_lot: false, requires_employee: true, requires_file: false },
  { code: 'C8', name: 'Vehicle Loading / Unloading Inspection', category: 'CLEANING_RECORD', creation_mode: 'HYBRID', frequency: 'Loading', erp_data: 'Dispatch & Inward Trucks / Containers', requires_inventory: false, requires_lot: false, requires_employee: false, requires_file: false },
  { code: 'C9', name: 'Food Handlers Personal Hygiene', category: 'CLEANING_RECORD', creation_mode: 'CHECKLIST', frequency: 'Daily', erp_data: 'All Production & Packing Staff', requires_inventory: false, requires_lot: false, requires_employee: true, requires_file: false },
  { code: 'C10', name: 'Primary Packing Material Inspection', category: 'CLEANING_RECORD', creation_mode: 'HYBRID', frequency: 'PM Receiving', erp_data: 'Inward Bags, Liners & Packaging Supplies', requires_inventory: true, requires_lot: true, requires_employee: false, requires_file: false },

  // CONTROLLED DOCUMENTS (D1 to D11)
  { code: 'D1', name: 'Work Instruction File', category: 'CONTROLLED_DOCUMENT', creation_mode: 'CONTROLLED_DOCUMENT', frequency: 'Annual Review', erp_data: 'Standard Work Instructions', requires_inventory: false, requires_lot: false, requires_employee: false, requires_file: true },
  { code: 'D2', name: 'Hazard / CCP / OPRP / VACCP Plan', category: 'CONTROLLED_DOCUMENT', creation_mode: 'CONTROLLED_DOCUMENT', frequency: 'Annual Review', erp_data: 'Hazard Analysis & CCP Control Limits', requires_inventory: false, requires_lot: false, requires_employee: false, requires_file: true },
  { code: 'D3', name: 'MTR Signed Specification', category: 'CONTROLLED_DOCUMENT', creation_mode: 'HYBRID', frequency: 'Annual / Supplier', erp_data: 'Raw Material / Supplier Specs', requires_inventory: true, requires_lot: false, requires_employee: false, requires_file: true },
  { code: 'D4', name: 'Training Record', category: 'CONTROLLED_DOCUMENT', creation_mode: 'HYBRID', frequency: 'Monthly / Event', erp_data: 'Employee Master / Competency', requires_inventory: false, requires_lot: false, requires_employee: true, requires_file: true },
  { code: 'D5', name: 'SOPs Repository', category: 'CONTROLLED_DOCUMENT', creation_mode: 'CONTROLLED_DOCUMENT', frequency: 'Annual Review', erp_data: 'Standard Operating Procedures', requires_inventory: false, requires_lot: false, requires_employee: false, requires_file: true },
  { code: 'D6', name: 'RCCA Record (Root Cause & CAPA)', category: 'CONTROLLED_DOCUMENT', creation_mode: 'HYBRID', frequency: 'On Non-Conformance', erp_data: '5-Why / Non-Conformance Incident', requires_inventory: true, requires_lot: true, requires_employee: true, requires_file: true },
  { code: 'D7', name: 'Medical Fitness Certificate', category: 'CONTROLLED_DOCUMENT', creation_mode: 'HYBRID', frequency: 'Annual / Bi-annual', erp_data: 'Employee Master / Medical Expiry', requires_inventory: false, requires_lot: false, requires_employee: true, requires_file: true },
  { code: 'D8', name: 'FOSTAC Training Certificate', category: 'CONTROLLED_DOCUMENT', creation_mode: 'HYBRID', frequency: 'Every 2 Years', erp_data: 'Employee Master / FOSTAC Validity', requires_inventory: false, requires_lot: false, requires_employee: true, requires_file: true },
  { code: 'D9', name: 'Recall / Withdraw System', category: 'CONTROLLED_DOCUMENT', creation_mode: 'HYBRID', frequency: 'Bi-annual Mock Drill', erp_data: 'Lot / Inward / Outward Traceability', requires_inventory: true, requires_lot: true, requires_employee: false, requires_file: true },
  { code: 'D10', name: 'Halal Declaration', category: 'CONTROLLED_DOCUMENT', creation_mode: 'CONTROLLED_DOCUMENT', frequency: 'Annual Renewal', erp_data: 'Product / Cross-contamination Assurance', requires_inventory: true, requires_lot: false, requires_employee: false, requires_file: true },
  { code: 'D11', name: 'Process Flow Chart', category: 'CONTROLLED_DOCUMENT', creation_mode: 'CONTROLLED_DOCUMENT', frequency: 'Annual Review', erp_data: 'Manufacturing Process Stages', requires_inventory: false, requires_lot: false, requires_employee: false, requires_file: true },
];

// GET /api/compliance/master-register
router.get('/master-register', async (req, res) => {
  try {
    // Get entry counts and latest date per doc_code
    const docCounts = await db.query(`
      SELECT doc_code, COUNT(*) as count, MAX(created_at) as last_date, MAX(status) as status
      FROM compliance_documents
      GROUP BY doc_code
    `);
    const docMap = {};
    (docCounts.rows || []).forEach(r => {
      docMap[r.doc_code] = r;
    });

    const prodCounts = await db.query(`
      SELECT record_code, COUNT(*) as count, MAX(record_date) as last_date, MAX(status) as status
      FROM compliance_production_records
      GROUP BY record_code
    `);
    const prodMap = {};
    (prodCounts.rows || []).forEach(r => {
      prodMap[r.record_code] = r;
    });

    const cleanCounts = await db.query(`
      SELECT record_code, COUNT(*) as count, MAX(record_date) as last_date, MAX(overall_status) as status
      FROM compliance_cleaning_records
      GROUP BY record_code
    `);
    const cleanMap = {};
    (cleanCounts.rows || []).forEach(r => {
      cleanMap[r.record_code] = r;
    });

    const enrichedList = MASTER_DOCUMENT_CONFIG.map((item, idx) => {
      let stats = null;
      if (item.category === 'CONTROLLED_DOCUMENT') {
        stats = docMap[item.code] || { count: 0, last_date: null, status: 'Active' };
      } else if (item.category === 'PRODUCTION_RECORD') {
        stats = prodMap[item.code] || { count: 0, last_date: null, status: 'Logged' };
      } else {
        stats = cleanMap[item.code] || { count: 0, last_date: null, status: 'Logged' };
      }

      return {
        s_no: idx + 1,
        ...item,
        record_count: stats.count || 0,
        last_entry: stats.last_date || 'No entries yet',
        current_status: stats.status || 'Active',
      };
    });

    res.json({
      success: true,
      total_count: MASTER_DOCUMENT_CONFIG.length,
      categories: {
        production: MASTER_DOCUMENT_CONFIG.filter(d => d.category === 'PRODUCTION_RECORD').length,
        cleaning: MASTER_DOCUMENT_CONFIG.filter(d => d.category === 'CLEANING_RECORD').length,
        controlled: MASTER_DOCUMENT_CONFIG.filter(d => d.category === 'CONTROLLED_DOCUMENT').length,
      },
      documents: enrichedList,
    });
  } catch (err) {
    console.error('Error fetching master register:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/compliance/today-required
router.get('/today-required', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    // Check which daily/required records have been logged today
    const prodToday = await db.query(`
      SELECT record_code, COUNT(*) as count, MAX(record_no) as last_no
      FROM compliance_production_records
      WHERE record_date = ? OR record_date = DATE('now')
      GROUP BY record_code
    `, [today]);
    const prodMap = {};
    (prodToday.rows || []).forEach(r => { prodMap[r.record_code] = r; });

    const cleanToday = await db.query(`
      SELECT record_code, COUNT(*) as count, MAX(record_no) as last_no, MAX(overall_status) as status
      FROM compliance_cleaning_records
      WHERE record_date = ? OR record_date = DATE('now')
      GROUP BY record_code
    `, [today]);
    const cleanMap = {};
    (cleanToday.rows || []).forEach(r => { cleanMap[r.record_code] = r; });

    const dailyItems = [
      { code: 'P4', name: 'CCP Monitoring Records', category: 'Production Records', frequency: 'Daily (2-Hourly)', required: true },
      { code: 'P3', name: 'In Process Checklist', category: 'Production Records', frequency: 'Daily / Per Batch', required: true },
      { code: 'C1', name: 'Production Area Cleaning', category: 'Cleaning Records', frequency: 'Daily', required: true },
      { code: 'C4', name: 'Pest Control Monitoring', category: 'Cleaning Records', frequency: 'Daily', required: true },
      { code: 'C6', name: 'Toilet Cleaning Checklist', category: 'Cleaning Records', frequency: 'Daily', required: true },
      { code: 'C9', name: 'Food Handlers Personal Hygiene', category: 'Cleaning Records', frequency: 'Daily', required: true },
      { code: 'C2', name: 'Wooden Pallet Control', category: 'Cleaning Records', frequency: '15 Days Once', required: false },
      { code: 'C3', name: 'Glass and Plastic Control', category: 'Cleaning Records', frequency: '15 Days Once', required: false },
    ];

    const result = dailyItems.map(item => {
      const isProd = item.category === 'Production Records';
      const entry = isProd ? prodMap[item.code] : cleanMap[item.code];
      const isDone = Boolean(entry && entry.count > 0);
      return {
        ...item,
        is_completed: isDone,
        status: isDone ? 'COMPLETED' : 'PENDING',
        last_no: entry ? entry.last_no : null,
      };
    });

    const pendingCount = result.filter(r => r.required && !r.is_completed).length;

    res.json({
      success: true,
      today,
      pendingCount,
      completedCount: result.filter(r => r.is_completed).length,
      records: result,
    });
  } catch (err) {
    console.error('Error fetching today required:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/compliance/expiring
router.get('/expiring', async (req, res) => {
  try {
    // Fetch certificates and controlled documents with review / expiry dates
    const docs = await db.query(`
      SELECT id, doc_code, doc_type, doc_number, title, employee_name, supplier_name, item_name,
             effective_date, review_date, version, status, attachment_url
      FROM compliance_documents
      WHERE review_date IS NOT NULL AND review_date != ''
      ORDER BY review_date ASC
    `);

    const today = new Date();
    const list = (docs.rows || []).map(doc => {
      const revDate = new Date(doc.review_date);
      const diffTime = revDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let expiryStatus = 'VALID';
      if (diffDays < 0) {
        expiryStatus = 'EXPIRED';
      } else if (diffDays <= 30) {
        expiryStatus = 'EXPIRING_SOON';
      } else if (diffDays <= 60) {
        expiryStatus = 'UPCOMING_REVIEW';
      }

      return {
        ...doc,
        days_remaining: diffDays,
        expiry_status: expiryStatus,
      };
    });

    res.json({
      success: true,
      total_tracked: list.length,
      expired_count: list.filter(d => d.expiry_status === 'EXPIRED').length,
      expiring_soon_count: list.filter(d => d.expiry_status === 'EXPIRING_SOON').length,
      documents: list,
    });
  } catch (err) {
    console.error('Error fetching expiring documents:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/compliance/pending
router.get('/pending', async (req, res) => {
  try {
    // 1. Unapproved or review docs
    const reviewDocs = await db.query(`
      SELECT id, doc_code, doc_type, doc_number, title, department, version, status, effective_date, prepared_by
      FROM compliance_documents
      WHERE status = 'UNDER_REVIEW' OR status = 'DRAFT'
      ORDER BY id DESC
    `);

    // 2. Pending today checklists
    const today = new Date().toISOString().slice(0, 10);
    const cleanToday = await db.query(`
      SELECT record_code FROM compliance_cleaning_records WHERE record_date = ?
    `, [today]);
    const cleanDone = new Set((cleanToday.rows || []).map(r => r.record_code));

    const pendingChecklists = [
      { code: 'C1', name: 'Production Area Cleaning', frequency: 'Daily' },
      { code: 'C4', name: 'Pest Control Monitoring', frequency: 'Daily' },
      { code: 'C6', name: 'Toilet Cleaning Checklist', frequency: 'Daily' },
      { code: 'C9', name: 'Food Handlers Personal Hygiene', frequency: 'Daily' },
      { code: 'P4', name: 'CCP Monitoring Records', frequency: 'Daily (2-Hourly)' },
      { code: 'P3', name: 'In Process Checklist', frequency: 'Daily / Batch' },
    ].filter(item => !cleanDone.has(item.code));

    res.json({
      success: true,
      pending_reviews: reviewDocs.rows || [],
      pending_reviews_count: (reviewDocs.rows || []).length,
      pending_checklists: pendingChecklists,
      pending_checklists_count: pendingChecklists.length,
      total_pending: (reviewDocs.rows || []).length + pendingChecklists.length,
    });
  } catch (err) {
    console.error('Error fetching pending documents:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

