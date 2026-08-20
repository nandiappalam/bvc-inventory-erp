const express = require('express')
const router = express.Router()
const db = require('../config/database')

// ============================================================================
// FINANCIAL YEARS TABLE MANAGEMENT
// ============================================================================

<<<<<<< HEAD
=======
// Create financial_years table if not exists
>>>>>>> origin/main
const createFinancialYearsTable = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS financial_years (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
<<<<<<< HEAD
        company_id INTEGER NOT NULL DEFAULT 1,
        financial_year TEXT NOT NULL,
        year_name TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT DEFAULT 'Active',
        is_active INTEGER DEFAULT 0,
        is_current INTEGER DEFAULT 0,
        is_locked INTEGER DEFAULT 0,
        remarks TEXT,
        created_by TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT,
        updated_at DATETIME,
        closed_by TEXT,
        closed_at DATETIME,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      )
    `)

    // Add missing columns if upgrading schema
    const columns = [
      { name: 'financial_year', type: 'TEXT' },
      { name: 'status', type: "TEXT DEFAULT 'Active'" },
      { name: 'is_current', type: 'INTEGER DEFAULT 0' },
      { name: 'remarks', type: 'TEXT' },
      { name: 'created_by', type: "TEXT DEFAULT 'admin'" },
      { name: 'updated_by', type: 'TEXT' },
      { name: 'updated_at', type: 'DATETIME' },
      { name: 'closed_by', type: 'TEXT' },
      { name: 'closed_at', type: 'DATETIME' }
    ]

    for (const col of columns) {
      try {
        await db.run(`ALTER TABLE financial_years ADD COLUMN ${col.name} ${col.type}`)
      } catch (e) {
        // Column already exists
      }
    }

    // Seed default financial year if empty
    const countRes = await db.query('SELECT COUNT(*) as count FROM financial_years')
    if (countRes.rows[0].count === 0) {
      await db.run(`
        INSERT INTO financial_years (company_id, financial_year, year_name, start_date, end_date, status, is_active, is_current, remarks, created_by)
        VALUES (1, '2026-2027', '2026-2027', '2026-04-01', '2027-03-31', 'Active', 1, 1, 'Initial Financial Year 2026-2027', 'admin')
      `)
      console.log('Seeded default financial year 2026-2027')
    }

=======
        company_id INTEGER NOT NULL,
        year_name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        is_locked INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        UNIQUE(company_id, year_name)
      )
    `)
>>>>>>> origin/main
    console.log('financial_years table ready')
  } catch (error) {
    console.error('Error creating financial_years table:', error.message)
  }
}

<<<<<<< HEAD
let tablePromise = null
const ensureFinancialYearsTable = async () => {
  if (!tablePromise) {
    tablePromise = createFinancialYearsTable()
  }
  return tablePromise
}

router.use(async (req, res, next) => {
  try {
    await ensureFinancialYearsTable()
  } catch (err) {
    console.error('Middleware ensureFinancialYearsTable error:', err.message)
  }
  next()
})

function mapFyRow(row) {
  if (!row) return null
  const fyStr = row.financial_year || row.year_name || '2026-2027'
  const isCurrentBool = row.is_current === 1 || row.is_active === 1
  return {
    ...row,
    financial_year: fyStr,
    year_name: fyStr,
    status: row.status || (isCurrentBool ? 'Active' : 'Closed'),
    is_current: isCurrentBool ? 1 : 0,
    is_active: isCurrentBool ? 1 : 0
  }
}
=======
createFinancialYearsTable()
>>>>>>> origin/main

// ============================================================================
// API ROUTES
// ============================================================================

<<<<<<< HEAD
// GET current active financial year
router.get('/current', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.query.companyId || 1
    let result
    try {
      result = await db.query(
        'SELECT * FROM financial_years WHERE company_id = ? AND (is_current = 1 OR is_active = 1) ORDER BY id DESC LIMIT 1',
        [companyId]
      )
    } catch (dbErr) {
      if (dbErr.message && dbErr.message.includes('no such table')) {
        await createFinancialYearsTable()
        result = await db.query(
          'SELECT * FROM financial_years WHERE company_id = ? AND (is_current = 1 OR is_active = 1) ORDER BY id DESC LIMIT 1',
          [companyId]
        )
      } else {
        throw dbErr
      }
    }

    if (result && result.rows && result.rows.length > 0) {
      res.json(mapFyRow(result.rows[0]))
    } else {
      // Return default
      const latest = await db.query('SELECT * FROM financial_years WHERE company_id = ? ORDER BY id DESC LIMIT 1', [companyId])
      if (latest && latest.rows && latest.rows.length > 0) {
        res.json(mapFyRow(latest.rows[0]))
      } else {
        res.json({
          id: 1,
          company_id: 1,
          financial_year: '2026-2027',
          year_name: '2026-2027',
          start_date: '2026-04-01',
          end_date: '2027-03-31',
          status: 'Active',
          is_current: 1,
          is_active: 1
        })
      }
    }
  } catch (error) {
    console.error('Error fetching current financial year:', error)
    res.json({
      id: 1,
      company_id: 1,
      financial_year: '2026-2027',
      year_name: '2026-2027',
      start_date: '2026-04-01',
      end_date: '2027-03-31',
      status: 'Active',
      is_current: 1,
      is_active: 1
    })
  }
})

