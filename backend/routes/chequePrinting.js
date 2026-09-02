const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET all cheque printing records
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM cheque_printing ORDER BY id DESC
    `);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching cheque printing records:', error);
    res.status(500).json({ message: 'Error fetching records', error: error.message });
  }
});

// GET by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM cheque_printing WHERE id = ?', [req.params.id]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching cheque printing record:', error);
    res.status(500).json({ message: 'Error fetching record', error: error.message });
  }
});

// POST save cheque printing record
router.post('/', async (req, res) => {
  try {
    const {
      bank_name, bankName,
      ac_name, acName,
      chq_date, chqDate,
      chq_amount, chqAmount,
      ac_payee, acPayee,
      auth_sign, authSign,
      no_of_copies, noOfCopies,
      ac_no, acNo
    } = req.body;

    const bank = bank_name || bankName || '';
    const name = ac_name || acName || '';
    const date = chq_date || chqDate || new Date().toISOString().split('T')[0];
    const amount = parseFloat(chq_amount || chqAmount || 0);
    const payee = ac_payee || acPayee || 'Yes';
    const sign = auth_sign || authSign || 'Yes';
    const copies = parseInt(no_of_copies || noOfCopies || 1) || 1;
    const acNum = ac_no || acNo || '';

    const result = await db.run(`
      INSERT INTO cheque_printing (
        bank_name, ac_name, chq_date, chq_amount, ac_payee, auth_sign, no_of_copies, ac_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [bank, name, date, amount, payee, sign, copies, acNum]);

    res.status(201).json({
      success: true,
      message: 'Cheque record saved successfully!',
      id: result.lastID
    });
  } catch (error) {
    console.error('Error saving cheque printing:', error);
    res.status(500).json({ success: false, message: 'Error saving cheque record', error: error.message });
  }
});

// DELETE cheque printing record
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM cheque_printing WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Error deleting cheque record:', error);
    res.status(500).json({ success: false, message: 'Error deleting record', error: error.message });
  }
});

module.exports = router;
