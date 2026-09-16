const db = require('../config/database');

/**
 * Procurement Planning Service
 * Handles Intelligent Procurement Planning (Supply, Demand, Projected Stock, Purchase Suggestions)
 * Compatible with SQLite (Tauri) and PostgreSQL (Cloud/Neon).
 */

// Helper: Calculate date range based on planning horizon ('7d', '30d', '60d', '90d', 'all')
function getHorizonDateStr(horizon = '30d') {
  const now = new Date();
  let daysToAdd = 30;
  if (horizon === '7d') daysToAdd = 7;
  else if (horizon === '15d') daysToAdd = 15;
  else if (horizon === '30d') daysToAdd = 30;
  else if (horizon === '60d') daysToAdd = 60;
  else if (horizon === '90d') daysToAdd = 90;
  else if (horizon === 'all') daysToAdd = 365;

  const targetDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 1. GET ALL INVENTORY ITEMS WITH SUPPLY, DEMAND, AND PROJECTED STOCK
 */
async function getProcurementPlanningItems(companyId, horizon = '30d', search = '', filterCategory = 'all') {
  const today = getTodayDateStr();
  const horizonDate = getHorizonDateStr(horizon);

  // A. Master Items Base
  let itemsMaster = [];
  try {
    const itemsRes = await db.query(`
      SELECT 
        im.id as item_id,
        im.item_code,
        im.item_name,
        im.item_group,
        im.type,
        im.unit,
        COALESCE(im.minimum_qty, 0) as minimum_qty,
        COALESCE(im.reorder_level, 0) as reorder_level,
        COALESCE(im.critical_level, 0) as critical_level,
        COALESCE(im.weight, 1) as unit_weight
      FROM item_master im
      WHERE im.status = 'Active' OR im.status IS NULL
      ORDER BY im.item_name ASC
    `);
    itemsMaster = itemsRes.rows || [];
  } catch (e) {
    console.warn('ProcurementPlanning items master query error:', e.message);
  }

  // B. Current Stock by Item
  const stockMap = {};
  try {
    const stockRes = await db.query(`
      SELECT 
        item_name,
        COALESCE(SUM(weight), 0) as total_weight,
        COALESCE(SUM(qty), 0) as total_qty
      FROM stock
      GROUP BY item_name
    `);
    (stockRes.rows || []).forEach(r => {
      stockMap[(r.item_name || '').trim().toLowerCase()] = {
        weight: parseFloat(r.total_weight || 0),
        qty: parseFloat(r.total_qty || 0)
      };
    });
  } catch (e) {
    console.warn('ProcurementPlanning stock query error:', e.message);
  }

  // C. Open Purchase Orders (Remaining Expected Quantity)
  const openPOMap = {};
  const openPODetails = {};
  try {
    const poRes = await db.query(`
      SELECT 
        po.id as po_id,
        po.s_no as po_number,
        po.supplier_name,
        po.date as po_date,
        poi.item_name,
        poi.qty as ordered_qty,
        COALESCE(poi.tot_wt, poi.qty * COALESCE(poi.weight, 1), poi.qty) as ordered_weight,
        poi.rate,
        po.inward_purchase_id
      FROM purchase_orders po
      JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      WHERE po.status NOT IN ('Received', 'Completed', 'Cancelled') 
         OR po.inward_purchase_id IS NULL
    `);
    (poRes.rows || []).forEach(r => {
      const key = (r.item_name || '').trim().toLowerCase();
      if (!openPOMap[key]) openPOMap[key] = 0;
      if (!openPODetails[key]) openPODetails[key] = [];

      const remainingWt = r.inward_purchase_id ? 0 : parseFloat(r.ordered_weight || 0);
      openPOMap[key] += remainingWt;
      if (remainingWt > 0) {
        openPODetails[key].push({
          poId: r.po_id,
          poNo: r.po_number,
          supplierName: r.supplier_name,
          date: r.po_date,
          orderedQty: r.ordered_qty,
          orderedWeight: remainingWt,
          rate: r.rate
        });
      }
    });
  } catch (e) {
    console.warn('ProcurementPlanning open PO query error:', e.message);
  }

  // D. Confirmed Incoming (Vehicle Movements or Inward QC)
  const incomingMap = {};
  try {
    const vmRes = await db.query(`
      SELECT 
        item_name,
        COALESCE(SUM(weight), 0) as incoming_wt
      FROM vehicle_movements
      WHERE status = 'IN' AND (gate_out_time IS NULL OR gate_out_time = '')
      GROUP BY item_name
    `);
    (vmRes.rows || []).forEach(r => {
      const key = (r.item_name || '').trim().toLowerCase();
      incomingMap[key] = parseFloat(r.incoming_wt || 0);
    });
  } catch (e) {
    console.warn('ProcurementPlanning incoming vehicle query error:', e.message);
  }

  // E. Reserved Stock (Quarantine / QC Hold / Not usable for production)
  const reservedMap = {};
  try {
    const resLots = await db.query(`
      SELECT 
        item_name,
        COALESCE(SUM(remaining_quantity), 0) as reserved_qty
      FROM stock_lots
      WHERE qc_status IN ('QC_PENDING', 'HOLD', 'REJECTED') 
         OR usable_for_production = 0
      GROUP BY item_name
    `);
    (resLots.rows || []).forEach(r => {
      const key = (r.item_name || '').trim().toLowerCase();
      reservedMap[key] = parseFloat(r.reserved_qty || 0);
    });
  } catch (e) {
    console.warn('ProcurementPlanning reserved lots query error:', e.message);
  }

  // F. Production Requirements (from Work Orders & Grains within horizon)
  const prodReqMap = {};
  const prodReqDetails = {};
  try {
    const woRes = await db.query(`
      SELECT 
        wo.id as wo_id,
        wo.work_order_no,
        wo.product as target_product,
        wo.date as wo_date,
        woi.item_name,
        COALESCE(woi.kgs, woi.input_qty * COALESCE(woi.weight, 1), woi.input_qty, 0) as required_wt
      FROM work_orders wo
      JOIN work_order_items woi ON woi.work_order_id = wo.id
      WHERE wo.status IN ('ISSUED', 'IN_PROGRESS', 'DRAFT', 'PENDING')
        AND (wo.date <= ? OR ? = 'all')
    `, [horizonDate, horizon]);
    (woRes.rows || []).forEach(r => {
      const key = (r.item_name || '').trim().toLowerCase();
      if (!prodReqMap[key]) prodReqMap[key] = 0;
      if (!prodReqDetails[key]) prodReqDetails[key] = [];

      const reqWt = parseFloat(r.required_wt || 0);
      prodReqMap[key] += reqWt;
      prodReqDetails[key].push({
        workOrderId: r.wo_id,
        workOrderNo: r.work_order_no,
        product: r.target_product,
        requiredDate: r.wo_date,
        requiredWeight: reqWt
      });
    });
  } catch (e) {
    console.warn('ProcurementPlanning work orders query error:', e.message);
  }

  // G. Confirmed Sales Requirements (from Sales Orders `is_order = 1`)
  const salesReqMap = {};
  const salesReqDetails = {};
  try {
    const soRes = await db.query(`
      SELECT 
        s.id as sales_order_id,
        s.s_no as sales_order_no,
        s.customer,
        s.date as order_date,
        si.item_name,
        COALESCE(si.total_wt, si.qty * COALESCE(si.weight, 1), si.qty, 0) as committed_wt
      FROM sales s
      JOIN sales_items si ON si.sales_id = s.id
      WHERE s.is_order = 1
        AND (s.date <= ? OR ? = 'all')
    `, [horizonDate, horizon]);
    (soRes.rows || []).forEach(r => {
      const key = (r.item_name || '').trim().toLowerCase();
      if (!salesReqMap[key]) salesReqMap[key] = 0;
      if (!salesReqDetails[key]) salesReqDetails[key] = [];

      const comWt = parseFloat(r.committed_wt || 0);
      salesReqMap[key] += comWt;
      salesReqDetails[key].push({
        salesOrderId: r.sales_order_id,
        salesOrderNo: r.sales_order_no,
        customer: r.customer,
        orderDate: r.order_date,
        committedWeight: comWt
      });
    });
  } catch (e) {
    console.warn('ProcurementPlanning sales order query error:', e.message);
  }

  // H. Preferred Suppliers & Recent Purchase Rates Map
  const supplierInfoMap = {};
  try {
    const suppRes = await db.query(`
      SELECT 
        pi.item_name,
        p.supplier,
        pi.rate,
        MAX(p.date) as last_date
      FROM purchase_items pi
      JOIN purchases p ON p.id = pi.purchase_id
      GROUP BY pi.item_name
    `);
    (suppRes.rows || []).forEach(r => {
      const key = (r.item_name || '').trim().toLowerCase();
      supplierInfoMap[key] = {
        preferredSupplier: r.supplier || 'Standard Supplier',
        lastRate: parseFloat(r.rate || 0)
      };
    });
  } catch (e) {
    console.warn('ProcurementPlanning supplier info error:', e.message);
  }

  // I. Combine Everything by Item into Planning Dataset
  const normalizedKeyToName = new Map();
  itemsMaster.forEach(im => {
    if (im.item_name && im.item_name.trim()) {
      const norm = im.item_name.trim().toLowerCase();
      if (!normalizedKeyToName.has(norm)) {
        normalizedKeyToName.set(norm, im.item_name.trim());
      }
    }
  });

  const registerKey = (k) => {
    if (k && k.trim()) {
      const norm = k.trim().toLowerCase();
      if (!normalizedKeyToName.has(norm)) {
        normalizedKeyToName.set(norm, k.trim());
      }
    }
  };

  Object.keys(stockMap).forEach(registerKey);
  Object.keys(openPOMap).forEach(registerKey);
  Object.keys(prodReqMap).forEach(registerKey);
  Object.keys(salesReqMap).forEach(registerKey);

  const itemsList = [];

  for (const [key, canonicalName] of normalizedKeyToName.entries()) {
    const master = itemsMaster.find(m => (m.item_name || '').trim().toLowerCase() === key) || {};

    const itemName = master.item_name ? master.item_name.trim() : canonicalName;
    const itemCode = master.item_code || `ITM-${itemsList.length + 1}`;
    const itemGroup = master.item_group || 'Raw Material';
    const unit = master.unit || 'kg';

    // Supply
    const currentStock = stockMap[key]?.weight || 0;
    const openPO = openPOMap[key] || 0;
    const confirmedIncoming = incomingMap[key] || 0;
    const totalSupply = currentStock + openPO + confirmedIncoming;

    // Demand
    const reservedStock = reservedMap[key] || 0;
    const productionDemand = prodReqMap[key] || 0;
    const salesDemand = salesReqMap[key] || 0;
    const totalDemand = reservedStock + productionDemand + salesDemand;

    // Projected Stock
    const projectedAvailable = totalSupply - totalDemand;

    // Stock Control Levels
    const minimumStock = master.minimum_qty || 500;
    const reorderLevel = master.reorder_level || 1000;
    const safetyStock = minimumStock > 0 ? minimumStock : Math.round(totalDemand * 0.1);

    // Shortage and Suggestions Calculation
    let shortage = 0;
    let recommendedPurchase = 0;
    let status = 'HEALTHY'; // 'SHORTAGE', 'REORDER', 'HEALTHY', 'SURPLUS'

    if (projectedAvailable < 0) {
      status = 'SHORTAGE';
      shortage = Math.abs(projectedAvailable) + safetyStock;
      recommendedPurchase = shortage;
    } else if (projectedAvailable <= reorderLevel) {
      status = 'REORDER';
      shortage = Math.max(0, reorderLevel - projectedAvailable + safetyStock);
      recommendedPurchase = shortage;
    } else if (projectedAvailable > reorderLevel * 2.5) {
      status = 'SURPLUS';
      shortage = 0;
      recommendedPurchase = 0;
    } else {
      status = 'HEALTHY';
      shortage = 0;
      recommendedPurchase = 0;
    }

    // Round recommended purchase to nearest 50 kg if applicable
    if (unit.toLowerCase() === 'kg' && recommendedPurchase > 0) {
      recommendedPurchase = Math.ceil(recommendedPurchase / 50) * 50;
    }

    const supplierInfo = supplierInfoMap[key] || {
      preferredSupplier: 'Preferred Vendor',
      lastRate: 75.0
    };

    const estAmount = recommendedPurchase * (supplierInfo.lastRate || 75);

    const itemObj = {
      itemId: master.item_id || null,
      itemCode,
      itemName,
      itemGroup,
      unit,
      supply: {
        currentStock,
        openPO,
        confirmedIncoming,
        totalSupply
      },
      demand: {
        reservedStock,
        productionDemand,
        salesDemand,
        totalDemand
      },
      projectedAvailable,
      controlLevels: {
        minimumStock,
        reorderLevel,
        safetyStock
      },
      shortage,
      recommendedPurchase,
      status,
      suggestedSupplier: supplierInfo.preferredSupplier,
      estimatedRate: supplierInfo.lastRate || 75,
      estimatedAmount: estAmount,
      details: {
        openPOs: openPODetails[key] || [],
        productionRequirements: prodReqDetails[key] || [],
        salesRequirements: salesReqDetails[key] || []
      }
    };

    itemsList.push(itemObj);
  }

  // Filter items if search or filter applied
  let filtered = itemsList;
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(it => 
      it.itemName.toLowerCase().includes(q) || 
      it.itemCode.toLowerCase().includes(q) ||
      it.itemGroup.toLowerCase().includes(q)
    );
  }

  if (filterCategory === 'shortage') {
    filtered = filtered.filter(it => it.status === 'SHORTAGE');
  } else if (filterCategory === 'reorder') {
    filtered = filtered.filter(it => it.status === 'REORDER' || it.status === 'SHORTAGE');
  } else if (filterCategory === 'surplus') {
    filtered = filtered.filter(it => it.status === 'SURPLUS');
  }

  return filtered;
}

