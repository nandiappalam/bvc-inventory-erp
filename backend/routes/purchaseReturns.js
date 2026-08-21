const express = require('express')
const router = express.Router()
const db = require('../config/database')

// Helper function to ensure purchase_return_deductions table exists and sync stock_lots status
async function ensureDeductionsTable() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS purchase_return_deductions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_return_id INTEGER,
        deduction_id INTEGER,
        deduction_name TEXT,
        type TEXT,
        calculation_type TEXT,
        percentage REAL DEFAULT 0,
        amount REAL DEFAULT 0
      )
    `);
    // Cleanup any lot returned previously so it doesn't show up in stock dropdowns
    await db.run(`
      UPDATE stock_lots 
      SET unloading_status = 'RETURNED', qc_status = 'REJECTED', usable_for_production = 0, approval_status = 'REJECTED', remaining_quantity = 0 
      WHERE lot_no IN (SELECT DISTINCT lot_no FROM purchase_return_items WHERE lot_no IS NOT NULL AND lot_no != '')
    `).catch(() => {});
  } catch (e) {}
}
ensureDeductionsTable();

// GET all purchase returns
router.get('/', async (req, res) => {
  try {
    await ensureDeductionsTable();
    const result = await db.query(`
      SELECT 
        pr.*,
        sm.name as supplier_master_name,
        sm.print_name as supplier_print_name,
        (
          SELECT GROUP_CONCAT(DISTINCT pri.item_name)
          FROM purchase_return_items pri 
          WHERE pri.purchase_return_id = pr.id
        ) as item_names,
        (
          SELECT GROUP_CONCAT(DISTINCT pri.weight)
          FROM purchase_return_items pri 
          WHERE pri.purchase_return_id = pr.id
        ) as item_weights,
        (
          SELECT SUM(prd.amount) 
          FROM purchase_return_deductions prd 
          WHERE prd.purchase_return_id = pr.id
        ) as deduction_amount
      FROM purchase_returns pr
      LEFT JOIN supplier_master sm ON (CAST(pr.supplier AS TEXT) = CAST(sm.id AS TEXT) OR pr.supplier = sm.name)
      GROUP BY pr.id
      ORDER BY pr.id DESC
    `)
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching purchase returns:', error)
    res.status(500).json({ message: 'Error fetching purchase returns' })
  }
})

// GET list of pending rejected lots for purchase return creation
router.get('/pending-returns', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        sl.id as stock_lot_id,
        sl.lot_no,
        sl.item_name,
        sl.quantity as qty,
        sl.rate,
        p.supplier as supplier_id,
        sl.unloading_status,
        sl.qc_status,
        sl.purchase_id,
        p.inv_no,
        p.date as inv_date,
        p.s_no,
        p.pay_type,
        p.tax_type,
        sm.id as supplier_master_id,
        sm.name as supplier_name,
        sm.print_name as supplier_print_name,
        COALESCE(sm.address1, '') as supplier_address,
        pi.per_unit_weight as weight,
        pi.disc_percent as disc,
        pi.tax_percent as tax,
        qi.id as qc_id,
        qi.overall_result
      FROM stock_lots sl
      LEFT JOIN purchases p ON sl.purchase_id = p.id
      LEFT JOIN supplier_master sm ON (CAST(p.supplier AS TEXT) = CAST(sm.id AS TEXT) OR p.supplier = sm.name)
      LEFT JOIN purchase_items pi ON (sl.purchase_id = pi.purchase_id AND (sl.lot_no = pi.lot_no OR sl.item_name = pi.item_name))
      LEFT JOIN qc_inspections qi ON sl.lot_no = qi.rm_lot_no
      WHERE (sl.unloading_status = 'RETURNED' OR sl.qc_status = 'REJECTED' OR qi.overall_result = 'REJECTED' OR qi.overall_result = 'FAIL')
        AND sl.lot_no NOT IN (
          SELECT DISTINCT lot_no FROM purchase_return_items WHERE lot_no IS NOT NULL AND lot_no != ''
        )
      GROUP BY sl.lot_no
      ORDER BY sl.id DESC
    `);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching pending returns:', error);
    res.status(500).json([]);
  }
});

