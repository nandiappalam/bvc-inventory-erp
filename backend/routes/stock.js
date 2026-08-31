const express = require('express')
const router = express.Router()
const db = require('../config/database')
const { rebuildStockLedger } = require('../utils/stockRebuilder')

// Rebuild stock ledger & stock lots
router.post('/rebuild', async (req, res) => {
  try {
    await rebuildStockLedger();
    res.json({ success: true, message: 'Stock ledger & lots successfully re-synchronized.' });
  } catch (err) {
    console.error('Error rebuilding stock:', err);
    res.status(500).json({ success: false, message: 'Failed to rebuild stock', error: err.message });
  }
});

// ============================================================================
// STOCK LOTS TABLE MANAGEMENT
// ============================================================================

// Create stock_lots table if not exists
const createStockLotsTable = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS stock_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        item_name TEXT NOT NULL,
        lot_no TEXT NOT NULL,
        purchase_id INTEGER,
        quantity REAL DEFAULT 0,
        remaining_quantity REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('stock_lots table ready')
  } catch (error) {
    console.error('Error creating stock_lots table:', error.message)
  }
}

// Initialize table on module load
createStockLotsTable()

// ============================================================================
// CREATE INDEXES FOR PERFORMANCE
// ============================================================================
const createIndexes = async () => {
  try {
    await db.run(`CREATE INDEX IF NOT EXISTS idx_stock_lots_lot ON stock_lots(lot_no)`)
    await db.run(`CREATE INDEX IF NOT EXISTS idx_stock_lots_item ON stock_lots(item_name)`)
    await db.run(`CREATE INDEX IF NOT EXISTS idx_stock_lots_purchase ON stock_lots(purchase_id)`)
    await db.run(`CREATE INDEX IF NOT EXISTS idx_stock_lot_no ON stock(lot_no)`)
    await db.run(`CREATE INDEX IF NOT EXISTS idx_stock_item_name ON stock(item_name)`)
    console.log('Stock indexes created successfully')
  } catch (error) {
    console.error('Error creating stock indexes:', error.message)
  }
}
createIndexes()

// ============================================================================
// STOCK CATEGORY DETERMINATION HELPER
// ============================================================================
const isWastageItem = (itemName, itemGroup) => {
  const grp = (itemGroup || '').toLowerCase();
  const name = (itemName || '').toLowerCase();
  if (
    grp.includes('wastage') || 
    grp.includes('reject') || 
    grp.includes('rejection') || 
    grp.includes('loss') || 
    grp.includes('scrap')
  ) {
    return true;
  }
  if (
    name.includes('wastage') || 
    name.includes('husk') || 
    name.includes('dust') || 
    name.includes('bran') || 
    name.includes('chuni') || 
    name.includes('lilo') || 
    name.includes('loss') || 
    name.includes('reject') ||
    name.includes('rejection') ||
    name.includes('scrap')
  ) {
    if (!name.includes('broken rice') && !name.includes('rice') && !name.includes('dal')) {
      return true;
    }
  }
  return false;
};

const determineLotCategory = async (dbInstance, itemName, itemGroup, lotNo) => {
  if (isWastageItem(itemName, itemGroup)) return 'Wastage';

  const grp = (itemGroup || '').toLowerCase().trim();
  const name = (itemName || '').toLowerCase().trim();
  const lot = (lotNo || '').toLowerCase().trim();

  // 1. Check database and lot prefix
  if (lot) {
    if (lot.startsWith('rm') || lot.includes('rm-')) return 'RM';
    if (lot.startsWith('fg') || lot.includes('fg-')) return 'FG';

    try {
      const slCheck = await dbInstance.query('SELECT category FROM stock_lots WHERE LOWER(lot_no) = LOWER(?) LIMIT 1', [lotNo]);
      if (slCheck.rows && slCheck.rows.length > 0 && slCheck.rows[0].category) {
        return slCheck.rows[0].category;
      }
    } catch (e) {}

    try {
      const piCheck = await dbInstance.query('SELECT id FROM purchase_items WHERE LOWER(lot_no) = LOWER(?) LIMIT 1', [lotNo]);
      if (piCheck.rows && piCheck.rows.length > 0) return 'RM';
    } catch (e) {}

    try {
      const giCheck = await dbInstance.query('SELECT id FROM grain_input_items WHERE LOWER(lot_no) = LOWER(?) LIMIT 1', [lotNo]);
      if (giCheck.rows && giCheck.rows.length > 0) return 'RM';
    } catch (e) {}

    try {
      const goCheck = await dbInstance.query('SELECT id FROM grain_output_items WHERE LOWER(lot_no) = LOWER(?) LIMIT 1', [lotNo]);
      if (goCheck.rows && goCheck.rows.length > 0) return 'FG';
    } catch (e) {}

    try {
      const pkCheck = await dbInstance.query(`SELECT id FROM packing_items WHERE LOWER(lot_no) = LOWER(?) AND (remarks = 'section:to' OR remarks IS NULL OR remarks = '' OR section = 'to') LIMIT 1`, [lotNo]);
      if (pkCheck.rows && pkCheck.rows.length > 0) return 'FG';
    } catch (e) {}

    try {
      const papCheck = await dbInstance.query('SELECT id FROM papad_in_items WHERE LOWER(lot_no) = LOWER(?) LIMIT 1', [lotNo]);
      if (papCheck.rows && papCheck.rows.length > 0) return 'FG';
    } catch (e) {}

    try {
      const foCheck = await dbInstance.query(`SELECT id FROM flour_out_items WHERE LOWER(lot_no) = LOWER(?) AND (remarks = 'section:to' OR section = 'to') LIMIT 1`, [lotNo]);
      if (foCheck.rows && foCheck.rows.length > 0) return 'FG';
    } catch (e) {}
  }

  // 2. Check item name & group keywords
  if (
    grp === 'rm' || 
    grp === 'raw material' || 
    grp.includes('raw material') || 
    grp.includes('pulses') || 
    grp.includes('grains') ||
    name.includes('bengal gram') ||
    name.includes('gram') ||
    name.includes('split') ||
    name.includes('broken rice') ||
    name.includes('urad') ||
    name.includes('raw rice') ||
    name.includes('paddy') ||
    name.includes('dal') ||
    name.includes('chana') ||
    name.includes('moong') ||
    name.includes('toor') ||
    name.includes('masur')
  ) {
    return 'RM';
  }

  if (grp.includes('packing') || grp === 'pm') {
    return 'PM';
  }

  if (
    grp === 'finished goods' || 
    grp === 'fg' || 
    grp.includes('papad') || 
    name.includes('papad') || 
    name.includes('atta') || 
    name.includes('flour') || 
    name.includes('bgf') || 
    name.includes('brf') || 
    name.includes('vaccum') ||
    name.includes('vacuum')
  ) {
    return 'FG';
  }

  return 'RM';
};

