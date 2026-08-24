const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Ensure tables exist
async function initTables() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS packing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        s_no TEXT,
        date TEXT,
        type TEXT,
        papad_comp TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS packing_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        packing_id INTEGER,
        item_name TEXT,
        lot_no TEXT,
        weight REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        tot_wt REAL DEFAULT 0,
        rate REAL DEFAULT 0,
        employee_name TEXT,
        box REAL DEFAULT 0,
        packet REAL DEFAULT 0,
        total_packet REAL DEFAULT 0,
        remarks TEXT,
        FOREIGN KEY (packing_id) REFERENCES packing(id) ON DELETE CASCADE
      )
    `);
  } catch (err) {
    console.error('Error initializing packing tables:', err);
  }
}
initTables();

// Middleware to guarantee tables exist
router.use(async (req, res, next) => {
  await initTables();
  next();
});

// GET next S.No
router.get('/next-sno', async (req, res) => {
  try {
    const result = await db.query('SELECT MAX(CAST(s_no AS INTEGER)) as max_sno, MAX(id) as max_id, COUNT(*) as total_count FROM packing');
    const maxVal = Math.max(
      parseInt(result.rows[0]?.max_sno) || 0,
      parseInt(result.rows[0]?.max_id) || 0,
      parseInt(result.rows[0]?.total_count) || 0
    );
    const nextSNo = maxVal + 1;
    res.json({ success: true, next_s_no: nextSNo, next_sno: nextSNo, s_no: nextSNo, data: { s_no: nextSNo } });
  } catch (error) {
    console.error('Error getting next packing sno:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET all packing entries
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        p.id, p.s_no, p.s_no as sNo, p.date, p.type, p.papad_comp, p.remarks, p.created_at,
        pi.id as item_id, pi.item_name, pi.lot_no, pi.weight, pi.qty, pi.tot_wt, pi.rate,
        pi.employee_name, pi.box, pi.packet, pi.total_packet, pi.remarks as item_remarks
      FROM packing p
      LEFT JOIN packing_items pi ON p.id = pi.packing_id
      ORDER BY p.id DESC, pi.id ASC
    `);

    // Group items by parent packing entry
    const entriesMap = {};
    (result.rows || []).forEach(row => {
      if (!entriesMap[row.id]) {
        entriesMap[row.id] = {
          id: row.id,
          s_no: row.s_no,
          sNo: row.sNo,
          date: row.date,
          type: row.type,
          papad_comp: row.papad_comp,
          remarks: row.remarks,
          created_at: row.created_at,
          items: []
        };
      }
      if (row.item_name || row.lot_no) {
        entriesMap[row.id].items.push({
          id: row.item_id,
          item_name: row.item_name,
          lot_no: row.lot_no,
          weight: row.weight,
          qty: row.qty,
          tot_wt: row.tot_wt,
          rate: row.rate,
          employee_name: row.employee_name,
          box: row.box,
          packet: row.packet,
          total_packet: row.total_packet,
          remarks: row.item_remarks
        });
      }
    });

    res.json(Object.values(entriesMap));
  } catch (error) {
    console.error('Error fetching packing list:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single packing entry
router.get('/:id', async (req, res) => {
  try {
    const parentRes = await db.query('SELECT * FROM packing WHERE id = ?', [req.params.id]);
    if (!parentRes.rows || parentRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Packing entry not found' });
    }

    const itemsRes = await db.query('SELECT * FROM packing_items WHERE packing_id = ? ORDER BY id ASC', [req.params.id]);
    
    const entry = parentRes.rows[0];
    entry.items = itemsRes.rows || [];
    res.json(entry);
  } catch (error) {
    console.error('Error fetching packing entry:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create packing entry
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const formData = body.formData || body;
    const items = body.items || [];

    const sNo = formData.sNo || formData.s_no || formData.sno || '1';
    const date = formData.date || new Date().toISOString().split('T')[0];
    const type = formData.type || 'Packing';
    const papadComp = formData.papadComp || formData.papad_comp || formData.papadCompany || '';
    const remarks = formData.remarks || '';

    const parentResult = await db.run(
      `INSERT INTO packing (s_no, date, type, papad_comp, remarks) VALUES (?, ?, ?, ?, ?)`,
      [sNo, date, type, papadComp, remarks]
    );

    const packingId = parentResult.lastInsertRowid || parentResult.lastID;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const box = parseFloat(item.box) || 0;
        const packet = parseFloat(item.packet) || 0;
        const totalPacket = parseFloat(item.total_packet || item.qty) || (box * packet) || 0;

        await db.run(
          `INSERT INTO packing_items (packing_id, item_name, lot_no, weight, qty, tot_wt, rate, employee_name, box, packet, total_packet, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            packingId,
            item.item_name || item.itemName || '',
            item.lot_no || item.lotNo || '',
            parseFloat(item.weight) || 0,
            totalPacket,
            parseFloat(item.totWt || item.tot_wt) || 0,
            parseFloat(item.rate) || 0,
            item.employee_name || '',
            box,
            packet,
            totalPacket,
            item.remarks || ''
          ]
        );
      }
      await processPackingStock(packingId, date, items);
    }

    res.json({ success: true, id: packingId, message: 'Packing entry saved successfully' });
  } catch (error) {
    console.error('Error creating packing entry:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper to revert stock changes for Packing
const revertPackingStock = async (packingId) => {
  try {
    const items = await db.query(`SELECT * FROM packing_items WHERE packing_id = ?`, [packingId]);
    for (const item of items.rows || []) {
      const itemName = item.item_name;
      const lotNo = item.lot_no;
      const qty = parseFloat(item.qty) || parseFloat(item.weight) || 0;
      const isConsumed = item.remarks === 'section:from' || item.remarks === 'section:material';
      const isProduced = item.remarks === 'section:to';

      if (isConsumed && lotNo && qty > 0) {
        await db.run(
          `UPDATE stock_lots SET remaining_quantity = remaining_quantity + ? WHERE lot_no = ? AND LOWER(item_name) = LOWER(?)`,
          [qty, lotNo, itemName]
        );
      } else if (isProduced && lotNo && qty > 0) {
        await db.run(
          `UPDATE stock_lots SET remaining_quantity = MAX(0, remaining_quantity - ?), quantity = MAX(0, quantity - ?) WHERE lot_no = ? AND LOWER(item_name) = LOWER(?)`,
          [qty, qty, lotNo, itemName]
        );
      }
    }
    await db.run(`DELETE FROM stock WHERE reference_id = ? AND type = 'Packing'`, [packingId]);
  } catch (err) {
    console.error('Error reverting packing stock:', err);
  }
};

const processPackingStock = async (packingId, date, items) => {
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const itemName = item.item_name || item.itemName || '';
    const lotNo = item.lot_no || item.lotNo || '';
    const qty = parseFloat(item.qty) || parseFloat(item.weight) || 0;
    const totWt = parseFloat(item.tot_wt || item.totWt || item.weight) || qty;
    const rate = parseFloat(item.rate) || 0;
    const remarks = item.remarks || '';
    const isConsumed = remarks === 'section:from' || remarks === 'section:material';
    const isProduced = remarks === 'section:to';

    if (!itemName) continue;

    let itemId = null;
    try {
      const im = await db.query(`SELECT id FROM item_master WHERE LOWER(item_name) = LOWER(?)`, [itemName]);
      if (im.rows.length > 0) itemId = im.rows[0].id;
    } catch (e) {}

    if (isConsumed && qty > 0) {
      if (lotNo) {
        const lotRes = await db.query(
          `SELECT id, remaining_quantity FROM stock_lots WHERE LOWER(item_name) = LOWER(?) AND lot_no = ? AND remaining_quantity > 0`,
          [itemName, lotNo]
        );
        if (lotRes.rows.length > 0) {
          const lot = lotRes.rows[0];
          await db.run(
            `UPDATE stock_lots SET remaining_quantity = MAX(0, remaining_quantity - ?) WHERE id = ?`,
            [qty, lot.id]
          );
        } else {
          await db.run(
            `UPDATE stock_lots SET remaining_quantity = MAX(0, remaining_quantity - ?) WHERE lot_no = ?`,
            [qty, lotNo]
          );
        }
      }

      await db.run(
        `INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Packing', ?)`,
        [date, itemId, itemName, lotNo, -qty, -totWt, rate, -(qty * rate), packingId]
      );
    } else if (isProduced && qty > 0) {
      if (lotNo) {
        const existing = await db.query(
          `SELECT id FROM stock_lots WHERE lot_no = ? AND LOWER(item_name) = LOWER(?)`,
          [lotNo, itemName]
        );
        if (existing.rows.length === 0) {
          await db.run(
            `INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate, usable_for_production) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [itemId, itemName, lotNo, packingId, qty, qty, rate]
          );
        } else {
          await db.run(
            `UPDATE stock_lots SET quantity = quantity + ?, remaining_quantity = remaining_quantity + ? WHERE id = ?`,
            [qty, qty, existing.rows[0].id]
          );
        }
      }

      await db.run(
        `INSERT INTO stock (date, item_id, item_name, lot_no, qty, weight, rate, amount, type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Packing', ?)`,
        [date, itemId, itemName, lotNo, qty, totWt, rate, qty * rate, packingId]
      );
    }
  }
};

// PUT update packing entry
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const formData = body.formData || body;
    const items = body.items || [];

    const sNo = formData.sNo || formData.s_no || formData.sno || '1';
    const date = formData.date || new Date().toISOString().split('T')[0];
    const type = formData.type || 'Packing';
    const papadComp = formData.papadComp || formData.papad_comp || formData.papadCompany || '';
    const remarks = formData.remarks || '';

    await revertPackingStock(id);

    await db.run(
      `UPDATE packing SET s_no = ?, date = ?, type = ?, papad_comp = ?, remarks = ? WHERE id = ?`,
      [sNo, date, type, papadComp, remarks, id]
    );

    // Delete existing items and re-insert
    await db.run('DELETE FROM packing_items WHERE packing_id = ?', [id]);

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const box = parseFloat(item.box) || 0;
        const packet = parseFloat(item.packet) || 0;
        const totalPacket = parseFloat(item.total_packet || item.qty) || (box * packet) || 0;

        await db.run(
          `INSERT INTO packing_items (packing_id, item_name, lot_no, weight, qty, tot_wt, rate, employee_name, box, packet, total_packet, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.item_name || item.itemName || '',
            item.lot_no || item.lotNo || '',
            parseFloat(item.weight) || 0,
            totalPacket,
            parseFloat(item.totWt || item.tot_wt) || 0,
            parseFloat(item.rate) || 0,
            item.employee_name || '',
            box,
            packet,
            totalPacket,
            item.remarks || ''
          ]
        );
      }
      await processPackingStock(id, date, items);
    }

    res.json({ success: true, message: 'Packing entry updated successfully' });
  } catch (error) {
    console.error('Error updating packing entry:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE packing entry
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await revertPackingStock(id);
    await db.run('DELETE FROM packing_items WHERE packing_id = ?', [id]);
    await db.run('DELETE FROM packing WHERE id = ?', [id]);
    res.json({ success: true, message: 'Packing entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting packing entry:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
