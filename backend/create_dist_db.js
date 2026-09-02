/**
 * Create Pre-populated Database for Distribution
 * Run this to create a database file with default admin user
 * 
 * Run: node backend/create_dist_db.js
 * Output: database/dist-db.db (include this with your installer)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const outputPath = path.join(__dirname, '..', 'database', 'dist-db.db');

// Ensure database directory exists
const dbDir = path.dirname(outputPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Delete existing file if exists
if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath);
}

console.log('Creating distribution database...');
console.log('Output:', outputPath);

const db = new sqlite3.Database(outputPath);

db.serialize(() => {
  // Create companies table
  db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      contact TEXT,
      email TEXT,
      gst_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )
  `);

  // Create default company
  db.run(
    "INSERT INTO companies (name, address, contact) VALUES (?, ?, ?)",
    ["BVC Company", "", ""],
    function(err) {
      if (err) {
        console.error('Error creating company:', err.message);
        return;
      }
      
      const companyId = this.lastID;
      console.log('Created company with ID:', companyId);
      
      // Create admin user with hashed password
      const adminHash = bcrypt.hashSync('admin123', 10);
      db.run(
        "INSERT INTO users (company_id, username, password_hash, role) VALUES (?, ?, ?, ?)",
        [companyId, 'admin', adminHash, 'admin'],
        function(err) {
          if (err) {
            console.error('Error creating admin user:', err.message);
            return;
          }
          
          console.log('Created admin user');
          console.log('Username: admin');
          console.log('Password: admin123');
          
          // Create additional tables that might be needed
          createAdditionalTables(db, () => {
            db.close();
            console.log('\n✅ Distribution database created successfully!');
            console.log('📦 File:', outputPath);
            console.log('\n📋 Include this file in your installer.');
            console.log('   On first run, the app will copy it to the user\'s data folder.');
          });
        }
      );
    }
  );
});

function createAdditionalTables(db, callback) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS area_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area_name TEXT NOT NULL,
      status TEXT DEFAULT 'Active'
    )`,
    `CREATE TABLE IF NOT EXISTS city_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city_name TEXT NOT NULL,
      status TEXT DEFAULT 'Active'
    )`,
    `CREATE TABLE IF NOT EXISTS customer_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      contact TEXT,
      status TEXT DEFAULT 'Active'
    )`,
    `CREATE TABLE IF NOT EXISTS supplier_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      contact TEXT,
      status TEXT DEFAULT 'Active'
    )`,
    `CREATE TABLE IF NOT EXISTS item_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      item_group TEXT,
      status TEXT DEFAULT 'Active'
    )`,
    `CREATE TABLE IF NOT EXISTS ledgermaster (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ledger_name TEXT NOT NULL,
      ledger_group TEXT,
      status TEXT DEFAULT 'Active'
    )`
  ];
  
  let completed = 0;
  tables.forEach(sql => {
    db.run(sql, () => {
      completed++;
      if (completed === tables.length) {
        callback();
      }
    });
  });
}
