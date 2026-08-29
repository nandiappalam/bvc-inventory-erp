require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');
const { MASTER_TABLES, MASTER_TABLE_NAMES } = require('../database/masterSchema');
const { COMPANY_TABLES, DEFAULT_LEDGER_CHART, DEFAULT_TAX_RATES } = require('../database/companySchema');

// Context storage for multi-tenant requests
const asyncLocalStorage = new AsyncLocalStorage();

// Database selection is intentionally explicit. A local machine can have a
// DATABASE_URL for another tool; that must never make desktop mode use Neon.
const configuredEngine = String(process.env.DB_ENGINE || '').trim().toLowerCase();
const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
const DB_ENGINE = configuredEngine || (isProduction ? '' : 'sqlite');
if (!['sqlite', 'postgres'].includes(DB_ENGINE)) {
  throw new Error('Invalid DB_ENGINE. Set DB_ENGINE to "sqlite" or "postgres" explicitly. Production cannot fall back to SQLite.');
}
if (DB_ENGINE === 'postgres' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required when DB_ENGINE=postgres.');
}
if (DB_ENGINE === 'sqlite' && process.env.DATABASE_URL) {
  console.warn('[Database] DATABASE_URL is ignored because DB_ENGINE=sqlite.');
}
const isPostgres = DB_ENGINE === 'postgres';
// Load only the selected engine. In particular, PostgreSQL mode must not even
// initialize SQLite's files or connections, and desktop mode must not create a
// PostgreSQL pool.
const Pool = isPostgres ? require('pg').Pool : null;
const sqlite3 = isPostgres ? null : require('sqlite3').verbose();

// ============================================================================
// SQLITE SETUP (Local Dev & Desktop Tauri)
// ============================================================================
// Packaged Node-backed desktop builds set SQLITE_DATABASE_DIR to an app-data
// folder. Development keeps its local database in the repository.
const dbDir = !isPostgres
  ? (process.env.SQLITE_DATABASE_DIR
    ? path.resolve(process.env.SQLITE_DATABASE_DIR)
    : path.join(__dirname, '../../database'))
  : null;
if (dbDir && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const masterDbPath = dbDir ? path.join(dbDir, 'master.db') : null;
const legacyDbPath = dbDir ? path.join(dbDir, 'bvc.db') : null;

const companyDbPool = new Map();
let masterDb = null;

function normalizeCompanyId(companyId) {
  const value = Number(companyId);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('Invalid company ID.');
  }
  return value;
}

// ============================================================================
// POSTGRESQL SETUP (Neon Cloud / Production / Render)
// ============================================================================
let pgPool = null;

