const express = require('express')
const router = express.Router()
const db = require('../config/database')

// GET /api/purchases/:id/summary
// Returns a purchase-level summary NOT repeated per item row.
router.get('/:id/summary', async (req, res) => {
  try {
    const rawParam = req.params.id;
    if (!rawParam || rawParam === 'undefined' || rawParam === 'null') {
      return res.status(400).json({ message: 'Invalid purchase identifier' });
    }

    const strVal = String(rawParam).trim();
    const numVal = parseInt(strVal, 10);
    const isNum = !isNaN(numVal) && String(numVal) === strVal;

    // Flexible query to find purchase record
    let pRes = await db.query(
      `SELECT id, base_amount, disc_amount, tax_amount, net_amount, grand_total, deduction_amount, inv_no, s_no, voucher_no
       FROM purchases
       WHERE id = ? 
          OR CAST(id AS TEXT) = ? 
          OR voucher_no = ? 
          OR inv_no = ? 
          OR s_no = ? 
          OR CAST(s_no AS TEXT) = ?
          OR LOWER(TRIM(voucher_no)) = LOWER(?)
          OR LOWER(TRIM(inv_no)) = LOWER(?)
       ORDER BY id DESC LIMIT 1`,
      [
        isNum ? numVal : -1,
        strVal,
        strVal,
        strVal,
        isNum ? numVal : -1,
        strVal,
        strVal.toLowerCase(),
        strVal.toLowerCase()
      ]
    );

    let p = pRes.rows && pRes.rows[0];

    // Fallback: check ledger_entries or voucher tables if not directly in purchases
    if (!p) {
      try {
        const leRes = await db.query(
          `SELECT reference_id FROM ledger_entries 
           WHERE voucher_no = ? OR reference_id = ? OR CAST(reference_id AS TEXT) = ?
           ORDER BY id DESC LIMIT 1`,
          [strVal, isNum ? numVal : -1, strVal]
        );
        if (leRes.rows && leRes.rows[0] && leRes.rows[0].reference_id) {
          const refId = leRes.rows[0].reference_id;
          const refP = await db.query(
            'SELECT id, base_amount, disc_amount, tax_amount, net_amount, grand_total, deduction_amount, inv_no, s_no, voucher_no FROM purchases WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1',
            [refId, String(refId)]
          );
          if (refP.rows && refP.rows[0]) {
            p = refP.rows[0];
          }
        }
      } catch (err) {
        console.warn('Notice querying ledger_entries in purchaseSummary:', err.message);
      }
    }

    if (!p) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    const purchaseId = p.id;

    // deductions from purchase_deductions table (true source for deductions)
    let addDeductions = 0
    let lessDeductions = 0

    let deductionsRows = []
    try {
      const dRes = await db.query(
        `SELECT * FROM purchase_deductions WHERE purchase_id = ? OR CAST(purchase_id AS TEXT) = ?`,
        [purchaseId, String(purchaseId)]
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
        if (d.type === 'ADD') addDeductions += amt
        else if (d.type === 'LESS') lessDeductions += amt
        else if (!d.type) lessDeductions += amt
      })
    } catch {
      deductionsRows = []
    }

    const grand_total = Number(p.grand_total || (Number(p.net_amount || 0) + (addDeductions - lessDeductions)))

    res.json({
      purchase_id: purchaseId,
      s_no: p.s_no,
      inv_no: p.inv_no,
      voucher_no: p.voucher_no,
      base_amount: Number(p.base_amount || 0),
      discount_amount: Number(p.disc_amount || 0),
      tax_amount: Number(p.tax_amount || 0),
      net_amount: Number(p.net_amount || 0),
      add_deductions: addDeductions,
      less_deductions: lessDeductions,
      deductions: {
        add: addDeductions,
        less: lessDeductions,
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

