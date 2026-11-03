const express = require('express')
const router = express.Router()
const db = require('../config/database')

const createQuotationsDeductionsTable = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS quotation_deductions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        deduction_id TEXT,
        name TEXT,
        type TEXT,
        percent TEXT,
        amount REAL,
        remarks TEXT
      )
    `);
  } catch (e) {}
};
createQuotationsDeductionsTable();

const createQuotationItemsTable = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        item_name TEXT,
        lot_no TEXT,
        weight TEXT,
        tax_type TEXT,
        qty REAL,
        box REAL,
        rate REAL,
        disc REAL,
        tax REAL,
        amount REAL
      )
    `);
    // Ensure columns exist (for updates to existing tables)
    try { await db.run(`ALTER TABLE quotation_items ADD COLUMN lot_no TEXT`); } catch (e) {}
    try { await db.run(`ALTER TABLE quotation_items ADD COLUMN weight TEXT`); } catch (e) {}
    try { await db.run(`ALTER TABLE quotation_items ADD COLUMN tax_type TEXT`); } catch (e) {}
  } catch (e) {}
};
createQuotationItemsTable();

const ensureQuotationColumns = async () => {
  try {
    await db.run(`ALTER TABLE quotations ADD COLUMN stock_type TEXT`);
  } catch (e) {}
};
ensureQuotationColumns();

// GET next Bill No for quotations - sequences automatically starting from 1
const getNextQuotationBillNo = async (req, res) => {
  try {
    const maxBillNo = await db.query('SELECT MAX(CAST(bill_no AS INTEGER)) as max_bill_no FROM quotations WHERE bill_no IS NOT NULL AND bill_no != ""')
    const maxVal = maxBillNo.rows[0]?.max_bill_no;
    const next_bill_no = (!maxVal || maxVal < 1) ? 1 : maxVal + 1;
    res.json({ 
      success: true, 
      next_bill_no,
      next_sno: next_bill_no,
      s_no: next_bill_no,
      bill_no: next_bill_no,
      data: {
        next_bill_no,
        bill_no: next_bill_no,
        next_sno: next_bill_no,
        s_no: next_bill_no
      }
    })
  } catch (error) {
    console.error('Error fetching next Bill No for quotation:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch next Bill No' })
  }
};

router.get('/next-bill-no', getNextQuotationBillNo);
router.get('/next-sno', getNextQuotationBillNo);

// GET all quotations
router.get('/', async (req, res) => {
  try {
    const qResult = await db.query(`
      SELECT 
        q.id,
        q.bill_no,
        q.bill_no as s_no,
        q.bill_no as sNo,
        q.date,
        q.customer as customer_id,
        COALESCE(cm.name, pcm.name, lm.name, q.customer) as customer,
        COALESCE(cm.name, pcm.name, lm.name, q.customer) as customer_name,
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
        q.created_at
      FROM quotations q
      LEFT JOIN customer_master cm ON (CAST(cm.id AS TEXT) = CAST(q.customer AS TEXT) OR cm.name = q.customer)
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(q.customer AS TEXT) OR pcm.name = q.customer)
      LEFT JOIN ledgermaster lm ON (CAST(lm.id AS TEXT) = CAST(q.customer AS TEXT) OR lm.name = q.customer)
      ORDER BY q.id DESC
    `);

    const quotations = qResult.rows || [];
    if (quotations.length === 0) {
      return res.json([]);
    }

    const itemsResult = await db.query(`
      SELECT * FROM quotation_items ORDER BY id ASC
    `);
    const allItems = itemsResult.rows || [];

    const dedResult = await db.query(`
      SELECT * FROM quotation_deductions ORDER BY id ASC
    `);
    const allDeds = dedResult.rows || [];

    const itemsByQuotation = {};
    for (const item of allItems) {
      if (!itemsByQuotation[item.quotation_id]) {
        itemsByQuotation[item.quotation_id] = [];
      }
      itemsByQuotation[item.quotation_id].push(item);
    }

    const dedsByQuotation = {};
    for (const ded of allDeds) {
      if (!dedsByQuotation[ded.quotation_id]) {
        dedsByQuotation[ded.quotation_id] = [];
      }
      dedsByQuotation[ded.quotation_id].push(ded);
    }

    const enrichedQuotations = quotations.map(q => {
      const qItems = itemsByQuotation[q.id] || [];
      const qDeds = dedsByQuotation[q.id] || [];
      const itemNames = qItems.map(it => it.item_name).filter(Boolean);
      const totalQty = qItems.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0);
      const firstItem = qItems[0] || {};
      return {
        ...q,
        items: qItems,
        deductions: qDeds,
        item_name: itemNames.join(', ') || q.item_name || '',
        lot_no: q.lot_no || firstItem.lot_no || '',
        qty: totalQty || q.qty || 0,
        rate: firstItem.rate || 0,
        tax_perc: q.tax_percent || firstItem.tax || 0,
        disc_perc: firstItem.disc || 0
      };
    });

    res.json(enrichedQuotations);
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({ message: 'Error fetching quotations', error: error.message });
  }
});

