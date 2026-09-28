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

  // 1. Identify default godowns for FG and RM
  let defaultFgGodownId = null;
  let defaultFgGodownName = null;
  let defaultRmGodownId = null;
  let defaultRmGodownName = null;
  let fallbackGodownId = null;
  let fallbackGodownName = null;

  try {
    const gmAll = await db.query(`SELECT id, godown_name FROM godown_master ORDER BY id ASC`, [], cId);
    const godowns = gmAll.rows || [];
    for (const g of godowns) {
      const gNameLower = (g.godown_name || '').toLowerCase();
      if (!defaultFgGodownName && (gNameLower.includes('finish') || gNameLower.includes('fg'))) {
        defaultFgGodownId = g.id;
        defaultFgGodownName = g.godown_name;
      }
      if (!defaultRmGodownName && (gNameLower.includes('raw') || gNameLower.includes('rm'))) {
        defaultRmGodownId = g.id;
        defaultRmGodownName = g.godown_name;
      }
    }
    if (godowns.length > 0) {
      fallbackGodownId = godowns[0].id;
      fallbackGodownName = godowns[0].godown_name;
    }
  } catch (e) {
    console.warn('Notice querying godown_master in weightConversion:', e.message);
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
    let itemGroup = (type === 'output' ? 'Finished Goods' : 'Raw Material');
    try {
      const im = await db.query(`SELECT id, item_name, item_group FROM item_master WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) LIMIT 1`, [itemName], cId);
      if (im.rows && im.rows.length > 0) {
        itemId = im.rows[0].id;
        itemName = im.rows[0].item_name; // Use master exact item_name
        if (im.rows[0].item_group) itemGroup = im.rows[0].item_group;
      } else {
        const newIm = await db.run(`INSERT INTO item_master (item_name, item_group, status) VALUES (?, ?, 'Active')`, [itemName, itemGroup], cId);
        itemId = newIm.lastID;
      }
    } catch (e) {
      console.error('Error checking item_master for weight conversion:', e);
    }

    if (type === 'input') {
      // Find specific input lot godown
      let itemGodownId = null;
      let itemGodownName = null;

      if (lotNo) {
        try {
          const lRes = await db.query(
            `SELECT godown_id, godown_name FROM stock_lots WHERE lot_no = ? OR (LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND lot_no = ?) LIMIT 1`,
            [lotNo, itemName, lotNo],
            cId
          );
          if (lRes && lRes.rows && lRes.rows.length > 0) {
            itemGodownId = lRes.rows[0].godown_id || itemGodownId;
            itemGodownName = lRes.rows[0].godown_name || itemGodownName;
          }
        } catch (e) {}

        if (itemGodownId && !itemGodownName) {
          try {
            const gm = await db.query(`SELECT godown_name FROM godown_master WHERE CAST(id AS TEXT) = CAST(? AS TEXT) LIMIT 1`, [itemGodownId], cId);
            if (gm && gm.rows && gm.rows.length > 0) itemGodownName = gm.rows[0].godown_name;
          } catch (e) {}
        }

        if (!itemGodownName && !itemGodownId) {
          try {
            const sRes = await db.query(
              `SELECT godown, godown_id FROM stock WHERE lot_no = ? AND LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND qty > 0 ORDER BY id DESC LIMIT 1`,
              [lotNo, itemName],
              cId
            );
            if (sRes && sRes.rows && sRes.rows.length > 0) {
              itemGodownName = sRes.rows[0].godown || itemGodownName;
              itemGodownId = sRes.rows[0].godown_id || itemGodownId;
            }
          } catch (e) {}
        }
      }

      // Fallback based on item group or default
      if (!itemGodownName) {
        if (itemGroup.toLowerCase().includes('finish') || itemGroup.toLowerCase().includes('fg')) {
          itemGodownName = defaultFgGodownName || fallbackGodownName || 'Finished Goods Godown';
          itemGodownId = defaultFgGodownId || fallbackGodownId;
        } else {
          itemGodownName = defaultRmGodownName || fallbackGodownName || 'Raw Material Godown';
          itemGodownId = defaultRmGodownId || fallbackGodownId;
        }
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

      // Determine output godown
      let outGodownId = defaultFgGodownId || fallbackGodownId;
      let outGodownName = defaultFgGodownName || fallbackGodownName || 'Finished Goods Godown';

      if (itemGroup.toLowerCase().includes('raw') || itemGroup.toLowerCase().includes('rm')) {
        outGodownId = defaultRmGodownId || fallbackGodownId;
        outGodownName = defaultRmGodownName || fallbackGodownName || 'Raw Material Godown';
      }

      // Check existing stock_lots
      const existing = await db.query(
        `SELECT id FROM stock_lots WHERE lot_no = ? OR (LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND lot_no = ?) LIMIT 1`,
        [lotNo, itemName, lotNo],
        cId
      );
      if (existing.rows && existing.rows.length > 0) {
        await db.run(
          `UPDATE stock_lots SET quantity = quantity + ?, remaining_quantity = remaining_quantity + ?, godown_id = ?, godown_name = ? WHERE id = ?`,
          [qty, qty, outGodownId, outGodownName, existing.rows[0].id],
          cId
        );
      } else {
        await db.run(
          `INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate, usable_for_production, approval_status, qc_status, godown_id, godown_name, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, 'APPROVED', 'ACCEPTED', ?, ?, ?)`,
          [itemId, itemName, lotNo, conversionId, qty, qty, outGodownId, outGodownName, date ? `${date} 12:00:00` : new Date().toISOString().replace('T', ' ').substring(0, 19)],
          cId
        );
      }

      // Link input lots to this output lot in lot_genealogy
      const inputItems = items.filter(i => (i.type || 'input') === 'input' && i.lot_no);
      for (const inItem of inputItems) {
        try {
          const genExists = await db.query(
            `SELECT id FROM lot_genealogy WHERE parent_lot_no = ? AND child_lot_no = ? AND transaction_type = 'WEIGHT_CONVERSION' AND transaction_id = ?`,
            [inItem.lot_no, lotNo, conversionId],
            cId
          );
          if (!genExists.rows || genExists.rows.length === 0) {
            await db.run(
              `INSERT INTO lot_genealogy (parent_lot_no, child_lot_no, quantity, uom, transaction_type, transaction_id, transaction_no, remarks) VALUES (?, ?, ?, 'KG', 'WEIGHT_CONVERSION', ?, ?, ?)`,
              [inItem.lot_no, lotNo, qty, conversionId, `WC-${conversionId}`, `Weight Conversion from ${inItem.item_name} (${inItem.lot_no}) to ${itemName}`],
              cId
            );
          }
        } catch (genErr) {
          console.warn('Notice inserting into lot_genealogy:', genErr.message);
        }
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
    // 1. Populate missing godown_name in stock_lots
    await db.run(`
      UPDATE stock_lots
      SET godown_name = (
        SELECT gm.godown_name FROM godown_master gm WHERE CAST(gm.id AS TEXT) = CAST(stock_lots.godown_id AS TEXT) LIMIT 1
      )
      WHERE (godown_name IS NULL OR TRIM(godown_name) = '') AND godown_id IS NOT NULL
    `);

    // 2. Populate missing godown_id in stock_lots
    await db.run(`
      UPDATE stock_lots
      SET godown_id = (
        SELECT gm.id FROM godown_master gm WHERE LOWER(TRIM(gm.godown_name)) = LOWER(TRIM(stock_lots.godown_name)) LIMIT 1
      )
      WHERE godown_id IS NULL AND godown_name IS NOT NULL AND TRIM(godown_name) != ''
    `);

    // 3. Process any unsynced conversions & lot genealogy links
    const wcResult = await db.query(`SELECT * FROM weight_conversion`);
    const conversions = wcResult.rows || [];
    for (const wc of conversions) {
      const itemsResult = await db.query(`SELECT * FROM weight_conversion_items WHERE CAST(weight_conversion_id AS TEXT) = CAST(? AS TEXT)`, [wc.id]);
      const items = itemsResult.rows || [];
      const stockCheck = await db.query(`SELECT id FROM stock WHERE CAST(reference_id AS TEXT) = CAST(? AS TEXT) AND type LIKE 'Weight Conversion%'`, [wc.id]);
      if ((stockCheck.rows || []).length === 0) {
        await processWeightConversionStock(wc.id, wc.date, items, 1);
        console.log(`Synced Weight Conversion ID ${wc.id} into stock table`);
      } else {
        // Ensure lot_genealogy links exist for already processed conversions
        const inItems = items.filter(i => (i.type || 'input') === 'input' && i.lot_no);
        const outItems = items.filter(i => i.type === 'output' && i.lot_no);
        for (const outItem of outItems) {
          for (const inItem of inItems) {
            try {
              const genCheck = await db.query(
                `SELECT id FROM lot_genealogy WHERE parent_lot_no = ? AND child_lot_no = ? AND transaction_type = 'WEIGHT_CONVERSION' AND transaction_id = ?`,
                [inItem.lot_no, outItem.lot_no, wc.id]
              );
              if (!genCheck.rows || genCheck.rows.length === 0) {
                await db.run(
                  `INSERT INTO lot_genealogy (parent_lot_no, child_lot_no, quantity, uom, transaction_type, transaction_id, transaction_no, remarks) VALUES (?, ?, ?, 'KG', 'WEIGHT_CONVERSION', ?, ?, ?)`,
                  [inItem.lot_no, outItem.lot_no, outItem.qty || 0, wc.id, `WC-${wc.s_no || wc.id}`, `Weight Conversion from ${inItem.item_name} (${inItem.lot_no}) to ${outItem.item_name}`]
                );
              }
            } catch (_) {}
          }
        }
      }
    }

    // 4. Auto-heal godowns of existing Weight Conversion Input stock rows
    await db.run(`
      UPDATE stock
      SET 
        godown = COALESCE(
          (SELECT g_sl.godown_name FROM stock_lots sl JOIN godown_master g_sl ON CAST(sl.godown_id AS TEXT) = CAST(g_sl.id AS TEXT) WHERE sl.lot_no = stock.lot_no AND g_sl.godown_name IS NOT NULL LIMIT 1),
          (SELECT sl.godown_name FROM stock_lots sl WHERE sl.lot_no = stock.lot_no AND sl.godown_name IS NOT NULL AND TRIM(sl.godown_name) != '' LIMIT 1),
          (SELECT s_orig.godown FROM stock s_orig WHERE s_orig.lot_no = stock.lot_no AND s_orig.qty > 0 AND s_orig.type NOT LIKE 'Weight Conversion%' AND s_orig.godown IS NOT NULL LIMIT 1),
          stock.godown
        ),
        godown_id = COALESCE(
          (SELECT sl.godown_id FROM stock_lots sl WHERE sl.lot_no = stock.lot_no AND sl.godown_id IS NOT NULL LIMIT 1),
          (SELECT s_orig.godown_id FROM stock s_orig WHERE s_orig.lot_no = stock.lot_no AND s_orig.qty > 0 AND s_orig.type NOT LIKE 'Weight Conversion%' AND s_orig.godown_id IS NOT NULL LIMIT 1),
          (SELECT g_id.id FROM godown_master g_id WHERE LOWER(TRIM(g_id.godown_name)) = LOWER(TRIM(stock.godown)) LIMIT 1),
          stock.godown_id
        )
      WHERE type = 'Weight Conversion Input'
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
