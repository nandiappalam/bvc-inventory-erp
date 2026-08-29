// Master schema definitions for Multi-Company Tenant Architecture
// Stores global entities: companies, database_registry, users, roles, permissions, login_history

const MASTER_TABLES = [
  {
    name: 'companies',
    sql: `CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      address TEXT,
      gst_number TEXT,
      contact TEXT,
      email TEXT,
      database_name TEXT,
      database_schema TEXT,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    name: 'database_registry',
    sql: `CREATE TABLE IF NOT EXISTS database_registry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL UNIQUE,
      db_type TEXT DEFAULT 'sqlite',
      db_name TEXT NOT NULL,
      db_schema TEXT,
      status TEXT DEFAULT 'Active',
      version INTEGER DEFAULT 1,
      last_migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    name: 'users',
    sql: `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      company_id INTEGER,
      status TEXT DEFAULT 'Active',
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(username, company_id)
    )`
  },
  {
    name: 'roles',
    sql: `CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    name: 'permissions',
    sql: `CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      module_name TEXT NOT NULL,
      page_name TEXT NOT NULL,
      can_view INTEGER DEFAULT 0,
      can_create INTEGER DEFAULT 0,
      can_edit INTEGER DEFAULT 0,
      can_delete INTEGER DEFAULT 0,
      can_print INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(role_id, module_name, page_name)
    )`
  },
  {
    name: 'user_permissions',
    sql: `CREATE TABLE IF NOT EXISTS user_permissions (
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
    )`
  },
  {
    name: 'login_history',
    sql: `CREATE TABLE IF NOT EXISTS login_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      company_id INTEGER,
      login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      logout_time DATETIME,
      ip_address TEXT
    )`
  },
  {
    name: '_master_migrations',
    sql: `CREATE TABLE IF NOT EXISTS _master_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  }
];

const MASTER_TABLE_NAMES = new Set([
  'companies',
  'database_registry',
  'users',
  'roles',
  'permissions',
  'user_permissions',
  'login_history',
  '_master_migrations'
]);

module.exports = {
  MASTER_TABLES,
  MASTER_TABLE_NAMES
};
