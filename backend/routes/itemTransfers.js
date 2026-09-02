const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Initialize item_transfers table
const initTable = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS item_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_no TEXT,
        date TEXT,
        from_godown_id INTEGER,
        from_godown_name TEXT,
        to_godown_id INTEGER,
        to_godown_name TEXT,
        item_id INTEGER,
        item_code TEXT,
        item_name TEXT,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        unit TEXT DEFAULT 'kg',
        available_qty REAL DEFAULT 0,
        transfer_qty REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        remarks TEXT,
        created_by TEXT DEFAULT 'Admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure godown_transfers exists for backwards compatibility
    await db.run(`
      CREATE TABLE IF NOT EXISTS godown_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT,
        transfer_date TEXT,
        from_godown_id INTEGER,
        from_godown_name TEXT,
        to_godown_id INTEGER,
        to_godown_name TEXT,
        item_name TEXT,
        lot_no TEXT,
        qty REAL DEFAULT 0,
        weight REAL DEFAULT 0,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('Error initializing item_transfers tables:', err.message);
  }
};
initTable();

// GET next sequential transfer number starting from TRF-1
const getNextTransferNo = async () => {
  try {
    const res1 = await db.query('SELECT transfer_no FROM item_transfers');
    const res2 = await db.query('SELECT s_no FROM godown_transfers');
    
    let maxNum = 0;
    (res1.rows || []).forEach(r => {
      const val = String(r.transfer_no || '').replace(/\D/g, '');
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });

    (res2.rows || []).forEach(r => {
      const val = String(r.s_no || '').replace(/\D/g, '');
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });

    return `TRF-${maxNum + 1}`;
  } catch (err) {
    return 'TRF-1';
  }
};

router.get('/next-sno', async (req, res) => {
  const nextVal = await getNextTransferNo();
  res.json({ next_s_no: nextVal, next_transfer_no: nextVal });
});

router.get('/next-transfer-no', async (req, res) => {
  const nextVal = await getNextTransferNo();
  res.json({ next_s_no: nextVal, next_transfer_no: nextVal });
});

// GET list of item transfers with optional filters
router.get('/', async (req, res) => {
  try {
    const { dateFrom, dateTo, from_date, to_date, fromGodown, from_godown_id, toGodown, to_godown_id, item, lotNo, lot_no } = req.query;

    let query = `SELECT * FROM item_transfers WHERE 1=1`;
    const params = [];

    const startDate = dateFrom || from_date;
    if (startDate) {
      query += ` AND date >= ?`;
      params.push(startDate);
    }

    const endDate = dateTo || to_date;
    if (endDate) {
      query += ` AND date <= ?`;
      params.push(endDate);
    }

    const fgId = fromGodown || from_godown_id;
    if (fgId && fgId !== 'all') {
      query += ` AND (from_godown_id = ? OR LOWER(from_godown_name) LIKE ?)`;
      params.push(fgId, `%${fgId.toString().toLowerCase()}%`);
    }

    const tgId = toGodown || to_godown_id;
    if (tgId && tgId !== 'all') {
      query += ` AND (to_godown_id = ? OR LOWER(to_godown_name) LIKE ?)`;
      params.push(tgId, `%${tgId.toString().toLowerCase()}%`);
    }

    if (item) {
      query += ` AND (LOWER(item_name) LIKE ? OR LOWER(item_code) LIKE ?)`;
      params.push(`%${item.toLowerCase()}%`, `%${item.toLowerCase()}%`);
    }

    const lot = lotNo || lot_no;
    if (lot) {
      query += ` AND LOWER(lot_no) LIKE ?`;
      params.push(`%${lot.toLowerCase()}%`);
    }

    query += ` ORDER BY id DESC`;

    const result = await db.query(query, params);
    res.json(result.rows || []);
  } catch (err) {
    console.error('Error fetching item transfers:', err);
    res.status(500).json({ message: 'Error fetching item transfers', error: err.message });
  }
});

// GET items available in a specific godown
router.get('/godown-items/:godownId', async (req, res) => {
  try {
    const godownId = req.params.godownId;

    // Fetch godown details from master
    let godownName = '';
    const gRes = await db.query('SELECT * FROM godown_master WHERE id = ? OR LOWER(godown_name) = LOWER(?)', [godownId, godownId]);
    if (gRes.rows && gRes.rows.length > 0) {
      godownName = gRes.rows[0].godown_name;
    }

    // Query available stock in this godown from stock_lots and stock tables
    let items = [];

    // 1. Check stock_lots table
    const lotQuery = `
      SELECT 
        sl.id,
        sl.item_name,
        sl.lot_no,
        sl.remaining_quantity as available_qty,
        sl.rate,
        im.id as item_id,
        COALESCE(im.item_code, UPPER(SUBSTR(sl.item_name, 1, 4))) as item_code,
        COALESCE(NULLIF(pi.per_unit_weight, 0), NULLIF(im.weight, 1), 50) as weight,
        COALESCE(im.unit, 'kg') as unit
      FROM stock_lots sl
      LEFT JOIN item_master im ON LOWER(sl.item_name) = LOWER(im.item_name)
      LEFT JOIN purchase_items pi ON sl.lot_no = pi.lot_no
      LEFT JOIN purchases p ON sl.lot_no = p.s_no OR sl.lot_no = p.inv_no
      LEFT JOIN godown_master g ON (sl.godown_id = g.id OR LOWER(p.godown) = LOWER(g.godown_name))
      WHERE (sl.godown_id = ? OR LOWER(g.godown_name) = LOWER(?) OR LOWER(p.godown) = LOWER(?) OR (? = '1' AND (sl.godown_id IS NULL OR sl.godown_id = 0)))
        AND sl.remaining_quantity > 0
        AND (sl.unloading_status IS NULL OR sl.unloading_status != 'RETURNED')
        AND sl.lot_no NOT IN (SELECT DISTINCT lot_no FROM purchase_return_items WHERE lot_no IS NOT NULL AND lot_no != '')
    `;
    let lotRows = [];
    try {
      const lotRes = await db.query(lotQuery, [godownId, godownName || godownId, godownName || godownId, String(godownId)]);
      lotRows = lotRes.rows || [];
    } catch (err) {
      console.log('Notice in lotQuery execution:', err.message);
      // Fallback query without im.weight if column absent
      try {
        const fallbackQuery = `
          SELECT 
            sl.id,
            sl.item_name,
            sl.lot_no,
            sl.remaining_quantity as available_qty,
            sl.rate,
            im.id as item_id,
            COALESCE(im.item_code, UPPER(SUBSTR(sl.item_name, 1, 4))) as item_code,
            COALESCE(pi.per_unit_weight, 50) as weight
          FROM stock_lots sl
          LEFT JOIN item_master im ON LOWER(sl.item_name) = LOWER(im.item_name)
          LEFT JOIN purchase_items pi ON sl.lot_no = pi.lot_no OR (sl.purchase_id = pi.purchase_id AND LOWER(sl.item_name) = LOWER(pi.item_name))
          WHERE sl.remaining_quantity > 0
            AND (sl.unloading_status IS NULL OR sl.unloading_status != 'RETURNED')
            AND sl.lot_no NOT IN (SELECT DISTINCT lot_no FROM purchase_return_items WHERE lot_no IS NOT NULL AND lot_no != '')
        `;
        const fbRes = await db.query(fallbackQuery);
        lotRows = fbRes.rows || [];
      } catch (e2) {
        console.log('Fallback lotQuery error:', e2.message);
      }
    }

    if (lotRows.length > 0) {
      items = lotRows.map(l => {
        const qty = parseFloat(l.available_qty) || 0;
        const wt = parseFloat(l.weight) || 50;
        const lot = l.lot_no || 'LOT-MAIN';
        return {
          item_id: l.item_id || l.id,
          item_code: l.item_code || 'ITEM',
          item_name: l.item_name,
          lot_no: lot,
          available_qty: qty,
          weight: wt,
          unit: l.unit || 'kg',
          rate: parseFloat(l.rate) || 0,
          label: `${l.item_name} (${wt}kg) - ${lot} - Qty ${qty}`
        };
      });
    } else {
      // 2. Query stock ledger table directly
      const stockRes = await db.query(`
        SELECT 
          s.item_name,
          s.lot_no,
          SUM(COALESCE(s.qty, 0)) as available_qty,
          AVG(CASE WHEN s.qty <> 0 THEN ABS(s.weight / s.qty) ELSE COALESCE(s.weight, 50) END) as weight,
          AVG(COALESCE(s.rate, 0)) as rate,
          im.id as item_id,
          COALESCE(im.item_code, UPPER(SUBSTR(s.item_name, 1, 4))) as item_code,
          COALESCE(im.unit, 'kg') as unit
        FROM stock s
        LEFT JOIN item_master im ON LOWER(s.item_name) = LOWER(im.item_name)
        WHERE LOWER(s.godown) = LOWER(?) OR (? = '1' AND (s.godown IS NULL OR s.godown = '' OR s.godown = 'Main Godown'))
        GROUP BY s.item_name, s.lot_no
        HAVING SUM(COALESCE(s.qty, 0)) > 0
      `, [godownName || godownId, String(godownId)]);

      if (stockRes.rows && stockRes.rows.length > 0) {
        items = stockRes.rows.map(s => {
          const qty = parseFloat(s.available_qty) || 0;
          const wt = parseFloat(s.weight) || 50;
          const lot = s.lot_no || 'LOT-MAIN';
          return {
            item_id: s.item_id || 1,
            item_code: s.item_code || 'ITEM',
            item_name: s.item_name,
            lot_no: lot,
            available_qty: qty,
            weight: wt,
            unit: s.unit || 'kg',
            rate: parseFloat(s.rate) || 0,
            label: `${s.item_name} (${wt}kg) - ${lot} - Qty ${qty}`
          };
        });
      }
    }

    // Fallback if no specific items found in this godown: query all available stock lots or item_master
    if (items.length === 0) {
      const allStockLots = await db.query(`
        SELECT 
          sl.id, sl.item_name, sl.lot_no, sl.remaining_quantity as available_qty, sl.rate,
          im.id as item_id, COALESCE(im.item_code, UPPER(SUBSTR(sl.item_name, 1, 4))) as item_code,
          COALESCE(NULLIF(im.weight, 1), 50) as weight, COALESCE(im.unit, 'kg') as unit
        FROM stock_lots sl
        LEFT JOIN item_master im ON LOWER(sl.item_name) = LOWER(im.item_name)
        WHERE sl.remaining_quantity > 0
          AND (sl.unloading_status IS NULL OR sl.unloading_status != 'RETURNED')
          AND sl.lot_no NOT IN (SELECT DISTINCT lot_no FROM purchase_return_items WHERE lot_no IS NOT NULL AND lot_no != '')
      `);
      if (allStockLots.rows && allStockLots.rows.length > 0) {
        items = allStockLots.rows.map(l => {
          const qty = parseFloat(l.available_qty) || 0;
          const wt = parseFloat(l.weight) || 50;
          const lot = l.lot_no || 'LOT-MAIN';
          return {
            item_id: l.item_id || l.id,
            item_code: l.item_code || 'ITEM',
            item_name: l.item_name,
            lot_no: lot,
            available_qty: qty,
            weight: wt,
            unit: l.unit || 'kg',
            rate: parseFloat(l.rate) || 0,
            label: `${l.item_name} (${wt}kg) - ${lot} - Qty ${qty}`
          };
        });
      } else {
        const allItemsRes = await db.query('SELECT id, item_code, item_name, weight, unit FROM item_master');
        items = (allItemsRes.rows || []).map((it, idx) => {
          const wt = parseFloat(it.weight) || 50;
          return {
            item_id: it.id,
            item_code: it.item_code || `ITM${100 + idx}`,
            item_name: it.item_name,
            lot_no: '',
            available_qty: 0,
            weight: wt,
            unit: it.unit || 'kg',
            rate: 0,
            label: `${it.item_name} (${wt}kg) - No Stock Available`
          };
        });
      }
    }

    res.json({ godown_name: godownName, items });
  } catch (err) {
    console.error('Error fetching godown items:', err);
    res.status(500).json({ message: 'Error fetching godown items', error: err.message });
  }
});

// GET single item transfer by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM item_transfers WHERE id = ?', [id]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: 'Item transfer record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching item transfer:', err);
    res.status(500).json({ message: 'Error fetching item transfer', error: err.message });
  }
});

// POST create new item transfer
router.post('/', async (req, res) => {
  try {
    const {
      transfer_no,
      s_no,
      date,
      transfer_date,
      from_godown_id,
      from_godown_name,
      to_godown_id,
      to_godown_name,
      items: inputItems,
      item_id,
      item_code,
      item_name,
      lot_no,
      weight,
      unit,
      available_qty,
      transfer_qty,
      qty,
      rate,
      remarks,
      created_by
    } = req.body;

    // Validations
    if (!from_godown_id) {
      return res.status(400).json({ message: 'From Godown is required' });
    }
    if (!to_godown_id) {
      return res.status(400).json({ message: 'To Godown is required' });
    }
    if (String(from_godown_id) === String(to_godown_id)) {
      return res.status(400).json({ message: 'Destination Godown cannot be the same as Source Godown' });
    }

    const itemsToProcess = (Array.isArray(inputItems) && inputItems.length > 0)
      ? inputItems
      : [{
          item_id,
          item_code,
          item_name,
          lot_no,
          weight,
          unit,
          available_qty,
          transfer_qty: transfer_qty || qty,
          rate,
          remarks
        }];

    if (itemsToProcess.length === 0 || !itemsToProcess[0].item_name) {
      return res.status(400).json({ message: 'At least one valid Item is required to transfer' });
    }

    const trfNo = transfer_no || s_no || (await getNextTransferNo());
    const trfDate = date || transfer_date || new Date().toISOString().split('T')[0];

    // Fetch godown names if not provided
    let fGodownName = from_godown_name;
    let tGodownName = to_godown_name;

    if (!fGodownName) {
      const fgRes = await db.query('SELECT godown_name FROM godown_master WHERE id = ?', [from_godown_id]);
      if (fgRes.rows && fgRes.rows.length > 0) fGodownName = fgRes.rows[0].godown_name;
    }
    if (!tGodownName) {
      const tgRes = await db.query('SELECT godown_name FROM godown_master WHERE id = ?', [to_godown_id]);
      if (tgRes.rows && tgRes.rows.length > 0) tGodownName = tgRes.rows[0].godown_name;
    }

    const createdIds = [];

    for (const itm of itemsToProcess) {
      const trfQty = parseFloat(itm.transfer_qty || itm.qty) || 0;
      if (trfQty <= 0) continue;

      const trfWt = parseFloat(itm.weight) || 1;
      const trfRate = parseFloat(itm.rate) || 0;
      const trfAmount = trfQty * trfRate;
      const availQty = parseFloat(itm.available_qty) || 0;
      const itmName = itm.item_name;
      const lotNo = itm.lot_no || 'LOT-MAIN';
      const itemRemarks = itm.remarks || remarks || '';

      // Insert into item_transfers
      const result = await db.run(`
        INSERT INTO item_transfers (
          transfer_no, date, from_godown_id, from_godown_name, to_godown_id, to_godown_name,
          item_id, item_code, item_name, lot_no, weight, unit, available_qty, transfer_qty,
          rate, amount, remarks, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        trfNo,
        trfDate,
        from_godown_id,
        fGodownName || 'Main Godown',
        to_godown_id,
        tGodownName || 'Destination Godown',
        itm.item_id || 1,
        itm.item_code || '',
        itmName,
        lotNo,
        trfWt,
        itm.unit || 'kg',
        availQty,
        trfQty,
        trfRate,
        trfAmount,
        itemRemarks,
        created_by || 'Admin'
      ]);

      createdIds.push(result.lastID);

      // Insert into godown_transfers for legacy compatibility
      try {
        await db.run(`
          INSERT INTO godown_transfers (
            s_no, transfer_date, from_godown_id, from_godown_name, to_godown_id, to_godown_name,
            item_name, lot_no, qty, weight, remarks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          trfNo, trfDate, from_godown_id, fGodownName, to_godown_id, tGodownName,
          itmName, lotNo, trfQty, trfWt * trfQty, itemRemarks
        ]);
      } catch (gErr) {
        console.warn('Legacy godown_transfers insert warning:', gErr.message);
      }

      // Update Stock Ledger (Outward & Inward)
      try {
        const totWt = trfWt * trfQty;

        // 1. Outward entry from source godown
        await db.run(`
          INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, godown, godown_id, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          trfDate,
          itm.item_id || null,
          itmName,
          lotNo,
          'Item Transfer Out',
          -Math.abs(trfQty),
          -Math.abs(totWt),
          trfRate,
          fGodownName,
          from_godown_id,
          `[${transfer_no}] Transferred to ${tGodownName}. ${itemRemarks}`
        ]);

        // 2. Inward entry to destination godown
        await db.run(`
          INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, godown, godown_id, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          trfDate,
          itm.item_id || null,
          itmName,
          lotNo,
          'Item Transfer In',
          Math.abs(trfQty),
          Math.abs(totWt),
          trfRate,
          tGodownName,
          to_godown_id,
          `[${transfer_no}] Transferred from ${fGodownName}. ${itemRemarks}`
        ]);

        // 3. Update stock_lots
        if (lotNo) {
          // Reduce from source
          await db.run(`
            UPDATE stock_lots
            SET remaining_quantity = MAX(0, remaining_quantity - ?)
            WHERE LOWER(item_name) = LOWER(?) AND LOWER(lot_no) = LOWER(?) AND (godown_id = ? OR godown_id = CAST(? AS INTEGER) OR godown_id IS NULL)
          `, [trfQty, itmName, lotNo, from_godown_id, from_godown_id]);

          // Increase or create in destination
          const destLotCheck = await db.query(`
            SELECT id FROM stock_lots
            WHERE LOWER(item_name) = LOWER(?) AND LOWER(lot_no) = LOWER(?) AND (godown_id = ? OR godown_id = CAST(? AS INTEGER))
          `, [itmName, lotNo, to_godown_id, to_godown_id]);

          if (destLotCheck.rows && destLotCheck.rows.length > 0) {
            await db.run(`
              UPDATE stock_lots
              SET remaining_quantity = remaining_quantity + ?
              WHERE id = ?
            `, [trfQty, destLotCheck.rows[0].id]);
          } else {
            const srcLotRes = await db.query(`
              SELECT item_id, purchase_id, qc_status, usable_for_production, approval_status, unloading_status
              FROM stock_lots
              WHERE LOWER(item_name) = LOWER(?) AND LOWER(lot_no) = LOWER(?)
              LIMIT 1
            `, [itmName, lotNo]);
            const sInfo = (srcLotRes.rows && srcLotRes.rows[0]) ? srcLotRes.rows[0] : {};

            await db.run(`
              INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, godown_id, quantity, remaining_quantity, rate, qc_status, usable_for_production, approval_status, unloading_status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              sInfo.item_id || itm.item_id || null,
              itmName,
              lotNo,
              sInfo.purchase_id || null,
              to_godown_id,
              0,
              trfQty,
              trfRate,
              sInfo.qc_status || 'ACCEPTED',
              sInfo.usable_for_production !== undefined ? sInfo.usable_for_production : 1,
              sInfo.approval_status || 'APPROVED',
              sInfo.unloading_status || 'UNLOADED'
            ]);
          }
        }
      } catch (sErr) {
        console.error('Error updating stock audit for transfer:', sErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Item Transfer recorded successfully',
      transfer_no: trfNo,
      ids: createdIds,
      id: createdIds[0]
    });
  } catch (err) {
    console.error('Error creating item transfer:', err);
    res.status(500).json({ message: 'Error creating item transfer', error: err.message });
  }
});

