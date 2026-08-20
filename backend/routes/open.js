const express = require('express')
const router = express.Router()
const db = require('../config/database')

<<<<<<< HEAD
// GET next S.No
router.get('/next-sno', async (req, res) => {
  try {
    const result = await db.query('SELECT COALESCE(MAX(CAST(s_no AS INTEGER)), 0) + 1 AS next_sno FROM open')
    const next_sno = result.rows[0]?.next_sno || 1
    res.json({ success: true, next_sno, data: { s_no: next_sno } })
  } catch (error) {
    console.error('Error getting next s_no:', error.message)
    res.status(500).json({ success: false, message: 'Error getting next s_no', error: error.message })
  }
})

// GET all open entries
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM open ORDER BY CAST(s_no AS INTEGER) DESC, id DESC')
    const entries = result.rows || []

    for (const entry of entries) {
      const itemsResult = await db.query('SELECT * FROM open_items WHERE open_id = ? ORDER BY id ASC', [entry.id])
      entry.items = itemsResult.rows || []
    }

    res.json(entries)
=======
// GET all open entries
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM open ORDER BY id DESC')
    res.json(result.rows)
>>>>>>> origin/main
  } catch (error) {
    console.error('Error fetching open entries:', error)
    res.status(500).json({ message: 'Error fetching open entries', error: error.message })
  }
})

// GET single open entry by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM open WHERE id = ?', [req.params.id])

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Open entry not found' })
    }

<<<<<<< HEAD
    const entry = result.rows[0]
    const itemsResult = await db.query('SELECT * FROM open_items WHERE open_id = ? ORDER BY id ASC', [entry.id])
    entry.items = itemsResult.rows || []

    res.json(entry)
=======
    res.json(result.rows[0])
>>>>>>> origin/main
  } catch (error) {
    console.error('Error fetching open entry:', error)
    res.status(500).json({ message: 'Error fetching open entry', error: error.message })
  }
})

