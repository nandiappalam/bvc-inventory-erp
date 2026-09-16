const db = require('../config/database');

/**
 * BOM & Formula Management Service (Phase 6)
 * Handles recipe structures, multi-level BOMs, versioning, material explosion,
 * and standard vs. actual consumption comparisons.
 */

async function getBOMs(filters = {}) {
  const { status, search } = filters;
  let sql = `
    SELECT 
      bh.*,
      COUNT(bi.id) as component_count,
      SUM(bi.quantity) as total_components_qty
    FROM bom_headers bh
    LEFT JOIN bom_items bi ON bh.id = bi.bom_id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'ALL') {
    sql += ` AND bh.status = ?`;
    params.push(status);
  }

  if (search) {
    sql += ` AND (LOWER(bh.bom_code) LIKE ? OR LOWER(bh.bom_name) LIKE ? OR LOWER(bh.product_name) LIKE ?)`;
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }

  sql += ` GROUP BY bh.id ORDER BY bh.id DESC`;
  const res = await db.query(sql, params);
  return res.rows || [];
}

async function getBOMById(id) {
  const headerRes = await db.query('SELECT * FROM bom_headers WHERE id = ?', [id]);
  if (!headerRes.rows?.length) return null;
  const header = headerRes.rows[0];

  const itemsRes = await db.query(`
    SELECT * FROM bom_items WHERE bom_id = ? ORDER BY sequence_order ASC, id ASC
  `, [id]);
  header.items = itemsRes.rows || [];

  return header;
}

async function createBOM(data) {
  const {
    bomCode,
    bomName,
    productId,
    productName,
    version = 'V1',
    batchQty = 100,
    uom = 'KG',
    status = 'Active',
    effectiveFrom,
    effectiveTo,
    standardYieldPct = 100,
    yieldTolerancePct = 2,
    createdBy = 'Admin',
    remarks,
    items = []
  } = data;

  if (!bomName || !productName) {
    throw new Error('BOM Name and Product Name are required');
  }

  const code = bomCode || `BOM-${Date.now().toString().slice(-6)}`;

  await db.run(`
    INSERT INTO bom_headers (
      bom_code, bom_name, product_id, product_name, version, batch_qty, uom,
      status, effective_from, effective_to, standard_yield_pct, yield_tolerance_pct,
      created_by, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    code, bomName, productId || null, productName, version, batchQty, uom,
    status, effectiveFrom || new Date().toISOString().split('T')[0], effectiveTo || null,
    standardYieldPct, yieldTolerancePct, createdBy, remarks || ''
  ]);

  const inserted = await db.query('SELECT id FROM bom_headers WHERE bom_code = ?', [code]);
  const bomId = inserted.rows?.[0]?.id;

  if (bomId && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await db.run(`
        INSERT INTO bom_items (
          bom_id, item_id, item_name, quantity, uom, scrap_pct, item_type, is_optional, sequence_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        bomId, it.itemId || null, it.itemName, parseFloat(it.quantity) || 0,
        it.uom || 'KG', parseFloat(it.scrapPct) || 0, it.itemType || 'Raw Material',
        it.isOptional ? 1 : 0, i + 1
      ]);
    }
  }

  return getBOMById(bomId);
}

async function updateBOM(id, data) {
  const existing = await getBOMById(id);
  if (!existing) throw new Error(`BOM #${id} not found`);

  const {
    bomName,
    productName,
    version,
    batchQty,
    uom,
    status,
    effectiveFrom,
    effectiveTo,
    standardYieldPct,
    yieldTolerancePct,
    approvedBy,
    remarks,
    items
  } = data;

  await db.run(`
    UPDATE bom_headers SET
      bom_name = COALESCE(?, bom_name),
      product_name = COALESCE(?, product_name),
      version = COALESCE(?, version),
      batch_qty = COALESCE(?, batch_qty),
      uom = COALESCE(?, uom),
      status = COALESCE(?, status),
      effective_from = COALESCE(?, effective_from),
      effective_to = COALESCE(?, effective_to),
      standard_yield_pct = COALESCE(?, standard_yield_pct),
      yield_tolerance_pct = COALESCE(?, yield_tolerance_pct),
      approved_by = COALESCE(?, approved_by),
      remarks = COALESCE(?, remarks),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    bomName, productName, version, batchQty, uom, status,
    effectiveFrom, effectiveTo, standardYieldPct, yieldTolerancePct,
    approvedBy, remarks, id
  ]);

  if (items && Array.isArray(items)) {
    // Delete existing components and re-insert
    await db.run('DELETE FROM bom_items WHERE bom_id = ?', [id]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await db.run(`
        INSERT INTO bom_items (
          bom_id, item_id, item_name, quantity, uom, scrap_pct, item_type, is_optional, sequence_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, it.itemId || null, it.itemName, parseFloat(it.quantity) || 0,
        it.uom || 'KG', parseFloat(it.scrapPct) || 0, it.itemType || 'Raw Material',
        it.isOptional ? 1 : 0, i + 1
      ]);
    }
  }

  return getBOMById(id);
}

