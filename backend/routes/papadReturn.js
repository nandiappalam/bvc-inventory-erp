const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 1. GET next S.No for Papad Return (MUST be before /:id)
router.get('/next-sno', async (req, res) => {
  try {
    const result = await db.query('SELECT MAX(CAST(s_no AS INTEGER)) as max_sno, MAX(id) as max_id, COUNT(*) as total_count FROM papad_return');
    const maxVal = Math.max(
      parseInt(result.rows[0]?.max_sno, 10) || 0,
      parseInt(result.rows[0]?.max_id, 10) || 0,
      parseInt(result.rows[0]?.total_count, 10) || 0
    );
    const nextSNo = maxVal + 1;
    res.json({ 
      success: true, 
      next_s_no: String(nextSNo), 
      next_sno: nextSNo, 
      s_no: nextSNo, 
      sNo: nextSNo, 
      sno: nextSNo, 
      data: { s_no: nextSNo } 
    });
  } catch (error) {
    console.error('Error getting next S.No for papad return:', error);
    res.json({ success: true, next_s_no: '1', next_sno: 1, s_no: 1 });
  }
});

// 2. GET calculated Papad Balance and Payment Balance for a selected company (MUST be before /:id)
router.get('/balance', async (req, res) => {
  try {
    const companyParam = req.query.company || req.query.papad_company || req.query.papadCompany || req.query.company_id || '';
    if (!companyParam || !String(companyParam).trim()) {
      return res.json({ 
        success: true, 
        papad_balance: 0, 
        payment_balance: 0, 
        papadBalance: 0, 
        paymentBalance: 0 
      });
    }

    const companyStr = String(companyParam).trim();

    // 1. Get company details from papad_company_master
    const compRes = await db.query(`
      SELECT id, name, opening_advance, opening_balance, wages_kg 
      FROM papad_company_master 
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR CAST(id AS TEXT) = ?
      LIMIT 1
    `, [companyStr, companyStr]);

    const compData = compRes.rows[0] || {};
    const companyName = compData.name || companyStr;
    const companyId = compData.id ? String(compData.id) : '';

    const openingAdvance = parseFloat(compData.opening_advance) || 0;
    const openingBal = parseFloat(compData.opening_balance) || 0;

    // 2. Calculate Total Flour Out (Weight in KG given to company)
    const flourOutRes = await db.query(`
      SELECT 
        SUM(COALESCE(foi.total_wt, foi.weight * foi.qty, 0)) as total_flour_wt,
        SUM(COALESCE(fo.total_wages, 0)) as total_flour_wages
      FROM flour_out fo
      LEFT JOIN flour_out_items foi ON fo.id = foi.flour_out_id
      WHERE (LOWER(TRIM(fo.papad_company)) = LOWER(TRIM(?)) OR CAST(fo.papad_company AS TEXT) = ? OR LOWER(TRIM(fo.papad_company)) = LOWER(TRIM(?)))
        AND (foi.box_papad IS NULL OR foi.box_papad = 0)
    `, [companyName, companyId, companyStr]);

    const flourOutWt = parseFloat(flourOutRes.rows[0]?.total_flour_wt) || 0;
    const flourOutWages = parseFloat(flourOutRes.rows[0]?.total_flour_wages) || 0;

    // 3. Calculate Total Flour Out Returns (Weight returned)
    const flourRetRes = await db.query(`
      SELECT 
        SUM(COALESCE(fori.total_wt, fori.weight * fori.qty, 0)) as total_flour_ret_wt,
        SUM(COALESCE(foret.total_wages, 0)) as total_flour_ret_wages
      FROM flour_out_returns foret
      LEFT JOIN flour_out_return_items fori ON foret.id = fori.flour_out_return_id
      WHERE (LOWER(TRIM(foret.papad_company)) = LOWER(TRIM(?)) OR CAST(foret.papad_company AS TEXT) = ? OR LOWER(TRIM(foret.papad_company)) = LOWER(TRIM(?)))
    `, [companyName, companyId, companyStr]);

    const flourRetWt = parseFloat(flourRetRes.rows[0]?.total_flour_ret_wt) || 0;

    // 4. Calculate Total Papad In (Weight of papad received)
    const papadInRes = await db.query(`
      SELECT 
        SUM(COALESCE(foi.wt_papad, foi.total_wt, foi.weight * foi.qty, 0)) as total_papad_in_wt,
        SUM(COALESCE(foi.wages, foi.papad_kg * foi.wages_bag, 0)) as total_papad_wages
      FROM flour_out fo
      LEFT JOIN flour_out_items foi ON fo.id = foi.flour_out_id
      WHERE (LOWER(TRIM(fo.papad_company)) = LOWER(TRIM(?)) OR CAST(fo.papad_company AS TEXT) = ? OR LOWER(TRIM(fo.papad_company)) = LOWER(TRIM(?)))
        AND (foi.box_papad > 0 OR foi.wt_papad > 0 OR LOWER(foi.item_name) LIKE '%papad%')
    `, [companyName, companyId, companyStr]);

    const papadInWt = parseFloat(papadInRes.rows[0]?.total_papad_in_wt) || 0;
    const papadInWages = parseFloat(papadInRes.rows[0]?.total_papad_wages) || 0;

    // 5. Calculate Previous Papad Returns
    const papadRetRes = await db.query(`
      SELECT 
        SUM(CASE WHEN LOWER(type) = 'add' THEN -COALESCE(papad_less, 0) ELSE COALESCE(papad_less, 0) END) as total_papad_less,
        SUM(CASE WHEN LOWER(type) = 'add' THEN -COALESCE(payment_less, 0) ELSE COALESCE(payment_less, 0) END) as total_payment_less
      FROM papad_return
      WHERE (LOWER(TRIM(papad_company)) = LOWER(TRIM(?)) OR CAST(papad_company AS TEXT) = ? OR LOWER(TRIM(papad_company)) = LOWER(TRIM(?)))
    `, [companyName, companyId, companyStr]);

    const totalPapadLess = parseFloat(papadRetRes.rows[0]?.total_papad_less) || 0;
    const totalPaymentLess = parseFloat(papadRetRes.rows[0]?.total_payment_less) || 0;

    // 6. Calculate Payments from vouchers / ledger
    let totalPaid = 0;
    try {
      const voucherRes = await db.query(`
        SELECT SUM(COALESCE(ve.debit, 0)) as total_paid
        FROM voucher_entry ve
        WHERE (LOWER(TRIM(ve.ledger_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(ve.ledger_name)) = LOWER(TRIM(?)))
      `, [companyName, companyStr]);
      totalPaid = parseFloat(voucherRes.rows[0]?.total_paid) || 0;
    } catch (e) {
      console.warn('Could not query voucher_entry for company payments:', e.message);
    }

    // Net Papad Balance = (Opening Advance + Flour Out) - Flour Return - Papad In - Previous Papad Less
    const netPapadBalance = (openingAdvance + flourOutWt) - flourRetWt - papadInWt - totalPapadLess;

    // Net Payment Balance = Opening Balance + Wages - Paid - Previous Payment Less
    const totalEarnedWages = flourOutWages + papadInWages;
    const netPaymentBalance = (openingBal + totalEarnedWages) - totalPaid - totalPaymentLess;

    res.json({
      success: true,
      papad_balance: Math.max(0, parseFloat(netPapadBalance.toFixed(2))),
      payment_balance: parseFloat(netPaymentBalance.toFixed(2)),
      papadBalance: Math.max(0, parseFloat(netPapadBalance.toFixed(2))),
      paymentBalance: parseFloat(netPaymentBalance.toFixed(2))
    });
  } catch (error) {
    console.error('Error calculating papad balances:', error);
    res.status(500).json({ success: false, message: 'Error calculating balances', error: error.message });
  }
});

