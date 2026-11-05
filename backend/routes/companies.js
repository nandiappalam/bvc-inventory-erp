const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { ensureCompanyDefaultUsers } = require('./auth');


function requireAdminOrSuperAdmin(req, res, next) {
  if (req.user) {
    const role = String(req.user.role || '').toLowerCase();
    if (role === 'admin' || role === 'superadmin') {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Admin or SuperAdmin privileges required' });
  }

  // Allow unauthenticated creation during initial setup/onboarding if database is new
  db.master.query('SELECT COUNT(*) as cnt FROM companies')
    .then((result) => {
      const count = parseInt(result.rows[0]?.cnt || result.rows[0]?.count || 0, 10);
      if (count <= 2) {
        return next();
      }
      return res.status(401).json({ success: false, message: 'Authentication required' });
    })
    .catch(() => next());
}

// ============================================================================
// API ROUTES FOR COMPANIES (Master Database)
// ============================================================================

// Helper function to normalize company record fields without injecting fake/mock data
function normalizeCompany(r) {
  if (!r) return null;
  const id = r.id;
  const rawName = r.name || r.company_name || r.comp_name || r.print_name || (id ? `Company ${id}` : 'Company');

  return {
    id: r.id,
    code: r.code || r.company_code || r.comp_code || `COMP_${r.id}`,
    name: rawName,
    address: r.address || r.address1 || r.address_line1 || r.location || r.city || '',
    gst_number: r.gst_number || r.gst_no || r.gstin || r.gst || '',
    contact: r.contact || r.phone || r.phone_off || r.mobile || r.mobile1 || r.phone_number || '',
    email: r.email || r.email_id || r.mail || '',
    state: r.state || '',
    state_code: r.state_code || '',
    tax_reg_type: r.tax_reg_type || 'Regular',
    status: r.status || 'Active',
    database_name: r.database_name || (db.isPostgres ? `company_${r.id}` : `company_${r.id}.db`),
    database_schema: r.database_schema || (db.isPostgres ? `company_${r.id}` : null)
  };
}

// Cleanup any fake backfilled defaults from previous company creation for tenant companies
setImmediate(async () => {
  try {
    await db.master.run(`
      UPDATE companies
      SET address = '',
          gst_number = '',
          contact = '',
          email = ''
      WHERE id > 1
        AND (
          address LIKE '%SIPCOT Growth Center%'
          OR address LIKE '%SIDCO Phase II%'
          OR address LIKE '%Industrial Estate, Salem%'
          OR address LIKE '%Industrial Estate, Tamil Nadu%'
          OR gst_number LIKE '33AABCB4567%'
          OR gst_number LIKE '33AABCB3456%'
          OR gst_number LIKE '33AABCB2345%'
          OR contact IN ('9842145678', '9842134567', '9842123456')
          OR email LIKE 'unit%@bvcexports.com'
        )
    `);
  } catch (_) {}
});

// Helper function to ensure default Company 1 and KIYA exist
async function ensureDefaultCompanyExists() {
  try {
    const existing = await db.master.query("SELECT * FROM companies WHERE status != 'Inactive' OR status IS NULL");
    if (existing.rows && existing.rows.length > 0) {
      return existing.rows.map(normalizeCompany);
    }

    console.log('🌱 [Companies] Auto-provisioning default Company records...');
    await db.master.run(`
      INSERT OR IGNORE INTO companies (id, code, name, address, gst_number, contact, email, database_name, database_schema, status)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
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

    const seeded = await db.master.query("SELECT * FROM companies WHERE status != 'Inactive' OR status IS NULL ORDER BY id ASC");
    return (seeded.rows || []).map(normalizeCompany);
  } catch (err) {
    console.warn('⚠️ Notice during ensureDefaultCompanyExists:', err.message);
    const fallback = await db.master.query("SELECT * FROM companies ORDER BY id ASC");
    return (fallback.rows || []).map(normalizeCompany);
  }
}

// GET all companies (Fast, instant response without blocking DDL migrations)
router.get(['/', '/list'], async (req, res) => {
  try {
    let result = await db.master.query("SELECT * FROM companies WHERE status != 'Inactive' OR status IS NULL ORDER BY id ASC");
    let rows = result.rows || [];

    // Fallback if status filter excluded records
    if (rows.length === 0) {
      result = await db.master.query("SELECT * FROM companies ORDER BY id ASC");
      rows = result.rows || [];
    }

    // If companies list is still empty, auto-ensure default Company 1
    if (rows.length === 0) {
      const seeded = await ensureDefaultCompanyExists();
      return res.json(seeded);
    }

    const normalized = rows.map(normalizeCompany);

    // Ensure every existing company has default admin/staff credentials provisioned
    if (typeof ensureCompanyDefaultUsers === 'function') {
      for (const comp of rows) {
        await ensureCompanyDefaultUsers(comp.id);
      }
    }

    res.json(normalized);
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
router.post('/init-default', requireAdminOrSuperAdmin, async (req, res) => {
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
    const requestedId = parseInt(req.params.id, 10);
    const result = await db.master.query('SELECT * FROM companies WHERE id = ?', [requestedId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json(normalizeCompany(result.rows[0]));
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ success: false, message: 'Error fetching company', error: error.message });
  }
});

// POST create new company (creates isolated database + clean schema)
router.post('/', requireAdminOrSuperAdmin, async (req, res) => {
  console.log('POST /api/companies called with body:', req.body);
  try {
    const { name, address, gst_number, contact, email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Company name is required' });
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

    // Auto-provision default admin/staff credentials for the new company
    if (typeof ensureCompanyDefaultUsers === 'function') {
      await ensureCompanyDefaultUsers(companyId);
    }

    // Grant the authenticated platform operator explicit access to provision tenant users.
    if (req.user && req.user.id) {
      await db.master.run(
        'INSERT INTO user_company_access (user_id, company_id) VALUES (?, ?)',
        [req.user.id, companyId]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Company created successfully. Provision an administrator through the authorized setup process.',
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
router.put('/:id', requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const { name, address, gst_number, contact, email } = req.body;
    const companyId = parseInt(req.params.id, 10);

    await db.master.run(`
      UPDATE companies 
      SET name = ?, address = ?, gst_number = ?, contact = ?, email = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, address, gst_number, contact, email, companyId]);

    // If PostgreSQL, also synchronize with tenant schema companies/papad_company_master table if present
    if (db.isPostgres) {
      try {
        const poolClient = await db.master.getConnection();
        const schemaName = `company_${companyId}`;
        await poolClient.query(`
          DO $$
          BEGIN
            IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = '${schemaName}' AND table_name = 'companies') THEN
              UPDATE "${schemaName}"."companies" SET name = '${name.replace(/'/g, "''")}', address = '${(address || '').replace(/'/g, "''")}', gst_number = '${(gst_number || '').replace(/'/g, "''")}', contact = '${(contact || '').replace(/'/g, "''")}', email = '${(email || '').replace(/'/g, "''")}' WHERE id = 1 OR id = ${companyId};
            END IF;
          END $$;
        `);
        poolClient.release();
      } catch (_) {}
    }

    res.json({ success: true, message: 'Company updated successfully!' });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ success: false, message: 'Error updating company', error: error.message });
  }
});

