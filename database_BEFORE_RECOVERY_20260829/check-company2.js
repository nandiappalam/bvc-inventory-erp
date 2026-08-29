const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(
  './database/company_2.db',
  sqlite3.OPEN_READONLY
);

db.get('PRAGMA integrity_check', (err, row) => {
  console.log('INTEGRITY:', err ? err.message : row);

  db.get('PRAGMA page_count', (err, row) => {
    console.log('PAGE_COUNT:', err ? err.message : row);

    db.get(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table'",
      (err, row) => {
        console.log('TABLES:', err ? err.message : row);
        db.close();
      }
    );
  });
});
