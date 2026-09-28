const express = require('express')
const router = express.Router()
const db = require('../config/database')
const { reserveNextLotNumber, recordLotNumber } = require('../utils/lotHelper')

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
          `UPDATE stock_lots SET remaining_quantity = remaining_quantity + ? WHERE lot_no = ? AND LOWER(TRIM(item_name)) = LOWER(TRIM(?))`,
          [qty, lotNo, itemName]
        );
      } else if (type === 'output' && qty > 0) {
        if (lotNo) {
          await db.run(
            `UPDATE stock_lots SET remaining_quantity = CASE WHEN remaining_quantity >= ? THEN remaining_quantity - ? ELSE 0 END, quantity = CASE WHEN quantity >= ? THEN quantity - ? ELSE 0 END WHERE lot_no = ? AND LOWER(TRIM(item_name)) = LOWER(TRIM(?))`,
            [qty, qty, qty, qty, lotNo, itemName]
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
const processWeightConversionStock = async (conversionId, date, items, companyId = 1) => {
  if (!Array.isArray(items)) return;

  const cId = companyId || 1;

  for (const item of items) {
    const itemName = item.item_name || '';
    let lotNo = item.lot_no ? String(item.lot_no).trim() : '';
    const qty = parseFloat(item.qty) || 0;
    const weightPerUnit = parseFloat(item.weight) || 0;
    const totalWt = parseFloat(item.total_wt) || (qty * weightPerUnit);
    const type = item.type || 'input';

    if (!itemName || qty <= 0) continue;

    let itemId = null;
    try {
      const im = await db.query(`SELECT id FROM item_master WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))`, [itemName]);
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
          `UPDATE stock_lots SET remaining_quantity = CASE WHEN remaining_quantity >= ? THEN remaining_quantity - ? ELSE 0 END WHERE lot_no = ? AND LOWER(TRIM(item_name)) = LOWER(TRIM(?))`,
          [qty, qty, lotNo, itemName]
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
          lotNo = await reserveNextLotNumber(cId);
          // Update lot_no in weight_conversion_items so UI & lot audit display it
          await db.run(`UPDATE weight_conversion_items SET lot_no = ? WHERE weight_conversion_id = ? AND item_name = ? AND type = 'output'`, [lotNo, conversionId, itemName]);
        } catch (e) {
          lotNo = `LOT_WC_${conversionId}`;
        }
      } else {
        try {
          await recordLotNumber(lotNo, cId);
        } catch (e) {}
      }

      // Check existing stock_lots
      const existing = await db.query(
        `SELECT id FROM stock_lots WHERE lot_no = ? AND LOWER(TRIM(item_name)) = LOWER(TRIM(?))`,
        [lotNo, itemName]
      );
      if (existing.rows && existing.rows.length > 0) {
        await db.run(
          `UPDATE stock_lots SET quantity = quantity + ?, remaining_quantity = remaining_quantity + ? WHERE id = ?`,
          [qty, qty, existing.rows[0].id]
        );
      } else {
        await db.run(
          `INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate, usable_for_production, approval_status, qc_status) VALUES (?, ?, ?, ?, ?, ?, 0, 1, 'APPROVED', 'ACCEPTED')`,
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
        await processWeightConversionStock(wc.id, wc.date, items, 1);
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
    const maxSNo = await db.query('SELECT MAX(CAST(s_no AS INTEGER)) as max_s_no, MAX(id) as max_id, COUNT(*) as total_count FROM weight_conversion')
    const maxVal = Math.max(
      parseInt(maxSNo.rows[0]?.max_s_no) || 0,
      parseInt(maxSNo.rows[0]?.max_id) || 0,
      parseInt(maxSNo.rows[0]?.total_count) || 0
    );
    const next_s_no = maxVal + 1;
    res.json({ success: true, next_s_no: String(next_s_no), next_sno: next_s_no, s_no: next_s_no, data: { s_no: next_s_no } })
  } catch (error) {
    console.error('Error fetching next S.No for weight conversion:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch next S.No' })
  }
})

// GET next auto Lot No for weight conversion
router.get('/next-lot-no', async (req, res) => {
  try {
    const cId = req.companyId || req.headers?.['x-company-id'] || req.query?.company_id || 1;
    const { previewNextLotNumber } = require('../utils/lotHelper');
    const nextLotNo = await previewNextLotNumber(cId);
    res.json({ success: true, lot_no: nextLotNo, next_lot_no: nextLotNo, data: { lot_no: nextLotNo } });
  } catch (error) {
    console.error('Error fetching next lot no for weight conversion:', error);
    res.json({ success: true, lot_no: 'LOT0001', next_lot_no: 'LOT0001', data: { lot_no: 'LOT0001' } });
  }
})

// GET available lots for weight conversion (MUST be before /:id)
router.get('/available-lots', async (req, res) => {
  try {
    const itemName = req.query.item_name || req.query.itemName || '';
    const lotNo = req.query.lot_no || req.query.lotNo || '';

    let query = `
      SELECT 
        sl.id,
        sl.item_id,
        sl.item_name,
        sl.lot_no,
        COALESCE(sl.remaining_quantity, sl.quantity, 0) AS remaining_quantity,
        COALESCE(sl.rate, 0) AS rate,
        sl.created_at,
        COALESCE(
          (SELECT pi.per_unit_weight FROM purchase_items pi WHERE pi.lot_no = sl.lot_no AND (LOWER(pi.item_name) = LOWER(sl.item_name) OR CAST(pi.item_id AS TEXT) = CAST(sl.item_id AS TEXT)) AND pi.per_unit_weight > 0 LIMIT 1),
          (SELECT pi.weight FROM purchase_items pi WHERE pi.lot_no = sl.lot_no AND (LOWER(pi.item_name) = LOWER(sl.item_name) OR CAST(pi.item_id AS TEXT) = CAST(sl.item_id AS TEXT)) AND pi.weight > 0 LIMIT 1),
          (SELECT wc.weight FROM weight_conversion_items wc WHERE wc.lot_no = sl.lot_no AND LOWER(wc.item_name) = LOWER(sl.item_name) AND wc.weight > 0 LIMIT 1),
          (SELECT wm.weight FROM weightmaster wm WHERE LOWER(wm.name) = LOWER(sl.item_name) AND wm.weight > 0 LIMIT 1),
          (SELECT ROUND(CAST(ABS(s.weight) / ABS(s.qty) AS NUMERIC), 2) FROM stock s WHERE s.lot_no = sl.lot_no AND LOWER(s.item_name) = LOWER(sl.item_name) AND s.qty > 0 AND s.weight > 0 LIMIT 1),
          0
        ) AS per_unit_weight
      FROM stock_lots sl
      WHERE COALESCE(sl.remaining_quantity, sl.quantity, 0) > 0
    `;
    const params = [];

    if (itemName && itemName.trim()) {
      const term = itemName.trim();
      query += ` AND (LOWER(TRIM(sl.item_name)) = LOWER(TRIM(?)) OR LOWER(sl.item_name) LIKE LOWER(?) OR sl.item_id IN (SELECT id FROM item_master WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))))`;
      params.push(term, `%${term}%`, term);
    }

    if (lotNo && lotNo.trim()) {
      const lTerm = lotNo.trim();
      query += ` AND (LOWER(TRIM(sl.lot_no)) = LOWER(TRIM(?)) OR LOWER(sl.lot_no) LIKE LOWER(?))`;
      params.push(lTerm, `%${lTerm}%`);
    }

    query += ` ORDER BY sl.created_at DESC, sl.id DESC LIMIT 100`;

    let result = await db.query(query, params);
    let rows = result.rows || [];

    // Fallback: If 0 rows found and itemName was provided, check if lots exist with any positive or zero remaining_quantity for THIS item
    if (rows.length === 0 && itemName && itemName.trim()) {
      const term = itemName.trim();
      const fbResult = await db.query(`
        SELECT 
          sl.id,
          sl.item_id,
          sl.item_name,
          sl.lot_no,
          COALESCE(sl.remaining_quantity, sl.quantity, 0) AS remaining_quantity,
          COALESCE(sl.rate, 0) AS rate,
          sl.created_at,
          0 AS per_unit_weight
        FROM stock_lots sl
        WHERE LOWER(TRIM(sl.item_name)) = LOWER(TRIM(?)) 
           OR LOWER(sl.item_name) LIKE LOWER(?)
           OR sl.item_id IN (SELECT id FROM item_master WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)))
        ORDER BY sl.created_at DESC, sl.id DESC
        LIMIT 50
      `, [term, `%${term}%`, term]);
      rows = fbResult.rows || [];
    }

    // Only if NO itemName was provided at all, allow generic lots
    if (rows.length === 0 && (!itemName || !itemName.trim())) {
      const allLotsQuery = `
        SELECT 
          sl.id,
          sl.item_id,
          sl.item_name,
          sl.lot_no,
          COALESCE(sl.remaining_quantity, sl.quantity, 0) AS remaining_quantity,
          COALESCE(sl.rate, 0) AS rate,
          sl.created_at,
          0 AS per_unit_weight
        FROM stock_lots sl
        WHERE sl.lot_no IS NOT NULL AND sl.lot_no != ''
        ORDER BY sl.created_at DESC, sl.id DESC
        LIMIT 50
      `;
      const allResult = await db.query(allLotsQuery, []);
      rows = allResult.rows || [];
    }

    // Deduplicate lots by lot_no while preserving highest remaining_quantity
    const lotMap = new Map();
    for (const r of rows) {
      if (!r.lot_no) continue;
      const rem = parseFloat(r.remaining_quantity) || 0;
      if (!lotMap.has(r.lot_no) || rem > (parseFloat(lotMap.get(r.lot_no).remaining_quantity) || 0)) {
        lotMap.set(r.lot_no, {
          id: r.id,
          item_id: r.item_id,
          item_name: r.item_name,
          lot_no: r.lot_no,
          remaining_quantity: rem,
          rate: parseFloat(r.rate) || 0,
          created_at: r.created_at,
          per_unit_weight: parseFloat(r.per_unit_weight) || 0
        });
      }
    }

    res.json(Array.from(lotMap.values()));
  } catch (error) {
    console.error('Error in /api/weight-conversion/available-lots:', error);
    res.status(500).json({ success: false, message: 'Error fetching available lots', error: error.message });
  }
});

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
    const companyId = req.companyId || req.headers?.['x-company-id'] || 1;
    await processWeightConversionStock(weightConversionId, formData.date, items, companyId);

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
    const companyId = req.companyId || req.headers?.['x-company-id'] || 1;
    await processWeightConversionStock(weightConversionId, formData.date, items, companyId);

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