/**
 * 2. GET PROCUREMENT PLANNING SUMMARY METRICS
 */
async function getProcurementPlanningSummary(companyId, horizon = '30d') {
  const items = await getProcurementPlanningItems(companyId, horizon);

  const itemsRequiringPurchase = items.filter(it => it.recommendedPurchase > 0).length;
  const projectedShortageItems = items.filter(it => it.status === 'SHORTAGE').length;
  const openPOItems = items.filter(it => it.supply.openPO > 0).length;
  const excessStockItems = items.filter(it => it.status === 'SURPLUS').length;

  const totalEstimatedProcurementValue = items.reduce((acc, it) => acc + (it.estimatedAmount || 0), 0);
  const totalRecommendedQtyKG = items.reduce((acc, it) => acc + (it.recommendedPurchase || 0), 0);

  return {
    horizon,
    totalItemsTracked: items.length,
    itemsRequiringPurchase,
    projectedShortageItems,
    openPOItems,
    excessStockItems,
    totalEstimatedProcurementValue,
    totalRecommendedQtyKG,
    totalRecommendedQtyMT: parseFloat((totalRecommendedQtyKG / 1000).toFixed(2))
  };
}

/**
 * 3. GET PURCHASE SUGGESTIONS LIST (For Direct Review & PR Generation)
 */
