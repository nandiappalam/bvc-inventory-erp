/**
 * Fix Database Schema - Change UNIQUE constraint on users table
 * Also resets admin password to admin123
 * 
 * Run: node backend/fix_users_constraint.js
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'bvc.db');

console.log('Fixing database schema...');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  console.log('\n1. Checking existing indexes...');
  db.all("PRAGMA index_list(users)", [], (err, indexes) => {
    if (err) {
      console.error('Error getting indexes:', err.message);
      return;
    }
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));
    
    const dropPromises = indexes
      .filter(idx => idx.name && idx.name.toLowerCase().includes('username'))
      .map(idx => {
        return new Promise((resolve) => {
          console.log('\n2. Dropping old index:', idx.name);
          db.run(DROP INDEX IF EXISTS , (err) => {
            if (err) console.error('Error dropping index:', err.message);
            resolve();
          });
        });
      });
    
    Promise.all(dropPromises).then(() => {
      console.log('\n3. Creating new composite unique index...');
      db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_company_username ON users(username, company_id)', (err) => {
        if (err) {
          console.error('Error creating index:', err.message);
        } else {
          console.log('Index created successfully!');
        }
        
        console.log('\n4. Current users in database:');
        db.all('SELECT id, username, company_id FROM users', [], (err, users) => {
          if (err) {
            console.error('Error getting users:', err.message);
          } else {
            console.log(users);
          }
          
          console.log('\n Database schema fixed!');
          
          const hash = bcrypt.hashSync('admin123', 10);
          console.log('\n5. Resetting admin password for company 1...');
          db.run(
            "UPDATE users SET password_hash = ? WHERE username = 'admin' AND company_id = 1",
            [hash],
            function(err) {
              if (err) {
                console.error('Error resetting password:', err.message);
              } else {
                console.log(' Password reset successful!');
                console.log('Username: admin');
                console.log('Password: admin123');
              }
              db.close();
            }
          );
        });
      });
    });
  });
});
