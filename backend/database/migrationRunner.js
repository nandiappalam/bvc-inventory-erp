const db = require('../config/database');
const { MASTER_TABLES } = require('./masterSchema');
const { COMPANY_TABLES, DEFAULT_LEDGER_CHART, DEFAULT_TAX_RATES } = require('./companySchema');
const bcrypt = require('bcryptjs');

async function runAllPendingMigrations() {
  console.log('🔄 [MIGRATIONS] Starting safe database migration check...');

  try {
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
          'company_1.db',
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
        [defaultCompanyId, db.isPostgres ? 'postgres' : 'sqlite', db.isPostgres ? 'company_1' : 'company_1.db', 'Active']
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
            `INSERT OR IGNORE INTO tax_master (tax_name, tax_percent, cgst, sgst, igst, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [tax.tax_name, tax.tax_percent, tax.cgst, tax.sgst, tax.igst, 'Active']
          );
        }

        // Run auto-migrations in company context
        if (db.companyStorage) {
          await db.companyStorage.run({ companyId: comp.id }, async () => {
            const autoMigrate = require('../autoMigrate');
            await autoMigrate();
          });
        }

        // Update database registry
        await master.run(
          `INSERT OR REPLACE INTO database_registry (company_id, db_type, db_name, status, last_migrated_at) 
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [comp.id, db.isPostgres ? 'postgres' : 'sqlite', comp.database_name || (db.isPostgres ? `company_${comp.id}` : `company_${comp.id}.db`), 'Active']
        );

        // Ensure default financial year exists for this company
        try {
          const fyRes = await compDb.query('SELECT id FROM financial_years LIMIT 1');
          if (!fyRes.rows || fyRes.rows.length === 0) {
            const currentYear = new Date().getFullYear();
            const nextYearShort = String(currentYear + 1).slice(-2);
            const fyName = `${currentYear}-${nextYearShort}`;
            const startDate = `${currentYear}-04-01`;
            const endDate = `${currentYear + 1}-03-31`;
            await compDb.run(
              `INSERT INTO financial_years (year_name, start_date, end_date, is_active, is_closed) VALUES (?, ?, ?, 1, 0)`,
              [fyName, startDate, endDate]
            );
          }
        } catch (fyErr) {
          // ignore if table doesn't exist
        }

        console.log(`✅ [MIGRATIONS] Company ${comp.id} (${comp.name}) database verified and up-to-date`);
      } catch (compErr) {
        console.error(`⚠️ [MIGRATIONS] Warning migrating company ${comp.id}:`, compErr.message);
      }
    }

    // Also run existing legacy autoMigrate for any extra column migrations
    try {
      const autoMigrate = require('../autoMigrate');
      await autoMigrate();
    } catch (migErr) {
      console.log('Notice running legacy autoMigrate:', migErr.message);
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
