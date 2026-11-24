const express = require('express');
const router = express.Router();
const db = require('../config/database');
const {
  sanitizeDate,
  round2,
  sanitizeEvidenceList,
  resolveBatchAndRmTraceability
} = require('../services/complaintTraceabilityHelper');
const { ensureSalesSchema } = require('../services/SalesService');

const getCompanyId = (req) => {
  const raw =
    req.companyId ||
    (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : (req.user?.company_id || 1));
  return parseInt(raw, 10) || 1;
};

const _capaSchemaEnsured = new Set();

const CAPA_SOURCES = ['Customer Complaint', 'Sales Return', 'Internal QC'];
const RCA_METHODS = ['5 Why', 'Fishbone', 'Other'];
const CAPA_STATUSES = ['Open', 'In Progress', 'Verification', 'Closed'];
const EFFECTIVENESS_STATUSES = ['Pending', 'Effective', 'Not Effective'];

async function ensureCapaTables(companyId) {
  const cId = parseInt(companyId, 10) || 1;
  const runner = db.forCompany(cId);

  await ensureSalesSchema(cId);

  if (_capaSchemaEnsured.has(cId)) {
    try {
      await runner.query(`SELECT 1 FROM capa_documents LIMIT 1`);
      await runner.query(`SELECT 1 FROM capa_items LIMIT 1`);
      await runner.query(`SELECT 1 FROM capa_audit_logs LIMIT 1`);
      return;
    } catch (_) {
      _capaSchemaEnsured.delete(cId);
    }
  }

  await runner.run(
    `CREATE TABLE IF NOT EXISTS capa_documents (
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
    )`
  );

  await runner.run(
    `CREATE TABLE IF NOT EXISTS capa_items (
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
    )`
  );

  await runner.run(
    `CREATE TABLE IF NOT EXISTS capa_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      capa_id INTEGER NOT NULL,
      capa_no TEXT,
      action TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      performed_by TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  _capaSchemaEnsured.add(cId);
}

router.use(async (req, _res, next) => {
  try {
    await ensureCapaTables(getCompanyId(req));
  } catch (e) {
    console.warn('[CapaRoute] schema ensure warning:', e.message);
  }
  next();
});

async function hasCapaApprovalAuthority(req, mode = 'approve') {
  if (!req.user || !req.user.id) return { ok: false, status: 401, message: 'Authentication required' };
  const role = String(req.user.role || '').trim().toLowerCase();
  const allowed = mode === 'delete'
    ? ['admin', 'super_admin', 'superadmin', 'manager', 'owner']
    : ['admin', 'super_admin', 'superadmin', 'manager', 'quality manager', 'supervisor', 'owner'];
  if (allowed.includes(role)) return { ok: true };

  if (db.master && typeof db.master.query === 'function') {
    const col = mode === 'delete' ? 'can_delete' : 'can_edit';
    const permRes = await db.master
      .query(
        `SELECT ${col} as allowed FROM user_permissions
         WHERE user_id = ?
           AND LOWER(TRIM(COALESCE(module_name, ''))) IN ('capa', 'customer complaint', 'quality control', 'all')
           AND COALESCE(${col}, 0) = 1
         LIMIT 1`,
        [req.user.id]
      )
      .catch(() => ({ rows: [] }));
    if (permRes.rows?.length > 0) return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    message:
      mode === 'delete'
        ? 'Only Admin or authorized Managers can delete a CAPA document.'
        : 'Insufficient authority. Only Admin, Quality Manager, Manager, or Supervisor can approve/close or waive CAPA verification.'
  };
}

function parseJsonSafe(raw, fallback = []) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : fallback;
  } catch (_) {
    return fallback;
  }
}

async function logCapaAudit(runner, { capaId, capaNo, action, oldStatus, newStatus, performedBy, remarks }) {
  await runner
    .run(
      `INSERT INTO capa_audit_logs (capa_id, capa_no, action, old_status, new_status, performed_by, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [capaId, capaNo || `CAPA-${capaId}`, action, oldStatus || '', newStatus || '', performedBy || 'admin', remarks || '']
    )
    .catch(() => {});
}

// Build automatic CAPA prefill payload from complaint_id / sales_return_id / sales_id
async function buildCapaPrefill(companyId, { complaintId, salesReturnId, salesId }) {
  const runner = db.forCompany(companyId);
  let cmp = null;
  let cmpItems = [];
  let sr = null;
  let srItems = [];

  if (salesReturnId) {
    const srRes = await runner.query(`SELECT * FROM sales_return WHERE id = ? LIMIT 1`, [salesReturnId]).catch(() => ({ rows: [] }));
    sr = srRes.rows?.[0] || null;
    if (sr) {
      srItems = (await runner.query(`SELECT * FROM sales_return_items WHERE sales_return_id = ? ORDER BY id ASC`, [sr.id]).catch(() => ({ rows: [] }))).rows || [];
      if (!complaintId && sr.complaint_id) {
        complaintId = sr.complaint_id;
      } else if (!complaintId && sr.complaint_no) {
        const cmpLookup = await runner.query(`SELECT id FROM customer_complaints WHERE UPPER(TRIM(complaint_no)) = UPPER(TRIM(?)) LIMIT 1`, [sr.complaint_no]).catch(() => ({ rows: [] }));
        if (cmpLookup.rows?.[0]?.id) complaintId = cmpLookup.rows[0].id;
      }
      if (!salesId && sr.original_sales_id) salesId = sr.original_sales_id;
    }
  }

  if (complaintId) {
    const cmpRes = await runner.query(`SELECT * FROM customer_complaints WHERE id = ? LIMIT 1`, [complaintId]).catch(() => ({ rows: [] }));
    cmp = cmpRes.rows?.[0] || null;
    if (cmp) {
      cmpItems = (await runner.query(`SELECT * FROM customer_complaint_items WHERE complaint_id = ? ORDER BY id ASC`, [cmp.id]).catch(() => ({ rows: [] }))).rows || [];
      if (!salesId && cmp.original_sales_id) salesId = cmp.original_sales_id;
      // If complaint has linked sales returns and none explicitly chosen, pick the latest active one for context
      if (!sr) {
        const relSr = await runner
          .query(
            `SELECT * FROM sales_return
             WHERE (complaint_id = ? OR (COALESCE(complaint_no,'') != '' AND UPPER(TRIM(complaint_no)) = UPPER(TRIM(?))))
               AND COALESCE(UPPER(approval_status), 'PENDING') != 'CANCELLED'
             ORDER BY id DESC LIMIT 1`,
            [cmp.id, cmp.complaint_no || '']
          )
          .catch(() => ({ rows: [] }));
        if (relSr.rows?.[0]) {
          sr = relSr.rows[0];
          srItems = (await runner.query(`SELECT * FROM sales_return_items WHERE sales_return_id = ? ORDER BY id ASC`, [sr.id]).catch(() => ({ rows: [] }))).rows || [];
        }
      }
    }
  }

  // Merge affected items across complaint_items & sales_return_items
  const mergedMap = new Map();
  const makeKey = (name, lot) => `${String(name || '').trim().toLowerCase()}|${String(lot || '').trim().toUpperCase()}`;

  for (const ci of cmpItems) {
    const k = makeKey(ci.item_name, ci.lot_no);
    mergedMap.set(k, {
      complaint_item_id: ci.id,
      sales_return_item_id: null,
      item_id: ci.item_id || null,
      product_name: ci.item_name,
      product_code: ci.product_code || '',
      lot_no: ci.lot_no || '',
      mfg_date: sanitizeDate(ci.mfg_date),
      exp_date: sanitizeDate(ci.exp_date),
      invoice_qty: round2(ci.invoice_qty || 0),
      complaint_qty: round2(ci.complaint_qty || 0),
      returned_qty: 0,
      uom: ci.uom || 'Bags'
    });
  }

  for (const si of srItems) {
    const k = makeKey(si.item_name, si.lot_no);
    if (mergedMap.has(k)) {
      const existing = mergedMap.get(k);
      existing.sales_return_item_id = si.id;
      existing.returned_qty = round2(existing.returned_qty + Number(si.qty || 0));
      if (!existing.invoice_qty && si.original_sold_qty) existing.invoice_qty = round2(si.original_sold_qty);
      if (!existing.mfg_date && si.mfg_date) existing.mfg_date = sanitizeDate(si.mfg_date);
      if (!existing.exp_date && si.exp_date) existing.exp_date = sanitizeDate(si.exp_date);
    } else {
      mergedMap.set(k, {
        complaint_item_id: si.complaint_item_id || null,
        sales_return_item_id: si.id,
        item_id: si.item_id || null,
        product_name: si.item_name,
        product_code: '',
        lot_no: si.lot_no || '',
        mfg_date: sanitizeDate(si.mfg_date),
        exp_date: sanitizeDate(si.exp_date),
        invoice_qty: round2(si.original_sold_qty || 0),
        complaint_qty: round2(si.complaint_qty || cmp?.complaint_qty || 0),
        returned_qty: round2(si.qty || 0),
        uom: si.uom || 'Bags'
      });
    }
  }

  // Fallback if complaint had only single header fields
  if (mergedMap.size === 0 && cmp && (cmp.product_name || cmp.lot_no)) {
    mergedMap.set(makeKey(cmp.product_name, cmp.lot_no), {
      complaint_item_id: null,
      sales_return_item_id: null,
      item_id: null,
      product_name: cmp.product_name,
      product_code: '',
      lot_no: cmp.lot_no || '',
      mfg_date: '',
      exp_date: '',
      invoice_qty: 0,
      complaint_qty: round2(cmp.complaint_qty || cmp.qty_affected || 0),
      returned_qty: 0,
      uom: 'Bags'
    });
  }

  let items = Array.from(mergedMap.values());
  const trace = await resolveBatchAndRmTraceability(
    companyId,
    items.map((i) => ({
      item_name: i.product_name,
      lot_no: i.lot_no,
      mfg_date: i.mfg_date,
      exp_date: i.exp_date,
      invoice_qty: i.invoice_qty
    })),
    { originalSalesId: salesId || null }
  );

  // Enrich items with batch_no, rm_lot_nos, qc_summary & item_code
  const itemMasterRes = await runner.query(`SELECT id, item_code, item_name FROM item_master`).catch(() => ({ rows: [] }));
  const imList = itemMasterRes.rows || [];
  items = items.map((it) => {
    const tr = trace.find((t) => String(t.lot_no || '').toUpperCase() === String(it.lot_no || '').toUpperCase()) || trace[0];
    const im = imList.find((x) => (it.item_id && Number(x.id) === Number(it.item_id)) || String(x.item_name || '').trim().toLowerCase() === String(it.product_name || '').trim().toLowerCase());
    return {
      ...it,
      product_code: it.product_code || im?.item_code || '',
      mfg_date: it.mfg_date || tr?.mfg_date || '',
      exp_date: it.exp_date || tr?.exp_date || '',
      batch_no: (tr?.manufacturing_batches || []).map((b) => b.batch_no).filter(Boolean).join(', ') || (tr?.packing_batches || []).map((p) => p.packing_no).filter(Boolean).join(', '),
      rm_lot_nos: (tr?.rm_parent_lots || []).map((r) => (r.supplier ? `${r.lot_no} (${r.supplier})` : r.lot_no)).filter(Boolean).join(', '),
      qc_summary: (tr?.qc_inspections || []).map((q) => `${q.qc_no}: ${q.overall_result}`).filter(Boolean).join('; ')
    };
  });

  // Compose QC Inspection Summary string from Sales Return QC + lot QC records
  const qcLines = [];
  if (sr) {
    qcLines.push(
      `Sales Return ${sr.return_no || `SR-${sr.s_no}`}: QC Status=${sr.qc_status || 'Pending'}, Goods Condition=${sr.goods_condition || 'Under Investigation'}, Disposition=${sr.stock_status || 'Hold'}${sr.inspected_by ? `, Inspected By=${sr.inspected_by}` : ''}${sr.qc_remarks ? `, Remarks: ${sr.qc_remarks}` : ''}`
    );
  }
  for (const tr of trace) {
    for (const q of (tr.qc_inspections || [])) {
      qcLines.push(`Lab QC ${q.qc_no} (Lot ${q.lot_no}, ${q.inspection_date || '-'}): ${q.overall_result || 'Recorded'}${q.inspector ? ` by ${q.inspector}` : ''}${q.remarks ? ` - ${q.remarks}` : ''}`);
    }
  }

  return {
    capa_source: sr && !cmp ? 'Sales Return' : cmp ? 'Customer Complaint' : 'Internal QC',
    complaint_id: cmp?.id || null,
    complaint_no: cmp?.complaint_no || sr?.complaint_no || '',
    sales_return_id: sr?.id || null,
    sales_return_no: sr ? sr.return_no || `SR-${String(sr.s_no || sr.id).padStart(5, '0')}` : '',
    original_sales_id: cmp?.original_sales_id || sr?.original_sales_id || salesId || null,
    original_invoice_no: cmp?.original_invoice_no || cmp?.invoice_no || sr?.original_invoice_no || '',
    customer_id: cmp?.customer_id || sr?.customer_id || null,
    customer_name: cmp?.customer_name || sr?.customer || '',
    customer_complaint_ref: cmp?.customer_complaint_ref || '',
    reported_problem: cmp?.complaint_description || cmp?.description || sr?.return_reason_detail || sr?.quality_issue_desc || '',
    complaint_category: cmp?.complaint_category || cmp?.complaint_type || sr?.return_reason_category || 'Quality',
    complaint_date: sanitizeDate(cmp?.complaint_date || sr?.date),
    affected_condition: sr?.goods_condition || sr?.quality_issue_desc || cmp?.severity || '',
    evidence: cmp ? parseJsonSafe(cmp.evidence_json, []) : [],
    customer_communication: cmp?.customer_communication || '',
    qc_inspection_results: qcLines.join('\n'),
    batch_traceability: trace,
    items
  };
}

// GET next CAPA number
router.get('/next-no', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const r = await runner.query(`SELECT MAX(id) as max_id, COUNT(*) as cnt FROM capa_documents`);
    const nextNum = Math.max(parseInt(r.rows?.[0]?.max_id, 10) || 0, parseInt(r.rows?.[0]?.cnt, 10) || 0) + 1;
    res.json({ success: true, next_seq: nextNum, capa_no: `CAPA-${String(nextNum).padStart(5, '0')}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET lookups for CAPA Entry form
router.get('/form-lookups', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);

    const [cmpRes, srRes, custRes, itemRes] = await Promise.all([
      runner
        .query(
          `SELECT id, complaint_no, complaint_date, customer_name, original_invoice_no, invoice_no, product_name, lot_no,
                  complaint_category, complaint_type, severity, return_required, investigation_status, complaint_qty
           FROM customer_complaints ORDER BY id DESC LIMIT 150`
        )
        .catch(() => ({ rows: [] })),
      runner
        .query(
          `SELECT id, s_no, return_no, date, customer, original_invoice_no, complaint_id, complaint_no,
                  return_reason_category, qc_status, stock_status, total_qty, total_wt
           FROM sales_return
           WHERE COALESCE(UPPER(approval_status), 'PENDING') != 'CANCELLED'
           ORDER BY id DESC LIMIT 150`
        )
        .catch(() => ({ rows: [] })),
      runner.query(`SELECT id, name, print_name FROM customer_master WHERE COALESCE(status, 'Active') = 'Active' ORDER BY name ASC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, item_code, item_name FROM item_master WHERE COALESCE(status, 'Active') = 'Active' ORDER BY item_name ASC`).catch(() => ({ rows: [] }))
    ]);

    res.json({
      success: true,
      data: {
        complaints: cmpRes.rows || [],
        salesReturns: (srRes.rows || []).map((r) => ({
          ...r,
          return_no: r.return_no || `SR-${String(r.s_no || r.id).padStart(5, '0')}`
        })),
        customers: custRes.rows || [],
        items: itemRes.rows || [],
        sources: CAPA_SOURCES,
        rcaMethods: RCA_METHODS,
        statuses: CAPA_STATUSES,
        effectivenessOptions: EFFECTIVENESS_STATUSES
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET prefill from complaint_id and/or sales_return_id
router.get('/prefill', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const complaintId = req.query.complaint_id ? parseInt(req.query.complaint_id, 10) : null;
    const salesReturnId = req.query.sales_return_id ? parseInt(req.query.sales_return_id, 10) : null;
    const salesId = req.query.sales_id ? parseInt(req.query.sales_id, 10) : null;

    const data = await buildCapaPrefill(activeCompanyId, { complaintId, salesReturnId, salesId });
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error building CAPA prefill:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET CAPA Reports analytics summary (complaint trends, root causes, action effectiveness)
router.get('/reports/summary', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const { from_date, to_date } = req.query;
    const today = new Date().toISOString().slice(0, 10);

    const [cmpRes, capaRes, itemRes] = await Promise.all([
      runner.query(`SELECT * FROM customer_complaints ORDER BY complaint_date DESC, id DESC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT * FROM capa_documents ORDER BY capa_date DESC, id DESC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT * FROM capa_items ORDER BY capa_id DESC, id ASC`).catch(() => ({ rows: [] }))
    ]);

    let complaints = cmpRes.rows || [];
    let capas = capaRes.rows || [];

    if (from_date) {
      complaints = complaints.filter((c) => !c.complaint_date || String(c.complaint_date).slice(0, 10) >= from_date);
      capas = capas.filter((c) => !c.capa_date || String(c.capa_date).slice(0, 10) >= from_date);
    }
    if (to_date) {
      complaints = complaints.filter((c) => !c.complaint_date || String(c.complaint_date).slice(0, 10) <= to_date);
      capas = capas.filter((c) => !c.capa_date || String(c.capa_date).slice(0, 10) <= to_date);
    }

    const itemsByCapa = new Map();
    for (const it of (itemRes.rows || [])) {
      if (!itemsByCapa.has(it.capa_id)) itemsByCapa.set(it.capa_id, []);
      itemsByCapa.get(it.capa_id).push(it);
    }

    // KPIs
    const openCapas = capas.filter((c) => c.capa_status === 'Open').length;
    const inProgCapas = capas.filter((c) => c.capa_status === 'In Progress').length;
    const verifCapas = capas.filter((c) => c.capa_status === 'Verification').length;
    const closedCapas = capas.filter((c) => c.capa_status === 'Closed').length;
    const effectiveCapas = capas.filter((c) => c.effectiveness_status === 'Effective').length;
    const notEffectiveCapas = capas.filter((c) => c.effectiveness_status === 'Not Effective').length;
    const verifiedTotal = effectiveCapas + notEffectiveCapas;
    const effectivenessRate = verifiedTotal > 0 ? round2((effectiveCapas / verifiedTotal) * 100) : 0;

    const overdueCapas = capas.filter((c) => {
      if (c.capa_status === 'Closed') return false;
      const target = sanitizeDate(c.corrective_target_date || c.preventive_target_date);
      return Boolean(target && target < today);
    });

    // Monthly Trends
    const monthMap = new Map();
    const bumpMonth = (dateStr, field) => {
      const m = String(dateStr || '').slice(0, 7) || 'Unknown';
      if (!monthMap.has(m)) monthMap.set(m, { month: m, complaints: 0, capas: 0, closed: 0, effective: 0 });
      monthMap.get(m)[field] += 1;
    };
    complaints.forEach((c) => bumpMonth(c.complaint_date, 'complaints'));
    capas.forEach((c) => {
      bumpMonth(c.capa_date, 'capas');
      if (c.capa_status === 'Closed') bumpMonth(c.capa_date, 'closed');
      if (c.effectiveness_status === 'Effective') bumpMonth(c.capa_date, 'effective');
    });
    const monthlyTrends = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    // Category Breakdown (from Complaints + CAPAs)
    const catMap = new Map();
    for (const c of complaints) {
      const cat = c.complaint_category || c.complaint_type || 'Quality';
      if (!catMap.has(cat)) catMap.set(cat, { category: cat, complaints: 0, capas: 0, return_required: 0 });
      catMap.get(cat).complaints += 1;
      if (c.return_required) catMap.get(cat).return_required += 1;
    }
    for (const ca of capas) {
      const cat = ca.complaint_category || 'Quality';
      if (!catMap.has(cat)) catMap.set(cat, { category: cat, complaints: 0, capas: 0, return_required: 0 });
      catMap.get(cat).capas += 1;
    }

    // Root Cause & RCA Method Breakdown
    const rcaMethodMap = new Map();
    const rootCauseMap = new Map();
    for (const ca of capas) {
      const method = ca.rca_method || '5 Why';
      rcaMethodMap.set(method, (rcaMethodMap.get(method) || 0) + 1);
      const rc = String(ca.identified_root_cause || '').trim();
      if (rc) {
        const key = rc.slice(0, 120);
        if (!rootCauseMap.has(key)) rootCauseMap.set(key, { root_cause: key, count: 0, effective: 0, closed: 0 });
        rootCauseMap.get(key).count += 1;
        if (ca.effectiveness_status === 'Effective') rootCauseMap.get(key).effective += 1;
        if (ca.capa_status === 'Closed') rootCauseMap.get(key).closed += 1;
      }
    }

    // Owner Workload & Effectiveness
    const ownerMap = new Map();
    for (const ca of capas) {
      const owner = String(ca.corrective_person || ca.preventive_person || 'Unassigned').trim() || 'Unassigned';
      if (!ownerMap.has(owner)) ownerMap.set(owner, { person: owner, total: 0, open: 0, closed: 0, effective: 0, overdue: 0 });
      const o = ownerMap.get(owner);
      o.total += 1;
      if (ca.capa_status === 'Closed') o.closed += 1;
      else o.open += 1;
      if (ca.effectiveness_status === 'Effective') o.effective += 1;
      const tDate = sanitizeDate(ca.corrective_target_date || ca.preventive_target_date);
      if (ca.capa_status !== 'Closed' && tDate && tDate < today) o.overdue += 1;
    }

    // Product / Lot Defect Concentration
    const prodMap = new Map();
    for (const ca of capas) {
      const cItems = itemsByCapa.get(ca.id) || [];
      for (const it of cItems) {
        const key = it.product_name || 'Unknown';
        if (!prodMap.has(key)) prodMap.set(key, { product_name: key, capas: 0, complaint_qty: 0, returned_qty: 0 });
        prodMap.get(key).capas += 1;
        prodMap.get(key).complaint_qty = round2(prodMap.get(key).complaint_qty + Number(it.complaint_qty || 0));
        prodMap.get(key).returned_qty = round2(prodMap.get(key).returned_qty + Number(it.returned_qty || 0));
      }
    }

    res.json({
      success: true,
      data: {
        kpis: {
          total_complaints: complaints.length,
          open_complaints: complaints.filter((c) => (c.investigation_status || c.status) !== 'Resolved').length,
          total_capas: capas.length,
          open_capas: openCapas,
          in_progress_capas: inProgCapas,
          verification_capas: verifCapas,
          closed_capas: closedCapas,
          overdue_capas: overdueCapas.length,
          effective_capas: effectiveCapas,
          not_effective_capas: notEffectiveCapas,
          effectiveness_rate: effectivenessRate
        },
        monthlyTrends,
        categoryBreakdown: Array.from(catMap.values()),
        rcaMethodBreakdown: Array.from(rcaMethodMap.entries()).map(([method, count]) => ({ method, count })),
        topRootCauses: Array.from(rootCauseMap.values()).sort((a, b) => b.count - a.count).slice(0, 15),
        ownerPerformance: Array.from(ownerMap.values()).sort((a, b) => b.total - a.total),
        productDefects: Array.from(prodMap.values()).sort((a, b) => b.capas - a.capas).slice(0, 15),
        overdueList: overdueCapas.map((c) => ({
          id: c.id,
          capa_no: c.capa_no,
          capa_date: c.capa_date,
          customer_name: c.customer_name,
          complaint_category: c.complaint_category,
          identified_root_cause: c.identified_root_cause,
          corrective_person: c.corrective_person || c.preventive_person,
          target_date: c.corrective_target_date || c.preventive_target_date,
          capa_status: c.capa_status
        }))
      }
    });
  } catch (err) {
    console.error('Error generating CAPA reports:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all CAPA documents (for 15-column CAPA Display Register)
router.get('/', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const { status, effectiveness, source, search, from_date, to_date } = req.query;

    const docsRes = await runner.query(`SELECT * FROM capa_documents ORDER BY capa_date DESC, id DESC`);
    const itemsRes = await runner.query(`SELECT * FROM capa_items ORDER BY capa_id DESC, id ASC`).catch(() => ({ rows: [] }));

    const itemsByCapa = new Map();
    for (const it of (itemsRes.rows || [])) {
      if (!itemsByCapa.has(it.capa_id)) itemsByCapa.set(it.capa_id, []);
      itemsByCapa.get(it.capa_id).push(it);
    }

    let rows = (docsRes.rows || []).map((doc) => {
      const cItems = itemsByCapa.get(doc.id) || [];
      const itemNames = Array.from(new Set(cItems.map((i) => i.product_name).filter(Boolean)));
      const lotNos = Array.from(new Set(cItems.map((i) => i.lot_no).filter(Boolean)));
      return {
        ...doc,
        items: cItems,
        item_name: itemNames.join(', ') || '—',
        lot_no: lotNos.join(', ') || '—',
        complaint_reason: doc.complaint_category || doc.reported_problem || 'Quality',
        responsible_person: doc.corrective_person || doc.preventive_person || '—',
        target_date: doc.corrective_target_date || doc.preventive_target_date || '',
        evidence: parseJsonSafe(doc.evidence_json, []),
        batch_traceability: parseJsonSafe(doc.batch_traceability_json, [])
      };
    });

    if (status) rows = rows.filter((r) => r.capa_status === status);
    if (effectiveness) rows = rows.filter((r) => r.effectiveness_status === effectiveness);
    if (source) rows = rows.filter((r) => r.capa_source === source);
    if (from_date) rows = rows.filter((r) => !r.capa_date || String(r.capa_date).slice(0, 10) >= from_date);
    if (to_date) rows = rows.filter((r) => !r.capa_date || String(r.capa_date).slice(0, 10) <= to_date);
    if (search) {
      const q = String(search).trim().toLowerCase();
      rows = rows.filter((r) =>
        `${r.capa_no} ${r.complaint_no} ${r.sales_return_no} ${r.original_invoice_no} ${r.customer_name} ${r.item_name} ${r.lot_no} ${r.identified_root_cause} ${r.responsible_person}`
          .toLowerCase()
          .includes(q)
      );
    }

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing CAPAs:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single CAPA dossier with Sections A–H, linked records, live traceability, and audit trail
router.get('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid CAPA ID' });
    }

    const docRes = await runner.query(`SELECT * FROM capa_documents WHERE id = ? LIMIT 1`, [id]);
    if (!docRes.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'CAPA document not found' });
    }
    const doc = docRes.rows[0];
    const items = (await runner.query(`SELECT * FROM capa_items WHERE capa_id = ? ORDER BY id ASC`, [id])).rows || [];
    const auditLogs = (await runner.query(`SELECT * FROM capa_audit_logs WHERE capa_id = ? ORDER BY id DESC`, [id]).catch(() => ({ rows: [] }))).rows || [];

    // Fetch live linked complaint & sales returns for independent drilldown
    let linkedComplaint = null;
    if (doc.complaint_id) {
      const cRes = await runner.query(`SELECT id, complaint_no, complaint_date, investigation_status, severity, return_required FROM customer_complaints WHERE id = ? LIMIT 1`, [doc.complaint_id]).catch(() => ({ rows: [] }));
      linkedComplaint = cRes.rows?.[0] || null;
    }

    const linkedReturns = (
      await runner
        .query(
          `SELECT id, s_no, return_no, date, total_qty, grand_total, qc_status, stock_status, settlement_status, workflow_status
           FROM sales_return
           WHERE (id = ? OR (complaint_id IS NOT NULL AND complaint_id = ?))
             AND COALESCE(UPPER(approval_status), 'PENDING') != 'CANCELLED'
           ORDER BY id DESC`,
          [doc.sales_return_id || -1, doc.complaint_id || -1]
        )
        .catch(() => ({ rows: [] }))
    ).rows || [];

    let batchTraceability = parseJsonSafe(doc.batch_traceability_json, []);
    if (batchTraceability.length === 0 && items.length > 0) {
      batchTraceability = await resolveBatchAndRmTraceability(
        activeCompanyId,
        items.map((i) => ({ item_name: i.product_name, lot_no: i.lot_no, mfg_date: i.mfg_date, exp_date: i.exp_date })),
        { originalSalesId: doc.original_sales_id }
      );
    }

    res.json({
      success: true,
      data: {
        ...doc,
        items,
        evidence: parseJsonSafe(doc.evidence_json, []),
        batch_traceability: batchTraceability,
        linked_complaint: linkedComplaint,
        linked_sales_returns: linkedReturns,
        audit_logs: auditLogs
      }
    });
  } catch (err) {
    console.error('Error fetching CAPA detail:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Shared CAPA item normalizer
async function prepareCapaItems(companyId, rawItems, traceabilityList = []) {
  const runner = db.forCompany(companyId);
  const valid = Array.isArray(rawItems) ? rawItems.filter((it) => String(it?.product_name || it?.item_name || '').trim()) : [];
  const itemMasterRes = await runner.query(`SELECT id, item_code, item_name FROM item_master`).catch(() => ({ rows: [] }));
  const imList = itemMasterRes.rows || [];

  return valid.map((it) => {
    const pName = String(it.product_name || it.item_name || '').trim();
    const lotNo = String(it.lot_no || '').trim();
    const tr = traceabilityList.find((t) => lotNo && String(t.lot_no || '').toUpperCase() === lotNo.toUpperCase());
    const im = imList.find((x) => (it.item_id && Number(x.id) === Number(it.item_id)) || String(x.item_name || '').trim().toLowerCase() === pName.toLowerCase());
    return {
      complaint_item_id: it.complaint_item_id || null,
      sales_return_item_id: it.sales_return_item_id || null,
      item_id: it.item_id || im?.id || null,
      product_name: pName,
      product_code: String(it.product_code || im?.item_code || '').trim(),
      lot_no: lotNo,
      mfg_date: sanitizeDate(it.mfg_date) || tr?.mfg_date || '',
      exp_date: sanitizeDate(it.exp_date) || tr?.exp_date || '',
      invoice_qty: round2(it.invoice_qty || 0),
      complaint_qty: round2(it.complaint_qty || 0),
      returned_qty: round2(it.returned_qty || 0),
      uom: String(it.uom || 'Bags').trim() || 'Bags',
      batch_no: String(it.batch_no || (tr?.manufacturing_batches || []).map((b) => b.batch_no).join(', ') || '').trim(),
      rm_lot_nos: String(it.rm_lot_nos || (tr?.rm_parent_lots || []).map((r) => r.lot_no).join(', ') || '').trim(),
      qc_summary: String(it.qc_summary || (tr?.qc_inspections || []).map((q) => `${q.qc_no}: ${q.overall_result}`).join('; ') || '').trim()
    };
  });
}

// POST create CAPA Document (never mutates Complaint/Sales Return closed status!)
router.post('/', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const body = req.body || {};

    const cleanDate = sanitizeDate(body.capa_date) || new Date().toISOString().slice(0, 10);
    const source = CAPA_SOURCES.includes(body.capa_source) ? body.capa_source : 'Customer Complaint';
    const rcaMethod = RCA_METHODS.includes(body.rca_method) ? body.rca_method : '5 Why';
    const status = ['Open', 'In Progress', 'Verification'].includes(body.capa_status) ? body.capa_status : 'Open';
    const effectiveness = EFFECTIVENESS_STATUSES.includes(body.effectiveness_status) ? body.effectiveness_status : 'Pending';
    const createdBy = req.user?.username || body.prepared_by || 'admin';

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const traceList =
      Array.isArray(body.batch_traceability) && body.batch_traceability.length > 0
        ? body.batch_traceability
        : await resolveBatchAndRmTraceability(
            activeCompanyId,
            rawItems.map((i) => ({ item_name: i.product_name || i.item_name, lot_no: i.lot_no })),
            { originalSalesId: body.original_sales_id || null }
          );

    const items = await prepareCapaItems(activeCompanyId, rawItems, traceList);
    if (items.length === 0 && !String(body.reported_problem || '').trim()) {
      return res.status(400).json({ success: false, message: 'Provide at least one affected product/lot or reported problem description.' });
    }

    const evidence = sanitizeEvidenceList(body.evidence || body.evidence_json);

    const txOut = await db.forCompany(activeCompanyId).withTransaction(async () => {
      let capaNo = String(body.capa_no || '').trim();
      if (!capaNo) {
        const seqRes = await runner.query(`SELECT MAX(id) as max_id, COUNT(*) as cnt FROM capa_documents`);
        const nextNum = Math.max(parseInt(seqRes.rows?.[0]?.max_id, 10) || 0, parseInt(seqRes.rows?.[0]?.cnt, 10) || 0) + 1;
        capaNo = `CAPA-${String(nextNum).padStart(5, '0')}`;
      }

      const insRes = await db.run(
        `INSERT INTO capa_documents (
          capa_no, capa_date, capa_source, complaint_id, complaint_no, sales_return_id, sales_return_no,
          original_sales_id, original_invoice_no, customer_id, customer_name, customer_complaint_ref,
          reported_problem, complaint_category, complaint_date, affected_condition, evidence_json, customer_communication,
          investigation_findings, qc_inspection_results, batch_traceability_json, identified_root_cause, rca_method, rca_details,
          immediate_containment, existing_problem_correction, corrective_action_desc, corrective_dept, corrective_person,
          corrective_target_date, corrective_completion_date, corrective_evidence, corrective_status,
          preventive_action_desc, process_improvement, training_required, training_details, inspection_testing_improvement,
          preventive_person, preventive_target_date, preventive_completion_date, preventive_status,
          verification_method, verification_date, followup_inspection_results, effectiveness_evidence,
          effectiveness_status, further_action_required, further_action_notes,
          capa_status, prepared_by, quality_manager, production_manager, final_remarks,
          company_id, created_by, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, CURRENT_TIMESTAMP
        )`,
        [
          capaNo,
          cleanDate,
          source,
          body.complaint_id ? Number(body.complaint_id) : null,
          String(body.complaint_no || '').trim(),
          body.sales_return_id ? Number(body.sales_return_id) : null,
          String(body.sales_return_no || '').trim(),
          body.original_sales_id ? Number(body.original_sales_id) : null,
          String(body.original_invoice_no || '').trim(),
          body.customer_id ? Number(body.customer_id) : null,
          String(body.customer_name || '').trim(),
          String(body.customer_complaint_ref || '').trim(),
          String(body.reported_problem || '').trim(),
          String(body.complaint_category || 'Quality').trim(),
          sanitizeDate(body.complaint_date) || '',
          String(body.affected_condition || '').trim(),
          JSON.stringify(evidence),
          String(body.customer_communication || '').trim(),
          String(body.investigation_findings || '').trim(),
          String(body.qc_inspection_results || '').trim(),
          JSON.stringify(traceList),
          String(body.identified_root_cause || '').trim(),
          rcaMethod,
          String(body.rca_details || '').trim(),
          String(body.immediate_containment || '').trim(),
          String(body.existing_problem_correction || '').trim(),
          String(body.corrective_action_desc || '').trim(),
          String(body.corrective_dept || '').trim(),
          String(body.corrective_person || '').trim(),
          sanitizeDate(body.corrective_target_date) || '',
          sanitizeDate(body.corrective_completion_date) || '',
          String(body.corrective_evidence || '').trim(),
          String(body.corrective_status || (body.corrective_completion_date ? 'Completed' : 'Pending')).trim(),
          String(body.preventive_action_desc || '').trim(),
          String(body.process_improvement || '').trim(),
          body.training_required ? 1 : 0,
          String(body.training_details || '').trim(),
          String(body.inspection_testing_improvement || '').trim(),
          String(body.preventive_person || '').trim(),
          sanitizeDate(body.preventive_target_date) || '',
          sanitizeDate(body.preventive_completion_date) || '',
          String(body.preventive_status || (body.preventive_completion_date ? 'Completed' : 'Pending')).trim(),
          String(body.verification_method || '').trim(),
          sanitizeDate(body.verification_date) || '',
          String(body.followup_inspection_results || '').trim(),
          String(body.effectiveness_evidence || '').trim(),
          effectiveness,
          body.further_action_required ? 1 : 0,
          String(body.further_action_notes || '').trim(),
          status,
          String(body.prepared_by || createdBy).trim(),
          String(body.quality_manager || '').trim(),
          String(body.production_manager || '').trim(),
          String(body.final_remarks || '').trim(),
          activeCompanyId,
          createdBy
        ],
        activeCompanyId
      );

      const capaId = insRes.lastID || insRes.lastInsertRowid;
      for (const it of items) {
        await db.run(
          `INSERT INTO capa_items (
            capa_id, complaint_item_id, sales_return_item_id, item_id, product_name, product_code,
            lot_no, mfg_date, exp_date, invoice_qty, complaint_qty, returned_qty, uom, batch_no, rm_lot_nos, qc_summary
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            capaId,
            it.complaint_item_id,
            it.sales_return_item_id,
            it.item_id,
            it.product_name,
            it.product_code,
            it.lot_no,
            it.mfg_date,
            it.exp_date,
            it.invoice_qty,
            it.complaint_qty,
            it.returned_qty,
            it.uom,
            it.batch_no,
            it.rm_lot_nos,
            it.qc_summary
          ],
          activeCompanyId
        );
      }

      await logCapaAudit(runner, {
        capaId,
        capaNo,
        action: 'CREATED',
        oldStatus: '',
        newStatus: status,
        performedBy: createdBy,
        remarks: `Source: ${source}${body.complaint_no ? ` | Complaint: ${body.complaint_no}` : ''}${body.sales_return_no ? ` | Return: ${body.sales_return_no}` : ''}`
      });

      return { id: capaId, capa_no: capaNo };
    });

    res.status(201).json({
      success: true,
      id: txOut.id,
      capa_no: txOut.capa_no,
      message: `CAPA Document ${txOut.capa_no} created cleanly.`
    });
  } catch (err) {
    console.error('Error creating CAPA:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update CAPA Sections A–H (cannot switch to Closed here — must use /approve-close gate)
router.put('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid CAPA ID' });
    }

    const existingRes = await runner.query(`SELECT * FROM capa_documents WHERE id = ? LIMIT 1`, [id]);
    if (!existingRes.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'CAPA document not found' });
    }
    const existing = existingRes.rows[0];
    if (existing.capa_status === 'Closed') {
      return res.status(400).json({
        success: false,
        message: 'Closed CAPA documents cannot be edited directly. Reopen the CAPA first with authorized reason.'
      });
    }

    const body = req.body || {};
    const updatedBy = req.user?.username || 'admin';
    const nextStatus = ['Open', 'In Progress', 'Verification'].includes(body.capa_status) ? body.capa_status : existing.capa_status;
    const effectiveness = EFFECTIVENESS_STATUSES.includes(body.effectiveness_status) ? body.effectiveness_status : existing.effectiveness_status;
    const rcaMethod = RCA_METHODS.includes(body.rca_method) ? body.rca_method : existing.rca_method;
    const source = CAPA_SOURCES.includes(body.capa_source) ? body.capa_source : existing.capa_source;

    const rawItems = Array.isArray(body.items) ? body.items : null;
    const traceList = Array.isArray(body.batch_traceability)
      ? body.batch_traceability
      : rawItems
      ? await resolveBatchAndRmTraceability(
          activeCompanyId,
          rawItems.map((i) => ({ item_name: i.product_name || i.item_name, lot_no: i.lot_no })),
          { originalSalesId: body.original_sales_id ?? existing.original_sales_id }
        )
      : parseJsonSafe(existing.batch_traceability_json, []);

    const items = rawItems ? await prepareCapaItems(activeCompanyId, rawItems, traceList) : null;
    const evidence = body.evidence !== undefined ? sanitizeEvidenceList(body.evidence) : parseJsonSafe(existing.evidence_json, []);

    await db.forCompany(activeCompanyId).withTransaction(async () => {
      await db.run(
        `UPDATE capa_documents SET
          capa_date = ?, capa_source = ?, complaint_id = ?, complaint_no = ?, sales_return_id = ?, sales_return_no = ?,
          original_sales_id = ?, original_invoice_no = ?, customer_id = ?, customer_name = ?, customer_complaint_ref = ?,
          reported_problem = ?, complaint_category = ?, complaint_date = ?, affected_condition = ?, evidence_json = ?, customer_communication = ?,
          investigation_findings = ?, qc_inspection_results = ?, batch_traceability_json = ?, identified_root_cause = ?, rca_method = ?, rca_details = ?,
          immediate_containment = ?, existing_problem_correction = ?, corrective_action_desc = ?, corrective_dept = ?, corrective_person = ?,
          corrective_target_date = ?, corrective_completion_date = ?, corrective_evidence = ?, corrective_status = ?,
          preventive_action_desc = ?, process_improvement = ?, training_required = ?, training_details = ?, inspection_testing_improvement = ?,
          preventive_person = ?, preventive_target_date = ?, preventive_completion_date = ?, preventive_status = ?,
          verification_method = ?, verification_date = ?, followup_inspection_results = ?, effectiveness_evidence = ?,
          effectiveness_status = ?, further_action_required = ?, further_action_notes = ?,
          capa_status = ?, prepared_by = ?, quality_manager = ?, production_manager = ?, final_remarks = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          sanitizeDate(body.capa_date) || existing.capa_date,
          source,
          body.complaint_id !== undefined ? (body.complaint_id ? Number(body.complaint_id) : null) : existing.complaint_id,
          String(body.complaint_no ?? existing.complaint_no ?? '').trim(),
          body.sales_return_id !== undefined ? (body.sales_return_id ? Number(body.sales_return_id) : null) : existing.sales_return_id,
          String(body.sales_return_no ?? existing.sales_return_no ?? '').trim(),
          body.original_sales_id !== undefined ? (body.original_sales_id ? Number(body.original_sales_id) : null) : existing.original_sales_id,
          String(body.original_invoice_no ?? existing.original_invoice_no ?? '').trim(),
          body.customer_id !== undefined ? (body.customer_id ? Number(body.customer_id) : null) : existing.customer_id,
          String(body.customer_name ?? existing.customer_name ?? '').trim(),
          String(body.customer_complaint_ref ?? existing.customer_complaint_ref ?? '').trim(),
          String(body.reported_problem ?? existing.reported_problem ?? '').trim(),
          String(body.complaint_category ?? existing.complaint_category ?? 'Quality').trim(),
          sanitizeDate(body.complaint_date) || existing.complaint_date || '',
          String(body.affected_condition ?? existing.affected_condition ?? '').trim(),
          JSON.stringify(evidence),
          String(body.customer_communication ?? existing.customer_communication ?? '').trim(),
          String(body.investigation_findings ?? existing.investigation_findings ?? '').trim(),
          String(body.qc_inspection_results ?? existing.qc_inspection_results ?? '').trim(),
          JSON.stringify(traceList),
          String(body.identified_root_cause ?? existing.identified_root_cause ?? '').trim(),
          rcaMethod,
          String(body.rca_details ?? existing.rca_details ?? '').trim(),
          String(body.immediate_containment ?? existing.immediate_containment ?? '').trim(),
          String(body.existing_problem_correction ?? existing.existing_problem_correction ?? '').trim(),
          String(body.corrective_action_desc ?? existing.corrective_action_desc ?? '').trim(),
          String(body.corrective_dept ?? existing.corrective_dept ?? '').trim(),
          String(body.corrective_person ?? existing.corrective_person ?? '').trim(),
          sanitizeDate(body.corrective_target_date ?? existing.corrective_target_date),
          sanitizeDate(body.corrective_completion_date ?? existing.corrective_completion_date),
          String(body.corrective_evidence ?? existing.corrective_evidence ?? '').trim(),
          String(body.corrective_status || (body.corrective_completion_date ? 'Completed' : existing.corrective_status || 'Pending')).trim(),
          String(body.preventive_action_desc ?? existing.preventive_action_desc ?? '').trim(),
          String(body.process_improvement ?? existing.process_improvement ?? '').trim(),
          body.training_required !== undefined ? (body.training_required ? 1 : 0) : existing.training_required,
          String(body.training_details ?? existing.training_details ?? '').trim(),
          String(body.inspection_testing_improvement ?? existing.inspection_testing_improvement ?? '').trim(),
          String(body.preventive_person ?? existing.preventive_person ?? '').trim(),
          sanitizeDate(body.preventive_target_date ?? existing.preventive_target_date),
          sanitizeDate(body.preventive_completion_date ?? existing.preventive_completion_date),
          String(body.preventive_status || (body.preventive_completion_date ? 'Completed' : existing.preventive_status || 'Pending')).trim(),
          String(body.verification_method ?? existing.verification_method ?? '').trim(),
          sanitizeDate(body.verification_date ?? existing.verification_date),
          String(body.followup_inspection_results ?? existing.followup_inspection_results ?? '').trim(),
          String(body.effectiveness_evidence ?? existing.effectiveness_evidence ?? '').trim(),
          effectiveness,
          body.further_action_required !== undefined ? (body.further_action_required ? 1 : 0) : existing.further_action_required,
          String(body.further_action_notes ?? existing.further_action_notes ?? '').trim(),
          nextStatus,
          String(body.prepared_by ?? existing.prepared_by ?? updatedBy).trim(),
          String(body.quality_manager ?? existing.quality_manager ?? '').trim(),
          String(body.production_manager ?? existing.production_manager ?? '').trim(),
          String(body.final_remarks ?? existing.final_remarks ?? '').trim(),
          id
        ],
        activeCompanyId
      );

      if (items) {
        await db.run(`DELETE FROM capa_items WHERE capa_id = ?`, [id], activeCompanyId);
        for (const it of items) {
          await db.run(
            `INSERT INTO capa_items (
              capa_id, complaint_item_id, sales_return_item_id, item_id, product_name, product_code,
              lot_no, mfg_date, exp_date, invoice_qty, complaint_qty, returned_qty, uom, batch_no, rm_lot_nos, qc_summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              it.complaint_item_id,
              it.sales_return_item_id,
              it.item_id,
              it.product_name,
              it.product_code,
              it.lot_no,
              it.mfg_date,
              it.exp_date,
              it.invoice_qty,
              it.complaint_qty,
              it.returned_qty,
              it.uom,
              it.batch_no,
              it.rm_lot_nos,
              it.qc_summary
            ],
            activeCompanyId
          );
        }
      }

      await logCapaAudit(runner, {
        capaId: id,
        capaNo: existing.capa_no,
        action: 'UPDATED',
        oldStatus: existing.capa_status,
        newStatus: nextStatus,
        performedBy: updatedBy,
        remarks: `RCA: ${rcaMethod} | Effectiveness: ${effectiveness}`
      });
    });

    res.json({ success: true, id, message: `CAPA ${existing.capa_no} updated cleanly.` });
  } catch (err) {
    console.error('Error updating CAPA:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Approve & Close CAPA (RBAC-gated; enforces action + effectiveness verification gate unless formally waived)
router.post('/:id/approve-close', async (req, res) => {
  try {
    const auth = await hasCapaApprovalAuthority(req, 'approve');
    if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });

    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid CAPA ID' });
    }

    const existingRes = await runner.query(`SELECT * FROM capa_documents WHERE id = ? LIMIT 1`, [id]);
    if (!existingRes.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'CAPA document not found' });
    }
    const existing = existingRes.rows[0];
    const body = req.body || {};

    const rootCause = String(body.identified_root_cause ?? existing.identified_root_cause ?? '').trim();
    const corrDesc = String(body.corrective_action_desc ?? existing.corrective_action_desc ?? '').trim();
    const corrCompDate = sanitizeDate(body.corrective_completion_date ?? existing.corrective_completion_date);
    const corrStatus = String(body.corrective_status ?? existing.corrective_status ?? (corrCompDate ? 'Completed' : 'Pending')).trim();

    const prevDesc = String(body.preventive_action_desc ?? existing.preventive_action_desc ?? '').trim();
    const prevCompDate = sanitizeDate(body.preventive_completion_date ?? existing.preventive_completion_date);
    const prevStatus = String(body.preventive_status ?? existing.preventive_status ?? (prevCompDate ? 'Completed' : 'Pending')).trim();

    const effStatus = String(body.effectiveness_status ?? existing.effectiveness_status ?? 'Pending').trim();
    const verifDate = sanitizeDate(body.verification_date ?? existing.verification_date);
    const followupRes = String(body.followup_inspection_results ?? existing.followup_inspection_results ?? '').trim();

    const waiveVerification = Boolean(body.waive_verification);
    const waiverReason = String(body.waiver_reason || '').trim();

    const missing = [];
    if (!rootCause) missing.push('Identified Root Cause (Section D)');
    if (!corrDesc || (corrStatus !== 'Completed' && !corrCompDate)) {
      missing.push('Completed Corrective Action (Section E)');
    }
    if (!prevDesc || (prevStatus !== 'Completed' && !prevCompDate)) {
      missing.push('Completed Preventive Action (Section F)');
    }
    if (effStatus !== 'Effective') {
      missing.push(`Effectiveness Verification must be "Effective" (currently "${effStatus}")`);
    } else if (!verifDate && !followupRes) {
      missing.push('Effectiveness Verification Date or Follow-up Results (Section G)');
    }

    if (missing.length > 0 && !waiveVerification) {
      return res.status(400).json({
        success: false,
        message: `CAPA cannot close until required actions and verification are complete: ${missing.join('; ')}.`,
        missing_gates: missing
      });
    }

    if (waiveVerification && !waiverReason) {
      return res.status(400).json({
        success: false,
        message: 'Mandatory Waiver Reason is required when closing CAPA under authorized waiver.'
      });
    }

    const approver = req.user?.username || 'admin';
    const closureDate = sanitizeDate(body.closure_date) || new Date().toISOString().slice(0, 10);
    const qualityManager = String(body.quality_manager ?? existing.quality_manager ?? approver).trim();
    const productionManager = String(body.production_manager ?? existing.production_manager ?? '').trim();
    const finalRemarks = String(body.final_remarks ?? existing.final_remarks ?? '').trim();

    await db.forCompany(activeCompanyId).withTransaction(async () => {
      await db.run(
        `UPDATE capa_documents SET
          identified_root_cause = ?,
          corrective_action_desc = ?,
          corrective_completion_date = ?,
          corrective_status = ?,
          preventive_action_desc = ?,
          preventive_completion_date = ?,
          preventive_status = ?,
          verification_date = ?,
          followup_inspection_results = ?,
          effectiveness_status = ?,
          quality_manager = ?,
          production_manager = ?,
          approved_by = ?,
          approved_at = CURRENT_TIMESTAMP,
          closure_date = ?,
          final_remarks = ?,
          waived_verification = ?,
          waiver_reason = ?,
          waived_by = ?,
          capa_status = 'Closed',
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          rootCause,
          corrDesc,
          corrCompDate,
          corrStatus === 'Completed' || corrCompDate ? 'Completed' : corrStatus,
          prevDesc,
          prevCompDate,
          prevStatus === 'Completed' || prevCompDate ? 'Completed' : prevStatus,
          verifDate,
          followupRes,
          effStatus,
          qualityManager,
          productionManager,
          approver,
          closureDate,
          finalRemarks,
          waiveVerification ? 1 : 0,
          waiveVerification ? waiverReason : '',
          waiveVerification ? approver : '',
          id
        ],
        activeCompanyId
      );

      await logCapaAudit(runner, {
        capaId: id,
        capaNo: existing.capa_no,
        action: waiveVerification ? 'CLOSED_WITH_WAIVER' : 'APPROVED_AND_CLOSED',
        oldStatus: existing.capa_status,
        newStatus: 'Closed',
        performedBy: approver,
        remarks: waiveVerification ? `Waiver Reason: ${waiverReason}` : (finalRemarks || 'All actions & effectiveness verified')
      });
    });

    res.json({
      success: true,
      capa_status: 'Closed',
      closure_date: closureDate,
      approved_by: approver,
      message: waiveVerification
        ? `CAPA ${existing.capa_no} closed under authorized waiver.`
        : `CAPA ${existing.capa_no} approved and closed cleanly.`
    });
  } catch (err) {
    console.error('Error closing CAPA:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Reopen closed CAPA (RBAC-gated)
router.post('/:id/reopen', async (req, res) => {
  try {
    const auth = await hasCapaApprovalAuthority(req, 'approve');
    if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });

    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    const existingRes = await runner.query(`SELECT * FROM capa_documents WHERE id = ? LIMIT 1`, [id]);
    if (!existingRes.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'CAPA document not found' });
    }
    const existing = existingRes.rows[0];
    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reopen reason is required.' });
    }

    const performer = req.user?.username || 'admin';
    await db.forCompany(activeCompanyId).withTransaction(async () => {
      await db.run(
        `UPDATE capa_documents SET capa_status = 'In Progress', closure_date = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id],
        activeCompanyId
      );
      await logCapaAudit(runner, {
        capaId: id,
        capaNo: existing.capa_no,
        action: 'REOPENED',
        oldStatus: existing.capa_status,
        newStatus: 'In Progress',
        performedBy: performer,
        remarks: reason
      });
    });

    res.json({ success: true, capa_status: 'In Progress', message: `CAPA ${existing.capa_no} reopened.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE CAPA (RBAC-gated)
router.delete('/:id', async (req, res) => {
  try {
    const auth = await hasCapaApprovalAuthority(req, 'delete');
    if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });

    const activeCompanyId = getCompanyId(req);
    const id = parseInt(req.params.id, 10);
    await db.forCompany(activeCompanyId).withTransaction(async () => {
      await db.run(`DELETE FROM capa_audit_logs WHERE capa_id = ?`, [id], activeCompanyId);
      await db.run(`DELETE FROM capa_items WHERE capa_id = ?`, [id], activeCompanyId);
      await db.run(`DELETE FROM capa_documents WHERE id = ?`, [id], activeCompanyId);
    });

    res.json({ success: true, message: 'CAPA document deleted cleanly.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
