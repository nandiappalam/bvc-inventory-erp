const db = require('../config/database');
const { ensureStockRegisterSchema } = require('./StockRegisterSchema');
const { reverseDocumentMovements, postMovement } = require('./InventoryService');
const { classifyWastageSubtype } = require('./CategoryResolverService');
const { buildPostingKey, round3 } = require('./StockIdentityHelper');
const { normalizeIsoDate } = require('./FinancialYearResolver');

async function resolveGodowns(runner) {
  const list = await runner.all(`SELECT id, godown_name, godown_type, storage_location, is_cold_storage FROM godown_master ORDER BY id ASC`);
  const defaultGodown = list.find(g =>
    String(g.godown_type || '').toLowerCase() === 'normal' ||
    String(g.storage_location || '').toLowerCase().includes('inside')
  ) || list[0] || { id: null, godown_name: 'Main Godown' };
  const rmGodown = list.find(g => /raw|\brm\b/i.test(g.godown_name || '')) || defaultGodown;
  const fgGodown = list.find(g => /finish|\bfg\b/i.test(g.godown_name || '')) || defaultGodown;
  const csGodown = list.find(g => Number(g.is_cold_storage || 0) === 1 || /cold|bts/i.test(g.godown_name || '')) || null;

  const findG = (idVal, nameVal, fallback = defaultGodown) => {
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
  return { defaultGodown, rmGodown, fgGodown, csGodown, findG };
}

function getSubModules(sourceModule) {
  const m = String(sourceModule || '').toUpperCase();
  if (m === 'GRAIN' || m === 'GRAINS') return ['GRAIN_INPUT', 'GRAIN_OUTPUT', 'GRAIN_WASTAGE'];
  if (m === 'PACKING') return ['PACKING_FROM', 'PACKING_TO', 'PACKING_MATERIAL'];
  if (m === 'WEIGHT_CONVERSION') return ['WEIGHT_CONVERSION_FROM', 'WEIGHT_CONVERSION_TO'];
  return [m];
}

async function deleteDocumentMovements(companyId, sourceModule, sourceId, reason = 'Document deleted', performedBy = 'admin') {
  const cId = parseInt(companyId, 10);
  if (!Number.isSafeInteger(cId) || cId <= 0 || !sourceId) return { reversedCount: 0 };
  const runner = db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);

  const subMods = getSubModules(sourceModule);
  let totalReversed = 0;
  for (const sm of subMods) {
    const res = await reverseDocumentMovements(cId, {
      sourceModule: sm,
      sourceId: Number(sourceId),
      reason,
      performedBy
    }, runner);
    totalReversed += (res.reversedCount || 0);
  }
  return { reversedCount: totalReversed };
}

