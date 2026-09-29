const db = require('../config/database');

/**
 * rebuildStockLedger
 * Synchronizes the `stock` ledger table and `stock_lots` table with source transactions across all modules.
 * This ensures exact real-time accuracy for Stock Status, Lot Breakdown, Godown Stock Reports,
 * Grind, Sales, Transfers, and Returns.
 */
async function rebuildStockLedger() {
  try {
    // Fetch master godowns for dynamic location mapping
    const gmAll = await db.query(`SELECT id, godown_name, godown_type, storage_location FROM godown_master ORDER BY id ASC`);
    const godownRows = gmAll.rows || [];
    
    // Determine default primary inside-factory godown from godown_master
    let defaultGodown = godownRows.find(g => (g.godown_type || '').toLowerCase() === 'normal' || (g.storage_location || '').toLowerCase() === 'inside factory') || godownRows[0] || { id: 1, godown_name: 'PJ' };

    // Determine finished goods godown if exists, else defaultGodown
    let fgGodown = godownRows.find(g => (g.godown_name || '').toLowerCase().includes('finish') || (g.godown_name || '').toLowerCase().includes('fg')) || defaultGodown;

    // Determine raw materials godown if exists, else defaultGodown
    let rmGodown = godownRows.find(g => (g.godown_name || '').toLowerCase().includes('raw') || (g.godown_name || '').toLowerCase().includes('rm')) || defaultGodown;

    // Determine cold storage godown if exists
    let csGodown = godownRows.find(g => (g.godown_type || '').toLowerCase().includes('cold') || (g.godown_name || '').toLowerCase().includes('cold')) || null;

    // 1. Clear stock_lots and non-Opening stock entries
    await db.run(`DELETE FROM stock_lots`);
    await db.run(`DELETE FROM stock WHERE type NOT IN ('Opening Stock', 'Open Stock', 'Opening') OR type IS NULL`);

    // Synchronize existing Opening Stock entries to real master godown
    await db.run(`
      UPDATE stock 
      SET godown = ?, godown_id = ?
      WHERE (type IN ('Opening Stock', 'Open Stock', 'Opening'))
        AND (godown IS NULL OR godown = '' OR godown = 'Main Godown' OR godown_id IS NULL OR godown_id NOT IN (SELECT id FROM godown_master))
    `, [defaultGodown.godown_name, defaultGodown.id]);

    // 2. Fetch all inflow transactions
    // A0. Opening Stock
    let openStock = { rows: [] };
    try {
      openStock = await db.query(`
        SELECT oi.*, o.date, o.id as open_id
        FROM open_items oi
        JOIN open o ON oi.open_id = o.id
        ORDER BY o.date ASC, oi.id ASC
      `);
    } catch (e) {}

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

    // H. Cold Storage IN (Inflow into Cold Storage Facility)
    let coldStorageIns = { rows: [] };
    try {
      coldStorageIns = await db.query(`
        SELECT csi.*, csv.voucher_date as date, csv.id as voucher_id, csv.cold_storage_id, csv.cold_storage_name, csv.source_godown_id, csv.source_godown_name
        FROM cold_storage_items csi
        JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
        WHERE csv.voucher_type = 'IN'
        ORDER BY csv.voucher_date ASC, csi.id ASC
      `);
    } catch (e) {}

    // I. Cold Storage OUT (Return / Inflow into Destination Godown)
    let coldStorageOuts = { rows: [] };
    try {
      coldStorageOuts = await db.query(`
        SELECT csi.*, csv.voucher_date as date, csv.id as voucher_id, csv.cold_storage_id, csv.cold_storage_name, csv.destination_godown_id, csv.destination_godown_name
        FROM cold_storage_items csi
        JOIN cold_storage_vouchers csv ON csi.voucher_id = csv.id
        WHERE csv.voucher_type = 'OUT'
        ORDER BY csv.voucher_date ASC, csi.id ASC
      `);
    } catch (e) {}

    // J. Weight Conversion Outputs (Finished/Yielded items)
    let wcOutputs = { rows: [] };
    try {
      wcOutputs = await db.query(`
        SELECT wci.*, wc.date, wc.id as conversion_id
        FROM weight_conversion_items wci
        JOIN weight_conversion wc ON CAST(wci.weight_conversion_id AS TEXT) = CAST(wc.id AS TEXT)
        WHERE LOWER(wci.type) = 'output'
        ORDER BY wc.date ASC, wci.id ASC
      `);
    } catch (e) {}

    // K. Weight Conversion Inputs (Consumed items)
    let wcInputs = { rows: [] };
    try {
      wcInputs = await db.query(`
        SELECT wci.*, wc.date, wc.id as conversion_id
        FROM weight_conversion_items wci
        JOIN weight_conversion wc ON CAST(wci.weight_conversion_id AS TEXT) = CAST(wc.id AS TEXT)
        WHERE LOWER(wci.type) = 'input'
        ORDER BY wc.date ASC, wci.id ASC
      `);
    } catch (e) {}

    // L. Stock Adjustments
    let stockAdjustments = { rows: [] };
    try {
      stockAdjustments = await db.query(`
        SELECT sai.*, sa.date, sa.id as adjustment_id, sa.type as adjustment_type
        FROM stock_adjustment_items sai
        JOIN stock_adjustments sa ON sai.stock_adjustment_id = sa.id
        ORDER BY sa.date ASC, sai.id ASC
      `);
    } catch (e) {}

    // M. Item Transfers & Godown Transfers
    let itemTransfers = { rows: [] };
    try {
      const trf1 = await db.query(`SELECT id, transfer_no, date, from_godown_id, from_godown_name, to_godown_id, to_godown_name, item_name, lot_no, transfer_qty, weight, rate, amount FROM item_transfers ORDER BY date ASC, id ASC`);
      if (trf1.rows && trf1.rows.length > 0) {
        itemTransfers = trf1;
      } else {
        const trf2 = await db.query(`SELECT id, s_no as transfer_no, transfer_date as date, from_godown_id, from_godown_name, to_godown_id, to_godown_name, item_name, lot_no, qty as transfer_qty, weight, 0 as rate, 0 as amount FROM godown_transfers ORDER BY transfer_date ASC, id ASC`);
        itemTransfers = trf2;
      }
    } catch (e) {}

    // Map of lots: key = UPPER(itemName):::UPPER(lotNo):::godownId
    const lotMap = new Map();

    function getOrCreateLot(itemName, lotNo, initialQty, rate, date, type, refId, godownId = null, godownName = null) {
      if (!itemName || !String(itemName).trim()) return null;
      const normName = String(itemName).trim();
      const normLot = (lotNo || '').trim();
      const targetGId = godownId || defaultGodown.id;
      const targetGName = godownName || defaultGodown.godown_name;
      const key = `${normName.toUpperCase()}:::${normLot.toUpperCase()}:::${targetGId}`;

      if (!lotMap.has(key)) {
        lotMap.set(key, {
          item_name: normName,
          lot_no: normLot,
          purchased_qty: parseFloat(initialQty) || 0,
          remaining_quantity: parseFloat(initialQty) || 0,
          returned_qty: 0,
          consumed_qty: 0,
          sold_qty: 0,
          rate: parseFloat(rate) || 0,
          date: date,
          type: type,
          refId: refId,
          godownId: targetGId,
          godownName: targetGName
        });
      } else {
        const lot = lotMap.get(key);
        lot.purchased_qty += parseFloat(initialQty) || 0;
        lot.remaining_quantity += parseFloat(initialQty) || 0;
        if (rate > 0) lot.rate = parseFloat(rate);
      }
      return lotMap.get(key);
    }

    function deductFromLot(itemName, lotNo, qty, targetGodownId = null, fieldName = 'consumed_qty') {
      if (!itemName) return null;
      const normName = String(itemName).trim().toUpperCase();
      const normLot = (lotNo || '').trim().toUpperCase();

      if (targetGodownId) {
        const exactKey = `${normName}:::${normLot}:::${targetGodownId}`;
        if (lotMap.has(exactKey)) {
          const lot = lotMap.get(exactKey);
          lot.remaining_quantity = Math.max(0, lot.remaining_quantity - qty);
          lot[fieldName] = (lot[fieldName] || 0) + qty;
          return lot;
        }
      }

      // Fallback search across godown locations for this lot
      for (const [key, lot] of lotMap.entries()) {
        if (lot.item_name.toUpperCase() === normName && lot.lot_no.toUpperCase() === normLot) {
          if (lot.remaining_quantity > 0 || !targetGodownId) {
            lot.remaining_quantity = Math.max(0, lot.remaining_quantity - qty);
            lot[fieldName] = (lot[fieldName] || 0) + qty;
            return lot;
          }
        }
      }
      return null;
    }

    // Process Opening Stock
    for (const row of (openStock.rows || [])) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.qty) || 0;
      getOrCreateLot(row.item_name, row.lot_no, qty, row.rate || 0, row.date, 'Opening Stock', row.open_id, defaultGodown.id, defaultGodown.godown_name);
    }

    // Process Purchases
    for (const row of purchases.rows) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.qty) || 0;
      const wt = parseFloat(row.total_wt || row.total_weight) || (qty * (parseFloat(row.weight) || 50));
      
      let godownId = rmGodown.id;
      let godownName = rmGodown.godown_name;
      if (row.godown_id) {
        const gRes = await db.query(`SELECT id, godown_name FROM godown_master WHERE id = ? OR CAST(id AS TEXT) = ? OR LOWER(godown_name) = LOWER(?) LIMIT 1`, [row.godown_id, String(row.godown_id), String(row.godown_id)]);
        if (gRes.rows && gRes.rows.length > 0) {
          godownId = gRes.rows[0].id;
          godownName = gRes.rows[0].godown_name;
        }
      }

      getOrCreateLot(row.item_name, row.lot_no, qty, row.rate, row.date, 'Purchase', row.purchase_id, godownId, godownName);
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
      const godownId = fgGodown.id;
      const godownName = fgGodown.godown_name;
      getOrCreateLot(row.item_name, row.lot_no, qty, 0, row.date, 'Grind Output', row.grain_id, godownId, godownName);
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
      const godownId = defaultGodown.id;
      const godownName = defaultGodown.godown_name;
      getOrCreateLot(row.item_name, row.lot_no, qty, 0, row.date, 'Grind Wastage', row.grain_id, godownId, godownName);
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
      const godownId = fgGodown.id;
      const godownName = fgGodown.godown_name;
      getOrCreateLot(row.item_name, row.lot_no, qty, row.rate || 0, row.date, 'Papad In', row.papad_in_id, godownId, godownName);
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
      const godownId = fgGodown.id;
      const godownName = fgGodown.godown_name;
      getOrCreateLot(row.item_name, row.lot_no, qty, row.rate || 0, row.date, 'Packing Output', row.packing_id, godownId, godownName);
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
      const godownId = fgGodown.id;
      const godownName = fgGodown.godown_name;
      getOrCreateLot(row.item_name, row.lot_no, qty, row.rate || 0, row.date, 'Flour Output', row.flour_out_id, godownId, godownName);
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
      const godownId = fgGodown.id;
      const godownName = fgGodown.godown_name;
      getOrCreateLot(row.item_name, row.lot_no, qty, row.rate || 0, row.date, 'Sales Return', row.sales_return_id, godownId, godownName);
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Sales Return', ?, ?, ?)
      `, [row.date, row.item_name, row.lot_no || '', qty, wt, row.rate || 0, row.total_amt || 0, row.sales_return_id, godownName, godownId]);
    }

    // Process Cold Storage IN (Inflow to Cold Storage)
    for (const row of coldStorageIns.rows) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.quantity) || 0;
      const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 1));
      let godownId = row.cold_storage_id || (csGodown ? csGodown.id : null);
      let godownName = row.cold_storage_name || (csGodown ? csGodown.godown_name : 'Cold Storage');
      if (godownId) {
        const gRes = await db.query(`SELECT id, godown_name FROM godown_master WHERE id = ? OR CAST(id AS TEXT) = ? OR LOWER(godown_name) = LOWER(?) LIMIT 1`, [godownId, String(godownId), String(godownName)]);
        if (gRes.rows && gRes.rows.length > 0) {
          godownId = gRes.rows[0].id;
          godownName = gRes.rows[0].godown_name;
        }
      }
      const lotNo = row.purchase_lot_no || row.cold_storage_lot_no || 'LOT-TRANSFER';
      getOrCreateLot(row.item_name, lotNo, qty, 0, row.date, 'Cold Storage In', row.voucher_id, godownId, godownName);
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id, remarks)
        VALUES (?, ?, ?, ?, ?, 0, 0, 'Cold Storage In', ?, ?, ?, ?)
      `, [row.date, row.item_name, lotNo, qty, wt, row.voucher_id, godownName, godownId, `Received in ${godownName} (CS Lot: ${row.cold_storage_lot_no || ''})`]);

      // Deduct from source purchase lot
      if (row.purchase_lot_no) {
        let srcGodownId = row.source_godown_id;
        if (!srcGodownId) {
          const resolved = await resolveOutflowGodown(row.item_name, row.purchase_lot_no, defaultGodown.id, defaultGodown.godown_name);
          srcGodownId = resolved.godownId;
        }
        deductFromLot(row.item_name, row.purchase_lot_no, qty, srcGodownId);

        let srcGodownName = row.source_godown_name;
        if (!srcGodownName || srcGodownName === 'Main Godown') {
          const resolved = await resolveOutflowGodown(row.item_name, row.purchase_lot_no, defaultGodown.id, defaultGodown.godown_name);
          srcGodownName = resolved.godownName;
        } else if (!srcGodownId) {
          const gRes = await db.query(`SELECT id, godown_name FROM godown_master WHERE LOWER(godown_name) = LOWER(?) LIMIT 1`, [srcGodownName]);
          if (gRes.rows && gRes.rows.length > 0) {
            srcGodownId = gRes.rows[0].id;
            srcGodownName = gRes.rows[0].godown_name;
          } else {
            srcGodownId = defaultGodown.id;
            srcGodownName = defaultGodown.godown_name;
          }
        }
        await db.run(`
          INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id, remarks)
          VALUES (?, ?, ?, ?, ?, 0, 0, 'Cold Storage Transfer Out', ?, ?, ?, ?)
        `, [row.date, row.item_name, row.purchase_lot_no, -qty, -wt, row.voucher_id, srcGodownName, srcGodownId, `Transferred to ${godownName} (CS Lot: ${row.cold_storage_lot_no || ''})`]);
      }
    }

    // Process Cold Storage OUT (Return / Inflow into Destination Godown)
    for (const row of coldStorageOuts.rows) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.quantity) || 0;
      const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 1));
      let destGodownId = row.destination_godown_id || defaultGodown.id;
      let destGodownName = row.destination_godown_name || defaultGodown.godown_name;
      const gDestRes = await db.query(`SELECT id, godown_name FROM godown_master WHERE id = ? OR CAST(id AS TEXT) = ? OR LOWER(godown_name) = LOWER(?) LIMIT 1`, [destGodownId, String(destGodownId), String(destGodownName)]);
      if (gDestRes.rows && gDestRes.rows.length > 0) {
        destGodownId = gDestRes.rows[0].id;
        destGodownName = gDestRes.rows[0].godown_name;
      } else {
        destGodownId = defaultGodown.id;
        destGodownName = defaultGodown.godown_name;
      }

      const destLotNo = row.purchase_lot_no || row.cold_storage_lot_no;
      getOrCreateLot(row.item_name, destLotNo, qty, 0, row.date, 'Cold Storage Transfer In', row.voucher_id, destGodownId, destGodownName);
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id, remarks)
        VALUES (?, ?, ?, ?, ?, 0, 0, 'Cold Storage Transfer In', ?, ?, ?, ?)
      `, [row.date, row.item_name, destLotNo, qty, wt, row.voucher_id, destGodownName, destGodownId, `Received from Cold Storage: ${row.cold_storage_name || 'Cold Storage'}`]);

      // Deduct from Cold Storage lot
      let csGodownId = row.cold_storage_id || (csGodown ? csGodown.id : null);
      let csGodownName = row.cold_storage_name || (csGodown ? csGodown.godown_name : 'Cold Storage');
      if (csGodownId) {
        const gRes = await db.query(`SELECT id, godown_name FROM godown_master WHERE id = ? OR CAST(id AS TEXT) = ? OR LOWER(godown_name) = LOWER(?) LIMIT 1`, [csGodownId, String(csGodownId), String(csGodownName)]);
        if (gRes.rows && gRes.rows.length > 0) {
          csGodownId = gRes.rows[0].id;
          csGodownName = gRes.rows[0].godown_name;
        }
      } else if (csGodownName) {
        const gRes = await db.query(`SELECT id, godown_name FROM godown_master WHERE LOWER(godown_name) = LOWER(?) OR LOWER(godown_name) LIKE ? LIMIT 1`, [csGodownName.toLowerCase(), `%${csGodownName.toLowerCase()}%`]);
        if (gRes.rows && gRes.rows.length > 0) {
          csGodownId = gRes.rows[0].id;
          csGodownName = gRes.rows[0].godown_name;
        }
      }
      deductFromLot(row.item_name, destLotNo, qty, csGodownId);
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id, remarks)
        VALUES (?, ?, ?, ?, ?, 0, 0, 'Cold Storage Transfer Out', ?, ?, ?, ?)
      `, [row.date, row.item_name, destLotNo, -qty, -wt, row.voucher_id, csGodownName, csGodownId, `Transferred to ${destGodownName}`]);
    }

    // Process Weight Conversion Outputs (New Lot or Yielded Items)
    for (const row of (wcOutputs.rows || [])) {
      if (!row.item_name) continue;
      const qty = parseFloat(row.qty) || 0;
      const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 1));
      const godownId = defaultGodown.id;
      const godownName = defaultGodown.godown_name;
      const lotNo = row.lot_no || `LOT_WC_${row.conversion_id}`;
      getOrCreateLot(row.item_name, lotNo, qty, 0, row.date, 'Weight Conversion Output', row.conversion_id, godownId, godownName);
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
        VALUES (?, ?, ?, ?, ?, 0, 0, 'Weight Conversion Output', ?, ?, ?)
      `, [row.date, row.item_name, lotNo, qty, wt, row.conversion_id, godownName, godownId]);
    }

    // 3. Process Outflow Transactions
    async function resolveOutflowGodown(itemName, lotNo, defaultGodownId = defaultGodown.id, defaultGodownName = defaultGodown.godown_name) {
      const key = `${(itemName || '').trim().toUpperCase()}:::${(lotNo || '').trim().toUpperCase()}`;
      let gId = defaultGodownId;
      let gName = defaultGodownName;

      if (lotMap.has(key)) {
        const lot = lotMap.get(key);
        if (lot.godownId) {
          gId = lot.godownId;
        }
        if (lot.godownName) {
          gName = lot.godownName;
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
      const { godownId, godownName } = await resolveOutflowGodown(row.item_name, row.lot_no, rmGodown.id, rmGodown.godown_name);
      deductFromLot(row.item_name, row.lot_no, qty, godownId, 'consumed_qty');
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
      const { godownId, godownName } = await resolveOutflowGodown(row.item_name, row.lot_no, fgGodown.id, fgGodown.godown_name);
      deductFromLot(row.item_name, row.lot_no, qty, godownId, 'sold_qty');
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
        const { godownId, godownName } = await resolveOutflowGodown(row.item_name, row.lot_no, fgGodown.id, fgGodown.godown_name);
        deductFromLot(row.item_name, row.lot_no, qty, godownId, 'consumed_qty');
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
        const { godownId, godownName } = await resolveOutflowGodown(row.item_name, row.lot_no, fgGodown.id, fgGodown.godown_name);
        deductFromLot(row.item_name, row.lot_no, qty, godownId, 'consumed_qty');
        await db.run(`
          INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Flour Input', ?, ?, ?)
        `, [row.date, row.item_name, row.lot_no || '', -qty, -wt, row.rate || 0, -(row.total_amt || 0), row.flour_out_id, godownName, godownId]);
      }
    } catch (e) {}

    // E. Purchase Returns
    try {
      const purchaseReturns = await db.query(`
        SELECT pri.*, pr.date, pr.id as purchase_return_id, pr.godown as return_godown
        FROM purchase_return_items pri
        JOIN purchase_returns pr ON pri.purchase_return_id = pr.id
        ORDER BY pr.date ASC, pri.id ASC
      `);
      for (const row of purchaseReturns.rows) {
        if (!row.item_name) continue;
        const qty = parseFloat(row.qty) || 0;
        const uWeight = parseFloat(row.weight) || 50;
        const wt = parseFloat(row.total_wt) || (qty * uWeight);
        const rate = parseFloat(row.rate) || 0;
        const amt = parseFloat(row.amount || row.total_amt) || (qty * rate);

        let itemId = row.item_id || null;
        if (!itemId) {
          const im = await db.query(`SELECT id FROM item_master WHERE UPPER(TRIM(item_name)) = UPPER(TRIM(?)) LIMIT 1`, [row.item_name]);
          if (im.rows.length > 0) itemId = im.rows[0].id;
        }

        const { godownId, godownName } = await resolveOutflowGodown(row.item_name, row.lot_no, rmGodown.id, rmGodown.godown_name);
        deductFromLot(row.item_name, row.lot_no, qty, godownId, 'returned_qty');
        await db.run(`
          INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Purchase Return', ?, ?, ?, 'Active')
        `, [row.date, itemId, row.item_name, row.lot_no || '', -qty, -wt, rate, -amt, row.purchase_return_id, godownName, godownId]);
      }
    } catch (e) {}

    // F. Weight Conversion Inputs (Consumed Items)
    try {
      for (const row of (wcInputs.rows || [])) {
        if (!row.item_name) continue;
        const qty = parseFloat(row.qty) || 0;
        const wt = parseFloat(row.total_wt) || (qty * (parseFloat(row.weight) || 1));
        const { godownId, godownName } = await resolveOutflowGodown(row.item_name, row.lot_no, rmGodown.id, rmGodown.godown_name);
        deductFromLot(row.item_name, row.lot_no, qty, godownId, 'consumed_qty');
        await db.run(`
          INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id)
          VALUES (?, ?, ?, ?, ?, 0, 0, 'Weight Conversion Input', ?, ?, ?)
        `, [row.date, row.item_name, row.lot_no || '', -qty, -wt, row.conversion_id, godownName, godownId]);
      }
    } catch (e) {}

    // G. Stock Adjustments (Additions and Deductions)
    try {
      for (const row of (stockAdjustments.rows || [])) {
        if (!row.item_name) continue;
        const rawQty = parseFloat(row.qty) || 0;
        const isAdd = (row.type || '').toLowerCase().includes('add') || (row.type || '').toLowerCase().includes('in') || (row.adjustment_type || '').toLowerCase().includes('add') || rawQty > 0;
        const qty = Math.abs(rawQty);
        const wt = Math.abs(parseFloat(row.tot_wt) || (qty * (parseFloat(row.weight) || 1)));
        const rate = parseFloat(row.rate) || 0;

        if (isAdd) {
          const lotNo = row.lot_no || 'ADJ-LOT';
          getOrCreateLot(row.item_name, lotNo, qty, rate, row.date, 'Stock Adjustment Add', row.adjustment_id, defaultGodown.id, defaultGodown.godown_name);
          await db.run(`
            INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Stock Adjust', ?, ?, ?, ?)
          `, [row.date, row.item_name, lotNo, qty, wt, rate, qty * rate, row.adjustment_id, defaultGodown.godown_name, defaultGodown.id, row.remarks || 'Stock Adjustment Add']);
        } else {
          const { godownId: outflowGodownId, godownName: outflowGodownName } = await resolveOutflowGodown(row.item_name, row.lot_no, defaultGodown.id, defaultGodown.godown_name);
          deductFromLot(row.item_name, row.lot_no, qty, outflowGodownId, 'consumed_qty');
          await db.run(`
            INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Stock Adjust', ?, ?, ?, ?)
          `, [row.date, row.item_name, row.lot_no || '', -qty, -wt, rate, -(qty * rate), row.adjustment_id, outflowGodownName, outflowGodownId, row.remarks || 'Stock Adjustment Deduct']);
        }
      }
    } catch (e) {}

    // H. Item Transfers between Godowns
    try {
      for (const row of (itemTransfers.rows || [])) {
        if (!row.item_name) continue;
        const qty = parseFloat(row.transfer_qty) || 0;
        if (qty <= 0) continue;
        const wt = parseFloat(row.weight) ? qty * parseFloat(row.weight) : qty * 50;

        // Source Godown Outward
        let fromGodownId = row.from_godown_id;
        let fromGodownName = row.from_godown_name;
        if (fromGodownId) {
          const gFromRes = await db.query(`SELECT id, godown_name FROM godown_master WHERE id = ? OR CAST(id AS TEXT) = ? OR LOWER(godown_name) = LOWER(?) LIMIT 1`, [fromGodownId, String(fromGodownId), String(fromGodownName)]);
          if (gFromRes.rows && gFromRes.rows.length > 0) {
            fromGodownId = gFromRes.rows[0].id;
            fromGodownName = gFromRes.rows[0].godown_name;
          }
        } else {
          fromGodownId = defaultGodown.id;
          fromGodownName = defaultGodown.godown_name;
        }

        deductFromLot(row.item_name, row.lot_no, qty, fromGodownId, 'consumed_qty');

        await db.run(`
          INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Item Transfer Out', ?, ?, ?, ?)
        `, [row.date, row.item_name, row.lot_no || '', -qty, -wt, row.rate || 0, -(row.amount || 0), row.id, fromGodownName, fromGodownId, `Transferred to ${row.to_godown_name || 'Destination Godown'}`]);

        // Destination Godown Inward
        let toGodownId = row.to_godown_id;
        let toGodownName = row.to_godown_name;
        if (toGodownId) {
          const gToRes = await db.query(`SELECT id, godown_name FROM godown_master WHERE id = ? OR CAST(id AS TEXT) = ? OR LOWER(godown_name) = LOWER(?) LIMIT 1`, [toGodownId, String(toGodownId), String(toGodownName)]);
          if (gToRes.rows && gToRes.rows.length > 0) {
            toGodownId = gToRes.rows[0].id;
            toGodownName = gToRes.rows[0].godown_name;
          }
        } else {
          toGodownId = defaultGodown.id;
          toGodownName = defaultGodown.godown_name;
        }

        getOrCreateLot(row.item_name, row.lot_no || 'TRF-LOT', qty, row.rate || 0, row.date, 'Item Transfer In', row.id, toGodownId, toGodownName);
        await db.run(`
          INSERT INTO stock (date, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Item Transfer In', ?, ?, ?, ?)
        `, [row.date, row.item_name, row.lot_no || '', qty, wt, row.rate || 0, row.amount || 0, row.id, toGodownName, toGodownId, `Transferred from ${fromGodownName}`]);
      }
    } catch (e) {}

    // 4. Save normalized lotMap into `stock_lots` table
    for (const [key, lot] of lotMap.entries()) {
      let itemId = null;
      const im = await db.query(`SELECT id FROM item_master WHERE UPPER(TRIM(item_name)) = UPPER(TRIM(?)) LIMIT 1`, [lot.item_name]);
      if (im.rows.length > 0) itemId = im.rows[0].id;

      const isFullyReturned = (lot.returned_qty || 0) >= (lot.purchased_qty - 0.001) && (lot.returned_qty || 0) > 0;
      const isConsumed = (lot.consumed_qty || 0) >= (lot.purchased_qty - 0.001) && (lot.consumed_qty || 0) > 0;
      const lotQcStatus = isFullyReturned ? 'RETURNED' : 'ACCEPTED';
      const lotUnloadStatus = isFullyReturned ? 'RETURNED' : (isConsumed ? 'CONSUMED' : 'UNLOADED');
      const usable = (isFullyReturned || isConsumed || lot.remaining_quantity <= 0.001) ? 0 : 1;

      const purchaseId = (lot.type === 'Purchase' && lot.refId) ? lot.refId : null;

      await db.run(`
        INSERT INTO stock_lots (godown_id, godown_name, item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate, qc_status, usable_for_production, approval_status, unloading_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)
      `, [lot.godownId || defaultGodown.id, lot.godownName || defaultGodown.godown_name, itemId, lot.item_name, lot.lot_no, purchaseId, lot.purchased_qty, lot.remaining_quantity, lot.rate, lotQcStatus, usable, lotUnloadStatus]);
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