// 3. GET all papad return records
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        pr.id,
        pr.s_no,
        pr.s_no as sno,
        pr.s_no as sNo,
        pr.date,
        COALESCE(pcm.name, pr.papad_company) as papad_company,
        COALESCE(pcm.name, pr.papad_company) as papadCompany,
        COALESCE(pcm.name, pr.papad_company) as papad_company_name,
        pr.papad_company as papad_company_id,
        pr.papad_balance,
        pr.papad_balance as papadBalance,
        pr.payment_balance,
        pr.payment_balance as paymentBalance,
        pr.type,
        pr.papad_less,
        pr.papad_less as papadLess,
        pr.payment_less,
        pr.payment_less as paymentLess,
        pr.remarks,
        pr.created_at,
        pr.created_at as createdAt
      FROM papad_return pr
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(pr.papad_company AS TEXT) OR pcm.name = pr.papad_company)
      ORDER BY pr.id DESC
    `);
    
    const rows = (result.rows || []).map(r => ({
      ...r,
      id: r.id,
      s_no: r.s_no || '',
      sNo: r.s_no || '',
      sno: r.s_no || '',
      date: r.date ? String(r.date).substring(0, 10) : '',
      papad_company: r.papad_company || '',
      papadCompany: r.papadCompany || r.papad_company || '',
      papad_balance: parseFloat(r.papad_balance || 0) || 0,
      papadBalance: parseFloat(r.papad_balance || 0) || 0,
      payment_balance: parseFloat(r.payment_balance || 0) || 0,
      paymentBalance: parseFloat(r.payment_balance || 0) || 0,
      type: r.type || 'Less',
      papad_less: parseFloat(r.papad_less || 0) || 0,
      papadLess: parseFloat(r.papad_less || 0) || 0,
      payment_less: parseFloat(r.payment_less || 0) || 0,
      paymentLess: parseFloat(r.payment_less || 0) || 0,
      remarks: r.remarks || ''
    }));

    res.json(rows);
  } catch (error) {
    console.error('Error fetching papad return records:', error);
    res.status(500).json({ message: 'Error fetching papad return records', error: error.message });
  }
});

// 4. GET papad return by ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined' || id === 'null' || isNaN(Number(id))) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const result = await db.query(`
      SELECT 
        pr.*,
        COALESCE(pcm.name, pr.papad_company) as papad_company_name
      FROM papad_return pr
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(pr.papad_company AS TEXT) OR pcm.name = pr.papad_company)
      WHERE pr.id = ?
    `, [id]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const row = result.rows[0];
    res.json({
      ...row,
      sNo: row.s_no,
      s_no: row.s_no,
      papadCompany: row.papad_company,
      papad_company: row.papad_company,
      papadBalance: row.papad_balance,
      papad_balance: row.papad_balance,
      paymentBalance: row.payment_balance,
      payment_balance: row.payment_balance,
      papadLess: row.papad_less,
      papad_less: row.papad_less,
      paymentLess: row.payment_less,
      payment_less: row.payment_less
    });
  } catch (error) {
    console.error('Error fetching papad return record:', error);
    res.status(500).json({ message: 'Error fetching record', error: error.message });
  }
});

// 5. POST create papad return record
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const fd = body.formData || body;

    let sNoVal = fd.s_no || fd.sNo || fd.sno || '';
    if (!sNoVal || sNoVal === '1') {
      const maxSnoRes = await db.query('SELECT COALESCE(MAX(CAST(s_no AS INTEGER)), 0) as maxSno FROM papad_return');
      sNoVal = String((maxSnoRes.rows[0]?.maxSno || 0) + 1);
    }

    const date = fd.date || new Date().toISOString().slice(0, 10);
    const compVal = fd.papad_company || fd.papadCompany || fd.company || '';
    const papadBalVal = parseFloat(fd.papad_balance || fd.papadBalance || 0);
    const pymtBalVal = parseFloat(fd.payment_balance || fd.paymentBalance || 0);
    const typeVal = fd.type || 'Less';
    const papadLessVal = parseFloat(fd.papad_less || fd.papadLess || 0);
    const pymtLessVal = parseFloat(fd.payment_less || fd.paymentLess || 0);
    const remarksVal = fd.remarks || '';

    // Check if company exists in master
    if (compVal) {
      try {
        const existingComp = await db.query('SELECT id FROM papad_company_master WHERE name = ? OR CAST(id AS TEXT) = ?', [compVal, String(compVal)]);
        if (existingComp.rows.length === 0) {
          await db.run('INSERT INTO papad_company_master (name, status) VALUES (?, ?)', [compVal, 'Active']);
        }
      } catch (e) {}
    }

    const result = await db.run(`
      INSERT INTO papad_return (
        s_no, date, papad_company, papad_balance, payment_balance, type, papad_less, payment_less, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [sNoVal, date, compVal, papadBalVal, pymtBalVal, typeVal, papadLessVal, pymtLessVal, remarksVal]);

    res.status(201).json({
      success: true,
      message: 'Papad Return saved successfully!',
      id: result.lastID
    });
  } catch (error) {
    console.error('Error creating papad return:', error);
    res.status(500).json({ success: false, message: 'Error saving record', error: error.message });
  }
});

