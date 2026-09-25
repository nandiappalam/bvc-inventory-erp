const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET all papad return records
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        pr.id,
        pr.s_no,
        pr.s_no as sNo,
        pr.s_no as sno,
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
        pr.created_at
      FROM papad_return pr
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(pr.papad_company AS TEXT) OR pcm.name = pr.papad_company)
      ORDER BY pr.id DESC
    `);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching papad return records:', error);
    res.status(500).json({ message: 'Error fetching papad return records', error: error.message });
  }
});

// GET next S.No
router.get('/next-sno', async (req, res) => {
  try {
    const result = await db.query('SELECT MAX(CAST(s_no AS INTEGER)) as max_sno, MAX(id) as max_id, COUNT(*) as total_count FROM papad_return');
    const maxVal = Math.max(
      parseInt(result.rows[0]?.max_sno) || 0,
      parseInt(result.rows[0]?.max_id) || 0,
      parseInt(result.rows[0]?.total_count) || 0
    );
    const nextSNo = maxVal + 1;
    res.json({ success: true, next_s_no: String(nextSNo), next_sno: nextSNo, s_no: nextSNo, sNo: nextSNo, data: { s_no: nextSNo } });
  } catch (error) {
    console.error('Error getting next S.No for papad return:', error);
    res.json({ success: true, next_s_no: '1', next_sno: 1, s_no: 1 });
  }
});

// GET balance for a specific company
router.get(['/company-balance', '/company-balance/:company'], async (req, res) => {
  try {
    const company = req.params.company || req.query.company || req.query.name || '';
    if (!company) {
      return res.json({ success: true, papadBalance: '0.00', paymentBalance: '0.00' });
    }

    // 1. Fetch from papad_company_master
    const compRes = await db.query(`
      SELECT id, name, opening_balance, opening_advance 
      FROM papad_company_master 
      WHERE id = ? OR CAST(id AS TEXT) = ? OR LOWER(name) = LOWER(?)
      LIMIT 1
    `, [company, String(company), String(company)]);

    const comp = compRes.rows[0] || {};
    const compName = comp.name || company;
    const compId = comp.id || company;

    let papadBal = parseFloat(comp.opening_balance || 0);
    let paymentBal = parseFloat(comp.opening_advance || 0);

    // 2. Flour Out transactions
    const foRes = await db.query(`
      SELECT 
        COALESCE(SUM(foi.papad_kg), SUM(foi.total_wt), 0) as total_papad_kg,
        COALESCE(SUM(foi.wages), 0) as total_wages
      FROM flour_out fo
      JOIN flour_out_items foi ON fo.id = foi.flour_out_id
      WHERE (fo.papad_company = ? OR fo.papad_company = ? OR fo.papad_company = ?)
        AND (fo.entry_type = 'Flour Out' OR fo.entry_type IS NULL)
        AND (foi.box_papad IS NULL OR foi.box_papad = 0)
    `, [String(compId), compName, company]);

    const flourPapadKg = parseFloat(foRes.rows[0]?.total_papad_kg || 0);
    const flourWages = parseFloat(foRes.rows[0]?.total_wages || 0);

    // 3. Papad In transactions
    const piRes = await db.query(`
      SELECT 
        COALESCE(SUM(foi.total_wt), SUM(foi.wt_papad), 0) as total_received_wt
      FROM flour_out fo
      JOIN flour_out_items foi ON fo.id = foi.flour_out_id
      WHERE (fo.papad_company = ? OR fo.papad_company = ? OR fo.papad_company = ?)
        AND (fo.entry_type = 'Papad In' OR foi.box_papad > 0 OR foi.wt_papad > 0)
    `, [String(compId), compName, company]);

    const receivedPapadKg = parseFloat(piRes.rows[0]?.total_received_wt || 0);

    // 4. Advances given to company
    let advanceTotal = 0;
    try {
      const advRes = await db.query(`
        SELECT COALESCE(SUM(amount), 0) as total_adv
        FROM advances
        WHERE (party_name = ? OR party_name = ? OR papad_company = ? OR papad_company = ?)
      `, [compName, String(compId), compName, String(compId)]);
      advanceTotal = parseFloat(advRes.rows[0]?.total_adv || 0);
    } catch (e) {}

    // 5. Existing Papad Returns
    const prRes = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'Less' THEN papad_less ELSE -papad_less END), 0) as papad_less_total,
        COALESCE(SUM(CASE WHEN type = 'Less' THEN payment_less ELSE -payment_less END), 0) as payment_less_total
      FROM papad_return
      WHERE (papad_company = ? OR papad_company = ? OR papad_company = ?)
    `, [String(compId), compName, company]);

    const retPapadLess = parseFloat(prRes.rows[0]?.papad_less_total || 0);
    const retPymtLess = parseFloat(prRes.rows[0]?.payment_less_total || 0);

    papadBal = papadBal + flourPapadKg - receivedPapadKg - retPapadLess;
    paymentBal = paymentBal + advanceTotal + flourWages - retPymtLess;

    res.json({
      success: true,
      company: compName,
      papadBalance: papadBal.toFixed(2),
      paymentBalance: paymentBal.toFixed(2)
    });
  } catch (error) {
    console.error('Error calculating company balance:', error);
    res.json({ success: true, papadBalance: '0.00', paymentBalance: '0.00' });
  }
});

// GET papad return by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM papad_return WHERE id = ?', [req.params.id]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching papad return record:', error);
    res.status(500).json({ message: 'Error fetching record', error: error.message });
  }
});

// POST create papad return record
router.post('/', async (req, res) => {
  try {
    const {
      s_no, sNo,
      date,
      papad_company, papadCompany,
      papad_balance, papadBalance,
      payment_balance, paymentBalance,
      type,
      papad_less, papadLess,
      payment_less, paymentLess,
      remarks
    } = req.body;

    let sNoVal = s_no || sNo;
    if (!sNoVal || sNoVal === '1' || sNoVal === 1 || sNoVal === '') {
      const maxRes = await db.query('SELECT COALESCE(MAX(CAST(s_no AS INTEGER)), 0) as max_sno FROM papad_return');
      const nextNum = (parseInt(maxRes.rows[0]?.max_sno) || 0) + 1;
      sNoVal = String(nextNum);
    }
    const compVal = papad_company || papadCompany || '';
    const papadBalVal = parseFloat(papad_balance || papadBalance || 0);
    const pymtBalVal = parseFloat(payment_balance || paymentBalance || 0);
    const typeVal = type || 'Less';
    const papadLessVal = parseFloat(papad_less || papadLess || 0);
    const pymtLessVal = parseFloat(payment_less || paymentLess || 0);
    const remarksVal = remarks || '';

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

// PUT update papad return record
router.put('/:id', async (req, res) => {
  try {
    const {
      s_no, sNo,
      date,
      papad_company, papadCompany,
      papad_balance, papadBalance,
      payment_balance, paymentBalance,
      type,
      papad_less, papadLess,
      payment_less, paymentLess,
      remarks
    } = req.body;

    const sNoVal = s_no || sNo || '1';
    const compVal = papad_company || papadCompany || '';
    const papadBalVal = parseFloat(papad_balance || papadBalance || 0);
    const pymtBalVal = parseFloat(payment_balance || paymentBalance || 0);
    const typeVal = type || 'Less';
    const papadLessVal = parseFloat(papad_less || papadLess || 0);
    const pymtLessVal = parseFloat(payment_less || paymentLess || 0);
    const remarksVal = remarks || '';

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

// DELETE papad return record
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
