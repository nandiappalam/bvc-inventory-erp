const express = require('express')
const router = express.Router()
const db = require('../config/database')

// Helper: wrap async errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// ============================================================================
// GET ALL papad companies with their entries
// ============================================================================
router.get('/', asyncHandler(async (req, res) => {
  const companies = await db.query(
    `SELECT * FROM papad_company_master ORDER BY name ASC`
  )

  // Fetch entries for each company
  const result = await Promise.all(
    companies.rows.map(async (company) => {
      const entries = await db.query(
        `SELECT * FROM papad_company_entry WHERE company_id = ? ORDER BY from_date DESC`,
        [company.id]
      )
      return { ...company, entries: entries.rows }
    })
  )

  res.json({ success: true, data: result })
}))

// ============================================================================
// GET SINGLE papad company with entries
// ============================================================================
router.get('/:id', asyncHandler(async (req, res) => {
  const companyResult = await db.query(
    `SELECT * FROM papad_company_master WHERE id = ?`,
    [req.params.id]
  )

  if (companyResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Company not found' })
  }

  const company = companyResult.rows[0]
  const entriesResult = await db.query(
    `SELECT * FROM papad_company_entry WHERE company_id = ? ORDER BY from_date DESC`,
    [company.id]
  )

  res.json({ success: true, data: { ...company, entries: entriesResult.rows } })
}))

// ============================================================================
// CREATE papad company with entries
// ============================================================================
router.post('/', asyncHandler(async (req, res) => {
  const {
    name, print_name, contact_person, address, area,
    phone_res, phone_off, mobile, email,
    opening_advance, opening_balance, status,
    entries = []
  } = req.body

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Company Name is required' })
  }

  // Insert company
  const companyResult = await db.run(
    `INSERT INTO papad_company_master
<<<<<<< HEAD
     (name, print_name, contact_person, address, address1, area, phone_res, phone_off, mobile, mobile1, email, opening_advance, opening_balance, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name, print_name || null, contact_person || null, address || null, address || null, area || null,
      phone_res || null, phone_off || null, mobile || null, mobile || null, email || null,
=======
     (name, print_name, contact_person, address, area, phone_res, phone_off, mobile, email, opening_advance, opening_balance, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name, print_name || null, contact_person || null, address || null, area || null,
      phone_res || null, phone_off || null, mobile || null, email || null,
>>>>>>> origin/main
      opening_advance || 0, opening_balance || 0, status || 'Active'
    ]
  )

  const companyId = companyResult.lastID

  // Insert entries
  for (const entry of entries) {
    await db.run(
      `INSERT INTO papad_company_entry
       (company_id, from_date, to_date, papad_per_bag, wages_per_bag, advance_deduction_per_bag)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        entry.from_date || null,
        entry.to_date || null,
        entry.papad_per_bag || 0,
        entry.wages_per_bag || 0,
        entry.advance_deduction_per_bag || 0
      ]
    )
  }

  res.status(201).json({
    success: true,
    message: 'Papad Company created successfully',
    id: companyId
  })
}))

// ============================================================================
// UPDATE papad company with entries
// ============================================================================
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    name, print_name, contact_person, address, area,
    phone_res, phone_off, mobile, email,
    opening_advance, opening_balance, status,
    entries = []
  } = req.body

  // Update company
  await db.run(
    `UPDATE papad_company_master SET
<<<<<<< HEAD
     name = ?, print_name = ?, contact_person = ?, address = ?, address1 = ?, area = ?,
     phone_res = ?, phone_off = ?, mobile = ?, mobile1 = ?, email = ?,
     opening_advance = ?, opening_balance = ?, status = ?
     WHERE id = ?`,
    [
      name, print_name || null, contact_person || null, address || null, address || null, area || null,
      phone_res || null, phone_off || null, mobile || null, mobile || null, email || null,
=======
     name = ?, print_name = ?, contact_person = ?, address = ?, area = ?,
     phone_res = ?, phone_off = ?, mobile = ?, email = ?,
     opening_advance = ?, opening_balance = ?, status = ?
     WHERE id = ?`,
    [
      name, print_name || null, contact_person || null, address || null, area || null,
      phone_res || null, phone_off || null, mobile || null, email || null,
>>>>>>> origin/main
      opening_advance || 0, opening_balance || 0, status || 'Active', id
    ]
  )

  // Delete old entries and re-insert
  await db.run(`DELETE FROM papad_company_entry WHERE company_id = ?`, [id])

  for (const entry of entries) {
    await db.run(
      `INSERT INTO papad_company_entry
       (company_id, from_date, to_date, papad_per_bag, wages_per_bag, advance_deduction_per_bag)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.from_date || null,
        entry.to_date || null,
        entry.papad_per_bag || 0,
        entry.wages_per_bag || 0,
        entry.advance_deduction_per_bag || 0
      ]
    )
  }

  res.json({ success: true, message: 'Papad Company updated successfully' })
}))

// ============================================================================
// DELETE papad company (entries cascade via FK)
// ============================================================================
router.delete('/:id', asyncHandler(async (req, res) => {
  await db.run(`DELETE FROM papad_company_master WHERE id = ?`, [req.params.id])
  res.json({ success: true, message: 'Papad Company deleted successfully' })
}))

module.exports = router

