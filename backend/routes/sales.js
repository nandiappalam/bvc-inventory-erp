const express = require('express')
const router = express.Router()
const db = require('../config/database')
const recycleBinService = require('../services/RecycleBinService')
const { createSalesLedgerEntries, deleteLedgerEntries } = require('../utils/ledgerHelper')
const { rebuildStockLedger } = require('../utils/stockRebuilder')

// Ensure is_order column exists in sales table
db.run("ALTER TABLE sales ADD COLUMN is_order INTEGER DEFAULT 0").catch(() => {});

// GET all sales
router.get(['/', '/list'], async (req, res) => {
  try {
    const isOrderQuery = req.query.is_order;
    let query = `
      SELECT s.id,
             s.s_no,
             s.date,
             COALESCE(c.name, s.customer) as customer,
             COALESCE(c.name, s.customer) as customer_name,
             s.remarks,
             s.is_order,
             s.bill_amt,
             s.tax_amt,
             s.deduction,
             s.deduction_amount,
             s.deductions_json,
             s.grand_total,
             s.created_at
      FROM sales s
      LEFT JOIN customer_master c ON (s.customer = CAST(c.id AS TEXT) OR s.customer = c.name)
    `;

    const params = [];
    if (isOrderQuery !== undefined) {
      query += ` WHERE COALESCE(s.is_order, 0) = ? `;
      params.push(parseInt(isOrderQuery) || 0);
    }

    query += ` ORDER BY s.created_at DESC, s.id DESC`;
    const result = await db.query(query, params)
    const salesList = result.rows || [];

    for (const sale of salesList) {
      const itemsRes = await db.query(`SELECT * FROM sales_items WHERE sales_id = ?`, [sale.id]);
      const items = itemsRes.rows || [];
      sale.items = items.map(i => ({
        id: i.id,
        itemName: i.item_name,
        item_name: i.item_name,
        lotNo: i.lot_no,
        lot_no: i.lot_no,
        weight: i.weight,
        qty: i.qty,
        totalWt: i.total_wt,
        total_wt: i.total_wt,
        rate: i.rate,
        discPerc: i.disc_perc,
        taxPerc: i.tax_perc,
        totalAmt: i.total_amt,
        total_amt: i.total_amt
      }));

      sale.item_name = items.map(i => i.item_name).filter(Boolean).join(', ') || 'Sale Item';
      sale.lot_no = items.map(i => i.lot_no).filter(Boolean).join(', ') || '';
      sale.qty = items.reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0);
      sale.weight = items[0]?.weight || 0;
      sale.total_wt = items.reduce((sum, i) => sum + (parseFloat(i.total_wt) || 0), 0);
      sale.rate = items[0]?.rate || 0;
      sale.disc_perc = items[0]?.disc_perc || 0;
      sale.tax_perc = items[0]?.tax_perc || 0;
      sale.total_amt = sale.grand_total || items.reduce((sum, i) => sum + (parseFloat(i.total_amt) || 0), 0);
    }

    res.json(salesList);
  } catch (error) {
    console.error('Error fetching sales:', error)
    res.status(500).json({ message: 'Error fetching sales', error: error.message })
  }
})

// GET next sequential s_no (Bill No / Order No) for sales
router.get('/next-sno', async (req, res) => {
  try {
    const isOrderQuery = req.query.is_order;
    let whereClause = "";
    const params = [];
    if (isOrderQuery !== undefined) {
      whereClause = " WHERE COALESCE(is_order, 0) = ?";
      params.push(parseInt(isOrderQuery) || 0);
    }
    const maxRes = await db.query(`
      SELECT 
        MAX(CAST(s_no AS INTEGER)) as max_sno,
        MAX(id) as max_id,
        COUNT(*) as total_count 
      FROM sales${whereClause}
    `, params);

    const maxVal = Math.max(
      parseInt(maxRes.rows[0]?.max_sno) || 0,
      parseInt(maxRes.rows[0]?.max_id) || 0,
      parseInt(maxRes.rows[0]?.total_count) || 0
    );
    const nextSno = maxVal + 1;
    res.json({ success: true, next_sno: String(nextSno), s_no: nextSno, next_s_no: String(nextSno), data: { s_no: nextSno } });
  } catch (error) {
    console.error('Error fetching next sales s_no:', error);
    res.status(500).json({ success: false, message: 'Error fetching next sales s_no', error: error.message });
  }
});

