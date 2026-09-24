const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { createPurchaseReturnVoucherChain, deletePurchaseReturnVoucherChain } = require('../utils/ledgerHelper');
const rebuildStockLedger = require('../utils/stockRebuilder');

// Helper function to ensure purchase_return schema, columns, and deductions exist
async function ensureReturnSchema() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS purchase_return_deductions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_return_id INTEGER,
        deduction_id INTEGER,
        deduction_name TEXT,
        type TEXT,
        calculation_type TEXT,
        percentage REAL DEFAULT 0,
        amount REAL DEFAULT 0
      )
    `);
  } catch (e) {}

  // Safe migrations for purchase_returns table
  const returnCols = [
    "ALTER TABLE purchase_returns ADD COLUMN source TEXT DEFAULT 'MANUAL'",
    "ALTER TABLE purchase_returns ADD COLUMN purchase_id TEXT",
    "ALTER TABLE purchase_returns ADD COLUMN purchase_inv_no TEXT",
    "ALTER TABLE purchase_returns ADD COLUMN po_no TEXT",
    "ALTER TABLE purchase_returns ADD COLUMN purchase_order_id INTEGER",
    "ALTER TABLE purchase_returns ADD COLUMN iqr_no TEXT",
    "ALTER TABLE purchase_returns ADD COLUMN qc_no TEXT",
    "ALTER TABLE purchase_returns ADD COLUMN status TEXT DEFAULT 'POSTED'",
    "ALTER TABLE purchase_returns ADD COLUMN approval_status TEXT DEFAULT 'APPROVED'"
  ];
  for (const sql of returnCols) {
    try { await db.run(sql); } catch (e) {}
  }

  // Safe migrations for purchase_return_items table
  const itemCols = [
    "ALTER TABLE purchase_return_items ADD COLUMN purchase_id INTEGER",
    "ALTER TABLE purchase_return_items ADD COLUMN purchase_item_id INTEGER",
    "ALTER TABLE purchase_return_items ADD COLUMN item_id INTEGER",
    "ALTER TABLE purchase_return_items ADD COLUMN purchased_qty REAL DEFAULT 0",
    "ALTER TABLE purchase_return_items ADD COLUMN accepted_qty REAL DEFAULT 0",
    "ALTER TABLE purchase_return_items ADD COLUMN rejected_qty REAL DEFAULT 0",
    "ALTER TABLE purchase_return_items ADD COLUMN previously_returned_qty REAL DEFAULT 0",
    "ALTER TABLE purchase_return_items ADD COLUMN available_qty REAL DEFAULT 0",
    "ALTER TABLE purchase_return_items ADD COLUMN iqr_no TEXT",
    "ALTER TABLE purchase_return_items ADD COLUMN qc_no TEXT",
    "ALTER TABLE purchase_return_items ADD COLUMN reason TEXT",
    "ALTER TABLE purchase_return_items ADD COLUMN source TEXT DEFAULT 'MANUAL'"
  ];
  for (const sql of itemCols) {
    try { await db.run(sql); } catch (e) {}
  }
}
ensureReturnSchema();

// GET all purchase returns
router.get(['/', '/list'], async (req, res) => {
  try {
    await ensureReturnSchema();
    const result = await db.query(`
      SELECT 
        pr.*,
        sm.name as supplier_master_name,
        sm.print_name as supplier_print_name,
        (
          SELECT GROUP_CONCAT(DISTINCT pri.item_name)
          FROM purchase_return_items pri 
          WHERE pri.purchase_return_id = pr.id
        ) as item_names,
        (
          SELECT GROUP_CONCAT(DISTINCT pri.weight)
          FROM purchase_return_items pri 
          WHERE pri.purchase_return_id = pr.id
        ) as item_weights,
        (
          SELECT SUM(prd.amount) 
          FROM purchase_return_deductions prd 
          WHERE prd.purchase_return_id = pr.id
        ) as deduction_amount
      FROM purchase_returns pr
      LEFT JOIN supplier_master sm ON (CAST(pr.supplier AS TEXT) = CAST(sm.id AS TEXT) OR pr.supplier = sm.name)
      ORDER BY pr.id DESC
    `);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching purchase returns:', error);
    res.status(500).json({ message: 'Error fetching purchase returns', error: error.message });
  }
});

// GET next sequential S.No for purchase return
router.get('/next-sno', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        MAX(CAST(s_no AS INTEGER)) as max_sno,
        MAX(id) as max_id,
        COUNT(*) as total_count 
      FROM purchase_returns
    `);
    const maxVal = Math.max(
      parseInt(result.rows[0]?.max_sno) || 0,
      parseInt(result.rows[0]?.max_id) || 0,
      parseInt(result.rows[0]?.total_count) || 0
    );
    const nextSNo = maxVal + 1;
    res.json({ success: true, next_s_no: String(nextSNo), next_sno: nextSNo, s_no: nextSNo, data: { s_no: nextSNo } });
  } catch (error) {
    console.error('Error fetching next purchase return S.No:', error);
    res.status(500).json({ success: false, message: 'Error fetching next S.No', error: error.message });
  }
});

