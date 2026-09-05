// Migration script: Add new fields to deduction_purchase table
// Usage: node database/migrate_deduction_purchase_fields.js

const db = require('../backend/config/database');

async function migrate() {
  try {
    const columnsToAdd = [
      { name: 'affect_cost_of_goods', def: "TEXT DEFAULT 'No'" },
      { name: 'type', def: "TEXT DEFAULT 'Add'" },
      { name: 'debit_side_adjust', def: "TEXT DEFAULT 'None'" },
      { name: 'deduction_type', def: "TEXT DEFAULT 'Add'" },
      { name: 'calculation_type', def: "TEXT DEFAULT 'Percentage'" },
      { name: 'deduction_value', def: 'REAL DEFAULT 0' },
      { name: 'status', def: "TEXT DEFAULT 'Active'" },
    ];

    // Check current columns
    const result = await db.query(`PRAGMA table_info(deduction_purchase)`);
    const existingColumns = result.rows.map(r => r.name);
    console.log('Existing columns:', existingColumns);

    for (const col of columnsToAdd) {
      if (existingColumns.includes(col.name)) {
        console.log(`✅ ${col.name} already exists in deduction_purchase`);
        continue;
      }

      await db.query(`ALTER TABLE deduction_purchase ADD COLUMN ${col.name} ${col.def}`);
      console.log(`✅ Added "${col.name}" column to deduction_purchase`);
    }

    // Verify
    const verify = await db.query(`PRAGMA table_info(deduction_purchase)`);
    const newColumns = verify.rows.map(r => r.name);
    console.log('Updated deduction_purchase columns:', newColumns);
    console.log('\n🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();