// GET sales by ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null' || isNaN(Number(id))) {
      return res.status(404).json({ message: 'Sales record not found' });
    }
    const salesResult = await db.query('SELECT * FROM sales WHERE id = ?', [id])
    if (salesResult.rows.length === 0) {
      return res.status(404).json({ message: 'Sales record not found' })
    }

    const itemsResult = await db.query('SELECT * FROM sales_items WHERE sales_id = ?', [req.params.id])

    const salesRow = salesResult.rows[0];
    let deductions = [];
    if (salesRow.deductions_json) {
      try {
        deductions = JSON.parse(salesRow.deductions_json);
      } catch (e) {
        console.error('Error parsing deductions_json:', e);
      }
    }

    const sales = {
      ...salesRow,
      deductions,
      items: itemsResult.rows
    }

    res.json(sales)
  } catch (error) {
    console.error('Error fetching sales:', error)
    res.status(500).json({ message: 'Error fetching sales' })
  }
})

// POST create new sales
router.post('/', async (req, res) => {
  try {
    const { formData, items, totals } = req.body

    // Validation
    if (!formData.date || (!formData.customer && !formData.customer_id) || !items || items.length === 0) {
      return res.status(400).json({ message: 'Date, customer, and at least one item are required' })
    }

    const validItems = items.filter(item => {
      const name = item.itemName || item.item_name;
      return name && String(name).trim() !== '';
    });

    if (validItems.length === 0) {
      return res.status(400).json({ message: 'At least one item with a valid name is required.' });
    }

    // Calculate totals
    const totalQty = validItems.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
    const totalWt = validItems.reduce((sum, item) => sum + (parseFloat(item.totalWt || item.total_wt || item.total_weight) || 0), 0)
    const totalAmt = parseFloat(formData.total_amt) || totals?.netAmount || totals?.totalAmount || validItems.reduce((sum, item) => sum + (parseFloat(item.totalAmt || item.total_amt || item.amount) || 0), 0)

    const deductionsJson = JSON.stringify(formData.selectedDeductions || req.body.selectedDeductions || []);
    const grandTotalVal = parseFloat(formData.grand_total) || totals?.grandTotal || totalAmt;

    // Insert sales
    const billNo = formData.sNo || formData.s_no || formData.bill_no || '';
    const salesResult = await db.run(`
      INSERT INTO sales (
        s_no, date, customer, remarks, total_qty, total_wt, total_amt,
        pay_type, tax_type, lorry_no, p_o_no, driver, pur_trans,
        customer_id, address, phone, sender_id, consignee_id, godown_from_id,
        bill_amt, tax_amt, base_amt, grand_total, deduction, deduction_remarks, deduction_amount, deductions_json,
        is_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      billNo,
      formData.date || new Date().toISOString().split('T')[0],
      formData.customer || '',
      formData.remarks || '',
      totalQty,
      totalWt,
      totalAmt,
      formData.pay_type || 'Credit',
      formData.tax_type || 'Exclusive',
      formData.lorry_no || '',
      formData.p_o_no || '',
      formData.driver || '',
      formData.pur_trans || '',
      formData.customer_id || null,
      formData.address || '',
      formData.phone || '',
      formData.sender_id || null,
      formData.consignee_id || null,
      formData.godown_from_id || null,
      parseFloat(formData.bill_amt) || 0,
      parseFloat(formData.tax_amt) || 0,
      parseFloat(totals?.baseAmount) || parseFloat(formData.bill_amt) || 0,
      grandTotalVal,
      formData.deduction || '',
      formData.deduction_remarks || '',
      parseFloat(formData.deduction_amount) || 0,
      deductionsJson,
      formData.is_order ? 1 : 0
    ]);

    const salesId = salesResult.lastID

    // Insert sales items and deduct from stock using FIFO
    for (const item of items) {
      const itName = item.itemName || item.item_name || '';
      const itLot = item.lotNo || item.lot_no || '';
      const itTotalWt = item.totalWt || item.total_wt || item.total_weight || 0;
      const itDiscPerc = item.discPerc || item.disc_perc || 0;
      const itTaxPerc = item.taxPerc || item.tax_perc || 0;
      const itTotalAmt = item.totalAmt || item.total_amt || item.amount || 0;

      // Insert sales item
      await db.run(`
        INSERT INTO sales_items (sales_id, item_name, lot_no, weight, qty, total_wt, rate, disc_perc, tax_perc, total_amt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [salesId, itName, itLot, item.weight || 0, item.qty, itTotalWt,
           item.rate, itDiscPerc, itTaxPerc, itTotalAmt])
      
      // Deduct from stock using FIFO
      const qtyToDeduct = parseFloat(item.qty) || 0
      
      // Get available lots ordered by FIFO (oldest first)
      const availableLotsRes = await db.query(`
        SELECT * FROM stock_lots 
        WHERE (item_name = ? OR item_name = ?) AND remaining_quantity > 0
        ORDER BY created_at ASC
      `, [itName, itName])
      const availableLots = availableLotsRes.rows || []
      
      // Check if total available quantity is enough
      const totalAvailable = availableLots.reduce((sum, lot) => sum + lot.remaining_quantity, 0)
      if (totalAvailable < qtyToDeduct) {
        // Rollback the sales insert
        await db.run('DELETE FROM sales_items WHERE sales_id = ?', [salesId])
        await db.run('DELETE FROM sales WHERE id = ?', [salesId])
        return res.status(400).json({ 
          message: `Insufficient stock for ${itName}. Available: ${totalAvailable}, Requested: ${qtyToDeduct}` 
        })
      }
      
      // Deduct quantity lot by lot (FIFO)
      let remainingToDeduct = qtyToDeduct
      
      for (const lot of availableLots) {
        if (remainingToDeduct <= 0) break
        
        const deductFromThis = Math.min(lot.remaining_quantity, remainingToDeduct)
        
        // Update stock_lots remaining quantity
        await db.run(`
          UPDATE stock_lots 
          SET remaining_quantity = remaining_quantity - ?
          WHERE id = ?
        `, [deductFromThis, lot.id])
        
        // Add negative stock entry for tracking
        await db.run(`
          INSERT INTO stock (item_name, lot_no, qty, weight, rate, amount, date, type, reference_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Sale', ?)
        `, [itName, lot.lot_no, -deductFromThis, -(item.weight || 0) * (deductFromThis / qtyToDeduct), item.rate, -itTotalAmt, formData.date, salesId])
        
        remainingToDeduct -= deductFromThis
      }
    }

    // Create sales ledger entries
    try {
      await createSalesLedgerEntries({
        customer: formData.customer_id || formData.customer || '',
        date: formData.date || new Date().toISOString().split('T')[0],
        invNo: billNo,
        salesId: salesId,
        totalAmount: totalAmt,
        taxAmount: parseFloat(formData.tax_amt) || 0,
        discAmount: 0,
        baseAmount: parseFloat(totals?.baseAmount) || parseFloat(formData.bill_amt) || (totalAmt - (parseFloat(formData.tax_amt) || 0)),
        deductions: formData.deduction_amount ? [{
          deduction: formData.deduction,
          amount: parseFloat(formData.deduction_amount) || 0,
          remarks: formData.deduction_remarks || ''
        }] : []
      })
      console.log('✓ Sales ledger entries and voucher chain auto-created for sales ID:', salesId)
    } catch (ledgerError) {
      console.error('Error auto-creating sales ledger entries:', ledgerError)
      // Continue even if ledger entries fail - don't rollback the sales
    }

    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after sale:', e);
    }

    res.status(201).json({
      message: 'Sales record saved successfully!',
      id: salesId
    })
  } catch (error) {
    console.error('Error saving sales:', error)
    res.status(500).json({ message: 'Error saving sales', error: error.message })
  }
})