if (isPostgres) {
  const connectionString = process.env.DATABASE_URL;
  const isSslNeeded = process.env.NODE_ENV === 'production' || 
                      connectionString.includes('neon.tech') || 
                      connectionString.includes('supabase.co') || 
                      connectionString.includes('sslmode=require') ||
                      !connectionString.includes('localhost');

  pgPool = new Pool({
    connectionString,
    ssl: isSslNeeded ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pgPool.on('error', (err) => {
    console.error('⚠️ [PostgreSQL Pool] Unexpected error on idle client:', err.message);
  });

  console.log('🚀 [Database Adapter] Initialized PostgreSQL connection pool (Neon/Cloud Engine)');
} else {
  console.log('📦 [Database Adapter] Initialized SQLite Multi-Tenant Engine (Local/Desktop Mode)');
}

// ============================================================================
// HELPER: IS MASTER TABLE QUERY
// ============================================================================
function isMasterTableQuery(sql) {
  if (!sql || typeof sql !== 'string') return false;
  const normalized = sql.toLowerCase();
  for (const tableName of MASTER_TABLE_NAMES) {
    const regex = new RegExp(`\\b${tableName}\\b`, 'i');
    if (regex.test(normalized)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// SQL NORMALIZER & TRANSLATOR (SQLite <-> PostgreSQL)
// ============================================================================
function translateSqlForPostgres(sql, companyId = 1) {
  if (!sql || typeof sql !== 'string') return sql;

  let transformed = sql;

  // 1. Convert sqlite_master checks to information_schema.tables
  if (transformed.toLowerCase().includes('sqlite_master')) {
    transformed = transformed.replace(/FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*'table'/gi, 
      `FROM information_schema.tables WHERE table_schema = 'public' OR table_schema = 'company_${companyId}'`);
    transformed = transformed.replace(/SELECT\s+name\s+FROM/gi, 'SELECT table_name AS name FROM');
    transformed = transformed.replace(/SELECT\s+sql\s+FROM/gi, "SELECT '' AS sql FROM");
  }

  // 2. Convert INSERT OR IGNORE to INSERT ... ON CONFLICT DO NOTHING
  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(transformed)) {
    transformed = transformed.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(transformed)) {
      transformed = `${transformed.trim()} ON CONFLICT DO NOTHING`;
    }
  }

  // 3. Convert INSERT OR REPLACE to standard INSERT ON CONFLICT DO NOTHING or UPDATE
  if (/INSERT\s+OR\s+REPLACE\s+INTO/i.test(transformed)) {
    transformed = transformed.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(transformed)) {
      transformed = `${transformed.trim()} ON CONFLICT DO NOTHING`;
    }
  }

  // 4. Translate SQLite type keywords in CREATE TABLE statements
  transformed = transformed.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
  transformed = transformed.replace(/DATETIME\s+DEFAULT\s+CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  transformed = transformed.replace(/DATETIME/gi, 'TIMESTAMP');

  // 5. If INSERT statement without RETURNING clause, append RETURNING id
  const trimmed = transformed.trim();
  if (/^INSERT\s+INTO/i.test(trimmed) && !/RETURNING/i.test(trimmed)) {
    // Check if table likely has an id column
    if (!trimmed.endsWith(';')) {
      transformed = `${transformed} RETURNING id`;
    } else {
      transformed = `${transformed.slice(0, -1)} RETURNING id;`;
    }
  }

  // 6. Convert ? parameter placeholders to $1, $2, $3...
  let paramIndex = 1;
  transformed = transformed.replace(/\?/g, () => `$${paramIndex++}`);

  return transformed;
}

// ============================================================================
// SQLITE IMPLEMENTATION DETAILS
// ============================================================================
function openMasterDatabase() {
  if (masterDb) return masterDb;

  masterDb = new sqlite3.Database(masterDbPath, (err) => {
    if (err) {
      console.error('❌ Error opening master SQLite database:', err.message);
    } else {
      console.log('✅ Connected to Master SQLite database at:', masterDbPath);
    }
  });

  masterDb.serialize(() => {
    masterDb.run('PRAGMA foreign_keys = ON');
    masterDb.run('PRAGMA journal_mode = WAL');
    masterDb.run('PRAGMA synchronous = NORMAL');
    masterDb.run('PRAGMA busy_timeout = 10000');

    for (const tbl of MASTER_TABLES) {
      masterDb.run(tbl.sql);
    }
  });

  return masterDb;
}

if (!isPostgres) {
  openMasterDatabase();
}

function getCompanyDbPath(companyId = 1) {
  const cId = normalizeCompanyId(companyId);
  if (cId === 1) {
    if (fs.existsSync(legacyDbPath)) {
      return legacyDbPath;
    }
    return path.join(dbDir, 'company_1.db');
  }
  return path.join(dbDir, `company_${cId}.db`);
}

function getCompanyDatabaseInstance(companyId = 1) {
  const cId = normalizeCompanyId(companyId);
  if (companyDbPool.has(cId)) {
    return companyDbPool.get(cId);
  }

  const filePath = getCompanyDbPath(cId);
  const instance = new sqlite3.Database(filePath, (err) => {
    if (err) {
      console.error(`❌ Error opening Company ${cId} database at ${filePath}:`, err.message);
    }
  });

  instance.serialize(() => {
    instance.run('PRAGMA foreign_keys = ON');
    instance.run('PRAGMA journal_mode = WAL');
    instance.run('PRAGMA synchronous = NORMAL');
    instance.run('PRAGMA busy_timeout = 10000');
  });

  companyDbPool.set(cId, instance);
  return instance;
}

function resolveTargetDatabase(sql, explicitCompanyId = null) {
  if (isMasterTableQuery(sql)) {
    return openMasterDatabase();
  }
  if (explicitCompanyId) {
    return getCompanyDatabaseInstance(normalizeCompanyId(explicitCompanyId));
  }
  const store = asyncLocalStorage.getStore();
  const contextCompanyId = store ? normalizeCompanyId(store.companyId) : 1;
  return getCompanyDatabaseInstance(contextCompanyId);
}

// ============================================================================
// POSTGRESQL MULTI-TENANT QUERY RUNNER
// ============================================================================
async function executePgQuery(sql, params = [], companyId = 1, isMaster = false) {
  if (!pgPool) {
    throw new Error('PostgreSQL pool not initialized. Please verify DATABASE_URL.');
  }

  const client = await pgPool.connect();
  try {
    const cId = normalizeCompanyId(companyId);
    const schemaName = isMaster ? 'public' : `company_${cId}`;

    // Schemas are provisioned by migrations/company creation, never implicitly
    // by an arbitrary request. The company id is parsed before it is an SQL
    // identifier, so request input cannot change search_path.
    if (!isMaster) {
      await client.query(`SET search_path TO ${schemaName}, public;`);
    } else {
      await client.query(`SET search_path TO public;`);
    }

    const transformedSql = translateSqlForPostgres(sql, cId);
    const result = await client.query(transformedSql, params);

    // Normalize result object for compatibility
    let lastID = null;
    if (result.rows && result.rows.length > 0 && result.rows[0].id !== undefined) {
      lastID = result.rows[0].id;
    }

    return {
      rows: result.rows || [],
      rowCount: result.rowCount || 0,
      changes: result.rowCount || 0,
      lastID: lastID,
      lastInsertRowid: lastID,
    };
  } catch (err) {
    // Never hide a database error as an empty result: that can make an ERP
    // screen appear to have saved business data when it did not.
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// SQLITE EXECUTION HELPERS
// ============================================================================
function queryOnSqlite(dbInst, text, params = []) {
  return new Promise((resolve, reject) => {
    dbInst.all(text, params, (err, rows) => {
      if (err) reject(err);
      else resolve({ rows: rows || [] });
    });
  });
}

function runOnSqlite(dbInst, text, params = []) {
  return new Promise((resolve, reject) => {
    dbInst.run(text, params, function (err) {
      if (err) reject(err);
      else {
        resolve({
          lastID: this.lastID,
          lastInsertRowid: this.lastID,
          changes: this.changes,
        });
      }
    });
  });
}

// ============================================================================
// CREATE NEW COMPANY DATABASE / SCHEMA (Zero-Error Automatic Provisioning)
// ============================================================================
async function createCompanyDatabase(companyId, companyCode) {
  const cId = normalizeCompanyId(companyId);

  console.log(`🏗️ [Database] Creating isolated tenant environment for Company ${cId} (${companyCode})...`);

  if (isPostgres) {
    // PostgreSQL Multi-Tenant Provisioning
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const schemaName = `company_${cId}`;
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
      await client.query(`SET search_path TO ${schemaName}, public`);

      // 1. Create all ERP tables
      for (const tableSql of COMPANY_TABLES) {
        const pgSql = translateSqlForPostgres(tableSql, cId);
        await client.query(pgSql);
      }

      // 2. Seed Default Ledgers
      for (const led of DEFAULT_LEDGER_CHART) {
        await client.query(
          `INSERT INTO ledgermaster (name, printname, under, ledger_type, openingbalance, status) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           ON CONFLICT DO NOTHING`,
          [led.name, led.printname, led.under, led.ledger_type, led.openingbalance, 'Active']
        );
      }

      // 3. Seed Default Tax Rates
      for (const tax of DEFAULT_TAX_RATES) {
        await client.query(
          `INSERT INTO tax_master (tax_name, hsn_code, gst_rate, cgst_rate, sgst_rate, igst_rate, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           ON CONFLICT DO NOTHING`,
          [tax.tax_name, '9999', tax.tax_percent, tax.cgst, tax.sgst, tax.igst, 'Active']
        );
      }

      // 4. Seed Current Financial Year
      const now = new Date();
      const currentYear = now.getFullYear();
      const nextYear = currentYear + 1;
      const fyString = `${currentYear}-${nextYear}`;
      await client.query(
        `INSERT INTO financial_years (company_id, financial_year, start_date, end_date, is_active, is_current, is_locked) 
         VALUES ($1, $2, $3, $4, 1, 1, 0) 
         ON CONFLICT DO NOTHING`,
        [cId, fyString, `${currentYear}-04-01`, `${nextYear}-03-31`]
      );

      // 5. Register in Master Database Registry
      await client.query(`SET search_path TO public`);
      await client.query(
        `INSERT INTO database_registry (company_id, db_type, db_name, db_schema, status) 
         VALUES ($1, 'postgres', $2, $3, 'Active') 
         ON CONFLICT (company_id) DO UPDATE SET last_migrated_at = CURRENT_TIMESTAMP`,
        [cId, `company_${cId}`, schemaName]
      );

      await client.query('COMMIT');
      console.log(`🎉 [PostgreSQL] Company ${cId} schema '${schemaName}' fully provisioned with clean ERP tables!`);
      return { success: true, companyId: cId, schema: schemaName };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ [PostgreSQL] Error creating company ${cId} schema:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  } else {
    // SQLite Multi-Tenant Provisioning
    const compDb = getCompanyDatabaseInstance(cId);
    return new Promise((resolve, reject) => {
      compDb.serialize(async () => {
        try {
          for (const tableSql of COMPANY_TABLES) {
            await new Promise((res, rej) => compDb.run(tableSql, (err) => err ? rej(err) : res()));
          }

          for (const led of DEFAULT_LEDGER_CHART) {
            await new Promise((res) => {
              compDb.run(
                `INSERT OR IGNORE INTO ledgermaster (name, printname, under, ledger_type, openingbalance, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [led.name, led.printname, led.under, led.ledger_type, led.openingbalance, 'Active'],
                () => res()
              );
            });
          }

          for (const tax of DEFAULT_TAX_RATES) {
            await new Promise((res) => {
              compDb.run(
                `INSERT OR IGNORE INTO tax_master (tax_name, tax_percent, cgst, sgst, igst, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [tax.tax_name, tax.tax_percent, tax.cgst, tax.sgst, tax.igst, 'Active'],
                () => res()
              );
            });
          }

          const now = new Date();
          const currentYear = now.getFullYear();
          const nextYear = currentYear + 1;
          const fyString = `${currentYear}-${nextYear}`;
          await new Promise((res) => {
            compDb.run(
              `INSERT OR IGNORE INTO financial_years (company_id, financial_year, start_date, end_date, is_active, is_locked) VALUES (?, ?, ?, ?, ?, ?)`,
              [cId, fyString, `${currentYear}-04-01`, `${nextYear}-03-31`, 1, 0],
              () => res()
            );
          });

          const master = openMasterDatabase();
          await new Promise((res) => {
            master.run(
              `INSERT OR REPLACE INTO database_registry (company_id, db_type, db_name, status) VALUES (?, ?, ?, ?)`,
              [cId, 'sqlite', `company_${cId}.db`, 'Active'],
              () => res()
            );
          });

          console.log(`🎉 [SQLite] Company ${cId} database created and initialized!`);
          resolve({ success: true, companyId: cId, dbName: `company_${cId}.db` });
        } catch (err) {
          console.error(`❌ [SQLite] Error creating Company ${cId} database:`, err.message);
          reject(err);
        }
      });
    });
  }
}

// ============================================================================
// RESTORE DATABASE FUNCTIONALITY (SQLite & PostgreSQL)
// ============================================================================
async function restoreDatabase(tempFilePath, companyId = 1) {
  const cId = normalizeCompanyId(companyId);
  if (!fs.existsSync(tempFilePath)) {
    throw new Error('Uploaded backup file does not exist.');
  }

  const backupDir = path.join(dbDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  if (isPostgres) {
    // SQLite files and PostgreSQL backups are deliberately incompatible. An
    // HTTP upload must never synchronize or truncate the Neon database.
    throw new Error('SQLite restore is available only when DB_ENGINE=sqlite. PostgreSQL restore is an explicit administrator operation.');
    /*
    const client = await pgPool.connect();
    try {
      const tempDb = new sqlite3.Database(tempFilePath, sqlite3.OPEN_READONLY);
      const tables = await new Promise((resolve) => {
        tempDb.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
          if (err) resolve([]);
          else resolve((rows || []).map((r) => r.name));
        });
      });

      const schemaName = `company_${cId}`;
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName};`);
      await client.query(`SET search_path TO ${schemaName}, public;`);

      for (const table of tables) {
        if (table === 'users' || table === 'companies') continue;
        const rows = await new Promise((resolve) => {
          tempDb.all(`SELECT * FROM ${table}`, (err, rows) => {
            if (err) resolve([]);
            else resolve(rows || []);
          });
        });

        if (rows && rows.length > 0) {
          try {
            await client.query(`TRUNCATE TABLE ${schemaName}.${table} CASCADE;`);
          } catch (e) {}

          for (const row of rows) {
            const keys = Object.keys(row);
            const values = Object.values(row);
            const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
            const colList = keys.join(', ');
            try {
              await client.query(
                `INSERT INTO ${schemaName}.${table} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                values
              );
            } catch (err) {}
          }
        }
      }
      tempDb.close();
      console.log(`✅ [PostgreSQL] Restored company_${cId} schema from backup file successfully!`);
      return { success: true, message: 'Database restored successfully into PostgreSQL schema.' };
    } finally {
      client.release();
    }
    */
  } else {
    // In SQLite mode:
    // 1. If an active connection exists in companyDbPool, close it and evict from cache
    if (companyDbPool.has(cId)) {
      const oldInstance = companyDbPool.get(cId);
      try {
        await new Promise((res) => oldInstance.close(() => res()));
      } catch (e) {
        console.warn(`Warning closing company ${cId} db connection before restore:`, e.message);
      }
      companyDbPool.delete(cId);
    }

    const targetDbPath = getCompanyDbPath(cId);

    // 2. Backup current target db if it exists
    if (fs.existsSync(targetDbPath)) {
      const backupPath = path.join(backupDir, `backup_before_restore_${cId}_${Date.now()}.db`);
      try {
        fs.copyFileSync(targetDbPath, backupPath);
        console.log(`📦 Created backup before restore at: ${backupPath}`);
      } catch (e) {
        console.warn('Warning creating pre-restore backup:', e.message);
      }
      try {
        if (fs.existsSync(`${targetDbPath}-wal`)) fs.unlinkSync(`${targetDbPath}-wal`);
        if (fs.existsSync(`${targetDbPath}-shm`)) fs.unlinkSync(`${targetDbPath}-shm`);
      } catch (e) {}
    }

    // 3. Copy uploaded file over targetDbPath
    fs.copyFileSync(tempFilePath, targetDbPath);

    // 4. Verify integrity of the restored SQLite DB
    const restoredDb = new sqlite3.Database(targetDbPath, (err) => {
      if (err) {
        throw new Error(`Failed to open restored database: ${err.message}`);
      }
    });

    await new Promise((resolve, reject) => {
      restoredDb.get('PRAGMA integrity_check', (err, row) => {
        if (err) {
          reject(new Error(`Integrity check failed: ${err.message}`));
        } else if (row && row.integrity_check !== 'ok') {
          console.warn('Restored DB integrity warning:', row.integrity_check);
          resolve();
        } else {
          resolve();
        }
      });
    });

    // 5. Configure WAL mode and store in companyDbPool
    await new Promise((resolve) => {
      restoredDb.serialize(() => {
        restoredDb.run('PRAGMA foreign_keys = ON');
        restoredDb.run('PRAGMA journal_mode = WAL');
        restoredDb.run('PRAGMA synchronous = NORMAL');
        restoredDb.run('PRAGMA busy_timeout = 10000', () => resolve());
      });
    });

    companyDbPool.set(cId, restoredDb);
    console.log(`✅ Company ${cId} database restored successfully from ${tempFilePath}!`);
    return { success: true, message: 'Database restored successfully!' };
  }
}

// ============================================================================
// TRANSACTION AWARE CONNECTION WRAPPERS
// ============================================================================
class PgDbConnection {
  constructor(client, companyId = 1, isMaster = false) {
    this.client = client;
    this.companyId = companyId;
    this.isMaster = isMaster;
  }

  async beginTransaction() {
    const schemaName = this.isMaster ? 'public' : `company_${this.companyId}`;
    if (!this.isMaster) {
      await this.client.query(`SET search_path TO ${schemaName}, public;`);
    } else {
      await this.client.query(`SET search_path TO public;`);
    }
    await this.client.query('BEGIN');
  }

  async commit() {
    await this.client.query('COMMIT');
  }

  async rollback() {
    await this.client.query('ROLLBACK');
  }

  async query(text, params = []) {
    const transformed = translateSqlForPostgres(text, this.companyId);
    const result = await this.client.query(transformed, params);
    let lastID = null;
    if (result.rows && result.rows.length > 0 && result.rows[0].id !== undefined) {
      lastID = result.rows[0].id;
    }
    return {
      rows: result.rows || [],
      rowCount: result.rowCount || 0,
      changes: result.rowCount || 0,
      lastID: lastID,
      lastInsertRowid: lastID,
    };
  }

  async run(text, params = []) {
    return this.query(text, params);
  }

  release() {
    if (this.client) {
      this.client.release();
    }
  }
}

class SqliteDbConnection {
  constructor(dbInstance, companyId = null) {
    this.db = dbInstance;
    this.companyId = companyId;
  }

  beginTransaction() {
    return new Promise((resolve, reject) => {
      this.db.run('BEGIN TRANSACTION', (err) => (err ? reject(err) : resolve()));
    });
  }

  commit() {
    return new Promise((resolve, reject) => {
      this.db.run('COMMIT', (err) => (err ? reject(err) : resolve()));
    });
  }

  rollback() {
    return new Promise((resolve, reject) => {
      this.db.run('ROLLBACK', (err) => (err ? reject(err) : resolve()));
    });
  }

  query(text, params = []) {
    return queryOnSqlite(this.db, text, params);
  }

  run(text, params = []) {
    return runOnSqlite(this.db, text, params);
  }

  release() {
    // No-op for SQLite
  }
}

// ============================================================================
// MODULE EXPORTS (Unified Dual-Engine API)
// ============================================================================
module.exports = {
  engine: DB_ENGINE,
  isPostgres,
  asyncLocalStorage,
  companyStorage: asyncLocalStorage,
  getDbPath: (companyId = 1) => getCompanyDbPath(companyId),
  getMasterDbPath: () => masterDbPath,
  createCompanyDatabase,
  restoreDatabase,

  // Primary Query function (routes automatically based on context & SQL)
  query: async (text, params = [], explicitCompanyId = null) => {
    const store = asyncLocalStorage.getStore();
    const activeCompanyId = explicitCompanyId || (store ? store.companyId : 1);
    const isMaster = isMasterTableQuery(text);

    if (isPostgres) {
      return executePgQuery(text, params, activeCompanyId, isMaster);
    } else {
      const targetDb = resolveTargetDatabase(text, explicitCompanyId);
      return queryOnSqlite(targetDb, text, params);
    }
  },

  // Primary Run function
  run: async (text, params = [], explicitCompanyId = null) => {
    const store = asyncLocalStorage.getStore();
    const activeCompanyId = explicitCompanyId || (store ? store.companyId : 1);
    const isMaster = isMasterTableQuery(text);

    if (isPostgres) {
      return executePgQuery(text, params, activeCompanyId, isMaster);
    } else {
      const targetDb = resolveTargetDatabase(text, explicitCompanyId);
      return runOnSqlite(targetDb, text, params);
    }
  },

  // Explicit Company DB accessor
  forCompany: (companyId) => {
    const cId = normalizeCompanyId(companyId);
    return {
      query: (text, params = []) => {
        if (isPostgres) return executePgQuery(text, params, cId, false);
        return queryOnSqlite(getCompanyDatabaseInstance(cId), text, params);
      },
      run: (text, params = []) => {
        if (isPostgres) return executePgQuery(text, params, cId, false);
        return runOnSqlite(getCompanyDatabaseInstance(cId), text, params);
      },
      getConnection: async () => {
        if (isPostgres) {
          const client = await pgPool.connect();
          return new PgDbConnection(client, cId, false);
        }
        return new SqliteDbConnection(getCompanyDatabaseInstance(cId), cId);
      },
    };
  },

  // Explicit Master DB accessor
  master: {
    query: (text, params = []) => {
      if (isPostgres) return executePgQuery(text, params, 1, true);
      return queryOnSqlite(openMasterDatabase(), text, params);
    },
    run: (text, params = []) => {
      if (isPostgres) return executePgQuery(text, params, 1, true);
      return runOnSqlite(openMasterDatabase(), text, params);
    },
    getConnection: async () => {
      if (isPostgres) {
        const client = await pgPool.connect();
        return new PgDbConnection(client, 1, true);
      }
      return new SqliteDbConnection(openMasterDatabase(), null);
    },
  },

  // Connection getters for transaction operations
  getConnection: async (explicitCompanyId = null) => {
    const store = asyncLocalStorage.getStore();
    const activeCompanyId = explicitCompanyId || (store ? store.companyId : 1);
    if (isPostgres) {
      const client = await pgPool.connect();
      return new PgDbConnection(client, activeCompanyId, false);
    }
    const targetDb = explicitCompanyId ? getCompanyDatabaseInstance(explicitCompanyId) : resolveTargetDatabase('', null);
    return new SqliteDbConnection(targetDb, activeCompanyId);
  },

  pool: {
    connect: async (explicitCompanyId = null) => {
      const store = asyncLocalStorage.getStore();
      const activeCompanyId = explicitCompanyId || (store ? store.companyId : 1);
      if (isPostgres) {
        const client = await pgPool.connect();
        return new PgDbConnection(client, activeCompanyId, false);
      }
      const targetDb = explicitCompanyId ? getCompanyDatabaseInstance(explicitCompanyId) : resolveTargetDatabase('', null);
      return new SqliteDbConnection(targetDb, activeCompanyId);
    },
  },
};
