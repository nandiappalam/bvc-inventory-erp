const express = require('express');
const router = express.Router();
const db = require('../config/database');
const {
  sanitizeDate,
  round2,
  sanitizeEvidenceList,
  resolveBatchAndRmTraceability
} = require('../services/complaintTraceabilityHelper');

const getCompanyId = (req) =>
  req.companyId ||
  (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : (req.user?.company_id || 1));

const _cmpSchemaEnsured = new Set();

const COMPLAINT_CATEGORIES = ['Quality', 'Packaging', 'Weight', 'Delivery', 'Other'];
const SEVERITY_LEVELS = ['Critical', 'Major', 'Minor'];
const INVESTIGATION_STATUSES = ['Open', 'Under Investigation', 'Resolved'];

async function ensureComplaintTables(companyId) {
  if (_cmpSchemaEnsured.has(companyId)) return;

  await db.run(
    `CREATE TABLE IF NOT EXISTS customer_complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_no TEXT UNIQUE NOT NULL,
      complaint_date TEXT NOT NULL,
      customer_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_gstin TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      customer_address TEXT,
      original_sales_id INTEGER,
      invoice_no TEXT,
      original_invoice_no TEXT,
      original_invoice_date TEXT,
      sales_order_no TEXT,
      customer_complaint_ref TEXT,
      product_name TEXT NOT NULL DEFAULT '',
      lot_no TEXT NOT NULL DEFAULT '',
      qty_affected REAL DEFAULT 0,
      complaint_qty REAL DEFAULT 0,
      complaint_weight REAL DEFAULT 0,
      complaint_type TEXT NOT NULL DEFAULT 'Quality',
      complaint_category TEXT NOT NULL DEFAULT 'Quality',
      description TEXT,
      complaint_description TEXT,
      evidence_json TEXT DEFAULT '[]',
      severity TEXT DEFAULT 'Major',
      return_required INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Open',
      investigation_status TEXT DEFAULT 'Open',
      customer_communication TEXT,
      received_by TEXT,
      assigned_to TEXT,
      company_id INTEGER DEFAULT 1,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    [],
    companyId
  );

  const extraCols = [
    'customer_id INTEGER',
    'customer_gstin TEXT',
    'customer_phone TEXT',
    'customer_email TEXT',
    'customer_address TEXT',
    'original_sales_id INTEGER',
    'original_invoice_no TEXT',
    'original_invoice_date TEXT',
    'customer_complaint_ref TEXT',
    'complaint_qty REAL DEFAULT 0',
    'complaint_weight REAL DEFAULT 0',
    "complaint_category TEXT DEFAULT 'Quality'",
    'complaint_description TEXT',
    "evidence_json TEXT DEFAULT '[]'",
    'return_required INTEGER DEFAULT 0',
    "investigation_status TEXT DEFAULT 'Open'",
    'customer_communication TEXT',
    'assigned_to TEXT',
    'created_by TEXT',
    'updated_at DATETIME'
  ];

  for (const col of extraCols) {
    try {
      await db.run(`ALTER TABLE customer_complaints ADD COLUMN ${col}`, [], companyId);
    } catch (_) {}
  }

  await db.run(
    `CREATE TABLE IF NOT EXISTS customer_complaint_items (
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
    )`,
    [],
    companyId
  );

  _cmpSchemaEnsured.add(companyId);
}

router.use(async (req, _res, next) => {
  try {
    await ensureComplaintTables(getCompanyId(req));
  } catch (e) {
    console.warn('[ComplaintsRoute] schema ensure warning:', e.message);
  }
  next();
});

async function hasComplaintAuthority(req) {
  if (!req.user || !req.user.id) return { ok: false, status: 401, message: 'Authentication required' };
  const role = String(req.user.role || '').trim().toLowerCase();
  if (['admin', 'super_admin', 'superadmin', 'manager', 'supervisor', 'quality manager', 'owner'].includes(role)) {
    return { ok: true };
  }
  if (db.master && typeof db.master.query === 'function') {
    const permRes = await db.master
      .query(
        `SELECT can_delete, can_edit FROM user_permissions
         WHERE user_id = ? AND LOWER(TRIM(COALESCE(module_name, ''))) IN ('customer complaint', 'capa', 'quality control', 'all')
           AND (COALESCE(can_delete, 0) = 1 OR COALESCE(can_edit, 0) = 1)
         LIMIT 1`,
        [req.user.id]
      )
      .catch(() => ({ rows: [] }));
    if (permRes.rows?.length > 0) return { ok: true };
  }
  return { ok: false, status: 403, message: 'Insufficient authority to delete customer complaints.' };
}

async function resolveCustomerRecord(runner, customerKey) {
  if (!customerKey && customerKey !== 0) return null;
  const k = String(customerKey).trim();
  if (!k) return null;
  const res = await runner
    .query(
      `SELECT id, name, print_name, gst_number, address1, address2, mobile1, phone_off, email, state, state_code
       FROM customer_master
       WHERE CAST(id AS TEXT) = ?
          OR LOWER(TRIM(COALESCE(name, ''))) = LOWER(?)
          OR LOWER(TRIM(COALESCE(print_name, ''))) = LOWER(?)
       LIMIT 1`,
      [k, k, k]
    )
    .catch(() => ({ rows: [] }));
  return res.rows?.[0] || null;
}

async function lookupLotDates(runner, lotNo) {
  if (!lotNo) return { mfg_date: '', exp_date: '' };
  const cleanLot = String(lotNo).trim();
  if (!cleanLot) return { mfg_date: '', exp_date: '' };

  const pk = await runner
    .query(
      `SELECT p.date as mfg_date FROM packing_items pi JOIN packing p ON p.id = pi.packing_id WHERE UPPER(TRIM(COALESCE(pi.lot_no,''))) = UPPER(?) ORDER BY p.date DESC LIMIT 1`,
      [cleanLot]
    )
    .catch(() => ({ rows: [] }));
  if (pk.rows?.[0]?.mfg_date) return { mfg_date: sanitizeDate(pk.rows[0].mfg_date), exp_date: '' };

  const gr = await runner
    .query(
      `SELECT g.date as mfg_date FROM grain_output_items goi JOIN grains g ON g.id = goi.grain_id WHERE UPPER(TRIM(COALESCE(goi.lot_no,''))) = UPPER(?) ORDER BY g.date DESC LIMIT 1`,
      [cleanLot]
    )
    .catch(() => ({ rows: [] }));
  if (gr.rows?.[0]?.mfg_date) return { mfg_date: sanitizeDate(gr.rows[0].mfg_date), exp_date: '' };

  return { mfg_date: '', exp_date: '' };
}

function normalizeSeverity(sev) {
  const s = String(sev || '').trim().toLowerCase();
  if (s === 'critical') return 'Critical';
  if (s === 'minor' || s === 'low') return 'Minor';
  return 'Major';
}

function normalizeCategory(cat) {
  const c = String(cat || '').trim().toLowerCase();
  if (c === 'packaging') return 'Packaging';
  if (c === 'weight') return 'Weight';
  if (c === 'delivery') return 'Delivery';
  if (c === 'other') return 'Other';
  return 'Quality';
}

function normalizeInvestigationStatus(st) {
  const s = String(st || '').trim().toLowerCase();
  if (s === 'under investigation' || s === 'investigating' || s === 'in progress') return 'Under Investigation';
  if (s === 'resolved' || s === 'closed') return 'Resolved';
  return 'Open';
}

function parseJsonSafe(raw, fallback = []) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

// GET next complaint number
router.get('/next-no', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const r = await runner.query(
      `SELECT MAX(id) as max_id, COUNT(*) as cnt FROM customer_complaints`
    );
    const maxNum = Math.max(
      parseInt(r.rows?.[0]?.max_id, 10) || 0,
      parseInt(r.rows?.[0]?.cnt, 10) || 0
    );
    const seq = maxNum + 1;
    const complaintNo = `CMP-${String(seq).padStart(5, '0')}`;
    res.json({ success: true, next_seq: seq, complaint_no: complaintNo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET form lookups (customers, items, posted sales invoices with items & FG lots)
router.get('/form-lookups', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);

    const [custRes, itemRes, salesRes, salesItemsRes] = await Promise.all([
      runner
        .query(
          `SELECT id, name, print_name, gst_number, address1, address2, mobile1, phone_off, email, state, state_code
           FROM customer_master WHERE COALESCE(status, 'Active') = 'Active' ORDER BY name ASC`
        )
        .catch(() => ({ rows: [] })),
      runner
        .query(
          `SELECT id, item_code, item_name, print_name FROM item_master WHERE COALESCE(status, 'Active') = 'Active' ORDER BY item_name ASC`
        )
        .catch(() => ({ rows: [] })),
      runner
        .query(
          `SELECT id, s_no, inv_no, bill_no, date, customer_id, customer, customer_gstin, billing_address, address,
                  place_of_supply, party_state, sales_order_ref, p_o_no, po_no
           FROM sales
           WHERE COALESCE(is_order, 0) = 0
             AND COALESCE(LOWER(outpass_status), '') != 'cancelled'
           ORDER BY date DESC, id DESC LIMIT 200`
        )
        .catch(() => ({ rows: [] })),
      runner
        .query(`SELECT id, sales_id, item_id, item_name, lot_no, uom, weight, qty, total_wt FROM sales_items ORDER BY sales_id DESC, id ASC`)
        .catch(() => ({ rows: [] }))
    ]);

    const customers = custRes.rows || [];
    const items = itemRes.rows || [];
    const itemById = new Map(items.map((i) => [Number(i.id), i]));
    const itemByName = new Map(items.map((i) => [String(i.item_name || '').trim().toLowerCase(), i]));

    const itemsBySales = new Map();
    for (const si of (salesItemsRes.rows || [])) {
      if (!itemsBySales.has(si.sales_id)) itemsBySales.set(si.sales_id, []);
      const im = itemById.get(Number(si.item_id)) || itemByName.get(String(si.item_name || '').trim().toLowerCase());
      const dates = await lookupLotDates(runner, si.lot_no);
      itemsBySales.get(si.sales_id).push({
        original_sales_id: si.sales_id,
        original_sales_item_id: si.id,
        item_id: si.item_id || im?.id || null,
        item_name: si.item_name || '',
        product_code: im?.item_code || '',
        lot_no: si.lot_no || '',
        uom: si.uom || 'Bags',
        weight_per_unit: Number(si.weight || 50),
        invoice_qty: round2(si.qty || 0),
        mfg_date: dates.mfg_date,
        exp_date: dates.exp_date
      });
    }

    const custById = new Map(customers.map((c) => [Number(c.id), c]));
    const invoices = (salesRes.rows || []).map((s) => {
      const cRow =
        (s.customer_id && custById.get(Number(s.customer_id))) ||
        customers.find(
          (c) =>
            String(c.name || '').trim().toLowerCase() === String(s.customer || '').trim().toLowerCase() ||
            String(c.print_name || '').trim().toLowerCase() === String(s.customer || '').trim().toLowerCase()
        ) ||
        null;
      const invNo = s.inv_no || s.bill_no || (s.s_no ? `SAL-${String(s.s_no).padStart(5, '0')}` : `SAL-${s.id}`);
      const cName = cRow?.name || cRow?.print_name || (!/^\d+$/.test(String(s.customer || '').trim()) ? s.customer : '') || 'Customer';
      return {
        id: s.id,
        inv_no: invNo,
        date: sanitizeDate(s.date),
        customer_id: cRow?.id || s.customer_id || null,
        customer_name: cName,
        customer_gstin: s.customer_gstin || cRow?.gst_number || '',
        customer_phone: cRow?.mobile1 || cRow?.phone_off || '',
        customer_email: cRow?.email || '',
        customer_address: s.billing_address || s.address || [cRow?.address1, cRow?.address2].filter(Boolean).join(', ') || '',
        sales_order_no: s.sales_order_ref || s.p_o_no || s.po_no || '',
        items: itemsBySales.get(s.id) || []
      };
    });

    res.json({
      success: true,
      data: {
        customers,
        items,
        invoices,
        categories: COMPLAINT_CATEGORIES,
        severities: SEVERITY_LEVELS,
        statuses: INVESTIGATION_STATUSES
      }
    });
  } catch (err) {
    console.error('Error fetching complaint lookups:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET complaints list (also serves /candidates for Sales Return & CAPA linking)
router.get(['/', '/candidates'], async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const { status, severity, category, search, return_required } = req.query;

    const headersRes = await runner.query(
      `SELECT * FROM customer_complaints ORDER BY complaint_date DESC, id DESC`
    );
    const itemsRes = await runner
      .query(`SELECT * FROM customer_complaint_items ORDER BY complaint_id DESC, id ASC`)
      .catch(() => ({ rows: [] }));

    const srCountRes = await runner
      .query(
        `SELECT complaint_id, complaint_no, COUNT(*) as cnt, COALESCE(SUM(total_qty), 0) as ret_qty
         FROM sales_return
         WHERE COALESCE(UPPER(approval_status), 'PENDING') != 'CANCELLED'
           AND (complaint_id IS NOT NULL OR COALESCE(complaint_no, '') != '')
         GROUP BY complaint_id, complaint_no`
      )
      .catch(() => ({ rows: [] }));

    const capaCountRes = await runner
      .query(
        `SELECT complaint_id, COUNT(*) as cnt, MAX(capa_no) as latest_capa_no, MAX(capa_status) as latest_capa_status
         FROM capa_documents
         WHERE complaint_id IS NOT NULL
         GROUP BY complaint_id`
      )
      .catch(() => ({ rows: [] }));

    const itemsByCmp = new Map();
    for (const it of (itemsRes.rows || [])) {
      if (!itemsByCmp.has(it.complaint_id)) itemsByCmp.set(it.complaint_id, []);
      itemsByCmp.get(it.complaint_id).push(it);
    }

    const srByCmpId = new Map();
    const srByCmpNo = new Map();
    for (const r of (srCountRes.rows || [])) {
      if (r.complaint_id) srByCmpId.set(Number(r.complaint_id), { count: Number(r.cnt || 0), ret_qty: round2(r.ret_qty) });
      if (r.complaint_no) srByCmpNo.set(String(r.complaint_no).trim().toUpperCase(), { count: Number(r.cnt || 0), ret_qty: round2(r.ret_qty) });
    }

    const capaByCmpId = new Map();
    for (const c of (capaCountRes.rows || [])) {
      if (c.complaint_id) {
        capaByCmpId.set(Number(c.complaint_id), {
          count: Number(c.cnt || 0),
          latest_capa_no: c.latest_capa_no || '',
          latest_capa_status: c.latest_capa_status || ''
        });
      }
    }

    let rows = (headersRes.rows || []).map((c) => {
      const cmpItems = itemsByCmp.get(c.id) || [];
      const fallbackItem = cmpItems.length > 0
        ? cmpItems
        : (c.product_name || c.lot_no
          ? [{
              id: null,
              complaint_id: c.id,
              original_sales_id: c.original_sales_id || null,
              item_name: c.product_name || '',
              lot_no: c.lot_no || '',
              uom: 'Bags',
              invoice_qty: 0,
              complaint_qty: round2(c.complaint_qty || c.qty_affected || 0),
              complaint_weight: round2(c.complaint_weight || 0)
            }]
          : []);

      const totalCmpQty = round2(
        fallbackItem.reduce((s, it) => s + Number(it.complaint_qty || 0), 0) || c.complaint_qty || c.qty_affected || 0
      );
      const totalCmpWt = round2(
        fallbackItem.reduce((s, it) => s + Number(it.complaint_weight || 0), 0) || c.complaint_weight || 0
      );
      const itemNames = Array.from(new Set(fallbackItem.map((i) => i.item_name).filter(Boolean)));
      const lotNos = Array.from(new Set(fallbackItem.map((i) => i.lot_no).filter(Boolean)));
      const srStat = srByCmpId.get(c.id) || srByCmpNo.get(String(c.complaint_no || '').trim().toUpperCase()) || { count: 0, ret_qty: 0 };
      const capaStat = capaByCmpId.get(c.id) || { count: 0, latest_capa_no: '', latest_capa_status: '' };

      return {
        ...c,
        original_invoice_no: c.original_invoice_no || c.invoice_no || '',
        complaint_category: c.complaint_category || c.complaint_type || 'Quality',
        complaint_description: c.complaint_description || c.description || '',
        investigation_status: normalizeInvestigationStatus(c.investigation_status || c.status),
        severity: normalizeSeverity(c.severity),
        return_required: c.return_required ? 1 : 0,
        complaint_qty: totalCmpQty,
        complaint_weight: totalCmpWt,
        item_names: itemNames.join(', ') || c.product_name || '',
        lot_nos: lotNos.join(', ') || c.lot_no || '',
        items: fallbackItem,
        evidence: parseJsonSafe(c.evidence_json, []),
        linked_returns_count: srStat.count,
        total_returned_qty: srStat.ret_qty,
        linked_capas_count: capaStat.count,
        latest_capa_no: capaStat.latest_capa_no,
        latest_capa_status: capaStat.latest_capa_status
      };
    });

    if (status) {
      const s = normalizeInvestigationStatus(status);
      rows = rows.filter((r) => r.investigation_status === s);
    }
    if (severity) {
      const sv = normalizeSeverity(severity);
      rows = rows.filter((r) => r.severity === sv);
    }
    if (category) {
      const ct = normalizeCategory(category);
      rows = rows.filter((r) => r.complaint_category === ct);
    }
    if (return_required === '1' || return_required === 'true') {
      rows = rows.filter((r) => r.return_required === 1);
    }
    if (search) {
      const q = String(search).trim().toLowerCase();
      rows = rows.filter((r) =>
        `${r.complaint_no} ${r.customer_name} ${r.original_invoice_no} ${r.customer_complaint_ref || ''} ${r.item_names} ${r.lot_nos} ${r.complaint_description}`
          .toLowerCase()
          .includes(q)
      );
    }

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing complaints:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single complaint with full items, linked returns, CAPAs, and lot traceability
router.get('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID' });
    }

    const cmpRes = await runner.query(`SELECT * FROM customer_complaints WHERE id = ? LIMIT 1`, [id]);
    if (!cmpRes.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'Customer complaint not found' });
    }
    const c = cmpRes.rows[0];

    const itemsRes = await runner.query(
      `SELECT * FROM customer_complaint_items WHERE complaint_id = ? ORDER BY id ASC`,
      [id]
    );
    const items =
      itemsRes.rows && itemsRes.rows.length > 0
        ? itemsRes.rows
        : (c.product_name || c.lot_no
          ? [{
              id: null,
              complaint_id: c.id,
              original_sales_id: c.original_sales_id || null,
              item_name: c.product_name || '',
              lot_no: c.lot_no || '',
              uom: 'Bags',
              invoice_qty: 0,
              complaint_qty: round2(c.complaint_qty || c.qty_affected || 0),
              complaint_weight: round2(c.complaint_weight || 0)
            }]
          : []);

    const linkedReturnsRes = await runner
      .query(
        `SELECT id, s_no, return_no, date, original_invoice_no, total_qty, total_wt, grand_total,
                qc_status, stock_status, settlement_status, workflow_status, approval_status
         FROM sales_return
         WHERE (complaint_id = ? OR (COALESCE(complaint_no, '') != '' AND UPPER(TRIM(complaint_no)) = UPPER(TRIM(?))))
         ORDER BY date DESC, id DESC`,
        [id, c.complaint_no || '']
      )
      .catch(() => ({ rows: [] }));

    const linkedCapasRes = await runner
      .query(
        `SELECT id, capa_no, capa_date, capa_source, capa_status, effectiveness_status,
                identified_root_cause, corrective_person, corrective_target_date, closure_date
         FROM capa_documents
         WHERE complaint_id = ?
         ORDER BY id DESC`,
        [id]
      )
      .catch(() => ({ rows: [] }));

    const traceability = await resolveBatchAndRmTraceability(activeCompanyId, items, {
      originalSalesId: c.original_sales_id || null
    });

    res.json({
      success: true,
      data: {
        ...c,
        original_invoice_no: c.original_invoice_no || c.invoice_no || '',
        complaint_category: c.complaint_category || c.complaint_type || 'Quality',
        complaint_description: c.complaint_description || c.description || '',
        investigation_status: normalizeInvestigationStatus(c.investigation_status || c.status),
        severity: normalizeSeverity(c.severity),
        return_required: c.return_required ? 1 : 0,
        items,
        evidence: parseJsonSafe(c.evidence_json, []),
        linked_sales_returns: linkedReturnsRes.rows || [],
        linked_capas: linkedCapasRes.rows || [],
        traceability
      }
    });
  } catch (err) {
    console.error('Error loading complaint dossier:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Shared item normalizer
async function normalizeComplaintItems(runner, rawItems, fallbackHeader = {}) {
  const list = Array.isArray(rawItems) ? rawItems.filter((it) => String(it?.item_name || it?.product_name || '').trim()) : [];
  if (list.length === 0 && String(fallbackHeader.product_name || '').trim()) {
    list.push({
      item_name: fallbackHeader.product_name,
      lot_no: fallbackHeader.lot_no || '',
      complaint_qty: fallbackHeader.complaint_qty || fallbackHeader.qty_affected || 0,
      complaint_weight: fallbackHeader.complaint_weight || 0
    });
  }
  if (list.length === 0) {
    const err = new Error('At least one affected product / FG lot line is required.');
    err.statusCode = 400;
    throw err;
  }

  const out = [];
  for (const row of list) {
    const itemName = String(row.item_name || row.product_name || '').trim();
    const lotNo = String(row.lot_no || '').trim();
    const dates = lotNo ? await lookupLotDates(runner, lotNo) : { mfg_date: '', exp_date: '' };
    const unitWt = Number(row.weight_per_unit || row.weight || 50) || 50;
    const cQty = round2(row.complaint_qty ?? row.qty_affected ?? 0);
    const cWt = round2(row.complaint_weight || (cQty > 0 ? cQty * unitWt : 0));

    out.push({
      original_sales_id: row.original_sales_id || fallbackHeader.original_sales_id || null,
      original_sales_item_id: row.original_sales_item_id || null,
      item_id: row.item_id || null,
      item_name: itemName,
      product_code: String(row.product_code || row.item_code || '').trim(),
      lot_no: lotNo,
      mfg_date: sanitizeDate(row.mfg_date) || dates.mfg_date || '',
      exp_date: sanitizeDate(row.exp_date) || dates.exp_date || '',
      uom: String(row.uom || 'Bags').trim() || 'Bags',
      weight_per_unit: unitWt,
      invoice_qty: round2(row.invoice_qty || 0),
      complaint_qty: cQty,
      complaint_weight: cWt,
      issue_notes: String(row.issue_notes || '').trim()
    });
  }
  return out;
}

// POST create Customer Complaint
router.post('/', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const body = req.body || {};

    const custRec = await resolveCustomerRecord(runner, body.customer_id || body.customer_name);
    const customerName = String(body.customer_name || custRec?.name || custRec?.print_name || '').trim();
    if (!customerName) {
      return res.status(400).json({ success: false, message: 'Customer Name is required.' });
    }

    const cleanDate = sanitizeDate(body.complaint_date) || new Date().toISOString().slice(0, 10);
    const category = normalizeCategory(body.complaint_category || body.complaint_type);
    const severity = normalizeSeverity(body.severity);
    const invStatus = normalizeInvestigationStatus(body.investigation_status || body.status);
    const returnRequired = body.return_required === true || body.return_required === 1 || body.return_required === '1' || String(body.return_required).toLowerCase() === 'yes' ? 1 : 0;
    const description = String(body.complaint_description ?? body.description ?? '').trim();
    if (!description) {
      return res.status(400).json({ success: false, message: 'Complaint Description is required.' });
    }

    const items = await normalizeComplaintItems(runner, body.items, {
      product_name: body.product_name,
      lot_no: body.lot_no,
      complaint_qty: body.complaint_qty,
      qty_affected: body.qty_affected,
      complaint_weight: body.complaint_weight,
      original_sales_id: body.original_sales_id
    });

    const totalCmpQty = round2(items.reduce((s, i) => s + i.complaint_qty, 0));
    const totalCmpWt = round2(items.reduce((s, i) => s + i.complaint_weight, 0));
    const primaryItem = items[0];
    const evidence = sanitizeEvidenceList(body.evidence || body.evidence_json);
    const createdBy = req.user?.username || body.received_by || 'admin';

    const txOut = await db.forCompany(activeCompanyId).withTransaction(async () => {
      let complaintNo = String(body.complaint_no || '').trim();
      if (!complaintNo) {
        const seqRes = await runner.query(`SELECT MAX(id) as max_id, COUNT(*) as cnt FROM customer_complaints`);
        const nextNum = Math.max(parseInt(seqRes.rows?.[0]?.max_id, 10) || 0, parseInt(seqRes.rows?.[0]?.cnt, 10) || 0) + 1;
        complaintNo = `CMP-${String(nextNum).padStart(5, '0')}`;
      }

      const origInvNo = String(body.original_invoice_no || body.invoice_no || '').trim();
      const insRes = await db.run(
        `INSERT INTO customer_complaints (
          complaint_no, complaint_date, customer_id, customer_name, customer_gstin, customer_phone, customer_email, customer_address,
          original_sales_id, invoice_no, original_invoice_no, original_invoice_date, sales_order_no, customer_complaint_ref,
          product_name, lot_no, qty_affected, complaint_qty, complaint_weight,
          complaint_type, complaint_category, description, complaint_description,
          evidence_json, severity, return_required, status, investigation_status,
          customer_communication, received_by, assigned_to, company_id, created_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          complaintNo,
          cleanDate,
          custRec?.id || (body.customer_id ? Number(body.customer_id) : null),
          customerName,
          String(body.customer_gstin || custRec?.gst_number || '').trim(),
          String(body.customer_phone || custRec?.mobile1 || custRec?.phone_off || '').trim(),
          String(body.customer_email || custRec?.email || '').trim(),
          String(body.customer_address || [custRec?.address1, custRec?.address2].filter(Boolean).join(', ') || '').trim(),
          body.original_sales_id ? Number(body.original_sales_id) : null,
          origInvNo,
          origInvNo,
          sanitizeDate(body.original_invoice_date) || '',
          String(body.sales_order_no || '').trim(),
          String(body.customer_complaint_ref || '').trim(),
          items.map((i) => i.item_name).join(', '),
          items.map((i) => i.lot_no).filter(Boolean).join(', ') || primaryItem.lot_no || '',
          totalCmpQty,
          totalCmpQty,
          totalCmpWt,
          category,
          category,
          description,
          description,
          JSON.stringify(evidence),
          severity,
          returnRequired,
          invStatus,
          invStatus,
          String(body.customer_communication || '').trim(),
          String(body.received_by || createdBy).trim(),
          String(body.assigned_to || '').trim(),
          activeCompanyId,
          createdBy
        ],
        activeCompanyId
      );

      const complaintId = insRes.lastID || insRes.lastInsertRowid;
      for (const it of items) {
        await db.run(
          `INSERT INTO customer_complaint_items (
            complaint_id, original_sales_id, original_sales_item_id, item_id, item_name, product_code,
            lot_no, mfg_date, exp_date, uom, weight_per_unit, invoice_qty, complaint_qty, complaint_weight, issue_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            complaintId,
            it.original_sales_id,
            it.original_sales_item_id,
            it.item_id,
            it.item_name,
            it.product_code,
            it.lot_no,
            it.mfg_date,
            it.exp_date,
            it.uom,
            it.weight_per_unit,
            it.invoice_qty,
            it.complaint_qty,
            it.complaint_weight,
            it.issue_notes
          ],
          activeCompanyId
        );
      }

      return { id: complaintId, complaint_no: complaintNo };
    });

    res.status(201).json({
      success: true,
      id: txOut.id,
      complaint_no: txOut.complaint_no,
      message: `Customer Complaint ${txOut.complaint_no} registered successfully.`
    });
  } catch (err) {
    console.error('Error creating complaint:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// PUT update Customer Complaint
router.put('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID' });
    }

    const existingRes = await runner.query(`SELECT * FROM customer_complaints WHERE id = ? LIMIT 1`, [id]);
    if (!existingRes.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'Customer complaint not found' });
    }
    const existing = existingRes.rows[0];
    const body = req.body || {};

    const custRec = await resolveCustomerRecord(runner, body.customer_id || body.customer_name || existing.customer_name);
    const customerName = String(body.customer_name || custRec?.name || existing.customer_name || '').trim();
    const cleanDate = sanitizeDate(body.complaint_date) || existing.complaint_date;
    const category = normalizeCategory(body.complaint_category || body.complaint_type || existing.complaint_category);
    const severity = normalizeSeverity(body.severity || existing.severity);
    const invStatus = normalizeInvestigationStatus(body.investigation_status || body.status || existing.investigation_status);
    const returnRequired =
      body.return_required !== undefined
        ? (body.return_required === true || body.return_required === 1 || body.return_required === '1' || String(body.return_required).toLowerCase() === 'yes' ? 1 : 0)
        : (existing.return_required ? 1 : 0);
    const description = String(body.complaint_description ?? body.description ?? existing.complaint_description ?? '').trim();
    if (!description) {
      return res.status(400).json({ success: false, message: 'Complaint Description is required.' });
    }

    const items = await normalizeComplaintItems(runner, body.items, {
      product_name: body.product_name || existing.product_name,
      lot_no: body.lot_no || existing.lot_no,
      complaint_qty: body.complaint_qty ?? existing.complaint_qty,
      complaint_weight: body.complaint_weight ?? existing.complaint_weight,
      original_sales_id: body.original_sales_id ?? existing.original_sales_id
    });

    const totalCmpQty = round2(items.reduce((s, i) => s + i.complaint_qty, 0));
    const totalCmpWt = round2(items.reduce((s, i) => s + i.complaint_weight, 0));
    const evidence = sanitizeEvidenceList(body.evidence ?? body.evidence_json ?? existing.evidence_json);
    const origInvNo = String(body.original_invoice_no ?? body.invoice_no ?? existing.original_invoice_no ?? '').trim();

    await db.forCompany(activeCompanyId).withTransaction(async () => {
      await db.run(
        `UPDATE customer_complaints SET
          complaint_date = ?, customer_id = ?, customer_name = ?, customer_gstin = ?, customer_phone = ?, customer_email = ?, customer_address = ?,
          original_sales_id = ?, invoice_no = ?, original_invoice_no = ?, original_invoice_date = ?, sales_order_no = ?, customer_complaint_ref = ?,
          product_name = ?, lot_no = ?, qty_affected = ?, complaint_qty = ?, complaint_weight = ?,
          complaint_type = ?, complaint_category = ?, description = ?, complaint_description = ?,
          evidence_json = ?, severity = ?, return_required = ?, status = ?, investigation_status = ?,
          customer_communication = ?, received_by = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          cleanDate,
          custRec?.id || existing.customer_id || null,
          customerName,
          String(body.customer_gstin ?? existing.customer_gstin ?? '').trim(),
          String(body.customer_phone ?? existing.customer_phone ?? '').trim(),
          String(body.customer_email ?? existing.customer_email ?? '').trim(),
          String(body.customer_address ?? existing.customer_address ?? '').trim(),
          body.original_sales_id ? Number(body.original_sales_id) : existing.original_sales_id,
          origInvNo,
          origInvNo,
          sanitizeDate(body.original_invoice_date) || existing.original_invoice_date || '',
          String(body.sales_order_no ?? existing.sales_order_no ?? '').trim(),
          String(body.customer_complaint_ref ?? existing.customer_complaint_ref ?? '').trim(),
          items.map((i) => i.item_name).join(', '),
          items.map((i) => i.lot_no).filter(Boolean).join(', '),
          totalCmpQty,
          totalCmpQty,
          totalCmpWt,
          category,
          category,
          description,
          description,
          JSON.stringify(evidence),
          severity,
          returnRequired,
          invStatus,
          invStatus,
          String(body.customer_communication ?? existing.customer_communication ?? '').trim(),
          String(body.received_by ?? existing.received_by ?? '').trim(),
          String(body.assigned_to ?? existing.assigned_to ?? '').trim(),
          id
        ],
        activeCompanyId
      );

      await db.run(`DELETE FROM customer_complaint_items WHERE complaint_id = ?`, [id], activeCompanyId);
      for (const it of items) {
        await db.run(
          `INSERT INTO customer_complaint_items (
            complaint_id, original_sales_id, original_sales_item_id, item_id, item_name, product_code,
            lot_no, mfg_date, exp_date, uom, weight_per_unit, invoice_qty, complaint_qty, complaint_weight, issue_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            it.original_sales_id,
            it.original_sales_item_id,
            it.item_id,
            it.item_name,
            it.product_code,
            it.lot_no,
            it.mfg_date,
            it.exp_date,
            it.uom,
            it.weight_per_unit,
            it.invoice_qty,
            it.complaint_qty,
            it.complaint_weight,
            it.issue_notes
          ],
          activeCompanyId
        );
      }
    });

    res.json({ success: true, id, message: `Complaint ${existing.complaint_no} updated cleanly.` });
  } catch (err) {
    console.error('Error updating complaint:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// PATCH status
router.patch('/:id/status', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const id = parseInt(req.params.id, 10);
    const invStatus = normalizeInvestigationStatus(req.body?.investigation_status || req.body?.status);
    await db.run(
      `UPDATE customer_complaints SET investigation_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [invStatus, invStatus, id],
      activeCompanyId
    );
    res.json({ success: true, investigation_status: invStatus, message: `Complaint marked as ${invStatus}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE complaint (RBAC-gated)
router.delete('/:id', async (req, res) => {
  try {
    const auth = await hasComplaintAuthority(req);
    if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });

    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID' });
    }

    const srLink = await runner
      .query(`SELECT id FROM sales_return WHERE complaint_id = ? LIMIT 1`, [id])
      .catch(() => ({ rows: [] }));
    if (srLink.rows?.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete complaint while linked Sales Return records exist.'
      });
    }

    const capaLink = await runner
      .query(`SELECT id FROM capa_documents WHERE complaint_id = ? LIMIT 1`, [id])
      .catch(() => ({ rows: [] }));
    if (capaLink.rows?.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete complaint while linked CAPA documents exist.'
      });
    }

    await db.forCompany(activeCompanyId).withTransaction(async () => {
      await db.run(`DELETE FROM customer_complaint_items WHERE complaint_id = ?`, [id], activeCompanyId);
      await db.run(`DELETE FROM customer_complaints WHERE id = ?`, [id], activeCompanyId);
    });

    res.json({ success: true, message: 'Customer complaint deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
