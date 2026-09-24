const db = require('../config/database');

/**
 * Advanced Lot Genealogy and Traceability Service
 * Builds bidirectional (forward and backward) trees, recall readiness datasets,
 * split/merge operations, and multi-parameter lot search based on real inventory.
 */

// Helper to normalize strings for comparison
const norm = (s) => (s || '').trim().toLowerCase();

/**
 * Searches lots across stock_lots, purchases, grains, work_orders, flour_out, sales
 */
async function searchLots(query = '', filters = {}) {
  const q = (query || '').trim().toLowerCase();
  const lotsMap = new Map();

  // 1. Fetch from stock_lots
  let sql = `
    SELECT 
      sl.id,
      sl.lot_no as lotNo,
      sl.item_name as itemName,
      sl.quantity,
      sl.remaining_quantity as remainingQuantity,
      COALESCE(gm.godown_name, sl.godown_name, 'Main Godown') as godownName,
      sl.qc_status as qcStatus,
      sl.approval_status as approvalStatus,
      sl.unloading_status as unloadingStatus,
      sl.created_at as createdAt,
      'STOCK_LOT' as source
    FROM stock_lots sl
    LEFT JOIN godown_master gm ON sl.godown_id = gm.id
    WHERE sl.lot_no IS NOT NULL AND sl.lot_no != ''
  `;
  const params = [];

  if (q) {
    sql += ` AND (LOWER(sl.lot_no) LIKE ? OR LOWER(sl.item_name) LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }

  const stockLotsRes = await db.query(sql + ` ORDER BY sl.id DESC LIMIT 100`, params);

  for (const row of (stockLotsRes.rows || [])) {
    if (row.lotNo && !lotsMap.has(row.lotNo)) {
      lotsMap.set(row.lotNo, {
        lotNo: row.lotNo,
        itemName: row.itemName || 'Raw Material',
        currentQuantity: row.remainingQuantity ?? row.quantity ?? 0,
        originalQuantity: row.quantity ?? 0,
        location: row.godownName || 'Main Godown',
        qcStatus: row.qcStatus || 'ACCEPTED',
        createdAt: row.createdAt
      });
    }
  }

  // 2. Also search across purchases & purchase_items
  const purLots = await db.query(`
    SELECT DISTINCT 
      pi.lot_no as lotNo, 
      pi.item_name as itemName, 
      COALESCE(sm.name, p.supplier) as supplierName, 
      SUBSTR(COALESCE(CAST(p.date AS TEXT), CAST(p.inv_date AS TEXT), ''), 1, 10) as purchaseDate, 
      COALESCE(NULLIF(p.voucher_no, ''), NULLIF(p.inv_no, ''), NULLIF(p.po_no, ''), 'PUR-' || CAST(p.s_no AS TEXT)) as voucherNo
    FROM purchase_items pi
    JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR sm.name = p.supplier)
    WHERE pi.lot_no IS NOT NULL AND pi.lot_no != '' ${q ? "AND (LOWER(pi.lot_no) LIKE ? OR LOWER(pi.item_name) LIKE ? OR LOWER(COALESCE(sm.name, p.supplier, '')) LIKE ?)" : ''}
    LIMIT 50
  `, q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []);

  for (const row of (purLots.rows || [])) {
    if (row.lotNo && !lotsMap.has(row.lotNo)) {
      lotsMap.set(row.lotNo, {
        lotNo: row.lotNo,
        itemName: row.itemName,
        supplier: row.supplierName,
        voucherNo: row.voucherNo,
        date: row.purchaseDate,
        location: 'Inward Ingestion',
        qcStatus: 'ACCEPTED'
      });
    }
  }

  // 3. Search grains (grain grinding / milling outputs)
  const grainLots = await db.query(`
    SELECT DISTINCT 
      goi.lot_no as lotNo, 
      goi.item_name as itemName, 
      g.work_order_no as workOrderNo, 
      SUBSTR(CAST(g.date AS TEXT), 1, 10) as millingDate,
      COALESCE(fmm.flourmill, g.flour_mill, 'BVC MILL') as flourMill
    FROM grain_output_items goi
    JOIN grains g ON goi.grain_id = g.id
    LEFT JOIN flour_mill_master fmm ON (CAST(fmm.id AS TEXT) = CAST(g.flour_mill AS TEXT) OR fmm.flourmill = g.flour_mill)
    WHERE goi.lot_no IS NOT NULL AND goi.lot_no != '' ${q ? 'AND (LOWER(goi.lot_no) LIKE ? OR LOWER(goi.item_name) LIKE ?)' : ''}
    LIMIT 50
  `, q ? [`%${q}%`, `%${q}%`] : []);

  for (const row of (grainLots.rows || [])) {
    if (row.lotNo && !lotsMap.has(row.lotNo)) {
      lotsMap.set(row.lotNo, {
        lotNo: row.lotNo,
        itemName: row.itemName,
        workOrderNo: row.workOrderNo,
        date: row.millingDate,
        location: row.flourMill || 'Milling Floor',
        qcStatus: 'ACCEPTED'
      });
    }
  }

  // 4. Search work orders outputs
  const woLots = await db.query(`
    SELECT DISTINCT fg_lot_no as lotNo, output_item as itemName, wo.work_order_no as workOrderNo, SUBSTR(CAST(wo.date AS TEXT), 1, 10) as date
    FROM work_order_outputs woo
    LEFT JOIN work_orders wo ON woo.work_order_id = wo.id
    WHERE fg_lot_no IS NOT NULL AND fg_lot_no != '' ${q ? 'AND (LOWER(fg_lot_no) LIKE ? OR LOWER(output_item) LIKE ?)' : ''}
    LIMIT 50
  `, q ? [`%${q}%`, `%${q}%`] : []);

  for (const row of (woLots.rows || [])) {
    if (row.lotNo && !lotsMap.has(row.lotNo)) {
      lotsMap.set(row.lotNo, {
        lotNo: row.lotNo,
        itemName: row.itemName,
        workOrderNo: row.workOrderNo,
        date: row.date,
        location: 'Production Output',
        qcStatus: 'ACCEPTED'
      });
    }
  }

  // 5. Search Purchase Returns / Vendor Return records
  try {
    const prLots = await db.query(`
      SELECT DISTINCT
        pri.lot_no as lotNo,
        pri.item_name as itemName,
        COALESCE(sm.name, pr.supplier) as supplierName,
        pr.return_inv_no as returnInvNo,
        SUBSTR(CAST(pr.date AS TEXT), 1, 10) as returnDate,
        pri.qty as returnedQty,
        pri.reason,
        COALESCE(pr.status, 'RETURNED') as status
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
      LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(pr.supplier AS TEXT) OR sm.name = pr.supplier)
      WHERE pri.lot_no IS NOT NULL AND pri.lot_no != '' ${q ? 'AND (LOWER(pri.lot_no) LIKE ? OR LOWER(pri.item_name) LIKE ? OR LOWER(pr.return_inv_no) LIKE ? OR LOWER(COALESCE(sm.name, pr.supplier, \'\')) LIKE ?)' : ''}
      LIMIT 50
    `, q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`] : []);

    for (const row of (prLots.rows || [])) {
      if (row.lotNo && !lotsMap.has(row.lotNo)) {
        lotsMap.set(row.lotNo, {
          lotNo: row.lotNo,
          itemName: row.itemName,
          supplier: row.supplierName,
          voucherNo: row.returnInvNo,
          date: row.returnDate,
          location: 'Returned to Supplier',
          qcStatus: 'RETURNED'
        });
      }
    }
  } catch (prErr) {
    // Ignore if table temporarily unpopulated
  }

  return Array.from(lotsMap.values());
}

