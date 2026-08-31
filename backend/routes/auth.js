const express = require('express')
const router = express.Router()
const db = require('../config/database')

// ============================================================================
// AUTH TABLES MANAGEMENT - Simplified initialization with logging
// ============================================================================

const createAuthTables = async () => {
  try {
    console.log('Creating auth tables...')
    await db.run(`PRAGMA foreign_keys = OFF`)
    
    // Create companies table
    await db.run(`CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT, gst_number TEXT, contact TEXT, email TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`)
    console.log('Companies table ready')
    
    // Create users table
    await db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      username TEXT NOT NULL, 
      password_hash TEXT NOT NULL, 
      role TEXT DEFAULT 'user', 
      company_id INTEGER, 
      status TEXT DEFAULT 'Active', 
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(username, company_id)
    )`)

    // Auto-migrate old users table schema if username had global UNIQUE constraint
    try {
      const tableInfo = await db.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
      if (tableInfo.rows.length > 0 && tableInfo.rows[0].sql.includes('username TEXT UNIQUE')) {
        console.log('Migrating users table schema to allow per-company unique usernames...')
        await db.run('ALTER TABLE users RENAME TO users_old')
        await db.run(`CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          company_id INTEGER,
          status TEXT DEFAULT 'Active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(username, company_id)
        )`)
        await db.run(`INSERT OR IGNORE INTO users (id, username, password_hash, role, company_id, status, created_at, updated_at)
          SELECT id, username, password_hash, role, COALESCE(company_id, 1), COALESCE(status, 'Active'), created_at, updated_at FROM users_old`)
        await db.run('DROP TABLE users_old')
        console.log('Users table schema successfully migrated!')
      }
    } catch (migErr) {
      console.error('User table migration notice:', migErr.message)
    }

    console.log('Users table ready')
    
    // Create user_permissions table
    await db.run(`CREATE TABLE IF NOT EXISTS user_permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, module_name TEXT NOT NULL, page_name TEXT NOT NULL, can_view INTEGER DEFAULT 0, can_create INTEGER DEFAULT 0, can_edit INTEGER DEFAULT 0, can_delete INTEGER DEFAULT 0, can_print INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, module_name, page_name))`)
    console.log('User_permissions table ready')

    // Create login_history table
    await db.run(`CREATE TABLE IF NOT EXISTS login_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, company_id INTEGER, login_time DATETIME DEFAULT CURRENT_TIMESTAMP, logout_time DATETIME, ip_address TEXT)`)
    console.log('Login_history table ready')
    
    await db.run(`PRAGMA foreign_keys = ON`)
    console.log('Auth tables initialized successfully')
  } catch (error) {
    console.error('Auth tables init error:', error.message)
  }
}

createAuthTables()

// ============================================================================
// SEED DEFAULT DATA
// ============================================================================
const seedDefaultData = async () => {
  try {
    const bcrypt = require('bcryptjs')
    const saltRounds = 10
    
    const adminPasswordHash = await bcrypt.hash('admin123', saltRounds)
    const staffPasswordHash = await bcrypt.hash('staff123', saltRounds)
    
    const companies = await db.query('SELECT COUNT(*) as count FROM companies')
    console.log('Companies count:', companies.rows[0].count)
    
    if (companies.rows[0].count === 0) {
      console.log('Seeding default company...')
      const companyResult = await db.run('INSERT INTO companies (name, address, gst_number, contact, email) VALUES (?, ?, ?, ?, ?)', ['BVC Company', '123 Main Street, City', '27AABCV1234A1Z5', '9876543210', 'info@bvc.com'])
      const companyId = companyResult.lastID
      console.log('Default company created with ID:', companyId)
      
      console.log('Seeding default users...')
      await db.run('INSERT INTO users (username, password_hash, role, status, company_id) VALUES (?, ?, ?, ?, ?)', ['admin', adminPasswordHash, 'Admin', 'Active', companyId])
      await db.run('INSERT INTO users (username, password_hash, role, status, company_id) VALUES (?, ?, ?, ?, ?)', ['staff', staffPasswordHash, 'Staff', 'Active', companyId])
      console.log('Default users created!')
    }
  } catch (error) {
    console.error('Error seeding default data:', error.message)
  }
}

setTimeout(seedDefaultData, 2000)

// ============================================================================
// API ROUTES
// ============================================================================

// GET login history
router.get('/login-history/:userId', async (req, res) => {
  try {
    await db.run(`CREATE TABLE IF NOT EXISTS login_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, company_id INTEGER, login_time DATETIME DEFAULT CURRENT_TIMESTAMP, logout_time DATETIME, ip_address TEXT)`)
    const result = await db.query(`SELECT lh.*, u.username FROM login_history lh LEFT JOIN users u ON lh.user_id = u.id WHERE lh.user_id = ? ORDER BY lh.login_time DESC LIMIT 50`, [req.params.userId])
    res.json(result.rows || [])
  } catch (error) {
    console.error('Error fetching login history:', error)
    res.json([])
  }
})

// GET user permissions
router.get('/permissions/:userId', async (req, res) => {
  try {
    const result = await db.query(`SELECT module_name, page_name, can_view, can_create, can_edit, can_delete, can_print FROM user_permissions WHERE user_id = ?`, [req.params.userId])
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching permissions:', error)
    res.status(500).json({ message: 'Error fetching permissions', error: error.message })
  }
})

// POST login
router.post('/login', async (req, res) => {
  try {
    let { username, password, company_id } = req.body
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' })
    }

    const trimmedUsername = String(username).trim()
    const companyIdNum = company_id ? parseInt(company_id, 10) : null
    const bcrypt = require('bcryptjs')

    if (companyIdNum) {
      // First, check if ANY users exist for this company
      const usersCountResult = await db.query('SELECT COUNT(*) as count FROM users WHERE company_id = ?', [companyIdNum])
      const userCount = usersCountResult.rows[0]?.count || 0
      if (userCount === 0) {
        // Also check global users count
        const totalUsersResult = await db.query('SELECT COUNT(*) as count FROM users')
        const totalUsers = totalUsersResult.rows[0]?.count || 0
        if (totalUsers === 0) {
          return res.status(404).json({ message: 'no_user_exists' })
        }
      }
    }

    let userCandidate = null;

    // 1. Check company-specific user matching username
    if (companyIdNum) {
      const companyUsers = await db.query(
        'SELECT id, username, password_hash, role, status, company_id FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) AND company_id = ?',
        [trimmedUsername, companyIdNum]
      )

      for (const candidate of companyUsers.rows) {
        let matches = false
        if (candidate.password_hash && candidate.password_hash.startsWith('$2')) {
          matches = await bcrypt.compare(password, candidate.password_hash)
        } else {
          matches = (password === candidate.password_hash)
        }
        if (matches) {
          userCandidate = candidate
          break
        }
      }
    }

    // 2. Fallback: Search all users globally matching username (e.g. Admin logging into another company)
    if (!userCandidate) {
      const globalUsers = await db.query(
        'SELECT id, username, password_hash, role, status, company_id FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))',
        [trimmedUsername]
      )

      for (const candidate of globalUsers.rows) {
        let matches = false
        if (candidate.password_hash && candidate.password_hash.startsWith('$2')) {
          matches = await bcrypt.compare(password, candidate.password_hash)
        } else {
          matches = (password === candidate.password_hash)
        }
        if (matches) {
          userCandidate = candidate
          break
        }
      }
    }

    if (!userCandidate) {
      return res.status(401).json({ message: 'Invalid username or password for this company' })
    }

    if (userCandidate.status === 'Inactive') {
      return res.status(401).json({ message: 'User account is inactive' })
    }

    const activeCompanyId = companyIdNum || userCandidate.company_id || 1
    const companyResult = await db.query('SELECT * FROM companies WHERE id = ?', [activeCompanyId])
    const company = companyResult.rows[0]

    if (!company) {
      return res.status(401).json({ message: 'User company not found' })
    }

    const permissionsResult = await db.query(
      `SELECT module_name, page_name, can_view, can_create, can_edit, can_delete, can_print FROM user_permissions WHERE user_id = ?`,
      [userCandidate.id]
    )
    const permissions = permissionsResult.rows
    const isAdmin = (userCandidate.role && (userCandidate.role.toLowerCase() === 'admin' || userCandidate.role.toLowerCase() === 'manager'))

    let loginHistoryId = null
    try {
      await db.run(`CREATE TABLE IF NOT EXISTS login_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, company_id INTEGER, login_time DATETIME DEFAULT CURRENT_TIMESTAMP, logout_time DATETIME, ip_address TEXT)`)
      const loginResult = await db.run('INSERT INTO login_history (user_id, company_id, ip_address) VALUES (?, ?, ?)', [userCandidate.id, activeCompanyId, req.ip])
      loginHistoryId = loginResult ? loginResult.lastInsertRowid : null
    } catch (lhErr) {
      console.error('Error recording login_history:', lhErr.message)
    }

    const { generateToken } = require('../middleware/authMiddleware')
    const token = generateToken({
      id: userCandidate.id,
      username: userCandidate.username,
      role: userCandidate.role,
      companyId: activeCompanyId,
      companyName: company.name
    })

    res.json({
      message: 'Login successful',
      token: token,
      user: { id: userCandidate.id, username: userCandidate.username, role: userCandidate.role, company_id: activeCompanyId, company_name: company.name },
      company: company,
      permissions: permissions,
      isAdmin: isAdmin,
      login_history_id: loginHistoryId
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Login failed', error: error.message })
  }
})

// POST logout
router.post('/logout', async (req, res) => {
  try {
    const { login_history_id } = req.body
    if (login_history_id) {
      await db.run('UPDATE login_history SET logout_time = CURRENT_TIMESTAMP WHERE id = ?', [login_history_id])
    }
    res.json({ message: 'Logout successful' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ message: 'Logout failed', error: error.message })
  }
})

// POST create user - WITH DETAILED LOGGING
router.post('/users', async (req, res) => {
  console.log('=== POST /api/auth/users ===')
  console.log('Request body:', JSON.stringify(req.body))
  
  try {
    let { username, password, role, status, company_id, permissions } = req.body

    if (!username || !password || !company_id) {
      console.log('Validation failed: missing required fields')
      return res.status(400).json({ message: 'Username, password and company are required' })
    }

    username = String(username).trim()
    const companyIdNum = parseInt(company_id, 10)

    // Check for existing user FOR THIS COMPANY
    console.log('Checking for existing user for company:', companyIdNum)
    const existingUser = await db.query(
      'SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) AND company_id = ?',
      [username, companyIdNum]
    )

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: `Username "${username}" already exists for this company` })
    }

    // Insert new user - hash the password
    const bcrypt = require('bcryptjs')
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)
    
    const userResult = await db.run(
      'INSERT INTO users (username, password_hash, role, status, company_id) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, role || 'Staff', status || 'Active', companyIdNum]
    )
    console.log('User inserted, ID:', userResult.lastID)
    const userId = userResult.lastID

    // Add permissions if provided
    if (permissions && permissions.length > 0) {
      console.log('Adding permissions:', permissions.length)
      for (const perm of permissions) {
        if (perm.can_view || perm.can_create || perm.can_edit || perm.can_delete || perm.can_print) {
          await db.run(
            `INSERT INTO user_permissions (user_id, module_name, page_name, can_view, can_create, can_edit, can_delete, can_print) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, perm.module_name, perm.page_name || 'Display', perm.can_view ? 1 : 0, perm.can_create ? 1 : 0, perm.can_edit ? 1 : 0, perm.can_delete ? 1 : 0, perm.can_print ? 1 : 0]
          )
        }
      }
    }

    console.log('User created successfully!')
    res.status(201).json({ message: 'User created successfully!', id: userId })
  } catch (error) {
    console.error('=== ERROR creating user ===', error)
    if (error.code === 'SQLITE_CONSTRAINT' || error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'Username already exists for this company. Please choose a different username.' })
    }
    res.status(500).json({ message: 'Error creating user', error: error.message })
  }
})

