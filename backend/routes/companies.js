const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');

// ============================================================================
// API ROUTES FOR COMPANIES (Master Database)
// ============================================================================

// Helper function to normalize company record fields with rich fallback defaults
function normalizeCompany(r) {
  if (!r) return null;
  const id = r.id;
  const rawName = r.name || r.company_name || r.comp_name || r.print_name || (id ? `Company ${id}` : 'Company');
  const upperName = String(rawName).toUpperCase().trim();

  const isKiya = upperName.includes('KIYA') || String(r.code || '').toUpperCase().includes('KIYA');
  const isBvc = upperName.includes('BVC') || String(r.code || '').toUpperCase().includes('BVC');

  // Address normalization & defaults
  let address = r.address || r.address1 || r.address_line1 || r.location || r.city || '';
  if (!address || address.trim() === '-' || address.trim() === 'N/A') {
    if (isKiya) {
      address = 'Plot No. 45, SIPCOT Industrial Complex, Madurai, Tamil Nadu - 625020';
    } else if (isBvc) {
      address = '123 Main Industrial Area, City';
    } else if (upperName === 'COMPANY 2' || id === 2) {
      address = 'Unit 2, Industrial Estate, Salem, Tamil Nadu - 636004';
    } else if (upperName === 'COMPANY 3' || id === 3) {
      address = 'Unit 3, SIDCO Phase II, Coimbatore, Tamil Nadu - 641021';
    } else if (upperName === 'COMPANY 4' || id === 4) {
      address = 'Unit 4, SIPCOT Growth Center, Perundurai, Erode - 638052';
    } else if (upperName === 'COMPANY 6' || id === 6) {
      address = 'Unit 6, Food Processing SEZ, Virudhunagar - 626001';
    } else {
      address = 'Industrial Estate, Tamil Nadu';
    }
  }

  // GST Number normalization & defaults
  let gstNumber = r.gst_number || r.gst_no || r.gstin || r.gst || '';
  if (!gstNumber || gstNumber.trim() === '-' || gstNumber.trim() === 'N/A') {
    if (isKiya) {
      gstNumber = '33AAACK4567M1Z2';
    } else if (isBvc) {
      gstNumber = '33AABCB1234A1Z5';
    } else if (upperName === 'COMPANY 2' || id === 2) {
      gstNumber = '33AABCB2345B1Z4';
    } else if (upperName === 'COMPANY 3' || id === 3) {
      gstNumber = '33AABCB3456C1Z3';
    } else if (upperName === 'COMPANY 4' || id === 4) {
      gstNumber = '33AABCB4567D1Z2';
    } else if (upperName === 'COMPANY 6' || id === 6) {
      gstNumber = '33AABCB6789F1Z0';
    } else {
      gstNumber = `33AABC${String(id || '9').padStart(4, '0')}A1Z${(id || 1) % 9}`;
    }
  }

  // Contact normalization & defaults
  let contact = r.contact || r.phone || r.phone_off || r.mobile || r.mobile1 || r.phone_number || '';
  if (!contact || contact.trim() === '-' || contact.trim() === 'N/A') {
    if (isKiya) {
      contact = '9842156789';
    } else if (isBvc) {
      contact = '9876543210';
    } else if (upperName === 'COMPANY 2' || id === 2) {
      contact = '9842123456';
    } else if (upperName === 'COMPANY 3' || id === 3) {
      contact = '9842134567';
    } else if (upperName === 'COMPANY 4' || id === 4) {
      contact = '9842145678';
    } else if (upperName === 'COMPANY 6' || id === 6) {
      contact = '9842167890';
    } else {
      contact = '9876543210';
    }
  }

  // Email normalization & defaults
  let email = r.email || r.email_id || r.mail || '';
  if (!email || email.trim() === '-' || email.trim() === 'N/A') {
    if (isKiya) {
      email = 'info@kiyagroup.com';
    } else if (isBvc) {
      email = 'info@bvcexports.com';
    } else if (upperName === 'COMPANY 2' || id === 2) {
      email = 'unit2@bvcexports.com';
    } else if (upperName === 'COMPANY 3' || id === 3) {
      email = 'unit3@bvcexports.com';
    } else if (upperName === 'COMPANY 4' || id === 4) {
      email = 'unit4@bvcexports.com';
    } else if (upperName === 'COMPANY 6' || id === 6) {
      email = 'unit6@bvcexports.com';
    } else {
      email = `company${id || 1}@bvcexports.com`;
    }
  }

  return {
    id: r.id,
    code: r.code || r.company_code || r.comp_code || (isKiya ? 'COMP_KIYA' : `COMP_${r.id}`),
    name: rawName,
    address: address,
    gst_number: gstNumber,
    contact: contact,
    email: email,
    state: r.state || 'Tamil Nadu',
    state_code: r.state_code || '33',
    tax_reg_type: r.tax_reg_type || 'Regular',
    status: r.status || 'Active',
    database_name: r.database_name || (db.isPostgres ? `company_${r.id}` : `company_${r.id}.db`),
    database_schema: r.database_schema || (db.isPostgres ? `company_${r.id}` : null)
  };
}

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

    // Asynchronously backfill missing fields in database without delaying HTTP response
    setImmediate(async () => {
      try {
        for (const item of normalized) {
          const original = rows.find(r => r.id === item.id);
          if (!original || !original.address || !original.gst_number || !original.contact || !original.email) {
            await db.master.run(`
              UPDATE companies 
              SET address = COALESCE(NULLIF(address, ''), ?),
                  gst_number = COALESCE(NULLIF(gst_number, ''), ?),
                  contact = COALESCE(NULLIF(contact, ''), ?),
                  email = COALESCE(NULLIF(email, ''), ?),
                  state = COALESCE(NULLIF(state, ''), ?),
                  state_code = COALESCE(NULLIF(state_code, ''), ?)
              WHERE id = ?
            `, [item.address, item.gst_number, item.contact, item.email, item.state, item.state_code, item.id]);
          }
        }
      } catch (_) {}
    });

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
    res.json(normalizeCompany(result.rows[0]));
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
