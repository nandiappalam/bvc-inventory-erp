const db = require('./config/database');

async function testCompanies() {
  console.log('Testing companies table...');
  
  try {
    // Check if companies table exists
    const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Available tables:', tables.rows.map(t => t.name));
    
    // Try to query companies
    const companies = await db.query('SELECT * FROM companies');
    console.log('Companies:', companies.rows);
    
    console.log('Test passed!');
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

testCompanies();
