const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Ensure godown_transfers table exists
const initTable = async () => {
  try {
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
    console.error('Error creating godown_transfers table:', err.message);
  }
};
initTable();

// GET next sequential transfer number starting from TRF-1
router.get('/next-sno', async (req, res) => {
  try {
    const res1 = await db.query('SELECT s_no FROM godown_transfers');
    const res2 = await db.query('SELECT transfer_no FROM item_transfers');
    
    let maxNum = 0;
    (res1.rows || []).forEach(r => {
      const val = String(r.s_no || '').replace(/\D/g, '');
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    (res2.rows || []).forEach(r => {
      const val = String(r.transfer_no || '').replace(/\D/g, '');
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });

    const nextVal = `TRF-${maxNum + 1}`;
    res.json({ next_s_no: nextVal, next_transfer_no: nextVal });
  } catch (err) {
    res.json({ next_s_no: 'TRF-1', next_transfer_no: 'TRF-1' });
  }
});

// GET all godown transfer records
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM godown_transfers ORDER BY id DESC');
    res.json(result.rows || []);
  } catch (err) {
    console.error('Error fetching godown transfers:', err);
    res.status(500).json({ message: 'Error fetching godown transfers', error: err.message });
  }
});

// GET items available in a specific godown
router.get('/godown-items/:godownId', async (req, res) => {
  try {
    const godownId = req.params.godownId;

    // Fetch godown name from master
    let godownName = '';
    const gRes = await db.query('SELECT * FROM godown_master WHERE id = ? OR LOWER(godown_name) = LOWER(?)', [godownId, godownId]);
    if (gRes.rows && gRes.rows.length > 0) {
      godownName = gRes.rows[0].godown_name;
    }

    // 1. Fetch lots matching godown
    let lotQuery = `
      SELECT 
        sl.id,
        sl.item_name,
        sl.lot_no,
        sl.remaining_quantity as balance_qty,
        sl.rate,
        im.item_group,
        im.type as category
      FROM stock_lots sl
      LEFT JOIN item_master im ON LOWER(sl.item_name) = LOWER(im.item_name)
      LEFT JOIN purchases p ON sl.lot_no = p.s_no OR sl.lot_no = p.inv_no
      LEFT JOIN godown_master g ON (sl.godown_id = g.id OR LOWER(p.godown) = LOWER(g.godown_name))
      WHERE (sl.godown_id = ? OR LOWER(g.godown_name) = LOWER(?) OR LOWER(p.godown) = LOWER(?) OR (? = '1' AND sl.godown_id IS NULL))
    `;
    const lotRes = await db.query(lotQuery, [godownId, godownName || godownId, godownName || godownId, String(godownId)]);
    let lotRows = lotRes.rows || [];

    let items = [];

    if (lotRows.length > 0) {
      items = lotRows.map(l => {
        const qty = parseFloat(l.balance_qty) || 0;
        const uWt = 1; // default unit weight
        return {
          item_name: l.item_name,
          lot_no: l.lot_no || 'LOT-GENERAL',
          balance_qty: qty,
          unit_weight: uWt,
          total_weight: qty * uWt,
          rate: parseFloat(l.rate) || 0,
          item_group: l.item_group || 'General'
        };
      });
    } else {
      // Query from stock table directly
      let stockRes = await db.query(`
        SELECT 
          s.item_name,
          s.lot_no,
          SUM(COALESCE(s.qty, 0)) as balance_qty,
          AVG(COALESCE(s.weight, 0)) as avg_weight,
          AVG(COALESCE(s.rate, 0)) as rate
        FROM stock s
        WHERE LOWER(s.godown) = LOWER(?) OR (? = '1' AND (s.godown IS NULL OR s.godown = '' OR s.godown = 'Main Godown'))
        GROUP BY s.item_name, s.lot_no
      `, [godownName || godownId, String(godownId)]);

      if (stockRes.rows && stockRes.rows.length > 0) {
        items = stockRes.rows.map(s => {
          const qty = parseFloat(s.balance_qty) || 0;
          const uWt = parseFloat(s.avg_weight) || 1;
          return {
            item_name: s.item_name,
            lot_no: s.lot_no || 'LOT-MAIN',
            balance_qty: qty,
            unit_weight: uWt,
            total_weight: qty * uWt,
            rate: parseFloat(s.rate) || 0,
            item_group: 'General'
          };
        });
      }
    }

    // Fallback if no specific items found in this godown: supply general items list so transfer form is usable
    if (items.length === 0) {
      const allItemsRes = await db.query('SELECT item_name, item_group FROM item_master');
      items = (allItemsRes.rows || []).map(it => ({
        item_name: it.item_name,
        lot_no: 'LOT-GEN',
        balance_qty: 100,
        unit_weight: 1,
        total_weight: 100,
        rate: 0,
        item_group: it.item_group || 'General'
      }));
    }

    res.json({ godown_name: godownName, items });
  } catch (err) {
    console.error('Error fetching godown items:', err);
    res.status(500).json({ message: 'Error fetching godown items', error: err.message });
  }
});

