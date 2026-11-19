const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { createAdvanceLedgerEntries, deleteLedgerEntries } = require('../utils/ledgerHelper');

const getCompanyId = (req) => req.companyId || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : 1);

// GET next S.No for advances
router.get('/next-sno', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const maxSNo = await db.forCompany(activeCompanyId).query('SELECT MAX(CAST(s_no AS INTEGER)) as max_s_no, MAX(id) as max_id, COUNT(*) as total_count FROM advances');
    const maxVal = Math.max(
      parseInt(maxSNo.rows[0]?.max_s_no) || 0,
      parseInt(maxSNo.rows[0]?.max_id) || 0,
      parseInt(maxSNo.rows[0]?.total_count) || 0
    );
    const next_s_no = maxVal + 1;
    res.json({ success: true, next_s_no: String(next_s_no), next_sno: next_s_no, s_no: next_s_no, data: { s_no: next_s_no } });
  } catch (error) {
    console.error('Error fetching next S.No for advance:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch next S.No' });
  }
});

// GET all advances
router.get('/', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const result = await db.forCompany(activeCompanyId).query(`
      SELECT a.*, COALESCE(pcm.name, a.papad_company) AS papad_company_name 
      FROM advances a 
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(a.papad_company AS TEXT) OR pcm.name = a.papad_company)
      ORDER BY a.id DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching advances:', error);
    res.status(500).json({ message: 'Error fetching advances', error: error.message });
  }
});

// GET single advance by ID
router.get('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const result = await db.forCompany(activeCompanyId).query(`
      SELECT a.*, COALESCE(pcm.name, a.papad_company) AS papad_company_name 
      FROM advances a 
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(a.papad_company AS TEXT) OR pcm.name = a.papad_company)
      WHERE CAST(a.id AS TEXT) = ?
    `, [String(req.params.id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Advance not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching advance:', error);
    res.status(500).json({ message: 'Error fetching advance', error: error.message });
  }
});

// POST create new advance
router.post('/', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    let { s_no, date, papad_company, amount, dr_cr, pay_mode, remarks } = req.body;

    if (!date || !papad_company || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: 'Required fields: date, papad_company, positive amount' });
    }

    const txResult = await db.forCompany(activeCompanyId).withTransaction(async () => {
      const maxSNo = await db.query('SELECT MAX(CAST(s_no AS INTEGER)) as max_s_no FROM advances', [], activeCompanyId);
      const nextSno = String((parseInt(maxSNo.rows[0]?.max_s_no, 10) || 0) + 1);

      const result = await db.run(
        'INSERT INTO advances (s_no, date, papad_company, amount, dr_cr, pay_mode, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nextSno, date, papad_company, amount, dr_cr || 'Dr', pay_mode || '', remarks || ''],
        activeCompanyId
      );

      const advanceId = result.lastID || result.lastInsertRowid;

      const vRes = await createAdvanceLedgerEntries({
        papadCompany: papad_company,
        date,
        sNo: nextSno,
        advanceId,
        amount,
        drCr: dr_cr || 'Dr',
        payMode: pay_mode || 'Cash',
        remarks: remarks || '',
        companyId: activeCompanyId
      });

      return { advanceId, voucherNo: vRes?.voucherNo || null };
    });

    try {
      const { triggerTransactionNotification } = require('../utils/transactionNotifier');
      const refNo = txResult.voucherNo || `ADV-${txResult.advanceId}`;
      await triggerTransactionNotification({
        eventType: 'VOUCHER_CREATED',
        moduleName: 'ADVANCE',
        referenceNo: refNo,
        referenceId: txResult.advanceId,
        companyId: activeCompanyId,
        title: `💳 ADVANCE ENTRY – ${refNo}`,
        message: `Company: ${papad_company} | Amount: ₹${amount} (${dr_cr || 'Dr'}) | Mode: ${pay_mode || 'Cash'}`,
        severity: 'INFO',
        details: {
          reference_no: refNo,
          action_label: `Advance (${dr_cr || 'Dr'})`,
          party_name: papad_company,
          payment_mode: pay_mode || 'Cash',
          amount: parseFloat(amount) || 0,
          remarks: remarks || '-',
          created_by: req.user?.username || 'Accounts Operator',
          date
        }
      });
    } catch (notifErr) {
      console.warn('Notification warning (Advance):', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Advance created successfully',
      id: txResult.advanceId,
      voucher_no: txResult.voucherNo
    });
  } catch (error) {
    console.error('Error creating advance:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ message: 'Advance with this S.No already exists' });
    } else {
      res.status(error.statusCode || 500).json({ message: 'Error creating advance', error: error.message });
    }
  }
});

// PUT update advance
router.put('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const { s_no, date, papad_company, amount, dr_cr, pay_mode, remarks } = req.body;
    const advanceId = req.params.id;

    if (!date || !papad_company || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: 'Required fields: date, papad_company, positive amount' });
    }

    const vRes = await db.forCompany(activeCompanyId).withTransaction(async () => {
      const existing = await db.query('SELECT id, s_no FROM advances WHERE id = ?', [advanceId], activeCompanyId);
      if (!existing.rows || existing.rows.length === 0) {
        const err = new Error('Advance not found');
        err.statusCode = 404;
        throw err;
      }
      const effectiveSno = s_no || existing.rows[0].s_no;

      await db.run(
        'UPDATE advances SET s_no = ?, date = ?, papad_company = ?, amount = ?, dr_cr = ?, pay_mode = ?, remarks = ? WHERE id = ?',
        [effectiveSno, date, papad_company, amount, dr_cr || 'Dr', pay_mode || '', remarks || '', advanceId],
        activeCompanyId
      );

      return createAdvanceLedgerEntries({
        papadCompany: papad_company,
        date,
        sNo: effectiveSno,
        advanceId,
        amount,
        drCr: dr_cr || 'Dr',
        payMode: pay_mode || 'Cash',
        remarks: remarks || '',
        companyId: activeCompanyId
      });
    });

    try {
      const { triggerTransactionNotification } = require('../utils/transactionNotifier');
      const refNo = vRes?.voucherNo || `ADV-${advanceId}`;
      await triggerTransactionNotification({
        eventType: 'VOUCHER_UPDATED',
        isUpdate: true,
        moduleName: 'ADVANCE',
        referenceNo: refNo,
        referenceId: advanceId,
        companyId: activeCompanyId,
        title: `✏️ ADVANCE ENTRY UPDATED – ${refNo}`,
        message: `Updated Advance | Company: ${papad_company} | Amount: ₹${amount} (${dr_cr || 'Dr'}) | Mode: ${pay_mode || 'Cash'}`,
        severity: 'INFO',
        details: {
          reference_no: refNo,
          action_label: `Advance (${dr_cr || 'Dr'})`,
          party_name: papad_company,
          payment_mode: pay_mode || 'Cash',
          amount: parseFloat(amount) || 0,
          remarks: remarks || '-',
          updated_by: req.user?.username || 'Accounts Operator',
          created_by: req.user?.username || 'Accounts Operator',
          date
        }
      });
    } catch (notifErr) {
      console.warn('Notification warning (Advance Update):', notifErr.message);
    }

    res.json({ success: true, message: 'Advance updated successfully', voucher_no: vRes?.voucherNo || null });
  } catch (error) {
    console.error('Error updating advance:', error);
    res.status(error.statusCode || 500).json({ message: 'Error updating advance', error: error.message });
  }
});

// DELETE advance
router.delete('/:id', async (req, res) => {
  try {
    const activeCompanyId = getCompanyId(req);
    const advanceId = req.params.id;

    await db.forCompany(activeCompanyId).withTransaction(async () => {
      const existing = await db.query('SELECT id FROM advances WHERE id = ?', [advanceId], activeCompanyId);
      if (!existing.rows || existing.rows.length === 0) {
        const err = new Error('Advance not found');
        err.statusCode = 404;
        throw err;
      }

      await deleteLedgerEntries(advanceId, 'advance', activeCompanyId);
      await db.run('DELETE FROM advances WHERE id = ?', [advanceId], activeCompanyId);
    });

    res.json({ success: true, message: 'Advance deleted successfully' });
  } catch (error) {
    console.error('Error deleting advance:', error);
    res.status(error.statusCode || 500).json({ message: 'Error deleting advance', error: error.message });
  }
});

module.exports = router;

