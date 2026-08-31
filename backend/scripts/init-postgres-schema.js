/**
 * Script: init-postgres-schema.js
 * Initializes Master tables and Company 1 schema in Neon / PostgreSQL
 */
const { Pool } = require('pg');
const { MASTER_TABLES } = require('../database/masterSchema');
const { COMPANY_TABLES, DEFAULT_LEDGER_CHART, DEFAULT_TAX_RATES } = require('../database/companySchema');
const bcrypt = require('bcryptjs');

async function initPostgresSchema() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  console.log('🚀 Connecting to PostgreSQL / Neon...');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    console.log('📦 1. Initializing Master Tables (public schema)...');
    await client.query('SET search_path TO public;');

    for (const tbl of MASTER_TABLES) {
      let pgSql = tbl.sql
        .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
        .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
        .replace(/DATETIME/gi, 'TIMESTAMP');

      await client.query(pgSql);
      console.log(`  ✓ Master Table '${tbl.name}' created`);
    }

    console.log('🏢 2. Seeding Master Company 1 & Admin...');
    const compCheck = await client.query('SELECT id FROM companies WHERE id = 1');
    if (compCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO companies (id, code, name, address, gst_number, contact, email, database_name, status)
        VALUES (1, 'COMP_BVC', 'BVC Exports Pvt Ltd', '123 Main Industrial Area', '33AABCB1234A1Z5', '9876543210', 'info@bvcexports.com', 'company_1', 'Active')
        ON CONFLICT DO NOTHING
      `);
      console.log('  ✓ Seeded Company 1');
    }

    const adminPass = await bcrypt.hash('admin123', 10);
    const staffPass = await bcrypt.hash('staff123', 10);

    await client.query(`
      INSERT INTO users (username, password_hash, role, company_id, status)
      VALUES 
        ('admin', $1, 'Admin', 1, 'Active'),
        ('staff', $2, 'Staff', 1, 'Active')
      ON CONFLICT DO NOTHING
    `, [adminPass, staffPass]);
    console.log('  ✓ Seeded Default Users (admin / staff)');

    console.log('🏭 3. Initializing Company 1 Tenant Schema (company_1)...');
    await client.query('CREATE SCHEMA IF NOT EXISTS company_1;');
    await client.query('SET search_path TO company_1, public;');

    for (const tblSql of COMPANY_TABLES) {
      let pgSql = tblSql
        .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
        .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
        .replace(/DATETIME/gi, 'TIMESTAMP')
        .replace(/REAL/gi, 'NUMERIC(15, 2)');

      await client.query(pgSql);
    }
    console.log('  ✓ Company 1 tables created');

    console.log('📊 4. Seeding Default Ledgers & Tax Rates...');
    for (const led of DEFAULT_LEDGER_CHART) {
      await client.query(`
        INSERT INTO ledgermaster (name, printname, under, ledger_type, openingbalance, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [led.name, led.printname, led.under, led.ledger_type, led.openingbalance, 'Active']);
    }

    for (const tax of DEFAULT_TAX_RATES) {
      await client.query(`
<<<<<<< HEAD
        INSERT INTO tax_master (tax_name, tax_percent, cgst, sgst, igst, status, hsn_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [tax.tax_name, tax.tax_percent, tax.cgst, tax.sgst, tax.igst, 'Active', '9999']);
=======
        INSERT INTO tax_master (tax_name, hsn_code, gst_rate, cgst_rate, sgst_rate, igst_rate, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [tax.tax_name, '9999', tax.tax_percent, tax.cgst, tax.sgst, tax.igst, 'Active']);
>>>>>>> origin/main
    }

    const now = new Date();
    const currYear = now.getFullYear();
    await client.query(`
      INSERT INTO financial_years (company_id, financial_year, start_date, end_date, is_active, is_current, is_locked)
      VALUES (1, $1, $2, $3, 1, 1, 0)
      ON CONFLICT DO NOTHING
    `, [`${currYear}-${currYear + 1}`, `${currYear}-04-01`, `${currYear + 1}-03-31`]);

    console.log('✅ PostgreSQL / Neon database schema initialization complete!');
  } catch (err) {
    console.error('❌ Error initializing PostgreSQL schema:', err);
<<<<<<< HEAD
=======
    throw err;
>>>>>>> origin/main
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  initPostgresSchema();
}

module.exports = initPostgresSchema;
