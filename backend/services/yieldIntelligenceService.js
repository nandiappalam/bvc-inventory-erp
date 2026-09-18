const db = require('../config/database');

/**
 * Yield Intelligence & Mass Balance Service (Phase 5)
 * Calculates yield %, process loss %, wastage %, mass balance verification,
 * detects standard vs actual deviations, and tracks batch comparisons based on real inventory transactions.
 */

/**
 * Calculates Mass Balance and Yield for a given Milling / Production Batch
 */
function calculateBatchYieldMetrics(inputKg, outputKg, byProductKg = 0, wastageKg = 0, processLossKg = 0, standardYield = 72, tolerance = 2) {
  const inp = Math.max(0, parseFloat(inputKg) || 0);
  const out = Math.max(0, parseFloat(outputKg) || 0);
  const byp = Math.max(0, parseFloat(byProductKg) || 0);
  const wst = Math.max(0, parseFloat(wastageKg) || 0);
  const pLoss = Math.max(0, parseFloat(processLossKg) || 0);

  const yieldPct = inp > 0 ? (out / inp) * 100 : 0;
  const wastagePct = inp > 0 ? (wst / inp) * 100 : 0;
  const processLossPct = inp > 0 ? (pLoss / inp) * 100 : 0;

  // Mass Balance: Input = Output + By-products + Wastage + Process Loss
  const accountedTotal = out + byp + wst + pLoss;
  const unexplainedDifference = Math.round((inp - accountedTotal) * 100) / 100;
  const massBalanceStatus = Math.abs(unexplainedDifference) < 0.5 ? 'BALANCED' : 'UNEXPLAINED_DIFFERENCE';

  // Standard Yield check
  const std = parseFloat(standardYield) || 72;
  const tol = parseFloat(tolerance) || 2;
  const minAcceptable = std - tol;
  const maxAcceptable = std + tol;

  let yieldStatus = 'WITHIN_STANDARD';
  if (yieldPct < minAcceptable) {
    yieldStatus = 'BELOW_STANDARD';
  } else if (yieldPct > maxAcceptable) {
    yieldStatus = 'ABOVE_STANDARD';
  }

  return {
    inputKg: inp,
    outputKg: out,
    byProductKg: byp,
    wastageKg: wst,
    processLossKg: pLoss,
    actualYieldPct: Math.round(yieldPct * 100) / 100,
    wastagePct: Math.round(wastagePct * 100) / 100,
    processLossPct: Math.round(processLossPct * 100) / 100,
    standardYieldPct: std,
    yieldTolerancePct: tol,
    variancePct: Math.round((yieldPct - std) * 100) / 100,
    massBalanceDiffKg: unexplainedDifference,
    massBalanceStatus,
    yieldStatus
  };
}

/**
 * Gets historical Yield list with calculated Mass Balance and Standards
 * Aggregates from both grains (milling) and work_orders
 */