// Helper to revert stock / lot deductions for a sale
const revertSalesStock = async (salesId) => {
  try {
    // 1. Fetch all stock entries for this sale to find which lots were deducted
    const stockEntries = await db.query(`
      SELECT item_name, lot_no, qty 
      FROM stock 
      WHERE reference_id = ? AND type = 'Sale'
    `, [salesId])

    for (const entry of stockEntries.rows) {
      const restoredQty = Math.abs(entry.qty)
      if (restoredQty > 0) {
        // Restore remaining_quantity in stock_lots
        const result = await db.run(`
          UPDATE stock_lots
          SET remaining_quantity = remaining_quantity + ?
          WHERE item_name = ? AND lot_no = ?
        `, [restoredQty, entry.item_name, entry.lot_no || ''])

        // Self-healing fallback: If no rows were updated, find the earliest stock lot of that item and restore there
        if (result && result.changes === 0) {
          const firstLot = await db.query(`
            SELECT lot_no FROM stock_lots 
            WHERE item_name = ? 
            ORDER BY created_at ASC LIMIT 1
          `, [entry.item_name])
          if (firstLot.rows.length > 0) {
            await db.run(`
              UPDATE stock_lots
              SET remaining_quantity = remaining_quantity + ?
              WHERE item_name = ? AND lot_no = ?
            `, [restoredQty, entry.item_name, firstLot.rows[0].lot_no])
          }
        }
      }
    }

    // 2. Delete the stock records for this sale
    await db.run(`
      DELETE FROM stock 
      WHERE reference_id = ? AND type = 'Sale'
    `, [salesId])

  } catch (err) {
    console.error('Error reverting sales stock:', err)
  }
}