// GET users by company
router.get('/users/:companyId', async (req, res) => {
  try {
    // Join with companies table to get company name
    const result = await db.query(`
      SELECT u.id as id, u.username, u.role, u.status, u.created_at, u.company_id,
             c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.company_id = ?
      ORDER BY u.username
    `, [req.params.companyId])
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ message: 'Error fetching users', error: error.message })
  }
})

// GET all users (for admin view across all companies)
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id as id, u.username, u.role, u.status, u.created_at, u.company_id,
             c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      ORDER BY u.username
    `)
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching all users:', error)
    res.status(500).json({ message: 'Error fetching users', error: error.message })
  }
})

// GET single user with permissions
router.get('/users/:companyId/:userId', async (req, res) => {
  try {
    let userResult = await db.query('SELECT id, username, role, status, company_id, created_at FROM users WHERE id = ? AND company_id = ?', [req.params.userId, req.params.companyId])
    if (userResult.rows.length === 0) {
      userResult = await db.query('SELECT id, username, role, status, company_id, created_at FROM users WHERE id = ?', [req.params.userId])
    }
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }
    const user = userResult.rows[0]
    const permResult = await db.query(`SELECT module_name, page_name, can_view, can_create, can_edit, can_delete, can_print FROM user_permissions WHERE user_id = ?`, [user.id])
    res.json({ ...user, permissions: permResult.rows })
  } catch (error) {
    console.error('Error fetching user:', error)
    res.status(500).json({ message: 'Error fetching user', error: error.message })
  }
})

// PUT update user
router.put('/users/:userId', async (req, res) => {
  try {
    const { username, password, role, status, company_id, permissions } = req.body
    const { userId } = req.params

    const companyIdNum = company_id ? parseInt(company_id, 10) : null

    if (password) {
      // Hash the password before updating
      const bcrypt = require('bcryptjs')
      const saltRounds = 10
      const passwordHash = await bcrypt.hash(password, saltRounds)
      if (companyIdNum) {
        await db.run('UPDATE users SET username = ?, password_hash = ?, role = ?, status = ?, company_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [username, passwordHash, role, status, companyIdNum, userId])
      } else {
        await db.run('UPDATE users SET username = ?, password_hash = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [username, passwordHash, role, status, userId])
      }
    } else {
      if (companyIdNum) {
        await db.run('UPDATE users SET username = ?, role = ?, status = ?, company_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [username, role, status, companyIdNum, userId])
      } else {
        await db.run('UPDATE users SET username = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [username, role, status, userId])
      }
    }

    if (permissions && Array.isArray(permissions)) {
      await db.run('DELETE FROM user_permissions WHERE user_id = ?', [userId])
      for (const perm of permissions) {
        if (perm.can_view || perm.can_create || perm.can_edit || perm.can_delete || perm.can_print) {
          await db.run(`INSERT INTO user_permissions (user_id, module_name, page_name, can_view, can_create, can_edit, can_delete, can_print) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [userId, perm.module_name, perm.page_name || 'Display', perm.can_view ? 1 : 0, perm.can_create ? 1 : 0, perm.can_edit ? 1 : 0, perm.can_delete ? 1 : 0, perm.can_print ? 1 : 0])
        }
      }
    }

    res.json({ message: 'User updated successfully!' })
  } catch (error) {
    console.error('Error updating user:', error)
    res.status(500).json({ message: 'Error updating user', error: error.message })
  }
})

// DELETE user
router.delete('/users/:userId', async (req, res) => {
  try {
    await db.run('DELETE FROM user_permissions WHERE user_id = ?', [req.params.userId])
    await db.run('DELETE FROM users WHERE id = ?', [req.params.userId])
    res.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    res.status(500).json({ message: 'Error deleting user', error: error.message })
  }
})

module.exports = router
