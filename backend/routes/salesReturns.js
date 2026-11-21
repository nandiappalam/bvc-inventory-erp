const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { createSalesReturnVoucherChain, deleteSalesReturnVoucherChain } = require('../utils/ledgerHelper');
const { rebuildStockLedger } = require('../utils/stockRebuilder');
const { syncDocumentMovements, deleteDocumentMovements } = require('../services/SourceMovementSync');

const getCompanyId = (req) => req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);
const _srSchemaEnsured = new Set();

async function ensureReturnColumns(companyId) {
  if (_srSchemaEnsured.has(companyId)) return;
  const returnCols = [
    'deduction TEXT', 'deduction_remarks TEXT', 'deduction_amount REAL DEFAULT 0', 'grand_total REAL DEFAULT 0',
    'loadman_name TEXT', 'loadman_worker_id INTEGER', 'loadman_rate_per_kg REAL DEFAULT 0.50', 'loadman_charges REAL DEFAULT 0'
  ];
  for (const col of returnCols) {
    try { await db.run(`ALTER TABLE sales_return ADD COLUMN ${col}`, [], companyId); } catch (_) {}
  }
  _srSchemaEnsured.add(companyId);
}

// Get all sales returns
router.get('/', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    await ensureReturnColumns(activeCompanyId);
    const sql = `
      SELECT sr.*, sri.item_name, sri.lot_no, sri.qty, sri.rate, sri.disc_perc, sri.tax_perc, sri.total_amt
      FROM sales_return sr
      LEFT JOIN sales_return_items sri ON sr.id = sri.sales_return_id
      ORDER BY sr.date DESC, sr.id DESC
    `;

    const result = await db.forCompany(activeCompanyId).query(sql, []);
    const salesReturnsMap = new Map();

    result.rows.forEach(row => {
      const returnId = row.id;
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
        });
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
        });
      }
    });

    res.json(Array.from(salesReturnsMap.values()));
  } catch (err) {
    console.error('Error fetching sales returns:', err);
    res.status(500).json({ error: 'Failed to fetch sales returns' });
  }
});

