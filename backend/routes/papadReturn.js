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
        pr.date,
        COALESCE(pcm.name, pr.papad_company) as papad_company,
        COALESCE(pcm.name, pr.papad_company) as papad_company_name,
        pr.papad_company as papad_company_id,
        pr.papad_balance,
        pr.payment_balance,
        pr.type,
        pr.papad_less,
        pr.payment_less,
        pr.remarks,
        pr.created_at
      FROM papad_return pr
      LEFT JOIN papad_company_master pcm ON (pcm.id = CAST(pr.papad_company AS INTEGER) OR pcm.name = pr.papad_company)
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
    const result = await db.query('SELECT MAX(CAST(s_no AS INTEGER)) as max_sno FROM papad_return');
    const maxVal = (result.rows && result.rows[0] && result.rows[0].max_sno) ? parseInt(result.rows[0].max_sno) : 0;
    res.json({ next_s_no: String(maxVal + 1) });
  } catch (error) {
    console.error('Error getting next S.No for papad return:', error);
    res.json({ next_s_no: '1' });
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

    const sNoVal = s_no || sNo || '1';
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