// ============================================================================
// GET LOT HISTORY - Complete traceability of a lot
// Param: lot_no
// Returns: Purchase details, Grind conversions, Sales, Remaining stock
// ============================================================================
router.get('/lot-history/:lotNo', async (req, res) => {
  try {
    const { lotNo } = req.params
    
    // Get lot details from stock_lots
    const lotDetails = await db.query(`
      SELECT sl.*, p.supplier as supplier_name, p.date as purchase_date
      FROM stock_lots sl
      LEFT JOIN purchases p ON sl.purchase_id = p.id
      WHERE sl.lot_no = ?
    `, [lotNo])
    
    if (lotDetails.rows.length === 0) {
      return res.status(404).json({ message: 'Lot not found' })
    }
    
    const lot = lotDetails.rows[0]
    
    // Get purchase items for this lot
    const purchaseItems = await db.query(`
      SELECT pi.*, p.inv_no, p.date as purchase_date, p.supplier
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      WHERE pi.lot_no = ? OR pi.lot_no LIKE ?
    `, [lotNo, `%${lotNo}%`])
    
    // Get sales items for this lot
    const salesItems = await db.query(`
      SELECT si.*, s.s_no, s.date as sales_date, s.customer
      FROM sales_items si
      JOIN sales s ON si.sales_id = s.id
      WHERE si.lot_no = ? OR si.lot_no LIKE ?
    `, [lotNo, `%${lotNo}%`])
    
    // Get flour out items (grind) for this lot
    const grindItems = await db.query(`
      SELECT foi.*, fo.s_no, fo.date as grind_date, fo.papad_company
      FROM flour_out_items foi
      JOIN flour_out fo ON foi.flour_out_id = fo.id
      WHERE foi.lot_no = ? OR foi.lot_no LIKE ?
    `, [lotNo, `%${lotNo}%`])
    
    // Get grain input items (grind) for this lot
    const grainInputItems = await db.query(`
      SELECT gi.*, g.s_no, g.date as grind_date, fmm.flourmill AS flour_mill_name
      FROM grain_input_items gi
      JOIN grains g ON gi.grain_id = g.id
      LEFT JOIN flour_mill_master fmm ON (CAST(g.flour_mill AS TEXT) = CAST(fmm.id AS TEXT) OR g.flour_mill = fmm.flourmill)
      WHERE gi.lot_no = ? OR gi.lot_no LIKE ?
    `, [lotNo, `%${lotNo}%`])

    const combinedGrind = [
      ...grindItems.rows.map(item => ({
        ...item,
        type: 'Flour Out',
        source: 'flour_out'
      })),
      ...grainInputItems.rows.map(item => ({
        id: item.id,
        flour_out_id: item.grain_id,
        item_name: item.item_name,
        lot_no: item.lot_no,
        weight: item.weight,
        qty: item.qty,
        total_wt: item.total_wt,
        s_no: item.s_no,
        grind_date: item.grind_date,
        papad_company: item.flour_mill_name || 'Grind Creation',
        type: 'Grind Creation',
        source: 'grains'
      }))
    ]
    
    // Get flour out output lots (flour lots created from this grain lot)
    const flourOutputLots = await db.query(`
      SELECT sl.*, fo.date as created_date
      FROM stock_lots sl
      JOIN flour_out fo ON sl.purchase_id = fo.id
      WHERE sl.item_name LIKE 'Flour%'
      AND fo.id IN (
        SELECT flour_out_id FROM flour_out_items 
        WHERE lot_no = ? OR lot_no LIKE ?
      )
    `, [lotNo, `%${lotNo}%`])

    // Get grain output lots (flour lots created from this grain lot)
    const grainOutputLots = await db.query(`
      SELECT sl.*, g.date as created_date
      FROM stock_lots sl
      JOIN grains g ON sl.purchase_id = g.id
      WHERE sl.lot_no IN (
        SELECT lot_no FROM grain_output_items
        WHERE grain_id IN (
          SELECT grain_id FROM grain_input_items
          WHERE lot_no = ? OR lot_no LIKE ?
        )
      )
    `, [lotNo, `%${lotNo}%`])

    const combinedOutput = [
      ...flourOutputLots.rows,
      ...grainOutputLots.rows
    ]
    
    res.json({
      lotDetails: lot,
      purchase: purchaseItems.rows,
      sales: salesItems.rows,
      grind: combinedGrind,
      flourOutput: combinedOutput,
      summary: {
        initialQuantity: lot.quantity,
        remainingQuantity: lot.remaining_quantity,
        soldQuantity: (lot.quantity || 0) - (lot.remaining_quantity || 0),
        totalSales: salesItems.rows.length,
        totalGrind: combinedGrind.length
      }
    })
  } catch (error) {
    console.error('Error fetching lot history:', error)
    res.status(500).json({ message: 'Error fetching lot history', error: error.message })
  }
})

// ============================================================================
// GET STOCK REPORT - Product Summary Mode
// Query Params: item_id (optional), from_date, to_date
// ============================================================================
router.get('/report', async (req, res) => {
  try {
    const { item_id, from_date, to_date } = req.query
    
    let query = `
      SELECT 
        s.item_name,
        (SELECT id FROM item_master WHERE LOWER(item_name) = LOWER(s.item_name) LIMIT 1) as item_id,
        (SELECT item_group FROM item_master WHERE LOWER(item_name) = LOWER(s.item_name) LIMIT 1) as item_group,
        SUM(CASE WHEN s.type IN ('Opening Stock', 'Open Stock') THEN COALESCE(s.qty, 0) ELSE 0 END) as opening_qty,
        SUM(CASE WHEN s.type NOT IN ('Opening Stock', 'Open Stock') AND s.qty > 0 THEN COALESCE(s.qty, 0) ELSE 0 END) as total_purchased,
        SUM(CASE WHEN s.qty < 0 THEN COALESCE(ABS(s.qty), 0) ELSE 0 END) as total_sold,
        SUM(COALESCE(s.qty, 0)) as balance,
        COALESCE(
          (SELECT CASE WHEN COALESCE(qty, 0) != 0 THEN ROUND(ABS(weight) / ABS(qty), 2) ELSE 0 END FROM stock WHERE item_name = s.item_name AND qty != 0 LIMIT 1),
          (SELECT COALESCE(per_unit_weight, weight) FROM purchase_items WHERE item_name = s.item_name AND COALESCE(per_unit_weight, weight) > 0 LIMIT 1),
          50
        ) as weight
      FROM stock s
      WHERE 1=1
    `
    const params = []
    
    if (item_id) {
      query += ` AND item_name = (SELECT item_name FROM item_master WHERE id = ?)`
      params.push(item_id)
    }
    
    if (from_date) {
      query += ` AND s.date >= ?`
      params.push(from_date)
    }
    
    if (to_date) {
      query += ` AND s.date <= ?`
      params.push(to_date)
    }
    
    query += ` GROUP BY s.item_name ORDER BY s.item_name ASC`
    
    const result = await db.query(query, params)

    const formattedRows = await Promise.all((result.rows || []).map(async (row) => {
      const category = await determineLotCategory(db, row.item_name, row.item_group, null);
      return {
        ...row,
        category
      };
    }))

    res.json(formattedRows)
  } catch (error) {
    console.error('Error fetching stock report:', error)
    res.status(500).json({ message: 'Error fetching stock report', error: error.message })
  }
})

