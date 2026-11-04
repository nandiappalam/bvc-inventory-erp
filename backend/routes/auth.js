const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { hasCompanyAccess } = require('../middleware/authMiddleware');

function requireCompanyAdmin(req, res, next) {
  const role = String(req.user && req.user.role || '').trim().toLowerCase();
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!['admin', 'manager', 'superadmin'].includes(role)) {
    return res.status(403).json({ success: false, message: 'Administrator privileges required' });
  }
  return next();
}

function requireCurrentCompany(req, res, next) {
  const requestedCompanyId = Number(req.params.companyId || req.body.company_id);
  if (!Number.isSafeInteger(requestedCompanyId) || requestedCompanyId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid company ID' });
  }
  if (requestedCompanyId !== Number(req.companyId)) {
    return res.status(403).json({ success: false, message: 'Company access denied' });
  }
  return next();
}

// Helper for database operations on the master database
const masterDb = {
  query: async (sql, params = []) => {
    if (db.master && typeof db.master.query === 'function') {
      return await db.master.query(sql, params);
    }
    return await db.query(sql, params);
  },
  run: async (sql, params = []) => {
    if (db.master && typeof db.master.run === 'function') {
      return await db.master.run(sql, params);
    }
    return await db.run(sql, params);
  }
};

// ============================================================================
// AUTH TABLES MANAGEMENT - Ensure tables & columns exist on SQLite & PostgreSQL
// ============================================================================
const createAuthTables = async () => {
  try {
    console.log('Ensuring auth tables and columns on database...');
    
    // Create companies table
    await masterDb.run(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT NOT NULL, 
        address TEXT, 
        gst_number TEXT, 
        contact TEXT, 
        email TEXT, 
        state TEXT DEFAULT 'Tamil Nadu',
        state_code TEXT DEFAULT '33',
        status TEXT DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create users table with all security and expiry columns
    await masterDb.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        username TEXT NOT NULL, 
        password_hash TEXT NOT NULL, 
        role TEXT DEFAULT 'Staff', 
        company_id INTEGER, 
        status TEXT DEFAULT 'Active', 
        password_expiry_days INTEGER DEFAULT 90,
        password_last_changed DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, company_id)
      )
    `);

    // Ensure password_expiry_days & password_last_changed exist in existing users table
    try {
      if (db.isPostgres) {
        if (db.master && typeof db.master.getConnection === 'function') {
          const poolClient = await db.master.getConnection();
          try {
            await poolClient.query(`
              ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_expiry_days INTEGER DEFAULT 90;
              ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_last_changed TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            `);
          } catch (_) {}
          poolClient.release();
        }
        await masterDb.run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expiry_days INTEGER DEFAULT 90`).catch(() => {});
        await masterDb.run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_last_changed TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => {});
      } else {
        const pragmaInfo = await masterDb.query("PRAGMA table_info(users)");
        const colNames = (pragmaInfo.rows || []).map(c => c.name);
        if (!colNames.includes('password_expiry_days')) {
          await masterDb.run("ALTER TABLE users ADD COLUMN password_expiry_days INTEGER DEFAULT 90").catch(() => {});
        }
        if (!colNames.includes('password_last_changed')) {
          await masterDb.run("ALTER TABLE users ADD COLUMN password_last_changed TEXT").catch(() => {});
          await masterDb.run("UPDATE users SET password_last_changed = datetime('now') WHERE password_last_changed IS NULL").catch(() => {});
        }
      }
    } catch (colErr) {
      console.warn('Notice ensuring user table columns:', colErr.message);
    }

    // Create user_permissions table
    await masterDb.run(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER NOT NULL, 
        module_name TEXT NOT NULL, 
        page_name TEXT NOT NULL, 
        can_view INTEGER DEFAULT 0, 
        can_create INTEGER DEFAULT 0, 
        can_edit INTEGER DEFAULT 0, 
        can_delete INTEGER DEFAULT 0, 
        can_print INTEGER DEFAULT 0, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
        UNIQUE(user_id, module_name, page_name)
      )
    `);

    // Create login_history table
    await masterDb.run(`
      CREATE TABLE IF NOT EXISTS login_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER NOT NULL, 
        company_id INTEGER, 
        login_time DATETIME DEFAULT CURRENT_TIMESTAMP, 
        logout_time DATETIME, 
        ip_address TEXT
      )
    `);

    await masterDb.run(`
      CREATE TABLE IF NOT EXISTS user_company_access (
        user_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        PRIMARY KEY (user_id, company_id)
      )
    `);

    console.log('✅ Auth tables and columns initialized successfully');
  } catch (error) {
    console.error('Auth tables init error:', error.message);
  }
};

createAuthTables();

// ============================================================================
// ENSURE A DEFAULT COMPANY EXISTS
// ============================================================================
const seedDefaultData = async () => {
  try {
    await createAuthTables();

    const companies = await masterDb.query("SELECT * FROM companies ORDER BY id ASC");
    if (!companies.rows || companies.rows.length === 0) {
      console.log('🌱 Seeding default company...');
      await masterDb.run(
        'INSERT INTO companies (name, address, gst_number, contact, email, status) VALUES (?, ?, ?, ?, ?, ?)',
        ['BVC Exports Pvt Ltd', '123 Main Industrial Area, City', '33AABCB1234A1Z5', '9876543210', 'info@bvcexports.com', 'Active']
      );
    }
  } catch (error) {
    console.error('Error seeding default auth data:', error.message);
  }
};

setTimeout(seedDefaultData, 1000);

// ============================================================================
// API ROUTES
// ============================================================================

// GET login history
router.get('/login-history/:userId', requireCompanyAdmin, async (req, res) => {
  try {
    const result = await masterDb.query(
      `SELECT lh.id, lh.company_id, lh.login_time, lh.logout_time, lh.ip_address, u.username
         FROM login_history lh
         JOIN users u ON lh.user_id = u.id
        WHERE lh.user_id = ? AND u.company_id = ? AND lh.company_id = ?
        ORDER BY lh.login_time DESC LIMIT 50`,
      [req.params.userId, req.companyId, req.companyId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching login history:', error);
    res.status(500).json({ success: false, message: 'Error fetching login history' });
  }
});

// GET user permissions
router.get('/permissions/:userId', requireCompanyAdmin, async (req, res) => {
  try {
    const result = await masterDb.query(
      `SELECT p.module_name, p.page_name, p.can_view, p.can_create, p.can_edit, p.can_delete, p.can_print
         FROM user_permissions p
         JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ? AND u.company_id = ?`,
      [req.params.userId, req.companyId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ message: 'Error fetching permissions', error: error.message });
  }
});

// POST login
router.post('/login', async (req, res) => {
  try {
    let { username, password, company_id } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const trimmedUsername = String(username).trim();
    const companyIdNum = company_id ? Number(company_id) : null;
    if (company_id && (!Number.isSafeInteger(companyIdNum) || companyIdNum <= 0)) {
      return res.status(400).json({ message: 'Invalid company ID' });
    }
    const retiredDefaultPasswords = new Set(['admin123', 'admin', 'password', '123456', 'staff123', 'staff']);
    if (typeof password !== 'string' || retiredDefaultPasswords.has(password.trim().toLowerCase())) {
      return res.status(401).json({ message: 'Invalid username or password for this company' });
    }

    let userCandidate = null;

    const userQuery = companyIdNum
      ? await masterDb.query(
        `SELECT * FROM users
          WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))
            AND (company_id = ? OR EXISTS (
              SELECT 1 FROM user_company_access a
               WHERE a.user_id = users.id AND a.company_id = ?
            ))`,
        [trimmedUsername, companyIdNum, companyIdNum]
      )
      : await masterDb.query(
        'SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) ORDER BY company_id ASC',
        [trimmedUsername]
      );

    for (const candidate of (userQuery.rows || [])) {
      const matches = candidate.password_hash && candidate.password_hash.startsWith('$2')
        ? await bcrypt.compare(password, candidate.password_hash)
        : password === candidate.password_hash;
      if (matches) {
        userCandidate = candidate;
        break;
      }
    }

    if (!userCandidate) {
      return res.status(401).json({ message: 'Invalid username or password for this company' });
    }
    if (!userCandidate.password_hash.startsWith('$2')) {
      const passwordHash = await bcrypt.hash(password, 10);
      await masterDb.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userCandidate.id]);
      userCandidate.password_hash = passwordHash;
    }

    if (userCandidate.status === 'Inactive') {
      return res.status(401).json({ message: 'User account is inactive. Please contact your administrator.' });
    }

    const activeCompanyId = companyIdNum || userCandidate.company_id || 1;
    if (!(await hasCompanyAccess(userCandidate.id, activeCompanyId))) {
      return res.status(401).json({ message: 'Invalid username or password for this company' });
    }
    const companyResult = await masterDb.query('SELECT * FROM companies WHERE id = ?', [activeCompanyId]);
    const company = companyResult.rows && companyResult.rows[0];
    if (!company || String(company.status || 'Active').toLowerCase() === 'inactive') {
      return res.status(401).json({ message: 'Invalid username or password for this company' });
    }

    const permissionsResult = await masterDb.query(
      `SELECT module_name, page_name, can_view, can_create, can_edit, can_delete, can_print FROM user_permissions WHERE user_id = ?`,
      [userCandidate.id]
    );
    const permissions = permissionsResult.rows || [];
    const isAdmin = (userCandidate.role && (userCandidate.role.toLowerCase() === 'admin' || userCandidate.role.toLowerCase() === 'manager'));

    // Record login history
    let loginHistoryId = null;
    try {
      const loginResult = await masterDb.run(
        'INSERT INTO login_history (user_id, company_id, ip_address) VALUES (?, ?, ?)',
        [userCandidate.id, activeCompanyId, req.ip]
      );
      loginHistoryId = loginResult ? (loginResult.lastID || loginResult.lastInsertRowid) : null;
    } catch (_) {}

    const { generateToken } = require('../middleware/authMiddleware');
    const token = generateToken({
      id: userCandidate.id,
      username: userCandidate.username,
      role: userCandidate.role,
      companyId: activeCompanyId,
      companyName: company.name
    });

    res.json({
      message: 'Login successful',
      token: token,
      user: {
        id: userCandidate.id,
        username: userCandidate.username,
        role: userCandidate.role,
        company_id: activeCompanyId,
        company_name: company.name,
        password_expiry_days: userCandidate.password_expiry_days || 90,
        password_last_changed: userCandidate.password_last_changed || userCandidate.updated_at || userCandidate.created_at || null
      },
      company: company,
      permissions: permissions,
      isAdmin: isAdmin,
      login_history_id: loginHistoryId
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// POST logout
router.post('/logout', async (req, res) => {
  try {
    const { login_history_id } = req.body;
    if (login_history_id) {
      await masterDb.run('UPDATE login_history SET logout_time = CURRENT_TIMESTAMP WHERE id = ?', [login_history_id]);
    }
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed', error: error.message });
  }
});

// POST create user
router.post('/users', requireCompanyAdmin, requireCurrentCompany, async (req, res) => {
  try {
    let { username, password, role, status, company_id, permissions, password_expiry_days } = req.body;

    if (!username || !password || !company_id) {
      return res.status(400).json({ message: 'Username, password and company are required' });
    }

    username = String(username).trim();
    const companyIdNum = Number(company_id);
    if (!Number.isSafeInteger(companyIdNum) || companyIdNum !== Number(req.companyId)) {
      return res.status(403).json({ success: false, message: 'Company access denied' });
    }
    if (typeof password !== 'string' || password.length < 12) {
      return res.status(400).json({ success: false, message: 'Password must be at least 12 characters' });
    }
    if (String(role || 'Staff').toLowerCase() === 'superadmin'
      && String(req.user.role).toLowerCase() !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only a SuperAdmin can grant the SuperAdmin role' });
    }
    const expiryDays = password_expiry_days !== undefined ? parseInt(password_expiry_days, 10) : 90;

    // Check for existing user FOR THIS COMPANY
    const existingUser = await masterDb.query(
      'SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) AND company_id = ?',
      [username, companyIdNum]
    );

    if (existingUser.rows && existingUser.rows.length > 0) {
      return res.status(400).json({ message: `Username "${username}" already exists for this company` });
    }

    // Insert new user - hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    let userResult;
    try {
      userResult = await masterDb.run(
        'INSERT INTO users (username, password_hash, role, status, company_id, password_expiry_days, password_last_changed) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [username, passwordHash, role || 'Staff', status || 'Active', companyIdNum, expiryDays]
      );
    } catch (insertError) {
      if (!/password_last_changed|column/i.test(insertError.message)) throw insertError;
      userResult = await masterDb.run(
        'INSERT INTO users (username, password_hash, role, status, company_id, password_expiry_days) VALUES (?, ?, ?, ?, ?, ?)',
        [username, passwordHash, role || 'Staff', status || 'Active', companyIdNum, expiryDays]
      );
    }

    const userId = userResult.lastID || userResult.lastInsertRowid;

    // Add permissions if provided
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      for (const perm of permissions) {
        if (perm.can_view || perm.can_create || perm.can_edit || perm.can_delete || perm.can_print) {
          await masterDb.run(
            `INSERT INTO user_permissions (user_id, module_name, page_name, can_view, can_create, can_edit, can_delete, can_print) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, perm.module_name, perm.page_name || 'Display', perm.can_view ? 1 : 0, perm.can_create ? 1 : 0, perm.can_edit ? 1 : 0, perm.can_delete ? 1 : 0, perm.can_print ? 1 : 0]
          );
        }
      }
    }

    res.status(201).json({ success: true, message: 'User created successfully!', id: userId });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 'SQLITE_CONSTRAINT' || /unique constraint|duplicate key/i.test(error.message)) {
      return res.status(400).json({ success: false, message: 'Username already exists for this company. Please choose a different username.' });
    }
    res.status(500).json({ success: false, message: 'Error creating user', error: error.message });
  }
});