// 6. PUT update papad return record
router.put('/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const fd = body.formData || body;

    const sNoVal = fd.s_no || fd.sNo || fd.sno || '1';
    const date = fd.date || new Date().toISOString().slice(0, 10);
    const compVal = fd.papad_company || fd.papadCompany || fd.company || '';
    const papadBalVal = parseFloat(fd.papad_balance || fd.papadBalance || 0);
    const pymtBalVal = parseFloat(fd.payment_balance || fd.paymentBalance || 0);
    const typeVal = fd.type || 'Less';
    const papadLessVal = parseFloat(fd.papad_less || fd.papadLess || 0);
    const pymtLessVal = parseFloat(fd.payment_less || fd.paymentLess || 0);
    const remarksVal = fd.remarks || '';

    await db.run(`
      UPDATE papad_return SET 
        s_no = ?, date = ?, papad_company = ?, papad_balance = ?, payment_balance = ?,
        type = ?, papad_less = ?, payment_less = ?, remarks = ?
      WHERE id = ?
    `, [sNoVal, date, compVal, papadBalVal, pymtBalVal, typeVal, papadLessVal, pymtLessVal, remarksVal, req.params.id]);

    res.json({ success: true, message: 'Papad Return updated successfully!' });
  } catch (error) {
    console.error('Error updating papad return:', error);
    res.status(500).json({ success: false, message: 'Error updating record', error: error.message });
  }
});

// 7. DELETE papad return record
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM papad_return WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Error deleting papad return:', error);
    res.status(500).json({ success: false, message: 'Error deleting record', error: error.message });
  }
});

module.exports = router;