// GET list of QC rejected, QC HOLD, not unloaded, not approved, not verified, not lab performed items
router.get(['/candidates', '/pending-returns'], async (req, res) => {
  try {
    await ensureReturnSchema();
    const includeAll = req.query.all === 'true';

    // 1. Fetch from stock_lots joined with purchases, QC, IQR
    const stockLotsSql = `
      SELECT 
        sl.id as stock_lot_id,
        sl.lot_no,
        sl.item_name,
        sl.item_id,
        COALESCE(sl.quantity, pi.qty, 0) as received_qty,
        COALESCE(sl.remaining_quantity, sl.quantity, pi.qty, 0) as remaining_quantity,
        COALESCE(sl.rate, pi.rate, 0) as rate,
        sl.unloading_status,
        sl.qc_status,
        sl.approval_status,
        COALESCE(sl.purchase_id, pi.purchase_id, p.id) as purchase_id,
        COALESCE(p.inv_no, CAST(p.s_no AS TEXT), CAST(p.id AS TEXT), '') as purchase_inv_no,
        COALESCE(p.inv_no, CAST(p.s_no AS TEXT), CAST(p.id AS TEXT), '') as inv_no,
        COALESCE(p.date, sl.created_at) as inv_date,
        p.s_no,
        COALESCE(p.source_order_no, p.po_no, '') as po_no,
        p.pay_type,
        p.tax_type,
        COALESCE(p.godown, 'Main Godown') as godown,
        p.supplier as supplier_id,
        sm.id as supplier_master_id,
        COALESCE(sm.print_name, sm.name, CAST(p.supplier AS TEXT), '') as supplier_name,
        COALESCE(sm.print_name, sm.name, CAST(p.supplier AS TEXT), '') as supplier_print_name,
        COALESCE(sm.address1, p.address, '') as supplier_address,
        COALESCE(sm.gst_number, '') as supplier_gstin,
        COALESCE(pi.per_unit_weight, 50) as weight,
        COALESCE(pi.disc_percent, 0) as disc,
        COALESCE(pi.tax_percent, 0) as tax,
        qi.id as qc_id,
        qi.qc_no,
        qi.inspection_date as qc_date,
        qi.inspector,
        qi.overall_result as qc_overall_result,
        COALESCE(qi.remarks, '') as qc_remarks,
        iqr.id as iqr_id,
        iqr.iqr_no,
        COALESCE(iqr.remarks, '') as iqr_remarks
      FROM stock_lots sl
      LEFT JOIN purchase_items pi ON (
        (pi.lot_no = sl.lot_no AND sl.lot_no IS NOT NULL AND sl.lot_no != '')
        OR (CAST(pi.purchase_id AS TEXT) = CAST(sl.purchase_id AS TEXT) AND pi.item_name = sl.item_name)
      )
      LEFT JOIN purchases p ON (
        p.id = sl.purchase_id 
        OR p.id = pi.purchase_id
        OR CAST(p.id AS TEXT) = CAST(sl.purchase_id AS TEXT)
        OR ('PUR-' || CAST(p.id AS TEXT)) = CAST(sl.purchase_id AS TEXT)
        OR p.inv_no = CAST(sl.purchase_id AS TEXT)
      )
      LEFT JOIN supplier_master sm ON (
        CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) 
        OR sm.name = CAST(p.supplier AS TEXT) 
        OR sm.print_name = CAST(p.supplier AS TEXT)
      )
      LEFT JOIN qc_inspections qi ON (
        qi.rm_lot_no = sl.lot_no 
        OR (CAST(qi.purchase_id AS TEXT) = CAST(p.id AS TEXT) AND CAST(p.id AS TEXT) != '')
      )
      LEFT JOIN incoming_quality_reports iqr ON (
        iqr.rm_lot_no = sl.lot_no 
        OR (iqr.qc_id IS NOT NULL AND iqr.qc_id = qi.id)
      )
      ORDER BY sl.id DESC
    `;

    // 2. Fetch directly from purchase_items & purchases (to catch un-lotted or direct purchases)
    const directPurchaseSql = `
      SELECT 
        pi.id as purchase_item_id,
        pi.lot_no,
        pi.item_name,
        pi.item_id,
        COALESCE(pi.qty, 0) as received_qty,
        COALESCE(pi.qty, 0) as remaining_quantity,
        COALESCE(pi.rate, 0) as rate,
        COALESCE(pi.per_unit_weight, 50) as weight,
        COALESCE(pi.disc_percent, 0) as disc,
        COALESCE(pi.tax_percent, 0) as tax,
        p.id as purchase_id,
        COALESCE(p.inv_no, CAST(p.s_no AS TEXT), CAST(p.id AS TEXT), '') as purchase_inv_no,
        COALESCE(p.inv_no, CAST(p.s_no AS TEXT), CAST(p.id AS TEXT), '') as inv_no,
        p.date as inv_date,
        p.s_no,
        COALESCE(p.source_order_no, p.po_no, '') as po_no,
        p.pay_type,
        p.tax_type,
        COALESCE(p.godown, 'Main Godown') as godown,
        p.supplier as supplier_id,
        sm.id as supplier_master_id,
        COALESCE(sm.print_name, sm.name, CAST(p.supplier AS TEXT), '') as supplier_name,
        COALESCE(sm.print_name, sm.name, CAST(p.supplier AS TEXT), '') as supplier_print_name,
        COALESCE(sm.address1, p.address, '') as supplier_address,
        COALESCE(sm.gst_number, '') as supplier_gstin,
        qi.id as qc_id,
        qi.qc_no,
        qi.inspection_date as qc_date,
        qi.inspector,
        qi.overall_result as qc_overall_result,
        COALESCE(qi.remarks, '') as qc_remarks,
        iqr.id as iqr_id,
        iqr.iqr_no,
        COALESCE(iqr.remarks, '') as iqr_remarks
      FROM purchase_items pi
      JOIN purchases p ON p.id = pi.purchase_id
      LEFT JOIN supplier_master sm ON (
        CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) 
        OR sm.name = CAST(p.supplier AS TEXT) 
        OR sm.print_name = CAST(p.supplier AS TEXT)
      )
      LEFT JOIN qc_inspections qi ON (
        (pi.lot_no IS NOT NULL AND pi.lot_no != '' AND qi.rm_lot_no = pi.lot_no)
        OR (CAST(qi.purchase_id AS TEXT) = CAST(p.id AS TEXT))
      )
      LEFT JOIN incoming_quality_reports iqr ON (
        (pi.lot_no IS NOT NULL AND pi.lot_no != '' AND iqr.rm_lot_no = pi.lot_no)
        OR (iqr.qc_id IS NOT NULL AND iqr.qc_id = qi.id)
      )
      ORDER BY pi.id DESC
    `;

    const [stockRes, purchaseRes] = await Promise.all([
      db.query(stockLotsSql).catch(() => ({ rows: [] })),
      db.query(directPurchaseSql).catch(() => ({ rows: [] }))
    ]);

    const combinedRows = [...(stockRes.rows || []), ...(purchaseRes.rows || [])];
    const seenKeys = new Set();
    const candidates = [];

    for (const r of combinedRows) {
      const key = r.lot_no ? `LOT-${r.lot_no}` : `PI-${r.purchase_id}-${r.item_name}-${r.received_qty}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      // Calculate previously returned quantity
      let previouslyReturned = 0;
      try {
        let retRes;
        if (r.lot_no) {
          retRes = await db.query(`
            SELECT COALESCE(SUM(pri.qty), 0) as returned_qty 
            FROM purchase_return_items pri
            WHERE UPPER(pri.lot_no) = UPPER(?) AND pri.lot_no != ''
          `, [r.lot_no]);
        } else if (r.purchase_id && r.item_name) {
          retRes = await db.query(`
            SELECT COALESCE(SUM(pri.qty), 0) as returned_qty 
            FROM purchase_return_items pri
            WHERE pri.purchase_id = ? AND pri.item_name = ?
          `, [r.purchase_id, r.item_name]);
        }
        if (retRes?.rows?.length) {
          previouslyReturned = parseFloat(retRes.rows[0]?.returned_qty) || 0;
        }
      } catch (e) {}

      // Calculate production consumption (Grain inputs, Flour inputs, Packing inputs)
      let consumedInProduction = 0;
      try {
        if (r.lot_no) {
          const prodRes = await db.query(`
            SELECT 
              (SELECT COALESCE(SUM(gi.qty), 0) FROM grain_input_items gi WHERE UPPER(gi.lot_no) = UPPER(?)) +
              (SELECT COALESCE(SUM(foi.qty), 0) FROM flour_out_items foi WHERE UPPER(foi.lot_no) = UPPER(?)) +
              (SELECT COALESCE(SUM(pi.qty), 0) FROM packing_items pi WHERE (pi.remarks = 'section:from' OR pi.remarks IS NULL OR pi.remarks != 'section:to') AND UPPER(pi.lot_no) = UPPER(?)) as consumed_qty
          `, [r.lot_no, r.lot_no, r.lot_no]);
          if (prodRes?.rows?.length) {
            consumedInProduction = parseFloat(prodRes.rows[0]?.consumed_qty) || 0;
          }
        }
      } catch (e) {}

      const receivedQty = parseFloat(r.received_qty) || 0;
      const remQty = parseFloat(r.remaining_quantity) || receivedQty;
      const eligibleReturnQty = Math.max(0, receivedQty - previouslyReturned - consumedInProduction);

      const isProcessed = (consumedInProduction > 0);
      const isReturned = (previouslyReturned >= (receivedQty - 0.001) && previouslyReturned > 0) && !isProcessed;

      const isQcRejected = r.qc_status === 'REJECTED' || r.qc_status === 'FAIL' || r.qc_overall_result === 'REJECTED' || r.qc_overall_result === 'FAIL';
      const isQcHold = r.qc_status === 'HOLD' || r.qc_overall_result === 'HOLD' || r.approval_status === 'ON_HOLD';
      const isNotUnloaded = r.unloading_status === 'PENDING_DECISION' || r.unloading_status === 'NOT_UNLOADED' || r.unloading_status === 'HOLD';
      const isNotApproved = r.approval_status && r.approval_status !== 'APPROVED';
      const isLabPending = !r.qc_id || r.qc_status === 'PENDING' || !r.qc_status;

      let statusCategory = 'FACTORY_STOCK';
      let statusBadge = 'Factory Stock';
      let defaultReason = 'Factory RM Stock';

      if (isProcessed) {
        statusCategory = 'PROCESSED';
        statusBadge = (consumedInProduction >= (receivedQty - 0.001)) 
          ? 'Processed in Production' 
          : `Partially Processed (${consumedInProduction} Bags in Production)`;
        defaultReason = 'Lot processed / consumed in factory production (input item lot)';
      } else if (isReturned) {
        statusCategory = 'RETURNED';
        statusBadge = 'Returned';
        defaultReason = 'Goods returned to supplier (Debit Note issued)';
      } else if (isQcRejected) {
        statusCategory = 'QC_REJECTED';
        statusBadge = 'QC Rejected';
        defaultReason = r.qc_remarks || 'Quality parameters out of specification (QC Rejection)';
      } else if (isQcHold) {
        statusCategory = 'QC_HOLD';
        statusBadge = 'QC Hold';
        defaultReason = r.qc_remarks || 'Quality Hold: Material quarantined pending re-test / return';
      } else if (isNotUnloaded) {
        statusCategory = 'NOT_UNLOADED';
        statusBadge = 'Not Unloaded / Pending';
        defaultReason = r.iqr_remarks || 'Material rejected at gate / not unloaded due to discrepancies';
      } else if (isNotApproved) {
        statusCategory = 'NOT_APPROVED';
        statusBadge = 'Not Approved';
        defaultReason = r.iqr_remarks || 'Inward approval rejected / authorization pending';
      } else if (isLabPending) {
        statusCategory = 'LAB_PENDING';
        statusBadge = 'Lab Pending / Not Verified';
        defaultReason = 'Lab inspection not performed / pending verification';
      } else {
        // Standard Factory RM Stock
        statusCategory = 'FACTORY_STOCK';
        statusBadge = 'Factory Stock';
        if (r.qc_overall_result === 'ACCEPTED' || r.qc_status === 'ACCEPTED') {
          defaultReason = r.qc_remarks ? `QC Accepted: ${r.qc_remarks}` : 'Factory Inward Stock (Inspected & Verified)';
        } else if (r.iqr_remarks) {
          defaultReason = `IQR Verified: ${r.iqr_remarks}`;
        } else {
          defaultReason = 'Factory RM Stock (Available for Excess / Manual Return)';
        }
      }

      if (eligibleReturnQty > 0 || isReturned || includeAll) {
        const isIqr = Boolean(r.iqr_no);
        candidates.push({
          candidate_id: key,
          source: isIqr ? 'IQR_REJECTION' : (statusCategory === 'QC_REJECTED' ? 'QC_REJECTION' : (statusCategory === 'QC_HOLD' ? 'QUALITY_HOLD' : 'MANUAL')),
          status_category: statusCategory,
          status_badge: statusBadge,
          stock_lot_id: r.stock_lot_id || null,
          purchase_item_id: r.purchase_item_id || null,
          lot_no: r.lot_no || '',
          item_id: r.item_id,
          item_name: r.item_name || 'Raw Material',
          purchase_id: r.purchase_id,
          purchase_inv_no: r.purchase_inv_no || (r.purchase_id ? `PUR-${r.purchase_id}` : '-'),
          inv_no: r.purchase_inv_no || (r.purchase_id ? `PUR-${r.purchase_id}` : '-'),
          inv_date: r.inv_date ? String(r.inv_date).split('T')[0] : '',
          received_date: r.inv_date ? String(r.inv_date).split('T')[0] : '',
          po_no: r.po_no || '-',
          pay_type: r.pay_type || 'Credit',
          tax_type: r.tax_type || 'Exclusive',
          godown: r.godown || 'Main Godown',
          supplier_id: r.supplier_id || r.supplier_master_id,
          supplier_name: r.supplier_name || 'Vendor',
          supplier_print_name: r.supplier_print_name || r.supplier_name || 'Vendor',
          supplier_address: r.supplier_address || '',
          supplier_gstin: r.supplier_gstin || '',
          qc_id: r.qc_id,
          qc_no: r.qc_no || (r.qc_id ? `QC-${r.qc_id}` : (isLabPending ? 'No QC Recorded' : '-')),
          qc_date: r.qc_date ? String(r.qc_date).split('T')[0] : '',
          qc_status: r.qc_status || r.qc_overall_result || (isLabPending ? 'PENDING' : 'HOLD'),
          inspector: r.inspector || '-',
          iqr_no: r.iqr_no || (isIqr ? `IQR-${r.lot_no || r.purchase_id}` : '-'),
          received_qty: receivedQty,
          remaining_quantity: remQty,
          accepted_qty: (statusCategory === 'QC_REJECTED' || statusCategory === 'QC_HOLD') ? 0 : receivedQty,
          rejected_qty: receivedQty,
          previously_returned_qty: previouslyReturned,
          eligible_return_qty: eligibleReturnQty,
          weight: parseFloat(r.weight) || 50,
          rate: parseFloat(r.rate) || 0,
          disc: parseFloat(r.disc) || 0,
          tax: parseFloat(r.tax) || 0,
          reason: defaultReason
        });
      }
    }

    res.json(candidates);
  } catch (error) {
    console.error('Error fetching purchase return candidates:', error);
    res.status(500).json([]);
  }
});

// GET list of available purchase invoices for Method B (Manual Return)
router.get('/invoices-for-return', async (req, res) => {
  try {
    const { supplier_id } = req.query;
    let query = `
      SELECT 
        p.id,
        COALESCE(p.inv_no, CAST(p.s_no AS TEXT), CAST(p.id AS TEXT)) as inv_no,
        p.date as inv_date,
        p.s_no,
        COALESCE(p.source_order_no, p.po_no, '') as po_no,
        p.supplier as supplier_id,
        COALESCE(sm.print_name, sm.name, CAST(p.supplier AS TEXT), '') as supplier_name,
        COALESCE(sm.print_name, sm.name, CAST(p.supplier AS TEXT), '') as supplier_print_name,
        COALESCE(sm.address1, p.address, '') as supplier_address,
        COALESCE(sm.gst_number, '') as supplier_gstin,
        p.pay_type,
        p.tax_type,
        COALESCE(p.godown, 'Main Godown') as godown,
        COALESCE(p.total_qty, 0) as total_qty,
        COALESCE(p.grand_total, 0) as grand_total,
        (
          SELECT GROUP_CONCAT(DISTINCT pi.item_name)
          FROM purchase_items pi WHERE pi.purchase_id = p.id
        ) as item_names
      FROM purchases p
      LEFT JOIN supplier_master sm ON (
        CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) 
        OR sm.name = CAST(p.supplier AS TEXT) 
        OR sm.print_name = CAST(p.supplier AS TEXT)
      )
    `;
    const params = [];
    if (supplier_id) {
      query += ` WHERE CAST(p.supplier AS TEXT) = ? OR sm.name = ? OR sm.print_name = ?`;
      params.push(String(supplier_id), String(supplier_id), String(supplier_id));
    }
    query += ` ORDER BY p.id DESC LIMIT 100`;

    const result = await db.query(query, params);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching invoices for return:', error);
    res.status(500).json([]);
  }
});

// GET full Purchase Genealogy Chain by Purchase ID or Invoice No
// Essential for Method B: fetches only items in this invoice, original lots, QC/IQR links,
// and enforces Purchased Qty - Previously Returned Qty = Available Return Qty
router.get('/purchase-chain/:idOrInvNo', async (req, res) => {
  try {
    const ref = req.params.idOrInvNo;
    if (!ref) {
      return res.status(400).json({ success: false, message: 'Purchase reference is required' });
    }

    // 1. Fetch purchase header
    const pRes = await db.query(`
      SELECT 
        p.*,
        COALESCE(p.inv_no, CAST(p.s_no AS TEXT), CAST(p.id AS TEXT)) as resolved_inv_no,
        p.date as resolved_inv_date,
        COALESCE(p.source_order_no, p.po_no, '') as resolved_po_no,
        sm.id as supplier_master_id,
        COALESCE(sm.print_name, sm.name, CAST(p.supplier AS TEXT), '') as supplier_name,
        COALESCE(sm.print_name, sm.name, CAST(p.supplier AS TEXT), '') as supplier_print_name,
        COALESCE(sm.address1, p.address, '') as supplier_address,
        COALESCE(sm.gst_number, '') as supplier_gstin,
        COALESCE(sm.mobile1, sm.phone_off, '') as supplier_phone,
        COALESCE(gm.godown_name, p.godown, 'Main Godown') as godown_name
      FROM purchases p
      LEFT JOIN supplier_master sm ON (
        CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) 
        OR sm.name = CAST(p.supplier AS TEXT) 
        OR sm.print_name = CAST(p.supplier AS TEXT)
      )
      LEFT JOIN godown_master gm ON (
        CAST(gm.id AS TEXT) = CAST(p.godown AS TEXT)
        OR gm.godown_name = CAST(p.godown AS TEXT)
      )
      WHERE CAST(p.id AS TEXT) = ? 
         OR p.inv_no = ? 
         OR CAST(p.s_no AS TEXT) = ?
         OR ('PUR-' || CAST(p.id AS TEXT)) = ?
         OR ('PUR-' || CAST(p.s_no AS TEXT)) = ?
      LIMIT 1
    `, [ref, ref, ref, ref, ref]);

    if (!pRes.rows || pRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Purchase record "${ref}" not found.` });
    }

    const purchase = pRes.rows[0];
    const purchaseId = purchase.id;

    // 2. Fetch all line items for this specific purchase
    const piRes = await db.query(`
      SELECT 
        pi.id as purchase_item_id,
        pi.purchase_id,
        pi.item_id,
        pi.item_name,
        pi.lot_no,
        COALESCE(pi.per_unit_weight, 50) as weight,
        COALESCE(pi.qty, 0) as purchased_qty,
        COALESCE(pi.total_weight, 0) as total_wt,
        COALESCE(pi.rate, 0) as rate,
        COALESCE(pi.disc_percent, 0) as disc_percent,
        COALESCE(pi.tax_percent, 0) as tax_percent,
        COALESCE(pi.amount, 0) as amount
      FROM purchase_items pi
      WHERE CAST(pi.purchase_id AS TEXT) = ?
      ORDER BY pi.id ASC
    `, [String(purchaseId)]);

    // 3. For each item, look up genealogy (QC, IQR, Stock, Previously Returned Qty)
    const items = [];
    for (const item of (piRes.rows || [])) {
      const lot = item.lot_no || '';
      
      // Look up QC inspection
      let qcData = null;
      try {
        const qcRes = await db.query(`
          SELECT id, qc_no, rm_lot_no, inspection_date, inspector, overall_result, remarks
          FROM qc_inspections
          WHERE rm_lot_no = ? OR CAST(purchase_id AS TEXT) = ?
          ORDER BY id DESC LIMIT 1
        `, [lot, String(purchaseId)]);
        qcData = qcRes.rows[0] || null;
      } catch (e) {}

      // Look up IQR
      let iqrData = null;
      try {
        const iqrRes = await db.query(`
          SELECT id, iqr_no, rm_lot_no, uploaded_date, remarks
          FROM incoming_quality_reports
          WHERE rm_lot_no = ? OR (qc_id IS NOT NULL AND qc_id = ?)
          ORDER BY id DESC LIMIT 1
        `, [lot, qcData?.id || null]);
        iqrData = iqrRes.rows[0] || null;
      } catch (e) {}

      // Look up stock_lots status
      let stockLot = null;
      try {
        const slRes = await db.query(`
          SELECT id, qc_status, unloading_status, approval_status, remaining_quantity
          FROM stock_lots
          WHERE lot_no = ? LIMIT 1
        `, [lot]);
        stockLot = slRes.rows[0] || null;
      } catch (e) {}

      // Look up previously returned quantity for this item/lot in this purchase
      let previouslyReturned = 0;
      try {
        let retRes;
        if (lot) {
          retRes = await db.query(`
            SELECT COALESCE(SUM(pri.qty), 0) as returned_qty
            FROM purchase_return_items pri
            WHERE pri.lot_no = ?
          `, [lot]);
        } else {
          retRes = await db.query(`
            SELECT COALESCE(SUM(pri.qty), 0) as returned_qty
            FROM purchase_return_items pri
            WHERE pri.purchase_id = ? AND pri.item_name = ?
          `, [purchaseId, item.item_name]);
        }
        previouslyReturned = parseFloat(retRes.rows[0]?.returned_qty) || 0;
      } catch (e) {}

      const purchasedQty = parseFloat(item.purchased_qty) || 0;
      const availableReturnQty = Math.max(0, purchasedQty - previouslyReturned);
      
      let acceptedQty = purchasedQty;
      let rejectedQty = 0;
      if (qcData && (qcData.overall_result === 'REJECTED' || qcData.overall_result === 'FAIL')) {
        rejectedQty = purchasedQty;
        acceptedQty = 0;
      } else if (stockLot && stockLot.qc_status === 'HOLD') {
        rejectedQty = 0;
        acceptedQty = 0; // In hold
      }

      items.push({
        ...item,
        purchased_qty: purchasedQty,
        accepted_qty: acceptedQty,
        rejected_qty: rejectedQty,
        previously_returned_qty: previouslyReturned,
        available_return_qty: availableReturnQty,
        qc_id: qcData?.id || null,
        qc_no: qcData?.qc_no || (qcData?.id ? `QC-${qcData.id}` : (stockLot?.qc_status === 'HOLD' ? 'QC-HOLD' : 'No QC')),
        qc_status: qcData?.overall_result || stockLot?.qc_status || 'PENDING',
        qc_remarks: qcData?.remarks || '',
        iqr_id: iqrData?.id || null,
        iqr_no: iqrData?.iqr_no || '',
        unloading_status: stockLot?.unloading_status || 'UNLOADED',
        approval_status: stockLot?.approval_status || 'APPROVED',
        is_qc_rejected: qcData ? (qcData.overall_result === 'REJECTED' || qcData.overall_result === 'FAIL') : false,
        is_qc_hold: (qcData?.overall_result === 'HOLD' || stockLot?.qc_status === 'HOLD')
      });
    }

    // 4. Fetch deductions from the original purchase if any
    let originalDeductions = [];
    try {
      const dRes = await db.query(`
        SELECT * FROM purchase_deductions WHERE CAST(purchase_id AS TEXT) = ?
      `, [String(purchaseId)]);
      originalDeductions = dRes.rows || [];
    } catch (e) {}

    res.json({
      success: true,
      purchase,
      items,
      deductions: originalDeductions
    });
  } catch (error) {
    console.error('Error fetching purchase chain:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single purchase return by ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null' || isNaN(Number(id))) {
      return res.status(404).json({ message: 'Purchase return not found' });
    }

    const purchaseReturnResult = await db.query(`
      SELECT 
        pr.*,
        sm.id as supplier_master_id,
        sm.name as supplier_name,
        sm.print_name as supplier_print_name,
        COALESCE(sm.address1, '') as supplier_address,
        COALESCE(sm.mobile1, sm.phone_off, sm.phone_res, '') as supplier_phone,
        COALESCE(sm.gst_number, '') as supplier_gstin
      FROM purchase_returns pr
      LEFT JOIN supplier_master sm ON (CAST(pr.supplier AS TEXT) = CAST(sm.id AS TEXT) OR pr.supplier = sm.name)
      WHERE pr.id = ?
    `, [id]);

    if (purchaseReturnResult.rows.length === 0) {
      return res.status(404).json({ message: 'Purchase return not found' });
    }

    const itemsResult = await db.query(`
      SELECT * FROM purchase_return_items WHERE purchase_return_id = ? ORDER BY id ASC
    `, [req.params.id]);
    
    let deductionsResult = [];
    try {
      const d = await db.query('SELECT * FROM purchase_return_deductions WHERE purchase_return_id = ?', [req.params.id]);
      deductionsResult = d.rows || [];
    } catch (e) {}

    const purchaseReturn = {
      ...purchaseReturnResult.rows[0],
      items: itemsResult.rows || [],
      deductions: deductionsResult
    };

    res.json(purchaseReturn);
  } catch (error) {
    console.error('Error fetching purchase return:', error);
    res.status(500).json({ message: 'Error fetching purchase return' });
  }
});

