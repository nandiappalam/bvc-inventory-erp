const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');
const { MASTER_TABLES, MASTER_TABLE_NAMES } = require('../database/masterSchema');
const { COMPANY_TABLES, DEFAULT_LEDGER_CHART, DEFAULT_TAX_RATES } = require('../database/companySchema');
const { orderTablesByDependencies } = require('../utils/schemaOrderer');

// Context storage for multi-tenant requests
const asyncLocalStorage = new AsyncLocalStorage();

// Check if PostgreSQL (Neon / Supabase / RDS / Render Postgres) is configured
const isPostgres = process.env.DB_ENGINE === 'postgres' || (!!process.env.DATABASE_URL && process.env.DB_ENGINE !== 'sqlite');

// ============================================================================
// MODE 1 vs MODE 2 ARCHITECTURAL ISOLATION
// Mode 1: Tauri / Desktop Local Development -> SQLite ONLY
// Mode 2: Render Production / Cloud -> Neon PostgreSQL ONLY (NON-SYNCED, NON-LINKED)
// ============================================================================
let dbDir = null;
let masterDbPath = null;
const companyDbPool = new Map();
let masterDb = null;
let pgPool = null;

if (isPostgres) {
  // MODE 2: Render / Cloud - Neon PostgreSQL ONLY
  console.log('================================================================');
  console.log('🚀 [BVC ERP MODE 2: RENDER / CLOUD]');
  console.log('🔹 Database Engine: Neon PostgreSQL ONLY');
  console.log('🔹 SQLite Files: DISABLED');
  console.log('🔹 Local SQLite Fallback: DISABLED');
  console.log('🔹 Cloud-Desktop Sync: STRICTLY NON-SYNCED & NON-LINKED');
  console.log('================================================================');

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
    console.error('⚠️ [PostgreSQL Pool] Error on idle client:', err.message);
  });
} else {
  // MODE 1: Tauri / Desktop Local - SQLite ONLY
  console.log('================================================================');
  console.log('📦 [BVC ERP MODE 1: TAURI / LOCAL DEVELOPMENT]');
  console.log('🔹 Database Engine: SQLite ONLY (Local Multi-Tenant)');
  console.log('🔹 Storage: Local Filesystem (/database/*.db)');
  console.log('🔹 Neon PostgreSQL: DISABLED');
  console.log('🔹 Cloud Sync: STRICTLY NON-SYNCED & NON-LINKED');
  console.log('================================================================');

  dbDir = path.join(__dirname, '../../database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  masterDbPath = path.join(dbDir, 'master.db');
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
// PAREN-AWARE SQL EXPRESSION REPLACERS
// ============================================================================
function replaceGroupConcat(sql) {
  const marker = 'GROUP_CONCAT';
  let result = '';
  let i = 0;
  while (i < sql.length) {
    const idx = sql.toUpperCase().indexOf(marker, i);
    if (idx === -1) {
      result += sql.slice(i);
      break;
    }
    if (idx > 0 && /[a-zA-Z0-9_]/.test(sql[idx - 1])) {
      result += sql.slice(i, idx + marker.length);
      i = idx + marker.length;
      continue;
    }
    result += sql.slice(i, idx);
    let cur = idx + marker.length;
    while (cur < sql.length && /\s/.test(sql[cur])) cur++;
    if (sql[cur] !== '(') {
      result += marker;
      i = idx + marker.length;
      continue;
    }
    cur++;
    let depth = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let args = [];
    let curArg = '';

    while (cur < sql.length && depth > 0) {
      const char = sql[cur];
      if (char === "'" && !inDoubleQuote) {
        if (inSingleQuote && sql[cur + 1] === "'") {
          curArg += "''";
          cur += 2;
          continue;
        }
        inSingleQuote = !inSingleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '(') {
          depth++;
          curArg += char;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            args.push(curArg.trim());
            curArg = '';
          } else {
            curArg += char;
          }
        } else if (char === ',' && depth === 1) {
          args.push(curArg.trim());
          curArg = '';
        } else {
          curArg += char;
        }
      } else {
        curArg += char;
      }
      cur++;
    }

    if (depth !== 0 || args.length === 0) {
      result += marker;
      i = idx + marker.length;
      continue;
    }

    let expr = args[0] || '';
    let delimiter = args[1] || "', '";
    let isDistinct = false;
    if (/^DISTINCT\s+/i.test(expr)) {
      isDistinct = true;
      expr = expr.replace(/^DISTINCT\s+/i, '').trim();
    }

    result += `STRING_AGG(${isDistinct ? 'DISTINCT ' : ''}(${expr})::text, ${delimiter})`;
    i = cur;
  }
  return result;
}

