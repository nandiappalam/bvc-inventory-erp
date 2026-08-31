const db = require('../config/database');
const { MASTER_TABLES } = require('./masterSchema');
const { COMPANY_TABLES, DEFAULT_LEDGER_CHART, DEFAULT_TAX_RATES } = require('./companySchema');
const bcrypt = require('bcryptjs');

async function runAllPendingMigrations() {
  console.log('🔄 [MIGRATIONS] Starting safe database migration check...');

  try {
<<<<<<< HEAD
=======
    // The legacy runner below contains SQLite DDL and upsert syntax. PostgreSQL
    // startup must use its dedicated schema path instead of translating it.
    if (db.isPostgres) {
      const initializePostgresSchema = require('../scripts/init-postgres-schema');
      await initializePostgresSchema();
      return { success: true, engine: 'postgres' };
    }

>>>>>>> origin/main
    // 1. Ensure Master Database and tables
    const master = db.master;
    for (const tbl of MASTER_TABLES) {
      await master.run(tbl.sql);
    }
    console.log('✅ [MIGRATIONS] Master tables verified');

    // 2. Check if default company (Company 1) exists in Master DB
    const companies = await master.query('SELECT * FROM companies ORDER BY id ASC');
    let defaultCompanyId = 1;

    if (!companies.rows || companies.rows.length === 0) {
      console.log('🌱 [MIGRATIONS] Seeding initial Company 1 in Master DB...');
      const compRes = await master.run(
        `INSERT INTO companies (code, name, address, gst_number, contact, email, database_name, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'COMP_BVC',
          'BVC Exports Pvt Ltd',
          '123 Main Industrial Area, City',
          '33AABCB1234A1Z5',
          '9876543210',
          'info@bvcexports.com',
<<<<<<< HEAD
          'company_1.db',
=======
          'bvc.db',
>>>>>>> origin/main
          'Active'
        ]
      );
      defaultCompanyId = compRes.lastInsertRowid || 1;

      // Seed default admin and staff users in Master DB
      const adminPass = await bcrypt.hash('admin123', 10);
      const staffPass = await bcrypt.hash('staff123', 10);

      await master.run(
        `INSERT OR IGNORE INTO users (username, password_hash, role, company_id, status) VALUES (?, ?, ?, ?, ?)`,
        ['admin', adminPass, 'Admin', defaultCompanyId, 'Active']
      );
      await master.run(
        `INSERT OR IGNORE INTO users (username, password_hash, role, company_id, status) VALUES (?, ?, ?, ?, ?)`,
        ['staff', staffPass, 'Staff', defaultCompanyId, 'Active']
      );

      // Register Company 1 database
      await master.run(
        `INSERT OR REPLACE INTO database_registry (company_id, db_type, db_name, status) VALUES (?, ?, ?, ?)`,
<<<<<<< HEAD
        [defaultCompanyId, db.isPostgres ? 'postgres' : 'sqlite', db.isPostgres ? 'company_1' : 'company_1.db', 'Active']
=======
        [defaultCompanyId, 'sqlite', 'bvc.db', 'Active']
>>>>>>> origin/main
      );
      console.log(`✅ [MIGRATIONS] Initial Company ${defaultCompanyId} and users seeded`);
    } else {
      defaultCompanyId = companies.rows[0].id;
    }

    // 3. For all registered companies, ensure their database tables exist and are up to date
    const activeCompanies = await master.query('SELECT id, code, name, database_name FROM companies WHERE status != ?', ['Deleted']);
    
    for (const comp of (activeCompanies.rows || [])) {
      try {
        const compDb = db.forCompany(comp.id);
        
        // Ensure all ERP tables exist in this company database
        for (const tableSql of COMPANY_TABLES) {
          await compDb.run(tableSql);
        }

        // Ensure default ledgers exist
        for (const led of DEFAULT_LEDGER_CHART) {
          await compDb.run(
            `INSERT OR IGNORE INTO ledgermaster (name, printname, under, ledger_type, openingbalance, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [led.name, led.printname, led.under, led.ledger_type, led.openingbalance, 'Active']
          );
        }

        // Ensure default taxes exist
        for (const tax of DEFAULT_TAX_RATES) {
          await compDb.run(
<<<<<<< HEAD
            `INSERT OR IGNORE INTO tax_master (tax_name, tax_percent, cgst, sgst, igst, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [tax.tax_name, tax.tax_percent, tax.cgst, tax.sgst, tax.igst, 'Active']
          );
        }

        // Run auto-migrations in company context
        if (db.companyStorage) {
=======
            `INSERT OR IGNORE INTO tax_master (tax_name, hsn_code, gst_rate, cgst_rate, sgst_rate, igst_rate, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [tax.tax_name, '9999', tax.tax_percent, tax.cgst, tax.sgst, tax.igst, 'Active']
          );
        }

        // The legacy auto-migrator also seeds and reconciles business data.
        // It is not a startup migration and may be run only explicitly.
        if (process.env.RUN_LEGACY_AUTO_MIGRATIONS === 'true' && db.companyStorage) {
>>>>>>> origin/main
          await db.companyStorage.run({ companyId: comp.id }, async () => {
            const autoMigrate = require('../autoMigrate');
            await autoMigrate();
          });
        }

        // Update database registry
        await master.run(
          `INSERT OR REPLACE INTO database_registry (company_id, db_type, db_name, status, last_migrated_at) 
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [comp.id, 'sqlite', comp.database_name || `company_${comp.id}.db`, 'Active']
        );

        console.log(`✅ [MIGRATIONS] Company ${comp.id} (${comp.name}) database verified and up-to-date`);
      } catch (compErr) {
<<<<<<< HEAD
        console.error(`⚠️ [MIGRATIONS] Warning migrating company ${comp.id}:`, compErr.message);
      }
    }

    // Also run existing legacy autoMigrate for any extra column migrations
    try {
      const autoMigrate = require('../autoMigrate');
      await autoMigrate();
    } catch (migErr) {
      console.log('Notice running legacy autoMigrate:', migErr.message);
=======
        console.error(`❌ [MIGRATIONS] Company ${comp.id} migration failed:`, compErr.message);
        throw compErr;
      }
    }

    // Keep legacy data-changing reconciliation out of ordinary application
    // starts and deployments. Operators can opt in for a reviewed repair run.
    if (process.env.RUN_LEGACY_AUTO_MIGRATIONS === 'true') {
      try {
        const autoMigrate = require('../autoMigrate');
        await autoMigrate();
      } catch (migErr) {
        console.log('Notice running legacy autoMigrate:', migErr.message);
      }
>>>>>>> origin/main
    }

    console.log('🎉 [MIGRATIONS] All database migrations completed safely with zero data loss');
    return { success: true };
  } catch (err) {
    console.error('❌ [MIGRATIONS] Migration error:', err);
    throw err;
  }
}

module.exports = {
  runAllPendingMigrations
};