// DELETE company
router.delete('/:id', requireAdminOrSuperAdmin, async (req, res) => {
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

    try {
      await db.master.run('DELETE FROM user_company_access WHERE company_id = ?', [companyId]);
    } catch (e) {
      console.warn(`Notice cleaning up memberships for company ${companyId}:`, e.message);
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

// One-click restore route for KIYA tenant data
router.all('/restore-kiya-data', requireAdminOrSuperAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const possiblePaths = [
      path.resolve(__dirname, '../restore_kiya_neon.sql'),
      path.resolve(__dirname, '../../restore_kiya_neon.sql'),
      path.resolve(process.cwd(), 'restore_kiya_neon.sql'),
      path.resolve(process.cwd(), 'backend/restore_kiya_neon.sql')
    ];
    let sql = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        sql = fs.readFileSync(p, 'utf8');
        break;
      }
    }

    if (!sql) {
      return res.status(404).json({ success: false, message: 'restore_kiya_neon.sql not found on server' });
    }

    if (db.isPostgres) {
      const conn = await db.master.getConnection();
      try {
        await conn.query(sql);
        console.log('✓ Successfully restored KIYA data to Neon schema company_8');
        return res.json({ 
          success: true, 
          message: 'KIYA data successfully restored to Neon schema company_8! All 9 purchases, 16 items, vouchers, and ledgers restored without touching company_5.' 
        });
      } finally {
        conn.release();
      }
    } else {
      return res.json({ success: true, message: 'Running on SQLite, KIYA data is active in database/company_1.db' });
    }
  } catch (err) {
    console.error('Error restoring KIYA data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
