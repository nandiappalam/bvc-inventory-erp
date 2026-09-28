const express = require('express')
const router = express.Router()
const db = require('../config/database')
const { reserveNextLotNumber, recordLotNumber } = require('../utils/lotHelper')

// Revert stock changes for a weight conversion record
const revertWeightConversionStock = async (conversionId, companyId = 1) => {
  try {
    const cId = companyId || 1;
    const items = await db.query(`SELECT * FROM weight_conversion_items WHERE CAST(weight_conversion_id AS TEXT) = CAST(? AS TEXT)`, [conversionId], cId);
    for (const item of (items.rows || [])) {
      const itemName = (item.item_name || '').trim();
      const lotNo = (item.lot_no || '').trim();
      const qty = parseFloat(item.qty) || 0;
      const type = item.type;

      if (type === 'input' && qty > 0) {
        if (lotNo) {
          await db.run(
            `UPDATE stock_lots SET remaining_quantity = remaining_quantity + ? WHERE lot_no = ? OR (LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND lot_no = ?)`,
            [qty, lotNo, itemName, lotNo],
            cId
          );
        } else {
          await db.run(
            `UPDATE stock_lots SET remaining_quantity = remaining_quantity + ? WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))`,
            [qty, itemName],
            cId
          );
        }
      } else if (type === 'output' && qty > 0) {
        if (lotNo) {
          await db.run(
            `UPDATE stock_lots SET remaining_quantity = CASE WHEN remaining_quantity >= ? THEN remaining_quantity - ? ELSE 0 END, quantity = CASE WHEN quantity >= ? THEN quantity - ? ELSE 0 END WHERE lot_no = ? OR (LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND lot_no = ?)`,
            [qty, qty, qty, qty, lotNo, itemName, lotNo],
            cId
          );
        }
      }
    }
    await db.run(`DELETE FROM stock WHERE CAST(reference_id AS TEXT) = CAST(? AS TEXT) AND type IN ('Weight Conversion Input', 'Weight Conversion Output', 'Weight Conversion')`, [conversionId], cId);
  } catch (err) {
    console.error('Error reverting weight conversion stock:', err);
  }
};

