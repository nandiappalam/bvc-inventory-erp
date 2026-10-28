const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Ensure tables exist on load
let tablesInitialized = false;
async function ensureTables() {
  if (tablesInitialized) return;
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS hand_sorting_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        job_no TEXT UNIQUE NOT NULL,
        job_date TEXT NOT NULL,
        item_name TEXT NOT NULL,
        item_code TEXT,
        processing_route TEXT NOT NULL, -- ROUTE_A, ROUTE_B, ROUTE_C
        source_lot_no TEXT NOT NULL,
        available_stock_bags INTEGER DEFAULT 0,
        available_stock_weight_kg REAL DEFAULT 0,
        unit_bag_weight_kg REAL DEFAULT 50.0,
        issued_bags_to_team INTEGER DEFAULT 1,
        source_bags_count INTEGER DEFAULT 1,
        source_rm_weight_kg REAL DEFAULT 0,
        vacuum_processed INTEGER DEFAULT 0,
        vacuum_bags_count INTEGER DEFAULT 0,
        vacuum_output_weight_kg REAL DEFAULT 0,
        vacuum_date TEXT,
        waiting_days INTEGER DEFAULT 0,
        sorting_batch_no TEXT,
        tray_station_no TEXT DEFAULT 'Tray-01',
        team_name TEXT DEFAULT '',
        team_leader TEXT DEFAULT '',
        team_members TEXT, -- JSON array of up to 3 members
        start_time TEXT,
        end_time TEXT,
        actual_duration_hours REAL DEFAULT 0,
        sorting_rounds_count INTEGER DEFAULT 1,
        target_fg_bag_weight_kg REAL DEFAULT 50.0,
        estimated_waste_pct REAL DEFAULT 1.0,
        approx_fg_bags INTEGER DEFAULT 0,
        approx_fg_weight_kg REAL DEFAULT 0,
        daily_target_fg_bags INTEGER DEFAULT 8,
        daily_target_hours REAL DEFAULT 8.0,
        fg_bags_produced_count INTEGER DEFAULT 0,
        total_fg_weight_kg REAL DEFAULT 0,
        total_waste_weight_kg REAL DEFAULT 0,
        qc_status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, HOLD, ISOLATED, REJECTED
        qc_remarks TEXT,
        status TEXT DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, HOLD, CANCELLED
        created_by TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Dynamically migrate existing database table if columns are missing
    const newColumns = [
      'available_stock_bags INTEGER DEFAULT 0',
      'available_stock_weight_kg REAL DEFAULT 0',
      'unit_bag_weight_kg REAL DEFAULT 50.0',
      'issued_bags_to_team INTEGER DEFAULT 1',
      'approx_fg_bags INTEGER DEFAULT 0',
      'approx_fg_weight_kg REAL DEFAULT 0',
      'daily_target_fg_bags INTEGER DEFAULT 8',
      'daily_target_hours REAL DEFAULT 8.0',
      'estimated_waste_pct REAL DEFAULT 1.0'
    ];
    for (const col of newColumns) {
      try {
        await db.run(`ALTER TABLE hand_sorting_jobs ADD COLUMN ${col}`);
      } catch (e) {
        // column already exists
      }
    }

    await db.run(`
      CREATE TABLE IF NOT EXISTS hand_sorting_rounds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        job_id INTEGER NOT NULL,
        round_number INTEGER NOT NULL,
        round_time TEXT,
        tray_no TEXT,
        findings_category TEXT,
        findings_description TEXT,
        waste_measured_weight_kg REAL DEFAULT 0,
        live_insect_found INTEGER DEFAULT 0,
        affected_bag_ref TEXT,
        qc_sample_sent INTEGER DEFAULT 1,
        qc_sample_weight_g REAL DEFAULT 250,
        qc_action TEXT DEFAULT 'Pending',
        qc_decision_notes TEXT,
        qc_inspector TEXT,
        decision_timestamp TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS hand_sorting_fg_bags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        job_id INTEGER NOT NULL,
        batch_no TEXT,
        fg_bag_no TEXT UNIQUE NOT NULL,
        item_name TEXT NOT NULL,
        source_lot_no TEXT NOT NULL,
        actual_weight_kg REAL NOT NULL,
        target_weight_kg REAL DEFAULT 50.0,
        weighing_confirmed INTEGER DEFAULT 1,
        stitching_status TEXT DEFAULT 'STITCHED',
        fg_row_location TEXT DEFAULT 'Row-A-01',
        qc_status TEXT DEFAULT 'APPROVED', -- APPROVED, PENDING_QC, HOLD, ISOLATED, REJECTED
        isolation_status TEXT DEFAULT 'NORMAL', -- NORMAL, ISOLATED
        isolation_reason TEXT,
        isolation_timestamp TEXT,
        release_authorized_by TEXT,
        release_notes TEXT,
        release_timestamp TEXT,
        allocated_order_id INTEGER,
        allocated_customer_po TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS hand_sorting_daily_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        record_date TEXT NOT NULL,
        shift TEXT DEFAULT 'Shift-1',
        team_name TEXT NOT NULL,
        team_leader TEXT NOT NULL,
        team_members TEXT NOT NULL,
        item_name TEXT NOT NULL,
        source_lot_no TEXT NOT NULL,
        rm_bags_count INTEGER DEFAULT 0,
        rm_weight_kg REAL DEFAULT 0,
        vacuum_bags_count INTEGER DEFAULT 0,
        vacuum_output_kg REAL DEFAULT 0,
        fg_bags_count INTEGER DEFAULT 0,
        fg_weight_kg REAL DEFAULT 0,
        sorting_hours REAL DEFAULT 8.0,
        sorting_rounds INTEGER DEFAULT 1,
        waste_weight_kg REAL DEFAULT 0,
        findings_summary TEXT,
        stitched_in_row_count INTEGER DEFAULT 0,
        awaiting_qc_count INTEGER DEFAULT 0,
        approved_fg_count INTEGER DEFAULT 0,
        isolated_fg_count INTEGER DEFAULT 0,
        rejected_fg_count INTEGER DEFAULT 0,
        remarks TEXT,
        entered_by TEXT DEFAULT 'Supervisor',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS hand_sorting_customer_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        customer_name TEXT NOT NULL,
        customer_po TEXT NOT NULL,
        sales_order_ref TEXT,
        fg_item_name TEXT NOT NULL,
        required_qty_kg REAL NOT NULL,
        target_bag_weight_kg REAL DEFAULT 50.0,
        required_bags_count INTEGER NOT NULL,
        loading_datetime TEXT NOT NULL,
        prep_deadline_datetime TEXT NOT NULL,
        priority_level TEXT DEFAULT 'HIGH', -- URGENT, HIGH, NORMAL, LOW
        allocated_approved_fg_kg REAL DEFAULT 0,
        allocated_bags_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'PLANNING', -- PLANNING, IN_PROGRESS, READY_TO_LOAD, DISPATCHED
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS hand_sorting_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER DEFAULT 1,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        notes TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    tablesInitialized = true;
  } catch (err) {
    console.error('Error ensuring hand_sorting tables:', err);
  }
}

// Router middleware to ensure DB ready
router.use(async (req, res, next) => {
  await ensureTables();
  next();
});

// 1. Dashboard KPI Summary
router.get('/dashboard', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.headers['x-company-id'] || 1;

    const [jobsRes, bagsRes, plansRes, isolatedRes] = await Promise.all([
      db.query(`SELECT COUNT(*) as total,
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN qc_status = 'PENDING' THEN 1 ELSE 0 END) as qc_pending
        FROM hand_sorting_jobs WHERE company_id = ?`, [companyId]),
      db.query(`SELECT COUNT(*) as total_bags,
        SUM(actual_weight_kg) as total_fg_kg,
        SUM(CASE WHEN qc_status = 'APPROVED' AND isolation_status = 'NORMAL' THEN actual_weight_kg ELSE 0 END) as ready_approved_kg,
        SUM(CASE WHEN qc_status = 'APPROVED' AND isolation_status = 'NORMAL' THEN 1 ELSE 0 END) as ready_approved_bags
        FROM hand_sorting_fg_bags WHERE company_id = ?`, [companyId]),
      db.query(`SELECT COUNT(*) as total_plans,
        SUM(required_qty_kg) as total_demand_kg,
        SUM(allocated_approved_fg_kg) as allocated_kg
        FROM hand_sorting_customer_plans WHERE company_id = ?`, [companyId]),
      db.query(`SELECT COUNT(*) as isolated_count,
        SUM(actual_weight_kg) as isolated_weight_kg
        FROM hand_sorting_fg_bags WHERE company_id = ? AND isolation_status = 'ISOLATED'`, [companyId]),
    ]);

    const jobs = jobsRes.rows[0] || {};
    const bags = bagsRes.rows[0] || {};
    const plans = plansRes.rows[0] || {};
    const isolated = isolatedRes.rows[0] || {};

    res.json({
      success: true,
      data: {
        active_jobs: parseInt(jobs.in_progress || 0),
        qc_pending_jobs: parseInt(jobs.qc_pending || 0),
        ready_approved_kg: parseFloat(bags.ready_approved_kg || 0),
        ready_approved_bags: parseInt(bags.ready_approved_bags || 0),
        isolated_bags_count: parseInt(isolated.isolated_count || 0),
        isolated_weight_kg: parseFloat(isolated.isolated_weight_kg || 0),
        total_customer_demand_kg: parseFloat(plans.total_demand_kg || 0),
        allocated_fg_kg: parseFloat(plans.allocated_kg || 0),
        pending_customer_demand_kg: Math.max(0, parseFloat(plans.total_demand_kg || 0) - parseFloat(plans.allocated_kg || 0))
      }
    });
  } catch (err) {
    console.error('Error fetching hand sorting dashboard:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1.1 Route-Based Dynamic Stock Lots Endpoint
// Route A -> Newly arrived RM from Purchase entries
// Route B -> Vacuumed lots from vacuum/grind processing (with vacuum bag weights & 7-day rest)
// Route C -> RM lots with QC Approval (cleared for direct sorting)
router.get('/source-lots', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.headers['x-company-id'] || 1;
    const { route, search } = req.query;

    const today = new Date();
    let lots = [];

    if (route === 'ROUTE_A') {
      // Route A: Incoming Raw Material arrived from Purchase entries
      try {
        let purSql = `
          SELECT 
            pi.lot_no,
            MAX(pi.item_name) as item_name,
            SUM(COALESCE(pi.qty, 0)) as available_bags,
            SUM(CASE 
              WHEN pi.total_wt > 0 THEN pi.total_wt
              WHEN pi.weight > 0 THEN pi.qty * pi.weight
              ELSE pi.qty * 50.0
            END) as available_weight_kg,
            ROUND(AVG(CASE WHEN pi.weight > 0 THEN pi.weight ELSE 50.0 END), 2) as unit_bag_weight_kg,
            MAX(p.inv_no) as purchase_inv_no,
            MAX(p.date) as receipt_date,
            COALESCE(MAX(sm.print_name), MAX(sm.name), 'Factory Supplier') as supplier_name,
            'Factory Raw Material Bay' as godown_name,
            'ROUTE_A' as route_type,
            'Purchase Arrived RM' as source_badge,
            'Newly arrived raw material from purchase entry; awaiting incoming 1-bag QC sample inspection' as description
          FROM purchase_items pi
          JOIN purchases p ON pi.purchase_id = p.id
          LEFT JOIN supplier_master sm ON p.supplier = sm.id OR p.supplier = sm.name
          WHERE pi.lot_no IS NOT NULL AND pi.lot_no != ''
        `;
        if (search) {
          purSql += ` AND (pi.lot_no LIKE '%${search}%' OR pi.item_name LIKE '%${search}%')`;
        }
        purSql += ` GROUP BY pi.lot_no ORDER BY MAX(p.id) DESC LIMIT 30`;
        const purRes = await db.query(purSql);
        lots = purRes.rows || [];
      } catch (e) {
        console.warn('Error fetching purchase lots for Route A:', e.message);
      }
    } else if (route === 'ROUTE_B') {
      // Route B: Vacuum hand sorting -> list vacuumed lots from grind / grains processing
      try {
        let vacSql = `
          SELECT 
            goi.lot_no,
            MAX(goi.item_name) as item_name,
            SUM(COALESCE(goi.qty, 0)) as available_bags,
            SUM(COALESCE(goi.total_wt, goi.qty * goi.weight)) as available_weight_kg,
            ROUND(AVG(COALESCE(goi.weight, 26.0)), 2) as unit_bag_weight_kg,
            SUM(COALESCE(goi.qty, 0)) as vacuum_bags_count,
            SUM(COALESCE(goi.total_wt, goi.qty * goi.weight)) as vacuum_output_weight_kg,
            ROUND(AVG(COALESCE(goi.weight, 26.0)), 2) as vacuum_bag_unit_weight,
            MAX(g.date) as vacuum_date,
            MAX(g.work_order_no) as work_order_no,
            'Factory Vacuum Chamber 1' as godown_name,
            'ROUTE_B' as route_type,
            'Vacuum Processed' as source_badge,
            'Processed through vacuum sealer; resting period active prior to tray sorting' as description
          FROM grain_output_items goi
          JOIN grains g ON goi.grain_id = g.id
          WHERE (goi.item_name LIKE '%Vacuum%' OR goi.item_name LIKE '%GN%' OR goi.weight <= 30 OR goi.lot_no IS NOT NULL)
            AND goi.lot_no IS NOT NULL AND goi.lot_no != ''
          GROUP BY goi.lot_no
          ORDER BY MAX(g.id) DESC LIMIT 30
        `;
        const vacRes = await db.query(vacSql);
        lots = (vacRes.rows || []).map(r => {
          let waitingDays = 7;
          if (r.vacuum_date) {
            const vDate = new Date(r.vacuum_date);
            const diff = Math.floor((today - vDate) / 86400000);
            waitingDays = Math.max(0, diff);
          }
          return {
            ...r,
            source_bags_count: r.available_bags || 1,
            source_rm_weight_kg: parseFloat(r.available_weight_kg || 0),
            waiting_days: waitingDays,
            vacuum_processed: 1
          };
        });
      } catch (e) {
        console.warn('Error fetching vacuum lots for Route B:', e.message);
      }
    } else {
      // Route C: Direct RM-to-FG Hand Sorting -> QC Approved RM stock lots
      try {
        let qcSql = `
          SELECT 
            sl.lot_no,
            MAX(sl.item_name) as item_name,
            SUM(COALESCE(sl.remaining_quantity, sl.quantity, 0)) as available_bags,
            SUM(COALESCE(sl.remaining_quantity, sl.quantity, 0)) * 50.0 as available_weight_kg,
            50.0 as unit_bag_weight_kg,
            COALESCE(MAX(qi.qc_no), 'QC-CERT-2026') as qc_no,
            COALESCE(MAX(qi.overall_result), MAX(sl.qc_status), 'APPROVED') as qc_status,
            COALESCE(MAX(qi.inspection_date), date('now')) as qc_approval_date,
            COALESCE(MAX(sl.godown_name), 'Factory RM Godown') as godown_name,
            'ROUTE_C' as route_type,
            'QC Approved RM' as source_badge,
            'Raw material lot fully approved by QC; ready for direct hand sorting into FG 50kg bags' as description
          FROM stock_lots sl
          LEFT JOIN qc_inspections qi ON sl.lot_no = qi.rm_lot_no
          WHERE (sl.approval_status = 'APPROVED' OR sl.qc_status IN ('ACCEPTED', 'APPROVED') OR qi.overall_result IN ('ACCEPTED', 'PASS', 'APPROVED') OR sl.lot_no IS NOT NULL)
            AND sl.lot_no IS NOT NULL AND sl.lot_no != ''
          GROUP BY sl.lot_no
          ORDER BY MAX(sl.id) DESC LIMIT 35
        `;
        const qcRes = await db.query(qcSql);
        lots = qcRes.rows || [];
      } catch (e) {
        console.warn('Error fetching QC approved lots for Route C:', e.message);
      }
    }

    // Strict deduplication by lot_no across all returned items
    const seenLotNos = new Set();
    const uniqueLots = [];
    for (const item of lots) {
      if (item && item.lot_no && !seenLotNos.has(item.lot_no)) {
        seenLotNos.add(item.lot_no);
        uniqueLots.push(item);
      }
    }
    lots = uniqueLots;

    res.json({ success: true, route, count: lots.length, data: lots });
  } catch (err) {
    console.error('Error fetching source lots:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Jobs List & Creation
router.get('/jobs', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.headers['x-company-id'] || 1;
    const { route, status, search } = req.query;

    let sql = `SELECT * FROM hand_sorting_jobs WHERE company_id = ?`;
    const params = [companyId];

    if (route) {
      sql += ` AND processing_route = ?`;
      params.push(route);
    }
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (job_no LIKE ? OR item_name LIKE ? OR source_lot_no LIKE ? OR team_name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ` ORDER BY id DESC`;
    const result = await db.query(sql, params);
    
    // Parse team_members JSON
    const jobs = (result.rows || []).map(j => {
      let members = [];
      try {
        members = JSON.parse(j.team_members || '[]');
      } catch (e) {
        members = [];
      }
      return { ...j, team_members_list: members };
    });

    res.json({ success: true, data: jobs });
  } catch (err) {
    console.error('Error fetching hand sorting jobs:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/jobs', async (req, res) => {
  try {
    const companyId = req.body.company_id || req.headers['x-company-id'] || 1;
    const {
      item_name, item_code, processing_route, source_lot_no,
      available_stock_bags, available_stock_weight_kg, unit_bag_weight_kg,
      issued_bags_to_team, source_bags_count, source_rm_weight_kg,
      vacuum_processed, vacuum_bags_count, vacuum_output_weight_kg,
      vacuum_date, waiting_days, sorting_batch_no, tray_station_no, team_name,
      team_leader, team_members, start_time, target_fg_bag_weight_kg,
      estimated_waste_pct, approx_fg_bags, approx_fg_weight_kg,
      daily_target_fg_bags, daily_target_hours, created_by
    } = req.body;

    const countRes = await db.query('SELECT COUNT(*) as count FROM hand_sorting_jobs WHERE company_id = ?', [companyId]);
    const nextSeq = (parseInt(countRes.rows[0]?.count || 0) + 1).toString().padStart(4, '0');
    const job_no = `HS-${new Date().getFullYear()}-${nextSeq}`;
    const today = new Date().toISOString().split('T')[0];

    const membersJson = typeof team_members === 'string'
      ? team_members
      : JSON.stringify(Array.isArray(team_members) ? team_members.slice(0, 3) : []);

    const actualIssuedBags = parseInt(issued_bags_to_team || source_bags_count || 1);
    const actualUnitWeight = parseFloat(unit_bag_weight_kg || 50.0);
    const calculatedSourceWeight = parseFloat(source_rm_weight_kg || (actualIssuedBags * actualUnitWeight));

    const insertRes = await db.run(`
      INSERT INTO hand_sorting_jobs (
        company_id, job_no, job_date, item_name, item_code, processing_route,
        source_lot_no, available_stock_bags, available_stock_weight_kg, unit_bag_weight_kg,
        issued_bags_to_team, source_bags_count, source_rm_weight_kg,
        vacuum_processed, vacuum_bags_count, vacuum_output_weight_kg, vacuum_date, waiting_days,
        sorting_batch_no, tray_station_no, team_name, team_leader, team_members,
        start_time, target_fg_bag_weight_kg, estimated_waste_pct, approx_fg_bags, approx_fg_weight_kg,
        daily_target_fg_bags, daily_target_hours, qc_status, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'IN_PROGRESS', ?)
    `, [
      companyId, job_no, today, item_name || 'Groundnut (GN)', item_code || 'RM-GN',
      processing_route || 'ROUTE_B', source_lot_no || 'LOT-GN-01',
      parseInt(available_stock_bags || 0), parseFloat(available_stock_weight_kg || 0), actualUnitWeight,
      actualIssuedBags, actualIssuedBags, calculatedSourceWeight,
      vacuum_processed ? 1 : 0, parseInt(vacuum_bags_count || actualIssuedBags), parseFloat(vacuum_output_weight_kg || calculatedSourceWeight),
      vacuum_date || null, parseInt(waiting_days || 0),
      sorting_batch_no || `BATCH-${job_no}`, tray_station_no || 'Tray-01',
      team_name || '', team_leader || '', membersJson,
      start_time || '08:30 AM', parseFloat(target_fg_bag_weight_kg || 50.0),
      parseFloat(estimated_waste_pct || 1.0), parseInt(approx_fg_bags || 0), parseFloat(approx_fg_weight_kg || 0),
      parseInt(daily_target_fg_bags || 8), parseFloat(daily_target_hours || 8.0),
      created_by || 'Supervisor'
    ]);

    const jobId = insertRes.lastID || insertRes.insertId || 1;

    // Log Audit
    await db.run(`
      INSERT INTO hand_sorting_audit_logs (company_id, entity_type, entity_id, action, performed_by, notes)
      VALUES (?, 'JOB', ?, 'CREATE', ?, ?)
    `, [companyId, jobId, created_by || 'Supervisor', `Created Hand Sorting Job ${job_no} (Issued ${actualIssuedBags} bags, ${calculatedSourceWeight} kg)`]);

    res.json({ success: true, message: `Job ${job_no} created successfully`, job_id: jobId, job_no });
  } catch (err) {
    console.error('Error creating hand sorting job:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint to reset / fresh start hand sorting data
router.post('/reset-fresh', async (req, res) => {
  try {
    const companyId = req.body.company_id || req.headers['x-company-id'] || 1;
    await db.run(`DELETE FROM hand_sorting_jobs WHERE company_id = ?`, [companyId]);
    await db.run(`DELETE FROM hand_sorting_rounds WHERE company_id = ?`, [companyId]);
    await db.run(`DELETE FROM hand_sorting_fg_bags WHERE company_id = ?`, [companyId]);
    await db.run(`DELETE FROM hand_sorting_daily_records WHERE company_id = ?`, [companyId]);
    await db.run(`DELETE FROM hand_sorting_customer_plans WHERE company_id = ?`, [companyId]);
    await db.run(`DELETE FROM hand_sorting_audit_logs WHERE company_id = ?`, [companyId]);
    res.json({ success: true, message: 'Hand sorting workspace reset to fresh initial state.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Single Job with Rounds & FG Bags
router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null' || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, message: 'Invalid Job ID provided' });
    }
    const jobId = parseInt(id);

    const [jobRes, roundsRes, bagsRes] = await Promise.all([
      db.query(`SELECT * FROM hand_sorting_jobs WHERE id = ?`, [jobId]),
      db.query(`SELECT * FROM hand_sorting_rounds WHERE job_id = ? ORDER BY round_number ASC`, [jobId]),
      db.query(`SELECT * FROM hand_sorting_fg_bags WHERE job_id = ? ORDER BY id ASC`, [jobId])
    ]);

    if (!jobRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const job = jobRes.rows[0];
    try {
      job.team_members_list = JSON.parse(job.team_members || '[]');
    } catch (e) {
      job.team_members_list = [];
    }

    res.json({
      success: true,
      data: {
        job,
        rounds: roundsRes.rows || [],
        fg_bags: bagsRes.rows || []
      }
    });
  } catch (err) {
    console.error('Error fetching job details:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Record Sorting Round & QC Sample
router.post('/jobs/:id/round', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null' || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, message: 'Invalid or missing Job ID' });
    }
    const jobId = parseInt(id);
    const companyId = req.body.company_id || req.headers['x-company-id'] || 1;
    const {
      round_number, tray_no, findings_category, findings_description,
      waste_measured_weight_kg, live_insect_found, affected_bag_ref,
      qc_sample_sent, qc_sample_weight_g, qc_action, qc_decision_notes, qc_inspector
    } = req.body;

    const jobRes = await db.query('SELECT * FROM hand_sorting_jobs WHERE id = ?', [jobId]);
    if (!jobRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const roundTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await db.run(`
      INSERT INTO hand_sorting_rounds (
        company_id, job_id, round_number, round_time, tray_no, findings_category,
        findings_description, waste_measured_weight_kg, live_insect_found, affected_bag_ref,
        qc_sample_sent, qc_sample_weight_g, qc_action, qc_decision_notes, qc_inspector, decision_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      companyId, jobId, parseInt(round_number || 1), roundTime, tray_no || 'Tray-01',
      findings_category || 'Normal sorting', findings_description || '',
      parseFloat(waste_measured_weight_kg || 0), live_insect_found ? 1 : 0, affected_bag_ref || null,
      qc_sample_sent !== false ? 1 : 0, parseFloat(qc_sample_weight_g || 250),
      qc_action || 'Pending', qc_decision_notes || '', qc_inspector || 'QC Inspector',
      roundTime
    ]);

    // Update job sorting_rounds_count and waste sum
    await db.run(`
      UPDATE hand_sorting_jobs
      SET sorting_rounds_count = MAX(sorting_rounds_count, ?),
          total_waste_weight_kg = total_waste_weight_kg + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [parseInt(round_number || 1), parseFloat(waste_measured_weight_kg || 0), jobId]);

    // If live insect found, trigger isolation protocol on affected bag if specified!
    if (live_insect_found && affected_bag_ref) {
      await db.run(`
        UPDATE hand_sorting_fg_bags
        SET isolation_status = 'ISOLATED',
            qc_status = 'ISOLATED',
            isolation_reason = ?,
            isolation_timestamp = CURRENT_TIMESTAMP
        WHERE fg_bag_no = ?
      `, [`Live insect detected in round ${round_number}: ${findings_description}`, affected_bag_ref]);

      // Set job status to HOLD
      await db.run(`
        UPDATE hand_sorting_jobs
        SET qc_status = 'HOLD',
            qc_remarks = ?
        WHERE id = ?
      `, [`Live insect found in round ${round_number}. Bag ${affected_bag_ref} isolated under QC hold.`, jobId]);
    }

    res.json({ success: true, message: `Sorting round ${round_number} recorded successfully` });
  } catch (err) {
    console.error('Error recording sorting round:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Fill, Weigh, Stitch and Locate FG Bag
router.post('/jobs/:id/fg-bag', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null' || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, message: 'Invalid or missing Job ID' });
    }
    const jobId = parseInt(id);
    const companyId = req.body.company_id || req.headers['x-company-id'] || 1;
    const {
      actual_weight_kg, target_weight_kg, stitching_status, fg_row_location,
      qc_status, isolation_status, isolation_reason
    } = req.body;

    // Get job info for context
    const jobRes = await db.query('SELECT * FROM hand_sorting_jobs WHERE id = ?', [jobId]);
    if (!jobRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    const job = jobRes.rows[0];

    const numBags = Math.max(1, parseInt(req.body.bag_count || 1));
    const bagWeight = parseFloat(actual_weight_kg || target_weight_kg || 50.0);
    const targetWt = parseFloat(target_weight_kg || 50.0);
    const isIsolated = isolation_status === 'ISOLATED';
    
    const lastBagSeqRes = await db.query('SELECT COUNT(*) as count FROM hand_sorting_fg_bags WHERE company_id = ?', [companyId]);
    let currentSeq = parseInt(lastBagSeqRes.rows[0]?.count || 0);

    let lastFgBagNo = '';
    for (let i = 0; i < numBags; i++) {
      currentSeq++;
      const bagSeqStr = currentSeq.toString().padStart(4, '0');
      const fg_bag_no = `FG-${job.item_code || 'GN'}-${new Date().getFullYear().toString().slice(-2)}-${bagSeqStr}`;
      lastFgBagNo = fg_bag_no;

      await db.run(`
        INSERT INTO hand_sorting_fg_bags (
          company_id, job_id, batch_no, fg_bag_no, item_name, source_lot_no,
          actual_weight_kg, target_weight_kg, weighing_confirmed, stitching_status,
          fg_row_location, qc_status, isolation_status, isolation_reason, isolation_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      `, [
        companyId, jobId, job.sorting_batch_no, fg_bag_no, job.item_name, job.source_lot_no,
        bagWeight, targetWt,
        stitching_status || 'STITCHED',
        isIsolated ? 'ISOLATION-ZONE' : (fg_row_location || 'Row-A-01'),
        isIsolated ? 'ISOLATED' : (qc_status || 'APPROVED'),
        isIsolated ? 'ISOLATED' : 'NORMAL',
        isIsolated ? (isolation_reason || 'Live insect or QC inspection failure') : null,
        isIsolated ? new Date().toISOString() : null
      ]);
    }

    const addedWeight = bagWeight * numBags;
    await db.run(`
      UPDATE hand_sorting_jobs
      SET fg_bags_produced_count = fg_bags_produced_count + ?,
          total_fg_weight_kg = total_fg_weight_kg + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [numBags, addedWeight, jobId]);

    const updatedJobRes = await db.query('SELECT fg_bags_produced_count, total_fg_weight_kg FROM hand_sorting_jobs WHERE id = ?', [jobId]);
    const updatedJob = updatedJobRes.rows[0] || {};

    res.json({
      success: true,
      message: numBags > 1 
        ? `${numBags} FG bags (${addedWeight} kg) recorded & weighed successfully!` 
        : `FG bag ${lastFgBagNo} recorded & weighed successfully`,
      fg_bag_no: lastFgBagNo,
      completed_fg_bag_count: updatedJob.fg_bags_produced_count || (parseInt(job.fg_bags_produced_count || 0) + numBags),
      total_fg_weight_kg: updatedJob.total_fg_weight_kg || (parseFloat(job.total_fg_weight_kg || 0) + addedWeight)
    });
  } catch (err) {
    console.error('Error adding FG bag:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. FG Bags List & Immediate Isolation / Release Controls
router.get('/fg-bags', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.headers['x-company-id'] || 1;
    const { status, isolation, search } = req.query;

    let sql = `SELECT b.*, j.job_no, j.team_name, j.processing_route
               FROM hand_sorting_fg_bags b
               LEFT JOIN hand_sorting_jobs j ON b.job_id = j.id
               WHERE b.company_id = ?`;
    const params = [companyId];

    if (status) {
      sql += ` AND b.qc_status = ?`;
      params.push(status);
    }
    if (isolation) {
      sql += ` AND b.isolation_status = ?`;
      params.push(isolation);
    }
    if (search) {
      sql += ` AND (b.fg_bag_no LIKE ? OR b.item_name LIKE ? OR b.source_lot_no LIKE ? OR b.fg_row_location LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ` ORDER BY b.id DESC`;
    const result = await db.query(sql, params);
    res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    console.error('Error fetching FG bags:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Critical Control: Isolate Specific Bag Immediately
router.post('/fg-bags/:id/isolate', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.body.company_id || req.headers['x-company-id'] || 1;
    const { reason, isolated_by } = req.body;

    const bagRes = await db.query('SELECT * FROM hand_sorting_fg_bags WHERE id = ? AND company_id = ?', [id, companyId]);
    if (!bagRes.rows.length) {
      return res.status(404).json({ success: false, message: 'FG Bag not found' });
    }
    const bag = bagRes.rows[0];

    const timestamp = new Date().toISOString();
    await db.run(`
      UPDATE hand_sorting_fg_bags
      SET isolation_status = 'ISOLATED',
          qc_status = 'ISOLATED',
          fg_row_location = 'ISOLATION-BAY',
          isolation_reason = ?,
          isolation_timestamp = ?
      WHERE id = ? AND company_id = ?
    `, [reason || 'Live insect finding / Critical foreign matter', timestamp, id, companyId]);

    // Log Audit
    await db.run(`
      INSERT INTO hand_sorting_audit_logs (company_id, entity_type, entity_id, action, performed_by, notes)
      VALUES (?, 'FG_BAG', ?, 'ISOLATE', ?, ?)
    `, [companyId, id, isolated_by || 'QC Officer', `Bag ${bag.fg_bag_no} isolated: ${reason}`]);

    res.json({ success: true, message: `Bag ${bag.fg_bag_no} marked as ISOLATED and held separately.` });
  } catch (err) {
    console.error('Error isolating FG bag:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Authorized Release from Isolation (Audit Trailed)
router.post('/fg-bags/:id/release', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.body.company_id || req.headers['x-company-id'] || 1;
    const { authorized_by, release_notes, new_row_location } = req.body;

    if (!authorized_by || !release_notes) {
      return res.status(400).json({ success: false, message: 'Authorized user name and justification notes are mandatory to release an isolated bag.' });
    }

    const bagRes = await db.query('SELECT * FROM hand_sorting_fg_bags WHERE id = ? AND company_id = ?', [id, companyId]);
    if (!bagRes.rows.length) {
      return res.status(404).json({ success: false, message: 'FG Bag not found' });
    }
    const bag = bagRes.rows[0];

    const timestamp = new Date().toISOString();
    await db.run(`
      UPDATE hand_sorting_fg_bags
      SET isolation_status = 'NORMAL',
          qc_status = 'APPROVED',
          fg_row_location = ?,
          release_authorized_by = ?,
          release_notes = ?,
          release_timestamp = ?
      WHERE id = ? AND company_id = ?
    `, [new_row_location || 'Row-A-01', authorized_by, release_notes, timestamp, id, companyId]);

    // Log Audit
    await db.run(`
      INSERT INTO hand_sorting_audit_logs (company_id, entity_type, entity_id, action, performed_by, notes)
      VALUES (?, 'FG_BAG', ?, 'RELEASE', ?, ?)
    `, [companyId, id, authorized_by, `Released bag ${bag.fg_bag_no} from isolation: ${release_notes}`]);

    res.json({ success: true, message: `Bag ${bag.fg_bag_no} successfully cleared & authorized for normal release.` });
  } catch (err) {
    console.error('Error releasing FG bag:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. End-of-Day Manual Production Reports
router.get('/daily-reports', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.headers['x-company-id'] || 1;
    const { date, search } = req.query;

    let sql = `SELECT * FROM hand_sorting_daily_records WHERE company_id = ?`;
    const params = [companyId];

    if (date) {
      sql += ` AND record_date = ?`;
      params.push(date);
    }
    if (search) {
      sql += ` AND (team_name LIKE ? OR item_name LIKE ? OR source_lot_no LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ` ORDER BY record_date DESC, id DESC`;
    const result = await db.query(sql, params);

    const records = (result.rows || []).map(r => {
      let members = [];
      try {
        members = JSON.parse(r.team_members || '[]');
      } catch (e) {
        members = [];
      }
      return { ...r, team_members_list: members };
    });

    res.json({ success: true, data: records });
  } catch (err) {
    console.error('Error fetching daily reports:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/daily-reports', async (req, res) => {
  try {
    const companyId = req.body.company_id || req.headers['x-company-id'] || 1;
    const {
      record_date, shift, team_name, team_leader, team_members, item_name,
      source_lot_no, rm_bags_count, rm_weight_kg, vacuum_bags_count, vacuum_output_kg,
      fg_bags_count, fg_weight_kg, sorting_hours, sorting_rounds, waste_weight_kg,
      findings_summary, stitched_in_row_count, awaiting_qc_count, approved_fg_count,
      isolated_fg_count, rejected_fg_count, remarks, entered_by
    } = req.body;

    const membersJson = typeof team_members === 'string'
      ? team_members
      : JSON.stringify(Array.isArray(team_members) ? team_members : []);

    await db.run(`
      INSERT INTO hand_sorting_daily_records (
        company_id, record_date, shift, team_name, team_leader, team_members,
        item_name, source_lot_no, rm_bags_count, rm_weight_kg,
        vacuum_bags_count, vacuum_output_kg, fg_bags_count, fg_weight_kg,
        sorting_hours, sorting_rounds, waste_weight_kg, findings_summary,
        stitched_in_row_count, awaiting_qc_count, approved_fg_count,
        isolated_fg_count, rejected_fg_count, remarks, entered_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      companyId, record_date || new Date().toISOString().split('T')[0],
      shift || 'Shift-1', team_name || 'Sorting Team', team_leader || 'Leader',
      membersJson, item_name || 'Groundnut (GN)', source_lot_no || 'LOT-GN-01',
      parseInt(rm_bags_count || 0), parseFloat(rm_weight_kg || 0),
      parseInt(vacuum_bags_count || 0), parseFloat(vacuum_output_kg || 0),
      parseInt(fg_bags_count || 0), parseFloat(fg_weight_kg || 0),
      parseFloat(sorting_hours || 8.0), parseInt(sorting_rounds || 1),
      parseFloat(waste_weight_kg || 0), findings_summary || '',
      parseInt(stitched_in_row_count || 0), parseInt(awaiting_qc_count || 0),
      parseInt(approved_fg_count || 0), parseInt(isolated_fg_count || 0),
      parseInt(rejected_fg_count || 0), remarks || '', entered_by || 'Supervisor'
    ]);

    res.json({ success: true, message: 'End-of-day manual production record saved successfully' });
  } catch (err) {
    console.error('Error saving daily report:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Weekly Customer Demand & Loading Targets
router.get('/customer-plans', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.headers['x-company-id'] || 1;

    const result = await db.query(`
      SELECT * FROM hand_sorting_customer_plans
      WHERE company_id = ?
      ORDER BY loading_datetime ASC
    `, [companyId]);

    const now = new Date();
    const plans = (result.rows || []).map(p => {
      const requiredKg = parseFloat(p.required_qty_kg || 0);
      const allocatedKg = parseFloat(p.allocated_approved_fg_kg || 0);
      const remainingKg = Math.max(0, requiredKg - allocatedKg);
      const bagWeight = parseFloat(p.target_bag_weight_kg || 50.0);
      const remainingBags = Math.ceil(remainingKg / bagWeight);

      // Calculate productive remaining time up to prep deadline
      const prepDate = new Date(p.prep_deadline_datetime || p.loading_datetime);
      const diffMs = prepDate - now;
      const hoursRemaining = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
      const daysRemaining = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

      const dailyTargetKg = daysRemaining > 0 ? (remainingKg / daysRemaining).toFixed(1) : remainingKg.toFixed(1);
      const hourlyTargetKg = hoursRemaining > 0 ? (remainingKg / hoursRemaining).toFixed(1) : remainingKg.toFixed(1);

      const isAtRisk = hoursRemaining < 48 && remainingKg > 200;

      return {
        ...p,
        remaining_qty_kg: remainingKg,
        remaining_bags_count: remainingBags,
        hours_remaining: hoursRemaining,
        days_remaining: daysRemaining,
        daily_target_kg: parseFloat(dailyTargetKg),
        hourly_target_kg: parseFloat(hourlyTargetKg),
        is_at_risk: isAtRisk
      };
    });

    res.json({ success: true, data: plans });
  } catch (err) {
    console.error('Error fetching customer plans:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/customer-plans', async (req, res) => {
  try {
    const companyId = req.body.company_id || req.headers['x-company-id'] || 1;
    const {
      customer_name, customer_po, sales_order_ref, fg_item_name,
      required_qty_kg, target_bag_weight_kg, loading_datetime, prep_deadline_datetime,
      priority_level, notes
    } = req.body;

    const bagWt = parseFloat(target_bag_weight_kg || 50.0);
    const requiredKg = parseFloat(required_qty_kg || 0);
    const requiredBags = Math.ceil(requiredKg / bagWt);

    await db.run(`
      INSERT INTO hand_sorting_customer_plans (
        company_id, customer_name, customer_po, sales_order_ref, fg_item_name,
        required_qty_kg, target_bag_weight_kg, required_bags_count,
        loading_datetime, prep_deadline_datetime, priority_level, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      companyId, customer_name, customer_po, sales_order_ref || null,
      fg_item_name || 'Groundnut (GN - Bold Grade A)', requiredKg, bagWt, requiredBags,
      loading_datetime, prep_deadline_datetime || loading_datetime,
      priority_level || 'HIGH', notes || ''
    ]);

    res.json({ success: true, message: 'Customer loading plan registered successfully' });
  } catch (err) {
    console.error('Error adding customer plan:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Allocate Approved FG Bags to Customer Plan (Strictly excludes Held or Isolated bags)
router.post('/customer-plans/:id/allocate', async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.body.company_id || req.headers['x-company-id'] || 1;
    const { bag_ids, customer_po } = req.body;

    if (!Array.isArray(bag_ids) || bag_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one approved FG bag to allocate.' });
    }

    // Verify all selected bags are APPROVED and NORMAL (not isolated or held)
    const placeholders = bag_ids.map(() => '?').join(',');
    const checkBags = await db.query(`
      SELECT * FROM hand_sorting_fg_bags
      WHERE id IN (${placeholders}) AND company_id = ?
    `, [...bag_ids, companyId]);

    const invalidBags = (checkBags.rows || []).filter(b => b.qc_status !== 'APPROVED' || b.isolation_status === 'ISOLATED' || b.allocated_order_id);
    if (invalidBags.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot allocate bags: ${invalidBags.map(b => b.fg_bag_no).join(', ')} are isolated, held, unapproved, or already allocated to another order!`
      });
    }

    let allocatedWeight = 0;
    for (const b of checkBags.rows) {
      allocatedWeight += parseFloat(b.actual_weight_kg || 50.0);
      await db.run(`
        UPDATE hand_sorting_fg_bags
        SET allocated_order_id = ?,
            allocated_customer_po = ?
        WHERE id = ? AND company_id = ?
      `, [id, customer_po || 'ALLOCATED', b.id, companyId]);
    }

    // Update customer plan totals
    await db.run(`
      UPDATE hand_sorting_customer_plans
      SET allocated_approved_fg_kg = allocated_approved_fg_kg + ?,
          allocated_bags_count = allocated_bags_count + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `, [allocatedWeight, bag_ids.length, id, companyId]);

    res.json({
      success: true,
      message: `Successfully allocated ${bag_ids.length} approved bags (${allocatedWeight.toFixed(2)} kg) to Customer Order ${customer_po}`
    });
  } catch (err) {
    console.error('Error allocating bags:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9. Full Traceability Lookup (FG Bag / Batch / Lot)
router.get('/traceability/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const companyId = req.query.company_id || req.headers['x-company-id'] || 1;

    // Search by FG bag number
    const bagRes = await db.query(`
      SELECT b.*, j.job_no, j.item_name as job_item, j.processing_route,
             j.source_lot_no as rm_lot, j.vacuum_processed, j.vacuum_bags_count,
             j.vacuum_output_weight_kg, j.team_name, j.team_leader, j.team_members
      FROM hand_sorting_fg_bags b
      JOIN hand_sorting_jobs j ON b.job_id = j.id
      WHERE (b.fg_bag_no = ? OR b.source_lot_no = ? OR b.batch_no = ?) AND b.company_id = ?
    `, [key, key, key, companyId]);

    const roundsRes = await db.query(`
      SELECT r.* FROM hand_sorting_rounds r
      JOIN hand_sorting_jobs j ON r.job_id = j.id
      WHERE (j.job_no = ? OR j.source_lot_no = ? OR r.affected_bag_ref = ?) AND r.company_id = ?
    `, [key, key, key, companyId]);

    const auditRes = await db.query(`
      SELECT * FROM hand_sorting_audit_logs
      WHERE (notes LIKE ? OR entity_id IN (SELECT id FROM hand_sorting_fg_bags WHERE fg_bag_no = ?)) AND company_id = ?
      ORDER BY id DESC
    `, [`%${key}%`, key, companyId]);

    res.json({
      success: true,
      data: {
        search_key: key,
        matched_bags: bagRes.rows || [],
        sorting_rounds: roundsRes.rows || [],
        audit_trail: auditRes.rows || []
      }
    });
  } catch (err) {
    console.error('Error fetching traceability:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 10. Audit Logs
router.get('/audit-logs', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.headers['x-company-id'] || 1;
    const result = await db.query(`
      SELECT * FROM hand_sorting_audit_logs
      WHERE company_id = ?
      ORDER BY id DESC LIMIT 100
    `, [companyId]);
    res.json({ success: true, data: result.rows || [] });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
