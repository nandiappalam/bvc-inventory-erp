const db = require('../config/database');
const { ensureStockRegisterSchema } = require('./StockRegisterSchema');
const { postMovement } = require('./InventoryService');
const { resolveCategory, classifyWastageSubtype } = require('./CategoryResolverService');
const { buildPostingKey, round3 } = require('./StockIdentityHelper');
const { normalizeIsoDate } = require('./FinancialYearResolver');

function requireCompanyId(companyId) {
  const cId = parseInt(companyId, 10);
  if (!Number.isSafeInteger(cId) || cId <= 0) {
    throw new Error(`Valid companyId required in BackfillAndReconciliationService (got: ${companyId})`);
  }
  return cId;
}

async function resolveGodowns(runner) {
  const res = await runner.all(`SELECT id, godown_name, godown_type, storage_location, is_cold_storage FROM godown_master ORDER BY id ASC`);
  const list = res || [];
  const defaultGodown = list.find(g =>
    String(g.godown_type || '').toLowerCase() === 'normal' ||
    String(g.storage_location || '').toLowerCase().includes('inside')
  ) || list[0] || { id: null, godown_name: 'Main Godown' };
  const rmGodown = list.find(g => /raw|\brm\b/i.test(g.godown_name || '')) || defaultGodown;
  const fgGodown = list.find(g => /finish|\bfg\b/i.test(g.godown_name || '')) || defaultGodown;
  const csGodown = list.find(g =>
    Number(g.is_cold_storage || 0) === 1 ||
    /cold/i.test(g.godown_type || '') ||
    /cold|bts/i.test(g.godown_name || '')
  ) || null;

  const findByIdOrName = (idVal, nameVal, fallback = defaultGodown) => {
    const numId = parseInt(idVal, 10);
    if (!Number.isNaN(numId) && numId > 0) {
      const m = list.find(g => Number(g.id) === numId);
      if (m) return m;
    }
    const nm = String(nameVal || '').trim().toLowerCase();
    if (nm) {
      const m = list.find(g => String(g.godown_name || '').trim().toLowerCase() === nm);
      if (m) return m;
    }
    return {
      id: (!Number.isNaN(numId) && numId > 0) ? numId : fallback.id,
      godown_name: String(nameVal || '').trim() || fallback.godown_name
    };
  };

  return { list, defaultGodown, rmGodown, fgGodown, csGodown, findByIdOrName };
}

async function hasTableColumn(runner, companyId, table, column) {
  try {
    if (db.isPostgres) {
      const r = await runner.get(
        `SELECT 1 as ok FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ? LIMIT 1`,
        [`company_${companyId}`, table, column]
      );
      return Boolean(r);
    }
    const cols = await runner.all(`PRAGMA table_info("${table}")`);
    return (cols || []).some(c => String(c.name).toLowerCase() === column.toLowerCase());
  } catch (_) {
    return false;
  }
}

function isDeductionAdjType(val) {
  const t = String(val || '').trim().toLowerCase();
  return (
    t.includes('deduct') ||
    t.includes('reduce') ||
    t.includes('issue') ||
    t.includes('damage') ||
    t.includes('wastage') ||
    t.includes('less') ||
    t === 'out'
  );
}

/**
 * Safely and idempotently backfills append-only stock_movements from all ERP source modules
 * for the specified company. Never deletes or alters legacy `stock` or `stock_lots`.
 */