// GET financial year by ID (single / detail)
router.get('/detail/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM financial_years WHERE id = ?', [req.params.id])
    if (result.rows.length > 0) {
      res.json(mapFyRow(result.rows[0]))
    } else {
      res.status(404).json({ message: 'Financial year not found' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching financial year', error: error.message })
  }
})

// GET active financial year for company by companyId parameter
router.get('/:companyId/active', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM financial_years WHERE company_id = ? AND (is_current = 1 OR is_active = 1) LIMIT 1',
      [req.params.companyId]
    )
    if (result.rows.length > 0) {
      res.json(mapFyRow(result.rows[0]))
    } else {
      res.json(null)
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching active financial year', error: error.message })
  }
})

// GET all financial years (optional query param company_id or path param)
router.get('/', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.query.companyId
    let sql = 'SELECT * FROM financial_years'
    let params = []
    if (companyId) {
      sql += ' WHERE company_id = ?'
      params.push(companyId)
    }
    sql += ' ORDER BY start_date DESC, id DESC'
    const result = await db.query(sql, params)
    res.json(result.rows.map(mapFyRow))
=======
// GET all financial years by company
router.get('/:companyId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM financial_years WHERE company_id = ? ORDER BY year_name DESC',
      [req.params.companyId]
    )
    res.json(result.rows)
>>>>>>> origin/main
  } catch (error) {
    console.error('Error fetching financial years:', error)
    res.status(500).json({ message: 'Error fetching financial years', error: error.message })
  }
})

<<<<<<< HEAD
// GET all financial years by company ID
router.get('/:companyId', async (req, res) => {
  try {
    // Check if parameter is 'current'
    if (req.params.companyId === 'current') {
      const result = await db.query(
        'SELECT * FROM financial_years WHERE is_current = 1 OR is_active = 1 ORDER BY id DESC LIMIT 1'
      )
      return res.json(result.rows.length > 0 ? mapFyRow(result.rows[0]) : null)
    }

    const companyId = parseInt(req.params.companyId, 10)
    if (isNaN(companyId)) {
      return res.status(400).json({ message: 'Invalid company ID' })
    }

    const result = await db.query(
      'SELECT * FROM financial_years WHERE company_id = ? ORDER BY start_date DESC, id DESC',
      [companyId]
    )
    res.json(result.rows.map(mapFyRow))
  } catch (error) {
    console.error('Error fetching financial years by company:', error)
    res.status(500).json({ message: 'Error fetching financial years', error: error.message })
=======
// GET active financial year for company
router.get('/:companyId/active', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM financial_years WHERE company_id = ? AND is_active = 1 LIMIT 1',
      [req.params.companyId]
    )
    if (result.rows.length > 0) {
      res.json(result.rows[0])
    } else {
      res.json(null)
    }
  } catch (error) {
    console.error('Error fetching active financial year:', error)
    res.status(500).json({ message: 'Error fetching active financial year', error: error.message })
>>>>>>> origin/main
  }
})