// GET purchase return by ID
router.get('/:id', async (req, res) => {
  try {
    const purchaseReturnResult = await db.query(`
      SELECT 
        pr.*,
        sm.id as supplier_master_id,
        sm.name as supplier_name,
        sm.print_name as supplier_print_name,
        COALESCE(sm.address1, '') as supplier_address,
        COALESCE(sm.mobile1, sm.phone_off, sm.phone_res, '') as supplier_phone,
        COALESCE(sm.gst_number, '') as supplier_gstin
      FROM purchase_returns pr
      LEFT JOIN supplier_master sm ON (CAST(pr.supplier AS TEXT) = CAST(sm.id AS TEXT) OR pr.supplier = sm.name)
      WHERE pr.id = ?
    `, [req.params.id]);

    if (purchaseReturnResult.rows.length === 0) {
      return res.status(404).json({ message: 'Purchase return not found' });
    }

    const itemsResult = await db.query('SELECT * FROM purchase_return_items WHERE purchase_return_id = ?', [req.params.id]);
    
    let deductionsResult = [];
    try {
      const d = await db.query('SELECT * FROM purchase_return_deductions WHERE purchase_return_id = ?', [req.params.id]);
      deductionsResult = d.rows || [];
    } catch (e) {}

    const purchaseReturn = {
      ...purchaseReturnResult.rows[0],
      items: itemsResult.rows,
      deductions: deductionsResult
    };

    res.json(purchaseReturn);
  } catch (error) {
    console.error('Error fetching purchase return:', error);
    res.status(500).json({ message: 'Error fetching purchase return' });
  }
});