// ============================================================================
// GET STOCK REPORT - Lot Breakdown Mode
// Query Params: item_id (optional)
// ============================================================================
router.get('/lots', async (req, res) => {
  try {
    const { item_id } = req.query
    
    let query = `
      SELECT 
        sl.id,
        sl.item_name,
        sl.lot_no,
        sl.quantity as purchased_qty,
        sl.remaining_quantity,
        sl.rate,
        sl.created_at,
        im.item_group,
        (sl.quantity - sl.remaining_quantity) as sold_qty,
        COALESCE(
          (SELECT CASE WHEN COALESCE(qty, 0) != 0 THEN ROUND(ABS(weight) / ABS(qty), 2) ELSE 0 END FROM stock WHERE lot_no = sl.lot_no AND item_name = sl.item_name AND qty != 0 LIMIT 1),
          (SELECT COALESCE(per_unit_weight, weight) FROM purchase_items WHERE lot_no = sl.lot_no AND item_name = sl.item_name AND COALESCE(per_unit_weight, weight) > 0 LIMIT 1),
          50
        ) as weight
      FROM stock_lots sl
      LEFT JOIN item_master im ON (sl.item_id = im.id OR LOWER(sl.item_name) = LOWER(im.item_name))
      WHERE 1=1
    `
    const params = []
    
    if (item_id) {
      query += ` AND sl.item_id = ?`
      params.push(item_id)
    }
    
    query += ` ORDER BY sl.item_name, sl.created_at ASC`
    
    const result = await db.query(query, params)

    const enrichedRows = await Promise.all(result.rows.map(async (row) => {
      const category = await determineLotCategory(db, row.item_name, row.item_group, row.lot_no);

      const lifecycle = [];
      
      // 1. Purchases
      try {
        const purRes = await db.query(`
          SELECT pi.qty, pi.weight, pi.rate, pi.total_amt, p.date, p.supplier, p.inv_no, p.id as purchase_id
          FROM purchase_items pi
          JOIN purchases p ON pi.purchase_id = p.id
          WHERE pi.lot_no = ?
        `, [row.lot_no]);
        for (const pRow of purRes.rows) {
          lifecycle.push({
            module: 'Purchase',
            reference_id: pRow.purchase_id,
            reference_no: pRow.inv_no,
            date: pRow.date,
            party: pRow.supplier,
            qty: pRow.qty,
            weight: pRow.weight,
            rate: pRow.rate,
            amount: pRow.total_amt,
            type: 'Entry'
          });
        }
      } catch (e) {}

      // 2. Sales
      try {
        const salRes = await db.query(`
          SELECT si.qty, si.weight, si.rate, si.total_amt, s.date, s.customer, s.s_no, s.id as sales_id
          FROM sales_items si
          JOIN sales s ON si.sales_id = s.id
          WHERE si.lot_no = ?
        `, [row.lot_no]);
        for (const sRow of salRes.rows) {
          lifecycle.push({
            module: 'Sale',
            reference_id: sRow.sales_id,
            reference_no: sRow.s_no,
            date: sRow.date,
            party: sRow.customer,
            qty: -sRow.qty,
            weight: -sRow.weight,
            rate: sRow.rate,
            amount: -sRow.total_amt,
            type: 'Usage'
          });
        }
      } catch (e) {}

      // 3. Grains (Processing) - Inputs
      try {
        const grInRes = await db.query(`
          SELECT gi.qty, gi.weight, gi.total_wt, g.date, g.s_no, g.id as grain_id, fmm.flourmill as flour_mill_name
          FROM grain_input_items gi
          JOIN grains g ON gi.grain_id = g.id
          LEFT JOIN flour_mill_master fmm ON (CAST(g.flour_mill AS TEXT) = CAST(fmm.id AS TEXT) OR g.flour_mill = fmm.flourmill)
          WHERE gi.lot_no = ?
        `, [row.lot_no]);
        for (const giRow of grInRes.rows) {
          lifecycle.push({
            module: 'Grain Processing (Input)',
            reference_id: giRow.grain_id,
            reference_no: giRow.s_no,
            date: giRow.date,
            party: giRow.flour_mill_name || 'In-House Processing',
            qty: -giRow.qty,
            weight: -giRow.total_wt,
            rate: 0,
            amount: 0,
            type: 'Usage'
          });
        }
      } catch (e) {}

      // 4. Grains (Processing) - Output creations
      try {
        const grOutRes = await db.query(`
          SELECT go.qty, go.weight, go.total_wt, g.date, g.s_no, g.id as grain_id
          FROM grain_output_items go
          JOIN grains g ON go.grain_id = g.id
          WHERE go.lot_no = ?
        `, [row.lot_no]);
        for (const goRow of grOutRes.rows) {
          lifecycle.push({
            module: 'Grain Processing (Output)',
            reference_id: goRow.grain_id,
            reference_no: goRow.s_no,
            date: goRow.date,
            party: 'Production Output',
            qty: goRow.qty,
            weight: goRow.total_wt,
            rate: 0,
            amount: 0,
            type: 'Entry'
          });
        }
      } catch (e) {}

      // 5. Grains (Processing) - Wastage creations
      try {
        const grWRes = await db.query(`
          SELECT gw.qty, gw.weight, gw.total_wt, g.date, g.s_no, g.id as grain_id
          FROM grain_wastage_items gw
          JOIN grains g ON gw.grain_id = g.id
          WHERE gw.lot_no = ?
        `, [row.lot_no]);
        for (const gwRow of grWRes.rows) {
          lifecycle.push({
            module: 'Grain Processing (Wastage)',
            reference_id: gwRow.grain_id,
            reference_no: gwRow.s_no,
            date: gwRow.date,
            party: 'Production Wastage',
            qty: gwRow.qty,
            weight: gwRow.total_wt,
            rate: 0,
            amount: 0,
            type: 'Entry'
          });
        }
      } catch (e) {}

      // 6. Flour Out
      try {
        const foRes = await db.query(`
          SELECT foi.qty, foi.weight, foi.total_wt, fo.date, fo.s_no, fo.id as flour_out_id, fo.papad_company
          FROM flour_out_items foi
          JOIN flour_out fo ON foi.flour_out_id = fo.id
          WHERE foi.lot_no = ?
        `, [row.lot_no]);
        for (const foRow of foRes.rows) {
          lifecycle.push({
            module: 'Flour Out',
            reference_id: foRow.flour_out_id,
            reference_no: foRow.s_no,
            date: foRow.date,
            party: foRow.papad_company,
            qty: -foRow.qty,
            weight: -foRow.total_wt,
            rate: 0,
            amount: 0,
            type: 'Usage'
          });
        }
      } catch (e) {}

      // 7. Stock Adjustments
      try {
        const saRes = await db.query(`
          SELECT sai.qty, sai.weight, sai.tot_wt, sai.type as item_adjust_type, sa.date, sa.s_no, sa.id as sa_id, sa.type as adjust_type
          FROM stock_adjustment_items sai
          JOIN stock_adjustments sa ON sai.stock_adjustment_id = sa.id
          WHERE sai.lot_no = ?
        `, [row.lot_no]);
        for (const saRow of saRes.rows) {
          const itemTypeStr = (saRow.item_adjust_type || saRow.adjust_type || '').toLowerCase();
          const isDeduction = itemTypeStr.includes('deduct') || itemTypeStr.includes('reduce') || itemTypeStr.includes('issue') || itemTypeStr.includes('damage') || itemTypeStr.includes('wastage') || itemTypeStr.includes('less');

          const signedQty = isDeduction ? -Math.abs(saRow.qty) : Math.abs(saRow.qty);
          const signedWt = isDeduction ? -Math.abs(saRow.tot_wt) : Math.abs(saRow.tot_wt);

          const displayModuleType = saRow.item_adjust_type || saRow.adjust_type || 'Adjustment';

          lifecycle.push({
            module: `Stock Adjustment (${displayModuleType})`,
            reference_id: saRow.sa_id,
            reference_no: saRow.s_no,
            date: saRow.date,
            party: 'Adjustment',
            qty: signedQty,
            weight: signedWt,
            rate: 0,
            amount: 0,
            type: isDeduction ? 'Usage' : 'Entry'
          });
        }
      } catch (e) {}

      // 8. Weight Conversion
      try {
        const wcRes = await db.query(`
          SELECT wci.qty, wci.weight, wci.total_wt, wci.type as item_type, wc.date, wc.s_no, wc.id as wc_id, wc.remarks
          FROM weight_conversion_items wci
          JOIN weight_conversion wc ON wci.weight_conversion_id = wc.id
          WHERE wci.lot_no = ?
        `, [row.lot_no]);
        for (const wcRow of wcRes.rows) {
          const isInput = wcRow.item_type === 'input';
          lifecycle.push({
            module: `Weight Conversion (${isInput ? 'Input' : 'Output'})`,
            reference_id: wcRow.wc_id,
            reference_no: wcRow.s_no,
            date: wcRow.date,
            party: wcRow.remarks || 'Weight Conversion',
            qty: isInput ? -wcRow.qty : wcRow.qty,
            weight: isInput ? -wcRow.total_wt : wcRow.total_wt,
            rate: 0,
            amount: 0,
            type: isInput ? 'Usage' : 'Entry'
          });
        }
      } catch (e) {}

      // 9. Packing Module
      try {
        const packRes = await db.query(`
          SELECT pi.qty, pi.weight, pi.tot_wt, pi.rate, pi.remarks, p.date, p.s_no, p.id as packing_id, pi.employee_name
          FROM packing_items pi
          JOIN packing p ON pi.packing_id = p.id
          WHERE pi.lot_no = ?
        `, [row.lot_no]);
        for (const pkRow of packRes.rows) {
          const isFrom = pkRow.remarks === 'section:from' || pkRow.remarks === 'section:material';
          lifecycle.push({
            module: isFrom ? 'Packing (Used)' : 'Packing (FG Created)',
            reference_id: pkRow.packing_id,
            reference_no: pkRow.s_no,
            date: pkRow.date,
            party: pkRow.employee_name || 'Packing Section',
            qty: isFrom ? -pkRow.qty : pkRow.qty,
            weight: isFrom ? -pkRow.tot_wt : pkRow.tot_wt,
            rate: pkRow.rate,
            amount: isFrom ? -(pkRow.qty * pkRow.rate) : (pkRow.qty * pkRow.rate),
            type: isFrom ? 'Usage' : 'Entry'
          });
        }
      } catch (e) {}

      lifecycle.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Processing details for RM (where it was processed and what FG/Wastage was created)
      let processingDetails = null;
      if (category === 'RM') {
        try {
          const inputRes = await db.query(`
            SELECT DISTINCT grain_id FROM grain_input_items WHERE lot_no = ?
          `, [row.lot_no]);
          if (inputRes.rows.length > 0) {
            const grainIds = inputRes.rows.map(r => r.grain_id);
            const placeholders = grainIds.map(() => '?').join(',');
            const outputRes = await db.query(`
              SELECT item_name, lot_no, qty, total_wt FROM grain_output_items WHERE grain_id IN (${placeholders})
            `, grainIds);
            const wastageRes = await db.query(`
              SELECT item_name, lot_no, qty, total_wt FROM grain_wastage_items WHERE grain_id IN (${placeholders})
            `, grainIds);
            
            processingDetails = {
              processed_runs: grainIds.length,
              outputs: outputRes.rows.map(o => ({ item_name: o.item_name, lot_no: o.lot_no, qty: o.qty, weight: o.total_wt })),
              wastages: wastageRes.rows.map(w => ({ item_name: w.item_name, lot_no: w.lot_no, qty: w.qty, weight: w.total_wt }))
            };
          }
        } catch (e) {}
      }

      // Source details for FG (which raw material lots it was created from)
      let sourceDetails = null;
      if (category === 'FG') {
        try {
          const outputRes = await db.query(`
            SELECT DISTINCT grain_id FROM grain_output_items WHERE lot_no = ?
          `, [row.lot_no]);
          if (outputRes.rows.length > 0) {
            const grainIds = outputRes.rows.map(r => r.grain_id);
            const placeholders = grainIds.map(() => '?').join(',');
            
            // Get all RM inputs for these runs
            const inputRes = await db.query(`
              SELECT item_name, lot_no, qty, total_wt FROM grain_input_items WHERE grain_id IN (${placeholders})
            `, grainIds);

            // Get all outputs for these runs (for tracing other outputs generated alongside)
            const allOutputsRes = await db.query(`
              SELECT item_name, lot_no, qty, total_wt FROM grain_output_items WHERE grain_id IN (${placeholders})
            `, grainIds);

            // Get all wastages for these runs
            const wastageRes = await db.query(`
              SELECT item_name, lot_no, qty, total_wt FROM grain_wastage_items WHERE grain_id IN (${placeholders})
            `, grainIds);

            // Get processing mill and date
            const processRes = await db.query(`
              SELECT g.date, g.s_no, fmm.flourmill as flour_mill_name
              FROM grains g
              LEFT JOIN flour_mill_master fmm ON (CAST(g.flour_mill AS TEXT) = CAST(fmm.id AS TEXT) OR g.flour_mill = fmm.flourmill)
              WHERE g.id IN (${placeholders})
            `, grainIds);
            
            sourceDetails = {
              process_info: processRes.rows.map(p => ({ date: p.date, reference_no: p.s_no, mill: p.flour_mill_name || 'In-House Grinding' })),
              rm_inputs: inputRes.rows.map(i => ({ item_name: i.item_name, lot_no: i.lot_no, qty: i.qty, weight: i.total_wt })),
              outputs: allOutputsRes.rows.map(o => ({ item_name: o.item_name, lot_no: o.lot_no, qty: o.qty, weight: o.total_wt })),
              wastages: wastageRes.rows.map(w => ({ item_name: w.item_name, lot_no: w.lot_no, qty: w.qty, weight: w.total_wt }))
            };
          }
        } catch (e) {
          console.error('Error generating source details:', e);
        }
      }

      return {
        ...row,
        category,
        lifecycle_history: lifecycle,
        processing_details: processingDetails,
        source_details: sourceDetails
      };
    }));

    res.json(enrichedRows)
  } catch (error) {
    console.error('Error fetching lot breakdown:', error)
    res.status(500).json({ message: 'Error fetching lot breakdown', error: error.message })
  }
})

