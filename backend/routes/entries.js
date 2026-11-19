const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { createSalesLedgerEntries } = require('../utils/ledgerHelper');

// Ensure database tables have necessary columns for full sales and deductions
async function ensureSalesColumns() {
  const salesColumns = [
    "pay_type TEXT", "tax_type TEXT", "lorry_no TEXT", "p_o_no TEXT", "driver TEXT", 
    "pur_trans TEXT", "customer_id INTEGER", "address TEXT", "phone TEXT", 
    "sender_id INTEGER", "consignee_id INTEGER", "godown_from_id INTEGER",
    "bill_amt REAL DEFAULT 0", "tax_amt REAL DEFAULT 0", "total_amt REAL DEFAULT 0",
    "base_amt REAL DEFAULT 0", "grand_total REAL DEFAULT 0", "deduction TEXT", "deduction_remarks TEXT",
    "voucher_no TEXT", "cgst_amt REAL DEFAULT 0", "sgst_amt REAL DEFAULT 0", "igst_amt REAL DEFAULT 0",
    "is_order INTEGER DEFAULT 0", "loadman_name TEXT", "loadman_worker_id INTEGER", "loadman_rate_per_kg REAL DEFAULT 0.50", "loadman_charges REAL DEFAULT 0"
  ];
  for (const col of salesColumns) {
    try {
      await db.run(`ALTER TABLE sales ADD COLUMN ${col}`);
    } catch (e) {}
  }

  const itemsColumns = [
    "tax_rate REAL DEFAULT 0", "disc REAL DEFAULT 0", "box REAL DEFAULT 0"
  ];
  for (const col of itemsColumns) {
    try {
      await db.run(`ALTER TABLE sales_items ADD COLUMN ${col}`);
    } catch (e) {}
  }
}

