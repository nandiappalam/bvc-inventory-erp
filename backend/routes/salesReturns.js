const express = require('express');
const router = express.Router();
const db = require('../config/database');
const AccountingEngine = require('../services/AccountingEngine');
const {
  createSalesReturnVoucherChain,
  createSalesReturnRefundVoucher,
  deleteSalesReturnVoucherChain
} = require('../utils/ledgerHelper');
const { syncDocumentMovements, deleteDocumentMovements } = require('../services/SourceMovementSync');
const { ensureSalesSchema } = require('../services/SalesService');

const getCompanyId = (req) => {
  const raw =
    req.companyId ||
    (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : (req.user?.company_id || 1));
  return parseInt(raw, 10) || 1;
};

const _srSchemaEnsured = new Set();

const RETURN_REASONS = [
  'Quality Issue',
  'Damaged Goods',
  'Expired Product',
  'Near Expiry',
  'Wrong Product Delivered',
  'Wrong Quantity',
  'Shortage / Excess Dispute',
  'Packaging Defect',
  'Moisture Problem',
  'Contamination',
  'Customer Order Cancellation',
  'Incorrect Specification',
  'Transit Delay',
  'Commercial / Billing Dispute',
  'Other'
];

const GOODS_CONDITIONS = [
  'Good / Resalable',
  'Damaged',
  'Quality Hold',
  'Reprocessing Required',
  'Wastage / Rejected',
  'Under Investigation'
];

const STOCK_DISPOSITIONS = [
  'Hold',
  'Resalable',
  'Reprocess',
  'Wastage'
];

const SETTLEMENT_TYPES = [
  'Credit Note',
  'Refund',
  'Replacement',
  'No Financial Adjustment'
];

function sanitizeDate(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || s === 'null' || s === 'undefined') return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})\s*[-\/]\s*(\d{1,2})\s*[-\/]\s*(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return s;
}

function round2(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function normalizeStockDisposition(condOrDisp) {
  const s = String(condOrDisp || '').trim().toLowerCase();
  if (!s) return 'Hold';
  if (s === 'resalable' || s === 'good / resalable' || s === 'good') return 'Resalable';
  if (s === 'reprocess' || s === 'reprocessing required' || s === 'reprocessing') return 'Reprocess';
  if (s === 'wastage' || s === 'wastage / rejected' || s === 'rejected' || s === 'damaged') return 'Wastage';
  return 'Hold';
}

function defaultConditionForDisposition(disp) {
  const d = normalizeStockDisposition(disp);
  if (d === 'Resalable') return 'Good / Resalable';
  if (d === 'Reprocess') return 'Reprocessing Required';
  if (d === 'Wastage') return 'Wastage / Rejected';
  return 'Quality Hold';
}

async function ensureReturnColumns(companyId) {
  const cId = parseInt(companyId, 10) || 1;
  const runner = db.forCompany(cId);

  await ensureSalesSchema(cId);

  if (_srSchemaEnsured.has(cId)) {
    try {
      await runner.query(`SELECT return_no, complaint_no, approval_status FROM sales_return LIMIT 1`);
      return;
    } catch (_) {
      _srSchemaEnsured.delete(cId);
    }
  }

  const headerCols = [
    'return_no TEXT',
    'original_sales_id INTEGER',
    'original_invoice_no TEXT',
    'original_invoice_date TEXT',
    'customer_id INTEGER',
    'customer_gstin TEXT',
    'customer_address TEXT',
    'customer_state TEXT',
    'customer_state_code TEXT',
    'sales_order_no TEXT',
    'delivery_challan_no TEXT',
    'outpass_no TEXT',
    'pay_type TEXT',
    'tax_type TEXT',
    'tax_percent REAL DEFAULT 0',
    'bill_amt REAL DEFAULT 0',
    'tax_amt REAL DEFAULT 0',
    'deduction TEXT',
    'deduction_remarks TEXT',
    'deduction_amount REAL DEFAULT 0',
    'deductions_json TEXT',
    'grand_total REAL DEFAULT 0',
    'loadman_name TEXT',
    'loadman_worker_id INTEGER',
    'loadman_rate_per_kg REAL DEFAULT 0.50',
    'loadman_charges REAL DEFAULT 0',
    'return_reason_category TEXT',
    'return_reason_detail TEXT',
    'complaint_id INTEGER',
    'complaint_no TEXT',
    'complaint_qty REAL DEFAULT 0',
    'quality_issue_desc TEXT',
    'inspection_required INTEGER DEFAULT 1',
    'inspection_date TEXT',
    'inspected_by TEXT',
    "qc_status TEXT DEFAULT 'Pending'",
    'qc_remarks TEXT',
    "goods_condition TEXT DEFAULT 'Under Investigation'",
    "stock_disposition TEXT DEFAULT 'Hold'",
    "stock_status TEXT DEFAULT 'Hold'",
    'destination_godown_id INTEGER',
    'destination_godown_name TEXT',
    "settlement_type TEXT DEFAULT 'Credit Note'",
    "settlement_status TEXT DEFAULT 'Pending'",
    'original_invoice_amount REAL DEFAULT 0',
    'returned_item_amount REAL DEFAULT 0',
    'credit_note_no TEXT',
    'credit_note_date TEXT',
    'refund_amount REAL DEFAULT 0',
    'refund_mode TEXT',
    'refund_bank_name TEXT',
    'refund_ref_no TEXT',
    'refund_voucher_no TEXT',
    'replacement_amount REAL DEFAULT 0',
    'replacement_ref_no TEXT',
    'customer_outstanding_adj REAL DEFAULT 0',
    'no_adjustment_reason TEXT',
    'voucher_no TEXT',
    'return_vehicle_no TEXT',
    'transporter_name TEXT',
    'driver_name TEXT',
    'return_freight REAL DEFAULT 0',
    "freight_paid_by TEXT DEFAULT 'Company'",
    'return_pass_ref TEXT',
    'customer_return_challan TEXT',
    'supporting_docs TEXT',
    'supporting_docs_json TEXT',
    "workflow_status TEXT DEFAULT 'QC Pending'",
    "approval_status TEXT DEFAULT 'PENDING'",
    'approved_by TEXT',
    'approved_at TEXT',
    'approval_remarks TEXT',
    'created_by TEXT',
    'updated_at DATETIME'
  ];

  for (const col of headerCols) {
    try {
      await runner.run(`ALTER TABLE sales_return ADD COLUMN ${col}`);
    } catch (_) {}
  }

  const itemCols = [
    'original_sales_id INTEGER',
    'original_sales_item_id INTEGER',
    'item_id INTEGER',
    "uom TEXT DEFAULT 'Bags'",
    'original_sold_qty REAL DEFAULT 0',
    'previously_returned_qty REAL DEFAULT 0',
    'available_return_qty REAL DEFAULT 0',
    'return_weight REAL DEFAULT 0',
    'destination_godown_id INTEGER',
    'destination_godown_name TEXT',
    'mfg_date TEXT',
    'exp_date TEXT',
    'goods_condition TEXT',
    'stock_disposition TEXT',
    'qc_item_result TEXT',
    'item_reason TEXT',
    'complaint_item_id INTEGER',
    'complaint_qty REAL DEFAULT 0',
    'taxable_amount REAL DEFAULT 0',
    'tax_amount REAL DEFAULT 0'
  ];

  for (const col of itemCols) {
    try {
      await runner.run(`ALTER TABLE sales_return_items ADD COLUMN ${col}`);
    } catch (_) {}
  }

  _srSchemaEnsured.add(cId);
}

router.use(async (req, _res, next) => {
  try {
    await ensureReturnColumns(getCompanyId(req));
  } catch (err) {
    console.warn('[SalesReturnRoute] schema ensure warning:', err.message);
  }
  next();
});

async function hasSalesReturnAuthority(req, mode = 'approve') {
  if (!req.user || !req.user.id) return { ok: false, status: 401, message: 'Authentication required' };
  const role = String(req.user.role || '').trim().toLowerCase();
  const allowedRoles = mode === 'cancel'
    ? ['admin', 'super_admin', 'superadmin', 'manager', 'owner']
    : ['admin', 'super_admin', 'superadmin', 'manager', 'supervisor', 'owner'];
  if (allowedRoles.includes(role)) {
    return { ok: true };
  }
  if (db.master && typeof db.master.query === 'function') {
    const col = mode === 'cancel' ? 'can_delete' : 'can_edit';
    const permRes = await db.master.query(
      `SELECT ${col} as allowed FROM user_permissions
       WHERE user_id = ?
         AND LOWER(TRIM(COALESCE(module_name, ''))) IN ('sales return', 'sales_return', 'sales', 'all')
         AND COALESCE(${col}, 0) = 1
       LIMIT 1`,
      [req.user.id]
    ).catch(() => ({ rows: [] }));
    if (permRes.rows && permRes.rows.length > 0) {
      return { ok: true };
    }
  }
  return {
    ok: false,
    status: 403,
    message: mode === 'cancel'
      ? 'Only Admin or authorized Managers can cancel or delete a sales return.'
      : 'Insufficient authority. Only Admin, Manager, or Supervisor can approve sales returns and release stock/credit notes.'
  };
}

async function requireApprovalAuthority(req, res, next) {
  const check = await hasSalesReturnAuthority(req, 'approve');
  if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });
  next();
}

async function requireCancelAuthority(req, res, next) {
  const check = await hasSalesReturnAuthority(req, 'cancel');
  if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });
  next();
}

async function resolveCustomerRecord(runner, customerKey) {
  if (!customerKey && customerKey !== 0) return null;
  const k = String(customerKey).trim();
  if (!k) return null;
  const res = await runner.query(
    `SELECT * FROM customer_master
     WHERE CAST(id AS TEXT) = ?
        OR LOWER(TRIM(COALESCE(name, ''))) = LOWER(?)
        OR LOWER(TRIM(COALESCE(print_name, ''))) = LOWER(?)
     LIMIT 1`,
    [k, k, k]
  ).catch(() => ({ rows: [] }));
  return res.rows?.[0] || null;
}

async function resolveGodownRecord(runner, godownId, godownName) {
  if (godownId) {
    const res = await runner.query(`SELECT id, godown_name FROM godown_master WHERE id = ? LIMIT 1`, [godownId]).catch(() => ({ rows: [] }));
    if (res.rows?.[0]) return res.rows[0];
  }
  if (godownName) {
    const res = await runner.query(
      `SELECT id, godown_name FROM godown_master WHERE LOWER(TRIM(godown_name)) = LOWER(TRIM(?)) LIMIT 1`,
      [String(godownName)]
    ).catch(() => ({ rows: [] }));
    if (res.rows?.[0]) return res.rows[0];
  }
  const fg = await runner.query(
    `SELECT id, godown_name FROM godown_master WHERE LOWER(godown_name) LIKE '%finish%' OR LOWER(godown_name) LIKE '%fg%' OR LOWER(COALESCE(godown_type,'')) = 'normal' ORDER BY id ASC LIMIT 1`
  ).catch(() => ({ rows: [] }));
  return fg.rows?.[0] || { id: null, godown_name: godownName || 'Main Godown' };
}

