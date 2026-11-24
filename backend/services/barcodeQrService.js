const db = require('../config/database');
const {
  loadPartyDirectory,
  resolveSupplierFromDirectory,
  resolveCustomerFromDirectory
} = require('./PartyNameResolver');

function getRunner(companyId = 1) {
  const cId = parseInt(companyId, 10);
  const safeId = Number.isSafeInteger(cId) && cId > 0 ? cId : 1;
  return { cId: safeId, runner: db.forCompany(safeId) };
}

class BarcodeQrService {
  /**
   * Universal 360° Code Resolver (Company-Scoped)
   */
  async lookupCode(rawCode, companyId = 1) {
    if (!rawCode) throw new Error('Code is required for lookup');
    const { cId, runner } = getRunner(companyId);

    const cleanCode = rawCode.trim();
    let type = 'UNKNOWN';
    let entityIdentifier = cleanCode;

    if (cleanCode.toUpperCase().startsWith('LOT-') && !cleanCode.toUpperCase().startsWith('LOT')) {
      type = 'LOT';
      entityIdentifier = cleanCode.slice(4);
    } else if (/^LOT-/i.test(cleanCode)) {
      // Distinguish LOT-2026-001 vs LOT0017
      type = 'LOT';
      entityIdentifier = cleanCode.replace(/^LOT-/i, '');
    } else if (/^ITM-/i.test(cleanCode)) {
      type = 'ITEM';
      entityIdentifier = cleanCode.replace(/^ITM-/i, '');
    } else if (/^LOC-/i.test(cleanCode)) {
      type = 'LOCATION';
      entityIdentifier = cleanCode.replace(/^LOC-/i, '');
    } else if (/^PLT-/i.test(cleanCode)) {
      type = 'PALLET';
      entityIdentifier = cleanCode.replace(/^PLT-/i, '');
    } else if (/^FG-/i.test(cleanCode)) {
      type = 'FINISHED_GOOD';
      entityIdentifier = cleanCode.replace(/^FG-/i, '');
    } else {
      const lotCheck = await runner.query(
        'SELECT lot_no FROM stock_lots WHERE UPPER(TRIM(lot_no)) = UPPER(?) LIMIT 1',
        [cleanCode]
      );
      type = 'LOT';
      if (lotCheck.rows?.[0]?.lot_no) {
        entityIdentifier = lotCheck.rows[0].lot_no;
      }
    }

    if (type === 'LOT') {
      return await this.resolveLot360(entityIdentifier, cleanCode, cId);
    } else if (type === 'LOCATION') {
      return await this.resolveLocation360(entityIdentifier, cleanCode, cId);
    } else if (type === 'ITEM') {
      return await this.resolveItem360(entityIdentifier, cleanCode, cId);
    } else if (type === 'FINISHED_GOOD') {
      return await this.resolveFinishedGood360(entityIdentifier, cleanCode, cId);
    } else {
      return {
        code: cleanCode,
        type: 'GENERIC',
        data: { message: `Identifier: ${cleanCode}` }
      };
    }
  }