// ============================================================================
// GET AVAILABLE LOTS FOR AN ITEM (for Sales Lot Selection)
// Returns lots with remaining_quantity > 0
// ============================================================================
// GET NEXT AUTO LOT NO (LOT0001 format)
// ============================================================================
router.get('/next-lot-no', async (req, res) => {
  try {
    let maxLotNum = 0;
    
    // Check stock_lots
    try {
      const lotResult = await db.query(`
        SELECT MAX(CAST(REPLACE(lot_no, 'LOT', '') AS INTEGER)) AS maxLot
        FROM stock_lots WHERE lot_no LIKE 'LOT%'
      `);
      const num = parseInt(lotResult.rows[0]?.maxLot) || 0;
      if (num > maxLotNum) maxLotNum = num;
    } catch (e) {}

    // Check purchase_items
    try {
      const lotResult2 = await db.query(`
        SELECT MAX(CAST(REPLACE(lot_no, 'LOT', '') AS INTEGER)) AS maxLot
        FROM purchase_items WHERE lot_no LIKE 'LOT%'
      `);
      const num2 = parseInt(lotResult2.rows[0]?.maxLot) || 0;
      if (num2 > maxLotNum) maxLotNum = num2;
    } catch (e) {}

    // Check packing_items
    try {
      const lotResult3 = await db.query(`
        SELECT MAX(CAST(REPLACE(lot_no, 'LOT', '') AS INTEGER)) AS maxLot
        FROM packing_items WHERE lot_no LIKE 'LOT%'
      `);
      const num3 = parseInt(lotResult3.rows[0]?.maxLot) || 0;
      if (num3 > maxLotNum) maxLotNum = num3;
    } catch (e) {}

    const nextLotNum = maxLotNum + 1;
    const nextLotNo = `LOT${String(nextLotNum).padStart(4, '0')}`;
    res.json({ success: true, lot_no: nextLotNo, next_lot_no: nextLotNo });
  } catch (error) {
    console.error('Error generating next lot no:', error);
    res.status(500).json({ success: false, message: 'Error generating next lot no', lot_no: 'LOT0001' });
  }
});

