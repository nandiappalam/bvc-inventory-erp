const db = require('../config/database');

/**
 * rebuildStockLedger
 * Synchronizes the `stock` ledger table and `stock_lots` table with source transactions across all modules.
 * This ensures exact real-time accuracy for Stock Status, Lot Breakdown, Godown Stock Reports,
 * Grind, Sales, Transfers, and Returns.
 */
async function rebuildStockLedger() {
  try {
    // 1. Clear stock_lots and non-Opening stock entries
    await db.run(`DELETE FROM stock_lots`);
    await db.run(`DELETE FROM stock WHERE type NOT IN ('Opening Stock', 'Open Stock', 'Opening') OR type IS NULL`);

    // 2. Fetch all inflow transactions
    // A. Purchases
    const purchases = await db.query(`
      SELECT pi.*, p.date, p.supplier, p.id as purchase_id, p.godown as godown_id
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      ORDER BY p.date ASC, pi.id ASC
    `);

    // B. Grain Outputs (Finished Goods)
    const grainOutputs = await db.query(`
      SELECT go.*, g.date, g.id as grain_id
      FROM grain_output_items go
      JOIN grains g ON go.grain_id = g.id
      ORDER BY g.date ASC, go.id ASC
    `);

    // C. Grain Wastages
    const grainWastages = await db.query(`
      SELECT gw.*, g.date, g.id as grain_id
      FROM grain_wastage_items gw
      JOIN grains g ON gw.grain_id = g.id
      ORDER BY g.date ASC, gw.id ASC
    `);

    // D. Papad In Outputs
    let papadIns = { rows: [] };
    try {
      papadIns = await db.query(`
        SELECT pii.*, pi.date, pi.id as papad_in_id
        FROM papad_in_items pii
        JOIN papad_in pi ON pii.papad_in_id = pi.id
        ORDER BY pi.date ASC, pii.id ASC
      `);
    } catch (e) {}

    // E. Packing Outputs (section:to)
    let packingOutputs = { rows: [] };
    try {
      packingOutputs = await db.query(`
        SELECT pi.*, p.date, p.id as packing_id
        FROM packing_items pi
        JOIN packing p ON pi.packing_id = p.id
        WHERE pi.remarks = 'section:to' OR pi.section = 'to'
        ORDER BY p.date ASC, pi.id ASC
      `);
    } catch (e) {}

    // F. Flour Out Outputs (section:to)
    let flourOutputs = { rows: [] };
    try {
      flourOutputs = await db.query(`
        SELECT foi.*, fo.date, fo.id as flour_out_id
        FROM flour_out_items foi
        JOIN flour_out fo ON foi.flour_out_id = fo.id
        WHERE foi.remarks = 'section:to' OR foi.section = 'to'
        ORDER BY fo.date ASC, foi.id ASC
      `);
    } catch (e) {}

    // G. Sales Returns
    let salesReturns = { rows: [] };
    try {
      salesReturns = await db.query(`
        SELECT sri.*, sr.date, sr.id as sales_return_id
        FROM sales_return_items sri
        JOIN sales_returns sr ON sri.sales_return_id = sr.id
        ORDER BY sr.date ASC, sri.id ASC
      `);
    } catch (e) {}

    // Map of lots: key = UPPER(itemName):::UPPER(lotNo)
    const lotMap = new Map();

    function getOrCreateLot(itemName, lotNo, initialQty, rate, date, type, refId, godownId = null) {
      if (!itemName || !String(itemName).trim()) return null;
      const normName = String(itemName).trim();
      const normLot = (lotNo || '').trim();
      const key = `${normName.toUpperCase()}:::${normLot.toUpperCase()}`;
      if (!lotMap.has(key)) {
        lotMap.set(key, {
          item_name: normName,
          lot_no: normLot,
          purchased_qty: parseFloat(initialQty) || 0,
          remaining_quantity: parseFloat(initialQty) || 0,
          rate: parseFloat(rate) || 0,
          date: date,
          type: type,
          refId: refId,
          godownId: godownId
        });
      } else {
        const lot = lotMap.get(key);
        lot.purchased_qty += parseFloat(initialQty) || 0;
        lot.remaining_quantity += parseFloat(initialQty) || 0;
        if (rate > 0) lot.rate = parseFloat(rate);
        if (godownId) lot.godownId = godownId;
      }
      return lotMap.get(key);
    }

    // Process Purchases
    for (const row of purchases.rows) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.qty) || 0;
      const wt = parseFloat(row.total_wt || row.total_weight) || (qty * (parseFloat(row.weight) || 50));
      
      let godownId = 3;
      let godownName = 'Raw Material Godown';
      if (row.godown_id) {
        const gRes = await db.query(`SELECT id, godown_name FROM godown_master WHERE id = ? OR CAST(id AS TEXT) = ? OR LOWER(godown_name) = LOWER(?) LIMIT 1`, [row.godown_id, String(row.godown_id), String(row.godown_id)]);
        if (gRes.rows && gRes.rows.length > 0) {
          godownId = gRes.rows[0].id;
          godownName = gRes.rows[0].godown_name;
        }
      }

      getOrCreateLot(row.item_name, row.lot_no, qty, row.rate, row.date, 'Purchase', row.purchase_id, godownId);
      await db.run(`
        INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Purchase', ?, ?, ?)
      `, [row.date, row.item_id || null, row.item_name, row.lot_no || '', qty, wt, row.rate || 0, row.total_amt || 0, row.purchase_id, godownName, godownId]);
    }

    // Process Grain Outputs
    for (const row of grainOutputs.rows) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.qty) || 0;
      const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 50));
      const godownId = 4;
      const godownName = 'Finished Goods Godown';
      getOrCreateLot(row.item_name, row.lot_no, qty, 0, row.date, 'Grind Output', row.grain_id, godownId);
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, 0, 0, 'Grind Output', ?, ?, ?)
      `, [row.date, row.item_name, row.lot_no || '', qty, wt, row.grain_id, godownName, godownId]);
    }

    // Process Grain Wastages
    for (const row of grainWastages.rows) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.qty) || 0;
      const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 50));
      const godownId = 1;
      const godownName = 'Main Godown';
      getOrCreateLot(row.item_name, row.lot_no, qty, 0, row.date, 'Grind Wastage', row.grain_id, godownId);
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, 0, 0, 'Grind Wastage', ?, ?, ?)
      `, [row.date, row.item_name, row.lot_no || '', qty, wt, row.grain_id, godownName, godownId]);
    }

    // Process Papad In Outputs
    for (const row of papadIns.rows) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.qty) || 0;
      const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 1));
      const godownId = 4;
      const godownName = 'Finished Goods Godown';
      getOrCreateLot(row.item_name, row.lot_no, qty, row.rate || 0, row.date, 'Papad In', row.papad_in_id, godownId);
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Papad In', ?, ?, ?)
      `, [row.date, row.item_name, row.lot_no || '', qty, wt, row.rate || 0, row.total_amt || 0, row.papad_in_id, godownName, godownId]);
    }

    // Process Packing Outputs
    for (const row of packingOutputs.rows) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.qty) || 0;
      const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 1));
      const godownId = 4;
      const godownName = 'Finished Goods Godown';
      getOrCreateLot(row.item_name, row.lot_no, qty, row.rate || 0, row.date, 'Packing Output', row.packing_id, godownId);
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Packing Output', ?, ?, ?)
      `, [row.date, row.item_name, row.lot_no || '', qty, wt, row.rate || 0, row.total_amt || 0, row.packing_id, godownName, godownId]);
    }

    // Process Flour Outputs
    for (const row of flourOutputs.rows) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.qty) || 0;
      const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 1));
      const godownId = 4;
      const godownName = 'Finished Goods Godown';
      getOrCreateLot(row.item_name, row.lot_no, qty, row.rate || 0, row.date, 'Flour Output', row.flour_out_id, godownId);
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Flour Output', ?, ?, ?)
      `, [row.date, row.item_name, row.lot_no || '', qty, wt, row.rate || 0, row.total_amt || 0, row.flour_out_id, godownName, godownId]);
    }

    // Process Sales Returns (Inflows)
    for (const row of salesReturns.rows) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.qty) || 0;
      const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 1));
      getOrCreateLot(row.item_name, row.lot_no, qty, row.rate || 0, row.date, 'Sales Return', row.sales_return_id);
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Sales Return', ?)
      `, [row.date, row.item_name, row.lot_no || '', qty, wt, row.rate || 0, row.total_amt || 0, row.sales_return_id]);
    }

    // 3. Process Outflow Transactions
    async function resolveOutflowGodown(itemName, lotNo, defaultGodownId = 3, defaultGodownName = 'Raw Material Godown') {
      const key = `${(itemName || '').trim().toUpperCase()}:::${(lotNo || '').trim().toUpperCase()}`;
      let gId = defaultGodownId;
      let gName = defaultGodownName;

      if (lotMap.has(key)) {
        const lot = lotMap.get(key);
        if (lot.godownId) {
          gId = lot.godownId;
        }
      }

      if (gId) {
        try {
          const gRes = await db.query(`SELECT id, godown_name FROM godown_master WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1`, [gId, String(gId)]);
          if (gRes.rows && gRes.rows.length > 0) {
            gName = gRes.rows[0].godown_name;
          }
        } catch (e) {}
      }

      return { godownId: gId, godownName: gName };
    }

    // A. Grain Inputs (RM Consumed)
    const grainInputs = await db.query(`
      SELECT gi.*, g.date, g.id as grain_id
      FROM grain_input_items gi
      JOIN grains g ON gi.grain_id = g.id
      ORDER BY g.date ASC, gi.id ASC
    `);

    for (const row of grainInputs.rows) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.qty) || 0;
      const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 50));
      const key = `${row.item_name.trim().toUpperCase()}:::${(row.lot_no || '').trim().toUpperCase()}`;
      if (lotMap.has(key)) {
        const lot = lotMap.get(key);
        lot.remaining_quantity = Math.max(0, lot.remaining_quantity - qty);
      }
      const { godownId, godownName } = await resolveOutflowGodown(row.item_name, row.lot_no, 3, 'Raw Material Godown');
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Grind Input', ?, ?, ?)
      `, [row.date, row.item_name, row.lot_no || '', -qty, -wt, row.rate || 0, -(row.total_wages || 0), row.grain_id, godownName, godownId]);
    }

    // B. Sales (Outflows)
    const salesItems = await db.query(`
      SELECT si.*, s.date, s.id as sales_id
      FROM sales_items si
      JOIN sales s ON si.sales_id = s.id
      ORDER BY s.date ASC, si.id ASC
    `);

    for (const row of salesItems.rows) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.qty) || 0;
      const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 50));
      const key = `${row.item_name.trim().toUpperCase()}:::${(row.lot_no || '').trim().toUpperCase()}`;
      if (lotMap.has(key)) {
        const lot = lotMap.get(key);
        lot.remaining_quantity = Math.max(0, lot.remaining_quantity - qty);
      }
      const { godownId, godownName } = await resolveOutflowGodown(row.item_name, row.lot_no, 4, 'Finished Goods Godown');
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Sale', ?, ?, ?)
      `, [row.date, row.item_name, row.lot_no || '', -qty, -wt, row.rate || 0, -(row.total_amt || 0), row.sales_id, godownName, godownId]);
    }

    // C. Packing Inputs
    try {
      const packingInputs = await db.query(`
        SELECT pi.*, p.date, p.id as packing_id
        FROM packing_items pi
        JOIN packing p ON pi.packing_id = p.id
        WHERE pi.remarks = 'section:from' OR pi.section = 'from'
        ORDER BY p.date ASC, pi.id ASC
      `);
      for (const row of packingInputs.rows) {
        if (!row.item_name) continue;
        const qty = parseFloat(row.qty) || 0;
        const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 1));
        const key = `${row.item_name.trim().toUpperCase()}:::${(row.lot_no || '').trim().toUpperCase()}`;
        if (lotMap.has(key)) {
          const lot = lotMap.get(key);
          lot.remaining_quantity = Math.max(0, lot.remaining_quantity - qty);
        }
        const { godownId, godownName } = await resolveOutflowGodown(row.item_name, row.lot_no, 4, 'Finished Goods Godown');
        await db.run(`
          INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Packing Input', ?, ?, ?)
        `, [row.date, row.item_name, row.lot_no || '', -qty, -wt, row.rate || 0, -(row.total_amt || 0), row.packing_id, godownName, godownId]);
      }
    } catch (e) {}

    // D. Flour Out Inputs
    try {
      const flourInputs = await db.query(`
        SELECT foi.*, fo.date, fo.id as flour_out_id
        FROM flour_out_items foi
        JOIN flour_out fo ON foi.flour_out_id = fo.id
        WHERE foi.remarks = 'section:from' OR foi.section = 'from'
        ORDER BY fo.date ASC, foi.id ASC
      `);
      for (const row of flourInputs.rows) {
        if (!row.item_name) continue;
        const qty = parseFloat(row.qty) || 0;
        const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 1));
        const key = `${row.item_name.trim().toUpperCase()}:::${(row.lot_no || '').trim().toUpperCase()}`;
        if (lotMap.has(key)) {
          const lot = lotMap.get(key);
          lot.remaining_quantity = Math.max(0, lot.remaining_quantity - qty);
        }
        const { godownId, godownName } = await resolveOutflowGodown(row.item_name, row.lot_no, 4, 'Finished Goods Godown');
        await db.run(`
          INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Flour Input', ?, ?, ?)
        `, [row.date, row.item_name, row.lot_no || '', -qty, -wt, row.rate || 0, -(row.total_amt || 0), row.flour_out_id, godownName, godownId]);
      }
    } catch (e) {}

    // E. Purchase Returns
    try {
      const purchaseReturns = await db.query(`
        SELECT pri.*, pr.date, pr.id as purchase_return_id
        FROM purchase_return_items pri
        JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
        ORDER BY pr.date ASC, pri.id ASC
      `);
      for (const row of purchaseReturns.rows) {
        if (!row.item_name) continue;
        const qty = parseFloat(row.qty) || 0;
        const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 1));
        const key = `${row.item_name.trim().toUpperCase()}:::${(row.lot_no || '').trim().toUpperCase()}`;
        if (lotMap.has(key)) {
          const lot = lotMap.get(key);
          lot.remaining_quantity = Math.max(0, lot.remaining_quantity - qty);
        }
        const { godownId, godownName } = await resolveOutflowGodown(row.item_name, row.lot_no, 3, 'Raw Material Godown');
        await db.run(`
          INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Purchase Return', ?, ?, ?)
        `, [row.date, row.item_name, row.lot_no || '', -qty, -wt, row.rate || 0, -(row.total_amt || 0), row.purchase_return_id, godownName, godownId]);
      }
    } catch (e) {}

    // 4. Save normalized lotMap into `stock_lots` table
    for (const [key, lot] of lotMap.entries()) {
      let itemId = null;
      const im = await db.query(`SELECT id FROM item_master WHERE UPPER(TRIM(item_name)) = UPPER(TRIM(?))`, [lot.item_name]);
      if (im.rows.length > 0) itemId = im.rows[0].id;

      await db.run(`
        INSERT INTO stock_lots (godown_id, item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate, qc_status, usable_for_production, approval_status, unloading_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACCEPTED', 1, 'APPROVED', 'UNLOADED')
      `, [lot.godownId || null, itemId, lot.item_name, lot.lot_no, lot.refId || null, lot.purchased_qty, lot.remaining_quantity, lot.rate]);
    }

    console.log(`✓ rebuildStockLedger successfully re-synchronized ${lotMap.size} stock lots & ledger entries.`);
    
    // Automatically trigger live stock alert evaluation
    try {
      const stockAlertsModule = require('../routes/stockAlerts');
      if (stockAlertsModule && typeof stockAlertsModule.evaluateStockAlerts === 'function') {
        stockAlertsModule.evaluateStockAlerts().catch(err => {
          console.log('Notice in auto stock alert evaluation:', err.message);
        });
      }
    } catch (alertErr) {
      console.log('Notice triggering stock alert evaluation from rebuilder:', alertErr.message);
    }
  } catch (err) {
    console.error('Error in rebuildStockLedger:', err);
  }
}

module.exports = rebuildStockLedger;
module.exports.rebuildStockLedger = rebuildStockLedger;