// POST create new open entry
router.post('/', async (req, res) => {
  try {
<<<<<<< HEAD
    const { s_no, date, description, amount, remarks, type, papad_comp, items } = req.body
=======
    const { s_no, date, description, amount, remarks } = req.body
>>>>>>> origin/main

    if (!s_no || !date) {
      return res.status(400).json({ message: 'S.No and Date are required' })
    }

    const result = await db.run(
<<<<<<< HEAD
      'INSERT INTO open (s_no, date, description, amount, remarks, type, papad_comp) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [s_no, date, description || '', amount || 0, remarks || '', type || '', papad_comp || '']
    )

    const open_id = result.lastInsertRowid || result.lastID

    if (items && Array.isArray(items)) {
      for (const item of items) {
        await db.run(
          'INSERT INTO open_items (open_id, lot_no, item_name, weight, qty, tot_wt, rate) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [open_id, item.lot_no || '', item.item_name || '', item.weight || '', item.qty || 0, item.tot_wt || 0, item.rate || item.cost || 0]
        )

        // Find or create item_id in item_master
        const itemName = item.item_name || '';
        let itemId = null;
        try {
          const itemRes = await db.query('SELECT id FROM item_master WHERE LOWER(item_name) = LOWER(?)', [itemName]);
          if (itemRes.rows.length > 0) {
            itemId = itemRes.rows[0].id;
          } else {
            const itemInsert = await db.run(`
              INSERT INTO item_master (item_name, item_group, status)
              VALUES (?, 'Raw Materials', 'Active')
            `, [itemName]);
            itemId = itemInsert.lastInsertRowid || itemInsert.lastID;
          }
        } catch (e) {
          console.error("Error managing item_master for opening stock:", e);
        }

        const qty = parseFloat(item.qty) || 0;
        const totWt = parseFloat(item.tot_wt) || 0;
        const rate = parseFloat(item.rate || item.cost) || 0;
        const itemAmount = qty * rate;
        const lotNo = item.lot_no || `LOT-OPEN-${open_id}`;

        // Insert into stock_lots
        await db.run(`
          INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [itemId, itemName, lotNo, open_id, qty, qty, rate]);

        // Insert into stock
        await db.run(`
          INSERT INTO stock (item_id, item_name, lot_no, qty, weight, rate, amount, date, type, reference_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Opening Stock', ?)
        `, [itemId, itemName, lotNo, qty, totWt, rate, itemAmount, date, open_id]);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Open entry created successfully',
      id: open_id
=======
      'INSERT INTO open (s_no, date, description, amount, remarks) VALUES (?, ?, ?, ?, ?)',
      [s_no, date, description || '', amount || 0, remarks || '']
    )

    res.status(201).json({
      message: 'Open entry created successfully',
      id: result.lastID
>>>>>>> origin/main
    })
  } catch (error) {
    console.error('Error creating open entry:', error)
    if (error.message.includes('UNIQUE constraint failed')) {
<<<<<<< HEAD
      res.status(400).json({ success: false, message: 'Open entry with this S.No already exists' })
    } else {
      res.status(500).json({ success: false, message: 'Error creating open entry', error: error.message })
=======
      res.status(400).json({ message: 'Open entry with this S.No already exists' })
    } else {
      res.status(500).json({ message: 'Error creating open entry', error: error.message })
>>>>>>> origin/main
    }
  }
})

// PUT update open entry
router.put('/:id', async (req, res) => {
  try {
<<<<<<< HEAD
    const { s_no, date, description, amount, remarks, type, papad_comp, items } = req.body
    const open_id = req.params.id

    await db.run(
      'UPDATE open SET s_no = ?, date = ?, description = ?, amount = ?, remarks = ?, type = ?, papad_comp = ? WHERE id = ?',
      [s_no, date, description || '', amount || 0, remarks || '', type || '', papad_comp || '', open_id]
    )

    // Revert existing stock and stock_lots first
    await db.run("DELETE FROM stock WHERE reference_id = ? AND type = 'Opening Stock'", [open_id])
    await db.run("DELETE FROM stock_lots WHERE purchase_id = ? AND (lot_no LIKE 'LOT-OPEN-%' OR lot_no IN (SELECT lot_no FROM open_items WHERE open_id = ?))", [open_id, open_id])

    // Delete existing items
    await db.run('DELETE FROM open_items WHERE open_id = ?', [open_id])

    // Insert updated items
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await db.run(
          'INSERT INTO open_items (open_id, lot_no, item_name, weight, qty, tot_wt, rate) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [open_id, item.lot_no || '', item.item_name || '', item.weight || '', item.qty || 0, item.tot_wt || 0, item.rate || item.cost || 0]
        )

        // Find or create item_id in item_master
        const itemName = item.item_name || '';
        let itemId = null;
        try {
          const itemRes = await db.query('SELECT id FROM item_master WHERE LOWER(item_name) = LOWER(?)', [itemName]);
          if (itemRes.rows.length > 0) {
            itemId = itemRes.rows[0].id;
          } else {
            const itemInsert = await db.run(`
              INSERT INTO item_master (item_name, item_group, status)
              VALUES (?, 'Raw Materials', 'Active')
            `, [itemName]);
            itemId = itemInsert.lastInsertRowid || itemInsert.lastID;
          }
        } catch (e) {
          console.error("Error managing item_master for opening stock:", e);
        }

        const qty = parseFloat(item.qty) || 0;
        const totWt = parseFloat(item.tot_wt) || 0;
        const rate = parseFloat(item.rate || item.cost) || 0;
        const itemAmount = qty * rate;
        const lotNo = item.lot_no || `LOT-OPEN-${open_id}`;

        // Insert into stock_lots
        await db.run(`
          INSERT INTO stock_lots (item_id, item_name, lot_no, purchase_id, quantity, remaining_quantity, rate)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [itemId, itemName, lotNo, open_id, qty, qty, rate]);

        // Insert into stock
        await db.run(`
          INSERT INTO stock (item_id, item_name, lot_no, qty, weight, rate, amount, date, type, reference_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Opening Stock', ?)
        `, [itemId, itemName, lotNo, qty, totWt, rate, itemAmount, date, open_id]);
      }
    }

    res.json({ success: true, message: 'Open entry updated successfully' })
  } catch (error) {
    console.error('Error updating open entry:', error)
    res.status(500).json({ success: false, message: 'Error updating open entry', error: error.message })
=======
    const { s_no, date, description, amount, remarks } = req.body

    const result = await db.run(
      'UPDATE open SET s_no = ?, date = ?, description = ?, amount = ?, remarks = ? WHERE id = ?',
      [s_no, date, description || '', amount || 0, remarks || '', req.params.id]
    )

    if (result.changes > 0) {
      res.json({ message: 'Open entry updated successfully' })
    } else {
      res.status(404).json({ message: 'Open entry not found' })
    }
  } catch (error) {
    console.error('Error updating open entry:', error)
    res.status(500).json({ message: 'Error updating open entry', error: error.message })
>>>>>>> origin/main
  }
})

// DELETE open entry
router.delete('/:id', async (req, res) => {
  try {
<<<<<<< HEAD
    const open_id = req.params.id

    await db.run("DELETE FROM stock WHERE reference_id = ? AND type = 'Opening Stock'", [open_id])
    await db.run("DELETE FROM stock_lots WHERE purchase_id = ? AND (lot_no LIKE 'LOT-OPEN-%' OR lot_no IN (SELECT lot_no FROM open_items WHERE open_id = ?))", [open_id, open_id])
    await db.run('DELETE FROM open_items WHERE open_id = ?', [open_id])

    const result = await db.run('DELETE FROM open WHERE id = ?', [open_id])

    if (result.changes > 0) {
      res.json({ success: true, message: 'Open entry deleted successfully' })
    } else {
      res.status(404).json({ success: false, message: 'Open entry not found' })
    }
  } catch (error) {
    console.error('Error deleting open entry:', error)
    res.status(500).json({ success: false, message: 'Error deleting open entry', error: error.message })
=======
    const result = await db.run('DELETE FROM open WHERE id = ?', [req.params.id])

    if (result.changes > 0) {
      res.json({ message: 'Open entry deleted successfully' })
    } else {
      res.status(404).json({ message: 'Open entry not found' })
    }
  } catch (error) {
    console.error('Error deleting open entry:', error)
    res.status(500).json({ message: 'Error deleting open entry', error: error.message })
>>>>>>> origin/main
  }
})

module.exports = router