// Query Param: item_id or item_name
// ============================================================================
router.get('/available-lots', async (req, res) => {
  try {
    const { item_id, item_name } = req.query
    
    let query = `
      SELECT 
        sl.id,
        sl.item_id,
        sl.item_name,
        sl.lot_no,
        sl.remaining_quantity,
        sl.remaining_quantity AS available_qty,
        sl.remaining_quantity AS balance_qty,
        sl.remaining_quantity AS stock,
        sl.quantity,
        COALESCE(
          NULLIF(sl.rate, 0),
          (SELECT pi.rate FROM purchase_items pi WHERE pi.lot_no = sl.lot_no AND (pi.item_id = sl.item_id OR LOWER(pi.item_name) = LOWER(sl.item_name)) AND pi.rate > 0 LIMIT 1),
          (SELECT s.rate FROM stock s WHERE s.lot_no = sl.lot_no AND (s.item_id = sl.item_id OR LOWER(s.item_name) = LOWER(sl.item_name)) AND s.rate > 0 LIMIT 1),
          0
        ) AS rate,
        COALESCE(
          sm.name,
          sm.print_name,
          (SELECT sm2.name FROM purchase_items pi2 JOIN purchases p2 ON p2.id = pi2.purchase_id LEFT JOIN supplier_master sm2 ON (sm2.id = p2.supplier OR sm2.name = p2.supplier) WHERE pi2.lot_no = sl.lot_no AND sm2.name IS NOT NULL LIMIT 1),
          (SELECT p3.supplier FROM purchase_items pi3 JOIN purchases p3 ON p3.id = pi3.purchase_id WHERE pi3.lot_no = sl.lot_no AND p3.supplier IS NOT NULL LIMIT 1),
          (SELECT sm3.name FROM supplier_master sm3 WHERE sm3.id = p.supplier OR sm3.name = p.supplier LIMIT 1),
          p.supplier,
          '-'
        ) AS supplier_name,
        sl.created_at as purchase_date,
        sl.created_at,
        COALESCE(
          (SELECT pi.per_unit_weight FROM purchase_items pi WHERE pi.lot_no = sl.lot_no AND (pi.item_id = sl.item_id OR LOWER(pi.item_name) = LOWER(sl.item_name)) AND pi.per_unit_weight > 0 LIMIT 1),
          (SELECT pi.weight FROM purchase_items pi WHERE pi.lot_no = sl.lot_no AND (pi.item_id = sl.item_id OR LOWER(pi.item_name) = LOWER(sl.item_name)) AND pi.weight > 0 LIMIT 1),
          (SELECT go.weight FROM grain_output_items go WHERE go.lot_no = sl.lot_no AND LOWER(go.item_name) = LOWER(sl.item_name) AND go.weight > 0 LIMIT 1),
          (SELECT pk.weight FROM packing_items pk WHERE pk.lot_no = sl.lot_no AND LOWER(pk.item_name) = LOWER(sl.item_name) AND pk.weight > 0 LIMIT 1),
          (SELECT wc.weight FROM weight_conversion_items wc WHERE wc.lot_no = sl.lot_no AND LOWER(wc.item_name) = LOWER(sl.item_name) AND wc.weight > 0 LIMIT 1),
          (SELECT ROUND(ABS(s.weight) / ABS(s.qty), 2) FROM stock s WHERE s.lot_no = sl.lot_no AND (s.item_id = sl.item_id OR LOWER(s.item_name) = LOWER(sl.item_name)) AND s.qty > 0 AND s.weight > 0 LIMIT 1),
          0
        ) AS per_unit_weight
      FROM stock_lots sl
      LEFT JOIN purchases p ON p.id = sl.purchase_id
      LEFT JOIN supplier_master sm ON (sm.id = p.supplier OR sm.name = p.supplier)
      WHERE COALESCE(sl.remaining_quantity, sl.quantity, 0) > 0
        AND (sl.unloading_status IS NULL OR sl.unloading_status != 'RETURNED')
        AND sl.lot_no NOT IN (
          SELECT DISTINCT lot_no FROM purchase_return_items WHERE lot_no IS NOT NULL AND lot_no != ''
        )
    `
    const params = []
    
    if (item_id) {
      query += ` AND (sl.item_id = ? OR sl.item_id IN (SELECT id FROM item_master WHERE id = ? OR LOWER(item_name) = LOWER(?)))`
      params.push(item_id, item_id, String(item_id))
    }
    
    if (item_name) {
      query += ` AND (LOWER(sl.item_name) = LOWER(?) OR sl.item_name LIKE ? OR sl.item_id IN (SELECT id FROM item_master WHERE LOWER(item_name) = LOWER(?)))`
      params.push(item_name, `%${item_name}%`, item_name)
    }
    
    query += ` GROUP BY sl.lot_no ORDER BY sl.id DESC`
    
    const result = await db.query(query, params)
    
    // Format response to show stock count, weight, rate, and supplier details
    const formatted = result.rows.map(row => {
      const rem = (row.remaining_quantity !== null && row.remaining_quantity !== undefined) 
        ? row.remaining_quantity 
        : (row.quantity || 0);
      const wt = parseFloat(row.per_unit_weight) || 0;
      const wtText = wt > 0 ? ` | Wt: ${wt} kg` : '';
      const rateVal = parseFloat(row.rate) || 0;
      const supplierName = row.supplier_name || '-';
      return {
        id: row.id,
        item_id: row.item_id,
        item_name: row.item_name,
        lot_no: row.lot_no,
        remaining_quantity: rem,
        available_qty: rem,
        balance_qty: rem,
        stock: rem,
        rate: rateVal,
        purchase_rate: rateVal,
        purc_rate: rateVal,
        supplier_name: supplierName,
        supplier: supplierName,
        weight: wt,
        per_unit_weight: wt,
        purchase_date: row.purchase_date,
        created_at: row.created_at,
        display: `${row.lot_no}${wtText} | Stock: ${rem} | Rate: ₹${rateVal} | ${supplierName}`
      };
    })
    
    res.json(formatted)
  } catch (error) {
    console.error('Error fetching available lots:', error)
    res.status(500).json({ message: 'Error fetching available lots', error: error.message })
  }
})

