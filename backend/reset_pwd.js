const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./database/bvc.db');
const hash = bcrypt.hashSync('admin123', 10);

console.log('Resetting password...');

db.run("UPDATE users SET password_hash = ? WHERE username = 'admin' AND company_id = 1", [hash], function(err) {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('Password reset to admin123 for company 1 admin user');
  }
  db.close();
});