async function calculatePreviouslyReturnedForItem(runner, {
  originalSalesId,
  originalSalesItemId,
  itemName,
  lotNo,
  excludeReturnId = null
}) {
  if (!originalSalesId) return 0;
  let sql = `
    SELECT COALESCE(SUM(sri.qty), 0) as total_returned
    FROM sales_return_items sri
    JOIN sales_return sr ON sr.id = sri.sales_return_id
    WHERE COALESCE(UPPER(sr.approval_status), 'PENDING') NOT IN ('CANCELLED', 'REJECTED')
      AND COALESCE(sri.original_sales_id, sr.original_sales_id) = ?
  `;
  const params = [Number(originalSalesId)];

  if (originalSalesItemId) {
    sql += ` AND (sri.original_sales_item_id = ? OR (sri.original_sales_item_id IS NULL AND LOWER(TRIM(COALESCE(sri.item_name,''))) = LOWER(TRIM(?)) AND UPPER(TRIM(COALESCE(sri.lot_no,''))) = UPPER(TRIM(?))))`;
    params.push(Number(originalSalesItemId), String(itemName || ''), String(lotNo || ''));
  } else {
    sql += ` AND LOWER(TRIM(COALESCE(sri.item_name,''))) = LOWER(TRIM(?)) AND UPPER(TRIM(COALESCE(sri.lot_no,''))) = UPPER(TRIM(?))`;
    params.push(String(itemName || ''), String(lotNo || ''));
  }

  if (excludeReturnId) {
    sql += ` AND sr.id != ?`;
    params.push(Number(excludeReturnId));
  }

  const res = await runner.query(sql, params).catch(() => ({ rows: [{ total_returned: 0 }] }));
  return round2(res.rows?.[0]?.total_returned || 0);
}

async function lookupLotDates(runner, lotNo) {
  if (!lotNo) return { mfg_date: '', exp_date: '' };
  const cleanLot = String(lotNo).trim();
  if (!cleanLot) return { mfg_date: '', exp_date: '' };

  const packRes = await runner.query(
    `SELECT p.date as mfg_date FROM packing_items pi JOIN packing p ON p.id = pi.packing_id WHERE UPPER(TRIM(COALESCE(pi.lot_no,''))) = UPPER(?) ORDER BY p.date DESC LIMIT 1`,
    [cleanLot]
  ).catch(() => ({ rows: [] }));
  if (packRes.rows?.[0]?.mfg_date) {
    return { mfg_date: String(packRes.rows[0].mfg_date).slice(0, 10), exp_date: '' };
  }

  const grainRes = await runner.query(
    `SELECT g.date as mfg_date FROM grain_output_items goi JOIN grains g ON g.id = goi.grain_id WHERE UPPER(TRIM(COALESCE(goi.lot_no,''))) = UPPER(?) ORDER BY g.date DESC LIMIT 1`,
    [cleanLot]
  ).catch(() => ({ rows: [] }));
  if (grainRes.rows?.[0]?.mfg_date) {
    return { mfg_date: String(grainRes.rows[0].mfg_date).slice(0, 10), exp_date: '' };
  }

  const lotRes = await runner.query(
    `SELECT created_at FROM stock_lots WHERE UPPER(TRIM(COALESCE(lot_no,''))) = UPPER(?) ORDER BY id DESC LIMIT 1`,
    [cleanLot]
  ).catch(() => ({ rows: [] }));
  if (lotRes.rows?.[0]?.created_at) {
    return { mfg_date: String(lotRes.rows[0].created_at).slice(0, 10), exp_date: '' };
  }

  return { mfg_date: '', exp_date: '' };
}

async function reverseApprovedStockImpact(runner, activeCompanyId, salesReturnId, reason, username) {
  const existingStockRes = await runner.query(
    `SELECT item_name, lot_no, qty, godown, godown_id FROM stock WHERE reference_id = ? AND type = 'Sale Return'`,
    [salesReturnId]
  ).catch(() => ({ rows: [] }));

  for (const stk of (existingStockRes.rows || [])) {
    const q = Number(stk.qty || 0);
    if (stk.item_name && q > 0) {
      await runner.run(
        `UPDATE stock_lots
         SET remaining_quantity = CASE WHEN COALESCE(remaining_quantity, 0) - ? > 0 THEN COALESCE(remaining_quantity, 0) - ? ELSE 0 END
         WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
           AND UPPER(TRIM(COALESCE(lot_no, ''))) = UPPER(TRIM(?))`,
        [q, q, stk.item_name, stk.lot_no || '']
      ).catch(() => {});
    }
  }

  await runner.run(`DELETE FROM stock WHERE reference_id = ? AND type = 'Sale Return'`, [salesReturnId]).catch(() => {});
  try {
    await deleteDocumentMovements(activeCompanyId, 'SALES_RETURN', salesReturnId, reason, username);
  } catch (e) {
    console.warn('[SalesReturn] Notice reversing stock movements:', e.message);
  }
}

async function applyResalableStockImpact(runner, activeCompanyId, header, items, username) {
  const cleanDate = sanitizeDate(header.date) || new Date().toISOString().slice(0, 10);
  for (const item of items) {
    const disp = normalizeStockDisposition(item.stock_disposition || header.stock_disposition || header.stock_status);
    if (disp !== 'Resalable') continue;

    const itName = String(item.item_name || '').trim();
    const lotNo = String(item.lot_no || '').trim();
    const qtyVal = Number(item.qty || 0);
    const rateVal = Number(item.rate || 0);
    const unitWt = Number(item.weight || 0) || 50;
    const totalWt = Number(item.return_weight || item.total_wt || 0) || (qtyVal * unitWt);
    if (!itName || qtyVal <= 0) continue;

    const destGodown = await resolveGodownRecord(
      runner,
      item.destination_godown_id || header.destination_godown_id,
      item.destination_godown_name || header.destination_godown_name
    );

    const lotCheck = await runner.query(
      `SELECT id FROM stock_lots
       WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))
         AND UPPER(TRIM(COALESCE(lot_no, ''))) = UPPER(TRIM(?))
       LIMIT 1`,
      [itName, lotNo]
    ).catch(() => ({ rows: [] }));

    if (lotCheck.rows && lotCheck.rows.length > 0) {
      await runner.run(
        `UPDATE stock_lots
         SET remaining_quantity = COALESCE(remaining_quantity, 0) + ?,
             godown_id = COALESCE(godown_id, ?),
             godown_name = COALESCE(NULLIF(godown_name, ''), ?)
         WHERE id = ?`,
        [qtyVal, destGodown.id, destGodown.godown_name, lotCheck.rows[0].id]
      );
    } else {
      await runner.run(
        `INSERT INTO stock_lots (item_name, lot_no, quantity, remaining_quantity, rate, qc_status, approval_status, godown_id, godown_name)
         VALUES (?, ?, ?, ?, ?, 'ACCEPTED', 'APPROVED', ?, ?)`,
        [itName, lotNo, qtyVal, qtyVal, rateVal, destGodown.id, destGodown.godown_name]
      );
    }

    await runner.run(
      `INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id, status, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Sale Return', ?, ?, ?, 'Active', ?)`,
      [
        cleanDate,
        item.item_id || null,
        itName,
        lotNo,
        qtyVal,
        totalWt,
        rateVal,
        Number(item.total_amt || 0),
        header.id,
        destGodown.godown_name,
        destGodown.id,
        `Approved Sales Return #${header.return_no || header.s_no || header.id}`
      ]
    );
  }

  try {
    await syncDocumentMovements(activeCompanyId, 'SALES_RETURN', header.id, username || 'admin');
  } catch (e) {
    console.warn('[SalesReturn] Notice syncing stock movements:', e.message);
  }
}

async function logReturnAudit(runner, activeCompanyId, {
  salesReturnId,
  returnNo,
  action,
  oldValue,
  newValue,
  performedBy,
  reason
}) {
  await runner.run(
    `INSERT INTO stock_audit_logs (company_id, entity_type, entity_id, entity_ref, action, old_value, new_value, performed_by, reason)
     VALUES (?, 'SALES_RETURN', ?, ?, ?, ?, ?, ?, ?)`,
    [
      activeCompanyId,
      salesReturnId,
      returnNo || `SR-${salesReturnId}`,
      action,
      oldValue ? String(oldValue) : null,
      newValue ? String(newValue) : null,
      performedBy || 'admin',
      reason || ''
    ]
  ).catch(() => {});
}

// GET lookups for Sales Return form
router.get('/form-lookups', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);

    const [custRes, gdwRes, itemRes, wtRes, taxRes, transRes, workerRes, dedRes, bankRes, cmpRes, cmpItemsRes] = await Promise.all([
      runner.query(`SELECT id, name, print_name, gst_number, address1, address2, state, state_code, mobile1, phone_off FROM customer_master WHERE COALESCE(status, 'Active') = 'Active' ORDER BY name ASC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, godown_name, godown_type, storage_location FROM godown_master WHERE COALESCE(status, 'Active') = 'Active' ORDER BY godown_name ASC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, item_code, item_name, print_name, hsn_code, tax FROM item_master WHERE COALESCE(status, 'Active') = 'Active' ORDER BY item_name ASC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, weight FROM weightmaster ORDER BY weight ASC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, tax_name, rate FROM tax_master ORDER BY rate ASC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, name, print_name FROM transport_master WHERE COALESCE(status, 'Active') = 'Active' ORDER BY name ASC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, name, per_kg_amount, from_date, till_date FROM operational_parties ORDER BY name ASC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, ded_name, ded_type, ded_value FROM deduction_sales ORDER BY ded_name ASC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, ledger_name, ledger_type, under FROM ledgermaster WHERE under IN ('Bank Accounts', 'Cash-in-hand') OR LOWER(COALESCE(ledger_type,'')) IN ('bank', 'cash') ORDER BY ledger_name ASC`).catch(() => ({ rows: [] })),
      runner.query(`SELECT id, complaint_no, complaint_date, customer_id, customer_name, original_sales_id, COALESCE(NULLIF(original_invoice_no,''), invoice_no, '') as original_invoice_no, customer_complaint_ref, COALESCE(NULLIF(complaint_category,''), complaint_type, 'Quality') as complaint_category, COALESCE(NULLIF(complaint_description,''), description, '') as complaint_description, severity, return_required, COALESCE(NULLIF(investigation_status,''), status, 'Open') as investigation_status, complaint_qty, complaint_weight, product_name, lot_no FROM customer_complaints ORDER BY id DESC LIMIT 150`).catch(() => ({ rows: [] })),
      runner.query(`SELECT * FROM customer_complaint_items ORDER BY complaint_id DESC, id ASC`).catch(() => ({ rows: [] }))
    ]);

    const cmpItemsById = new Map();
    for (const ci of (cmpItemsRes.rows || [])) {
      if (!cmpItemsById.has(ci.complaint_id)) cmpItemsById.set(ci.complaint_id, []);
      cmpItemsById.get(ci.complaint_id).push(ci);
    }
    const complaints = (cmpRes.rows || []).map((c) => ({
      ...c,
      items: cmpItemsById.get(c.id) || (c.product_name || c.lot_no ? [{
        id: null,
        complaint_id: c.id,
        original_sales_id: c.original_sales_id || null,
        item_name: c.product_name || '',
        lot_no: c.lot_no || '',
        uom: 'Bags',
        complaint_qty: round2(c.complaint_qty || 0),
        complaint_weight: round2(c.complaint_weight || 0)
      }] : [])
    }));

    res.json({
      success: true,
      data: {
        customers: custRes.rows || [],
        godowns: gdwRes.rows || [],
        items: itemRes.rows || [],
        weights: wtRes.rows || [],
        taxes: taxRes.rows || [],
        transporters: transRes.rows || [],
        workers: workerRes.rows || [],
        deductions: dedRes.rows || [],
        banks: bankRes.rows || [],
        complaints,
        returnReasons: RETURN_REASONS,
        goodsConditions: GOODS_CONDITIONS,
        stockDispositions: STOCK_DISPOSITIONS,
        settlementTypes: SETTLEMENT_TYPES
      }
    });
  } catch (err) {
    console.error('Error fetching sales return lookups:', err);
    res.status(500).json({ success: false, message: 'Failed to load lookups', error: err.message });
  }
});

