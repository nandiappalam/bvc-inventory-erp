const db = require('./config/database');

async function normalize() {
  console.log('Normalizing advances.papad_company to IDs...');
  
  // First, check current data
  const before = await db.query('SELECT papad_company FROM advances WHERE papad_company NOT GLOB \'[0-9]*\'');
  console.log('Rows to update:', before.rows);
  
// Safe update - only if match exists
  const result = await db.query(`
    UPDATE advances 
    SET papad_company = (
      SELECT id FROM papad_company_master 
      WHERE name = advances.papad_company LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1 FROM papad_company_master 
      WHERE name = advances.papad_company
    ) AND papad_company NOT GLOB '[0-9]*'
  `);
  
  console.log('Updated rows:', result.changes);
  
  // Verify
  const after = await db.query('SELECT papad_company FROM advances LIMIT 5');
  console.log('Sample after:', after.rows);
}

normalize().then(() => process.exit(0)).catch(console.error);