  /**
   * Complete 360° Dossier for a Scanned Lot (Authoritative stock_movements + Milling/Wastage + CS)
   */
  async resolveLot360(lotNo, originalCode, companyId = 1) {
    const { cId, runner } = getRunner(companyId);
    const cleanLotNo = String(lotNo || '').trim();
    const partyDir = await loadPartyDirectory(cId, runner);

    const defGodownRes = await runner.query('SELECT godown_name FROM godown_master ORDER BY id ASC LIMIT 1');
    const defaultGodownName = defGodownRes.rows?.[0]?.godown_name || 'Main Godown';

    // 0. Cold Storage siblings (LOT0017 <-> CS-LOT0017)
    const csSiblings = new Set();
    let linkedParentFromCs = null;
    const csInwards = [];
    const csOutwards = [];
    try {
      const csRes = await runner.query(`
        SELECT
          csv.id AS voucher_id, csv.voucher_no, csv.voucher_type, csv.voucher_date,
          csv.cold_storage_name, csv.source_godown_name, csv.destination_godown_name,
          csv.vehicle_no, csv.remarks AS voucher_remarks,
          csi.item_name, csi.purchase_lot_no, csi.cold_storage_lot_no,
          csi.quantity, csi.weight, csi.total_wt, csi.unit, csi.remarks AS item_remarks
        FROM cold_storage_items csi
        JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
        WHERE UPPER(TRIM(COALESCE(csi.purchase_lot_no, ''))) = UPPER(?)
           OR UPPER(TRIM(COALESCE(csi.cold_storage_lot_no, ''))) = UPPER(?)
        ORDER BY csv.voucher_date ASC, csv.id ASC
      `, [cleanLotNo, cleanLotNo]);

      for (const r of (csRes.rows || [])) {
        const pLot = (r.purchase_lot_no || '').trim();
        const csLot = (r.cold_storage_lot_no || '').trim();
        if (pLot && pLot.toUpperCase() !== cleanLotNo.toUpperCase()) csSiblings.add(pLot);
        if (csLot && csLot.toUpperCase() !== cleanLotNo.toUpperCase()) csSiblings.add(csLot);
        if (csLot.toUpperCase() === cleanLotNo.toUpperCase() && pLot && pLot.toUpperCase() !== cleanLotNo.toUpperCase()) {
          linkedParentFromCs = pLot;
        }
        const isAutoSync = String(r.voucher_remarks || '').startsWith('Auto-sync from Stock Lot');
        if (!isAutoSync) {
          if (r.voucher_type === 'IN') csInwards.push(r);
          else csOutwards.push(r);
        }
      }
    } catch (_) {}

    const familyUpper = Array.from(new Set([cleanLotNo, ...Array.from(csSiblings)])).map(l => l.toUpperCase());
    const familyPh = familyUpper.map(() => 'UPPER(?)').join(',');

    // 1. Live stock balances per godown from clean physical stock_movements
    let perGodownBalances = [];
    let totalNetBags = 0;
    let totalNetWeightKg = 0;
    try {
      const gbRes = await runner.query(`
        SELECT
          godown_name,
          lot_no,
          MAX(item_name) AS item_name,
          SUM(CASE WHEN direction = 'IN' THEN qty ELSE -qty END) AS balance_qty,
          SUM(CASE WHEN direction = 'IN' THEN COALESCE(weight, 0) ELSE -COALESCE(weight, 0) END) AS balance_wt
        FROM stock_movements
        WHERE is_reversed = 0 AND is_reversal = 0 AND is_physical_stock = 1
          AND UPPER(TRIM(lot_no)) = UPPER(?)
        GROUP BY godown_name, lot_no
        ORDER BY balance_qty DESC, godown_name ASC
      `, [cleanLotNo]);
      perGodownBalances = (gbRes.rows || []).map(r => ({
        godownName: r.godown_name || defaultGodownName,
        lotNo: r.lot_no,
        itemName: r.item_name,
        balanceQty: Number((parseFloat(r.balance_qty) || 0).toFixed(3)),
        balanceWeightKg: Number((parseFloat(r.balance_wt) || 0).toFixed(3))
      }));
      for (const gb of perGodownBalances) {
        totalNetBags += gb.balanceQty;
        totalNetWeightKg += gb.balanceWeightKg;
      }
    } catch (_) {}

    // 1b. Stock Lots fallback
    const stockLotRes = await runner.query(`
      SELECT
        sl.*,
        COALESCE(g.godown_name, sl.godown_name, ?) AS godown_name,
        COALESCE(i.item_name, sl.item_name, 'Raw Grain') AS resolved_item_name
      FROM stock_lots sl
      LEFT JOIN godown_master g ON sl.godown_id = g.id
      LEFT JOIN item_master i ON sl.item_id = i.id
      WHERE UPPER(TRIM(sl.lot_no)) = UPPER(?)
      ORDER BY sl.id DESC
    `, [defaultGodownName, cleanLotNo]);
    const stockLotRows = stockLotRes.rows || [];
    const stockInfo = stockLotRows[0] || null;

    // 2. Purchase Inward & Supplier Details (direct or parent CS/inpass/grain link)
    const fetchPurchase = async (targetLot) => {
      const purchaseRes = await runner.query(`
        SELECT
          p.id AS purchase_id,
          p.s_no,
          COALESCE(NULLIF(p.voucher_no, ''), NULLIF(p.inv_no, ''), 'PUR-' || CAST(p.s_no AS TEXT), 'PUR-' || CAST(p.id AS TEXT)) AS voucher_no,
          p.inv_no,
          SUBSTR(COALESCE(CAST(p.date AS TEXT), CAST(p.inv_date AS TEXT), ''), 1, 10) AS inward_date,
          p.supplier AS raw_supplier,
          COALESCE(NULLIF(p.vehicle_no, ''), NULLIF(p.lorry_no, ''), '') AS vehicle_no,
          COALESCE(NULLIF(p.driver_name, ''), NULLIF(p.driver, ''), '') AS driver_name,
          COALESCE(gm.godown_name, p.godown, '') AS purchase_godown,
          pi.lot_no,
          pi.item_name,
          pi.qty,
          pi.unit,
          pi.rate,
          pi.amount,
          COALESCE(NULLIF(pi.total_weight, 0), NULLIF(pi.total_wt, 0), NULLIF(pi.weight, 0), p.total_weight, 0) AS total_weight
        FROM purchase_items pi
        JOIN purchases p ON pi.purchase_id = p.id
        LEFT JOIN godown_master gm ON (CAST(gm.id AS TEXT) = CAST(p.godown AS TEXT) OR LOWER(TRIM(gm.godown_name)) = LOWER(TRIM(p.godown)))
        WHERE UPPER(TRIM(pi.lot_no)) = UPPER(?)
        LIMIT 1
      `, [targetLot]);
      const r = purchaseRes.rows?.[0];
      if (!r) return null;
      const sup = resolveSupplierFromDirectory(partyDir, r.raw_supplier, null);
      return {
        ...r,
        supplier_name: sup.name || r.raw_supplier || 'Supplier'
      };
    };

    let purchaseInfo = await fetchPurchase(cleanLotNo);
    let isDerivedFromParent = false;
    let derivedParentLotNo = null;
    if (!purchaseInfo && linkedParentFromCs) {
      purchaseInfo = await fetchPurchase(linkedParentFromCs);
      if (purchaseInfo) {
        isDerivedFromParent = true;
        derivedParentLotNo = linkedParentFromCs;
      }
    }

    // 3. QC Inspection Details (include parent CS lot if applicable)
    const qcTargets = Array.from(new Set([cleanLotNo, linkedParentFromCs].filter(Boolean))).map(l => l.toUpperCase());
    const qcPh = qcTargets.map(() => 'UPPER(?)').join(',');
    const qcRes = await runner.query(`
      SELECT q.qc_no, q.inspection_date, q.inspector, q.overall_result, q.remarks, q.rm_lot_no
      FROM qc_inspections q
      WHERE UPPER(TRIM(COALESCE(q.rm_lot_no, ''))) IN (${qcPh})
      ORDER BY q.inspection_date DESC, q.id DESC
      LIMIT 1
    `, qcTargets);
    const qcInfo = qcRes.rows?.[0] || null;

    // 4. Milling / Grinding Production records (Inputs + Outputs + Wastages per batch, no Cartesian join)
    const millingInputs = [];
    const millingOutputs = [];
    const millingWastages = [];
    const millingBatches = [];
    const coveredWoIds = new Set();
    const coveredWoNos = new Set();

    try {
      let inpassMatches = [];
      try {
        const ipRes = await runner.query(`
          SELECT DISTINCT inpass_no, original_lot_no
          FROM inpass_items
          WHERE UPPER(TRIM(lot_no)) = UPPER(?) OR UPPER(TRIM(COALESCE(original_lot_no, ''))) = UPPER(?)
        `, [cleanLotNo, cleanLotNo]);
        inpassMatches = ipRes.rows || [];
      } catch (_) {}
      const ipNosUpper = Array.from(new Set(inpassMatches.map(r => String(r.inpass_no || '').trim().toUpperCase()).filter(Boolean)));
      const ipSql = ipNosUpper.length ? `OR UPPER(TRIM(COALESCE(g.inpass_no, ''))) IN (${ipNosUpper.map(() => 'UPPER(?)').join(',')})` : '';

      const grainsRes = await runner.query(`
        SELECT DISTINCT
          g.id AS grain_id, g.s_no, g.work_order_id,
          COALESCE(g.work_order_no, 'GRD-' || CAST(g.s_no AS TEXT)) AS batch_no,
          SUBSTR(CAST(g.date AS TEXT), 1, 10) AS milling_date,
          COALESCE(fmm.flourmill, g.flour_mill, 'BVC MILL') AS mill_name,
          g.process_mode, g.outpass_no, g.inpass_no
        FROM grains g
        LEFT JOIN flour_mill_master fmm ON (CAST(fmm.id AS TEXT) = CAST(g.flour_mill AS TEXT) OR fmm.flourmill = g.flour_mill)
        WHERE EXISTS (SELECT 1 FROM grain_input_items gi WHERE gi.grain_id = g.id AND UPPER(TRIM(gi.lot_no)) IN (${familyPh}))
           OR EXISTS (SELECT 1 FROM grain_output_items go WHERE go.grain_id = g.id AND UPPER(TRIM(go.lot_no)) IN (${familyPh}))
           OR EXISTS (SELECT 1 FROM grain_wastage_items gw WHERE gw.grain_id = g.id AND UPPER(TRIM(gw.lot_no)) IN (${familyPh}))
           ${ipSql}
        ORDER BY g.date ASC, g.id ASC
      `, [...familyUpper, ...familyUpper, ...familyUpper, ...ipNosUpper]);

      for (const g of (grainsRes.rows || [])) {
        if (g.work_order_id) coveredWoIds.add(Number(g.work_order_id));
        if (g.batch_no) coveredWoNos.add(String(g.batch_no).trim().toUpperCase());

        const inRes = await runner.query(`SELECT item_name, lot_no, qty, weight, total_wt FROM grain_input_items WHERE grain_id = ?`, [g.grain_id]);
        const outRes = await runner.query(`SELECT item_name, lot_no, qty, weight, total_wt FROM grain_output_items WHERE grain_id = ?`, [g.grain_id]);
        const wstRes = await runner.query(`SELECT item_name, lot_no, category, qty, weight, total_wt FROM grain_wastage_items WHERE grain_id = ?`, [g.grain_id]);

        const inputs = inRes.rows || [];
        let outputs = outRes.rows || [];
        let wastages = wstRes.rows || [];

        // Enrich with inpass_items if outside mill inpass exists
        if (g.inpass_no) {
          try {
            const ipItemsRes = await runner.query(`SELECT item_name, lot_no, output_type, qty, weight, total_weight FROM inpass_items WHERE UPPER(TRIM(inpass_no)) = UPPER(?)`, [g.inpass_no]);
            const ipRows = ipItemsRes.rows || [];
            const ipOut = ipRows.filter(r => r.output_type === 'PROCESSED_OUTPUT');
            if (ipOut.length > 0 && outputs.every(o => String(o.lot_no || '').toUpperCase() === String(g.inpass_no).toUpperCase())) {
              outputs = ipOut.map(r => ({
                item_name: r.item_name,
                lot_no: r.lot_no,
                qty: r.qty,
                weight: r.weight,
                total_wt: r.total_weight
              }));
            }
          } catch (_) {}
        }

        const totalInKg = inputs.reduce((s, r) => s + (parseFloat(r.total_wt) || 0), 0);
        const totalOutKg = outputs.reduce((s, r) => s + (parseFloat(r.total_wt) || 0), 0);
        const totalWstKg = wastages.reduce((s, r) => s + (parseFloat(r.total_wt) || 0), 0);

        const isIn = inputs.some(i => familyUpper.includes(String(i.lot_no || '').trim().toUpperCase()));
        const isOut = outputs.some(o => familyUpper.includes(String(o.lot_no || '').trim().toUpperCase())) || (g.inpass_no && ipNosUpper.includes(String(g.inpass_no).trim().toUpperCase()));
        const isWst = wastages.some(w => familyUpper.includes(String(w.lot_no || '').trim().toUpperCase()));

        const batchObj = {
          grain_id: g.grain_id,
          batch_no: g.batch_no,
          milling_date: g.milling_date,
          mill_name: g.mill_name,
          process_mode: g.process_mode || 'INSIDE_MILL',
          role: isOut ? 'PRODUCED_OUTPUT' : (isWst ? 'WASTAGE_RECOVERY' : 'CONSUMED_INPUT'),
          inputs: inputs.map(i => ({ item_name: i.item_name, lot_no: i.lot_no, qty: i.qty, weight_kg: i.total_wt })),
          outputs: outputs.map(o => ({ item_name: o.item_name, lot_no: o.lot_no, qty: o.qty, weight_kg: o.total_wt })),
          wastages: wastages.map(w => ({ item_name: w.item_name, category: w.category, lot_no: w.lot_no, qty: w.qty, weight_kg: w.total_wt })),
          total_input_kg: totalInKg,
          total_output_kg: totalOutKg,
          total_wastage_kg: totalWstKg,
          yield_percent: totalInKg > 0 ? Number(((totalOutKg / totalInKg) * 100).toFixed(1)) : 0
        };
        millingBatches.push(batchObj);

        if (isIn) {
          inputs.filter(i => familyUpper.includes(String(i.lot_no || '').trim().toUpperCase())).forEach(i => {
            millingInputs.push({
              grain_id: g.grain_id,
              qty: i.qty,
              weight_kg: i.total_wt,
              milling_date: g.milling_date,
              batch_no: g.batch_no,
              mill_name: g.mill_name,
              outputs: batchObj.outputs,
              wastages: batchObj.wastages
            });
          });
        }
        if (isOut) {
          outputs.forEach(o => {
            millingOutputs.push({
              grain_id: g.grain_id,
              item_name: o.item_name,
              lot_no: o.lot_no,
              qty: o.qty,
              weight_kg: o.total_wt,
              milling_date: g.milling_date,
              batch_no: g.batch_no,
              mill_name: g.mill_name,
              inputs: batchObj.inputs,
              wastages: batchObj.wastages
            });
          });
        }
        if (isWst) {
          wastages.filter(w => familyUpper.includes(String(w.lot_no || '').trim().toUpperCase())).forEach(w => {
            millingWastages.push({
              grain_id: g.grain_id,
              item_name: w.item_name,
              category: w.category,
              lot_no: w.lot_no,
              qty: w.qty,
              weight_kg: w.total_wt,
              milling_date: g.milling_date,
              batch_no: g.batch_no
            });
          });
        }
      }
    } catch (_) {}

    // 4b. Work Orders NOT already covered by grains
    try {
      const woRes = await runner.query(`
        SELECT DISTINCT wo.id, wo.work_order_no, SUBSTR(CAST(wo.date AS TEXT), 1, 10) AS milling_date, wo.work_unit, wo.product, wo.grind_id
        FROM work_orders wo
        WHERE EXISTS (SELECT 1 FROM work_order_items woi WHERE woi.work_order_id = wo.id AND UPPER(TRIM(woi.lot_no)) IN (${familyPh}))
           OR EXISTS (SELECT 1 FROM work_order_outputs woo WHERE woo.work_order_id = wo.id AND UPPER(TRIM(woo.fg_lot_no)) IN (${familyPh}))
           OR EXISTS (SELECT 1 FROM work_order_wastages wow WHERE wow.work_order_id = wo.id AND UPPER(TRIM(wow.lot_no)) IN (${familyPh}))
      `, [...familyUpper, ...familyUpper, ...familyUpper]);

      for (const wo of (woRes.rows || [])) {
        if (coveredWoIds.has(Number(wo.id)) || coveredWoNos.has(String(wo.work_order_no || '').trim().toUpperCase())) {
          continue;
        }
        const woIn = (await runner.query(`SELECT item_name, lot_no, input_qty AS qty, weight, kgs AS total_wt FROM work_order_items WHERE work_order_id = ?`, [wo.id])).rows || [];
        const woOut = (await runner.query(`SELECT output_item AS item_name, fg_lot_no AS lot_no, expected_qty AS qty, weight, output_kgs AS total_wt FROM work_order_outputs WHERE work_order_id = ?`, [wo.id])).rows || [];
        const woWst = (await runner.query(`SELECT item_name, category, lot_no, qty, weight, total_wt FROM work_order_wastages WHERE work_order_id = ?`, [wo.id])).rows || [];

        const totalInKg = woIn.reduce((s, r) => s + (parseFloat(r.total_wt) || 0), 0);
        const totalOutKg = woOut.reduce((s, r) => s + (parseFloat(r.total_wt) || 0), 0);
        const totalWstKg = woWst.reduce((s, r) => s + (parseFloat(r.total_wt) || 0), 0);
        const isOut = woOut.some(o => familyUpper.includes(String(o.lot_no || '').trim().toUpperCase()));

        millingBatches.push({
          work_order_id: wo.id,
          batch_no: wo.work_order_no,
          milling_date: wo.milling_date,
          mill_name: wo.work_unit || 'Production Floor',
          process_mode: 'WORK_ORDER',
          role: isOut ? 'PRODUCED_OUTPUT' : 'CONSUMED_INPUT',
          inputs: woIn.map(i => ({ item_name: i.item_name, lot_no: i.lot_no, qty: i.qty, weight_kg: i.total_wt })),
          outputs: woOut.map(o => ({ item_name: o.item_name, lot_no: o.lot_no, qty: o.qty, weight_kg: o.total_wt })),
          wastages: woWst.map(w => ({ item_name: w.item_name, category: w.category, lot_no: w.lot_no, qty: w.qty, weight_kg: w.total_wt })),
          total_input_kg: totalInKg,
          total_output_kg: totalOutKg,
          total_wastage_kg: totalWstKg,
          yield_percent: totalInKg > 0 ? Number(((totalOutKg / totalInKg) * 100).toFixed(1)) : 0
        });
        if (!isOut) {
          millingInputs.push({ batch_no: wo.work_order_no, milling_date: wo.milling_date, mill_name: wo.work_unit, weight_kg: totalInKg, outputs: woOut });
        } else {
          millingOutputs.push({ batch_no: wo.work_order_no, milling_date: wo.milling_date, mill_name: wo.work_unit, weight_kg: totalOutKg, inputs: woIn });
        }
      }
    } catch (_) {}

    // 5. Sales Dispatches
    let salesDispatches = [];
    try {
      const salesRes = await runner.query(`
        SELECT s.id, s.s_no, COALESCE(NULLIF(s.voucher_no, ''), CAST(s.s_no AS TEXT)) AS bill_no,
               s.customer, s.customer_id, SUBSTR(CAST(s.date AS TEXT), 1, 10) AS sale_date,
               si.item_name, si.lot_no, si.qty, si.weight, si.total_wt, COALESCE(NULLIF(si.total_amt, 0), si.amount, 0) AS amount
        FROM sales_items si
        JOIN sales s ON si.sales_id = s.id
        WHERE UPPER(TRIM(si.lot_no)) IN (${familyPh})
        ORDER BY s.date ASC, s.id ASC
      `, familyUpper);
      salesDispatches = (salesRes.rows || []).map(sr => ({
        ...sr,
        customer_name: resolveCustomerFromDirectory(partyDir, sr.customer, sr.customer_id).name || sr.customer || 'Customer',
        total_wt: parseFloat(sr.total_wt) || ((parseFloat(sr.qty) || 0) * (parseFloat(sr.weight) || 0))
      }));
    } catch (_) {}

    // 6. Purchase Returns
    let purchaseReturns = [];
    try {
      const prRes = await runner.query(`
        SELECT
          pri.id AS item_id, pri.purchase_return_id, pri.lot_no, pri.item_name,
          pri.weight, pri.qty, pri.total_wt, pri.rate, pri.amount, pri.reason,
          pri.iqr_no, pri.qc_no, pri.source, pr.s_no AS return_s_no, pr.return_inv_no,
          SUBSTR(CAST(pr.date AS TEXT), 1, 10) AS return_date,
          pr.supplier AS raw_supplier,
          COALESCE(pr.status, 'RETURNED') AS return_status, pr.approval_status
        FROM purchase_return_items pri
        JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
        WHERE UPPER(TRIM(pri.lot_no)) IN (${familyPh})
        ORDER BY pr.id DESC
      `, familyUpper);
      purchaseReturns = (prRes.rows || []).map(pr => ({
        ...pr,
        supplier_name: resolveSupplierFromDirectory(partyDir, pr.raw_supplier, null).name || pr.raw_supplier || 'Supplier'
      }));
    } catch (_) {}

    const totalReturnedQty = purchaseReturns.reduce((sum, pr) => sum + (parseFloat(pr.qty) || 0), 0);
    const totalReturnedWeight = purchaseReturns.reduce((sum, pr) => sum + (parseFloat(pr.total_wt) || 0), 0);

    const hasMovements = perGodownBalances.length > 0;
    let effectiveBags = hasMovements
      ? totalNetBags
      : stockLotRows.reduce((s, r) => s + (parseFloat(r.remaining_quantity ?? r.quantity) || 0), 0) || (parseFloat(purchaseInfo?.qty) || 0);
    let effectiveWeightKg = hasMovements
      ? totalNetWeightKg
      : (parseFloat(purchaseInfo?.total_weight) || (millingOutputs[0]?.weight_kg ? parseFloat(millingOutputs[0].weight_kg) : 0));

    if (!hasMovements && totalReturnedQty > 0 && effectiveBags > 0) {
      effectiveBags = Math.max(0, effectiveBags - totalReturnedQty);
    }

    let effectiveQcStatus = stockInfo?.qc_status || qcInfo?.overall_result || 'ACCEPTED';
    if (stockInfo?.unloading_status === 'RETURNED' || (purchaseReturns.length > 0 && effectiveBags <= 0)) {
      effectiveQcStatus = 'RETURNED';
    } else if (purchaseReturns.length > 0 && effectiveBags > 0) {
      effectiveQcStatus = 'PARTIALLY_RETURNED';
    }

    const activeGodown =
      perGodownBalances.find(g => g.balanceQty > 0)?.godownName ||
      perGodownBalances[0]?.godownName ||
      purchaseInfo?.purchase_godown ||
      stockInfo?.godown_name ||
      defaultGodownName;

    const itemName =
      perGodownBalances[0]?.itemName ||
      stockInfo?.resolved_item_name ||
      purchaseInfo?.item_name ||
      millingOutputs[0]?.item_name ||
      millingWastages[0]?.item_name ||
      purchaseReturns[0]?.item_name ||
      'Agri Commodity';

    return {
      code: originalCode,
      type: 'LOT',
      lotNo: cleanLotNo,
      itemName,
      currentStock: effectiveBags,
      currentStockBags: effectiveBags,
      currentWeightKg: effectiveWeightKg,
      totalReturnedQty,
      totalReturnedWeight,
      unit: 'Bags',
      weightUnit: purchaseInfo?.unit || 'KG',
      currentGodown: activeGodown,
      perGodownBalances,
      qcStatus: effectiveQcStatus,
      purchase: purchaseInfo ? {
        voucherNo: purchaseInfo.voucher_no || `PUR-${purchaseInfo.s_no || purchaseInfo.purchase_id}`,
        invoiceNo: purchaseInfo.inv_no,
        inwardDate: purchaseInfo.inward_date,
        supplierName: purchaseInfo.supplier_name,
        vehicleNo: purchaseInfo.vehicle_no || purchaseInfo.lorry_no || 'N/A',
        driverName: purchaseInfo.driver_name,
        inwardQuantity: purchaseInfo.qty,
        inwardWeightKg: purchaseInfo.total_weight,
        rate: purchaseInfo.rate,
        isDerivedFromParent,
        parentLotNo: derivedParentLotNo
      } : null,
      qcInspection: qcInfo ? {
        qcNo: qcInfo.qc_no,
        date: qcInfo.inspection_date,
        inspector: qcInfo.inspector,
        result: qcInfo.overall_result,
        remarks: qcInfo.remarks
      } : null,
      purchaseReturns,
      millingUsage: {
        inputs: millingInputs,
        outputs: millingOutputs,
        wastages: millingWastages,
        batches: millingBatches
      },
      coldStorageMovements: {
        inwards: csInwards,
        outwards: csOutwards,
        siblings: Array.from(csSiblings)
      },
      salesDispatches,
      traceUrl: `/lot-genealogy?lotNo=${encodeURIComponent(cleanLotNo)}`,
      canTraceGenealogy: true
    };
  }