// POST create financial year
router.post('/', async (req, res) => {
  try {
<<<<<<< HEAD
    const {
      company_id = 1,
      financial_year,
      year_name,
      start_date,
      end_date,
      status = 'Active',
      is_current = 0,
      is_active = 0,
      remarks = '',
      created_by = 'admin'
    } = req.body

    const fyStr = (financial_year || year_name || '').trim()

    if (!fyStr || !start_date || !end_date) {
      return res.status(400).json({ message: 'Financial year, start date, and end date are required' })
    }

    const setAsCurrent = (is_current == 1 || is_current === true || is_active == 1 || is_active === true) ? 1 : 0
    const finalStatus = status || (setAsCurrent ? 'Active' : 'Closed')

    // Check if year already exists for company
    const existing = await db.query(
      'SELECT id FROM financial_years WHERE company_id = ? AND (financial_year = ? OR year_name = ?)',
      [company_id, fyStr, fyStr]
    )

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: `Financial year ${fyStr} already exists for this company` })
    }

    // If set as current, deactivate other years for this company
    if (setAsCurrent) {
      await db.run(
        'UPDATE financial_years SET is_current = 0, is_active = 0 WHERE company_id = ?',
        [company_id]
      )
    }

    const result = await db.run(
      `INSERT INTO financial_years 
      (company_id, financial_year, year_name, start_date, end_date, status, is_current, is_active, remarks, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [company_id, fyStr, fyStr, start_date, end_date, finalStatus, setAsCurrent, setAsCurrent, remarks, created_by]
    )

    const newId = result.lastInsertRowid

    res.status(201).json({
      message: 'Financial year created successfully!',
      id: newId,
      financial_year: fyStr
=======
    const { company_id, year_name, start_date, end_date } = req.body

    if (!company_id || !year_name || !start_date || !end_date) {
      return res.status(400).json({ message: 'Company, year name, start date and end date are required' })
    }

    // Check if year already exists
    const existing = await db.query(
      'SELECT id FROM financial_years WHERE company_id = ? AND year_name = ?',
      [company_id, year_name]
    )

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Financial year already exists for this company' })
    }

    const result = await db.run(
      'INSERT INTO financial_years (company_id, year_name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, 0)',
      [company_id, year_name, start_date, end_date]
    )

    res.status(201).json({
      message: 'Financial year created successfully!',
      id: result.lastInsertRowid
>>>>>>> origin/main
    })
  } catch (error) {
    console.error('Error creating financial year:', error)
    res.status(500).json({ message: 'Error creating financial year', error: error.message })
  }
})

<<<<<<< HEAD
// POST set current financial year
const setCurrentHandler = async (req, res) => {
  try {
    const { id } = req.params
    const fyQuery = await db.query('SELECT * FROM financial_years WHERE id = ?', [id])
    
    if (fyQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Financial year not found' })
    }

    const targetFy = fyQuery.rows[0]
    const companyId = req.body.company_id || targetFy.company_id || 1

    // Deactivate all years for this company
    await db.run(
      'UPDATE financial_years SET is_current = 0, is_active = 0 WHERE company_id = ?',
      [companyId]
    )

    // Activate selected year
    await db.run(
      "UPDATE financial_years SET is_current = 1, is_active = 1, status = 'Active' WHERE id = ?",
      [id]
    )

    const updated = await db.query('SELECT * FROM financial_years WHERE id = ?', [id])

    res.json({
      message: 'Financial year set as current active year successfully!',
      financial_year: mapFyRow(updated.rows[0])
    })
  } catch (error) {
    console.error('Error setting current financial year:', error)
    res.status(500).json({ message: 'Error setting current financial year', error: error.message })
  }
}

router.post('/:id/set-current', setCurrentHandler)
router.put('/:id/activate', setCurrentHandler)

// POST close financial year
router.post('/:id/close', async (req, res) => {
  try {
    const { id } = req.params
    const closed_by = req.body.closed_by || 'admin'

    await db.run(
      "UPDATE financial_years SET status = 'Closed', is_current = 0, is_active = 0, closed_by = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [closed_by, id]
    )

    res.json({ message: 'Financial year closed successfully!' })
  } catch (error) {
    console.error('Error closing financial year:', error)
    res.status(500).json({ message: 'Error closing financial year', error: error.message })
=======
// PUT set active financial year
router.put('/:id/activate', async (req, res) => {
  try {
    const { company_id } = req.body

    // Deactivate all years for this company
    await db.run(
      'UPDATE financial_years SET is_active = 0 WHERE company_id = ?',
      [company_id]
    )

    // Activate the selected year
    await db.run(
      'UPDATE financial_years SET is_active = 1 WHERE id = ?',
      [req.params.id]
    )

    res.json({ message: 'Financial year activated successfully!' })
  } catch (error) {
    console.error('Error activating financial year:', error)
    res.status(500).json({ message: 'Error activating financial year', error: error.message })
  }
})

// PUT lock financial year
router.put('/:id/lock', async (req, res) => {
  try {
    await db.run(
      'UPDATE financial_years SET is_locked = 1 WHERE id = ?',
      [req.params.id]
    )

    res.json({ message: 'Financial year locked successfully!' })
  } catch (error) {
    console.error('Error locking financial year:', error)
    res.status(500).json({ message: 'Error locking financial year', error: error.message })
  }
})

// PUT unlock financial year
router.put('/:id/unlock', async (req, res) => {
  try {
    await db.run(
      'UPDATE financial_years SET is_locked = 0 WHERE id = ?',
      [req.params.id]
    )

    res.json({ message: 'Financial year unlocked successfully!' })
  } catch (error) {
    console.error('Error unlocking financial year:', error)
    res.status(500).json({ message: 'Error unlocking financial year', error: error.message })
>>>>>>> origin/main
  }
})

// PUT update financial year
router.put('/:id', async (req, res) => {
  try {
<<<<<<< HEAD
    const { id } = req.params
    const {
      company_id = 1,
      financial_year,
      year_name,
      start_date,
      end_date,
      status,
      is_current,
      is_active,
      remarks,
      updated_by = 'admin'
    } = req.body

    const fyStr = (financial_year || year_name || '').trim()
    const setAsCurrent = (is_current == 1 || is_current === true || is_active == 1 || is_active === true) ? 1 : 0

    if (setAsCurrent) {
      await db.run(
        'UPDATE financial_years SET is_current = 0, is_active = 0 WHERE company_id = ?',
        [company_id]
      )
    }

    await db.run(
      `UPDATE financial_years SET 
        financial_year = COALESCE(?, financial_year),
        year_name = COALESCE(?, year_name),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        status = COALESCE(?, status),
        is_current = ?,
        is_active = ?,
        remarks = COALESCE(?, remarks),
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [fyStr || null, fyStr || null, start_date || null, end_date || null, status || null, setAsCurrent, setAsCurrent, remarks || null, updated_by, id]
=======
    const { year_name, start_date, end_date } = req.body

    await db.run(
      'UPDATE financial_years SET year_name = ?, start_date = ?, end_date = ? WHERE id = ?',
      [year_name, start_date, end_date, req.params.id]
>>>>>>> origin/main
    )

    res.json({ message: 'Financial year updated successfully!' })
  } catch (error) {
    console.error('Error updating financial year:', error)
    res.status(500).json({ message: 'Error updating financial year', error: error.message })
  }
})