// GET users by company
router.get('/users/:companyId', requireCompanyAdmin, requireCurrentCompany, async (req, res) => {
  try {
    const result = await masterDb.query(`
      SELECT u.id, u.username, u.role, u.company_id, u.status, u.email, u.phone,
             u.password_expiry_days, u.password_last_changed, u.created_at, u.updated_at,
             c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.company_id = ?
      ORDER BY u.id ASC
    `, [req.params.companyId]);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// GET all users (for admin view across all companies)
router.get('/users', requireCompanyAdmin, async (req, res) => {
  try {
    const result = await masterDb.query(`
      SELECT u.id, u.username, u.role, u.company_id, u.status, u.email, u.phone,
             u.password_expiry_days, u.password_last_changed, u.created_at, u.updated_at,
             c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.company_id = ?
      ORDER BY u.id ASC
    `, [req.companyId]);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// GET single user with permissions
router.get('/users/:companyId/:userId', requireCompanyAdmin, requireCurrentCompany, async (req, res) => {
  try {
    const userResult = await masterDb.query(
      `SELECT id, username, role, company_id, status, email, phone,
              password_expiry_days, password_last_changed, created_at, updated_at
         FROM users WHERE id = ? AND company_id = ?`,
      [req.params.userId, req.params.companyId]
    );
    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = userResult.rows[0];
    const permResult = await masterDb.query(
      `SELECT module_name, page_name, can_view, can_create, can_edit, can_delete, can_print FROM user_permissions WHERE user_id = ?`,
      [user.id]
    );
    res.json({ ...user, permissions: permResult.rows || [] });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
});

// PUT update user (allows changing username, password, expiry time period, role, status, permissions)
router.put('/users/:userId', requireCompanyAdmin, async (req, res) => {
  try {
    const { username, password, role, status, company_id, permissions, password_expiry_days } = req.body;
    const { userId } = req.params;
    const companyIdNum = company_id ? Number(company_id) : Number(req.companyId);
    const expiryDays = password_expiry_days !== undefined ? parseInt(password_expiry_days, 10) : 90;
    if (companyIdNum !== Number(req.companyId)) {
      return res.status(403).json({ success: false, message: 'Company access denied' });
    }

    const currentResult = await masterDb.query(
      'SELECT id, username, role FROM users WHERE id = ? AND company_id = ?',
      [userId, req.companyId]
    );
    const currentUser = currentResult.rows && currentResult.rows[0];
    if (!currentUser) return res.status(404).json({ success: false, message: 'User not found' });
    if (String(role || currentUser.role).toLowerCase() === 'superadmin'
      && String(req.user.role).toLowerCase() !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Only a SuperAdmin can grant the SuperAdmin role' });
    }
    if (password && (typeof password !== 'string' || password.length < 12)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 12 characters' });
    }

    const fields = [
      username || currentUser.username,
      role || currentUser.role,
      status || 'Active',
      expiryDays,
      userId,
      req.companyId,
    ];
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await masterDb.run(
        `UPDATE users
            SET username = ?, role = ?, status = ?, password_expiry_days = ?,
                password_hash = ?, password_last_changed = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND company_id = ?`,
        [fields[0], fields[1], fields[2], fields[3], passwordHash, fields[4], fields[5]]
      );
    } else {
      await masterDb.run(
        `UPDATE users
            SET username = ?, role = ?, status = ?, password_expiry_days = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND company_id = ?`,
        fields
      );
    }

    if (permissions && Array.isArray(permissions)) {
      await masterDb.run(
        'DELETE FROM user_permissions WHERE user_id = ? AND EXISTS (SELECT 1 FROM users WHERE id = ? AND company_id = ?)',
        [userId, userId, req.companyId]
      );
      for (const perm of permissions) {
        if (perm.can_view || perm.can_create || perm.can_edit || perm.can_delete || perm.can_print) {
          await masterDb.run(
            `INSERT INTO user_permissions (user_id, module_name, page_name, can_view, can_create, can_edit, can_delete, can_print) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, perm.module_name, perm.page_name || 'Display', perm.can_view ? 1 : 0, perm.can_create ? 1 : 0, perm.can_edit ? 1 : 0, perm.can_delete ? 1 : 0, perm.can_print ? 1 : 0]
          );
        }
      }
    }

    res.json({ success: true, message: 'User details, password settings, and permissions updated successfully!' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Error updating user', error: error.message });
  }
});

// DELETE user
router.delete('/users/:userId', requireCompanyAdmin, async (req, res) => {
  try {
    if (Number(req.params.userId) === Number(req.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }
    await masterDb.run(
      'DELETE FROM user_permissions WHERE user_id = ? AND EXISTS (SELECT 1 FROM users WHERE id = ? AND company_id = ?)',
      [req.params.userId, req.params.userId, req.companyId]
    );
    const result = await masterDb.run(
      'DELETE FROM users WHERE id = ? AND company_id = ?',
      [req.params.userId, req.companyId]
    );
    if (!result.changes && !result.rowCount) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Error deleting user', error: error.message });
  }
});

module.exports = router;
