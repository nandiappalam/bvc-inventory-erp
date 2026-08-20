const db = require('./config/database');

async function testUsers() {
  try {
    console.log('=== Testing Users Table ===');
    
    // Check all users
    const users = await db.query('SELECT * FROM users');
    console.log('All users:', JSON.stringify(users.rows, null, 2));
    
    // Check companies
    const companies = await db.query('SELECT * FROM companies');
    console.log('All companies:', JSON.stringify(companies.rows, null, 2));
    
    // Try to insert a test user directly
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('test123', 10);
    
    try {
      const result = await db.run(
        'INSERT INTO users (username, password_hash, role, status, company_id) VALUES (?, ?, ?, ?, ?)',
        ['testuser_' + Date.now(), passwordHash, 'User', 'Active', 3]
      );
      console.log('Direct insert success! User ID:', result.lastID);
    } catch (e) {
      console.log('Direct insert error:', e.message);
    }
    
    // Check users again
    const usersAfter = await db.query('SELECT * FROM users');
    console.log('Users after insert:', JSON.stringify(usersAfter.rows, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

testUsers();