// DELETE item transfer
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch transfer detail before deletion to revert stock
    const trfRes = await db.query('SELECT * FROM item_transfers WHERE id = ?', [id]);
    if (trfRes.rows && trfRes.rows.length > 0) {
      const trf = trfRes.rows[0];
      const trfQty = parseFloat(trf.transfer_qty) || 0;
      const trfWt = parseFloat(trf.weight) || 1;
      const totWt = trfQty * trfWt;

      // Revert stock: Add back to From Godown, Deduct from To Godown
      try {
        await db.run(`
          INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, godown, godown_id, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          new Date().toISOString().split('T')[0],
          trf.item_id || null,
          trf.item_name,
          trf.lot_no,
          'Transfer Delete Reversal',
          trfQty,
          totWt,
          trf.rate || 0,
          trf.from_godown_name,
          trf.from_godown_id,
          `Reversal of Transfer ${trf.transfer_no}`
        ]);

        await db.run(`
          INSERT INTO stock (date, item_id, item_name, lot_no, type, qty, weight, rate, godown, godown_id, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          new Date().toISOString().split('T')[0],
          trf.item_id || null,
          trf.item_name,
          trf.lot_no,
          'Transfer Delete Reversal',
          -trfQty,
          -totWt,
          trf.rate || 0,
          trf.to_godown_name,
          trf.to_godown_id,
          `Reversal of Transfer ${trf.transfer_no}`
        ]);

        // Revert stock_lots
        if (trf.lot_no) {
          // Re-add to source
          await db.run(`
            UPDATE stock_lots
            SET remaining_quantity = remaining_quantity + ?
            WHERE LOWER(item_name) = LOWER(?) AND LOWER(lot_no) = LOWER(?) AND (godown_id = ? OR godown_id = CAST(? AS INTEGER) OR godown_id IS NULL)
          `, [trfQty, trf.item_name, trf.lot_no, trf.from_godown_id, trf.from_godown_id]);

          // Deduct from destination
          await db.run(`
            UPDATE stock_lots
            SET remaining_quantity = MAX(0, remaining_quantity - ?)
            WHERE LOWER(item_name) = LOWER(?) AND LOWER(lot_no) = LOWER(?) AND (godown_id = ? OR godown_id = CAST(? AS INTEGER))
          `, [trfQty, trf.item_name, trf.lot_no, trf.to_godown_id, trf.to_godown_id]);
        }
      } catch (revErr) {
        console.error('Error recording stock reversal on transfer delete:', revErr);
      }
    }

    await db.run('DELETE FROM item_transfers WHERE id = ?', [id]);
    await db.run('DELETE FROM godown_transfers WHERE id = ?', [id]);

    res.json({ success: true, message: 'Item transfer deleted successfully' });
  } catch (err) {
    console.error('Error deleting item transfer:', err);
    res.status(500).json({ message: 'Error deleting item transfer', error: err.message });
  }
});

module.exports = router;