async function backfillCompanyMovements(companyId, conn = null) {
  const cId = requireCompanyId(companyId);
  const runner = conn || db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);

  const summary = {
    companyId: cId,
    inserted: 0,
    skippedDuplicates: 0,
    byModule: {}
  };

  const track = (mod, res) => {
    if (!summary.byModule[mod]) summary.byModule[mod] = { inserted: 0, skipped: 0 };
    if (res && !res.skipped) {
      summary.inserted++;
      summary.byModule[mod].inserted++;
    } else {
      summary.skippedDuplicates++;
      summary.byModule[mod].skipped++;
    }
  };

  const gdw = await resolveGodowns(runner);

  // QC status cache per lot/purchase
  const qcLotMap = new Map();
  try {
    const lotQcRows = await runner.all(`SELECT lot_no, qc_status, approval_status FROM stock_lots WHERE lot_no IS NOT NULL`);
    for (const r of (lotQcRows || [])) {
      const k = String(r.lot_no || '').trim().toUpperCase();
      if (k) qcLotMap.set(k, String(r.qc_status || r.approval_status || '').toUpperCase());
    }
    const qcInsp = await runner.all(`SELECT rm_lot_no, overall_result FROM qc_inspections WHERE rm_lot_no IS NOT NULL`);
    for (const r of (qcInsp || [])) {
      const k = String(r.rm_lot_no || '').trim().toUpperCase();
      const res = String(r.overall_result || '').toUpperCase();
      if (k && (res.includes('REJECT') || res.includes('HOLD'))) {
        qcLotMap.set(k, res.includes('REJECT') ? 'QC_REJECTED' : 'QC_HOLD');
      }
    }
  } catch (_) {}

  // 1. Opening Stock (`open` + `open_items`)
  try {
    const openRows = await runner.all(`
      SELECT oi.*, o.date, o.s_no, o.type as header_type, o.papad_comp, o.remarks as header_remarks, o.created_at
      FROM open_items oi
      JOIN open o ON oi.open_id = o.id
      ORDER BY o.date ASC, oi.id ASC
    `);
    for (const r of (openRows || [])) {
      if (!r.item_name) continue;
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 0;
      const totWt = Math.abs(parseFloat(r.tot_wt) || (qty * unitWt));
      const g = gdw.defaultGodown;
      const res = await postMovement(cId, {
        movementDate: r.date,
        movementTime: '08:00:00',
        createdAt: r.created_at,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: g.id,
        godownName: g.godown_name,
        direction: 'IN',
        movementType: 'OPENING',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        amount: round3(qty * (parseFloat(r.rate) || 0)),
        sourceModule: 'OPEN',
        sourceTable: 'open_items',
        sourceId: r.open_id,
        sourceLineId: r.id,
        sourceRefNo: r.s_no ? `OPN-${r.s_no}` : `OPN-${r.open_id}`,
        remarks: r.header_remarks || r.header_type || 'Opening Stock'
      }, runner);
      track('OPEN', res);
    }
  } catch (_) {}

  // 2. Purchases + Unloading Allocations + QC Hold/Rejection exclusion
  try {
    const purRows = await runner.all(`
      SELECT pi.*, p.date, p.s_no, p.inv_no, p.supplier, p.godown_id, p.godown as godown_name,
             p.stock_type, p.remarks as header_remarks, p.created_at
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      ORDER BY p.date ASC, pi.id ASC
    `);
    for (const r of (purRows || [])) {
      if (!r.item_name) continue;
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.per_unit_weight || r.weight) || 50;
      const totWt = Math.abs(parseFloat(r.total_wt || r.total_weight) || (qty * unitWt));
      const lotKey = String(r.lot_no || '').trim().toUpperCase();
      const qcState = qcLotMap.get(lotKey) || '';
      const isRejected = qcState.includes('REJECT');
      const isHold = qcState.includes('HOLD');
      const stockStatus = isRejected ? 'Rejected' : (isHold ? 'Hold' : 'Available');

      let allocations = [];
      if (r.lot_no) {
        try {
          allocations = await runner.all(
            `SELECT id, godown_id, godown_name, qty, unloading_status
             FROM stock_unloading_allocations
             WHERE (purchase_id = ? OR purchase_id IS NULL) AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?)) AND qty > 0
             ORDER BY id ASC`,
            [r.purchase_id, r.lot_no]
          );
        } catch (_) {}
      }

      if (allocations && allocations.length > 0) {
        for (const alloc of allocations) {
          const allocQty = Math.abs(parseFloat(alloc.qty) || 0);
          const allocWt = qty > 0 ? round3((allocQty / qty) * totWt) : round3(allocQty * unitWt);
          const g = gdw.findByIdOrName(alloc.godown_id, alloc.godown_name, gdw.rmGodown);
          const pk = buildPostingKey({
            companyId: cId,
            sourceModule: 'PURCHASE',
            sourceId: r.purchase_id,
            sourceLineId: `${r.id}_A${alloc.id}`,
            direction: 'IN',
            movementType: 'PURCHASE_IN'
          });
          const res = await postMovement(cId, {
            postingKey: pk,
            movementDate: r.date,
            createdAt: r.created_at,
            itemId: r.item_id,
            itemName: r.item_name,
            stockCategory: r.stock_type || null,
            lotNo: r.lot_no || '',
            godownId: g.id,
            godownName: g.godown_name,
            supplierName: r.supplier || '',
            supplierInvoiceNo: r.inv_no || '',
            partyName: r.supplier || '',
            direction: 'IN',
            movementType: 'PURCHASE_IN',
            qty: allocQty,
            unitWeight: unitWt,
            weight: allocWt,
            rate: parseFloat(r.rate) || 0,
            amount: parseFloat(r.total_amt || r.amount) || 0,
            sourceModule: 'PURCHASE',
            sourceTable: 'purchase_items',
            sourceId: r.purchase_id,
            sourceLineId: r.id,
            sourceRefNo: r.inv_no || `PUR-${r.s_no || r.purchase_id}`,
            stockStatus,
            isPhysicalStock: !isRejected,
            remarks: r.header_remarks || ''
          }, runner);
          track('PURCHASE', res);
        }
      } else {
        const g = gdw.findByIdOrName(r.godown_id, r.godown_name, gdw.rmGodown);
        const res = await postMovement(cId, {
          movementDate: r.date,
          createdAt: r.created_at,
          itemId: r.item_id,
          itemName: r.item_name,
          stockCategory: r.stock_type || null,
          lotNo: r.lot_no || '',
          godownId: g.id,
          godownName: g.godown_name,
          supplierName: r.supplier || '',
          supplierInvoiceNo: r.inv_no || '',
          partyName: r.supplier || '',
          direction: 'IN',
          movementType: 'PURCHASE_IN',
          qty,
          unitWeight: unitWt,
          weight: totWt,
          rate: parseFloat(r.rate) || 0,
          amount: parseFloat(r.total_amt || r.amount) || 0,
          sourceModule: 'PURCHASE',
          sourceTable: 'purchase_items',
          sourceId: r.purchase_id,
          sourceLineId: r.id,
          sourceRefNo: r.inv_no || `PUR-${r.s_no || r.purchase_id}`,
          stockStatus,
          isPhysicalStock: !isRejected,
          remarks: r.header_remarks || ''
        }, runner);
        track('PURCHASE', res);
      }
    }
  } catch (_) {}

  // 3. Purchase Returns
  try {
    const prRows = await runner.all(`
      SELECT pri.*, pr.date, pr.s_no, pr.return_inv_no, pr.supplier, pr.godown, pr.remarks as header_remarks, pr.created_at
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
      ORDER BY pr.date ASC, pri.id ASC
    `);
    for (const r of (prRows || [])) {
      if (!r.item_name) continue;
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 50;
      const totWt = Math.abs(parseFloat(r.total_wt) || (qty * unitWt));
      const g = gdw.findByIdOrName(null, r.godown, gdw.rmGodown);
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: g.id,
        godownName: g.godown_name,
        supplierName: r.supplier || '',
        partyName: r.supplier || '',
        direction: 'OUT',
        movementType: 'PURCHASE_RETURN',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        amount: parseFloat(r.amount) || 0,
        sourceModule: 'PURCHASE_RETURN',
        sourceTable: 'purchase_return_items',
        sourceId: r.purchase_return_id,
        sourceLineId: r.id,
        sourceRefNo: r.return_inv_no || `PR-${r.s_no || r.purchase_return_id}`,
        remarks: r.header_remarks || ''
      }, runner);
      track('PURCHASE_RETURN', res);
    }
  } catch (_) {}

  // 4. Grains (Production Input / Output / Recoverable Wastage / Non-physical Process Loss)
  try {
    const grainInputs = await runner.all(`
      SELECT gi.*, g.date, g.s_no, g.flour_mill, g.outpass_id, g.inpass_id, g.process_mode, g.created_at
      FROM grain_input_items gi
      JOIN grains g ON gi.grain_id = g.id
      ORDER BY g.date ASC, gi.id ASC
    `);
    const grainParentLotMap = new Map();
    for (const r of (grainInputs || [])) {
      if (!r.item_name) continue;
      if (r.lot_no && !grainParentLotMap.has(r.grain_id)) {
        grainParentLotMap.set(r.grain_id, { lotNo: r.lot_no, supplierName: r.supplier_name || '' });
      }
      // If linked to an Outpass, factory custody was already reduced by the Outpass
      const hasLinkedOutpass = Number(r.outpass_id || 0) > 0;
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 50;
      const totWt = Math.abs(parseFloat(r.total_wt) || (qty * unitWt));
      const g = gdw.rmGodown;
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        supplierName: r.supplier_name || '',
        godownId: g.id,
        godownName: g.godown_name,
        partyName: r.flour_mill || '',
        direction: 'OUT',
        movementType: 'PRODUCTION_ISSUE',
        categoryHintModule: 'PURCHASE',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        sourceModule: 'GRAIN_INPUT',
        sourceTable: 'grain_input_items',
        sourceId: r.grain_id,
        sourceLineId: r.id,
        sourceRefNo: `GRD-${r.s_no || r.grain_id}`,
        isPhysicalStock: !hasLinkedOutpass,
        remarks: hasLinkedOutpass ? 'Linked to Outpass (Physical issue recorded on Outpass)' : ''
      }, runner);
      track('GRAIN_INPUT', res);
    }

    const grainOutputs = await runner.all(`
      SELECT go.*, g.date, g.s_no, g.flour_mill, g.inpass_id, g.created_at
      FROM grain_output_items go
      JOIN grains g ON go.grain_id = g.id
      ORDER BY g.date ASC, go.id ASC
    `);
    for (const r of (grainOutputs || [])) {
      if (!r.item_name) continue;
      const hasLinkedInpass = Number(r.inpass_id || 0) > 0;
      const parentMeta = grainParentLotMap.get(r.grain_id) || {};
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 50;
      const totWt = Math.abs(parseFloat(r.total_wt) || (qty * unitWt));
      const g = gdw.fgGodown;
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        parentLotNo: parentMeta.lotNo || '',
        supplierName: parentMeta.supplierName || '',
        godownId: g.id,
        godownName: g.godown_name,
        partyName: r.flour_mill || '',
        direction: 'IN',
        movementType: 'PRODUCTION_OUTPUT',
        categoryHintModule: 'GRAIN_OUTPUT',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        sourceModule: 'GRAIN_OUTPUT',
        sourceTable: 'grain_output_items',
        sourceId: r.grain_id,
        sourceLineId: r.id,
        sourceRefNo: `GRD-${r.s_no || r.grain_id}`,
        isPhysicalStock: !hasLinkedInpass,
        remarks: hasLinkedInpass ? 'Linked to Inpass (Physical receipt recorded on Inpass)' : ''
      }, runner);
      track('GRAIN_OUTPUT', res);
    }

    const grainWastage = await runner.all(`
      SELECT gw.*, g.date, g.s_no, g.flour_mill, g.inpass_id, g.created_at
      FROM grain_wastage_items gw
      JOIN grains g ON gw.grain_id = g.id
      ORDER BY g.date ASC, gw.id ASC
    `);
    for (const r of (grainWastage || [])) {
      if (!r.item_name) continue;
      const parentMeta = grainParentLotMap.get(r.grain_id) || {};
      const subtype = classifyWastageSubtype({ itemName: r.item_name, category: r.category, lotNo: r.lot_no });
      const isProcessLoss = subtype === 'PROCESS_LOSS';
      const hasLinkedInpass = Number(r.inpass_id || 0) > 0;
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 1;
      const totWt = Math.abs(parseFloat(r.total_wt) || (qty * unitWt));
      const g = gdw.defaultGodown;
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemName: r.item_name,
        stockCategory: 'Wastage',
        lotNo: r.lot_no || '',
        parentLotNo: parentMeta.lotNo || '',
        godownId: g.id,
        godownName: g.godown_name,
        partyName: r.flour_mill || '',
        direction: isProcessLoss ? 'OUT' : 'IN',
        movementType: isProcessLoss ? 'PROCESS_LOSS' : 'WASTAGE_RECOVERY',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        sourceModule: 'GRAIN_WASTAGE',
        sourceTable: 'grain_wastage_items',
        sourceId: r.grain_id,
        sourceLineId: r.id,
        sourceRefNo: `GRD-${r.s_no || r.grain_id}`,
        isPhysicalStock: !isProcessLoss && !hasLinkedInpass,
        remarks: isProcessLoss ? 'Process loss memo (RM already deducted on input)' : (r.category || 'Recoverable wastage')
      }, runner);
      track('GRAIN_WASTAGE', res);
    }
  } catch (_) {}

  // 5. Hand Sorting
  try {
    const hsRows = await runner.all(`SELECT * FROM hand_sorting_jobs ORDER BY sorting_date ASC, id ASC`);
    for (const r of (hsRows || [])) {
      const sDate = r.sorting_date || r.date || new Date().toISOString().slice(0, 10);
      if (r.input_item_name && (parseFloat(r.input_qty) > 0 || parseFloat(r.input_weight) > 0)) {
        const resIn = await postMovement(cId, {
          postingKey: buildPostingKey({ companyId: cId, sourceModule: 'HAND_SORTING', sourceId: r.id, sourceLineId: 1, direction: 'OUT', movementType: 'PRODUCTION_ISSUE' }),
          movementDate: sDate,
          itemName: r.input_item_name,
          lotNo: r.input_lot_no || '',
          godownId: r.godown_id || gdw.defaultGodown.id,
          godownName: r.godown_name || gdw.defaultGodown.godown_name,
          direction: 'OUT',
          movementType: 'PRODUCTION_ISSUE',
          qty: Math.abs(parseFloat(r.input_qty) || 0),
          weight: Math.abs(parseFloat(r.input_weight) || 0),
          sourceModule: 'HAND_SORTING',
          sourceTable: 'hand_sorting_jobs',
          sourceId: r.id,
          sourceLineId: 1,
          sourceRefNo: r.job_no || `HS-${r.id}`
        }, runner);
        track('HAND_SORTING', resIn);
      }
      if (r.output_item_name && (parseFloat(r.output_qty) > 0 || parseFloat(r.output_weight) > 0)) {
        const resOut = await postMovement(cId, {
          postingKey: buildPostingKey({ companyId: cId, sourceModule: 'HAND_SORTING', sourceId: r.id, sourceLineId: 2, direction: 'IN', movementType: 'PRODUCTION_OUTPUT' }),
          movementDate: sDate,
          itemName: r.output_item_name,
          lotNo: r.output_lot_no || '',
          parentLotNo: r.input_lot_no || '',
          godownId: r.godown_id || gdw.fgGodown.id,
          godownName: r.godown_name || gdw.fgGodown.godown_name,
          direction: 'IN',
          movementType: 'PRODUCTION_OUTPUT',
          categoryHintModule: 'GRAIN_OUTPUT',
          qty: Math.abs(parseFloat(r.output_qty) || 0),
          weight: Math.abs(parseFloat(r.output_weight) || 0),
          sourceModule: 'HAND_SORTING',
          sourceTable: 'hand_sorting_jobs',
          sourceId: r.id,
          sourceLineId: 2,
          sourceRefNo: r.job_no || `HS-${r.id}`
        }, runner);
        track('HAND_SORTING', resOut);
      }
    }
  } catch (_) {}

  // 6. Packing
  try {
    const hasSectionCol = await hasTableColumn(runner, cId, 'packing_items', 'section');
    const packRows = await runner.all(`
      SELECT pi.*, ${hasSectionCol ? 'pi.section,' : "'' as section,"} p.date, p.s_no, p.remarks as header_remarks, p.created_at
      FROM packing_items pi
      JOIN packing p ON pi.packing_id = p.id
      ORDER BY p.date ASC, pi.id ASC
    `);
    for (const r of (packRows || [])) {
      if (!r.item_name) continue;
      const rem = String(r.remarks || '').toLowerCase();
      const sec = String(r.section || '').toLowerCase();
      const isTo = rem === 'section:to' || sec === 'to';
      const isMaterial = rem === 'section:material' || sec === 'material';
      const direction = isTo ? 'IN' : 'OUT';
      const movementType = isTo ? 'PACKING_IN' : (isMaterial ? 'PACKING_MATERIAL_OUT' : 'PACKING_OUT');
      const catHint = isTo ? 'PACKING_TO' : (isMaterial ? 'PACKING_MATERIAL' : 'GRAIN_OUTPUT');
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 0;
      const totWt = Math.abs(parseFloat(r.tot_wt) || (qty * unitWt));
      const g = gdw.fgGodown;
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: g.id,
        godownName: g.godown_name,
        direction,
        movementType,
        categoryHintModule: catHint,
        qty,
        unitWeight: unitWt,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        sourceModule: isTo ? 'PACKING_TO' : (isMaterial ? 'PACKING_MATERIAL' : 'PACKING_FROM'),
        sourceTable: 'packing_items',
        sourceId: r.packing_id,
        sourceLineId: r.id,
        sourceRefNo: `PK-${r.s_no || r.packing_id}`,
        remarks: r.header_remarks || ''
      }, runner);
      track('PACKING', res);
    }
  } catch (_) {}

  // 7. Weight Conversion
  try {
    const wcRows = await runner.all(`
      SELECT wci.*, wc.date, wc.s_no as header_s_no, wc.remarks as header_remarks, wc.created_at
      FROM weight_conversion_items wci
      JOIN weight_conversion wc ON CAST(wci.weight_conversion_id AS TEXT) = CAST(wc.id AS TEXT)
      ORDER BY wc.date ASC, wci.id ASC
    `);
    for (const r of (wcRows || [])) {
      if (!r.item_name) continue;
      const t = String(r.type || 'input').toLowerCase();
      const isOutput = t === 'output' || t === 'to';
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 0;
      const totWt = Math.abs(parseFloat(r.total_wt) || (qty * unitWt));
      const g = gdw.defaultGodown;
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: g.id,
        godownName: g.godown_name,
        direction: isOutput ? 'IN' : 'OUT',
        movementType: isOutput ? 'WEIGHT_CONVERSION_IN' : 'WEIGHT_CONVERSION_OUT',
        categoryHintModule: 'GRAIN_OUTPUT',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        sourceModule: isOutput ? 'WEIGHT_CONVERSION_TO' : 'WEIGHT_CONVERSION_FROM',
        sourceTable: 'weight_conversion_items',
        sourceId: Number(r.weight_conversion_id) || r.id,
        sourceLineId: r.id,
        sourceRefNo: `WC-${r.header_s_no || r.weight_conversion_id}`,
        remarks: r.header_remarks || ''
      }, runner);
      track('WEIGHT_CONVERSION', res);
    }
  } catch (_) {}

  // 8. Flour Out & Papad In & Flour Out Returns
  try {
    const foRows = await runner.all(`
      SELECT foi.*, fo.date, fo.s_no, fo.papad_company, fo.created_at
      FROM flour_out_items foi
      JOIN flour_out fo ON foi.flour_out_id = fo.id
      ORDER BY fo.date ASC, foi.id ASC
    `);
    for (const r of (foRows || [])) {
      if (!r.item_name) continue;
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 0;
      const totWt = Math.abs(parseFloat(r.total_wt) || (qty * unitWt));
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: gdw.defaultGodown.id,
        godownName: gdw.defaultGodown.godown_name,
        partyName: r.papad_company || '',
        direction: 'OUT',
        movementType: 'OUTPASS_OUT',
        categoryHintModule: 'GRAIN_OUTPUT',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        sourceModule: 'FLOUR_OUT',
        sourceTable: 'flour_out_items',
        sourceId: r.flour_out_id,
        sourceLineId: r.id,
        sourceRefNo: `FO-${r.s_no || r.flour_out_id}`
      }, runner);
      track('FLOUR_OUT', res);
    }
  } catch (_) {}

  try {
    const piRows = await runner.all(`SELECT * FROM papad_in ORDER BY date ASC, id ASC`);
    for (const r of (piRows || [])) {
      if (!r.item_name) continue;
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 1;
      const totWt = Math.abs(qty * unitWt);
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: gdw.fgGodown.id,
        godownName: gdw.fgGodown.godown_name,
        partyName: r.papad_company || '',
        direction: 'IN',
        movementType: 'PAPAD_IN',
        categoryHintModule: 'PAPAD_IN',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        amount: parseFloat(r.amount) || 0,
        sourceModule: 'PAPAD_IN',
        sourceTable: 'papad_in',
        sourceId: r.id,
        sourceLineId: r.id,
        sourceRefNo: `PI-${r.s_no || r.id}`
      }, runner);
      track('PAPAD_IN', res);
    }
  } catch (_) {}

  // 9. Outpasses & Inpasses
  try {
    const opRows = await runner.all(`
      SELECT opi.*, op.outpass_no, op.date, op.party_name, op.from_godown_id, op.from_godown_name, op.status as header_status, op.created_at
      FROM outpass_items opi
      JOIN outpasses op ON opi.outpass_id = op.id
      WHERE UPPER(COALESCE(op.status, 'OUTPASSED')) != 'CANCELLED'
      ORDER BY op.date ASC, opi.id ASC
    `);
    for (const r of (opRows || [])) {
      if (!r.item_name) continue;
      const g = gdw.findByIdOrName(r.godown_id || r.from_godown_id, r.godown_name || r.from_godown_name, gdw.rmGodown);
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 50;
      const totWt = Math.abs(parseFloat(r.total_weight) || (qty * unitWt));
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemId: r.item_id,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: g.id,
        godownName: g.godown_name,
        partyName: r.party_name || '',
        direction: 'OUT',
        movementType: 'OUTPASS_OUT',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        amount: parseFloat(r.amount) || 0,
        sourceModule: 'OUTPASS',
        sourceTable: 'outpass_items',
        sourceId: r.outpass_id,
        sourceLineId: r.id,
        sourceRefNo: r.outpass_no || `OP-${r.outpass_id}`,
        remarks: r.reason || r.remarks || ''
      }, runner);
      track('OUTPASS', res);
    }
  } catch (_) {}

  try {
    const ipRows = await runner.all(`
      SELECT ipi.*, ip.inpass_no, ip.date, ip.party_name, ip.to_godown_id, ip.to_godown_name, ip.status as header_status, ip.created_at
      FROM inpass_items ipi
      JOIN inpasses ip ON ipi.inpass_id = ip.id
      WHERE UPPER(COALESCE(ip.status, 'RECEIVED')) != 'CANCELLED'
      ORDER BY ip.date ASC, ipi.id ASC
    `);
    for (const r of (ipRows || [])) {
      if (!r.item_name) continue;
      const ot = String(r.output_type || '').toUpperCase();
      const isWastage = ot.includes('WASTAGE') || ot.includes('BYPRODUCT');
      const isProcessLoss = ot.includes('LOSS');
      const g = gdw.findByIdOrName(r.godown_id || r.to_godown_id, r.godown_name || r.to_godown_name, isWastage ? gdw.defaultGodown : gdw.fgGodown);
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 50;
      const totWt = Math.abs(parseFloat(r.total_weight) || (qty * unitWt));
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemId: r.item_id,
        itemName: r.item_name,
        stockCategory: isWastage ? 'Wastage' : null,
        lotNo: r.lot_no || '',
        parentLotNo: r.original_lot_no || '',
        godownId: g.id,
        godownName: g.godown_name,
        partyName: r.party_name || '',
        direction: isProcessLoss ? 'OUT' : 'IN',
        movementType: isProcessLoss ? 'PROCESS_LOSS' : 'INPASS_IN',
        categoryHintModule: 'INPASS_OUTPUT',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        amount: parseFloat(r.amount) || 0,
        sourceModule: 'INPASS',
        sourceTable: 'inpass_items',
        sourceId: r.inpass_id,
        sourceLineId: r.id,
        sourceRefNo: r.inpass_no || `IP-${r.inpass_id}`,
        isPhysicalStock: !isProcessLoss,
        remarks: r.remarks || ''
      }, runner);
      track('INPASS', res);
    }
  } catch (_) {}

  // 10. Cold Storage Vouchers (skip auto-created duplicates of Purchases & Godown Transfers)
  try {
    const csRows = await runner.all(`
      SELECT csi.*, csv.voucher_no, csv.voucher_type, csv.voucher_date, csv.cold_storage_id, csv.cold_storage_name,
             csv.source_godown_id, csv.source_godown_name, csv.destination_godown_id, csv.destination_godown_name,
             csv.inward_source_type, csv.outward_dest_type, csv.customer_name, csv.supplier_name, csv.remarks as header_remarks, csv.created_at
      FROM cold_storage_items csi
      JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
      WHERE UPPER(COALESCE(csv.status, 'Confirmed')) != 'CANCELLED'
        AND LOWER(COALESCE(csv.remarks, '')) NOT LIKE '%auto-sync from stock lot%'
        AND LOWER(COALESCE(csv.remarks, '')) NOT LIKE '%auto-inward from purchase%'
        AND LOWER(COALESCE(csv.remarks, '')) NOT LIKE '%auto-created from%'
      ORDER BY csv.voucher_date ASC, csi.id ASC
    `);
    for (const r of (csRows || [])) {
      if (!r.item_name) continue;
      const vType = String(r.voucher_type || 'IN').toUpperCase();
      const qty = Math.abs(parseFloat(r.quantity) || 0);
      const unitWt = parseFloat(r.weight) || 50;
      const totWt = Math.abs(parseFloat(r.total_wt) || (qty * unitWt));
      const csG = gdw.findByIdOrName(r.cold_storage_id, r.cold_storage_name, gdw.csGodown || { id: null, godown_name: r.cold_storage_name || 'Cold Storage' });

      if (vType === 'IN') {
        const resIn = await postMovement(cId, {
          postingKey: buildPostingKey({ companyId: cId, sourceModule: 'COLD_STORAGE', sourceId: r.voucher_id, sourceLineId: r.id, direction: 'IN', movementType: 'COLD_STORAGE_IN' }),
          movementDate: r.voucher_date,
          createdAt: r.created_at,
          itemId: r.item_id,
          itemName: r.item_name,
          lotNo: r.cold_storage_lot_no || r.purchase_lot_no || '',
          parentLotNo: r.purchase_lot_no || '',
          supplierName: r.supplier_name || '',
          godownId: csG.id,
          godownName: csG.godown_name,
          storageType: 'Cold Storage',
          direction: 'IN',
          movementType: 'COLD_STORAGE_IN',
          qty,
          unitWeight: unitWt,
          weight: totWt,
          sourceModule: 'COLD_STORAGE',
          sourceTable: 'cold_storage_items',
          sourceId: r.voucher_id,
          sourceLineId: r.id,
          sourceRefNo: r.voucher_no,
          remarks: r.remarks || r.header_remarks || ''
        }, runner);
        track('COLD_STORAGE', resIn);

        if ((r.source_godown_id || r.source_godown_name) && String(r.inward_source_type || '').toLowerCase() !== 'direct purchase') {
          const srcG = gdw.findByIdOrName(r.source_godown_id, r.source_godown_name, gdw.defaultGodown);
          const resOut = await postMovement(cId, {
            postingKey: buildPostingKey({ companyId: cId, sourceModule: 'COLD_STORAGE', sourceId: r.voucher_id, sourceLineId: r.id, direction: 'OUT', movementType: 'TRANSFER_OUT' }),
            movementDate: r.voucher_date,
            createdAt: r.created_at,
            itemId: r.item_id,
            itemName: r.item_name,
            lotNo: r.purchase_lot_no || r.cold_storage_lot_no || '',
            parentLotNo: r.purchase_lot_no || '',
            godownId: srcG.id,
            godownName: srcG.godown_name,
            storageType: 'Factory',
            direction: 'OUT',
            movementType: 'TRANSFER_OUT',
            qty,
            unitWeight: unitWt,
            weight: totWt,
            sourceModule: 'COLD_STORAGE',
            sourceTable: 'cold_storage_items',
            sourceId: r.voucher_id,
            sourceLineId: r.id,
            sourceRefNo: r.voucher_no,
            remarks: `Sent to ${csG.godown_name}`
          }, runner);
          track('COLD_STORAGE', resOut);
        }
      } else {
        // Check whether cold_storage_lot_no physically exists as IN in this CS godown; otherwise fall back to purchase_lot_no (direct-to-CS purchase)
        let csOutLotNo = r.cold_storage_lot_no || r.purchase_lot_no || '';
        if (r.cold_storage_lot_no && r.purchase_lot_no && r.cold_storage_lot_no !== r.purchase_lot_no) {
          const hasCsLot = await runner.get(
            `SELECT COALESCE(SUM(qty), 0) as q FROM stock_movements
             WHERE company_id = ? AND COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0
               AND direction = 'IN' AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))
               AND LOWER(TRIM(godown_name)) = LOWER(TRIM(?))`,
            [cId, r.cold_storage_lot_no, csG.godown_name]
          ).catch(() => null);
          if (parseFloat(hasCsLot?.q || 0) <= 0) {
            csOutLotNo = r.purchase_lot_no;
          }
        }
        const resOut = await postMovement(cId, {
          postingKey: buildPostingKey({ companyId: cId, sourceModule: 'COLD_STORAGE', sourceId: r.voucher_id, sourceLineId: r.id, direction: 'OUT', movementType: 'COLD_STORAGE_OUT' }),
          movementDate: r.voucher_date,
          createdAt: r.created_at,
          itemId: r.item_id,
          itemName: r.item_name,
          lotNo: csOutLotNo,
          parentLotNo: r.purchase_lot_no || '',
          godownId: csG.id,
          godownName: csG.godown_name,
          storageType: 'Cold Storage',
          direction: 'OUT',
          movementType: 'COLD_STORAGE_OUT',
          qty,
          unitWeight: unitWt,
          weight: totWt,
          sourceModule: 'COLD_STORAGE',
          sourceTable: 'cold_storage_items',
          sourceId: r.voucher_id,
          sourceLineId: r.id,
          sourceRefNo: r.voucher_no,
          remarks: r.remarks || r.header_remarks || ''
        }, runner);
        track('COLD_STORAGE', resOut);

        const isDirectCustomer = String(r.outward_dest_type || '').toLowerCase().includes('customer') || String(r.outward_dest_type || '').toLowerCase().includes('sale');
        if (!isDirectCustomer && (r.destination_godown_id || r.destination_godown_name)) {
          const destG = gdw.findByIdOrName(r.destination_godown_id, r.destination_godown_name, gdw.defaultGodown);
          const resDestIn = await postMovement(cId, {
            postingKey: buildPostingKey({ companyId: cId, sourceModule: 'COLD_STORAGE', sourceId: r.voucher_id, sourceLineId: r.id, direction: 'IN', movementType: 'TRANSFER_IN' }),
            movementDate: r.voucher_date,
            createdAt: r.created_at,
            itemId: r.item_id,
            itemName: r.item_name,
            lotNo: r.purchase_lot_no || r.cold_storage_lot_no || '',
            parentLotNo: r.purchase_lot_no || '',
            godownId: destG.id,
            godownName: destG.godown_name,
            storageType: 'Factory',
            direction: 'IN',
            movementType: 'TRANSFER_IN',
            qty,
            unitWeight: unitWt,
            weight: totWt,
            sourceModule: 'COLD_STORAGE',
            sourceTable: 'cold_storage_items',
            sourceId: r.voucher_id,
            sourceLineId: r.id,
            sourceRefNo: r.voucher_no,
            remarks: `Released from ${csG.godown_name}`
          }, runner);
          track('COLD_STORAGE', resDestIn);
        }
      }
    }
  } catch (_) {}

  // 11. Deduplicated Godown Transfers & Item Transfers (single source of truth for godown-to-godown & CS transfers)
  try {
    const itRows = await runner.all(`
      SELECT id, transfer_no, date, from_godown_id, from_godown_name, to_godown_id, to_godown_name,
             item_id, item_name, lot_no, transfer_qty as qty, weight, rate, amount, remarks, created_at, 'ITEM_TRANSFER' as src_tbl
      FROM item_transfers
    `);
    const gtRows = await runner.all(`
      SELECT gt.id, gt.s_no as transfer_no, gt.transfer_date as date, gt.from_godown_id, gt.from_godown_name,
             gt.to_godown_id, gt.to_godown_name, NULL as item_id, gt.item_name, gt.lot_no, gt.qty,
             CASE WHEN COALESCE(gt.qty, 0) > 0 THEN COALESCE(gt.weight, 0) / gt.qty ELSE 0 END as weight,
             0 as rate, 0 as amount, gt.remarks, gt.created_at, 'GODOWN_TRANSFER' as src_tbl
      FROM godown_transfers gt
      WHERE NOT EXISTS (
        SELECT 1 FROM item_transfers it
        WHERE (it.id = gt.id OR LOWER(TRIM(COALESCE(it.transfer_no, ''))) = LOWER(TRIM(COALESCE(gt.s_no, ''))))
          AND COALESCE(it.date, '') = COALESCE(gt.transfer_date, '')
          AND LOWER(TRIM(COALESCE(it.item_name, ''))) = LOWER(TRIM(COALESCE(gt.item_name, '')))
          AND LOWER(TRIM(COALESCE(it.lot_no, ''))) = LOWER(TRIM(COALESCE(gt.lot_no, '')))
      )
    `);
    const allTransfers = [...(itRows || []), ...(gtRows || [])];
    for (const r of allTransfers) {
      if (!r.item_name) continue;
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 50;
      const totWt = round3(qty * unitWt);
      const fromG = gdw.findByIdOrName(r.from_godown_id, r.from_godown_name, gdw.defaultGodown);
      const toG = gdw.findByIdOrName(r.to_godown_id, r.to_godown_name, gdw.defaultGodown);
      const isFromCs = Number(fromG.is_cold_storage || 0) === 1 || /cold|bts/i.test(fromG.godown_name || '');
      const isToCs = Number(toG.is_cold_storage || 0) === 1 || /cold|bts/i.test(toG.godown_name || '');

      let outLotNo = String(r.lot_no || '').trim();
      if (isFromCs && outLotNo && !outLotNo.toUpperCase().startsWith('CS-')) {
        const csPrefixed = `CS-${outLotNo}`;
        const csCheck = await runner.get(
          `SELECT COALESCE(SUM(qty), 0) as q FROM stock_movements
           WHERE company_id = ? AND COALESCE(is_reversed, 0) = 0 AND COALESCE(is_reversal, 0) = 0
             AND direction = 'IN' AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?))
             AND LOWER(TRIM(godown_name)) = LOWER(TRIM(?))`,
          [cId, csPrefixed, fromG.godown_name]
        ).catch(() => null);
        if (parseFloat(csCheck?.q || 0) > 0) {
          outLotNo = csPrefixed;
        }
      }

      const resOut = await postMovement(cId, {
        postingKey: buildPostingKey({ companyId: cId, sourceModule: r.src_tbl, sourceId: r.id, sourceLineId: 1, direction: 'OUT', movementType: 'TRANSFER_OUT' }),
        movementDate: r.date,
        createdAt: r.created_at,
        itemId: r.item_id,
        itemName: r.item_name,
        lotNo: outLotNo,
        parentLotNo: r.lot_no || '',
        godownId: fromG.id,
        godownName: fromG.godown_name,
        direction: 'OUT',
        movementType: 'TRANSFER_OUT',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        sourceModule: r.src_tbl,
        sourceTable: r.src_tbl === 'ITEM_TRANSFER' ? 'item_transfers' : 'godown_transfers',
        sourceId: r.id,
        sourceLineId: 1,
        sourceRefNo: r.transfer_no ? `TRF-${r.transfer_no}` : `TRF-${r.id}`,
        remarks: r.remarks || `To ${toG.godown_name}`
      }, runner);
      track('TRANSFER', resOut);

      const resIn = await postMovement(cId, {
        postingKey: buildPostingKey({ companyId: cId, sourceModule: r.src_tbl, sourceId: r.id, sourceLineId: 2, direction: 'IN', movementType: 'TRANSFER_IN' }),
        movementDate: r.date,
        createdAt: r.created_at,
        itemId: r.item_id,
        itemName: r.item_name,
        lotNo: isToCs && !String(r.lot_no || '').toUpperCase().startsWith('CS-') ? `CS-${r.lot_no}` : (r.lot_no || ''),
        parentLotNo: r.lot_no || '',
        godownId: toG.id,
        godownName: toG.godown_name,
        direction: 'IN',
        movementType: 'TRANSFER_IN',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        sourceModule: r.src_tbl,
        sourceTable: r.src_tbl === 'ITEM_TRANSFER' ? 'item_transfers' : 'godown_transfers',
        sourceId: r.id,
        sourceLineId: 2,
        sourceRefNo: r.transfer_no ? `TRF-${r.transfer_no}` : `TRF-${r.id}`,
        remarks: r.remarks || `From ${fromG.godown_name}`
      }, runner);
      track('TRANSFER', resIn);
    }
  } catch (_) {}

  // 12. Sales (Dispatched Only — is_order = 0)
  try {
    const salesRows = await runner.all(`
      SELECT si.*, s.date, s.s_no, s.customer, s.godown_from_id, s.remarks as header_remarks, s.created_at
      FROM sales_items si
      JOIN sales s ON si.sales_id = s.id
      WHERE COALESCE(s.is_order, 0) = 0
      ORDER BY s.date ASC, si.id ASC
    `);
    for (const r of (salesRows || [])) {
      if (!r.item_name) continue;
      const g = gdw.findByIdOrName(r.godown_from_id, null, gdw.fgGodown);
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 50;
      const totWt = Math.abs(parseFloat(r.total_wt) || (qty * unitWt));
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: g.id,
        godownName: g.godown_name,
        partyName: r.customer || '',
        direction: 'OUT',
        movementType: 'SALES_DISPATCH',
        categoryHintModule: 'SALES',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        amount: parseFloat(r.total_amt) || 0,
        sourceModule: 'SALES',
        sourceTable: 'sales_items',
        sourceId: r.sales_id,
        sourceLineId: r.id,
        sourceRefNo: `INV-${r.s_no || r.sales_id}`,
        remarks: r.header_remarks || ''
      }, runner);
      track('SALES', res);
    }
  } catch (_) {}

  // 13. Sales Export Orders (Dispatched Only — is_order = 0)
  try {
    const expRows = await runner.all(`
      SELECT seoi.*, seo.date, seo.bill_no, seo.consignee, seo.remarks as header_remarks, seo.created_at
      FROM sales_export_order_items seoi
      JOIN sales_export_orders seo ON seoi.sales_export_order_id = seo.id
      WHERE COALESCE(seo.is_order, 0) = 0
      ORDER BY seo.date ASC, seoi.id ASC
    `);
    for (const r of (expRows || [])) {
      if (!r.description) continue;
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const totWt = Math.abs(parseFloat(r.qty_in_kg) || 0);
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemName: r.description,
        lotNo: r.lot_no || '',
        godownId: gdw.fgGodown.id,
        godownName: gdw.fgGodown.godown_name,
        partyName: r.consignee || '',
        direction: 'OUT',
        movementType: 'SALES_DISPATCH',
        categoryHintModule: 'SALES',
        qty,
        weight: totWt,
        rate: parseFloat(r.usd_rate) || 0,
        amount: parseFloat(r.inr_amt || r.usd_amt) || 0,
        sourceModule: 'SALES_EXPORT_ORDER',
        sourceTable: 'sales_export_order_items',
        sourceId: r.sales_export_order_id,
        sourceLineId: r.id,
        sourceRefNo: r.bill_no || `EXP-${r.sales_export_order_id}`,
        remarks: r.header_remarks || ''
      }, runner);
      track('SALES_EXPORT_ORDER', res);
    }
  } catch (_) {}

  // 14. Sales Return (`sales_return` singular) — only APPROVED + Resalable disposition enter saleable FG stock
  try {
    const srRows = await runner.all(`
      SELECT sri.*, sr.date, sr.s_no, sr.return_no, sr.customer, sr.remarks as header_remarks, sr.created_at,
             sr.approval_status, sr.stock_disposition as header_disposition, sr.stock_status,
             sr.destination_godown_id as header_godown_id, sr.destination_godown_name as header_godown_name
      FROM sales_return_items sri
      JOIN sales_return sr ON sri.sales_return_id = sr.id
      WHERE UPPER(COALESCE(sr.approval_status, '')) = 'APPROVED'
      ORDER BY sr.date ASC, sri.id ASC
    `);
    for (const r of (srRows || [])) {
      if (!r.item_name) continue;
      const disp = String(r.stock_disposition || r.header_disposition || r.stock_status || '').trim().toLowerCase();
      if (disp !== 'resalable' && disp !== 'good / resalable') continue;
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 50;
      const totWt = Math.abs(parseFloat(r.return_weight) || parseFloat(r.total_wt) || (qty * unitWt));
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: r.destination_godown_id || r.header_godown_id || gdw.fgGodown.id,
        godownName: r.destination_godown_name || r.header_godown_name || gdw.fgGodown.godown_name,
        partyName: r.customer || '',
        direction: 'IN',
        movementType: 'SALES_RETURN',
        categoryHintModule: 'SALES_RETURN',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        amount: parseFloat(r.total_amt) || 0,
        sourceModule: 'SALES_RETURN',
        sourceTable: 'sales_return_items',
        sourceId: r.sales_return_id,
        sourceLineId: r.id,
        sourceRefNo: r.return_no || `SR-${r.s_no || r.sales_return_id}`,
        remarks: r.header_remarks || ''
      }, runner);
      track('SALES_RETURN', res);
    }
  } catch (_) {}

  // 15. Stock Adjustments
  try {
    const saRows = await runner.all(`
      SELECT sai.*, sa.date, sa.s_no, sa.type as header_type, sa.papad_comp, sa.flour_mill, sa.remarks as header_remarks, sa.created_at
      FROM stock_adjustment_items sai
      JOIN stock_adjustments sa ON sai.stock_adjustment_id = sa.id
      ORDER BY sa.date ASC, sai.id ASC
    `);
    for (const r of (saRows || [])) {
      if (!r.item_name) continue;
      const isOut = isDeductionAdjType(r.type || r.header_type);
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const unitWt = parseFloat(r.weight) || 0;
      const totWt = Math.abs(parseFloat(r.tot_wt) || (qty * unitWt));
      const g = gdw.defaultGodown;
      const res = await postMovement(cId, {
        movementDate: r.date,
        createdAt: r.created_at,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: g.id,
        godownName: g.godown_name,
        direction: isOut ? 'OUT' : 'IN',
        movementType: isOut ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN',
        qty,
        unitWeight: unitWt,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        sourceModule: 'STOCK_ADJUST',
        sourceTable: 'stock_adjustment_items',
        sourceId: r.stock_adjustment_id,
        sourceLineId: r.id,
        sourceRefNo: `SA-${r.s_no || r.stock_adjustment_id}`,
        remarks: r.remarks || r.header_remarks || r.header_type || ''
      }, runner);
      track('STOCK_ADJUST', res);
    }
  } catch (_) {}

  return summary;
}