// PUT update sales
router.put('/:id', async (req, res) => {
  try {
    const { formData, items, totals } = req.body
    const salesId = req.params.id

    const activeItems = (items || []).filter(item => item.item_name || item.itemName)

    const isOrder = !!(formData.is_order || req.body.is_order || false)

    // Calculate totals
    const totalQty = activeItems.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
    const totalWt = activeItems.reduce((sum, item) => sum + (parseFloat(item.totalWt || item.total_wt || item.total_weight || item.weight * item.qty) || 0), 0)
    const totalAmt = parseFloat(formData.total_amt) || totals?.netAmount || totals?.totalAmount || activeItems.reduce((sum, item) => sum + (parseFloat(item.totalAmt || item.total_amt || item.amount) || 0), 0)

    // Revert existing stock changes first
    await revertSalesStock(salesId)

    // Check if new items have enough stock before committing changes (only if NOT a sales order)
    if (!isOrder) {
      for (const item of activeItems) {
        const qtyToDeduct = parseFloat(item.qty) || 0
        const itemName = item.item_name || item.itemName

        const availableLots = await db.query(`
          SELECT COALESCE(SUM(remaining_quantity), 0) as totalAvailable 
          FROM stock_lots 
          WHERE item_name = ? AND remaining_quantity > 0
        `, [itemName])

        const totalAvailable = availableLots.rows[0]?.totalAvailable || 0
        if (totalAvailable < qtyToDeduct) {
          return res.status(400).json({ 
            message: `Insufficient stock for ${itemName}. Available: ${totalAvailable}, Requested: ${qtyToDeduct}` 
          })
        }
      }
    }

    const deductionsJson = JSON.stringify(formData.selectedDeductions || req.body.selectedDeductions || []);
    const grandTotalVal = parseFloat(formData.grand_total) || totals?.grandTotal || totalAmt;

    // Update sales (full list of columns matching entries.js)
    await db.run(`
      UPDATE sales SET 
        s_no = ?, date = ?, customer = ?, remarks = ?, total_qty = ?, total_wt = ?, total_amt = ?,
        pay_type = ?, tax_type = ?, lorry_no = ?, p_o_no = ?, driver = ?, pur_trans = ?,
        customer_id = ?, address = ?, phone = ?, sender_id = ?, consignee_id = ?, godown_from_id = ?,
        bill_amt = ?, tax_amt = ?, base_amt = ?, grand_total = ?, deduction = ?, deduction_remarks = ?, deduction_amount = ?, deductions_json = ?,
        is_order = ?
      WHERE id = ?
    `, [
      formData.sNo || formData.bill_no || formData.s_no || salesId,
      formData.date || new Date().toISOString().split('T')[0],
      formData.customer || '',
      formData.remarks || '',
      totalQty,
      totalWt,
      totalAmt,
      formData.pay_type || 'Credit',
      formData.tax_type || 'Exclusive',
      formData.lorry_no || '',
      formData.p_o_no || '',
      formData.driver || '',
      formData.pur_trans || '',
      formData.customer_id || null,
      formData.address || '',
      formData.phone || '',
      formData.sender_id || null,
      formData.consignee_id || null,
      formData.godown_from_id || null,
      parseFloat(formData.bill_amt) || 0,
      parseFloat(formData.tax_amt) || 0,
      parseFloat(totals?.baseAmount) || parseFloat(formData.bill_amt) || 0,
      grandTotalVal,
      formData.deduction || '',
      formData.deduction_remarks || '',
      parseFloat(formData.deduction_amount) || 0,
      deductionsJson,
      isOrder ? 1 : 0,
      salesId
    ])

    // Delete existing items
    await db.run('DELETE FROM sales_items WHERE sales_id = ?', [salesId])

    // Insert updated items and deduct stock
    for (const item of activeItems) {
      const itemName = item.item_name || item.itemName
      const lotNo = item.lot_no || item.lotNo || ''
      const weight = parseFloat(item.weight || item.weight_val || 0)
      const qty = parseFloat(item.qty) || 0
      const totalWtVal = parseFloat(item.total_wt || item.totalWt || (qty * weight))
      const rate = parseFloat(item.rate) || 0
      const discPerc = parseFloat(item.disc_perc || item.discPerc || item.disc || 0)
      const taxPerc = parseFloat(item.tax_perc || item.taxPerc || item.tax || item.tax_rate || 0)
      const totalAmtVal = parseFloat(item.total_amt || item.totalAmt || item.amount || 0)
      const box = parseFloat(item.box) || 0

      await db.run(`
        INSERT INTO sales_items (
          sales_id, item_name, lot_no, weight, qty, total_wt, rate, disc_perc, tax_perc, total_amt, tax_rate, disc, box
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [salesId, itemName, lotNo, weight, qty, totalWtVal, rate, discPerc, taxPerc, totalAmtVal, taxPerc, discPerc, box])

      if (!isOrder) {
        // Deduct from stock using FIFO
        const qtyToDeduct = qty
        
        const availableLots = await db.query(`
          SELECT * FROM stock_lots 
          WHERE item_name = ? AND remaining_quantity > 0
          ORDER BY created_at ASC
        `, [itemName])
        
        let remainingToDeduct = qtyToDeduct
        
        for (const lot of availableLots.rows) {
          if (remainingToDeduct <= 0) break
          
          const deductFromThis = Math.min(lot.remaining_quantity, remainingToDeduct)
          
          // Update stock_lots remaining quantity
          await db.run(`
            UPDATE stock_lots 
            SET remaining_quantity = MAX(0, remaining_quantity - ?)
            WHERE id = ?
          `, [deductFromThis, lot.id])
          
          // Add negative stock entry for tracking
          await db.run(`
            INSERT INTO stock (item_name, lot_no, qty, weight, rate, amount, date, type, reference_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Sale', ?)
          `, [itemName, lot.lot_no, -deductFromThis, -weight * (deductFromThis / qtyToDeduct), rate, -totalAmtVal, formData.date || new Date().toISOString().split('T')[0], salesId])
          
          remainingToDeduct -= deductFromThis
        }
      }
    }

    // Update sales ledger entries and voucher chain
    try {
      await deleteLedgerEntries(salesId)
      await createSalesLedgerEntries({
        customer: formData.customer_id || formData.customer || '',
        date: formData.date || new Date().toISOString().split('T')[0],
        invNo: formData.sNo || formData.bill_no || formData.s_no || salesId,
        salesId: salesId,
        totalAmount: totalAmt,
        taxAmount: parseFloat(formData.tax_amt) || 0,
        discAmount: 0,
        baseAmount: parseFloat(totals?.baseAmount) || parseFloat(formData.bill_amt) || 0,
        deductions: formData.deduction_amount ? [{
          deduction: formData.deduction,
          amount: parseFloat(formData.deduction_amount) || 0,
          remarks: formData.deduction_remarks || ''
        }] : []
      })
      console.log('✓ Sales ledger entries and voucher chain updated for sales ID:', salesId)
    } catch (ledgerError) {
      console.error('Error updating sales ledger entries:', ledgerError)
    }

    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after updating sale:', e);
    }

    res.json({ success: true, message: 'Sales record updated successfully!' })
  } catch (error) {
    console.error('Error updating sales:', error)
    res.status(500).json({ success: false, message: 'Error updating sales', error: error.message })
  }
})

// DELETE sales
router.delete('/:id', async (req, res) => {
  try {
    const salesId = req.params.id

    try {
      const sRes = await db.query('SELECT * FROM sales WHERE id = ?', [salesId]);
      if (sRes.rows && sRes.rows.length > 0) {
        const sRow = sRes.rows[0];
        const sItems = await db.query('SELECT * FROM sales_items WHERE sales_id = ?', [salesId]);
        await recycleBinService.saveToRecycleBin({
          moduleName: 'Sales',
          recordId: salesId,
          title: `Sales Invoice #${sRow.inv_no || sRow.s_no || salesId} - ${sRow.customer || 'Customer'}`,
          recordData: {
            tableName: 'sales',
            record: sRow,
            subRecords: [
              { tableName: 'sales_items', records: sItems.rows || [] }
            ]
          },
          deletedBy: req.user?.username || 'admin'
        });
      }
    } catch (e) {
      console.warn('Recycle bin save error in sales:', e.message);
    }
    
    // Revert existing stock changes first
    await revertSalesStock(salesId)

    // Delete sales ledger entries first
    try {
      await deleteLedgerEntries(salesId)
    } catch (ledgerError) {
      console.error('Error deleting sales ledger entries:', ledgerError)
    }
    
    // Delete sales items manually to be safe
    await db.run('DELETE FROM sales_items WHERE sales_id = ?', [salesId])

    await db.run('DELETE FROM sales WHERE id = ?', [salesId])

    try {
      await rebuildStockLedger();
    } catch (e) {
      console.error('Error rebuilding stock after deleting sale:', e);
    }

    res.json({ message: 'Sales record deleted successfully' })
  } catch (error) {
    console.error('Error deleting sales:', error)
    res.status(500).json({ message: 'Error deleting sales' })
  }
})

module.exports = router
