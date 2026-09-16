const db = require('../config/database');

/**
 * Inventory Intelligence Service
 * Handles Advanced Inventory Intelligence (Stock Health, Multi-Bucket Aging, Dead Stock, Slow Moving, Excess Stock)
 * Compatible with SQLite (Tauri) and PostgreSQL (Cloud/Neon).
 */

function getTodayDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Calculate days between two date strings (YYYY-MM-DD or ISO)
function calculateDaysDifference(dateStr) {
  if (!dateStr) return 999;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return 999;
  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * 1. GET INVENTORY INTELLIGENCE SUMMARY & STOCK HEALTH
 */
async function getInventorySummary(companyId) {
  let totalPhysicalKg = 0;
  let normalGodownKg = 0;
  let coldStorageKg = 0;
  let quarantineKg = 0;
  let rejectedKg = 0;
  let reservedKg = 0;
  let inTransitKg = 0;
  let openPOIncomingKg = 0;

  // A. Total Physical Stock & Godown Split
  try {
    const stockRes = await db.query(`
      SELECT 
        s.godown,
        COALESCE(SUM(s.weight), 0) as godown_wt
      FROM stock s
      GROUP BY s.godown
    `);
    (stockRes.rows || []).forEach(r => {
      const wt = parseFloat(r.godown_wt || 0);
      totalPhysicalKg += wt;
      const gName = (r.godown || '').toLowerCase();
      if (gName.includes('cold') || gName.includes('storage')) {
        coldStorageKg += wt;
      } else {
        normalGodownKg += wt;
      }
    });
  } catch (e) {
    console.warn('InventoryIntelligence physical stock query error:', e.message);
  }

  // B. Quarantine & Rejected Stock (from stock_lots and qc_inspections)
  try {
    const qcLots = await db.query(`
      SELECT 
        qc_status,
        COALESCE(SUM(remaining_quantity), 0) as lot_wt
      FROM stock_lots
      GROUP BY qc_status
    `);
    (qcLots.rows || []).forEach(r => {
      const wt = parseFloat(r.lot_wt || 0);
      const st = (r.qc_status || '').toUpperCase();
      if (st === 'REJECTED' || st === 'FAILED') {
        rejectedKg += wt;
      } else if (st === 'QC_PENDING' || st === 'HOLD' || st === 'UNDER_TEST') {
        quarantineKg += wt;
      }
    });
  } catch (e) {
    console.warn('InventoryIntelligence qc lots query error:', e.message);
  }

  // C. Reserved Stock (Active Work Orders)
  try {
    const woRes = await db.query(`
      SELECT COALESCE(SUM(woi.kgs), 0) as reserved_wt
      FROM work_orders wo
      JOIN work_order_items woi ON woi.work_order_id = wo.id
      WHERE wo.status IN ('ISSUED', 'IN_PROGRESS', 'DRAFT')
    `);
    reservedKg = parseFloat(woRes.rows[0]?.reserved_wt || 0);
  } catch (e) {
    console.warn('InventoryIntelligence reserved query error:', e.message);
  }

  // D. In-Transit (Vehicle movements inside gate)
  try {
    const vmRes = await db.query(`
      SELECT COALESCE(SUM(weight), 0) as transit_wt
      FROM vehicle_movements
      WHERE status = 'IN' AND (gate_out_time IS NULL OR gate_out_time = '')
    `);
    inTransitKg = parseFloat(vmRes.rows[0]?.transit_wt || 0);
  } catch (e) {
    console.warn('InventoryIntelligence vehicle movements error:', e.message);
  }

  // E. Open PO Expected Incoming
  try {
    const poRes = await db.query(`
      SELECT COALESCE(SUM(COALESCE(poi.tot_wt, poi.qty * COALESCE(poi.weight, 1), poi.qty, 0)), 0) as po_wt
      FROM purchase_orders po
      JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      WHERE po.status NOT IN ('Received', 'Completed', 'Cancelled')
         OR po.inward_purchase_id IS NULL
    `);
    openPOIncomingKg = parseFloat(poRes.rows[0]?.po_wt || 0);
  } catch (e) {
    console.warn('InventoryIntelligence open PO error:', e.message);
  }

  // Available Stock = Physical - Quarantine - Rejected - Reserved
  const availableKg = Math.max(0, totalPhysicalKg - quarantineKg - rejectedKg - reservedKg);

  // F. Stock Health Breakdown by Category
  const healthMetrics = await getStockHealthCategories(companyId);

  return {
    physicalStockKG: totalPhysicalKg,
    physicalStockMT: parseFloat((totalPhysicalKg / 1000).toFixed(2)),
    availableStockKG: availableKg,
    availableStockMT: parseFloat((availableKg / 1000).toFixed(2)),
    reservedStockKG: reservedKg,
    reservedStockMT: parseFloat((reservedKg / 1000).toFixed(2)),
    quarantineStockKG: quarantineKg,
    quarantineStockMT: parseFloat((quarantineKg / 1000).toFixed(2)),
    rejectedStockKG: rejectedKg,
    rejectedStockMT: parseFloat((rejectedKg / 1000).toFixed(2)),
    coldStorageStockKG: coldStorageKg,
    coldStorageStockMT: parseFloat((coldStorageKg / 1000).toFixed(2)),
    inTransitKG: inTransitKg,
    inTransitMT: parseFloat((inTransitKg / 1000).toFixed(2)),
    openPOIncomingKG: openPOIncomingKg,
    openPOIncomingMT: parseFloat((openPOIncomingKg / 1000).toFixed(2)),
    health: healthMetrics
  };
}

/**
 * 2. GET STOCK HEALTH CATEGORIES & OVERALL HEALTH SCORE
 */
async function getStockHealthCategories(companyId) {
  let healthyCount = 0;
  let lowStockCount = 0;
  let criticalCount = 0;
  let excessCount = 0;
  let expiringCount = 0;
  let deadStockCount = 0;
  let totalItemsCount = 0;

  const itemsRes = await db.query(`
    SELECT 
      im.id as item_id,
      im.item_name,
      COALESCE(im.minimum_qty, 500) as minimum_qty,
      COALESCE(im.reorder_level, 1000) as reorder_level,
      COALESCE(SUM(s.weight), 0) as current_weight,
      MAX(s.date) as last_movement_date
    FROM item_master im
    LEFT JOIN stock s ON LOWER(s.item_name) = LOWER(im.item_name)
    WHERE im.status = 'Active' OR im.status IS NULL
    GROUP BY im.id, im.item_name, im.minimum_qty, im.reorder_level
  `);

  const items = itemsRes.rows || [];
  totalItemsCount = items.length || 1;

  items.forEach(it => {
    const curWt = parseFloat(it.current_weight || 0);
    const minQty = parseFloat(it.minimum_qty || 500);
    const reorderLevel = parseFloat(it.reorder_level || 1000);
    const maxQty = reorderLevel * 2.5;
    const daysSince = calculateDaysDifference(it.last_movement_date);

    if (curWt <= 0) {
      // 0 stock: checked as critical if required
      criticalCount++;
    } else if (curWt <= minQty) {
      criticalCount++;
    } else if (curWt <= reorderLevel) {
      lowStockCount++;
    } else if (curWt > maxQty) {
      excessCount++;
    } else {
      healthyCount++;
    }

    if (curWt > 0 && daysSince >= 120) {
      deadStockCount++;
    } else if (curWt > 0 && daysSince >= 90) {
      expiringCount++;
    }
  });

  // Health Score Calculation (% healthy items with deduction for critical & dead stock)
  let healthScore = Math.round((healthyCount / totalItemsCount) * 100);
  if (deadStockCount > 0) healthScore -= Math.min(15, deadStockCount * 2);
  if (criticalCount > 0) healthScore -= Math.min(20, criticalCount * 3);
  healthScore = Math.max(10, Math.min(99, healthScore));

  return {
    healthy: healthyCount,
    lowStock: lowStockCount,
    critical: criticalCount,
    excessStock: excessCount,
    expiringSoon: expiringCount,
    deadStock: deadStockCount,
    totalItems: totalItemsCount,
    healthScorePercent: healthScore
  };
}

/**
 * 3. GET INVENTORY AGING ANALYSIS (0-30, 31-60, 61-90, 91-180, 180+ Days)
 * Supports both Item-level aggregation and Lot-level drilldown
 */
async function getInventoryAging(companyId, viewType = 'item') {
  // A. Lot-based Aging Records
  const lotsRes = await db.query(`
    SELECT 
      sl.id as lot_id,
      sl.lot_no,
      sl.item_name,
      sl.quantity as initial_qty,
      sl.remaining_quantity as current_qty,
      sl.qc_status,
      sl.created_at,
      p.supplier,
      p.date as purchase_date,
      s.godown
    FROM stock_lots sl
    LEFT JOIN purchases p ON p.id = sl.purchase_id
    LEFT JOIN stock s ON s.lot_no = sl.lot_no
    WHERE sl.remaining_quantity > 0
    ORDER BY sl.created_at ASC
  `);

  const rawLots = lotsRes.rows || [];

  const bucketSummary = {
    b0_30: 0,
    b31_60: 0,
    b61_90: 0,
    b91_180: 0,
    b180_plus: 0,
    totalWeight: 0
  };

  const lotList = [];
  const itemMap = {};

  rawLots.forEach(lot => {
    const dateStr = lot.purchase_date || lot.created_at;
    const ageDays = calculateDaysDifference(dateStr);
    const weight = parseFloat(lot.current_qty || 0);

    let bucket = '0-30';
    if (ageDays <= 30) {
      bucket = '0-30';
      bucketSummary.b0_30 += weight;
    } else if (ageDays <= 60) {
      bucket = '31-60';
      bucketSummary.b31_60 += weight;
    } else if (ageDays <= 90) {
      bucket = '61-90';
      bucketSummary.b61_90 += weight;
    } else if (ageDays <= 180) {
      bucket = '91-180';
      bucketSummary.b91_180 += weight;
    } else {
      bucket = '180+';
      bucketSummary.b180_plus += weight;
    }

    bucketSummary.totalWeight += weight;

    // Build lot item
    lotList.push({
      lotId: lot.lot_id,
      lotNo: lot.lot_no,
      itemName: lot.item_name,
      supplier: lot.supplier || 'Standard Supplier',
      receivedDate: dateStr,
      ageDays,
      currentWeightKG: weight,
      qcStatus: lot.qc_status || 'PASSED',
      godown: lot.godown || 'Main Godown',
      bucket
    });

    // Group by Item
    const itemKey = (lot.item_name || '').trim();
    if (!itemMap[itemKey]) {
      itemMap[itemKey] = {
        itemName: itemKey,
        b0_30: 0,
        b31_60: 0,
        b61_90: 0,
        b91_180: 0,
        b180_plus: 0,
        totalWeightKG: 0,
        oldestLotDays: 0,
        lotCount: 0
      };
    }

    if (bucket === '0-30') itemMap[itemKey].b0_30 += weight;
    else if (bucket === '31-60') itemMap[itemKey].b31_60 += weight;
    else if (bucket === '61-90') itemMap[itemKey].b61_90 += weight;
    else if (bucket === '91-180') itemMap[itemKey].b91_180 += weight;
    else if (bucket === '180+') itemMap[itemKey].b180_plus += weight;

    itemMap[itemKey].totalWeightKG += weight;
    itemMap[itemKey].lotCount += 1;
    itemMap[itemKey].oldestLotDays = Math.max(itemMap[itemKey].oldestLotDays, ageDays);
  });

  const itemList = Object.values(itemMap).sort((a, b) => b.totalWeightKG - a.totalWeightKG);

  return {
    bucketSummary: {
      b0_30: bucketSummary.b0_30,
      b31_60: bucketSummary.b31_60,
      b61_90: bucketSummary.b61_90,
      b91_180: bucketSummary.b91_180,
      b180_plus: bucketSummary.b180_plus,
      totalWeightKG: bucketSummary.totalWeight,
      totalWeightMT: parseFloat((bucketSummary.totalWeight / 1000).toFixed(2))
    },
    items: itemList,
    lots: lotList.sort((a, b) => b.ageDays - a.ageDays)
  };
}

/**
 * 4. GET DEAD STOCK ANALYSIS
 * Definition: No movement transactions for >= X days AND current stock > 0
 */
async function getDeadStock(companyId, thresholdDays = 120) {
  const stockRes = await db.query(`
    SELECT 
      s.item_name,
      s.lot_no,
      s.godown,
      COALESCE(SUM(s.weight), 0) as current_weight,
      MAX(s.date) as last_movement_date,
      im.type as item_group,
      im.reorder_level
    FROM stock s
    LEFT JOIN item_master im ON LOWER(im.item_name) = LOWER(s.item_name)
    GROUP BY s.item_name, s.lot_no, s.godown
    HAVING current_weight > 0
  `);

  const raw = stockRes.rows || [];
  const deadStockItems = [];
  let totalDeadStockKg = 0;
  let totalDeadStockValue = 0;

  const itemGrouped = {};

  raw.forEach(r => {
    const curWt = parseFloat(r.current_weight || 0);
    const daysSince = calculateDaysDifference(r.last_movement_date);

    if (daysSince >= thresholdDays && curWt > 0) {
      totalDeadStockKg += curWt;
      const estRate = 75; // standard rate per kg
      const lockedValue = curWt * estRate;
      totalDeadStockValue += lockedValue;

      const key = (r.item_name || '').trim();
      if (!itemGrouped[key]) {
        itemGrouped[key] = {
          itemName: key,
          itemGroup: r.item_group || 'General',
          totalWeightKG: 0,
          totalValue: 0,
          lastMovementDate: r.last_movement_date,
          daysInactive: daysSince,
          godowns: new Set(),
          lots: []
        };
      }

      itemGrouped[key].totalWeightKG += curWt;
      itemGrouped[key].totalValue += lockedValue;
      itemGrouped[key].godowns.add(r.godown || 'Main Godown');
      itemGrouped[key].lots.push({
        lotNo: r.lot_no || 'Standard',
        godown: r.godown || 'Main Godown',
        weight: curWt,
        daysInactive: daysSince
      });
      itemGrouped[key].daysInactive = Math.max(itemGrouped[key].daysInactive, daysSince);
    }
  });

  const formattedItems = Object.values(itemGrouped).map(item => ({
    ...item,
    godowns: Array.from(item.godowns),
    severity: item.daysInactive >= 180 ? 'CRITICAL_DEAD' : 'SLOW_DEAD'
  })).sort((a, b) => b.daysInactive - a.daysInactive);

  return {
    thresholdDays,
    totalDeadStockItemsCount: formattedItems.length,
    totalDeadStockKG: totalDeadStockKg,
    totalDeadStockMT: parseFloat((totalDeadStockKg / 1000).toFixed(2)),
    totalLockedCapitalValue: totalDeadStockValue,
    items: formattedItems
  };
}

/**
 * 5. GET SLOW-MOVING STOCK
 * Items with movement inactive between 60 to 120 days
 */
async function getSlowMovingStock(companyId) {
  return await getDeadStock(companyId, 60);
}

/**
 * 6. GET EXCESS STOCK
 * Items with Available Stock > Maximum Stock (or > 2.5 * reorder level)
 */
async function getExcessStock(companyId) {
  const stockRes = await db.query(`
    SELECT 
      im.id as item_id,
      im.item_code,
      im.item_name,
      im.item_group,
      COALESCE(im.reorder_level, 1000) as reorder_level,
      COALESCE(im.minimum_qty, 500) as minimum_qty,
      COALESCE(SUM(s.weight), 0) as current_weight,
      AVG(COALESCE(s.rate, 75)) as avg_rate
    FROM item_master im
    JOIN stock s ON LOWER(s.item_name) = LOWER(im.item_name)
    GROUP BY im.id, im.item_code, im.item_name, im.item_group, im.reorder_level, im.minimum_qty
    HAVING current_weight > (COALESCE(im.reorder_level, 1000) * 2.2)
  `);

  const items = (stockRes.rows || []).map(r => {
    const curWt = parseFloat(r.current_weight || 0);
    const reorderLevel = parseFloat(r.reorder_level || 1000);
    const maxStock = reorderLevel * 2;
    const excessWt = Math.max(0, curWt - maxStock);
    const rate = parseFloat(r.avg_rate || 75);
    const excessValue = excessWt * rate;

    return {
      itemId: r.item_id,
      itemCode: r.item_code || `ITM-${r.item_id}`,
      itemName: r.item_name,
      itemGroup: r.item_group || 'Raw Material',
      currentStockKG: curWt,
      reorderLevel,
      maxStockLevel: maxStock,
      excessWeightKG: excessWt,
      excessValueLocked: excessValue,
      recommendation: 'Pause fresh purchase orders; prioritize consumption in next production plans or promotional sales.'
    };
  }).sort((a, b) => b.excessWeightKG - a.excessWeightKG);

  const totalExcessKG = items.reduce((acc, it) => acc + it.excessWeightKG, 0);
  const totalExcessValue = items.reduce((acc, it) => acc + it.excessValueLocked, 0);

  return {
    totalExcessItemsCount: items.length,
    totalExcessKG,
    totalExcessMT: parseFloat((totalExcessKG / 1000).toFixed(2)),
    totalExcessValueLocked: totalExcessValue,
    items
  };
}

/**
 * 7. GET LOT DETAIL FOR LOT TRACEABILITY & QC AUDIT DRILLDOWN
 */
async function getLotDetails(companyId, lotNo) {
  if (!lotNo) throw new Error('Lot number is required');

  const lotRes = await db.query(`
    SELECT 
      sl.*,
      p.supplier,
      p.date as purchase_date,
      p.lorry_no,
      s.godown
    FROM stock_lots sl
    LEFT JOIN purchases p ON p.id = sl.purchase_id
    LEFT JOIN stock s ON s.lot_no = sl.lot_no
    WHERE sl.lot_no = ?
    LIMIT 1
  `, [lotNo]);

  const lot = lotRes.rows[0];
  if (!lot) {
    return {
      lotNo,
      found: false,
      message: `Lot ${lotNo} not found in database.`
    };
  }

  // Get QC inspections
  let qcDetails = [];
  try {
    const qcRes = await db.query(`SELECT * FROM qc_inspections WHERE rm_lot_no = ?`, [lotNo]);
    qcDetails = qcRes.rows || [];
  } catch (e) {}

  return {
    found: true,
    lotNo: lot.lot_no,
    itemName: lot.item_name,
    supplier: lot.supplier || 'Standard Vendor',
    purchaseDate: lot.purchase_date || lot.created_at,
    initialQuantity: lot.quantity,
    remainingQuantity: lot.remaining_quantity,
    qcStatus: lot.qc_status,
    usableForProduction: lot.usable_for_production === 1,
    godown: lot.godown || 'Main Godown',
    ageDays: calculateDaysDifference(lot.purchase_date || lot.created_at),
    inspections: qcDetails
  };
}

module.exports = {
  getInventorySummary,
  getStockHealthCategories,
  getInventoryAging,
  getDeadStock,
  getSlowMovingStock,
  getExcessStock,
  getLotDetails
};
