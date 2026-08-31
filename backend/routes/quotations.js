const express = require('express')
const router = express.Router()
const db = require('../config/database')

// GET next Bill No for quotations
router.get('/next-bill-no', async (req, res) => {
  try {
    const maxBillNo = await db.query('SELECT MAX(CAST(bill_no AS INTEGER)) as max_bill_no FROM quotations')
    const next_bill_no = (maxBillNo.rows[0].max_bill_no || 0) + 1;
    res.json({ success: true, next_bill_no })
  } catch (error) {
    console.error('Error fetching next Bill No for quotation:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch next Bill No' })
  }
})

// GET all quotations
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        q.id,
        q.bill_no as s_no,
        q.bill_no as sNo,
        q.date,
        COALESCE(cm.name, pcm.name, lm.ledger_name, q.customer) as customer,
        COALESCE(cm.name, pcm.name, lm.ledger_name, q.customer) as customer_name,
        q.pay_type,
        q.tax_type,
        q.type,
        q.remarks,
        q.address,
        q.tax_percent,
        q.bill_amt,
        q.tax_amt,
        q.total_amt as amount,
        q.total_amt,
        q.deduction,
        q.percent,
        q.deduction_amount,
        q.deduction_remarks,
        qi.id as itemId,
        qi.item_name,
        qi.qty,
        qi.box,
        qi.rate,
        qi.disc,
        qi.tax,
        qi.amount as item_amount
      FROM quotations q
      LEFT JOIN customer_master cm ON (CAST(cm.id AS TEXT) = CAST(q.customer AS TEXT) OR cm.name = q.customer)
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(q.customer AS TEXT) OR pcm.name = q.customer)
      LEFT JOIN ledgermaster lm ON (CAST(lm.id AS TEXT) = CAST(q.customer AS TEXT) OR lm.ledger_name = q.customer)
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      ORDER BY q.id DESC, qi.id ASC
    `)
    res.json(result.rows || [])
  } catch (error) {
    console.error('Error fetching quotations:', error)
    res.status(500).json({ message: 'Error fetching quotations', error: error.message })
  }
})

// POST a new quotation
router.post('/', async (req, res) => {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    
    const {
      bill_no, date, pay_type, tax_type, type, remarks, customer, address,
      tax_percent, amount, bill_amt, tax_amt, total_amt, deduction, percent,
      deduction_amount, deduction_remarks, items
    } = req.body

    // First, insert quotation
    const insertQuotationQuery = `
      INSERT INTO quotations (
        s_no, date, customer, item_name, lot_no, qty, amount,
        bill_no, pay_type, tax_type, type, remarks, address,
        tax_percent, bill_amt, tax_amt, total_amt, deduction,
        percent, deduction_amount, deduction_remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    // We can extract first item's name & lot as summary values if items exist
    const firstItemName = items && items[0] ? items[0].item_name : ''
    const firstLotNo = items && items[0] ? items[0].lot_no : ''
    const totalQty = items ? items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0) : 0
    const totalItemAmt = items ? items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) : 0

    const quotationResult = await connection.run(insertQuotationQuery, [
      bill_no || '', date || '', customer || '', firstItemName, firstLotNo, totalQty, totalItemAmt,
      bill_no || '', pay_type || '', tax_type || '', type || '', remarks || '', address || '',
      parseFloat(tax_percent) || 0, parseFloat(bill_amt) || 0, parseFloat(tax_amt) || 0,
      parseFloat(total_amt) || 0, parseFloat(deduction) || 0, parseFloat(percent) || 0,
      parseFloat(deduction_amount) || 0, deduction_remarks || ''
    ])

    const quotationId = quotationResult.lastInsertRowid || quotationResult.lastID

    // Now insert quotation items if any
    if (items && Array.isArray(items)) {
      const insertItemQuery = `
        INSERT INTO quotation_items (
          quotation_id, item_name, qty, box, rate, disc, tax, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      for (const item of items) {
        if (!item.item_name) continue
        await connection.run(insertItemQuery, [
          quotationId, item.item_name, parseFloat(item.qty) || 0, parseFloat(item.box) || 0,
          parseFloat(item.rate) || 0, parseFloat(item.disc) || 0, parseFloat(item.tax) || 0,
          parseFloat(item.amount) || 0
        ])
      }
    }

    await connection.commit()
    res.json({ success: true, id: quotationId, message: 'Quotation created successfully' })
  } catch (error) {
    await connection.rollback()
    console.error('Error creating quotation:', error)
    res.status(500).json({ success: false, message: 'Error creating quotation', error: error.message })
  }
})

// GET single quotation by ID
router.get('/:id', async (req, res) => {
  try {
    const qRes = await db.query('SELECT * FROM quotations WHERE id = ?', [req.params.id]);
    if (!qRes.rows || qRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }
    const quotation = qRes.rows[0];
    const itemsRes = await db.query('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC', [req.params.id]);
    quotation.items = itemsRes.rows || [];
    res.json(quotation);
  } catch (error) {
    console.error('Error fetching single quotation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update quotation
router.put('/:id', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const id = req.params.id;
    const {
      bill_no, date, pay_type, tax_type, type, remarks, customer, address,
      tax_percent, bill_amt, tax_amt, total_amt, deduction, percent,
      deduction_amount, deduction_remarks, items
    } = req.body;

    const firstItemName = items && items[0] ? items[0].item_name : '';
    const firstLotNo = items && items[0] ? items[0].lot_no : '';
    const totalQty = items ? items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0) : 0;
    const totalItemAmt = items ? items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) : 0;

    await connection.run(`
      UPDATE quotations SET
        s_no = ?, date = ?, customer = ?, item_name = ?, lot_no = ?, qty = ?, amount = ?,
        bill_no = ?, pay_type = ?, tax_type = ?, type = ?, remarks = ?, address = ?,
        tax_percent = ?, bill_amt = ?, tax_amt = ?, total_amt = ?, deduction = ?,
        percent = ?, deduction_amount = ?, deduction_remarks = ?
      WHERE id = ?
    `, [
      bill_no || '', date || '', customer || '', firstItemName, firstLotNo, totalQty, totalItemAmt,
      bill_no || '', pay_type || '', tax_type || '', type || '', remarks || '', address || '',
      parseFloat(tax_percent) || 0, parseFloat(bill_amt) || 0, parseFloat(tax_amt) || 0,
      parseFloat(total_amt) || 0, parseFloat(deduction) || 0, parseFloat(percent) || 0,
      parseFloat(deduction_amount) || 0, deduction_remarks || '', id
    ]);

    await connection.run('DELETE FROM quotation_items WHERE quotation_id = ?', [id]);

    if (items && Array.isArray(items)) {
      const insertItemQuery = `
        INSERT INTO quotation_items (
          quotation_id, item_name, qty, box, rate, disc, tax, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      for (const item of items) {
        if (!item.item_name) continue;
        await connection.run(insertItemQuery, [
          id, item.item_name, parseFloat(item.qty) || 0, parseFloat(item.box) || 0,
          parseFloat(item.rate) || 0, parseFloat(item.disc) || 0, parseFloat(item.tax) || 0,
          parseFloat(item.amount) || 0
        ]);
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'Quotation updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating quotation:', error);
    res.status(500).json({ success: false, message: 'Error updating quotation', error: error.message });
  }
});

// DELETE quotation
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id
    // cascade delete items
    await db.run('DELETE FROM quotation_items WHERE quotation_id = ?', [id])
    const result = await db.run('DELETE FROM quotations WHERE id = ?', [id])
    if (result.changes > 0) {
      res.json({ success: true, message: 'Quotation deleted successfully' })
    } else {
      res.status(404).json({ success: false, message: 'Quotation not found' })
    }
  } catch (error) {
    console.error('Error deleting quotation:', error)
    res.status(500).json({ success: false, message: 'Error deleting quotation', error: error.message })
  }
})

module.exports = router