async function getBatchYieldList(filters = {}) {
  const { status, limit = 50 } = filters;
  const numLimit = parseInt(limit, 10) || 50;
  const batches = [];

  // 1. Fetch real batches from grains table (grain grinding / milling)
  const grainRes = await db.query(`
    SELECT 
      g.id,
      COALESCE(NULLIF(g.work_order_no, ''), 'MILL-' || CAST(g.s_no AS TEXT)) as batchNo,
      SUBSTR(COALESCE(CAST(g.date AS TEXT), CAST(g.created_at AS TEXT), ''), 1, 10) as batchDate,
      COALESCE(fmm.flourmill, g.flour_mill, 'BVC MILL') as machineLine,
      COALESCE(goi.item_name, 'Urad Flour') as productName,
      gii.lot_no as rawLotNo,
      goi.lot_no as fgLotNo,
      COALESCE(NULLIF(gii.total_wt, 0), gii.qty * 50, g.total_input_kg, 0) as inputKg,
      COALESCE(NULLIF(goi.total_wt, 0), goi.qty * 50, g.total_output_kg, 0) as outputKg,
      COALESCE(g.total_wastage_kg, 0) as wastageKg
    FROM grains g
    LEFT JOIN flour_mill_master fmm ON (CAST(fmm.id AS TEXT) = CAST(g.flour_mill AS TEXT) OR fmm.flourmill = g.flour_mill)
    LEFT JOIN grain_input_items gii ON g.id = gii.grain_id
    LEFT JOIN grain_output_items goi ON g.id = goi.grain_id
    ORDER BY g.id DESC
    LIMIT ?
  `, [numLimit]);

  for (const gr of (grainRes.rows || [])) {
    const inputKg = parseFloat(gr.inputKg) || 0;
    const outputKg = parseFloat(gr.outputKg) || 0;
    const totalWastage = parseFloat(gr.wastageKg) || 0;
    const byProductKg = 0;
    const processLossKg = Math.max(0, inputKg - (outputKg + byProductKg + totalWastage));

    const metrics = calculateBatchYieldMetrics(
      inputKg,
      outputKg,
      byProductKg,
      totalWastage,
      processLossKg,
      100.0, // When 5000 -> 5000 it's 100%
      5.0
    );

    batches.push({
      id: `grain-${gr.id}`,
      batchNo: gr.batchNo,
      batchDate: gr.batchDate,
      machineLine: gr.machineLine,
      productName: gr.productName,
      rawLotNo: gr.rawLotNo || 'N/A',
      fgLotNo: gr.fgLotNo || 'N/A',
      ...metrics
    });
  }

  // 2. Fetch from work_orders (if any separate from grains)
  const woRes = await db.query(`
    SELECT 
      wo.id,
      wo.work_order_no as batchNo,
      SUBSTR(CAST(wo.date AS TEXT), 1, 10) as batchDate,
      wo.work_unit as machineLine,
      wo.product as productName,
      wo.status,
      wo.expected_output_wt,
      wo.actual_output_wt,
      wo.rejection_wt,
      wo.elevator_wt,
      wo.waste_flour_wt,
      wo.sieve_flour_wt,
      wo.other_wastage_wt,
      COALESCE((SELECT SUM(input_qty) FROM work_order_items WHERE work_order_id = wo.id), 0) as inputKg,
      (SELECT lot_no FROM work_order_items WHERE work_order_id = wo.id LIMIT 1) as rawLotNo,
      (SELECT fg_lot_no FROM work_order_outputs WHERE work_order_id = wo.id LIMIT 1) as fgLotNo
    FROM work_orders wo
    WHERE wo.work_order_no NOT IN (SELECT COALESCE(work_order_no, '') FROM grains WHERE work_order_no IS NOT NULL)
    ORDER BY wo.id DESC
    LIMIT ?
  `, [numLimit]);

  for (const wo of (woRes.rows || [])) {
    const totalWastage = (parseFloat(wo.rejection_wt) || 0) + 
                         (parseFloat(wo.elevator_wt) || 0) + 
                         (parseFloat(wo.waste_flour_wt) || 0) + 
                         (parseFloat(wo.sieve_flour_wt) || 0) + 
                         (parseFloat(wo.other_wastage_wt) || 0);

    const inputKg = parseFloat(wo.inputKg) || parseFloat(wo.expected_output_wt) || 0;
    const outputKg = parseFloat(wo.actual_output_wt) || parseFloat(wo.expected_output_wt) || 0;
    const byProductKg = 0;
    const processLossKg = Math.max(0, inputKg - (outputKg + byProductKg + totalWastage));

    const metrics = calculateBatchYieldMetrics(
      inputKg,
      outputKg,
      byProductKg,
      totalWastage,
      processLossKg,
      72.0,
      2.0
    );

    batches.push({
      id: `wo-${wo.id}`,
      batchNo: wo.batchNo,
      batchDate: wo.batchDate,
      machineLine: wo.machineLine || 'Milling Floor',
      productName: wo.productName,
      rawLotNo: wo.rawLotNo || 'N/A',
      fgLotNo: wo.fgLotNo || 'N/A',
      ...metrics
    });
  }

  if (status && status !== 'ALL') {
    return batches.filter(b => b.yieldStatus === status);
  }
  return batches;
}

/**
 * Yield & Production Dashboard High-Level Metrics
 */