// GET next sequential S.No for sales return
router.get('/next-sno', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const result = await db.forCompany(activeCompanyId).query(`
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
    const activeCompanyId = getCompanyId(req);
    await ensureReturnColumns(activeCompanyId);
    const { id } = req.params;

    const sql = `
      SELECT sr.*, sri.item_name, sri.lot_no, sri.qty, sri.rate, sri.disc_perc, sri.tax_perc, sri.total_amt as item_total_amt
      FROM sales_return sr
      LEFT JOIN sales_return_items sri ON sr.id = sri.sales_return_id
      WHERE sr.id = ?
    `;

    const result = await db.forCompany(activeCompanyId).query(sql, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sales return not found' });
    }

    const salesReturn = {
      ...result.rows[0],
      items: result.rows
        .filter(r => r.item_name)
        .map(row => ({
          item_name: row.item_name,
          lot_no: row.lot_no,
          qty: row.qty,
          rate: row.rate,
          disc_perc: row.disc_perc,
          tax_perc: row.tax_perc,
          total_amt: row.item_total_amt
        }))
    };

    res.json(salesReturn);
  } catch (err) {
    console.error('Error fetching sales return:', err);
    res.status(500).json({ error: 'Failed to fetch sales return' });
  }
});

// Create new sales return
router.post('/', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    await ensureReturnColumns(activeCompanyId);
    const {
      s_no, date, customer, pay_type, tax_type, address, remarks,
      total_qty, total_wt, total_amt, items,
      deduction, deduction_remarks, deduction_amount, grand_total,
      loadman_name, loadman_worker_id, loadman_rate_per_kg, loadman_charges
    } = req.body;

    const validItems = Array.isArray(items)
      ? items.filter(item => {
          const name = item.item_name || item.itemName;
          return name && String(name).trim() !== '';
        })
      : [];

    if (items !== undefined && (!Array.isArray(items) || validItems.length === 0)) {
      return res.status(400).json({ success: false, error: 'At least one item with a valid name is required.' });
    }

    const cleanDate = date || new Date().toISOString().split('T')[0];

    const txResult = await db.forCompany(activeCompanyId).withTransaction(async () => {
      const result = await db.run(`
        INSERT INTO sales_return (
          s_no, date, customer, pay_type, tax_type, address, remarks, 
          total_qty, total_wt, total_amt, deduction, deduction_remarks, deduction_amount, grand_total,
          loadman_name, loadman_worker_id, loadman_rate_per_kg, loadman_charges
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        s_no || '',
        cleanDate,
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
        parseFloat(grand_total) || parseFloat(total_amt) || 0,
        loadman_name || '',
        loadman_worker_id || null,
        parseFloat(loadman_rate_per_kg) || 0.50,
        parseFloat(loadman_charges) || 0
      ], activeCompanyId);

      const salesReturnId = result.lastID || result.lastInsertRowid;

      for (const item of validItems) {
        const itName = item.item_name || item.itemName;
        const lotNo = item.lot_no || item.lotNo || '';
        const qtyVal = parseFloat(item.qty) || 0;
        const rateVal = parseFloat(item.rate) || 0;

        await db.run(`
          INSERT INTO sales_return_items (sales_return_id, item_name, lot_no, qty, rate, disc_perc, tax_perc, total_amt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          salesReturnId,
          itName,
          lotNo,
          qtyVal,
          rateVal,
          parseFloat(item.disc_perc) || 0,
          parseFloat(item.tax_perc) || 0,
          parseFloat(item.amount || item.total_amt) || 0
        ], activeCompanyId);

        if (itName && qtyVal > 0) {
          const lotCheck = await db.query(
            'SELECT id FROM stock_lots WHERE item_name = ? AND lot_no = ?',
            [itName, lotNo],
            activeCompanyId
          );

          if (lotCheck.rows.length > 0) {
            await db.run(
              'UPDATE stock_lots SET remaining_quantity = remaining_quantity + ? WHERE id = ?',
              [qtyVal, lotCheck.rows[0].id],
              activeCompanyId
            );
          } else {
            await db.run(
              'INSERT INTO stock_lots (item_name, lot_no, quantity, remaining_quantity) VALUES (?, ?, ?, ?)',
              [itName, lotNo, qtyVal, qtyVal],
              activeCompanyId
            );
          }

          await db.run(`
            INSERT INTO stock (date, item_name, lot_no, qty, rate, type, reference_id, status)
            VALUES (?, ?, ?, ?, ?, 'Sale Return', ?, 'Active')
          `, [cleanDate, itName, lotNo, qtyVal, rateVal, salesReturnId], activeCompanyId);
        }
      }

      const vRes = await createSalesReturnVoucherChain({
        companyId: activeCompanyId,
        customer,
        date: cleanDate,
        returnInvNo: s_no ? `SRT-${s_no}` : `SRT-${salesReturnId}`,
        sNo: s_no,
        salesReturnId,
        totalAmount: parseFloat(grand_total) || parseFloat(total_amt) || 0,
        baseAmount: Math.max(0, (parseFloat(grand_total) || parseFloat(total_amt) || 0) - (parseFloat(req.body.tax_amt) || 0)),
        taxAmount: parseFloat(req.body.tax_amt) || 0,
        deductionAmount: parseFloat(deduction_amount) || 0,
        isInterstate: String(tax_type || '').toLowerCase().includes('inter'),
        narration: remarks || `Sales Return #${s_no || salesReturnId}`
      });

      return { salesReturnId, voucherNo: vRes?.voucherNo || null };
    });

    try {
      await syncDocumentMovements(activeCompanyId, 'SALES_RETURN', txResult.salesReturnId, req.user?.username || 'admin');
    } catch (stkErr) {
      console.warn('Notice syncing stock movements on sales return save:', stkErr.message);
    }

    try {
      const { triggerTransactionNotification } = require('../utils/transactionNotifier');
      const retNo = s_no ? `SRT-${s_no}` : `SRT-${txResult.salesReturnId}`;
      const itemDesc = validItems.map(i => `${i.qty || 0} ${i.item_name || i.itemName || 'Item'}`).slice(0, 3).join(', ');
      const grandAmt = parseFloat(grand_total) || parseFloat(total_amt) || 0;
      await triggerTransactionNotification({
        eventType: 'SALES_RETURN_CREATED',
        moduleName: 'SALES_RETURN',
        referenceNo: retNo,
        referenceId: txResult.salesReturnId,
        companyId: activeCompanyId,
        title: `🟡 SALES RETURN – ${retNo}`,
        message: `Customer: ${customer || 'Customer'} | Items: ${itemDesc || 'Returned Stock'} | Qty: ${total_qty || 0} (${total_wt || 0} KG) | Amount: ₹${grandAmt}`,
        severity: 'WARNING',
        details: {
          reference_no: retNo,
          customer: customer || 'Customer',
          invoice_no: req.body.invoice_no || req.body.bill_no || '-',
          item_summary: itemDesc || 'Returned Goods',
          quantity: `${total_qty || 0} Bags / ${total_wt || 0} KG`,
          amount: grandAmt,
          remarks: remarks || '-',
          created_by: req.user?.username || 'Sales Operator',
          date: cleanDate
        }
      });
    } catch (notifErr) {
      console.warn('Notification warning (Sales Return):', notifErr.message);
    }

    res.status(201).json({ success: true, id: txResult.salesReturnId, voucher_no: txResult.voucherNo, message: 'Sales return created successfully' });
  } catch (err) {
    console.error('Error creating sales return:', err);
    res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Failed to create sales return' });
  }
});

