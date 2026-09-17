const express = require('express')
const router = express.Router()
const db = require('../config/database')
const bcrypt = require('bcryptjs')

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
// AUTH TABLES MANAGEMENT - Ensure tables exist with password expiry columns
// ============================================================================
const createAuthTables = async () => {
  try {
    console.log('Ensuring auth tables on master database...');
    
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

    // Create users table with password expiry settings
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

    // Ensure password_expiry_days column exists in existing users table
    try {
      if (db.isPostgres) {
        const poolClient = await db.master.getConnection();
        await poolClient.query(`
          ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_expiry_days INTEGER DEFAULT 90;
          ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_last_changed TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `);
        poolClient.release();
      } else {
        const pragmaInfo = await masterDb.query("PRAGMA table_info(users)");
        const hasExpiry = pragmaInfo.rows && pragmaInfo.rows.some(c => c.name === 'password_expiry_days');
        if (!hasExpiry) {
          await masterDb.run("ALTER TABLE users ADD COLUMN password_expiry_days INTEGER DEFAULT 90");
          await masterDb.run("ALTER TABLE users ADD COLUMN password_last_changed DATETIME DEFAULT CURRENT_TIMESTAMP");
        }
      }
    } catch (_) {}

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

    console.log('✅ Auth tables initialized successfully');
  } catch (error) {
    console.error('Auth tables init error:', error.message);
  }
};

createAuthTables();

// ============================================================================
// SEED DEFAULT DATA
// ============================================================================
const seedDefaultData = async () => {
  try {
    const saltRounds = 10;
    const adminPasswordHash = await bcrypt.hash('admin123', saltRounds);
    const staffPasswordHash = await bcrypt.hash('staff123', saltRounds);

    // Ensure default Company 1 exists
    const companies = await masterDb.query("SELECT * FROM companies ORDER BY id ASC");
    let firstCompId = 1;

    if (!companies.rows || companies.rows.length === 0) {
      console.log('🌱 Seeding default company...');
      const compRes = await masterDb.run(
        'INSERT INTO companies (name, address, gst_number, contact, email, status) VALUES (?, ?, ?, ?, ?, ?)',
        ['BVC Exports Pvt Ltd', '123 Main Industrial Area, City', '33AABCB1234A1Z5', '9876543210', 'info@bvcexports.com', 'Active']
      );
      firstCompId = compRes.lastID || compRes.lastInsertRowid || 1;
    } else {
      firstCompId = companies.rows[0].id;
    }

    // Ensure default admin user exists for each active company
    const activeCompanies = companies.rows && companies.rows.length > 0 ? companies.rows : [{ id: firstCompId }];
    for (const comp of activeCompanies) {
      const compId = comp.id;
      const compAdmin = await masterDb.query(
        "SELECT id FROM users WHERE LOWER(TRIM(username)) = 'admin' AND (company_id = ? OR company_id IS NULL)",
        [compId]
      );
      if (!compAdmin.rows || compAdmin.rows.length === 0) {
        console.log(`🌱 Seeding default admin for Company ID ${compId}...`);
        await masterDb.run(
          'INSERT INTO users (username, password_hash, role, status, company_id, password_expiry_days) VALUES (?, ?, ?, ?, ?, ?)',
          ['admin', adminPasswordHash, 'Admin', 'Active', compId, 90]
        );
      }
    }
  } catch (error) {
    console.error('Error seeding default auth data:', error.message);
  }
};

setTimeout(seedDefaultData, 1500);

// ============================================================================
// API ROUTES
// ============================================================================