// POST a new quotation
router.post('/', async (req, res) => {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    
    const {
      bill_no, date, pay_type, tax_type, type, remarks, customer, address,
      tax_percent, amount, bill_amt, tax_amt, total_amt, deduction, percent,
      deduction_amount, deduction_remarks, items, deductions,
      loadman_name, loadman_worker_id, loadman_rate_per_kg, loadman_charges,
      stock_type
    } = req.body

    // First, insert quotation
    const insertQuotationQuery = `
      INSERT INTO quotations (
        s_no, date, customer, item_name, lot_no, qty, amount,
        bill_no, pay_type, tax_type, type, remarks, address,
        tax_percent, bill_amt, tax_amt, total_amt, deduction,
        percent, deduction_amount, deduction_remarks,
        loadman_name, loadman_worker_id, loadman_rate_per_kg, loadman_charges,
        stock_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    // We can extract first item's name & lot as summary values if items exist
    const firstItemName = items && items[0] ? items[0].item_name : ''
    const firstLotNo = items && items[0] ? (items[0].lot_no || '') : ''
    const totalQty = items ? items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0) : 0
    const totalItemAmt = items ? items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) : 0

    // Ensure sequential bill_no starting from 1
    let finalBillNo = bill_no;
    if (!finalBillNo || String(finalBillNo).trim() === '' || isNaN(Number(finalBillNo))) {
      const maxRes = await connection.query('SELECT MAX(CAST(bill_no AS INTEGER)) as max_bill_no FROM quotations WHERE bill_no IS NOT NULL AND bill_no != ""');
      const maxVal = maxRes.rows[0]?.max_bill_no;
      finalBillNo = (!maxVal || maxVal < 1) ? '1' : String(maxVal + 1);
    } else {
      finalBillNo = String(finalBillNo).trim();
    }

    const quotationResult = await connection.run(insertQuotationQuery, [
      finalBillNo, date || '', customer || '', firstItemName, firstLotNo, totalQty, totalItemAmt,
      finalBillNo, pay_type || '', tax_type || '', type || '', remarks || '', address || '',
      parseFloat(tax_percent) || 0, parseFloat(bill_amt) || 0, parseFloat(tax_amt) || 0,
      parseFloat(total_amt) || 0, parseFloat(deduction) || 0, parseFloat(percent) || 0,
      parseFloat(deduction_amount) || 0, deduction_remarks || '',
      loadman_name || '', loadman_worker_id || null, parseFloat(loadman_rate_per_kg) || 0.50, parseFloat(loadman_charges) || 0,
      stock_type || 'RM'
    ])

    const quotationId = quotationResult.lastInsertRowid || quotationResult.lastID

    // Now insert quotation items if any with all columns (lot_no, weight, tax_type)
    if (items && Array.isArray(items)) {
      const insertItemQuery = `
        INSERT INTO quotation_items (
          quotation_id, item_name, lot_no, weight, tax_type, qty, box, rate, disc, tax, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      for (const item of items) {
        if (!item.item_name) continue
        await connection.run(insertItemQuery, [
          quotationId, item.item_name, item.lot_no || firstLotNo || '', item.weight || item.per_unit_wt || '50 KG',
          item.tax_type || (parseFloat(item.tax) > 0 ? 'Taxable' : 'Nil Rated'),
          parseFloat(item.qty) || 0, parseFloat(item.box) || 0,
          parseFloat(item.rate) || 0, parseFloat(item.disc) || 0, parseFloat(item.tax) || 0,
          parseFloat(item.amount) || 0
        ])
      }
    }

    if (deductions && Array.isArray(deductions)) {
      const insertDedQuery = `
        INSERT INTO quotation_deductions (
          quotation_id, deduction_id, name, type, percent, amount, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      for (const ded of deductions) {
        if (!ded.name && !ded.deduction_id && !ded.amount) continue
        await connection.run(insertDedQuery, [
          quotationId, ded.deduction_id || '', ded.name || '', ded.type || 'LESS',
          ded.percent || '', parseFloat(ded.amount) || 0, ded.remarks || ''
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
    const qRes = await db.query(`
      SELECT 
        q.*,
        q.customer as customer_id,
        COALESCE(cm.name, pcm.name, lm.name, q.customer) as customer_name
      FROM quotations q
      LEFT JOIN customer_master cm ON (CAST(cm.id AS TEXT) = CAST(q.customer AS TEXT) OR cm.name = q.customer)
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(q.customer AS TEXT) OR pcm.name = q.customer)
      LEFT JOIN ledgermaster lm ON (CAST(lm.id AS TEXT) = CAST(q.customer AS TEXT) OR lm.name = q.customer)
      WHERE q.id = ?
    `, [req.params.id]);
    if (!qRes.rows || qRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }
    const quotation = qRes.rows[0];
    const itemsRes = await db.query('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC', [req.params.id]);
    const rawItems = itemsRes.rows || [];

    // Ensure all existing item details (lot_no, weight, tax, tax_type) are reliably populated
    quotation.items = rawItems.map(it => {
      const lotVal = it.lot_no || quotation.lot_no || '';
      const taxVal = (it.tax !== null && it.tax !== undefined && it.tax !== '' && parseFloat(it.tax) > 0)
        ? it.tax
        : (quotation.tax_percent || 0);
      const taxTypeVal = it.tax_type || (parseFloat(taxVal) > 0 ? 'Taxable' : 'Nil Rated');
      const weightVal = (it.weight !== null && it.weight !== undefined && it.weight !== '')
        ? it.weight
        : '50 KG';

      return {
        ...it,
        lot_no: lotVal,
        weight: weightVal,
        tax: taxVal,
        tax_type: taxTypeVal
      };
    });

    const dedRes = await db.query('SELECT * FROM quotation_deductions WHERE quotation_id = ? ORDER BY id ASC', [req.params.id]);
    quotation.deductions = dedRes.rows || [];

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
      deduction_amount, deduction_remarks, items, deductions,
      loadman_name, loadman_worker_id, loadman_rate_per_kg, loadman_charges,
      stock_type
    } = req.body;

    const firstItemName = items && items[0] ? items[0].item_name : '';
    const firstLotNo = items && items[0] ? (items[0].lot_no || '') : '';
    const totalQty = items ? items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0) : 0;
    const totalItemAmt = items ? items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) : 0;

    await connection.run(`
      UPDATE quotations SET
        s_no = ?, date = ?, customer = ?, item_name = ?, lot_no = ?, qty = ?, amount = ?,
        bill_no = ?, pay_type = ?, tax_type = ?, type = ?, remarks = ?, address = ?,
        tax_percent = ?, bill_amt = ?, tax_amt = ?, total_amt = ?, deduction = ?,
        percent = ?, deduction_amount = ?, deduction_remarks = ?,
        loadman_name = ?, loadman_worker_id = ?, loadman_rate_per_kg = ?, loadman_charges = ?,
        stock_type = ?
      WHERE id = ?
    `, [
      bill_no || '', date || '', customer || '', firstItemName, firstLotNo, totalQty, totalItemAmt,
      bill_no || '', pay_type || '', tax_type || '', type || '', remarks || '', address || '',
      parseFloat(tax_percent) || 0, parseFloat(bill_amt) || 0, parseFloat(tax_amt) || 0,
      parseFloat(total_amt) || 0, parseFloat(deduction) || 0, parseFloat(percent) || 0,
      parseFloat(deduction_amount) || 0, deduction_remarks || '',
      loadman_name || '', loadman_worker_id || null, parseFloat(loadman_rate_per_kg) || 0.50, parseFloat(loadman_charges) || 0,
      stock_type || 'RM',
      id
    ]);

    await connection.run('DELETE FROM quotation_items WHERE quotation_id = ?', [id]);

    if (items && Array.isArray(items)) {
      const insertItemQuery = `
        INSERT INTO quotation_items (
          quotation_id, item_name, lot_no, weight, tax_type, qty, box, rate, disc, tax, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      for (const item of items) {
        if (!item.item_name) continue;
        await connection.run(insertItemQuery, [
          id, item.item_name, item.lot_no || firstLotNo || '', item.weight || item.per_unit_wt || '50 KG',
          item.tax_type || (parseFloat(item.tax) > 0 ? 'Taxable' : 'Nil Rated'), 
          parseFloat(item.qty) || 0, parseFloat(item.box) || 0,
          parseFloat(item.rate) || 0, parseFloat(item.disc) || 0, parseFloat(item.tax) || 0,
          parseFloat(item.amount) || 0
        ]);
      }
    }

    await connection.run('DELETE FROM quotation_deductions WHERE quotation_id = ?', [id]);

    if (deductions && Array.isArray(deductions)) {
      const insertDedQuery = `
        INSERT INTO quotation_deductions (
          quotation_id, deduction_id, name, type, percent, amount, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      for (const ded of deductions) {
        if (!ded.name && !ded.deduction_id && !ded.amount) continue;
        await connection.run(insertDedQuery, [
          id, ded.deduction_id || '', ded.name || '', ded.type || 'LESS',
          ded.percent || '', parseFloat(ded.amount) || 0, ded.remarks || ''
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