// Process stock changes for a weight conversion record
const processWeightConversionStock = async (conversionId, date, items, companyId = 1) => {
  if (!Array.isArray(items)) return;

  const cId = companyId || 1;

  // 1. Identify primary input lot's godown
  let defaultGodownId = null;
  let defaultGodownName = null;

  for (const item of items) {
    const type = item.type || 'input';
    const itemName = (item.item_name || '').trim();
    const lotNo = item.lot_no ? String(item.lot_no).trim() : '';

    if (type === 'input' && lotNo) {
      try {
        const lRes = await db.query(
          `SELECT godown_id, godown_name FROM stock_lots WHERE lot_no = ? OR (LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND lot_no = ?) LIMIT 1`,
          [lotNo, itemName, lotNo],
          cId
        );
        if (lRes && lRes.rows && lRes.rows.length > 0 && (lRes.rows[0].godown_id || lRes.rows[0].godown_name)) {
          defaultGodownId = lRes.rows[0].godown_id;
          defaultGodownName = lRes.rows[0].godown_name;
        }
        if (!defaultGodownName && !defaultGodownId) {
          const sRes = await db.query(
            `SELECT godown, godown_id FROM stock WHERE lot_no = ? AND LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND qty > 0 ORDER BY id DESC LIMIT 1`,
            [lotNo, itemName],
            cId
          );
          if (sRes && sRes.rows && sRes.rows.length > 0) {
            defaultGodownName = sRes.rows[0].godown;
            defaultGodownId = sRes.rows[0].godown_id;
          }
        }
        if (defaultGodownId || defaultGodownName) break;
      } catch (e) {}
    }
  }

  // Resolve godown name if only id exists
  if (defaultGodownId && !defaultGodownName) {
    try {
      const gm = await db.query(`SELECT godown_name FROM godown_master WHERE CAST(id AS TEXT) = CAST(? AS TEXT) LIMIT 1`, [defaultGodownId], cId);
      if (gm && gm.rows && gm.rows.length > 0) defaultGodownName = gm.rows[0].godown_name;
    } catch (e) {}
  }

  // If no godown found, search first active godown in godown_master
  if (!defaultGodownName) {
    try {
      const gmAll = await db.query(`SELECT id, godown_name FROM godown_master ORDER BY id ASC LIMIT 1`, [], cId);
      if (gmAll && gmAll.rows && gmAll.rows.length > 0) {
        defaultGodownId = gmAll.rows[0].id;
        defaultGodownName = gmAll.rows[0].godown_name;
      }
    } catch (e) {}
  }

  for (const item of items) {
    let itemName = (item.item_name || '').trim();
    let lotNo = item.lot_no ? String(item.lot_no).trim() : '';
    const qty = parseFloat(item.qty) || 0;
    const weightPerUnit = parseFloat(item.weight) || 0;
    const totalWt = parseFloat(item.total_wt) || (qty * weightPerUnit);
    const type = item.type || 'input';

    if (!itemName || qty <= 0) continue;

    let itemId = null;
    try {
      const im = await db.query(`SELECT id, item_name FROM item_master WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) LIMIT 1`, [itemName], cId);
      if (im.rows && im.rows.length > 0) {
        itemId = im.rows[0].id;
        itemName = im.rows[0].item_name; // Use master exact item_name
      } else {
        const isOutput = (type === 'output');
        const grp = isOutput ? 'Finished Goods' : 'Raw Material';
        const newIm = await db.run(`INSERT INTO item_master (item_name, item_group, status) VALUES (?, ?, 'Active')`, [itemName, grp], cId);
        itemId = newIm.lastID;
      }
    } catch (e) {
      console.error('Error checking item_master for weight conversion:', e);
    }

    if (type === 'input') {
      // Find specific input lot godown
      let itemGodownId = defaultGodownId;
      let itemGodownName = defaultGodownName;
      if (lotNo) {
        try {
          const lRes = await db.query(
            `SELECT godown_id, godown_name FROM stock_lots WHERE lot_no = ? OR (LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND lot_no = ?) LIMIT 1`,
            [lotNo, itemName, lotNo],
            cId
          );
          if (lRes && lRes.rows && lRes.rows.length > 0 && (lRes.rows[0].godown_id || lRes.rows[0].godown_name)) {
            itemGodownId = lRes.rows[0].godown_id || itemGodownId;
            itemGodownName = lRes.rows[0].godown_name || itemGodownName;
          } else {
            const sRes = await db.query(
              `SELECT godown, godown_id FROM stock WHERE lot_no = ? AND LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND qty > 0 ORDER BY id DESC LIMIT 1`,
              [lotNo, itemName],
              cId
            );
            if (sRes && sRes.rows && sRes.rows.length > 0) {
              itemGodownName = sRes.rows[0].godown || itemGodownName;
              itemGodownId = sRes.rows[0].godown_id || itemGodownId;
            }
          }
        } catch (e) {}
      }
      if (itemGodownId && !itemGodownName) {
        try {
          const gm = await db.query(`SELECT godown_name FROM godown_master WHERE CAST(id AS TEXT) = CAST(? AS TEXT) LIMIT 1`, [itemGodownId], cId);
          if (gm && gm.rows && gm.rows.length > 0) itemGodownName = gm.rows[0].godown_name;
        } catch (e) {}
      }

      // Deduct from stock_lots
      if (lotNo) {
        await db.run(
          `UPDATE stock_lots SET remaining_quantity = CASE WHEN remaining_quantity >= ? THEN remaining_quantity - ? ELSE 0 END WHERE lot_no = ? OR (LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND lot_no = ?)`,
          [qty, qty, lotNo, itemName, lotNo],
          cId
        );
      }

      await db.run(
        `INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'Weight Conversion Input', ?, ?, ?)`,
        [date, itemId, itemName, lotNo, -qty, -totalWt, conversionId, itemGodownName, itemGodownId],
        cId
      );
    } else if (type === 'output') {
      if (!lotNo) {
        try {
          lotNo = await reserveNextLotNumber(cId);
          await db.run(`UPDATE weight_conversion_items SET lot_no = ? WHERE CAST(weight_conversion_id AS TEXT) = CAST(? AS TEXT) AND item_name = ? AND type = 'output'`, [lotNo, conversionId, itemName], cId);
        } catch (e) {
          lotNo = `LOT_WC_${conversionId}`;
        }
      } else {
        try {
          await recordLotNumber(lotNo, cId);
        } catch (e) {}
      }

      // Determine output godown:
      // If Finished Goods, prefer Finished Goods Godown if available, else defaultGodown
      let outGodownId = defaultGodownId;
      let outGodownName = defaultGodownName;
      try {
        const fgRes = await db.query(`SELECT id, godown_name FROM godown_master WHERE LOWER(godown_name) LIKE '%finished%' LIMIT 1`, [], cId);
        if (fgRes && fgRes.rows && fgRes.rows.length > 0) {
          outGodownId = fgRes.rows[0].id;
          outGodownName = fgRes.rows[0].godown_name;
        }
      } catch (e) {}

      // Check existing stock_lots
      const existing = await db.query(
        `SELECT id FROM stock_lots WHERE lot_no = ? OR (LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND lot_no = ?) LIMIT 1`,
        [lotNo, itemName, lotNo],
        cId
      );
      if (existing.rows && existing.rows.length > 0) {
        await db.run(
          `UPDATE stock_lots SET quantity = quantity + ?, remaining_quantity = remaining_quantity + ? WHERE id = ?`,
          [qty, qty, existing.rows[0].id],
          cId
        );
      } else {
        await db.run(
          `INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate, usable_for_production, approval_status, qc_status, godown_id, godown_name, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, 'APPROVED', 'ACCEPTED', ?, ?, ?)`,
          [itemId, itemName, lotNo, conversionId, qty, qty, outGodownId, outGodownName, date ? `${date} 12:00:00` : new Date().toISOString().replace('T', ' ').substring(0, 19)],
          cId
        );
      }

      await db.run(
        `INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id, godown, godown_id) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'Weight Conversion Output', ?, ?, ?)`,
        [date, itemId, itemName, lotNo, qty, totalWt, conversionId, outGodownName, outGodownId],
        cId
      );
    }
  }
};