function replaceStrftime(sql) {
  const marker = 'STRFTIME';
  let result = '';
  let i = 0;
  while (i < sql.length) {
    const idx = sql.toUpperCase().indexOf(marker, i);
    if (idx === -1) {
      result += sql.slice(i);
      break;
    }
    if (idx > 0 && /[a-zA-Z0-9_]/.test(sql[idx - 1])) {
      result += sql.slice(i, idx + marker.length);
      i = idx + marker.length;
      continue;
    }
    result += sql.slice(i, idx);
    let cur = idx + marker.length;
    while (cur < sql.length && /\s/.test(sql[cur])) cur++;
    if (sql[cur] !== '(') {
      result += marker;
      i = idx + marker.length;
      continue;
    }
    cur++;
    let depth = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let args = [];
    let curArg = '';

    while (cur < sql.length && depth > 0) {
      const char = sql[cur];
      if (char === "'" && !inDoubleQuote) {
        if (inSingleQuote && sql[cur + 1] === "'") {
          curArg += "''";
          cur += 2;
          continue;
        }
        inSingleQuote = !inSingleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        curArg += char;
        cur++;
        continue;
      }
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '(') {
          depth++;
          curArg += char;
        } else if (char === ')') {
          depth--;
          if (depth === 0) {
            args.push(curArg.trim());
            curArg = '';
          } else {
            curArg += char;
          }
        } else if (char === ',' && depth === 1) {
          args.push(curArg.trim());
          curArg = '';
        } else {
          curArg += char;
        }
      } else {
        curArg += char;
      }
      cur++;
    }

    if (depth !== 0 || args.length < 2) {
      result += marker;
      i = idx + marker.length;
      continue;
    }

    const fmt = args[0].replace(/['"]/g, '').trim();
    const colExpr = args[1].trim();

    if (fmt === '%Y-%m') {
      result += `SUBSTRING((${colExpr})::text FROM 1 FOR 7)`;
    } else if (fmt === '%Y') {
      result += `SUBSTRING((${colExpr})::text FROM 1 FOR 4)`;
    } else if (fmt === '%m') {
      result += `SUBSTRING((${colExpr})::text FROM 6 FOR 2)`;
    } else if (fmt === '%d') {
      result += `SUBSTRING((${colExpr})::text FROM 9 FOR 2)`;
    } else if (fmt === '%Y-%m-%d') {
      result += `SUBSTRING((${colExpr})::text FROM 1 FOR 10)`;
    } else {
      result += `SUBSTRING((${colExpr})::text FROM 1 FOR 10)`;
    }
    i = cur;
  }
  return result;
}

