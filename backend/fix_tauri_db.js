const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// This is the correct Tauri database path
const db = new sqlite3.Database('C:\\Users\\MY-PC\\AppData\\Roaming\\BVC ERP\\database\\bvc.db');
const hash = bcrypt.hashSync('admin123', 10);

console.log('Fixing admin password in Tauri database...');

db.serialize(() => {
  // First, let's see what companies exist
  db.all("SELECT id, name FROM companies", [], (err, companies) => {
    if (err) {
      console.error('Error:', err.message);
      db.close();
      return;
    }
    
    console.log('Companies found:', companies);
    
    // For each company, create/update admin user
    let completed = 0;
    companies.forEach((company) => {
      // Check if admin exists
      db.get(
        "SELECT id FROM users WHERE username = 'admin' AND company_id = ?",
        [company.id],
        (err, row) => {
          if (row) {
            // Update password
            db.run(
              "UPDATE users SET password_hash = ? WHERE username = 'admin' AND company_id = ?",
              [hash, company.id],
              function(err) {
                console.log(`✅ Updated admin for company ${company.id}: ${company.name}`);
                completed++;
                if (completed === companies.length) {
                  console.log('\n✅ All done! Login with admin/admin123 for any company');
                  db.close();
                }
              }
            );
          } else {
            // Insert new admin
            db.run(
              "INSERT INTO users (username, password_hash, role, company_id) VALUES (?, ?, ?, ?)",
              ['admin', hash, 'Admin', company.id],
              function(err) {
                console.log(`✅ Created admin for company ${company.id}: ${company.name}`);
                completed++;
                if (completed === companies.length) {
                  console.log('\n✅ All done! Login with admin/admin123 for any company');
                  db.close();
                }
              }
            );
          }
        }
      );
    });
  });
});