// ============================================================================
// GET AVAILABLE STOCK FOR AN ITEM (for FIFO deduction check)
// ============================================================================
// ============================================================================
// GET AVAILABLE STOCK FOR AN ITEM (by item_id or item_name)
// Required by ERP modules: returns lots with available_qty > 0
// Param: itemId
// ============================================================================
router.get('/available/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params

    const result = await db.query(`
      SELECT
        sl.id,
        sl.item_id,
        sl.item_name,
        sl.lot_no,
        sl.remaining_quantity AS available_qty,
        sl.remaining_quantity AS remaining_quantity,
        sl.remaining_quantity AS balance_qty,
        sl.remaining_quantity AS stock,
        sl.quantity,
        COALESCE(
          NULLIF(sl.rate, 0),
          (SELECT pi.rate FROM purchase_items pi WHERE pi.lot_no = sl.lot_no AND (pi.item_id = sl.item_id OR LOWER(pi.item_name) = LOWER(sl.item_name)) AND pi.rate > 0 LIMIT 1),
          (SELECT s.rate FROM stock s WHERE s.lot_no = sl.lot_no AND (s.item_id = sl.item_id OR LOWER(s.item_name) = LOWER(sl.item_name)) AND s.rate > 0 LIMIT 1),
          0
        ) AS rate,
        COALESCE(
          sm.name,
          sm.print_name,
          (SELECT sm2.name FROM purchase_items pi2 JOIN purchases p2 ON p2.id = pi2.purchase_id LEFT JOIN supplier_master sm2 ON (sm2.id = p2.supplier OR sm2.name = p2.supplier) WHERE pi2.lot_no = sl.lot_no AND sm2.name IS NOT NULL LIMIT 1),
          (SELECT p3.supplier FROM purchase_items pi3 JOIN purchases p3 ON p3.id = pi3.purchase_id WHERE pi3.lot_no = sl.lot_no AND p3.supplier IS NOT NULL LIMIT 1),
          (SELECT sm3.name FROM supplier_master sm3 WHERE sm3.id = p.supplier OR sm3.name = p.supplier LIMIT 1),
          p.supplier,
          '-'
        ) AS supplier_name,
        sl.created_at,
        sl.created_at AS purchase_date,
        COALESCE(
          (SELECT pi.per_unit_weight FROM purchase_items pi WHERE pi.lot_no = sl.lot_no AND (pi.item_id = sl.item_id OR LOWER(pi.item_name) = LOWER(sl.item_name)) AND pi.per_unit_weight > 0 LIMIT 1),
          (SELECT pi.weight FROM purchase_items pi WHERE pi.lot_no = sl.lot_no AND (pi.item_id = sl.item_id OR LOWER(pi.item_name) = LOWER(sl.item_name)) AND pi.weight > 0 LIMIT 1),
          (SELECT go.weight FROM grain_output_items go WHERE go.lot_no = sl.lot_no AND LOWER(go.item_name) = LOWER(sl.item_name) AND go.weight > 0 LIMIT 1),
          (SELECT pk.weight FROM packing_items pk WHERE pk.lot_no = sl.lot_no AND LOWER(pk.item_name) = LOWER(sl.item_name) AND pk.weight > 0 LIMIT 1),
          (SELECT wc.weight FROM weight_conversion_items wc WHERE wc.lot_no = sl.lot_no AND LOWER(wc.item_name) = LOWER(sl.item_name) AND wc.weight > 0 LIMIT 1),
          (SELECT ROUND(ABS(s.weight) / ABS(s.qty), 2) FROM stock s WHERE s.lot_no = sl.lot_no AND (s.item_id = sl.item_id OR LOWER(s.item_name) = LOWER(sl.item_name)) AND s.qty > 0 AND s.weight > 0 LIMIT 1),
          0
        ) AS per_unit_weight
      FROM stock_lots sl
      LEFT JOIN purchases p ON p.id = sl.purchase_id
      LEFT JOIN supplier_master sm ON (sm.id = p.supplier OR sm.name = p.supplier)
      WHERE (
        sl.item_id = ? 
        OR LOWER(sl.item_name) = LOWER(?)
        OR sl.item_name LIKE ?
        OR sl.item_id IN (SELECT id FROM item_master WHERE id = ? OR LOWER(item_name) = LOWER(?))
      )
      AND COALESCE(sl.remaining_quantity, sl.quantity, 0) > 0
      AND (sl.unloading_status IS NULL OR sl.unloading_status != 'RETURNED')
      AND sl.lot_no NOT IN (
        SELECT DISTINCT lot_no FROM purchase_return_items WHERE lot_no IS NOT NULL AND lot_no != ''
      )
      GROUP BY sl.lot_no
      ORDER BY sl.id DESC
    `, [itemId, itemId, `%${itemId}%`, itemId, itemId])

    res.json(result.rows.map(r => {
      const rateVal = parseFloat(r.rate) || 0;
      const wt = parseFloat(r.per_unit_weight) || 0;
      const supplierName = r.supplier_name || '-';
      return {
        id: r.id,
        item_id: r.item_id,
        item_name: r.item_name,
        lot_no: r.lot_no,
        available_qty: r.available_qty,
        remaining_quantity: r.available_qty,
        balance_qty: r.available_qty,
        stock: r.available_qty,
        rate: rateVal,
        purchase_rate: rateVal,
        purc_rate: rateVal,
        supplier_name: supplierName,
        supplier: supplierName,
        created_at: r.created_at,
        purchase_date: r.purchase_date,
        weight: wt,
        per_unit_weight: wt,
        display: `${r.lot_no} | Wt: ${wt} kg | Stock: ${r.available_qty} | Rate: ₹${rateVal} | ${supplierName}`
      };
    }))
  } catch (error) {
    console.error('Error fetching available stock (by item_id):', error)
    res.status(500).json({ message: 'Error fetching available stock', error: error.message })
  }
})