// GET next sequential S.No, Return No & Credit Note No
router.get(['/next-sno', '/next-no'], async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const result = await runner.query(`
      SELECT
        MAX(CAST(s_no AS INTEGER)) as max_sno,
        MAX(id) as max_id,
        COUNT(*) as total_count
      FROM sales_return
    `);
    const maxVal = Math.max(
      parseInt(result.rows[0]?.max_sno, 10) || 0,
      parseInt(result.rows[0]?.max_id, 10) || 0,
      parseInt(result.rows[0]?.total_count, 10) || 0
    );
    const nextSNo = maxVal + 1;
    const returnNo = `SR-${String(nextSNo).padStart(5, '0')}`;

    const cnRes = await runner.query(
      `SELECT COUNT(*) as cn_cnt FROM voucher WHERE voucher_type = 'Credit Note' OR voucher_no LIKE 'CN-%'`
    ).catch(() => ({ rows: [{ cn_cnt: 0 }] }));
    const nextCnNum = Math.max(nextSNo, (parseInt(cnRes.rows?.[0]?.cn_cnt, 10) || 0) + 1);
    const creditNoteNo = `CN-${String(nextCnNum).padStart(5, '0')}`;

    res.json({
      success: true,
      next_s_no: String(nextSNo),
      next_sno: nextSNo,
      s_no: nextSNo,
      return_no: returnNo,
      credit_note_no: creditNoteNo,
      data: { s_no: nextSNo, return_no: returnNo, credit_note_no: creditNoteNo }
    });
  } catch (error) {
    console.error('Error fetching next sales return S.No:', error);
    res.status(500).json({ success: false, message: 'Error fetching next S.No', error: error.message });
  }
});

// GET posted Sales Invoices eligible for return with auto-fill metadata & remaining available qty per item
router.get(['/invoice-candidates', '/sales-invoices'], async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const excludeReturnId = req.query.exclude_return_id ? parseInt(req.query.exclude_return_id, 10) : null;
    const search = String(req.query.search || '').trim().toLowerCase();
    const customerFilter = String(req.query.customer || '').trim().toLowerCase();

    const salesRes = await runner.query(`
      SELECT s.*,
             o.outpass_no as linked_outpass_no,
             o.reference_no as linked_dc_no
      FROM sales s
      LEFT JOIN outpasses o ON o.id = s.outpass_id
      WHERE COALESCE(s.is_order, 0) = 0
        AND COALESCE(LOWER(s.outpass_status), '') != 'cancelled'
        AND COALESCE(LOWER(s.dispatch_status), '') != 'cancelled'
      ORDER BY s.date DESC, s.id DESC
    `);

    const customersRes = await runner.query(`SELECT id, name, print_name, gst_number, address1, address2, state, state_code, mobile1, phone_off FROM customer_master`).catch(() => ({ rows: [] }));
    const custList = customersRes.rows || [];
    const findCustomer = (s) => {
      if (s.customer_id) {
        const byId = custList.find((c) => Number(c.id) === Number(s.customer_id));
        if (byId) return byId;
      }
      const key = String(s.customer || '').trim().toLowerCase();
      if (!key) return null;
      return custList.find(
        (c) =>
          String(c.id) === key ||
          String(c.name || '').trim().toLowerCase() === key ||
          String(c.print_name || '').trim().toLowerCase() === key
      ) || null;
    };

    const itemsRes = await runner.query(`SELECT * FROM sales_items ORDER BY sales_id DESC, id ASC`);
    const itemsBySale = new Map();
    for (const si of (itemsRes.rows || [])) {
      if (!itemsBySale.has(si.sales_id)) itemsBySale.set(si.sales_id, []);
      itemsBySale.get(si.sales_id).push(si);
    }

    const candidates = [];
    for (const sale of (salesRes.rows || [])) {
      const custRow = findCustomer(sale);
      const customerName = custRow?.name || custRow?.print_name || (!/^\d+$/.test(String(sale.customer || '').trim()) ? sale.customer : '') || 'Customer';
      const invNo = sale.inv_no || sale.bill_no || (sale.s_no ? `SAL-${String(sale.s_no).padStart(5, '0')}` : `SAL-${sale.id}`);

      if (customerFilter && !customerName.toLowerCase().includes(customerFilter) && String(sale.customer_id || '') !== customerFilter) {
        continue;
      }
      if (search) {
        const hay = `${invNo} ${sale.s_no || ''} ${customerName} ${sale.sales_order_ref || ''} ${sale.outpass_no || ''} ${sale.delivery_challan_no || ''}`.toLowerCase();
        if (!hay.includes(search)) continue;
      }

      const rawItems = itemsBySale.get(sale.id) || [];
      const enrichedItems = [];
      let totalEligibleQty = 0;

      for (const si of rawItems) {
        const soldQty = round2(si.qty || 0);
        const prevRet = await calculatePreviouslyReturnedForItem(runner, {
          originalSalesId: sale.id,
          originalSalesItemId: si.id,
          itemName: si.item_name,
          lotNo: si.lot_no,
          excludeReturnId
        });
        const availQty = Math.max(0, round2(soldQty - prevRet));
        totalEligibleQty += availQty;
        const dates = await lookupLotDates(runner, si.lot_no);

        enrichedItems.push({
          original_sales_id: sale.id,
          original_sales_item_id: si.id,
          item_id: si.item_id || null,
          item_name: si.item_name || '',
          hsn_code: si.hsn_code || '',
          lot_no: si.lot_no || '',
          uom: si.uom || 'Bags',
          weight: Number(si.weight || 50),
          original_sold_qty: soldQty,
          previously_returned_qty: prevRet,
          available_return_qty: availQty,
          qty: availQty,
          rate: Number(si.rate || 0),
          rate_type: si.rate_type || 'Per Kg',
          disc_perc: Number(si.disc_perc ?? si.disc ?? 0),
          tax_perc: Number(si.tax_perc ?? si.tax_rate ?? si.gst_rate ?? 0),
          tax_type: si.tax_type || sale.tax_type || 'Exclusive',
          destination_godown_id: si.godown_id || sale.godown_from_id || null,
          destination_godown_name: si.godown_name || sale.godown_from_name || '',
          mfg_date: dates.mfg_date,
          exp_date: dates.exp_date,
          original_line_amount: Number(si.total_amt || si.amount || 0)
        });
      }

      const custAddress = sale.billing_address || sale.address || [custRow?.address1, custRow?.address2].filter(Boolean).join(', ') || '';
      const custState = sale.place_of_supply || sale.party_state || custRow?.state || '';
      const custGstin = sale.customer_gstin || custRow?.gst_number || '';

      candidates.push({
        id: sale.id,
        sales_id: sale.id,
        s_no: sale.s_no,
        inv_no: invNo,
        date: sale.date ? String(sale.date).slice(0, 10) : '',
        customer_id: custRow?.id || sale.customer_id || null,
        customer_name: customerName,
        customer_gstin: custGstin,
        customer_address: custAddress,
        customer_state: custState,
        customer_state_code: sale.party_state_code || custRow?.state_code || '',
        sales_order_no: sale.sales_order_ref || sale.p_o_no || sale.po_no || '',
        outpass_no: sale.outpass_no || sale.linked_outpass_no || '',
        delivery_challan_no: sale.delivery_challan_no || sale.linked_dc_no || sale.outpass_no || '',
        tax_type: sale.tax_type || 'Exclusive',
        pay_type: sale.pay_type || 'Credit',
        godown_id: sale.godown_from_id || null,
        godown_name: sale.godown_from_name || '',
        original_invoice_amount: round2(sale.grand_total || sale.total_amt || 0),
        total_qty: round2(sale.total_qty || 0),
        total_eligible_qty: round2(totalEligibleQty),
        items: enrichedItems
      });
    }

    res.json({ success: true, data: candidates });
  } catch (err) {
    console.error('Error fetching sales invoice candidates:', err);
    res.status(500).json({ success: false, message: 'Failed to load sales invoices', error: err.message });
  }
});

