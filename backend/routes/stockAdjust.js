const express = require('express')
const router = express.Router()
const db = require('../config/database')

// GET next S.No for stock adjustments
router.get('/next-sno', async (req, res) => {
  try {
    const maxSNo = await db.query('SELECT MAX(CAST(s_no AS INTEGER)) as max_s_no, MAX(id) as max_id, COUNT(*) as total_count FROM stock_adjustments')
    const maxVal = Math.max(
      parseInt(maxSNo.rows[0]?.max_s_no) || 0,
      parseInt(maxSNo.rows[0]?.max_id) || 0,
      parseInt(maxSNo.rows[0]?.total_count) || 0
    );
    const next_s_no = maxVal + 1;
    res.json({ success: true, next_s_no: String(next_s_no), next_sno: next_s_no, s_no: next_s_no, data: { s_no: next_s_no } })
  } catch (error) {
    console.error('Error fetching next S.No for stock adjustment:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch next S.No' })
  }
})

// GET all stock adjustments with items
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sa.*, 
             COALESCE(pcm.name, sa.papad_comp) as papad_company_name,
             COALESCE(fmm.flourmill, sa.flour_mill) as flour_mill_name
      FROM stock_adjustments sa
      LEFT JOIN papad_company_master pcm ON (pcm.id = CAST(sa.papad_comp AS INTEGER) OR pcm.name = sa.papad_comp)
      LEFT JOIN flour_mill_master fmm ON (fmm.id = CAST(sa.flour_mill AS INTEGER) OR fmm.flourmill = sa.flour_mill)
      ORDER BY CAST(sa.s_no AS INTEGER) DESC, sa.id DESC
    `)
    
    const list = []
    for (const record of result.rows) {
      const itemsResult = await db.query(
        'SELECT * FROM stock_adjustment_items WHERE stock_adjustment_id = ? ORDER BY s_no ASC',
        [record.id]
      )
      list.push({
        ...record,
        items: itemsResult.rows
      })
    }
    
    res.json(list)
  } catch (error) {
    console.error('Error fetching stock adjustments:', error)
    res.status(500).json({ message: 'Error fetching stock adjustments', error: error.message })
  }
})

// GET single stock adjustment by ID
router.get('/:id', async (req, res) => {
  try {
    const recordResult = await db.query('SELECT * FROM stock_adjustments WHERE id = ?', [req.params.id])
    if (recordResult.rows.length === 0) {
      return res.status(404).json({ message: 'Stock adjustment not found' })
    }

    const itemsResult = await db.query(
      'SELECT * FROM stock_adjustment_items WHERE stock_adjustment_id = ? ORDER BY s_no ASC', 
      [req.params.id]
    )

    const adjustment = {
      ...recordResult.rows[0],
      items: itemsResult.rows
    }

    res.json(adjustment)
  } catch (error) {
    console.error('Error fetching stock adjustment:', error)
    res.status(500).json({ message: 'Error fetching stock adjustment record' })
  }
})

// POST create stock adjustment
router.post('/', async (req, res) => {
  try {
    const { formData, items } = req.body

    if (!formData.date) {
      return res.status(400).json({ message: 'Date is required' })
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' })
    }

    const result = await db.run(`
      INSERT INTO stock_adjustments (s_no, date, type, papad_comp, flour_mill, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [formData.sNo, formData.date, formData.type, formData.papadComp, formData.flourMill, formData.remarks])

    const adjustmentId = result.lastID

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      await db.run(`
        INSERT INTO stock_adjustment_items (stock_adjustment_id, s_no, item_name, lot_no, weight, type, qty, tot_wt, rate, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        adjustmentId, 
        i + 1, 
        item.item_name || '', 
        item.lot_no || '', 
        parseFloat(item.weight) || 0, 
        item.type || '', 
        parseFloat(item.qty) || 0, 
        parseFloat(item.totWt || item.total_wt) || 0, 
        parseFloat(item.rate) || 0, 
        item.remarks || ''
      ])
    }

    // Apply the inventory changes
    await applyStockAdjustments(adjustmentId, formData.date, items)

    res.status(201).json({
      success: true,
      message: 'Stock adjustment saved successfully!',
      id: adjustmentId
    })
  } catch (error) {
    console.error('Error saving stock adjustment:', error)
    res.status(500).json({ success: false, message: 'Error saving stock adjustment', error: error.message })
  }
})

// PUT update stock adjustment
router.put('/:id', async (req, res) => {
  try {
    const { formData, items } = req.body
    const adjustmentId = req.params.id

    // Reverse old adjustments first
    await reverseStockAdjustments(adjustmentId)

    await db.run(`
      UPDATE stock_adjustments 
      SET s_no = ?, date = ?, type = ?, papad_comp = ?, flour_mill = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [formData.sNo, formData.date, formData.type, formData.papadComp, formData.flourMill, formData.remarks, adjustmentId])

    await db.run('DELETE FROM stock_adjustment_items WHERE stock_adjustment_id = ?', [adjustmentId])

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      await db.run(`
        INSERT INTO stock_adjustment_items (stock_adjustment_id, s_no, item_name, lot_no, weight, type, qty, tot_wt, rate, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        adjustmentId, 
        i + 1, 
        item.item_name || '', 
        item.lot_no || '', 
        parseFloat(item.weight) || 0, 
        item.type || '', 
        parseFloat(item.qty) || 0, 
        parseFloat(item.totWt || item.total_wt) || 0, 
        parseFloat(item.rate) || 0, 
        item.remarks || ''
      ])
    }

    // Apply the new inventory changes
    await applyStockAdjustments(adjustmentId, formData.date, items)

    res.json({ success: true, message: 'Stock adjustment record updated successfully!' })
  } catch (error) {
    console.error('Error updating stock adjustment:', error)
    res.status(500).json({ success: false, message: 'Error updating stock adjustment' })
  }
})

// DELETE stock adjustment
router.delete('/:id', async (req, res) => {
  try {
    const adjustmentId = req.params.id

    // Reverse old adjustments
    await reverseStockAdjustments(adjustmentId)

    await db.run('DELETE FROM stock_adjustment_items WHERE stock_adjustment_id = ?', [adjustmentId])
    await db.run('DELETE FROM stock_adjustments WHERE id = ?', [adjustmentId])

    res.json({ success: true, message: 'Stock adjustment record deleted successfully' })
  } catch (error) {
    console.error('Error deleting stock adjustment:', error)
    res.status(500).json({ message: 'Error deleting stock adjustment' })
  }
})

// Helper to identify deduction/reduction item types
const isDeductionType = (itemType) => {
  if (!itemType) return false;
  const t = String(itemType).trim().toLowerCase();
  return (
    t.includes('deduct') ||
    t.includes('reduce') ||
    t.includes('issue') ||
    t.includes('damage') ||
    t.includes('wastage') ||
    t.includes('less') ||
    t === 'deduction' ||
    t === 'reduction' ||
    t === 'out'
  );
};

// Helper to apply stock and lot adjustments
const applyStockAdjustments = async (adjustmentId, date, items) => {
  if (!Array.isArray(items)) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemName = item.item_name || item.itemName;
    const lotNo = item.lot_no || item.lotNo;
    const qty = parseFloat(item.qty) || 0;
    const weight = parseFloat(item.weight) || 0;
    const totWt = parseFloat(item.totWt || item.total_wt || item.tot_wt) || 0;
    const rate = parseFloat(item.rate) || 0;
    const itemType = item.type || ''; // 'Addition' or 'Deduction' / 'Reduction'

    if (!itemName) continue;

    // Determine direction
    const isReduction = isDeductionType(itemType);
    const adjQty = isReduction ? -Math.abs(qty) : Math.abs(qty);
    const adjTotWt = isReduction ? -Math.abs(totWt) : Math.abs(totWt);

    // Get item_id
    let itemId = null;
    const itemMaster = await db.query('SELECT id FROM item_master WHERE item_name = ? LIMIT 1', [itemName]);
    if (itemMaster.rows.length > 0) {
      itemId = itemMaster.rows[0].id;
    } else {
      const insertItem = await db.run('INSERT INTO item_master (item_name, status) VALUES (?, ?)', [itemName, 'Active']);
      itemId = insertItem.lastID;
    }

    // Insert into centralized stock table
    await db.run(`
      INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Stock Adjust', ?)
    `, [
      date,
      itemId,
      itemName,
      lotNo || '',
      adjQty,
      weight,
      rate,
      adjTotWt * rate,
      adjustmentId
    ]);

    // Adjust remaining_quantity in stock_lots
    if (lotNo) {
      const lotRes = await db.query('SELECT id, remaining_quantity FROM stock_lots WHERE lot_no = ? LIMIT 1', [lotNo]);
      if (lotRes.rows.length > 0) {
        const lot = lotRes.rows[0];
        const newRemaining = Math.max(0, (lot.remaining_quantity || 0) + adjQty);
        await db.run('UPDATE stock_lots SET remaining_quantity = ? WHERE id = ?', [newRemaining, lot.id]);
      } else if (!isReduction) {
        // If lot doesn't exist and we're adding stock, create a lot entry
        await db.run(`
          INSERT INTO stock_lots (item_id, item_name, lot_no, quantity, remaining_quantity, rate)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          itemId,
          itemName,
          lotNo,
          qty,
          qty,
          rate
        ]);
      }
    }
  }
};

