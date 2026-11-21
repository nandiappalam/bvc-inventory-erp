const db = require('../config/database');
const { formatBagBreakdown, normalizeBagBreakdown, round3 } = require('./StockIdentityHelper');
const { resolveSupplierName } = require('./PartyNameResolver');

async function generateLot({ prefix = 'LOT', suffix = '' } = {}) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const token = suffix ? `${prefix}${stamp}${suffix}` : `${prefix}${stamp}`;
  return token;
}

/**
 * Resolves supplier name, invoice no, arrival date, RM lot, FG lot, parent lot, and QC status
 * for a given lot number in the specified company database.
 */
async function resolveLotGenealogy(companyId, { lotNo = '', itemName = '', parentLotNo = '', stockCategory = '' } = {}, conn = null) {
  const cId = parseInt(companyId, 10);
  if (!Number.isSafeInteger(cId) || cId <= 0) {
    throw new Error(`Valid companyId required in resolveLotGenealogy (got: ${companyId})`);
  }
  const runner = conn || db.forCompany(cId);
  const lotStr = String(lotNo || '').trim();
  const itemStr = String(itemName || '').trim();
  let rmLotNo = '';
  let fgLotNo = '';
  let resolvedParent = String(parentLotNo || '').trim();
  let supplierName = '';
  let supplierInvoiceNo = '';
  let arrivalDate = '';
  let qcStatus = '';
  let bagBreakdown = null;

  if (!lotStr) {
    return { rmLotNo, fgLotNo, parentLotNo: resolvedParent, supplierName, supplierInvoiceNo, arrivalDate, qcStatus, bagBreakdown };
  }

  // 1. Check stock_lots first (preserving parent_lot_no, qc_status, godown)
  try {
    const sl = await runner.get(
      `SELECT item_name, lot_no, purchase_id, qc_status, approval_status, parent_lot_no, bag_breakdown_json, created_at
       FROM stock_lots
       WHERE LOWER(TRIM(lot_no)) = LOWER(TRIM(?))
       ORDER BY CASE WHEN LOWER(TRIM(item_name)) = LOWER(TRIM(?)) THEN 0 ELSE 1 END, id ASC
       LIMIT 1`,
      [lotStr, itemStr]
    );
    if (sl) {
      qcStatus = sl.qc_status || sl.approval_status || '';
      if (!resolvedParent && sl.parent_lot_no) resolvedParent = String(sl.parent_lot_no).trim();
      if (sl.bag_breakdown_json) bagBreakdown = sl.bag_breakdown_json;
      if (sl.purchase_id) {
        const pur = await runner.get(`
          SELECT p.date, p.inv_no, COALESCE(NULLIF(TRIM(sm.print_name), ''), NULLIF(TRIM(sm.name), ''), p.supplier) as supplier_name
          FROM purchases p
          LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR LOWER(TRIM(sm.name)) = LOWER(TRIM(p.supplier)) OR LOWER(TRIM(sm.print_name)) = LOWER(TRIM(p.supplier)))
          WHERE p.id = ? LIMIT 1
        `, [sl.purchase_id]);
        if (pur) {
          supplierName = pur.supplier_name || supplierName;
          supplierInvoiceNo = pur.inv_no || supplierInvoiceNo;
          arrivalDate = pur.date || arrivalDate;
        }
      }
    }
  } catch (_) {}

  // 2. Check purchase_items directly for lot_no -> RM lot & supplier
  if (!supplierName || !supplierInvoiceNo) {
    try {
      const pi = await runner.get(
        `SELECT p.date, p.inv_no, pi.lot_no,
                COALESCE(NULLIF(TRIM(sm.print_name), ''), NULLIF(TRIM(sm.name), ''), p.supplier) as supplier_name
         FROM purchase_items pi
         JOIN purchases p ON pi.purchase_id = p.id
         LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR LOWER(TRIM(sm.name)) = LOWER(TRIM(p.supplier)) OR LOWER(TRIM(sm.print_name)) = LOWER(TRIM(p.supplier)))
         WHERE LOWER(TRIM(pi.lot_no)) = LOWER(TRIM(?))
         ORDER BY p.date ASC, pi.id ASC
         LIMIT 1`,
        [lotStr]
      );
      if (pi) {
        supplierName = supplierName || pi.supplier_name || '';
        supplierInvoiceNo = supplierInvoiceNo || pi.inv_no || '';
        arrivalDate = arrivalDate || pi.date || '';
        if (!rmLotNo) rmLotNo = lotStr;
      }
    } catch (_) {}
  }

  // 3. Check Cold Storage items (cold_storage_lot_no -> purchase_lot_no)
  if (!resolvedParent) {
    try {
      const csi = await runner.get(
        `SELECT csi.purchase_lot_no, csi.inward_date, p.inv_no,
                COALESCE(NULLIF(TRIM(sm.print_name), ''), NULLIF(TRIM(sm.name), ''), p.supplier) as supplier_name
         FROM cold_storage_items csi
         LEFT JOIN purchases p ON csi.purchase_id = p.id
         LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR LOWER(TRIM(sm.name)) = LOWER(TRIM(p.supplier)) OR LOWER(TRIM(sm.print_name)) = LOWER(TRIM(p.supplier)))
         WHERE LOWER(TRIM(csi.cold_storage_lot_no)) = LOWER(TRIM(?))
         ORDER BY csi.id ASC LIMIT 1`,
        [lotStr]
      );
      if (csi && csi.purchase_lot_no) {
        resolvedParent = String(csi.purchase_lot_no).trim();
        supplierName = supplierName || csi.supplier_name || '';
        supplierInvoiceNo = supplierInvoiceNo || csi.inv_no || '';
        arrivalDate = arrivalDate || csi.inward_date || '';
      }
    } catch (_) {}
  }

  // 4. Check Grains output -> find parent RM input lot
  if (!resolvedParent) {
    try {
      const go = await runner.get(
        `SELECT gi.lot_no as input_lot, gi.supplier_name, g.date
         FROM grain_output_items go
         JOIN grains g ON go.grain_id = g.id
         LEFT JOIN grain_input_items gi ON gi.grain_id = g.id
         WHERE LOWER(TRIM(go.lot_no)) = LOWER(TRIM(?))
         ORDER BY go.id ASC LIMIT 1`,
        [lotStr]
      );
      if (go) {
        if (go.input_lot) resolvedParent = String(go.input_lot).trim();
        supplierName = supplierName || go.supplier_name || '';
        arrivalDate = arrivalDate || go.date || '';
        if (!fgLotNo) fgLotNo = lotStr;
      }
    } catch (_) {}
  }

  // 5. Check stock_movements history for this lot if already recorded
  if (!resolvedParent || !supplierName) {
    try {
      const mv = await runner.get(
        `SELECT rm_lot_no, fg_lot_no, parent_lot_no, supplier_name, supplier_invoice_no, movement_date
         FROM stock_movements
         WHERE COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0
           AND (LOWER(TRIM(lot_no)) = LOWER(TRIM(?)) OR LOWER(TRIM(fg_lot_no)) = LOWER(TRIM(?)))
         ORDER BY movement_timestamp ASC, id ASC LIMIT 1`,
        [lotStr, lotStr]
      );
      if (mv) {
        resolvedParent = resolvedParent || mv.parent_lot_no || mv.rm_lot_no || '';
        supplierName = supplierName || mv.supplier_name || '';
        supplierInvoiceNo = supplierInvoiceNo || mv.supplier_invoice_no || '';
        arrivalDate = arrivalDate || mv.movement_date || '';
      }
    } catch (_) {}
  }

  // 6. If parent lot exists and we still miss supplier/invoice, recurse once cleanly (no cycle)
  if (resolvedParent && resolvedParent.toLowerCase() !== lotStr.toLowerCase() && (!supplierName || !supplierInvoiceNo)) {
    try {
      const pPi = await runner.get(
        `SELECT p.date, p.inv_no,
                COALESCE(NULLIF(TRIM(sm.print_name), ''), NULLIF(TRIM(sm.name), ''), p.supplier) as supplier_name
         FROM purchase_items pi
         JOIN purchases p ON pi.purchase_id = p.id
         LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR LOWER(TRIM(sm.name)) = LOWER(TRIM(p.supplier)) OR LOWER(TRIM(sm.print_name)) = LOWER(TRIM(p.supplier)))
         WHERE LOWER(TRIM(pi.lot_no)) = LOWER(TRIM(?))
         ORDER BY p.date ASC LIMIT 1`,
        [resolvedParent]
      );
      if (pPi) {
        supplierName = supplierName || pPi.supplier_name || '';
        supplierInvoiceNo = supplierInvoiceNo || pPi.inv_no || '';
        arrivalDate = arrivalDate || pPi.date || '';
      }
    } catch (_) {}
  }

  // Final normalization pass if supplierName is still numeric ID
  if (supplierName && /^\d+$/.test(String(supplierName).trim())) {
    const resolved = await resolveSupplierName(cId, supplierName, null, runner);
    if (resolved && resolved.name) supplierName = resolved.name;
  }

  // Assign RM Lot No vs FG Lot No cleanly based on category & genealogy
  const catUpper = String(stockCategory || '').toUpperCase();
  if (catUpper === 'FG' || lotStr.toUpperCase().startsWith('FG') || lotStr.toUpperCase().startsWith('PK') || lotStr.toUpperCase().startsWith('WC')) {
    fgLotNo = fgLotNo || lotStr;
    rmLotNo = rmLotNo || (resolvedParent && !resolvedParent.toUpperCase().startsWith('FG') ? resolvedParent : '');
  } else if (catUpper === 'WASTAGE') {
    rmLotNo = rmLotNo || resolvedParent || '';
    fgLotNo = fgLotNo || '';
  } else {
    rmLotNo = rmLotNo || lotStr;
  }

  return {
    rmLotNo,
    fgLotNo,
    parentLotNo: resolvedParent || rmLotNo || '',
    supplierName,
    supplierInvoiceNo,
    arrivalDate,
    qcStatus,
    bagBreakdown
  };
}

