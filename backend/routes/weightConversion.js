const express = require('express')
const router = express.Router()
const db = require('../config/database')

// Revert stock changes for a weight conversion record
const revertWeightConversionStock = async (conversionId) => {
  try {
    const items = await db.query(`SELECT * FROM weight_conversion_items WHERE weight_conversion_id = ?`, [conversionId]);
    for (const item of (items.rows || [])) {
      const itemName = item.item_name;
      const lotNo = item.lot_no;
      const qty = parseFloat(item.qty) || 0;
      const type = item.type;

      if (type === 'input' && lotNo && qty > 0) {
        await db.run(
          `UPDATE stock_lots SET remaining_quantity = remaining_quantity + ? WHERE lot_no = ? AND LOWER(item_name) = LOWER(?)`,
          [qty, lotNo, itemName]
        );
      } else if (type === 'output' && qty > 0) {
        if (lotNo) {
          await db.run(
            `UPDATE stock_lots SET remaining_quantity = MAX(0, remaining_quantity - ?), quantity = MAX(0, quantity - ?) WHERE lot_no = ? AND LOWER(item_name) = LOWER(?)`,
            [qty, qty, lotNo, itemName]
          );
        }
      }
    }
    await db.run(`DELETE FROM stock WHERE reference_id = ? AND type IN ('Weight Conversion Input', 'Weight Conversion Output', 'Weight Conversion')`, [conversionId]);
  } catch (err) {
    console.error('Error reverting weight conversion stock:', err);
  }
};

// Process stock changes for a weight conversion record
const processWeightConversionStock = async (conversionId, date, items) => {
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const itemName = item.item_name || '';
    let lotNo = item.lot_no || '';
    const qty = parseFloat(item.qty) || 0;
    const weightPerUnit = parseFloat(item.weight) || 0;
    const totalWt = parseFloat(item.total_wt) || (qty * weightPerUnit);
    const type = item.type || 'input';

    if (!itemName || qty <= 0) continue;

    let itemId = null;
    try {
      const im = await db.query(`SELECT id FROM item_master WHERE LOWER(item_name) = LOWER(?)`, [itemName]);
      if (im.rows && im.rows.length > 0) {
        itemId = im.rows[0].id;
      } else {
        const isOutput = (type === 'output');
        const grp = isOutput ? 'Finished Goods' : 'Raw Material';
        const newIm = await db.run(`INSERT INTO item_master (item_name, item_group, status) VALUES (?, ?, 'Active')`, [itemName, grp]);
        itemId = newIm.lastID;
      }
    } catch (e) {
      console.error('Error checking item_master for weight conversion:', e);
    }

    if (type === 'input') {
      // Consumed item - reduce stock
      if (lotNo) {
        await db.run(
          `UPDATE stock_lots SET remaining_quantity = MAX(0, remaining_quantity - ?) WHERE lot_no = ? AND LOWER(item_name) = LOWER(?)`,
          [qty, lotNo, itemName]
        );
      }

      await db.run(
        `INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'Weight Conversion Input', ?)`,
        [date, itemId, itemName, lotNo, -qty, -totalWt, conversionId]
      );
    } else if (type === 'output') {
      // Produced item - increase stock
      if (!lotNo) {
        try {
          const nextLotRes = await db.query(`SELECT MAX(CAST(SUBSTR(lot_no, 4) AS INTEGER)) as max_num FROM stock_lots WHERE lot_no LIKE 'LOT%'`);
          const nextNum = ((nextLotRes.rows && nextLotRes.rows[0]?.max_num) || 0) + 1;
          lotNo = `LOT${String(nextNum).padStart(4, '0')}`;
          // Update lot_no in weight_conversion_items so UI & lot audit display it
          await db.run(`UPDATE weight_conversion_items SET lot_no = ? WHERE weight_conversion_id = ? AND item_name = ? AND type = 'output'`, [lotNo, conversionId, itemName]);
        } catch (e) {
          lotNo = `LOT_WC_${conversionId}`;
        }
      }

      // Check existing stock_lots
      const existing = await db.query(
        `SELECT id FROM stock_lots WHERE lot_no = ? AND LOWER(item_name) = LOWER(?)`,
        [lotNo, itemName]
      );
      if (existing.rows && existing.rows.length > 0) {
        await db.run(
          `UPDATE stock_lots SET quantity = quantity + ?, remaining_quantity = remaining_quantity + ? WHERE id = ?`,
          [qty, qty, existing.rows[0].id]
        );
      } else {
        await db.run(
          `INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate, usable_for_production) VALUES (?, ?, ?, ?, ?, ?, 0, 1)`,
          [itemId, itemName, lotNo, conversionId, qty, qty]
        );
      }

      await db.run(
        `INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'Weight Conversion Output', ?)`,
        [date, itemId, itemName, lotNo, qty, totalWt, conversionId]
      );
    }
  }
};

// Sync existing weight conversion records into stock if missing
const syncExistingWeightConversions = async () => {
  try {
    const wcResult = await db.query(`SELECT * FROM weight_conversion`);
    const conversions = wcResult.rows || [];
    for (const wc of conversions) {
      const stockCheck = await db.query(`SELECT id FROM stock WHERE reference_id = ? AND type LIKE 'Weight Conversion%'`, [wc.id]);
      if ((stockCheck.rows || []).length === 0) {
        const itemsResult = await db.query(`SELECT * FROM weight_conversion_items WHERE weight_conversion_id = ?`, [wc.id]);
        const items = itemsResult.rows || [];
        await processWeightConversionStock(wc.id, wc.date, items);
        console.log(`Synced Weight Conversion ID ${wc.id} into stock table`);
      }
    }
  } catch (err) {
    console.error('Error syncing weight conversions into stock:', err);
  }
};

