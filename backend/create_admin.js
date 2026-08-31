const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./database/bvc.db');
const hash = bcrypt.hashSync('admin123', 10);

console.log('Creating fresh admin user for company 1...');

// First delete any existing admin for company 1
db.run("DELETE FROM users WHERE username = 'admin' AND company_id = 1", function(err) {
  if (err) console.error('Error deleting:', err.message);
  
  // Insert fresh admin user
  db.run(
    "INSERT INTO users (username, password_hash, role, company_id) VALUES (?, ?, ?, ?)",
    ['admin', hash, 'Admin', 1],
    function(err) {
      if (err) {
        console.error('Error inserting:', err.message);
      } else {
        console.log('✅ Admin user created successfully!');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('Company: asm (id=1)');
      }
      db.close();
    }
  );
});