/**
 * Gets detailed metadata, QC, stock, production and commercial history for a specific lot
 */
async function getLotDetails(lotNo) {
  if (!lotNo) return null;
  const cleanLotNo = lotNo.trim();

  // 1. Stock Lots record
  const stockLotRes = await db.query(`
    SELECT sl.*, COALESCE(gm.godown_name, sl.godown_name, 'Main Godown') as current_godown
    FROM stock_lots sl
    LEFT JOIN godown_master gm ON sl.godown_id = gm.id
    WHERE LOWER(sl.lot_no) = LOWER(?)
    LIMIT 1
  `, [cleanLotNo]);
  const stockLot = stockLotRes.rows?.[0] || {};

  // 2. Inward Purchase info (Direct inward record)
  const purRes = await db.query(`
    SELECT 
      p.id as purchaseId,
      p.s_no as purchaseSNo,
      COALESCE(NULLIF(p.voucher_no, ''), NULLIF(p.inv_no, ''), NULLIF(p.po_no, ''), 'PUR-' || p.s_no, 'PUR-' || p.id) as voucherNo,
      p.inv_no as invNo,
      p.po_no as poNo,
      SUBSTR(COALESCE(CAST(p.date AS TEXT), CAST(p.inv_date AS TEXT), ''), 1, 10) as purchaseDate,
      COALESCE(sm.name, NULLIF(p.supplier, '')) as supplierName,
      sm.phone_res as supplierPhone,
      COALESCE(NULLIF(p.vehicle_no, ''), NULLIF(p.lorry_no, ''), 'N/A') as vehicleNo,
      COALESCE(NULLIF(p.driver, ''), NULLIF(p.driver_name, ''), '') as driverName,
      COALESCE(NULLIF(p.transport, ''), NULLIF(p.transporter, ''), '') as transportName,
      pi.item_name as itemName,
      pi.qty,
      pi.unit,
      COALESCE(NULLIF(pi.total_weight, 0), NULLIF(pi.weight, 0), p.total_weight, 0) as totalWeight,
      pi.rate
    FROM purchase_items pi
    JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR sm.name = p.supplier)
    WHERE LOWER(pi.lot_no) = LOWER(?)
    LIMIT 1
  `, [cleanLotNo]);
  let purchase = purRes.rows?.[0] || null;

  // 3. Vehicle Movements
  const vehRes = await db.query(`
    SELECT * FROM vehicle_movements 
    WHERE LOWER(lot_no) = LOWER(?) OR (vehicle_no = ? AND vehicle_no != '')
    ORDER BY id DESC LIMIT 1
  `, [cleanLotNo, purchase?.vehicleNo || '']);
  const vehicle = vehRes.rows?.[0] || null;

  // 4. Milling & Production - Check grains table (BVC ERP milling vouchers)
  const grainMillingRes = await db.query(`
    SELECT 
      g.id as grain_id,
      g.s_no as grain_s_no,
      SUBSTR(CAST(g.date AS TEXT), 1, 10) as milling_date,
      g.work_order_no,
      COALESCE(fmm.flourmill, g.flour_mill, 'BVC MILL') as flour_mill_name,
      gii.lot_no as input_lot_no,
      gii.item_name as input_item,
      gii.qty as input_qty,
      gii.total_wt as input_weight,
      goi.lot_no as output_lot_no,
      goi.item_name as output_item,
      goi.qty as output_qty,
      goi.total_wt as output_weight
    FROM grains g
    LEFT JOIN flour_mill_master fmm ON (CAST(fmm.id AS TEXT) = CAST(g.flour_mill AS TEXT) OR fmm.flourmill = g.flour_mill)
    LEFT JOIN grain_input_items gii ON g.id = gii.grain_id
    LEFT JOIN grain_output_items goi ON g.id = goi.grain_id
    WHERE LOWER(gii.lot_no) = LOWER(?) OR LOWER(goi.lot_no) = LOWER(?)
  `, [cleanLotNo, cleanLotNo]);

  const millingConsumptions = [];
  const millingOutputs = [];
  let parentLotFromMilling = null;

  for (const gr of (grainMillingRes.rows || [])) {
    if (gr.input_lot_no && gr.input_lot_no.toLowerCase() === cleanLotNo.toLowerCase()) {
      millingConsumptions.push({
        work_order_no: gr.work_order_no || `MILL-${gr.grain_s_no}`,
        work_unit: gr.flour_mill_name,
        target_product: gr.output_item || 'Flour',
        work_order_date: gr.milling_date,
        input_qty: gr.input_weight || (gr.input_qty ? gr.input_qty * 50 : 0),
        output_lot_no: gr.output_lot_no,
        output_weight: gr.output_weight,
        source: 'GRAIN_MILLING'
      });
    }
    if (gr.output_lot_no && gr.output_lot_no.toLowerCase() === cleanLotNo.toLowerCase()) {
      parentLotFromMilling = gr.input_lot_no;
      millingOutputs.push({
        work_order_no: gr.work_order_no || `MILL-${gr.grain_s_no}`,
        work_unit: gr.flour_mill_name,
        finished_product: gr.output_item,
        work_order_date: gr.milling_date,
        output_kgs: gr.output_weight || (gr.output_qty ? gr.output_qty * 50 : 0),
        input_lot_no: gr.input_lot_no,
        input_item: gr.input_item,
        source: 'GRAIN_MILLING'
      });
    }
  }

  // 5. Also check work orders (if any)
  const woInputRes = await db.query(`
    SELECT woi.*, wo.work_order_no, SUBSTR(CAST(wo.date AS TEXT), 1, 10) as work_order_date, wo.work_unit, wo.product as target_product
    FROM work_order_items woi
    JOIN work_orders wo ON woi.work_order_id = wo.id
    WHERE LOWER(woi.lot_no) = LOWER(?)
  `, [cleanLotNo]);

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

  const woOutputRes = await db.query(`
    SELECT woo.*, wo.work_order_no, SUBSTR(CAST(wo.date AS TEXT), 1, 10) as work_order_date, wo.work_unit, wo.product as finished_product
    FROM work_order_outputs woo
    JOIN work_orders wo ON woo.work_order_id = wo.id
    WHERE LOWER(woo.fg_lot_no) = LOWER(?)
  `, [cleanLotNo]);

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

  // 6. Explicit lot genealogy records
  const genealogyParents = await db.query(`
    SELECT * FROM lot_genealogy WHERE LOWER(child_lot_no) = LOWER(?)
  `, [cleanLotNo]);

  const genealogyChildren = await db.query(`
    SELECT * FROM lot_genealogy WHERE LOWER(parent_lot_no) = LOWER(?)
  `, [cleanLotNo]);

  // Determine parent lot if not a direct purchase
  const effectiveParentLot = parentLotFromMilling || genealogyParents.rows?.[0]?.parent_lot_no || null;

  // If this lot was produced (e.g. LOT0005) and has no direct purchase inward,
  // resolve inward details from parent lot (e.g. LOT0001)
  if (!purchase && effectiveParentLot) {
    const parentPurRes = await db.query(`
      SELECT 
        p.id as purchaseId,
        p.s_no as purchaseSNo,
        COALESCE(NULLIF(p.voucher_no, ''), NULLIF(p.inv_no, ''), NULLIF(p.po_no, ''), 'PUR-' || p.s_no, 'PUR-' || p.id) as voucherNo,
        p.inv_no as invNo,
        p.po_no as poNo,
        SUBSTR(COALESCE(CAST(p.date AS TEXT), CAST(p.inv_date AS TEXT), ''), 1, 10) as purchaseDate,
        COALESCE(sm.name, NULLIF(p.supplier, '')) as supplierName,
        sm.phone_res as supplierPhone,
        COALESCE(NULLIF(p.vehicle_no, ''), NULLIF(p.lorry_no, ''), 'N/A') as vehicleNo,
        COALESCE(NULLIF(p.driver, ''), NULLIF(p.driver_name, ''), '') as driverName,
        COALESCE(NULLIF(p.transport, ''), NULLIF(p.transporter, ''), '') as transportName,
        pi.item_name as itemName,
        pi.qty,
        pi.unit,
        COALESCE(NULLIF(pi.total_weight, 0), NULLIF(pi.weight, 0), p.total_weight, 0) as totalWeight,
        pi.rate
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(p.supplier AS TEXT) OR sm.name = p.supplier)
      WHERE LOWER(pi.lot_no) = LOWER(?)
      LIMIT 1
    `, [effectiveParentLot]);

    if (parentPurRes.rows?.length) {
      purchase = {
        ...parentPurRes.rows[0],
        isDerivedFromParent: true,
        parentLotNo: effectiveParentLot
      };
    }
  }

  // 7. QC Inspection - Query directly for this lot or fallback to parent lot
  let qc = null;
  const qcTargetLot = cleanLotNo;
  const singleQc = await db.query(`
    SELECT * FROM qc_inspections 
    WHERE LOWER(rm_lot_no) = LOWER(?) OR LOWER(rm_lot_no) = LOWER(?)
    ORDER BY id DESC LIMIT 1
  `, [qcTargetLot, effectiveParentLot || qcTargetLot]);

  if (singleQc.rows?.length) {
    qc = singleQc.rows[0];
    const paramsRes = await db.query('SELECT param_key, param_value FROM qc_inspection_params WHERE qc_id = ?', [qc.id]);
    qc.paramsList = (paramsRes.rows || []).map(p => {
      try {
        const parsed = JSON.parse(p.param_value);
        return {
          key: p.param_key,
          name: parsed.parameterName || p.param_key,
          value: parsed.actualResult || '',
          unit: parsed.unit || '',
          status: parsed.status || 'PASS'
        };
      } catch (e) {
        return { key: p.param_key, name: p.param_key, value: p.param_value, unit: '', status: 'PASS' };
      }
    });

    // Human-friendly summary of key QC specs
    qc.summarySpecs = qc.paramsList.map(pr => `${pr.name}: ${pr.value}${pr.unit ? ' ' + pr.unit : ''}`).join(', ');
  }

  // 8. Jobwork Movements (Flour Out)
  const jobworkOutRes = await db.query(`
    SELECT foi.*, SUBSTR(CAST(fo.date AS TEXT), 1, 10) as dispatch_date, COALESCE(pcm.name, fo.papad_company) as contractor_name, fo.s_no as dispatch_no
    FROM flour_out_items foi
    JOIN flour_out fo ON foi.flour_out_id = fo.id
    LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(fo.papad_company AS TEXT) OR pcm.name = fo.papad_company)
    WHERE LOWER(foi.lot_no) = LOWER(?)
  `, [cleanLotNo]);

  // 9. Sales Dispatches
  const salesRes = await db.query(`
    SELECT si.*, s.s_no as bill_no, SUBSTR(CAST(s.date AS TEXT), 1, 10) as invoice_date, s.customer as customer_name, s.pur_trans as transport, s.lorry_no as vehicle_no
    FROM sales_items si
    JOIN sales s ON si.sales_id = s.id
    WHERE LOWER(si.lot_no) = LOWER(?)
  `, [cleanLotNo]);

  // 10. Purchase Returns / Vendor Return Rejections
  let purchaseReturns = [];
  try {
    const prRes = await db.query(`
      SELECT 
        pri.id as item_id,
        pri.purchase_return_id,
        pri.lot_no,
        pri.item_name,
        pri.weight,
        pri.qty,
        pri.total_wt,
        pri.rate,
        pri.amount,
        pri.reason,
        pri.iqr_no,
        pri.qc_no,
        pri.source,
        pr.s_no as return_s_no,
        pr.return_inv_no,
        SUBSTR(CAST(pr.date AS TEXT), 1, 10) as return_date,
        pr.supplier as supplier_raw,
        COALESCE(sm.name, pr.supplier) as supplier_name,
        COALESCE(pr.status, 'RETURNED') as return_status,
        pr.approval_status
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
      LEFT JOIN supplier_master sm ON (CAST(sm.id AS TEXT) = CAST(pr.supplier AS TEXT) OR sm.name = pr.supplier)
      WHERE LOWER(pri.lot_no) = LOWER(?) OR (CAST(? AS TEXT) != '' AND LOWER(pri.lot_no) = LOWER(CAST(? AS TEXT)))
      ORDER BY pr.id DESC
    `, [cleanLotNo, effectiveParentLot || '', effectiveParentLot || '']);
    purchaseReturns = prRes.rows || [];
  } catch (prErr) {
    console.warn('Notice: Error querying purchase returns for lot:', prErr.message);
  }

  const totalReturnedQty = purchaseReturns.reduce((sum, pr) => sum + (parseFloat(pr.qty) || 0), 0);
  const totalReturnedWeight = purchaseReturns.reduce((sum, pr) => sum + (parseFloat(pr.total_wt) || 0), 0);

  // Determine standard item name & quantities
  const finalItemName = stockLot.item_name || purchase?.itemName || millingOutputs[0]?.finished_product || millingConsumptions[0]?.target_product || (purchaseReturns[0]?.item_name) || 'Raw Material';
  const finalQty = stockLot.quantity || purchase?.qty || (millingOutputs[0]?.output_kgs ? millingOutputs[0].output_kgs / 50 : 0);
  let finalRemaining = stockLot.remaining_quantity ?? stockLot.quantity ?? (millingOutputs[0]?.output_kgs ? millingOutputs[0].output_kgs / 50 : 0);

  // If purchase return exists and stock_lots didn't reflect reduction, reflect it in calculation
  if (totalReturnedQty > 0 && finalRemaining === finalQty && finalQty > 0) {
    finalRemaining = Math.max(0, finalQty - totalReturnedQty);
  }

  let determinedQcStatus = stockLot.qc_status || (qc?.overall_result ? qc.overall_result.toUpperCase() : 'ACCEPTED');
  if (stockLot.unloading_status === 'RETURNED' || (purchaseReturns.length > 0 && finalRemaining === 0)) {
    determinedQcStatus = 'RETURNED';
  } else if (purchaseReturns.length > 0 && finalRemaining > 0) {
    determinedQcStatus = 'PARTIALLY_RETURNED';
  }

  return {
    lotNo: cleanLotNo,
    itemName: finalItemName,
    quantity: finalQty,
    remainingQuantity: finalRemaining,
    totalReturnedQty,
    totalReturnedWeight,
    unit: purchase?.unit || 'KG',
    godown: stockLot.current_godown || stockLot.godown_name || 'Main Godown',
    qcStatus: determinedQcStatus,
    purchase,
    vehicle,
    qc,
    effectiveParentLot,
    millingConsumptions,
    millingOutputs,
    workOrderConsumptions: millingConsumptions,
    workOrderOutputs: millingOutputs,
    jobworkMovements: jobworkOutRes.rows || [],
    salesDispatches: salesRes.rows || [],
    purchaseReturns,
    parents: genealogyParents.rows || [],
    children: genealogyChildren.rows || []
  };
}

