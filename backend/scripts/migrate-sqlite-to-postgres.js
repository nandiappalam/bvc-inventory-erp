/**
 * Script: migrate-sqlite-to-postgres.js
 * Migrates existing SQLite databases (master.db, bvc.db, company_*.db) to Neon PostgreSQL
 */
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../database');
const masterDbPath = path.join(dbDir, 'master.db');
const legacyDbPath = path.join(dbDir, 'bvc.db');

function readSqliteRows(dbPath, sql, params = []) {
  return new Promise((resolve) => {
    if (!fs.existsSync(dbPath)) return resolve([]);
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve([]);
    });
    db.all(sql, params, (err, rows) => {
      db.close();
      if (err) resolve([]);
      else resolve(rows || []);
    });
  });
}

function getSqliteTableList(dbPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(dbPath)) return resolve([]);
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve([]);
    });
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, rows) => {
      db.close();
      if (err) resolve([]);
      else resolve((rows || []).map(r => r.name));
    });
  });
}

function getSqliteTableSchema(dbPath, tableName) {
  return new Promise((resolve) => {
    if (!fs.existsSync(dbPath)) return resolve([]);
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve([]);
    });
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      db.close();
      if (err) resolve([]);
      else resolve(rows || []);
    });
  });
}

function mapSqliteTypeToPg(sqliteType) {
  const t = String(sqliteType || '').trim().toUpperCase();
  if (!t) return 'TEXT';
  if (t.includes('INT')) return 'INTEGER';
  if (t.includes('REAL') || t.includes('NUM') || t.includes('DEC') || t.includes('FLOAT') || t.includes('DOUBLE')) {
    return 'NUMERIC(15, 2)';
  }
  if (t === 'DATE') return 'DATE';
  if (t.includes('TIME')) return 'TIMESTAMP';
  if (t.includes('BOOL')) return 'BOOLEAN';
  return 'TEXT';
}

function sanitizeMigrationValue(val, pgDataType, colName) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const lower = trimmed.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;

    if (pgDataType === 'date' || pgDataType.includes('timestamp')) {
      if (!trimmed) return null;
      const ddmmyyyy = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
      return trimmed;
    }

    if (pgDataType.includes('int') || pgDataType === 'numeric' || pgDataType === 'double precision' || pgDataType === 'real') {
      if (!trimmed) return null;
      if (colName === 'is_active') {
        if (lower === 'false' || lower === 'inactive' || lower === 'no' || lower === '0') return 0;
        if (lower === 'true' || lower === 'active' || lower === 'yes' || lower === '1') return 1;
      }
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : null;
    }

    if (pgDataType === 'boolean') {
      if (!trimmed) return null;
      return !(lower === '0' || lower === 'false' || lower === 'inactive' || lower === 'no');
    }
  }

  if (typeof val === 'boolean' && (pgDataType.includes('int') || pgDataType === 'numeric')) {
    return val ? 1 : 0;
  }

  return val;
}

async function syncMissingPgColumns(client, schemaName, tableName, sqlitePath) {
  const sqliteCols = await getSqliteTableSchema(sqlitePath, tableName);
  const pgColsRes = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
    [schemaName, tableName]
  );

  if (pgColsRes.rows.length === 0) return null;

  const pgTypeMap = {};
  for (const r of pgColsRes.rows) {
    pgTypeMap[r.column_name] = String(r.data_type || '').toLowerCase();
  }

  for (const col of sqliteCols) {
    const colName = col.name;
    if (!colName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(colName)) continue;
    if (!pgTypeMap[colName]) {
      const pgType = mapSqliteTypeToPg(col.type);
      try {
        await client.query(`ALTER TABLE "${schemaName}"."${tableName}" ADD COLUMN IF NOT EXISTS "${colName}" ${pgType}`);
        pgTypeMap[colName] = pgType.toLowerCase();
        console.log(`    + Added missing column ${schemaName}.${tableName}.${colName} (${pgType})`);
      } catch (alterErr) {
        console.warn(`    ⚠ Could not add column ${schemaName}.${tableName}.${colName}:`, alterErr.message);
      }
    }
  }

  return pgTypeMap;
}

