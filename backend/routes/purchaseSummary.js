const express = require('express')
const router = express.Router()
const db = require('../config/database')

// GET /api/purchases/:id/summary
// Returns a purchase-level summary NOT repeated per item row.
router.get('/:id/summary', async (req, res) => {
  try {
    const purchaseId = req.params.id

    // purchase-level totals from purchases table
    const pRes = await db.query(
      `SELECT id, base_amount, disc_amount, tax_amount, net_amount, grand_total, deduction_amount
       FROM purchases
       WHERE id = ?`,
      [purchaseId]
    )

    if (!pRes.rows || pRes.rows.length === 0) {
      return res.status(404).json({ message: 'Purchase not found' })
    }

    const p = pRes.rows[0]

    // deductions from purchase_deductions table (true source for deductions)
    // We still also return the numeric deduction_amount column for backward compat.
    let addDeductions = 0
    let lessDeductions = 0

    let deductionsRows = []
    try {
      const dRes = await db.query(
        `SELECT * FROM purchase_deductions WHERE purchase_id = ?`,
        [purchaseId]
      )

      deductionsRows = (dRes.rows || []).map(r => ({
        id: r.deduction_id || r.deduction_purchase_id || r.id,
        name: r.deduction_name || '',
        type: (r.type || '').toUpperCase(),
        calc_type: r.calc_type || r.calculation_type || 'Fixed',
        amount: Number(r.amount || 0),
        percentage: Number(r.percentage || r.value || 0),
        value: Number(r.value || r.percentage || 0),
        remarks: r.remarks || ''
      }))

      deductionsRows.forEach(d => {
        const amt = Number(d.amount || 0)
        // conventions in this project:
        // type is often ADD/LESS or Add/Less
        if (d.type === 'ADD') addDeductions += amt
        else if (d.type === 'LESS') lessDeductions += amt
        // fallback: if type missing treat LESS
        else if (!d.type) lessDeductions += amt
      })
    } catch {
      deductionsRows = []
    }

    // Deduction convention in your UI: deductions shown as ADD - LESS effect.
    // We return both separately.
    const grand_total = Number(p.grand_total || (Number(p.net_amount || 0) + (addDeductions - lessDeductions)))

    res.json({
      purchase_id: purchaseId,
      base_amount: Number(p.base_amount || 0),
      discount_amount: Number(p.disc_amount || 0),
      tax_amount: Number(p.tax_amount || 0),
      net_amount: Number(p.net_amount || 0),
      add_deductions: addDeductions,
      less_deductions: lessDeductions,
      deductions: {
        add: addDeductions,
        less: lessDeductions,
        // keep old single-number shape too
        total: addDeductions - lessDeductions,
      },
      grand_total
    })
  } catch (err) {
    console.error('purchase summary error:', err)
    res.status(500).json({ message: 'Error fetching purchase summary', error: err.message })
  }
})

module.exports = router