async function syncDocumentMovements(companyId, sourceModule, sourceId, performedBy = 'admin') {
  const cId = parseInt(companyId, 10);
  if (!Number.isSafeInteger(cId) || cId <= 0 || !sourceId) return { synced: 0 };
  const runner = db.forCompany(cId);
  await ensureStockRegisterSchema(cId, runner);

  const mod = String(sourceModule || '').toUpperCase();
  const sId = Number(sourceId);
  const gdw = await resolveGodowns(runner);

  // Reverse prior movements for this document before reposting current DB lines cleanly
  await deleteDocumentMovements(cId, mod, sId, `${mod} synced/updated`, performedBy);

  let synced = 0;
  const postOne = async (payload) => {
    const r = await postMovement(cId, { ...payload, createdBy: performedBy || 'admin' }, runner);
    if (r && !r.skipped) synced++;
  };

  if (mod === 'OPEN') {
    const header = await runner.get(`SELECT * FROM open WHERE id = ?`, [sId]);
    if (!header) return { synced: 0 };
    const items = await runner.all(`SELECT * FROM open_items WHERE open_id = ? ORDER BY id ASC`, [sId]);
    for (const r of items) {
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 0;
      const totWt = Math.abs(parseFloat(r.tot_wt) || (qty * uw));
      await postOne({
        movementDate: header.date,
        movementTime: '08:00:00',
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: gdw.defaultGodown.id,
        godownName: gdw.defaultGodown.godown_name,
        direction: 'IN',
        movementType: 'OPENING',
        qty,
        unitWeight: uw,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        sourceModule: 'OPEN',
        sourceTable: 'open_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: header.s_no ? `OPN-${header.s_no}` : `OPN-${sId}`,
        remarks: header.remarks || 'Opening Stock'
      });
    }
  } else if (mod === 'PURCHASE') {
    const header = await runner.get(`SELECT * FROM purchases WHERE id = ?`, [sId]);
    if (!header) return { synced: 0 };
    const items = await runner.all(`SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id ASC`, [sId]);
    for (const r of items) {
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.per_unit_weight || r.weight) || 50;
      const totWt = Math.abs(parseFloat(r.total_wt || r.total_weight) || (qty * uw));
      let qcState = '';
      if (r.lot_no) {
        const sl = await runner.get(`SELECT qc_status, approval_status FROM stock_lots WHERE LOWER(TRIM(lot_no)) = LOWER(TRIM(?)) LIMIT 1`, [r.lot_no]).catch(() => null);
        qcState = String(sl?.qc_status || sl?.approval_status || '').toUpperCase();
      }
      const isRejected = qcState.includes('REJECT');
      const stockStatus = isRejected ? 'Rejected' : (qcState.includes('HOLD') ? 'Hold' : 'Available');

      let allocations = [];
      if (r.lot_no) {
        allocations = await runner.all(
          `SELECT id, godown_id, godown_name, qty FROM stock_unloading_allocations WHERE (purchase_id = ? OR purchase_id IS NULL) AND LOWER(TRIM(lot_no)) = LOWER(TRIM(?)) AND qty > 0`,
          [sId, r.lot_no]
        ).catch(() => []);
      }

      if (allocations && allocations.length > 0) {
        for (const alloc of allocations) {
          const allocQty = Math.abs(parseFloat(alloc.qty) || 0);
          const allocWt = qty > 0 ? round3((allocQty / qty) * totWt) : round3(allocQty * uw);
          const g = gdw.findG(alloc.godown_id, alloc.godown_name, gdw.rmGodown);
          await postOne({
            postingKey: buildPostingKey({ companyId: cId, sourceModule: 'PURCHASE', sourceId: sId, sourceLineId: `${r.id}_A${alloc.id}`, direction: 'IN', movementType: 'PURCHASE_IN' }),
            movementDate: header.date,
            itemId: r.item_id,
            itemName: r.item_name,
            stockCategory: header.stock_type || null,
            lotNo: r.lot_no || '',
            godownId: g.id,
            godownName: g.godown_name,
            supplierName: header.supplier || '',
            supplierInvoiceNo: header.inv_no || '',
            partyName: header.supplier || '',
            direction: 'IN',
            movementType: 'PURCHASE_IN',
            qty: allocQty,
            unitWeight: uw,
            weight: allocWt,
            rate: parseFloat(r.rate) || 0,
            sourceModule: 'PURCHASE',
            sourceTable: 'purchase_items',
            sourceId: sId,
            sourceLineId: r.id,
            sourceRefNo: header.inv_no || `PUR-${header.s_no || sId}`,
            stockStatus,
            isPhysicalStock: !isRejected
          });
        }
      } else {
        const g = gdw.findG(header.godown_id, header.godown, gdw.rmGodown);
        await postOne({
          movementDate: header.date,
          itemId: r.item_id,
          itemName: r.item_name,
          stockCategory: header.stock_type || null,
          lotNo: r.lot_no || '',
          godownId: g.id,
          godownName: g.godown_name,
          supplierName: header.supplier || '',
          supplierInvoiceNo: header.inv_no || '',
          partyName: header.supplier || '',
          direction: 'IN',
          movementType: 'PURCHASE_IN',
          qty,
          unitWeight: uw,
          weight: totWt,
          rate: parseFloat(r.rate) || 0,
          sourceModule: 'PURCHASE',
          sourceTable: 'purchase_items',
          sourceId: sId,
          sourceLineId: r.id,
          sourceRefNo: header.inv_no || `PUR-${header.s_no || sId}`,
          stockStatus,
          isPhysicalStock: !isRejected
        });
      }
    }
  } else if (mod === 'PURCHASE_RETURN') {
    const header = await runner.get(`SELECT * FROM purchase_returns WHERE id = ?`, [sId]);
    if (!header) return { synced: 0 };
    const items = await runner.all(`SELECT * FROM purchase_return_items WHERE purchase_return_id = ? ORDER BY id ASC`, [sId]);
    const g = gdw.findG(null, header.godown, gdw.rmGodown);
    for (const r of items) {
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 50;
      const totWt = Math.abs(parseFloat(r.total_wt) || (qty * uw));
      await postOne({
        movementDate: header.date,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: g.id,
        godownName: g.godown_name,
        supplierName: header.supplier || '',
        partyName: header.supplier || '',
        direction: 'OUT',
        movementType: 'PURCHASE_RETURN',
        qty,
        unitWeight: uw,
        weight: totWt,
        rate: parseFloat(r.rate) || 0,
        sourceModule: 'PURCHASE_RETURN',
        sourceTable: 'purchase_return_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: header.return_inv_no || `PR-${header.s_no || sId}`
      });
    }
  } else if (mod === 'GRAIN' || mod === 'GRAINS') {
    const header = await runner.get(`SELECT * FROM grains WHERE id = ?`, [sId]);
    if (!header) return { synced: 0 };
    const inputs = await runner.all(`SELECT * FROM grain_input_items WHERE grain_id = ? ORDER BY id ASC`, [sId]);
    const parentLot = inputs[0]?.lot_no || '';
    const parentSup = inputs[0]?.supplier_name || '';
    const hasOutpass = Number(header.outpass_id || 0) > 0;
    const hasInpass = Number(header.inpass_id || 0) > 0;

    for (const r of inputs) {
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 50;
      await postOne({
        movementDate: header.date,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        supplierName: r.supplier_name || '',
        godownId: gdw.rmGodown.id,
        godownName: gdw.rmGodown.godown_name,
        partyName: header.flour_mill || '',
        direction: 'OUT',
        movementType: 'PRODUCTION_ISSUE',
        categoryHintModule: 'PURCHASE',
        qty,
        unitWeight: uw,
        weight: Math.abs(parseFloat(r.total_wt) || (qty * uw)),
        sourceModule: 'GRAIN_INPUT',
        sourceTable: 'grain_input_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: `GRD-${header.s_no || sId}`,
        isPhysicalStock: !hasOutpass
      });
    }
    const outputs = await runner.all(`SELECT * FROM grain_output_items WHERE grain_id = ? ORDER BY id ASC`, [sId]);
    for (const r of outputs) {
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 50;
      await postOne({
        movementDate: header.date,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        parentLotNo: parentLot,
        supplierName: parentSup,
        godownId: gdw.fgGodown.id,
        godownName: gdw.fgGodown.godown_name,
        partyName: header.flour_mill || '',
        direction: 'IN',
        movementType: 'PRODUCTION_OUTPUT',
        categoryHintModule: 'GRAIN_OUTPUT',
        qty,
        unitWeight: uw,
        weight: Math.abs(parseFloat(r.total_wt) || (qty * uw)),
        sourceModule: 'GRAIN_OUTPUT',
        sourceTable: 'grain_output_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: `GRD-${header.s_no || sId}`,
        isPhysicalStock: !hasInpass
      });
    }
    const wastages = await runner.all(`SELECT * FROM grain_wastage_items WHERE grain_id = ? ORDER BY id ASC`, [sId]);
    for (const r of wastages) {
      const subtype = classifyWastageSubtype({ itemName: r.item_name, category: r.category, lotNo: r.lot_no });
      const isProcessLoss = subtype === 'PROCESS_LOSS';
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 1;
      await postOne({
        movementDate: header.date,
        itemName: r.item_name,
        stockCategory: 'Wastage',
        lotNo: r.lot_no || '',
        parentLotNo: parentLot,
        godownId: gdw.defaultGodown.id,
        godownName: gdw.defaultGodown.godown_name,
        partyName: header.flour_mill || '',
        direction: isProcessLoss ? 'OUT' : 'IN',
        movementType: isProcessLoss ? 'PROCESS_LOSS' : 'WASTAGE_RECOVERY',
        qty,
        unitWeight: uw,
        weight: Math.abs(parseFloat(r.total_wt) || (qty * uw)),
        sourceModule: 'GRAIN_WASTAGE',
        sourceTable: 'grain_wastage_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: `GRD-${header.s_no || sId}`,
        isPhysicalStock: !isProcessLoss && !hasInpass
      });
    }
  } else if (mod === 'PACKING') {
    const header = await runner.get(`SELECT * FROM packing WHERE id = ?`, [sId]);
    if (!header) return { synced: 0 };
    const items = await runner.all(`SELECT * FROM packing_items WHERE packing_id = ? ORDER BY id ASC`, [sId]);
    for (const r of items) {
      const rem = String(r.remarks || '').toLowerCase();
      const sec = String(r.section || '').toLowerCase();
      const isTo = rem === 'section:to' || sec === 'to';
      const isMaterial = rem === 'section:material' || sec === 'material';
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 0;
      await postOne({
        movementDate: header.date,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: gdw.fgGodown.id,
        godownName: gdw.fgGodown.godown_name,
        direction: isTo ? 'IN' : 'OUT',
        movementType: isTo ? 'PACKING_IN' : (isMaterial ? 'PACKING_MATERIAL_OUT' : 'PACKING_OUT'),
        categoryHintModule: isTo ? 'PACKING_TO' : (isMaterial ? 'PACKING_MATERIAL' : 'GRAIN_OUTPUT'),
        qty,
        unitWeight: uw,
        weight: Math.abs(parseFloat(r.tot_wt) || (qty * uw)),
        sourceModule: isTo ? 'PACKING_TO' : (isMaterial ? 'PACKING_MATERIAL' : 'PACKING_FROM'),
        sourceTable: 'packing_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: `PK-${header.s_no || sId}`
      });
    }
  } else if (mod === 'WEIGHT_CONVERSION') {
    const header = await runner.get(`SELECT * FROM weight_conversion WHERE id = ?`, [sId]);
    if (!header) return { synced: 0 };
    const items = await runner.all(`SELECT * FROM weight_conversion_items WHERE CAST(weight_conversion_id AS TEXT) = CAST(? AS TEXT) ORDER BY id ASC`, [sId]);
    for (const r of items) {
      const t = String(r.type || 'input').toLowerCase();
      const isOutput = t === 'output' || t === 'to';
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 0;
      await postOne({
        movementDate: header.date,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: gdw.defaultGodown.id,
        godownName: gdw.defaultGodown.godown_name,
        direction: isOutput ? 'IN' : 'OUT',
        movementType: isOutput ? 'WEIGHT_CONVERSION_IN' : 'WEIGHT_CONVERSION_OUT',
        categoryHintModule: 'GRAIN_OUTPUT',
        qty,
        unitWeight: uw,
        weight: Math.abs(parseFloat(r.total_wt) || (qty * uw)),
        sourceModule: isOutput ? 'WEIGHT_CONVERSION_TO' : 'WEIGHT_CONVERSION_FROM',
        sourceTable: 'weight_conversion_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: `WC-${header.s_no || sId}`
      });
    }
  } else if (mod === 'SALES') {
    const header = await runner.get(`SELECT * FROM sales WHERE id = ?`, [sId]);
    if (!header || Number(header.is_order || 0) === 1) return { synced: 0 };
    const items = await runner.all(`SELECT * FROM sales_items WHERE sales_id = ? ORDER BY id ASC`, [sId]);
    for (const r of items) {
      const g = gdw.findG(r.godown_id || header.godown_from_id, r.godown_name, gdw.fgGodown);
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 50;
      await postOne({
        movementDate: header.date,
        itemId: r.item_id || null,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        parentLotNo: r.parent_rm_lot_no || '',
        godownId: g.id,
        godownName: g.godown_name,
        partyName: header.customer || '',
        direction: 'OUT',
        movementType: 'SALES_DISPATCH',
        categoryHintModule: 'SALES',
        qty,
        unitWeight: uw,
        weight: Math.abs(parseFloat(r.total_wt) || (qty * uw)),
        rate: parseFloat(r.rate) || 0,
        sourceModule: 'SALES',
        sourceTable: 'sales_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: `INV-${header.s_no || sId}`
      });
    }
  } else if (mod === 'SALES_EXPORT_ORDER') {
    const header = await runner.get(`SELECT * FROM sales_export_orders WHERE id = ?`, [sId]);
    if (!header || Number(header.is_order || 0) === 1) return { synced: 0 };
    const items = await runner.all(`SELECT * FROM sales_export_order_items WHERE sales_export_order_id = ? ORDER BY id ASC`, [sId]);
    for (const r of items) {
      await postOne({
        movementDate: header.date,
        itemName: r.description,
        lotNo: r.lot_no || '',
        godownId: gdw.fgGodown.id,
        godownName: gdw.fgGodown.godown_name,
        partyName: header.consignee || '',
        direction: 'OUT',
        movementType: 'SALES_DISPATCH',
        categoryHintModule: 'SALES',
        qty: Math.abs(parseFloat(r.qty) || 0),
        weight: Math.abs(parseFloat(r.qty_in_kg) || 0),
        sourceModule: 'SALES_EXPORT_ORDER',
        sourceTable: 'sales_export_order_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: header.bill_no || `EXP-${sId}`
      });
    }
  } else if (mod === 'SALES_RETURN') {
    const header = await runner.get(`SELECT * FROM sales_return WHERE id = ?`, [sId]);
    if (!header) return { synced: 0 };
    const approvalSt = String(header.approval_status || '').trim().toUpperCase();
    if (approvalSt !== 'APPROVED') {
      return { synced: 0 };
    }
    const items = await runner.all(`SELECT * FROM sales_return_items WHERE sales_return_id = ? ORDER BY id ASC`, [sId]);
    for (const r of items) {
      const disp = String(r.stock_disposition || header.stock_disposition || header.stock_status || '').trim().toLowerCase();
      if (disp !== 'resalable' && disp !== 'good / resalable') {
        continue;
      }
      const destGodown = gdw.findG(
        r.destination_godown_id || header.destination_godown_id,
        r.destination_godown_name || header.destination_godown_name,
        gdw.fgGodown
      );
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 50;
      await postOne({
        movementDate: header.date,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: destGodown.id,
        godownName: destGodown.godown_name,
        partyName: header.customer || '',
        direction: 'IN',
        movementType: 'SALES_RETURN',
        categoryHintModule: 'SALES_RETURN',
        qty,
        unitWeight: uw,
        weight: Math.abs(parseFloat(r.return_weight) || parseFloat(r.total_wt) || (qty * uw)),
        rate: parseFloat(r.rate) || 0,
        amount: parseFloat(r.total_amt) || 0,
        sourceModule: 'SALES_RETURN',
        sourceTable: 'sales_return_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: header.return_no || `SR-${header.s_no || sId}`,
        remarks: header.remarks || ''
      });
    }
  } else if (mod === 'STOCK_ADJUST') {
    const header = await runner.get(`SELECT * FROM stock_adjustments WHERE id = ?`, [sId]);
    if (!header) return { synced: 0 };
    const items = await runner.all(`SELECT * FROM stock_adjustment_items WHERE stock_adjustment_id = ? ORDER BY id ASC`, [sId]);
    for (const r of items) {
      const t = String(r.type || header.type || '').toLowerCase();
      const isOut = t.includes('deduct') || t.includes('reduce') || t.includes('issue') || t.includes('damage') || t.includes('wastage') || t.includes('less') || t === 'out';
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 0;
      await postOne({
        movementDate: header.date,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: gdw.defaultGodown.id,
        godownName: gdw.defaultGodown.godown_name,
        direction: isOut ? 'OUT' : 'IN',
        movementType: isOut ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN',
        qty,
        unitWeight: uw,
        weight: Math.abs(parseFloat(r.tot_wt) || (qty * uw)),
        sourceModule: 'STOCK_ADJUST',
        sourceTable: 'stock_adjustment_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: `SA-${header.s_no || sId}`,
        remarks: r.remarks || header.remarks || ''
      });
    }
  } else if (mod === 'ITEM_TRANSFER' || mod === 'GODOWN_TRANSFER') {
    const r = mod === 'ITEM_TRANSFER'
      ? await runner.get(`SELECT id, transfer_no, date, from_godown_id, from_godown_name, to_godown_id, to_godown_name, item_id, item_name, lot_no, transfer_qty as qty, weight, rate, remarks FROM item_transfers WHERE id = ?`, [sId])
      : await runner.get(`SELECT id, s_no as transfer_no, transfer_date as date, from_godown_id, from_godown_name, to_godown_id, to_godown_name, NULL as item_id, item_name, lot_no, qty, CASE WHEN COALESCE(qty,0)>0 THEN COALESCE(weight,0)/qty ELSE 0 END as weight, 0 as rate, remarks FROM godown_transfers WHERE id = ?`, [sId]);
    if (!r) return { synced: 0 };
    const qty = Math.abs(parseFloat(r.qty) || 0);
    const uw = parseFloat(r.weight) || 50;
    const totWt = round3(qty * uw);
    const fromG = gdw.findG(r.from_godown_id, r.from_godown_name, gdw.defaultGodown);
    const toG = gdw.findG(r.to_godown_id, r.to_godown_name, gdw.defaultGodown);
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

    await postOne({
      postingKey: buildPostingKey({ companyId: cId, sourceModule: mod, sourceId: sId, sourceLineId: 1, direction: 'OUT', movementType: 'TRANSFER_OUT' }),
      movementDate: r.date,
      itemId: r.item_id,
      itemName: r.item_name,
      lotNo: outLotNo,
      parentLotNo: r.lot_no || '',
      godownId: fromG.id,
      godownName: fromG.godown_name,
      direction: 'OUT',
      movementType: 'TRANSFER_OUT',
      qty,
      unitWeight: uw,
      weight: totWt,
      sourceModule: mod,
      sourceTable: mod === 'ITEM_TRANSFER' ? 'item_transfers' : 'godown_transfers',
      sourceId: sId,
      sourceLineId: 1,
      sourceRefNo: r.transfer_no ? `TRF-${r.transfer_no}` : `TRF-${sId}`
    });
    await postOne({
      postingKey: buildPostingKey({ companyId: cId, sourceModule: mod, sourceId: sId, sourceLineId: 2, direction: 'IN', movementType: 'TRANSFER_IN' }),
      movementDate: r.date,
      itemId: r.item_id,
      itemName: r.item_name,
      lotNo: isToCs && !String(r.lot_no || '').toUpperCase().startsWith('CS-') ? `CS-${r.lot_no}` : (r.lot_no || ''),
      parentLotNo: r.lot_no || '',
      godownId: toG.id,
      godownName: toG.godown_name,
      direction: 'IN',
      movementType: 'TRANSFER_IN',
      qty,
      unitWeight: uw,
      weight: totWt,
      sourceModule: mod,
      sourceTable: mod === 'ITEM_TRANSFER' ? 'item_transfers' : 'godown_transfers',
      sourceId: sId,
      sourceLineId: 2,
      sourceRefNo: r.transfer_no ? `TRF-${r.transfer_no}` : `TRF-${sId}`
    });
  } else if (mod === 'OUTPASS') {
    const header = await runner.get(`SELECT * FROM outpasses WHERE id = ?`, [sId]);
    if (!header || String(header.status || '').toUpperCase() === 'CANCELLED') return { synced: 0 };
    // Sales-linked Outpasses are Gate Dispatch Documents; the Sale itself handles physical stock deduction (never double-deduct!)
    if (String(header.reference_type || '').toUpperCase() === 'SALES' || String(header.purpose || '').toLowerCase() === 'sales dispatch') {
      return { synced: 0 };
    }
    const items = await runner.all(`SELECT * FROM outpass_items WHERE outpass_id = ? ORDER BY id ASC`, [sId]);
    for (const r of items) {
      const g = gdw.findG(r.godown_id || header.from_godown_id, r.godown_name || header.from_godown_name, gdw.rmGodown);
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 50;
      await postOne({
        movementDate: header.date,
        itemId: r.item_id,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: g.id,
        godownName: g.godown_name,
        partyName: header.party_name || '',
        direction: 'OUT',
        movementType: 'OUTPASS_OUT',
        qty,
        unitWeight: uw,
        weight: Math.abs(parseFloat(r.total_weight) || (qty * uw)),
        sourceModule: 'OUTPASS',
        sourceTable: 'outpass_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: header.outpass_no || `OP-${sId}`
      });
    }
  } else if (mod === 'INPASS') {
    const header = await runner.get(`SELECT * FROM inpasses WHERE id = ?`, [sId]);
    if (!header || String(header.status || '').toUpperCase() === 'CANCELLED') return { synced: 0 };
    const items = await runner.all(`SELECT * FROM inpass_items WHERE inpass_id = ? ORDER BY id ASC`, [sId]);
    for (const r of items) {
      const ot = String(r.output_type || '').toUpperCase();
      const isWastage = ot.includes('WASTAGE') || ot.includes('BYPRODUCT');
      const isProcessLoss = ot.includes('LOSS');
      const g = gdw.findG(r.godown_id || header.to_godown_id, r.godown_name || header.to_godown_name, isWastage ? gdw.defaultGodown : gdw.fgGodown);
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 50;
      await postOne({
        movementDate: header.date,
        itemId: r.item_id,
        itemName: r.item_name,
        stockCategory: isWastage ? 'Wastage' : null,
        lotNo: r.lot_no || '',
        parentLotNo: r.original_lot_no || '',
        godownId: g.id,
        godownName: g.godown_name,
        partyName: header.party_name || '',
        direction: isProcessLoss ? 'OUT' : 'IN',
        movementType: isProcessLoss ? 'PROCESS_LOSS' : 'INPASS_IN',
        categoryHintModule: 'INPASS_OUTPUT',
        qty,
        unitWeight: uw,
        weight: Math.abs(parseFloat(r.total_weight) || (qty * uw)),
        sourceModule: 'INPASS',
        sourceTable: 'inpass_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: header.inpass_no || `IP-${sId}`,
        isPhysicalStock: !isProcessLoss
      });
    }
  } else if (mod === 'COLD_STORAGE') {
    const header = await runner.get(`SELECT * FROM cold_storage_vouchers WHERE id = ?`, [sId]);
    if (!header || String(header.status || '').toUpperCase() === 'CANCELLED') return { synced: 0 };
    const remLower = String(header.remarks || '').toLowerCase();
    if (
      remLower.includes('auto-created from') ||
      remLower.includes('auto-inward from purchase') ||
      remLower.includes('auto-sync from stock lot')
    ) {
      return { synced: 0 };
    }
    const items = await runner.all(`SELECT * FROM cold_storage_items WHERE voucher_id = ? ORDER BY id ASC`, [sId]);
    const csG = gdw.findG(header.cold_storage_id, header.cold_storage_name, gdw.csGodown || { id: null, godown_name: header.cold_storage_name || 'Cold Storage' });
    const vType = String(header.voucher_type || 'IN').toUpperCase();
    for (const r of items) {
      const qty = Math.abs(parseFloat(r.quantity) || 0);
      const uw = parseFloat(r.weight) || 50;
      const totWt = Math.abs(parseFloat(r.total_wt) || (qty * uw));
      if (vType === 'IN') {
        await postOne({
          postingKey: buildPostingKey({ companyId: cId, sourceModule: 'COLD_STORAGE', sourceId: sId, sourceLineId: r.id, direction: 'IN', movementType: 'COLD_STORAGE_IN' }),
          movementDate: header.voucher_date,
          itemId: r.item_id,
          itemName: r.item_name,
          lotNo: r.cold_storage_lot_no || r.purchase_lot_no || '',
          parentLotNo: r.purchase_lot_no || '',
          supplierName: header.supplier_name || '',
          godownId: csG.id,
          godownName: csG.godown_name,
          storageType: 'Cold Storage',
          direction: 'IN',
          movementType: 'COLD_STORAGE_IN',
          qty,
          unitWeight: uw,
          weight: totWt,
          sourceModule: 'COLD_STORAGE',
          sourceTable: 'cold_storage_items',
          sourceId: sId,
          sourceLineId: r.id,
          sourceRefNo: header.voucher_no
        });
        if ((header.source_godown_id || header.source_godown_name) && String(header.inward_source_type || '').toLowerCase() !== 'direct purchase') {
          const srcG = gdw.findG(header.source_godown_id, header.source_godown_name, gdw.defaultGodown);
          await postOne({
            postingKey: buildPostingKey({ companyId: cId, sourceModule: 'COLD_STORAGE', sourceId: sId, sourceLineId: r.id, direction: 'OUT', movementType: 'TRANSFER_OUT' }),
            movementDate: header.voucher_date,
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
            unitWeight: uw,
            weight: totWt,
            sourceModule: 'COLD_STORAGE',
            sourceTable: 'cold_storage_items',
            sourceId: sId,
            sourceLineId: r.id,
            sourceRefNo: header.voucher_no
          });
        }
      } else {
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
        await postOne({
          postingKey: buildPostingKey({ companyId: cId, sourceModule: 'COLD_STORAGE', sourceId: sId, sourceLineId: r.id, direction: 'OUT', movementType: 'COLD_STORAGE_OUT' }),
          movementDate: header.voucher_date,
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
          unitWeight: uw,
          weight: totWt,
          sourceModule: 'COLD_STORAGE',
          sourceTable: 'cold_storage_items',
          sourceId: sId,
          sourceLineId: r.id,
          sourceRefNo: header.voucher_no
        });
        const isDirectCust = String(header.outward_dest_type || '').toLowerCase().includes('customer') || String(header.outward_dest_type || '').toLowerCase().includes('sale');
        if (!isDirectCust && (header.destination_godown_id || header.destination_godown_name)) {
          const destG = gdw.findG(header.destination_godown_id, header.destination_godown_name, gdw.defaultGodown);
          await postOne({
            postingKey: buildPostingKey({ companyId: cId, sourceModule: 'COLD_STORAGE', sourceId: sId, sourceLineId: r.id, direction: 'IN', movementType: 'TRANSFER_IN' }),
            movementDate: header.voucher_date,
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
            unitWeight: uw,
            weight: totWt,
            sourceModule: 'COLD_STORAGE',
            sourceTable: 'cold_storage_items',
            sourceId: sId,
            sourceLineId: r.id,
            sourceRefNo: header.voucher_no
          });
        }
      }
    }
  } else if (mod === 'FLOUR_OUT') {
    const header = await runner.get(`SELECT * FROM flour_out WHERE id = ?`, [sId]);
    if (!header) return { synced: 0 };
    const items = await runner.all(`SELECT * FROM flour_out_items WHERE flour_out_id = ? ORDER BY id ASC`, [sId]);
    for (const r of items) {
      if (!r.item_name) continue;
      const qty = Math.abs(parseFloat(r.qty) || 0);
      const uw = parseFloat(r.weight) || 0;
      await postOne({
        movementDate: header.date,
        createdAt: header.created_at,
        itemName: r.item_name,
        lotNo: r.lot_no || '',
        godownId: gdw.defaultGodown.id,
        godownName: gdw.defaultGodown.godown_name,
        partyName: header.papad_company || '',
        direction: 'OUT',
        movementType: 'OUTPASS_OUT',
        categoryHintModule: 'GRAIN_OUTPUT',
        qty,
        unitWeight: uw,
        weight: Math.abs(parseFloat(r.total_wt) || (qty * uw)),
        sourceModule: 'FLOUR_OUT',
        sourceTable: 'flour_out_items',
        sourceId: sId,
        sourceLineId: r.id,
        sourceRefNo: `FO-${header.s_no || sId}`
      });
    }
  } else if (mod === 'PAPAD_IN') {
    const r = await runner.get(`SELECT * FROM papad_in WHERE id = ?`, [sId]);
    if (!r || !r.item_name) return { synced: 0 };
    const qty = Math.abs(parseFloat(r.qty) || 0);
    const uw = parseFloat(r.weight) || 1;
    await postOne({
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
      unitWeight: uw,
      weight: Math.abs(qty * uw),
      rate: parseFloat(r.rate) || 0,
      amount: parseFloat(r.amount) || 0,
      sourceModule: 'PAPAD_IN',
      sourceTable: 'papad_in',
      sourceId: sId,
      sourceLineId: sId,
      sourceRefNo: `PI-${r.s_no || sId}`
    });
  } else if (mod === 'HAND_SORTING') {
    const r = await runner.get(`SELECT * FROM hand_sorting_jobs WHERE id = ?`, [sId]);
    if (!r) return { synced: 0 };
    const sDate = r.sorting_date || r.date || new Date().toISOString().slice(0, 10);
    if (r.input_item_name && (parseFloat(r.input_qty) > 0 || parseFloat(r.input_weight) > 0)) {
      await postOne({
        postingKey: buildPostingKey({ companyId: cId, sourceModule: 'HAND_SORTING', sourceId: sId, sourceLineId: 1, direction: 'OUT', movementType: 'PRODUCTION_ISSUE' }),
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
        sourceId: sId,
        sourceLineId: 1,
        sourceRefNo: r.job_no || `HS-${sId}`
      });
    }
    if (r.output_item_name && (parseFloat(r.output_qty) > 0 || parseFloat(r.output_weight) > 0)) {
      await postOne({
        postingKey: buildPostingKey({ companyId: cId, sourceModule: 'HAND_SORTING', sourceId: sId, sourceLineId: 2, direction: 'IN', movementType: 'PRODUCTION_OUTPUT' }),
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
        sourceId: sId,
        sourceLineId: 2,
        sourceRefNo: r.job_no || `HS-${sId}`
      });
    }
  }

  return { synced };
}

module.exports = {
  syncDocumentMovements,
  deleteDocumentMovements
};