// Sync on start
setTimeout(syncExistingWeightConversions, 1000);

// GET next S.No for weight conversion
router.get('/next-sno', async (req, res) => {
  try {
    const maxSNo = await db.query('SELECT MAX(CAST(s_no AS INTEGER)) as max_s_no FROM weight_conversion')
    const next_s_no = ((maxSNo.rows && maxSNo.rows[0]?.max_s_no) || 0) + 1;
    res.json({ success: true, next_s_no })
  } catch (error) {
    console.error('Error fetching next S.No for weight conversion:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch next S.No' })
  }
})

// GET all weight conversion records
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM weight_conversion ORDER BY id DESC
    `)
    
    const weightConversions = []
    for (const wc of (result.rows || [])) {
      const itemsResult = await db.query(
        'SELECT * FROM weight_conversion_items WHERE weight_conversion_id = ?',
        [wc.id]
      )
      weightConversions.push({
        ...wc,
        items: itemsResult.rows || []
      })
    }
    
    res.json(weightConversions)
  } catch (error) {
    console.error('Error fetching weight conversion:', error)
    res.status(500).json({ message: 'Error fetching weight conversion records', error: error.message })
  }
})

// GET weight conversion by ID
router.get('/:id', async (req, res) => {
  try {
    const weightConversionResult = await db.query('SELECT * FROM weight_conversion WHERE id = ?', [req.params.id])
    if (!weightConversionResult.rows || weightConversionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Weight conversion record not found' })
    }

    const itemsResult = await db.query('SELECT * FROM weight_conversion_items WHERE weight_conversion_id = ?', [req.params.id])

    const weightConversion = {
      ...weightConversionResult.rows[0],
      items: itemsResult.rows || []
    }

    res.json(weightConversion)
  } catch (error) {
    console.error('Error fetching weight conversion:', error)
    res.status(500).json({ message: 'Error fetching weight conversion record' })
  }
})

// POST create new weight conversion
router.post('/', async (req, res) => {
  try {
    const { formData, items } = req.body

    // Validation
    if (!formData.date) {
      return res.status(400).json({ message: 'Date is required' })
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' })
    }

    if (items.some(item => !item.item_name || item.qty <= 0)) {
      return res.status(400).json({ message: 'All items must have a name and positive quantity' })
    }

    // Insert weight conversion
    const weightConversionResult = await db.run(`
      INSERT INTO weight_conversion (s_no, date, remarks, type)
      VALUES (?, ?, ?, ?)
    `, [formData.sNo, formData.date, formData.remarks, formData.type])

    const weightConversionId = weightConversionResult.lastID

    // Insert weight conversion items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      await db.run(`
        INSERT INTO weight_conversion_items (weight_conversion_id, s_no, item_name, lot_no, weight, qty, total_wt, type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [weightConversionId, i + 1, item.item_name, item.lot_no || '', item.weight || 0, item.qty, item.total_wt || 0, item.type || 'input'])
    }

    // Process stock update
    await processWeightConversionStock(weightConversionId, formData.date, items);

    res.status(201).json({
      message: 'Weight conversion record saved successfully!',
      id: weightConversionId
    })
  } catch (error) {
    console.error('Error saving weight conversion:', error)
    res.status(500).json({ message: 'Error saving weight conversion', error: error.message })
  }
})

// PUT update weight conversion
router.put('/:id', async (req, res) => {
  try {
    const { formData, items } = req.body
    const weightConversionId = req.params.id

    // Revert existing stock
    await revertWeightConversionStock(weightConversionId);

    // Update weight conversion
    await db.run(`
      UPDATE weight_conversion SET s_no = ?, date = ?, remarks = ?, type = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [formData.sNo, formData.date, formData.remarks, formData.type, weightConversionId])

    // Delete existing items
    await db.run('DELETE FROM weight_conversion_items WHERE weight_conversion_id = ?', [weightConversionId])

    // Insert updated items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      await db.run(`
        INSERT INTO weight_conversion_items (weight_conversion_id, s_no, item_name, lot_no, weight, qty, total_wt, type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [weightConversionId, i + 1, item.item_name, item.lot_no || '', item.weight || 0, item.qty, item.total_wt || 0, item.type || 'input'])
    }

    // Process updated stock
    await processWeightConversionStock(weightConversionId, formData.date, items);

    res.json({ message: 'Weight conversion record updated successfully!' })
  } catch (error) {
    console.error('Error updating weight conversion:', error)
    res.status(500).json({ message: 'Error updating weight conversion' })
  }
})

// DELETE weight conversion
router.delete('/:id', async (req, res) => {
  try {
    await revertWeightConversionStock(req.params.id);
    await db.run('DELETE FROM weight_conversion_items WHERE weight_conversion_id = ?', [req.params.id])
    await db.run('DELETE FROM weight_conversion WHERE id = ?', [req.params.id])
    res.json({ success: true, message: 'Weight conversion record deleted successfully' })
  } catch (error) {
    console.error('Error deleting weight conversion:', error)
    res.status(500).json({ success: false, message: 'Error deleting weight conversion', error: error.message })
  }
})

module.exports = router
