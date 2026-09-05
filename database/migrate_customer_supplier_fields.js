// Migration script: Add new fields to customer_master and supplier_master
// Usage: node database/migrate_customer_supplier_fields.js

const db = require('../backend/config/database');

async function migrate() {
  try {
    const columnsToAdd = [
      { name: 'email', def: 'TEXT' },
      { name: 'transport', def: 'TEXT' },
      { name: 'limit_days', def: 'INTEGER' },
      { name: 'limit_amount', def: 'REAL' },
      { name: 'balance_type', def: "TEXT DEFAULT 'Dr'" },
      { name: 'status', def: "TEXT DEFAULT 'Active'" },
    ];

    for (const table of ['customer_master', 'supplier_master']) {
      console.log(`\n--- Migrating ${table} ---`);
      
      // Check current columns
      const result = await db.query(`PRAGMA table_info(${table})`);
      const existingColumns = result.rows.map(r => r.name);
      console.log('Existing columns:', existingColumns);

      for (const col of columnsToAdd) {
        if (existingColumns.includes(col.name)) {
          console.log(`  ✅ ${col.name} already exists`);
          continue;
        }

        await db.query(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.def}`);
        console.log(`  ✅ Added "${col.name}"`);
      }

      // Verify
      const verify = await db.query(`PRAGMA table_info(${table})`);
      const newColumns = verify.rows.map(r => r.name);
      console.log('Updated columns:', newColumns);
    }

    console.log('\n🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
