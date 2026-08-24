const express = require('express')
const router = express.Router()
const db = require('../config/database')

// GET all flour out returns
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        for.id,
        for.s_no as s_no,
        for.s_no as sno,
        for.date,
        COALESCE(pcm.name, for.papad_company) as papad_company,
        COALESCE(pcm.name, for.papad_company) as papadCompany,
        COALESCE(pcm.name, for.papad_company) as flour_mill,
        for.tax_type,
        for.remarks,
        fori.id as item_id,
        fori.item_name,
        fori.lot_no,
        fori.weight,
        fori.qty,
        fori.total_wt,
        fori.papad_kg,
        fori.cost,
        fori.wages_bag as wages_per_bag,
        fori.wages_bag as wages_per_kg,
        fori.wages
      FROM flour_out_returns for
      LEFT JOIN papad_company_master pcm ON (pcm.id = CAST(for.papad_company AS INTEGER) OR pcm.name = for.papad_company)
      LEFT JOIN flour_out_return_items fori ON for.id = fori.flour_out_return_id
      ORDER BY for.created_at DESC, fori.id ASC
    `)
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching flour out returns:', error)
    res.status(500).json({ message: 'Error fetching flour out returns', error: error.message })
  }
})

// GET next sequential S.No for flour out return
router.get('/next-sno', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        MAX(CAST(s_no AS INTEGER)) as max_sno,
        MAX(id) as max_id,
        COUNT(*) as total_count 
      FROM flour_out_returns
    `);
    const maxVal = Math.max(
      parseInt(result.rows[0]?.max_sno) || 0,
      parseInt(result.rows[0]?.max_id) || 0,
      parseInt(result.rows[0]?.total_count) || 0
    );
    const nextSNo = maxVal + 1;
    res.json({ success: true, next_s_no: String(nextSNo), next_sno: nextSNo, s_no: nextSNo, data: { s_no: nextSNo } });
  } catch (error) {
    console.error('Error fetching next flour out return S.No:', error);
    res.status(500).json({ success: false, message: 'Error fetching next S.No', error: error.message });
  }
});

// GET flour out return by ID
router.get('/:id', async (req, res) => {
  try {
    const flourOutReturnResult = await db.query('SELECT * FROM flour_out_returns WHERE id = ?', [req.params.id])
    if (flourOutReturnResult.rows.length === 0) {
      return res.status(404).json({ message: 'Flour out return not found' })
    }

    const itemsResult = await db.query('SELECT * FROM flour_out_return_items WHERE flour_out_return_id = ?', [req.params.id])

    const flourOutReturn = {
      ...flourOutReturnResult.rows[0],
      papadCompany: flourOutReturnResult.rows[0].papad_company,
      items: itemsResult.rows
    }

    res.json(flourOutReturn)
  } catch (error) {
    console.error('Error fetching flour out return:', error)
    res.status(500).json({ message: 'Error fetching flour out return' })
  }
})

