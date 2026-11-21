const db = require('../config/database');
const {
  loadPartyDirectory,
  resolveSupplierFromDirectory,
  resolveCustomerFromDirectory,
  resolvePartyFromDirectory
} = require('./PartyNameResolver');

/**
 * Advanced Lot Genealogy and Traceability Service
 * Builds bidirectional (forward and backward) trees, recall readiness datasets,
 * split/merge operations, and multi-parameter lot search based on clean stock_movements
 * and real multi-table transaction lineage (company-isolated, SQLite + PostgreSQL safe).
 */

function getRunner(companyId = 1) {
  const cId = parseInt(companyId, 10);
  const safeId = Number.isSafeInteger(cId) && cId > 0 ? cId : 1;
  return { cId: safeId, runner: db.forCompany(safeId) };
}

async function getDefaultGodownInfo(runner) {
  try {
    const res = await runner.query('SELECT id, godown_name FROM godown_master ORDER BY id ASC LIMIT 1');
    if (res.rows && res.rows[0]) {
      return { id: res.rows[0].id, name: res.rows[0].godown_name };
    }
  } catch (_) {}
  return { id: 1, name: 'PJ' };
}

/**
 * Searches lots across stock_movements, stock_lots, purchases, grains, work_orders,
 * cold_storage_items, weight_conversion_items, inpass_items, open_items, purchase_returns, and sales.
 */