async function getPurchaseSuggestions(companyId, horizon = '30d') {
  const items = await getProcurementPlanningItems(companyId, horizon);
  const suggestions = items
    .filter(it => it.recommendedPurchase > 0)
    .map(it => ({
      itemId: it.itemId,
      itemCode: it.itemCode,
      itemName: it.itemName,
      itemGroup: it.itemGroup,
      unit: it.unit,
      currentStock: it.supply.currentStock,
      openPO: it.supply.openPO,
      totalDemand: it.demand.totalDemand,
      projectedAvailable: it.projectedAvailable,
      reorderLevel: it.controlLevels.reorderLevel,
      recommendedPurchase: it.recommendedPurchase,
      suggestedSupplier: it.suggestedSupplier,
      estimatedRate: it.estimatedRate,
      estimatedAmount: it.estimatedAmount,
      reason: it.projectedAvailable < 0 
        ? `Demand (${it.demand.totalDemand} ${it.unit}) exceeds supply (${it.supply.totalSupply} ${it.unit}) by ${Math.abs(it.projectedAvailable)} ${it.unit}`
        : `Projected available (${it.projectedAvailable} ${it.unit}) is below reorder level (${it.controlLevels.reorderLevel} ${it.unit})`,
      sources: {
        openPOCount: it.details.openPOs.length,
        workOrderCount: it.details.productionRequirements.length,
        salesOrderCount: it.details.salesRequirements.length
      }
    }));

  return suggestions;
}

