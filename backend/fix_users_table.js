const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/bvc.db');
const db = new sqlite3.Database(dbPath, async (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  
  console.log('Connected to database');
  
  // Check users table schema
  db.all("PRAGMA table_info(users)", [], (err, rows) => {
    if (err) {
      console.error('Error getting table info:', err.message);
      process.exit(1);
    }
    console.log('Users table schema:', JSON.stringify(rows, null, 2));
    
    // Check if id is primary key
    const idColumn = rows.find(c => c.name === 'id');
    if (idColumn) {
      console.log('ID column:', idColumn);
      if (!idColumn.pk) {
        console.log('ID column is NOT a primary key! Fixing...');
        
        // Recreate users table with proper schema
        db.run("ALTER TABLE users RENAME TO users_old", (err) => {
          if (err) {
            console.error('Error renaming table:', err.message);
            process.exit(1);
          }
          
          db.run(`
            CREATE TABLE users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT UNIQUE NOT NULL,
              password_hash TEXT,
              role TEXT DEFAULT 'user',
              status TEXT DEFAULT 'Active',
              company_id INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (company_id) REFERENCES companies(id)
            )
          `, (err) => {
            if (err) {
              console.error('Error creating new table:', err.message);
              process.exit(1);
            }
            
            // Copy data from old table
            db.run(`
              INSERT INTO users (id, username, password_hash, role, status, company_id, created_at)
              SELECT id, username, password_hash, role, status, company_id, created_at FROM users_old
            `, (err) => {
              if (err) {
                console.error('Error copying data:', err.message);
                process.exit(1);
              }
              
              console.log('Users table recreated successfully!');
              
              // Verify
              db.all("SELECT * FROM users", [], (err, rows) => {
                console.log('Users after fix:', JSON.stringify(rows, null, 2));
                db.close();
                process.exit(0);
              });
            });
          });
        });
      } else {
        console.log('ID column is a primary key - schema looks correct');
        db.close();
        process.exit(0);
      }
    } else {
      console.log('No id column found!');
      db.close();
      process.exit(1);
    }
  });
});