// POST create new sales record from SalesCreate.jsx
router.post('/sale', async (req, res) => {
  try {
    await ensureSalesColumns();

    const { formData, items, totals } = req.body;

    if (!formData || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing form data or items' });
    }

    let s_no = formData.s_no || formData.sNo;
    const isOrderFlag = Boolean(formData.is_order) && Number(formData.is_order) === 1 ? 1 : 0;
    if (!s_no) {
      const maxRes = await db.query("SELECT COALESCE(MAX(CAST(NULLIF(s_no, '') AS INTEGER)), 0) AS max_sno FROM sales WHERE COALESCE(is_order, 0) = ?", [isOrderFlag]);
      const maxVal = parseInt(maxRes.rows?.[0]?.max_sno, 10) || 0;
      s_no = maxVal + 1;
    }

    // Calculate totals (support totals.totalAmt, totals.netAmount, totals.totalAmount, totals.grandTotal, and item sums)
    const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    const totalWt = items.reduce((sum, item) => sum + (parseFloat(item.totalWt || item.weight) || 0), 0);
    const itemsAmtSum = items.reduce((sum, item) => sum + (parseFloat(item.totalAmt || item.total_amt || item.amount) || 0), 0);
    const totalAmt = parseFloat(formData.total_amt) || parseFloat(totals?.totalAmt) || parseFloat(totals?.netAmount) || parseFloat(totals?.totalAmount) || parseFloat(totals?.grandTotal) || parseFloat(formData.grand_total) || itemsAmtSum;

    const deductionsJson = JSON.stringify(formData.selectedDeductions || req.body.selectedDeductions || []);
    const grandTotalVal = parseFloat(formData.grand_total) || parseFloat(totals?.grandTotal) || parseFloat(totals?.totalAmt) || totalAmt;

    // Insert sales main record
    const salesResult = await db.run(`
      INSERT INTO sales (
        s_no, date, customer, remarks, total_qty, total_wt, total_amt,
        pay_type, tax_type, lorry_no, p_o_no, driver, pur_trans,
        customer_id, address, phone, sender_id, consignee_id, godown_from_id,
        bill_amt, tax_amt, base_amt, grand_total, deduction, deduction_remarks, deduction_amount, deductions_json,
        is_order, loadman_name, loadman_worker_id, loadman_rate_per_kg, loadman_charges
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      s_no,
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
      formData.is_order ? 1 : 0,
      formData.loadman_name || '',
      formData.loadman_worker_id || null,
      parseFloat(formData.loadman_rate_per_kg) || 0.50,
      parseFloat(formData.loadman_charges) || 0
    ]);

    const salesId = salesResult.lastID;

    // Filter out empty rows or rows without a valid item name
    const validItems = items.filter(item => {
      const name = item.itemName || item.item_name;
      return name && String(name).trim() !== '';
    });

    if (validItems.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item with a valid name is required.' });
    }

    // Process and insert items
    for (const item of validItems) {
      const itemName = item.itemName || item.item_name;
      const lotNo = item.lotNo || item.lot_no;
      const qty = parseFloat(item.qty) || 0;
      const weight = parseFloat(item.weight || item.weight_val) || 0;
      const itemTotalWt = parseFloat(item.totalWt || item.total_wt) || (qty * weight);
      const rate = parseFloat(item.rate) || 0;
      const disc = parseFloat(item.disc || item.disc_perc) || 0;
      const taxRate = parseFloat(item.tax || item.tax_rate) || 0;
      const itemAmt = parseFloat(item.amount || item.total_amt) || 0;
      const box = parseFloat(item.box) || 0;

      // Insert sales item record
      await db.run(`
        INSERT INTO sales_items (
          sales_id, item_name, lot_no, weight, qty, total_wt, rate, disc_perc, tax_perc, total_amt, tax_rate, disc, box
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        salesId, itemName, lotNo || '', weight, qty, itemTotalWt, rate, disc, taxRate, itemAmt, taxRate, disc, box
      ]);

      // Deduct from stock only if NOT a sales order
      if (!formData.is_order) {
        let remainingToDeduct = qty;

        // 1. Try exact lot deduction first if lotNo is provided
        if (lotNo) {
          const lotResult = await db.query(`
            SELECT id, remaining_quantity, lot_no 
            FROM stock_lots 
            WHERE item_name = ? AND lot_no = ? AND remaining_quantity > 0
          `, [itemName, lotNo]);

          if (lotResult.rows.length > 0) {
            const lot = lotResult.rows[0];
            const deduct = Math.min(lot.remaining_quantity, remainingToDeduct);
            await db.run(`
              UPDATE stock_lots 
              SET remaining_quantity = MAX(0, remaining_quantity - ?)
              WHERE id = ?
            `, [deduct, lot.id]);

            // Insert negative stock entry for tracking this lot deduction
            await db.run(`
              INSERT INTO stock (date, item_name, lot_no, qty, rate, weight, amount, type, reference_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'Sale', ?)
            `, [
              formData.date || new Date().toISOString().split('T')[0],
              itemName,
              lot.lot_no,
              -deduct,
              rate,
              -weight * (deduct / qty),
              -itemAmt * (deduct / qty),
              salesId
            ]);

            remainingToDeduct -= deduct;
          }
        }

        // 2. Fallback to FIFO if there is still quantity to deduct
        if (remainingToDeduct > 0) {
          const availableLots = await db.query(`
            SELECT id, remaining_quantity, lot_no 
            FROM stock_lots 
            WHERE item_name = ? AND remaining_quantity > 0
            ORDER BY created_at ASC
          `, [itemName]);

          for (const lot of availableLots.rows) {
            if (remainingToDeduct <= 0) break;
            const deduct = Math.min(lot.remaining_quantity, remainingToDeduct);
            await db.run(`
              UPDATE stock_lots 
              SET remaining_quantity = MAX(0, remaining_quantity - ?)
              WHERE id = ?
            `, [deduct, lot.id]);

            // Insert negative stock entry for tracking this lot deduction
            await db.run(`
              INSERT INTO stock (date, item_name, lot_no, qty, rate, weight, amount, type, reference_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'Sale', ?)
            `, [
              formData.date || new Date().toISOString().split('T')[0],
              itemName,
              lot.lot_no,
              -deduct,
              rate,
              -weight * (deduct / qty),
              -itemAmt * (deduct / qty),
              salesId
            ]);

            remainingToDeduct -= deduct;
          }
        }
      }
    }

    // Post to ledger and create Sales Voucher chain ONLY for actual Sales Invoices (not Sales Orders)
    let voucherNo = null;
    if (!isOrderFlag && grandTotalVal > 0) {
      try {
        const salesTaxVal = parseFloat(formData.tax_amt) || parseFloat(totals?.taxAmount) || 0;
        const isInterstateSales = String(formData.tax_type || '').toLowerCase().includes('inter');
        const cgstSales = parseFloat(formData.cgst_amt) || (isInterstateSales ? 0 : Number((salesTaxVal / 2).toFixed(2)));
        const sgstSales = parseFloat(formData.sgst_amt) || (isInterstateSales ? 0 : Number((salesTaxVal - cgstSales).toFixed(2)));
        const igstSales = parseFloat(formData.igst_amt) || (isInterstateSales ? salesTaxVal : 0);

        const rawSelected = Array.isArray(formData.selectedDeductions)
          ? formData.selectedDeductions
          : (Array.isArray(req.body.selectedDeductions) ? req.body.selectedDeductions : []);
        const normalizedDeductions = rawSelected
          .map(d => {
            const amt = parseFloat(d?.amount || d?.deduction_amount || 0);
            if (!(amt > 0)) return null;
            const rawType = String(d?.type || d?.ded_type || d?.deduction_type || '').trim().toUpperCase();
            const isAdd = rawType === 'ADD' || rawType === '+' || rawType === 'ADDITION' || rawType === 'PLUS';
            return {
              deduction_id: d?.deduction_id || d?.id || null,
              name: (d?.deduction_name || d?.name || d?.deduction || '').trim() || (isAdd ? 'Other Charges' : 'Sales Deduction'),
              type: isAdd ? 'ADD' : 'LESS',
              amount: amt,
              remarks: d?.remarks || ''
            };
          })
          .filter(Boolean);

        const customManualDed = parseFloat(formData.deduction) || 0;
        if (customManualDed > 0) {
          normalizedDeductions.push({
            name: 'Manual Deduction',
            type: 'LESS',
            amount: customManualDed,
            remarks: formData.deduction_remarks || ''
          });
        } else if (normalizedDeductions.length === 0 && formData.deduction_amount) {
          const rawDedAmt = parseFloat(formData.deduction_amount) || 0;
          if (rawDedAmt !== 0) {
            const isAdd = rawDedAmt < 0;
            normalizedDeductions.push({
              name: (formData.deduction && isNaN(Number(formData.deduction)))
                ? String(formData.deduction).trim()
                : (isAdd ? 'Other Charges' : 'Sales Deduction'),
              type: isAdd ? 'ADD' : 'LESS',
              amount: Math.abs(rawDedAmt),
              remarks: formData.deduction_remarks || ''
            });
          }
        }

        const vRes = await createSalesLedgerEntries({
          customer: formData.customer_id || formData.customer,
          date: formData.date || new Date().toISOString().split('T')[0],
          invNo: s_no,
          salesId: salesId,
          totalAmount: grandTotalVal,
          taxAmount: salesTaxVal,
          cgstAmount: cgstSales,
          sgstAmount: sgstSales,
          igstAmount: igstSales,
          isInterstate: isInterstateSales,
          discAmount: 0,
          baseAmount: parseFloat(totals?.baseAmount) || parseFloat(formData.bill_amt) || Math.max(0, totalAmt - salesTaxVal),
          deductions: normalizedDeductions
        });
        voucherNo = vRes?.voucherNo || null;
        if (voucherNo) {
          await db.run('UPDATE sales SET voucher_no = ? WHERE id = ?', [voucherNo, salesId]).catch(() => {});
        }
        console.log('✓ Sales Voucher chain and ledger entries auto-created for sales ID:', salesId);
      } catch (ledgerErr) {
        console.error('Error auto-creating Sales Voucher chain:', ledgerErr);
      }
    }

    return res.status(201).json({
      success: true,
      message: isOrderFlag ? 'Sales Order saved successfully!' : 'Sales record saved successfully!',
      id: salesId,
      voucher_no: voucherNo
    });

  } catch (err) {
    console.error('Error saving sales entry:', err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