/**
 * 4. CREATE PURCHASE REQUEST FROM SELECTED SUGGESTIONS
 * Seamlessly populates existing PR system (`purchase_requests` and `purchase_request_items`)
 */
async function createPRFromSuggestions(companyId, user, itemsToProcure, remarks = 'Generated from Procurement Planning Engine') {
  if (!itemsToProcure || !itemsToProcure.length) {
    throw new Error('No items selected for Purchase Request creation');
  }

  const today = getTodayDateStr();
  const reqDate = getTodayDateStr();
  const deliveryHorizonDate = getHorizonDateStr('7d');

  // Generate unique PR Number (e.g. PR-2026-0089)
  const currentYear = new Date().getFullYear();
  let nextSeq = 1;
  try {
    const seqRes = await db.query(`SELECT COUNT(*) as count FROM purchase_requests`);
    nextSeq = parseInt(seqRes.rows[0]?.count || 0, 10) + 1;
  } catch (e) {
    nextSeq = Math.floor(1000 + Math.random() * 9000);
  }
  const prNo = `PR-${currentYear}-${String(nextSeq).padStart(4, '0')}`;

  const supplierName = itemsToProcure[0]?.suggestedSupplier || 'Standard Supplier';
  const requestedBy = user?.username || 'Procurement Officer';

  // 1. Insert header into purchase_requests
  const prInsert = await db.run(`
    INSERT INTO purchase_requests (
      pr_no,
      request_date,
      required_date,
      department,
      requested_by,
      supplier_name,
      priority,
      status,
      remarks,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    prNo,
    reqDate,
    deliveryHorizonDate,
    'Procurement Planning',
    requestedBy,
    supplierName,
    'High',
    'Draft',
    remarks
  ]);

  const prId = prInsert.lastID || prInsert.id;

  // 2. Insert items into purchase_request_items
  for (const it of itemsToProcure) {
    const requestedQty = parseFloat(it.recommendedPurchase || it.requested_qty || 0);
    const estRate = parseFloat(it.estimatedRate || it.estimated_rate || 0);
    const estAmount = requestedQty * estRate;

    await db.run(`
      INSERT INTO purchase_request_items (
        purchase_request_id,
        item_id,
        item_code,
        item_name,
        description,
        requested_qty,
        approved_qty,
        unit,
        current_stock,
        minimum_stock,
        suggested_qty,
        estimated_rate,
        estimated_amount,
        remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      prId,
      it.itemId || null,
      it.itemCode || '',
      it.itemName,
      it.reason || 'Auto-suggested by Procurement Planning',
      requestedQty,
      requestedQty,
      it.unit || 'kg',
      parseFloat(it.currentStock || 0),
      parseFloat(it.reorderLevel || 0),
      requestedQty,
      estRate,
      estAmount,
      it.reason || 'Shortage replenishment'
    ]);
  }

  return {
    success: true,
    prId,
    prNo,
    itemCount: itemsToProcure.length,
    message: `Purchase Request ${prNo} successfully created with ${itemsToProcure.length} items.`
  };
}

module.exports = {
  getProcurementPlanningItems,
  getProcurementPlanningSummary,
  getPurchaseSuggestions,
  createPRFromSuggestions
};