// Helper validation for Over-Return enforcement:
// Ensures that for each item: Return Qty <= (Purchased Qty - Previously Returned Qty)
async function validateReturnQuantities(items, purchaseId, excludeReturnId = null) {
  for (const item of items) {
    const returnQty = parseFloat(item.qty) || 0;
    if (returnQty <= 0) {
      continue;
    }
    const lotNo = (item.lot_no || '').trim();
    const itemName = (item.item_name || '').trim();

    let purchasedQty = parseFloat(item.purchased_qty) || 0;

    // If purchasedQty wasn't passed in, look up from DB
    if (!purchasedQty) {
      if (lotNo) {
        const lotRes = await db.query('SELECT quantity FROM stock_lots WHERE lot_no = ? LIMIT 1', [lotNo]);
        if (lotRes.rows && lotRes.rows.length > 0) {
          purchasedQty = parseFloat(lotRes.rows[0].quantity) || 0;
        }
      }
      if (!purchasedQty && purchaseId) {
        const piRes = await db.query(`
          SELECT qty FROM purchase_items 
          WHERE CAST(purchase_id AS TEXT) = ? AND item_name = ? LIMIT 1
        `, [String(purchaseId), itemName]);
        if (piRes.rows && piRes.rows.length > 0) {
          purchasedQty = parseFloat(piRes.rows[0].qty) || 0;
        }
      }
    }

    if (purchasedQty > 0) {
      let alreadyReturned = 0;
      let query = `
        SELECT COALESCE(SUM(pri.qty), 0) as total_returned
        FROM purchase_return_items pri
        WHERE 1=1
      `;
      const params = [];
      if (lotNo) {
        query += ` AND pri.lot_no = ?`;
        params.push(lotNo);
      } else if (purchaseId) {
        query += ` AND pri.purchase_id = ? AND pri.item_name = ?`;
        params.push(purchaseId, itemName);
      }

      if (excludeReturnId) {
        query += ` AND pri.purchase_return_id != ?`;
        params.push(excludeReturnId);
      }

      const retRes = await db.query(query, params);
      alreadyReturned = parseFloat(retRes.rows[0]?.total_returned) || 0;

      const availableQty = Math.max(0, purchasedQty - alreadyReturned);

      // Enforce: returnQty cannot exceed availableQty
      if (returnQty > availableQty + 0.001) {
        return {
          valid: false,
          error: `Over-return validation failed: Item "${itemName || lotNo}" has only ${availableQty.toFixed(2)} available for return (${purchasedQty.toFixed(2)} originally purchased, ${alreadyReturned.toFixed(2)} previously returned), but ${returnQty.toFixed(2)} was entered.`
        };
      }
    }
  }
  return { valid: true };
}