/**
 * Builds Full Forward Traceability Tree (Where did this raw material / lot go?)
 * RM Lot -> QC -> Godown -> Production Batch / Milling -> Output Lots -> Jobwork -> Finished Goods -> Sales -> Customers
 * AND / OR Purchase Return / Debit Note -> Returned to Supplier
 */
async function buildForwardTrace(lotNo) {
  const details = await getLotDetails(lotNo);
  if (!details) return null;

  const tree = {
    id: `LOT-${details.lotNo}`,
    name: details.lotNo,
    type: 'LOT',
    item: details.itemName,
    quantity: details.quantity,
    remainingQuantity: details.remainingQuantity,
    totalReturnedQty: details.totalReturnedQty || 0,
    stage: details.purchase?.isDerivedFromParent ? 'Milled Output' : 'Raw Inward Material',
    children: []
  };

  // Node 1: Purchase Inward
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

  // Node 2: QC Inspection
  const qcNode = {
    id: `QC-${details.lotNo}`,
    name: details.qc?.qc_no || (details.qcStatus === 'ACCEPTED' ? 'QC Verified (ACCEPTED)' : (details.qcStatus === 'RETURNED' ? 'QC Rejected / Returned' : 'QC Inward Check')),
    type: 'QC',
    status: details.qc?.overall_result || details.qcStatus || 'ACCEPTED',
    inspector: details.qc?.inspector || 'Chief Chemist',
    date: details.qc?.inspection_date || details.purchase?.purchaseDate || 'N/A',
    summarySpecs: details.qc?.summarySpecs || '',
    children: []
  };

  // Node 3: Godown Storage
  const storageNode = {
    id: `GODOWN-${details.lotNo}`,
    name: details.godown || 'Main Godown',
    type: 'STORAGE',
    remainingQuantity: details.remainingQuantity,
    children: []
  };

  // Node 3.1: Purchase Returns (Debit Note / Returned to Supplier)
  if (details.purchaseReturns && details.purchaseReturns.length > 0) {
    for (const pr of details.purchaseReturns) {
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
        status: pr.return_status || 'RETURNED',
        qcNo: pr.qc_no || '',
        iqrNo: pr.iqr_no || ''
      });
    }
  }

  // Node 4: Production Milling / Work Orders & Child Lots
  if (details.millingConsumptions.length > 0) {
    for (const mc of details.millingConsumptions) {
      const woNode = {
        id: `WO-${mc.work_order_no}`,
        name: `Milling Batch: ${mc.work_order_no}`,
        type: 'PRODUCTION',
        consumedQty: mc.input_qty,
        mill: mc.work_unit || 'BVC MILL',
        date: mc.work_order_date,
        children: []
      };

      if (mc.output_lot_no) {
        const fgLotNode = {
          id: `FG-${mc.output_lot_no}`,
          name: mc.output_lot_no,
          type: 'INTERMEDIATE_LOT',
          item: mc.target_product || 'Flour',
          quantity: mc.output_weight || mc.input_qty,
          children: []
        };

        // Check if output lot went to jobwork or sales
        const childSales = await db.query(`
          SELECT si.*, s.s_no as bill_no, s.customer as customer_name, SUBSTR(CAST(s.date AS TEXT), 1, 10) as invoice_date
          FROM sales_items si
          JOIN sales s ON si.sales_id = s.id
          WHERE LOWER(si.lot_no) = LOWER(?)
        `, [mc.output_lot_no]);

        for (const cs of (childSales.rows || [])) {
          fgLotNode.children.push({
            id: `SALE-${cs.bill_no}`,
            name: `Invoice #${cs.bill_no} → ${cs.customer_name}`,
            type: 'SALES_CUSTOMER',
            customer: cs.customer_name,
            qty: cs.qty,
            date: cs.invoice_date
          });
        }

        woNode.children.push(fgLotNode);
      }

      storageNode.children.push(woNode);
    }
  }

  // Node 5: Jobwork Direct Issue
  if (details.jobworkMovements.length > 0) {
    for (const jw of details.jobworkMovements) {
      storageNode.children.push({
        id: `JW-DIR-${jw.dispatch_no}`,
        name: `Contractor Issue: ${jw.contractor_name}`,
        type: 'JOBWORK',
        contractor: jw.contractor_name,
        issuedQty: jw.total_wt || jw.qty || 0,
        date: jw.dispatch_date || jw.date
      });
    }
  }

  // Node 6: Direct Sales Dispatches
  if (details.salesDispatches.length > 0) {
    for (const sd of details.salesDispatches) {
      storageNode.children.push({
        id: `SALE-DIR-${sd.bill_no}`,
        name: `Invoice #${sd.bill_no} → ${sd.customer_name}`,
        type: 'SALES_CUSTOMER',
        customer: sd.customer_name,
        qty: sd.qty,
        date: sd.invoice_date
      });
    }
  }

  qcNode.children.push(storageNode);
  tree.children.push(qcNode);

  return tree;
}