// GET all sales returns (enriched for 16-column register)
router.get(['/', '/list'], async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);

    const headersRes = await runner.query(`
      SELECT sr.*
      FROM sales_return sr
      ORDER BY sr.date DESC, sr.id DESC
    `);

    const itemsRes = await runner.query(`
      SELECT * FROM sales_return_items ORDER BY sales_return_id DESC, id ASC
    `);
    const itemsByReturn = new Map();
    for (const it of (itemsRes.rows || [])) {
      if (!itemsByReturn.has(it.sales_return_id)) itemsByReturn.set(it.sales_return_id, []);
      itemsByReturn.get(it.sales_return_id).push(it);
    }

    const enriched = (headersRes.rows || []).map((sr) => {
      const items = itemsByReturn.get(sr.id) || [];
      const itemNames = Array.from(new Set(items.map((i) => i.item_name).filter(Boolean)));
      const lots = Array.from(new Set(items.map((i) => i.lot_no).filter(Boolean)));
      const totalQty = items.reduce((s, i) => s + (Number(i.qty) || 0), 0) || Number(sr.total_qty || 0);
      const totalReturnWt =
        items.reduce((s, i) => s + (Number(i.return_weight || i.total_wt) || ((Number(i.qty) || 0) * (Number(i.weight) || 0))), 0) ||
        Number(sr.total_wt || sr.total_weight || 0);
      const returnNo = sr.return_no || (sr.s_no ? `SR-${String(sr.s_no).padStart(5, '0')}` : `SR-${sr.id}`);

      return {
        ...sr,
        return_no: returnNo,
        bill_no: returnNo,
        customer_name: sr.customer || '',
        items,
        item_name: itemNames.join(', ') || 'Returned Goods',
        primary_item_name: itemNames[0] || 'Returned Goods',
        item_summary: itemNames.length > 1 ? `${itemNames[0]} + ${itemNames.length - 1} more` : (itemNames[0] || 'Returned Goods'),
        lot_no: lots.join(', ') || '',
        primary_lot_no: lots[0] || '',
        total_qty: round2(totalQty),
        total_wt: round2(totalReturnWt),
        total_return_weight: round2(totalReturnWt),
        qc_status: sr.qc_status || 'Pending',
        stock_status: sr.stock_status || normalizeStockDisposition(sr.stock_disposition || sr.goods_condition),
        settlement_status: sr.settlement_status || 'Pending',
        approval_status: sr.approval_status || 'PENDING',
        workflow_status: sr.workflow_status || 'QC Pending',
        grand_total: round2(sr.grand_total || sr.total_amt || 0)
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('Error fetching sales returns:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch sales returns' });
  }
});

// GET single sales return detail with audit logs & linked vouchers
router.get('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(404).json({ success: false, error: 'Sales return not found' });
    }

    const headerRes = await runner.query(`SELECT * FROM sales_return WHERE id = ? LIMIT 1`, [id]);
    if (!headerRes.rows || headerRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sales return not found' });
    }
    const sr = headerRes.rows[0];
    const itemsRes = await runner.query(`SELECT * FROM sales_return_items WHERE sales_return_id = ? ORDER BY id ASC`, [id]);

    // Refresh live available_return_qty when linked to original invoice
    const enrichedItems = [];
    for (const it of (itemsRes.rows || [])) {
      let availQty = Number(it.available_return_qty || 0);
      let prevRet = Number(it.previously_returned_qty || 0);
      if (sr.original_sales_id && Number(it.original_sold_qty || 0) > 0) {
        prevRet = await calculatePreviouslyReturnedForItem(runner, {
          originalSalesId: sr.original_sales_id,
          originalSalesItemId: it.original_sales_item_id,
          itemName: it.item_name,
          lotNo: it.lot_no,
          excludeReturnId: id
        });
        availQty = Math.max(0, round2(Number(it.original_sold_qty) - prevRet));
      }
      enrichedItems.push({
        ...it,
        previously_returned_qty: prevRet,
        available_return_qty: availQty
      });
    }

    const auditLogs = await runner.query(
      `SELECT * FROM stock_audit_logs WHERE entity_type = 'SALES_RETURN' AND entity_id = ? ORDER BY id DESC`,
      [id]
    ).catch(() => ({ rows: [] }));

    const linkedVouchers = await runner.query(
      `SELECT id, voucher_no, voucher_type, date, total_amount, narration, source_module
       FROM voucher
       WHERE source_id = ? AND LOWER(COALESCE(source_module, '')) IN ('sales_return', 'sales_return_refund')
       ORDER BY id ASC`,
      [id]
    ).catch(() => ({ rows: [] }));

    const returnNo = sr.return_no || (sr.s_no ? `SR-${String(sr.s_no).padStart(5, '0')}` : `SR-${sr.id}`);
    res.json({
      ...sr,
      return_no: returnNo,
      items: enrichedItems,
      audit_logs: auditLogs.rows || [],
      linked_vouchers: linkedVouchers.rows || []
    });
  } catch (err) {
    console.error('Error fetching sales return:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch sales return' });
  }
});

// Shared item quantity validation
async function validateAndPrepareItems(runner, rawItems, {
  originalSalesId,
  excludeReturnId = null,
  authorizedOverride = false,
  overrideReason = '',
  req = null
}) {
  const validItems = Array.isArray(rawItems)
    ? rawItems.filter((it) => String(it.item_name || it.itemName || '').trim() !== '')
    : [];

  if (validItems.length === 0) {
    const err = new Error('At least one returned item with a valid name is required.');
    err.statusCode = 400;
    throw err;
  }

  if (authorizedOverride) {
    const authCheck = await hasSalesReturnAuthority(req, 'approve');
    if (!authCheck.ok) {
      const err = new Error('Only Admin or Manager can authorize a return quantity override.');
      err.statusCode = 403;
      throw err;
    }
    if (!String(overrideReason || '').trim()) {
      const err = new Error('Override reason is required when exceeding invoice available return quantity.');
      err.statusCode = 400;
      throw err;
    }
  }

  // Track cumulative qty per original item in same payload so split rows cannot bypass cap
  const runningByItemKey = new Map();
  const prepared = [];

  for (const item of validItems) {
    const itemName = String(item.item_name || item.itemName || '').trim();
    const lotNo = String(item.lot_no || item.lotNo || '').trim();
    const qty = round2(item.qty || 0);
    if (qty <= 0) {
      const err = new Error(`Return quantity must be greater than 0 for item "${itemName}".`);
      err.statusCode = 400;
      throw err;
    }

    const origSalesId = item.original_sales_id || originalSalesId || null;
    const origSalesItemId = item.original_sales_item_id || null;
    let soldQty = round2(item.original_sold_qty || 0);

    if (origSalesId && soldQty <= 0) {
      if (origSalesItemId) {
        const siRes = await runner.query(`SELECT qty FROM sales_items WHERE id = ? AND sales_id = ? LIMIT 1`, [origSalesItemId, origSalesId]);
        if (siRes.rows?.[0]) soldQty = round2(siRes.rows[0].qty);
      } else {
        const siRes = await runner.query(
          `SELECT COALESCE(SUM(qty), 0) as qty FROM sales_items WHERE sales_id = ? AND LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND UPPER(TRIM(COALESCE(lot_no,''))) = UPPER(TRIM(?))`,
          [origSalesId, itemName, lotNo]
        );
        if (siRes.rows?.[0]) soldQty = round2(siRes.rows[0].qty);
      }
    }

    let prevReturned = 0;
    let availReturnQty = soldQty;

    if (origSalesId && soldQty > 0) {
      prevReturned = await calculatePreviouslyReturnedForItem(runner, {
        originalSalesId: origSalesId,
        originalSalesItemId: origSalesItemId,
        itemName,
        lotNo,
        excludeReturnId
      });
      const itemKey = origSalesItemId ? `SI:${origSalesItemId}` : `${itemName.toLowerCase()}|${lotNo.toUpperCase()}`;
      const usedInPayload = runningByItemKey.get(itemKey) || 0;
      availReturnQty = Math.max(0, round2(soldQty - prevReturned - usedInPayload));

      if (!authorizedOverride && qty > availReturnQty + 0.001) {
        const err = new Error(
          `Return quantity (${qty}) exceeds remaining eligible quantity (${availReturnQty}) for "${itemName}"${lotNo ? ` (Lot ${lotNo})` : ''}. Original Sold: ${soldQty}, Previously Returned: ${prevReturned}.`
        );
        err.statusCode = 400;
        throw err;
      }
      runningByItemKey.set(itemKey, round2(usedInPayload + qty));
    }

    const unitWt = Number(item.weight || 0) || 50;
    const returnWeight = round2(item.return_weight || item.total_wt || (qty * unitWt));
    const rate = Number(item.rate || 0);
    const discPerc = Number(item.disc_perc ?? item.disc ?? 0);
    const taxPerc = Number(item.tax_perc ?? item.tax_rate ?? 0);
    const grossLine = qty * rate;
    const discAmt = (grossLine * discPerc) / 100;
    const taxableAmt = round2(item.taxable_amount !== undefined ? item.taxable_amount : (grossLine - discAmt));
    const taxAmt = round2(item.tax_amount !== undefined ? item.tax_amount : ((taxableAmt * taxPerc) / 100));
    const lineTotal = round2(item.amount || item.total_amt || (taxableAmt + taxAmt));

    const destGodown = await resolveGodownRecord(
      runner,
      item.destination_godown_id,
      item.destination_godown_name
    );

    prepared.push({
      original_sales_id: origSalesId ? Number(origSalesId) : null,
      original_sales_item_id: origSalesItemId ? Number(origSalesItemId) : null,
      item_id: item.item_id ? Number(item.item_id) : null,
      item_name: itemName,
      lot_no: lotNo,
      uom: String(item.uom || 'Bags').trim() || 'Bags',
      weight: unitWt,
      qty,
      original_sold_qty: soldQty,
      previously_returned_qty: prevReturned,
      available_return_qty: availReturnQty,
      total_wt: returnWeight,
      return_weight: returnWeight,
      rate,
      disc_perc: discPerc,
      tax_perc: taxPerc,
      taxable_amount: taxableAmt,
      tax_amount: taxAmt,
      total_amt: lineTotal,
      destination_godown_id: destGodown.id,
      destination_godown_name: destGodown.godown_name,
      mfg_date: sanitizeDate(item.mfg_date) || '',
      exp_date: sanitizeDate(item.exp_date) || '',
      goods_condition: String(item.goods_condition || '').trim(),
      stock_disposition: normalizeStockDisposition(item.stock_disposition || item.goods_condition || 'Hold'),
      qc_item_result: String(item.qc_item_result || 'Pending').trim(),
      item_reason: String(item.item_reason || '').trim(),
      complaint_item_id: item.complaint_item_id ? Number(item.complaint_item_id) : null,
      complaint_qty: round2(item.complaint_qty || 0)
    });
  }

  return prepared;
}