async function searchLots(query = '', filters = {}, companyId = 1) {
  const { cId, runner } = getRunner(companyId);
  const q = (query || '').trim().toLowerCase();
  const lotsMap = new Map();
  const defGodown = await getDefaultGodownInfo(runner);
  const partyDir = await loadPartyDirectory(cId, runner);

  // Build authoritative live net balance & weight per lot from non-reversed physical stock_movements
  const mvBalanceMap = new Map();
  try {
    const mvRes = await runner.query(`
      SELECT
        TRIM(lot_no) AS lot_no,
        MAX(item_name) AS item_name,
        MAX(godown_name) AS godown_name,
        SUM(CASE WHEN direction = 'IN' THEN qty ELSE -qty END) AS net_qty,
        SUM(CASE WHEN direction = 'IN' THEN COALESCE(weight, 0) ELSE -COALESCE(weight, 0) END) AS net_wt,
        SUM(CASE WHEN direction = 'IN' THEN qty ELSE 0 END) AS total_in_qty,
        SUM(CASE WHEN direction = 'IN' THEN COALESCE(weight, 0) ELSE 0 END) AS total_in_wt
      FROM stock_movements
      WHERE is_reversed = 0 AND is_reversal = 0 AND is_physical_stock = 1
        AND lot_no IS NOT NULL AND TRIM(lot_no) != ''
      GROUP BY TRIM(lot_no)
    `);
    for (const r of (mvRes.rows || [])) {
      mvBalanceMap.set(r.lot_no.toUpperCase(), {
        lotNo: r.lot_no,
        itemName: r.item_name,
        godownName: r.godown_name,
        netQty: Number((parseFloat(r.net_qty) || 0).toFixed(3)),
        netWt: Number((parseFloat(r.net_wt) || 0).toFixed(3)),
        totalInQty: Number((parseFloat(r.total_in_qty) || 0).toFixed(3)),
        totalInWt: Number((parseFloat(r.total_in_wt) || 0).toFixed(3))
      });
    }
  } catch (_) {}

  const upsertLot = (lotNoRaw, patch) => {
    const lotNo = String(lotNoRaw || '').trim();
    if (!lotNo) return;
    const key = lotNo.toUpperCase();
    const mv = mvBalanceMap.get(key);
    const existing = lotsMap.get(key);
    if (!existing) {
      lotsMap.set(key, {
        lotNo,
        itemName: patch.itemName || mv?.itemName || 'Raw Material',
        currentQuantity: mv ? mv.netQty : (patch.currentQuantity ?? patch.originalQuantity ?? 0),
        originalQuantity: patch.originalQuantity ?? (mv ? mv.totalInQty : 0),
        currentWeightKg: mv ? mv.netWt : (patch.currentWeightKg ?? 0),
        location: patch.location || mv?.godownName || defGodown.name,
        qcStatus: patch.qcStatus || 'ACCEPTED',
        supplier: patch.supplier || '',
        voucherNo: patch.voucherNo || '',
        workOrderNo: patch.workOrderNo || '',
        date: patch.date || '',
        createdAt: patch.createdAt || null
      });
    } else {
      if (!existing.itemName && patch.itemName) existing.itemName = patch.itemName;
      if (!existing.supplier && patch.supplier) existing.supplier = patch.supplier;
      if (!existing.voucherNo && patch.voucherNo) existing.voucherNo = patch.voucherNo;
      if (!existing.workOrderNo && patch.workOrderNo) existing.workOrderNo = patch.workOrderNo;
      if (!existing.date && patch.date) existing.date = patch.date;
      if (patch.qcStatus && existing.qcStatus === 'ACCEPTED') existing.qcStatus = patch.qcStatus;
    }
  };

  // 1. stock_lots
  try {
    let sql = `
      SELECT
        sl.id, sl.lot_no AS lotNo, sl.item_name AS itemName, sl.quantity, sl.remaining_quantity AS remainingQuantity,
        COALESCE(gm.godown_name, sl.godown_name, ?) AS godownName,
        sl.qc_status AS qcStatus, sl.unloading_status AS unloadingStatus, sl.created_at AS createdAt
      FROM stock_lots sl
      LEFT JOIN godown_master gm ON sl.godown_id = gm.id
      WHERE sl.lot_no IS NOT NULL AND TRIM(sl.lot_no) != ''
    `;
    const params = [defGodown.name];
    if (q) {
      sql += ` AND (LOWER(sl.lot_no) LIKE ? OR LOWER(sl.item_name) LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    const stockLotsRes = await runner.query(`${sql} ORDER BY sl.id DESC LIMIT 150`, params);
    for (const row of (stockLotsRes.rows || [])) {
      upsertLot(row.lotNo, {
        itemName: row.itemName,
        currentQuantity: row.remainingQuantity ?? row.quantity ?? 0,
        originalQuantity: row.quantity ?? 0,
        location: row.godownName,
        qcStatus: row.unloadingStatus === 'RETURNED' ? 'RETURNED' : (row.qcStatus || 'ACCEPTED'),
        createdAt: row.createdAt
      });
    }
  } catch (_) {}

  // 2. purchases & purchase_items
  try {
    const purLots = await runner.query(`
      SELECT DISTINCT
        pi.lot_no AS lotNo, pi.item_name AS itemName, p.supplier AS rawSupplier,
        pi.qty AS qty, COALESCE(pi.total_weight, pi.weight, p.total_weight, 0) AS weightKg,
        SUBSTR(COALESCE(CAST(p.date AS TEXT), CAST(p.inv_date AS TEXT), ''), 1, 10) AS purchaseDate,
        COALESCE(NULLIF(p.voucher_no, ''), NULLIF(p.inv_no, ''), NULLIF(p.po_no, ''), 'PUR-' || CAST(p.s_no AS TEXT), 'PUR-' || CAST(p.id AS TEXT)) AS voucherNo,
        COALESCE(gm.godown_name, p.godown, ?) AS godownName
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      LEFT JOIN godown_master gm ON (CAST(gm.id AS TEXT) = CAST(p.godown AS TEXT) OR gm.godown_name = p.godown)
      WHERE pi.lot_no IS NOT NULL AND TRIM(pi.lot_no) != ''
        ${q ? 'AND (LOWER(pi.lot_no) LIKE ? OR LOWER(pi.item_name) LIKE ?)' : ''}
      LIMIT 100
    `, q ? [defGodown.name, `%${q}%`, `%${q}%`] : [defGodown.name]);

    for (const row of (purLots.rows || [])) {
      const supName = resolveSupplierFromDirectory(partyDir, row.rawSupplier, null).name || row.rawSupplier || '';
      upsertLot(row.lotNo, {
        itemName: row.itemName,
        supplier: supName,
        voucherNo: row.voucherNo,
        date: row.purchaseDate,
        originalQuantity: row.qty,
        currentWeightKg: row.weightKg,
        location: row.godownName
      });
    }
  } catch (_) {}

  // 3. grains milling outputs
  try {
    const grainLots = await runner.query(`
      SELECT DISTINCT
        goi.lot_no AS lotNo, goi.item_name AS itemName, goi.qty AS qty, goi.total_wt AS totalWt,
        COALESCE(g.work_order_no, 'GRD-' || CAST(g.s_no AS TEXT), 'GRD-' || CAST(g.id AS TEXT)) AS workOrderNo,
        SUBSTR(CAST(g.date AS TEXT), 1, 10) AS millingDate,
        COALESCE(fmm.flourmill, g.flour_mill, 'BVC MILL') AS flourMill
      FROM grain_output_items goi
      JOIN grains g ON goi.grain_id = g.id
      LEFT JOIN flour_mill_master fmm ON (CAST(fmm.id AS TEXT) = CAST(g.flour_mill AS TEXT) OR fmm.flourmill = g.flour_mill)
      WHERE goi.lot_no IS NOT NULL AND TRIM(goi.lot_no) != ''
        ${q ? 'AND (LOWER(goi.lot_no) LIKE ? OR LOWER(goi.item_name) LIKE ?)' : ''}
      LIMIT 100
    `, q ? [`%${q}%`, `%${q}%`] : []);

    for (const row of (grainLots.rows || [])) {
      upsertLot(row.lotNo, {
        itemName: row.itemName,
        workOrderNo: row.workOrderNo,
        date: row.millingDate,
        originalQuantity: row.qty,
        currentWeightKg: row.totalWt,
        location: row.flourMill
      });
    }
  } catch (_) {}

  // 4. Cold storage lots (CS-LOT*)
  try {
    const csLots = await runner.query(`
      SELECT DISTINCT
        csi.cold_storage_lot_no AS lotNo, csi.item_name AS itemName,
        csv.voucher_no AS voucherNo, csv.voucher_date AS voucherDate,
        csv.cold_storage_name AS csName, csi.quantity AS qty, csi.total_wt AS totalWt
      FROM cold_storage_items csi
      JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
      WHERE csi.cold_storage_lot_no IS NOT NULL AND TRIM(csi.cold_storage_lot_no) != ''
        ${q ? 'AND (LOWER(csi.cold_storage_lot_no) LIKE ? OR LOWER(csi.item_name) LIKE ?)' : ''}
      LIMIT 100
    `, q ? [`%${q}%`, `%${q}%`] : []);

    for (const row of (csLots.rows || [])) {
      upsertLot(row.lotNo, {
        itemName: row.itemName,
        voucherNo: row.voucherNo,
        date: row.voucherDate,
        originalQuantity: row.qty,
        currentWeightKg: row.totalWt,
        location: row.csName || 'Cold Storage'
      });
    }
  } catch (_) {}

  // 5. Weight Conversions
  try {
    const wcLots = await runner.query(`
      SELECT DISTINCT
        wci.lot_no AS lotNo, wci.item_name AS itemName, wc.s_no AS conversionSNo,
        SUBSTR(CAST(wc.date AS TEXT), 1, 10) AS conversionDate, wci.qty, wci.total_wt
      FROM weight_conversion_items wci
      JOIN weight_conversion wc ON CAST(wci.weight_conversion_id AS TEXT) = CAST(wc.id AS TEXT)
      WHERE wci.lot_no IS NOT NULL AND TRIM(wci.lot_no) != ''
        ${q ? 'AND (LOWER(wci.lot_no) LIKE ? OR LOWER(wci.item_name) LIKE ?)' : ''}
      LIMIT 100
    `, q ? [`%${q}%`, `%${q}%`] : []);
    for (const row of (wcLots.rows || [])) {
      upsertLot(row.lotNo, {
        itemName: row.itemName,
        voucherNo: `WC-${row.conversionSNo || 1}`,
        date: row.conversionDate,
        originalQuantity: row.qty,
        currentWeightKg: row.total_wt
      });
    }
  } catch (_) {}

  // 6. Outside Inpass lots (IP-*)
  try {
    const ipLots = await runner.query(`
      SELECT DISTINCT
        ii.lot_no AS lotNo, ii.item_name AS itemName, ip.s_no AS sNo,
        SUBSTR(CAST(ip.date AS TEXT), 1, 10) AS ipDate, ii.qty, ii.total_wt
      FROM inpass_items ii
      JOIN inpass ip ON ii.inpass_id = ip.id
      WHERE ii.lot_no IS NOT NULL AND TRIM(ii.lot_no) != ''
        ${q ? 'AND (LOWER(ii.lot_no) LIKE ? OR LOWER(ii.item_name) LIKE ?)' : ''}
      LIMIT 50
    `, q ? [`%${q}%`, `%${q}%`] : []);
    for (const row of (ipLots.rows || [])) {
      upsertLot(row.lotNo, {
        itemName: row.itemName,
        voucherNo: `IP-${row.sNo || 1}`,
        date: row.ipDate,
        originalQuantity: row.qty,
        currentWeightKg: row.total_wt,
        location: 'Jobwork Receipt'
      });
    }
  } catch (_) {}

  // 7. Purchase Returns
  try {
    const prLots = await runner.query(`
      SELECT DISTINCT
        pri.lot_no AS lotNo, pri.item_name AS itemName, pr.supplier AS rawSupplier,
        pr.return_inv_no AS returnInvNo, SUBSTR(CAST(pr.date AS TEXT), 1, 10) AS returnDate
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
      WHERE pri.lot_no IS NOT NULL AND TRIM(pri.lot_no) != ''
        ${q ? 'AND (LOWER(pri.lot_no) LIKE ? OR LOWER(pri.item_name) LIKE ?)' : ''}
      LIMIT 50
    `, q ? [`%${q}%`, `%${q}%`] : []);
    for (const row of (prLots.rows || [])) {
      const supName = resolveSupplierFromDirectory(partyDir, row.rawSupplier, null).name || row.rawSupplier || '';
      upsertLot(row.lotNo, {
        itemName: row.itemName,
        supplier: supName,
        voucherNo: row.returnInvNo,
        date: row.returnDate,
        qcStatus: 'RETURNED'
      });
    }
  } catch (_) {}

  // 8. Any remaining lots present in clean stock_movements
  for (const [key, mv] of mvBalanceMap.entries()) {
    if (q && !mv.lotNo.toLowerCase().includes(q) && !String(mv.itemName || '').toLowerCase().includes(q)) {
      continue;
    }
    if (!lotsMap.has(key)) {
      upsertLot(mv.lotNo, {
        itemName: mv.itemName,
        currentQuantity: mv.netQty,
        originalQuantity: mv.totalInQty,
        currentWeightKg: mv.netWt,
        location: mv.godownName
      });
    }
  }

  return Array.from(lotsMap.values()).sort((a, b) => a.lotNo.localeCompare(b.lotNo));
}

/**
 * Resolves Cold Storage sibling lots (purchase_lot_no <-> cold_storage_lot_no)
 */
async function resolveColdStorageLinks(runner, cleanLotNo) {
  const csRows = [];
  const csSiblingLots = new Set([cleanLotNo]);
  const csParentPurchaseLots = new Set();
  try {
    const res = await runner.query(`
      SELECT
        csv.id AS voucher_id, csv.voucher_no, csv.voucher_type, csv.voucher_date,
        csv.cold_storage_name, csv.source_godown_name, csv.destination_godown_name,
        csv.vehicle_no, csv.remarks,
        csi.item_name, csi.purchase_lot_no, csi.cold_storage_lot_no,
        csi.quantity, csi.weight, csi.total_wt, csi.unit
      FROM cold_storage_items csi
      JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
      WHERE UPPER(TRIM(COALESCE(csi.purchase_lot_no, ''))) = UPPER(?)
         OR UPPER(TRIM(COALESCE(csi.cold_storage_lot_no, ''))) = UPPER(?)
      ORDER BY csv.voucher_date ASC, csv.id ASC
    `, [cleanLotNo, cleanLotNo]);

    for (const r of (res.rows || [])) {
      const pLot = (r.purchase_lot_no || '').trim();
      const csLot = (r.cold_storage_lot_no || '').trim();
      if (pLot) csSiblingLots.add(pLot);
      if (csLot) csSiblingLots.add(csLot);
      if (csLot.toUpperCase() === cleanLotNo.toUpperCase() && pLot && pLot.toUpperCase() !== cleanLotNo.toUpperCase()) {
        csParentPurchaseLots.add(pLot);
      }
      csRows.push({
        ...r,
        is_auto_sync: String(r.remarks || '').startsWith('Auto-sync from Stock Lot')
      });
    }
  } catch (_) {}
  return { csRows, csSiblingLots: Array.from(csSiblingLots), csParentPurchaseLots: Array.from(csParentPurchaseLots) };
}

/**
 * Gets detailed metadata, QC, stock, godown transfers, cold storage, production,
 * and commercial history for a specific lot (without Cartesian multiplication).
 */
async function getLotDetails(lotNo, companyId = 1) {
  if (!lotNo) return null;
  const { cId, runner } = getRunner(companyId);
  const cleanLotNo = String(lotNo).trim();
  const defGodown = await getDefaultGodownInfo(runner);
  const partyDir = await loadPartyDirectory(cId, runner);

  // 0. Cold storage aliases & movements
  const { csRows, csSiblingLots, csParentPurchaseLots } = await resolveColdStorageLinks(runner, cleanLotNo);
  const familyUpper = Array.from(new Set([cleanLotNo, ...csSiblingLots])).map(l => l.toUpperCase());
  const familyPh = familyUpper.map(() => 'UPPER(?)').join(',');

  // 1. Stock Lots record (may have multiple godowns for same lot)
  const stockLotRes = await runner.query(`
    SELECT sl.*, COALESCE(gm.godown_name, sl.godown_name, ?) AS current_godown
    FROM stock_lots sl
    LEFT JOIN godown_master gm ON sl.godown_id = gm.id
    WHERE UPPER(TRIM(sl.lot_no)) = UPPER(?)
    ORDER BY sl.id ASC
  `, [defGodown.name, cleanLotNo]);
  const stockLotRows = stockLotRes.rows || [];
  const stockLot = stockLotRows[0] || {};

  // 1b. Clean authoritative per-godown physical stock balances from stock_movements
  let godownBalances = [];
  let mvTotalInQty = 0;
  let mvTotalInWt = 0;
  let mvNetQty = 0;
  let mvNetWt = 0;
  try {
    const gbRes = await runner.query(`
      SELECT
        godown_name,
        lot_no,
        SUM(CASE WHEN direction = 'IN' THEN qty ELSE 0 END) AS in_qty,
        SUM(CASE WHEN direction = 'OUT' THEN qty ELSE 0 END) AS out_qty,
        SUM(CASE WHEN direction = 'IN' THEN qty ELSE -qty END) AS balance_qty,
        SUM(CASE WHEN direction = 'IN' THEN COALESCE(weight, 0) ELSE 0 END) AS in_weight,
        SUM(CASE WHEN direction = 'OUT' THEN COALESCE(weight, 0) ELSE 0 END) AS out_weight,
        SUM(CASE WHEN direction = 'IN' THEN COALESCE(weight, 0) ELSE -COALESCE(weight, 0) END) AS balance_weight
      FROM stock_movements
      WHERE is_reversed = 0 AND is_reversal = 0 AND is_physical_stock = 1
        AND UPPER(TRIM(lot_no)) = UPPER(?)
      GROUP BY godown_name, lot_no
      ORDER BY godown_name ASC
    `, [cleanLotNo]);
    godownBalances = (gbRes.rows || []).map(r => ({
      godownName: r.godown_name || defGodown.name,
      lotNo: r.lot_no,
      inQty: Number((parseFloat(r.in_qty) || 0).toFixed(3)),
      outQty: Number((parseFloat(r.out_qty) || 0).toFixed(3)),
      balanceQty: Number((parseFloat(r.balance_qty) || 0).toFixed(3)),
      inWeightKg: Number((parseFloat(r.in_weight) || 0).toFixed(3)),
      outWeightKg: Number((parseFloat(r.out_weight) || 0).toFixed(3)),
      balanceWeightKg: Number((parseFloat(r.balance_weight) || 0).toFixed(3))
    }));
    for (const g of godownBalances) {
      mvTotalInQty += g.inQty;
      mvTotalInWt += g.inWeightKg;
      mvNetQty += g.balanceQty;
      mvNetWt += g.balanceWeightKg;
    }
  } catch (_) {}

  // 2. Direct Purchase Inward
  const fetchPurchaseForLot = async (targetLot) => {
    const res = await runner.query(`
      SELECT
        p.id AS purchaseId,
        p.s_no AS purchaseSNo,
        COALESCE(NULLIF(p.voucher_no, ''), NULLIF(p.inv_no, ''), NULLIF(p.po_no, ''), 'PUR-' || CAST(p.s_no AS TEXT), 'PUR-' || CAST(p.id AS TEXT)) AS voucherNo,
        p.inv_no AS invNo,
        p.po_no AS poNo,
        SUBSTR(COALESCE(CAST(p.date AS TEXT), CAST(p.inv_date AS TEXT), ''), 1, 10) AS purchaseDate,
        p.supplier AS rawSupplier,
        COALESCE(sm.mobile1, sm.phone_off, sm.phone_res, p.phone, '') AS supplierPhone,
        COALESCE(sm.gst_number, p.gst_no, '') AS supplierGstin,
        COALESCE(NULLIF(p.vehicle_no, ''), NULLIF(p.lorry_no, ''), 'N/A') AS vehicleNo,
        COALESCE(NULLIF(p.driver, ''), NULLIF(p.driver_name, ''), '') AS driverName,
        COALESCE(NULLIF(p.transport, ''), NULLIF(p.transporter, ''), '') AS transportName,
        pi.lot_no AS lotNo,
        pi.item_name AS itemName,
        pi.qty,
        pi.unit,
        COALESCE(NULLIF(pi.total_weight, 0), NULLIF(pi.weight, 0), p.total_weight, 0) AS totalWeight,
        pi.rate
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR LOWER(TRIM(sm.name)) = LOWER(TRIM(p.supplier)) OR LOWER(TRIM(sm.print_name)) = LOWER(TRIM(p.supplier)))
      WHERE UPPER(TRIM(pi.lot_no)) = UPPER(?)
      LIMIT 1
    `, [targetLot]);
    const r = res.rows?.[0];
    if (!r) return null;
    const resolvedSup = resolveSupplierFromDirectory(partyDir, r.rawSupplier, null);
    return {
      ...r,
      supplierName: resolvedSup.name || r.rawSupplier || 'Supplier'
    };
  };

  let purchase = await fetchPurchaseForLot(cleanLotNo);

  // 3. Vehicle Movements
  let vehicle = null;
  try {
    const vehRes = await runner.query(`
      SELECT * FROM vehicle_movements
      WHERE UPPER(TRIM(lot_no)) = UPPER(?) OR (vehicle_no = ? AND vehicle_no != '')
      ORDER BY id DESC LIMIT 1
    `, [cleanLotNo, purchase?.vehicleNo || '']);
    vehicle = vehRes.rows?.[0] || null;
  } catch (_) {}

  // 4. Milling & Production - Query grain_input_items and grain_output_items SEPARATELY per grain_id (no Cartesian join!)
  const millingConsumptions = [];
  const millingOutputs = [];
  const parentLotSet = new Set(csParentPurchaseLots);

  try {
    const matchedGrainsRes = await runner.query(`
      SELECT DISTINCT
        g.id AS grain_id, g.s_no AS grain_s_no,
        SUBSTR(CAST(g.date AS TEXT), 1, 10) AS milling_date,
        g.work_order_no,
        COALESCE(fmm.flourmill, g.flour_mill, 'BVC MILL') AS flour_mill_name
      FROM grains g
      LEFT JOIN flour_mill_master fmm ON (CAST(fmm.id AS TEXT) = CAST(g.flour_mill AS TEXT) OR fmm.flourmill = g.flour_mill)
      WHERE EXISTS (SELECT 1 FROM grain_input_items gii WHERE gii.grain_id = g.id AND UPPER(TRIM(gii.lot_no)) IN (${familyPh}))
         OR EXISTS (SELECT 1 FROM grain_output_items goi WHERE goi.grain_id = g.id AND UPPER(TRIM(goi.lot_no)) IN (${familyPh}))
      ORDER BY g.date ASC, g.id ASC
    `, [...familyUpper, ...familyUpper]);

    for (const g of (matchedGrainsRes.rows || [])) {
      const inputsRes = await runner.query(`SELECT * FROM grain_input_items WHERE grain_id = ?`, [g.grain_id]);
      const outputsRes = await runner.query(`SELECT * FROM grain_output_items WHERE grain_id = ?`, [g.grain_id]);
      const inputs = inputsRes.rows || [];
      const outputs = outputsRes.rows || [];
      const woNo = g.work_order_no || `GRD-${g.grain_s_no || g.grain_id}`;

      const matchedInputs = inputs.filter(i => i.lot_no && familyUpper.includes(String(i.lot_no).trim().toUpperCase()));
      const matchedOutputs = outputs.filter(o => o.lot_no && familyUpper.includes(String(o.lot_no).trim().toUpperCase()));

      if (matchedInputs.length > 0) {
        const myInWeight = matchedInputs.reduce((s, i) => s + (parseFloat(i.total_wt) || (parseFloat(i.qty) || 0) * (parseFloat(i.weight) || 50)), 0);
        const myInBags = matchedInputs.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
        if (outputs.length > 0) {
          for (const o of outputs) {
            millingConsumptions.push({
              grain_id: g.grain_id,
              work_order_no: woNo,
              work_unit: g.flour_mill_name,
              target_product: o.item_name || 'Output',
              work_order_date: g.milling_date,
              input_qty: myInWeight,
              input_bags: myInBags,
              output_lot_no: o.lot_no,
              output_qty: o.qty,
              output_weight: o.total_wt || ((parseFloat(o.qty) || 0) * (parseFloat(o.weight) || 0)),
              source: 'GRAIN_MILLING'
            });
          }
        } else {
          millingConsumptions.push({
            grain_id: g.grain_id,
            work_order_no: woNo,
            work_unit: g.flour_mill_name,
            target_product: 'Processed Output',
            work_order_date: g.milling_date,
            input_qty: myInWeight,
            input_bags: myInBags,
            output_lot_no: null,
            output_qty: 0,
            output_weight: 0,
            source: 'GRAIN_MILLING'
          });
        }
      }

      if (matchedOutputs.length > 0) {
        for (const i of inputs) {
          if (i.lot_no) parentLotSet.add(String(i.lot_no).trim());
        }
        const totalOutWt = matchedOutputs.reduce((s, o) => s + (parseFloat(o.total_wt) || (parseFloat(o.qty) || 0) * (parseFloat(o.weight) || 0)), 0);
        const totalOutBags = matchedOutputs.reduce((s, o) => s + (parseFloat(o.qty) || 0), 0);
        millingOutputs.push({
          grain_id: g.grain_id,
          work_order_no: woNo,
          work_unit: g.flour_mill_name,
          finished_product: matchedOutputs[0].item_name,
          work_order_date: g.milling_date,
          output_kgs: totalOutWt,
          output_bags: totalOutBags,
          input_lot_no: inputs[0]?.lot_no || null,
          input_item: inputs.map(i => `${i.item_name} (${i.lot_no})`).join(', '),
          inputs: inputs.map(i => ({
            lot_no: i.lot_no,
            item_name: i.item_name,
            qty: parseFloat(i.qty) || 0,
            total_wt: parseFloat(i.total_wt) || 0
          })),
          source: 'GRAIN_MILLING'
        });
      }
    }
  } catch (_) {}

  // 5. Work orders
  try {
    const woInputRes = await runner.query(`
      SELECT woi.*, wo.work_order_no, SUBSTR(CAST(wo.date AS TEXT), 1, 10) AS work_order_date, wo.work_unit, wo.product AS target_product
      FROM work_order_items woi
      JOIN work_orders wo ON woi.work_order_id = wo.id
      WHERE UPPER(TRIM(woi.lot_no)) IN (${familyPh})
    `, familyUpper);
    for (const woi of (woInputRes.rows || [])) {
      millingConsumptions.push({
        work_order_no: woi.work_order_no,
        work_unit: woi.work_unit || 'Production Floor',
        target_product: woi.target_product,
        work_order_date: woi.work_order_date,
        input_qty: woi.input_qty || woi.kgs || 0,
        source: 'WORK_ORDER'
      });
    }

    const woOutputRes = await runner.query(`
      SELECT woo.*, wo.work_order_no, SUBSTR(CAST(wo.date AS TEXT), 1, 10) AS work_order_date, wo.work_unit, wo.product AS finished_product
      FROM work_order_outputs woo
      JOIN work_orders wo ON woo.work_order_id = wo.id
      WHERE UPPER(TRIM(woo.fg_lot_no)) IN (${familyPh})
    `, familyUpper);
    for (const woo of (woOutputRes.rows || [])) {
      millingOutputs.push({
        work_order_no: woo.work_order_no,
        work_unit: woo.work_unit || 'Production Floor',
        finished_product: woo.finished_product || woo.output_item,
        work_order_date: woo.work_order_date,
        output_kgs: woo.output_kgs || woo.expected_qty || 0,
        source: 'WORK_ORDER'
      });
    }
  } catch (_) {}

  // 6. Weight Conversions
  const weightConversionConsumptions = [];
  const weightConversionOutputs = [];
  try {
    const wcRes = await runner.query(`
      SELECT DISTINCT
        wc.id AS conversion_id, wc.s_no AS conversion_s_no,
        SUBSTR(CAST(wc.date AS TEXT), 1, 10) AS conversion_date,
        wc.type AS conversion_type, wc.remarks,
        wci.lot_no AS target_lot_no, wci.item_name AS target_item,
        wci.qty AS target_qty, wci.weight AS target_weight,
        wci.total_wt AS target_total_wt, wci.type AS item_role
      FROM weight_conversion_items wci
      JOIN weight_conversion wc ON CAST(wci.weight_conversion_id AS TEXT) = CAST(wc.id AS TEXT)
      WHERE UPPER(TRIM(wci.lot_no)) IN (${familyPh})
    `, familyUpper);

    for (const wcRow of (wcRes.rows || [])) {
      const convId = wcRow.conversion_id;
      const allItemsRes = await runner.query(`
        SELECT * FROM weight_conversion_items WHERE CAST(weight_conversion_id AS TEXT) = CAST(? AS TEXT)
      `, [convId]);
      const convItems = allItemsRes.rows || [];
      const inputs = convItems.filter(i => (i.type || 'input') === 'input');
      const outputs = convItems.filter(i => i.type === 'output');

      if (wcRow.item_role === 'input') {
        for (const outItem of outputs) {
          weightConversionConsumptions.push({
            conversion_id: convId,
            conversion_s_no: wcRow.conversion_s_no,
            voucher_no: `WC-${wcRow.conversion_s_no || convId}`,
            conversion_date: wcRow.conversion_date,
            conversion_type: wcRow.conversion_type,
            remarks: wcRow.remarks,
            input_item: wcRow.target_item,
            input_lot_no: wcRow.target_lot_no,
            input_qty: wcRow.target_qty,
            input_weight: wcRow.target_total_wt || (wcRow.target_qty * wcRow.target_weight),
            output_item: outItem.item_name,
            output_lot_no: outItem.lot_no,
            output_qty: outItem.qty,
            output_weight: outItem.total_wt || (outItem.qty * outItem.weight),
            source: 'WEIGHT_CONVERSION'
          });
        }
      } else if (wcRow.item_role === 'output') {
        for (const inItem of inputs) {
          if (inItem.lot_no) parentLotSet.add(String(inItem.lot_no).trim());
          weightConversionOutputs.push({
            conversion_id: convId,
            conversion_s_no: wcRow.conversion_s_no,
            voucher_no: `WC-${wcRow.conversion_s_no || convId}`,
            conversion_date: wcRow.conversion_date,
            conversion_type: wcRow.conversion_type,
            remarks: wcRow.remarks,
            output_item: wcRow.target_item,
            output_lot_no: wcRow.target_lot_no,
            output_qty: wcRow.target_qty,
            output_weight: wcRow.target_total_wt || (wcRow.target_qty * wcRow.target_weight),
            input_item: inItem.item_name,
            input_lot_no: inItem.lot_no,
            input_qty: inItem.qty,
            input_weight: inItem.total_wt || (inItem.qty * inItem.weight),
            source: 'WEIGHT_CONVERSION'
          });
        }
      }
    }
  } catch (_) {}

  // 7. Outside Inpass / Outpass + Lot Genealogy table
  const inpassLinks = [];
  try {
    const ipRes = await runner.query(`
      SELECT ii.*, ip.s_no AS ip_s_no, SUBSTR(CAST(ip.date AS TEXT), 1, 10) AS ip_date
      FROM inpass_items ii
      JOIN inpass ip ON ii.inpass_id = ip.id
      WHERE UPPER(TRIM(ii.lot_no)) IN (${familyPh}) OR UPPER(TRIM(COALESCE(ii.original_lot_no, ''))) IN (${familyPh})
    `, [...familyUpper, ...familyUpper]);
    for (const row of (ipRes.rows || [])) {
      if (row.lot_no && familyUpper.includes(row.lot_no.trim().toUpperCase()) && row.original_lot_no) {
        parentLotSet.add(row.original_lot_no.trim());
      }
      inpassLinks.push(row);
    }
  } catch (_) {}

  let genealogyParents = { rows: [] };
  let genealogyChildren = { rows: [] };
  try {
    genealogyParents = await runner.query(`SELECT * FROM lot_genealogy WHERE UPPER(TRIM(child_lot_no)) IN (${familyPh})`, familyUpper);
    for (const p of (genealogyParents.rows || [])) {
      if (p.parent_lot_no) parentLotSet.add(p.parent_lot_no.trim());
    }
    genealogyChildren = await runner.query(`SELECT * FROM lot_genealogy WHERE UPPER(TRIM(parent_lot_no)) IN (${familyPh})`, familyUpper);
  } catch (_) {}

  // 7b. Godown Transfers (item_transfers + godown_transfers)
  const godownTransfers = [];
  try {
    const gtRes = await runner.query(`
      SELECT id, date AS transfer_date, 'Transfer-' || CAST(id AS TEXT) AS ref_no,
             from_godown_name, to_godown_name, item_name, lot_no, qty, weight, vehicle_no, remarks
      FROM item_transfers
      WHERE UPPER(TRIM(COALESCE(lot_no, ''))) IN (${familyPh})
      ORDER BY date ASC, id ASC
    `, familyUpper);
    godownTransfers.push(...(gtRes.rows || []));
  } catch (_) {}
  try {
    const gt2Res = await runner.query(`
      SELECT id, transfer_date, COALESCE(transfer_no, 'GT-' || CAST(id AS TEXT)) AS ref_no,
             from_godown_name, to_godown_name, item_name, lot_no, transfer_qty AS qty, weight, vehicle_no, remarks
      FROM godown_transfers
      WHERE UPPER(TRIM(COALESCE(lot_no, ''))) IN (${familyPh})
      ORDER BY transfer_date ASC, id ASC
    `, familyUpper);
    godownTransfers.push(...(gt2Res.rows || []));
  } catch (_) {}

  // Resolve ALL parent lot purchases cleanly
  const parentLots = Array.from(parentLotSet).filter(l => l && l.toUpperCase() !== cleanLotNo.toUpperCase());
  const effectiveParentLot = parentLots[0] || null;
  const parentPurchases = [];
  for (const pLot of parentLots) {
    const pp = await fetchPurchaseForLot(pLot);
    if (pp) {
      parentPurchases.push({ ...pp, isDerivedFromParent: true, parentLotNo: pLot });
    }
  }
  if (!purchase && parentPurchases.length > 0) {
    purchase = parentPurchases[0];
  }

  // 8. QC Inspection
  let qc = null;
  try {
    const qcTargets = [cleanLotNo, ...parentLots].map(l => l.toUpperCase());
    const qcPh = qcTargets.map(() => 'UPPER(?)').join(',');
    const singleQc = await runner.query(`
      SELECT * FROM qc_inspections
      WHERE UPPER(TRIM(COALESCE(rm_lot_no, ''))) IN (${qcPh})
      ORDER BY id DESC LIMIT 1
    `, qcTargets);
    if (singleQc.rows?.length) {
      qc = singleQc.rows[0];
      const paramsRes = await runner.query('SELECT param_key, param_value FROM qc_inspection_params WHERE qc_id = ?', [qc.id]);
      qc.paramsList = (paramsRes.rows || []).map(p => {
        try {
          const parsed = JSON.parse(p.param_value);
          return {
            key: p.param_key,
            name: parsed.parameterName || p.param_key,
            value: parsed.actualResult ?? '',
            unit: parsed.unit || '',
            status: parsed.status || 'PASS'
          };
        } catch (_) {
          return { key: p.param_key, name: p.param_key, value: p.param_value, unit: '', status: 'PASS' };
        }
      });
      qc.summarySpecs = qc.paramsList.map(pr => `${pr.name}: ${pr.value}${pr.unit ? ' ' + pr.unit : ''}`).join(', ');
    }
  } catch (_) {}

  // 9. Jobwork Movements (Flour Out)
  let jobworkMovements = [];
  try {
    const jobworkOutRes = await runner.query(`
      SELECT foi.*, SUBSTR(CAST(fo.date AS TEXT), 1, 10) AS dispatch_date,
             COALESCE(pcm.name, fo.papad_company) AS contractor_name, fo.s_no AS dispatch_no
      FROM flour_out_items foi
      JOIN flour_out fo ON foi.flour_out_id = fo.id
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(fo.papad_company AS TEXT) OR pcm.name = fo.papad_company)
      WHERE UPPER(TRIM(foi.lot_no)) IN (${familyPh})
    `, familyUpper);
    jobworkMovements = jobworkOutRes.rows || [];
  } catch (_) {}

  // 10. Sales Dispatches (resolved Customer Name + real weight)
  let salesDispatches = [];
  try {
    const salesRes = await runner.query(`
      SELECT si.*,
             COALESCE(NULLIF(s.voucher_no, ''), CAST(s.s_no AS TEXT), CAST(s.id AS TEXT)) AS bill_no,
             SUBSTR(CAST(s.date AS TEXT), 1, 10) AS invoice_date,
             s.customer AS raw_customer, s.customer_id,
             s.pur_trans AS transport, COALESCE(s.vehicle_no, s.lorry_no, '') AS vehicle_no
      FROM sales_items si
      JOIN sales s ON si.sales_id = s.id
      WHERE UPPER(TRIM(si.lot_no)) IN (${familyPh})
      ORDER BY s.date ASC, s.id ASC
    `, familyUpper);
    salesDispatches = (salesRes.rows || []).map(row => {
      const cust = resolveCustomerFromDirectory(partyDir, row.raw_customer, row.customer_id);
      const qty = parseFloat(row.qty) || 0;
      const bagWt = parseFloat(row.weight) || 0;
      const totalWt = parseFloat(row.total_wt) || (qty * bagWt);
      return {
        ...row,
        customer_name: cust.name || row.raw_customer || 'Customer',
        qty,
        total_wt: totalWt
      };
    });
  } catch (_) {}

  // 11. Purchase Returns
  let purchaseReturns = [];
  try {
    const prRes = await runner.query(`
      SELECT
        pri.id AS item_id, pri.purchase_return_id, pri.lot_no, pri.item_name,
        pri.weight, pri.qty, pri.total_wt, pri.rate, pri.amount, pri.reason,
        pri.iqr_no, pri.qc_no, pri.source, pr.s_no AS return_s_no, pr.return_inv_no,
        SUBSTR(CAST(pr.date AS TEXT), 1, 10) AS return_date,
        pr.supplier AS supplier_raw,
        COALESCE(pr.status, 'RETURNED') AS return_status, pr.approval_status
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
      WHERE UPPER(TRIM(pri.lot_no)) IN (${familyPh})
      ORDER BY pr.id DESC
    `, familyUpper);
    purchaseReturns = (prRes.rows || []).map(row => ({
      ...row,
      supplier_name: resolveSupplierFromDirectory(partyDir, row.supplier_raw, null).name || row.supplier_raw || 'Supplier'
    }));
  } catch (_) {}

  // 12. Full Chronological Movement Audit Trail from clean stock_movements
  let movementsTimeline = [];
  try {
    const mvRes = await runner.query(`
      SELECT id, movement_date, movement_type, source_module, source_ref_no, godown_name,
             lot_no, rm_lot_no, fg_lot_no, parent_lot_no, item_name, direction, qty, weight,
             party_name, supplier_name, supplier_invoice_no, nav_route, remarks
      FROM stock_movements
      WHERE is_reversed = 0 AND is_reversal = 0
        AND (UPPER(TRIM(COALESCE(lot_no, ''))) = UPPER(?)
             OR UPPER(TRIM(COALESCE(fg_lot_no, ''))) = UPPER(?)
             OR UPPER(TRIM(COALESCE(parent_lot_no, ''))) = UPPER(?))
      ORDER BY movement_date ASC, id ASC
    `, [cleanLotNo, cleanLotNo, cleanLotNo]);
    movementsTimeline = (mvRes.rows || []).map(m => {
      const resolved = resolvePartyFromDirectory(partyDir, {
        supplierName: m.supplier_name,
        partyName: m.party_name,
        sourceModule: m.source_module
      });
      return {
        ...m,
        party_name: resolved.partyName || m.party_name || m.godown_name || '-'
      };
    });
  } catch (_) {}

  const totalReturnedQty = purchaseReturns.reduce((sum, pr) => sum + (parseFloat(pr.qty) || 0), 0);
  const totalReturnedWeight = purchaseReturns.reduce((sum, pr) => sum + (parseFloat(pr.total_wt) || 0), 0);

  const finalItemName =
    stockLot.item_name ||
    purchase?.itemName ||
    millingOutputs[0]?.finished_product ||
    millingConsumptions[0]?.target_product ||
    csRows[0]?.item_name ||
    purchaseReturns[0]?.item_name ||
    movementsTimeline[0]?.item_name ||
    'Raw Material';

  const slTotalQty = stockLotRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
  const slRemQty = stockLotRows.reduce((s, r) => s + (parseFloat(r.remaining_quantity ?? r.quantity) || 0), 0);

  const finalQty = mvTotalInQty > 0 ? mvTotalInQty : (slTotalQty || purchase?.qty || (millingOutputs[0]?.output_bags || 0));
  let finalRemaining = godownBalances.length > 0 ? mvNetQty : slRemQty;
  const currentWeightKg = godownBalances.length > 0 ? mvNetWt : (parseFloat(purchase?.totalWeight) || 0);
  const originalWeightKg = mvTotalInWt > 0 ? mvTotalInWt : (parseFloat(purchase?.totalWeight) || (millingOutputs[0]?.output_kgs || 0));

  if (totalReturnedQty > 0 && godownBalances.length === 0 && finalRemaining === finalQty && finalQty > 0) {
    finalRemaining = Math.max(0, finalQty - totalReturnedQty);
  }

  let determinedQcStatus = stockLot.qc_status || (qc?.overall_result ? qc.overall_result.toUpperCase() : 'ACCEPTED');
  if (stockLot.unloading_status === 'RETURNED' || (purchaseReturns.length > 0 && finalRemaining <= 0)) {
    determinedQcStatus = 'RETURNED';
  } else if (purchaseReturns.length > 0 && finalRemaining > 0) {
    determinedQcStatus = 'PARTIALLY_RETURNED';
  }

  const primaryGodown =
    godownBalances.find(g => g.balanceQty > 0)?.godownName ||
    godownBalances[0]?.godownName ||
    stockLot.current_godown ||
    stockLot.godown_name ||
    defGodown.name;

  return {
    lotNo: cleanLotNo,
    itemName: finalItemName,
    quantity: finalQty,
    remainingQuantity: finalRemaining,
    originalWeightKg,
    currentWeightKg,
    totalReturnedQty,
    totalReturnedWeight,
    unit: purchase?.unit || csRows[0]?.unit || 'KG',
    godown: primaryGodown,
    godownBalances,
    qcStatus: determinedQcStatus,
    purchase,
    parentPurchases,
    parentLots,
    effectiveParentLot,
    vehicle,
    qc,
    coldStorageMovements: csRows.filter(r => !r.is_auto_sync),
    coldStorageSiblings: csSiblingLots.filter(l => l.toUpperCase() !== cleanLotNo.toUpperCase()),
    godownTransfers,
    inpassLinks,
    millingConsumptions,
    millingOutputs,
    workOrderConsumptions: millingConsumptions,
    workOrderOutputs: millingOutputs,
    jobworkMovements,
    salesDispatches,
    weightConversionConsumptions,
    weightConversionOutputs,
    purchaseReturns,
    movementsTimeline,
    parents: genealogyParents.rows || [],
    children: genealogyChildren.rows || []
  };
}

/**
 * Recursive Forward Traceability Tree (with cycle guard)
 */
async function buildForwardTrace(lotNo, companyId = 1, visited = new Set()) {
  const details = await getLotDetails(lotNo, companyId);
  if (!details) return null;

  const { runner } = getRunner(companyId);
  const visitedNext = new Set(visited);
  visitedNext.add(details.lotNo.toUpperCase());

  const tree = {
    id: `LOT-${details.lotNo}`,
    name: details.lotNo,
    type: 'LOT',
    item: details.itemName,
    quantity: details.quantity,
    remainingQuantity: details.remainingQuantity,
    currentWeightKg: details.currentWeightKg,
    totalReturnedQty: details.totalReturnedQty || 0,
    stage: details.purchase?.isDerivedFromParent ? 'Milled / Converted Output' : 'Raw Inward Material',
    children: []
  };

  if (details.purchase) {
    tree.purchase = {
      voucherNo: details.purchase.voucherNo || details.purchase.invNo || `PUR-${details.purchase.purchaseId}`,
      supplier: details.purchase.supplierName || 'Primary Grain Vendor',
      date: details.purchase.purchaseDate || 'N/A',
      vehicle: details.purchase.vehicleNo || 'N/A',
      isDerivedFromParent: details.purchase.isDerivedFromParent,
      parentLotNo: details.purchase.parentLotNo
    };
  }

  const qcNode = {
    id: `QC-${details.lotNo}`,
    name: details.qc?.qc_no || (details.qcStatus === 'ACCEPTED' ? 'QC Verified (ACCEPTED)' : (details.qcStatus === 'RETURNED' ? 'QC Rejected / Returned' : 'QC Inward Check')),
    type: 'QC',
    status: details.qc?.overall_result || details.qcStatus || 'ACCEPTED',
    inspector: details.qc?.inspector || 'QA Inspector',
    date: details.qc?.inspection_date || details.purchase?.purchaseDate || 'N/A',
    summarySpecs: details.qc?.summarySpecs || '',
    children: []
  };

  const defGodown = await getDefaultGodownInfo(runner);
  const storageNode = {
    id: `GODOWN-${details.lotNo}`,
    name: details.godown || defGodown.name,
    type: 'STORAGE',
    remainingQuantity: details.remainingQuantity,
    godownBalances: details.godownBalances,
    children: []
  };

  // Purchase Returns
  for (const pr of (details.purchaseReturns || [])) {
    storageNode.children.push({
      id: `PUR-RET-${pr.return_inv_no || pr.purchase_return_id}`,
      name: `Purchase Return #${pr.return_inv_no || pr.return_s_no} → ${pr.supplier_name}`,
      type: 'PURCHASE_RETURN',
      supplier: pr.supplier_name,
      voucherNo: pr.return_inv_no || pr.return_s_no,
      qty: pr.qty,
      weight: pr.total_wt || (pr.weight * pr.qty),
      date: pr.return_date,
      reason: pr.reason || 'QC Rejection / Returned to Vendor',
      status: pr.return_status || 'RETURNED'
    });
  }

  // Cold Storage Movements
  for (const cs of (details.coldStorageMovements || [])) {
    storageNode.children.push({
      id: `CS-${cs.voucher_no}-${cs.cold_storage_lot_no}`,
      name: `Cold Storage ${cs.voucher_type} #${cs.voucher_no} → ${cs.cold_storage_name} (${cs.cold_storage_lot_no})`,
      type: 'COLD_STORAGE',
      date: cs.voucher_date,
      qty: cs.quantity,
      weight: cs.total_wt
    });
  }

  // Godown Transfers
  for (const gt of (details.godownTransfers || [])) {
    storageNode.children.push({
      id: `GT-${gt.ref_no}-${gt.id}`,
      name: `Transfer #${gt.ref_no}: ${gt.from_godown_name} → ${gt.to_godown_name}`,
      type: 'GODOWN_TRANSFER',
      date: gt.transfer_date,
      qty: gt.qty,
      weight: gt.weight
    });
  }

  // Milling Batches (recursive into output lots)
  for (const mc of (details.millingConsumptions || [])) {
    const woNode = {
      id: `WO-${mc.work_order_no}-${mc.output_lot_no || 'out'}`,
      name: `Milling Batch: ${mc.work_order_no}`,
      type: 'PRODUCTION',
      consumedQty: mc.input_qty,
      mill: mc.work_unit || 'BVC MILL',
      date: mc.work_order_date,
      children: []
    };

    if (mc.output_lot_no && !visitedNext.has(mc.output_lot_no.toUpperCase())) {
      const childTree = await buildForwardTrace(mc.output_lot_no, companyId, visitedNext);
      if (childTree) {
        woNode.children.push(childTree);
      }
    }
    storageNode.children.push(woNode);
  }

  // Weight Conversions (recursive into output lots)
  for (const wc of (details.weightConversionConsumptions || [])) {
    const wcNode = {
      id: `WC-${wc.conversion_s_no || wc.conversion_id}-${wc.output_lot_no || 'out'}`,
      name: `Weight Conversion #${wc.conversion_s_no || wc.conversion_id} (${wc.conversion_type || 'Conversion'})`,
      type: 'WEIGHT_CONVERSION',
      consumedQty: wc.input_qty,
      consumedWeight: wc.input_weight,
      date: wc.conversion_date,
      remarks: wc.remarks || '-',
      children: []
    };

    if (wc.output_lot_no && !visitedNext.has(wc.output_lot_no.toUpperCase())) {
      const childTree = await buildForwardTrace(wc.output_lot_no, companyId, visitedNext);
      if (childTree) {
        wcNode.children.push(childTree);
      }
    }
    storageNode.children.push(wcNode);
  }

  // Jobwork Direct Issue
  for (const jw of (details.jobworkMovements || [])) {
    storageNode.children.push({
      id: `JW-DIR-${jw.dispatch_no}`,
      name: `Contractor Issue: ${jw.contractor_name}`,
      type: 'JOBWORK',
      contractor: jw.contractor_name,
      issuedQty: jw.total_wt || jw.qty || 0,
      date: jw.dispatch_date || jw.date
    });
  }

  // Direct Sales Dispatches
  for (const sd of (details.salesDispatches || [])) {
    storageNode.children.push({
      id: `SALE-DIR-${sd.bill_no}-${sd.id || ''}`,
      name: `Invoice #${sd.bill_no} → ${sd.customer_name}`,
      type: 'SALES_CUSTOMER',
      customer: sd.customer_name,
      qty: sd.qty,
      weight: sd.total_wt,
      date: sd.invoice_date
    });
  }

  qcNode.children.push(storageNode);
  tree.children.push(qcNode);
  tree.movementsTimeline = details.movementsTimeline;

  return tree;
}

