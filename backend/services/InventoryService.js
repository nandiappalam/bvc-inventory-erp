const db = require('../config/database');
const { ensureStockRegisterSchema } = require('./StockRegisterSchema');
const { resolveCategory, matchesCategoryFilter } = require('./CategoryResolverService');
const { resolveFinancialYear, normalizeIsoDate } = require('./FinancialYearResolver');
const {
  buildStockIdentityKey,
  buildPostingKey,
  normalizeBagBreakdown,
  round3
} = require('./StockIdentityHelper');
const { resolveLotGenealogy } = require('./LotService');
const { loadPartyDirectory, resolvePartyFromDirectory } = require('./PartyNameResolver');

function requireCompanyId(companyId) {
  const cId = parseInt(companyId, 10);
  if (!Number.isSafeInteger(cId) || cId <= 0) {
    throw new Error(`Explicit positive companyId is required by InventoryService (received: ${companyId})`);
  }
  return cId;
}

function normalizeTimeStr(timeInput, createdAtFallback = null) {
  if (timeInput && /^\d{1,2}:\d{2}(:\d{2})?$/.test(String(timeInput).trim())) {
    const parts = String(timeInput).trim().split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${(parts[2] || '00').padStart(2, '0')}`;
  }
  if (createdAtFallback) {
    const m = String(createdAtFallback).match(/(\d{2}:\d{2}:\d{2})/);
    if (m) return m[1];
  }
  return '12:00:00';
}

function buildNavRoute(sourceModule, sourceId, sourceRefNo = null) {
  const m = String(sourceModule || '').toUpperCase();
  const id = sourceId !== undefined && sourceId !== null && String(sourceId).trim() !== '' && Number(sourceId) > 0
    ? Number(sourceId)
    : null;
  const ref = sourceRefNo !== undefined && sourceRefNo !== null && String(sourceRefNo).trim() !== ''
    ? String(sourceRefNo).trim()
    : '';

  const withHighlight = (basePath) => {
    if (id) {
      return `${basePath}?highlightId=${id}`;
    }
    if (ref) {
      return `${basePath}?highlightRef=${encodeURIComponent(ref)}`;
    }
    return basePath;
  };

  switch (m) {
    case 'OPEN':
    case 'OPENING':
      return withHighlight('/entry/open-display');
    case 'PURCHASE':
    case 'QC':
    case 'UNLOADING':
      return withHighlight('/entry/purchase-display');
    case 'PURCHASE_RETURN':
      return withHighlight('/entry/purchase-return-display');
    case 'GRAIN':
    case 'GRAINS':
    case 'GRAIN_INPUT':
    case 'GRAIN_OUTPUT':
    case 'GRAIN_WASTAGE':
      return withHighlight('/entry/grind-display');
    case 'HAND_SORTING':
      return withHighlight('/hand-sorting');
    case 'PACKING':
    case 'PACKING_FROM':
    case 'PACKING_TO':
    case 'PACKING_MATERIAL':
      return withHighlight('/entry/packing-display');
    case 'WEIGHT_CONVERSION':
    case 'WEIGHT_CONVERSION_FROM':
    case 'WEIGHT_CONVERSION_TO':
      return withHighlight('/entry/weight-conversion-display');
    case 'FLOUR_OUT':
      return withHighlight('/entry/flour-out-display');
    case 'FLOUR_OUT_RETURN':
      return withHighlight('/entry/flour-out-return-display');
    case 'PAPAD_IN':
      return withHighlight('/entry/papad-in-display');
    case 'PAPAD_RETURN':
      return withHighlight('/entry/papad-return-display');
    case 'OUTPASS':
      return withHighlight('/entry/outpass-display');
    case 'INPASS':
      return withHighlight('/entry/inpass-display');
    case 'ITEM_TRANSFER':
      return withHighlight('/inventory/item-transfer/display');
    case 'GODOWN_TRANSFER':
      return withHighlight('/entry/godown-transfer-display');
    case 'COLD_STORAGE':
      return withHighlight('/cold-storage/vouchers');
    case 'SALES':
      return withHighlight('/entry/sales-display');
    case 'SALES_ORDER':
      return withHighlight('/entry/sales-order-display');
    case 'SALES_EXPORT_ORDER':
      return withHighlight('/entry/sales-export-order-display');
    case 'SALES_RETURN':
      return withHighlight('/entry/sales-return-display');
    case 'STOCK_ADJUST':
      return withHighlight('/entry/stock-adjust-display');
    case 'DAILY_CLOSING':
      return '/reports/category/inventory?type=closing';
    default:
      return '/reports/category/inventory?type=current';
  }
}

/**
 * Appends a single idempotent stock_movement record within the caller's company scope.
 * Never mutates historical stock/stock_lots destructively.
 */
async function postMovement(companyId, payload = {}, conn = null) {
  const cId = requireCompanyId(companyId);
  const runner = conn || db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);

  const qty = Math.abs(round3(payload.qty || 0));
  const weight = Math.abs(round3(payload.weight || 0));
  if (qty <= 0 && weight <= 0 && payload.allowZero !== true) {
    return { skipped: true, reason: 'ZERO_QTY_AND_WEIGHT' };
  }

  const direction = String(payload.direction || 'IN').toUpperCase() === 'OUT' ? 'OUT' : 'IN';
  const movementDate = normalizeIsoDate(payload.movementDate || payload.date);
  const movementTime = normalizeTimeStr(payload.movementTime || payload.time, payload.createdAt);
  const movementTimestamp = `${movementDate} ${movementTime}`;
  const sourceModule = String(payload.sourceModule || 'MANUAL').toUpperCase();
  const sourceId = payload.sourceId !== undefined && payload.sourceId !== null ? Number(payload.sourceId) : null;
  const sourceLineId = payload.sourceLineId !== undefined && payload.sourceLineId !== null ? Number(payload.sourceLineId) : 0;
  const movementType = String(payload.movementType || (direction === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT')).toUpperCase();

  const postingKey = payload.postingKey || buildPostingKey({
    companyId: cId,
    sourceModule,
    sourceId: sourceId || 0,
    sourceLineId,
    direction,
    movementType,
    role: payload.role || 'MAIN'
  });

  // Duplicate prevention on postingKey
  const existing = await runner.get(
    `SELECT id, identity_key FROM stock_movements
     WHERE posting_key = ? AND COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0
     LIMIT 1`,
    [postingKey]
  );
  if (existing) {
    return { skipped: true, duplicate: true, id: existing.id, postingKey, identityKey: existing.identity_key };
  }

  const fyInfo = payload.financialYear
    ? { financialYear: payload.financialYear }
    : await resolveFinancialYear(cId, { date: movementDate }, runner);

  const catInfo = await resolveCategory(cId, {
    itemId: payload.itemId,
    itemCode: payload.itemCode,
    itemName: payload.itemName,
    itemGroup: payload.itemGroup,
    itemType: payload.itemType,
    explicitCategory: payload.stockCategory,
    sourceModule: payload.categoryHintModule || sourceModule,
    lineType: payload.lineType,
    lotNo: payload.lotNo,
    godownId: payload.godownId,
    godownName: payload.godownName,
    explicitStorageType: payload.storageType
  }, runner);

  const resolvedItemId = payload.itemId || catInfo.itemMeta?.id || null;
  const resolvedItemCode = payload.itemCode || catInfo.itemMeta?.item_code || null;
  const resolvedItemName = String(payload.itemName || catInfo.itemMeta?.item_name || '').trim() || 'Unknown Item';
  const unitWeight = round3(payload.unitWeight || catInfo.itemMeta?.weight || (qty > 0 && weight > 0 ? weight / qty : 0));

  const resolvedGodownId = payload.godownId || null;
  const resolvedGodownName = String(payload.godownName || 'Main Godown').trim();

  const genealogy = await resolveLotGenealogy(cId, {
    lotNo: payload.lotNo,
    itemName: resolvedItemName,
    parentLotNo: payload.parentLotNo,
    stockCategory: catInfo.stockCategory
  }, runner);

  const lotNo = String(payload.lotNo || genealogy.fgLotNo || genealogy.rmLotNo || '').trim();
  const rmLotNo = String(payload.rmLotNo || genealogy.rmLotNo || '').trim();
  const fgLotNo = String(payload.fgLotNo || genealogy.fgLotNo || '').trim();
  const parentLotNo = String(payload.parentLotNo || genealogy.parentLotNo || '').trim();
  const rawSupplierName = String(payload.supplierName || genealogy.supplierName || '').trim();
  const supplierInvoiceNo = String(payload.supplierInvoiceNo || genealogy.supplierInvoiceNo || '').trim();
  const partyDir = await loadPartyDirectory(cId, runner);
  const resolvedPartyMeta = resolvePartyFromDirectory(partyDir, {
    supplierName: rawSupplierName,
    supplierId: payload.supplierId || null,
    partyName: payload.partyName || '',
    sourceModule
  });
  const supplierId = resolvedPartyMeta.supplierId;
  const supplierName = resolvedPartyMeta.supplierName;
  const resolvedPartyName = resolvedPartyMeta.partyName || supplierName || null;

  const bagBreakdownArr = normalizeBagBreakdown(
    payload.bagBreakdown || payload.bag_breakdown_json || genealogy.bagBreakdown,
    qty,
    unitWeight,
    weight
  );
  const bagBreakdownJson = bagBreakdownArr.length > 0 ? JSON.stringify(bagBreakdownArr) : null;

  const isPhysicalStock = payload.isPhysicalStock !== undefined
    ? (payload.isPhysicalStock ? 1 : 0)
    : (catInfo.wastageSubtype === 'PROCESS_LOSS' ? 0 : 1);

  const identityKey = buildStockIdentityKey({
    companyId: cId,
    financialYear: fyInfo.financialYear,
    stockCategory: catInfo.stockCategory,
    storageType: catInfo.storageType,
    itemId: resolvedItemId,
    itemName: resolvedItemName,
    lotNo,
    rmLotNo,
    fgLotNo,
    godownId: resolvedGodownId,
    godownName: resolvedGodownName
  });

  const navRoute = payload.navRoute || buildNavRoute(sourceModule, sourceId, payload.sourceRefNo);

  const ins = await runner.run(
    `INSERT INTO stock_movements (
      company_id, financial_year, movement_date, movement_time, movement_timestamp,
      identity_key, posting_key, stock_category, storage_type, wastage_subtype,
      item_id, item_code, item_name, uom, unit_weight, bag_breakdown_json,
      lot_no, rm_lot_no, fg_lot_no, parent_lot_no,
      godown_id, godown_name, supplier_id, supplier_name, supplier_invoice_no, party_name,
      direction, movement_type, qty, weight, rate, amount,
      source_module, source_table, source_id, source_line_id, source_ref_no, nav_route,
      stock_status, is_physical_stock, is_reversed, is_reversal, remarks, created_by, approved_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    [
      cId,
      fyInfo.financialYear,
      movementDate,
      movementTime,
      movementTimestamp,
      identityKey,
      postingKey,
      catInfo.stockCategory,
      catInfo.storageType,
      catInfo.wastageSubtype || null,
      resolvedItemId,
      resolvedItemCode,
      resolvedItemName,
      payload.uom || catInfo.itemMeta?.unit || 'Bags',
      unitWeight,
      bagBreakdownJson,
      lotNo,
      rmLotNo,
      fgLotNo,
      parentLotNo,
      resolvedGodownId,
      resolvedGodownName,
      supplierId,
      supplierName,
      supplierInvoiceNo,
      resolvedPartyName,
      direction,
      movementType,
      qty,
      weight,
      round3(payload.rate || 0),
      round3(payload.amount || 0),
      sourceModule,
      payload.sourceTable || null,
      sourceId,
      sourceLineId,
      payload.sourceRefNo || (sourceId ? `${sourceModule}-${sourceId}` : ''),
      navRoute,
      payload.stockStatus || (catInfo.storageType === 'Outside Processing' ? 'Outside Processing' : 'Available'),
      isPhysicalStock,
      payload.remarks || '',
      payload.createdBy || 'admin',
      payload.approvedBy || null
    ]
  );

  return {
    id: ins.lastInsertRowid || null,
    postingKey,
    identityKey,
    stockCategory: catInfo.stockCategory,
    storageType: catInfo.storageType,
    isPhysicalStock,
    qty,
    weight
  };
}

async function reverseDocumentMovements(companyId, { sourceModule, sourceId, reason = 'Reversed / Edited / Cancelled', performedBy = 'admin', conn = null } = {}) {
  const cId = requireCompanyId(companyId);
  if (!sourceModule || !sourceId) return { reversedCount: 0 };
  const runner = conn || db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);

  const modUpper = String(sourceModule).toUpperCase();
  const sId = Number(sourceId);
  const activeRows = await runner.all(
    `SELECT * FROM stock_movements
     WHERE company_id = ? AND source_module = ? AND source_id = ?
       AND COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0
     ORDER BY id ASC`,
    [cId, modUpper, sId]
  );

  let reversedCount = 0;
  for (const row of activeRows) {
    const revDirection = row.direction === 'IN' ? 'OUT' : 'IN';
    const revPostingKey = `${row.posting_key || `ID:${row.id}`}:REV:${Date.now()}:${row.id}`;
    await runner.run(
      `UPDATE stock_movements SET is_reversed = 1, reversal_reason = ? WHERE id = ?`,
      [reason, row.id]
    );
    await runner.run(
      `INSERT INTO stock_movements (
        company_id, financial_year, movement_date, movement_time, movement_timestamp,
        identity_key, posting_key, stock_category, storage_type, wastage_subtype,
        item_id, item_code, item_name, uom, unit_weight, bag_breakdown_json,
        lot_no, rm_lot_no, fg_lot_no, parent_lot_no,
        godown_id, godown_name, supplier_id, supplier_name, supplier_invoice_no, party_name,
        direction, movement_type, qty, weight, rate, amount,
        source_module, source_table, source_id, source_line_id, source_ref_no, nav_route,
        stock_status, is_physical_stock, is_reversed, is_reversal, reversed_movement_id, reversal_reason, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REVERSAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)`,
      [
        cId, row.financial_year, row.movement_date, row.movement_time, row.movement_timestamp,
        row.identity_key, revPostingKey, row.stock_category, row.storage_type, row.wastage_subtype,
        row.item_id, row.item_code, row.item_name, row.uom, row.unit_weight, row.bag_breakdown_json,
        row.lot_no, row.rm_lot_no, row.fg_lot_no, row.parent_lot_no,
        row.godown_id, row.godown_name, row.supplier_id, row.supplier_name, row.supplier_invoice_no, row.party_name,
        revDirection, row.qty, row.weight, row.rate, row.amount,
        row.source_module, row.source_table, row.source_id, row.source_line_id, row.source_ref_no, row.nav_route,
        row.stock_status, row.is_physical_stock, row.id, reason, `Reversal of #${row.id}: ${reason}`, performedBy
      ]
    );
    reversedCount++;
  }

  return { reversedCount };
}