// ============================================================================
// GET AVAILABLE STOCK FOR AN ITEM (legacy by itemName)
// ============================================================================
router.get('/available-item-name/:itemName', async (req, res) => {
  try {
    const { itemName } = req.params
    
    const result = await db.query(`
      SELECT 
        sl.id,
        sl.item_id,
        sl.item_name,
        sl.lot_no,
        sl.remaining_quantity,
        sl.remaining_quantity AS available_qty,
        sl.remaining_quantity AS balance_qty,
        sl.remaining_quantity AS stock,
        sl.quantity,
        COALESCE(
          NULLIF(sl.rate, 0),
          (SELECT pi.rate FROM purchase_items pi WHERE pi.lot_no = sl.lot_no AND (pi.item_id = sl.item_id OR LOWER(pi.item_name) = LOWER(sl.item_name)) AND pi.rate > 0 LIMIT 1),
          (SELECT s.rate FROM stock s WHERE s.lot_no = sl.lot_no AND (s.item_id = sl.item_id OR LOWER(s.item_name) = LOWER(sl.item_name)) AND s.rate > 0 LIMIT 1),
          0
        ) AS rate,
        COALESCE(
          sm.name,
          sm.print_name,
          (SELECT sm2.name FROM purchase_items pi2 JOIN purchases p2 ON p2.id = pi2.purchase_id LEFT JOIN supplier_master sm2 ON (sm2.id = p2.supplier OR sm2.name = p2.supplier) WHERE pi2.lot_no = sl.lot_no AND sm2.name IS NOT NULL LIMIT 1),
          (SELECT p3.supplier FROM purchase_items pi3 JOIN purchases p3 ON p3.id = pi3.purchase_id WHERE pi3.lot_no = sl.lot_no AND p3.supplier IS NOT NULL LIMIT 1),
          (SELECT sm3.name FROM supplier_master sm3 WHERE sm3.id = p.supplier OR sm3.name = p.supplier LIMIT 1),
          p.supplier,
          '-'
        ) AS supplier_name,
        sl.created_at,
        sl.created_at AS purchase_date,
        COALESCE(
          (SELECT pi.per_unit_weight FROM purchase_items pi WHERE pi.lot_no = sl.lot_no AND (pi.item_id = sl.item_id OR LOWER(pi.item_name) = LOWER(sl.item_name)) AND pi.per_unit_weight > 0 LIMIT 1),
          (SELECT pi.weight FROM purchase_items pi WHERE pi.lot_no = sl.lot_no AND (pi.item_id = sl.item_id OR LOWER(pi.item_name) = LOWER(sl.item_name)) AND pi.weight > 0 LIMIT 1),
          (SELECT go.weight FROM grain_output_items go WHERE go.lot_no = sl.lot_no AND LOWER(go.item_name) = LOWER(sl.item_name) AND go.weight > 0 LIMIT 1),
          (SELECT pk.weight FROM packing_items pk WHERE pk.lot_no = sl.lot_no AND LOWER(pk.item_name) = LOWER(sl.item_name) AND pk.weight > 0 LIMIT 1),
          (SELECT wc.weight FROM weight_conversion_items wc WHERE wc.lot_no = sl.lot_no AND LOWER(wc.item_name) = LOWER(sl.item_name) AND wc.weight > 0 LIMIT 1),
          (SELECT ROUND(ABS(s.weight) / ABS(s.qty), 2) FROM stock s WHERE s.lot_no = sl.lot_no AND (s.item_id = sl.item_id OR LOWER(s.item_name) = LOWER(sl.item_name)) AND s.qty > 0 AND s.weight > 0 LIMIT 1),
          0
        ) AS per_unit_weight
      FROM stock_lots sl
      LEFT JOIN purchases p ON p.id = sl.purchase_id
      LEFT JOIN supplier_master sm ON (sm.id = p.supplier OR sm.name = p.supplier)
      WHERE (
        LOWER(sl.item_name) = LOWER(?)
        OR sl.item_name LIKE ?
        OR sl.item_id IN (SELECT id FROM item_master WHERE LOWER(item_name) = LOWER(?) OR item_name LIKE ?)
      )
      AND COALESCE(sl.remaining_quantity, sl.quantity, 0) > 0
      GROUP BY sl.lot_no
      ORDER BY sl.id DESC
    `, [itemName, `%${itemName}%`, itemName, `%${itemName}%`])
    
    res.json(result.rows.map(r => {
      const rateVal = parseFloat(r.rate) || 0;
      const wt = parseFloat(r.per_unit_weight) || 0;
      const supplierName = r.supplier_name || '-';
      return {
        id: r.id,
        item_id: r.item_id,
        item_name: r.item_name,
        lot_no: r.lot_no,
        available_qty: r.remaining_quantity,
        remaining_quantity: r.remaining_quantity,
        balance_qty: r.remaining_quantity,
        stock: r.remaining_quantity,
        rate: rateVal,
        purchase_rate: rateVal,
        purc_rate: rateVal,
        supplier_name: supplierName,
        supplier: supplierName,
        created_at: r.created_at,
        purchase_date: r.purchase_date,
        weight: wt,
        per_unit_weight: wt,
        display: `${r.lot_no} | Wt: ${wt} kg | Stock: ${r.remaining_quantity} | Rate: ₹${rateVal} | ${supplierName}`
      };
    }))
  } catch (error) {
    console.error('Error fetching available stock:', error)
    res.status(500).json({ message: 'Error fetching available stock', error: error.message })
  }
})

// ============================================================================
// GET ITEM STOCK BALANCE (Single item live RM & FG stock breakdown)
// ============================================================================
router.get('/item-balance/:itemName', async (req, res) => {
  try {
    const { itemName } = req.params;
    if (!itemName) {
      return res.json({ success: true, item_name: '', stock_qty: 0, rm_stock_qty: 0, fg_stock_qty: 0, stock_weight: 0, remaining_quantity: 0 });
    }

    // 1. Check stock_lots active balance and separate into RM and FG
    const lotsRes = await db.query(`
      SELECT 
        sl.id,
        sl.item_name,
        sl.lot_no,
        sl.remaining_quantity,
        im.item_group
      FROM stock_lots sl
      LEFT JOIN item_master im ON (sl.item_id = im.id OR LOWER(TRIM(sl.item_name)) = LOWER(TRIM(im.item_name)))
      WHERE (
        LOWER(TRIM(sl.item_name)) = LOWER(TRIM(?))
        OR sl.item_name LIKE ?
        OR sl.item_id IN (SELECT id FROM item_master WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)))
      )
      AND COALESCE(sl.remaining_quantity, 0) > 0
      AND (sl.unloading_status IS NULL OR sl.unloading_status != 'RETURNED')
    `, [itemName, `%${itemName}%`, itemName]);

    let rmStock = 0;
    let fgStock = 0;
    let totalLotsQty = 0;

    for (const lot of (lotsRes.rows || [])) {
      const rem = parseFloat(lot.remaining_quantity) || 0;
      totalLotsQty += rem;
      const cat = await determineLotCategory(db, lot.item_name, lot.item_group, lot.lot_no);
      if (cat === 'RM') {
        rmStock += rem;
      } else if (cat === 'FG') {
        fgStock += rem;
      } else {
        // If not explicitly RM/FG, classify based on lot naming
        const lotLower = (lot.lot_no || '').toLowerCase();
        if (lotLower.startsWith('fg') || lotLower.includes('fg-')) fgStock += rem;
        else rmStock += rem;
      }
    }

    // 2. Check stock ledger balance (sum of all + and - entries)
    const stockRes = await db.query(`
      SELECT 
        COALESCE(SUM(qty), 0) AS total_stock_qty,
        COALESCE(SUM(weight), 0) AS total_stock_weight
      FROM stock
      WHERE (
        LOWER(TRIM(item_name)) = LOWER(TRIM(?))
        OR item_name LIKE ?
      )
    `, [itemName, `%${itemName}%`]);

    const ledgerQty = parseFloat(stockRes.rows[0]?.total_stock_qty) || 0;
    const ledgerWeight = parseFloat(stockRes.rows[0]?.total_stock_weight) || 0;

    // Fallback if lots are 0 but ledger has entries
    if (rmStock === 0 && fgStock === 0 && ledgerQty > 0) {
      const itemMasterCheck = await db.query(`SELECT item_group FROM item_master WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) LIMIT 1`, [itemName]);
      const grp = itemMasterCheck.rows[0]?.item_group || '';
      const defaultCat = await determineLotCategory(db, itemName, grp, null);
      if (defaultCat === 'FG') {
        fgStock = ledgerQty;
      } else {
        rmStock = ledgerQty;
      }
    }

    const finalQty = totalLotsQty > 0 ? totalLotsQty : (ledgerQty > 0 ? ledgerQty : 0);

    res.json({
      success: true,
      item_name: itemName,
      stock_qty: finalQty,
      rm_stock_qty: rmStock,
      fg_stock_qty: fgStock,
      remaining_quantity: finalQty,
      available_qty: finalQty,
      stock_weight: ledgerWeight > 0 ? ledgerWeight : (finalQty * 50),
      lots_count: lotsRes.rows?.length || 0
    });
  } catch (error) {
    console.error('Error fetching item balance:', error);
    res.status(500).json({ success: false, message: 'Error fetching item stock balance', error: error.message });
  }
});

// ============================================================================
// GET ALL STOCK RECORDS (with optional item_name and item_id query filtering)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { item_name, item_id } = req.query;
    let query = `SELECT * FROM stock WHERE 1=1`;
    const params = [];

    if (item_id) {
      query += ` AND (item_id = ? OR item_name = (SELECT item_name FROM item_master WHERE id = ? LIMIT 1))`;
      params.push(item_id, item_id);
    }

    if (item_name) {
      query += ` AND (LOWER(TRIM(item_name)) = LOWER(TRIM(?)) OR item_name LIKE ?)`;
      params.push(item_name, `%${item_name}%`);
    }

    query += ` ORDER BY created_at DESC`;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ message: 'Error fetching stock records', error: error.message });
  }
});

