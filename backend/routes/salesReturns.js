const express = require('express')
const router = express.Router()
const db = require('../config/database')

// Ensure deduction columns exist in sales_return
async function ensureReturnColumns() {
  const returnCols = [
    "deduction TEXT", "deduction_remarks TEXT", "deduction_amount REAL DEFAULT 0", "grand_total REAL DEFAULT 0"
  ];
  for (const col of returnCols) {
    try {
      await db.run(`ALTER TABLE sales_return ADD COLUMN ${col}`);
    } catch (e) {}
  }
}

// Get all sales returns
router.get('/', async (req, res) => {
  try {
    await ensureReturnColumns();
    const sql = `
      SELECT sr.*, sri.item_name, sri.lot_no, sri.qty, sri.rate, sri.disc_perc, sri.tax_perc, sri.total_amt
      FROM sales_return sr
      LEFT JOIN sales_return_items sri ON sr.id = sri.sales_return_id
      ORDER BY sr.date DESC
    `

    const result = await db.query(sql, [])
    
    // Group items by sales return
    const salesReturnsMap = new Map()
    
    result.rows.forEach(row => {
      const returnId = row.id
      if (!salesReturnsMap.has(returnId)) {
        salesReturnsMap.set(returnId, {
          id: row.id,
          s_no: row.s_no,
          date: row.date,
          customer: row.customer,
          remarks: row.remarks,
          total_qty: row.total_qty,
          total_wt: row.total_wt,
          total_amt: row.total_amt,
          pay_type: row.pay_type,
          tax_type: row.tax_type,
          address: row.address,
          deduction: row.deduction,
          deduction_remarks: row.deduction_remarks,
          deduction_amount: row.deduction_amount,
          grand_total: row.grand_total,
          items: []
        })
      }
      
      if (row.item_name) {
        salesReturnsMap.get(returnId).items.push({
          item_name: row.item_name,
          lot_no: row.lot_no,
          qty: row.qty,
          rate: row.rate,
          disc_perc: row.disc_perc,
          tax_perc: row.tax_perc,
          total_amt: row.total_amt
        })
      }
    })

    const salesReturns = Array.from(salesReturnsMap.values())
    res.json(salesReturns)
  } catch (err) {
    console.error('Error fetching sales returns:', err)
    res.status(500).json({ error: 'Failed to fetch sales returns' })
  }
})