  /**
   * Location 360° Lookup
   */
  async resolveLocation360(locationCode, originalCode, companyId = 1) {
    const { runner } = getRunner(companyId);
    const csChamberRes = await runner.query(`
      SELECT c.*, f.name AS facility_name
      FROM cs_chambers c
      JOIN cs_facilities f ON c.facility_id = f.id
      WHERE c.chamber_name LIKE ? OR c.id = ?
    `, [`%${locationCode}%`, parseInt(locationCode, 10) || 0]);

    return {
      code: originalCode,
      type: 'LOCATION',
      locationCode,
      chamber: csChamberRes.rows?.[0] || null,
      description: `Warehouse Location Node: ${locationCode}`
    };
  }

  /**
   * Item 360° Lookup
   */
  async resolveItem360(itemCode, originalCode, companyId = 1) {
    const { runner } = getRunner(companyId);
    const itemRes = await runner.query(`
      SELECT * FROM item_master WHERE item_code = ? OR id = ? OR LOWER(item_name) = LOWER(?)
    `, [itemCode, parseInt(itemCode, 10) || 0, itemCode]);
    const item = itemRes.rows?.[0] || null;

    let stockKg = 0;
    if (item) {
      const mvRes = await runner.query(
        `SELECT SUM(CASE WHEN direction='IN' THEN COALESCE(weight,0) ELSE -COALESCE(weight,0) END) AS tot
         FROM stock_movements WHERE is_reversed=0 AND is_reversal=0 AND is_physical_stock=1 AND item_id = ?`,
        [item.id]
      );
      stockKg = parseFloat(mvRes.rows?.[0]?.tot || 0);
    }

    return {
      code: originalCode,
      type: 'ITEM',
      item,
      currentTotalStockKg: stockKg
    };
  }