/**
 * Creates a new revision/version of an existing BOM while preserving the previous version's immutability
 */
async function createBOMVersion(id, newVersionData = {}) {
  const existing = await getBOMById(id);
  if (!existing) throw new Error(`BOM #${id} not found`);

  // Parse existing version number
  const vMatch = existing.version.match(/V(\d+)/i);
  const nextVer = vMatch ? `V${parseInt(vMatch[1], 10) + 1}` : `${existing.version}-Rev1`;

  const newCode = `${existing.bom_code}-${nextVer}`;

  return createBOM({
    bomCode: newCode,
    bomName: newVersionData.bomName || `${existing.bom_name} (${nextVer})`,
    productId: existing.product_id,
    productName: existing.product_name,
    version: nextVer,
    batchQty: newVersionData.batchQty || existing.batch_qty,
    uom: existing.uom,
    status: 'Draft',
    effectiveFrom: newVersionData.effectiveFrom || new Date().toISOString().split('T')[0],
    standardYieldPct: newVersionData.standardYieldPct || existing.standard_yield_pct,
    yieldTolerancePct: newVersionData.yieldTolerancePct || existing.yield_tolerance_pct,
    createdBy: newVersionData.createdBy || 'Admin',
    remarks: `Created as new version from ${existing.bom_code} (${existing.version})`,
    items: newVersionData.items || existing.items
  });
}

/**
 * Multi-level Material Requirement Explosion & Available Stock Check
 * Given target production quantity, calculates required quantities recursively through all BOM levels
 */
