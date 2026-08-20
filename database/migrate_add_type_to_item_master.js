// Migration script: Add 'type' column to item_master table
// Usage: node database/migrate_add_type_to_item_master.js

const db = require('../backend/config/database');

async function migrate() {
  try {
    // Check if 'type' column already exists
    const result = await db.query(`PRAGMA table_info(item_master)`);
    const columns = result.rows.map(r => r.name);

    if (columns.includes('type')) {
      console.log('✅ type column already exists in item_master');
      return;
    }

    // Add the type column
    await db.query(`ALTER TABLE item_master ADD COLUMN type TEXT DEFAULT 'Urad'`);
    console.log('✅ Added "type" column to item_master with default "Urad"');

    // Verify
    const verify = await db.query(`PRAGMA table_info(item_master)`);
    const newColumns = verify.rows.map(r => r.name);
    console.log('Current item_master columns:', newColumns);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