// Update sales return
router.put('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    await ensureReturnColumns(activeCompanyId);
    const { id } = req.params;
    const {
      s_no, date, customer, pay_type, tax_type, address, remarks,
      total_qty, total_wt, total_amt, items,
      deduction, deduction_remarks, deduction_amount, grand_total,
      loadman_name, loadman_worker_id, loadman_rate_per_kg, loadman_charges
    } = req.body;

    const cleanDate = date || new Date().toISOString().split('T')[0];

    const vRes = await db.forCompany(activeCompanyId).withTransaction(async () => {
      const existingRes = await db.query('SELECT id FROM sales_return WHERE id = ?', [id], activeCompanyId);
      if (!existingRes.rows || existingRes.rows.length === 0) {
        const err = new Error('Sales return not found');
        err.statusCode = 404;
        throw err;
      }

      if (Array.isArray(items)) {
        const oldItemsRes = await db.query('SELECT item_name, lot_no, qty FROM sales_return_items WHERE sales_return_id = ?', [id], activeCompanyId);
        for (const oldItem of oldItemsRes.rows || []) {
          const oldQty = parseFloat(oldItem.qty) || 0;
          if (oldItem.item_name && oldQty > 0) {
            await db.run(
              'UPDATE stock_lots SET remaining_quantity = MAX(0, remaining_quantity - ?) WHERE item_name = ? AND lot_no = ?',
              [oldQty, oldItem.item_name, oldItem.lot_no || ''],
              activeCompanyId
            );
          }
        }
        await db.run('DELETE FROM sales_return_items WHERE sales_return_id = ?', [id], activeCompanyId);
        await db.run("DELETE FROM stock WHERE reference_id = ? AND type = 'Sale Return'", [id], activeCompanyId);

        const validItems = items.filter(item => (item.item_name || item.itemName) && String(item.item_name || item.itemName).trim() !== '');
        for (const item of validItems) {
          const itName = item.item_name || item.itemName;
          const lotNo = item.lot_no || item.lotNo || '';
          const qtyVal = parseFloat(item.qty) || 0;
          const rateVal = parseFloat(item.rate) || 0;

          await db.run(`
            INSERT INTO sales_return_items (sales_return_id, item_name, lot_no, qty, rate, disc_perc, tax_perc, total_amt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id,
            itName,
            lotNo,
            qtyVal,
            rateVal,
            parseFloat(item.disc_perc) || 0,
            parseFloat(item.tax_perc) || 0,
            parseFloat(item.amount || item.total_amt) || 0
          ], activeCompanyId);

          if (itName && qtyVal > 0) {
            const lotCheck = await db.query(
              'SELECT id FROM stock_lots WHERE item_name = ? AND lot_no = ?',
              [itName, lotNo],
              activeCompanyId
            );
            if (lotCheck.rows.length > 0) {
              await db.run(
                'UPDATE stock_lots SET remaining_quantity = remaining_quantity + ? WHERE id = ?',
                [qtyVal, lotCheck.rows[0].id],
                activeCompanyId
              );
            } else {
              await db.run(
                'INSERT INTO stock_lots (item_name, lot_no, quantity, remaining_quantity) VALUES (?, ?, ?, ?)',
                [itName, lotNo, qtyVal, qtyVal],
                activeCompanyId
              );
            }
            await db.run(`
              INSERT INTO stock (date, item_name, lot_no, qty, rate, type, reference_id, status)
              VALUES (?, ?, ?, ?, ?, 'Sale Return', ?, 'Active')
            `, [cleanDate, itName, lotNo, qtyVal, rateVal, id], activeCompanyId);
          }
        }
      }

      await db.run(`
        UPDATE sales_return
        SET s_no = ?, date = ?, customer = ?, pay_type = ?, tax_type = ?, address = ?, remarks = ?, 
            total_qty = ?, total_wt = ?, total_amt = ?, deduction = ?, deduction_remarks = ?, 
            deduction_amount = ?, grand_total = ?,
            loadman_name = ?, loadman_worker_id = ?, loadman_rate_per_kg = ?, loadman_charges = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        s_no, cleanDate, customer, pay_type, tax_type, address, remarks,
        total_qty, total_wt, total_amt, deduction, deduction_remarks,
        deduction_amount, grand_total,
        loadman_name || '', loadman_worker_id || null, parseFloat(loadman_rate_per_kg) || 0.50, parseFloat(loadman_charges) || 0,
        id
      ], activeCompanyId);

      return createSalesReturnVoucherChain({
        companyId: activeCompanyId,
        customer,
        date: cleanDate,
        returnInvNo: s_no ? `SRT-${s_no}` : `SRT-${id}`,
        sNo: s_no,
        salesReturnId: id,
        totalAmount: parseFloat(grand_total) || parseFloat(total_amt) || 0,
        baseAmount: Math.max(0, (parseFloat(grand_total) || parseFloat(total_amt) || 0) - (parseFloat(req.body.tax_amt) || 0)),
        taxAmount: parseFloat(req.body.tax_amt) || 0,
        deductionAmount: parseFloat(deduction_amount) || 0,
        isInterstate: String(tax_type || '').toLowerCase().includes('inter'),
        narration: remarks || `Sales Return #${s_no || id}`
      });
    });

    try {
      await syncDocumentMovements(activeCompanyId, 'SALES_RETURN', id, req.user?.username || 'admin');
    } catch (stkErr) {
      console.warn('Notice syncing stock movements on sales return update:', stkErr.message);
    }

    try {
      const { triggerTransactionNotification } = require('../utils/transactionNotifier');
      const retNo = s_no ? `SRT-${s_no}` : `SRT-${id}`;
      const retItems = Array.isArray(items) ? items : [];
      const itemSummary = retItems.map(i => `${i.qty || 0} ${i.itemName || i.item_name}`).slice(0, 3).join(', ') || 'Returned Goods';
      await triggerTransactionNotification({
        eventType: 'SALES_RETURN_UPDATED',
        isUpdate: true,
        moduleName: 'SALES_RETURN',
        referenceNo: retNo,
        referenceId: id,
        companyId: activeCompanyId,
        title: `✏️ SALES RETURN UPDATED – ${retNo}`,
        message: `Customer: ${customer || 'Customer'} | ${itemSummary} | Amount: ₹${parseFloat(grand_total || total_amt || 0)}`,
        severity: 'WARNING',
        details: {
          reference_no: retNo,
          customer: customer || 'Customer',
          invoice_no: s_no || retNo,
          item_summary: itemSummary,
          quantity: `${total_wt || 0} KG (${total_qty || 0} Bags)`,
          amount: parseFloat(grand_total || total_amt || 0),
          remarks: remarks || '-',
          updated_by: req.user?.username || 'Billing Desk',
          date: cleanDate
        }
      });
    } catch (notifErr) {
      console.warn('Notification warning (Sales Return Update):', notifErr.message);
    }

    res.json({ success: true, message: 'Sales return updated successfully', voucher_no: vRes?.voucherNo || null });
  } catch (err) {
    console.error('Error updating sales return:', err);
    res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Failed to update sales return' });
  }
});