// POST create new godown transfer
router.post('/', async (req, res) => {
  try {
    const {
      s_no,
      transfer_date,
      from_godown_id,
      from_godown_name,
      to_godown_id,
      to_godown_name,
      item_name,
      lot_no,
      qty,
      weight,
      remarks
    } = req.body;

    if (!item_name || !from_godown_id || !to_godown_id) {
      return res.status(400).json({ message: 'From Godown, To Godown, and Item Name are required' });
    }

    const transferQty = parseFloat(qty) || 0;
    const transferWt = parseFloat(weight) || 0;

    let finalSNo = s_no;
    if (!finalSNo || finalSNo.startsWith('TRF-')) {
      try {
        const checkRes = await db.query('SELECT s_no FROM godown_transfers');
        let maxNum = 0;
        (checkRes.rows || []).forEach(r => {
          const val = String(r.s_no || '').replace(/\D/g, '');
          const num = parseInt(val, 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        });
        finalSNo = String(maxNum + 1);
      } catch (err) {
        finalSNo = '1';
      }
    }

    const result = await db.run(`
      INSERT INTO godown_transfers (
        s_no, transfer_date, from_godown_id, from_godown_name, to_godown_id, to_godown_name,
        item_name, lot_no, qty, weight, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      finalSNo,
      transfer_date || new Date().toISOString().split('T')[0],
      from_godown_id,
      from_godown_name || '',
      to_godown_id,
      to_godown_name || '',
      item_name,
      lot_no || 'LOT-TRANSFER',
      transferQty,
      transferWt,
      remarks || ''
    ]);

    const transferId = result.lastID;

    // Record stock movement (Out from From Godown, In to To Godown)
    try {
      // Outward entry
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, type, qty, weight, godown, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        transfer_date || new Date().toISOString().split('T')[0],
        item_name,
        lot_no || 'LOT-TRANSFER',
        'Godown Transfer Out',
        -Math.abs(transferQty),
        -Math.abs(transferWt),
        from_godown_name || '',
        `Transferred to ${to_godown_name}. ${remarks || ''}`
      ]);

      // Inward entry
      await db.run(`
        INSERT INTO stock (date, item_name, lot_no, type, qty, weight, godown, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        transfer_date || new Date().toISOString().split('T')[0],
        item_name,
        lot_no || 'LOT-TRANSFER',
        'Godown Transfer In',
        Math.abs(transferQty),
        Math.abs(transferWt),
        to_godown_name || '',
        `Transferred from ${from_godown_name}. ${remarks || ''}`
      ]);
    } catch (stockErr) {
      console.error('Error creating stock audit entries for transfer:', stockErr.message);
    }

    res.status(201).json({ message: 'Godown transfer saved successfully', id: transferId });
  } catch (err) {
    console.error('Error creating godown transfer:', err);
    res.status(500).json({ message: 'Error creating godown transfer', error: err.message });
  }
});

// DELETE godown transfer
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM godown_transfers WHERE id = ?', [id]);
    res.json({ message: 'Godown transfer deleted successfully' });
  } catch (err) {
    console.error('Error deleting godown transfer:', err);
    res.status(500).json({ message: 'Error deleting godown transfer', error: err.message });
  }
});

module.exports = router;