// GET next sequential S.No for sales return
router.get('/next-sno', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        MAX(CAST(s_no AS INTEGER)) as max_sno,
        MAX(id) as max_id,
        COUNT(*) as total_count 
      FROM sales_return
    `);
    const maxVal = Math.max(
      parseInt(result.rows[0]?.max_sno) || 0,
      parseInt(result.rows[0]?.max_id) || 0,
      parseInt(result.rows[0]?.total_count) || 0
    );
    const nextSNo = maxVal + 1;
    res.json({ success: true, next_s_no: String(nextSNo), next_sno: nextSNo, s_no: nextSNo, data: { s_no: nextSNo } });
  } catch (error) {
    console.error('Error fetching next sales return S.No:', error);
    res.status(500).json({ success: false, message: 'Error fetching next S.No', error: error.message });
  }
});

// Get single sales return
router.get('/:id', async (req, res) => {
  try {
    await ensureReturnColumns();
    const { id } = req.params

    const sql = `
      SELECT sr.*, sri.*
      FROM sales_return sr
      LEFT JOIN sales_return_items sri ON sr.id = sri.sales_return_id
      WHERE sr.id = ?
    `

    const result = await db.query(sql, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sales return not found' })
    }

    const salesReturn = {
      ...result.rows[0],
      items: result.rows.map(row => ({
        item_name: row.item_name,
        lot_no: row.lot_no,
        qty: row.qty,
        rate: row.rate,
        disc_perc: row.disc_perc,
        tax_perc: row.tax_perc,
        total_amt: row.total_amt
      }))
    }

    res.json(salesReturn)
  } catch (err) {
    console.error('Error fetching sales return:', err)
    res.status(500).json({ error: 'Failed to fetch sales return' })
  }
})

// Create new sales return
router.post('/', async (req, res) => {
  try {
    await ensureReturnColumns();
    const { 
      s_no, date, customer, pay_type, tax_type, address, remarks, 
      total_qty, total_wt, total_amt, items,
      deduction, deduction_remarks, deduction_amount, grand_total 
    } = req.body

    const sql = `
      INSERT INTO sales_return (
        s_no, date, customer, pay_type, tax_type, address, remarks, 
        total_qty, total_wt, total_amt, deduction, deduction_remarks, deduction_amount, grand_total
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    const result = await db.run(sql, [
      s_no || '', 
      date || new Date().toISOString().split('T')[0], 
      customer || '', 
      pay_type || 'Credit', 
      tax_type || 'Exclusive', 
      address || '', 
      remarks || '', 
      total_qty || 0, 
      total_wt || 0, 
      total_amt || 0,
      deduction || '',
      deduction_remarks || '',
      parseFloat(deduction_amount) || 0,
      parseFloat(grand_total) || parseFloat(total_amt) || 0
    ])
    const salesReturnId = result.lastID || result.lastInsertRowid

    // Insert items and adjust stock
    if (items && items.length > 0) {
      const validItems = items.filter(item => {
        const name = item.item_name || item.itemName;
        return name && String(name).trim() !== '';
      });

      if (validItems.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one item with a valid name is required.' });
      }

      const itemSql = `
        INSERT INTO sales_return_items (sales_return_id, item_name, lot_no, qty, rate, disc_perc, tax_perc, total_amt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `

      for (const item of validItems) {
        const qtyVal = parseFloat(item.qty) || 0;
        const rateVal = parseFloat(item.rate) || 0;

        await db.run(itemSql, [
          salesReturnId,
          item.item_name,
          item.lot_no || '',
          qtyVal,
          rateVal,
          parseFloat(item.disc_perc) || 0,
          parseFloat(item.tax_perc) || 0,
          parseFloat(item.amount || item.total_amt) || 0
        ])

        // Add back returned stock to stock_lots and insert positive stock entry
        if (item.item_name) {
          const lotCheck = await db.query(
            "SELECT id FROM stock_lots WHERE item_name = ? AND lot_no = ?", 
            [item.item_name, item.lot_no || '']
          )
          
          if (lotCheck.rows.length > 0) {
            await db.run(
              "UPDATE stock_lots SET remaining_quantity = remaining_quantity + ? WHERE id = ?", 
              [qtyVal, lotCheck.rows[0].id]
            )
          } else {
            await db.run(
              "INSERT INTO stock_lots (item_name, lot_no, remaining_quantity) VALUES (?, ?, ?)", 
              [item.item_name, item.lot_no || '', qtyVal]
            )
          }

          // Insert positive stock log entry
          await db.run(`
            INSERT INTO stock (date, item_name, lot_no, qty, rate, type, status)
            VALUES (?, ?, ?, ?, ?, 'Sale Return', 'Active')
          `, [date || new Date().toISOString().split('T')[0], item.item_name, item.lot_no || '', qtyVal, rateVal])
        }
      }
    }

    res.status(201).json({ success: true, id: salesReturnId, message: 'Sales return created successfully' })
  } catch (err) {
    console.error('Error creating sales return:', err)
    res.status(500).json({ success: false, error: 'Failed to create sales return' })
  }
})

// Update sales return
router.put('/:id', async (req, res) => {
  try {
    await ensureReturnColumns();
    const { id } = req.params
    const { 
      s_no, date, customer, pay_type, tax_type, address, remarks, 
      total_qty, total_wt, total_amt,
      deduction, deduction_remarks, deduction_amount, grand_total 
    } = req.body

    const sql = `
      UPDATE sales_return
      SET s_no = ?, date = ?, customer = ?, pay_type = ?, tax_type = ?, address = ?, remarks = ?, 
          total_qty = ?, total_wt = ?, total_amt = ?, deduction = ?, deduction_remarks = ?, 
          deduction_amount = ?, grand_total = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `

    const result = await db.run(sql, [
      s_no, date, customer, pay_type, tax_type, address, remarks, 
      total_qty, total_wt, total_amt, deduction, deduction_remarks, 
      deduction_amount, grand_total, id
    ])

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Sales return not found' })
    }

    res.json({ success: true, message: 'Sales return updated successfully' })
  } catch (err) {
    console.error('Error updating sales return:', err)
    res.status(500).json({ success: false, error: 'Failed to update sales return' })
  }
})

// Delete sales return
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Delete items first (due to foreign key constraint)
    await db.run('DELETE FROM sales_return_items WHERE sales_return_id = ?', [id])

    // Delete the sales return
    const result = await db.run('DELETE FROM sales_return WHERE id = ?', [id])

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Sales return not found' })
    }

    res.json({ success: true, message: 'Sales return deleted successfully' })
  } catch (err) {
    console.error('Error deleting sales return:', err)
    res.status(500).json({ success: false, error: 'Failed to delete sales return' })
  }
})

module.exports = router