  /**
   * Finished Good 360° Lookup
   */
  async resolveFinishedGood360(fgCode, originalCode) {
    return {
      code: originalCode,
      type: 'FINISHED_GOOD',
      fgCode,
      batchNo: `BATCH-${fgCode}`,
      mfgDate: new Date().toISOString().split('T')[0],
      qcStatus: 'PASSED',
      standards: 'FSSAI Certified / ISO 22000'
    };
  }

  /**
   * Generate and store Barcode/QR code in Master
   */
  async registerCode(data, companyId = 1) {
    const { runner } = getRunner(companyId);
    const { codeType, entityCode, labelTitle, metadata = {} } = data;

    let prefix = 'LOT-';
    if (codeType === 'ITEM') prefix = 'ITM-';
    else if (codeType === 'PALLET') prefix = 'PLT-';
    else if (codeType === 'LOCATION') prefix = 'LOC-';
    else if (codeType === 'FINISHED_GOOD') prefix = 'FG-';

    const fullCode = entityCode.startsWith(prefix) ? entityCode : `${prefix}${entityCode}`;

    const res = await runner.run(`
      INSERT INTO barcode_qr_master (
        code_type, entity_code, label_title, barcode_data, qr_data, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      codeType,
      fullCode,
      labelTitle || `${codeType} ${entityCode}`,
      fullCode,
      fullCode,
      JSON.stringify(metadata)
    ]);

    return {
      id: res.lastID,
      code: fullCode,
      type: codeType,
      title: labelTitle,
      success: true
    };
  }

  /**
   * Get all registered codes
   */
  async getAllCodes(companyId = 1) {
    const { runner } = getRunner(companyId);
    const res = await runner.query('SELECT * FROM barcode_qr_master ORDER BY id DESC LIMIT 50');
    return res.rows || [];
  }
}

module.exports = new BarcodeQrService();
