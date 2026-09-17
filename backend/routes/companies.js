const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');

// ============================================================================
// API ROUTES FOR COMPANIES (Master Database)
// ============================================================================

// Helper function to ensure default Company 1 exists
async function ensureDefaultCompanyExists() {
  try {
    const existing = await db.master.query("SELECT * FROM companies WHERE id = 1 OR code = 'COMP_BVC' OR status != 'Inactive'");
    if (existing.rows && existing.rows.length > 0) {
      return existing.rows;
    }

    console.log('🌱 [Companies] Auto-provisioning default Company 1...');
    await db.master.run(`
      INSERT INTO companies (code, name, address, gst_number, contact, email, database_name, database_schema, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `, [
      'COMP_BVC',
      'BVC Exports Pvt Ltd',
      '123 Main Industrial Area, City',
      '33AABCB1234A1Z5',
      '9876543210',
      'info@bvcexports.com',
      db.isPostgres ? 'company_1' : 'company_1.db',
      db.isPostgres ? 'company_1' : null
    ]);

    // Ensure database registry record exists
    await db.master.run(`
      INSERT OR REPLACE INTO database_registry (company_id, db_type, db_name, db_schema, status)
      VALUES (1, ?, ?, ?, 'Active')
    `, [db.isPostgres ? 'postgres' : 'sqlite', db.isPostgres ? 'company_1' : 'company_1.db', db.isPostgres ? 'company_1' : null]);

    // Ensure default admin user exists
    const adminExists = await db.master.query("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
    if (!adminExists.rows || adminExists.rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.master.run(`
        INSERT OR IGNORE INTO users (username, password_hash, role, company_id, status)
        VALUES ('admin', ?, 'Admin', 1, 'Active')
      `, [hash]);
    }

    const seeded = await db.master.query("SELECT * FROM companies WHERE status != 'Inactive' OR status IS NULL ORDER BY id ASC");
    return seeded.rows || [];
  } catch (err) {
    console.warn('⚠️ Notice during ensureDefaultCompanyExists:', err.message);
    const fallback = await db.master.query("SELECT * FROM companies ORDER BY id ASC");
    return fallback.rows || [];
  }
}

// GET all companies
router.get(['/', '/list'], async (req, res) => {
  try {
    let result = await db.master.query("SELECT * FROM companies WHERE status != 'Inactive' OR status IS NULL ORDER BY name ASC");
    let rows = result.rows || [];

    // If companies list is empty, auto-ensure Company 1
    if (rows.length === 0) {
      rows = await ensureDefaultCompanyExists();
    }

    res.json(rows);
  } catch (error) {
    console.error('Error fetching companies:', error);
    try {
      // Attempt recovery
      const recovered = await ensureDefaultCompanyExists();
      if (recovered.length > 0) {
        return res.json(recovered);
      }
    } catch (e) {}
    res.status(500).json({ message: 'Error fetching companies', error: error.message });
  }
});

// POST initialize default company (recovery route)
router.post('/init-default', async (req, res) => {
  try {
    const companies = await ensureDefaultCompanyExists();
    res.json({ success: true, message: 'Default company verified', companies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    const duplicate = await db.master.query(
      'SELECT id FROM companies WHERE LOWER(name) = LOWER(?) OR (gst_number IS NOT NULL AND gst_number = ?)',
      [trimmedName, gst_number || null]
    );
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'A company with this name or GST number already exists' });
    }
    const code = `COMP_${Date.now().toString(36).toUpperCase()}`;
    const dbName = `company_${Date.now()}`;

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
    const duplicate = error.code === '23505' || /unique constraint|duplicate key/i.test(error.message);
    res.status(duplicate ? 409 : 500).json({ success: false, message: duplicate ? 'Company name, code, or GST number already exists' : 'Error creating company', error: error.message });
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

// DELETE company
router.delete('/:id', async (req, res) => {
  try {
    const companyId = parseInt(req.params.id, 10);
    if (!companyId || isNaN(companyId)) {
      return res.status(400).json({ success: false, message: 'Invalid company ID' });
    }

    console.log(`🗑️ Deleting company ${companyId}...`);

    // 1. Delete associated users for this company
    try {
      await db.master.run('DELETE FROM users WHERE company_id = ?', [companyId]);
    } catch (e) {
      console.warn(`Notice cleaning up users for company ${companyId}:`, e.message);
    }

    // 2. Delete database registry entry
    try {
      await db.master.run('DELETE FROM database_registry WHERE company_id = ?', [companyId]);
    } catch (e) {
      console.warn(`Notice cleaning up database_registry for company ${companyId}:`, e.message);
    }

    // 3. Delete login history
    try {
      await db.master.run('DELETE FROM login_history WHERE company_id = ?', [companyId]);
    } catch (e) {
      console.warn(`Notice cleaning up login_history for company ${companyId}:`, e.message);
    }

    // 4. In PostgreSQL, drop company tenant schema
    if (db.isPostgres) {
      try {
        const poolClient = await db.master.getConnection();
        await poolClient.query(`DROP SCHEMA IF EXISTS company_${companyId} CASCADE;`);
        poolClient.release();
        console.log(`✓ PostgreSQL schema company_${companyId} dropped`);
      } catch (schemaErr) {
        console.warn(`Notice dropping PostgreSQL schema company_${companyId}:`, schemaErr.message);
      }
    }

    // 5. Delete company record from master DB
    const result = await db.master.run('DELETE FROM companies WHERE id = ?', [companyId]);

    // 6. Close and remove local sqlite connection if exists
    if (db.companyDbPool && db.companyDbPool.has(companyId)) {
      try {
        const d = db.companyDbPool.get(companyId);
        d.close();
      } catch (e) {}
      db.companyDbPool.delete(companyId);
    }

    res.json({ success: true, message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ success: false, message: 'Error deleting company', error: error.message });
  }
});

module.exports = router;
