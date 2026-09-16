const db = require('../config/database');
const bomService = require('./bomService');

/**
 * Production Planning & Material Requirement Service (Phase 5)
 * Plans finished goods demand, calculates component raw material shortages via BOMs,
 * and releases production orders.
 */

async function getProductionPlans(filters = {}) {
  const { status, search } = filters;
  let sql = `
    SELECT 
      pp.*,
      COUNT(ppi.id) as item_count,
      COALESCE(SUM(ppi.target_qty), 0) as total_target_qty
    FROM production_plans pp
    LEFT JOIN production_plan_items ppi ON pp.id = ppi.plan_id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'ALL') {
    sql += ` AND pp.status = ?`;
    params.push(status);
  }

  if (search) {
    sql += ` AND (LOWER(pp.plan_no) LIKE ? OR LOWER(pp.remarks) LIKE ?)`;
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }

  sql += ` GROUP BY pp.id ORDER BY pp.id DESC`;
  const res = await db.query(sql, params);
  return res.rows || [];
}

async function getProductionPlanById(id) {
  const planRes = await db.query('SELECT * FROM production_plans WHERE id = ?', [id]);
  if (!planRes.rows?.length) return null;
  const plan = planRes.rows[0];

  const itemsRes = await db.query(`
    SELECT ppi.*, bh.bom_name, bh.bom_code
    FROM production_plan_items ppi
    LEFT JOIN bom_headers bh ON ppi.bom_id = bh.id
    WHERE ppi.plan_id = ?
    ORDER BY ppi.id ASC
  `, [id]);
  plan.items = itemsRes.rows || [];

  return plan;
}

async function createProductionPlan(data) {
  const {
    planNo,
    planDate = new Date().toISOString().split('T')[0],
    targetDate,
    status = 'Planned',
    remarks,
    createdBy = 'Admin',
    items = []
  } = data;

  const code = planNo || `PP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

  await db.run(`
    INSERT INTO production_plans (plan_no, plan_date, target_date, status, remarks, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [code, planDate, targetDate || null, status, remarks || '', createdBy]);

  const inserted = await db.query('SELECT id FROM production_plans WHERE plan_no = ?', [code]);
  const planId = inserted.rows?.[0]?.id;

  if (planId && items.length > 0) {
    for (const it of items) {
      // Find matching active BOM if not explicitly provided
      let bomId = it.bomId;
      let bomVer = it.bomVersion || 'V1';
      if (!bomId && it.productName) {
        const bomRes = await db.query('SELECT id, version FROM bom_headers WHERE LOWER(product_name) = LOWER(?) AND status = "Active" LIMIT 1', [it.productName]);
        if (bomRes.rows?.length) {
          bomId = bomRes.rows[0].id;
          bomVer = bomRes.rows[0].version;
        }
      }

      await db.run(`
        INSERT INTO production_plan_items (
          plan_id, product_id, product_name, bom_id, bom_version, target_qty, uom, machine_line, shift, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        planId, it.productId || null, it.productName, bomId || null, bomVer,
        parseFloat(it.targetQty) || 0, it.uom || 'KG', it.machineLine || 'Flour Mill A',
        it.shift || 'General Shift', 'Pending'
      ]);
    }
  }

  return getProductionPlanById(planId);
}

async function updateProductionPlan(id, data) {
  const existing = await getProductionPlanById(id);
  if (!existing) throw new Error(`Production plan #${id} not found`);

  const { targetDate, status, remarks, items } = data;

  await db.run(`
    UPDATE production_plans SET
      target_date = COALESCE(?, target_date),
      status = COALESCE(?, status),
      remarks = COALESCE(?, remarks),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [targetDate, status, remarks, id]);

  if (items && Array.isArray(items)) {
    await db.run('DELETE FROM production_plan_items WHERE plan_id = ?', [id]);
    for (const it of items) {
      await db.run(`
        INSERT INTO production_plan_items (
          plan_id, product_id, product_name, bom_id, bom_version, target_qty, uom, machine_line, shift, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, it.productId || null, it.productName, it.bomId || null, it.bomVersion || 'V1',
        parseFloat(it.targetQty) || 0, it.uom || 'KG', it.machineLine || 'Flour Mill A',
        it.shift || 'General Shift', it.status || 'Pending'
      ]);
    }
  }

  return getProductionPlanById(id);
}

/**
 * Explodes Material Requirements for an entire Production Plan and calculates Stock Shortages
 */
async function calculatePlanRequirementsAndShortages(planId) {
  const plan = await getProductionPlanById(planId);
  if (!plan) throw new Error(`Production plan #${planId} not found`);

  const aggregatedRequirements = new Map();

  for (const item of (plan.items || [])) {
    try {
      const explosion = await bomService.calculateMaterialRequirements(item.bom_id || item.product_name, item.target_qty);
      for (const comp of (explosion.requirements || [])) {
        const key = comp.itemName.toLowerCase();
        if (aggregatedRequirements.has(key)) {
          const prev = aggregatedRequirements.get(key);
          prev.totalRequiredQty += comp.requiredQty;
          prev.shortage = Math.max(0, prev.totalRequiredQty - prev.availableStock);
          prev.status = prev.shortage > 0 ? 'SHORTAGE' : 'SUFFICIENT';
          prev.productsUsedIn.push({ product: item.product_name, plannedQty: item.target_qty, componentQty: comp.requiredQty });
        } else {
          aggregatedRequirements.set(key, {
            itemId: comp.itemId,
            itemName: comp.itemName,
            itemType: comp.itemType,
            uom: comp.uom,
            totalRequiredQty: comp.requiredQty,
            availableStock: comp.availableStock,
            shortage: comp.shortage,
            status: comp.status,
            productsUsedIn: [{ product: item.product_name, plannedQty: item.target_qty, componentQty: comp.requiredQty }]
          });
        }
      }
    } catch (e) {
      console.warn(`Could not explode BOM for item ${item.product_name}:`, e.message);
    }
  }

  const requirementsList = Array.from(aggregatedRequirements.values());
  const totalShortageCount = requirementsList.filter(r => r.shortage > 0).length;

  return {
    planId: plan.id,
    planNo: plan.plan_no,
    planDate: plan.plan_date,
    targetDate: plan.target_date,
    status: plan.status,
    totalShortageCount,
    requirements: requirementsList
  };
}

module.exports = {
  getProductionPlans,
  getProductionPlanById,
  createProductionPlan,
  updateProductionPlan,
  calculatePlanRequirementsAndShortages
};
