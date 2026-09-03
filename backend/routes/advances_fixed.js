const express = require('express')
const router = express.Router()
const db = require('../config/database')
const { createAdvanceLedgerEntries, deleteLedgerEntries } = require('../utils/ledgerHelper')

// GET all advances
router.get('/', async (req, res) => {
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
    let { s_no, date, papad_company, amount, pay_mode, remarks } = req.body

    // Always auto-generate s_no to avoid UNIQUE constraint issues
    const maxSNo = await db.query('SELECT MAX(CAST(s_no AS INTEGER)) as max_s_no FROM advances')
    s_no = String((maxSNo.rows[0].max_s_no || 0) + 1)

    if (!date || !papad_company || !amount) {
      return res.status(400).json({ message: 'Required fields: date, papad_company, amount' })
    }

    const result = await db.run(
      'INSERT INTO advances (s_no, date, papad_company, amount, pay_mode, remarks) VALUES (?, ?, ?, ?, ?, ?)',
      [s_no, date, papad_company, amount, pay_mode || '', remarks || '']
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
    } catch (ledgerError) {
      console.error('Error creating advance ledger entries:', ledgerError)
    }

    res.status(201).json({
      message: 'Advance created successfully',
      id: advanceId
    })
  } catch (error) {
    console.error('Error creating advance:', error)
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ message: 'Advance with this S.No already exists' })
    } else {
      res.status(500).json({ message: 'Error creating advance', error: error.message })
    }
  }
})

// PUT update advance
router.put('/:id', async (req, res) => {
  try {
    const { s_no, date, papad_company, amount, pay_mode, remarks } = req.body
    const advanceId = req.params.id

    const result = await db.run(
      'UPDATE advances SET s_no = ?, date = ?, papad_company = ?, amount = ?, pay_mode = ?, remarks = ? WHERE id = ?',
      [s_no, date, papad_company, amount, pay_mode || '', remarks || '', advanceId]
    )

    if (result.changes > 0) {
      try {
        await deleteLedgerEntries(advanceId)
        await createAdvanceLedgerEntries({
          papadCompany: papad_company,
          date: date,
          sNo: s_no,
          advanceId: advanceId,
          amount: amount
        })
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