// POST create new purchase return
router.post('/', async (req, res) => {
  try {
    await ensureReturnSchema();
    const { formData, items, totals, deductions } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item must be included in the purchase return.' });
    }

    const purchaseId = formData.purchaseId || formData.purchase_id || null;

    // 1. Strict Over-Return Validation
    const validation = await validateReturnQuantities(items, purchaseId);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const auto_wages = parseFloat(totals?.deductions?.autoWages ?? totals?.auto_wages) || 0;
    const vat_percent = parseFloat(totals?.deductions?.vatPercent ?? totals?.vat_percent) || 0;
    const vat = parseFloat(totals?.deductions?.vat ?? totals?.vat) || 0;

    const returnSource = formData.returnMethod === 'QC_IQR' ? 'QC_REJECTION' : (formData.source || 'MANUAL');

    // 2. Insert into purchase_returns with full genealogy
    const purchaseReturnResult = await db.run(`
      INSERT INTO purchase_returns (
        s_no, date, return_inv_no, supplier, pay_type, inv_date, type, address,
        tax_type, godown, remarks, total_qty, total_weight, total_amount,
        base_amount, disc_amount, tax_amount, net_amount, auto_wages,
        vat_percent, vat, grand_total, source, purchase_id, purchase_inv_no,
        po_no, iqr_no, qc_no, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      formData.sNo ?? formData.s_no, 
      formData.date, 
      formData.returnInvNo ?? formData.return_inv_no, 
      formData.supplier, 
      formData.payType ?? formData.pay_type ?? 'Credit',
      formData.invDate ?? formData.inv_date, 
      formData.type ?? 'Urad', 
      formData.address ?? '', 
      formData.taxType ?? formData.tax_type ?? 'Exclusive', 
      formData.godown ?? 'Main Godown',
      formData.remarks ?? '', 
      totals.totalQty ?? totals.total_qty ?? 0, 
      totals.totalWeight ?? totals.total_weight ?? 0, 
      totals.totalAmount ?? totals.total_amount ?? 0,
      totals.baseAmount ?? totals.base_amount ?? 0, 
      totals.discAmount ?? totals.disc_amount ?? 0, 
      totals.taxAmount ?? totals.tax_amount ?? 0, 
      totals.netAmount ?? totals.net_amount ?? 0,
      auto_wages, 
      vat_percent, 
      vat, 
      totals.grandTotal ?? totals.grand_total ?? 0,
      returnSource,
      purchaseId ? String(purchaseId) : null,
      formData.purchaseInvNo || formData.returnInvNo || null,
      formData.poNo || null,
      formData.iqrNo || null,
      formData.qcNo || null,
      'POSTED'
    ]);

    const purchaseReturnId = purchaseReturnResult.lastID || purchaseReturnResult.lastInsertRowid || purchaseReturnResult.rows?.[0]?.id;

    // 3. Insert purchase return items and update inventory & genealogy
    for (const item of items) {
      const lot_no = item.lot_no ?? item.lotNo ?? '';
      const item_name = item.item_name ?? item.itemName ?? '';
      const item_id = item.item_id ?? null;
      const weight = parseFloat(item.weight) || 0;
      const qty = parseFloat(item.qty) || 0;
      const total_wt = parseFloat(item.total_wt ?? item.totalWt ?? item.total_weight) || (weight * qty);
      const rate = parseFloat(item.rate) || 0;
      const disc_percent = parseFloat(item.disc_percent ?? item.disc ?? item.discountPercent) || 0;
      const tax_percent = parseFloat(item.tax_percent ?? item.tax ?? item.taxPercent) || 0;
      const amount = parseFloat(item.amount) || 0;

      const purchased_qty = parseFloat(item.purchased_qty) || qty;
      const accepted_qty = parseFloat(item.accepted_qty) || 0;
      const rejected_qty = parseFloat(item.rejected_qty) || 0;
      const previously_returned = parseFloat(item.previously_returned_qty) || 0;
      const available_qty = parseFloat(item.available_return_qty ?? item.available_qty) || Math.max(0, purchased_qty - previously_returned);
      const reason = item.reason || item.return_reason || formData.remarks || 'Returned to supplier';
      const itemPurchaseId = item.purchase_id || purchaseId || null;

      await db.run(`
        INSERT INTO purchase_return_items (
          purchase_return_id, lot_no, item_name, item_id, weight, qty, total_wt, rate, disc_percent, tax_percent, amount,
          purchase_id, purchased_qty, accepted_qty, rejected_qty, previously_returned_qty, available_qty,
          iqr_no, qc_no, reason, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseReturnId, lot_no, item_name, item_id, weight, qty, total_wt,
        rate, disc_percent, tax_percent, amount,
        itemPurchaseId, purchased_qty, accepted_qty, rejected_qty, previously_returned, available_qty,
        item.iqr_no || formData.iqrNo || null,
        item.qc_no || formData.qcNo || null,
        reason,
        returnSource
      ]);

      // 4. Create Stock Transaction for the return
      try {
        await db.run(`
          INSERT INTO stock (
            date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Purchase Return', ?, ?, 'Active')
        `, [
          formData.date,
          item_id,
          item_name,
          lot_no,
          -Math.abs(qty),
          -Math.abs(total_wt),
          rate,
          -Math.abs(amount),
          purchaseReturnId,
          formData.godown || 'Main Godown'
        ]);
      } catch (stkErr) {
        console.warn('Note: Could not insert stock record for return:', stkErr.message);
      }

      // 5. Update stock_lots: reduce remaining_quantity and update lot status
      if (lot_no) {
        try {
          const sLotRes = await db.query('SELECT remaining_quantity, quantity FROM stock_lots WHERE lot_no = ? LIMIT 1', [lot_no]);
          if (sLotRes.rows && sLotRes.rows.length > 0) {
            const currentRem = parseFloat(sLotRes.rows[0].remaining_quantity) || 0;
            const newRem = Math.max(0, currentRem - qty);
            const isFullReturn = newRem <= 0.001;

            await db.run(`
              UPDATE stock_lots 
              SET remaining_quantity = ?, 
                  unloading_status = CASE WHEN ? THEN 'RETURNED' ELSE unloading_status END,
                  qc_status = CASE WHEN ? THEN 'RETURNED' ELSE qc_status END
              WHERE lot_no = ?
            `, [newRem, isFullReturn, isFullReturn, lot_no]);
          }

          await db.run(`UPDATE vehicle_movements SET status = 'RETURNED', operation_type = 'RETURN', gate_out_time = datetime('now', 'localtime') WHERE UPPER(lot_no) = UPPER(?)`, [lot_no]);
        } catch (e) {
          console.error('Error auto-syncing return status on purchase return insert:', e);
        }
      }
    }

    // 6. Insert purchase return deductions if present
    const dedList = deductions || req.body.selectedDeductions || [];
    if (Array.isArray(dedList)) {
      for (const d of dedList) {
        try {
          await db.run(`
            INSERT INTO purchase_return_deductions (
              purchase_return_id, deduction_id, deduction_name, type, calculation_type, percentage, amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            purchaseReturnId,
            d.deduction_id || d.id || null,
            d.name || d.deduction_name || '',
            d.type || 'LESS',
            d.calculation_type || d.calc_type || 'Percentage',
            parseFloat(d.percent ?? d.percentage ?? 0) || 0,
            parseFloat(d.amount) || 0
          ]);
        } catch (e) {
          console.error('Error inserting purchase_return_deduction:', e);
        }
      }
    }

    // 7. Auto-create Debit Note / Purchase Return voucher in Financial Ledger
    try {
      const return_inv_no = formData.returnInvNo || formData.return_inv_no || `PR-${purchaseReturnId}`;
      const s_no = formData.sNo || formData.s_no || purchaseReturnId;
      const base_amount = parseFloat(totals?.baseAmount ?? totals?.base_amount ?? totals?.totalAmount ?? 0);
      const tax_amount = parseFloat(totals?.taxAmount ?? totals?.tax_amount ?? totals?.vat ?? 0);
      const disc_amount = parseFloat(totals?.discAmount ?? totals?.disc_amount ?? 0);
      const net_amount = parseFloat(totals?.netAmount ?? totals?.net_amount ?? totals?.grandTotal ?? 0);
      const grand_total = parseFloat(totals?.grandTotal ?? totals?.grand_total ?? totals?.netAmount ?? 0);

      await createPurchaseReturnVoucherChain({
        supplier: formData.supplier,
        date: formData.date,
        returnInvNo: return_inv_no,
        sNo: s_no,
        purchaseReturnId: purchaseReturnId,
        baseAmount: base_amount,
        taxAmount: tax_amount,
        discAmount: disc_amount,
        netAmount: net_amount,
        grandTotal: grand_total,
        narration: formData.remarks || `Purchase Return #${return_inv_no}`
      });
    } catch (ledgerErr) {
      console.error('Error generating purchase return ledger voucher:', ledgerErr);
    }

    // 8. Rebuild stock ledger to synchronize stock tables immediately
    try {
      await rebuildStockLedger();
    } catch (rbErr) {
      console.warn('Notice rebuilding stock ledger on purchase return save:', rbErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Purchase return saved successfully!',
      id: purchaseReturnId
    });
  } catch (error) {
    console.error('Error saving purchase return:', error);
    res.status(500).json({ success: false, message: 'Error saving purchase return: ' + error.message });
  }
});