/**
 * Builds Full Backward Traceability Tree (Where did this finished product come from?)
 * Finished Lot / Papad -> Jobwork / Work Order Batch -> Intermediate Lots -> Inward Raw Lots -> Purchase -> Supplier -> QC
 */
async function buildBackwardTrace(lotNo) {
  const details = await getLotDetails(lotNo);
  if (!details) return null;

  const backwardTree = {
    id: `BACK-LOT-${details.lotNo}`,
    name: details.lotNo,
    type: 'FINISHED_LOT',
    item: details.itemName,
    quantity: details.quantity,
    totalReturnedQty: details.totalReturnedQty || 0,
    stage: details.purchase?.isDerivedFromParent ? 'Milled Product' : (details.purchaseReturns?.length > 0 ? 'Returned / Raw Material' : 'Raw Inward Stock'),
    parents: []
  };

  // 1. Check if generated by Milling / Work Orders
  if (details.millingOutputs.length > 0) {
    for (const mo of details.millingOutputs) {
      const woNode = {
        id: `BACK-WO-${mo.work_order_no}`,
        name: `Milling Batch: ${mo.work_order_no} (${mo.work_unit || 'BVC MILL'})`,
        type: 'PRODUCTION',
        mill: mo.work_unit || 'BVC MILL',
        date: mo.work_order_date,
        inputs: []
      };

      if (mo.input_lot_no) {
        const rawLotDetails = await getLotDetails(mo.input_lot_no);
        woNode.inputs.push({
          id: `BACK-RAW-${mo.input_lot_no}`,
          name: mo.input_lot_no,
          item: mo.input_item || rawLotDetails?.itemName,
          consumedQty: mo.output_kgs,
          supplier: rawLotDetails?.purchase?.supplierName || 'Primary Supplier',
          purchaseVoucher: rawLotDetails?.purchase?.voucherNo || 'N/A',
          purchaseDate: rawLotDetails?.purchase?.purchaseDate || 'N/A',
          qcResult: rawLotDetails?.qc?.overall_result || rawLotDetails?.qcStatus || 'ACCEPTED',
          vehicleNo: rawLotDetails?.purchase?.vehicleNo || 'N/A',
          hasReturn: (rawLotDetails?.purchaseReturns?.length > 0)
        });
      }

      backwardTree.parents.push(woNode);
    }
  }

  // 2. Direct Purchase Stage
  if (details.purchase) {
    backwardTree.parents.push({
      id: `BACK-PUR-${details.purchase.voucherNo || details.purchase.purchaseId}`,
      name: details.purchase.isDerivedFromParent
        ? `Upstream Purchase (Parent Lot ${details.purchase.parentLotNo}): Inv #${details.purchase.voucherNo}`
        : `Purchase #${details.purchase.voucherNo}`,
      type: 'PURCHASE',
      supplier: details.purchase.supplierName,
      purchaseDate: details.purchase.purchaseDate,
      vehicleNo: details.purchase.vehicleNo,
      qcStatus: details.qc?.overall_result || details.qcStatus || 'ACCEPTED',
      lotNo: details.purchase.parentLotNo || details.lotNo,
      item: details.purchase.itemName
    });
  }

  // 3. Purchase Return / Return to Vendor Stage
  if (details.purchaseReturns && details.purchaseReturns.length > 0) {
    for (const pr of details.purchaseReturns) {
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
  }

  return backwardTree;
}

/**
 * Generate Comprehensive Product Recall Readiness Report
 * Given any Lot (Raw Material, Intermediate, or Finished), maps all affected upstream and downstream entities
 */
async function generateRecallReport(lotNo) {
  const details = await getLotDetails(lotNo);
  if (!details) throw new Error(`Lot ${lotNo} not found`);

  const forwardTree = await buildForwardTrace(lotNo);
  const backwardTree = await buildBackwardTrace(lotNo);

  // Collect unique affected entities
  const affectedCustomers = [];
  const affectedSuppliers = [];
  const affectedBatches = [];
  const affectedGodowns = [details.godown || 'Main Godown'];
  const returnedToSuppliers = [];

  if (details.purchase?.supplierName) {
    affectedSuppliers.push({
      supplierName: details.purchase.supplierName,
      voucherNo: details.purchase.voucherNo,
      date: details.purchase.purchaseDate,
      vehicleNo: details.purchase.vehicleNo
    });
  }

  // Purchase return vendor details
  if (details.purchaseReturns && details.purchaseReturns.length > 0) {
    for (const pr of details.purchaseReturns) {
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
  }

  // Flatten forward sales
  for (const sd of details.salesDispatches) {
    affectedCustomers.push({
      customerName: sd.customer_name,
      invoiceNo: sd.bill_no,
      date: sd.invoice_date,
      quantity: sd.qty
    });
  }

  // Flatten milling batches
  for (const mc of details.millingConsumptions) {
    affectedBatches.push({
      batchNo: mc.work_order_no,
      unit: mc.work_unit,
      date: mc.work_order_date
    });
  }
  for (const mo of details.millingOutputs) {
    if (!affectedBatches.some(b => b.batchNo === mo.work_order_no)) {
      affectedBatches.push({
        batchNo: mo.work_order_no,
        unit: mo.work_unit,
        date: mo.work_order_date
      });
    }
  }

  return {
    lotNo: details.lotNo,
    itemName: details.itemName,
    lotStatus: details.qcStatus,
    currentStockKg: details.remainingQuantity,
    originalQtyKg: details.quantity,
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
async function performLotSplit({ sourceLotNo, splitQuantities = [], reason = '', operator = 'Admin' }) {
  if (!sourceLotNo || !splitQuantities.length) {
    throw new Error('Source lot number and split quantities are required');
  }

  const srcLot = await getLotDetails(sourceLotNo);
  if (!srcLot) throw new Error(`Source lot ${sourceLotNo} not found`);

  const totalSplitQty = splitQuantities.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  if (totalSplitQty > (srcLot.remainingQuantity || srcLot.quantity)) {
    throw new Error(`Split total (${totalSplitQty} KG) exceeds available lot balance (${srcLot.remainingQuantity} KG)`);
  }

  const createdLots = [];

  for (let i = 0; i < splitQuantities.length; i++) {
    const item = splitQuantities[i];
    const newLotNo = item.targetLotNo || `${sourceLotNo}-S${i + 1}`;
    const qty = parseFloat(item.quantity) || 0;
    const godown = item.godownName || srcLot.godown || 'Main Godown';

    // 1. Insert new stock lot
    await db.run(`
      INSERT INTO stock_lots (item_name, lot_no, godown_name, quantity, remaining_quantity, qc_status, approval_status, usable_for_production)
      VALUES (?, ?, ?, ?, ?, ?, 'APPROVED', 1)
    `, [srcLot.itemName, newLotNo, godown, qty, qty, srcLot.qcStatus]);

    // 2. Insert into lot_genealogy table
    await db.run(`
      INSERT INTO lot_genealogy (parent_lot_no, child_lot_no, quantity, uom, transaction_type, transaction_no, remarks)
      VALUES (?, ?, ?, 'KG', 'LOT_SPLIT', ?, ?)
    `, [sourceLotNo, newLotNo, qty, `SPLIT-${Date.now()}`, reason || `Split from ${sourceLotNo}`]);

    createdLots.push({ lotNo: newLotNo, quantity: qty, godown });
  }

  // 3. Deduct from source lot
  await db.run(`
    UPDATE stock_lots 
    SET remaining_quantity = MAX(0, remaining_quantity - ?) 
    WHERE LOWER(lot_no) = LOWER(?)
  `, [totalSplitQty, sourceLotNo]);

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
async function performLotMerge({ sourceLots = [], targetLotNo, targetItemName, reason = '', operator = 'Admin' }) {
  if (!sourceLots.length || !targetLotNo) {
    throw new Error('Source lots and target lot number are required');
  }

  let totalMergedQty = 0;
  let itemName = targetItemName || '';

  for (const src of sourceLots) {
    const sLot = await getLotDetails(src.lotNo);
    if (!sLot) throw new Error(`Source lot ${src.lotNo} not found`);
    const q = parseFloat(src.quantity) || sLot.remainingQuantity || 0;
    totalMergedQty += q;
    if (!itemName) itemName = sLot.itemName;

    // Deduct source lot
    await db.run(`
      UPDATE stock_lots 
      SET remaining_quantity = MAX(0, remaining_quantity - ?) 
      WHERE LOWER(lot_no) = LOWER(?)
    `, [q, src.lotNo]);

    // Record genealogy parent->child
    await db.run(`
      INSERT INTO lot_genealogy (parent_lot_no, child_lot_no, quantity, uom, transaction_type, transaction_no, remarks)
      VALUES (?, ?, ?, 'KG', 'LOT_MERGE', ?, ?)
    `, [src.lotNo, targetLotNo, q, `MERGE-${Date.now()}`, reason || `Merged into ${targetLotNo}`]);
  }

  // Create target lot
  await db.run(`
    INSERT INTO stock_lots (item_name, lot_no, godown_name, quantity, remaining_quantity, qc_status, approval_status, usable_for_production)
    VALUES (?, ?, 'Main Godown', ?, ?, 'ACCEPTED', 'APPROVED', 1)
  `, [itemName, targetLotNo, totalMergedQty, totalMergedQty]);

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