// Helper to reverse previous adjustments
const reverseStockAdjustments = async (adjustmentId) => {
  try {
    const itemsRes = await db.query('SELECT * FROM stock_adjustment_items WHERE stock_adjustment_id = ?', [adjustmentId]);
    for (const item of itemsRes.rows) {
      const isReduction = isDeductionType(item.type);
      const adjQty = isReduction ? -Math.abs(item.qty) : Math.abs(item.qty);

      if (item.lot_no) {
        const lotRes = await db.query('SELECT id, remaining_quantity FROM stock_lots WHERE lot_no = ? LIMIT 1', [item.lot_no]);
        if (lotRes.rows.length > 0) {
          const lot = lotRes.rows[0];
          const reversedRemaining = Math.max(0, (lot.remaining_quantity || 0) - adjQty);
          await db.run('UPDATE stock_lots SET remaining_quantity = ? WHERE id = ?', [reversedRemaining, lot.id]);
        }
      }
    }

    // Delete existing entries in stock table for this adjustment
    await db.run('DELETE FROM stock WHERE type = "Stock Adjust" AND reference_id = ?', [adjustmentId]);
  } catch (err) {
    console.error('Error reversing stock adjustments:', err);
  }
};

// Auto-repair existing stock adjustments in database
setTimeout(async () => {
  try {
    const allAdjustments = await db.query('SELECT id, date FROM stock_adjustments');
    for (const adj of allAdjustments.rows) {
      const itemsRes = await db.query('SELECT * FROM stock_adjustment_items WHERE stock_adjustment_id = ?', [adj.id]);
      if (itemsRes.rows.length > 0) {
        await reverseStockAdjustments(adj.id);
        await applyStockAdjustments(adj.id, adj.date, itemsRes.rows);
      }
    }
  } catch (err) {
    console.error('Error syncing legacy stock adjustments:', err);
  }
}, 1000);

module.exports = router;
