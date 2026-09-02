const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./database/bvc.db');
const hash = bcrypt.hashSync('admin123', 10);

// Get all companies first
db.all("SELECT id, name FROM companies", [], (err, companies) => {
  if (err) {
    console.error('Error:', err.message);
    db.close();
    return;
  }
  
  console.log('Found companies:', companies);
  
  let completed = 0;
  companies.forEach((company) => {
    // Check if admin exists for this company
    db.get(
      "SELECT id FROM users WHERE username = 'admin' AND company_id = ?",
      [company.id],
      (err, row) => {
        if (row) {
          // Update existing admin
          db.run(
            "UPDATE users SET password_hash = ? WHERE username = 'admin' AND company_id = ?",
            [hash, company.id],
            function(err) {
              console.log(`✅ Updated admin for company ${company.id}: ${company.name}`);
              completed++;
              if (completed === companies.length) db.close();
            }
          );
        } else {
          // Create new admin
          db.run(
            "INSERT INTO users (username, password_hash, role, company_id) VALUES (?, ?, ?, ?)",
            ['admin', hash, 'Admin', company.id],
            function(err) {
              console.log(`✅ Created admin for company ${company.id}: ${company.name}`);
              completed++;
              if (completed === companies.length) db.close();
            }
          );
        }
      }
    );
  });
});