// PUT update purchase return
router.put('/:id', async (req, res) => {
  try {
    await ensureReturnSchema();
    const { formData, items, totals } = req.body;
    const purchaseReturnId = req.params.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item must be included in the purchase return.' });
    }

    const purchaseId = formData.purchaseId || formData.purchase_id || null;

    // Strict Over-Return Validation
    const validation = await validateReturnQuantities(items, purchaseId, purchaseReturnId);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const auto_wages = parseFloat(totals?.deductions?.autoWages ?? totals?.auto_wages) || 0;
    const vat_percent = parseFloat(totals?.deductions?.vatPercent ?? totals?.vat_percent) || 0;
    const vat = parseFloat(totals?.deductions?.vat ?? totals?.vat) || 0;

    const returnSource = formData.returnMethod === 'QC_IQR' ? 'QC_REJECTION' : (formData.source || 'MANUAL');

    // Update purchase return
    await db.run(`
      UPDATE purchase_returns SET
        s_no = ?, date = ?, return_inv_no = ?, supplier = ?, pay_type = ?,
        inv_date = ?, type = ?, address = ?, tax_type = ?, godown = ?,
        remarks = ?, total_qty = ?, total_weight = ?, total_amount = ?,
        base_amount = ?, disc_amount = ?, tax_amount = ?, net_amount = ?,
        auto_wages = ?, vat_percent = ?, vat = ?, grand_total = ?,
        source = ?, purchase_id = ?, purchase_inv_no = ?, po_no = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      formData.sNo ?? formData.s_no, 
      formData.date, 
      formData.returnInvNo ?? formData.return_inv_no, 
      formData.supplier, 
      formData.payType ?? formData.pay_type ?? 'Credit',
      formData.invDate ?? formData.inv_date, 
      formData.type ?? 'Urad', 
      formData.address ?? '', 
      formData.taxType ?? formData.tax_type ?? 'Exclusive', 
      formData.godown ?? 'Main Godown',
      formData.remarks ?? '', 
      totals.totalQty ?? totals.total_qty ?? 0, 
      totals.totalWeight ?? totals.total_weight ?? 0, 
      totals.totalAmount ?? totals.total_amount ?? 0,
      totals.baseAmount ?? totals.base_amount ?? 0, 
      totals.discAmount ?? totals.disc_amount ?? 0, 
      totals.taxAmount ?? totals.tax_amount ?? 0, 
      totals.netAmount ?? totals.net_amount ?? 0,
      auto_wages, 
      vat_percent, 
      vat,
      totals.grandTotal ?? totals.grand_total ?? 0, 
      returnSource,
      purchaseId ? String(purchaseId) : null,
      formData.purchaseInvNo || formData.returnInvNo || null,
      formData.poNo || null,
      purchaseReturnId
    ]);

    // Delete existing items & deductions & reverse stock
    await db.run('DELETE FROM purchase_return_items WHERE purchase_return_id = ?', [purchaseReturnId]);
    await db.run('DELETE FROM purchase_return_deductions WHERE purchase_return_id = ?', [purchaseReturnId]);
    await db.run("DELETE FROM stock WHERE reference_id = ? AND type = 'Purchase Return'", [purchaseReturnId]);

    // Insert updated items
    for (const item of items) {
      const lot_no = item.lot_no ?? item.lotNo ?? '';
      const item_name = item.item_name ?? item.itemName ?? '';
      const item_id = item.item_id ?? null;
      const weight = parseFloat(item.weight) || 0;
      const qty = parseFloat(item.qty) || 0;
      const total_wt = parseFloat(item.total_wt ?? item.totalWt ?? item.total_weight) || (weight * qty);
      const rate = parseFloat(item.rate) || 0;
      const disc_percent = parseFloat(item.disc_percent ?? item.disc ?? item.discountPercent) || 0;
      const tax_percent = parseFloat(item.tax_percent ?? item.tax ?? item.taxPercent) || 0;
      const amount = parseFloat(item.amount) || 0;

      const purchased_qty = parseFloat(item.purchased_qty) || qty;
      const accepted_qty = parseFloat(item.accepted_qty) || 0;
      const rejected_qty = parseFloat(item.rejected_qty) || 0;
      const previously_returned = parseFloat(item.previously_returned_qty) || 0;
      const available_qty = parseFloat(item.available_return_qty ?? item.available_qty) || Math.max(0, purchased_qty - previously_returned);
      const reason = item.reason || item.return_reason || formData.remarks || 'Returned to supplier';
      const itemPurchaseId = item.purchase_id || purchaseId || null;

      await db.run(`
        INSERT INTO purchase_return_items (
          purchase_return_id, lot_no, item_name, item_id, weight, qty, total_wt, rate, disc_percent, tax_percent, amount,
          purchase_id, purchased_qty, accepted_qty, rejected_qty, previously_returned_qty, available_qty,
          iqr_no, qc_no, reason, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseReturnId, lot_no, item_name, item_id, weight, qty, total_wt,
        rate, disc_percent, tax_percent, amount,
        itemPurchaseId, purchased_qty, accepted_qty, rejected_qty, previously_returned, available_qty,
        item.iqr_no || formData.iqrNo || null,
        item.qc_no || formData.qcNo || null,
        reason,
        returnSource
      ]);

      // Re-create stock record
      try {
        await db.run(`
          INSERT INTO stock (
            date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Purchase Return', ?, ?, 'Active')
        `, [
          formData.date,
          item_id,
          item_name,
          lot_no,
          -Math.abs(qty),
          -Math.abs(total_wt),
          rate,
          -Math.abs(amount),
          purchaseReturnId,
          formData.godown || 'Main Godown'
        ]);
      } catch (stkErr) {}

      // Re-sync lot status
      if (lot_no) {
        try {
          await db.run(`UPDATE stock_lots SET unloading_status = 'RETURNED', qc_status = 'REJECTED' WHERE lot_no = ?`, [lot_no]);
        } catch (e) {}
      }
    }

    // Re-insert purchase return deductions if present
    const dedList = req.body.deductions || req.body.selectedDeductions || [];
    if (Array.isArray(dedList)) {
      for (const d of dedList) {
        try {
          await db.run(`
            INSERT INTO purchase_return_deductions (
              purchase_return_id, deduction_id, deduction_name, type, calculation_type, percentage, amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            purchaseReturnId,
            d.deduction_id || d.id || null,
            d.name || d.deduction_name || '',
            d.type || 'LESS',
            d.calculation_type || d.calc_type || 'Percentage',
            parseFloat(d.percent ?? d.percentage ?? 0) || 0,
            parseFloat(d.amount) || 0
          ]);
        } catch (e) {
          console.error('Error re-inserting purchase_return_deduction:', e);
        }
      }
    }

    // Re-create Debit Note / Purchase Return voucher in Financial Ledger
    try {
      await createPurchaseReturnVoucherChain({
        supplier: formData.supplier,
        date: formData.date,
        returnInvNo: formData.returnInvNo || formData.return_inv_no || formData.sNo,
        sNo: formData.sNo || formData.s_no,
        purchaseReturnId: purchaseReturnId,
        baseAmount: parseFloat(totals?.baseAmount ?? totals?.base_amount ?? totals?.totalAmount ?? 0),
        taxAmount: parseFloat(totals?.taxAmount ?? totals?.tax_amount ?? totals?.vat ?? 0),
        discAmount: parseFloat(totals?.discAmount ?? totals?.disc_amount ?? 0),
        netAmount: parseFloat(totals?.netAmount ?? totals?.net_amount ?? totals?.grandTotal ?? 0),
        grandTotal: parseFloat(totals?.grandTotal ?? totals?.grand_total ?? totals?.netAmount ?? 0),
        narration: formData.remarks || `Purchase Return #${formData.returnInvNo || purchaseReturnId}`
      });
    } catch (ledgerErr) {
      console.error('Error updating purchase return ledger voucher:', ledgerErr);
    }

    // Re-sync complete stock ledger
    try {
      await rebuildStockLedger();
    } catch (rbErr) {
      console.warn('Notice rebuilding stock ledger on purchase return update:', rbErr.message);
    }

    res.json({ success: true, message: 'Purchase return updated successfully!' });
  } catch (error) {
    console.error('Error updating purchase return:', error);
    res.status(500).json({ success: false, message: 'Error updating purchase return: ' + error.message });
  }
});

// DELETE purchase return
router.delete('/:id', async (req, res) => {
  try {
    const returnId = req.params.id;
    try {
      await deletePurchaseReturnVoucherChain(returnId);
    } catch (ledgerErr) {
      console.error('Error deleting purchase return ledger voucher:', ledgerErr);
    }
    await db.run("DELETE FROM stock WHERE reference_id = ? AND type = 'Purchase Return'", [returnId]);
    await db.run('DELETE FROM purchase_return_items WHERE purchase_return_id = ?', [returnId]);
    await db.run('DELETE FROM purchase_return_deductions WHERE purchase_return_id = ?', [returnId]);
    const result = await db.run('DELETE FROM purchase_returns WHERE id = ?', [returnId]);
    
    // Re-sync complete stock ledger
    try {
      await rebuildStockLedger();
    } catch (rbErr) {
      console.warn('Notice rebuilding stock ledger on purchase return delete:', rbErr.message);
    }

    if (result.changes > 0) {
      res.json({ success: true, message: 'Purchase return deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Purchase return not found' });
    }
  } catch (error) {
    console.error('Error deleting purchase return:', error);
    res.status(500).json({ success: false, message: 'Error deleting purchase return: ' + error.message });
  }
});

module.exports = router;