async function resyncSchemaSequences(client, schemaName, tableNames) {
  for (const table of tableNames) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) continue;
    try {
      const seqRes = await client.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [`${schemaName}.${table}`]);
      const seqName = seqRes.rows[0]?.seq;
      if (seqName) {
        await client.query(`SELECT setval($1, COALESCE((SELECT MAX(id) FROM "${schemaName}"."${table}"), 1), true)`, [seqName]);
      }
    } catch (_) {
      // Table may not have an id serial column
    }
  }
}

async function migrateSqliteToPostgres() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  console.log('🚀 Starting SQLite -> Neon PostgreSQL Migration...');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    // 1. Initialize schema first
    const initPostgresSchema = require('./init-postgres-schema');
    await initPostgresSchema();

    // 2. Migrate Master DB tables
    console.log('\n📦 Migrating Master Data from master.db...');
    const masterTables = ['companies', 'users', 'roles', 'permissions', 'user_permissions', 'login_history'];

    for (const table of masterTables) {
      const pgTypeMap = await syncMissingPgColumns(client, 'public', table, masterDbPath);
      if (!pgTypeMap) continue;

      const rows = await readSqliteRows(masterDbPath, `SELECT * FROM ${table}`);
      if (rows.length > 0) {
        console.log(`  Migrating ${rows.length} rows for master table '${table}'...`);
        for (const row of rows) {
          const keys = Object.keys(row).filter(k => pgTypeMap[k] !== undefined);
          if (keys.length === 0) continue;
          const values = keys.map(k => sanitizeMigrationValue(row[k], pgTypeMap[k], k));
          const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
          const colList = keys.map(k => `"${k}"`).join(', ');

          try {
            await client.query(`
              INSERT INTO public."${table}" (${colList})
              VALUES (${placeholders})
              ON CONFLICT DO NOTHING
            `, values);
          } catch (e) {
            if (e.code !== '23505') {
              console.warn(`  ⚠ Skipped row in public.${table}:`, e.message);
            }
          }
        }
      }
    }
    await resyncSchemaSequences(client, 'public', masterTables);

    // 3. Migrate Company 1 tables from bvc.db or company_1.db
    const sourceCompanyDbPath = fs.existsSync(legacyDbPath) ? legacyDbPath : path.join(dbDir, 'company_1.db');
    console.log(`\n🏭 Migrating Company 1 Data from ${path.basename(sourceCompanyDbPath)}...`);

    const companyTables = await getSqliteTableList(sourceCompanyDbPath);
    await client.query('SET search_path TO company_1, public;');

    for (const table of companyTables) {
      if (table.startsWith('sqlite_') || table === 'users' || table === 'companies') continue;

      const pgTypeMap = await syncMissingPgColumns(client, 'company_1', table, sourceCompanyDbPath);
      if (!pgTypeMap) {
        console.warn(`  ⚠ Skipping '${table}' (no matching table in company_1 schema)`);
        continue;
      }

      const rows = await readSqliteRows(sourceCompanyDbPath, `SELECT * FROM ${table}`);
      if (rows.length > 0) {
        console.log(`  Migrating ${rows.length} rows for '${table}' into company_1...`);
        for (const row of rows) {
          const keys = Object.keys(row).filter(k => pgTypeMap[k] !== undefined);
          if (keys.length === 0) continue;
          const values = keys.map(k => sanitizeMigrationValue(row[k], pgTypeMap[k], k));
          const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
          const colList = keys.map(k => `"${k}"`).join(', ');

          try {
            await client.query(`
              INSERT INTO company_1."${table}" (${colList})
              VALUES (${placeholders})
              ON CONFLICT DO NOTHING
            `, values);
          } catch (e) {
            if (e.code !== '23505') {
              console.warn(`  ⚠ Row insert failed for company_1.${table} (id=${row.id ?? 'n/a'}):`, e.message);
            }
          }
        }
      }
    }
    await resyncSchemaSequences(client, 'company_1', companyTables);

    console.log('\n🎉 [MIGRATION COMPLETE] All SQLite data successfully migrated into PostgreSQL!');
  } catch (err) {
    console.error('❌ Migration encountered an error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrateSqliteToPostgres();
}

module.exports = migrateSqliteToPostgres;