async function getYieldDashboardStats() {
  const batches = await getBatchYieldList({ limit: 100 });
  const totalBatches = batches.length;

  let totalInput = 0;
  let totalOutput = 0;
  let totalWastage = 0;

  for (const b of batches) {
    totalInput += b.inputKg;
    totalOutput += b.outputKg;
    totalWastage += b.wastageKg;
  }

  const overallYieldPct = totalInput > 0 ? Math.round((totalOutput / totalInput) * 1000) / 10 : 0;

  const withinStandardCount = batches.filter(b => b.yieldStatus === 'WITHIN_STANDARD').length;
  const belowStandardCount = batches.filter(b => b.yieldStatus === 'BELOW_STANDARD').length;
  const aboveStandardCount = batches.filter(b => b.yieldStatus === 'ABOVE_STANDARD').length;
  const massBalanceErrorsCount = batches.filter(b => b.massBalanceStatus !== 'BALANCED').length;

  return {
    totalBatches,
    totalInputKg: Math.round(totalInput),
    totalOutputKg: Math.round(totalOutput),
    totalWastageKg: Math.round(totalWastage),
    overallYieldPct,
    withinStandardCount,
    belowStandardCount,
    aboveStandardCount,
    massBalanceErrorsCount,
    standardYieldBenchmark: 72.0
  };
}

/**
 * Monthly and Weekly Yield Trends for Degradation Tracking
 */
async function getYieldTrends() {
  const batches = await getBatchYieldList({ limit: 100 });
  const monthMap = {};

  for (const b of batches) {
    const month = (b.batchDate || '').substring(0, 7) || new Date().toISOString().substring(0, 7);
    if (!monthMap[month]) {
      monthMap[month] = { month, totalInput: 0, totalOutput: 0, totalWastage: 0, count: 0 };
    }
    monthMap[month].totalInput += b.inputKg;
    monthMap[month].totalOutput += b.outputKg;
    monthMap[month].totalWastage += b.wastageKg;
    monthMap[month].count++;
  }

  const trends = Object.values(monthMap).map(m => ({
    month: m.month,
    avgYieldPct: m.totalInput > 0 ? Math.round((m.totalOutput / m.totalInput) * 1000) / 10 : 0,
    avgWastagePct: m.totalInput > 0 ? Math.round((m.totalWastage / m.totalInput) * 1000) / 10 : 0,
    batchCount: m.count,
    targetYieldPct: 72.0
  })).sort((a, b) => a.month.localeCompare(b.month));

  return trends;
}

/**
 * Gets List of Production Yield Standards
 */
async function getYieldStandards() {
  const res = await db.query('SELECT * FROM yield_standards ORDER BY id ASC');
  return res.rows || [];
}

/**
 * Saves or updates a Yield Standard
 */
async function saveYieldStandard(data) {
  const { id, productName, processName, standardYieldPct, tolerancePct, allowedWastagePct, allowedLossPct } = data;
  if (!productName || !processName) throw new Error('Product and Process names are required');

  if (id) {
    await db.run(`
      UPDATE yield_standards SET
        product_name = ?, process_name = ?, standard_yield_pct = ?,
        tolerance_pct = ?, allowed_wastage_pct = ?, allowed_loss_pct = ?
      WHERE id = ?
    `, [productName, processName, standardYieldPct, tolerancePct, allowedWastagePct, allowedLossPct, id]);
    return { id, ...data };
  } else {
    await db.run(`
      INSERT INTO yield_standards (product_name, process_name, standard_yield_pct, tolerance_pct, allowed_wastage_pct, allowed_loss_pct)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [productName, processName, standardYieldPct || 72, tolerancePct || 2, allowedWastagePct || 5, allowedLossPct || 5]);
    const res = await db.query('SELECT id FROM yield_standards ORDER BY id DESC LIMIT 1');
    return { id: res.rows?.[0]?.id, ...data };
  }
}

/**
 * Production Exception Logger & Investigation Tracking
 */
async function getProductionExceptions() {
  const batches = await getBatchYieldList({ limit: 100 });
  return batches.filter(b => b.yieldStatus === 'BELOW_STANDARD' || b.massBalanceStatus !== 'BALANCED');
}

module.exports = {
  getYieldDashboardStats,
  calculateBatchYieldMetrics,
  getBatchYieldList,
  getYieldTrends,
  getYieldStandards,
  saveYieldStandard,
  getProductionExceptions
};
