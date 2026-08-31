const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(
  './database/company_2.db',
  sqlite3.OPEN_READONLY,
  err => {
    if (err) {
      console.error('OPEN ERROR:', err.message);
      return;
    }

    const checks = [
      'PRAGMA journal_mode',
      'PRAGMA page_count',
      'PRAGMA page_size',
      'PRAGMA schema_version',
      'PRAGMA user_version',
      'PRAGMA wal_autocheckpoint'
    ];

    let i = 0;

    function next() {
      if (i >= checks.length) {
        db.close();
        return;
      }

      const sql = checks[i++];

      db.get(sql, (err, row) => {
        console.log('\nSQL:', sql);

        if (err) {
          console.log('ERROR:', err.message);
        } else {
          console.log(row);
        }

        next();
      });
    }

    next();
  }
);