async function getLotAvailability(lotNo, companyId = null) {
  if (!companyId) {
    return { lotNo, available: 0, reserved: 0, consumed: 0 };
  }
  const cId = parseInt(companyId, 10);
  const runner = db.forCompany(cId);
  try {
    const mov = await runner.get(
      `SELECT
         COALESCE(SUM(CASE WHEN direction = 'IN' THEN qty ELSE 0 END), 0) as total_in,
         COALESCE(SUM(CASE WHEN direction = 'OUT' THEN qty ELSE 0 END), 0) as total_out,
         COALESCE(SUM(CASE WHEN direction = 'IN' THEN weight ELSE -weight END), 0) as balance_weight
       FROM stock_movements
       WHERE COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0 AND COALESCE(is_physical_stock, 1) = 1
         AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))`,
      [String(lotNo || '')]
    );
    const totalIn = round3(mov?.total_in || 0);
    const totalOut = round3(mov?.total_out || 0);
    const physical = round3(totalIn - totalOut);
    if (totalIn > 0 || totalOut > 0) {
      return {
        lotNo,
        available: physical,
        reserved: 0,
        consumed: totalOut,
        balanceWeight: round3(mov?.balance_weight || 0)
      };
    }
    const sl = await runner.get(
      `SELECT COALESCE(SUM(quantity), 0) as total_qty, COALESCE(SUM(remaining_quantity), 0) as rem_qty
       FROM stock_lots WHERE LOWER(TRIM(lot_no)) = LOWER(TRIM(?))`,
      [String(lotNo || '')]
    );
    return {
      lotNo,
      available: round3(sl?.rem_qty || 0),
      reserved: 0,
      consumed: round3((sl?.total_qty || 0) - (sl?.rem_qty || 0))
    };
  } catch (_) {
    return { lotNo, available: 0, reserved: 0, consumed: 0 };
  }
}

async function createLotRecord(payload = {}) {
  return {
    lotNo: payload.lotNo || payload.lot_no || 'LOT0000',
    ...payload
  };
}

module.exports = {
  generateLot,
  getLotAvailability,
  createLotRecord,
  resolveLotGenealogy,
  formatBagBreakdown,
  normalizeBagBreakdown
};
