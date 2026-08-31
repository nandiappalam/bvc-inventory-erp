const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')
const path = require('path')

const dbDir = path.join(__dirname, '../../database')
const dbPath = path.join(dbDir, 'master.db')
fs.mkdirSync(dbDir, { recursive: true })

const db = new sqlite3.Database(dbPath)
db.run('PRAGMA foreign_keys = ON')

const query = (text, params = []) => new Promise((resolve, reject) => {
  db.all(text, params, (err, rows) => err ? reject(err) : resolve({ rows: rows || [] }))
})

const run = (text, params = []) => new Promise((resolve, reject) => {
  db.run(text, params, function (err) {
    if (err) reject(err)
    else resolve({ lastID: this.lastID, lastInsertRowid: this.lastID, changes: this.changes })
  })
})

async function initialize() {
  await run(`CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_code TEXT UNIQUE,
    name TEXT NOT NULL,
    address TEXT,
    gst_number TEXT,
    contact TEXT,
    email TEXT,
    database_name TEXT NOT NULL UNIQUE,
    database_path TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(username, company_id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
  )`)
  await run(`CREATE TABLE IF NOT EXISTS user_permissions (
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
  )`)
  await run(`CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    company_id INTEGER,
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    logout_time DATETIME,
    ip_address TEXT
  )`)

  const count = await query('SELECT COUNT(*) AS count FROM companies')
  if (count.rows[0].count === 0) await migrateLegacyData()
}

async function migrateLegacyData() {
  const legacyPath = path.join(dbDir, 'bvc.db')
  if (!fs.existsSync(legacyPath)) return
  const legacy = new sqlite3.Database(legacyPath)
  const read = (sql) => new Promise((resolve) => legacy.all(sql, [], (err, rows) => resolve(err ? [] : rows)))
  const companies = await read('SELECT * FROM companies')
  for (const company of companies) {
    const result = await run(`INSERT OR IGNORE INTO companies
      (id, company_code, name, address, gst_number, contact, email, database_name, database_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      company.id, `LEGACY${String(company.id).padStart(3, '0')}`, company.name,
      company.address || null, company.gst_number || null, company.contact || null,
      company.email || null, company.id === 1 ? 'bvc.db' : `company_${company.id}.db`,
      path.join(dbDir, company.id === 1 ? 'bvc.db' : `company_${company.id}.db`)
    ])
    const companyId = result.lastID || company.id
    const users = await read(`SELECT * FROM users WHERE company_id = ${Number(company.id)}`)
    for (const user of users) {
      await run(`INSERT OR IGNORE INTO users
        (id, company_id, username, password_hash, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [user.id, companyId, user.username, user.password_hash,
        user.role || 'user', user.status || 'Active', user.created_at, user.updated_at])
    }
  }
  legacy.close()
}

initialize().catch(err => console.error('Master database initialization failed:', err.message))

module.exports = { dbPath, query, run, initialize }