// POST create new flour out return
router.post('/', async (req, res) => {
  try {
    const body = req.body || {}
    const fd = body.formData || body
    const items = body.items || []
    const totals = body.totals || {
      totalQty: body.totalQty || 0,
      totalWeight: body.totalWeight || 0,
      totalWages: body.totalWages || 0
    }

    const sNo = fd.sNo || fd.s_no || fd.sno || 1
    const date = fd.date || new Date().toISOString().slice(0, 10)
    const papadCompany = fd.papadCompany || fd.papad_company || fd.company || ''
    const taxType = fd.taxType || fd.tax_type || ''
    const remarks = fd.remarks || ''

    // Insert flour out return
    const flourOutReturnResult = await db.run(`
      INSERT INTO flour_out_returns (s_no, date, papad_company, tax_type, remarks, total_qty, total_weight, total_wages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [sNo, date, papadCompany, taxType, remarks,
         totals.totalQty || 0, totals.totalWeight || 0, totals.totalWages || 0])

    const flourOutReturnId = flourOutReturnResult.lastID

    // Insert flour out return items
    for (const item of items) {
      const itemName = item.itemName || item.item_name || ''
      const lotNo = item.lotNo || item.lot_no || ''
      const weight = item.weight || 0
      const qty = item.qty || 0
      const totalWt = item.totalWt || item.total_wt || 0
      const papadKg = item.papadKg || item.papad_kg || 0
      const cost = item.cost || 0
      const wagesBag = item.wagesBag || item.wages_bag || item.wages_per_bag || 0
      const wages = item.wages || 0

      await db.run(`
        INSERT INTO flour_out_return_items (flour_out_return_id, item_name, lot_no, weight, qty, total_wt, papad_kg, cost, wages_bag, wages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [flourOutReturnId, itemName, lotNo, weight, qty, totalWt, papadKg, cost, wagesBag, wages])
    }

    res.status(201).json({
      success: true,
      message: 'Flour out return saved successfully!',
      id: flourOutReturnId
    })
  } catch (error) {
    console.error('Error saving flour out return:', error)
    res.status(500).json({ success: false, message: 'Error saving flour out return', error: error.message })
  }
})

// PUT update flour out return
router.put('/:id', async (req, res) => {
  try {
    const body = req.body || {}
    const fd = body.formData || body
    const items = body.items || []
    const totals = body.totals || {
      totalQty: body.totalQty || 0,
      totalWeight: body.totalWeight || 0,
      totalWages: body.totalWages || 0
    }
    const flourOutReturnId = req.params.id

    const sNo = fd.sNo || fd.s_no || fd.sno || 1
    const date = fd.date || new Date().toISOString().slice(0, 10)
    const papadCompany = fd.papadCompany || fd.papad_company || fd.company || ''
    const taxType = fd.taxType || fd.tax_type || ''
    const remarks = fd.remarks || ''

    // Update flour out return
    await db.run(`
      UPDATE flour_out_returns SET s_no = ?, date = ?, papad_company = ?, tax_type = ?, remarks = ?,
                                  total_qty = ?, total_weight = ?, total_wages = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [sNo, date, papadCompany, taxType, remarks,
         totals.totalQty || 0, totals.totalWeight || 0, totals.totalWages || 0, flourOutReturnId])

    // Delete existing items
    await db.run('DELETE FROM flour_out_return_items WHERE flour_out_return_id = ?', [flourOutReturnId])

    // Insert updated items
    for (const item of items) {
      const itemName = item.itemName || item.item_name || ''
      const lotNo = item.lotNo || item.lot_no || ''
      const weight = item.weight || 0
      const qty = item.qty || 0
      const totalWt = item.totalWt || item.total_wt || 0
      const papadKg = item.papadKg || item.papad_kg || 0
      const cost = item.cost || 0
      const wagesBag = item.wagesBag || item.wages_bag || item.wages_per_bag || 0
      const wages = item.wages || 0

      await db.run(`
        INSERT INTO flour_out_return_items (flour_out_return_id, item_name, lot_no, weight, qty, total_wt, papad_kg, cost, wages_bag, wages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [flourOutReturnId, itemName, lotNo, weight, qty, totalWt, papadKg, cost, wagesBag, wages])
    }

    res.json({ success: true, message: 'Flour out return updated successfully!' })
  } catch (error) {
    console.error('Error updating flour out return:', error)
    res.status(500).json({ success: false, message: 'Error updating flour out return', error: error.message })
  }
})

// DELETE flour out return
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM flour_out_return_items WHERE flour_out_return_id = ?', [req.params.id])
    await db.run('DELETE FROM flour_out_returns WHERE id = ?', [req.params.id])
    res.json({ success: true, message: 'Flour out return deleted successfully' })
  } catch (error) {
    console.error('Error deleting flour out return:', error)
    res.status(500).json({ success: false, message: 'Error deleting flour out return' })
  }
})

module.exports = router