async function postDocumentMovements(companyId, { sourceModule, sourceId, movements = [], conn = null } = {}) {
  const cId = requireCompanyId(companyId);
  const runner = conn || db.forCompany(cId);
  const results = [];
  for (let i = 0; i < movements.length; i++) {
    const m = movements[i];
    const res = await postMovement(cId, {
      ...m,
      sourceModule: m.sourceModule || sourceModule,
      sourceId: m.sourceId !== undefined ? m.sourceId : sourceId,
      sourceLineId: m.sourceLineId !== undefined ? m.sourceLineId : (i + 1)
    }, runner);
    results.push(res);
  }
  return results;
}

async function repostDocumentMovements(companyId, { sourceModule, sourceId, movements = [], reason = 'Document updated', performedBy = 'admin', conn = null } = {}) {
  const cId = requireCompanyId(companyId);
  const execute = async (txRunner) => {
    await reverseDocumentMovements(cId, { sourceModule, sourceId, reason, performedBy, conn: txRunner });
    const posted = await postDocumentMovements(cId, { sourceModule, sourceId, movements, conn: txRunner });
    return { reversed: true, posted };
  };
  if (conn) return execute(conn);
  return db.forCompany(cId).withTransaction(async (tx) => execute(tx));
}

/**
 * Computes active non-physical reservations from open Work Orders, Sales Orders, and Export Orders.
 * Never deducts physical stock. Supports cutoffDate.
 */
