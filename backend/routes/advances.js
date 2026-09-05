const express = require('express')
const router = express.Router()
const db = require('../config/database')
const { createAdvanceLedgerEntries, deleteLedgerEntries } = require('../utils/ledgerHelper')

// GET next S.No for advances
router.get('/next-sno', async (req, res) => {
  try {
    const maxSNo = await db.query('SELECT MAX(CAST(s_no AS INTEGER)) as max_s_no, MAX(id) as max_id, COUNT(*) as total_count FROM advances')
    const maxVal = Math.max(
      parseInt(maxSNo.rows[0]?.max_s_no) || 0,
      parseInt(maxSNo.rows[0]?.max_id) || 0,
      parseInt(maxSNo.rows[0]?.total_count) || 0
    );
    const next_s_no = maxVal + 1;
    res.json({ success: true, next_s_no: String(next_s_no), next_sno: next_s_no, s_no: next_s_no, data: { s_no: next_s_no } })
  } catch (error) {
    console.error('Error fetching next S.No for advance:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch next S.No' })
  }
})

// GET all advances
router.get('/', async (req, res) => {
  console.log("🔥 ADVANCE API HIT");
  try {
    const result = await db.query(`
      SELECT a.*, COALESCE(pcm.name, a.papad_company) AS papad_company_name 
      FROM advances a 
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(a.papad_company AS TEXT) OR pcm.name = a.papad_company)
      ORDER BY a.id DESC
    `)
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching advances:', error)
    res.status(500).json({ message: 'Error fetching advances', error: error.message })
  }
})

// GET single advance by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*, COALESCE(pcm.name, a.papad_company) AS papad_company_name 
      FROM advances a 
      LEFT JOIN papad_company_master pcm ON (CAST(pcm.id AS TEXT) = CAST(a.papad_company AS TEXT) OR pcm.name = a.papad_company)
      WHERE CAST(a.id AS TEXT) = ?
    `, [String(req.params.id)])

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Advance not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching advance:', error)
    res.status(500).json({ message: 'Error fetching advance', error: error.message })
  }
})

// POST create new advance
router.post('/', async (req, res) => {
  try {
    let { s_no, date, papad_company, amount, dr_cr, pay_mode, remarks } = req.body

    // Always auto-generate s_no to avoid UNIQUE constraint issues
    const maxSNo = await db.query('SELECT MAX(CAST(s_no AS INTEGER)) as max_s_no FROM advances')
    s_no = String((maxSNo.rows[0].max_s_no || 0) + 1)

    if (!date || !papad_company || !amount) {
      return res.status(400).json({ message: 'Required fields: date, papad_company, amount' })
    }

    const result = await db.run(
      'INSERT INTO advances (s_no, date, papad_company, amount, dr_cr, pay_mode, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [s_no, date, papad_company, amount, dr_cr || 'Dr', pay_mode || '', remarks || '']
    )

    const advanceId = result.lastID

    // Create advance ledger entries
    try {
      await createAdvanceLedgerEntries({
        papadCompany: papad_company,
        date: date,
        sNo: s_no,
        advanceId: advanceId,
        amount: amount
      })
      console.log('Advance ledger entries created for advance ID:', advanceId)
    } catch (ledgerError) {
      console.error('Error creating advance ledger entries:', ledgerError)
      // Continue even if ledger entries fail
    }

    res.status(201).json({
      success: true,
      message: 'Advance created successfully',
      id: advanceId
    })
  } catch (error) {
    console.error('Error creating advance:', error)
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ message: 'Advance with this S.No already exists' })
    } else {
      res.status(500).json({ message: 'Error creating advance', error: error.message })
    }
  }
})

// PUT update advance
router.put('/:id', async (req, res) => {
  try {
    const { s_no, date, papad_company, amount, dr_cr, pay_mode, remarks } = req.body
    const advanceId = req.params.id

    const result = await db.run(
      'UPDATE advances SET s_no = ?, date = ?, papad_company = ?, amount = ?, dr_cr = ?, pay_mode = ?, remarks = ? WHERE id = ?',
      [s_no, date, papad_company, amount, dr_cr || 'Dr', pay_mode || '', remarks || '', advanceId]
    )

    if (result.changes > 0) {
      // Update advance ledger entries
      try {
        await deleteLedgerEntries(advanceId)
        await createAdvanceLedgerEntries({
          papadCompany: papad_company,
          date: date,
          sNo: s_no,
          advanceId: advanceId,
          amount: amount
        })
        console.log('Advance ledger entries updated for advance ID:', advanceId)
      } catch (ledgerError) {
        console.error('Error updating advance ledger entries:', ledgerError)
      }
      res.json({ message: 'Advance updated successfully' })
    } else {
      res.status(404).json({ message: 'Advance not found' })
    }
  } catch (error) {
    console.error('Error updating advance:', error)
    res.status(500).json({ message: 'Error updating advance', error: error.message })
  }
})

// DELETE advance
router.delete('/:id', async (req, res) => {
  try {
    const advanceId = req.params.id
    
    // Delete advance ledger entries first
    try {
      await deleteLedgerEntries(advanceId)
    } catch (ledgerError) {
      console.error('Error deleting advance ledger entries:', ledgerError)
    }
    
    const result = await db.run('DELETE FROM advances WHERE id = ?', [advanceId])

    if (result.changes > 0) {
      res.json({ message: 'Advance deleted successfully' })
    } else {
      res.status(404).json({ message: 'Advance not found' })
    }
  } catch (error) {
    console.error('Error deleting advance:', error)
    res.status(500).json({ message: 'Error deleting advance', error: error.message })
  }
})

module.exports = router