// POST create new sales return (strictly lands in QC Pending / Quality Hold — NEVER adds directly to saleable FG stock)
router.post('/', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const body = req.body || {};

    const cleanDate = sanitizeDate(body.date) || new Date().toISOString().slice(0, 10);
    const reasonCategory = String(body.return_reason_category || '').trim();
    const reasonDetail = String(body.return_reason_detail || body.remarks || '').trim();

    if (!reasonCategory) {
      return res.status(400).json({ success: false, message: 'Return Reason Category is required.' });
    }
    if (reasonCategory.toLowerCase() === 'other' && !reasonDetail) {
      return res.status(400).json({ success: false, message: 'Detailed Return Reason is mandatory when "Other" category is selected.' });
    }

    const custRec = await resolveCustomerRecord(runner, body.customer_id || body.customer);
    const resolvedCustomerName =
      String(body.customer_name || '').trim() ||
      custRec?.name ||
      custRec?.print_name ||
      (!/^\d+$/.test(String(body.customer || '').trim()) ? String(body.customer || '').trim() : '');

    if (!resolvedCustomerName) {
      return res.status(400).json({ success: false, message: 'Customer is required.' });
    }

    const preparedItems = await validateAndPrepareItems(runner, body.items, {
      originalSalesId: body.original_sales_id,
      authorizedOverride: Boolean(body.authorized_override),
      overrideReason: body.override_reason,
      req
    });

    const destGodown = await resolveGodownRecord(
      runner,
      body.destination_godown_id,
      body.destination_godown_name
    );

    const totalQty = round2(preparedItems.reduce((s, it) => s + it.qty, 0));
    const totalWeight = round2(preparedItems.reduce((s, it) => s + it.return_weight, 0));
    const returnedItemAmount = round2(
      body.returned_item_amount !== undefined && body.returned_item_amount !== ''
        ? body.returned_item_amount
        : preparedItems.reduce((s, it) => s + it.total_amt, 0)
    );
    const billAmt = round2(body.bill_amt || preparedItems.reduce((s, it) => s + it.taxable_amount, 0));
    const taxAmt = round2(body.tax_amt || preparedItems.reduce((s, it) => s + it.tax_amount, 0));
    const dedAmt = round2(body.deduction_amount || 0);
    const grandTotal = round2(body.grand_total || body.total_amt || Math.max(0, returnedItemAmount - dedAmt));

    const custState = String(body.customer_state || body.party_state || custRec?.state || '').trim();
    const isInterState =
      String(body.tax_type || '').toLowerCase().includes('inter') ||
      (custState && !custState.toLowerCase().includes('tamil nadu') && !custState.toLowerCase().includes('33'));

    const cgstAmt = round2(body.cgst_amt || (isInterState ? 0 : taxAmt / 2));
    const sgstAmt = round2(body.sgst_amt || (isInterState ? 0 : taxAmt - cgstAmt));
    const igstAmt = round2(body.igst_amt || (isInterState ? taxAmt : 0));

    // Enforce initial Quarantine / QC Hold on new receipt
    const requestedCondition = String(body.goods_condition || 'Under Investigation').trim();
    const settlementType = SETTLEMENT_TYPES.includes(body.settlement_type) ? body.settlement_type : 'Credit Note';
    const createdBy = req.user?.username || body.created_by || 'admin';

    const txResult = await db.forCompany(activeCompanyId).withTransaction(async () => {
      let sNoNum = parseInt(body.s_no, 10);
      if (!Number.isSafeInteger(sNoNum) || sNoNum <= 0) {
        const snoRes = await runner.query(
          `SELECT MAX(CAST(s_no AS INTEGER)) as max_sno, MAX(id) as max_id, COUNT(*) as cnt FROM sales_return`
        );
        sNoNum = Math.max(
          parseInt(snoRes.rows?.[0]?.max_sno, 10) || 0,
          parseInt(snoRes.rows?.[0]?.max_id, 10) || 0,
          parseInt(snoRes.rows?.[0]?.cnt, 10) || 0
        ) + 1;
      }
      let returnNo = String(body.return_no || '').trim();

      const insertRes = await db.run(
        `INSERT INTO sales_return (
          s_no, return_no, date, original_sales_id, original_invoice_no, original_invoice_date,
          customer_id, customer, customer_gstin, customer_address, customer_state, customer_state_code,
          sales_order_no, delivery_challan_no, outpass_no,
          pay_type, tax_type, tax_percent, address, party_state,
          remarks, total_qty, total_wt, total_weight, total_amt, total_amount,
          bill_amt, tax_amt, cgst_amount, sgst_amount, igst_amount,
          deduction, deduction_remarks, deduction_amount, deductions_json, grand_total,
          loadman_name, loadman_worker_id, loadman_rate_per_kg, loadman_charges,
          return_reason_category, return_reason_detail, complaint_id, complaint_no, complaint_qty, quality_issue_desc,
          inspection_required, inspection_date, inspected_by, qc_status, qc_remarks,
          goods_condition, stock_disposition, stock_status, destination_godown_id, destination_godown_name,
          settlement_type, settlement_status, original_invoice_amount, returned_item_amount,
          credit_note_no, credit_note_date, refund_amount, refund_mode, refund_bank_name, refund_ref_no,
          replacement_amount, replacement_ref_no, customer_outstanding_adj, no_adjustment_reason,
          return_vehicle_no, transporter_name, driver_name, return_freight, freight_paid_by,
          return_pass_ref, customer_return_challan, supporting_docs, supporting_docs_json,
          workflow_status, approval_status, created_by, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          'QC Pending', 'PENDING', ?, CURRENT_TIMESTAMP
        )`,
        [
          sNoNum,
          returnNo || null,
          cleanDate,
          body.original_sales_id ? Number(body.original_sales_id) : null,
          String(body.original_invoice_no || '').trim(),
          sanitizeDate(body.original_invoice_date) || '',
          custRec?.id || (body.customer_id ? Number(body.customer_id) : null),
          resolvedCustomerName,
          String(body.customer_gstin || custRec?.gst_number || '').trim(),
          String(body.customer_address || body.address || '').trim(),
          custState,
          String(body.customer_state_code || custRec?.state_code || '').trim(),
          String(body.sales_order_no || '').trim(),
          String(body.delivery_challan_no || '').trim(),
          String(body.outpass_no || '').trim(),
          String(body.pay_type || 'Credit'),
          String(body.tax_type || 'Exclusive'),
          Number(body.tax_percent || 0),
          String(body.customer_address || body.address || '').trim(),
          custState,
          reasonDetail || String(body.remarks || '').trim(),
          totalQty,
          totalWeight,
          totalWeight,
          grandTotal,
          grandTotal,
          billAmt,
          taxAmt,
          cgstAmt,
          sgstAmt,
          igstAmt,
          String(body.deduction || ''),
          String(body.deduction_remarks || ''),
          dedAmt,
          body.deductions_json || '[]',
          grandTotal,
          String(body.loadman_name || ''),
          body.loadman_worker_id || null,
          Number(body.loadman_rate_per_kg || 0.50),
          Number(body.loadman_charges || 0),
          reasonCategory,
          reasonDetail,
          body.complaint_id ? Number(body.complaint_id) : null,
          String(body.complaint_no || '').trim(),
          round2(body.complaint_qty || preparedItems.reduce((s, it) => s + Number(it.complaint_qty || 0), 0)),
          String(body.quality_issue_desc || '').trim(),
          body.inspection_required === false || body.inspection_required === 0 ? 0 : 1,
          sanitizeDate(body.inspection_date) || '',
          String(body.inspected_by || '').trim(),
          'Pending',
          String(body.qc_remarks || '').trim(),
          requestedCondition,
          'Hold',
          'Hold',
          destGodown.id,
          destGodown.godown_name,
          settlementType,
          'Pending',
          round2(body.original_invoice_amount || 0),
          returnedItemAmount,
          String(body.credit_note_no || '').trim(),
          sanitizeDate(body.credit_note_date) || cleanDate,
          round2(body.refund_amount || 0),
          String(body.refund_mode || ''),
          String(body.refund_bank_name || ''),
          String(body.refund_ref_no || ''),
          round2(body.replacement_amount || 0),
          String(body.replacement_ref_no || ''),
          0,
          String(body.no_adjustment_reason || '').trim(),
          String(body.return_vehicle_no || '').trim(),
          String(body.transporter_name || '').trim(),
          String(body.driver_name || '').trim(),
          round2(body.return_freight || 0),
          String(body.freight_paid_by || 'Company').trim(),
          String(body.return_pass_ref || '').trim(),
          String(body.customer_return_challan || '').trim(),
          String(body.supporting_docs || '').trim(),
          body.supporting_docs_json || '[]',
          createdBy
        ],
        activeCompanyId
      );

      const salesReturnId = insertRes.lastID || insertRes.lastInsertRowid;
      if (!returnNo) {
        returnNo = `SR-${String(sNoNum || salesReturnId).padStart(5, '0')}`;
        await db.run(`UPDATE sales_return SET return_no = ? WHERE id = ?`, [returnNo, salesReturnId], activeCompanyId);
      }

      for (const it of preparedItems) {
        await db.run(
          `INSERT INTO sales_return_items (
            sales_return_id, original_sales_id, original_sales_item_id, item_id,
            item_name, lot_no, uom, weight, qty, original_sold_qty, previously_returned_qty, available_return_qty,
            total_wt, return_weight, rate, disc_perc, tax_perc, taxable_amount, tax_amount, total_amt,
            destination_godown_id, destination_godown_name, mfg_date, exp_date,
            goods_condition, stock_disposition, qc_item_result, item_reason, complaint_item_id, complaint_qty
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            salesReturnId,
            it.original_sales_id,
            it.original_sales_item_id,
            it.item_id,
            it.item_name,
            it.lot_no,
            it.uom,
            it.weight,
            it.qty,
            it.original_sold_qty,
            it.previously_returned_qty,
            it.available_return_qty,
            it.total_wt,
            it.return_weight,
            it.rate,
            it.disc_perc,
            it.tax_perc,
            it.taxable_amount,
            it.tax_amount,
            it.total_amt,
            it.destination_godown_id,
            it.destination_godown_name,
            it.mfg_date,
            it.exp_date,
            it.goods_condition || requestedCondition,
            'Hold',
            'Pending',
            it.item_reason,
            it.complaint_item_id,
            it.complaint_qty
          ],
          activeCompanyId
        );
      }

      await logReturnAudit(runner, activeCompanyId, {
        salesReturnId,
        returnNo,
        action: 'CREATED_IN_HOLD',
        oldValue: null,
        newValue: `QC Pending | Stock: Hold (${totalQty} qty / ${totalWeight} kg) | Reason: ${reasonCategory}`,
        performedBy: createdBy,
        reason: body.authorized_override ? `Override: ${body.override_reason}` : reasonDetail
      });

      return { salesReturnId, returnNo };
    });

    try {
      const { triggerTransactionNotification } = require('../utils/transactionNotifier');
      const itemDesc = preparedItems.map((i) => `${i.qty} ${i.item_name}`).slice(0, 3).join(', ');
      await triggerTransactionNotification({
        eventType: 'SALES_RETURN_CREATED',
        moduleName: 'SALES_RETURN',
        referenceNo: txResult.returnNo,
        referenceId: txResult.salesReturnId,
        companyId: activeCompanyId,
        title: `🟡 SALES RETURN (QC HOLD) – ${txResult.returnNo}`,
        message: `Customer: ${resolvedCustomerName} | Reason: ${reasonCategory} | Items: ${itemDesc} | Amount: ₹${grandTotal} | Status: QC Pending (Hold)`,
        severity: 'WARNING',
        details: {
          reference_no: txResult.returnNo,
          customer: resolvedCustomerName,
          invoice_no: body.original_invoice_no || '-',
          item_summary: itemDesc,
          quantity: `${totalQty} ${preparedItems[0]?.uom || 'Bags'} / ${totalWeight} KG`,
          amount: grandTotal,
          remarks: `${reasonCategory}: ${reasonDetail || '-'}`,
          created_by: createdBy,
          date: cleanDate
        }
      });
    } catch (notifErr) {
      console.warn('Notification warning (Sales Return):', notifErr.message);
    }

    res.status(201).json({
      success: true,
      id: txResult.salesReturnId,
      return_no: txResult.returnNo,
      qc_status: 'Pending',
      stock_status: 'Hold',
      message: 'Sales Return recorded in Quality Hold / QC Pending status. Complete QC inspection & approval before releasing stock or Credit Note.'
    });
  } catch (err) {
    console.error('Error creating sales return:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message, error: err.message });
  }
});

// PUT update sales return (if already APPROVED, requires approval authority and preserves stock/voucher consistency)
router.put('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid sales return ID' });
    }

    const existingRes = await runner.query(`SELECT * FROM sales_return WHERE id = ? LIMIT 1`, [id]);
    if (!existingRes.rows || existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sales return not found' });
    }
    const existing = existingRes.rows[0];

    if (String(existing.approval_status || '').toUpperCase() === 'APPROVED') {
      const authCheck = await hasSalesReturnAuthority(req, 'approve');
      if (!authCheck.ok) {
        return res.status(authCheck.status).json({
          success: false,
          message: 'Only Admin or Manager can modify an already-approved sales return.'
        });
      }
    }

    const body = req.body || {};
    const cleanDate = sanitizeDate(body.date) || existing.date || new Date().toISOString().slice(0, 10);
    const reasonCategory = String(body.return_reason_category || existing.return_reason_category || '').trim();
    const reasonDetail = String(body.return_reason_detail || body.remarks || existing.return_reason_detail || '').trim();

    if (!reasonCategory) {
      return res.status(400).json({ success: false, message: 'Return Reason Category is required.' });
    }
    if (reasonCategory.toLowerCase() === 'other' && !reasonDetail) {
      return res.status(400).json({ success: false, message: 'Detailed Return Reason is mandatory when "Other" category is selected.' });
    }

    const custRec = await resolveCustomerRecord(runner, body.customer_id || body.customer || existing.customer);
    const resolvedCustomerName =
      String(body.customer_name || '').trim() ||
      custRec?.name ||
      custRec?.print_name ||
      existing.customer;

    const preparedItems = await validateAndPrepareItems(runner, body.items, {
      originalSalesId: body.original_sales_id || existing.original_sales_id,
      excludeReturnId: id,
      authorizedOverride: Boolean(body.authorized_override),
      overrideReason: body.override_reason,
      req
    });

    const destGodown = await resolveGodownRecord(
      runner,
      body.destination_godown_id || existing.destination_godown_id,
      body.destination_godown_name || existing.destination_godown_name
    );

    const totalQty = round2(preparedItems.reduce((s, it) => s + it.qty, 0));
    const totalWeight = round2(preparedItems.reduce((s, it) => s + it.return_weight, 0));
    const returnedItemAmount = round2(
      body.returned_item_amount !== undefined && body.returned_item_amount !== ''
        ? body.returned_item_amount
        : preparedItems.reduce((s, it) => s + it.total_amt, 0)
    );
    const billAmt = round2(body.bill_amt || preparedItems.reduce((s, it) => s + it.taxable_amount, 0));
    const taxAmt = round2(body.tax_amt || preparedItems.reduce((s, it) => s + it.tax_amount, 0));
    const dedAmt = round2(body.deduction_amount || 0);
    const grandTotal = round2(body.grand_total || body.total_amt || Math.max(0, returnedItemAmount - dedAmt));

    const custState = String(body.customer_state || body.party_state || existing.customer_state || custRec?.state || '').trim();
    const isInterState =
      String(body.tax_type || existing.tax_type || '').toLowerCase().includes('inter') ||
      (custState && !custState.toLowerCase().includes('tamil nadu') && !custState.toLowerCase().includes('33'));

    const cgstAmt = round2(body.cgst_amt || (isInterState ? 0 : taxAmt / 2));
    const sgstAmt = round2(body.sgst_amt || (isInterState ? 0 : taxAmt - cgstAmt));
    const igstAmt = round2(body.igst_amt || (isInterState ? taxAmt : 0));

    const settlementType = SETTLEMENT_TYPES.includes(body.settlement_type)
      ? body.settlement_type
      : (existing.settlement_type || 'Credit Note');
    const updatedBy = req.user?.username || 'admin';
    const isAlreadyApproved = String(existing.approval_status || '').toUpperCase() === 'APPROVED';

    await db.forCompany(activeCompanyId).withTransaction(async () => {
      if (isAlreadyApproved) {
        await reverseApprovedStockImpact(runner, activeCompanyId, id, 'Approved sales return updated', updatedBy);
      }

      await db.run(`DELETE FROM sales_return_items WHERE sales_return_id = ?`, [id], activeCompanyId);

      const newCondition = String(body.goods_condition || existing.goods_condition || 'Under Investigation').trim();
      const keptDisp = isAlreadyApproved
        ? normalizeStockDisposition(body.stock_disposition || existing.stock_disposition || existing.stock_status)
        : 'Hold';

      await db.run(
        `UPDATE sales_return SET
          s_no = ?, return_no = ?, date = ?, original_sales_id = ?, original_invoice_no = ?, original_invoice_date = ?,
          customer_id = ?, customer = ?, customer_gstin = ?, customer_address = ?, customer_state = ?, customer_state_code = ?,
          sales_order_no = ?, delivery_challan_no = ?, outpass_no = ?,
          pay_type = ?, tax_type = ?, tax_percent = ?, address = ?, party_state = ?,
          remarks = ?, total_qty = ?, total_wt = ?, total_weight = ?, total_amt = ?, total_amount = ?,
          bill_amt = ?, tax_amt = ?, cgst_amount = ?, sgst_amount = ?, igst_amount = ?,
          deduction = ?, deduction_remarks = ?, deduction_amount = ?, deductions_json = ?, grand_total = ?,
          loadman_name = ?, loadman_worker_id = ?, loadman_rate_per_kg = ?, loadman_charges = ?,
          return_reason_category = ?, return_reason_detail = ?, complaint_id = ?, complaint_no = ?, complaint_qty = ?, quality_issue_desc = ?,
          inspection_required = ?, inspection_date = ?, inspected_by = ?, qc_remarks = ?,
          goods_condition = ?, stock_disposition = ?, stock_status = ?, destination_godown_id = ?, destination_godown_name = ?,
          settlement_type = ?, original_invoice_amount = ?, returned_item_amount = ?,
          credit_note_no = ?, credit_note_date = ?, refund_amount = ?, refund_mode = ?, refund_bank_name = ?, refund_ref_no = ?,
          replacement_amount = ?, replacement_ref_no = ?, no_adjustment_reason = ?,
          return_vehicle_no = ?, transporter_name = ?, driver_name = ?, return_freight = ?, freight_paid_by = ?,
          return_pass_ref = ?, customer_return_challan = ?, supporting_docs = ?, supporting_docs_json = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          parseInt(body.s_no, 10) || existing.s_no,
          String(body.return_no || existing.return_no || `SR-${String(existing.s_no || id).padStart(5, '0')}`),
          cleanDate,
          body.original_sales_id ? Number(body.original_sales_id) : existing.original_sales_id,
          String(body.original_invoice_no ?? existing.original_invoice_no ?? ''),
          sanitizeDate(body.original_invoice_date) ?? existing.original_invoice_date ?? '',
          custRec?.id || body.customer_id || existing.customer_id,
          resolvedCustomerName,
          String(body.customer_gstin ?? existing.customer_gstin ?? ''),
          String(body.customer_address ?? body.address ?? existing.customer_address ?? ''),
          custState,
          String(body.customer_state_code ?? existing.customer_state_code ?? ''),
          String(body.sales_order_no ?? existing.sales_order_no ?? ''),
          String(body.delivery_challan_no ?? existing.delivery_challan_no ?? ''),
          String(body.outpass_no ?? existing.outpass_no ?? ''),
          String(body.pay_type || existing.pay_type || 'Credit'),
          String(body.tax_type || existing.tax_type || 'Exclusive'),
          Number(body.tax_percent ?? existing.tax_percent ?? 0),
          String(body.customer_address ?? body.address ?? existing.address ?? ''),
          custState,
          reasonDetail || String(body.remarks ?? existing.remarks ?? ''),
          totalQty,
          totalWeight,
          totalWeight,
          grandTotal,
          grandTotal,
          billAmt,
          taxAmt,
          cgstAmt,
          sgstAmt,
          igstAmt,
          String(body.deduction ?? existing.deduction ?? ''),
          String(body.deduction_remarks ?? existing.deduction_remarks ?? ''),
          dedAmt,
          body.deductions_json ?? existing.deductions_json ?? '[]',
          grandTotal,
          String(body.loadman_name ?? existing.loadman_name ?? ''),
          body.loadman_worker_id ?? existing.loadman_worker_id ?? null,
          Number(body.loadman_rate_per_kg ?? existing.loadman_rate_per_kg ?? 0.50),
          Number(body.loadman_charges ?? existing.loadman_charges ?? 0),
          reasonCategory,
          reasonDetail,
          body.complaint_id !== undefined ? (body.complaint_id ? Number(body.complaint_id) : null) : existing.complaint_id,
          String(body.complaint_no ?? existing.complaint_no ?? ''),
          round2(body.complaint_qty ?? existing.complaint_qty ?? 0),
          String(body.quality_issue_desc ?? existing.quality_issue_desc ?? ''),
          body.inspection_required === false || body.inspection_required === 0 ? 0 : 1,
          sanitizeDate(body.inspection_date) ?? existing.inspection_date ?? '',
          String(body.inspected_by ?? existing.inspected_by ?? ''),
          String(body.qc_remarks ?? existing.qc_remarks ?? ''),
          newCondition,
          keptDisp,
          keptDisp,
          destGodown.id,
          destGodown.godown_name,
          settlementType,
          round2(body.original_invoice_amount ?? existing.original_invoice_amount ?? 0),
          returnedItemAmount,
          String(body.credit_note_no ?? existing.credit_note_no ?? ''),
          sanitizeDate(body.credit_note_date) ?? existing.credit_note_date ?? cleanDate,
          round2(body.refund_amount ?? existing.refund_amount ?? 0),
          String(body.refund_mode ?? existing.refund_mode ?? ''),
          String(body.refund_bank_name ?? existing.refund_bank_name ?? ''),
          String(body.refund_ref_no ?? existing.refund_ref_no ?? ''),
          round2(body.replacement_amount ?? existing.replacement_amount ?? 0),
          String(body.replacement_ref_no ?? existing.replacement_ref_no ?? ''),
          String(body.no_adjustment_reason ?? existing.no_adjustment_reason ?? ''),
          String(body.return_vehicle_no ?? existing.return_vehicle_no ?? ''),
          String(body.transporter_name ?? existing.transporter_name ?? ''),
          String(body.driver_name ?? existing.driver_name ?? ''),
          round2(body.return_freight ?? existing.return_freight ?? 0),
          String(body.freight_paid_by ?? existing.freight_paid_by ?? 'Company'),
          String(body.return_pass_ref ?? existing.return_pass_ref ?? ''),
          String(body.customer_return_challan ?? existing.customer_return_challan ?? ''),
          String(body.supporting_docs ?? existing.supporting_docs ?? ''),
          body.supporting_docs_json ?? existing.supporting_docs_json ?? '[]',
          id
        ],
        activeCompanyId
      );

      for (const it of preparedItems) {
        await db.run(
          `INSERT INTO sales_return_items (
            sales_return_id, original_sales_id, original_sales_item_id, item_id,
            item_name, lot_no, uom, weight, qty, original_sold_qty, previously_returned_qty, available_return_qty,
            total_wt, return_weight, rate, disc_perc, tax_perc, taxable_amount, tax_amount, total_amt,
            destination_godown_id, destination_godown_name, mfg_date, exp_date,
            goods_condition, stock_disposition, qc_item_result, item_reason, complaint_item_id, complaint_qty
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            it.original_sales_id,
            it.original_sales_item_id,
            it.item_id,
            it.item_name,
            it.lot_no,
            it.uom,
            it.weight,
            it.qty,
            it.original_sold_qty,
            it.previously_returned_qty,
            it.available_return_qty,
            it.total_wt,
            it.return_weight,
            it.rate,
            it.disc_perc,
            it.tax_perc,
            it.taxable_amount,
            it.tax_amount,
            it.total_amt,
            it.destination_godown_id,
            it.destination_godown_name,
            it.mfg_date,
            it.exp_date,
            it.goods_condition || newCondition,
            isAlreadyApproved ? normalizeStockDisposition(it.stock_disposition || keptDisp) : 'Hold',
            isAlreadyApproved ? existing.qc_status : 'Pending',
            it.item_reason,
            it.complaint_item_id,
            it.complaint_qty
          ],
          activeCompanyId
        );
      }

      if (isAlreadyApproved) {
        const refreshedHeader = (await runner.query(`SELECT * FROM sales_return WHERE id = ?`, [id])).rows[0];
        const refreshedItems = (await runner.query(`SELECT * FROM sales_return_items WHERE sales_return_id = ?`, [id])).rows;
        await applyResalableStockImpact(runner, activeCompanyId, refreshedHeader, refreshedItems, updatedBy);

        if (settlementType === 'Credit Note' || settlementType === 'Refund') {
          const vRes = await createSalesReturnVoucherChain({
            companyId: activeCompanyId,
            customer: resolvedCustomerName,
            date: cleanDate,
            returnInvNo: refreshedHeader.return_no,
            existingVoucherNo: refreshedHeader.credit_note_no || refreshedHeader.voucher_no || null,
            sNo: refreshedHeader.s_no,
            salesReturnId: id,
            totalAmount: grandTotal,
            baseAmount: billAmt,
            taxAmount: taxAmt,
            cgstAmount: cgstAmt,
            sgstAmount: sgstAmt,
            igstAmount: igstAmt,
            deductionAmount: dedAmt,
            isInterstate: isInterState,
            narration: `Sales Return ${refreshedHeader.return_no} (${reasonCategory})`
          });
          if (vRes?.voucherNo) {
            await db.run(
              `UPDATE sales_return SET voucher_no = ?, credit_note_no = COALESCE(NULLIF(credit_note_no,''), ?) WHERE id = ?`,
              [vRes.voucherNo, vRes.voucherNo, id],
              activeCompanyId
            );
          }
          if (settlementType === 'Refund' && Number(body.refund_amount || 0) > 0) {
            await createSalesReturnRefundVoucher({
              companyId: activeCompanyId,
              customer: resolvedCustomerName,
              date: cleanDate,
              returnInvNo: refreshedHeader.return_no,
              salesReturnId: id,
              refundAmount: Number(body.refund_amount || 0),
              refundMode: body.refund_mode || 'Bank',
              bankAccountName: body.refund_bank_name || '',
              refundRefNo: body.refund_ref_no || ''
            });
          }
        }
      }

      await logReturnAudit(runner, activeCompanyId, {
        salesReturnId: id,
        returnNo: existing.return_no,
        action: 'UPDATED',
        oldValue: `${existing.total_qty} qty`,
        newValue: `${totalQty} qty | Reason: ${reasonCategory}`,
        performedBy: updatedBy,
        reason: reasonDetail
      });
    });

    res.json({ success: true, id, message: 'Sales Return updated successfully.' });
  } catch (err) {
    console.error('Error updating sales return:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message, error: err.message });
  }
});

// POST QC inspection update (step 2 before authorized approval)
router.post('/:id/inspect', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid sales return ID' });
    }

    const existingRes = await runner.query(`SELECT * FROM sales_return WHERE id = ? LIMIT 1`, [id]);
    if (!existingRes.rows || existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sales return not found' });
    }
    const existing = existingRes.rows[0];
    if (String(existing.approval_status || '').toUpperCase() === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot inspect a cancelled sales return.' });
    }

    const body = req.body || {};
    const qcStatus = ['Pending', 'Approved', 'Rejected', 'Hold', 'Reprocess'].includes(body.qc_status)
      ? body.qc_status
      : 'Approved';
    const inspectionDate = sanitizeDate(body.inspection_date) || new Date().toISOString().slice(0, 10);
    const inspectedBy = String(body.inspected_by || req.user?.username || 'QC Inspector').trim();
    const goodsCondition = String(body.goods_condition || existing.goods_condition || 'Under Investigation').trim();
    const qcRemarks = String(body.qc_remarks || '').trim();
    const qualityIssueDesc = String(body.quality_issue_desc ?? existing.quality_issue_desc ?? '').trim();

    await runner.run(
      `UPDATE sales_return SET
         inspection_date = ?,
         inspected_by = ?,
         qc_status = ?,
         goods_condition = ?,
         quality_issue_desc = ?,
         qc_remarks = ?,
         workflow_status = CASE WHEN approval_status = 'APPROVED' THEN workflow_status ELSE 'Inspected' END,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [inspectionDate, inspectedBy, qcStatus, goodsCondition, qualityIssueDesc, qcRemarks, id]
    );

    await logReturnAudit(runner, activeCompanyId, {
      salesReturnId: id,
      returnNo: existing.return_no,
      action: 'QC_INSPECTED',
      oldValue: existing.qc_status,
      newValue: `${qcStatus} (${goodsCondition})`,
      performedBy: inspectedBy,
      reason: qcRemarks || qualityIssueDesc
    });

    res.json({ success: true, message: `QC Inspection recorded (${qcStatus}).` });
  } catch (err) {
    console.error('Error recording QC inspection:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Authorized Approval + Conditional Stock Disposition + Independent Financial Settlement (RBAC-gated)
router.post('/:id/approve', requireApprovalAuthority, async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid sales return ID' });
    }

    const existingRes = await runner.query(`SELECT * FROM sales_return WHERE id = ? LIMIT 1`, [id]);
    if (!existingRes.rows || existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sales return not found' });
    }
    const existing = existingRes.rows[0];
    if (String(existing.approval_status || '').toUpperCase() === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot approve a cancelled sales return.' });
    }

    const itemsRes = await runner.query(`SELECT * FROM sales_return_items WHERE sales_return_id = ? ORDER BY id ASC`, [id]);
    const items = itemsRes.rows || [];
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Sales return has no items to approve.' });
    }

    const body = req.body || {};
    const approver = req.user?.username || 'admin';
    const cleanDate = sanitizeDate(body.credit_note_date) || existing.date || new Date().toISOString().slice(0, 10);

    // 1. Independent QC status
    const qcStatus = ['Approved', 'Rejected', 'Hold', 'Reprocess', 'Pending'].includes(body.qc_status)
      ? body.qc_status
      : (existing.qc_status && existing.qc_status !== 'Pending' ? existing.qc_status : 'Approved');

    // 2. Independent Stock Disposition
    const stockDisposition = normalizeStockDisposition(body.stock_disposition || body.stock_status || existing.stock_disposition || 'Hold');
    const goodsCondition = String(body.goods_condition || defaultConditionForDisposition(stockDisposition)).trim();
    const destGodown = await resolveGodownRecord(
      runner,
      body.destination_godown_id || existing.destination_godown_id,
      body.destination_godown_name || existing.destination_godown_name
    );

    // 3. Independent Financial Settlement
    const settlementType = SETTLEMENT_TYPES.includes(body.settlement_type)
      ? body.settlement_type
      : (existing.settlement_type || 'Credit Note');
    const noAdjReason = String(body.no_adjustment_reason ?? existing.no_adjustment_reason ?? body.approval_remarks ?? '').trim();
    if (settlementType === 'No Financial Adjustment' && !noAdjReason) {
      return res.status(400).json({
        success: false,
        message: 'Authorization reason is required when selecting "No Financial Adjustment".'
      });
    }

    const approvalRemarks = String(body.approval_remarks || '').trim();
    const inspectionDate = sanitizeDate(body.inspection_date) || existing.inspection_date || new Date().toISOString().slice(0, 10);
    const inspectedBy = String(body.inspected_by || existing.inspected_by || approver).trim();
    const qcRemarks = String(body.qc_remarks ?? existing.qc_remarks ?? '').trim();

    const returnNo = existing.return_no || `SR-${String(existing.s_no || id).padStart(5, '0')}`;
    const refundAmount = round2(body.refund_amount ?? existing.refund_amount ?? existing.grand_total ?? existing.total_amt ?? 0);
    const refundMode = String(body.refund_mode || existing.refund_mode || 'Bank').trim();
    const refundBankName = String(body.refund_bank_name || existing.refund_bank_name || '').trim();
    const refundRefNo = String(body.refund_ref_no || existing.refund_ref_no || '').trim();
    const replacementAmount = round2(body.replacement_amount ?? existing.replacement_amount ?? 0);
    const replacementRefNo = String(body.replacement_ref_no || existing.replacement_ref_no || '').trim();
    const grandTotal = round2(existing.grand_total || existing.total_amt || 0);
    const billAmt = round2(existing.bill_amt || 0);
    const taxAmt = round2(existing.tax_amt || 0);
    const cgstAmt = round2(existing.cgst_amount || 0);
    const sgstAmt = round2(existing.sgst_amount || 0);
    const igstAmt = round2(existing.igst_amount || 0);
    const dedAmt = round2(existing.deduction_amount || 0);
    const isInterState = igstAmt > 0 || String(existing.tax_type || '').toLowerCase().includes('inter');

    const itemDispMap = body.item_dispositions && typeof body.item_dispositions === 'object' ? body.item_dispositions : {};

    const txOut = await db.forCompany(activeCompanyId).withTransaction(async () => {
      // Reverse any previous approved stock impact cleanly before applying new disposition
      await reverseApprovedStockImpact(runner, activeCompanyId, id, 'Disposition re-evaluated on approval', approver);

      for (const it of items) {
        const lineDisp = normalizeStockDisposition(itemDispMap[it.id] || stockDisposition);
        const lineCond = defaultConditionForDisposition(lineDisp);
        await db.run(
          `UPDATE sales_return_items
           SET stock_disposition = ?, goods_condition = ?, qc_item_result = ?,
               destination_godown_id = COALESCE(destination_godown_id, ?),
               destination_godown_name = COALESCE(NULLIF(destination_godown_name,''), ?)
           WHERE id = ?`,
          [lineDisp, lineCond, qcStatus, destGodown.id, destGodown.godown_name, it.id],
          activeCompanyId
        );
      }

      // Financial Settlement Execution
      let creditNoteNo = String(body.credit_note_no || existing.credit_note_no || '').trim();
      let voucherNo = existing.voucher_no || '';
      let refundVoucherNo = existing.refund_voucher_no || '';
      let settlementStatus = 'Pending';
      let outstandingAdj = 0;

      if (settlementType === 'Credit Note' || settlementType === 'Refund') {
        const cnRes = await createSalesReturnVoucherChain({
          companyId: activeCompanyId,
          customer: existing.customer,
          date: cleanDate,
          returnInvNo: returnNo,
          existingVoucherNo: creditNoteNo || voucherNo || null,
          sNo: existing.s_no,
          salesReturnId: id,
          totalAmount: grandTotal,
          baseAmount: billAmt,
          taxAmount: taxAmt,
          cgstAmount: cgstAmt,
          sgstAmount: sgstAmt,
          igstAmount: igstAmt,
          deductionAmount: dedAmt,
          isInterstate: isInterState,
          narration: `Credit Note for Sales Return ${returnNo} (${existing.return_reason_category || 'Return'})`
        });
        voucherNo = cnRes?.voucherNo || cnRes?.voucher_no || voucherNo;
        creditNoteNo = creditNoteNo || voucherNo || `CN-${String(id).padStart(5, '0')}`;
        outstandingAdj = grandTotal;
        settlementStatus = 'Adjusted';

        if (settlementType === 'Refund' && refundAmount > 0) {
          const refRes = await createSalesReturnRefundVoucher({
            companyId: activeCompanyId,
            customer: existing.customer,
            date: cleanDate,
            returnInvNo: returnNo,
            salesReturnId: id,
            refundAmount,
            refundMode,
            bankAccountName: refundBankName,
            refundRefNo,
            existingVoucherNo: refundVoucherNo || null,
            narration: `Customer Refund for Sales Return ${returnNo}`
          });
          refundVoucherNo = refRes?.voucherNo || refRes?.voucher_no || refundVoucherNo;
          settlementStatus = 'Refunded';
        } else {
          await AccountingEngine.deleteVoucherBySource({
            companyId: activeCompanyId,
            sourceModule: 'sales_return_refund',
            sourceId: id,
            voucherTypes: ['Payment', 'PAY']
          });
          refundVoucherNo = '';
        }
      } else {
        await deleteSalesReturnVoucherChain(id, activeCompanyId);
        voucherNo = '';
        refundVoucherNo = '';
        creditNoteNo = '';
        outstandingAdj = 0;
        settlementStatus = settlementType === 'Replacement' ? 'Replaced' : 'No Adjustment';
      }

      const nextWorkflow = body.close_return ? 'Closed' : 'Approved';
      await db.run(
        `UPDATE sales_return SET
          inspection_date = ?,
          inspected_by = ?,
          qc_status = ?,
          qc_remarks = ?,
          goods_condition = ?,
          stock_disposition = ?,
          stock_status = ?,
          destination_godown_id = ?,
          destination_godown_name = ?,
          settlement_type = ?,
          settlement_status = ?,
          credit_note_no = ?,
          credit_note_date = ?,
          refund_amount = ?,
          refund_mode = ?,
          refund_bank_name = ?,
          refund_ref_no = ?,
          refund_voucher_no = ?,
          replacement_amount = ?,
          replacement_ref_no = ?,
          customer_outstanding_adj = ?,
          no_adjustment_reason = ?,
          voucher_no = ?,
          approval_status = 'APPROVED',
          workflow_status = ?,
          approved_by = ?,
          approved_at = CURRENT_TIMESTAMP,
          approval_remarks = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          inspectionDate,
          inspectedBy,
          qcStatus,
          qcRemarks,
          goodsCondition,
          stockDisposition,
          stockDisposition,
          destGodown.id,
          destGodown.godown_name,
          settlementType,
          settlementStatus,
          creditNoteNo,
          cleanDate,
          settlementType === 'Refund' ? refundAmount : 0,
          refundMode,
          refundBankName,
          refundRefNo,
          refundVoucherNo,
          settlementType === 'Replacement' ? replacementAmount : 0,
          replacementRefNo,
          outstandingAdj,
          noAdjReason,
          voucherNo,
          nextWorkflow,
          approver,
          approvalRemarks,
          id
        ],
        activeCompanyId
      );

      const updatedHeader = (await runner.query(`SELECT * FROM sales_return WHERE id = ?`, [id])).rows[0];
      const updatedItems = (await runner.query(`SELECT * FROM sales_return_items WHERE sales_return_id = ? ORDER BY id ASC`, [id])).rows;

      // Apply FG stock ONLY for items routed to 'Resalable'
      await applyResalableStockImpact(runner, activeCompanyId, updatedHeader, updatedItems, approver);

      await logReturnAudit(runner, activeCompanyId, {
        salesReturnId: id,
        returnNo,
        action: `APPROVED_${stockDisposition.toUpperCase()}`,
        oldValue: `${existing.qc_status || 'Pending'} / ${existing.stock_status || 'Hold'}`,
        newValue: `QC: ${qcStatus} | Stock: ${stockDisposition} | Settlement: ${settlementType} (${settlementStatus})${creditNoteNo ? ` | CN: ${creditNoteNo}` : ''}`,
        performedBy: approver,
        reason: approvalRemarks || qcRemarks || noAdjReason
      });

      return {
        returnNo,
        qcStatus,
        stockDisposition,
        settlementStatus,
        creditNoteNo,
        voucherNo,
        refundVoucherNo,
        workflowStatus: nextWorkflow
      };
    });

    res.json({
      success: true,
      data: txOut,
      message: `Sales Return ${txOut.returnNo} approved (${txOut.stockDisposition} | ${txOut.settlementStatus}).`
    });
  } catch (err) {
    console.error('Error approving sales return:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// POST Close approved sales return
router.post('/:id/close', requireApprovalAuthority, async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    const existingRes = await runner.query(`SELECT * FROM sales_return WHERE id = ? LIMIT 1`, [id]);
    if (!existingRes.rows?.[0]) return res.status(404).json({ success: false, message: 'Sales return not found' });

    const existing = existingRes.rows[0];
    if (String(existing.approval_status || '').toUpperCase() !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Sales Return must be approved before closing.' });
    }

    await runner.run(
      `UPDATE sales_return SET workflow_status = 'Closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    await logReturnAudit(runner, activeCompanyId, {
      salesReturnId: id,
      returnNo: existing.return_no,
      action: 'CLOSED',
      oldValue: existing.workflow_status,
      newValue: 'Closed',
      performedBy: req.user?.username || 'admin',
      reason: req.body?.remarks || 'Return closed'
    });

    res.json({ success: true, message: 'Sales Return closed cleanly.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST cancel sales return (RBAC-gated; reverses any approved FG stock & vouchers without removing audit record)
router.post('/:id/cancel', requireCancelAuthority, async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    const existingRes = await runner.query(`SELECT * FROM sales_return WHERE id = ? LIMIT 1`, [id]);
    if (!existingRes.rows?.[0]) return res.status(404).json({ success: false, message: 'Sales return not found' });

    const existing = existingRes.rows[0];
    const username = req.user?.username || 'admin';
    const cancelReason = String(req.body?.reason || 'Cancelled by authorized user').trim();

    await db.forCompany(activeCompanyId).withTransaction(async () => {
      await reverseApprovedStockImpact(runner, activeCompanyId, id, cancelReason, username);
      await deleteSalesReturnVoucherChain(id, activeCompanyId);
      await db.run(
        `UPDATE sales_return
         SET approval_status = 'CANCELLED',
             workflow_status = 'Cancelled',
             settlement_status = 'Cancelled',
             approval_remarks = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [cancelReason, id],
        activeCompanyId
      );
      await logReturnAudit(runner, activeCompanyId, {
        salesReturnId: id,
        returnNo: existing.return_no,
        action: 'CANCELLED',
        oldValue: existing.workflow_status,
        newValue: 'Cancelled',
        performedBy: username,
        reason: cancelReason
      });
    });

    res.json({ success: true, message: 'Sales Return cancelled and all stock/credit note entries reversed.' });
  } catch (err) {
    console.error('Error cancelling sales return:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE sales return (RBAC-gated; cleanly reverses approved FG stock & vouchers)
router.delete('/:id', requireCancelAuthority, async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const runner = db.forCompany(activeCompanyId);
    const id = parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid sales return ID' });
    }

    const username = req.user?.username || 'admin';
    await db.forCompany(activeCompanyId).withTransaction(async () => {
      const existingRes = await db.query('SELECT id, return_no FROM sales_return WHERE id = ?', [id], activeCompanyId);
      if (!existingRes.rows || existingRes.rows.length === 0) {
        const err = new Error('Sales return not found');
        err.statusCode = 404;
        throw err;
      }

      await reverseApprovedStockImpact(runner, activeCompanyId, id, 'Sales return deleted', username);
      await deleteSalesReturnVoucherChain(id, activeCompanyId);
      await db.run('DELETE FROM sales_return_items WHERE sales_return_id = ?', [id], activeCompanyId);
      await db.run('DELETE FROM sales_return WHERE id = ?', [id], activeCompanyId);
    });

    res.json({ success: true, message: 'Sales return deleted and stock/vouchers reversed cleanly.' });
  } catch (err) {
    console.error('Error deleting sales return:', err);
    res.status(err.statusCode || 500).json({ success: false, error: err.message, message: err.message });
  }
});

module.exports = router;