async function calculateMaterialRequirements(productNameOrBomId, targetQuantity = 100) {
  let bom = null;
  if (typeof productNameOrBomId === 'number' || !isNaN(Number(productNameOrBomId))) {
    bom = await getBOMById(productNameOrBomId);
  } else {
    const res = await db.query(`
      SELECT * FROM bom_headers 
      WHERE (LOWER(product_name) = LOWER(?) OR LOWER(bom_code) = LOWER(?)) AND status = 'Active'
      ORDER BY id DESC LIMIT 1
    `, [productNameOrBomId, productNameOrBomId]);
    if (res.rows?.length) {
      bom = await getBOMById(res.rows[0].id);
    }
  }

  if (!bom) {
    throw new Error(`Active BOM not found for '${productNameOrBomId}'`);
  }

  const batchQty = bom.batch_qty || 100;
  const multiplier = (parseFloat(targetQuantity) || 100) / batchQty;

  const directRequirements = [];
  const multiLevelTree = {
    productName: bom.product_name,
    targetQuantity,
    uom: bom.uom,
    bomCode: bom.bom_code,
    version: bom.version,
    components: []
  };

  for (const comp of (bom.items || [])) {
    const grossQty = comp.quantity * multiplier;
    const scrapAllowance = grossQty * ((comp.scrap_pct || 0) / 100);
    const totalRequired = grossQty + scrapAllowance;

    // Check available stock in warehouse
    const stockRes = await db.query(`
      SELECT COALESCE(SUM(remaining_quantity), 0) as available_qty
      FROM stock_lots
      WHERE LOWER(item_name) = LOWER(?) AND usable_for_production = 1 AND qc_status = 'ACCEPTED'
    `, [comp.item_name]);

    const availableQty = parseFloat(stockRes.rows?.[0]?.available_qty) || 0;
    const shortageQty = Math.max(0, totalRequired - availableQty);

    const compData = {
      itemId: comp.item_id,
      itemName: comp.item_name,
      itemType: comp.item_type,
      standardQtyPerBatch: comp.quantity,
      requiredQty: Math.round(totalRequired * 100) / 100,
      uom: comp.uom,
      scrapPct: comp.scrap_pct,
      availableStock: Math.round(availableQty * 100) / 100,
      shortage: Math.round(shortageQty * 100) / 100,
      status: shortageQty > 0 ? 'SHORTAGE' : 'SUFFICIENT',
      subBom: null
    };

    // Multi-level check: if this component is itself an Intermediate with an active BOM (e.g. Urad Flour)
    if (comp.item_type === 'Intermediate') {
      const subBomRes = await db.query(`
        SELECT id FROM bom_headers WHERE LOWER(product_name) = LOWER(?) AND status = 'Active' LIMIT 1
      `, [comp.item_name]);

      if (subBomRes.rows?.length) {
        try {
          const subRequirements = await calculateMaterialRequirements(subBomRes.rows[0].id, totalRequired);
          compData.subBom = subRequirements;
        } catch (e) {
          // ignore sub-bom recursive errors
        }
      }
    }

    directRequirements.push(compData);
    multiLevelTree.components.push(compData);
  }

  return {
    bom,
    targetQuantity,
    multiplier,
    requirements: directRequirements,
    tree: multiLevelTree
  };
}

/**
 * Compare Standard BOM Consumption vs Actual Consumption for a Production Batch / Work Order
 */
async function compareStandardVsActual(workOrderId) {
  const woRes = await db.query('SELECT * FROM work_orders WHERE id = ?', [workOrderId]);
  if (!woRes.rows?.length) throw new Error(`Work order #${workOrderId} not found`);
  const wo = woRes.rows[0];

  const actualInputs = await db.query('SELECT * FROM work_order_items WHERE work_order_id = ?', [workOrderId]);
  const actualOutputs = await db.query('SELECT * FROM work_order_outputs WHERE work_order_id = ?', [workOrderId]);

  // Find corresponding BOM
  const bomRes = await db.query(`
    SELECT * FROM bom_headers WHERE LOWER(product_name) = LOWER(?) ORDER BY id DESC LIMIT 1
  `, [wo.product]);

  let standardRequirements = [];
  if (bomRes.rows?.length) {
    const explosion = await calculateMaterialRequirements(bomRes.rows[0].id, wo.actual_output_wt || wo.expected_output_wt || 1000);
    standardRequirements = explosion.requirements;
  }

  const comparison = (actualInputs.rows || []).map(act => {
    const std = standardRequirements.find(s => s.itemName.toLowerCase() === act.item_name.toLowerCase());
    const actualQty = act.input_qty || act.weight || 0;
    const standardQty = std ? std.requiredQty : actualQty;
    const variance = actualQty - standardQty;
    const variancePct = standardQty > 0 ? (variance / standardQty) * 100 : 0;

    return {
      itemName: act.item_name,
      lotNo: act.lot_no,
      standardQty: Math.round(standardQty * 100) / 100,
      actualQty: Math.round(actualQty * 100) / 100,
      varianceQty: Math.round(variance * 100) / 100,
      variancePct: Math.round(variancePct * 100) / 100,
      status: variance > 0 ? 'OVER_CONSUMED' : variance < 0 ? 'UNDER_CONSUMED' : 'EXACT'
    };
  });

  return {
    workOrderNo: wo.work_order_no,
    product: wo.product,
    outputWeight: wo.actual_output_wt || wo.expected_output_wt,
    comparisons: comparison
  };
}

module.exports = {
  getBOMs,
  getBOMById,
  createBOM,
  updateBOM,
  createBOMVersion,
  calculateMaterialRequirements,
  compareStandardVsActual
};