/**
 * Recursive Backward Traceability Tree (with cycle guard & multi-input parent support)
 */
async function buildBackwardTrace(lotNo, companyId = 1, visited = new Set()) {
  const details = await getLotDetails(lotNo, companyId);
  if (!details) return null;

  const visitedNext = new Set(visited);
  visitedNext.add(details.lotNo.toUpperCase());

  const backwardTree = {
    id: `BACK-LOT-${details.lotNo}`,
    name: details.lotNo,
    type: 'FINISHED_LOT',
    item: details.itemName,
    quantity: details.quantity,
    remainingQuantity: details.remainingQuantity,
    currentWeightKg: details.currentWeightKg,
    totalReturnedQty: details.totalReturnedQty || 0,
    stage: details.purchase?.isDerivedFromParent ? 'Converted / Milled Product' : (details.purchaseReturns?.length > 0 ? 'Returned / Raw Material' : 'Raw Inward Stock'),
    parents: []
  };

  // Milling / Production batches
  for (const mo of (details.millingOutputs || [])) {
    const woNode = {
      id: `BACK-WO-${mo.work_order_no}`,
      name: `Milling Batch: ${mo.work_order_no} (${mo.work_unit || 'BVC MILL'})`,
      type: 'PRODUCTION',
      mill: mo.work_unit || 'BVC MILL',
      date: mo.work_order_date,
      inputs: []
    };

    const inputsList = (mo.inputs && mo.inputs.length > 0) ? mo.inputs : (mo.input_lot_no ? [{ lot_no: mo.input_lot_no, item_name: mo.input_item, total_wt: mo.output_kgs }] : []);
    for (const inp of inputsList) {
      if (!inp.lot_no) continue;
      const rawLotDetails = !visitedNext.has(inp.lot_no.toUpperCase()) ? await getLotDetails(inp.lot_no, companyId) : null;
      const parentSubtree = !visitedNext.has(inp.lot_no.toUpperCase()) ? await buildBackwardTrace(inp.lot_no, companyId, visitedNext) : null;
      woNode.inputs.push({
        id: `BACK-RAW-${inp.lot_no}`,
        name: inp.lot_no,
        item: inp.item_name || rawLotDetails?.itemName,
        consumedQty: inp.total_wt || mo.output_kgs,
        supplier: rawLotDetails?.purchase?.supplierName || 'Primary Supplier',
        purchaseVoucher: rawLotDetails?.purchase?.voucherNo || 'N/A',
        purchaseDate: rawLotDetails?.purchase?.purchaseDate || 'N/A',
        qcResult: rawLotDetails?.qc?.overall_result || rawLotDetails?.qcStatus || 'ACCEPTED',
        vehicleNo: rawLotDetails?.purchase?.vehicleNo || 'N/A',
        hasReturn: (rawLotDetails?.purchaseReturns?.length > 0),
        ancestry: parentSubtree
      });
    }
    backwardTree.parents.push(woNode);
  }

  // Weight Conversion
  for (const wco of (details.weightConversionOutputs || [])) {
    const wcNode = {
      id: `BACK-WC-${wco.conversion_s_no || wco.conversion_id}`,
      name: `Weight Conversion #${wco.conversion_s_no || wco.conversion_id} (${wco.conversion_type || 'Conversion'})`,
      type: 'WEIGHT_CONVERSION',
      date: wco.conversion_date,
      remarks: wco.remarks || '-',
      inputs: []
    };
    if (wco.input_lot_no && !visitedNext.has(wco.input_lot_no.toUpperCase())) {
      const rawLotDetails = await getLotDetails(wco.input_lot_no, companyId);
      const parentSubtree = await buildBackwardTrace(wco.input_lot_no, companyId, visitedNext);
      wcNode.inputs.push({
        id: `BACK-WC-RAW-${wco.input_lot_no}`,
        name: wco.input_lot_no,
        item: wco.input_item || rawLotDetails?.itemName,
        consumedQty: wco.input_qty,
        consumedWeight: wco.input_weight,
        supplier: rawLotDetails?.purchase?.supplierName || 'Primary Supplier',
        purchaseVoucher: rawLotDetails?.purchase?.voucherNo || 'N/A',
        purchaseDate: rawLotDetails?.purchase?.purchaseDate || 'N/A',
        qcResult: rawLotDetails?.qc?.overall_result || rawLotDetails?.qcStatus || 'ACCEPTED',
        vehicleNo: rawLotDetails?.purchase?.vehicleNo || 'N/A',
        hasReturn: (rawLotDetails?.purchaseReturns?.length > 0),
        ancestry: parentSubtree
      });
    }
    backwardTree.parents.push(wcNode);
  }

  // Purchases (all direct or derived parent purchases)
  const purList = details.parentPurchases?.length > 0 && details.purchase?.isDerivedFromParent
    ? details.parentPurchases
    : (details.purchase ? [details.purchase] : []);

  for (const pur of purList) {
    backwardTree.parents.push({
      id: `BACK-PUR-${pur.voucherNo || pur.purchaseId}-${pur.lotNo || details.lotNo}`,
      name: pur.isDerivedFromParent
        ? `Upstream Purchase (Parent Lot ${pur.parentLotNo}): Inv #${pur.voucherNo}`
        : `Purchase #${pur.voucherNo}`,
      type: 'PURCHASE',
      supplier: pur.supplierName,
      purchaseDate: pur.purchaseDate,
      vehicleNo: pur.vehicleNo,
      qcStatus: details.qc?.overall_result || details.qcStatus || 'ACCEPTED',
      lotNo: pur.parentLotNo || details.lotNo,
      item: pur.itemName
    });
  }

  // Purchase Returns
  for (const pr of (details.purchaseReturns || [])) {
    backwardTree.parents.push({
      id: `BACK-RET-${pr.return_inv_no || pr.purchase_return_id}`,
      name: `Returned to Vendor: Inv #${pr.return_inv_no || pr.return_s_no} (${pr.qty} Bags / ${pr.total_wt} KG)`,
      type: 'PURCHASE_RETURN',
      supplier: pr.supplier_name,
      returnDate: pr.return_date,
      reason: pr.reason,
      status: pr.return_status,
      qcNo: pr.qc_no,
      iqrNo: pr.iqr_no
    });
  }

  backwardTree.movementsTimeline = details.movementsTimeline;
  return backwardTree;
}

