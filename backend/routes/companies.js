const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');

// ============================================================================
// API ROUTES FOR COMPANIES (Master Database)
// ============================================================================

// GET all companies
router.get(['/', '/list'], async (req, res) => {
  try {
    const result = await db.master.query('SELECT * FROM companies ORDER BY name ASC');
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ message: 'Error fetching companies', error: error.message });
  }
});

// GET company by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await db.master.query('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ message: 'Error fetching company', error: error.message });
  }
});

// POST create new company (creates isolated database + clean schema)
router.post('/', async (req, res) => {
  console.log('POST /api/companies called with body:', req.body);
  try {
    const { name, address, gst_number, contact, email, admin_username, admin_password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Company name is required' });
    }

    const trimmedName = name.trim();
    const code = `COMP_${Date.now().toString(36).toUpperCase()}`;
    const dbName = `company_${Date.now()}.db`;

    // 1. Insert into Master DB companies table
    const result = await db.master.run(`
      INSERT INTO companies (code, name, address, gst_number, contact, email, database_name, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
    `, [code, trimmedName, address || null, gst_number || null, contact || null, email || null, dbName]);

    const companyId = result.lastInsertRowid;
    console.log(`✅ Company record created in master DB with ID: ${companyId}`);

    // 2. Initialize isolated database with clean ERP schema (Company B gets empty tables!)
    await db.createCompanyDatabase(companyId, code);

    // 3. Create initial Company Administrator in master users table
    const adminUser = (admin_username && admin_username.trim()) ? admin_username.trim() : 'admin';
    const adminPass = (admin_password && admin_password.trim()) ? admin_password.trim() : 'admin123';
    const passwordHash = await bcrypt.hash(adminPass, 10);

    await db.master.run(`
      INSERT OR REPLACE INTO users (username, password_hash, role, company_id, status)
      VALUES (?, ?, 'Admin', ?, 'Active')
    `, [adminUser, passwordHash, companyId]);

    console.log(`✅ Created default administrator '${adminUser}' for Company ${companyId}`);

    res.status(201).json({
      message: 'Company created successfully with isolated database!',
      id: companyId,
      company_id: companyId,
      name: trimmedName,
      database: `company_${companyId}.db`
    });
  } catch (error) {
    console.error('❌ Error creating company:', error);
    res.status(500).json({ message: 'Error creating company', error: error.message });
  }
});

// PUT update company
router.put('/:id', async (req, res) => {
  try {
    const { name, address, gst_number, contact, email } = req.body;

    await db.master.run(`
      UPDATE companies 
      SET name = ?, address = ?, gst_number = ?, contact = ?, email = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, address, gst_number, contact, email, req.params.id]);

    res.json({ message: 'Company updated successfully!' });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ message: 'Error updating company', error: error.message });
  }
});

// DELETE company (soft-deactivate to prevent accidental data loss)
router.delete('/:id', async (req, res) => {
  try {
    const companyId = req.params.id;
    // Mark as inactive rather than immediately dropping data
    await db.master.run(`UPDATE companies SET status = 'Inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [companyId]);
    res.json({ message: 'Company deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating company:', error);
    res.status(500).json({ message: 'Error deactivating company', error: error.message });
  }
});

module.exports = router;