// Delete sales return
router.delete('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const { id } = req.params;

    await db.forCompany(activeCompanyId).withTransaction(async () => {
      const existingRes = await db.query('SELECT id FROM sales_return WHERE id = ?', [id], activeCompanyId);
      if (!existingRes.rows || existingRes.rows.length === 0) {
        const err = new Error('Sales return not found');
        err.statusCode = 404;
        throw err;
      }

      const oldItemsRes = await db.query('SELECT item_name, lot_no, qty FROM sales_return_items WHERE sales_return_id = ?', [id], activeCompanyId);
      for (const oldItem of oldItemsRes.rows || []) {
        const oldQty = parseFloat(oldItem.qty) || 0;
        if (oldItem.item_name && oldQty > 0) {
          await db.run(
            'UPDATE stock_lots SET remaining_quantity = MAX(0, remaining_quantity - ?) WHERE item_name = ? AND lot_no = ?',
            [oldQty, oldItem.item_name, oldItem.lot_no || ''],
            activeCompanyId
          );
        }
      }

      await deleteSalesReturnVoucherChain(id, activeCompanyId);
      await db.run("DELETE FROM stock WHERE reference_id = ? AND type = 'Sale Return'", [id], activeCompanyId);
      await db.run('DELETE FROM sales_return_items WHERE sales_return_id = ?', [id], activeCompanyId);
      await db.run('DELETE FROM sales_return WHERE id = ?', [id], activeCompanyId);
    });

    try {
      await deleteDocumentMovements(activeCompanyId, 'SALES_RETURN', id, 'Sales return deleted', req.user?.username || 'admin');
    } catch (stkErr) {
      console.warn('Notice reversing stock movements on sales return delete:', stkErr.message);
    }

    res.json({ success: true, message: 'Sales return deleted successfully' });
  } catch (err) {
    console.error('Error deleting sales return:', err);
    res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Failed to delete sales return' });
  }
});

module.exports = router;
