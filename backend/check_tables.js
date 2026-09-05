const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/bvc.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('Tables in database:');
    rows.forEach(r => console.log('  -', r.name));
  }
  db.close();
});