/**
 * Generate Comprehensive Product Recall Readiness Report
 */
async function generateRecallReport(lotNo, companyId = 1) {
  const details = await getLotDetails(lotNo, companyId);
  if (!details) throw new Error(`Lot ${lotNo} not found`);

  const { runner } = getRunner(companyId);
  const forwardTree = await buildForwardTrace(lotNo, companyId);
  const backwardTree = await buildBackwardTrace(lotNo, companyId);

  const affectedCustomers = [];
  const affectedSuppliers = [];
  const affectedBatches = [];
  const affectedGodowns = details.godownBalances?.length > 0
    ? Array.from(new Set(details.godownBalances.map(g => g.godownName)))
    : [details.godown || (await getDefaultGodownInfo(runner)).name];
  const returnedToSuppliers = [];

  const purSources = details.parentPurchases?.length > 0 ? details.parentPurchases : (details.purchase ? [details.purchase] : []);
  for (const ps of purSources) {
    if (ps.supplierName) {
      affectedSuppliers.push({
        supplierName: ps.supplierName,
        voucherNo: ps.voucherNo,
        date: ps.purchaseDate,
        vehicleNo: ps.vehicleNo,
        lotNo: ps.parentLotNo || ps.lotNo || details.lotNo
      });
    }
  }

  for (const pr of (details.purchaseReturns || [])) {
    returnedToSuppliers.push({
      supplierName: pr.supplier_name,
      returnInvNo: pr.return_inv_no || pr.return_s_no,
      date: pr.return_date,
      returnedQty: pr.qty,
      returnedWeight: pr.total_wt,
      reason: pr.reason,
      status: pr.return_status
    });
  }

  for (const sd of (details.salesDispatches || [])) {
    affectedCustomers.push({
      customerName: sd.customer_name,
      invoiceNo: sd.bill_no,
      date: sd.invoice_date,
      quantity: sd.qty,
      weightKg: sd.total_wt
    });
  }

  for (const mc of (details.millingConsumptions || [])) {
    affectedBatches.push({ batchNo: mc.work_order_no, unit: mc.work_unit, date: mc.work_order_date });
  }
  for (const mo of (details.millingOutputs || [])) {
    if (!affectedBatches.some(b => b.batchNo === mo.work_order_no)) {
      affectedBatches.push({ batchNo: mo.work_order_no, unit: mo.work_unit, date: mo.work_order_date });
    }
  }
  for (const wc of (details.weightConversionConsumptions || [])) {
    affectedBatches.push({ batchNo: `WC-${wc.conversion_s_no || wc.conversion_id}`, unit: 'Weight Conversion', date: wc.conversion_date, type: wc.conversion_type });
  }
  for (const wco of (details.weightConversionOutputs || [])) {
    if (!affectedBatches.some(b => b.batchNo === `WC-${wco.conversion_s_no || wco.conversion_id}`)) {
      affectedBatches.push({ batchNo: `WC-${wco.conversion_s_no || wco.conversion_id}`, unit: 'Weight Conversion', date: wco.conversion_date, type: wco.conversion_type });
    }
  }

  return {
    lotNo: details.lotNo,
    itemName: details.itemName,
    lotStatus: details.qcStatus,
    currentStockQty: details.remainingQuantity,
    currentStockKg: details.currentWeightKg,
    originalQtyKg: details.originalWeightKg,
    totalReturnedQty: details.totalReturnedQty || 0,
    totalReturnedWeight: details.totalReturnedWeight || 0,
    recallSeverityLevel: details.qcStatus === 'REJECTED' || details.qcStatus === 'RETURNED' ? 'CRITICAL' : 'STANDARD_AUDIT',
    affectedSuppliers,
    returnedToSuppliers,
    affectedBatches,
    affectedGodowns,
    affectedCustomers,
    forwardTree,
    backwardTree,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Perform a physical/logical Lot Split with full genealogy preservation
 */
async function performLotSplit({ sourceLotNo, splitQuantities = [], reason = '', operator = 'Admin' }, companyId = 1) {
  if (!sourceLotNo || !splitQuantities.length) {
    throw new Error('Source lot number and split quantities are required');
  }

  const { runner } = getRunner(companyId);
  const srcLot = await getLotDetails(sourceLotNo, companyId);
  if (!srcLot) throw new Error(`Source lot ${sourceLotNo} not found`);

  const totalSplitQty = splitQuantities.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  if (totalSplitQty > (srcLot.remainingQuantity || srcLot.quantity)) {
    throw new Error(`Split total (${totalSplitQty}) exceeds available lot balance (${srcLot.remainingQuantity})`);
  }

  const createdLots = [];
  const defGodown = await getDefaultGodownInfo(runner);

  for (let i = 0; i < splitQuantities.length; i++) {
    const item = splitQuantities[i];
    const newLotNo = item.targetLotNo || `${sourceLotNo}-S${i + 1}`;
    const qty = parseFloat(item.quantity) || 0;
    const godown = item.godownName || srcLot.godown || defGodown.name;

    await runner.run(`
      INSERT INTO stock_lots (item_name, lot_no, godown_name, quantity, remaining_quantity, qc_status, approval_status, usable_for_production)
      VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', 1)
    `, [srcLot.itemName, newLotNo, godown, qty, qty, srcLot.qcStatus]);

    await runner.run(`
      INSERT INTO lot_genealogy (parent_lot_no, child_lot_no, quantity, uom, transaction_type, transaction_no, remarks)
      VALUES (?, ?, ?, 'KG', 'LOT_SPLIT', ?, ?)
    `, [sourceLotNo, newLotNo, qty, `SPLIT-${Date.now()}`, reason || `Split from ${sourceLotNo}`]);

    createdLots.push({ lotNo: newLotNo, quantity: qty, godown });
  }

  await runner.run(`
    UPDATE stock_lots
    SET remaining_quantity = CASE WHEN remaining_quantity > ? THEN remaining_quantity - ? ELSE 0 END
    WHERE LOWER(lot_no) = LOWER(?)
  `, [totalSplitQty, totalSplitQty, sourceLotNo]);

  return {
    success: true,
    sourceLotNo,
    deductedQty: totalSplitQty,
    remainingSourceQty: Math.max(0, (srcLot.remainingQuantity || srcLot.quantity) - totalSplitQty),
    createdLots
  };
}

/**
 * Perform Lot Merge with complete genealogy preservation
 */
async function performLotMerge({ sourceLots = [], targetLotNo, targetItemName, reason = '', operator = 'Admin' }, companyId = 1) {
  if (!sourceLots.length || !targetLotNo) {
    throw new Error('Source lots and target lot number are required');
  }

  const { runner } = getRunner(companyId);
  let totalMergedQty = 0;
  let itemName = targetItemName || '';

  for (const src of sourceLots) {
    const sLot = await getLotDetails(src.lotNo, companyId);
    if (!sLot) throw new Error(`Source lot ${src.lotNo} not found`);
    const q = parseFloat(src.quantity) || sLot.remainingQuantity || 0;
    totalMergedQty += q;
    if (!itemName) itemName = sLot.itemName;

    await runner.run(`
      UPDATE stock_lots
      SET remaining_quantity = CASE WHEN remaining_quantity > ? THEN remaining_quantity - ? ELSE 0 END
      WHERE LOWER(lot_no) = LOWER(?)
    `, [q, q, src.lotNo]);

    await runner.run(`
      INSERT INTO lot_genealogy (parent_lot_no, child_lot_no, quantity, uom, transaction_type, transaction_no, remarks)
      VALUES (?, ?, ?, 'KG', 'LOT_MERGE', ?, ?)
    `, [src.lotNo, targetLotNo, q, `MERGE-${Date.now()}`, reason || `Merged into ${targetLotNo}`]);
  }

  const defGodown = await getDefaultGodownInfo(runner);
  await runner.run(`
    INSERT INTO stock_lots (item_name, lot_no, godown_name, quantity, remaining_quantity, qc_status, approval_status, usable_for_production)
    VALUES (?, ?, ?, ?, ?, 'ACCEPTED', 'APPROVED', 1)
  `, [itemName, targetLotNo, defGodown.name, totalMergedQty, totalMergedQty]);

  return {
    success: true,
    targetLotNo,
    totalMergedQty,
    itemName,
    sourceLots
  };
}

module.exports = {
  searchLots,
  getLotDetails,
  buildForwardTrace,
  buildBackwardTrace,
  generateRecallReport,
  performLotSplit,
  performLotMerge
};