// POST create new purchase return
router.post('/', async (req, res) => {
  try {
    await ensureDeductionsTable();
    const { formData, items, totals, deductions } = req.body

    const auto_wages = parseFloat(totals?.deductions?.autoWages ?? totals?.auto_wages) || 0;
    const vat_percent = parseFloat(totals?.deductions?.vatPercent ?? totals?.vat_percent) || 0;
    const vat = parseFloat(totals?.deductions?.vat ?? totals?.vat) || 0;

    // Insert purchase return
    const purchaseReturnResult = await db.run(`
      INSERT INTO purchase_returns (
        s_no, date, return_inv_no, supplier, pay_type, inv_date, type, address,
        tax_type, godown, remarks, total_qty, total_weight, total_amount,
        base_amount, disc_amount, tax_amount, net_amount, auto_wages,
        vat_percent, vat, grand_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      formData.sNo ?? formData.s_no, formData.date, formData.returnInvNo ?? formData.return_inv_no, formData.supplier, formData.payType ?? formData.pay_type,
      formData.invDate ?? formData.inv_date, formData.type, formData.address, formData.taxType ?? formData.tax_type, formData.godown,
      formData.remarks, totals.totalQty ?? totals.total_qty, totals.totalWeight ?? totals.total_weight, totals.totalAmount ?? totals.total_amount,
      totals.baseAmount ?? totals.base_amount, totals.discAmount ?? totals.disc_amount, totals.taxAmount ?? totals.tax_amount, totals.netAmount ?? totals.net_amount,
      auto_wages, vat_percent, vat, totals.grandTotal ?? totals.grand_total
    ])

    const purchaseReturnId = purchaseReturnResult.lastID

    // Insert purchase return items
    for (const item of items) {
      const lot_no = item.lot_no ?? item.lotNo ?? '';
      const item_name = item.item_name ?? item.itemName ?? '';
      const weight = parseFloat(item.weight) || 0;
      const qty = parseFloat(item.qty) || 0;
      const total_wt = parseFloat(item.total_wt ?? item.totalWt ?? item.total_weight) || 0;
      const rate = parseFloat(item.rate) || 0;
      const disc_percent = parseFloat(item.disc_percent ?? item.disc ?? item.discountPercent) || 0;
      const tax_percent = parseFloat(item.tax_percent ?? item.tax ?? item.taxPercent) || 0;
      const amount = parseFloat(item.amount) || 0;

      await db.run(`
        INSERT INTO purchase_return_items (
          purchase_return_id, lot_no, item_name, weight, qty, total_wt, rate, disc_percent, tax_percent, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseReturnId, lot_no, item_name, weight, qty, total_wt,
        rate, disc_percent, tax_percent, amount
      ])

      // Auto-update stock_lots and vehicle_movements status
      if (lot_no) {
        try {
          await db.run(`UPDATE stock_lots SET unloading_status = 'RETURNED', qc_status = 'REJECTED', usable_for_production = 0, approval_status = 'REJECTED' WHERE lot_no = ?`, [lot_no]);
          await db.run(`UPDATE qc_inspections SET overall_result = 'REJECTED' WHERE rm_lot_no = ?`, [lot_no]);
          await db.run(`UPDATE vehicle_movements SET status = 'RETURNED', operation_type = 'RETURN', gate_out_time = datetime('now', 'localtime') WHERE UPPER(lot_no) = UPPER(?) OR reference_id IN (SELECT CAST(purchase_id AS TEXT) FROM stock_lots WHERE lot_no = ?)`, [lot_no, lot_no]);
          await db.run(`DELETE FROM stock WHERE lot_no = ? AND type = 'Purchase'`, [lot_no]);
        } catch (e) {
          console.error('Error auto-syncing return status on purchase return insert:', e);
        }
      }
    }

    // Insert purchase return deductions if present
    const dedList = deductions || req.body.selectedDeductions || [];
    if (Array.isArray(dedList)) {
      for (const d of dedList) {
        try {
          await db.run(`
            INSERT INTO purchase_return_deductions (
              purchase_return_id, deduction_id, deduction_name, type, calculation_type, percentage, amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            purchaseReturnId,
            d.deduction_id || d.id || null,
            d.name || d.deduction_name || '',
            d.type || 'LESS',
            d.calculation_type || d.calc_type || 'Percentage',
            parseFloat(d.percent ?? d.percentage ?? 0) || 0,
            parseFloat(d.amount) || 0
          ]);
        } catch (e) {
          console.error('Error inserting purchase_return_deduction:', e);
        }
      }
    }

    res.status(201).json({
      message: 'Purchase return saved successfully!',
      id: purchaseReturnId
    })
  } catch (error) {
    console.error('Error saving purchase return:', error)
    res.status(500).json({ message: 'Error saving purchase return', error: error.message })
  }
})

// PUT update purchase return
router.put('/:id', async (req, res) => {
  try {
    const { formData, items, totals } = req.body
    const purchaseReturnId = req.params.id

    const auto_wages = parseFloat(totals?.deductions?.autoWages ?? totals?.auto_wages) || 0;
    const vat_percent = parseFloat(totals?.deductions?.vatPercent ?? totals?.vat_percent) || 0;
    const vat = parseFloat(totals?.deductions?.vat ?? totals?.vat) || 0;

    // Update purchase return
    await db.query(`
      UPDATE purchase_returns SET
        s_no = ?, date = ?, return_inv_no = ?, supplier = ?, pay_type = ?,
        inv_date = ?, type = ?, address = ?, tax_type = ?, godown = ?,
        remarks = ?, total_qty = ?, total_weight = ?, total_amount = ?,
        base_amount = ?, disc_amount = ?, tax_amount = ?, net_amount = ?,
        auto_wages = ?, vat_percent = ?, vat = ?, grand_total = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      formData.sNo ?? formData.s_no, formData.date, formData.returnInvNo ?? formData.return_inv_no, formData.supplier, formData.payType ?? formData.pay_type,
      formData.invDate ?? formData.inv_date, formData.type, formData.address, formData.taxType ?? formData.tax_type, formData.godown,
      formData.remarks, totals.totalQty ?? totals.total_qty, totals.totalWeight ?? totals.total_weight, totals.totalAmount ?? totals.total_amount,
      totals.baseAmount ?? totals.base_amount, totals.discAmount ?? totals.disc_amount, totals.taxAmount ?? totals.tax_amount, totals.netAmount ?? totals.net_amount,
      auto_wages, vat_percent, vat,
      totals.grandTotal ?? totals.grand_total, purchaseReturnId
    ])

    // Delete existing items
    await db.query('DELETE FROM purchase_return_items WHERE purchase_return_id = ?', [purchaseReturnId])

    // Delete existing deductions
    try {
      await db.query('DELETE FROM purchase_return_deductions WHERE purchase_return_id = ?', [purchaseReturnId]);
    } catch (e) {}

    // Insert updated items
    for (const item of items) {
      const lot_no = item.lot_no ?? item.lotNo ?? '';
      const item_name = item.item_name ?? item.itemName ?? '';
      const weight = parseFloat(item.weight) || 0;
      const qty = parseFloat(item.qty) || 0;
      const total_wt = parseFloat(item.total_wt ?? item.totalWt ?? item.total_weight) || 0;
      const rate = parseFloat(item.rate) || 0;
      const disc_percent = parseFloat(item.disc_percent ?? item.disc ?? item.discountPercent) || 0;
      const tax_percent = parseFloat(item.tax_percent ?? item.tax ?? item.taxPercent) || 0;
      const amount = parseFloat(item.amount) || 0;

      await db.query(`
        INSERT INTO purchase_return_items (
          purchase_return_id, lot_no, item_name, weight, qty, total_wt, rate, disc_percent, tax_percent, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        purchaseReturnId, lot_no, item_name, weight, qty, total_wt,
        rate, disc_percent, tax_percent, amount
      ])

      // Auto-update stock_lots and vehicle_movements status
      if (lot_no) {
        try {
          await db.run(`UPDATE stock_lots SET unloading_status = 'RETURNED', qc_status = 'REJECTED', usable_for_production = 0, approval_status = 'REJECTED', remaining_quantity = 0 WHERE lot_no = ?`, [lot_no]);
          await db.run(`UPDATE qc_inspections SET overall_result = 'REJECTED' WHERE rm_lot_no = ?`, [lot_no]);
          await db.run(`UPDATE vehicle_movements SET status = 'RETURNED', operation_type = 'RETURN', gate_out_time = datetime('now', 'localtime') WHERE UPPER(lot_no) = UPPER(?) OR reference_id IN (SELECT CAST(purchase_id AS TEXT) FROM stock_lots WHERE lot_no = ?)`, [lot_no, lot_no]);
          await db.run(`DELETE FROM stock WHERE lot_no = ? AND type = 'Purchase'`, [lot_no]);
        } catch (e) {
          console.error('Error auto-syncing return status on purchase return update:', e);
        }
      }
    }

    // Re-insert purchase return deductions if present
    const dedList = req.body.deductions || req.body.selectedDeductions || [];
    if (Array.isArray(dedList)) {
      for (const d of dedList) {
        try {
          await db.run(`
            INSERT INTO purchase_return_deductions (
              purchase_return_id, deduction_id, deduction_name, type, calculation_type, percentage, amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            purchaseReturnId,
            d.deduction_id || d.id || null,
            d.name || d.deduction_name || '',
            d.type || 'LESS',
            d.calculation_type || d.calc_type || 'Percentage',
            parseFloat(d.percent ?? d.percentage ?? 0) || 0,
            parseFloat(d.amount) || 0
          ]);
        } catch (e) {
          console.error('Error re-inserting purchase_return_deduction:', e);
        }
      }
    }

    res.json({ message: 'Purchase return updated successfully!' })
  } catch (error) {
    console.error('Error updating purchase return:', error)
    res.status(500).json({ message: 'Error updating purchase return' })
  }
})

// DELETE purchase return
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.run('DELETE FROM purchase_returns WHERE id = ?', [req.params.id])
    if (result.changes > 0) {
      res.json({ message: 'Purchase return deleted successfully' })
    } else {
      res.status(404).json({ message: 'Purchase return not found' })
    }
  } catch (error) {
    console.error('Error deleting purchase return:', error)
    res.status(500).json({ message: 'Error deleting purchase return', error: error.message })
  }
})

module.exports = router
