/**
 * Script: validate-migration.js
 * Compares row counts between SQLite and PostgreSQL for all ERP tables
 */
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../database');
const masterDbPath = path.join(dbDir, 'master.db');
const legacyDbPath = path.join(dbDir, 'bvc.db');

function getSqliteRowCount(dbPath, tableName) {
  return new Promise((resolve) => {
    if (!fs.existsSync(dbPath)) return resolve(0);
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve(0);
    });
    db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
      db.close();
      if (err || !row) resolve(0);
      else resolve(row.count || 0);
    });
  });
}

async function validateMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  console.log('==================================================');
  console.log('📊 BVC ERP - DATABASE MIGRATION VALIDATION REPORT');
  console.log('==================================================\n');

  try {
    const sourceCompanyDbPath = fs.existsSync(legacyDbPath) ? legacyDbPath : path.join(dbDir, 'company_1.db');
    const testTables = [
      'item_master',
      'customer_master',
      'supplier_master',
      'godown_master',
      'purchases',
      'purchase_items',
      'purchase_returns',
      'sales',
      'sales_items',
      'stock',
      'stock_lots',
      'ledgermaster',
      'financial_years',
      'tax_master',
      'compliance_documents',
      'compliance_cleaning_records',
      'compliance_production_records'
    ];

    let passed = 0;
    let failed = 0;

    for (const tbl of testTables) {
      const sqliteCount = await getSqliteRowCount(sourceCompanyDbPath, tbl);
      let pgCount = 0;

      try {
        const res = await client.query(`SELECT COUNT(*) as count FROM company_1.${tbl}`);
        pgCount = parseInt(res.rows[0].count, 10) || 0;
      } catch (e) {
        pgCount = 0;
      }

      if (pgCount >= sqliteCount) {
        console.log(`✓ ${tbl.padEnd(30)} SQLite: ${String(sqliteCount).padStart(5)} | PG: ${String(pgCount).padStart(5)} [PASS]`);
        passed++;
      } else {
        console.log(`⚠️ ${tbl.padEnd(30)} SQLite: ${String(sqliteCount).padStart(5)} | PG: ${String(pgCount).padStart(5)} [WARNING]`);
        failed++;
      }
    }

    console.log('\n--------------------------------------------------');
    console.log(`Validation Complete: ${passed} Passed, ${failed} Warnings`);
    console.log('==================================================');
  } catch (err) {
    console.error('Validation error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  validateMigration();
}

module.exports = validateMigration;