// Sync existing weight conversion records into stock if missing, and heal godowns
const syncExistingWeightConversions = async () => {
  try {
    const wcResult = await db.query(`SELECT * FROM weight_conversion`);
    const conversions = wcResult.rows || [];
    for (const wc of conversions) {
      const stockCheck = await db.query(`SELECT id FROM stock WHERE CAST(reference_id AS TEXT) = CAST(? AS TEXT) AND type LIKE 'Weight Conversion%'`, [wc.id]);
      if ((stockCheck.rows || []).length === 0) {
        const itemsResult = await db.query(`SELECT * FROM weight_conversion_items WHERE CAST(weight_conversion_id AS TEXT) = CAST(? AS TEXT)`, [wc.id]);
        const items = itemsResult.rows || [];
        await processWeightConversionStock(wc.id, wc.date, items, 1);
        console.log(`Synced Weight Conversion ID ${wc.id} into stock table`);
      }
    }

    // Auto-heal godowns of existing Weight Conversion Input stock rows
    await db.run(`
      UPDATE stock
      SET 
        godown = (
          SELECT COALESCE(sl.godown_name, g.godown_name, s_orig.godown)
          FROM stock s_orig
          LEFT JOIN stock_lots sl ON sl.lot_no = s_orig.lot_no
          LEFT JOIN godown_master g ON CAST(sl.godown_id AS TEXT) = CAST(g.id AS TEXT)
          WHERE s_orig.lot_no = stock.lot_no AND s_orig.qty > 0 AND s_orig.type NOT LIKE 'Weight Conversion%'
          LIMIT 1
        ),
        godown_id = (
          SELECT COALESCE(sl.godown_id, s_orig.godown_id)
          FROM stock s_orig
          LEFT JOIN stock_lots sl ON sl.lot_no = s_orig.lot_no
          WHERE s_orig.lot_no = stock.lot_no AND s_orig.qty > 0 AND s_orig.type NOT LIKE 'Weight Conversion%'
          LIMIT 1
        )
      WHERE type = 'Weight Conversion Input'
        AND EXISTS (
          SELECT 1 FROM stock s_orig2 WHERE s_orig2.lot_no = stock.lot_no AND s_orig2.qty > 0 AND s_orig2.type NOT LIKE 'Weight Conversion%'
        )
    `);
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
    const cId = req.companyId || req.headers?.['x-company-id'] || 1;
    if (req.query.flat === 'true' || req.query.display === 'true') {
      const flatResult = await db.query(`
        SELECT 
          wc.id, 
          wc.s_no, 
          wc.date, 
          wc.remarks, 
          wc.type, 
          wci.id AS item_id,
          wci.item_name, 
          wci.lot_no, 
          wci.weight, 
          wci.qty, 
          wci.total_wt,
          COALESCE(wci.type, 'input') as item_type
        FROM weight_conversion wc 
        LEFT JOIN weight_conversion_items wci ON CAST(wc.id AS TEXT) = CAST(wci.weight_conversion_id AS TEXT)
        ORDER BY wc.id DESC, wci.s_no ASC
      `, [], cId);
      return res.json(flatResult.rows || []);
    }

    const result = await db.query(`
      SELECT * FROM weight_conversion ORDER BY id DESC
    `, [], cId);
    
    const weightConversions = [];
    for (const wc of (result.rows || [])) {
      const itemsResult = await db.query(
        'SELECT * FROM weight_conversion_items WHERE CAST(weight_conversion_id AS TEXT) = CAST(? AS TEXT)',
        [wc.id],
        cId
      );
      weightConversions.push({
        ...wc,
        items: itemsResult.rows || []
      });
    }
    
    res.json(weightConversions);
  } catch (error) {
    console.error('Error fetching weight conversion:', error);
    res.status(500).json({ message: 'Error fetching weight conversion records', error: error.message });
  }
});

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
    const formData = req.body.formData || req.body || {};
    const items = req.body.items || [];
    const weightConversionId = req.params.id;
    const companyId = req.companyId || req.headers?.['x-company-id'] || 1;

    // Revert existing stock
    await revertWeightConversionStock(weightConversionId, companyId);

    // Update weight conversion
    await db.run(`
      UPDATE weight_conversion SET s_no = ?, date = ?, remarks = ?, type = ?
      WHERE CAST(id AS TEXT) = CAST(? AS TEXT)
    `, [formData.sNo || formData.s_no, formData.date, formData.remarks || '', formData.type || 'RM', weightConversionId], companyId);

    // Delete existing items
    await db.run('DELETE FROM weight_conversion_items WHERE CAST(weight_conversion_id AS TEXT) = CAST(? AS TEXT)', [weightConversionId], companyId);

    // Insert updated items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await db.run(`
        INSERT INTO weight_conversion_items (weight_conversion_id, s_no, item_name, lot_no, weight, qty, total_wt, type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [weightConversionId, i + 1, item.item_name, item.lot_no || '', item.weight || 0, item.qty, item.total_wt || 0, item.type || 'input'], companyId);
    }

    // Process updated stock
    await processWeightConversionStock(weightConversionId, formData.date, items, companyId);

    res.json({ success: true, message: 'Weight conversion record updated successfully!' });
  } catch (error) {
    console.error('Error updating weight conversion:', error);
    res.status(500).json({ success: false, message: 'Error updating weight conversion: ' + error.message });
  }
});

// DELETE weight conversion
router.delete('/:id', async (req, res) => {
  try {
    const companyId = req.companyId || req.headers?.['x-company-id'] || 1;
    await revertWeightConversionStock(req.params.id, companyId);
    await db.run('DELETE FROM weight_conversion_items WHERE CAST(weight_conversion_id AS TEXT) = CAST(? AS TEXT)', [req.params.id], companyId);
    await db.run('DELETE FROM weight_conversion WHERE CAST(id AS TEXT) = CAST(? AS TEXT)', [req.params.id], companyId);
    res.json({ success: true, message: 'Weight conversion record deleted successfully' });
  } catch (error) {
    console.error('Error deleting weight conversion:', error);
    res.status(500).json({ success: false, message: 'Error deleting weight conversion', error: error.message });
  }
});

module.exports = router