// ============================================================================
// SQL NORMALIZER & TRANSLATOR (SQLite <-> PostgreSQL)
// ============================================================================
function translateSqlForPostgres(sql, companyId = 1) {
  if (!sql || typeof sql !== 'string') return sql;

  let transformed = sql.trim();

  // 0. Handle PRAGMA commands for PostgreSQL
  const pragmaMatch = transformed.match(/^PRAGMA\s+table_info\s*\(\s*([^\)]+)\s*\)/i);
  if (pragmaMatch) {
    const rawTableName = pragmaMatch[1].trim().replace(/['"`]/g, '');
    return `SELECT column_name AS name, data_type AS type, (CASE WHEN is_nullable = 'NO' THEN 1 ELSE 0 END) AS notnull, column_default AS dflt_value 
            FROM information_schema.columns 
            WHERE lower(table_name) = lower('${rawTableName}') 
              AND (table_schema = 'company_${companyId}' OR table_schema = 'public')`;
  }

  const pragmaIndexMatch = transformed.match(/^PRAGMA\s+index_list\s*\(\s*([^\)]+)\s*\)/i);
  if (pragmaIndexMatch) {
    const rawTableName = pragmaIndexMatch[1].trim().replace(/['"`]/g, '');
    return `SELECT indexname AS name FROM pg_indexes WHERE lower(tablename) = lower('${rawTableName}')`;
  }

  if (/^PRAGMA\s+/i.test(transformed)) {
    // Non-applicable SQLite pragmas become safe no-ops
    return 'SELECT 1 AS pragma_result';
  }

  // 1. Convert sqlite_master queries safely with virtual table subquery
  if (/\bsqlite_master\b/i.test(transformed)) {
    const virtualMaster = `(
      SELECT tablename AS name, tablename AS table_name, 'table' AS type, tablename AS tbl_name, '' AS sql 
      FROM pg_tables 
      WHERE schemaname IN ('public', 'company_${companyId}')
      UNION ALL
      SELECT indexname AS name, indexname AS table_name, 'index' AS type, tablename AS tbl_name, '' AS sql
      FROM pg_indexes
      WHERE schemaname IN ('public', 'company_${companyId}')
    ) AS sqlite_master`;
    transformed = transformed.replace(/\bsqlite_master\b/gi, virtualMaster);
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

  // 4b. Translate SQLite SQL functions for PostgreSQL using paren-matching parsers
  transformed = replaceGroupConcat(transformed);
  transformed = replaceStrftime(transformed);

  transformed = transformed.replace(/DATE\s*\(\s*['"]now['"]\s*\)/gi, 'CURRENT_DATE');
  transformed = transformed.replace(/DATETIME\s*\(\s*['"]now['"]\s*(?:,\s*['"][^'"]*['"])?\s*\)/gi, 'CURRENT_TIMESTAMP');
  transformed = transformed.replace(/IFNULL\s*\(/gi, 'COALESCE(');
  transformed = transformed.replace(/ROUND\s*\(\s*([^,]+?)\s*,\s*(\d+)\s*\)/gi, 'ROUND(($1)::numeric, $2)');

  // 4c. Prevent empty IN () / NOT IN () syntax errors
  transformed = transformed.replace(/\bIN\s*\(\s*\)/gi, 'IN (NULL)');
  transformed = transformed.replace(/\bNOT\s+IN\s*\(\s*\)/gi, 'NOT IN (NULL)');

  // 4d. Ensure ADD COLUMN uses IF NOT EXISTS for PostgreSQL
  transformed = transformed.replace(/ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\b)(\w+)/gi, 'ADD COLUMN IF NOT EXISTS $1');

  // 4e. Translate SQLite GLOB operator to PostgreSQL regex / LIKE
  transformed = transformed.replace(/\bGLOB\s+'\[0-9\]\*'/gi, "~ '^[0-9]'");
  transformed = transformed.replace(/\bGLOB\s+'([^']+)'/gi, (match, pattern) => {
    if (pattern.includes('[') || pattern.includes('?')) {
      const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
      return `~ '^${regexPattern}'`;
    }
    const likePattern = pattern.replace(/\*/g, '%').replace(/\?/g, '_');
    return `LIKE '${likePattern}'`;
  });

  // 4f. Fix double-quoted default string literals: DEFAULT "value" -> DEFAULT 'value'
  transformed = transformed.replace(/DEFAULT\s+"([^"]+)"/gi, "DEFAULT '$1'");

  // 4g. Handle reserved keyword current_date when used as column definition or assignment
  transformed = transformed.replace(/\bcurrent_date\s+TEXT\b/gi, '"current_date" TEXT');
  transformed = transformed.replace(/,\s*current_date\s*,/gi, ', "current_date",');
  transformed = transformed.replace(/\bcurrent_date\s*=\s*excluded\.current_date\b/gi, '"current_date" = excluded."current_date"');
  transformed = transformed.replace(/\bcurrent_date\s*=\s*\?/gi, '"current_date" = ?');

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
    masterDb.run('PRAGMA busy_timeout = 30000');

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
  if (isPostgres || !dbDir) return null;
  const cId = parseInt(companyId, 10) || 1;
  return path.join(dbDir, `company_${cId}.db`);
}

function getCompanyDatabaseInstance(companyId = 1) {
  const cId = parseInt(companyId, 10) || 1;
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
    instance.run('PRAGMA busy_timeout = 30000');

    // Ensure company tables exist
    for (const tableSql of COMPANY_TABLES) {
      instance.run(tableSql, () => {});
    }

    // Ensure crucial purchase columns exist on this company database
    const extraCols = [
      'ALTER TABLE purchases ADD COLUMN transporter TEXT',
      'ALTER TABLE purchases ADD COLUMN transport TEXT',
      'ALTER TABLE purchases ADD COLUMN vehicle_no TEXT',
      'ALTER TABLE purchases ADD COLUMN lorry_no TEXT',
      'ALTER TABLE purchases ADD COLUMN driver_name TEXT',
      'ALTER TABLE purchases ADD COLUMN driver TEXT',
      'ALTER TABLE purchases ADD COLUMN purchase_order_id INTEGER',
      'ALTER TABLE purchases ADD COLUMN po_no TEXT',
      'ALTER TABLE purchases ADD COLUMN source_order_id INTEGER',
      'ALTER TABLE purchases ADD COLUMN source_order_no TEXT',
      'ALTER TABLE purchases ADD COLUMN tax_percent REAL DEFAULT 0',
      'ALTER TABLE purchases ADD COLUMN deduction_amount REAL DEFAULT 0',
      'ALTER TABLE purchase_items ADD COLUMN item_id INTEGER',
      'ALTER TABLE purchase_items ADD COLUMN per_unit_weight REAL DEFAULT 0',
      'ALTER TABLE purchase_items ADD COLUMN total_weight REAL DEFAULT 0',
      'ALTER TABLE purchase_items ADD COLUMN disc_amount REAL DEFAULT 0',
      'ALTER TABLE purchase_items ADD COLUMN tax_amount REAL DEFAULT 0'
    ];
    for (const sql of extraCols) {
      instance.run(sql, () => {});
    }
  });

  companyDbPool.set(cId, instance);
  return instance;
}

function resolveTargetDatabase(sql, explicitCompanyId = null) {
  if (isMasterTableQuery(sql)) {
    return openMasterDatabase();
  }
  if (explicitCompanyId) {
    return getCompanyDatabaseInstance(explicitCompanyId);
  }
  const store = asyncLocalStorage.getStore();
  const contextCompanyId = store ? store.companyId : 1;
  return getCompanyDatabaseInstance(contextCompanyId);
}

// ============================================================================
// POSTGRESQL SEQUENCE RESYNCHRONIZATION
// ============================================================================
async function resyncPostgresSequences(clientOrPool, schemaName = null) {
  try {
    const q = clientOrPool.query ? clientOrPool : pgPool;
    if (!q) return;

    const sql = `
      SELECT 
        n.nspname AS schema_name,
        c.relname AS table_name,
        a.attname AS column_name,
        s.relname AS sequence_name
      FROM pg_class s
      JOIN pg_depend d ON d.objid = s.oid
      JOIN pg_class c ON d.refobjid = c.oid
      JOIN pg_attribute a ON (d.refobjid = a.attrelid AND d.refobjsubid = a.attnum)
      JOIN pg_namespace n ON n.oid = s.relnamespace
      WHERE s.relkind = 'S' AND c.relkind = 'r'
        ${schemaName ? 'AND n.nspname = $1' : "AND n.nspname IN ('public', 'company_1')"}
    `;
    const params = schemaName ? [schemaName] : [];
    const res = await q.query(sql, params);
    for (const row of (res.rows || [])) {
      try {
        await q.query(`
          SELECT setval(
            '"' || $1 || '"."' || $2 || '"', 
            COALESCE((SELECT MAX("${row.column_name}") FROM "${row.schema_name}"."${row.table_name}"), 0) + 1, 
            false
          )
        `, [row.schema_name, row.sequence_name]);
      } catch (e) {}
    }
  } catch (err) {
    console.warn('⚠️ [PostgreSQL] Sequence resync warning:', err.message);
  }
}

async function ensurePostgresCompanySequences(companyId = 1) {
  if (!isPostgres || !pgPool) return;
  const client = await pgPool.connect();
  try {
    const schemaName = `company_${parseInt(companyId, 10) || 1}`;
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    await client.query(`SET search_path TO ${schemaName}, public`);
    await resyncPostgresSequences(client, schemaName);
  } finally {
    client.release();
  }
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
    const cId = parseInt(companyId, 10) || 1;
    const schemaName = isMaster ? 'public' : `company_${cId}`;

    // Ensure schema exists and set search_path for isolation
    if (!isMaster) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName};`);
      await client.query(`SET search_path TO ${schemaName}, public;`);
    } else {
      await client.query(`SET search_path TO public;`);
    }

    let transformedSql = translateSqlForPostgres(sql, cId);
    let result;
    try {
      result = await client.query(transformedSql, params);
    } catch (queryErr) {
      if (queryErr.code === '42703' && /RETURNING id/i.test(transformedSql)) {
        const withoutReturning = transformedSql.replace(/\s+RETURNING\s+id\b/gi, '');
        result = await client.query(withoutReturning, params);
      } else if (queryErr.code === '23505' && /duplicate key value violates unique constraint/i.test(queryErr.message)) {
        await resyncPostgresSequences(client, schemaName);
        result = await client.query(transformedSql, params);
      } else {
        throw queryErr;
      }
    }

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
    // If table doesn't exist, log cleanly and handle gracefully
    if (err.code === '42P01') { // undefined_table
      console.warn(`[PostgreSQL] Table not yet created: ${err.message}. Returning empty result.`);
      return { rows: [], rowCount: 0, changes: 0, lastID: null, lastInsertRowid: null };
    }
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
  const cId = parseInt(companyId, 10);
  if (!cId) throw new Error('Invalid companyId for database creation');

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
      for (const tableSql of orderTablesByDependencies(COMPANY_TABLES)) {
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
          [tax.tax_name, tax.hsn_code || '0000', tax.gst_rate || 0, tax.cgst_rate || 0, tax.sgst_rate || 0, tax.igst_rate || 0, 'Active']
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
                `INSERT OR IGNORE INTO tax_master (tax_name, hsn_code, gst_rate, cgst_rate, sgst_rate, igst_rate, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [tax.tax_name, tax.hsn_code || '0000', tax.gst_rate || 0, tax.cgst_rate || 0, tax.sgst_rate || 0, tax.igst_rate || 0, 'Active'],
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
  const cId = parseInt(companyId, 10) || 1;
  if (!fs.existsSync(tempFilePath)) {
    throw new Error('Uploaded backup file does not exist.');
  }

  const backupDir = path.join(dbDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  if (isPostgres) {
    // In PostgreSQL mode: Restore tables from the uploaded SQLite backup file
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
// ENSURE POSTGRESQL MASTER SCHEMA
// ============================================================================
async function ensurePostgresMasterSchema() {
  if (!isPostgres || !pgPool) {
    return;
  }

  console.log('🔧 [PostgreSQL] Ensuring public master schema is up to date...');
  const client = await pgPool.connect();

  try {
    await client.query('SET search_path TO public');

    // Create master tables from authoritative schema
    for (const tbl of MASTER_TABLES) {
      const pgSql = translateSqlForPostgres(tbl.sql);
      await client.query(pgSql);
      console.log(`✓ Master table ready: ${tbl.name}`);
    }

    // Defensive column migrations for master tables
    await client.query(`
      ALTER TABLE public.companies
        ADD COLUMN IF NOT EXISTS code TEXT,
        ADD COLUMN IF NOT EXISTS database_name TEXT,
        ADD COLUMN IF NOT EXISTS database_schema TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active',
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS companies_code_unique_idx
      ON public.companies (code)
      WHERE code IS NOT NULL
    `);

    await client.query(`
      ALTER TABLE public.database_registry
        ADD COLUMN IF NOT EXISTS db_schema TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active',
        ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS last_migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await client.query(`
      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active',
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS phone TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    await resyncPostgresSequences(client);
    console.log('✓ PostgreSQL public master schema and sequences verified successfully');
  } catch (err) {
    console.error('⚠️ [PostgreSQL] Master schema check notice:', err.message);
  } finally {
    client.release();
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
      await this.client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName};`);
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
    let transformed = translateSqlForPostgres(text, this.companyId);
    const schemaName = this.isMaster ? 'public' : `company_${this.companyId}`;
    let result;
    try {
      result = await this.client.query(transformed, params);
    } catch (queryErr) {
      if (queryErr.code === '42703' && /RETURNING id/i.test(transformed)) {
        const withoutReturning = transformed.replace(/\s+RETURNING\s+id\b/gi, '');
        result = await this.client.query(withoutReturning, params);
      } else if (queryErr.code === '23505' && /duplicate key value violates unique constraint/i.test(queryErr.message)) {
        await resyncPostgresSequences(this.client, schemaName);
        result = await this.client.query(transformed, params);
      } else {
        throw queryErr;
      }
    }

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
  isPostgres,
  asyncLocalStorage,
  companyStorage: asyncLocalStorage,
  getDbPath: (companyId = 1) => getCompanyDbPath(companyId),
  getMasterDbPath: () => masterDbPath,
  createCompanyDatabase,
  restoreDatabase,
  ensurePostgresMasterSchema,
  ensurePostgresCompanySequences,

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
    const cId = parseInt(companyId, 10) || 1;
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
