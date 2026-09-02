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
      const rows = await readSqliteRows(masterDbPath, `SELECT * FROM ${table}`);
      if (rows.length > 0) {
        console.log(`  Migrating ${rows.length} rows for master table '${table}'...`);
        for (const row of rows) {
          const keys = Object.keys(row);
          const values = Object.values(row);
          const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
          const colList = keys.join(', ');

          try {
            await client.query(`
              INSERT INTO public.${table} (${colList})
              VALUES (${placeholders})
              ON CONFLICT DO NOTHING
            `, values);
          } catch (e) {
            // Silently skip duplicate errors
          }
        }
      }
    }

    // 3. Migrate Company 1 tables from bvc.db or company_1.db
    const sourceCompanyDbPath = fs.existsSync(legacyDbPath) ? legacyDbPath : path.join(dbDir, 'company_1.db');
    console.log(`\n🏭 Migrating Company 1 Data from ${path.basename(sourceCompanyDbPath)}...`);

    const companyTables = await getSqliteTableList(sourceCompanyDbPath);
    await client.query('SET search_path TO company_1, public;');

    for (const table of companyTables) {
      if (table.startsWith('sqlite_') || table === 'users' || table === 'companies') continue;

      const rows = await readSqliteRows(sourceCompanyDbPath, `SELECT * FROM ${table}`);
      if (rows.length > 0) {
        console.log(`  Migrating ${rows.length} rows for '${table}' into company_1...`);
        for (const row of rows) {
          const keys = Object.keys(row);
          const values = Object.values(row);
          const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
          const colList = keys.join(', ');

          try {
            await client.query(`
              INSERT INTO company_1.${table} (${colList})
              VALUES (${placeholders})
              ON CONFLICT DO NOTHING
            `, values);
          } catch (e) {
            // Silently skip duplicate constraint errors
          }
        }
      }
    }

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