// DELETE financial year
router.delete('/:id', async (req, res) => {
  try {
<<<<<<< HEAD
    const { id } = req.params
    const yearQuery = await db.query(
      'SELECT * FROM financial_years WHERE id = ?',
      [id]
    )

    if (yearQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Financial year not found' })
    }

    const fy = yearQuery.rows[0]

    if (fy.is_current || fy.is_active) {
      return res.status(400).json({ message: 'Cannot delete current active financial year' })
    }

    if (fy.is_locked) {
      return res.status(400).json({ message: 'Cannot delete locked financial year' })
    }

    // Check if transactions exist in purchases or sales
    let hasTx = false
    try {
      const p = await db.query(
        'SELECT COUNT(*) as cnt FROM purchases WHERE (date >= ? AND date <= ?) OR financial_year = ?',
        [fy.start_date, fy.end_date, fy.financial_year || fy.year_name]
      )
      if (p.rows[0] && p.rows[0].cnt > 0) hasTx = true
    } catch (e) {}

    if (!hasTx) {
      try {
        const s = await db.query(
          'SELECT COUNT(*) as cnt FROM sales WHERE (date >= ? AND date <= ?) OR financial_year = ?',
          [fy.start_date, fy.end_date, fy.financial_year || fy.year_name]
        )
        if (s.rows[0] && s.rows[0].cnt > 0) hasTx = true
      } catch (e) {}
    }

    if (hasTx) {
      return res.status(400).json({ message: 'Cannot delete Financial Year as transactions are associated with this period.' })
    }

    await db.run('DELETE FROM financial_years WHERE id = ?', [id])
=======
    // Check if year is active
    const year = await db.query(
      'SELECT is_active, is_locked FROM financial_years WHERE id = ?',
      [req.params.id]
    )

    if (year.rows.length === 0) {
      return res.status(404).json({ message: 'Financial year not found' })
    }

    if (year.rows[0].is_active) {
      return res.status(400).json({ message: 'Cannot delete active financial year' })
    }

    if (year.rows[0].is_locked) {
      return res.status(400).json({ message: 'Cannot delete locked financial year' })
    }

    await db.run('DELETE FROM financial_years WHERE id = ?', [req.params.id])
>>>>>>> origin/main

    res.json({ message: 'Financial year deleted successfully!' })
  } catch (error) {
    console.error('Error deleting financial year:', error)
    res.status(500).json({ message: 'Error deleting financial year', error: error.message })
  }
})

module.exports = router