async function computeActiveReservations(companyId, { cutoffDate = null } = {}, conn = null) {
  const cId = requireCompanyId(companyId);
  const runner = conn || db.forCompany(cId);
  const reservations = [];

  // 1. Open Work Orders
  try {
    const woSql = `
      SELECT wo.id as doc_id, wo.work_order_no as doc_no, wo.date, wo.status,
             woi.item_id, woi.item_name, woi.lot_no, woi.input_qty as qty, woi.kgs as weight, woi.weight as unit_wt
      FROM work_orders wo
      JOIN work_order_items woi ON woi.work_order_id = wo.id
      WHERE UPPER(COALESCE(wo.status, 'ISSUED')) NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED', 'DONE')
      ${cutoffDate ? 'AND wo.date <= ?' : ''}
    `;
    const woRows = await runner.all(woSql, cutoffDate ? [cutoffDate] : []);
    for (const r of (woRows || [])) {
      reservations.push({
        sourceModule: 'WORK_ORDER',
        docId: r.doc_id,
        docNo: r.doc_no || `WO-${r.doc_id}`,
        date: r.date,
        itemId: r.item_id || null,
        itemName: r.item_name || '',
        lotNo: r.lot_no || '',
        godownId: null,
        godownName: '',
        qty: round3(r.qty || 0),
        weight: round3(r.weight || ((r.qty || 0) * (r.unit_wt || 0)))
      });
    }
  } catch (_) {}

  // 2. Open Sales Orders (sales where is_order = 1)
  try {
    const soSql = `
      SELECT s.id as doc_id, s.s_no as doc_no, s.date, s.godown_from_id as godown_id,
             si.item_name, si.lot_no, si.qty, si.total_wt as weight, si.weight as unit_wt
      FROM sales s
      JOIN sales_items si ON si.sales_id = s.id
      WHERE COALESCE(s.is_order, 0) = 1
      ${cutoffDate ? 'AND s.date <= ?' : ''}
    `;
    const soRows = await runner.all(soSql, cutoffDate ? [cutoffDate] : []);
    for (const r of (soRows || [])) {
      reservations.push({
        sourceModule: 'SALES_ORDER',
        docId: r.doc_id,
        docNo: `SO-${r.doc_no || r.doc_id}`,
        date: r.date,
        itemId: null,
        itemName: r.item_name || '',
        lotNo: r.lot_no || '',
        godownId: r.godown_id || null,
        godownName: '',
        qty: round3(r.qty || 0),
        weight: round3(r.weight || ((r.qty || 0) * (r.unit_wt || 0)))
      });
    }
  } catch (_) {}

  // 3. Open Sales Export Orders (where is_order = 1)
  try {
    const eoSql = `
      SELECT seo.id as doc_id, seo.bill_no as doc_no, seo.date,
             seoi.description as item_name, seoi.lot_no, seoi.qty, seoi.qty_in_kg as weight
      FROM sales_export_orders seo
      JOIN sales_export_order_items seoi ON seoi.sales_export_order_id = seo.id
      WHERE COALESCE(seo.is_order, 0) = 1
      ${cutoffDate ? 'AND seo.date <= ?' : ''}
    `;
    const eoRows = await runner.all(eoSql, cutoffDate ? [cutoffDate] : []);
    for (const r of (eoRows || [])) {
      reservations.push({
        sourceModule: 'EXPORT_ORDER',
        docId: r.doc_id,
        docNo: r.doc_no || `EXP-ORD-${r.doc_id}`,
        date: r.date,
        itemId: null,
        itemName: r.item_name || '',
        lotNo: r.lot_no || '',
        godownId: null,
        godownName: '',
        qty: round3(r.qty || 0),
        weight: round3(r.weight || 0)
      });
    }
  } catch (_) {}

  return reservations;
}

// Legacy compatibility stubs preserved
async function reserveStock({ lotNo, quantity = 0 }) {
  return { lotNo, reserved: Number(quantity || 0) };
}
async function releaseStock({ lotNo, quantity = 0 }) {
  return { lotNo, released: Number(quantity || 0) };
}
async function consumeStock({ lotNo, quantity = 0 }) {
  return { lotNo, consumed: Number(quantity || 0) };
}

module.exports = {
  postMovement,
  postDocumentMovements,
  reverseDocumentMovements,
  repostDocumentMovements,
  computeActiveReservations,
  buildNavRoute,
  matchesCategoryFilter,
  reserveStock,
  releaseStock,
  consumeStock
};
