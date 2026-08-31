const db = require('./config/database');
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../database/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

const statements = schema.split(';').filter(s => s.trim());

async function initSchema() {
  console.log('Initializing database schema...');
  
  for (const sql of statements) {
    if (sql.trim()) {
      try {
        await db.run(sql);
        console.log('Executed:', sql.substring(0, 50) + '...');
      } catch (e) {
        console.log('Error:', e.message);
      }
    }
  }
  
  // Verify tables
  const result = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('\nAvailable tables:');
  result.rows.forEach(r => console.log('  -', r.name));
  
  process.exit(0);
}

initSchema().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
