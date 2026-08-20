const db = require('../config/database');

// Helper to deduct stock for Flour Out items (Flour issue to papad makers -> Usage)
const deductFlourOutStock = async (flourOutId, date, items) => {
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const itemName = item.item_name || item.itemName;
    const lotNo = item.lot_no || item.lotNo || '';
    const qty = parseFloat(item.qty) || 0;
    const totalWt = parseFloat(item.total_wt || item.totalWt || item.weight) || 0;

    if (!itemName || (qty <= 0 && totalWt <= 0)) continue;

    let remainingToDeduct = qty > 0 ? qty : totalWt;

    // Try deduction from specific stock lot
    if (lotNo) {
      const lotResult = await db.query(`
        SELECT id, remaining_quantity 
        FROM stock_lots 
        WHERE item_name = ? AND lot_no = ? AND remaining_quantity > 0
      `, [itemName, lotNo]);

      if (lotResult.rows.length > 0) {
        const lot = lotResult.rows[0];
        const deduct = Math.min(lot.remaining_quantity, remainingToDeduct);
        await db.run(`
          UPDATE stock_lots 
          SET remaining_quantity = MAX(0, remaining_quantity - ?)
          WHERE id = ?
        `, [deduct, lot.id]);
        remainingToDeduct -= deduct;
      }
    }

    // Fallback to FIFO if remainingToDeduct > 0
    if (remainingToDeduct > 0) {
      const availableLots = await db.query(`
        SELECT id, remaining_quantity 
        FROM stock_lots 
        WHERE item_name = ? AND remaining_quantity > 0
        ORDER BY created_at ASC
      `, [itemName]);

      for (const lot of availableLots.rows) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(lot.remaining_quantity, remainingToDeduct);
        await db.run(`
          UPDATE stock_lots 
          SET remaining_quantity = MAX(0, remaining_quantity - ?)
          WHERE id = ?
        `, [deduct, lot.id]);
        remainingToDeduct -= deduct;
      }
    }

    // Get item_id from item_master
    let itemId = null;
    const itemMaster = await db.query(`SELECT id FROM item_master WHERE item_name = ?`, [itemName]);
    if (itemMaster.rows.length > 0) {
      itemId = itemMaster.rows[0].id;
    }

    // Insert negative stock entry for tracking
    await db.run(`
      INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, 'Flour Out', ?)
    `, [date, itemId, itemName, lotNo, -qty, -totalWt, flourOutId]);
  }
};

// Helper to revert stock changes for Flour Out
const revertFlourOutStock = async (flourOutId) => {
  try {
    const items = await db.query(`SELECT * FROM flour_out_items WHERE flour_out_id = ?`, [flourOutId]);
    for (const item of items.rows) {
      if (item.lot_no && item.qty > 0) {
        await db.run(`
          UPDATE stock_lots
          SET remaining_quantity = remaining_quantity + ?
          WHERE item_name = ? AND lot_no = ?
        `, [item.qty, item.item_name, item.lot_no]);
      }
    }
    await db.run(`DELETE FROM stock WHERE reference_id = ? AND type = 'Flour Out'`, [flourOutId]);
  } catch (err) {
    console.error('Error reverting flour out stock:', err);
  }
};