/**
 * Shadow Reconciliation comparing append-only stock_movements against legacy `stock` and `stock_lots`.
 * Never alters or auto-repairs historical discrepancies.
 */
async function getReconciliationReport(companyId, filters = {}, conn = null) {
  const cId = requireCompanyId(companyId);
  const runner = conn || db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);

  const movRows = await runner.all(`
    SELECT
      MAX(item_id) as item_id,
      MAX(item_code) as item_code,
      MAX(item_name) as item_name,
      MAX(stock_category) as stock_category,
      MAX(storage_type) as storage_type,
      COALESCE(lot_no, '') as lot_no,
      MAX(rm_lot_no) as rm_lot_no,
      MAX(fg_lot_no) as fg_lot_no,
      MAX(parent_lot_no) as parent_lot_no,
      MAX(godown_id) as godown_id,
      COALESCE(godown_name, '') as godown_name,
      SUM(CASE WHEN direction = 'IN' THEN qty ELSE -qty END) as movement_qty,
      SUM(CASE WHEN direction = 'IN' THEN weight ELSE -weight END) as movement_weight,
      COUNT(*) as movement_count
    FROM stock_movements
    WHERE company_id = ?
      AND COALESCE(is_reversed, 0) = 0
      AND COALESCE(is_reversal, 0) = 0
      AND COALESCE(is_physical_stock, 1) = 1
      ${filters.financialYear ? 'AND financial_year = ?' : ''}
    GROUP BY LOWER(TRIM(item_name)), LOWER(TRIM(COALESCE(lot_no, ''))), LOWER(TRIM(COALESCE(godown_name, '')))
  `, filters.financialYear ? [cId, filters.financialYear] : [cId]);

  const legacyStockRows = await runner.all(`
    SELECT
      MAX(s.item_name) as item_name,
      COALESCE(s.lot_no, '') as lot_no,
      COALESCE(gm.godown_name, s.godown, '') as godown_name,
      SUM(COALESCE(s.qty, 0)) as legacy_stock_qty,
      SUM(COALESCE(s.weight, 0)) as legacy_stock_weight
    FROM stock s
    LEFT JOIN godown_master gm ON gm.id = s.godown_id
    GROUP BY LOWER(TRIM(COALESCE(s.item_name, ''))), LOWER(TRIM(COALESCE(s.lot_no, ''))), LOWER(TRIM(COALESCE(gm.godown_name, s.godown, '')))
  `);

  const legacyLotRows = await runner.all(`
    SELECT
      MAX(sl.item_name) as item_name,
      COALESCE(sl.lot_no, '') as lot_no,
      COALESCE(gm.godown_name, sl.godown_name, '') as godown_name,
      SUM(COALESCE(sl.remaining_quantity, 0)) as legacy_lot_qty,
      MAX(sl.qc_status) as qc_status
    FROM stock_lots sl
    LEFT JOIN godown_master gm ON gm.id = sl.godown_id
    GROUP BY LOWER(TRIM(COALESCE(sl.item_name, ''))), LOWER(TRIM(COALESCE(sl.lot_no, ''))), LOWER(TRIM(COALESCE(gm.godown_name, sl.godown_name, '')))
  `);

  const map = new Map();
  const makeKey = (itemName, lotNo, godownName) =>
    `${String(itemName || '').trim().toLowerCase()}|${String(lotNo || '').trim().toLowerCase()}|${String(godownName || '').trim().toLowerCase()}`;

  const ensureEntry = (itemName, lotNo, godownName) => {
    const k = makeKey(itemName, lotNo, godownName);
    if (!map.has(k)) {
      map.set(k, {
        identity_key: k,
        item_name: itemName || '',
        lot_no: lotNo || '',
        rm_lot_no: '',
        fg_lot_no: '',
        parent_lot_no: '',
        godown_name: godownName || '',
        stock_category: '',
        storage_type: 'Factory',
        movement_qty: 0,
        movement_weight: 0,
        movement_count: 0,
        legacy_stock_qty: 0,
        legacy_lot_qty: 0,
        variance_vs_stock: 0,
        variance_vs_lots: 0,
        status: 'MATCHED'
      });
    }
    return map.get(k);
  };

  for (const m of (movRows || [])) {
    const e = ensureEntry(m.item_name, m.lot_no, m.godown_name);
    e.item_id = m.item_id || null;
    e.item_code = m.item_code || '';
    e.stock_category = m.stock_category || '';
    e.storage_type = m.storage_type || 'Factory';
    e.rm_lot_no = m.rm_lot_no || '';
    e.fg_lot_no = m.fg_lot_no || '';
    e.parent_lot_no = m.parent_lot_no || '';
    e.godown_id = m.godown_id || null;
    e.movement_qty = round3(e.movement_qty + (parseFloat(m.movement_qty) || 0));
    e.movement_weight = round3(e.movement_weight + (parseFloat(m.movement_weight) || 0));
    e.movement_count += parseInt(m.movement_count || 0, 10);
  }

  for (const ls of (legacyStockRows || [])) {
    const e = ensureEntry(ls.item_name, ls.lot_no, ls.godown_name);
    e.legacy_stock_qty = round3(e.legacy_stock_qty + (parseFloat(ls.legacy_stock_qty) || 0));
  }

  for (const ll of (legacyLotRows || [])) {
    const e = ensureEntry(ll.item_name, ll.lot_no, ll.godown_name);
    e.legacy_lot_qty = round3(e.legacy_lot_qty + (parseFloat(ll.legacy_lot_qty) || 0));
    if (ll.qc_status) e.qc_status = ll.qc_status;
  }

  let rows = Array.from(map.values());
  for (const row of rows) {
    if (!row.stock_category) {
      const cat = await resolveCategory(cId, {
        itemName: row.item_name,
        lotNo: row.lot_no,
        godownName: row.godown_name
      }, runner);
      row.stock_category = cat.stockCategory;
      row.storage_type = cat.storageType;
    }
    row.variance_vs_stock = round3(row.movement_qty - row.legacy_stock_qty);
    row.variance_vs_lots = round3(row.movement_qty - row.legacy_lot_qty);
    row.status = (Math.abs(row.variance_vs_stock) > 0.01 || Math.abs(row.variance_vs_lots) > 0.01) ? 'VARIANCE' : 'MATCHED';
  }

  if (filters.varianceOnly) {
    rows = rows.filter(r => r.status === 'VARIANCE');
  }
  if (filters.search) {
    const s = String(filters.search).trim().toLowerCase();
    rows = rows.filter(r =>
      String(r.item_name || '').toLowerCase().includes(s) ||
      String(r.lot_no || '').toLowerCase().includes(s) ||
      String(r.godown_name || '').toLowerCase().includes(s)
    );
  }
  if (filters.godownName) {
    const g = String(filters.godownName).trim().toLowerCase();
    rows = rows.filter(r => String(r.godown_name || '').toLowerCase() === g);
  }

  rows.sort((a, b) => Math.abs(b.variance_vs_lots) - Math.abs(a.variance_vs_lots) || a.item_name.localeCompare(b.item_name));

  return {
    rows,
    summary: {
      totalRows: rows.length,
      matchedCount: rows.filter(r => r.status === 'MATCHED').length,
      varianceCount: rows.filter(r => r.status === 'VARIANCE').length,
      totalMovementQty: round3(rows.reduce((s, r) => s + r.movement_qty, 0)),
      totalLegacyStockQty: round3(rows.reduce((s, r) => s + r.legacy_stock_qty, 0)),
      totalLegacyLotQty: round3(rows.reduce((s, r) => s + r.legacy_lot_qty, 0))
    }
  };
}

module.exports = {
  backfillCompanyMovements,
  getReconciliationReport
};
