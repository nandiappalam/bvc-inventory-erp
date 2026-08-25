const express = require('express')
const router = express.Router()
const db = require('../config/masterDatabase')
const { getCompanyDatabase, createFreshCompanyDatabase } = require('../config/companyDatabase')
const path = require('path')

// ============================================================================
// COMPANIES TABLE MANAGEMENT
// ============================================================================

// Create companies table if not exists
const createCompaniesTable = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        gst_number TEXT,
        contact TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('companies table ready')
  } catch (error) {
    console.error('Error creating companies table:', error.message)
  }
}

// Initialize companies table
createCompaniesTable()

// ============================================================================
// API ROUTES
// ============================================================================

// GET all companies
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM companies ORDER BY name ASC')
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching companies:', error)
    res.status(500).json({ message: 'Error fetching companies', error: error.message })
  }
})

// GET company by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM companies WHERE id = ?', [req.params.id])
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' })
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching company:', error)
    res.status(500).json({ message: 'Error fetching company', error: error.message })
  }
})

// POST create new company
router.post('/', async (req, res) => {
  console.log('POST /api/companies called with body:', req.body);
  try {
    const { name, address, gst_number, contact, email } = req.body

    if (!name) {
      return res.status(400).json({ message: 'Company name is required' })
    }

    console.log('Inserting company:', { name, address, gst_number, contact, email });
    
    const nextId = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM companies')
    const companyId = nextId.rows[0].id
    const databaseName = `company_${companyId}.db`
    const result = await db.run(`
      INSERT INTO companies (id, company_code, name, address, gst_number, contact, email, database_name, database_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [companyId, `BVC${String(companyId).padStart(3, '0')}`, name, address || null,
      gst_number || null, contact || null, email || null, databaseName,
      path.join(__dirname, '../../database', databaseName)])

    const company = (await db.query('SELECT * FROM companies WHERE id = ?', [companyId])).rows[0]
    await createFreshCompanyDatabase(company.database_path)
    const companyDb = await getCompanyDatabase(company)
    const runOnCompany = (sql, params) => new Promise((resolve, reject) => companyDb.run(sql, params, function (err) { err ? reject(err) : resolve(this) }))

    console.log('Insert result:', result);

    // Seed default ledgers when a company is created
    const defaultLedgers = [
      { name: 'Cash', under: 'Cash', type: 'Cash' },
      { name: 'Petty Cash', under: 'Cash', type: 'Cash' },
      { name: 'Indian Bank', under: 'Bank Accounts', type: 'Bank' },
      { name: 'Purchase Account', under: 'Purchase', type: 'Purchase' },
      { name: 'Sales Account', under: 'Sales', type: 'Sales' },
      { name: 'Input Tax', under: 'Duties & Taxes', type: 'Tax' },
      { name: 'Output Tax', under: 'Duties & Taxes', type: 'Tax' }
    ];

    for (const led of defaultLedgers) {
      try {
        const existing = await new Promise((resolve, reject) => companyDb.all('SELECT id FROM ledgermaster WHERE TRIM(name) = ?', [led.name.trim()], (err, rows) => err ? reject(err) : resolve({ rows })))
        if (existing.rows.length === 0) {
          await runOnCompany(
            'INSERT INTO ledgermaster (name, printname, under, ledger_type, openingbalance, status) VALUES (?, ?, ?, ?, ?, ?)',
            [led.name, led.name, led.under, led.type, 0, 'Active']
          );
          console.log(`Auto-created default ledger: ${led.name}`);
        } else {
          // Update the existing ledger type/under to match the recommendation
          await runOnCompany(
            'UPDATE ledgermaster SET ledger_type = ?, under = ? WHERE id = ?',
            [led.type, led.under, existing.rows[0].id]
          );
          console.log(`Updated existing ledger: ${led.name} to Type: ${led.type}, Under: ${led.under}`);
        }
      } catch (err) {
        console.error(`Error auto-seeding default ledger ${led.name}:`, err.message);
      }
    }

    res.status(201).json({
      message: 'Company created successfully!',
      id: result.lastInsertRowid
    })
  } catch (error) {
    console.error('Error creating company:', error)
    res.status(500).json({ message: 'Error creating company', error: error.message })
  }
})

// PUT update company
router.put('/:id', async (req, res) => {
  try {
    const { name, address, gst_number, contact, email } = req.body

    await db.run(`
      UPDATE companies 
      SET name = ?, address = ?, gst_number = ?, contact = ?, email = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, address, gst_number, contact, email, req.params.id])

    res.json({ message: 'Company updated successfully!' })
  } catch (error) {
    console.error('Error updating company:', error)
    res.status(500).json({ message: 'Error updating company', error: error.message })
  }
})

// DELETE company
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM companies WHERE id = ?', [req.params.id])
    res.json({ message: 'Company deleted successfully' })
  } catch (error) {
    console.error('Error deleting company:', error)
    res.status(500).json({ message: 'Error deleting company', error: error.message })
  }
})

module.exports = router