// Helper to add stock for Papad In items (Receiving Finished Papad into Inventory -> Entry)
const addPapadInStock = async (papadInId, date, items) => {
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const itemName = item.itemName || item.item_name;
    const lotNo = item.lotNo || item.lot_no || `LOT-PAP-${papadInId}`;
    const qty = parseFloat(item.qty || item.box_papad) || 0;
    const weight = parseFloat(item.totalWt || item.tot_wt || item.wt_papad || item.weight) || 0;

    if (!itemName || (qty <= 0 && weight <= 0)) continue;

    // 1. Get or create item in item_master
    let itemId = null;
    const itemMaster = await db.query(`SELECT id FROM item_master WHERE item_name = ?`, [itemName]);
    if (itemMaster.rows.length > 0) {
      itemId = itemMaster.rows[0].id;
    } else {
      const newMaster = await db.run(`INSERT INTO item_master (item_name, status, item_group) VALUES (?, 'Active', 'FG')`, [itemName]);
      itemId = newMaster.lastID;
    }

    // 2. Check if stock_lot already exists for this lot_no and item_name
    const existingLot = await db.query(`
      SELECT id, quantity, remaining_quantity FROM stock_lots WHERE item_name = ? AND lot_no = ?
    `, [itemName, lotNo]);

    if (existingLot.rows.length > 0) {
      await db.run(`
        UPDATE stock_lots 
        SET quantity = quantity + ?, remaining_quantity = remaining_quantity + ?
        WHERE id = ?
      `, [qty, qty, existingLot.rows[0].id]);
    } else {
      await db.run(`
        INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `, [itemId, itemName, lotNo, papadInId, qty, qty]);
    }

    // 3. Insert stock movement entry (type = 'Papad In')
    await db.run(`
      INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, 'Papad In', ?)
    `, [date, itemId, itemName, lotNo, qty, weight, papadInId]);
  }
};

// Helper to revert stock changes for Papad In
const revertPapadInStock = async (papadInId) => {
  try {
    // Delete stock movement
    await db.run(`DELETE FROM stock WHERE reference_id = ? AND type = 'Papad In'`, [papadInId]);
    
    // Find items for this papadIn
    const items = await db.query(`SELECT * FROM flour_out_items WHERE flour_out_id = ?`, [papadInId]);
    for (const item of items.rows) {
      const itemName = item.item_name;
      const lotNo = item.lot_no;
      const qty = parseFloat(item.qty || item.box_papad) || 0;
      if (lotNo && qty > 0) {
        await db.run(`
          UPDATE stock_lots
          SET quantity = MAX(0, quantity - ?), remaining_quantity = MAX(0, remaining_quantity - ?)
          WHERE item_name = ? AND lot_no = ?
        `, [qty, qty, itemName, lotNo]);
      }
    }
  } catch (err) {
    console.error('Error reverting papad in stock:', err);
  }
};

// Sync method to ensure historical records in flour_out table exist in stock & stock_lots
const syncFlourOutAndPapadInStock = async () => {
  try {
    const foRecords = await db.query(`SELECT * FROM flour_out`);
    for (const fo of foRecords.rows) {
      const items = await db.query(`SELECT * FROM flour_out_items WHERE flour_out_id = ?`, [fo.id]);
      if (items.rows.length === 0) continue;

      // Determine if this is a Papad In record vs a Flour Out record
      const isPapadIn = items.rows.some(i => 
        (i.item_name && i.item_name.toLowerCase().includes('papad')) ||
        (i.box_papad && i.box_papad > 0) ||
        (i.wt_papad && i.wt_papad > 0)
      );

      if (isPapadIn) {
        const stockCheck = await db.query(`SELECT id FROM stock WHERE reference_id = ? AND type = 'Papad In'`, [fo.id]);
        if (stockCheck.rows.length === 0) {
          console.log(`Syncing missing Papad In stock for flour_out ID ${fo.id}`);
          await addPapadInStock(fo.id, fo.date, items.rows);
        }
      } else {
        const stockCheck = await db.query(`SELECT id FROM stock WHERE reference_id = ? AND type = 'Flour Out'`, [fo.id]);
        if (stockCheck.rows.length === 0) {
          console.log(`Syncing missing Flour Out stock for flour_out ID ${fo.id}`);
          await deductFlourOutStock(fo.id, fo.date, items.rows);
        }
      }
    }
    console.log('✓ Flour Out & Papad In stock sync completed');
  } catch (err) {
    console.error('Error syncing flour out / papad in stock:', err);
  }
};

module.exports = {
  deductFlourOutStock,
  revertFlourOutStock,
  addPapadInStock,
  revertPapadInStock,
  syncFlourOutAndPapadInStock
};