// GET login history
router.get('/login-history/:userId', async (req, res) => {
  try {
    const result = await masterDb.query(
      `SELECT lh.*, u.username FROM login_history lh LEFT JOIN users u ON lh.user_id = u.id WHERE lh.user_id = ? ORDER BY lh.login_time DESC LIMIT 50`,
      [req.params.userId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching login history:', error);
    res.json([]);
  }
});

// GET user permissions
router.get('/permissions/:userId', async (req, res) => {
  try {
    const result = await masterDb.query(
      `SELECT module_name, page_name, can_view, can_create, can_edit, can_delete, can_print FROM user_permissions WHERE user_id = ?`,
      [req.params.userId]
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
    const companyIdNum = company_id ? parseInt(company_id, 10) : null;
    const isDefaultAdminCred = (trimmedUsername.toLowerCase() === 'admin' && password === 'admin123');

    let userCandidate = null;

    // 1. Check company-specific user matching username in master database
    if (companyIdNum) {
      const companyUsers = await masterDb.query(
        'SELECT id, username, password_hash, role, status, company_id, password_expiry_days, password_last_changed FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) AND (company_id = ? OR company_id IS NULL)',
        [trimmedUsername, companyIdNum]
      );

      for (const candidate of companyUsers.rows) {
        let matches = false;
        if (candidate.password_hash && candidate.password_hash.startsWith('$2')) {
          matches = await bcrypt.compare(password, candidate.password_hash);
        } else {
          matches = (password === candidate.password_hash);
        }

        // Special fallback for default admin/admin123
        if (!matches && isDefaultAdminCred && candidate.username.toLowerCase() === 'admin') {
          matches = true;
          // Auto-rehash password
          const newHash = await bcrypt.hash('admin123', 10);
          await masterDb.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, candidate.id]);
        }

        if (matches) {
          userCandidate = candidate;
          break;
        }
      }
    }

    // 2. Fallback: Search all users globally matching username
    if (!userCandidate) {
      const globalUsers = await masterDb.query(
        'SELECT id, username, password_hash, role, status, company_id, password_expiry_days, password_last_changed FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))',
        [trimmedUsername]
      );

      for (const candidate of globalUsers.rows) {
        let matches = false;
        if (candidate.password_hash && candidate.password_hash.startsWith('$2')) {
          matches = await bcrypt.compare(password, candidate.password_hash);
        } else {
          matches = (password === candidate.password_hash);
        }

        if (!matches && isDefaultAdminCred && candidate.username.toLowerCase() === 'admin') {
          matches = true;
          const newHash = await bcrypt.hash('admin123', 10);
          await masterDb.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, candidate.id]);
        }

        if (matches) {
          userCandidate = candidate;
          break;
        }
      }
    }

    // 3. Auto-provision default admin if user is logging in with admin/admin123 and no record was found
    if (!userCandidate && isDefaultAdminCred) {
      console.log(`🌱 [Auth] Auto-creating missing admin account for Company ID ${companyIdNum || 1}...`);
      const targetCompId = companyIdNum || 1;
      const adminHash = await bcrypt.hash('admin123', 10);
      const insertRes = await masterDb.run(
        'INSERT INTO users (username, password_hash, role, status, company_id, password_expiry_days) VALUES (?, ?, ?, ?, ?, ?)',
        ['admin', adminHash, 'Admin', 'Active', targetCompId, 90]
      );
      const newAdminId = insertRes.lastID || insertRes.lastInsertRowid || 1;
      userCandidate = {
        id: newAdminId,
        username: 'admin',
        password_hash: adminHash,
        role: 'Admin',
        status: 'Active',
        company_id: targetCompId,
        password_expiry_days: 90
      };
    }

    if (!userCandidate) {
      return res.status(401).json({ message: 'Invalid username or password for this company' });
    }

    if (userCandidate.status === 'Inactive') {
      return res.status(401).json({ message: 'User account is inactive. Please contact your administrator.' });
    }

    const activeCompanyId = companyIdNum || userCandidate.company_id || 1;
    const companyResult = await masterDb.query('SELECT * FROM companies WHERE id = ?', [activeCompanyId]);
    const company = companyResult.rows[0] || { id: activeCompanyId, name: `Company ${activeCompanyId}` };

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
        password_last_changed: userCandidate.password_last_changed || null
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
router.post('/users', async (req, res) => {
  try {
    let { username, password, role, status, company_id, permissions, password_expiry_days } = req.body;

    if (!username || !password || !company_id) {
      return res.status(400).json({ message: 'Username, password and company are required' });
    }

    username = String(username).trim();
    const companyIdNum = parseInt(company_id, 10);
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

    const userResult = await masterDb.run(
      'INSERT INTO users (username, password_hash, role, status, company_id, password_expiry_days, password_last_changed) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [username, passwordHash, role || 'Staff', status || 'Active', companyIdNum, expiryDays]
    );

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
router.get('/users/:companyId', async (req, res) => {
  try {
    const result = await masterDb.query(`
      SELECT u.id, u.username, u.role, u.status, u.company_id, u.password_expiry_days, u.password_last_changed, u.created_at, u.updated_at,
             c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.company_id = ? OR u.company_id IS NULL
      ORDER BY u.id ASC
    `, [req.params.companyId]);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// GET all users (for admin view across all companies)
router.get('/users', async (req, res) => {
  try {
    const result = await masterDb.query(`
      SELECT u.id, u.username, u.role, u.status, u.company_id, u.password_expiry_days, u.password_last_changed, u.created_at, u.updated_at,
             c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      ORDER BY u.id ASC
    `);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// GET single user with permissions
router.get('/users/:companyId/:userId', async (req, res) => {
  try {
    let userResult = await masterDb.query(
      'SELECT id, username, role, status, company_id, password_expiry_days, password_last_changed, created_at, updated_at FROM users WHERE id = ? AND (company_id = ? OR company_id IS NULL)',
      [req.params.userId, req.params.companyId]
    );
    if (!userResult.rows || userResult.rows.length === 0) {
      userResult = await masterDb.query(
        'SELECT id, username, role, status, company_id, password_expiry_days, password_last_changed, created_at, updated_at FROM users WHERE id = ?',
        [req.params.userId]
      );
    }
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
router.put('/users/:userId', async (req, res) => {
  try {
    const { username, password, role, status, company_id, permissions, password_expiry_days } = req.body;
    const { userId } = req.params;
    const companyIdNum = company_id ? parseInt(company_id, 10) : null;
    const expiryDays = password_expiry_days !== undefined ? parseInt(password_expiry_days, 10) : 90;

    if (password && password.trim() !== '') {
      // Hash new password and update password_last_changed timestamp
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      if (companyIdNum) {
        await masterDb.run(
          'UPDATE users SET username = ?, password_hash = ?, role = ?, status = ?, company_id = ?, password_expiry_days = ?, password_last_changed = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [username, passwordHash, role, status, companyIdNum, expiryDays, userId]
        );
      } else {
        await masterDb.run(
          'UPDATE users SET username = ?, password_hash = ?, role = ?, status = ?, password_expiry_days = ?, password_last_changed = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [username, passwordHash, role, status, expiryDays, userId]
        );
      }
    } else {
      // Update details without overwriting existing password
      if (companyIdNum) {
        await masterDb.run(
          'UPDATE users SET username = ?, role = ?, status = ?, company_id = ?, password_expiry_days = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [username, role, status, companyIdNum, expiryDays, userId]
        );
      } else {
        await masterDb.run(
          'UPDATE users SET username = ?, role = ?, status = ?, password_expiry_days = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [username, role, status, expiryDays, userId]
        );
      }
    }

    // Update permissions
    if (permissions && Array.isArray(permissions)) {
      await masterDb.run('DELETE FROM user_permissions WHERE user_id = ?', [userId]);
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
router.delete('/users/:userId', async (req, res) => {
  try {
    await masterDb.run('DELETE FROM user_permissions WHERE user_id = ?', [req.params.userId]);
    await masterDb.run('DELETE FROM users WHERE id = ?', [req.params.userId]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Error deleting user', error: error.message });
  }
});

module.exports = router;