// ============================================================================
// GET STOCK BY ITEM NAME
// ============================================================================
router.get('/item/:itemName', async (req, res) => {
  try {
    const { itemName } = req.params;
    const result = await db.query(`
      SELECT * FROM stock 
      WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) OR item_name LIKE ?
      ORDER BY created_at DESC
    `, [itemName, `%${itemName}%`]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ message: 'Error fetching stock records' });
  }
});

// ============================================================================
// GET LOT-WISE STOCK SUMMARY
// ============================================================================
router.get('/lot-summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        item_name,
        lot_no,
        SUM(qty) as total_qty,
        SUM(weight) as total_weight,
        SUM(amount) as total_amount,
        MIN(date) as first_date,
        MAX(date) as last_date
      FROM stock
      GROUP BY item_name, lot_no
      ORDER BY item_name, lot_no
    `)
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching lot summary:', error)
    res.status(500).json({ message: 'Error fetching lot summary' })
  }
})

// ============================================================================
// POST - ADD STOCK (FOR PURCHASES)
// Auto-generates lot number and creates stock_lots entry
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { item_id, item_name, lot_no, qty, weight, rate, amount, date, type, reference_id } = req.body

    if (!item_name) {
      return res.status(400).json({ message: 'Item name is required' })
    }

    // Auto-generate lot number if not provided
    let finalLotNo = lot_no
    if (!finalLotNo) {
      // Generate lot number: ITEM-YYYYMMDD-SEQ
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const seqResult = await db.query(`
        SELECT COUNT(*) as cnt FROM stock_lots 
        WHERE item_name = ? AND lot_no LIKE ?
      `, [item_name, `%${today}%`])
      const seq = (seqResult.rows[0]?.cnt || 0) + 1
      finalLotNo = `${item_name.substring(0, 3).toUpperCase()}-${today}-${String(seq).padStart(4, '0')}`
    }

    // Insert into stock table
    const result = await db.run(`
      INSERT INTO stock (item_name, lot_no, qty, weight, rate, amount, date, type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [item_name, finalLotNo, qty || 0, weight || 0, rate || 0, amount || 0, date, type || 'Purchase', reference_id])

    // Insert into stock_lots table
    await db.run(`
      INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [item_id, item_name, finalLotNo, reference_id, qty || 0, qty || 0, rate || 0])

    try {
      const stockAlerts = require('./stockAlerts');
      if (stockAlerts && typeof stockAlerts.evaluateStockAlerts === 'function') {
        stockAlerts.evaluateStockAlerts().catch(() => {});
      }
    } catch (e) {}

    res.status(201).json({ 
      message: 'Stock added successfully!', 
      id: result.lastID,
      lot_no: finalLotNo
    })
  } catch (error) {
    console.error('Error adding stock:', error)
    res.status(500).json({ message: 'Error adding stock', error: error.message })
  }
})

// ============================================================================
// POST - DEDUCT STOCK (FOR SALES) - FIFO LOGIC
// ============================================================================
router.post('/deduct', async (req, res) => {
  try {
    const { item_name, qty, weight, amount, date, type, reference_id } = req.body

    if (!item_name || !qty) {
      return res.status(400).json({ message: 'Item name and quantity are required' })
    }

    // Get available lots ordered by FIFO (oldest first)
    const availableLots = await db.query(`
      SELECT * FROM stock_lots 
      WHERE item_name = ? AND remaining_quantity > 0
      ORDER BY created_at ASC
    `, [item_name])

    // Check if total available quantity is enough
    const totalAvailable = availableLots.reduce((sum, lot) => sum + lot.remaining_quantity, 0)
    if (totalAvailable < qty) {
      return res.status(400).json({ 
        message: `Insufficient stock for ${item_name}. Available: ${totalAvailable}, Requested: ${qty}` 
      })
    }

    // Deduct quantity lot by lot (FIFO)
    let remainingToDeduct = qty
    const deductions = []
    
    for (const lot of availableLots) {
      if (remainingToDeduct <= 0) break
      
      const deductFromThis = Math.min(lot.remaining_quantity, remainingToDeduct)
      
      // Update stock_lots remaining quantity
      await db.run(`
        UPDATE stock_lots 
        SET remaining_quantity = remaining_quantity - ?
        WHERE id = ?
      `, [deductFromThis, lot.id])

      // Add negative stock entry for tracking
      await db.run(`
        INSERT INTO stock (item_name, lot_no, qty, weight, rate, amount, date, type, reference_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [item_name, lot.lot_no, -deductFromThis, -(weight || 0) * (deductFromThis / qty), lot.rate, -(amount || 0), date, type || 'Sale', reference_id])

      deductions.push({
        lot_no: lot.lot_no,
        deducted: deductFromThis
      })
      
      remainingToDeduct -= deductFromThis
    }

    try {
      const stockAlerts = require('./stockAlerts');
      if (stockAlerts && typeof stockAlerts.evaluateStockAlerts === 'function') {
        stockAlerts.evaluateStockAlerts().catch(() => {});
      }
    } catch (e) {}

    res.status(201).json({ 
      message: 'Stock deducted successfully (FIFO)!', 
      deductions
    })
  } catch (error) {
    console.error('Error deducting stock:', error)
    res.status(500).json({ message: 'Error deducting stock', error: error.message })
  }
})

// ============================================================================
// PUT - Update stock (legacy - for backwards compatibility)
// ============================================================================
router.put('/deduct', async (req, res) => {
  // Redirect to POST /deduct
  router.post('/deduct', async (req, res) => {
    try {
      const { item_name, lot_no, qty, weight, amount, date, type, reference_id } = req.body

      if (!item_name || !lot_no) {
        return res.status(400).json({ message: 'Item name and Lot No are required' })
      }

      // Check if there's enough stock
      const checkResult = await db.query(`
        SELECT SUM(remaining_quantity) as total_qty
        FROM stock_lots 
        WHERE item_name = ? AND lot_no = ?
      `, [item_name, lot_no])

      const availableQty = checkResult.rows[0]?.total_qty || 0
      if (availableQty < (qty || 0)) {
        return res.status(400).json({ message: `Insufficient stock for lot ${lot_no}. Available: ${availableQty}` })
      }

      // Update remaining quantity
      await db.run(`
        UPDATE stock_lots 
        SET remaining_quantity = remaining_quantity - ?
        WHERE item_name = ? AND lot_no = ?
      `, [qty || 0, item_name, lot_no])

      // Add negative stock entry (deduction)
      await db.run(`
        INSERT INTO stock (item_name, lot_no, qty, weight, rate, amount, date, type, reference_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [item_name, lot_no, -(qty || 0), -(weight || 0), 0, -(amount || 0), date, type || 'Sale', reference_id])

      try {
        const stockAlerts = require('./stockAlerts');
        if (stockAlerts && typeof stockAlerts.evaluateStockAlerts === 'function') {
          stockAlerts.evaluateStockAlerts().catch(() => {});
        }
      } catch (e) {}

      res.status(201).json({ 
        message: 'Stock deducted successfully!', 
      })
    } catch (error) {
      console.error('Error deducting stock:', error)
      res.status(500).json({ message: 'Error deducting stock', error: error.message })
    }
  })
})

// ============================================================================
// DELETE - Remove stock record
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM stock WHERE id = ?', [req.params.id])
    try {
      const stockAlerts = require('./stockAlerts');
      if (stockAlerts && typeof stockAlerts.evaluateStockAlerts === 'function') {
        stockAlerts.evaluateStockAlerts().catch(() => {});
      }
    } catch (e) {}
    res.json({ message: 'Stock record deleted successfully' })
  } catch (error) {
    console.error('Error deleting stock:', error)
    res.status(500).json({ message: 'Error deleting stock record' })
  }
})

module.exports = router
