/**
 * Migration 001: Initial Schema
 *
 * Creates the core companies, users, company_users, login_history,
 * user_permissions, and migrations tables.
 *
 * Schema is compatible with the existing masterDatabase.js schema
 * (companies, users, user_permissions, login_history) so that existing
 * data is preserved. Uses CREATE TABLE IF NOT EXISTS and ALTER TABLE
 * to add missing columns — never destructive.
 */
const db = require('../config/database');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

async function up() {
  // ─── Companies table ───────────────────────────────────────────────────
  // Compatible with existing masterDatabase.js schema
  await db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_code TEXT UNIQUE,
      name TEXT NOT NULL,
      address TEXT,
      gst_number TEXT,
      contact TEXT,
      email TEXT,
      database_name TEXT,
      database_path TEXT,
      legal_name TEXT,
      phone TEXT,
      pan_number TEXT,
      state TEXT,
      state_code TEXT,
      tax_reg_type TEXT DEFAULT 'Regular',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Users table ───────────────────────────────────────────────────────
  // Compatible with existing masterDatabase.js schema
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      username TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(username, company_id)
    )
  `);

  // ─── Company users (membership table) ──────────────────────────────────
  // New table for explicit company-user membership
  await db.run(`
    CREATE TABLE IF NOT EXISTS company_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, user_id),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
    )
  `);

  // ─── Login history ─────────────────────────────────────────────────────
  await db.run(`
    CREATE TABLE IF NOT EXISTS login_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      company_id INTEGER,
      login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      logout_time DATETIME,
      ip_address TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
    )
  `);

  // ─── User permissions ──────────────────────────────────────────────────
  await db.run(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      company_id INTEGER,
      module_name TEXT NOT NULL,
      page_name TEXT NOT NULL,
      can_view INTEGER DEFAULT 0,
      can_create INTEGER DEFAULT 0,
      can_edit INTEGER DEFAULT 0,
      can_delete INTEGER DEFAULT 0,
      can_print INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, module_name, page_name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
    )
  `);

  // ─── Migration tracking table ──────────────────────────────────────────
  await db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── Migrate legacy data from master.db ────────────────────────────────
  // If master.db exists and has data, copy companies and users into the main database
  if (db.isSqlite) {
    const dbDir = path.join(__dirname, '../../database');
    const masterDbPath = path.join(dbDir, 'master.db');

    if (fs.existsSync(masterDbPath)) {
      const masterDb = new sqlite3.Database(masterDbPath);
      try {
        // Check if master.db has companies
        const masterCompanies = await new Promise((resolve) => {
          masterDb.all('SELECT * FROM companies', [], (err, rows) => resolve(err ? [] : rows));
        });

        for (const company of masterCompanies) {
          // Insert or update company (don't overwrite if already exists)
          const existing = await db.query('SELECT id FROM companies WHERE id = ?', [company.id]);
          if (existing.rows.length === 0) {
            await db.run(
              `INSERT INTO companies (id, company_code, name, address, gst_number, contact, email, database_name, database_path, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                company.id,
                company.company_code || `BVC${String(company.id).padStart(3, '0')}`,
                company.name,
                company.address || null,
                company.gst_number || null,
                company.contact || null,
                company.email || null,
                company.database_name || null,
                company.database_path || null,
                company.status || 'active',
                company.created_at || null,
                company.updated_at || null,
              ]
            );
            console.log(`✓ Migrated company: ${company.name} (id=${company.id})`);
          }
        }

        // Check if master.db has users
        const masterUsers = await new Promise((resolve) => {
          masterDb.all('SELECT * FROM users', [], (err, rows) => resolve(err ? [] : rows));
        });

        for (const user of masterUsers) {
          const existing = await db.query('SELECT id FROM users WHERE id = ?', [user.id]);
          if (existing.rows.length === 0) {
            await db.run(
              `INSERT INTO users (id, company_id, username, email, password_hash, name, role, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                user.id,
                user.company_id || null,
                user.username,
                user.email || null,
                user.password_hash,
                user.name || null,
                user.role || 'user',
                user.status || 'Active',
                user.created_at || null,
                user.updated_at || null,
              ]
            );
            console.log(`✓ Migrated user: ${user.username} (id=${user.id})`);
          }
        }

        // Migrate login_history
        const masterLogins = await new Promise((resolve) => {
          masterDb.all('SELECT * FROM login_history', [], (err, rows) => resolve(err ? [] : rows));
        });
        for (const login of masterLogins) {
          const existing = await db.query('SELECT id FROM login_history WHERE id = ?', [login.id]);
          if (existing.rows.length === 0) {
            await db.run(
              `INSERT INTO login_history (id, user_id, company_id, login_time, logout_time, ip_address)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [login.id, login.user_id, login.company_id || null, login.login_time || null, login.logout_time || null, login.ip_address || null]
            );
          }
        }

        // Migrate user_permissions
        const masterPerms = await new Promise((resolve) => {
          masterDb.all('SELECT * FROM user_permissions', [], (err, rows) => resolve(err ? [] : rows));
        });
        for (const perm of masterPerms) {
          const existing = await db.query('SELECT id FROM user_permissions WHERE id = ?', [perm.id]);
          if (existing.rows.length === 0) {
            await db.run(
              `INSERT INTO user_permissions (id, user_id, company_id, module_name, page_name, can_view, can_create, can_edit, can_delete, can_print, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [perm.id, perm.user_id, perm.company_id || null, perm.module_name, perm.page_name, perm.can_view, perm.can_create, perm.can_edit, perm.can_delete, perm.can_print, perm.created_at || null]
            );
          }
        }

        console.log('✓ Legacy data migration from master.db complete');
      } catch (err) {
        console.error('Legacy data migration error:', err.message);
      } finally {
        masterDb.close();
      }
    }
  }

  // ─── Seed default data if no companies exist ───────────────────────────
  const companyCount = await db.query('SELECT COUNT(*) as count FROM companies');
  if (companyCount.rows[0].count === 0) {
    const bcrypt = require('bcryptjs');
    const adminPasswordHash = await bcrypt.hash('admin123', 10);

    const result = await db.run(
      `INSERT INTO companies (company_code, name, address, gst_number, contact, email, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['BVC001', 'BVC Company', '123 Main Street, City', '27AABCV1234A1Z5', '9876543210', 'info@bvc.com', 'active']
    );
    const companyId = result.lastID;

    await db.run(
      `INSERT INTO users (company_id, username, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      [companyId, 'admin', adminPasswordHash, 'Admin', 'Active']
    );

    // Create company_users membership
    await db.run(
      `INSERT INTO company_users (company_id, user_id, role, status)
       VALUES (?, ?, ?, ?)`,
      [companyId, 1, 'Admin', 'Active']
    );

    console.log('✓ Seeded default company and admin user');
  }

  console.log('✓ Migration 001: Initial schema complete');
}

async function down() {
  console.log('⚠️ Migration 001 cannot be reversed (core tables)');
}

module.exports = { up, down, version: 1, name: 'initial_schema' };
